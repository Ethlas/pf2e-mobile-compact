/**
 * Weapon strikes, alternate usages (thrown / combination), trait toggles
 * (versatile / double-barrel), modular auxiliary options, and ammunition
 * linking / reloading for the Attacks tab.
 */
import { PhysicalDiceManager } from "../../rolls/physical-dice-interceptor.js";
import { getOriginToken, setTargetToken } from "../../tokens/token-adapter.js";
import { resolveTargetForAction } from "./sheet-prompts.js";

const t = (key) => (typeof key === "string" && key ? (game.i18n?.localize?.(key) ?? key) : "");
const tOr = (key, fallback) => {
  const localized = t(key);
  return localized && localized !== key ? localized : fallback;
};

/**
 * Extracts versatile damage-type options and double-barrel toggle state from a strike or altUsage.
 * @param {object} action
 * @returns {{ versatileOptions: object[], doubleBarrel: object|null, hasTraitToggles: boolean }}
 */
function buildTraitToggles(action) {
  const versatileOptions = (action.versatileOptions ?? []).map(opt => {
    const value = String(opt.value ?? "");
    const typeKey = CONFIG.PF2E?.damageTypes?.[value];
    const label = typeKey ? t(typeKey) : t(opt.label ?? value);
    return {
      value,
      label,
      title: t(opt.label ?? value),
      glyph: opt.glyph ?? "",
      selected: !!opt.selected
    };
  });

  const doubleBarrel = action.doubleBarrel
    ? {
        selected: !!action.doubleBarrel.selected,
        label: tOr("PF2E.TraitDoubleBarrel", "Double Barrel")
      }
    : null;

  return {
    versatileOptions,
    doubleBarrel,
    hasTraitToggles: versatileOptions.length > 0 || !!doubleBarrel
  };
}

/**
 * Normalizes a strike or alternate-usage entry into template-ready attack/damage/toggle fields.
 * @param {object} usage
 * @param {number} strikeIndex
 * @param {number|null} altIndex
 * @returns {object}
 */
function buildUsageData(usage, strikeIndex, altIndex) {
  const item = usage.item;
  const isThrown = !!item?.isThrown;
  const isRanged = !!item?.isRanged;
  const rangeIncrement = item?.range?.increment ?? item?.system?.range ?? null;

  let modeLabel = "Melee";
  let modeIcon = "fas fa-fist-raised";
  if (isThrown) {
    modeLabel = "Thrown";
    modeIcon = "fas fa-bullseye";
  } else if (usage.type === "auto-fire" || usage.type === "area-fire") {
    modeLabel = t(usage.label) || (usage.type === "auto-fire" ? "Auto-Fire" : "Area Fire");
    modeIcon = "fas fa-burst";
  } else if (isRanged) {
    modeLabel = "Ranged";
    modeIcon = "fas fa-crosshairs";
  }

  return {
    strikeIndex,
    altIndex,
    isAlt: altIndex !== null,
    modeLabel,
    modeIcon,
    rangeIncrement,
    variants: (usage.variants ?? []).map((v, vIdx) => ({
      index: vIdx,
      label: v.label
    })),
    damage: !!usage.damage,
    critical: typeof usage.critical === "function",
    damageFormula: item?.system?.damage?.dice
      ? `${item.system.damage.dice}${item.system.damage.die}`
      : (usage.damageFormula ?? "Damage"),
    ...buildTraitToggles(usage)
  };
}

/**
 * Normalizes `strike.ammunition` for bow linking and firearm/crossbow reload & magazine controls.
 * @param {object|null|undefined} ammunition
 * @returns {object|null}
 */
function buildAmmunitionData(ammunition) {
  if (!ammunition) return null;

  const selectedId = ammunition.selected?.id ?? "";
  const compatible = (ammunition.compatible ?? []).map(c => ({
    id: c.id,
    label: c.label ?? c.name ?? c.id,
    selected: c.id === selectedId
  }));
  const loaded = (ammunition.loaded ?? []).map(l => {
    const max = Number(l.max) || 1;
    return {
      id: l.id,
      name: l.name ?? "Ammo",
      img: l.img ?? "",
      quantity: l.quantity ?? 0,
      max,
      showMax: max > 1,
      isTemporary: !!l.isTemporary,
      isSelected: l.id === selectedId
    };
  });

  const capacity = Number(ammunition.capacity) || 0;
  const remaining = Math.max(0, Number(ammunition.remaining) || 0);
  const emptyLabel = capacity > 1
    ? (game.i18n?.has?.("PF2E.Actor.Character.EmptyMultipleLabel")
        ? game.i18n.format("PF2E.Actor.Character.EmptyMultipleLabel", { value: remaining })
        : `${remaining} empty`)
    : tOr("PF2E.Actor.Character.EmptyLabel", "Empty");

  return {
    selectedId,
    compatible,
    loaded,
    capacity,
    remaining,
    requiresReload: !!ammunition.requiresReload,
    reloadGlyph: ammunition.reloadGlyph ?? "",
    emptyLabel,
    noAmmoLabel: tOr("PF2E.NoAmmoLabel", "No Ammunition"),
    hasLoaded: loaded.length > 0,
    hasMultipleLoaded: loaded.length > 1,
    hasCompatible: compatible.length > 0,
    hasSingleCompatible: compatible.length === 1,
    singleCompatible: compatible[0] ?? null,
    canReloadAll: remaining > 1
  };
}

/**
 * Normalizes weapon auxiliary actions, including Modular `aux.options` (PF2e object map or array).
 * Preserves each entry's original `index` into `strike.auxiliaryActions` while hiding redundant
 * Reload/Unload entries (e.g. from `pf2e-ranged-combat`) when the native ammo section covers them.
 * @param {object[]} auxiliaryActions
 * @param {object|null} ammunition
 * @returns {object[]}
 */
function buildAuxiliaryActions(auxiliaryActions, ammunition) {
  return (auxiliaryActions ?? [])
    .map((aux, aIdx) => {
      const rawOptions = aux.options
        ? (Array.isArray(aux.options) ? aux.options : Object.values(aux.options))
        : [];
      const options = rawOptions.map(opt => ({
        value: String(opt.value ?? ""),
        label: t(opt.label ?? opt.value ?? ""),
        selected: !!opt.selected
      }));
      return {
        index: aIdx,
        label: t(aux.label ?? aux.action ?? "Action"),
        glyph: aux.glyph ?? (aux.actions ? String(aux.actions) : ""),
        annotation: aux.annotation ?? null,
        purpose: aux.action ?? "",
        options,
        hasOptions: options.length > 0
      };
    })
    .filter(aux => {
      if (!ammunition?.requiresReload || aux.annotation || aux.hasOptions) return true;
      const labelLower = aux.label.trim().toLowerCase();
      if (ammunition.remaining > 0 && labelLower === "reload") return false;
      if (ammunition.hasLoaded && labelLower === "unload") return false;
      return true;
    });
}

/**
 * Builds template-ready strike cards for `context.strikes`, including alternate usages,
 * versatile/double-barrel trait toggles, modular auxiliary select options, and ammunition.
 * @param {Actor} actor
 * @returns {object[]}
 */
export function prepareStrikesContext(actor) {
  const strikesList = Array.isArray(actor?.system?.actions)
    ? actor.system.actions
    : (Array.isArray(actor?.actions) ? actor.actions : []);

  return strikesList.map((action, idx) => {
    const item = action.item;
    const rawTraits = action.traits ?? item?.system?.traits?.value ?? [];
    const traits = Array.isArray(rawTraits)
      ? rawTraits.map(tr => typeof tr === "string" ? { label: t(tr) } : { label: t(tr.label ?? tr.name ?? "") })
      : [];

    const ammunition = buildAmmunitionData(action.ammunition);
    const auxActions = buildAuxiliaryActions(action.auxiliaryActions, ammunition);
    const primary = buildUsageData(action, idx, null);
    const altUsages = (action.altUsages ?? []).map((u, uIdx) => buildUsageData(u, idx, uIdx));
    const isRanged = !!item?.isRanged;
    const isMelee = !!item?.isMelee;
    const isThrown = !!item?.isThrown;
    const rangeIncrement = item?.range?.increment ?? null;

    return {
      index: idx,
      label: action.label ?? action.name ?? "Strike",
      type: action.type ?? "strike",
      glyph: action.glyph ?? (action.actionCost ? String(action.actionCost.value || 1) : "1"),
      img: item?.img || "systems/pf2e/icons/default-icons/melee.svg",
      variants: primary.variants,
      damage: primary.damage,
      critical: primary.critical,
      damageFormula: primary.damageFormula,
      versatileOptions: primary.versatileOptions,
      doubleBarrel: primary.doubleBarrel,
      hasTraitToggles: primary.hasTraitToggles,
      traits,
      auxiliaryActions: auxActions,
      hasAuxiliary: auxActions.length > 0,
      isRanged,
      isMelee,
      isThrown,
      rangeIncrement,
      hasMetaBadges: traits.length > 0 || isMelee || isThrown || isRanged || !!rangeIncrement,
      ready: action.ready,
      altUsages,
      ammunition
    };
  });
}

/**
 * Resolves a primary strike or an alternate usage (`data-alt-usage`) from a control's dataset.
 * @param {Actor} actor
 * @param {HTMLElement} target
 * @returns {object|null}
 */
export function resolveStrike(actor, target) {
  const strikeIndex = parseInt(target?.dataset?.strikeIndex, 10);
  if (!Number.isInteger(strikeIndex)) return null;
  const rootStrike = actor?.system?.actions?.[strikeIndex] ?? null;
  if (!rootStrike) return null;

  const altRaw = target?.dataset?.altUsage;
  if (altRaw !== undefined && altRaw !== "") {
    const altIndex = parseInt(altRaw, 10);
    return Number.isInteger(altIndex) ? (rootStrike.altUsages?.[altIndex] ?? null) : null;
  }
  return rootStrike;
}

/**
 * Action handler: execute strike (or alternate usage) attack roll with target prompt.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onExecuteStrike(sheet, event, target) {
  const strike = resolveStrike(sheet.actor, target);
  if (!strike) return;

  const variantIndex = parseInt(target?.dataset?.variantIndex, 10);
  const variant = strike.variants?.[variantIndex];
  if (!variant) return;

  const originToken = getOriginToken(sheet.actor);
  const targetToken = await resolveTargetForAction(sheet, `${strike.label} (${variant.label})`, { includeSelf: false });
  if (targetToken === false) return;

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
  if (strike.item?.altUsageType) {
    rollOptions.altUsage = strike.item.altUsageType;
  }

  // Headless flanking options apply only to melee strikes when canvas is disabled or not ready
  if (!strike.item?.isRanged && originToken && targetToken && typeof originToken.isFlanking === "function") {
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
 * Shared handler for weapon normal and critical damage rolls (primary or alternate usage).
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 * @param {"damage" | "critical"} method
 */
async function runStrikeDamage(sheet, event, target, method) {
  const strike = resolveStrike(sheet.actor, target);
  if (!strike) return;

  const isCrit = method === "critical";
  const originToken = getOriginToken(sheet.actor);
  const targetToken = await resolveTargetForAction(
    sheet,
    `${strike.label} (${isCrit ? "Critical" : "Damage"})`,
    { includeSelf: false }
  );
  if (targetToken === false) return;

  if (targetToken?.id) {
    await setTargetToken(targetToken.id);
  }

  const rollOptions = { event, target: targetToken || undefined };
  if (originToken) rollOptions.token = originToken.document ?? originToken;

  await PhysicalDiceManager.withPhysicalMode({
    title: `${strike.label}`,
    subtitle: isCrit ? "Critical Damage Roll" : "Damage Roll",
    target: targetToken,
    actor: sheet.actor
  }, async () => {
    if (typeof strike[method] === "function") {
      await strike[method](rollOptions);
    }
  }, sheet.rollMode === "physical");
}

/**
 * Action handler: execute damage roll (primary or alternate usage) with target prompt.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onExecuteDamage(sheet, event, target) {
  return runStrikeDamage(sheet, event, target, "damage");
}

/**
 * Action handler: execute critical damage roll (primary or alternate usage) with target prompt.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onExecuteCritical(sheet, event, target) {
  return runStrikeDamage(sheet, event, target, "critical");
}

/**
 * Action handler: execute a weapon auxiliary action (draw, sheathe, drop, reload, change grip, modular).
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onExecuteAuxiliaryAction(sheet, event, target) {
  const strike = resolveStrike(sheet.actor, target);
  if (!strike) return;

  const auxIndex = parseInt(target?.dataset?.auxIndex, 10);
  const aux = strike.auxiliaryActions?.[auxIndex];
  const isSelect = target?.tagName === "SELECT" || target?.type === "select-one" || (!!aux?.options && target?.value !== undefined);
  const selection = isSelect ? (target.value ?? null) : null;

  if (typeof aux?.execute === "function") {
    await aux.execute(selection !== null ? { selection } : { event });
    await sheet.render?.({ parts: ["header", "sheet"] });
    return;
  }

  // Fallback if aux.execute is not directly available
  const weapon = strike.item;
  if (!weapon) return;
  const purpose = aux?.action ?? aux?.purpose ?? target?.dataset?.purpose ?? "";

  if (purpose === "draw") {
    await weapon.update({ "system.equipped.carryType": "held", "system.equipped.handsHeld": 1 });
    await sheet.render?.({ parts: ["header", "sheet"] });
  } else if (purpose === "sheathe") {
    await weapon.update({ "system.equipped.carryType": "worn", "system.equipped.handsHeld": 0 });
    await sheet.render?.({ parts: ["header", "sheet"] });
  } else if (purpose === "drop") {
    await weapon.update({ "system.equipped.carryType": "dropped", "system.equipped.handsHeld": 0 });
    await sheet.render?.({ parts: ["header", "sheet"] });
  }
}

/**
 * Action handler: toggle a weapon trait (`double-barrel` or `versatile`) on a primary or alternate strike.
 * @param {object} sheet
 * @param {Event} _event
 * @param {HTMLElement} target
 */
export async function onToggleWeaponTrait(sheet, _event, target) {
  const weapon = resolveStrike(sheet.actor, target)?.item;
  const toggles = weapon?.system?.traits?.toggles;
  if (!weapon || typeof toggles?.update !== "function") return;

  const trait = target?.dataset?.trait;
  if (trait === "double-barrel") {
    await toggles.update({ trait, selected: !toggles.doubleBarrel?.selected });
    await sheet.render?.({ parts: ["header", "sheet"] });
  } else if (trait === "versatile") {
    const value = target?.dataset?.value ?? target?.value ?? "";
    const baseType = weapon.system?.damage?.damageType ?? null;
    const selected = target?.classList?.contains?.("selected") || value === baseType ? null : value;
    await toggles.update({ trait, selected });
    await sheet.render?.({ parts: ["header", "sheet"] });
  }
}

/**
 * Action handler: link or unlink compatible ammunition on a non-reloadable ranged weapon (e.g. bow).
 * @param {object} sheet
 * @param {Event} _event
 * @param {HTMLElement} target
 */
export async function onLinkStrikeAmmo(sheet, _event, target) {
  const weapon = resolveStrike(sheet.actor, target)?.item;
  if (!weapon) return;

  const ammoId = target?.value || null;
  const ammo = ammoId ? (sheet.actor.items?.get?.(ammoId) ?? null) : null;
  await weapon.update({ system: { selectedAmmoId: ammo?.id ?? null } });
  await sheet.render?.({ parts: ["header", "sheet"] });
}

/**
 * Action handler: reload one or all remaining rounds into a reloadable/repeating weapon.
 * @param {object} sheet
 * @param {Event} _event
 * @param {HTMLElement} target
 */
export async function onReloadStrikeAmmo(sheet, _event, target) {
  const strike = resolveStrike(sheet.actor, target);
  const weapon = strike?.item;
  if (!strike || !weapon) return;

  const ammoId = target?.dataset?.ammoId
    || target?.closest?.(".strike-ammo-reload")?.querySelector?.("select")?.value
    || strike.ammunition?.compatible?.[0]?.id;
  const ammo = ammoId
    ? (sheet.actor.items?.get?.(ammoId) ?? sheet.actor.inventory?.get?.(ammoId) ?? null)
    : null;
  if (!ammo) {
    ui.notifications?.warn?.("No compatible ammunition selected.");
    return;
  }

  const isMagazine = ammo.isOfType?.("ammo") && (ammo.system?.uses?.max ?? 0) > 1;
  const depleted = (ammo.quantity ?? 0) <= 0 || (isMagazine && (ammo.system?.uses?.value ?? 0) <= 0);
  if (depleted) {
    ui.notifications?.warn?.(`${ammo.name} is out of ammunition.`);
    return;
  }

  let remainingSpace;
  if (weapon.subitems) {
    const capacity = weapon.system?.ammo?.capacity ?? strike.ammunition?.capacity ?? 1;
    const subitems = weapon.subitems.contents ?? Array.from(weapon.subitems.values?.() ?? weapon.subitems);
    const loaded = subitems.filter(i =>
      (i.isOfType?.("ammo") || (i.isOfType?.("weapon") && i.isAmmoFor?.(weapon)))
      && !(i.isOfType?.("ammo") && i.isMagazine && (i.system?.uses?.value ?? 0) === 0)
    );
    const numLoaded = loaded.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
    remainingSpace = Math.max(0, capacity - numLoaded);
  } else {
    remainingSpace = Math.max(0, Number(strike.ammunition?.remaining ?? 1));
  }
  if (remainingSpace <= 0) return;

  const reloadAll = target?.dataset?.reloadAll === "true";
  const quantity = reloadAll ? Math.min(remainingSpace, ammo.quantity ?? 1) : 1;
  if (typeof weapon.attach === "function") {
    await weapon.attach(ammo, { quantity, stack: true });
  }

  if (game.combat && typeof ChatMessage?.create === "function") {
    try {
      const renderTemplateFn = foundry?.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
      if (typeof renderTemplateFn === "function") {
        const systemId = game.system?.id ?? "pf2e";
        const flavor = await renderTemplateFn(`systems/${systemId}/templates/chat/action/flavor.hbs`, {
          action: {
            title: "PF2E.Actions.Interact.Title",
            subtitle: "PF2E.Actions.Interact.Reload.Title",
            glyph: strike.ammunition?.reloadGlyph || ""
          },
          traits: [{ name: "manipulate", label: CONFIG.PF2E?.actionTraits?.manipulate ?? "Manipulate" }]
        });
        const message = game.i18n?.format?.("PF2E.Actions.Interact.Reload.Description", {
          actor: sheet.actor.name,
          weapon: weapon.name,
          ammo: ammo.name
        }) ?? `${sheet.actor.name} reloads ${weapon.name} with ${ammo.name}.`;
        const content = await renderTemplateFn(`systems/${systemId}/templates/chat/action/content.hbs`, {
          imgPath: weapon.img,
          message
        });
        const token = sheet.actor.getActiveTokens?.(false, true)?.[0];
        await ChatMessage.create({
          content,
          speaker: ChatMessage.getSpeaker({ actor: sheet.actor, token }),
          flavor,
          style: CONST?.CHAT_MESSAGE_STYLES?.EMOTE
        });
      }
    } catch (err) {
      console.warn("PF2e Mobile Compact | Failed to post reload chat message:", err);
    }
  }

  await sheet.render?.({ parts: ["header", "sheet"] });
}

/**
 * Action handler: unload a loaded ammunition stack back into inventory.
 * @param {object} sheet
 * @param {Event} _event
 * @param {HTMLElement} target
 */
export async function onUnloadStrikeAmmo(sheet, _event, target) {
  const weapon = resolveStrike(sheet.actor, target)?.item;
  const ammoId = target?.dataset?.ammoId ?? target?.closest?.("[data-item-id]")?.dataset?.itemId;
  if (!weapon || !ammoId) return;

  const subitem = weapon.subitems?.get?.(ammoId)
    ?? weapon.subitems?.contents?.find?.(s => s.id === ammoId);
  if (typeof subitem?.detach === "function") {
    await subitem.detach({ skipConfirm: true });
    await sheet.render?.({ parts: ["header", "sheet"] });
  }
}

/**
 * Action handler: select which loaded ammunition stack is chambered first (and purge depleted 0-qty stacks).
 * @param {object} sheet
 * @param {Event} _event
 * @param {HTMLElement} target
 */
export async function onSelectStrikeAmmo(sheet, _event, target) {
  const weapon = resolveStrike(sheet.actor, target)?.item;
  const ammoId = target?.dataset?.ammoId ?? target?.closest?.("[data-item-id]")?.dataset?.itemId;
  if (!weapon || !ammoId || !weapon.subitems) return;

  const subitemsList = weapon.subitems.contents ?? Array.from(weapon.subitems.values?.() ?? weapon.subitems);
  const ammoSubItems = subitemsList.filter(i => i.isOfType?.("ammo", "weapon") && i.isAmmoFor?.(weapon));
  const ammoIds = new Set(ammoSubItems.map(i => i.id));
  const purgedIds = new Set(ammoSubItems.filter(i => !i.quantity).map(i => i.id));
  const rawSources = weapon._source?.system?.subitems ?? [];
  const cloneFn = foundry?.utils?.deepClone ?? (v => structuredClone(v));

  const sources = cloneFn(rawSources)
    .filter(s => !purgedIds.has(s._id ?? ""))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const priority = (s) => (!ammoIds.has(s._id) ? 0 : s._id === ammoId ? 1 : 2);
  [...sources].sort((a, b) => priority(a) - priority(b)).forEach((item, idx) => {
    item.sort = idx;
  });

  await weapon.update({ "system.subitems": sources });
  await sheet.render?.({ parts: ["header", "sheet"] });
}
