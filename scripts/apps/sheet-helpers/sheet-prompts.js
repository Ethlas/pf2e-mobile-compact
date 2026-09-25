import { getTargetableToken, setTargetToken } from "../../tokens/token-adapter.js";

/**
 * Resolves the target token for an action.
 * If a target is already selected in the header (or on canvas), it returns that token immediately.
 * If no target is selected, it opens a prompt dialog to let the user select one or proceed without a target.
 * @param {object} sheet - Application instance
 * @param {string} actionLabel
 * @returns {Promise<object|null|false>} Resolves to target token adapter, null (no target), or false (cancelled).
 */
export async function resolveTargetForAction(sheet, actionLabel) {
  const currentTarget = Array.from(game.user?.targets ?? []).find(t => t.id);
  if (currentTarget) {
    const targetToken = getTargetableToken(currentTarget.id) ?? currentTarget;
    if (targetToken) return targetToken;
  }
  return promptTargetSelection(sheet, actionLabel);
}

/**
 * Prompts the user to select or confirm their target before executing an action.
 * @param {object} sheet - Application instance
 * @param {string} actionLabel
 * @returns {Promise<object|null|false>} Resolves to target token adapter, null (no target), or false (cancelled).
 */
export async function promptTargetSelection(sheet, actionLabel) {
  const scene = canvas?.scene ?? game.scenes.viewed ?? game.scenes.active;
  const currentTargetId = Array.from(game.user?.targets ?? []).find(t => t.id)?.id ?? "";

  let availableTokens = [];
  if (canvas?.tokens?.placeables?.length) {
    availableTokens = canvas.tokens.placeables
      .filter(t => t.actor && t.actor.id !== sheet.actor.id && t.visible)
      .map(t => ({ id: t.id, name: t.name, selected: t.id === currentTargetId }));
  } else if (scene?.tokens) {
    availableTokens = scene.tokens.contents
      .filter(t => t.actor && t.actorId !== sheet.actor.id && (!t.hidden || game.user.isGM))
      .map(t => ({ id: t.id, name: t.name, selected: t.id === currentTargetId }));
  }

  // If there are no other tokens on the scene, proceed without target
  if (availableTokens.length === 0) return null;

  return new Promise(resolve => {
    const { DialogV2 } = foundry.applications.api;
    const optionsHtml = availableTokens
      .map(t => `<option value="${t.id}" ${t.selected ? "selected" : ""}>${t.name}</option>`)
      .join("");

    const content = `
      <div style="padding: 10px; text-align: center;">
        <p style="margin-bottom: 10px; font-size: 1.05rem;"><strong>Target for ${actionLabel}</strong></p>
        <label for="action-target-select" style="display:block; margin-bottom: 6px; font-size: 0.9rem; color: #bbb;">Select Target Token:</label>
        <select id="action-target-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 48px; font-size: 16px; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          <option value="">-- No Target --</option>
          ${optionsHtml}
        </select>
      </div>
    `;

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `Target: ${actionLabel}` },
        content,
        ok: {
          label: "Confirm & Roll",
          callback: async (event, button, dialog) => {
            const select = dialog.element.querySelector("#action-target-select");
            const selectedTokenId = select?.value ?? "";
            await setTargetToken(selectedTokenId);
            sheet.render({ parts: ["header"] });
            const targetToken = selectedTokenId ? getTargetableToken(selectedTokenId) : null;
            resolve(targetToken);
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) resolve(false);
      });
    } else {
      const chosen = window.prompt(`Select Target Token ID for ${actionLabel} (leave empty for none):`, currentTargetId);
      if (chosen !== null) {
        setTargetToken(chosen);
        sheet.render({ parts: ["header"] });
        resolve(chosen ? getTargetableToken(chosen) : null);
      } else {
        resolve(false);
      }
    }
  });
}

/**
 * Prompts user to select an action variant when multiple variants exist.
 * @param {object} sheet - Application instance
 * @param {string} actionLabel
 * @param {Array<{slug: string, name: string, glyph?: string, cost?: number}>} variants
 * @returns {Promise<string|false>} Selected variant slug, or false if cancelled.
 */
export async function promptVariantSelection(sheet, actionLabel, variants) {
  if (!variants || variants.length === 0) return null;
  if (variants.length === 1) return variants[0].slug;

  return new Promise(resolve => {
    const { DialogV2 } = foundry.applications.api;
    const optionsHtml = variants
      .map((v, i) => {
        const rawName = v.name || v.label || v.slug;
        const name = typeof rawName === "string" ? game.i18n.localize(rawName) : String(rawName?.name ?? rawName?.label ?? v.slug);
        const glyph = v.glyph ? ` [${v.glyph}]` : "";
        return `<option value="${v.slug}" ${i === 0 ? "selected" : ""}>${name}${glyph}</option>`;
      })
      .join("");

    const content = `
      <div style="padding: 10px; text-align: center;">
        <p style="margin-bottom: 10px; font-size: 1.05rem;"><strong>${actionLabel}</strong></p>
        <label for="action-variant-select" style="display:block; margin-bottom: 6px; font-size: 0.9rem; color: #bbb;">Select Action Variant:</label>
        <select id="action-variant-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 48px; font-size: 16px; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          ${optionsHtml}
        </select>
      </div>
    `;

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `${actionLabel} - Select Variant` },
        content,
        ok: {
          label: "Proceed",
          callback: (event, button, dialog) => {
            const select = dialog.element.querySelector("#action-variant-select");
            resolve(select?.value ?? variants[0].slug);
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) resolve(false);
      });
    } else {
      resolve(variants[0].slug);
    }
  });
}

/**
 * Prompts user to select a statistic/skill when an action supports multiple statistics (e.g. Recall Knowledge).
 * @param {object} sheet - Application instance
 * @param {string} actionLabel
 * @param {Array<string>} statistics
 * @returns {Promise<string|false>} Selected statistic slug, or false if cancelled.
 */
export async function promptStatisticSelection(sheet, actionLabel, statistics) {
  if (!statistics || statistics.length === 0) return null;
  if (statistics.length === 1) return statistics[0];

  return new Promise(resolve => {
    const { DialogV2 } = foundry.applications.api;
    const optionsHtml = statistics
      .map((statKey, i) => {
        const stat = sheet.actor.getStatistic?.(statKey) ?? sheet.actor.skills?.[statKey];
        const mod = stat?.totalModifier ?? stat?.mod ?? stat?.check?.mod;
        const sign = typeof mod === "number" ? (mod >= 0 ? `+${mod}` : `${mod}`) : "";
        const skillConfig = CONFIG.PF2E?.skills?.[statKey];
        const rawLabel = stat?.label ?? (typeof skillConfig === "object" ? skillConfig?.label : skillConfig) ?? statKey;
        const label = typeof rawLabel === "string" ? game.i18n.localize(rawLabel) : String(rawLabel);
        return `<option value="${statKey}" ${i === 0 ? "selected" : ""}>${label} (${sign})</option>`;
      })
      .join("");

    const content = `
      <div style="padding: 10px; text-align: center;">
        <p style="margin-bottom: 10px; font-size: 1.05rem;"><strong>${actionLabel}</strong></p>
        <label for="action-stat-select" style="display:block; margin-bottom: 6px; font-size: 0.9rem; color: #bbb;">Select Skill to Check:</label>
        <select id="action-stat-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 48px; font-size: 16px; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          ${optionsHtml}
        </select>
      </div>
    `;

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `${actionLabel} - Select Skill` },
        content,
        ok: {
          label: "Roll Check",
          callback: (event, button, dialog) => {
            const select = dialog.element.querySelector("#action-stat-select");
            resolve(select?.value ?? statistics[0]);
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) resolve(false);
      });
    } else {
      resolve(statistics[0]);
    }
  });
}

/**
 * Prompts user to select a weapon strike when executing an attack feat (e.g. Combat Grab, Power Attack).
 * @param {object} sheet - Application instance
 * @param {string} actionLabel
 * @param {Array<object>} strikes
 * @returns {Promise<object|false>} Selected strike object, or false if cancelled.
 */
export async function promptStrikeSelection(sheet, actionLabel, strikes) {
  if (!strikes || strikes.length === 0) return null;
  if (strikes.length === 1) return strikes[0];

  return new Promise(resolve => {
    const { DialogV2 } = foundry.applications.api;
    const optionsHtml = strikes
      .map((s, i) => {
        const mod = s.totalModifier ?? s.variants?.[0]?.totalModifier;
        const sign = typeof mod === "number" ? (mod >= 0 ? `+${mod}` : `${mod}`) : "";
        return `<option value="${i}" ${i === 0 ? "selected" : ""}>${s.label} (${sign})</option>`;
      })
      .join("");

    const content = `
      <div style="padding: 10px; text-align: center;">
        <p style="margin-bottom: 10px; font-size: 1.05rem;"><strong>${actionLabel}</strong></p>
        <label for="action-strike-select" style="display:block; margin-bottom: 6px; font-size: 0.9rem; color: #bbb;">Select Weapon Strike to Attack With:</label>
        <select id="action-strike-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 48px; font-size: 16px; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          ${optionsHtml}
        </select>
      </div>
    `;

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `${actionLabel} - Select Strike` },
        content,
        ok: {
          label: "Roll Attack",
          callback: (event, button, dialog) => {
            const select = dialog.element.querySelector("#action-strike-select");
            const idx = parseInt(select?.value ?? "0", 10);
            resolve(strikes[idx] ?? strikes[0]);
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) resolve(false);
      });
    } else {
      resolve(strikes[0]);
    }
  });
}

/**
 * Prompts user to select whether to consume an item on self or administer it to an ally on the scene.
 * @param {object} sheet - Application instance
 * @param {Item} item - Consumable item
 * @returns {Promise<{mode: "self"|"ally", targetToken?: object, targetId?: string}|false>}
 */
export async function promptConsumableUsage(sheet, item) {
  const scene = canvas?.scene ?? game.scenes.viewed ?? game.scenes.active;
  const currentTargetId = Array.from(game.user?.targets ?? []).find(t => t.id)?.id ?? "";

  let candidates = [];
  if (canvas?.tokens?.placeables?.length) {
    candidates = canvas.tokens.placeables
      .filter(t => t.actor && t.actor.id !== sheet.actor.id && t.visible && (t.document?.disposition >= 0 || t.actor.hasPlayerOwner))
      .map(t => ({
        id: t.id,
        name: t.name,
        selected: t.id === currentTargetId,
        actorName: t.actor?.name ?? t.name
      }));
  } else if (scene?.tokens) {
    candidates = scene.tokens.contents
      .filter(t => t.actor && t.actorId !== sheet.actor.id && (!t.hidden || game.user.isGM) && (t.disposition >= 0 || t.actor?.hasPlayerOwner))
      .map(t => ({
        id: t.id,
        name: t.name,
        selected: t.id === currentTargetId,
        actorName: t.actor?.name ?? t.name
      }));
  }

  return new Promise(resolve => {
    const { DialogV2 } = foundry.applications.api;

    const comradeOptions = candidates.map(c =>
      `<option value="${c.id}" ${c.selected ? "selected" : ""}>Comrade: ${c.name}</option>`
    ).join("");

    const content = `
      <div style="padding: 10px; text-align: center;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px;">
          <img src="${item.img}" alt="${item.name}" width="36" height="36" style="border: 1px solid #444; border-radius: 4px;" />
          <span style="font-size: 1.1rem; font-weight: bold;">${item.name}</span>
        </div>
        <p style="margin-bottom: 12px; font-size: 0.9rem; color: #bbb;">Choose who receives this consumable:</p>
        <label for="consumable-recipient-select" style="display:block; margin-bottom: 6px; font-size: 0.85rem; color: #888;">Recipient:</label>
        <select id="consumable-recipient-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 48px; font-size: 16px; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          <option value="self">Self (${sheet.actor.name})</option>
          ${comradeOptions}
        </select>
      </div>
    `;

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `Use Consumable: ${item.name}` },
        content,
        ok: {
          label: "Use / Administer",
          callback: (event, button, dialog) => {
            const select = dialog.element.querySelector("#consumable-recipient-select");
            const val = select?.value ?? "self";
            if (val === "self") {
              resolve({ mode: "self" });
            } else {
              const targetToken = getTargetableToken(val) ?? canvas?.tokens?.get(val) ?? null;
              resolve({ mode: "ally", targetToken, targetId: val });
            }
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) resolve(false);
      });
    } else {
      resolve({ mode: "self" });
    }
  });
}

/**
 * Prompts user to select a weapon to apply a poison or oil onto.
 * @param {object} sheet - Application instance
 * @param {Item} consumable - Poison or oil item
 * @param {Array<Item>} weapons - Available weapons
 * @returns {Promise<Item|false>} Selected weapon item, or false if cancelled.
 */
export async function promptWeaponSelectionForAttachment(sheet, consumable, weapons) {
  if (!weapons || weapons.length === 0) {
    ui.notifications?.warn("No weapons available to apply poison to.");
    return false;
  }

  return new Promise(resolve => {
    const { DialogV2 } = foundry.applications.api;

    const weaponOptions = weapons.map(w => {
      const hasPoison = (w.subitems?.contents ?? []).some(s => s.category === "poison" || s.system?.traits?.value?.includes("injury"));
      const poisonSuffix = hasPoison ? " (Already Poisoned)" : "";
      return `<option value="${w.id}">${w.name}${poisonSuffix}</option>`;
    }).join("");

    const content = `
      <div style="padding: 10px; text-align: center;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px;">
          <img src="${consumable.img}" alt="${consumable.name}" width="36" height="36" style="border: 1px solid #444; border-radius: 4px;" />
          <span style="font-size: 1.1rem; font-weight: bold;">${consumable.name}</span>
        </div>
        <p style="margin-bottom: 12px; font-size: 0.9rem; color: #bbb;">Select weapon to apply this poison or oil to (1 Interact Action):</p>
        <label for="weapon-attach-select" style="display:block; margin-bottom: 6px; font-size: 0.85rem; color: #888;">Weapon:</label>
        <select id="weapon-attach-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 48px; font-size: 16px; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          ${weaponOptions}
        </select>
      </div>
    `;

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `Apply ${consumable.name}` },
        content,
        ok: {
          label: "Apply to Weapon",
          callback: (event, button, dialog) => {
            const select = dialog.element.querySelector("#weapon-attach-select");
            const weaponId = select?.value;
            const chosen = weapons.find(w => w.id === weaponId) ?? weapons[0];
            resolve(chosen);
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) resolve(false);
      });
    } else {
      resolve(weapons[0]);
    }
  });
}

export { promptRuneConfiguration, scanInventoryRunes } from "./rune-handlers.js";
