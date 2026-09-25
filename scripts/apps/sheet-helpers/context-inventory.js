/**
 * Context preparation helper for Inventory items and Encumbrance.
 * Strictly separates physical items from character traits/feats and enriches
 * consumables, weapons, armor, and gear with mobile-ready status metadata.
 */

import { getPropertyRuneLabel } from "./rune-data.js";

const PHYSICAL_ITEM_TYPES = new Set([
  "ammo",
  "armor",
  "backpack",
  "book",
  "consumable",
  "equipment",
  "shield",
  "treasure",
  "weapon"
]);

/**
 * Prepares inventory weapons, armor, consumables, gear, and bulk encumbrance.
 * @param {Actor} actor
 * @param {object} sheet
 * @param {object} context
 */
/**
 * Check safely whether an item has a specific trait, supporting Set, Array, or custom collections.
 * @param {Item} item
 * @param {string} trait
 * @returns {boolean}
 */
function hasTrait(item, trait) {
  if (!item) return false;
  if (typeof item.traits?.has === "function") return item.traits.has(trait);
  if (item.traits instanceof Set) return item.traits.has(trait);
  if (Array.isArray(item.traits)) return item.traits.includes(trait);
  const val = item.system?.traits?.value;
  if (typeof val?.has === "function") return val.has(trait);
  if (val instanceof Set) return val.has(trait);
  if (Array.isArray(val)) return val.includes(trait);
  return false;
}

/**
 * Determine whether an item can be invested according to PF2e rules.
 * @param {Item} item
 * @returns {boolean}
 */
function isInvestableItem(item) {
  if (item.isInvestable !== undefined) return Boolean(item.isInvestable);
  return hasTrait(item, "invested");
}

async function enrichItemDescription(item, actor) {
  const rawDescription = item.system?.description?.value ?? "";
  if (!rawDescription) return "";
  const TextEditorClass = foundry.applications?.ux?.TextEditor ?? globalThis.TextEditor;
  if (typeof TextEditorClass?.enrichHTML === "function") {
    try {
      return await TextEditorClass.enrichHTML(rawDescription, {
        secrets: item.isOwner ?? false,
        rollData: actor?.getRollData?.() ?? {},
        async: true
      });
    } catch {
      return rawDescription;
    }
  }
  return rawDescription;
}

export async function prepareInventoryContext(actor, sheet, context) {
  const system = actor.system ?? {};
  const encumbrance = system.attributes?.encumbrance ?? {};
  context.encumbrance = {
    bulk: (encumbrance.bulk?.value ?? 0).toFixed(1),
    max: encumbrance.bulk?.max ?? 10,
    isEncumbered: encumbrance.isEncumbered ?? false,
    isOverLimit: encumbrance.isOverLimit ?? false
  };

  const party = Array.from(actor.parties ?? [])[0]
    ?? (game.actors.party?.members.some(m => m.id === actor.id) ? game.actors.party : null)
    ?? game.actors.find(p => p.type === "party" && p.members?.some(m => m.id === actor.id));

  context.partyStash = party ? {
    id: party.id,
    name: party.name,
    itemsCount: party.items.filter(i => (typeof i.isOfType === "function" ? i.isOfType("physical") : PHYSICAL_ITEM_TYPES.has(i.type))).length
  } : null;

  const items = actor.items ?? [];

  // Defensive check for physical items (PF2e isOfType predicate and physical item set)
  const isPhysical = (i) => {
    if (!i) return false;
    if (typeof i.isOfType === "function") {
      return i.isOfType("physical") || PHYSICAL_ITEM_TYPES.has(i.type);
    }
    return PHYSICAL_ITEM_TYPES.has(i.type);
  };

  const physicalItems = Array.from(items).filter(isPhysical);

  // 1. Consumables
  const consumables = await Promise.all(physicalItems.filter(i => typeof i.isOfType === "function" ? i.isOfType("consumable") : i.type === "consumable").map(async c => {
    const category = c.category ?? c.system?.category ?? "other";
    const hasInjuryTrait = hasTrait(c, "injury") || hasTrait(c, "contact");
    const isPoison = category === "poison" || hasInjuryTrait || category === "oil";
    const isPotionOrElixir = ["potion", "elixir", "drug"].includes(category);
    const uses = {
      value: c.system?.uses?.value ?? 1,
      max: c.system?.uses?.max ?? 1
    };
    const description = await enrichItemDescription(c, actor);

    return {
      id: c.id,
      name: c.name,
      img: c.img,
      quantity: c.quantity ?? c.system?.quantity ?? 1,
      bulk: c.system?.bulk?.value ?? "-",
      category,
      categoryLabel: formatCategoryLabel(category),
      uses,
      hasUses: uses.max > 1,
      isPoison,
      canApplyToWeapon: isPoison,
      canAdminister: isPotionOrElixir,
      isPotionOrElixir,
      description,
      isExpanded: Boolean(sheet._expandedActionIds?.has(c.id))
    };
  }));

  // 2. Weapons & Attached Subitems (Poisons, Loaded Ammo) & Runes
  const weapons = await Promise.all(physicalItems.filter(i => typeof i.isOfType === "function" ? i.isOfType("weapon") : i.type === "weapon").map(async w => {
    const equipped = w.system?.equipped ?? {};
    const carryType = equipped.carryType ?? "worn";
    const handsHeld = equipped.handsHeld ?? 0;

    // Check attached subitems for poisons or ammunition
    const subitems = (w.subitems?.contents ?? []).map(s => {
      const cat = s.category ?? s.system?.category ?? "";
      const sInjury = hasTrait(s, "injury") || hasTrait(s, "poison") || cat === "poison" || cat === "oil";
      return {
        id: s.id,
        name: s.name,
        img: s.img,
        type: s.type,
        isPoison: sInjury,
        quantity: s.quantity ?? s.system?.quantity ?? 1
      };
    });

    const poison = subitems.find(s => s.isPoison) ?? null;
    const runesSummary = formatWeaponRunes(w.system?.runes);
    const description = await enrichItemDescription(w, actor);

    return {
      id: w.id,
      name: w.name,
      img: w.img,
      quantity: w.quantity ?? w.system?.quantity ?? 1,
      bulk: w.system?.bulk?.value ?? "-",
      isEquipped: w.isEquipped ?? (carryType === "held" || carryType === "worn"),
      isInvestable: isInvestableItem(w),
      isInvested: w.isInvested ?? (equipped.invested ?? false),
      carryType,
      handsHeld,
      carryLabel: formatCarryLabel(carryType, handsHeld),
      subitems,
      poison,
      isPoisoned: Boolean(poison),
      runesSummary,
      canHaveRunes: true,
      description,
      isExpanded: Boolean(sheet._expandedActionIds?.has(w.id))
    };
  }));

  // 3. Armor & Shields & Runes
  const armor = await Promise.all(physicalItems.filter(i => typeof i.isOfType === "function" ? i.isOfType("armor", "shield") : (i.type === "armor" || i.type === "shield")).map(async a => {
    const isShield = typeof a.isOfType === "function" ? a.isOfType("shield") : a.type === "shield";
    const equipped = a.system?.equipped ?? {};
    const carryType = equipped.carryType ?? "worn";
    const isEquipped = a.isEquipped ?? (isShield ? (carryType === "held" && (equipped.handsHeld ?? 0) > 0) : (carryType === "worn" && equipped.inSlot !== false));
    const runesSummary = isShield ? formatShieldRunes(a.system?.runes) : formatArmorRunes(a.system?.runes);
    const equipLabel = isEquipped ? (isShield ? "Held" : "Worn") : (isShield ? "Hold" : "Wear");
    const description = await enrichItemDescription(a, actor);

    return {
      id: a.id,
      name: a.name,
      img: a.img,
      bulk: a.system?.bulk?.value ?? "-",
      isShield,
      isEquipped,
      equipLabel,
      isInvested: a.isInvested ?? (equipped.invested ?? false),
      isInvestable: isInvestableItem(a),
      hp: a.system?.hp?.value,
      maxHp: a.system?.hp?.max,
      hardness: a.system?.hardness ?? 0,
      acBonus: a.system?.acBonus ?? (a.system?.armor?.value ?? 0),
      runesSummary,
      canHaveRunes: true,
      canBeWorn: true,
      description,
      isExpanded: Boolean(sheet._expandedActionIds?.has(a.id))
    };
  }));

  // 4. Other Physical Gear (Equipment, Backpacks, Books, Treasure, Ammo)
  const gear = await Promise.all(physicalItems.filter(i => {
    if (typeof i.isOfType === "function") {
      return i.isOfType("equipment", "backpack", "book", "treasure", "ammo");
    }
    return ["equipment", "backpack", "book", "treasure", "ammo"].includes(i.type);
  }).map(async g => {
    const isContainer = typeof g.isOfType === "function" ? g.isOfType("backpack") : g.type === "backpack";
    const equipped = g.system?.equipped ?? {};
    const usageType = g.system?.usage?.type ?? "";
    const usageValue = g.system?.usage?.value ?? "";
    const isWornUsage = usageType === "worn" || usageValue.startsWith("worn") || equipped.carryType === "worn" || g.type === "equipment";
    const isEquipped = g.isEquipped ?? (equipped.carryType === "worn" && equipped.inSlot !== false);
    const description = await enrichItemDescription(g, actor);

    return {
      id: g.id,
      name: g.name,
      img: g.img,
      quantity: g.quantity ?? g.system?.quantity ?? 1,
      bulk: g.system?.bulk?.value ?? "-",
      isContainer,
      isInvested: g.isInvested ?? (equipped.invested ?? false),
      isInvestable: isInvestableItem(g),
      isEquipped,
      equipLabel: isEquipped ? "Worn" : "Wear",
      canBeWorn: isWornUsage && !isContainer,
      isStowed: g.isStowed ?? false,
      containerName: g.container?.name ?? null,
      heldItemsCount: isContainer ? (g.contents?.size ?? g.contents?.length ?? 0) : 0,
      description,
      isExpanded: Boolean(sheet._expandedActionIds?.has(g.id))
    };
  }));

  context.inventory = {
    consumables,
    weapons,
    armor,
    gear,
    isConsumablesCollapsed: sheet._collapsedInventorySections?.has("consumables") ?? false,
    isWeaponsCollapsed: sheet._collapsedInventorySections?.has("weapons") ?? false,
    isArmorCollapsed: sheet._collapsedInventorySections?.has("armor") ?? false,
    isGearCollapsed: sheet._collapsedInventorySections?.has("gear") ?? false
  };
}

/**
 * Format category label into user-friendly title.
 * @param {string} category
 * @returns {string}
 */
function formatCategoryLabel(category) {
  if (!category) return "Item";
  const map = {
    potion: "Potion",
    elixir: "Elixir",
    poison: "Poison",
    oil: "Oil",
    scroll: "Scroll",
    wand: "Wand",
    talisman: "Talisman",
    snare: "Snare",
    drug: "Drug",
    ammo: "Ammo",
    toolkit: "Toolkit"
  };
  return map[category] ?? (category.charAt(0).toUpperCase() + category.slice(1));
}

/**
 * Format carry type into concise badge text.
 * @param {string} carryType
 * @param {number} handsHeld
 * @returns {string}
 */
function formatCarryLabel(carryType, handsHeld) {
  switch (carryType) {
    case "held":
      return handsHeld === 2 ? "Held (2H)" : "Held (1H)";
    case "worn":
      return "Worn";
    case "stowed":
      return "Stowed";
    case "dropped":
      return "Dropped";
    default:
      return "Carried";
  }
}

/**
 * Format active weapon runes into concise string.
 * @param {object} runes
 * @returns {string}
 */
function formatWeaponRunes(runes) {
  if (!runes) return "";
  const parts = [];
  if (runes.potency) parts.push(`+${runes.potency}`);
  if (runes.striking) {
    const map = { 1: "Striking", 2: "Gr. Striking", 3: "Maj. Striking" };
    parts.push(map[runes.striking] ?? "Striking");
  }
  if (Array.isArray(runes.property) && runes.property.length) {
    parts.push(...runes.property.map(p => {
      const slug = typeof p === "string" ? p : p?.slug ?? p?.value ?? "";
      if (!slug) return null;
      return getPropertyRuneLabel(slug, true) || slug;
    }).filter(Boolean));
  }
  return parts.join(" ");
}

/**
 * Format active armor runes into concise string.
 * @param {object} runes
 * @returns {string}
 */
function formatArmorRunes(runes) {
  if (!runes) return "";
  const parts = [];
  if (runes.potency) parts.push(`+${runes.potency}`);
  if (runes.resilient) {
    const map = { 1: "Resilient", 2: "Gr. Resilient", 3: "Maj. Resilient" };
    parts.push(map[runes.resilient] ?? "Resilient");
  }
  if (Array.isArray(runes.property) && runes.property.length) {
    parts.push(...runes.property.map(p => {
      const slug = typeof p === "string" ? p : p?.slug ?? p?.value ?? "";
      if (!slug) return null;
      return getPropertyRuneLabel(slug, false) || slug;
    }).filter(Boolean));
  }
  return parts.join(" ");
}

/**
 * Format active shield reinforcing runes into concise string.
 * @param {object} runes
 * @returns {string}
 */
function formatShieldRunes(runes) {
  if (!runes || !runes.reinforcing) return "";
  const map = { 1: "Minor", 2: "Lesser", 3: "Moderate", 4: "Greater", 5: "Major", 6: "True" };
  return `Reinforcing (${map[runes.reinforcing] ?? runes.reinforcing})`;
}
