/**
 * PF2e Mobile Sheet (Compact) - Kingdom Actions & Dice Execution Engine
 * Robust dual-tier execution pipeline supporting pf2e-kingmaker-tools with
 * proper DOM attachment, synthetic event propagation, and native PF2e
 * campaign statistic fallback, plus physical dice interception.
 */

import { PhysicalDiceManager } from "../rolls/physical-dice-interceptor.js";
import { ensureSafeCanvasTokens } from "../utils/sheet-utils.js";
import { getPartyActor, getKingdomName, getOrInitKingdomApp } from "./kingdom-context.js";

/**
 * Robust dispatcher for Kingdom sheet actions.
 * Prioritizes pf2e-kingmaker-tools when active with proper DOM attachment,
 * falling back seamlessly to native PF2e partyActor.campaign statistics.
 *
 * @param {object} sheet - The mobile sheet instance.
 * @param {Event} event - The triggering UI event.
 * @param {object} actionData - Dataset attributes for the action.
 * @param {string|null} [rollTitle=null] - Optional label for PhysicalDice interception.
 */
export async function dispatchKingdomSheetAction(sheet, event, actionData, rollTitle = null) {
  const partyActor = getPartyActor(sheet.actor) || sheet.actor;
  if (!partyActor) return;

  // Guarantee canvas.tokens exists and has safe defaults with zero controlled tokens
  // so Kingdom turn checks never query, require, or roll from a token.
  ensureSafeCanvasTokens();

  const kmApp = await getOrInitKingdomApp(partyActor, true);

  // --- Tier 1: Delegate directly to pf2e-kingmaker-tools buttons/action handlers ---
  if (kmApp && (typeof kmApp._onClickAction === "function" || kmApp.element)) {
    let targetBtn = null;
    let isTempBtn = false;

    // 1. Look for existing button matching this action in kmApp's rendered DOM
    if (kmApp.element?.querySelector) {
      let found = null;
      if (actionData.skill) {
        found = kmApp.element.querySelector(`[data-action="${actionData.action}"][data-skill="${actionData.skill}"]`);
      } else if (actionData.activity) {
        found = kmApp.element.querySelector(`[data-action="${actionData.action}"][data-activity="${actionData.activity}"]`);
      } else if (actionData.id) {
        found = kmApp.element.querySelector(`[data-action="${actionData.action}"][data-id="${actionData.id}"]`);
      } else if (actionData.index !== undefined) {
        found = kmApp.element.querySelector(`[data-action="${actionData.action}"][data-index="${actionData.index}"]`);
      } else {
        found = kmApp.element.querySelector(`[data-action="${actionData.action}"]`);
      }
      if (found?.dataset && found.dataset.action === actionData.action) {
        targetBtn = found;
      }
    }

    // 2. If button is not currently rendered in kmApp DOM, create and attach temporary button
    if (!targetBtn) {
      targetBtn = typeof document !== "undefined" && typeof document.createElement === "function"
        ? document.createElement("button")
        : { dataset: {} };
      isTempBtn = true;

      const targetParent = kmApp.form || kmApp.element;
      if (targetParent && typeof targetParent.appendChild === "function") {
        try {
          targetParent.appendChild(targetBtn);
        } catch {}
      }
    }

    targetBtn.dataset ??= {};
    for (const [key, val] of Object.entries(actionData)) {
      if (val !== undefined && val !== null) {
        targetBtn.dataset[key] = String(val);
      }
    }

    // Synchronize active leader and active settlement dropdowns on kmApp if set
    try {
      const targetParent = kmApp.form || kmApp.element;
      if (sheet._activeKingdomLeader && targetParent?.querySelector) {
        const leaderSelect = targetParent.querySelector('select[name="activeLeader"]');
        if (leaderSelect && leaderSelect.value !== sheet._activeKingdomLeader) {
          leaderSelect.value = sheet._activeKingdomLeader;
          leaderSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      if (sheet._activeKingdomSettlement && targetParent?.querySelector) {
        const settleSelect = targetParent.querySelector('select[name="activeSettlement"]');
        if (settleSelect && settleSelect.value !== sheet._activeKingdomSettlement) {
          settleSelect.value = sheet._activeKingdomSettlement;
          settleSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    } catch {}

    sheet._pendingKingdomRollTitle = rollTitle;

    // Create a safe synthetic event matching Foundry's ApplicationV2 action dispatch
    const syntheticEvent = {
      preventDefault: () => {},
      stopPropagation: () => {},
      stopImmediatePropagation: () => {},
      target: targetBtn,
      currentTarget: targetBtn,
      shiftKey: Boolean(event?.shiftKey),
      ctrlKey: Boolean(event?.ctrlKey),
      metaKey: Boolean(event?.metaKey),
      altKey: Boolean(event?.altKey)
    };

    const runAction = async () => {
      ensureSafeCanvasTokens();
      // Ensure canvas has zero controlled tokens during kingdom action execution so checks
      // originate strictly from the sheet without requiring or querying any token.
      const canvasObj = typeof canvas !== "undefined" ? canvas : null;
      const origControlled = canvasObj?.tokens?.controlled;
      try {
        if (canvasObj?.tokens) {
          canvasObj.tokens.controlled = [];
        }
        if (typeof kmApp._onClickAction === "function") {
          await kmApp._onClickAction(syntheticEvent, targetBtn);
        } else if (typeof targetBtn.click === "function") {
          targetBtn.click();
        }
      } finally {
        if (canvasObj?.tokens && origControlled) {
          canvasObj.tokens.controlled = origControlled;
        }
      }
    };

    try {
      if (rollTitle) {
        await PhysicalDiceManager.withPhysicalMode({
          title: rollTitle,
          actor: partyActor
        }, runAction, sheet.rollMode === "physical" || sheet._rollMode === "physical");
      } else {
        await runAction();
      }

      // Check if a modal dialog opened to avoid synchronous re-render collision
      const hasOpenDialog = Array.from(foundry.applications?.instances?.values?.() ?? [])
        .some((app) => app?.constructor?.name === "KingdomCheckDialog" || app?.element?.querySelector?.(".km-check-dialog"));

      if (!hasOpenDialog && sheet.rendered) {
        sheet.render({ parts: ["header", "sheet"] });
      }
      return;
    } catch (err) {
      console.warn("PF2e Mobile Compact | pf2e-kingmaker-tools action failed; falling back to sheet campaign roll:", err);
    } finally {
      if (isTempBtn && targetBtn?.parentNode) {
        try {
          targetBtn.parentNode.removeChild(targetBtn);
        } catch {}
      }
    }
  }

  // --- Tier 2: Native PF2e Campaign Fallback (Direct from Sheet) ---
  await fallbackNativeKingdomRoll(partyActor, actionData, event);
  if (sheet.rendered) {
    sheet.render({ parts: ["header", "sheet"] });
  }
}

/**
 * Native PF2e fallback that rolls directly from the Party actor's sheet without tokens.
 */
async function fallbackNativeKingdomRoll(partyActor, actionData, event) {
  const campaign = partyActor.campaign || partyActor.system?.campaign;
  if (!campaign) {
    ui.notifications?.warn?.("Kingdom campaign data is not available on this party actor.");
    return;
  }

  // Fallback A: Skill Checks
  if (actionData.action === "roll-skill-check" && actionData.skill) {
    const slug = String(actionData.skill).toLowerCase();
    const stat = campaign.skills?.[slug] || campaign.skills?.[actionData.skill];
    if (stat) {
      if (typeof stat.roll === "function") {
        return stat.roll({ event });
      }
      if (typeof stat.check?.roll === "function") {
        return stat.check.roll({ event });
      }
    }
  }

  // Fallback B: Activities
  if (actionData.action === "perform-activity" && actionData.activity) {
    const actId = actionData.activity;
    if (typeof campaign.rollAction === "function") {
      return campaign.rollAction(event, actId);
    }
    const item = partyActor.items?.get?.(actId)
      || partyActor.itemTypes?.campaignFeature?.find?.((i) => i.id === actId || i.slug === actId);
    if (item) {
      if (typeof item.roll === "function") return item.roll(event);
      if (typeof item.toMessage === "function") return item.toMessage(event);
    }
    const pack = game.packs?.get?.("pf2e.kingmaker-features");
    if (pack) {
      const compItem = await pack.getDocument(actId).catch(() => null);
      if (compItem) {
        if (typeof compItem.roll === "function") return compItem.roll(event);
        if (typeof compItem.toMessage === "function") return compItem.toMessage(event);
      }
    }
  }

  ui.notifications?.warn?.(`Action "${actionData.action}" could not be completed.`);
}

/**
 * Rolls a Kingdom skill check.
 */
export async function onRollKingdomSkillCheck(sheet, event, target) {
  const skillSlug = target.dataset.skill;
  const skillLabel = target.dataset.label || skillSlug || "Kingdom Skill";
  await dispatchKingdomSheetAction(
    sheet,
    event,
    { action: "roll-skill-check", skill: skillSlug },
    `${skillLabel} Check`
  );
}

/**
 * Performs a Kingdom activity (d20 check or direct administrative execution).
 */
export async function onPerformKingdomActivity(sheet, event, target) {
  event?.stopPropagation?.();
  const activityId = target.dataset.activityId;
  const activityName = target.dataset.activityName || "Kingdom Activity";
  await dispatchKingdomSheetAction(
    sheet,
    event,
    { action: "perform-activity", activity: activityId },
    activityName
  );
}

/**
 * Rolls Kingdom Resource Dice into chat.
 */
export async function onRollKingdomResourceDice(sheet, event) {
  event?.stopPropagation?.();
  const partyActor = getPartyActor(sheet.actor);
  if (!partyActor) return;

  const flag = partyActor.getFlag?.("pf2e-kingmaker-tools", "kingdom-sheet")
    || partyActor.flags?.["pf2e-kingmaker-tools"]?.["kingdom-sheet"]
    || {};
  const campaign = partyActor.system?.campaign;

  const level = Number(flag.level ?? campaign?.level ?? 1);
  const count = level + 4;
  const bonus = Number(flag.resourceDice?.bonus ?? campaign?.resourceDice?.bonus ?? 0);
  const formula = bonus ? `${count}d6 + ${bonus}` : `${count}d6`;

  const rollAction = async () => {
    const roll = new Roll(formula);
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: partyActor }),
      flavor: `<strong>Kingdom Resource Dice</strong> (Level ${level})`
    });
  };

  await PhysicalDiceManager.withPhysicalMode({
    title: "Kingdom Resource Dice",
    actor: partyActor
  }, rollAction, sheet.rollMode === "physical" || sheet._rollMode === "physical");
}

/**
 * Posts the activity's details or official chat card to chat.
 */
export async function onPostKingdomActivityChat(sheet, event, target) {
  event?.stopPropagation?.();
  const activityId = target.dataset.activityId;
  const partyActor = getPartyActor(sheet.actor);
  if (!partyActor || !activityId) return;

  // Check if item exists on party
  const item = partyActor.items?.get?.(activityId)
    || partyActor.itemTypes?.campaignFeature?.find?.((i) => i.id === activityId || i.slug === activityId);
  if (item && typeof item.toMessage === "function") {
    return item.toMessage(event);
  }

  // Check compendium pack
  const pack = game.packs?.get?.("pf2e.kingmaker-features");
  if (pack) {
    const compItem = await pack.getDocument(activityId).catch(() => null);
    if (compItem && typeof compItem.toMessage === "function") {
      return compItem.toMessage(event);
    }
  }

  // Fallback: post activity text from kmApp context
  const kmApp = await getOrInitKingdomApp(partyActor, false);
  const km = (kmApp && typeof kmApp._preparePartContext === "function")
    ? await kmApp._preparePartContext("form", {}, {})
    : {};
  const allActs = Object.values(km.activities || {}).flat();
  const act = allActs.find((a) => a?.id === activityId);
  if (act) {
    const name = act.name || act.displayName || act.label || "Kingdom Activity";
    const desc = act.description || "";
    const content = `
      <div class="pf2e chat-card">
        <header class="card-header">
          <h3>${foundry.utils.escapeHTML(name)}</h3>
        </header>
        <div class="card-content">
          ${desc}
        </div>
      </div>`;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: partyActor }),
      content
    });
  }
}

/**
 * Skips collecting taxes and rolls to reduce unrest.
 */
export async function onSkipCollectTaxes(sheet, event) {
  event?.stopPropagation?.();
  await dispatchKingdomSheetAction(sheet, event, { action: "skip-collect-taxes" }, "Skip Collect Taxes");
}

/**
 * Claims a kingdom refuge (+1 Fame).
 */
export async function onClaimKingdomRefuge(sheet, event) {
  event?.stopPropagation?.();
  await dispatchKingdomSheetAction(sheet, event, { action: "claimed-refuge" });
}

/**
 * Claims a kingdom landmark.
 */
export async function onClaimKingdomLandmark(sheet, event) {
  event?.stopPropagation?.();
  await dispatchKingdomSheetAction(sheet, event, { action: "claimed-landmark" }, "Claimed Landmark");
}

/**
 * Updates a Kingdom or Kingmaker Tools field directly from mobile input/select changes.
 */
export async function onUpdateKingdomField(sheet, event, target) {
  const partyActor = getPartyActor(sheet.actor);
  if (!partyActor) return;

  const field = target.dataset?.fieldName || target.dataset?.field || target.name;
  if (!field) return;

  let val;
  if (target.type === "checkbox") {
    val = Boolean(target.checked);
  } else if (target.dataset?.dtype === "Boolean") {
    val = target.value === "true" || target.value === "1";
  } else if (target.dataset?.dtype === "Number" || target.type === "number") {
    const parsed = Number(target.value);
    val = Number.isNaN(parsed) ? 0 : parsed;
  } else {
    val = target.value ?? "";
  }

  try {
    const kmApp = await getOrInitKingdomApp(partyActor, true);
    if (kmApp) {
      const kmInput = kmApp.element?.querySelector?.(`[name="${field}"]`) || {
        name: field,
        type: target.type || "text",
        value: val,
        checked: Boolean(val)
      };
      kmInput.name = field;
      kmInput.type = target.type || kmInput.type || "text";
      if (target.type === "checkbox") {
        kmInput.checked = Boolean(val);
      } else {
        kmInput.value = val;
      }
      if (typeof Event !== "undefined" && typeof kmInput.dispatchEvent === "function") {
        kmInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (typeof kmApp._onChangeForm === "function") {
        await kmApp._onChangeForm(kmApp.options?.form || kmApp.form || {}, { target: kmInput });
      }
    }
  } catch (err) {
    console.warn(`PF2e Mobile Sheet | Failed to sync kingdom field "${field}" via kmApp:`, err);
  }

  try {
    const updatePath = (field.startsWith("system.") || field.startsWith("flags."))
      ? field
      : `flags.pf2e-kingmaker-tools.kingdom-sheet.${field}`;
    await partyActor.update?.({ [updatePath]: val });
  } catch (err) {
    console.warn(`PF2e Mobile Sheet | Failed to update kingdom field "${field}":`, err);
  }
  sheet.render({ parts: ["header", "sheet"] });
}

/**
 * Generic dispatcher for buttons using `data-action="dispatchKingdomNativeAction"` and `data-km-action="..."`.
 */
export async function onDispatchKingdomNativeAction(sheet, event, target) {
  const kmAction = target.dataset.kmAction || target.dataset.actionName;
  if (!kmAction) return;

  const partyActor = getPartyActor(sheet.actor);
  const campaign = partyActor?.system?.campaign;

  if (kmAction === "inspect-leader-skills" || kmAction === "inspect-kingdom-skills") {
    const kmApp = await getOrInitKingdomApp(partyActor, true);
    const km = (kmApp && typeof kmApp._preparePartContext === "function")
      ? await kmApp._preparePartContext("form", {}, {})
      : {};
    const skillList = Array.isArray(km.skills) && km.skills.length > 0
      ? km.skills
      : Object.entries(campaign?.skills || {}).map(([k, v]) => ({
          skill: k,
          name: v?.label || k.charAt(0).toUpperCase() + k.slice(1).toLowerCase(),
          totalModifier: v?.mod ?? v?.value ?? 0
        }));

    if (kmAction === "inspect-leader-skills") {
      const roleKey = target.dataset.role;
      const roleObj = Array.isArray(km.leadersContext)
        ? km.leadersContext.find((l) => l.key === roleKey || l.id === roleKey)
        : null;
      const actorUuid = roleObj?.character?.value || campaign?.leadership?.[roleKey]?.uuid;
      const leaderActor = actorUuid && typeof fromUuidSync === "function"
        ? fromUuidSync(actorUuid)
        : (partyActor?.members?.[0] || null);
      const leaderName = leaderActor?.name || roleObj?.label || "Leader";
      const rows = skillList.map((s) => {
        const slug = String(s.skill || "").toLowerCase();
        const mod = leaderActor?.skills?.[slug]?.mod ?? s.totalModifier ?? 0;
        return `<div style="display:flex;justify-content:space-between;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.78rem;">
          <span>${s.name || s.skill}</span>
          <strong style="color:#f3d486;">${mod >= 0 ? `+${mod}` : mod}</strong>
        </div>`;
      }).join("");
      await foundry.applications.api.DialogV2.prompt({
        window: { title: `${leaderName} — PC Skills Overview`, icon: "fa-solid fa-user-check" },
        classes: ["pf2e-mobile-dialog", "compact-theme"],
        content: `<div style="max-height:360px;overflow-y:auto;">${rows}</div>`,
        ok: { label: "Close", icon: "fa-solid fa-check" }
      });
      return;
    }

    const rows = skillList.map((s) => {
      const mod = s.totalModifier ?? 0;
      const rankLabel = s.proficiencyRank?.value || "";
      return `<div style="display:flex;justify-content:space-between;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.78rem;">
        <span>${s.name || s.skill}</span>
        <strong style="color:#6ee7b7;">${mod >= 0 ? `+${mod}` : mod}${rankLabel ? ` (${rankLabel})` : ""}</strong>
      </div>`;
    }).join("");
    await foundry.applications.api.DialogV2.prompt({
      window: { title: `${getKingdomName(partyActor)} — Kingdom Skills`, icon: "fa-solid fa-crown" },
      classes: ["pf2e-mobile-dialog", "compact-theme"],
      content: `<div style="max-height:360px;overflow-y:auto;">${rows}</div>`,
      ok: { label: "Close", icon: "fa-solid fa-check" }
    });
    return;
  }

  const extraDataset = { ...target.dataset, action: kmAction };
  delete extraDataset.kmAction;
  const label = target.title || target.textContent?.trim() || kmAction;
  await dispatchKingdomSheetAction(sheet, event, extraDataset, label);
}
