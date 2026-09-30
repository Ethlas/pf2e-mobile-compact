# Changelog

All notable changes and technical implementation milestones for **PF2e Mobile Sheet (Compact)** (`pf2e-mobile-compact`) will be documented in this file.

---

## [Unreleased]

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

