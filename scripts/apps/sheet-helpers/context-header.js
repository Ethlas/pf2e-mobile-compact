import { hasKingdomData, getKingdomName } from "../../kingdom/kingdom-handlers.js";
import { collectSceneCandidateTokens } from "./sheet-prompts.js";
import { isMobileCanvasDisabled } from "../../utils/sheet-utils.js";

/**
 * Prepares header dashboard data: HP, shield, defenses, initiative, targets, owned characters, and focus.
 * @param {Actor} actor
 * @param {object} sheet
 * @param {object} context
 */
export function prepareHeaderContext(actor, sheet, context) {
  const system = actor.system ?? {};

  // Switcher Context: Include owned characters, character's party, and Kingdom Sheet
  const isKingdom = Boolean(actor.type === "party" && sheet?._isKingdomMode);
  const isParty = actor.type === "party" && !isKingdom;
  context.isKingdom = isKingdom;
  context.isParty = isParty;

  const owned = game.actors.filter(a => a.type === "character" && (a.isOwner || game.user.isGM));
  const actorOptions = owned.map(a => ({
    id: a.id,
    name: `👤 ${a.name}`,
    img: a.img,
    isParty: false,
    isKingdom: false,
    selected: !isKingdom && a.id === actor.id
  }));

  const partyActor = (actor.type === "party")
    ? actor
    : (Array.from(actor.parties ?? [])[0]
      ?? (game.actors.party?.members?.some?.(m => m.id === actor.id) ? game.actors.party : null)
      ?? game.actors.find(p => p.type === "party" && p.members?.some?.(m => m.id === actor.id))
      ?? game.actors.party
      ?? game.actors.find(p => p.type === "party" && hasKingdomData(p))
      ?? game.actors.find(p => p.type === "party"));

  if (partyActor && !actorOptions.some(o => o.id === partyActor.id)) {
    actorOptions.push({
      id: partyActor.id,
      name: `👥 ${partyActor.name} (Party)`,
      img: partyActor.img,
      isParty: true,
      isKingdom: false,
      selected: !isKingdom && partyActor.id === actor.id
    });
  }

  const partyHasKingdom = Boolean(partyActor && hasKingdomData(partyActor));
  context.hasKingdom = partyHasKingdom;
  if (partyActor && partyHasKingdom) {
    const kmName = getKingdomName(partyActor);
    actorOptions.push({
      id: `kingdom:${partyActor.id}`,
      name: `👑 ${kmName} (Kingdom)`,
      img: partyActor.img,
      isParty: false,
      isKingdom: true,
      selected: isKingdom && partyActor.id === actor.id
    });
  }

  context.ownedCharacters = actorOptions;
  context.hasMultipleCharacters = context.ownedCharacters.length > 1;

  if (isParty) {
    const wealthString = actor.inventory?.totalWealth?.toString?.({ decimal: true })
      ?? (actor.inventory?.totalWealth ? `${actor.inventory.totalWealth}` : "0 gp");
    const bulkVal = actor.inventory?.bulk?.value ?? 0;
    const bulkStr = typeof bulkVal.toDecimal === "function" ? bulkVal.toDecimal().toFixed(1) : (bulkVal.value ?? bulkVal).toString();

    context.partyHeader = {
      name: actor.name,
      membersCount: actor.members?.length ?? 0,
      totalWealth: wealthString,
      totalBulk: bulkStr
    };
  }

  // HP & Shield Context
  context.hp = {
    value: system.attributes?.hp?.value ?? 0,
    max: system.attributes?.hp?.max ?? 0,
    temp: system.attributes?.hp?.temp ?? 0
  };

  const shield = system.attributes?.shield ?? actor.heldShield?.system;
  context.shield = {
    hp: {
      value: shield?.hp?.value ?? 0,
      max: shield?.hp?.max ?? 0
    },
    hardness: shield?.hardness ?? 0
  };

  // Defenses Context: querying actor statistic objects directly with resilient fallbacks
  const fortMod = actor.saves?.fortitude?.mod ?? actor.saves?.fortitude?.check?.mod ?? actor.saves?.fortitude?.totalModifier ?? system.saves?.fortitude?.value ?? system.saves?.fortitude?.mod ?? 0;
  const refMod = actor.saves?.reflex?.mod ?? actor.saves?.reflex?.check?.mod ?? actor.saves?.reflex?.totalModifier ?? system.saves?.reflex?.value ?? system.saves?.reflex?.mod ?? 0;
  const willMod = actor.saves?.will?.mod ?? actor.saves?.will?.check?.mod ?? actor.saves?.will?.totalModifier ?? system.saves?.will?.value ?? system.saves?.will?.mod ?? 0;
  const percMod = actor.perception?.mod ?? actor.perception?.check?.mod ?? actor.perception?.totalModifier ?? system.perception?.mod ?? system.attributes?.perception?.value ?? 0;
  const acVal = actor.armorClass?.value ?? actor.attributes?.ac?.value ?? system.attributes?.ac?.value ?? 10;

  context.defenses = {
    ac: { value: acVal },
    perception: { mod: percMod },
    fortitude: { mod: fortMod },
    reflex: { mod: refMod },
    will: { mod: willMod }
  };

  // Combat & Initiative Context
  const activeCombat = game.combat;
  const combatant = activeCombat ? activeCombat.combatants.find(c => c.actor?.id === actor.id || c.actor === actor) : null;
  const hasRolledInit = combatant?.initiative !== null && combatant?.initiative !== undefined;
  const initStat = actor.initiative;
  const initMod = initStat?.mod ?? initStat?.totalModifier ?? percMod;

  context.initiative = {
    mod: initMod,
    value: hasRolledInit ? combatant.initiative : null
  };

  context.combat = {
    active: !!activeCombat,
    inCombat: !!combatant,
    hasRolled: hasRolledInit,
    initiative: hasRolledInit ? combatant.initiative : null
  };

  // Target Selection: Gather tokens from current scene (includes Self and syncs _source positions on iOS)
  const targetTokens = collectSceneCandidateTokens(actor, { includeSelf: true });
  const selectedTargets = targetTokens.filter(t => t.selected);
  const hasMultipleTargets = selectedTargets.length > 1;

  if (hasMultipleTargets) {
    // When multiple targets are active, keep individual option.selected false so the __multi__ summary option is selected
    for (const t of targetTokens) {
      t.selectedInSingle = false;
    }
  } else {
    for (const t of targetTokens) {
      t.selectedInSingle = t.selected;
    }
  }

  context.targets = targetTokens;
  context.activeTarget = selectedTargets[0] ?? null;
  context.activeTargetCount = selectedTargets.length;
  context.hasMultipleTargets = hasMultipleTargets;
  context.multiTargetNames = selectedTargets.map(t => t.isSelf ? "Self" : t.rawName).join(", ");

  // Focus Pool
  const focusResource = system.resources?.focus;
  context.focus = {
    value: focusResource?.value ?? 0,
    max: focusResource?.max ?? 0
  };

  context.canvasDisabled = isMobileCanvasDisabled();
}

