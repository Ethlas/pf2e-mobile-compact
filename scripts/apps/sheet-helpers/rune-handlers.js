/**
 * Specialized domain handler for Weapon, Armor, and Shield Rune management.
 * Scans character inventory for available Runestones and standalone rune items,
 * and restricts or filters rune etching to items actually owned by the actor.
 */

import {
  WEAPON_PROPERTY_RUNES,
  ARMOR_PROPERTY_RUNES,
  matchPropertyRune,
  getRuneItemMeta,
  getPropertyRuneLabel,
  normalizePropertyRuneSlug,
  sanitizePropertyRunes
} from "./rune-data.js";

export { WEAPON_PROPERTY_RUNES, ARMOR_PROPERTY_RUNES };

/**
 * Self-heals any legacy kebab-case or invalid property rune slugs stored on an
 * actor's owned weapons or armor (e.g. "greater-flaming" -> "greaterFlaming").
 * @param {Actor} actor
 */
export async function migrateActorPropertyRunes(actor) {
  if (!actor?.isOwner || !actor.items) return;
  for (const item of actor.items) {
    const isWeapon = item.type === "weapon";
    const isArmor = item.type === "armor";
    if (!isWeapon && !isArmor) continue;
    const rawProps = item._source?.system?.runes?.property ?? item.system?.runes?.property;
    if (!Array.isArray(rawProps) || rawProps.length === 0) continue;
    const sanitized = sanitizePropertyRunes(rawProps, isWeapon);
    const changed = sanitized.length !== rawProps.length || sanitized.some((s, idx) => s !== rawProps[idx]);
    if (changed) {
      try {
        console.info(`PF2e Mobile Compact | Auto-migrating property runes on ${item.name}:`, rawProps, "->", sanitized);
        await item.update({ "system.runes.property": sanitized });
      } catch (err) {
        console.warn(`PF2e Mobile Compact | Failed to auto-migrate property runes on ${item.name}:`, err);
      }
    }
  }
}

/**
 * Scan actor's inventory for fundamental and property runes.
 * @param {Actor} actor
 * @param {Item} targetItem
 * @param {"weapon"|"armor"|"shield"} itemType
 * @returns {object}
 */
export function scanInventoryRunes(actor, targetItem, itemType) {
  const isWeapon = itemType === "weapon";
  const isArmor = itemType === "armor";
  const isShield = itemType === "shield";

  const available = {
    potency: new Map([[0, { label: "None", source: "default" }]]),
    striking: new Map([[0, { label: "None", source: "default" }]]),
    resilient: new Map([[0, { label: "None", source: "default" }]]),
    reinforcing: new Map([[0, { label: "None", source: "default" }]]),
    property: new Map() // slug -> { label, source, item }
  };

  const currentRunes = targetItem.system?.runes ?? {};

  // 1. Retain currently etched runes on this target item
  if (currentRunes.potency) {
    available.potency.set(currentRunes.potency, {
      label: `+${currentRunes.potency} Potency (Current)`,
      source: "current"
    });
  }
  if (isWeapon && currentRunes.striking) {
    const map = { 1: "Striking", 2: "Greater Striking", 3: "Major Striking" };
    available.striking.set(currentRunes.striking, {
      label: `${map[currentRunes.striking] ?? "Striking"} (Current)`,
      source: "current"
    });
  }
  if (isArmor && currentRunes.resilient) {
    const map = { 1: "Resilient", 2: "Greater Resilient", 3: "Major Resilient" };
    available.resilient.set(currentRunes.resilient, {
      label: `${map[currentRunes.resilient] ?? "Resilient"} (Current)`,
      source: "current"
    });
  }
  if (isShield && currentRunes.reinforcing) {
    const map = { 1: "Minor", 2: "Lesser", 3: "Moderate", 4: "Greater", 5: "Major", 6: "True" };
    available.reinforcing.set(currentRunes.reinforcing, {
      label: `Reinforcing - ${map[currentRunes.reinforcing] ?? currentRunes.reinforcing} (Current)`,
      source: "current"
    });
  }
  if (Array.isArray(currentRunes.property)) {
    for (const p of currentRunes.property) {
      if (!p) continue;
      const rawSlug = typeof p === "string" ? p : p?.slug ?? p?.value ?? "";
      if (!rawSlug) continue;
      const slug = normalizePropertyRuneSlug(rawSlug, isWeapon);
      if (!slug) continue;
      const loc = getPropertyRuneLabel(slug, isWeapon) || (slug.charAt(0).toUpperCase() + slug.slice(1));
      available.property.set(slug, {
        label: `${loc} (Current)`,
        source: "current"
      });
    }
  }

  // 2. Scan physical items in the actor's inventory
  const items = actor.items ?? [];
  for (const item of items) {
    if (item.id === targetItem.id) continue;

    // A weapon or armor in inventory cannot be etched as a rune
    if (["weapon", "armor", "shield"].includes(item.type)) continue;

    const name = (item.name ?? "").toLowerCase();
    const slug = (item.slug ?? "").toLowerCase();
    const traits = (item.system?.traits?.value ?? []).map(t => (typeof t === "string" ? t : t?.value ?? "").toLowerCase());
    const isRuneOrMagical = traits.includes("rune") || traits.includes("magical");
    const usage = String(item.system?.usage?.value ?? item.system?.usage ?? "").toLowerCase();
    const isEtchedWeapon = usage.includes("etched") && (usage.includes("weapon") || !usage.includes("armor"));
    const isEtchedArmor = usage.includes("etched") && (usage.includes("armor") || !usage.includes("weapon"));
    const itemRunes = item.system?.runes ?? {};

    // A. Check system.runes (e.g. etched on an inventory Runestone)
    if (itemRunes.potency) {
      const pot = itemRunes.potency;
      if (!available.potency.has(pot)) {
        available.potency.set(pot, {
          label: `+${pot} Potency (${item.name})`,
          source: "inventory",
          item
        });
      }
    }
    if (isWeapon && itemRunes.striking) {
      const str = itemRunes.striking;
      const map = { 1: "Striking", 2: "Greater Striking", 3: "Major Striking" };
      if (!available.striking.has(str)) {
        available.striking.set(str, {
          label: `${map[str] ?? "Striking"} (${item.name})`,
          source: "inventory",
          item
        });
      }
    }
    if (isArmor && itemRunes.resilient) {
      const res = itemRunes.resilient;
      const map = { 1: "Resilient", 2: "Greater Resilient", 3: "Major Resilient" };
      if (!available.resilient.has(res)) {
        available.resilient.set(res, {
          label: `${map[res] ?? "Resilient"} (${item.name})`,
          source: "inventory",
          item
        });
      }
    }
    if (isShield && itemRunes.reinforcing) {
      const reinf = itemRunes.reinforcing;
      const map = { 1: "Minor", 2: "Lesser", 3: "Moderate", 4: "Greater", 5: "Major", 6: "True" };
      if (!available.reinforcing.has(reinf)) {
        available.reinforcing.set(reinf, {
          label: `Reinforcing - ${map[reinf] ?? reinf} (${item.name})`,
          source: "inventory",
          item
        });
      }
    }
    if (Array.isArray(itemRunes.property)) {
      for (const p of itemRunes.property) {
        if (!p) continue;
        const rawPSlug = typeof p === "string" ? p : p?.slug ?? p?.value ?? "";
        if (!rawPSlug) continue;
        const pSlug = normalizePropertyRuneSlug(rawPSlug, isWeapon);
        if (pSlug && !available.property.has(pSlug)) {
          const label = getPropertyRuneLabel(pSlug, isWeapon);
          available.property.set(pSlug, {
            label: `${label} (${item.name})`,
            source: "inventory",
            item
          });
        }
      }
    }

    // B. Check standalone fundamental rune items
    if (isWeapon) {
      if (slug.includes("weapon-potency-3") || name.includes("+3 weapon potency") || (name.includes("potency") && name.includes("3") && (isEtchedWeapon || isRuneOrMagical || name.includes("weapon")))) {
        if (!available.potency.has(3)) available.potency.set(3, { label: `+3 Potency (${item.name})`, source: "inventory", item });
      } else if (slug.includes("weapon-potency-2") || name.includes("+2 weapon potency") || (name.includes("potency") && name.includes("2") && (isEtchedWeapon || isRuneOrMagical || name.includes("weapon")))) {
        if (!available.potency.has(2)) available.potency.set(2, { label: `+2 Potency (${item.name})`, source: "inventory", item });
      } else if (slug.includes("weapon-potency-1") || name.includes("+1 weapon potency") || (name.includes("potency") && name.includes("1") && (isEtchedWeapon || isRuneOrMagical || name.includes("weapon")))) {
        if (!available.potency.has(1)) available.potency.set(1, { label: `+1 Potency (${item.name})`, source: "inventory", item });
      }

      if (slug.includes("major-striking") || name.includes("major striking")) {
        if (!available.striking.has(3)) available.striking.set(3, { label: `Major Striking (${item.name})`, source: "inventory", item });
      } else if (slug.includes("greater-striking") || name.includes("greater striking")) {
        if (!available.striking.has(2)) available.striking.set(2, { label: `Greater Striking (${item.name})`, source: "inventory", item });
      } else if ((slug === "striking" || name.includes("striking")) && !name.includes("greater") && !name.includes("major") && (isEtchedWeapon || isRuneOrMagical || item.type === "equipment")) {
        if (!available.striking.has(1)) available.striking.set(1, { label: `Striking (${item.name})`, source: "inventory", item });
      }
    }

    if (isArmor) {
      if (slug.includes("armor-potency-3") || name.includes("+3 armor potency") || (name.includes("potency") && name.includes("3") && (isEtchedArmor || isRuneOrMagical || name.includes("armor")))) {
        if (!available.potency.has(3)) available.potency.set(3, { label: `+3 Potency (${item.name})`, source: "inventory", item });
      } else if (slug.includes("armor-potency-2") || name.includes("+2 armor potency") || (name.includes("potency") && name.includes("2") && (isEtchedArmor || isRuneOrMagical || name.includes("armor")))) {
        if (!available.potency.has(2)) available.potency.set(2, { label: `+2 Potency (${item.name})`, source: "inventory", item });
      } else if (slug.includes("armor-potency-1") || name.includes("+1 armor potency") || (name.includes("potency") && name.includes("1") && (isEtchedArmor || isRuneOrMagical || name.includes("armor")))) {
        if (!available.potency.has(1)) available.potency.set(1, { label: `+1 Potency (${item.name})`, source: "inventory", item });
      }

      if (slug.includes("major-resilient") || name.includes("major resilient")) {
        if (!available.resilient.has(3)) available.resilient.set(3, { label: `Major Resilient (${item.name})`, source: "inventory", item });
      } else if (slug.includes("greater-resilient") || name.includes("greater resilient")) {
        if (!available.resilient.has(2)) available.resilient.set(2, { label: `Greater Resilient (${item.name})`, source: "inventory", item });
      } else if ((slug === "resilient" || name.includes("resilient")) && !name.includes("greater") && !name.includes("major") && (isEtchedArmor || isRuneOrMagical || item.type === "equipment")) {
        if (!available.resilient.has(1)) available.resilient.set(1, { label: `Resilient (${item.name})`, source: "inventory", item });
      }
    }

    if (isShield && (slug.includes("reinforcing") || name.includes("reinforcing"))) {
      if (name.includes("true") || slug.includes("true")) { if (!available.reinforcing.has(6)) available.reinforcing.set(6, { label: `True Reinforcing (${item.name})`, source: "inventory", item }); }
      else if (name.includes("major") || slug.includes("major")) { if (!available.reinforcing.has(5)) available.reinforcing.set(5, { label: `Major Reinforcing (${item.name})`, source: "inventory", item }); }
      else if (name.includes("greater") || slug.includes("greater")) { if (!available.reinforcing.has(4)) available.reinforcing.set(4, { label: `Greater Reinforcing (${item.name})`, source: "inventory", item }); }
      else if (name.includes("moderate") || slug.includes("moderate")) { if (!available.reinforcing.has(3)) available.reinforcing.set(3, { label: `Moderate Reinforcing (${item.name})`, source: "inventory", item }); }
      else if (name.includes("lesser") || slug.includes("lesser")) { if (!available.reinforcing.has(2)) available.reinforcing.set(2, { label: `Lesser Reinforcing (${item.name})`, source: "inventory", item }); }
      else if (name.includes("minor") || slug.includes("minor")) { if (!available.reinforcing.has(1)) available.reinforcing.set(1, { label: `Minor Reinforcing (${item.name})`, source: "inventory", item }); }
    }

    // C. Check standalone property rune items using official PF2e rules list & usage
    if (isWeapon || isArmor) {
      const match = matchPropertyRune(item, isWeapon);
      if (match && !available.property.has(match.slug)) {
        available.property.set(match.slug, {
          label: `${match.name} (${item.name})`,
          source: "inventory",
          item
        });
      }
    }
  }

  return available;
}

/**
 * Builds HTML for property rune slots dynamically based strictly on potency.
 * Max property slots in PF2e is equal to the potency rune value (+1 => 1, +2 => 2, +3 => 3, 0 => 0).
 * @param {number} potency - Fundamental potency value (0 to 3)
 * @param {string[]} currentProperties - Slugs of currently selected property runes
 * @param {Array<{slug: string, name: string}>} availablePropertyList - Sorted list of available property runes
 * @returns {string} HTML markup
 */
export function buildPropertySlotsHTML(potency, currentProperties = [], availablePropertyList = []) {
  const pot = Math.max(0, Math.min(3, parseInt(potency ?? 0, 10) || 0));

  if (pot === 0) {
    return `
      <div class="rune-prop-notice" style="text-align: center; padding: 12px 8px; color: #888; background: rgba(255,255,255,0.03); border-radius: 6px; font-size: 0.85rem; border: 1px dashed #444;">
        <i class="fas fa-circle-info" style="margin-right: 4px; color: #90caf9;"></i>
        Requires a <strong>+1, +2, or +3 Potency</strong> rune to etch property runes.
      </div>
    `;
  }

  const noneLabel = availablePropertyList.length === 0 ? "-- None in Inventory --" : "-- None --";

  let html = "";
  for (let slotIdx = 0; slotIdx < pot; slotIdx++) {
    const selectedSlug = currentProperties[slotIdx] ?? "";
    const options = `<option value="">${noneLabel}</option>` + availablePropertyList.map(r =>
      `<option value="${r.slug}" ${selectedSlug === r.slug ? "selected" : ""}>${r.name}</option>`
    ).join("");

    html += `
      <div class="rune-prop-slot-wrapper" style="margin-bottom: 8px;">
        <label style="display:block; margin-bottom: 4px; font-size: 0.82rem; color: #aaa;">Property Rune ${slotIdx + 1}:</label>
        <select class="rune-prop-slot" data-slot-index="${slotIdx}" onclick="event.stopPropagation()" style="width: 100%; min-height: 44px; font-size: 16px; border-radius: 6px; padding: 6px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          ${options}
        </select>
      </div>
    `;
  }

  return html;
}

/**
 * Builds HTML options for fundamental and property runes.
 * @param {object} params
 * @returns {object} Form field HTML strings
 */
function buildRuneOptionsHTML({ isWeapon, isArmor, isShield, available, runes }) {
  const currentPotency = runes.potency ?? 0;
  const currentStriking = runes.striking ?? 0;
  const currentResilient = runes.resilient ?? 0;
  const currentReinforcing = runes.reinforcing ?? 0;
  const currentProperties = (isWeapon || isArmor)
    ? sanitizePropertyRunes(runes.property, isWeapon)
    : [];

  let potencyOptions = "";
  let fundamentalSecondOptions = "";
  let propSlots = "";
  let propList = [];

  // 1. Potency Options (strictly inventory + current)
  if (isWeapon || isArmor) {
    const levels = Array.from(available.potency.keys()).sort((a, b) => a - b);
    potencyOptions = levels.map(v => {
      let label = v === 0 ? "None" : `+${v} Potency`;
      if (available.potency.has(v)) {
        label = available.potency.get(v).label;
      }
      return `<option value="${v}" ${currentPotency === v ? "selected" : ""}>${label}</option>`;
    }).join("");
  }

  // 2. Striking / Resilient / Reinforcing (strictly inventory + current)
  if (isWeapon) {
    const levels = Array.from(available.striking.keys()).sort((a, b) => a - b);
    fundamentalSecondOptions = levels.map(v => {
      let label = v === 0 ? "None" : "Striking";
      if (available.striking.has(v)) {
        label = available.striking.get(v).label;
      }
      return `<option value="${v}" ${currentStriking === v ? "selected" : ""}>${label}</option>`;
    }).join("");
  } else if (isArmor) {
    const levels = Array.from(available.resilient.keys()).sort((a, b) => a - b);
    fundamentalSecondOptions = levels.map(v => {
      let label = v === 0 ? "None" : "Resilient";
      if (available.resilient.has(v)) {
        label = available.resilient.get(v).label;
      }
      return `<option value="${v}" ${currentResilient === v ? "selected" : ""}>${label}</option>`;
    }).join("");
  } else if (isShield) {
    const levels = Array.from(available.reinforcing.keys()).sort((a, b) => a - b);
    fundamentalSecondOptions = levels.map(v => {
      let label = v === 0 ? "None" : "Reinforcing";
      if (available.reinforcing.has(v)) {
        label = available.reinforcing.get(v).label;
      }
      return `<option value="${v}" ${currentReinforcing === v ? "selected" : ""}>${label}</option>`;
    }).join("");
  }

  // 3. Property Runes (strictly inventory + current, slots matched to current potency)
  if (isWeapon || isArmor) {
    propList = Array.from(available.property.entries()).map(([slug, data]) => ({
      slug,
      name: data.label
    })).sort((a, b) => a.name.localeCompare(b.name));

    propSlots = buildPropertySlotsHTML(currentPotency, currentProperties, propList);
  }

  return { potencyOptions, fundamentalSecondOptions, propSlots, propList, currentPotency };
}

/**
 * Returns a removed rune back to the character sheet inventory.
 * Checks for an existing inventory stack, then attempts to fetch from
 * the official PF2e equipment compendium (pf2e.equipment-srd), and falls
 * back to generating a valid native PF2e equipment item.
 * @param {Actor} actor
 * @param {object} runeInfo
 * @returns {Promise<string>} Name of the returned rune item
 */
export async function returnRuneToInventory(actor, runeInfo) {
  const meta = getRuneItemMeta(runeInfo);
  const targetSlug = meta.slug;
  const targetName = meta.name;
  const searchTerms = (meta.searchTerms ?? [targetName.toLowerCase()]).map(s => s.toLowerCase());
  const isWeapon = runeInfo.itemType === "weapon";

  // 1. If actor already has this rune item in inventory, increment quantity
  const existing = actor.items.find(i => {
    if (!["equipment", "consumable", "treasure"].includes(i.type)) return false;
    const iSlug = (i.slug ?? "").toLowerCase();
    const iName = (i.name ?? "").toLowerCase();
    if (targetSlug && (i.slug === targetSlug || iSlug === `${targetSlug.toLowerCase()}-rune`)) return true;
    if (iName === targetName.toLowerCase()) return true;
    if (searchTerms.some(st => iName === st || iSlug === st.replace(/\s+/g, "-"))) return true;
    if (runeInfo.category === "property") {
      const matched = matchPropertyRune(i, isWeapon);
      if (matched && matched.slug === targetSlug) return true;
    }
    return false;
  });

  if (existing) {
    const currentQty = existing.system?.quantity ?? existing.quantity ?? 1;
    await existing.update({ "system.quantity": currentQty + 1 });
    return existing.name;
  }

  // 2. Look up the official item in pf2e.equipment-srd compendium pack
  try {
    const pack = game.packs?.get?.("pf2e.equipment-srd");
    if (pack) {
      const index = await pack.getIndex({ fields: ["system.slug"] });
      const entry = index.find(e => {
        const entrySlug = (e.system?.slug ?? e.slug ?? "").toLowerCase();
        const entryName = (e.name ?? "").toLowerCase();
        if (targetSlug && (entrySlug === targetSlug.toLowerCase() || entrySlug === `${targetSlug.toLowerCase()}-rune`)) return true;
        return searchTerms.some(st => entryName === st || entrySlug === st.replace(/\s+/g, "-"));
      });

      if (entry) {
        const doc = await pack.getDocument(entry._id);
        if (doc) {
          const itemData = doc.toObject();
          if (itemData.system?.equipped) {
            itemData.system.equipped = { carryType: "worn", inSlot: false };
          }
          if (itemData.system?.quantity !== undefined) {
            itemData.system.quantity = 1;
          }
          delete itemData._id;
          const [created] = await actor.createEmbeddedDocuments("Item", [itemData]);
          return created?.name ?? doc.name;
        }
      }
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | Error looking up rune in pf2e.equipment-srd:", err);
  }

  // 3. Fallback: Create a clean native PF2e equipment rune item
  const isArmor = runeInfo.itemType === "armor";
  const fallbackItem = {
    name: targetName,
    type: "equipment",
    img: isArmor
      ? "systems/pf2e/icons/equipment/runes/armor-property-runes.webp"
      : "systems/pf2e/icons/equipment/runes/weapon-property-runes.webp",
    system: {
      description: { value: `<p>A magical ${targetName} removed from equipment and returned to inventory.</p>` },
      traits: { value: ["magical", "rune"] },
      quantity: 1,
      bulk: { value: "-" },
      equipped: { carryType: "worn", inSlot: false },
      usage: { value: isArmor ? "etched-onto-armor" : "etched-onto-a-weapon" }
    }
  };
  const [created] = await actor.createEmbeddedDocuments("Item", [fallbackItem]);
  return created?.name ?? targetName;
}

/**
 * Prompts user to configure runes on a weapon, armor, or shield.
 * Strictly queries actor's gear and inventory for owned runes.
 * Shows property rune slots based on selected potency.
 * @param {object} sheet - Application instance
 * @param {Item} item - Weapon, armor, or shield item
 * @returns {Promise<boolean>}
 */
export async function promptRuneConfiguration(sheet, item) {
  const isWeapon = typeof item.isOfType === "function" ? item.isOfType("weapon") : item.type === "weapon";
  const isArmor = typeof item.isOfType === "function" ? item.isOfType("armor") : item.type === "armor";
  const isShield = typeof item.isOfType === "function" ? item.isOfType("shield") : item.type === "shield";

  if (!isWeapon && !isArmor && !isShield) {
    ui.notifications?.warn("Runes cannot be applied to this item type.");
    return false;
  }

  const itemType = isWeapon ? "weapon" : isArmor ? "armor" : "shield";
  const runes = item.system?.runes ?? {};
  const available = scanInventoryRunes(sheet.actor, item, itemType);

  const getFieldsHTML = () => {
    const { potencyOptions, fundamentalSecondOptions, propSlots, currentPotency } = buildRuneOptionsHTML({
      isWeapon, isArmor, isShield, available, runes
    });

    const hasAnyOptions = isWeapon
      ? (available.potency.size > 1 || available.striking.size > 1 || available.property.size > 0 || (runes.potency || runes.striking || runes.property?.length))
      : isArmor
      ? (available.potency.size > 1 || available.resilient.size > 1 || available.property.size > 0 || (runes.potency || runes.resilient || runes.property?.length))
      : (available.reinforcing.size > 1 || runes.reinforcing);

    if (!hasAnyOptions) {
      return `
        <div style="text-align: center; padding: 18px 10px; color: #aaa; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: 12px;">
          <i class="fas fa-gem" style="font-size: 1.6rem; color: #777; margin-bottom: 8px; display: block;"></i>
          <p style="margin: 0; font-size: 0.95rem;">No runes or runestones found in your inventory.</p>
          <span style="font-size: 0.8rem; color: #777;">Place runestones or rune items in your gear to etch them.</span>
        </div>
      `;
    }

    if (isWeapon) {
      return `
        <div style="margin-bottom: 12px;">
          <label style="display:block; margin-bottom: 4px; font-size: 0.85rem; color: #aaa;">Fundamental Potency:</label>
          <select id="rune-potency-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 44px; font-size: 16px; border-radius: 6px; padding: 6px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
            ${potencyOptions}
          </select>
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display:block; margin-bottom: 4px; font-size: 0.85rem; color: #aaa;">Fundamental Striking:</label>
          <select id="rune-striking-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 44px; font-size: 16px; border-radius: 6px; padding: 6px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
            ${fundamentalSecondOptions}
          </select>
        </div>
        <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 0.88rem; font-weight: bold; color: #90caf9;">Property Runes</span>
            <span id="rune-property-count-badge" style="font-size: 0.75rem; color: #aaa;">(${Math.min(currentPotency, 3)} max)</span>
          </div>
          <div id="rune-property-slots-container">
            ${propSlots}
          </div>
        </div>
      `;
    }

    if (isArmor) {
      return `
        <div style="margin-bottom: 12px;">
          <label style="display:block; margin-bottom: 4px; font-size: 0.85rem; color: #aaa;">Fundamental Potency:</label>
          <select id="rune-potency-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 44px; font-size: 16px; border-radius: 6px; padding: 6px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
            ${potencyOptions}
          </select>
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display:block; margin-bottom: 4px; font-size: 0.85rem; color: #aaa;">Fundamental Resilient:</label>
          <select id="rune-resilient-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 44px; font-size: 16px; border-radius: 6px; padding: 6px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
            ${fundamentalSecondOptions}
          </select>
        </div>
        <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 0.88rem; font-weight: bold; color: #90caf9;">Property Runes</span>
            <span id="rune-property-count-badge" style="font-size: 0.75rem; color: #aaa;">(${Math.min(currentPotency, 3)} max)</span>
          </div>
          <div id="rune-property-slots-container">
            ${propSlots}
          </div>
        </div>
      `;
    }

    return `
      <div style="margin-bottom: 12px;">
        <label style="display:block; margin-bottom: 4px; font-size: 0.85rem; color: #aaa;">Reinforcing Rune:</label>
        <select id="rune-reinforcing-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 44px; font-size: 16px; border-radius: 6px; padding: 6px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          ${fundamentalSecondOptions}
        </select>
      </div>
    `;
  };

  const { propList } = buildRuneOptionsHTML({ isWeapon, isArmor, isShield, available, runes });

  return new Promise(resolve => {
    const { DialogV2 } = foundry.applications.api ?? {};

    const content = `
      <div style="padding: 8px; text-align: left;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; border-bottom: 1px solid #444; padding-bottom: 8px;">
          <img src="${item.img}" alt="${item.name}" width="36" height="36" style="border-radius: 4px; border: 1px solid #555;" />
          <div>
            <strong style="font-size: 1.05rem; display: block;">${item.name}</strong>
            <span style="font-size: 0.8rem; color: #aaa;">Configure Enchantments &amp; Runes</span>
          </div>
        </div>

        <div style="background: rgba(144, 202, 249, 0.08); border: 1px solid rgba(144, 202, 249, 0.25); border-radius: 6px; padding: 6px 10px; margin-bottom: 12px; font-size: 0.84rem; color: #90caf9;">
          <i class="fas fa-gem"></i> Selecting from runes available in your inventory
        </div>

        <div id="rune-fields-container">
          ${getFieldsHTML()}
        </div>

        <!-- Inventory Source Consumption -->
        <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #444;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: #aaa; cursor: pointer; user-select: none;">
            <input type="checkbox" id="rune-consume-source" checked style="width: 16px; height: 16px; accent-color: #e65100;" />
            <span>Remove etched rune items from inventory</span>
          </label>
        </div>
      </div>
    `;

    // Attaches change listener to potency select to dynamically resize property slots
    const bindPotencyChangeListener = (rootEl) => {
      if (!rootEl) return;
      const potencySelect = rootEl.querySelector("#rune-potency-select");
      const slotsContainer = rootEl.querySelector("#rune-property-slots-container");
      const countBadge = rootEl.querySelector("#rune-property-count-badge");

      if (potencySelect && slotsContainer) {
        potencySelect.addEventListener("change", (e) => {
          const newPot = parseInt(e.target.value ?? "0", 10) || 0;
          const currentSelected = Array.from(slotsContainer.querySelectorAll(".rune-prop-slot")).map(s => s.value);
          slotsContainer.innerHTML = buildPropertySlotsHTML(newPot, currentSelected, propList);
          if (countBadge) {
            countBadge.textContent = `(${Math.min(newPot, 3)} max)`;
          }
        });
      }
    };

    const handleSave = async (rootEl) => {
      const updates = {};
      const newlyAddedSources = [];
      const removedRunes = [];

      if (isWeapon) {
        const pot = parseInt(rootEl.querySelector("#rune-potency-select")?.value ?? "0", 10) || 0;
        const str = parseInt(rootEl.querySelector("#rune-striking-select")?.value ?? "0", 10) || 0;
        const propSelects = rootEl.querySelectorAll(".rune-prop-slot");
        const rawProps = Array.from(propSelects).map(s => s.value).filter(Boolean);
        // Strictly limit property runes to potency capacity, and normalize/drop any slug
        // this PF2e build cannot resolve (an unknown slug throws in its data prep).
        const props = sanitizePropertyRunes([...new Set(rawProps)], true).slice(0, pot);

        const oldPot = runes.potency ?? 0;
        const oldStr = runes.striking ?? 0;
        const oldProps = sanitizePropertyRunes(runes.property, true);

        if (pot > oldPot && available.potency.get(pot)?.item) {
          newlyAddedSources.push(available.potency.get(pot).item);
        }
        if (str > oldStr && available.striking.get(str)?.item) {
          newlyAddedSources.push(available.striking.get(str).item);
        }
        for (const p of props) {
          if (!oldProps.includes(p) && available.property.get(p)?.item) {
            newlyAddedSources.push(available.property.get(p).item);
          }
        }

        // Track removed runes to return to actor inventory
        if (oldPot > 0 && pot < oldPot) {
          removedRunes.push({ category: "potency", value: oldPot, itemType: "weapon" });
        }
        if (oldStr > 0 && str < oldStr) {
          removedRunes.push({ category: "striking", value: oldStr, itemType: "weapon" });
        }
        for (const p of oldProps) {
          if (!props.includes(p)) {
            removedRunes.push({ category: "property", value: p, itemType: "weapon" });
          }
        }

        updates["system.runes.potency"] = pot;
        updates["system.runes.striking"] = str;
        updates["system.runes.property"] = props;
      } else if (isArmor) {
        const pot = parseInt(rootEl.querySelector("#rune-potency-select")?.value ?? "0", 10) || 0;
        const res = parseInt(rootEl.querySelector("#rune-resilient-select")?.value ?? "0", 10) || 0;
        const propSelects = rootEl.querySelectorAll(".rune-prop-slot");
        const rawProps = Array.from(propSelects).map(s => s.value).filter(Boolean);
        // Strictly limit property runes to potency capacity, and normalize/drop any slug
        // this PF2e build cannot resolve (an unknown slug throws in its data prep).
        const props = sanitizePropertyRunes([...new Set(rawProps)], false).slice(0, pot);

        const oldPot = runes.potency ?? 0;
        const oldRes = runes.resilient ?? 0;
        const oldProps = sanitizePropertyRunes(runes.property, false);

        if (pot > oldPot && available.potency.get(pot)?.item) {
          newlyAddedSources.push(available.potency.get(pot).item);
        }
        if (res > oldRes && available.resilient.get(res)?.item) {
          newlyAddedSources.push(available.resilient.get(res).item);
        }
        for (const p of props) {
          if (!oldProps.includes(p) && available.property.get(p)?.item) {
            newlyAddedSources.push(available.property.get(p).item);
          }
        }

        // Track removed runes to return to actor inventory
        if (oldPot > 0 && pot < oldPot) {
          removedRunes.push({ category: "potency", value: oldPot, itemType: "armor" });
        }
        if (oldRes > 0 && res < oldRes) {
          removedRunes.push({ category: "resilient", value: oldRes, itemType: "armor" });
        }
        for (const p of oldProps) {
          if (!props.includes(p)) {
            removedRunes.push({ category: "property", value: p, itemType: "armor" });
          }
        }

        updates["system.runes.potency"] = pot;
        updates["system.runes.resilient"] = res;
        updates["system.runes.property"] = props;
      } else if (isShield) {
        const reinf = parseInt(rootEl.querySelector("#rune-reinforcing-select")?.value ?? "0", 10) || 0;
        const oldReinf = runes.reinforcing ?? 0;
        if (reinf > oldReinf && available.reinforcing.get(reinf)?.item) {
          newlyAddedSources.push(available.reinforcing.get(reinf).item);
        }
        if (oldReinf > 0 && reinf < oldReinf) {
          removedRunes.push({ category: "reinforcing", value: oldReinf, itemType: "shield" });
        }
        updates["system.runes.reinforcing"] = reinf;
      }

      await item.update(updates);

      // Return any removed runes back to the actor's inventory
      const returnedNames = [];
      for (const rune of removedRunes) {
        try {
          const retName = await returnRuneToInventory(sheet.actor, rune);
          if (retName) returnedNames.push(retName);
        } catch (err) {
          console.error("PF2e Mobile Compact | Failed to return rune to inventory:", rune, err);
        }
      }

      // Handle optional inventory source item consumption
      const consumeSource = rootEl.querySelector("#rune-consume-source")?.checked ?? false;
      if (consumeSource && newlyAddedSources.length > 0) {
        const sourceCounts = new Map();
        for (const src of newlyAddedSources) {
          if (!src?.id) continue;
          const entry = sourceCounts.get(src.id) ?? { item: src, count: 0 };
          entry.count += 1;
          sourceCounts.set(src.id, entry);
        }
        for (const { item: src, count } of sourceCounts.values()) {
          const currentQty = src.quantity ?? src.system?.quantity ?? 1;
          if (currentQty > count) {
            await src.update({ "system.quantity": currentQty - count });
          } else {
            await src.delete();
          }
        }
      }

      if (returnedNames.length > 0 && newlyAddedSources.length > 0) {
        ui.notifications?.info(`Updated runes on ${item.name}. Added to inventory: ${returnedNames.join(", ")}.`);
      } else if (returnedNames.length > 0) {
        ui.notifications?.info(`Removed runes added to inventory: ${returnedNames.join(", ")}.`);
      } else if (consumeSource && newlyAddedSources.length > 0) {
        ui.notifications?.info(`Applied runes and removed transferred items from inventory.`);
      } else {
        ui.notifications?.info(`Updated runes on ${item.name}.`);
      }

      sheet.render();
      resolve(true);
    };

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `Runes: ${item.name}` },
        content,
        render: (event, html) => {
          const rootEl = (html instanceof HTMLElement)
            ? html
            : (html?.element instanceof HTMLElement)
            ? html.element
            : (event?.target instanceof HTMLElement)
            ? event.target
            : null;
          bindPotencyChangeListener(rootEl);
        },
        ok: {
          label: "Save Runes",
          callback: async (event, button, dialog) => {
            const rootEl = dialog.element ?? dialog;
            await handleSave(rootEl);
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) resolve(false);
      });
    } else {
      new Dialog({
        title: `Runes: ${item.name}`,
        content,
        render: (html) => {
          const rootEl = html[0] ?? html;
          bindPotencyChangeListener(rootEl);
        },
        buttons: {
          save: {
            label: "Save Runes",
            callback: async (html) => {
              const rootEl = html[0] ?? html;
              await handleSave(rootEl);
            }
          },
          cancel: {
            label: "Cancel",
            callback: () => resolve(false)
          }
        },
        default: "save",
        close: () => resolve(false)
      }).render(true);
    }
  });
}
