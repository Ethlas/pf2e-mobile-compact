---
name: pf2e-sheet-dev
description: >-
  Use this skill when developing new features, creating or editing sheet tabs, updating action/spell/gear handlers, or enhancing mobile UX for pf2e-mobile-compact.
---

# PF2e Mobile Sheet Development Skill

This guide provides procedures for developing and extending the PF2e Mobile Sheet.

## Key Component Locations
- **Module Entry & Registration**: [`scripts/pf2e-mobile.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/pf2e-mobile.js)
- **Sheet ApplicationV2 Class**: [`scripts/apps/mobile-sheet.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/mobile-sheet.js)
- **Physical Dice Engine**: [`scripts/rolls/physical-dice-interceptor.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/rolls/physical-dice-interceptor.js)
- **Physical Dice Entry Dialog**: [`scripts/apps/physical-dice-dialog.js`](file:///d:/Dnd/coding/pf2e-mobile-compact/scripts/apps/physical-dice-dialog.js)
- **Templates**:
  - Main Frame: [`templates/mobile-sheet.hbs`](file:///d:/Dnd/coding/pf2e-mobile-compact/templates/mobile-sheet.hbs)
  - Sub-tab Parts: [`templates/parts/`](file:///d:/Dnd/coding/pf2e-mobile-compact/templates/parts/) (`actions.hbs`, `spells.hbs`, `inventory.hbs`, `skills.hbs`, `chat.hbs`, `header.hbs`)
- **Styles**: [`styles/pf2e-mobile.css`](file:///d:/Dnd/coding/pf2e-mobile-compact/styles/pf2e-mobile.css)

## Workflow for Adding or Updating Features

1. **Context Preparation (`_prepareContext`)**:
   - Collect and structure data from `this.actor.system` without modifying the actor document.
   - For actions with variants, provide options for selection modals rather than executing blindly.

2. **Template Binding**:
   - Place markup in appropriate `templates/parts/*.hbs`.
   - Use `data-action` on clickable buttons (min 38px height).
   - Use `data-change-action` on `<select>` elements.

3. **Event Handling**:
   - Add action methods in `PF2eMobileSheet` and register them in `#getActionHandlers()` or the ApplicationV2 actions map.
   - Wrap roll calls in try/catch and delegate to PF2e's native roll methods.

4. **Styling**:
   - Add responsive styles in `styles/pf2e-mobile.css`.
   - Test on compact viewport widths (360px - 430px).

5. **Deploy & Validate**:
   - Run `.\deploy.ps1` to sync and restart the server.

