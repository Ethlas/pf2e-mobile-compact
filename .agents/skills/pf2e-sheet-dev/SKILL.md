---
name: pf2e-sheet-dev
description: >-
  Use this skill when developing new features, creating or editing sheet tabs, updating action/spell/gear handlers, or enhancing mobile UX for pf2e-mobile-compact.
---

# PF2e Mobile Sheet Development Skill

This guide provides procedures for developing and extending the PF2e Mobile Sheet.

## Key Component Locations
- **Module Entry & Registration**: [`scripts/pf2e-mobile.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/pf2e-mobile.js)
- **Sheet Orchestrator Class**: [`scripts/apps/mobile-sheet.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/mobile-sheet.js) (lean ApplicationV2 coordinator)
- **Domain Helpers & Context Builders**: [`scripts/apps/sheet-helpers/`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/sheet-helpers/)
  - `context-header.js` (HP, Shield, Defenses, Initiative, Targets)
  - `context-actions.js` (Strikes, Traits, MAP Variants, Aux Actions, Action Categories)
  - `context-spells.js` (Unified Rank Buckets, Slots, Presets, Formatted Spells)
  - `context-skills.js` (Core & Lore Skill Proficiencies)
  - `context-inventory.js` (Weapons, Armor, Consumables, Gear, Bulk)
  - `sheet-prompts.js` (Target, Variant, Stat, Strike Selection Modals)
  - `actions-handlers.js` (Strikes, Checks, Skill Rolls, Item Usage)
  - `spells-handlers.js` (Cast, Slot Mgmt, Daily Rest, Presets, Signature Spells)
- **Headless Token Geometry & Canvas Adapter**: [`scripts/tokens/token-adapter.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/tokens/token-adapter.js)
- **Physical Dice Adapter Bridge**: [`scripts/rolls/physical-dice-interceptor.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/rolls/physical-dice-interceptor.js) (delegates roll interception and prompts to external `physical-dice` module)
- **Utilities**: [`scripts/utils/sheet-utils.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/utils/sheet-utils.js)
- **Templates**:
  - Main Frame: [`templates/mobile-sheet.hbs`](file:///d:/Dnd/coding/pf2e-mobile-compact/templates/mobile-sheet.hbs)
  - Sub-tab Parts: [`templates/parts/`](file:///d:/Dnd/coding/pf2e-mobile-compact/templates/parts/) (`actions.hbs`, `spells.hbs`, `inventory.hbs`, `skills.hbs`, `chat.hbs`, `header.hbs`)
- **Styles**: [`styles/pf2e-mobile.css`](file:///d:/Dnd/coding/pf2e-mobile-compact/styles/pf2e-mobile.css)

## Workflow for Adding or Updating Features

1. **Maintain Architectural Domain Modeling & File Size Discipline**:
   - **Do NOT put heavy domain logic in `mobile-sheet.js`**: Keep `mobile-sheet.js` strictly as a coordinator delegating to domain helpers.
   - **Proactive File Size Checks**: If any file or module begins exceeding 400–600 lines, actively decompose and refactor it into dedicated sub-modules.
   - Place data preparation in `scripts/apps/sheet-helpers/context-*.js`.
   - Place user prompts / dialogs in `scripts/apps/sheet-helpers/sheet-prompts.js`.
   - Place execution handlers in `actions-handlers.js` or `spells-handlers.js`.

2. **Context Preparation (`_prepareContext`)**:
   - Collect and structure data through domain helper functions without mutating underlying actor documents.
   - For actions with variants, provide options for selection modals rather than executing blindly.

3. **Template Binding**:
   - Place markup in appropriate `templates/parts/*.hbs`.
   - Use `data-action` on clickable buttons (min 38px height).
   - Use `data-change-action` on `<select>` elements (never `data-action`).

4. **Event Handling & Action Delegation**:
   - Keep action names registered in `DEFAULT_OPTIONS.actions` on `PF2eMobileSheet`.
   - Delegate static action methods directly to the domain handler functions.
   - Wrap roll calls in try/catch and delegate to PF2e's native roll methods.

5. **Styling**:
   - Add responsive styles in `styles/pf2e-mobile.css`.
   - Test on compact viewport widths (360px - 430px).

6. **Static Verification, Conventional Commits & Pull Requests**:
   - Run `node scripts/verify.mjs` before committing or deploying.
   - Format all commit messages and Pull Request titles using **[Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)** (`<type>[optional scope][!]: <description>`).
   - For `fix:` and `feat:` PRs (which package a new Foundry module release when merged), bump `module.json` and `CHANGELOG.md` via `node scripts/bump-version.mjs <bugfix|feature|full> "<description>"`.
   - **NEVER commit, push, or deploy without explicit user authorization, and NEVER merge Pull Requests (`gh pr merge`).**


