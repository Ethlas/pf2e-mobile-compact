/**
 * The order of the spellcasting entries on the Spells tab.
 * The entries are shown in pf2e's order: the entry items' sort value (see prepareSpellsContext). On pf2e's own
 * sheet that value changes by dragging one entry onto another; on a phone the ▲/▼ buttons in an entry's header
 * do the same with one tap. Both use sortRelative, so the new order is stored on the actor and pf2e's sheet
 * and the mobile sheet always agree.
 */

/**
 * Action handler: move a spellcasting entry one place up or down among the entries shown on the Spells tab.
 * The neighbour is taken from the rendered sections, so entries that are not shown there (staves, wands,
 * scrolls, empty entries) are skipped over and keep their place.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target  The button, with data-entry-id and data-direction ("up" or "down")
 */
export async function onMoveSpellEntry(sheet, event, target) {
  event?.preventDefault?.();
  const actor = sheet.actor;
  const entryId = target.dataset.entryId;
  const up = target.dataset.direction === "up";
  const entry = actor?.items.get(entryId);
  if (!entry?.isOfType?.("spellcastingEntry")) return;

  const shownIds = Array.from(sheet.element?.querySelectorAll(".spell-entry[data-entry-id]") ?? [], el => el.dataset.entryId);
  const index = shownIds.indexOf(entryId);
  const neighbourId = index < 0 ? null : shownIds[up ? index - 1 : index + 1];
  const neighbour = neighbourId ? actor.items.get(neighbourId) : null;
  if (!neighbour) return;

  // The siblings in the order the tab shows them (sort value, ties kept in collection order), without the
  // entry itself, so a reindex of equal sort values keeps that order. Only real entry items: the actor's
  // spellcasting collection can also hold pf2e's ritual pseudo-entry, which has no sort value to change.
  const siblings = [...(actor.spellcasting?.contents ?? [])]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map(e => actor.items.get(e.id))
    .filter(e => e?.isOfType?.("spellcastingEntry") && e.id !== entry.id);
  await entry.sortRelative({ target: neighbour, siblings, sortBefore: up });
}
