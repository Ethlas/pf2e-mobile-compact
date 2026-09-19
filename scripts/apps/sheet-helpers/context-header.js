/**
 * Context preparation helper for Mobile Sheet Header & Dashboard.
 */

/**
 * Prepares header dashboard data: HP, shield, defenses, initiative, targets, owned characters, and focus.
 * @param {Actor} actor
 * @param {object} sheet
 * @param {object} context
 */
export function prepareHeaderContext(actor, sheet, context) {
  const system = actor.system ?? {};

  // Owned Characters Switcher Context
  const owned = game.actors.filter(a => a.type === "character" && a.isOwner);
  context.ownedCharacters = owned.map(a => ({
    id: a.id,
    name: a.name,
    img: a.img
  }));
  context.hasMultipleCharacters = context.ownedCharacters.length > 1;

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

  // Target Selection: Gather tokens from current scene (supports bypassed canvas)
  const scene = canvas?.scene ?? game.scenes.viewed ?? game.scenes.active;
  const currentTargetId = Array.from(game.user?.targets ?? []).find(t => t.id)?.id ?? "";

  let targetTokens = [];
  if (canvas?.tokens?.placeables?.length) {
    targetTokens = canvas.tokens.placeables
      .filter(t => t.actor && t.actor.id !== actor.id && t.visible)
      .map(t => ({
        id: t.id,
        name: t.name,
        selected: t.id === currentTargetId
      }));
  } else if (scene?.tokens) {
    targetTokens = scene.tokens.contents
      .filter(t => {
        if (!t.actor) return false;
        if (t.actorId === actor.id) return false;
        if (t.hidden && !game.user.isGM) return false;
        return true;
      })
      .map(t => ({
        id: t.id,
        name: t.name,
        selected: t.id === currentTargetId
      }));
  }
  context.targets = targetTokens;

  // Focus Pool
  const focusResource = system.resources?.focus;
  context.focus = {
    value: focusResource?.value ?? 0,
    max: focusResource?.max ?? 0
  };
}

