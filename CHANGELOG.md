# Changelog

All notable changes and technical implementation milestones for **PF2e Mobile Sheet (Compact)** (`pf2e-mobile-compact`) will be documented in this file.

---

## [1.0.11] - 2026-09-19

### Milestone 9: Layout Architecture Restoration, CSS Refactoring & Spell Slot Expenditure Fix

#### Fixed
- **Spell Casting Expended Slots Twice** (`_onCastSpell` in `scripts/apps/mobile-sheet.js`):
  - Root cause: `entry.cast()` was called with `{ slot, level }`, which are not part of PF2e's `CastOptions` (`{ rank, slotId, consume, message, rollMode }`). PF2e ignored them, defaulted `consume: true`, and expended the slot itself; the module then expended it a second time manually.
  - Spontaneous casters lost two slots per cast; prepared casters with the same spell in multiple slots could have both copies expended; the tapped rank was ignored so heightened casts went out at the spell's base rank.
  - Fix: pass `{ rank, slotId }` to `entry.cast()` and let PF2e handle all slot, focus point, and innate-use consumption natively. Removed the manual prepared/spontaneous slot decrement block.
- **Mobile Sheet Layout & Viewport Scroll Restoration**: Fixed issue where the entire page scrolled and pushed the bottom navigation bar off-screen. Removed detached fixed positioning on the sheet body and configured explicit ApplicationV2 flex child sizing (`flex: 0 0 auto` top dashboard header, `flex: 1 1 0%` sheet body, scrollable `mobile-tab-content`, and permanently pinned `mobile-bottom-nav`).
- **Eliminated 87% of `!important` Declarations**: Systematically refactored `styles/pf2e-mobile.css` (reducing from 520+ occurrences down to 65). Scoped button and component classes naturally to override base sheet rules without specificity hacks.
- **Removed Local Foundry Sync Artifacts**: Completely deleted local sync scripts and documentation per workflow requirements.
- **Touch Target Compliances**: Ensured all buttons, auxiliary strike actions, slot adjustment controls, and dialog actions satisfy the 38px+ touch target standard.

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

