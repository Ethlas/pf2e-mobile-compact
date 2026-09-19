---
name: code-verifier
description: >-
  Use this skill to run automated static code verifications on pf2e-mobile-compact without requiring a live browser or Foundry server test.
---

# Code Verifier Skill

This skill guides automated static verification for `pf2e-mobile-compact` code changes.

## Verification Suite

Run the built-in static verification suite:
```powershell
node scripts/verify.mjs
```

### What It Verifies:
1. **JavaScript Syntax**: Checks all `.js` and `.mjs` files using `node --check`.
2. **`module.json` Integrity**: Validates manifest structure and required fields.
3. **Handlebars Templates**:
   - Ensures no `<select>` elements use `data-action` (enforces the mobile touch rule).
   - Validates that block helpers (`{{#if}}`, `{{#each}}`, etc.) are balanced and closed.
4. **ApplicationV2 Action Consistency**:
   - Cross-checks all `data-action` attributes against the registered action handlers in sheet/picker classes.
5. **Mobile Touch Target Audit**:
   - Scans CSS for interactive button heights below the 36px–44px minimum standard.

