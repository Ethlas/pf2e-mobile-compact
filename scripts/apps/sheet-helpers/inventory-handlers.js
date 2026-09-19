import { setTargetToken, getTargetableToken } from "../../tokens/token-adapter.js";
import {
  promptConsumableUsage,
  promptWeaponSelectionForAttachment
} from "./sheet-prompts.js";
import { promptRuneConfiguration } from "./rune-handlers.js";

/**
 * Domain handlers for inventory, physical items, consumables, and weapon attachments.
 */

/**
 * Action handler: Use consumable (potion, elixir, drug, scroll, wand, or poison).
 * Offers self-use or administering to a comrade token on the scene.
 * @param {object} sheet - Mobile sheet instance
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onUseConsumable(sheet, event, target) {
  const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
  const item = sheet.actor.items.get(itemId);
  if (!item) return;

  const category = item.category ?? item.system?.category ?? "";
  const traits = item.system?.traits?.value ?? [];
  const hasInjuryTrait = Array.isArray(traits) && traits.some(t => {
    const s = typeof t === "string" ? t : t?.value ?? "";
    return s.toLowerCase() === "injury" || s.toLowerCase() === "contact";
  });
  const isPoison = category === "poison" || hasInjuryTrait || category === "oil";

  // If item is an injury poison or oil, route directly to weapon application
  if (isPoison) {
    return onApplyPoison(sheet, event, target);
  }

  // If item is a potion, elixir, or drug, present self vs comrade administration prompt
  const isPotionOrElixir = ["potion", "elixir", "drug"].includes(category);
  if (isPotionOrElixir) {
    const choice = await promptConsumableUsage(sheet, item);
    if (!choice) return; // User cancelled

    if (choice.mode === "ally" && choice.targetId) {
      await setTargetToken(choice.targetId);
      const allyName = choice.targetToken?.name ?? "Comrade";

      // Execute native consumption (deducts uses/quantity and emits roll/message)
      if (typeof item.consume === "function") {
        await item.consume();
      }

      // Post Paizo-style administration chat card
      const speaker = ChatMessage.getSpeaker({ actor: sheet.actor });
      const content = `
        <div class="pf2e chat-card">
          <header class="card-header">
            <img src="${item.img}" width="32" height="32" style="border-radius: 4px; border: 1px solid #444;" />
            <h3>Administered Consumable</h3>
          </header>
          <div class="card-content">
            <p><strong>${sheet.actor.name}</strong> administers <strong>${item.name}</strong> to <strong>${allyName}</strong> (1 Action - Interact).</p>
          </div>
        </div>
      `;
      await ChatMessage.create({ speaker, content });
      ui.notifications?.info(`Administered ${item.name} to ${allyName}.`);
      return;
    }

    // Otherwise use on self
    if (typeof item.consume === "function") {
      await item.consume();
      ui.notifications?.info(`${sheet.actor.name} consumed ${item.name}.`);
    }
    return;
  }

  // Fallback for scrolls, wands, talismans, and general consumables
  if (typeof item.consume === "function") {
    await item.consume();
  }
}

/**
 * Action handler: Apply poison or oil onto a carried weapon using PF2e's native subitem attachment system.
 * @param {object} sheet - Mobile sheet instance
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onApplyPoison(sheet, event, target) {
  const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
  const poisonItem = sheet.actor.items.get(itemId);
  if (!poisonItem) return;

  const weapons = sheet.actor.itemTypes.weapon ?? [];
  if (weapons.length === 0) {
    ui.notifications?.warn("No weapons available in inventory to apply poison to.");
    return;
  }

  const selectedWeapon = await promptWeaponSelectionForAttachment(sheet, poisonItem, weapons);
  if (!selectedWeapon) return;

  if (typeof selectedWeapon.attach === "function") {
    await selectedWeapon.attach(poisonItem, { quantity: 1 });

    const speaker = ChatMessage.getSpeaker({ actor: sheet.actor });
    const content = `
      <div class="pf2e chat-card">
        <header class="card-header">
          <img src="${poisonItem.img}" width="32" height="32" style="border-radius: 4px; border: 1px solid #444;" />
          <h3>Applied Weapon Poison</h3>
        </header>
        <div class="card-content">
          <p><strong>${sheet.actor.name}</strong> applied <strong>${poisonItem.name}</strong> to <strong>${selectedWeapon.name}</strong> (1 Action - Interact).</p>
        </div>
      </div>
    `;
    await ChatMessage.create({ speaker, content });
    ui.notifications?.info(`Applied ${poisonItem.name} to ${selectedWeapon.name}.`);
    sheet.render();
  } else {
    ui.notifications?.error("Selected weapon does not support attaching items.");
  }
}

/**
 * Action handler: Detach a subitem (poison, ammunition, talisman) from a parent weapon.
 * @param {object} sheet - Mobile sheet instance
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onDetachSubitem(sheet, event, target) {
  const weaponId = target.dataset.weaponId ?? target.closest("[data-weapon-id]")?.dataset.weaponId;
  const subitemId = target.dataset.subitemId ?? target.closest("[data-subitem-id]")?.dataset.subitemId;
  const weapon = sheet.actor.items.get(weaponId);
  if (!weapon) return;

  const subitem = weapon.subitems?.get(subitemId) ?? weapon.subitems?.contents?.find(s => s.id === subitemId);
  if (!subitem) return;

  if (typeof subitem.detach === "function") {
    await subitem.detach({ skipConfirm: true });
    ui.notifications?.info(`Cleaned / detached ${subitem.name} from ${weapon.name}.`);
    sheet.render();
  }
}

/**
 * Action handler: Change carry type for an inventory item (Held 1H, Held 2H, Worn, Stowed).
 * @param {object} sheet - Mobile sheet instance
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onChangeCarryType(sheet, event, target) {
  const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
  const item = sheet.actor.items.get(itemId);
  if (!item || typeof sheet.actor.changeCarryType !== "function") return;

  const currentEquipped = item.system.equipped ?? {};
  const currentType = currentEquipped.carryType ?? "worn";
  const handsHeld = currentEquipped.handsHeld ?? 0;

  let newCarryType = "worn";
  let newHands = 0;

  if (currentType === "worn") {
    newCarryType = "held";
    newHands = 1;
  } else if (currentType === "held" && handsHeld === 1 && (item.traits?.has("two-hand-d8") || item.traits?.has("two-hand-d10") || item.traits?.has("two-hand-d12") || item.system.usage?.value === "held-in-two-hands")) {
    newCarryType = "held";
    newHands = 2;
  } else if (currentType === "held") {
    newCarryType = "worn";
    newHands = 0;
  } else {
    newCarryType = "held";
    newHands = 1;
  }

  await sheet.actor.changeCarryType(item, { carryType: newCarryType, handsHeld: newHands });
  sheet.render();
}

/**
 * Action handler: Toggle collapsible state of an inventory section.
 * @param {object} sheet - Mobile sheet instance
 * @param {Event} event
 * @param {HTMLElement} target
 */
export function onToggleInventorySection(sheet, event, target) {
  const section = target.dataset.section ?? target.closest("[data-section]")?.dataset.section;
  if (!section) return;

  if (!sheet._collapsedInventorySections) {
    sheet._collapsedInventorySections = new Set();
  }

  if (sheet._collapsedInventorySections.has(section)) {
    sheet._collapsedInventorySections.delete(section);
  } else {
    sheet._collapsedInventorySections.add(section);
  }

  sheet.render();
}

/**
 * Action handler: Open rune configurator for a weapon, armor, or shield.
 * @param {object} sheet - Mobile sheet instance
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onConfigureRunes(sheet, event, target) {
  const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
  const item = sheet.actor.items.get(itemId);
  if (!item) return;

  return promptRuneConfiguration(sheet, item);
}

/**
 * Action handler: Toggle investiture on an investable item.
 * @param {object} sheet - Mobile sheet instance
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onToggleInvested(sheet, event, target) {
  const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
  const item = sheet.actor.items.get(itemId);
  if (!item) return;

  if (typeof sheet.actor.toggleInvested === "function") {
    await sheet.actor.toggleInvested(itemId);
    const isNowInvested = item.isInvested;
    ui.notifications?.info(`${item.name} is now ${isNowInvested ? "invested" : "no longer invested"}.`);
    sheet.render();
  } else {
    const curr = item.system.equipped?.invested ?? false;
    await item.update({ "system.equipped.invested": !curr });
    sheet.render();
  }
}

/**
 * Action handler: Toggle equipped / worn state of an item (armor, shield, or worn equipment).
 * @param {object} sheet - Mobile sheet instance
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onToggleEquipped(sheet, event, target) {
  const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
  const item = sheet.actor.items.get(itemId);
  if (!item || typeof sheet.actor.changeCarryType !== "function") return;

  if (item.isOfType?.("weapon") || item.type === "weapon") {
    return onChangeCarryType(sheet, event, target);
  }

  const isShield = typeof item.isOfType === "function" ? item.isOfType("shield") : item.type === "shield";
  const isArmor = typeof item.isOfType === "function" ? item.isOfType("armor") : item.type === "armor";
  const isEquipped = item.isEquipped ?? false;

  if (isArmor) {
    if (isEquipped) {
      await sheet.actor.changeCarryType(item, { carryType: "worn", inSlot: false });
      ui.notifications?.info(`Removed ${item.name}.`);
    } else {
      await sheet.actor.changeCarryType(item, { carryType: "worn", inSlot: true });
      ui.notifications?.info(`Donned ${item.name}.`);
    }
  } else if (isShield) {
    if (isEquipped) {
      await sheet.actor.changeCarryType(item, { carryType: "worn", handsHeld: 0 });
      ui.notifications?.info(`Lowered/Wore ${item.name}.`);
    } else {
      await sheet.actor.changeCarryType(item, { carryType: "held", handsHeld: 1 });
      ui.notifications?.info(`Equipped ${item.name} in hand.`);
    }
  } else {
    if (isEquipped) {
      try {
        await sheet.actor.changeCarryType(item, { carryType: "stowed" });
        ui.notifications?.info(`Stowed ${item.name}.`);
      } catch {
        await sheet.actor.changeCarryType(item, { carryType: "dropped" });
        ui.notifications?.info(`Unequipped ${item.name}.`);
      }
    } else {
      await sheet.actor.changeCarryType(item, { carryType: "worn" });
      ui.notifications?.info(`Wore ${item.name}.`);
    }
  }
  sheet.render();
}


