# PF2e Mobile Sheet (Compact) - Agent Guidelines & Repository Rules

Welcome to the **PF2e Mobile Sheet (Compact)** repository (`pf2e-mobile-compact`). This is a mobile-optimized, battery-efficient character sheet module for Pathfinder Second Edition (PF2e) running on Foundry Virtual Tabletop (v14).

---

## 1. Repository Overview & Tech Stack

- **Foundry VTT Compatibility**: Foundry v14 (`module.json`).
- **Target System**: `pf2e` (minimum v6.0.0).
- **Core Entry Point**: [`scripts/pf2e-mobile.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/pf2e-mobile.js)
- **Sheet Architecture**: Foundry `ApplicationV2` / `ActorSheetV2` in [`scripts/apps/mobile-sheet.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/mobile-sheet.js)
- **Physical Dice Engine**: [`scripts/rolls/physical-dice-interceptor.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/rolls/physical-dice-interceptor.js) & [`scripts/apps/physical-dice-dialog.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/physical-dice-dialog.js)
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

---

## 3. Workflow & Deployment Rules

1. **Syntax & Quality Checks**:
   - Verify JavaScript syntax and Handlebars templates before pushing changes or deploying.
2. **Deployment**:
   - Run `.\deploy.ps1` to sync the repository to the test server (`foundry@10.0.0.50`) and automatically restart the Foundry PM2 service.
   - Monitor remote logs if errors occur using `plink.exe -batch @PwArgs foundry@10.0.0.50 "pm2 logs foundry --lines 30 --nostream"` (using `$env:FOUNDRY_DEPLOY_PASSWORD` or SSH keys).
3. **Documentation & Security Integrity**:
   - Never commit or store plaintext passwords in repository files or skill runbooks.
   - For every feature milestone, bug fix, or breaking change, document the change under the corresponding version in [`CHANGELOG.md`](file:///d:/Dnd/coding/pf2e-mobile-compact/CHANGELOG.md).
   - Bump version in [`module.json`](file:///d:/Dnd/coding/pf2e-mobile-compact/module.json) when releasing new milestone versions.
