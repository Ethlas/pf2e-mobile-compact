/**
 * Carry type of inventory items: held in one or two hands, worn (in its slot), stowed, dropped, ...
 * The Gear tab shows one carry badge per weapon, armor, shield and gear item; tapping it opens a picker with
 * the choices pf2e's own sheet offers in its carry menu (systems/pf2e/templates/actors/partials/carry-type.hbs).
 * A choice is passed to pf2e's actor.changeCarryType, and whether the item counts as equipped comes from pf2e's
 * item.isEquipped, which compares the carry type with the item's usage (a torch is held in one hand, a belt is
 * worn in its slot, ...). The labels are pf2e's own (PF2E.CarryType.*), so they follow the Foundry language.
 */

/** Font Awesome icons per carry type, the same as pf2e's carry menu. */
const CARRY_ICONS = {
  attached: "fa-paperclip",
  held: "fa-hand-back-fist",
  implanted: "fa-plug",
  worn: "fa-shirt",
  stowed: "fa-box",
  dropped: "fa-grip-lines"
};

/**
 * The worn slot of an item ("belt", "gloves", ...), or "" when it is not worn in a slot.
 * @param {Item} item
 * @returns {string}
 */
function wornSlot(item) {
  const usage = item.system?.usage ?? {};
  return usage.type === "worn" && usage.where ? usage.where : "";
}

/**
 * "Worn (Belt)" for an item worn in its slot.
 * @param {string} where
 * @returns {string}
 */
function wornInSlotLabel(where) {
  return game.i18n.format("PF2E.Item.Physical.Usage.WornParenthetical", {
    where: game.i18n.localize(`PF2E.Item.Physical.Usage.WornSlot.${where}`)
  });
}

/**
 * The current carry state of an item, for its badge on the Gear tab.
 * isEquipped (the badge turns green) is pf2e's item.isEquipped, except for items whose usage is "carried":
 * pf2e counts those as equipped however they are carried (only dropping them unequips them), so there is
 * no carry state that makes a difference to show.
 * @param {Item} item
 * @returns {{label: string, icon: string, isEquipped: boolean}}
 */
export function getCarryState(item) {
  const equipped = item.system?.equipped ?? {};
  const carryType = equipped.carryType ?? "worn";
  const where = wornSlot(item);
  let label;
  if (carryType === "held") label = game.i18n.localize(equipped.handsHeld === 2 ? "PF2E.CarryType.held2" : "PF2E.CarryType.held1");
  else if (carryType === "worn" && where && equipped.inSlot) label = wornInSlotLabel(where);
  else if (carryType === "stowed" && item.container) label = `In ${item.container.name}`;
  else label = game.i18n.localize(`PF2E.CarryType.${carryType}`);
  return { label, icon: CARRY_ICONS[carryType] ?? "fa-shirt", isEquipped: Boolean(item.isEquipped) && item.system?.usage?.type !== "carried" };
}

/**
 * The carry types an item can be changed to, in the order and with the conditions of pf2e's carry menu.
 * @param {Item} item
 * @returns {Array<{carryType: string, handsHeld: number, inSlot: boolean, label: string, icon: string, selected: boolean}>}
 */
export function getCarryOptions(item) {
  const actor = item.actor;
  const equipped = item.system?.equipped ?? {};
  const current = equipped.carryType;
  const where = wornSlot(item);
  const option = (carryType, label, { handsHeld = 0, inSlot = false, selected = current === carryType } = {}) =>
    ({ carryType, handsHeld, inSlot, label, icon: CARRY_ICONS[carryType], selected });

  const options = [];
  if (item.isAttachable) options.push(option("attached", game.i18n.localize("PF2E.CarryType.attached")));
  options.push(option("held", game.i18n.localize("PF2E.CarryType.held1"), { handsHeld: 1, selected: current === "held" && equipped.handsHeld === 1 }));
  options.push(option("held", game.i18n.localize("PF2E.CarryType.held2"), { handsHeld: 2, selected: current === "held" && equipped.handsHeld === 2 }));
  if (item.system?.usage?.type === "implanted") options.push(option("implanted", game.i18n.localize("PF2E.CarryType.implanted")));
  if (where) options.push(option("worn", wornInSlotLabel(where), { inSlot: true, selected: current === "worn" && Boolean(equipped.inSlot) }));
  options.push(option("worn", game.i18n.localize("PF2E.CarryType.worn"), { selected: current === "worn" && (!where || !equipped.inSlot) }));
  // Stowing needs a container to put the item in; pf2e only offers it when the actor has one.
  const hasStowingContainers = (actor?.itemTypes?.backpack ?? []).some(b => b.system?.stowing && !b.isInContainer);
  if (hasStowingContainers) options.push(option("stowed", game.i18n.localize("PF2E.CarryType.stowed")));
  options.push(option("dropped", game.i18n.localize("PF2E.CarryType.dropped")));
  return options;
}

/**
 * Action handler: open the carry type picker for an inventory item and apply the choice through pf2e.
 * @param {object} sheet - Mobile sheet instance
 * @param {Event} event
 * @param {HTMLElement} target  The carry badge, with data-item-id
 */
export async function onChangeCarryType(sheet, event, target) {
  event?.preventDefault?.();
  const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
  const item = sheet.actor.items.get(itemId);
  if (!item || typeof sheet.actor.changeCarryType !== "function") return;

  const choice = await promptCarryType(item);
  if (!choice) return;
  const equipped = item.system.equipped ?? {};
  // Same check as pf2e's carry menu: nothing to do when the current state is chosen again.
  const unchanged = choice.carryType === equipped.carryType && choice.inSlot === Boolean(equipped.inSlot)
    && (choice.carryType !== "held" || choice.handsHeld === equipped.handsHeld);
  if (unchanged) return;
  await sheet.actor.changeCarryType(item, { carryType: choice.carryType, handsHeld: choice.handsHeld, inSlot: choice.inSlot });
}

/**
 * Show the carry types of an item as a list of touch buttons.
 * @param {Item} item
 * @returns {Promise<object|null>} The chosen option from getCarryOptions, or null when cancelled.
 */
async function promptCarryType(item) {
  const options = getCarryOptions(item);
  const usageKey = CONFIG.PF2E?.usages?.[item.system?.usage?.value];
  const renderTemplateFn = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  const content = await renderTemplateFn("modules/pf2e-mobile-compact/templates/parts/carry-type-dialog.hbs", {
    item: { name: item.name, img: item.img },
    usage: usageKey ? game.i18n.localize(usageKey) : "",
    options
  });

  return new Promise(resolve => {
    let chosen = null;
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: item.name },
      content,
      buttons: [{ action: "cancel", label: "Cancel", icon: "fa-solid fa-times" }],
      actions: {
        chooseCarryType: (_event, button) => {
          chosen = options[Number(button.dataset.index)] ?? null;
          dialog.close();
        }
      }
    });
    dialog.addEventListener("close", () => resolve(chosen), { once: true });
    dialog.render({ force: true });
  });
}
