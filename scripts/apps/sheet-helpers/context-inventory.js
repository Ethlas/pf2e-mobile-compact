/**
 * Context preparation helper for Inventory items and Encumbrance.
 */

/**
 * Prepares inventory weapons, armor, consumables, gear, and bulk encumbrance.
 * @param {Actor} actor
 * @param {object} sheet
 * @param {object} context
 */
export function prepareInventoryContext(actor, sheet, context) {
  const system = actor.system ?? {};
  const encumbrance = system.attributes?.encumbrance ?? {};
  context.encumbrance = {
    bulk: (encumbrance.bulk?.value ?? 0).toFixed(1),
    max: encumbrance.bulk?.max ?? 10,
    isEncumbered: encumbrance.isEncumbered ?? false,
    isOverLimit: encumbrance.isOverLimit ?? false
  };

  const items = actor.items;
  context.inventory = {
    weapons: items.filter(i => i.type === "weapon").map(w => ({
      id: w.id,
      name: w.name,
      img: w.img,
      bulk: w.system.bulk?.value ?? "-"
    })),
    armor: items.filter(i => i.type === "armor" || i.type === "shield").map(a => ({
      id: a.id,
      name: a.name,
      img: a.img,
      bulk: a.system.bulk?.value ?? "-"
    })),
    consumables: items.filter(i => i.type === "consumable").map(c => ({
      id: c.id,
      name: c.name,
      img: c.img,
      quantity: c.system.quantity ?? 1
    })),
    gear: items.filter(i => !["weapon", "armor", "shield", "consumable", "spell", "feat", "effect"].includes(i.type)).map(g => ({
      id: g.id,
      name: g.name,
      img: g.img,
      quantity: g.system.quantity ?? 1,
      bulk: g.system.bulk?.value ?? "-"
    }))
  };
}

