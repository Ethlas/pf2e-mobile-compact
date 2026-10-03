/**
 * Action handler for pf2e's roll-option toggles (templates/parts/toggles.hbs, data from context-toggles.js).
 */

/**
 * Action handler (change event of a toggle's checkbox or dropdown): switches the toggle or picks a choice
 * through pf2e's actor.toggleRollOption, the same call pf2e's own sheet makes. The row carries the toggle's
 * domain, option and item; the checkbox and the dropdown are read together, so a dropdown change keeps the
 * checkbox's state. An always-active toggle has no checkbox and stays on. pf2e updates the item, which
 * re-renders the sheet.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target  The checkbox or dropdown that changed
 */
export async function onSetRollOption(sheet, event, target) {
  const row = target.closest("[data-domain][data-option]");
  if (!row) return;
  const { domain, option, toggleItemId } = row.dataset;
  const checkbox = row.querySelector("input[type=checkbox]");
  const select = row.querySelector("select");
  const value = checkbox ? checkbox.checked : true;
  await sheet.actor.toggleRollOption(domain, option, toggleItemId || null, value, select?.value ?? null);
}
