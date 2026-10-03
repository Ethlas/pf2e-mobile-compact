/**
 * Action handlers for the Character overview (templates/parts/character.hbs).
 */
import { closeHeaderMenu } from "./header-handlers.js";

/**
 * Action handler: the user button next to the character name opens the Character overview
 * (a view in the tab area, not a footer tab) and returns to the previous tab when tapped again.
 * The footer tabs also leave the overview (see _onSwitchTab in mobile-sheet.js).
 * @param {object} sheet
 */
export function onToggleCharacterOverview(sheet) {
  closeHeaderMenu(sheet);
  const scrollEl = sheet.element?.querySelector?.(".mobile-tab-content");
  if (scrollEl) sheet._tabScrollPositions?.set(sheet._activeTab, scrollEl.scrollTop);
  if (sheet._activeTab === "character") {
    sheet._activeTab = sheet._tabBeforeOverview ?? "actions";
  } else {
    sheet._tabBeforeOverview = sheet._activeTab;
    sheet._activeTab = "character";
    // Each visit starts with all feats closed and re-reads descriptions, in case a feat was edited meanwhile
    sheet._expandedItemIds?.clear();
    sheet._itemDescriptions?.clear();
  }
  sheet.render({ parts: ["header", "sheet"] });
}

/**
 * Re-renders the overview when game time moves on (a new combat round or turn, or world time),
 * so the effects' remaining durations stay current: pf2e derives them from the world time and
 * combat turn without updating the effect, so no document change triggers a render.
 * Does nothing unless the overview is open.
 * @param {object} sheet
 */
export function refreshOverviewDurations(sheet) {
  if (sheet.rendered && sheet._activeTab === "character") sheet.render({ parts: ["sheet"] });
}

/**
 * Enriches a feat or effect description the same way the Actions tab does (context-actions.js),
 * so inline rolls and content links work.
 * @param {Actor} actor
 * @param {Item} item
 * @returns {Promise<string>}
 */
async function enrichItemDescription(actor, item) {
  const rawDescription = item.system?.description?.value ?? "";
  const TextEditorClass = foundry.applications?.ux?.TextEditor ?? globalThis.TextEditor;
  if (!rawDescription || typeof TextEditorClass?.enrichHTML !== "function") return rawDescription;
  try {
    return await TextEditorClass.enrichHTML(rawDescription, {
      secrets: item.isOwner ?? false,
      rollData: actor.getRollData?.() ?? {},
      async: true
    });
  } catch {
    return rawDescription;
  }
}

/**
 * Action handler: tapping a feat or effect line in the overview opens or closes its description.
 * The description is only enriched on the first tap, not for every feat and effect when the overview opens,
 * since most are never opened. It is then cached on the sheet (sheet._itemDescriptions),
 * so open entries stay open, with their text, when the sheet re-renders (prepareCharacterContext reads the cache).
 * Opening and closing only changes the DOM; no re-render.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onToggleItemDescription(sheet, event, target) {
  const itemEl = target.closest(".character-item");
  const drawer = itemEl?.querySelector(":scope > .action-summary");
  const itemId = itemEl?.dataset.itemId;
  if (!drawer || !itemId) return;

  sheet._expandedItemIds ??= new Set();
  sheet._itemDescriptions ??= new Map();

  if (drawer.classList.contains("expanded")) {
    drawer.classList.replace("expanded", "collapsed");
    itemEl.classList.remove("expanded");
    sheet._expandedItemIds.delete(itemId);
    return;
  }

  if (!sheet._itemDescriptions.has(itemId)) {
    // Conditions are looked up the way pf2e's effects panel does: some only exist in actor.conditions
    const item = sheet.actor.conditions?.get?.(itemId) ?? sheet.actor.items.get(itemId);
    if (!item) return;
    sheet._itemDescriptions.set(itemId, await enrichItemDescription(sheet.actor, item));
  }
  const content = drawer.querySelector(".action-description-content");
  // An empty description shows the template's "No description." text (see character.hbs)
  if (content) content.innerHTML = sheet._itemDescriptions.get(itemId) ?? "";

  drawer.classList.replace("collapsed", "expanded");
  itemEl.classList.add("expanded");
  sheet._expandedItemIds.add(itemId);
}
