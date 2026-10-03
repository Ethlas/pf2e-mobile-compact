/**
 * Context preparation for pf2e's roll-option toggles: the checkboxes (some with a dropdown) that pf2e's own
 * character sheet shows above the strikes and above the spellcasting entries, e.g. a sorcerer's Blood Magic,
 * Spellshape, a rogue's Debilitation or an exemplar's Divine Spark. pf2e uses them as roll options, so
 * switching one changes the next roll. Rendered by templates/parts/toggles.hbs, switched by
 * onSetRollOption (toggles-handlers.js).
 *
 * Everything is read from what pf2e has already prepared: the toggles in actor.synthetics.toggles (the same
 * list pf2e's sheet shows), the rule elements in actor.rules and the items they come from. Nothing is
 * decided by name; a toggle is sorted by its structure:
 *
 * 1. Left out: theater-of-the-mind toggles (pf2e's "totm" world setting), and toggles that only come from
 *    archetype or mythic feats, general and skill feats, or equipment (e.g. a lit torch).
 * 2. Actions / Spells tab (pf2e's placement): toggles with a dropdown.
 * 3. Left out: on/off toggles whose rules only add a modifier or damage dice to a roll (plus chat notes).
 *    pf2e's roll dialog already lists such a modifier as a row that can be switched on (e.g. Sorcerous
 *    Potency, Dazing Blow).
 * 4. Actions / Spells tab: the other toggles of an action, reaction or free action, or of a feature with
 *    limited uses (a frequency).
 * 5. Character tab, "Specials": every other on/off toggle (auras, reach, senses, rage damage ...).
 */

// Rule element types that pf2e's roll dialogs list as a row of their own, which can be switched on there
const ROLL_DIALOG_RULE_TYPES = new Set(["FlatModifier", "DamageDice"]);

// Rule element types that only add text to the chat card (a note on the roll's outcome); they don't need the
// toggle on the sheet: when the toggle is switched on in the roll dialog, pf2e still shows the note
const CHAT_NOTE_RULE_TYPES = new Set(["Note"]);

// Selectors of modifiers that are never rolled (so no roll dialog shows them): AC, HP, speeds and DCs
const UNROLLED_SELECTOR = /^(ac|hp|speed|[-a-z]+-speed|[-a-z]+-dc)$/;

// Feat categories whose toggles are shown; feats of other categories (general, skill, bonus ...) are not
const ANCESTRY_CATEGORIES = new Set(["ancestry", "ancestryfeature", "heritage"]);

// Traits of feats whose toggles are not shown
const EXCLUDED_TRAITS = ["archetype", "mythic"];

/**
 * Localizes a key when Foundry's i18n is available, otherwise returns the key unchanged.
 * @param {string} key
 * @returns {string}
 */
function localize(key) {
  if (!key) return "";
  return globalThis.game?.i18n?.localize?.(key) ?? key;
}

// Item types whose toggles are shown: the ancestry and heritage themselves, abilities they or the class grant
// (e.g. a beastkin's Change Shape) and spells (e.g. a monk's Qi Blast). Feats are checked by category below.
const SHOWN_ITEM_TYPES = new Set(["ancestry", "heritage", "action", "spell"]);

/**
 * True for an item whose toggles the sheet shows: an ancestry, heritage, ability or spell, a class feature,
 * an ancestry or heritage feature, or a class feat (a feat with a class trait), but nothing with the
 * archetype or mythic trait.
 * @param {Item} item
 * @returns {boolean}
 */
function isShownSource(item) {
  const traits = item?.system?.traits?.value ?? [];
  if (traits.some(trait => EXCLUDED_TRAITS.includes(trait))) return false;
  if (SHOWN_ITEM_TYPES.has(item?.type)) return true;
  if (item?.type !== "feat") return false;
  const category = item.system?.category;
  if (category === "classfeature" || ANCESTRY_CATEGORIES.has(category)) return true;
  const classTraits = CONFIG.PF2E?.classTraits ?? {};
  return category === "class" && traits.some(trait => trait in classTraits);
}

/**
 * True for an item that is used as an action: an action, reaction or free action.
 * @param {Item} item
 * @returns {boolean}
 */
function isActionItem(item) {
  const actionType = item?.system?.actionType?.value;
  return !!actionType && actionType !== "passive";
}

/**
 * The raw predicate of a rule element as text, to look for a roll option in it.
 * @param {object} rule
 * @returns {string}
 */
function predicateText(rule) {
  return JSON.stringify(rule._source?.predicate ?? rule.predicate ?? []);
}

/**
 * True when every rule that depends on the option (apart from chat notes) only adds a modifier or damage
 * dice to a rolled check or damage roll, so pf2e's roll dialog already offers it. False when no such rule
 * uses it (it may be used in a way we can't see, so it stays visible).
 * @param {Actor} actor
 * @param {string} option
 * @returns {boolean}
 */
function isOfferedInRollDialog(actor, option) {
  const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mentionsOption = new RegExp(`"(not:)?${escaped}(:[^"]*)?"`);
  const rules = actor.rules.filter(rule =>
    rule.key !== "RollOption" && !CHAT_NOTE_RULE_TYPES.has(rule.key) && mentionsOption.test(predicateText(rule))
  );
  if (!rules.length) return false;
  return rules.every(rule => {
    if (!ROLL_DIALOG_RULE_TYPES.has(rule.key)) return false;
    const selectors = [rule._source?.selector ?? rule._source?.selectors ?? []].flat();
    return selectors.length > 0 && !selectors.some(selector => UNROLLED_SELECTOR.test(selector));
  });
}

/**
 * Where a toggle goes: "placement" (pf2e's own tab), "specials" (Character tab) or null (not shown).
 * @param {Actor} actor
 * @param {object} toggle  An entry of actor.synthetics.toggles
 * @returns {"placement" | "specials" | null}
 */
function classifyToggle(actor, toggle) {
  // All RollOption rules behind the toggle: several feats can feed one dropdown (e.g. Blood Magic)
  const rules = actor.rules.filter(rule =>
    rule.key === "RollOption" && rule.toggleable && rule.domain === toggle.domain && rule.option === toggle.option
  );
  if (rules.some(rule => rule.toggleable === "totm")) return null;
  const sources = rules.map(rule => rule.item).filter(item => isShownSource(item));
  if (!sources.length) return null;

  if (toggle.suboptions?.length) return "placement";
  if (isOfferedInRollDialog(actor, toggle.option)) return null;
  if (sources.some(item => isActionItem(item) || item.system?.frequency?.max)) return "placement";
  return "specials";
}

/**
 * Template data of one toggle.
 * @param {object} toggle  An entry of actor.synthetics.toggles
 * @returns {{domain: string, option: string, itemId: string, label: string, checked: boolean, disabled: boolean, alwaysActive: boolean, choices: {value: string, label: string, selected: boolean}[]}}
 */
function formatToggle(toggle) {
  return {
    domain: toggle.domain,
    option: toggle.option,
    itemId: toggle.itemId,
    label: localize(toggle.label),
    checked: !!toggle.checked,
    disabled: !!toggle.alwaysActive || !toggle.enabled,
    alwaysActive: !!toggle.alwaysActive,
    choices: (toggle.suboptions ?? []).map(suboption => ({
      value: suboption.value,
      label: localize(suboption.label),
      selected: !!suboption.selected
    }))
  };
}

/**
 * Builds context.toggles: the toggles for the Actions tab, the Spells tab and the Character tab's Specials,
 * and context.togglesCollapsed: whether each of those frames is folded (keys "toggles-actions" etc. in the
 * sheet's _collapsedRankGroups, set by toggleRankGroup).
 * Catches its own errors (logged, with empty lists), so a broken toggle never stops the sheet from rendering.
 * @param {Actor} actor
 * @param {object} sheet
 * @param {object} context
 */
export function prepareTogglesContext(actor, sheet, context) {
  const toggles = { actions: [], spellcasting: [], specials: [] };
  context.toggles = toggles;
  context.togglesCollapsed = Object.fromEntries(
    Object.keys(toggles).map(key => [key, !!sheet?._collapsedRankGroups?.has(`toggles-${key}`)])
  );
  try {
    const all = Object.values(actor.synthetics?.toggles ?? {}).flatMap(domain => Object.values(domain));
    for (const toggle of all) {
      const place = classifyToggle(actor, toggle);
      if (place === "specials") toggles.specials.push(formatToggle(toggle));
      else if (place === "placement") (toggle.placement === "spellcasting" ? toggles.spellcasting : toggles.actions).push(formatToggle(toggle));
    }
    for (const list of Object.values(toggles)) list.sort((a, b) => a.label.localeCompare(b.label));
  } catch (err) {
    console.error("PF2e Mobile Compact | Error preparing toggles context:", err);
    context.toggles = { actions: [], spellcasting: [], specials: [] };
  }
}
