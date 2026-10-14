import { PhysicalDiceManager } from "../../rolls/physical-dice-interceptor.js";
import { getOriginToken, setTargetToken, getTargetableToken } from "../../tokens/token-adapter.js";
import {
  resolveTargetForAction,
  promptVariantSelection,
  promptStatisticSelection,
  promptStrikeSelection
} from "./sheet-prompts.js";
import { onUseConsumable } from "./inventory-handlers.js";

/**
 * Action handler: execute strike attack roll with target prompt.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onExecuteStrike(sheet, event, target) {
  const strikeIndex = parseInt(target.dataset.strikeIndex, 10);
  const variantIndex = parseInt(target.dataset.variantIndex, 10);
  const strike = sheet.actor.system.actions?.[strikeIndex];
  if (!strike) return;

  const variant = strike.variants?.[variantIndex];
  if (!variant) return;

  // Ensure origin token adapter is initialized and synchronized on scene TokenDocument
  const originToken = getOriginToken(sheet.actor);

  // Resolve target: use pre-selected target or prompt user (exclude Self for weapon Strikes)
  const targetToken = await resolveTargetForAction(sheet, `${strike.label} (${variant.label})`, { includeSelf: false });
  if (targetToken === false) return; // User cancelled prompt

  // Ensure target is synchronized in Foundry user targets
  if (targetToken?.id) {
    await setTargetToken(targetToken.id);
  }

  const rollOptions = {
    event,
    target: targetToken || undefined
  };
  if (originToken) {
    rollOptions.token = originToken.document ?? originToken;
  }

  // When running with canvas disabled or not ready, ensure flanking roll options are injected
  if (originToken && targetToken && typeof originToken.isFlanking === "function") {
    const reach = sheet.actor.getReach?.({ action: "attack", weapon: strike.item }) ?? 5;
    const isFlanked = originToken.isFlanking(targetToken, { reach });
    const isCanvasDisabled = !canvas?.ready || canvas?.app?.stage?.renderable === false;
    if (isFlanked && isCanvasDisabled) {
      const flankOpts = ["self:flanking", "target:flanked", "target:condition:off-guard"];
      rollOptions.options = flankOpts;
      rollOptions.extraRollOptions = flankOpts;
    }
  }

  await PhysicalDiceManager.withPhysicalMode({
    title: `${strike.label} (${variant.label})`,
    subtitle: "Attack Roll",
    target: targetToken,
    actor: sheet.actor
  }, async () => {
    if (typeof variant.roll === "function") {
      await variant.roll(rollOptions);
    }
  }, sheet.rollMode === "physical");
}

/**
 * Action handler: execute damage roll with target prompt.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onExecuteDamage(sheet, event, target) {
  const strikeIndex = parseInt(target.dataset.strikeIndex, 10);
  const strike = sheet.actor.system.actions?.[strikeIndex];
  if (!strike) return;

  // Ensure origin token adapter is initialized
  const originToken = getOriginToken(sheet.actor);

  // Resolve target: use pre-selected target or prompt user (exclude Self for weapon Strikes)
  const targetToken = await resolveTargetForAction(sheet, `${strike.label} (Damage)`, { includeSelf: false });
  if (targetToken === false) return; // User cancelled prompt

  if (targetToken?.id) {
    await setTargetToken(targetToken.id);
  }

  const rollOptions = { event, target: targetToken || undefined };
  if (originToken) rollOptions.token = originToken.document ?? originToken;

  await PhysicalDiceManager.withPhysicalMode({
    title: `${strike.label}`,
    subtitle: "Damage Roll",
    target: targetToken,
    actor: sheet.actor
  }, async () => {
    if (typeof strike.damage === "function") {
      await strike.damage(rollOptions);
    }
  }, sheet.rollMode === "physical");
}

/**
 * Action handler: execute critical damage roll with target prompt.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onExecuteCritical(sheet, event, target) {
  const strikeIndex = parseInt(target.dataset.strikeIndex, 10);
  const strike = sheet.actor.system.actions?.[strikeIndex];
  if (!strike) return;

  // Ensure origin token adapter is initialized
  const originToken = getOriginToken(sheet.actor);

  // Resolve target: use pre-selected target or prompt user (exclude Self for weapon Strikes)
  const targetToken = await resolveTargetForAction(sheet, `${strike.label} (Critical)`, { includeSelf: false });
  if (targetToken === false) return; // User cancelled prompt

  if (targetToken?.id) {
    await setTargetToken(targetToken.id);
  }

  const rollOptions = { event, target: targetToken || undefined };
  if (originToken) rollOptions.token = originToken.document ?? originToken;

  await PhysicalDiceManager.withPhysicalMode({
    title: `${strike.label}`,
    subtitle: "Critical Damage Roll",
    target: targetToken,
    actor: sheet.actor
  }, async () => {
    if (typeof strike.critical === "function") {
      await strike.critical(rollOptions);
    }
  }, sheet.rollMode === "physical");
}

/**
 * Action handler: execute a weapon auxiliary action (draw, sheathe, drop, reload, change grip).
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onExecuteAuxiliaryAction(sheet, event, target) {
  const strikeIndex = parseInt(target.dataset.strikeIndex, 10);
  const auxIndex = parseInt(target.dataset.auxIndex, 10);
  const strike = sheet.actor.system.actions?.[strikeIndex];
  if (!strike) return;

  const aux = strike.auxiliaryActions?.[auxIndex];
  if (typeof aux?.execute === "function") {
    await aux.execute({ event });
    return;
  }

  // Fallback if aux.execute is not directly available
  const weapon = strike.item;
  if (!weapon) return;
  const purpose = aux?.action ?? aux?.purpose ?? target.dataset.purpose ?? "";

  if (purpose === "draw") {
    await weapon.update({ "system.equipped.carryType": "held", "system.equipped.handsHeld": 1 });
  } else if (purpose === "sheathe") {
    await weapon.update({ "system.equipped.carryType": "worn", "system.equipped.handsHeld": 0 });
  } else if (purpose === "drop") {
    await weapon.update({ "system.equipped.carryType": "dropped", "system.equipped.handsHeld": 0 });
  }
}

/**
 * Action handler: send item / ability card to chat.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onItemToChat(sheet, event, target) {
  const itemId = target.dataset.itemId;
  // Conditions are looked up like pf2e's effects panel does: some only exist in memory (actor.conditions)
  const item = sheet.actor.conditions?.get?.(itemId) ?? sheet.actor.items.get(itemId);
  if (!item) return;

  const rank = parseInt(target.dataset.rank, 10);
  const options = !isNaN(rank) && rank > 0 ? { data: { castRank: rank, castLevel: rank } } : {};

  if (typeof item.toMessage === "function") {
    await item.toMessage(event, options);
  }
}

/**
 * Action handler: execute character action / feat ability.
 * Handles both self-inflicted actions (selfEffect / self-buffs applied to actor, ignoring targets)
 * and targeted / attack actions (affecting the targeted token).
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onUseAction(sheet, event, target) {
  const itemId = target.dataset.itemId;
  const item = sheet.actor.items.get(itemId);
  if (!item) return;

  const actionSlug = item.slug ?? item.system?.slug ?? "";
  const rawTraits = item.system?.traits?.value ?? [];
  const traits = Array.isArray(rawTraits) ? rawTraits.map(t => typeof t === "string" ? t.toLowerCase() : String(t?.value ?? "").toLowerCase()) : [];

  // 1. If the action has a selfEffect (e.g. Dueling Parry, Raise a Shield, Marshall Aura, etc.)
  // These actions are explicitly on self and MUST NOT affect any targeted enemy token.
  const selfEffect = item.system?.selfEffect;
  if (selfEffect?.uuid) {
    const targetUuid = selfEffect.uuid;
    const targetName = (selfEffect.name ?? "").trim().toLowerCase();
    const itemName = (item.name ?? "").trim().toLowerCase();
    const itemSlug = (actionSlug || "").toLowerCase();

    // Check if the effect is already active on the actor (self)
    const existingEffect = sheet.actor.itemTypes?.effect?.find(e =>
      e.sourceId === targetUuid ||
      e.flags?.core?.sourceId === targetUuid ||
      (targetName && e.name?.toLowerCase() === targetName) ||
      (itemName && e.name?.toLowerCase() === `effect: ${itemName}`) ||
      (itemSlug && (e.system?.slug === itemSlug || e.system?.slug === `effect-${itemSlug}`))
    );

    if (existingEffect) {
      // Toggle effect off on actor
      await existingEffect.delete();
      ui.notifications?.info?.(`Deactivated ${existingEffect.name} for ${sheet.actor.name}.`);
    } else {
      // Fetch and apply the effect to the actor (self only)
      const effectDoc = await fromUuid(selfEffect.uuid);
      if (effectDoc) {
        const effectSource = effectDoc.toObject();
        delete effectSource._id;
        effectSource._id = null;

        const tokenDoc = sheet.token ?? sheet.actor.getActiveTokens?.(true, true)?.[0] ?? sheet.actor.getActiveTokens?.()?.[0]?.document ?? null;
        if (!effectSource.system) effectSource.system = {};
        effectSource.system.context = {
          origin: {
            actor: sheet.actor.uuid,
            item: item.uuid,
            token: tokenDoc?.uuid ?? null,
            spellcasting: null,
            rollOptions: typeof item.getOriginData === "function" ? (item.getOriginData()?.rollOptions ?? []) : []
          },
          target: {
            actor: sheet.actor.uuid,
            token: tokenDoc?.uuid ?? null
          },
          roll: null
        };

        await sheet.actor.createEmbeddedDocuments("Item", [effectSource]);
        ui.notifications?.info?.(`Activated ${effectDoc.name} on ${sheet.actor.name}.`);
      }
    }

    // Deduct frequency if applicable
    if (item.system?.frequency && item.system.frequency.value > 0) {
      const newVal = Math.max(0, (item.system.frequency.value ?? 0) - 1);
      await item.update({ "system.frequency.value": newVal });
    }

    // Send action card to chat
    if (typeof item.toMessage === "function") {
      await item.toMessage(event);
    }

    sheet.render({ parts: ["sheet"] });
    return;
  }

  // 2. If PF2e system action registry provides an action implementation (Action.use)
  const systemAction = game.pf2e?.actions?.get?.(actionSlug) ?? game.pf2e?.actions?.[actionSlug];
  if (systemAction) {
    const SELF_ACTION_SLUGS = new Set([
      "raise-a-shield", "take-cover", "end-cover", "point-out", "delay",
      "drop-prone", "stand", "step", "stride", "burrow", "climb", "fly",
      "leap", "swim", "escape", "hide", "sneak"
    ]);

    const isSelfAction = SELF_ACTION_SLUGS.has(actionSlug);

    let targetToken = null;
    if (!isSelfAction) {
      // Targeted action: resolve the selected target or prompt for one
      targetToken = await resolveTargetForAction(sheet, item.name);
      if (targetToken === false) return; // User cancelled prompt
    }

    const useOptions = {
      actors: [sheet.actor],
      event
    };
    if (targetToken) {
      useOptions.target = targetToken.object ?? targetToken;
    }

    // Check if action offers multiple variants (e.g. Administer First Aid, Perform, Create a Diversion, etc.)
    const variantsCollection = systemAction.variants;
    if (variantsCollection && variantsCollection.size > 1) {
      const variantList = Array.from(variantsCollection.values()).map(v => ({
        slug: v.slug,
        name: v.name || v.label || v.slug,
        glyph: v.glyph,
        cost: v.cost
      }));
      const chosenVariant = await promptVariantSelection(sheet, item.name, variantList);
      if (chosenVariant === false) return; // User cancelled prompt
      if (chosenVariant) {
        useOptions.variant = chosenVariant;
      }
    }

    // Check if action offers multiple statistics (e.g. Recall Knowledge)
    if (Array.isArray(systemAction.statistic) && systemAction.statistic.length > 1) {
      const chosenStat = await promptStatisticSelection(sheet, item.name, systemAction.statistic);
      if (chosenStat === false) return; // User cancelled prompt
      if (chosenStat) {
        useOptions.statistic = chosenStat;
      }
    }

    try {
      if (typeof systemAction.use === "function") {
        await systemAction.use(useOptions);
        return;
      } else if (typeof systemAction === "function") {
        await systemAction(useOptions);
        return;
      }
    } catch (err) {
      console.warn(`pf2e-mobile-compact | Error executing action ${item.name}:`, err);
      ui.notifications?.warn?.(`Action execution: ${err.message}`);
    }
  }

  // 3. Deduct frequency if applicable
  if (item.system?.frequency && item.system.frequency.value > 0) {
    const newVal = Math.max(0, (item.system.frequency.value ?? 0) - 1);
    await item.update({ "system.frequency.value": newVal });
  }

  // 4. Send action card to chat
  if (typeof item.toMessage === "function") {
    await item.toMessage(event);
  }

  sheet.render({ parts: ["sheet"] });
}

/**
 * Action handler: roll an action check (skill check, attack activity, or rolled action).
 * Resolves target token and executes PF2e's native check workflow or statistic roll.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onRollActionCheck(sheet, event, target) {
  const itemId = target.dataset.itemId;
  const actionSlug = target.dataset.actionSlug;
  const item = sheet.actor.items.get(itemId);
  const label = item?.name ?? actionSlug;
  const systemAction = game.pf2e?.actions?.get?.(actionSlug) ?? game.pf2e?.actions?.[actionSlug];

  // 1. Resolve target: check active target or prompt user. Downtime activities (Earn Income, Craft, Subsist, ...)
  //    never aim at a creature, so they skip this.
  let targetToken = null;
  const traits = [...(item?.system?.traits?.value ?? []), ...(systemAction?.traits ?? [])];
  if (!traits.includes("downtime")) {
    const currentTarget = Array.from(game.user?.targets ?? []).find(t => t.id);
    if (currentTarget) {
      targetToken = getTargetableToken(currentTarget.id) ?? currentTarget;
    } else {
      targetToken = await resolveTargetForAction(sheet, label);
      if (targetToken === false) return; // User cancelled prompt
    }
  }

  // Ensure origin token adapter is initialized
  getOriginToken(sheet.actor);

  await PhysicalDiceManager.withPhysicalMode({
    title: label,
    target: targetToken,
    actor: sheet.actor
  }, async () => {
    // 2. PF2e System Action Registry (e.g. Demoralize, Trip, Grapple, Disarm, Feint, Administer First Aid, etc.)
    if (systemAction) {
      const useOptions = {
        actors: [sheet.actor],
        event
      };
      if (targetToken) {
        useOptions.target = targetToken.object ?? targetToken;
      }

      // Check if action offers multiple variants (e.g. Administer First Aid, Perform, Create a Diversion, etc.)
      const variantsCollection = systemAction.variants;
      if (variantsCollection && variantsCollection.size > 1) {
        const variantList = Array.from(variantsCollection.values()).map(v => ({
          slug: v.slug,
          name: v.name || v.label || v.slug,
          glyph: v.glyph,
          cost: v.cost
        }));
        const chosenVariant = await promptVariantSelection(sheet, label, variantList);
        if (chosenVariant === false) return; // User cancelled prompt
        if (chosenVariant) {
          useOptions.variant = chosenVariant;
        }
      }

      // Check if action offers multiple statistics (e.g. Recall Knowledge)
      if (Array.isArray(systemAction.statistic) && systemAction.statistic.length > 1) {
        const chosenStat = await promptStatisticSelection(sheet, label, systemAction.statistic);
        if (chosenStat === false) return; // User cancelled prompt
        if (chosenStat) {
          useOptions.statistic = chosenStat;
        }
      }

      try {
        if (typeof systemAction?.use === "function") {
          await systemAction.use(useOptions);
          return;
        } else if (typeof systemAction === "function") {
          await systemAction(useOptions);
          return;
        }
      } catch (err) {
        console.warn(`pf2e-mobile-compact | Error executing action check ${label}:`, err);
        ui.notifications?.warn?.(`Action roll: ${err.message}`);
      }
    }

    // 3. Action declaring a specific skill statistic (e.g. item.system.statistic)
    const statistic = item?.system?.statistic;
    if (statistic) {
      const stat = sheet.actor.getStatistic?.(statistic) ?? sheet.actor.skills?.[statistic];
      if (stat && typeof stat.roll === "function") {
        await stat.roll({
          event,
          target: targetToken?.object ?? targetToken
        });
        return;
      }
    }

    // 4. Attack Activity Feat: roll strike if action has the attack trait
    const itemTraits = item?.system?.traits?.value ?? [];
    const isAttack = itemTraits.includes("attack") || (Array.isArray(itemTraits) && itemTraits.some(t => (t?.value ?? t) === "attack"));
    if (isAttack) {
      const strikes = sheet.actor.system.actions ?? [];
      let selectedStrike = strikes[0];
      if (strikes.length > 1) {
        const chosen = await promptStrikeSelection(sheet, label, strikes);
        if (chosen === false) return; // User cancelled prompt
        if (chosen) selectedStrike = chosen;
      }

      if (selectedStrike && typeof selectedStrike.roll === "function") {
        await selectedStrike.roll({
          event,
          target: targetToken?.object ?? targetToken
        });
        return;
      }
    }

    // Fallback: send action card to chat
    if (typeof item?.toMessage === "function") {
      await item.toMessage(event);
    }
  }, sheet.rollMode === "physical");
}

/**
 * Action handler: roll skill check.
 * Resolves skill statistic and executes PF2e native check workflow with physical dice interception.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onRollSkill(sheet, event, target) {
  const skillSlug = target?.dataset?.skill ?? target?.closest?.("[data-skill]")?.dataset?.skill;
  if (!skillSlug) return;

  const stat = sheet.actor.getStatistic?.(skillSlug) ?? sheet.actor.skills?.[skillSlug];
  const skillData = sheet.actor.system?.skills?.[skillSlug];
  const rawLabel = stat?.label ?? skillData?.label ?? skillSlug;
  const label = typeof rawLabel === "string" ? (game.i18n?.localize?.(rawLabel) ?? rawLabel) : String(rawLabel);

  let targetToken = null;
  const currentTarget = Array.from(game.user?.targets ?? []).find(t => t.id);
  if (currentTarget) {
    targetToken = getTargetableToken(currentTarget.id) ?? currentTarget;
  }

  // Ensure origin token adapter is initialized
  getOriginToken(sheet.actor);

  await PhysicalDiceManager.withPhysicalMode({
    title: `${label} Check`,
    target: targetToken,
    actor: sheet.actor
  }, async () => {
    const rollOptions = { event };
    if (targetToken) {
      rollOptions.target = targetToken.object ?? targetToken;
    }

    if (typeof stat?.roll === "function") {
      await stat.roll(rollOptions);
    } else if (typeof stat?.check?.roll === "function") {
      await stat.check.roll(rollOptions);
    } else if (typeof sheet.actor.rollSkill === "function") {
      await sheet.actor.rollSkill(event, skillSlug);
    } else {
      console.warn(`pf2e-mobile-compact | Could not find roll method for skill: ${skillSlug}`);
      ui.notifications?.warn?.(`Could not find roll method for skill: ${label}`);
    }
  }, sheet.rollMode === "physical");
}

/**
 * Action handler: consume item (delegated to inventory handler).
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onConsumeItem(sheet, event, target) {
  return onUseConsumable(sheet, event, target);
}

/**
 * Action handler: toggle expandable description summary on an action card.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export function onToggleActionSummary(sheet, event, target) {
  if (event.target?.closest?.(".staff-charges-tracker, .charges-buttons, .btn-charge-adjust")) return;
  event.preventDefault();
  const actionEl = target.closest(".m-action-card, .strike-card, .item-card, .inventory-item-card, .staff-activation-group");
  if (!actionEl) return;

  const isStaffGroup = actionEl.classList.contains("staff-activation-group");
  const summaryEl = isStaffGroup
    ? actionEl.querySelector(".staff-drawer-content")
    : actionEl.querySelector(".action-summary, .item-summary");
  if (!summaryEl) return;

  const icon = isStaffGroup
    ? actionEl.querySelector(".staff-header-card .action-expand-icon")
    : actionEl.querySelector(".action-expand-icon, .action-toggle-icon, .fa-chevron-down");
  const itemId = target.dataset.itemId || actionEl.dataset.itemId;

  if (!sheet._expandedActionIds) {
    sheet._expandedActionIds = new Set();
  }

  const isCurrentlyExpanded = summaryEl.classList.contains("expanded") ||
                              summaryEl.classList.contains("open") ||
                              actionEl.classList.contains("expanded");

  if (isCurrentlyExpanded) {
    summaryEl.classList.remove("open", "expanded");
    summaryEl.classList.add("collapsed");
    actionEl.classList.remove("expanded");
    icon?.classList?.remove("expanded");
    if (itemId) sheet._expandedActionIds.delete(itemId);
  } else {
    summaryEl.classList.add("open", "expanded");
    summaryEl.classList.remove("collapsed");
    actionEl.classList.add("expanded");
    icon?.classList?.add("expanded");
    if (itemId) sheet._expandedActionIds.add(itemId);
  }
}

