/**
 * Context preparation helper for Strikes, Character Actions, Reactions,
 * Free actions, Skill actions, Exploration, and Downtime activities.
 */
import { getGlyph, parseActionCostInfo, PROFICIENCY_RANK_LETTERS, PROFICIENCY_RANK_NAMES } from "../../utils/sheet-utils.js";

const PF2E_SKILL_SLUGS = new Set([
  "acrobatics",
  "arcana",
  "athletics",
  "crafting",
  "deception",
  "diplomacy",
  "intimidation",
  "lore",
  "medicine",
  "nature",
  "occultism",
  "performance",
  "religion",
  "society",
  "stealth",
  "survival",
  "thievery"
]);

const KNOWN_SKILL_ACTION_SLUGS = new Set([
  // Acrobatics
  "balance", "tumble-through", "maneuver-in-flight", "squeeze", "kip-up", "steady-balance",
  // Arcana
  "borrow-an-arcane-spell", "decipher-writing", "identify-magic", "learn-a-spell", "safely-borrow-an-arcane-spell",
  // Athletics
  "climb", "force-open", "grapple", "high-jump", "jump", "long-jump", "shove", "swim", "trip", "disarm", "escape", "reposition",
  // Crafting
  "craft", "earn-income", "identify-alchemy", "repair",
  // Deception
  "create-a-diversion", "feint", "impersonate", "lie",
  // Diplomacy
  "bon-mot", "gather-information", "make-an-impression", "request",
  // Intimidation
  "coerce", "demoralize",
  // Medicine
  "administer-first-aid", "battle-medicine", "treat-disease", "treat-poison", "treat-wounds",
  // Nature
  "command-an-animal",
  // Performance
  "perform",
  // Society
  "create-forgery", "subsist",
  // Stealth
  "conceal-an-object", "hide", "sneak",
  // Survival
  "cover-tracks", "sense-direction", "track",
  // Thievery
  "disable-device", "palm-an-object", "pick-a-lock", "steal",
  // Shared / General
  "recall-knowledge", "seek", "sense-motive", "scramble"
]);

const KNOWN_SKILL_ACTION_NAMES = new Set([
  "administer first aid", "balance", "battle medicine", "bon mot",
  "borrow an arcane spell", "climb", "coerce", "command an animal",
  "conceal an object", "craft", "create a diversion", "create forgery",
  "decipher writing", "demoralize", "disable device", "disarm",
  "earn income", "escape", "feint", "force open", "gather information",
  "grapple", "hide", "high jump", "identify alchemy", "identify magic",
  "impersonate", "jump", "leap", "learn a spell", "lie", "long jump",
  "make an impression", "maneuver in flight", "palm an object", "perform",
  "pick a lock", "recall knowledge", "repair", "reposition", "request",
  "safely borrow an arcane spell", "scramble", "seek", "sense direction",
  "sense motive", "shove", "sneak", "squeeze", "steal", "subsist",
  "swim", "track", "treat disease", "treat poison", "treat wounds",
  "trip", "tumble through"
]);

/**
 * Resolves the skill an action rolls and the character's proficiency in it, for the
 * skill label on the card and the Skill Actions sort order.
 * pf2e's action registry names the skill (`statistic`), either one slug ("stealth") or a
 * list the player chooses from when rolling (Recall Knowledge). For a list, the label reads
 * "Multiple" and the rank is the character's best rank among the options.
 * @param {Actor} actor
 * @param {string|string[]|null|undefined} statistic  Skill slug(s), e.g. from game.pf2e.actions
 * @returns {{ label: string, options: string, rank: number, rankLetter: string, rankName: string }|null}
 *   null when the action names no skill the character has
 */
export function getActionSkillInfo(actor, statistic) {
  const slugs = (Array.isArray(statistic) ? statistic : [statistic]).filter(s => typeof s === "string" && s);
  const stats = slugs
    .map(slug => actor?.getStatistic?.(slug) ?? actor?.skills?.[slug] ?? null)
    .filter(Boolean);
  if (!stats.length) return null;

  const i18n = globalThis.game?.i18n;
  const localize = (text) => i18n?.localize?.(text) ?? text;
  const rank = Math.max(...stats.map(stat => (typeof stat.rank === "number" ? stat.rank : 0)));
  const labels = stats.map(stat => localize(stat.label ?? stat.slug ?? ""));
  return {
    label: stats.length > 1 ? "Multiple" : labels[0],
    options: labels.join(", "),
    rank,
    rankLetter: PROFICIENCY_RANK_LETTERS[rank] ?? "U",
    rankName: i18n ? localize(`PF2E.ProficiencyLevel${rank}`) : (PROFICIENCY_RANK_NAMES[rank] ?? "")
  };
}

/**
 * Sort order of the Skill Actions section: actions from feats first (the character's own
 * build, e.g. Battle Medicine), then by proficiency in the action's skill (best first;
 * actions without a skill last), then by name.
 * @param {{ name: string, fromFeat: boolean, skill: { rank: number }|null }} a
 * @param {{ name: string, fromFeat: boolean, skill: { rank: number }|null }} b
 * @returns {number}
 */
export function compareSkillActions(a, b) {
  return (Number(b.fromFeat) - Number(a.fromFeat))
    || ((b.skill?.rank ?? -1) - (a.skill?.rank ?? -1))
    || a.name.localeCompare(b.name);
}

/**
 * Prepares strikes and categorized character actions for the Actions tab.
 * @param {Actor} actor
 * @param {object} sheet
 * @param {object} context
 */
export async function prepareActionsContext(actor, sheet, context) {
  // Defensive initialization of context fields expected by actions.hbs
  context.strikes = [];
  context.characterActions = {
    actions: [],
    reactions: [],
    free: [],
    skillActions: [],
    exploration: [],
    downtime: [],
    hasEncounter: false,
    hasSkillActions: false,
    hasExploration: false,
    hasDowntime: false
  };

  // Strikes Context (with Weapon Image, Traits, MAP Variants, Damage, and Auxiliary Actions)
  const strikesList = Array.isArray(actor.system?.actions)
    ? actor.system.actions
    : (Array.isArray(actor.actions) ? actor.actions : []);

  context.strikes = strikesList.map((action, idx) => {
    const item = action.item;
    const rawTraits = action.traits ?? item?.system?.traits?.value ?? [];
    const traits = Array.isArray(rawTraits)
      ? rawTraits.map(t => typeof t === "string" ? { label: t } : { label: t.label ?? t.name ?? "" })
      : [];

    const auxActions = (action.auxiliaryActions ?? []).map((aux, aIdx) => ({
      index: aIdx,
      label: aux.label ?? aux.action ?? "Action",
      glyph: aux.glyph ?? (aux.actions ? String(aux.actions) : ""),
      annotation: aux.annotation ?? null,
      purpose: aux.action ?? ""
    }));

    return {
      index: idx,
      label: action.label ?? action.name ?? "Strike",
      type: action.type ?? "strike",
      glyph: action.glyph ?? (action.actionCost ? String(action.actionCost.value || 1) : "1"),
      img: item?.img || "systems/pf2e/icons/default-icons/melee.svg",
      variants: (action.variants ?? []).map((v, vIdx) => ({
        index: vIdx,
        label: v.label
      })),
      damage: !!action.damage,
      critical: typeof action.critical === "function",
      damageFormula: item?.system?.damage?.dice
        ? `${item.system.damage.dice}${item.system.damage.die}`
        : (action.damageFormula ?? "Damage"),
      traits,
      auxiliaryActions: auxActions,
      hasAuxiliary: auxActions.length > 0,
      isRanged: !!item?.isRanged,
      isMelee: !!item?.isMelee,
      isThrown: !!item?.isThrown,
      rangeIncrement: item?.range?.increment ?? null,
      ready: action.ready
    };
  });

  // Character Actions Preparation (Matching PF2e ActorSheet actions tab)
  const encounterActions = [];
  const encounterReactions = [];
  const encounterFree = [];
  const skillActions = [];
  const explorationActions = [];
  const downtimeActions = [];

  const elementalBlasts = actor.itemTypes?.action?.filter(i => i.slug === "elemental-blast") ?? [];
  const items = actor.items ?? [];

  for (const item of items) {
    try {
      const isAction = typeof item.isOfType === "function" ? item.isOfType("action") : item.type === "action";
      const isFeat = typeof item.isOfType === "function" ? item.isOfType("feat") : item.type === "feat";
      const isFeatWithAction = isFeat && (item.actionCost || item.system?.actionType?.value === "action" || item.system?.actionType?.value === "reaction" || item.system?.actionType?.value === "free");

      if (!isAction && !isFeatWithAction) continue;
      if (item.suppressed) continue;
      if (actor.flags?.pf2e?.kineticist && item === elementalBlasts[0]) continue;

      const actionCost = item.actionCost;
      const rawTraits = item.system?.traits?.value ?? [];
      const traits = Array.isArray(rawTraits) ? rawTraits.map(t => typeof t === "string" ? t.toLowerCase() : String(t?.value ?? "").toLowerCase()) : [];
      const actionCategory = String(item.system?.actionCategory?.value ?? item.system?.category ?? item.category ?? "").toLowerCase();

      // Exploration & Downtime identification
      const isExploration = traits.includes("exploration") || actionCategory === "exploration";
      const isDowntime = traits.includes("downtime") || actionCategory === "downtime";

      // Check system action registry if available in PF2e
      const actionSlug = item.slug ?? item.system?.slug ?? "";
      const systemAction = game.pf2e?.actions?.get?.(actionSlug);
      const isSystemSkillAction = systemAction?.section === "skill" || !!systemAction?.statistic;

      const itemSlug = String(actionSlug).toLowerCase();
      const normalizedName = String(item.name ?? "").trim().toLowerCase();

      // Skill Action identification:
      const isSkillAction = !isExploration && !isDowntime && (
        KNOWN_SKILL_ACTION_SLUGS.has(itemSlug) ||
        KNOWN_SKILL_ACTION_NAMES.has(normalizedName) ||
        isSystemSkillAction ||
        traits.some(t => PF2E_SKILL_SLUGS.has(t) || t === "skill") ||
        actionCategory === "skill" ||
        item.category === "skill" ||
        (item.system?.category === "interaction") ||
        (item.flags?.pf2e?.skillAction)
      );

      const selfEffect = item.system?.selfEffect;
      const isEffectActive = !!(selfEffect?.uuid && actor.itemTypes?.effect?.some(e => {
        const sourceId = e._stats?.compendiumSource ?? e.flags?.core?.sourceId ?? null;
        return sourceId === selfEffect.uuid ||
          (selfEffect.name && e.name?.toLowerCase() === selfEffect.name.toLowerCase()) ||
          (item.name && e.name?.toLowerCase() === `effect: ${item.name.toLowerCase()}`) ||
          (actionSlug && (e.system?.slug === actionSlug || e.system?.slug === `effect-${actionSlug}`));
      }));

      const isUsable = !!selfEffect || !!item.system?.frequency || !!item.crafting;
      const isAttack = traits.includes("attack") || systemAction?.traits?.includes("attack");
      const isSkillStatistic = !!systemAction?.statistic || !!item.system?.statistic || KNOWN_SKILL_ACTION_SLUGS.has(itemSlug);
      const hasRoll = !selfEffect && (!!systemAction || isAttack || isSkillStatistic);

      let rawDescription = item.system?.description?.value ?? "";
      if (!rawDescription && systemAction?.description) {
        rawDescription = game.i18n.localize(systemAction.description);
      }
      const TextEditorClass = foundry.applications?.ux?.TextEditor ?? globalThis.TextEditor;
      let enrichedDescription = rawDescription;
      if (rawDescription && typeof TextEditorClass?.enrichHTML === "function") {
        try {
          enrichedDescription = await TextEditorClass.enrichHTML(rawDescription, {
            secrets: item.isOwner ?? false,
            rollData: actor.getRollData?.() ?? {},
            async: true
          });
        } catch {
          enrichedDescription = rawDescription;
        }
      }

      // Skill label and sort data (Skill Actions only). An action "comes from a feat" when it is a
      // feat itself (skill feats with an action cost) or was granted by one (pf2e sets item.grantedBy).
      const skill = isSkillAction ? getActionSkillInfo(actor, systemAction?.statistic ?? item.system?.statistic) : null;
      const fromFeat = item.type === "feat" || item.grantedBy?.type === "feat";

      const costInfo = parseActionCostInfo(item, systemAction?.cost);
      const actionData = {
        id: item.id,
        name: item.name,
        slug: actionSlug,
        img: item.img || "systems/pf2e/icons/actions/Empty.webp",
        glyph: costInfo.glyph || getGlyph(actionCost),
        actionCostType: costInfo.actionCostType,
        actionCostValue: costInfo.actionCostValue,
        multiActionLabel: (!isExploration && !isDowntime) ? costInfo.multiActionLabel : "",
        usable: isUsable,
        active: isEffectActive,
        isAttack,
        hasRoll,
        traits: traits.map(t => ({ label: t })),
        frequency: item.system?.frequency ? {
          value: item.system.frequency.value ?? 0,
          max: item.system.frequency.max ?? 0,
          per: item.system.frequency.per ?? ""
        } : null,
        description: enrichedDescription || rawDescription,
        isExpanded: Boolean(sheet._expandedActionIds?.has(item.id) || sheet._expandedActionIds?.has(actionSlug)),
        skill,
        fromFeat
      };

      if (isDowntime) {
        downtimeActions.push(actionData);
      } else if (isExploration) {
        explorationActions.push(actionData);
      } else if (isSkillAction) {
        skillActions.push(actionData);
      } else if (actionCost?.type === "reaction") {
        encounterReactions.push(actionData);
      } else if (actionCost?.type === "free") {
        encounterFree.push(actionData);
      } else {
        encounterActions.push(actionData);
      }
    } catch (err) {
      console.warn(`PF2e Mobile Compact | Failed to prepare action item "${item?.name}":`, err);
    }
  }

  const sortByName = (a, b) => a.name.localeCompare(b.name);
  encounterActions.sort(sortByName);
  encounterReactions.sort(sortByName);
  encounterFree.sort(sortByName);
  skillActions.sort(compareSkillActions);
  explorationActions.sort(sortByName);
  downtimeActions.sort(sortByName);

  context.characterActions = {
    actions: encounterActions,
    reactions: encounterReactions,
    free: encounterFree,
    skillActions: skillActions,
    exploration: explorationActions,
    downtime: downtimeActions,
    hasEncounter: encounterActions.length > 0 || encounterReactions.length > 0 || encounterFree.length > 0,
    hasSkillActions: skillActions.length > 0,
    hasExploration: explorationActions.length > 0,
    hasDowntime: downtimeActions.length > 0
  };
}

