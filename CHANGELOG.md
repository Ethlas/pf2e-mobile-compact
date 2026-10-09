# Changelog

All notable changes and technical implementation milestones for **PF2e Mobile Sheet (Compact)** (`pf2e-mobile-compact`) will be documented in this file.

---

## [Unreleased]

### Carry Items Like pf2e's Sheet: Hold a Torch, Wear a Belt in Its Slot (`scripts/apps/sheet-helpers/carry-type.js`, `scripts/apps/sheet-helpers/context-inventory.js`, `scripts/apps/sheet-helpers/inventory-handlers.js`, `scripts/apps/mobile-sheet.js`, `templates/parts/inventory.hbs`, `templates/parts/inventory/carry-badge.hbs`, `templates/parts/carry-type-dialog.hbs`, `styles/pf2e-mobile.css`, `docs/style-guide.html`, `scripts/verify.mjs`)

#### Added
- **Carry type picker**: every weapon, armor, shield and gear item on the Gear tab has one carry badge showing how it is carried (Held 1H, Held 2H, Worn (Belt), Worn, In Backpack, Dropped). Tapping it opens a picker with the same choices as pf2e's carry menu on its own sheet: held in one or two hands, implanted (for implants), worn in the item's slot (only for items with one), worn, stowed (only when the character has a container), dropped, and attached for attachable items. The picker shows pf2e's usage of the item ("Held in One Hand", ...), so you can see how it has to be carried to work. The choice goes to pf2e's `actor.changeCarryType`, and the labels are pf2e's own (`PF2E.CarryType.*`), so they follow the Foundry language.

#### Fixed
- **Gear that is held, such as a torch or lantern, could not be equipped**: the gear's only button was "Wear", which set the item to worn. pf2e counts an item as equipped only when it is carried the way its usage says, so a torch stayed unequipped. It can now be held.
- **"Wear" did nothing for most worn magic items**: items with a worn slot (belt, gloves, boots, cloak, ...) only count as equipped when worn *in* that slot (`inSlot`), which the old button never set. The picker offers "Worn (Belt)" etc.
- **Taking gear off failed silently without a container**: the old button stowed the item, which pf2e skips when there is no container to put it in. Stowed is now only offered when there is one; Worn and Dropped always are.
- **Weapons could not be stowed or dropped from the phone**: their badge only cycled worn → held 1H → held 2H.
- The badge is green when pf2e counts the item as equipped (`item.isEquipped`), instead of the module guessing from the carry type.

#### Changed
- The separate "Wear"/"Hold" equip button (`equip-badge`, action `toggleEquipped`) and the "in <container>" badge (`stowed-badge`) are replaced by the carry badge; a stowed item's badge reads "In Backpack". The carry logic moved out of `inventory-handlers.js` into `carry-type.js`.
- The palette and the layout utilities are also scoped to the new `.carry-type-dialog`, like the spell picker dialog.

### Escape the Mobile View from the Phone (`scripts/utils/view-mode.js`, `scripts/apps/sheet-helpers/header-handlers.js`, `scripts/apps/mobile-sheet.js`, `scripts/pf2e-mobile.js`, `scripts/utils/sheet-utils.js`, `templates/parts/header.hbs`, `styles/pf2e-mobile.css`)

#### Added
- **Desktop view button in the header's cog menu**: switches this device to Foundry's desktop view. Before, the only way out of the mobile sheet was the "Mobile Activation Mode" setting, which sits in Configure Settings behind the full-screen sheet, so a phone couldn't leave the mobile view at all.
- **Floating "Mobile view" button**: a mobile device in the desktop view gets a round button bottom-left that switches back.
- Both ask for confirmation, then set Mobile Activation Mode (`never` for the desktop view, `auto` for the mobile view). It is a client setting, so it only changes the view on this device, and its existing `onChange` reloads the page: the body class, sheet routing and stylesheet are decided at load. The floating button is styled inline, because the module stylesheet is off in the desktop view. The setting's hint mentions both buttons.

#### Changed
- **Mobile detection (`isMobileDevice()`) by the screen's short side and the kind of pointer**: the viewport test now uses the shorter side (`min(width, height) < 768`), so a phone in landscape stays in the mobile view, and it needs a touch screen whose primary pointer is coarse (a finger) and not fine (`pointer: coarse`, not `pointer: fine`). A narrow desktop browser window and a touchscreen laptop with a touchpad or mouse no longer count as mobile, also when the window is short. Phones and tablets are still recognised by their user agent first. The same pointer check is used in Ethlas's open PR #25. The stylesheet's full-bleed fallback media query also covers a coarse-pointer device in landscape.

### Spell Order Follows pf2e's Sheet; Move Entries from the Phone (`scripts/apps/sheet-helpers/context-spells.js`, `scripts/apps/sheet-helpers/spell-entry-order-handlers.js`, `scripts/apps/mobile-sheet.js`, `templates/parts/spells.hbs`, `styles/pf2e-mobile.css`, `docs/style-guide.html`)

#### Added
- **▲/▼ arrows in each spellcasting entry's header** (small chevrons in the colour of the header's top border, sitting on that border at the right in a round gap of the sheet background, each with a 38px touch target) move the entry up or down on the Spells tab, for example to put Focus Spells above the class entry. Before, the order could only be changed by dragging entries on pf2e's desktop sheet. The buttons do the same as that drag (`sortRelative` on the entry's `sort` value), so the order is stored on the actor and pf2e's sheet shows it too. Entries not shown on the tab (staves, wands, scrolls, empty entries) keep their place. The first entry's ▲ and the last entry's ▼ are greyed out, and there are no arrows when there is only one entry. The handler lives in its own small module because `spells-handlers.js` is already over 700 lines.

#### Changed
- **Entry header layout**: the tradition and proficiency rank badge moved from the name row to the right end of the Spell DC / Spell Attack row, so the name row has room for the full entry name below the move arrows. The name row gets 4px of room above it from a new utility, `m-mt-4` (margin-top), listed in the style guide and `AGENTS.md`.
- **Spells inside a group are in pf2e's order instead of alphabetical**: the order you set by dragging spells on pf2e's character sheet (the spell's `sort` value) is now used, with the name as tie-breaker, like `SpellCollection#getSpellData`. Prepared spells keep their slot order, and heightened copies of signature spells come after a rank's own spells, as on pf2e's sheet. The order of the entries (by the entry's `sort`) and of the groups (Focus Spells, Cantrips, Rank 1–10) is unchanged.

### Roll Mode Button Only with the Physical Dice Module (`templates/parts/header.hbs`, `scripts/utils/sheet-utils.js`, `scripts/verify.mjs`)

#### Fixed
- **The header's roll mode button did nothing without `physical-dice`**: since 1.0.30 the manual rolling is done by the `physical-dice` module, but the button was still shown without it. Switching it to manual then gave digital rolls with no prompt for dice. The button is now only shown when `physical-dice` is active (`isPhysicalDiceActive`), like the entry method button in the cog menu.
- **A saved "physical" mode no longer lingers without the module**: `getStoredRollMode()` now only reads `physical-dice.rollMode` while that module is active and returns `digital` otherwise. Before, it fell back to the module's own old `pf2e-mobile-compact.rollMode` setting, so a client that had manual mode on before 1.0.30 stayed in it (and the kingdom check dialog still prepared a manual roll).
- `verify.mjs` checks both: the button sits inside `{{#if isPhysicalDiceActive}}`, and without the module the roll mode is `digital`.

## [1.0.30] - 2026-10-04

### Physical Dice Module Integration & Engine Migration (`scripts/rolls/physical-dice-interceptor.js`, `scripts/utils/sheet-utils.js`, `scripts/apps/sheet-helpers/context-header.js`, `scripts/apps/sheet-helpers/header-handlers.js`, `scripts/apps/mobile-sheet.js`, `templates/parts/header.hbs`, `styles/pf2e-mobile.css`)

#### Added
- **Bidirectional Roll Mode Synchronization with `physical-dice`**: Toggling roll mode via the header dice button (`<button data-action="toggleRollMode">`) directly synchronizes with `physical-dice.rollMode`. If the roll mode is changed externally (e.g. from the chat controls button injected by `physical-dice` or in module settings), `pf2e-mobile-compact` listens to `physicalDiceRollModeChanged` and updates the header icon in real-time.
- **Manual Dice Entry Method Setting**: Added an entry method toggle button under the header settings cog menu (`.header-menu-panel`), enabling mobile users to switch between **Popup Dialog** (`fa-window-restore`) and **In-Chat Rolls** (`fa-comment-dots`) directly in the compact sheet UI.

#### Removed
- **Internal Physical Dice Engine & Dialog**: Removed obsolete internal `scripts/apps/physical-dice-dialog.js`, `templates/physical-dice-dialog.hbs`, and associated modal CSS rules from `styles/pf2e-mobile.css`.
- **Duplicate Evaluator Interception**: Removed monkey patches to `Roll.prototype.evaluate` (`setupPhysicalDiceInterceptor`) from `scripts/pf2e-mobile.js`, establishing `physical-dice` as the single authoritative source of roll interception.

#### Refactored
- **Lightweight Adapter Bridge**: Replaced `scripts/rolls/physical-dice-interceptor.js` with a lean adapter bridge (`PhysicalDiceManager`) that delegates `withPhysicalMode` and `activeContext` to `game.modules.get("physical-dice").api.PhysicalDiceManager` when active and executes rolls seamlessly when inactive.

## [1.0.29] - 2026-10-04

#### Changed
- **Spells are grouped by spellcasting entry, then by rank**, like pf2e's own sheet. Before, every entry's spells were merged into one list per rank, so a hand-made staff entry ("Other Spells (Staves etc)"), a spell granted by a feat (e.g. Charm from Enthralling Allure) and the class's own spells sat together, and prepared and spontaneous spells could share a rank. Now each entry gets its own section in pf2e's order (the entries' sort value).
- **Each section starts with the entry's header**, separated from the entry above by a double line across the tab in the warning colour (`--m-warning-border`, no background): its name, tradition and proficiency rank (the skills' rank badge), and its own Spell DC and Spell Attack bonus, read from the entry's statistic (`entry.statistic.dc.value`, `entry.statistic.check.mod`). An entry granted by a feat can use another attribute or rank than the class's entry, so each list shows the numbers its spells actually use.
- **Slot counters belong to their own entry**: a rank's counter shows that entry's slots. Before, the merged rank showed the highest value and maximum of all entries.
- **Rank headings (Cantrips, Rank 1 ..., Focus Spells, and the staff's ranks) are dim grey** (`m-color-dim`) instead of orange: the entry header now marks the sections, and the colour stays free to highlight something else later.
- **A rank group's fold is remembered per entry** (key `<entryId>-<rank>`, `<entryId>-focus`), so folding Rank 1 of one entry leaves the other entries' Rank 1 open.
- Staves, wands and scrolls (the item entries) stay on the Activations sub-tab, as before.

#### Refactored
- The Preparation view's data (prepared slots by rank and the saved presets) moved from `context-spells.js` into `context-spell-preparation.js` (`preparePreparationContext`), so `context-spells.js` stays under the size limit. `prepareEntryGroups` builds one entry's groups and `describeEntry` its header data.

### Daily Rest and Dailies Buttons (`scripts/apps/sheet-helpers/spells-handlers.js`, `scripts/apps/sheet-helpers/activations-handlers.js`)

#### Fixed
- **Daily Rest stopped halfway for a character with a staff**: pf2e-dailies adds a staff spellcasting entry to `actor.spellcasting` that is not an item and has no `system` data, so reading its slots threw (`entry.system is undefined`). Focus points, staff charges and the "Daily rest complete" notice were then skipped. Entries without slots are now passed over; the staff's charges are still refreshed by the step after the loop.
- **Daily Rest asked twice**: after our own confirmation, pf2e's Rest for the Night opened a second one. It is now called with `skipDialog: true`.
- **Dailies button did nothing after preparing**: pf2e-dailies opens no window and shows no message until the character has rested since the last preparation (its `canPrepareDailies` check, the "Rest Required" state on pf2e's sheet). The button now checks `game.dailies.api.canPrepareDailies` first and says the character must Rest for the Night.

### Roll-Option Toggles: Blood Magic, Spellshape, Debilitation, Specials (`scripts/apps/sheet-helpers/context-toggles.js`, `scripts/apps/sheet-helpers/toggles-handlers.js`, `templates/parts/toggles.hbs`, `templates/parts/actions.hbs`, `templates/parts/spells.hbs`, `templates/parts/character.hbs`, `styles/pf2e-mobile.css`)

#### Added
- **pf2e's toggles on the mobile sheet**: the checkboxes (some with a dropdown) that pf2e's own sheet shows above the strikes and the spellcasting entries, e.g. a sorcerer's Blood Magic and Second Blood Magic, Spellshape, a rogue's Debilitation, an exemplar's Divine Spark and Epithet, a swashbuckler's Finisher, a beastkin's Change Shape. Before, the mobile sheet had none of them, so they could only be switched on the desktop sheet.
  - **Spells tab**: a "Special Abilities" frame at the top of the Spells view for the spellcasting toggles. **Actions tab**: a "Special Abilities" frame in Encounter, after the free actions and just above the skill actions (they are used less often than the actions above them). **Character tab**: a "Specials" frame at the bottom. The name covers class features, ancestry abilities and spells alike; all three use the star icon.
  - Each frame folds like a spell rank group (chevron, title, count), with the same `toggleRankGroup` handler; the sheet remembers a folded frame under its key (`toggles-actions`, `toggles-spellcasting`, `toggles-specials`).
  - Data comes from `actor.synthetics.toggles`, the list pf2e's sheet uses; a change calls `actor.toggleRollOption(domain, option, itemId, value, suboption)`, the same call pf2e's sheet makes. pf2e updates the item and the sheet re-renders.
  - One line per toggle in the frame (no card each): the name with its checkbox, and the dropdown of choices on the same line (at most 55% wide), which keeps the frame short. A line is as tall as its dropdown (the row has `min-height: 38px` and 3px padding, so lines without a dropdown match); the name sets no height of its own. The dropdown keeps the 38px `m-compact` height: smaller selects are hard to tap, and iOS needs the 16px text the sheet already forces on fields.
  - An always-active toggle (pf2e's `alwaysActive`, e.g. Blood Magic, Debilitation) has no checkbox: it can't be switched off, only its choice changes. A dropdown with one choice is shown but can't be changed, like on pf2e's sheet.
  - The checkbox and dropdown use `data-change-action` (not `data-action`), so the native controls and the OS picker keep working on touch screens.
- **Where a toggle goes is decided by its structure, not its name** (`classifyToggle` in `context-toggles.js`):
  - Actions / Spells tab (pf2e's placement): toggles with choices, and on/off toggles of an action, reaction or free action or of a feature with limited uses (e.g. Nimble Dodge, Lunge).
  - Character tab "Specials": the other on/off toggles, of passive features (auras, reach, senses, rage damage ...).
  - Not shown: on/off toggles whose rules only add a modifier or damage dice (`FlatModifier`, `DamageDice`) to a rolled check or damage roll, apart from chat notes, because pf2e's roll dialog already lists them as a row that can be switched on (e.g. Sorcerous Potency, Dazing Blow, Dual-Handed Assault); theater-of-the-mind toggles (pf2e's "totm" world setting); toggles that only come from archetype feats other than dedications, mythic feats, general or skill feats, or equipment (e.g. a lit torch). Dedication feats (e.g. Ghoul, Werecreature, Spellshifter Dedication) are shown like class feats. These can be added later by changing the rules in `context-toggles.js`.
- **`toggle-row`** component (in a `toggle-list`, with `toggle-checkbox`, `toggle-select`) in the stylesheet and the style guide.

### Activations: Spell Cards for Wands, Scrolls and Item Spells (`templates/parts/spells.hbs`, `templates/parts/spells/spell-card.hbs`, `scripts/apps/sheet-helpers/context-activations.js`, `styles/pf2e-mobile.css`)

#### Changed
- **Wands, scrolls and other item spells use the Spells tab's spell card**: the spell's name, action glyph, range/area/defense/duration tags and a drawer with the item's name, traits, Chat, Damage and the description, like the staff and the Spells tab. Each section is a frame with its title and count, like the rank groups. Before, these cards showed only the item's name and badges, without a way to read the spell.
  - The item's own data goes in through a new `detailTags` slot at the start of the tag row: a wand's rank and uses, a scroll's rank and quantity (only when more than one), an item spell's entry name.
  - New card parameters: `sourceItemId` makes the drawer's Chat and Damage buttons use the wand or scroll instead of its spell, which is not an item on the actor (both handlers already resolve the item's spell); `sourceItemName` shows the item's name in the drawer header; `item` gives the slots the caller's data.
  - An overcharged wand (0 uses) shows the card's expended look with an "Overcharged" tag. Cast stays enabled; pf2e's `consume()` decides what happens.
  - A wand or scroll without a spell (e.g. a blank "Scroll of 3rd-rank Spell") gets a plain card with its name and Chat.
- **Other item spells cast the right spell**: their Cast button is now the Spells tab's (`castSpell` through the spell's entry). Before, it used `castItemSpell`, which for a spell (no `consume()`) fell back to the entry's first spell, so an entry with several spells always cast the first one. This also removes the misspelled `data-item-typeThe` attribute.
- Removed the old card classes and rules (`activation-item-card`, `activation-item-img`, `activation-section-title`).
- **Rank badge stands out**: a wand's or scroll's rank is the first thing to check before using one, so its badge (`item-rank-badge`) is the neutral badge on the palette's raised grey (`--m-surface-5`, strong border) with bright, semibold text, clearly lighter than the dark detail tags next to it. No new colour.

### Stylesheet Deduplication (`styles/pf2e-mobile.css`, `templates/`)

#### Changed
- **Removed declarations that had no effect**: 20 `box-sizing: border-box` (the sheet's `.pf2e-mobile-sheet *` rule already sets it for every element), and 36 `cursor: pointer` and 20 `touch-action: manipulation` on buttons, `.touch-target` and `data-action` elements (the global interactive rule already sets both for exactly those; checked per class against the templates). The dev preview showed no difference before and after.
- **Merged duplicated rules**: `.spell-rank-header`, `.rank-title` and `.slot-counter` had an older first block that the later one fully overrode; it is removed. `.spell-details` had two blocks; its font size and colour moved into the remaining one. The Actions and Spells sub-tab bars, the invest and equip badge buttons, and the Use and Roll buttons were identical rule pairs; each is now one rule with both selectors (the Spells sub-tab buttons keep their 6px gap in a one-line rule). No difference in the dev preview.
- **`m-truncate` utility**: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` (one line ending in "…") was repeated in 10 sheet rules: the header selects and name, action, skill, slot spell, staff and party member names, the member blurb and the overview title. They now use the `m-truncate` class in the templates; `.character-title-name` only held these three lines and is gone. The spell picker and compendium picker keep their own rules, since they are rendered outside the sheet. No difference in the dev preview.
- **Shared component classes**:
  - `m-compact`: the 38px height and 4px corners of compact controls (header buttons, selects and pills, action and spell buttons, badge buttons, party buttons), 57 elements from 28 rules. It sits right after the 48px touch-target default so it wins over it; rules that want 6px corners keep their own radius. Left out: the chat damage buttons (pf2e builds that markup), the spell picker (outside the sheet), the drawer Cast buttons (`.btn-cast` is 48px elsewhere) and the HP change input (an `input[type=text]` rule is more specific).
  - `m-panel`: card colour, thin subtle border and 6px corners for flat panels (the sub-tab bars, Preparation rank cards, and the party summary, member and stash panels).
  - Badge tones: the ~35 rules that each repeated a tone's background, border and text colour are now one rule per tone (blue, green, red, orange, purple, cyan) listing all its selectors, at the end of the stylesheet. Each selector keeps its own specificity, so the cascade is unchanged; a class in the template would have lost to the two-class base rules of the badges.
  - No difference in the dev preview.
- **Remaining flex layout moved into the templates**: the first round only handled rules with a single class. Rules with a parent or two classes (e.g. `.mobile-header-dashboard .header-btn`, `.badge-btn.invest-badge`, `.spell-drawer-footer .btn-spell-action`) were checked in the dev preview across all fixtures and tabs: a declaration moved to an `m-*` utility only where every element carrying the class matches the rule, and no other rule would win over the utility. 33 rules lost their flex, gap and alignment lines this way; a few context rules were handled per element (the spell detail tags, the spell sub-tab buttons' gap, the heightened notice icon), and two lines that the utilities already covered were removed (`.m-card-line > .action-btn-group`, the party nav item's `flex: 1`). Left in CSS: rules for markup pf2e or Foundry build (chat messages, damage buttons, the window), the compendium picker, and rules whose class is also used outside their context or where `min-width: 0` would lose to the 48px button default. No difference in the dev preview.
- **Layout utilities in the compendium picker, spell picker and dice dialog**: the layout utilities (`m-flex-*`, `m-align-*`, `m-justify-*`, `m-gap-*`, `m-wrap`, `m-flex-1`, `m-flex-auto`, `m-min-w-0`, `m-shrink-0`, `m-truncate`) are now scoped to `:is(.pf2e-mobile-sheet, .pf2e-mobile-compendium-picker, .spell-picker-dialog)`, which weighs exactly as much as `.pf2e-mobile-sheet`, so they also work in the two windows Foundry renders outside the sheet. The flex layout of 39 rules in those windows and the physical dice dialog moved into the templates (`templates/compendium-picker.hbs`, `templates/parts/spell-picker-dialog.hbs`, `templates/physical-dice-dialog.hbs`). Before that, an older first copy of seven compendium picker rules was merged into the later one (it was almost fully overridden; its padding, gap and colours for the window and the search field's minimum height and width were still in effect and were kept). Five classes that no longer had any CSS were removed from the markup. Checked with a new local test page that renders the three windows in several states (no difference) and with the sheet preview (no difference).
- **Type scale and text utilities**:
  - The stylesheet used 25 font sizes, many only 0.02–0.03rem apart. Sizes below 1rem were snapped down to a scale of seven steps: 0.68→0.65, 0.72→0.7, 0.78→0.75, 0.82 and 0.84→0.8, 0.88→0.85, 0.92→0.9rem (at most 0.04rem, about 0.6px, smaller). `font-weight: 700` became `bold` (the same weight) and the single `800` became `bold` too. This is the only visible change in this step.
  - New utilities `m-text-2xs` (0.65rem), `m-text-xs` (0.7), `m-text-sm` (0.75), `m-text-md` (0.8), `m-text-base` (0.85), `m-text-lg` (0.9), `m-text-xl` (0.95), and `m-medium`, `m-semibold`, `m-bold`, scoped like the layout utilities. They come right after the 48px / 16px button and input defaults (like `m-compact`), so a button can take a smaller size; inputs and selects keep the 16px that iOS needs.
  - Font sizes and weights of 133 rules moved into the templates, checked in the dev preview and the dialog test page the same way as the flex layout (no difference after the snapping). Three rules became empty; `skill-name` and `staged-meta` were removed from the markup.
  - Left in CSS: 1rem/16px on inputs, selects and buttons, the larger titles, numbers and icons (1.05–2rem), sizes in states and context rules, and markup pf2e or Foundry build.
- **Text colours**:
  - The stylesheet used 18 text greys. They are now six palette variables linked to Foundry's own text colours, with its values as fallback: `--m-text-strong` (`--color-text-light-0`, #fff), `--m-text` (light-2, #ddd), `--m-text-soft` (light-4, #bbb), `--m-text-muted` (light-5, #aaa), `--m-text-dim` (light-7, #888) and `--m-text-faint` (`--color-text-dark-5`, #666). 154 declarations were snapped to them; most shifts are 1–3 steps of 255 (e.g. #e0e0e0→#ddd, #999→#888, #777→#666), the largest #eee→#ddd on the skill buttons, dice dialog and competency pills. Left as they were: the sheet's root colour, the spent focus point (#4a4a4a) and the tinted text colours. The palette variables are now also defined on the compendium picker.
  - New utilities `m-color-strong`, `-normal`, `-soft`, `-muted`, `-dim`, `-faint`, `m-color-accent`, and `m-color-info`, `-success`, `-danger`, `-warning`, placed after the button default (which sets white text). The text colours of 110 rules moved into the templates, checked like the flex layout and type scale (no difference after the snapping). 16 rules became empty and 14 classes that no longer had any CSS were removed from the markup. Colours in modifier and state rules (active tabs, damage types, rank badges) stay in CSS.
- **Child-element rules replaced by utilities, no more 17px**:
  - Rules that styled a bare child inside a component (`.defense-item.ac-badge strong`, `.defense-item.shield-badge strong`, `.header-defenses-saves-row .save-item strong`, `.party-header-stat i`, `.physical-modifier-info strong`, `.damage-input-row label`, `.compendium-picker .spell-config-form label`, `.character-details dt`/`dd`, `.character-facts dt`/`dd`, `.slot-counter strong`, `.charges-label strong`, `.spell-heightened-notice i`) now put utilities on that child in the template; nine rules are gone, the others keep only their margin, minimum width or letter style. New utilities `m-color-cyan`, `m-color-charge`, `m-color-slot` and `m-normal` (resets a bold parent).
  - The 17px sizes are gone: the HP and temp HP inputs already showed 16px (iOS forces inputs to 16px), so their 1.0625rem was removed; max HP, the MAP buttons and the spell picker title went from 17 to 16px (`m-text-full`). That is the only visible change.
  - The size comments in the type scale block (they had slid one rule down in the reformat) are back above their rule.
- **Character speeds with utilities (`templates/parts/character.hbs`, `styles/pf2e-mobile.css`)**: the speed value is a 16px span (new utility `m-text-full`, 1rem) with the number and "ft" as their own spans with utilities, and a speed the character lacks gets `m-color-faint` in the template. The `.character-speed-value` rules (value, missing speed, "ft") are gone; the value went from 17 to 16px.
- **Auxiliary action glyphs without a box (`styles/pf2e-mobile.css`, `templates/parts/actions.hbs`)**: the action glyph in front of a weapon's auxiliary actions (e.g. Raise a Shield) no longer sits in an 18px grey square; the `.aux-glyph` rule and class were removed.
- **Type scale on whole pixels**: the type scale's rem values fell between pixels at the 16px base (10.4, 11.2, 12.8, 13.6, 14.4, 15.2px). It is now five steps on whole pixels: `m-text-xs` 11px (0.6875rem), `m-text-sm` 12px, `m-text-md` 13px (0.8125rem), `m-text-base` 14px (0.875rem) and `m-text-xl` 15px (0.9375rem). `m-text-2xs` (10.4px, too small to read comfortably) folded into `m-text-xs`, and `m-text-lg` (14.4px) into `m-text-base`. The sizes still set in CSS rules moved along, and the larger ones went to whole pixels too: 16.8→17px (header HP numbers, max HP, MAP buttons, spell picker title, character speeds), 17.6 and 18.4→18px (attribute modifiers, dice dialog title, staged spell name), 19.2 and 20.8→20px (bottom nav icons, dice dialog damage input). Changes are at most 0.8px; text that was 10.4px is now 11px.
- **Badge classes `m-badge` and `m-badge-neutral`**:
  - The small badges were snapped to the standard badge shape: trait badges, the spell detail tags, the spell picker's tags and the party overview's skill pills from `1px 4–5px` with 3px corners to `2px 6px` with 4px corners, hero points from `1px 5px` to `2px 6px`, and the base `.detail-tag` (wand and scroll rank, activation entry, drawer target) from 3px to 4px corners. That is the only visible change: those badges are about 2px taller.
  - `m-badge` holds the shape every badge shares (`padding: 2px 6px`, 4px corners); `m-badge-neutral` is the same shape with the look of badges without a role colour (`--m-surface-3` and a `--m-border` border). A badge takes one of the two: 16 badge families (73 elements) use them, the five neutral ones `m-badge-neutral`, and their rules lost those lines. Layout, text size and colour stay with the utilities, colour roles with the Badge Tones rules.
  - Design rationale: a badge is a single element, so it gets a class rather than a long list of look-utilities, while a repeated snippet of several tags would become a partial. Putting `inline-flex` and a gap in `m-badge` was tried, but it moved coin pills up to 14px and party member cards 8px, so the layout stays separate.
  - The round counters (spell count per rank, Activations count, unread chat) keep their own rules.
- **Style guide rule (`AGENTS.md`, `scripts/verify.mjs`)**: a new section "F. Stylesheet: Follow the Style Guide" in `AGENTS.md` asks every stylesheet change to use the palette variables, the `m-*` utilities and the shared components, and to keep the new style guide page current. A `[Style Guide]` check in `verify.mjs` fails when an `m-*` class has no sample on that page.
- **Style guide page (`docs/style-guide.html`)**: shows the colours, utility classes and components of the stylesheet, rendered with the real `styles/pf2e-mobile.css` and with the class names under each sample. The colour variables, `m-*` classes and badge tone rules are read from the stylesheet when the page loads; the sample buttons, badges, tags and states are written by hand. Open it over HTTP from the repository root (`python3 -m http.server 8000`, then `/docs/style-guide.html`). Not part of the module.
- **`touch-target` class removed (`styles/pf2e-mobile.css`, `templates/`, `scripts/`, `docs/style-guide.html`)**: checked in the dev preview by measuring every element with the class (about 1,080, all tabs, three characters, staff and party stash) before and after removing it. On buttons, selects and inputs it changed nothing: the same rules already list `button`, `select` and `input[type=…]`, and most of these then get their size from `m-compact` or their own rule. Its 17 uses in the transfer, coin, target and slot dialogs never applied, because those dialogs don't have the `pf2e-mobile-sheet` class. It only did something on four `div`s: text #fff instead of #e0e0e0 on the spell rank and staff headers (no visible difference, their text has its own colours), and a button background and border on the party stash item names without the 48px height, which is gone now. The physical dice dialog now focuses its first `input[type='number']` directly.
- **Docked chat looks like Foundry's sidebar again (`styles/pf2e-mobile.css`, `templates/`, `scripts/apps/sheet-helpers/actions-handlers.js`, `docs/style-guide.html`)**:
  - The sheet's card base class `action-card` is renamed to `m-action-card` (11 cards in the templates, 3 rules, the `closest()` lookup in the action handlers). pf2e's action chat cards (e.g. Raise a Shield) are `<div class="pf2e chat-card action-card">`, so the sheet's dark card style also hit them in the docked chat, while pf2e's dark text colour stayed: the description was dark on dark.
  - The sheet's base control look (48px, dark surface, border, light text) no longer applies to buttons and fields inside chat messages (`:where(:not(.chat-message *))`, which keeps the selectors' specificity). pf2e's damage buttons and Foundry's message buttons keep their own look, as in the sidebar.
  - pf2e's damage buttons keep pf2e's layout: Damage, Half, Double and Block in one row instead of three per row with Block on its own row; only their height is raised to 38px. The old coloured button rules are removed: they used pf2e 6's `data-action` names (`apply-damage`, `half-damage`, `double-damage`, `shield-block`), while pf2e 7 and later use `applyDamage` with `data-multiplier` and `shieldBlock`, so they no longer applied.
  - Checked offline at phone width with the world's stored messages, pf2e's damage button markup and Foundry's, pf2e's and the module's stylesheets.
- **`m-pill-input` component (`styles/pf2e-mobile.css`, `templates/parts/header.hbs`, `docs/style-guide.html`, `scripts/verify.mjs`)**: the HP and Temp HP inputs in the header each repeated the same 28px borderless input with a dashed underline and a focus tint, only to undo the 48px input defaults. That is now one class for an input inside a pill: no box, a dashed underline in its text colour (solid with a 15% tint while editing). Their own rules keep only width and colour. The underline follows the text colour, so the HP underline now turns orange or red with the warning and danger states instead of staying green. The style guide's class list and the verify check also recognise component selectors written as `input.m-x`.
- **Delta input without its own look (`styles/pf2e-mobile.css`)**: the HP delta input in the header is a plain input with neutral text instead of gold, and no own focus style. It keeps the surface of the HP and Temp pills next to it and its small dim placeholder. Its 38px height and corners come from `m-compact`, which now also matches `input.m-compact`: the input defaults (`input[type="text"]`) were more specific than `.m-compact`, so `m-compact` alone didn't size a text input. Checked in the dev preview: all 78 inputs and selects render the same as before.

### Accent Colours from Foundry and pf2e (`styles/pf2e-mobile.css`, `scripts/utils/sheet-utils.js`, `templates/parts/header.hbs`)

#### Changed
- **Role colours linked to Foundry**: new variables `--m-accent` (Foundry's `--color-warm-1`) and `--m-hue-info`, `--m-hue-success`, `--m-hue-danger`, `--m-hue-warning` (Foundry's `--color-level-*` status colours), with Foundry's values as fallback outside Foundry. Purple and cyan have no Foundry equivalent and keep the sheet's own hue. In Foundry's sci-fi theme the accent follows Foundry's blue.
- **One formula per kind of element**: from each hue the palette mixes (CSS `color-mix`) a badge tone (`--m-<role>-bg`, `-border`, `-text`: dark background, mid border, light text) and a solid button (`--m-<role>-solid`, `-solid-active`). Every badge and button of one role now has exactly the same shades, instead of 5–10 near-identical variants per colour from two palettes (Material and Tailwind).
  - Primary blue: Cast, Use, Roll (was indigo), Transfer, primary and dice dialog submit. Danger red: Strike, Damage, Cast (attack), Roll (attack). Success green: Use (active), Add gear, Apply poison, Consume, Heal. Warning orange: Send to party stash, encumbered.
  - Badge tones: prepared, preparing and preset buttons, categories, MAP, invested, wand uses (blue); equipped, held, innate, restore, save, poison, resistance (green); expended, not held, remove, delete, weakness (red); signature, spontaneous, uses, containers, in combat, perception (orange); focus, runes, immunity (purple); heightened, shield (cyan).
  - The accent `#ffb74d` (section titles, glyphs, the active tab, opened card edges, focus rings) became `--m-accent`; the "your character" edge in the party overview and the strike ready edge use the accent and the green badge border.
- **pf2e's own colours**: damage type badges use pf2e's `--color-border-<type>` (slashing, piercing and bludgeoning share pf2e's physical grey; cold keeps its blue; vitality is a radiant glowing yellow; void is pf2e's near-black with purple text; spirit is light blue; force, which shared spirit's rule, gets pf2e's force purple). Size and trait tags use pf2e's `--color-bg-size`, `--color-bg-trait` and `--color-border-trait`. The rank badges already read pf2e's proficiency colours; their fallbacks now match pf2e's values.
- **Staff, charges and slots**: the staff card and drawer get a quieter wood tone, the staff name and drawer headings the accent, and the description block no longer has its own background. Purple (`--m-charge-*`, the same purple tone as focus spells and runes) marks charges: the Cast with charges button, the charges count and the charge cost. A gold was tried first, but next to the staff name and wood it made too many similar yellows in one place. Verdigris (`--m-slot-*`) marks spell slots: the slot count in rank headers (now just "2 / 3" in slightly larger numbers, without the "Slots:" label; the tooltip says "Spell slots"), the − / + signs and the slot numbers in Preparation. The charge + slot button runs from purple to verdigris, since it costs both. Hero points and the HP change input in the header use a gold (`--m-gold-*`), temp HP the cyan.
- **Header HP coloured by health (`getHpState()` in `scripts/utils/sheet-utils.js`)**: the HP in the header is green, orange at 50% or less and red at 25% or less, like the HP bars in the party overview. Both now use the same helper, so the thresholds cannot drift apart.
- **Shield block switched on** looks pressed in (darker blue, inner shadow, thicker light border) instead of turning green.
- Left as they were: coin colours, the other chat damage buttons, Critical, Runes, Dailies, Daily reset, Detach, the roll mode badges and the expended spell card tint.
- Design rationale: the sheet used 186 coloured values, many near-duplicates from two palettes. Basing the roles on Foundry's status colours and the semantic badges on pf2e's colours makes the sheet match the rest of Foundry, and the palette variables give one place to tune it. Layout was compared before and after in the dev preview: the only element that moved is the staff description block, which lost its border.

### Grey Palette Variables (`styles/pf2e-mobile.css`)

#### Changed
- **Backgrounds and borders use a small set of greys**:
  - New CSS variables on `.pf2e-mobile-sheet` (and `.spell-picker-dialog`, which Foundry renders outside the sheet): `--m-surface-0` to `--m-surface-5` (`#111`, `#1a1a1a`, `#222`, `#2a2a2a`, `#333`, `#444`) and `--m-border-subtle`, `--m-border`, `--m-border-strong` (`#333`, `#444`, `#555`).
  - The surfaces go by layer: 0 chrome and wells (header, bottom nav, image and input wells), 1 the sheet and group frames, 2 cards and panels, 3 controls on a card (buttons, pills, inputs), 4 raised and hover, 5 pressed.
  - 169 hex greys in backgrounds and borders were replaced by these variables. 96 kept their exact colour; 73 were near-duplicates (27 background greys and about 15 border greys were in use) and moved by a few steps to the nearest level of their role. The most visible: the subtabs bars and party/stash panels (`#1e1e1e` → `#222`), controls such as skill buttons and preset pills (`#252525` → `#2a2a2a`), and the `.m-group` frame border (`#3a3a3a` → `#444`). The base `.detail-tag` (wand/scroll rank, activation entry name) goes to `--m-surface-1` instead, so it stays darker than the card it sits on.
  - The zinc greys used in a few sheet controls (staff charge buttons and badges, filter select, spell drawer footer) were folded into the same levels.
  - Left as they were: tinted backgrounds that carry meaning (the expended spell card, the staff drawer, the quantity badge and Signature button), coloured backgrounds, text colours, the compendium picker (its own window with its own zinc scheme) and Foundry UI overrides on `body`.
  - Design rationale: the sheet used 27 background greys, many only 1–3 steps apart, chosen per component. One named set makes the layering consistent and gives one place to tune the look. Layout was compared before and after in the dev preview (no element moved); every changed colour matched one of the planned shifts.

### Flex Layout Utility Classes (`styles/pf2e-mobile.css`, `templates/`)

#### Changed
- **More layout utilities (`styles/pf2e-mobile.css`)**: next to `.m-flex-row`, `.m-flex-col`, `.m-align-center` and `.m-align-baseline` there are now `.m-inline-flex`, `.m-justify-center`, `.m-justify-between`, `.m-wrap`, `.m-gap-2/4/6/8/10/12`, and for children of a flex container `.m-flex-1` (`flex: 1`), `.m-flex-auto` (`flex: 1 1 auto`), `.m-min-w-0` (`min-width: 0`) and `.m-shrink-0` (`flex-shrink: 0`). Like the existing ones they are scoped to `.pf2e-mobile-sheet` and only do layout.
- **Flex layout moved from component rules into the templates (`templates/`, `styles/pf2e-mobile.css`)**:
  - In component rules of the form `.pf2e-mobile-sheet .component { … }`, the declarations a utility covers (display flex/inline-flex, direction, align-items, justify-content, gap, wrap, `flex: 1`, `flex: 1 1 auto`, `min-width: 0`, `flex-shrink: 0`) were removed and the matching utilities added to every element with that class. About 380 declarations in 129 components; the stylesheet went from 4171 to 3748 lines.
  - Rules that only held layout are gone. When nothing else used the class, it was removed from the markup as well (e.g. `strike-card-header`, `slot-filled-content`, `tag-strip`, `skill-info`); classes that JS, `verify.mjs` or other rules still use stay.
  - Left in CSS on purpose: grid layouts, other values (e.g. `gap: 8px 12px`, `justify-content: space-around`), selectors with more than one class or a parent, rules inside media queries, classes that are only set conditionally in the template, and `.staff-drawer-content`'s `display`, which has to beat `.action-summary { display: none }`.
  - Order of classes in the markup: component classes first, then utilities as display, wrap, align, justify, gap, child sizing.
  - Design rationale: the same three or four flex declarations were repeated in about 200 rules. With the utilities the layout of an element can be read in the template, and component rules keep only how something looks.
  - The utilities come before all component rules in the stylesheet, so a component rule with the same specificity that sets the same property still wins. The rendered layout was compared before and after in the dev preview for all tabs, sub-tabs and opened cards of the local fixtures, a party fixture and two screen widths: no element moved or changed size.
- **Duplicate party nav rule removed (`styles/pf2e-mobile.css`)**: `.mobile-bottom-nav.party-nav` repeated the `display: flex` and `justify-content: space-around` the bottom nav already has.
- **Gap steps (`styles/pf2e-mobile.css`)**: odd gap values in the sheet were rounded down to the nearest step: 5px to 4px (HP row, damage application, aux action buttons, item badges, poison/detach/runes buttons, spell details), 3px to 2px (AC and shield badges, strike traits, item details) and 7px to 6px (skill info). Gaps in the compendium picker and dice dialog keep their values.

### Character Overview & Feats

#### Added
- **Character overview (`scripts/apps/sheet-helpers/context-character.js`, `templates/parts/character.hbs`)**: a view with the character's identity, the active effects, the six attribute modifiers, speeds, senses, languages, class DC, immunities, weaknesses and resistances, and all feats and features. The layout is inspired by pf2e's own character tab:
  - **Identity card**: the name with class and level in its title, the size and creature traits as tags (`identity.traits`, from `CONFIG.PF2E.creatureTraits`), and ancestry, heritage, background and deity in two columns.
  - **Attributes frame**: the six attribute boxes have a thin bronze border and no background of their own. Attributes, speeds, senses, languages and defenses share one frame, each with its own small header. Speeds are always land, swim, climb, fly and burrow in columns, like pf2e's sheet, with a dash for the ones the character doesn't have and pf2e's short type labels (`PF2E.Actor.Speed.Type.*`). Senses, languages and IWR are tags; like pf2e's sheet, low-light vision is left out when the character has darkvision, and both when it has greater darkvision (`SUPERSEDED_SENSES`, mirroring pf2e's private `condenseSenses()`).
  - Feats are listed in pf2e's own feat groups and order (`actor.feats`, plus the bonus feats group): ancestry features, class features, ancestry, class, archetype, skill, general and so on. Empty slots and empty groups are skipped, and feats granted by another feat (e.g. a dedication's free feat) are indented under it. The opened drawer has a Send to Chat button (the existing `itemToChat` action), like the action cards.
  - **Effects**: afflictions, active conditions and effects, the same three lists as pf2e's effects panel, right under the identity card, with their pf2e icon and the remaining duration under the name. Effects and afflictions show their badge value after the name (a counter, or an affliction's stage label); conditions don't, because pf2e already puts their value in the name ("Stupefied 2"). Effects show their remaining duration. pf2e calculates that duration (`effect.remainingDuration`); its own label formatter is private to its `EffectsPanel`, so `remainingDurationLabel()` mirrors its unit choice with the same `PF2E.EffectPanel` strings. While the overview is open it re-renders on combat and world time updates (`refreshOverviewDurations`), so the durations count down; pf2e doesn't update the effect itself when time passes. The section is hidden when nothing is active. Send to Chat (`onItemToChat` in `actions-handlers.js`) now also finds conditions that pf2e only keeps in memory (`actor.conditions`), the same lookup as the description drawer and pf2e's effects panel. This is a first place for effects until they get a better home. While anything is active, the 👤 button gets a small orange lightning badge in its corner (`hasActiveEffects` in `context-header.js`, the same corner badge style as the roll mode button).
  - **Feat and effect descriptions load on tap (`scripts/apps/sheet-helpers/character-handlers.js`)**: tapping a feat or effect line opens its description in the same drawer the action cards use, with an orange top edge on the open card. Unlike the Actions tab, descriptions are not enriched up front: most feats are never opened, so `onToggleItemDescription` enriches only the tapped feat (`TextEditor.enrichHTML`, same options as `context-actions.js`) and caches it on the sheet (`_itemDescriptions`). Open feats keep their text when the sheet re-renders; reopening the overview starts with all feats closed and re-reads the descriptions.
  - Everything is read from values pf2e already prepared; nothing is recalculated. The context is only built while the overview is open, so the other tabs don't pay for it.
  - Design rationale: `context-character.js` passes plain data (e.g. `identity.className`, `identity.level`, attribute keys); `character.hbs` and the CSS decide labels, order, which rows show and fallback text such as "No description.".
- **User button in the header (`templates/parts/header.hbs`, `scripts/apps/sheet-helpers/character-handlers.js`, `scripts/apps/mobile-sheet.js`)**: a `.header-btn` with 👤, left of the character name, opens the overview; tapping it again returns to the previous tab, and any footer tab also leaves it. It is green (`.active`) while the overview is open. Party and Kingdom sheets don't have it.
  - Characters in the switcher (and a lone character's name) no longer start with 👤, since the button next to them shows it. Party (👥) and Kingdom (👑) entries keep their icon.
  - Design rationale: the footer is full, and the cog menu is for settings, so the overview is a view in the tab area (`activeTab = "character"`) without a footer slot. It reuses the tab rendering and scroll memory; no footer item is highlighted while it is open.

#### Changed
- **Header grid gets a column for the user button (`styles/pf2e-mobile.css`)**: user button | name | target | roll mode | cog. `.actor-identity-wrapper` now uses `display: contents` like `.header-controls-wrapper`, so the button takes room from both the name and the target select instead of only from the name. Checked at phone width in Chromium and Firefox.

### Header Settings Menu & Shared Header Control Styles

#### Changed
- **Cog menu for canvas and fullscreen (`templates/parts/header.hbs`, `scripts/apps/sheet-helpers/header-handlers.js`, `scripts/apps/mobile-sheet.js`)**:
  - The canvas and fullscreen buttons moved into a small popover under a new cog button (`toggleHeaderMenu`). This leaves more room in the top row for the character name and the target select.
  - Using either of them closes the popover again (`closeHeaderMenu`). The open state lives only in the DOM, so a header re-render also closes it.
- **Roll mode toggle button (`templates/parts/header.hbs`, `scripts/apps/sheet-helpers/header-handlers.js`)**:
  - The 🎲 / ✋ roll mode select is replaced by a button next to the cog. It shows two dice (`fa-dice`) with a small corner icon for who rolls: a light blue chip (`fa-microchip`) for digital, a yellow hand (`fa-hand`) for your own dice.
  - Only the corner icon is coloured, with its own colour per mode, so neither mode looks like an "off" state.
  - One tap switches modes; `onToggleRollMode` now flips the saved mode instead of reading a select value.
- **Shared header control styles (`styles/pf2e-mobile.css`)**:
  - The per-control rules (`.btn-canvas-toggle`, `.btn-fullscreen`, `.header-roll-mode-select`, and the duplicated `.actor-switcher` / `.header-target-select` styling) are replaced by two shared classes: `.header-select` for dropdowns and `.header-btn` for square icon buttons, with `.header-btn.active` for the "canvas on" state. `.header-btn-badge` places a small corner icon on a header button.
  - `.btn-fullscreen` stays on the fullscreen button only as the hook the fullscreen icon sync looks up.
  - The top row is now a CSS grid (name | target | roll mode | cog; `.header-controls-wrapper` uses `display: contents`). The character switcher and the target select share the remaining space 2:3 (`2fr 3fr`), so there is no gap between them.
  - With the earlier nested flex layout, Firefox (also on Android) squeezed the target select to a sliver.
  - Without the character switcher, the plain name only takes the room its text needs and the target select gets the rest. On Party and Kingdom (no target select) the name spans both columns.
- **Range in the target dropdown (`templates/parts/header.hbs`)**:
  - Target options read `🎯 15ft Goblin Warrior` instead of `🎯 Goblin Warrior (15)`. The range comes first, so it stays visible when the select cuts off a long name.
  - The separate range pill next to the select is removed. Your own token keeps its `Self: … (Self)` text.

### Digital/Physical Roll Mode Remembered Across Reloads

#### Fixed
- **Roll mode persistence (`scripts/utils/sheet-utils.js`, `scripts/apps/sheet-helpers/header-handlers.js`, `scripts/apps/mobile-sheet.js`, `scripts/rolls/physical-dice-interceptor.js`, `scripts/pf2e-mobile.js`)**:
  - The Digital/Physical choice reset to Digital on every reload. The `ready` hook removed `localStorage["pf2e-mobile-compact.rollMode"]`, which is the same key Foundry uses to store the client-scope `rollMode` setting, so the setting was wiped as well.
  - The mode is now stored only in the client setting, through new `getStoredRollMode()` / `setStoredRollMode()` helpers. The extra raw localStorage writes and reads are gone; they also never matched, because Foundry stores the value JSON-encoded (`"physical"` with quotes).

### Slot Counter Only for Spontaneous Casters (`scripts/apps/sheet-helpers/context-spells.js`)

#### Fixed
- **Prepared casters no longer show a "Slots x / y" counter in the Cast view**: the counter and its +/- buttons showed pf2e's `slots.slotN.value`, which pf2e only uses for spontaneous and flexible casting. Casting a prepared spell marks that prepared spell as expended instead (shown on the spell card) and never changes the value, so prepared casters saw a counter stuck at its old number (e.g. "2 / 2") whose buttons did nothing useful. The counter now only counts spontaneous and flexible entries. For a prepared caster a rank group shows once a spell is prepared at that rank; the Preparation view is unchanged.
- **No slot counter on Cantrips (`scripts/apps/sheet-helpers/context-spells.js`, `scripts/verify.mjs`)**: cantrips are cast at will, but spontaneous casters got a counter on the Cantrips group because pf2e's `slots.slot0` holds the number of cantrips known. The counter now only looks at ranks 1–10. A `[Slot Counter]` check in `verify.mjs` covers it.

### Chat on the Line for Actions Without Use or Roll (`templates/parts/actions/action-card.hbs`)

#### Changed
- **Chat button moves to the line when an action has no other button (`templates/parts/actions/action-card.hbs`, `styles/pf2e-mobile.css`)**: actions with neither Use (self effect, frequency, crafting) nor Roll (a check) had no button on the line, e.g. Anoint Ally or Command Undead. For those, posting the card to chat is the action (the chat card shows the description and any effect link to drag onto an ally), so Chat now sits on the line as an icon button and the drawer only holds the description. Actions with Use or Roll keep Chat in the drawer.

### Skill Actions: Skill Label & Sort Order (`scripts/apps/sheet-helpers/context-actions.js`)

#### Changed
- **Skill label on skill action cards (`scripts/apps/sheet-helpers/context-actions.js`, `templates/parts/actions/action-card.hbs`, `styles/pf2e-mobile.css`)**: each card in Skill Actions shows the skill it rolls and the character's proficiency in it, e.g. "M Stealth", with the rank letter in the Skills tab colors. The skill comes from pf2e's action registry (`game.pf2e.actions`, `statistic`) or the item's own `system.statistic`. Actions with a choice of skills (Recall Knowledge) read "Multiple" with the best rank among the options; the tooltip lists them.
- **Skill Actions sort order (`scripts/apps/sheet-helpers/context-actions.js`)**: the section was sorted by name. It now lists actions from feats first (skill feats with an action cost, or actions a feat granted, per pf2e's `item.grantedBy`), then by proficiency in the action's skill (best first, actions without a skill last), then by name. The other sections still sort by name.
- **Shared proficiency constants (`scripts/utils/sheet-utils.js`, `scripts/apps/sheet-helpers/context-skills.js`)**: the rank letters and names (U / T / E / M / L) moved from `context-skills.js` to `sheet-utils.js`, so the Skills tab and the skill labels use the same list.
- **`scripts/verify.mjs`**: new `[Skill Action Labels]` check for the skill lookup (single skill, choice of skills, no skill) and the sort order.

### Strike Action Icon (`templates/parts/actions.hbs`)

#### Changed
- **Strike glyph is an icon**: the action cost on strike cards in Attacks was shown as the plain letter "A" (pf2e's glyph for one action). It now uses the pf2e action icon font, like the spell and action cards, so it shows the one-action icon.
- **Ready weapons are marked (`scripts/apps/sheet-helpers/context-actions.js`, `templates/parts/actions.hbs`, `styles/pf2e-mobile.css`)**: strike cards whose weapon is ready to strike get a green left border, the same green as the Held / Equipped badges on the Gear tab. "Ready" is pf2e's own `strike.ready`: the weapon is held in enough hands, or it is a worn thrown weapon and a hand is free.

### Shared Item Card Partial & Gear Tab Look (`templates/parts/inventory/`)

#### Changed
- **One template for an item card (`templates/parts/inventory/item-card.hbs`, `templates/parts/inventory.hbs`, `scripts/pf2e-mobile.js`)**:
  - Consumables, Weapons, Armor & Shields and Other Gear each had their own copy of the item card. The card now lives in `inventory/item-card.hbs`, rendered as a partial block; `inventory.hbs` went from 295 to 195 lines. Each section fills the named slots `badges`, `lineButtons` and `drawerButtons` with inline partials; `showQuantity` and `showBulk` cover the other differences. The card itself adds Send to Stash.
  - As with the spell card, the slots can only use the card's parameters and `@root` (`../partyStash` became `@root.partyStash`), and the loops no longer name their item `item`.
  - Before the look changed below, the refactor was checked to render identically for three real character exports, with and without a party stash, collapsed and expanded.
- **Gear tab gets the shared look (`templates/parts/inventory/item-card.hbs`, `templates/parts/inventory.hbs`, `styles/pf2e-mobile.css`)**:
  - The four sections are `.m-group` frames (they keep folding and their fold chevron) and the items are `.m-card` rows. The whole line (image, name, badge row) toggles the drawer, without a chevron; long names are cut off with an ellipsis.
  - Use / Apply and the status badges (carry state, equipped, invested) stay on the line. Runes, Clean and Send to Stash moved into the drawer, above the description. The bulk is shown as a badge in the badge row.
  - The section title rule is now shared (`.m-group > .section-title`) by the Actions and Gear tabs. The Spells and Actions tabs were measured before and after and are unchanged.

### Shared Group & Card Classes (`m-group`, `m-card`)

#### Changed
- **One set of classes for the shared look (`styles/pf2e-mobile.css`, `templates/parts/spells/spell-card.hbs`, `templates/parts/spells.hbs`, `templates/parts/actions/action-card.hbs`, `templates/parts/actions.hbs`)**:
  - The Spells and Actions tabs shared their look through pairs of class names (`.spell-card-line, .action-card-line`, ...). They now use one set of `m-` classes: `.m-group` (padded frame: spell rank groups, Actions sections), `.m-group-list` (its list of cards), `.m-card` (raised card: spell, action and strike cards), `.m-card-line` (tappable line), `.m-card-main` / `.m-card-title` (name column and name row) and `.m-drawer-row` (Chat + damage row in the drawer). The CSS section starts with a comment listing them.
  - Tab-specific class names stay where JavaScript uses them (`.spell-list`, `.spell-rank-group`, `.spell-card`, `.strike-card`) or for tab-specific details; the old line/column/row names were replaced. The old `.character-actions-list`, `.character-action-card` and `.character-action-card.expanded` rules, and the strike card's own background and border, were removed because the shared rules cover them.
  - The look is unchanged: the position, size and computed style of every element (6422 elements in six views across both tabs) were measured in the preview before and after and are identical.

### Shared Action Card Partial (`templates/parts/actions/`)

#### Changed
- **One template for an action card (`templates/parts/actions/action-card.hbs`, `templates/parts/actions.hbs`, `scripts/pf2e-mobile.js`, `scripts/verify.mjs`)**:
  - The Actions, Reactions, Free Actions, Skill Actions, Exploration and Downtime sections each had their own copy of the action card. The card now lives in `actions/action-card.hbs` and each section renders it with one line; `actions.hbs` went from 444 to 162 lines. Strikes (Attacks) keep their own layout.
  - The copies differed in three ways. Two are now parameters: `glyphType` ("reaction" / "free" shows the fixed ⬢ / ◇ symbol) and `showActionCount` (adds the action count to Use / Roll, as in Actions and Skill Actions).
  - Rendered output is unchanged, checked by rendering three real character exports in every Actions sub-tab, collapsed and expanded, before and after. The `[Action Cost Labels]` check in `verify.mjs` now reads the Use / Roll label from the partial.
- **Actions tab gets the spell card look (`templates/parts/actions/action-card.hbs`, `templates/parts/actions.hbs`, `styles/pf2e-mobile.css`, `scripts/verify.mjs`)**:
  - Action cards follow the spell card structure: the whole line (name row plus a second row with traits and "Uses") toggles the drawer, without a chevron; the card lightens while pressed and gets an orange top edge when open; long names are cut off with an ellipsis instead of pushing the buttons off screen.
  - Use and Roll / Attack are icon-only on the line (▶ / toggle when active, d20, crosshairs); the action cost is shown by the glyph, so the `showActionCount` parameter was removed. Chat moved into the drawer, which is now always present.
  - The glyph uses the pf2e action icon font; reactions and free actions show the real reaction / free-action icons instead of ⬢ / ◇.
  - Each Actions tab section (Attacks, Actions, Reactions, Free Actions, Skill Actions, Exploration, Downtime) is a frame like the spell rank groups, with its title inside, and the cards are raised rows. Strike cards keep their own layout and only get the raised card look. The sections do not fold: they have no fold state, so folding would add code rather than remove it.
  - The CSS reuses the spell rules through combined selectors (for example `.spell-card-line, .action-card-line`); only the section title, icon-only buttons, traits row and strike padding needed their own rules.
  - Removed the part of the `[Action Cost Labels]` check that required the "(2)" text on the Use / Roll buttons; the checks on how action counts are parsed stay.
- **"Uses: x / y" shown in every Actions section (`templates/parts/actions/action-card.hbs`)**: the line for actions with limited uses (pf2e's Frequency, e.g. once per day) was only shown in Actions, Reactions and Free Actions. It is now also shown in Skill Actions, Exploration and Downtime when an activity has a limit; nothing changes for activities without one.

### Shared Spell Card & Cast Button Partials (`templates/parts/spells/`)

#### Changed
- **One template for a spell line (`templates/parts/spells/spell-card.hbs`, `templates/parts/spells.hbs`, `scripts/pf2e-mobile.js`)**:
  - Moved the spell card markup (name row, source badges, detail tags, traits, heightened notice, damage row, description and Signature/Remove footer) out of `spells.hbs` into a new partial, `spells/spell-card.hbs`, registered in the `loadTemplates` list. Partials that make up the Spells tab live in the new `templates/parts/spells/` folder.
  - Both the Spells list and the staff spell list now render through this partial as a Handlebars partial block (`{{#> ".../spells/spell-card.hbs" spell=spell rank=group.rank}}…{{/…}}`). The block content supplies the buttons next to the spell name, because those differ per list; everything else is written once.
  - Parameters: `showManageButtons` shows the Signature/Remove footer (Spells list only); `showChargeCost` shows the staff charge-cost badge (staff list only).
  - Design rationale: the card was copied between the Spells list and the staff list and the copies had drifted apart (for example, the traits block in the Spells list still carried the `staff-spell-traits` class). One partial keeps them consistent and gives upcoming layout changes a single place to edit.
- **Cast buttons in their own partials (`templates/parts/spells/cast-button.hbs`, `templates/parts/spells/staff-cast-buttons.hbs`, `scripts/verify.mjs`)**:
  - `cast-button.hbs` holds the Spells list Cast button (normal and expended-slot variants); `staff-cast-buttons.hbs` holds the staff Cast buttons (cantrip, full charge cost, and 1 charge + spontaneous slot). The staff id is passed in as `staffId` instead of being read from `@root`.
  - Moving the buttons did not change the rendered output.
- **Spells list Cast button shows only the cast icon (`templates/parts/spells/cast-button.hbs`, `scripts/verify.mjs`)**:
  - Removed the "Cast (2)" text; the button shows the wand icon (crosshairs for attack spells). The action count stays in the tooltip.
  - Removed the part of the `[Action Cost Labels]` check that required the "Cast (…)" text in the template. The checks on how action counts are parsed stay.
- **Whole spell line toggles the details drawer (`templates/parts/spells/spell-card.hbs`, `styles/pf2e-mobile.css`)**:
  - The name row and detail tags are wrapped in `.spell-card-line`, which carries `data-action="toggleActionSummary"`, so tapping anywhere on the line opens or closes the drawer instead of only the name. Buttons inside the line keep their own actions. Taps inside the open drawer no longer collapse it.
  - The title part of the line is layout only (badges, action glyph, name) without its own click handler.
  - Removed the chevron from the spell line: on a two-row tap target it looked out of place. Instead the card shows its state: it lightens while its line is pressed (not when a button on it is pressed, using `:has(.spell-card-line:active):not(:has(button:active))`), and an open card gets an orange-tinted border and a slightly lighter background, continuing the drawer's orange accent.
- **Layout utility classes (`styles/pf2e-mobile.css`)**:
  - Added `.m-flex-row` (`display: flex; flex-direction: row`), `.m-flex-col` (`display: flex; flex-direction: column`) and `.m-align-baseline` (`align-items: baseline`), scoped to `.pf2e-mobile-sheet`. They handle layout only, so templates can use them instead of repeating flex rules in each component class. The `m-` prefix avoids clashes with Foundry's own `flexrow`/`flexcol` and other modules.
- **pf2e action icons for spell action costs (`templates/parts/spells/spell-card.hbs`, `templates/parts/spells.hbs`, `templates/parts/spell-picker-dialog.hbs`)**:
  - The action-cost badge on spell cards, preparation slots and the spell picker wraps the glyph in `<span class="action-glyph">`, pf2e's own class for its `Pathfinder2eActions` icon font, so `1`, `2`, `3`, `R` and `F` show as the official action icons. The font and class are loaded by the pf2e system at runtime; nothing is bundled.
  - Ranges keep the module's format (`1-3`), which shows as two icons joined by a hyphen, because only the digits and letters are icons in that font. No Handlebars helper or mapping is needed.
- **Line and drawer button slots; secondary buttons moved into the drawer (`templates/parts/spells/spell-card.hbs`, `templates/parts/spells.hbs`, `templates/parts/spells/staff-line-cast-button.hbs`, `styles/pf2e-mobile.css`, `scripts/pf2e-mobile.js`)**:
  - `spell-card.hbs` now has two named slots that the caller fills with inline partials: `lineButtons` (next to the spell name) and `drawerButtons` (a new `.spell-drawer-actions` row in the opened drawer). This replaces the single `@partial-block` slot, because the drawer content also differs per list.
  - Spells list: the line only has the Cast button; Restore Expended Slot moved into the drawer.
  - Chat is part of the card itself, in a drawer row (`.spell-drawer-primary-row`, formerly `.spell-damage-drawer-row`) that is always shown: the Chat button first, then the Roll Damage / Roll Healing button (when the spell has one) filling the remaining width. Chat now also passes `data-rank` for staff spells, so a heightened staff spell is posted to chat at the rank of its group.
  - The `.spell-drawer-actions` row is hidden when the caller supplies no buttons (`:not(:has(*))`, since the slot may still contain whitespace).
  - Staff list: when a spell can be cast in two ways (full charge cost, or 1 charge + a spontaneous slot), the line button opens the drawer, where both options are shown. With only one way (cantrips, or no spontaneous slots of that rank or higher) the line button casts directly. This logic lives in the new `staff-line-cast-button.hbs`; a popup to choose may replace the drawer later.
  - Handlebars limitation: inline partials cannot see the block parameters of the surrounding each-loop, and a block parameter with the same name as the card's `spell` parameter crashes rendering. The loops therefore use `listSpell` / `staffSpell` and pass them in as `spell`; the slots use only `spell`, `rank` and `@root`.
- **Rank groups frame their spells (`styles/pf2e-mobile.css`)**:
  - Each rank group (`.spell-rank-group`, in the Spells list and inside the staff) is a padded frame with a 2px border and rounded corners. The rank header (title, count, slots) sits inside the frame without its own bar, and the spells are separate raised rows with a small gap between them inside the frame: only a light top border (`1px solid rgba(255, 255, 255, 0.25)`, other sides `0`) plus a soft drop shadow, on a background slightly lighter than the frame. Rank groups can still be folded.
  - Because only the top border has a width, an open spell shows an orange top edge and an expended spell a red top edge (with its red-tinted background). The "No spells available for this rank." hint sits inside the frame.
- **Focus spells in their own group above the Cantrips (`scripts/apps/sheet-helpers/context-spells.js`, `templates/parts/spells.hbs`)**:
  - `prepareSpellsContext()` collects focus spells into a "Focus Spells" group (`rank: "focus"`) that is placed first in `spellRanks`, instead of in the rank they are heightened to. Each spell keeps its `castRank`, so heightening, damage and casting use the correct rank; the group only appears when there are focus spells.
  - The spell card now gets its rank from the spell (`rank=listSpell.castRank`) instead of from the group, since the focus group has no single rank. For all rank groups this is the same value (checked by rendering every preview fixture before and after).
  - The rank header tooltip reads "Toggle {{group.label}}" (for example "Toggle Focus Spells", "Toggle Rank 1").
  - The focus point counter moved from the action bar above the spells into the Focus Spells header, in the place where rank groups show their slots. A focus pool without focus spells cannot be used, so the action bar no longer shows it at all; the unused `.focus-pool-tracker` / `.focus-buttons` CSS was removed.
  - Focus points are shown as one flame per point (`.btn-focus-point`): lit for available points, dimmed for spent ones. Tapping a lit flame spends a point, tapping a dimmed one regains a point (same `adjustFocus` action with `data-delta` −1 / +1). `prepareHeaderContext()` adds `focus.points` (one `{ available }` entry per point) because Handlebars cannot loop over a number. Each flame is a 36px touch target, the same size as the slot −/+ buttons.

#### Fixed
- **Reaction and free-action spells no longer count as 2 actions (`scripts/utils/sheet-utils.js`, `scripts/apps/sheet-helpers/context-spells.js`, `scripts/apps/sheet-helpers/context-activations.js`, `scripts/verify.mjs`)**: `parseActionCostInfo()` only gave reactions and free actions an empty action count for non-spells, so spells such as Hidebound got `castActions: "2"` (tooltip "Cast Hidebound (2 Actions)"). Spells now get an empty count too (the glyph stays "R" / "F"), `formatSpell()` no longer turns an empty count back into "2", and wands / scrolls use their spell's own count. `verify.mjs` checks a reaction spell.
- **"Cantrip" shown twice on cantrip spells (`templates/parts/spells/spell-card.hbs`)**: the drawer added its own Cantrip badge next to pf2e's "cantrip" trait. The extra badge was removed; all cantrips in the test data carry the trait.
- **Long spell names no longer push the Cast button off screen (`templates/parts/spells/spell-card.hbs`, `styles/pf2e-mobile.css`)**: the name/tags column of the spell line (`.spell-card-main`) and the name row (`.spell-card-title`) may now shrink below their content width (`min-width: 0`), and the button group keeps its size (`flex-shrink: 0`). A name that does not fit is cut off with an ellipsis; on an opened card it wraps.
- **Folding staff rank groups and the focus group is remembered (`scripts/apps/sheet-helpers/spells-handlers.js`)**: `onToggleRankGroup` used `parseInt` on the group key, turning `"staff-2"` into `NaN`, so a folded staff rank group opened again on the next render. Numeric keys are still stored as numbers; other keys (`"focus"`, `"staff-2"`) are now stored as text, matching what the context builders look up.

#### Changed
- **Staff spells use the same card layout as the Spells list (`templates/parts/spells.hbs`, `styles/pf2e-mobile.css`)**:
  - Staff spell buttons now sit next to the spell name instead of on a row underneath, and the charge-cost badge moved from the name row into the detail tags row. The layout is intentionally left unpolished until the spell card design is reworked.
  - Removed the now unused stacked staff layout CSS (`.staff-spell-card`, `.staff-spell-header*`, `.staff-spell-details`, `.staff-spell-actions`, `.staff-btn-flex`).
  - The Spells list renders identically to before; this was checked by rendering every preview fixture in each sub-tab, collapsed and expanded, before and after the change and comparing the HTML.

---

## [1.0.29] - 2026-09-29

### Targeting Fixes: iOS Real-Time Distance Updates, AoE Multi-Targeting, Flanking Detection, Self-Targeting, & Persistent Canvas Toggle (Issue #16)

#### Fixed & Added
- **iOS / Mobile Real-Time Token Distance Synchronization & Tiny `5-10-5` Grid Steps (`scripts/tokens/token-adapter.js`, `scripts/apps/mobile-sheet.js`, `scripts/apps/sheet-helpers/context-header.js`)**:
  - Fixed an issue on iPhone / iOS where paused canvas animations caused `tokenDoc.x`/`y` and `placeable.bounds`/`center` to freeze at pre-movement coordinates when tokens moved on the map.
  - Added `syncTokenPosition(tokenOrDoc)`, `syncSceneTokenPositions(scene)`, and `getAuthoritativeTokenGeometry(tokenOrDoc)` to read authoritative database coordinates (`doc._source.x`, `doc._source.y`, `doc._source.elevation`), terminate stalled canvas animations via `foundry.canvas.animation.CanvasAnimation`, and immediately update `tokenDoc` and `placeable` positions.
  - Snapped Tiny tokens (`width < 1` or `height < 1`) to the 5-ft grid square containing their center in `getAuthoritativeTokenGeometry()` and `measurePF2eTokenDistance()` so distances always step in 5-ft increments (`0, 5, 10, 15, 20, 25...`) using PF2e `5-10-5` diagonal rules and never produce non-5-ft sub-grid fractions (`23 ft`).
- **Area of Effect (AoE), Heightened Multi-Target Spells, & Single-Target Narrowing (`scripts/apps/sheet-helpers/sheet-prompts.js`, `scripts/tokens/token-adapter.js`, `scripts/apps/sheet-helpers/spells-handlers.js`, `scripts/apps/sheet-helpers/activations-handlers.js`, `templates/parts/header.hbs`)**:
  - Updated `isMultiTargetOrAreaSpell(spell, castRank)` to evaluate heightened spell variants (`spell.loadVariant({ castRank })` and `system.heightening.levels`) so spells that become multi-target when heightened (e.g., Rank 6 *Slow*, *Haste*, *Paralyze*) support multi-targeting, while guarding against false positives on strings like `"any 1 creature"` or `"any single ally"`.
  - Updated `resolveTargetForAction(sheet, actionLabel, { includeSelf, allowMulti })` so that when a single-target action (`allowMulti: false`, such as a weapon Strike) is used while multiple targets (`game.user.targets.size > 1`) are selected, the user is prompted to narrow selection down to 1 target and unselect the others.
  - Added `setTargetTokens(tokenIds)` in `token-adapter.js` using `{ user: game.user, releaseOthers: false, groupSelection: true }` to synchronize multiple targets simultaneously in `game.user.targets` and broadcast all target reticules to the TV/GM screen.
- **Flanking Detection, Condition & Action Depletion Checks, & No-Canvas Fallback (`scripts/tokens/token-adapter.js`, `scripts/pf2e-mobile.js`, `scripts/apps/sheet-helpers/actions-handlers.js`)**:
  - Delegated `placeable.isFlanking` and `placeable.canFlank` to PF2e's native canvas flanking (`TokenPF2e.prototype.isFlanking` / `canFlank`) whenever the canvas is active (`canvas?.ready`).
  - When the canvas is disabled/headless, `computeTokenFlanking()`, `canTokenFlank()`, and `isActorAbleToFlank()` evaluate `attributes.flanking.canFlank`, static blocking conditions (`unconscious`, `dead`, `dying`, `0 HP`, `paralyzed`, `petrified`, `confused`, `controlled`, `fleeing`, `restrained`, `blinded`), and dynamic `stunned`/`slowed`/`quickened` action depletion (`Math.max(stunned, slowed) >= baseActions`, plus duration-based stun).
  - Fixed headless `TokenDocument.prototype.object` getter override in `getTargetableToken()` using `Object.defineProperty(tokenDoc, "object", { value: adapter, configurable: true, writable: true })` and added an `Actor.prototype.getActiveTokens` headless fallback in `patchUserActiveTokens()` so Strike rolls invoke our module's `adapter.isFlanking` (`computeTokenFlanking`) when `core.noCanvas` is enabled.
  - Eliminated recursive `placeable.distanceTo` calls in `measurePF2eTokenDistance()` and replaced global `CanvasAnimation` access with `foundry?.canvas?.animation?.CanvasAnimation`.
- **Self-Targeting for Spells, Actions, & Header Selector (`scripts/tokens/token-adapter.js`, `scripts/apps/sheet-helpers/sheet-prompts.js`, `scripts/apps/sheet-helpers/context-header.js`)**:
  - Updated `getTokenDistanceInfo()` and `collectSceneCandidateTokens()` to include the character's own token (`Self: <Name> (Self)`) in the header target dropdown, spell target prompts, and skill/action prompts (while excluding Self from weapon Strike prompts via `{ includeSelf: false }`).
- **Mobile Canvas Active by Default + Persistent `core.noCanvas` & `CONFIG.Canvas.disabled` Toggle with Confirmation (`scripts/pf2e-mobile.js`, `scripts/utils/sheet-utils.js`, `scripts/apps/sheet-helpers/header-handlers.js`, `templates/parts/header.hbs`)**:
  - Kept the WebGL canvas **enabled by default** on mobile (`disableCanvas = false`), synchronized Foundry v14's `core.noCanvas` setting (`localStorage` and `game.settings`) alongside `CONFIG.Canvas.disabled` when No-Canvas mode is toggled, and paused the background PIXI WebGL ticker (`canvas.app.ticker.stop()`, `stage.renderable = false`) while the full-screen mobile sheet is active.
  - Added a `DialogV2.confirm` confirmation prompt on `onToggleCanvasMode` (`data-action="toggleCanvasMode"`) before toggling and reloading the session.

---

## [1.0.28] - 2026-09-29

### Repeatable Spell Damage Button Inside Spell Cards (`Dmg` / `Heal`)

#### Added
- **Spell Damage & Heightening Detection (`scripts/apps/sheet-helpers/context-spells.js`, `scripts/apps/sheet-helpers/context-activations.js`)**:
  - Updated `formatSpell` to resolve the heightened spell variant (`spell.loadVariant({ castRank: effectiveCastRank })`) and enrich spell descriptions with heightened roll data.
  - Added detection for `hasDamage`, `isHealingOnly`, `damageFormula`, and `effectiveCastRank` across `system.damage`, `spell.overlays`, and inline `@Damage[...]` tags.
  - Updated `prepareActivationsContext` so Wands and Scrolls also resolve their embedded spell documents (`item.system.spell`) and pass `castRank` for damage detection.
- **Repeatable Non-Consuming Spell Damage Handler (`scripts/apps/sheet-helpers/spells-handlers.js`, `scripts/apps/mobile-sheet.js`)**:
  - Added `onRollSpellDamage` (`data-action="rollSpellDamage"`) to roll spell damage or healing at the spell's heightened rank using PF2e's native `variantSpell.rollDamage(event)` without expending spell slots, focus points, innate uses, or staff/wand charges.
  - Added support for overlay variant selection (e.g., 1/2/3-action *Heal*, *Harm*, *Force Barrage*) via `promptVariantSelection`, inline `@Damage[...]` link fallback, and Physical Dice interception (`PhysicalDiceManager.withPhysicalMode`).
- **Spell Card UI & Expended Slot Brightness (`templates/parts/spells.hbs`, `styles/pf2e-mobile.css`)**:
  - Added a touch-friendly `Dmg` / `Heal` button directly in the `.action-btn-group` header of Spell Cards, Staff Spell Cards, Wand Cards, Scroll Cards, and Other Item Spell Cards, plus a full-width `Roll Damage (Rank X) · Formula` button inside the expanded `.action-summary` drawer.
  - Updated `.spell-card.expended` styling so that only the expended spell title and disabled `Cast` button are dimmed while the `Dmg` and `Restore Slot` buttons remain at 100% brightness and contrast for multi-turn/sustained damage rolls.

---

## [1.0.27] - 2026-09-28

### Spell Casting Action Counts (`Cast (1)`, `Cast (2)`, `Cast (3)`, `Cast (1-3)`) & Multi-Action Button Labels (`> 1` Action)

#### Added
- **Action Cost & Spell Time Parser (`scripts/utils/sheet-utils.js`)**:
  - Added `normalizeActionCountString(raw)` and `parseActionCostInfo(itemOrSpell, fallbackCost, options)` and enhanced `getGlyph(actionCost, rawTime)` to parse PF2e spell casting times (`spell.system?.time?.value`), `actionCost`, and variable action ranges (`"1 to 3"` $\rightarrow$ `"1-3"`, `"1 to 2"` $\rightarrow$ `"1-2"`, `"2 to 3"` $\rightarrow$ `"2-3"`).
  - Configured spells (`options.isSpell === true`) to default to `2` actions (`"2"`) whenever a specific 1–3 action count is not explicitly specified on the spell document.
  - Configured non-spell actions to expose `multiActionLabel` (`"2"`, `"3"`, `"1-2"`, `"1-3"`, `"2-3"`) strictly when the action requires more than 1 action.
- **Spell Cast Buttons & Activations (`scripts/apps/sheet-helpers/context-spells.js`, `scripts/apps/sheet-helpers/context-activations.js`, `scripts/apps/sheet-helpers/spells-handlers.js`, `templates/parts/spells.hbs`)**:
  - Updated all `Cast` buttons across the main Spells Cast View and Activations sub-tab (Staves, Wands, Scrolls, and Other Item Spells) to display the action count next to `Cast` (`Cast (1)`, `Cast (2)`, `Cast (3)`, `Cast (1-3)`, `Cast (1-2)`, `Cast (2-3)`), defaulting to `Cast (2)`.
  - Updated `onOpenSpellPrepPicker` to use `parseActionCostInfo` so variable-cost (`1-3`) and standard spells display accurate action glyphs in the Spell Preparation picker.
- **Character & Skill Action Buttons (`scripts/apps/sheet-helpers/context-actions.js`, `templates/parts/actions.hbs`, `styles/pf2e-mobile.css`)**:
  - Updated `Use`, `Roll`, and `Attack` buttons across Encounter Actions, Skill Actions, Exploration, and Downtime cards to append `({{act.multiActionLabel}})` when an action requires more than 1 action (`Use (2)`, `Roll (2)`, `Attack (2)`).
  - Updated `.action-cost-glyph` CSS to support auto-width pill expansion (`min-width: 26px; width: auto; padding: 0 5px;`) for variable range glyphs (`1-3`).

---

## [1.0.26] - 2026-09-27

### Real-Time Target Distance Display (`Name (distance)`)

#### Added
- **Target Distance Calculation (`scripts/tokens/token-adapter.js`)**:
  - Added `getTokenDistanceInfo(actor, targetTokenOrId)` to calculate PF2e grid-aware distances (including 2.5D elevation and alternating diagonals) across both live Canvas placeables and headless `TokenDocument` adapters, returning clean numeric distance labels (`{ distance, label }`).
  - Updated `getOriginToken(actor)` so live canvas placeables also resolve through `getTargetableToken(placeable.id)` to guarantee `.distanceTo()` availability.
- **Header Target Selector & Active Distance Badge (`scripts/apps/sheet-helpers/context-header.js`, `templates/parts/header.hbs`, `styles/pf2e-mobile.css`)**:
  - Updated header target selector options to display `🎯 Name (distance)` (e.g., `🎯 Goblin Warrior (15)`) without unit clutter, sorted closest-first (`distance` ascending).
  - Added a compact `.header-target-distance-pill` badge (`(15)`) beside the target selector when a target is active so the distance remains visible even when long monster names ellipsis-truncate in the closed `<select>`.
- **Action & Consumable Target Modals (`scripts/apps/sheet-helpers/sheet-prompts.js`)**:
  - Updated `promptTargetSelection` and `promptConsumableUsage` modals to display `Name (distance)` (e.g. `Goblin Warrior (15)`, `Comrade: Kyra (5)`) and sort tokens by distance ascending.

---

## [1.0.25] - 2026-09-27

### Mobile Kingdom Sheet (`pf2e-kingmaker-tools` Integration), Homebrew Rules & Automated CI Verification

#### Added
- **Mobile Kingdom Sheet (`scripts/kingdom/kingdom-handlers.js`, `templates/kingdom/*.hbs`, `styles/kingdom.css`)**:
  - Added full 5-tab Mobile Kingdom Sheet (`Turn`, `Kingdom`, `Settlements`, `Trade`, `Notes`) integrated into `PF2eMobileSheet` (`templates/mobile-sheet.hbs`, `templates/parts/header.hbs`, `templates/parts/party-overview.hbs`).
  - Seamless switching between Character Sheets, Party Sheet, and Kingdom Sheet via the Header Actor Switcher (`👑 <Kingdom Name> (Kingdom)`) and the Party Overview launcher button (`Open Kingdom Sheet (Mobile View)`).
  - Direct API delegation to `pf2e-kingmaker-tools` (`kmApp._preparePartContext("form", {}, {})`, `kmApp._onClickAction`, `kmApp._onChangeForm`) and native PF2e (`partyActor.system.campaign`) with zero duplicated rule constants.
- **Full Leadership Roster & `pf2e-kingmaker-tools` Homebrew Rules Support**:
  - Interactive 8-role Leadership Roster (`Ruler`, `Counselor`, `General`, `Emissary`, `Magister`, `Treasurer`, `Viceroy`, `Warden`) with mobile Character Assignment `<select>`, Vacancy toggle, and Active Turn Leader `<select>`.
  - Support for `pf2e-kingmaker-tools` Homebrew Leadership Modifiers (`enableLeadershipModifiers` / `useLeadershipModifiers`) with interactive `Invested` / `Skilled` / `Uninvested` `<select>` pickers, live Leader Skill Bonus badges (`+1`/`+2`/`+3`), and mobile **PC Skills (`inspect-leader-skills`)** & **Kingdom Skills (`inspect-kingdom-skills`)** modal inspectors.
  - Support for Homebrew Leadership activities (**Naval Support**, **Cleanse Item**), V&K XP buttons (`vkXp`, `solution-xp`, `rp-xp`, `level-up`, `end-turn`), and rigid Settlement Level-Up (`level-up-settlement`).
  - All Kingdom skill checks (`rollKingdomSkillCheck`) and activity rolls (`performKingdomActivity`) automatically integrate with `PhysicalDiceManager.withPhysicalMode` for Digital (`🎲`) and Physical (`✋`) dice modes, plus mobile-styled `DialogV2` modals for `KingdomCheckDialog`, `Consumption Breakdown`, and `InspectSettlement`.
- **Section-by-Section Automated Verification Suite, GitHub Actions CI & Foundry AI Policy Enforcement (`scripts/verify.mjs`, `.github/workflows/ci-verify.yml`, `.agents/rules/foundry-ai-policy.md`, `.agents/skills/foundry-ai-policy-audit/SKILL.md`)**:
  - Expanded `scripts/verify.mjs` to validate all 26 ES modules, static `PF2eMobileSheet` action method definitions, HTML tag and Handlebars block balance across all 17 templates, 196 `data-action` and `data-change-action` bindings, CSS brace balance, and end-to-end interactive tests across all 5 Kingdom tabs.
  - Added Section 7 (`Foundry VTT AI Content Policy Compliance Audit`) to `scripts/verify.mjs`, `.agents/rules/foundry-ai-policy.md`, `.agents/skills/foundry-ai-policy-audit/SKILL.md`, and `AGENTS.md` enforcing Foundry VTT's March 18, 2026 AI Content Policy (zero AI-generated media/SVG evasion, zero copied third-party rules constants, zero runtime `eval`/`new Function`, modular `< 700` line orchestrator with 100% JSDoc coverage, and honest package categorization).
  - Added `.github/workflows/ci-verify.yml` to run `node scripts/verify.mjs` automatically on every Pull Request and push to `main`.


---

## [1.0.24] - 2026-09-25

### Codebase Audit & Comprehensive Bug Fixes

#### Fixed
- **Initialization Order & Dynamic Sheet Routing** (`scripts/pf2e-mobile.js`):
  - Registered `mobileActivationMode`, `autoOpenSheet`, and `rollMode` settings at the start of `Hooks.once("init")` before `shouldActivateMobile()` is evaluated, fixing `"always"` mode on desktop/tablets and `"never"` mode on mobile.
  - Installed `Actor.prototype._getSheetClass` and `sheet` getter routing unconditionally in `init` (guarded dynamically by `shouldActivateMobile()`), and ensured `setupPhysicalDiceInterceptor()` and `patchUserActiveTokens()` are active whenever `PF2eMobileSheet` renders.
- **Physical Dice Mode Environment, Negative Check Modifiers & Multi-Die Check Partitioning** (`scripts/rolls/physical-dice-interceptor.js`, `scripts/apps/physical-dice-dialog.js`):
  - Replaced `isMobileDevice()` hardcodes in `isPhysicalModeActive()`, `withPhysicalMode()`, and `shouldIntercept()` with `_isPhysicalEnvironment()`, honoring `mobileActivationMode` and open `.pf2e-mobile-sheet` windows.
  - Fixed `interceptRoll()` check modifier calculation so negative operators (`1d20 - 2`) are respected instead of summed as positive numbers.
  - Validated non-fortune multi-die check inputs (`count > 1`) against `count..(count * faces)` and partitioned the entered sum across individual dice via `partitionTotal()`.
- **Staff Charge `+1` / `-1` Buttons & Pure Charges vs `1 Chg + Slot` Casting** (`templates/parts/spells.hbs`, `scripts/apps/sheet-helpers/activations-handlers.js`, `scripts/apps/sheet-helpers/context-activations.js`, `scripts/apps/sheet-helpers/sheet-prompts.js`, `scripts/apps/sheet-helpers/actions-handlers.js`):
  - Removed `onclick="event.stopPropagation()"` from `.staff-charges-tracker` in `templates/parts/spells.hbs` which was swallowing click events before they could bubble to Foundry `ApplicationV2`'s `[data-action]` delegator (`adjustStaffCharges`), and added a `.staff-charges-tracker` guard in `onToggleActionSummary`.
  - Unified staff charge resolution and persistence (`resolveActorStaffCharges` / `setActorStaffCharges`) across `pf2e-dailies` (`extra.dailies.staves.charges`) and `pf2e-mobile-compact` flags so users can freely add (`+1`) or spend (`-1`) charges up to max charges if they accidentally removed one.
  - Bypassed `pf2e-dailies`'s `StaffSpellcasting.prototype.cast` popup during pure-charges (`X Chg`) casts so spending staff charges never prompts to use a spontaneous spell slot.
  - Added `promptSpontaneousSlotSelection` when pressing `1 Chg + Slot` (`castMode === "spontaneous"`), requiring the user to explicitly select which eligible Rank `X+` spontaneous slot to expend or cancel the entire cast.
- **Staff Rank Group Accordion Collapse (`NaN` Key)** (`scripts/apps/sheet-helpers/spells-handlers.js`):
  - Preserved string rank group keys (`"staff-0"`, `"staff-1"`, etc.) in `onToggleRankGroup` instead of converting them to `NaN` via `parseInt`.
- **Party Sheet Stash Item Descriptions & Section Collapse Headers** (`scripts/apps/sheet-helpers/context-party.js`, `templates/parts/party-overview.hbs`, `templates/parts/party-stash.hbs`):
  - Enriched stash item descriptions unconditionally in `preparePartyContext` so collapsed stash items render `.action-summary` and can be expanded on tap.
  - Wired `isCompetenciesCollapsed`, `stash.isConsumablesCollapsed`, `stash.isEquipmentCollapsed`, and `stash.isGearCollapsed` in `context-party.js` and templates.
- **Casting "Other Item Spells" & Multi-Entry Spell Slot Trackers** (`scripts/apps/sheet-helpers/activations-handlers.js`, `scripts/apps/sheet-helpers/context-spells.js`):
  - Updated `onCastItemSpell` to resolve spells from `actor.spellcasting.get(entryId).spells.get(itemId)` when casting from ephemeral/embedded item spellcasting entries.
  - Kept `rankBuckets[r].slots` and `rankBuckets[r].entryId` paired to the same owner entry (preferring spontaneous entries for manual `+/-` slot tracking) and computed unexpended prepared slot counts.
- **Dialog Promise & Rune Source Consumption Fixes** (`scripts/apps/sheet-helpers/spell-presets-handlers.js`, `scripts/apps/sheet-helpers/party-handlers.js`, `scripts/apps/sheet-helpers/rune-handlers.js`, `scripts/apps/sheet-helpers/actions-handlers.js`):
  - Updated `onSaveSpellPreset` to use `DialogV2.wait(..., { rejectClose: false })` with a `close` handler so dismissing the dialog resolves `null` instead of hanging.
  - Added zero-coin validation (`totalCoins <= 0`) and classic `Dialog` fallback in `onTransferCoins`.
  - Deduplicated `newlyAddedSources` by item ID in `openRuneEditorDialog` before deducting quantity or deleting source items.
  - Wrapped `systemAction.use(useOptions)` in `PhysicalDiceManager.withPhysicalMode` inside `onUseAction`.
- **Negative Modifier Formatting (`+-` Fix) & CSS Brace Validation** (`templates/parts/header.hbs`, `templates/parts/party-overview.hbs`, `styles/pf2e-mobile.css`, `scripts/verify.mjs`):
  - Replaced hardcoded `+{{...mod}}` with conditional `{{#if (gte ...mod 0)}}+{{/if}}{{...mod}}` across header saves/perception/initiative and party overview modifiers.
  - Removed stray unmatched closing brace in `styles/pf2e-mobile.css` and added automated CSS brace balance verification to `scripts/verify.mjs`.

---

## [1.0.23] - 2026-09-25

### Hotfix: Property Rune Slugs & Bottom Navigation Viewport Fix (Issue #7 / PR #8)

#### Fixed
- **Etching a Multi-Word Property Rune Broke the Weapon** (`scripts/apps/sheet-helpers/rune-data.js`, `rune-handlers.js`):
  - Root cause: the rune tables keyed property runes in kebab-case (`greater-flaming`, `ghost-touch`, `acid-resistant`), but PF2e stores and looks them up in camelCase (`greaterFlaming`, `ghostTouch`, `acidResistant`). 84 of the module's 146 slugs did not exist in PF2e's `RUNE_DATA` registry.
  - PF2e's data preparation indexes `RUNE_DATA.<type>.property[slug]` without guarding for unknown keys (`item/weapon/document.ts`, `item/physical/runes.ts`), so an unresolved slug threw `TypeError: Cannot read properties of undefined (reading 'damage')` while building the item's strikes. Only single-word runes (`flaming`, `keen`, `frost`), where both conventions coincide, worked.
  - Regenerated both rune tables from the PF2e system's own registry: correct camelCase slugs, all 80 weapon and 58 armor property runes (previously 96 and 51 entries, 41 of which named runes PF2e does not implement), with English labels and `i18n` keys taken from the system's `en.json`.
- **Automatic Normalization & Migration of Legacy Kebab-Case Rune Slugs** (`scripts/apps/sheet-helpers/rune-data.js`, `rune-handlers.js`, `scripts/pf2e-mobile.js`):
  - Added `normalizePropertyRuneSlug()` and updated `sanitizePropertyRunes()` so legacy kebab-case slugs (`greater-flaming`, `ghost-touch`) and suffix-ordered slugs (`flaming-greater`) are automatically converted to their valid PF2e camelCase equivalents (`greaterFlaming`, `ghostTouch`) rather than being destructively dropped or triggering false rune-unetch inventory duplicates.
  - Added `migrateActorPropertyRunes()` invoked during `ready` and `renderPF2eMobileSheet` to automatically self-heal owned weapons and armor with legacy kebab-case runes from v1.0.17.
- **Full Tier Consistency in `matchPropertyRune()`** (`scripts/apps/sheet-helpers/rune-data.js`):
  - Added `lesser`, `moderate`, and `minor` tier checks alongside `greater`, `major`, and `true`, fixing a bug where `Lesser Dread` (`lesserDread`) was misidentified as `Moderate Dread` (`moderateDread`).
- **Localized Rune Labels & Compendium Lookups** (`scripts/apps/sheet-helpers/context-inventory.js`, `rune-data.js`, `rune-handlers.js`):
  - Added `getPropertyRuneLabel()`, which prefers PF2e's localization key so rune badges and dialog options render in the client's language, falling back to the English name and then to a de-camelized slug.
  - Enhanced `getRuneItemMeta()` and `returnRuneToInventory()` to match both prefix (`greater-flaming-rune`, `Greater Flaming`) and PF2e Remaster parenthetical/suffix conventions (`flaming-greater`, `Flaming (Greater)`), while preserving English fallback search terms on non-English clients and matching existing inventory stacks via `searchTerms` and `matchPropertyRune()`.
- **Bottom Navigation Bar & `Hooks.once("init")` Settings Order Fix** (`scripts/pf2e-mobile.js`, `scripts/apps/mobile-sheet.js`, `styles/pf2e-mobile.css`):
  - Moved `game.settings.register("pf2e-mobile-compact", "mobileActivationMode", ...)` to the very start of `Hooks.once("init")` before `shouldActivateMobile()` is called.
  - Removed a stray CSS syntax error in `styles/pf2e-mobile.css`, changed `.window-content` and `.mobile-sheet-body` to `flex: 1 1 0% !important; min-height: 0 !important; height: auto !important;` so header heights never push `<nav class="mobile-bottom-nav">` outside the container, and clamped windowed sheet height to the viewport in `_onRender`.
- **Regression Guard** (`scripts/verify.mjs`):
  - Added check 4b, failing the build if any property rune slug contains a hyphen. Verified it reports all 68 pre-fix slugs and exits non-zero.

#### Known Limitations (not addressed here)
- Property rune slot count still uses `min(potency, 3)`. PF2e's `getPropertyRuneSlots()` also grants +1 slot for orichalcum and derives potency from character level under Automatic Bonus Progression; potency is `ZeroToFour`, not 0-3.
- Duplicate pruning is exact-match only; PF2e's `prunePropertyRunes` also strips lesser runes when a greater one is present.

---

## [1.0.22] - 2026-09-24

### iPhone / iOS Safari Compatibility — WebKit GPU Memory Protection & Mobile Viewport Fixes (Issue #9)

#### Fixed
- **WebKit WebProcess / GPUProcess Crash & Auto-Reload Loop (`scripts/pf2e-mobile.js`)**:
  - Resolved the critical iOS Safari crash loop (`"A problem repeatedly occurred on this webpage"`) caused by PixiJS allocating 3x Retina WebGL framebuffers (`devicePixelRatio: 3`) and continuously rendering full-resolution scene textures, lighting, and weather effects in the background.
  - Moved `body.pf2e-mobile-active` activation, viewport meta injection (`injectMobileViewportMeta`), and canvas optimization (`optimizeCanvasForMobile`) to execute immediately during `Hooks.once("init")` *before* `game.initializeCanvas()` runs.
  - Clamped `PIXI.settings.RESOLUTION` and `canvas.app.renderer.resolution` to `1` on mobile, stopped `canvas.app.ticker`, disabled `canvas.app.stage.renderable` and `interactiveChildren`, and cleared canvas weather particles (`canvas.weather.clear()`), while preserving `canvas.scene` and `scene.tokens` for headless token geometry (`token-adapter.js`).
  - Added `resumeCanvasFromMobile()` so desktop clients deactivating mobile mode can cleanly restore canvas rendering.
- **Notch / Dynamic Island & Home Indicator Safe-Area Collisions (`scripts/pf2e-mobile.js`, `styles/pf2e-mobile.css`)**:
  - Updated `meta[name="viewport"]` to include `viewport-fit=cover` so `env(safe-area-inset-*)` variables evaluate accurately on iOS devices.
  - Added Apple Web App (PWA) meta tags (`apple-mobile-web-app-capable="yes"`, `apple-mobile-web-app-status-bar-style="black-translucent"`, `apple-mobile-web-app-title="PF2e Mobile"`).
  - Updated `.pf2e-mobile-sheet .mobile-header-dashboard`, `#notifications`, `.mobile-tab-content`, `.mobile-bottom-nav`, and `#pf2e-mobile-fab` to respect `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, `env(safe-area-inset-left)`, and `env(safe-area-inset-right)`.
- **iOS Safari Input Auto-Zoom Prevention (`styles/pf2e-mobile.css`, `scripts/apps/sheet-helpers/sheet-prompts.js`, `scripts/apps/sheet-helpers/rune-handlers.js`)**:
  - Enforced `font-size: 16px !important` on all `<input>`, `<select>`, and `<textarea>` elements inside `.pf2e-mobile-sheet`, `body.pf2e-mobile-active`, and `DialogV2` modals to prevent Safari from auto-zooming the viewport on focus.
- **Elastic Rubber-Band Window Overscroll (`styles/pf2e-mobile.css`)**:
  - Locked `html:has(body.pf2e-mobile-active)` and `body.pf2e-mobile-active` with `position: fixed`, `inset: 0`, `height: 100dvh`, `overflow: hidden`, and `overscroll-behavior: none`, and applied `overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch;` to `.mobile-tab-content`.
- **WebKit Delegated Clicks, Native Select Pickers & Fullscreen Fallback (`styles/pf2e-mobile.css`, `scripts/apps/sheet-helpers/header-handlers.js`, `scripts/apps/sheet-helpers/sheet-prompts.js`, `scripts/apps/sheet-helpers/rune-handlers.js`, `scripts/utils/sheet-utils.js`)**:
  - Added `cursor: pointer !important; touch-action: manipulation; -webkit-tap-highlight-color: transparent;` to all `[data-action]`, `[data-change-action]`, and `.touch-target` elements so iOS WebKit reliably dispatches delegated click events on non-button elements (`<div>`, `<span>`).
  - Added `onclick="event.stopPropagation()"` to `<select>` elements inside `DialogV2` modals in `sheet-prompts.js` and `rune-handlers.js` so native iOS picker wheels open reliably.
  - Added `isIOSDevice()` in `sheet-utils.js` and updated `onToggleFullscreen()` in `header-handlers.js` with a CSS fullscreen fallback and a one-time iOS Home Screen PWA tip.
  - Wrapped `patchMediaElements()` in defensive `try/catch` blocks in `scripts/pf2e-mobile.js`.

---

## [1.0.21] - 2026-09-24

### Staff Preparation Spells Isolation & Morning Dailies Fix

#### Fixed
- **Staff Spells Isolation & Old Spells Cleanup** (`scripts/apps/sheet-helpers/context-activations.js`, `templates/parts/spells.hbs`):
  - Fixed an issue where expanding a newly prepared staff continued to show spells belonging to the previous staff.
  - Rewrote the staff spell resolution order to give strict Priority 1 to morning-prepared spells from `pf2e-dailies` (`dailiesStaffData.spells`), completely preventing stale spells from preexisting spellcasting entries on the actor from overriding the active staff.
  - Filtered fallback spell entries to ensure spells belonging to other staves in inventory are excluded.
- **Accurate Morning-Prepared Staff Binding** (`scripts/apps/sheet-helpers/context-activations.js`, `scripts/apps/sheet-helpers/activations-handlers.js`):
  - Bound staff resolution directly to the morning-prepared staff ID (`preparedStaffId = dailiesStaffData?.staffId ?? actor.getFlag("pf2e-dailies", "extra.dailies.staves")?.staffId`) rather than returning the first staff found in inventory.
  - Passed `data-staff-id` on charge adjustment buttons (`adjustStaffCharges`) and cast buttons (`castStaffSpell`) in `spells.hbs`, ensuring charge tracking and spellcasting target the specific staff prepared in the morning.

#### Improved
- **Stacked Staff Spell Cards Layout** (`templates/parts/spells.hbs`, `styles/pf2e-mobile.css`):
  - Dedicated the top row exclusively to the spell name, action cost glyph, charge badge, and expand chevron so spell titles have full horizontal room on mobile viewports.
  - Kept the quick details row (`Range`, `Target`, `Area/Size`, `Save/Defense`, `Duration`) permanently visible in the second row.
  - Moved the cast/action buttons (`Chat`, `Cast Charges`, `1 Chg + Slot`) into a dedicated full-width button row underneath the spell details.
  - Relocated spell traits/tags (`Cantrip`, `Concentrate`, `Manipulate`, etc.) into the expandable spell description drawer.
- **Compact Normal Spell Card Header & Source Badges** (`templates/parts/spells.hbs`, `styles/pf2e-mobile.css`):
  - Converted spell source badges (`Focus`, `Innate`, `Prepared`, `Spontaneous`) into compact 1-letter badges (`F`, `I`, `P`, `S`) placed in the `.spell-details` row directly underneath the spell name alongside `Range`, `Target`, `Area/Size`, `Save/Defense`, and `Duration`, freeing up maximum horizontal space for the spell name next to the `Cast` button.
  - Moved spell traits (`Cantrip`, `Concentrate`, `Manipulate`, etc.) into the expandable description drawer.
  - Added full untruncated spell name display (both by un-truncating `.action-name` when `.spell-card.expanded` is active and displaying a `.expanded-spell-fullname` banner with the full source name inside the expanded drawer).

---

## [1.0.20] - 2026-09-23

### Party Stash & Party Sheet Integration

#### Added
- **Full Party Sheet Experience on Mobile** (`scripts/apps/sheet-helpers/context-party.js`, `templates/parts/party-overview.hbs`, `templates/parts/party-stash.hbs`, `styles/pf2e-mobile.css`):
  - **Overview Tab**: Displays party-wide competency pills (all known languages across the party with speaker counts, top party modifiers for every core skill, and Recall Knowledge best modifiers), paired with tactical member cards displaying avatar, level/ancestry/class blurb, interactive HP progress bars with percentage indicators, defense badges (AC, Fortitude, Reflex, Will, Perception), senses, top skills, hero points, and 1-tap sheet switching.
  - **Stash Tab**: Complete party inventory dashboard displaying coin totals (PP, GP, SP, CP), total party wealth, total bulk, and categorized items (Consumables, Weapons & Armor, and Other Gear/Treasure) with full item cards, bulk badges, and expandable Remaster descriptions.
- **Touch-Friendly Item & Coin Transfers** (`scripts/apps/sheet-helpers/party-handlers.js`):
  - **Give / Take Transfer Dialog**: Tapping "Give" on any stash item opens a touch dialog (`promptItemTransfer`) to select any party member as recipient, complete with stepper/slider quantity controls and an "All" button for multi-quantity stacks. Transfers are executed via PF2e's native `party.transferItemToActor(target, item, qty)` API.
  - **Direct Consumable Usage**: Consumables in the party stash (e.g. healing potions, scrolls, elixirs) can be used directly from the stash using the "Use" button without needing to transfer them first.
  - **Coin Transfer Dialog**: Added an interactive currency transfer modal (`transferCoins`) enabling players and GMs to withdraw or deposit specific amounts of PP, GP, SP, and CP between party members and the shared stash.
- **Bidirectional Character & Party Integration** (`scripts/apps/sheet-helpers/context-header.js`, `scripts/apps/sheet-helpers/context-inventory.js`, `templates/parts/header.hbs`, `templates/parts/inventory.hbs`):
  - **Header Actor Switcher**: Added the party actor directly into the header dropdown (`👥 [Party Name] (Party)`), allowing players to switch between their character and the party stash with a single tap.
  - **Quick Stash Jump in Gear Tab**: Added a prominent "Party Stash" button to the character inventory header displaying live item count.
  - **Send to Stash Action**: Added a "Send to Stash" button on all physical inventory items on the character sheet, allowing players to deposit gear directly into the party stash.
- **Adaptive Bottom Navigation & Routing** (`scripts/apps/mobile-sheet.js`, `scripts/pf2e-mobile.js`, `templates/mobile-sheet.hbs`):
  - Registered `PF2eMobileSheet` for `party` actors in `ActorsCollection` and routed mobile party sheet requests to `PF2eMobileSheet`.
  - When viewing a party document, the bottom navigation automatically adapts to show **Overview** (`fa-users`), **Stash** (`fa-box-archive`), and persistent **Chat** (`fa-comments` with unread badge), defaulting to the Stash view on open.

---

## [1.0.19] - 2026-09-23

### Skill Rolling Fix & Enhanced Proficiency Badges

#### Fixed
- **Skill Rolling in Skills Tab** (`scripts/apps/sheet-helpers/actions-handlers.js`):
  - Fixed an issue where tapping on skill buttons did not roll them. Replaced the non-existent `sheet.actor.rollSkill(event, skillSlug)` call with PF2e's native `actor.getStatistic(skillSlug).roll(...)` API.
  - Retained full integration with `PhysicalDiceManager.withPhysicalMode` to support physical dice d20 entry on mobile devices alongside digital dice rolls.
  - Automatically forwards targeted tokens from `game.user.targets` so PF2e can calculate degrees of success against target DCs when applicable.

#### Added & Improved
- **Skill Proficiency Badges & Organization** (`scripts/apps/sheet-helpers/context-skills.js`, `templates/parts/skills.hbs`, `styles/pf2e-mobile.css`):
  - Added high-contrast proficiency badges (`U`, `T`, `E`, `M`, `L`) styled with PF2e system colors (`--color-proficiency-*`) displaying the character's training level for each skill.
  - Localized all core skill labels via `game.i18n.localize()` so raw localization keys (e.g. `PF2E.Skill.Acrobatics`) are never displayed.
  - Split skills into "Core Skills" and "Lore Skills" sections when the character possesses Lore skills, sorting each group alphabetically by localized label.
  - Added responsive tactile tap feedback (`:active { transform: scale(0.98); background: #424242; }`) and set `pointer-events: none` on child elements of the skill button to guarantee reliable touch event propagation on iOS WebKit and Android Chromium.

---

## [1.0.18] - 2026-09-23

### Item Spells Separation, PF2e Staff Engine & Dailies Integration

#### Added
- **Dedicated "Activations" Sub-Tab** (`scripts/apps/sheet-helpers/context-activations.js`, `templates/parts/spells.hbs`, `styles/pf2e-mobile.css`):
  - Created a third sub-navigation view in the Spells tab alongside "Spells" and "Preparation", complete with an item counter badge.
  - Excluded all item-based spellcasting entries (`category === "items"` and `category === "charges"`, as well as ephemeral item entries) from the main "Spells" view.
  - Organized item activations into Staves, Wands, Scrolls, and Other Item Spells.
- **Pathfinder 2e Staves Engine & Rules Fidelity** (`scripts/apps/sheet-helpers/context-activations.js`, `scripts/apps/sheet-helpers/activations-handlers.js`, `templates/parts/spells.hbs`, `styles/pf2e-mobile.css`):
  - **Expandable Staff Drawer**: The spells castable from a staff are organized inside an expandable drawer (`.staff-drawer-content`), tucked away until the user expands the staff card.
  - **Persistent Sticky Staff Header**: While the staff drawer is expanded and the user browses through staff spells, the staff header card (showing the staff image, name, held status, spell counter badge, and interactive daily charges tracker with `[-]` and `[+]` adjusters) is pinned with `position: sticky; top: 0`, keeping charges and staff information persistent at the top of the viewport.
  - Multi-tier staff spell resolution engine: retrieves staff spells from `pf2e-dailies` collections, `dailiesStaffData.spells`, `dailiesApi.getSpells(staffItem, maxCharges)`, or autonomous Remaster HTML description parsing (`getSpellsFromStaffDescription`).
  - Cantrips cost 0 charges and cast freely at will.
  - Ranked spells clearly display their charge cost (Rank $N$ costs $N$ charges).
  - **Greyed-Out Buttons & Insufficient Charges Guard**: Cast buttons on staff spells requiring more charges than currently available (or lacking spontaneous slots) are styled with `opacity: 0.55`, `filter: grayscale(100%)`, `#27272a` dark neutral surface, and descriptive tooltips explaining charge requirements (`Not enough charges (requires X)`). Attempted clicks show an informative warning notification.
  - **Strict Charge Requirement & Zero Charges Handling**: Ranked staff spells strictly require charges to be cast. When staff charges are 0, both pure charge casting and 1-charge + slot casting are disabled with clear tooltips (`No staff charges remaining`). Cantrips cost 0 charges and remain freely castable at will.
  - **Exclusion of Staff Entries from Main Spell List**: Enhanced `isItemSpellcastingEntry` to reliably recognize all staff-derived entries (by category, preparation type, ID, flags, and physical inventory matching), completely preventing staff spells from leaking into the main Spells list or polluting character class spell slot pools.
  - **Spontaneous Caster Rule & Remaster Slot Flexibility**: Spontaneous casters holding a staff can cast staff spells by expending 1 staff charge plus an available spontaneous spell slot of the spell's rank or higher (per Remaster rules).
  - Seamlessly integrates with the `pf2e-dailies` API (`getStaffData`, `setStaffChargesValue`, `getStaffItem`), delegating casting directly to `StaffSpellcasting.cast(spell, options)` with autonomous fallback to native PF2e charge tracking flags when the module is not present.
- **Dailies Quick Action Button** (`scripts/apps/sheet-helpers/activations-handlers.js`, `templates/parts/spells.hbs`, `styles/pf2e-mobile.css`):
  - Added a touch-friendly "Dailies" button with a warm amber/sun accent next to "Daily Rest" in the Spells tab toolbar.
  - Invokes `game.dailies.api.openDailiesInterface(actor)` directly from the mobile sheet.
- **Exhausted Spell Slots & Expended Prepared Spells Feedback** (`scripts/apps/sheet-helpers/context-spells.js`, `scripts/apps/sheet-helpers/spells-handlers.js`, `templates/parts/spells.hbs`, `styles/pf2e-mobile.css`):
  - Spontaneous spells automatically grey out their Cast button (`.disabled`, `opacity: 0.55`, `filter: grayscale(100%)`, `#27272a` dark neutral surface) when all spell slots for that rank are exhausted, complete with an informative tooltip (`No Rank X spell slots remaining`).
  - Prepared spells that were used/expended retain an accessible, greyed-out Cast button (`title="Spell slot already expended"`) alongside a dedicated, touch-friendly `[Restore]` icon button (`min-width: 38px`, `height: 38px`).
  - Focus spells with 0 focus points and innate spells with 0 daily uses are similarly disabled and greyed out.
  - Tapping disabled cast buttons triggers a clear, explanatory warning notification instead of failing silently or throwing uncaught system errors.
- **Modular Presets Refactoring** (`scripts/apps/sheet-helpers/spell-presets-handlers.js`, `scripts/apps/sheet-helpers/spells-handlers.js`):
  - Extracted spell preset save, load, and delete workflows into `spell-presets-handlers.js`, keeping `spells-handlers.js` lean (576 lines) and strictly complying with repository modularity rules.

---

## [1.0.17] - 2026-09-22

### Spell Preparation Picker Sizing & Preparation Action Fix

#### Fixed
- **Spell Preparation Dialog Icon Sizing** (`styles/pf2e-mobile.css`):
  - Scoped `.spell-item-img`, `.spell-item-info`, `.spell-item-title-row`, `.spell-item-name`, and `.spell-item-meta` under `.spell-picker-dialog`.
  - Fixed full-size (512×512) unconstrained icon explosion when opening the spell preparation modal from body-level Foundry dialog containers.
  - Added `.spell-picker-dialog .action-cost-glyph` for styling action glyphs inside the dialog.
- **Spell Slot Preparation & Selection Handlers** (`scripts/apps/sheet-helpers/spells-handlers.js`):
  - Registered `confirmPrepareSpell` in `DialogV2`'s `actions` option map and bound live search/click event listeners directly to `dialogInstance.element`.
  - Mapped cantrip rank parameter `rank === 0 ? "cantrips" : rank` to prevent native PF2e `cantrip-mismatch` drop rejections.
  - Pre-populated/padded empty slot arrays with `{ id: null, expended: false }` to prevent native PF2e `TypeError: Cannot read properties of undefined (reading 'expended')` crashes.
  - Fixed `onUnprepareSlot` to safely clear prepared slots using standard PF2e conventions.
  - Replaced deprecated global `renderTemplate` with `foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate`.
- **Handlebars Template Preloading Modernization** (`scripts/pf2e-mobile.js`):
  - Replaced deprecated global `loadTemplates` with `foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates`.
  - Added `spell-picker-dialog.hbs` and `compendium-picker.hbs` to preloaded template part paths.

---

## [1.0.16] - 2026-09-22

### Desktop Mode Compatibility & Complete Desktop Dormancy

#### Fixed
- **Desktop Item Expansion Restored** (`styles/pf2e-mobile.css`):
  - Strictly scoped `.item-summary` and `.action-summary` rules inside `.pf2e-mobile-sheet`.
  - Resolved major bug where global `.item-summary { display: none; }` hid item, strike, spell, feat, and inventory drawers on standard desktop PF2e character sheets (`CharacterSheetPF2e`).
  - Scoped all 337 previously unscoped CSS rules under `.pf2e-mobile-sheet`, `.compendium-picker`, or `.spell-picker-dialog` to eliminate style bleeding into desktop Foundry windows.
  - Adjusted spell preparation preset action buttons (`.btn-save-preset`, `.btn-apply-preset`, `.btn-delete-preset`) to meet standard 38px touch targets.
- **Strict Desktop Dormancy & Dynamic Stylesheet Management** (`scripts/pf2e-mobile.js`):
  - Added `syncStylesheetState()`: automatically disables the module stylesheet (`link.disabled = true`) during desktop sessions, and only enables it if a `PF2eMobileSheet` instance is actively rendered.
  - Guarded monkey patches: `patchUserActiveTokens()`, `setupPhysicalDiceInterceptor()`, and `ActorClass` sheet routing overrides are strictly bypassed on desktop sessions.
  - Guarded event listeners: fullscreen transitions, notification sweeping, and low-resolution dialog hooks now early-exit when desktop mode is active.

---

## [1.0.15] - 2026-09-19

### Collapsible Inventory, Scroll Preservation, Item Investiture & Rune Management

#### Added
- **Collapsible Inventory Sections** (`scripts/apps/sheet-helpers/inventory-handlers.js`, `templates/parts/inventory.hbs`, `styles/pf2e-mobile.css`):
  - Section headers for Consumables, Weapons, Armor & Shields, and Other Gear are now interactive touch toggles with animated chevron indicators.
  - Collapsed states are remembered per session in `_collapsedInventorySections`.
- **Global Scroll Position Preservation** (`scripts/apps/mobile-sheet.js`):
  - Fixed annoying scroll jumping to the top of the sheet upon re-renders in Spells and Gear lists.
  - Automatically captures and restores exact `scrollTop` across renders and tab switches (`_tabScrollPositions`).
- **Item Investiture & Equip/Wear Controls** (`scripts/apps/sheet-helpers/inventory-handlers.js`, `templates/parts/inventory.hbs`):
  - Added dedicated "Invest" button for all investable weapons, armor, shields, and equipment, delegating to PF2e's native `actor.toggleInvested()`.
  - Added 1-tap "Wear/Equip" button for armor (donning/removing inSlot), shields (raising/lowering handsHeld), and wearable gear via `actor.changeCarryType()`.
- **Strict Gear-Only Rune Configuration** (`scripts/apps/sheet-helpers/rune-handlers.js`, `templates/parts/inventory.hbs`, `styles/pf2e-mobile.css`):
  - Added dedicated domain handler `rune-handlers.js` with `scanInventoryRunes()` that strictly inspects the actor's carried gear in memory (`actor.items`) for owned Runestones and standalone rune items.
    - Selections are strictly restricted to runes actually owned in the character's gear (or already etched on the weapon/armor/shield), preventing selection of unowned runes.
    - Added comprehensive official rules list matching (`scripts/apps/sheet-helpers/rune-data.js`) recognizing standalone property runes (e.g., Flaming, Greater Flaming, Ghost Touch, Slick) with usage `etched-onto-a-weapon`, `etched-onto-armor`, or rune traits.
    - Dynamically limits property rune slots based strictly on weapon/armor potency (+1 = 1 slot, +2 = 2 slots, +3 = 3 slots, 0 = 0 slots with clear requirement guidance).
    - Added live `#rune-potency-select` change listener in `DialogV2` to resize property slot lines in real-time while preserving selected runes.
    - Updated weapon and armor rune badges in `context-inventory.js` to format property rune names using official dictionaries instead of raw slugs.
    - Automatically consumes/decrements the source rune item from inventory upon etching.
    - Fixed parenthesis syntax error in `rune-handlers.js` that blocked character sheet ES module evaluation.
    - Hardened all section context builders in `mobile-sheet.js` (`prepareHeaderContext`, `prepareActionsContext`, `prepareSpellsContext`, `prepareSkillsContext`) with defensive try/catch fallbacks to guarantee resilient sheet rendering.
    - Fixed syntax error in `sheet-prompts.js` export that prevented the character sheet module from loading.
    - Hardened `prepareInventoryContext` and trait inspection against invalid trait collections or uninitialized system properties.
- **Compendium Search On-Enter / Search Button** (`scripts/apps/compendium-picker.js`, `templates/compendium-picker.hbs`, `styles/pf2e-mobile.css`):
  - Removed aggressive per-keystroke re-rendering in the Compendium Browser that interrupted typing and closed mobile soft keyboards.
  - Search now triggers strictly when the user presses **Enter** on their keyboard or taps the dedicated **Search** button.
  - Handled native search clear ('x') and removed disruptive `autofocus`.
- **Actions Display & Defensive Action Context** (`scripts/apps/sheet-helpers/context-actions.js`, `scripts/apps/mobile-sheet.js`):
  - Fixed actions tab failing to render attacks and character actions by hardening `prepareActionsContext` with safe initial defaults and per-item error isolation.
  - Corrected context fallback keys in `mobile-sheet.js` (`strikes` and `characterActions`).
  - Upgraded effect inspection to check `_stats.compendiumSource` and `flags.core.sourceId` avoiding deprecated/removed property crashes in Foundry v14.
- **Card Expansion Across Actions, Spells & Inventory** (`scripts/apps/sheet-helpers/actions-handlers.js`, `scripts/apps/sheet-helpers/context-inventory.js`, `templates/parts/inventory.hbs`, `styles/pf2e-mobile.css`):
  - Resolved summary drawer toggle in `onToggleActionSummary` by synchronizing `.expanded`, `.open`, `.collapsed`, parent card `.expanded`, and chevron rotation.
  - Added expandable description drawers to weapons, armor, consumables, and gear in the inventory tab with HTML enrichment.
- **Desktop / Non-Mobile Physical Roll Interception Bypass** (`scripts/rolls/physical-dice-interceptor.js`, `scripts/utils/sheet-utils.js`, `scripts/pf2e-mobile.js`):
  - Guarded `PhysicalDiceManager.isPhysicalModeActive()`, `shouldIntercept()`, and `withPhysicalMode()` with `!isMobileDevice()`. Rolls from non-mobile clients are never intercepted for physical table dice.
  - Added session cache cleanup in `Hooks.once("ready")` to clear cached `rollMode` on login.
- **Rune Return to Inventory on Removal** (`scripts/apps/sheet-helpers/rune-handlers.js`, `scripts/apps/sheet-helpers/rune-data.js`):
  - When removing fundamental runes (Potency, Striking, Resilient, Reinforcing) or property runes (e.g., Flaming, Ghost Touch) from a weapon, armor, or shield, the removed runes are automatically returned to the character sheet's inventory.
  - If the actor already possesses that rune item in their gear, its quantity is automatically incremented.
  - If not already owned, fetches the official Paizo item document from `pf2e.equipment-srd` or generates a native PF2e equipment rune document with proper usage and traits.
  - Automatically handles property runes trimmed when decreasing potency rank (e.g. going from +2 to +1 returns the second property rune to inventory).
  - Posts a clear Foundry notification detailing which runes were returned to inventory.

---

## [1.0.14] - 2026-09-19

### Gear Section Overhaul: Physical Filtering, Ally Administration & Weapon Poisoning

#### Fixed
- **Strict Physical Item Filtering in Inventory** (`scripts/apps/sheet-helpers/context-inventory.js`):
  - Replaced naive negative exclusion list with PF2e's official `item.isOfType("physical")` predicate and `PHYSICAL_ITEM_TYPES` positive set check.
  - Eliminated bug where non-physical items (`action`, `ancestry`, `background`, `class`, `condition`, `affliction`, `deity`, `heritage`, `lore`, `melee`, `spellcastingEntry`, `campaignFeature`) appeared inside the "Other Gear" section.

#### Added
- **Consumable Administration to Comrades** (`scripts/apps/sheet-helpers/inventory-handlers.js`, `scripts/apps/sheet-helpers/sheet-prompts.js`):
  - Tapping "Use" on drinkable/administerable consumables (potions, elixirs, drugs) opens a mobile prompt with options to drink on self or administer to an ally token on the active scene.
  - Synchronizes user target to the designated comrade token and triggers native PF2e `item.consume()`, allowing 1-click healing/damage card application directly to the friend.
  - Posts Paizo-styled chat card: `[Actor] administers [Item] to [Comrade] (1 Action - Interact)`.
- **Weapon Poisoning & Subitem Attachments** (`scripts/apps/sheet-helpers/inventory-handlers.js`, `templates/parts/inventory.hbs`, `styles/pf2e-mobile.css`):
  - Added "Apply" button on poisons and oils in the Consumables list.
  - Integrates with PF2e's native subitem attachment engine: `weapon.attach(poisonItem, { quantity: 1 })`.
  - Weapons with applied poisons display an interactive green badge (`Poisoned: [Poison Name]`) and a "Clean" button executing `subitem.detach()`.
- **Modular Inventory Domain Architecture** (`scripts/apps/sheet-helpers/inventory-handlers.js`):
  - Extracted inventory actions (`onUseConsumable`, `onApplyPoison`, `onDetachSubitem`, `onChangeCarryType`) into a dedicated domain handler, keeping `mobile-sheet.js` under 700 lines per repo rules.
- **Carry Type Quick Toggle** (`templates/parts/inventory.hbs`, `scripts/apps/sheet-helpers/inventory-handlers.js`):
  - Interactive carry badge on weapons allowing 1-tap toggling between Held (1H / 2H) and Worn states via `actor.changeCarryType()`.

---

## [1.0.13] - 2026-09-19

### Polish & Cache Busting (Issue #5)

#### Fixed
- **Stylesheet Cache Synchronization** (`scripts/pf2e-mobile.js`):
  - Added proactive `link[href*="pf2e-mobile.css"]` version synchronization on module `init` to prevent mobile browsers from locking onto stale cached CSS.
- **Harmonized HP Row Pill Design** (`styles/pf2e-mobile.css`):
  - Removed nested inner input box borders and backgrounds in the HP and Temp HP groups.
  - Implemented seamless matching 38px pill cards with borderless, dashed-underline editable numbers and balanced proportions across the row.

---

## [1.0.12] - 2026-09-19

### Compact Header & Defense/Saves Integration (Issue #5)

#### Added
- **Streamlined 3-Row Header Layout** (`templates/parts/header.hbs`, `styles/pf2e-mobile.css`):
  - **Row 1 (Toolbar)**: Character Switcher / Name, scene token Target dropdown, Digital vs. Physical Roll Mode dropdown, and Fullscreen toggle button.
  - **Row 2 (Consolidated HP Row)**:
    - Left quick-delta input box (`±Amt`): Allows typing signed (`-5`, `+5`) or unsigned amounts and pressing Enter to apply damage or healing directly via PF2e's native damage engine (`applyDamage`), preserving temp HP absorption order.
    - Direct Current HP edit (`HP [ val ] / max`): Allows typing absolute numbers to set HP, or signed numbers (`+/-`) to adjust.
    - Direct Temp HP edit (`TEMP [ val ]`): Allows typing absolute values or signed deltas (`+/-`).
    - Shield status badge (`🛡️ value/max`) conditionally displayed when a shield is raised or equipped.
  - **Row 3 (Defenses & Saves Pill Strip)**:
    - Integrated `AC` badge.
    - Touch-friendly Fortitude (`Fort`), Reflex (`Ref`), and Will (`Will`) saving throw roll buttons.
    - Dropdown selector combining Perception checks (`👁️ +mod`) and Initiative rolls (`⚔️ Init`), featuring active combat pulsing animations (`combat-active` and `combat-rolled`).
- **Domain Handlers Extraction** (`scripts/apps/sheet-helpers/header-handlers.js`, `scripts/apps/sheet-helpers/chat-handler.js`):
  - Extracted header action handlers (`applyDeltaHP`, `setDirectHP`, `setDirectTempHP`, `rollPerceptionOrInitiative`, `rollSave`, `rollPerception`, `rollInitiative`, `selectTarget`, `toggleRollMode`, `toggleFullscreen`, `switchActor`) into `header-handlers.js`.
  - Extracted chat tab DOM docking, scroll-to-bottom handling, and mutation observers into `chat-handler.js`.
  - Reduced `scripts/apps/mobile-sheet.js` to 673 lines (<700 lines target).

---

## [1.0.11] - 2026-09-19

### Milestone 10: Code Quality, Battery Optimization & Physical Dice Edge Cases (Issue #1)

#### Fixed
- **Pruned Global Monkey-Patching & Scoped Media Elements** (`scripts/pf2e-mobile.js`):
  - Scoped `patchMediaElements()` to only execute on mobile environments (`shouldActivateMobile()`), preventing desktop clients from undergoing unnecessary `HTMLMediaElement` and `window.Audio` prototype mutations.
  - Eliminated brute-force iteration over `GameClass.prototype` and `game` properties.
  - Removed broad `console.error` and `console.warn` interceptors that could hide legitimate development and runtime errors.
  - Targeted resolution suppression directly at Foundry v14's `ClientIssues` (`_detectUsabilityIssues`) and `ui.notifications.error` specifically for `ERROR.RESOLUTION` and `reqWidth` parameters.
- **Physical Dice Edge Cases: Fortune / Misfortune & Dynamic Face Validation** (`scripts/apps/physical-dice-dialog.js`, `scripts/rolls/physical-dice-interceptor.js`, `templates/physical-dice-dialog.hbs`):
  - Fixed issue where `partitionTotal` was splitting a check roll value across dice for fortune (`2d20kh`) and misfortune (`2d20kl`), breaking keep-highest / keep-lowest semantics.
  - Added contextual instructions guiding the user to enter the higher result for Fortune rolls or the lower result for Misfortune rolls.
  - Assigned the entered roll result to all dice in the term so native Foundry `_evaluateModifiers()` keep/drop evaluation preserves the user's selected outcome without partition distortion.
  - Made die face validation dynamic (`1` to `faces`) rather than hardcoding `1-20`.
- **Battery Optimization & Polling Removal** (`scripts/pf2e-mobile.js`):
  - Removed fake 25-second socket status heartbeat (`socket.emit("status")`).
  - Replaced the 1-second `setInterval` DOM poller for the floating action button (FAB) with reactive ApplicationV2 lifecycle hooks (`renderPF2eMobileSheet`, `closePF2eMobileSheet`) and initial/resize state updates.
- **Foundry Manifest Compatibility** (`module.json`):
  - Updated `compatibility.minimum` to `"14"` in `module.json` to reflect Foundry v14 requirement.
- **Modular Architecture Refactoring (Issue #1, Item #5)** (`scripts/apps/mobile-sheet.js`):
  - Extracted headless token adapter geometry, distance calculations, and targeting synchronization into [`scripts/tokens/token-adapter.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/tokens/token-adapter.js).
  - Extracted reusable helper utilities (`clamp`, `getGlyph`) into [`scripts/utils/sheet-utils.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/utils/sheet-utils.js).
  - Modularized context builders into domain helpers under `scripts/apps/sheet-helpers/` (`context-header.js`, `context-actions.js`, `context-spells.js`, `context-skills.js`, `context-inventory.js`).
  - Modularized interactive modal prompts (target, variant, statistic, strike selection) into [`scripts/apps/sheet-helpers/sheet-prompts.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/sheet-helpers/sheet-prompts.js).
  - Modularized domain action handlers (strikes, damage, critical, aux action, item chat, use action, check rolls, skill rolls, consumable consumption) into [`scripts/apps/sheet-helpers/actions-handlers.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/sheet-helpers/actions-handlers.js).
  - Modularized spell management handlers (casting, prep picker, slot toggles/adjustments, daily rest, presets, signature spells, spell removal) into [`scripts/apps/sheet-helpers/spells-handlers.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/sheet-helpers/spells-handlers.js).
  - Streamlined [`scripts/apps/mobile-sheet.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/mobile-sheet.js) from 3,370 lines down to ~698 lines (~80% line reduction) while retaining 100% template compatibility, registered ApplicationV2 action delegation, and backward-compatible function re-exports.


### Milestone 9: Layout Architecture Restoration, CSS Refactoring & Spell Slot Expenditure Fix

#### Fixed
- **Spell Casting Expended Slots Twice** (`_onCastSpell` in `scripts/apps/mobile-sheet.js`):
  - Root cause: `entry.cast()` was called with `{ slot, level }`, which are not part of PF2e's `CastOptions` (`{ rank, slotId, consume, message, rollMode }`). PF2e ignored them, defaulted `consume: true`, and expended the slot itself; the module then expended it a second time manually.
  - Spontaneous casters lost two slots per cast; prepared casters with the same spell in multiple slots could have both copies expended; the tapped rank was ignored so heightened casts went out at the spell's base rank.
  - Fix: pass `{ rank, slotId }` to `entry.cast()` and let PF2e handle all slot, focus point, and innate-use consumption natively. Removed the manual prepared/spontaneous slot decrement block.
- **Mobile Sheet Layout & Viewport Scroll Restoration**: Fixed issue where the entire page scrolled and pushed the bottom navigation bar off-screen. Removed detached fixed positioning on the sheet body and configured explicit ApplicationV2 flex child sizing (`flex: 0 0 auto` top dashboard header, `flex: 1 1 0%` sheet body, scrollable `mobile-tab-content`, and permanently pinned `mobile-bottom-nav`).
- **Eliminated 87% of `!important` Declarations**: Systematically refactored `styles/pf2e-mobile.css` (reducing from 520+ occurrences down to 65). Scoped button and component classes naturally to override base sheet rules without specificity hacks.
- **Removed Local Foundry Sync Artifacts**: Completely deleted local sync scripts and documentation per workflow requirements.
- **Universal Daily Rest Button & Confirmation Prompt** (`templates/parts/spells.hbs`, `scripts/apps/mobile-sheet.js`):
  - Made the "Daily Rest" button permanently visible on the Spells action bar for all casters (not just prepared entries).
  - Added a touch-friendly confirmation dialog (`DialogV2.confirm`) to prevent accidental resets on mobile screens.
  - Linked daily rest to PF2e's native `restForTheNight` action while guaranteeing all spell slots and focus points are fully restored.
- **Spell Slot Adjustment (+/-) Event Delegation** (`templates/parts/spells.hbs`, `scripts/apps/mobile-sheet.js`):
  - Removed inline `onclick="event.stopPropagation()"` on `.slot-counter` that was suppressing click events before reaching ApplicationV2's delegated action listeners.
  - Added a target check in `_onToggleRankGroup` to ignore clicks originating from `.slot-counter`, and added an immediate sheet re-render in `_onAdjustSlot`.
- **Foundry v14 Global `Game` Deprecation Fix** (`scripts/pf2e-mobile.js`):
  - Replaced bare `Game.prototype` access with `foundry.Game?.prototype ?? globalThis.Game?.prototype`, eliminating the Foundry v14 compatibility deprecation warning.
- **Chat Damage Scoping to Active Mobile Sheet** (`scripts/pf2e-mobile.js`, `scripts/apps/mobile-sheet.js`):
  - Updated `patchUserActiveTokens()` so `game.user.getActiveTokens()` prioritizes the open `PF2eMobileSheet` actor, ensuring chat card damage buttons strictly apply to the viewed character rather than all owned/controlled tokens on canvas.
  - Updated `_ensureTokenControlled()` to release all other tokens cleanly when controlling the active character.

---

## [1.0.10] - 2026-09-18

### Hotfix: Sheet Getter Reference Resolution

#### Fixed
- **Actor Sheet Getter ReferenceError**: Fixed `ReferenceError: origSheetGetter is not defined` when resolving `actor.sheet` property on mobile and desktop clients by correctly defining `origSheetGetter` from the prototype chain descriptor.

---

## [1.0.9] - 2026-09-14

### Milestone 8: Spells Tab Modernization, Expandable Cards & Tap-to-Prepare Overhaul

#### Added
- **Unified Cast View Grouped by Rank**:
  - Automatically aggregates spells across all spellcasting sources (Spontaneous, Prepared, Focus, Innate) by spell rank (Cantrips, Rank 1 to 10).
  - Prominent source badges (`Focus`, `Innate`, `Prepared`, `Spontaneous`) identify how each spell is cast.
  - Collapsible rank accordions with stop-propagation slot adjustment buttons (`-` / `+`) permit quick folding/unfolding of rank sections without screen clutter.
- **Expandable Spell Cards & Enriched Descriptions**:
  - Tap-to-expand details drawer revealing enriched HTML descriptions with formatting, links, and inline roll styling (`TextEditor.enrichHTML`).
  - Action glyphs (1, 2, 3 actions, Reaction, Free action), traits tags, range, area, target, duration, and defense save badges.
- **Mobile-First Tap-to-Prepare Slot Workflow**:
  - Clean `Preparation` sub-tab for characters with prepared spellcasting entries.
  - Displays slot rows as empty dashed slots or filled spell slots with slot numbers.
  - Tap "Prepare Spell" or "Change Spell" to open a touch-friendly picker modal with real-time name filtering over the repertoire.
  - One-tap "Unprepare" (`btn-unprepare-slot`) to clear slots without drag-and-drop.
- **Spell Loadout Presets**:
  - Added "Save Current" button in the Preparation sub-tab to capture prepared spell slot configurations.
  - Presets are saved with custom names and can be loaded or deleted with a single tap.
- **Daily Prep Reset**:
  - Added a "Daily Rest" button (`btn-daily-reset`) that instantly unmarks expended states across all prepared slots.
- **Target Resolution for Attack Spells**:
  - Casting attack spells or spells with target specifications automatically invokes `#resolveTargetForAction` to ensure targets are designated on the canvas before rolling.

---

## [1.0.8] - 2026-09-14

### Milestone 7: Chat Auto-Scroll & Floating Latest Jump Button

#### Added
- **Floating "Latest" Jump Button**:
  - Added a touch-friendly 40px floating pill button (`.btn-scroll-bottom`) positioned in the bottom-right of the Chat tab.
  - Automatically fades in when scrolling away from the bottom (> 80px) and smoothly disappears when reading the latest messages.
  - Tapping the button or tapping the "Chat" bottom navigation icon while already on the Chat tab instantly jumps down to the newest rolls.

#### Fixed
- **Foundry v14 Chat Scroll Hierarchy Conflict**:
  - Resolved issue where switching to the Chat tab required manual scrolling to view recent rolls.
  - Corrected nested scroll container conflict where `#disableChatInputs` forced `height: 100%` and `overflow-y: auto` onto `#chat-log` inside `.chat-scroll`.
  - Configured `.chat-scroll` as the dedicated scroll container and restored natural height expansion to `#chat-log`.
  - Implemented resilient multi-frame auto-scrolling on tab switch, sheet render, and new chat message arrival.

---

## [1.0.7] - 2026-09-13

### Physical Damage Dice Roll Resolution & Native PF2e Evaluation Fix

#### Fixed
- **Physical Damage Dice Detection**: Fixed an issue where damage rolls in Physical mode rolled digital dice instead of prompting for manual table dice entry.
  - Root cause: In PF2e (`DamageRoll` / `DamageInstance`), `terms` contains AST expressions (such as `Grouping` or `ArithmeticExpression`) rather than direct `Die` terms. The interceptor checked `inst.terms` for `t.faces`, which returned `false` and bypassed the prompt.
  - Fix: Updated `extractDiceFromInstance` to inspect `inst.dice` (the official PF2e dice getter) and recursively traverse AST nodes, properly detecting all unevaluated dice.
- **Pure Native PF2e Evaluation ("No Custom Calculations")**:
  - Eliminated all manual calculation of damage totals (`roll._total`).
  - The interceptor now populates physical dice outcomes directly into `term.results` and delegates entirely to Foundry and PF2e's native `evaluate()` with `allowInteractive: false`.
  - PF2e natively evaluates all modifiers, critical hit rules (`double-damage` / `double-dice`), weaknesses, resistances, and canvas target AC/defenses, rendering the authentic PF2e damage card with native damage application buttons (`Apply Damage`, `Half Damage`, `Double Damage`, `Shield Block`, `Apply Healing`).
- **Chat Card Damage Button Interception**:
  - Enabled physical dice interception for damage buttons clicked directly on chat cards (not just from the mobile sheet) by checking active client settings and `localStorage.getItem("pf2e-mobile-compact.rollMode")`.
- **Nested Instance Double-Evaluation Guard**:
  - Added `_isPhysicalIntercepted` flag across rolls and instances to ensure child terms don't re-prompt during AST evaluation.

---

## [1.0.6] - 2026-09-13

### Milestone 6: Hybrid Physical Dice Entry & Mobile Dropdown Selection Fix

#### Added
- **Native PF2e Physical Dice Entry Engine (`PhysicalDiceManager`)**:
  - Implemented roll interception hooking Foundry's `Roll.prototype.evaluate` and PF2e's `CheckRoll` and `DamageRoll` when in Physical Roll mode.
  - Intercepts raw dice terms and allows players to input outcomes from their real physical table dice while delegating modifier calculations, degree of success, and chat cards entirely to the native PF2e system.
  - **d20 Check Entry**: Prompt displays action name, modifier, and target token name (if targeted). Players type the d20 result (1-20) into a focused numeric field. Supports keyboard Enter and touch keyboards. Natural 20s and Natural 1s automatically trigger PF2e's degree of success upgrade/downgrade rules!
  - **Multi-Type Grouped Damage Entry**: Automatically groups weapon and spell damage pools into distinct rows by damage type (e.g. 6d8 Slashing, 1d6 Fire, 1d4 Persistent Bleed).
  - Prompts players with the exact physical dice to roll on the table and allows them to enter the total sum for all dice in that group.
  - Flat numeric modifiers are displayed as added automatically by the system and are factored in by PF2e.
  - Partitions entered sums across dice results (`partitionTotal`), ensuring all dice terms are marked evaluated with valid die faces without triggering random rolls.
  - Renders complete official PF2e Check and Damage Chat Cards with all damage types intact, enabling the GM and players to click the native damage buttons (`Apply Damage`, `Half Damage`, `Double Damage`, `Shield Block`, `Apply Healing`) with full resistance, weakness, and immunity calculations.
  - Safe cancellation: Closing or cancelling the physical dialog gracefully aborts the roll without generating broken or empty chat cards.
- **Persistent Roll Mode**:
  - Roll mode choice (`Digital` vs `Physical`) is persisted across sheet reopens and browser reloads via `localStorage` (`pf2e-mobile-compact.rollMode`) and client setting (`game.settings.get/set("pf2e-mobile-compact", "rollMode")`), so table players don't have to re-select it every time they reload their phone.

#### Fixed
- **Mobile Dropdown Selection in Header**:
  - Resolved mobile bug where tapping the Roll Mode dropdown (`Digital` / `Physical`) on touchscreens did not open the picker.
  - Root cause: Foundry ApplicationV2 binds a delegated `click` handler to all elements with `data-action` that calls `event.preventDefault()`, which suppresses the native OS select picker on iOS WebKit and Android Chromium and re-renders the header prematurely.
  - Solution: Replaced `data-action` on select elements with `data-change-action`, stopped click event bubbling on selects so ApplicationV2 never intercepts them, and bound delegated `change` listeners that cleanly trigger `#onToggleRollMode`, `#onSelectTarget`, and `#onSwitchActor` when an option is selected.

---

## [1.0.3] - 2026-09-13

### Milestone 3.5: Chat Tab Integration & Native PF2e Damage Application

#### Added
- **Dedicated Chat Tab in Mobile Sheet**:
  - Expanded the bottom navigation bar to 5 items: **Actions**, **Spells**, **Gear**, **Skills**, and **Chat**.
  - Docked Foundry's live `ui.chat.element` directly inside the mobile sheet's persistent chat container.
  - Streaming updates: new chat messages, attack rolls, and damage cards post and scroll into view seamlessly without losing context or scroll position.
  - Unread badge indicator on the bottom nav Chat button that tracks new messages when the user is viewing other tabs.
  - Full chat sending interface with textarea and roll mode selector optimized for mobile keyboards and touch devices.
- **Native PF2e Damage Application directly from Mobile Chat**:
  - Tapping **Apply Damage** (1x), **Half Damage**, **Double Damage**, **Triple Damage**, **Apply Healing**, or **Shield Block** on damage cards in the chat directly applies damage using PF2e's native rules engine (accounting for IWR, temporary HP, shield hardness, and damage undo/revert).
  - Automatically asserts token selection for the mobile sheet's character upon sheet open and immediately prior to damage button execution.
  - Patched `User.prototype.getActiveTokens` with a fail-safe fallback to the active mobile sheet character's token document if no token is explicitly controlled on the canvas, eliminating the `"No token selected to take damage"` error on mobile devices.
  - Touch-optimized styling for `.damage-application` buttons with prominent touch targets (min 38px height) and distinct color coding.

### Added
- **Expandable Action & Feat Descriptions**: Every action card across all sub-tabs can now be tapped (on the title or chevron) to smoothly expand an inline summary showing the full description, triggers, requirements, and enriched Foundry links. The expanded state is persisted across re-renders and tab navigation.
- **Action Variant & Skill Selection Modals**: Actions with multiple variants (such as *Administer First Aid* -> *Stabilize* vs *Stop Bleeding*, or *Perform*, *Create a Diversion*) and actions with multiple skill choices (like *Recall Knowledge*) now prompt the user with a touch-friendly selection modal before rolling, resolving the "no variant was requested" error.
- **Weapon Strike Selection for Attack Feats**: Attack feats (like *Combat Grab*, *Power Attack*, etc.) prompt the user to choose which weapon/strike to use when multiple strikes are available on the actor.

### Fixed
- **Sheet Render ReferenceError**: Fixed `ReferenceError: actionSlug is not defined` in `PF2eMobileSheet._prepareContext` when processing character action data for the attack and roll buttons.
- **Action Execution Error Handling**: Wrapped system action and roll executions in try/catch blocks with friendly user notifications to prevent uncaught promise errors.
- **Foundry v14 Namespaced Collections**: Updated sheet registration to use `foundry.documents.collections.Actors` and `getDocumentClass("Actor")`, resolving the deprecation warning regarding global `Actors` access.
- **Skill Label Resolution TypeError**: Fixed `TypeError: key.split is not a function` when displaying the skill selection modal for actions with multiple statistics (such as *Recall Knowledge*).
- **Full-Screen Viewport Coverage & Responsive Layout**:
  - Replaced legacy ApplicationV1 `.app.window-app.pf2e-mobile-sheet` selector with proper ApplicationV2 selectors (`.pf2e-mobile-sheet`, `body.pf2e-mobile-active .pf2e-mobile-sheet`, `.pf2e-mobile-sheet.fullscreen-mode`, and `:fullscreen`), enabling the mobile sheet to properly occupy the entire screen (`100vw` x `100dvh`) without being clamped to 420x750px.
  - Ensured sheet seamlessly expands across the entire viewport when the page is expanded, rotated, or resized.
  - Updated `#onToggleFullscreen` with WebKit prefix fallbacks and CSS fallback classes (`.fullscreen-mode`, `body.pf2e-fullscreen`), ensuring full-screen mode functions on iOS Safari and desktop browsers alike.
  - Re-anchored `.mobile-bottom-nav` using sticky positioning and iOS safe-area insets (`env(safe-area-inset-bottom)`), eliminating navigation detachment in windowed or responsive modes.
  - Added bottom drawer modal layout for the compendium picker on mobile viewports.
  - Added modern iPad / iPadOS touch detection (`MacIntel` with touch points > 1) and dynamic resize listeners.
- **Low-Resolution & Window Dimensions Warning Suppression**: Suppressed Foundry's redundant core warnings regarding minimum display resolutions (e.g. 1024x700 / 1024x768) on mobile devices across `Game.prototype`, `Notifications.prototype`, and `ui.notifications`, preventing low-resolution warning spam when connecting from phone viewports while styling `#notifications` for clean mobile toasts.

### Milestone 3: Actions Page Refactoring & PF2e Targeting/Flanking Engine

#### Added
- **Complete Character Actions Organization**:
  - Implemented **Action Sub-Tabs** under the Actions tab: **Encounter** (default), **Exploration**, and **Downtime**, keeping exploration and downtime activities from cluttering combat.
  - Strict Encounter Actions hierarchy matching PF2e conventions:
    1. **Attacks** (Strikes with MAP variants, Damage, and Crit buttons)
    2. **Actions** (from class/ancestry feats and activities)
    3. **Reactions**
    4. **Free Actions**
    5. **Skill Actions** (comprehensive detection of skill-based actions via PF2e skill slugs and skill feat categories, placed cleanly at the bottom)
  - Dedicated **Exploration Activities** and **Downtime Activities** sub-tabs.
  - Added action cost glyphs (`1`, `2`, `3`, `⬢` Reaction, `◇` Free Action), trait badges, and frequency trackers (`Uses: X / Y`).
  - Added direct **Send to Chat** (`data-action="itemToChat"`) and **Use Action** (`data-action="useAction"`) buttons on every character action.
- **Feat Action Execution & Self-Effect Toggling**:
  - Tapping "Use" on actions with an embedded `selfEffect` (e.g. *Dueling Parry*, *Raise a Shield*, Marshall stances) directly applies the effect to the character (self only) with origin and target set to the user actor, ensuring that any currently targeted enemy token is never affected by self-inflicted actions.
  - Tapping "Active" cleanly toggles the effect off and removes it from the character.
  - Button dynamically updates to a distinct green **Active** badge (`.btn-action-use.active`) when the effect is currently active on the actor, and re-renders the sheet immediately.
  - Removed unwanted "Use" buttons from generic skill actions (Administer First Aid, Balance, Demoralize, Trip, Grapple, etc.), showing only the chat icon like the standard PF2e character sheet unless the action has a self-effect, frequency, or crafting.
  - Actions that target an enemy (e.g. offensive checks or attack actions) resolve and apply against the selected target token.
- **Attack & Roll/Check Action Execution Buttons**:
  - Added dedicated **`[⚔️ Attack]`** button (`.btn-action-attack`) for combat feats and activities containing the `attack` trait.
  - Added dedicated **`[🎲 Roll]`** button (`.btn-action-roll`) for actions that require a skill check or rolled dice (such as *Trip*, *Demoralize*, *Battle Medicine*, *Administer First Aid*, *Feint*, *Grapple*, *Disarm*, *Bon Mot*, etc.).
  - Clicking these buttons automatically checks the active target token in the mobile header (or prompts for one if none is selected), executing the check via PF2e's native degree-of-success engine (`systemAction.use` or `statistic.roll`).
- **Strike Enhancements**:
  - Prominent **MAP Attacks at the Top**: Moved the 3 Multiple Attack Penalty variant buttons (`+X`, `+Y`, `+Z`) into a dedicated primary attack row at the top of each strike card.
  - Added **Weapon Artwork / Image Thumbnail**: Displays weapon icon (`strike.img`) alongside strike name and traits.
  - Added **Weapon Auxiliary Actions Bar**: Provides native weapon actions directly on the card:
    - 🗡️ **Draw** / **Sheathe**
    - ⬇️ **Drop**
    - 🔄 **Reload** (with ammunition action cost)
    - ✋ **Change Grip** (1H / 2H)
    - ⚔️ **Versatile** / **Modular** switches
  - Dedicated **Critical Damage** button (`⚡ Crit` via `data-action="executeCritical"`) alongside standard Damage (`💥 Damage`).
- **Dedicated Skills View**:
  - Separated general skills from the Actions tab into a dedicated bottom navigation tab (`templates/parts/skills.hbs`).
- **Accurate PF2e Flanking, Off-Guard & Range Increment Calculations**:
  - Transitioned from canvas bypass to **Background Canvas Architecture**: Foundry's standard `Canvas.prototype.draw` runs normally in the background while keeping `#board` and `#board-container` visually hidden behind the full-bleed mobile sheet (`z-index: 100`, `100dvh`).
  - Real `Token` placeables on `canvas.tokens.placeables` remain fully initialized with PixiJS geometry, bounds, walls, and lighting.
  - Enabled native PF2e system rules (`isFlanking`, raycasting, off-guard condition, cover, and range increments) to calculate out-of-the-box identically to desktop PF2e.
  - Eliminated `Message has no token` errors and `TypeError: this.token.addChild is not a function` from modules such as `pf2e-flatcheck-helper`.
  - Capped mobile canvas ticker frame rate at 30 FPS (`maxFPS = 30`) to conserve battery while keeping animations and coordinate updates responsive.
- **Full-Screen Mobile App Mode**:
  - Added dedicated Fullscreen toggle button (`.btn-fullscreen`) in the mobile header control row.
  - Implemented `PF2eMobileSheet.#onToggleFullscreen` using standard Web Fullscreen API (`document.documentElement.requestFullscreen()` / `document.exitFullscreen()`).
  - Added dynamic icon synchronization (`fa-expand` / `fa-compress`) responding to `fullscreenchange` events.
- **Session Keep-Alive & Phone Sleep Prevention**:
  - Integrated Screen Wake Lock API (`navigator.wakeLock.request('screen')`) to prevent mobile phones from auto-dimming or sleeping during play.
  - Added `visibilitychange` lifecycle listener to immediately re-acquire wake lock and reconnect `game.socket` upon phone unlock or returning to the foreground, preventing disconnection or session logouts.
  - Added periodic 25s keep-alive heartbeat to protect against mobile carrier / proxy WebSocket idle timeouts.

#### Fixed
- **Flanking and Token Placeables Incompatibility**:
  - Resolved regression where PF2e's native `CheckContext` could not find token placeables on headless canvas, which caused flanking checks and off-guard bonuses to fail and broke chat message token lookups.
  - Replaced canvas bypass with background-rendered placeables layered underneath the opaque mobile sheet UI.
- **Targeting System Synchronization**:
  - Streamlined `setTargetToken(tokenId)` to invoke native `Token.prototype.setTarget` on live placeables with `releaseOthers: true`, ensuring single-target selection, socket reticule broadcasting, and third-party module compatibility.
  - Ensured `setTargetToken(targetToken.id)` is called prior to strike, damage, and critical rolls so `game.user.targets` is synchronized for PF2e rule evaluation.

### Milestone 2: Native Targeting Synchronization & Header Target System

#### Added
- **Bidirectional Desktop & Mobile Target Sync**:
  - Implemented `setTargetToken(tokenId)` utilizing Foundry VTT's native `user.broadcastActivity({ targets: string[], sceneId: string }, { volatile: false })` socket protocol. Targeting a token on the mobile compact sheet immediately displays the user's targeting reticule across all connected desktop clients, GM screens, and TV map displays.
  - Registered real-time `Hooks.on("targetToken", (user) => { ... })` listener to re-render the mobile header dropdown whenever a token is targeted or untargeted on desktop.
- **Headless Mobile Canvas Token Adapter**:
  - Enhanced `getTargetableToken(tokenId)` to detect if PixiJS canvas rendering is active. If canvas drawing is suppressed (headless mobile view), it constructs an adapter adhering to the PF2e `TokenDocument` / `Token` interface:
    - Provides `id`, `name`, `actor`, `document`, `scene`, `center`, `bounds`, `elevation`, and `distanceTo(otherToken)`.
    - Implements `setTarget(state, { user, releaseOthers })` to manage `user.targets` and call `Hooks.callAll("targetToken", user, token, state)`.
    - Automatically attaches adapter to `tokenDoc.object`.
- **ApplicationV2 `change` Event Delegation**:
  - Added change event delegation to `PF2eMobileSheet._onRender` so `<select data-action="...">` and `<input data-action="...">` elements trigger action handlers seamlessly under Foundry VTT v13/v14 `ApplicationV2`.
- **Streamlined Action Targeting Workflow (`#resolveTargetForAction`)**:
  - Added `#resolveTargetForAction(actionLabel)` to `#onExecuteStrike`, `#onExecuteDamage`, and `#onCastSpell`.
  - When an enemy is already targeted in the header dropdown, strikes, damage rolls, and targeted spells roll immediately using that target without interrupting gameplay with an extra dialog.
  - If no target is selected, a touch-friendly dialog prompts the player to confirm/pick a target or proceed with no target.

#### Changed
- **TokenLayer Placeable Fallback**:
  - Refined `TokenLayer.prototype.get` monkey-patch in `scripts/pf2e-mobile.js` to ensure only placeables containing valid `setTarget` functions are returned, preventing partial objects from bypassing the headless token adapter.

---

## [1.0.0] - 2026-09-12

### Milestone 1: Initial Architecture & Canvas Suppression Engine
- Initial scaffold for `pf2e-mobile-compact` Foundry VTT v13/v14 module.
- Mobile viewport detection (`< 768px`) and user-agent detection.
- Complete canvas ticker suppression (`canvas.app.ticker.stop()`) and 1x1 buffer sizing to eliminate GPU/battery drain on mobile devices.
- Full-bleed mobile sheet styling (`styles/pf2e-mobile.css`) meeting touch target minimums (48px).

### Milestone 2 (Initial): Sticky Header Dashboard
- `PF2eMobileSheet` extending `HandlebarsApplicationMixin(ActorSheetV2)`.
- Live HP, Temporary HP, Shield Hardness, AC, Saves (Fort/Ref/Will), and Perception.
- Quick Damage (`-`) and Heal (`+`) touch buttons integrated directly with `actor.applyDamage`.
- Character switcher dropdown for players with multiple assigned characters.

### Milestone 3: Hybrid Rolling System
- Digital roll integration with PF2e actions (`variant.roll`, `strike.damage`, `actor.rollSkill`).
- Physical roll mode toggle (`digital` vs. `physical`) with manual d20/formula prompt dialogs and chat card reporting.

### Milestone 4 & 5: Spellcasting, Inventory & Bottom Navigation
- Rank-based spell slot tracking and spellcasting execution.
- Focus point pool management.
- Compendium picker modal (`CompendiumPickerApp`) for browsing spells and actions.
- Fixed bottom navigation bar with tabs for Actions, Spells, and Inventory.

