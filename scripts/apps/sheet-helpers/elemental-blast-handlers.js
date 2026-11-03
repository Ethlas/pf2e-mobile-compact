/**
 * Kineticist Elemental Blast for the Attacks section: context builder and action handlers.
 * Like pf2e's own character sheet, everything goes through pf2e's `game.pf2e.ElementalBlast` API
 * (configs, attack, damage, setDamageType); no blast math is done here. Weapon Infusion and the
 * 1/2-action cost are pf2e roll options, shown via context-toggles.js (toggles.elementalBlast).
 */
import { PhysicalDiceManager } from "../../rolls/physical-dice-interceptor.js";
import { setTargetToken } from "../../tokens/token-adapter.js";
import { resolveTargetForAction } from "./sheet-prompts.js";
import { onUseAction } from "./actions-handlers.js";

const t = (key) => game.i18n?.localize?.(key) ?? key;

/**
 * Builds `context.elementalBlasts` (one card per channeled element, or a single unchanneled card
 * with the Channel Elements button), `context.elementalBlastsReady` and `context.channelElementsItemId`.
 * @param {Actor} actor
 * @param {object} context
 */
export async function prepareElementalBlastsContext(actor, context) {
  context.elementalBlasts = [];
  context.elementalBlastsReady = false;
  context.channelElementsItemId = null;

  const BlastClass = game.pf2e?.ElementalBlast;
  if (actor?.type !== "character" || typeof BlastClass !== "function") return;

  const blast = new BlastClass(actor);
  const actions = actor.itemTypes?.action ?? [];
  const blastItem = blast.item ?? actions.find(i => i.slug === "elemental-blast") ?? null;
  const channelItem = actions.find(i => i.slug === "channel-elements") ?? null;
  if (!blastItem && !channelItem) return; // not a kineticist

  context.channelElementsItemId = channelItem?.id ?? null;
  const channelLabel = channelItem?.name ?? "Channel Elements";
  const actionCost = Number(blast.actionCost) || 1;
  const configs = (blast.configs ?? []).filter(c => c.ready !== false);

  // Kinetic Aura not active: pf2e has no ready blast, show the card with the Channel Elements button
  if (!configs.length) {
    context.elementalBlasts = [{
      label: blastItem?.name ?? "Elemental Blast",
      img: blastItem?.img ?? channelItem?.img,
      itemId: blastItem?.id ?? null,
      channelItemId: channelItem?.id ?? null,
      channelLabel,
      ready: false,
      glyph: String(actionCost)
    }];
    return;
  }

  const traitLabel = (slug) => t(CONFIG.PF2E?.weaponTraits?.[slug] ?? CONFIG.PF2E?.npcAttackTraits?.[slug] ?? slug);
  const meleeTraits = (blast.infusion?.traits?.melee ?? []).map(slug => ({ slug, label: traitLabel(slug) }));
  const rangedTraits = (blast.infusion?.traits?.ranged ?? []).map(slug => ({ slug, label: traitLabel(slug) }));
  const withPrefix = (prefix, label) => (/^(melee|ranged)\b/i.test(label ?? "") ? label : `${prefix} ${label ?? ""}`.trim());

  context.elementalBlasts = await Promise.all(configs.map(async (config) => {
    const damageTypes = (config.damageTypes ?? []).map(dt => ({ ...dt, label: t(dt.label) }));
    const selected = damageTypes.find(dt => dt.selected) ?? damageTypes[0];
    const damageType = selected?.value ?? "untyped";
    // pf2e computes the formula itself (getFormula), the same way its sheet labels the damage buttons
    const formula = async (melee) => {
      try {
        return await blast.damage({ element: config.element, damageType, melee, outcome: "success", getFormula: true });
      } catch {
        return `1d${config.dieFaces}`;
      }
    };
    const maps = config.maps ?? {};
    return {
      element: config.element,
      elementLabel: t(CONFIG.PF2E?.effectTraits?.[config.element] ?? config.element),
      label: t(config.label),
      img: config.img,
      itemId: blastItem?.id ?? null,
      channelItemId: channelItem?.id ?? null,
      channelLabel,
      ready: true,
      actionCost: Number(config.actionCost) || actionCost,
      glyph: String(Number(config.actionCost) || actionCost),
      dieFaces: config.dieFaces,
      damageType,
      damageTypeLabel: selected?.label ?? damageType,
      damageTypes,
      hasMultipleDamageTypes: damageTypes.length > 1,
      rangeLabel: config.range?.label ? t(config.range.label) : "",
      meleeTraits,
      rangedTraits,
      meleeVariants: [
        { mapIncreases: 0, label: withPrefix("Melee", maps.melee?.map0) },
        { mapIncreases: 1, label: maps.melee?.map1 },
        { mapIncreases: 2, label: maps.melee?.map2 }
      ],
      rangedVariants: [
        { mapIncreases: 0, label: withPrefix("Ranged", maps.ranged?.map0) },
        { mapIncreases: 1, label: maps.ranged?.map1 },
        { mapIncreases: 2, label: maps.ranged?.map2 }
      ],
      formula: { melee: { damage: await formula(true) }, ranged: { damage: await formula(false) } }
    };
  }));
  context.elementalBlasts.sort((a, b) => a.label.localeCompare(b.label, game.i18n?.lang));
  context.elementalBlastsReady = true;
}

/** Action handler: use Channel Elements (pf2e applies or removes the Kinetic Aura self-effect). */
export async function onChannelElements(sheet, event, target) {
  const itemId = target?.dataset?.itemId ?? sheet.actor.itemTypes?.action?.find(i => i.slug === "channel-elements")?.id;
  if (itemId) return onUseAction(sheet, event, { dataset: { itemId } });
}

/** Action handler: switch Elemental Blast between 1 and 2 actions (pf2e's "action-cost" roll option). */
export async function onToggleBlastActionCost(sheet, event, target) {
  const next = Number(target?.dataset?.actionCost) === 2 ? 1 : 2;
  const toggle = sheet.actor.synthetics?.toggles?.["elemental-blast"]?.["action-cost"];
  await sheet.actor.toggleRollOption("elemental-blast", "action-cost", toggle?.itemId ?? target?.dataset?.itemId, true, String(next));
}

/** Action handler: choose an element's damage type (includes the B/P/S types added by Weapon Infusion). */
export async function onSetBlastDamageType(sheet, event, target) {
  const { element, damageType } = target?.dataset ?? {};
  if (element && damageType) await new game.pf2e.ElementalBlast(sheet.actor).setDamageType({ element, damageType });
}

/**
 * Shared flow for blast rolls: resolve and sync the target, then run pf2e's roll inside the
 * physical-dice wrapper (same pattern as weapon strikes in actions-handlers.js).
 * @param {object} sheet
 * @param {HTMLElement} target - button carrying data-element / data-damage-type / data-melee
 * @param {string} subtitle
 * @param {(blast: object, params: object) => Promise<void>} roll
 */
async function runBlastRoll(sheet, target, subtitle, roll) {
  const { element, damageType } = target?.dataset ?? {};
  if (!element || !damageType) return;
  const blast = new game.pf2e.ElementalBlast(sheet.actor);
  const title = t(blast.configs?.find(c => c.element === element)?.label ?? "Elemental Blast");

  const targetToken = await resolveTargetForAction(sheet, `${title} (${subtitle})`, { includeSelf: false });
  if (targetToken === false) return;
  if (targetToken?.id) await setTargetToken(targetToken.id);

  const params = { element, damageType, melee: target.dataset.melee === "true" };
  await PhysicalDiceManager.withPhysicalMode(
    { title, subtitle, target: targetToken, actor: sheet.actor },
    () => roll(blast, params),
    sheet.rollMode === "physical"
  );
}

/** Action handler: Elemental Blast attack roll (melee or ranged, MAP 0/1/2). */
export async function onExecuteBlastAttack(sheet, event, target) {
  const mapIncreases = Math.min(Math.max(parseInt(target?.dataset?.mapIncreases, 10) || 0, 0), 2);
  const mode = target?.dataset?.melee === "true" ? "Melee" : "Ranged";
  return runBlastRoll(sheet, target, `${mode} Attack`, (blast, params) => blast.attack({ ...params, mapIncreases, event }));
}

/** Action handler: Elemental Blast damage or critical damage roll (melee or ranged). */
export async function onExecuteBlastDamage(sheet, event, target) {
  const outcome = target?.dataset?.outcome === "criticalSuccess" ? "criticalSuccess" : "success";
  const subtitle = outcome === "criticalSuccess" ? "Critical Damage" : "Damage";
  return runBlastRoll(sheet, target, subtitle, (blast, params) => blast.damage({ ...params, outcome, event }));
}
