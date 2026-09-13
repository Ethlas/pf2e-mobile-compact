# Changelog

All notable changes and technical implementation milestones for **PF2e Mobile Sheet (Compact)** (`pf2e-mobile-compact`) will be documented in this file.

---

## [1.0.3] - 2026-09-13

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

