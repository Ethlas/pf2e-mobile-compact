# PF2e Mobile Sheet (Compact) - Agent Guidelines & Repository Rules

Welcome to the **PF2e Mobile Sheet (Compact)** repository (`pf2e-mobile-compact`). This is a mobile-optimized, battery-efficient character sheet module for Pathfinder Second Edition (PF2e) running on Foundry Virtual Tabletop (v14).

---

## 1. Repository Overview & Tech Stack

- **Foundry VTT Compatibility**: Foundry v14 (`module.json`).
- **Target System**: `pf2e` (minimum v6.0.0).
- **Core Entry Point**: [`scripts/pf2e-mobile.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/pf2e-mobile.js)
- **Sheet Architecture**: Foundry `ApplicationV2` / `ActorSheetV2` in [`scripts/apps/mobile-sheet.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/mobile-sheet.js) (lean orchestrator).
- **Domain Helpers & Context Builders**: [`scripts/apps/sheet-helpers/`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/sheet-helpers/) (`context-*.js`, `sheet-prompts.js`, `actions-handlers.js`, `spells-handlers.js`).
- **Headless Token Geometry & Canvas Adapter**: [`scripts/tokens/token-adapter.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/tokens/token-adapter.js).
- **Physical Dice Engine**: [`scripts/rolls/physical-dice-interceptor.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/rolls/physical-dice-interceptor.js) & [`scripts/apps/physical-dice-dialog.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/physical-dice-dialog.js)
- **Utilities**: [`scripts/utils/sheet-utils.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/utils/sheet-utils.js).
- **Templates**: Handlebars templates in [`templates/`](file:///d:/Dnd/coding/pf2e-mobile-compact/templates/) and [`templates/parts/`](file:///d:/Dnd/coding/pf2e-mobile-compact/templates/parts/)
- **Styles**: Mobile-first CSS in [`styles/pf2e-mobile.css`](file:///d:/Dnd/coding/pf2e-mobile-compact/styles/pf2e-mobile.css)
- **Deployment**: PowerShell script [`deploy.ps1`](file:///d:/Dnd/coding/pf2e-mobile-compact/deploy.ps1) syncing to remote Foundry server via `pscp.exe` and restarting PM2 via `plink.exe`.

---

## 2. Core Architectural Principles

### A. Respect Foundry ApplicationV2 Lifecycles
- Subclass `foundry.applications.sheets.ActorSheetV2` (or modern `api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2)`).
- Use `_prepareContext(options)` to curate clean, template-ready data. Do not mutate underlying Actor documents in prepare hooks.
- Use `foundry.documents.collections.Actors` or `getDocumentClass("Actor")` instead of deprecated global accessors.

### B. Mobile Touch & Native Dropdowns (Critical UX Rule)
- **Do NOT put `data-action` on `<select>` elements**: ApplicationV2 binds delegated `click` handlers to elements with `data-action` that call `event.preventDefault()`, which suppresses the native OS select picker on iOS WebKit and Android Chromium.
- For select dropdowns (e.g. Roll Mode, Actor Switcher, Target Selector), use `data-change-action` and stop click propagation (`e.stopPropagation()`) so native pickers open reliably on touch screens.
- Ensure minimum touch target heights: **38px - 44px** minimum for all clickable buttons, chevrons, tabs, and inputs.

### C. PF2e System Integrity & Roll Interception
- **Never re-implement PF2e game math**: Always delegate modifier calculations, degree of success, MAP (Multiple Attack Penalty), and IWR (Immunities, Weaknesses, Resistances) to PF2e's native system (`statistic.roll`, `item.toMessage()`, `DamageRoll`, `CheckRoll`).
- In Physical Dice Roll mode, intercept dice terms and prompt users for raw physical totals, but let PF2e calculate the final degree of success and render official chat cards.
- Support action variants (e.g., *Stabilize* vs *Stop Bleeding*, or *Recall Knowledge* skills) by presenting touch-friendly modal pickers instead of triggering empty or failing rolls.

### D. Mobile Chat & Damage Application
- Keep Foundry's docked chat integrated cleanly in the sheet (`#chat-tab-content`).
- Maintain token selection fallback: on mobile devices without canvas interaction, ensure damage application buttons on chat cards fall back to the active sheet's token/actor.

### E. Modular Domain Modeling & File Size Discipline (Critical Architecture Rule)
- **Maintain Lean Orchestrator**: Keep [`scripts/apps/mobile-sheet.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/mobile-sheet.js) strictly as a high-level ApplicationV2 orchestrator (target < 700 lines).
- **Respect Domain Boundaries**:
  - **Context Builders** (`scripts/apps/sheet-helpers/context-*.js`): Prepares data for Header, Actions, Spells, Skills, and Inventory templates.
  - **Interactive Prompts** (`scripts/apps/sheet-helpers/sheet-prompts.js`): User dialogs for targeting, variant picker, statistic selection, and strike selection.
  - **Action & Strike Handlers** (`scripts/apps/sheet-helpers/actions-handlers.js`): Execution of weapon strikes, damage, auxiliary actions, action checks, skill rolls, and consumable consumption.
  - **Spell Handlers** (`scripts/apps/sheet-helpers/spells-handlers.js`): Spellcasting, slot preparation, daily rest, presets, signature spells, and compendium browser integration.
  - **Token Geometry** (`scripts/tokens/token-adapter.js`): Headless canvas token geometry, flanking detection, and targeting synchronization.
  - **Utilities** (`scripts/utils/sheet-utils.js`): Shared mathematical clamps, glyph formatters, and pure helpers.
- **Proactive Refactoring on New Features**:
  - Whenever introducing a new feature, enhancement, or bug fix, **strictly respect this modular modeling**.
  - **Never dump new domain logic directly into `mobile-sheet.js`**.
  - Proactively assess file sizes: if any helper or module approaches 400–600 lines or takes on mixed responsibilities, immediately refactor and extract into dedicated domain sub-modules.
  - Preserve registered action names in `DEFAULT_OPTIONS.actions` on `PF2eMobileSheet` while delegating execution directly to the modular domain handlers.

### F. Stylesheet: Follow the Style Guide (Critical Styling Rule)
- **The style guide is the reference**: `docs/style-guide.html` (open it over HTTP from the repository root, e.g. `python3 -m http.server 8000` and <http://localhost:8000/docs/style-guide.html>) shows every colour variable, utility class, component and badge/button colour of `styles/pf2e-mobile.css`, with class names. Every change to the stylesheet or to classes in the templates must follow it.
- **Colours come from the palette**: use the `--m-*` variables in the Colour Palette block (surfaces, borders, role hues and their badge tones and solid shades, staff/charge/slot/gold) instead of hex values in component rules. The role colours are linked to Foundry's own variables (`--color-level-*`, `--color-warm-1`); damage types, proficiency ranks and character tags use pf2e's colours. A genuinely new colour is added to the palette first.
- **Layout lives in the templates**: use the `m-*` utilities (`m-flex-row`, `m-flex-col`, `m-align-*`, `m-justify-*`, `m-gap-*`, `m-wrap`, `m-flex-1`, `m-flex-auto`, `m-min-w-0`, `m-shrink-0`, `m-truncate`) and the type scale (`m-text-xs` 11px, `m-text-sm` 12px, `m-text-md` 13px, `m-text-base` 14px, `m-text-xl` 15px, in rem that land on whole pixels at the 16px base; `m-medium`, `m-semibold`, `m-bold`) and text colours (`m-color-strong`, `-normal`, `-soft`, `-muted`, `-dim`, `-faint` for the six text greys, `m-color-accent`, and `m-color-info`, `-success`, `-danger`, `-warning`) on the element instead of repeating those declarations in a component rule. Use a step of the scale instead of a size in between. Component rules keep how something looks. The layout utilities also work in the compendium picker and the spell picker dialog (they are scoped to `:is(.pf2e-mobile-sheet, .pf2e-mobile-compendium-picker, .spell-picker-dialog)`).
- **Reuse the shared components**: `m-group`, `m-card`, `m-panel`, `m-compact` (the 38px control size), and for badges one of `m-badge` (the shape: padding and corners) or `m-badge-neutral` (the same shape with the surface and border of badges without a role colour). A badge that is a single element takes one of these classes; its text size and colour come from `m-text-*` / `m-color-*`. A snippet of several tags that repeats belongs in a shared Handlebars partial instead. A new badge or soft button of a role joins that role's rule in the Badge Tones section at the end of the stylesheet.
- **Keep the guide current**: when adding or changing a variable, utility, component or colour role, update `docs/style-guide.html` in the same change. `scripts/verify.mjs` fails when an `m-*` class has no sample there.

---

## 3. Workflow & Deployment Rules

1. **Syntax & Quality Checks**:
   - Run `node scripts/verify.mjs` before pushing changes or deploying to verify JavaScript syntax, template rules, and touch targets.
2. **Deployment**:
   - Run `.\deploy.ps1` to sync to the remote Foundry server (`$env:FOUNDRY_DEPLOY_SERVER`) only when explicitly authorized by the user for deployment.
3. **Approval & Documentation Integrity**:
   - **NEVER commit or push to Git/GitHub without explicit user approval.**
   - **NEVER deploy without explicit user approval.**
   - Never commit or store plaintext passwords in repository files or skill runbooks.
   - For every feature milestone, bug fix, or breaking change, document the change under the corresponding version in [`CHANGELOG.md`](file:///d:/Dnd/coding/pf2e-mobile-compact/CHANGELOG.md).
   - Bump version in [`module.json`](file:///d:/Dnd/coding/pf2e-mobile-compact/module.json) when releasing new milestone versions.

---

## 4. Foundry VTT AI Content Policy Compliance ([Official Policy](https://foundryvtt.com/article/ai-policy/))

All code, templates, assets, and documentation in this repository MUST strictly adhere to the **Foundry VTT AI Content Policy (Revised March 18, 2026)** (detailed in [`.agents/rules/foundry-ai-policy.md`](file:///d:/Dnd/coding/pf2e-mobile-compact/.agents/rules/foundry-ai-policy.md)):

1. **Zero AI-Generated Prepared Media (Sections 3.1, 4.2, 4.3)**:
   - **Never** generate or bundle AI-created images, illustrations, tokens, icons, video, or audio files (`.png`, `.jpg`, `.webp`, `.gif`, `.mp3`, `.ogg`, `.wav`).
   - Use FontAwesome (`fa-solid`, `fas`), Foundry VTT built-in icons (`icons/...`), PF2e system icons (`systems/pf2e/...`), CSS styling, or clean geometric UI `<svg>` icons (`< 10 KB`, no embedded raster `<image>` data URLs).
   - Any bundled raster/audio asset must be 100% human-created and listed in `ASSET_PROVENANCE.json` with creator attribution and license details.
2. **Zero AI-Generated Lore/Rules Text & No Third-Party Scraping (Sections 1.1, 4.1)**:
   - Never bundle AI-written lore, item descriptions, or copied third-party rules constants (`pf2e`, `pf2e-kingmaker-tools`, `pf2e-dailies`). Always delegate at runtime to official system compendia and installed module APIs (`kmApp._preparePartContext`, `game.pf2e`).
3. **Human Author Comprehension & Anti-"Vibe Coding" (Sections 4.4 & 7)**:
   - All AI-assisted code must be modular, clearly structured, and documented with JSDoc headers and `CHANGELOG.md` design rationale so the human author (`Ethlas`) can personally understand, explain, modify, and maintain 100% of the codebase.
4. **Runtime Code Safety & Honest Package Categorization (Sections 5, 4.5, 6.6)**:
   - Never use `eval()` or `new Function()` to execute unconfirmed dynamically generated code at runtime.
   - Never label the package as `"Zero AI"`, and ensure `module.json` descriptions and marketing copy are human-authored/approved.

