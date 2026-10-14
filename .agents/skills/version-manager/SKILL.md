---
name: version-manager
description: >-
  Use this skill to manage module versions (bug fix, feature, or full new version), update module.json and CHANGELOG.md, run verifications, and trigger GitHub releases.
---

# Semantic Version Manager Skill

This skill defines the procedure for updating the version of `pf2e-mobile-compact`, keeping documentation synchronized, verifying integrity, and packaging releases for Foundry Virtual Tabletop.

---

## 1. Semantic Versioning Rules (Crucial)

The module version in [`module.json`](file:///d:/Dnd/coding/pf2e-mobile-compact/module.json) follows the `MAJOR.MINOR.PATCH` format (e.g., `1.0.36`).

Always apply the following rules when determining the next version number:

1. **Bug Fix (Patch)**:
   - **Update the 3rd number** (`MAJOR.MINOR.PATCH + 1`).
   - Example: `1.0.36` -> `1.0.37`.
   - Use for bug fixes, edge case corrections, CSS/styling fixes, typo corrections, or minor internal refactors that do not add new functionality.

2. **Feature (Minor)**:
   - **Update the middle number** (`MAJOR.MINOR + 1.0`) and **reset the 3rd number to 0**.
   - Example: `1.0.36` -> `1.1.0`.
   - Use for new user-facing features, new tabs, new dialogs, new subsystem integrations (e.g. physical dice, kingdom sheets, audio suppression), or backwards-compatible enhancements.

3. **Full New Version (Major)**:
   - **Update the 1st number** (`MAJOR + 1.0.0`) and **reset the middle and 3rd numbers to 0**.
   - Example: `1.0.36` -> `2.0.0`.
   - Use for full new version milestones, major architectural redesigns, breaking API changes, or major Foundry VTT core upgrades (e.g. migrating from Foundry v14 to v15).

---

## 2. Automated Version Bump Command

Use the built-in CLI script to calculate versions, update manifests, format the changelog, and run tests automatically:

```bash
# For a bug fix (updates 3rd number)
node scripts/bump-version.mjs bugfix "Brief description of fix"

# For a feature (updates middle number)
node scripts/bump-version.mjs feature "Brief description of feature"

# For a full new version (updates 1st number)
node scripts/bump-version.mjs full "Brief description of major milestone"
```

### What `bump-version.mjs` Performs:
1. Validates the current version in [`module.json`](file:///d:/Dnd/coding/pf2e-mobile-compact/module.json).
2. Calculates the new version based on the specified release type.
3. Updates `module.json`'s `"version"` field.
4. Prepends a draft entry with today's date in [`CHANGELOG.md`](file:///d:/Dnd/coding/pf2e-mobile-compact/CHANGELOG.md).
5. Runs the automated verification suite (`node scripts/verify.mjs`).
6. Outputs exact git release commands.

---

## 3. Verification & Quality Assurance

Before committing or releasing any version:
1. Always run static and interactive verifications:
   ```bash
   node scripts/verify.mjs
   ```
2. Check that all tests pass with 0 errors and 0 warnings.
3. Ensure [`CHANGELOG.md`](file:///d:/Dnd/coding/pf2e-mobile-compact/CHANGELOG.md) accurately documents the changes and lists affected files.

---

## 4. Git & GitHub Release Workflow

> [!WARNING]
> **NEVER commit, tag, or push to Git/GitHub without explicit user approval.** Always show the proposed changes and ask the user before running git push commands.

Once the user authorizes the release:
1. Stage and commit the updated version files:
   ```bash
   git add module.json CHANGELOG.md
   git commit -m "Release vX.Y.Z: <Summary>"
   ```
2. Create the version tag:
   ```bash
   git tag vX.Y.Z
   ```
3. Push to GitHub with tags:
   ```bash
   git push origin main --tags
   ```

### Automated GitHub Release Action
Pushing the `vX.Y.Z` tag automatically triggers the GitHub Actions workflow [`.github/workflows/release.yml`](file:///d:/Dnd/coding/pf2e-mobile-compact/.github/workflows/release.yml):
- Verifies code integrity via `node scripts/verify.mjs`.
- Whitelists only runtime assets (`module.json`, `README.md`, `scripts/`, `styles/`, `templates/`).
- Excludes development files (`.agents`, `AGENTS.md`, `CHANGELOG.md`, `deploy.ps1`, `run-verify.ps1`, `docs/`, `scratch/`, `verify.mjs`).
- Creates `module.zip` and attaches both `module.zip` and `module.json` to the official GitHub Release for instant Foundry VTT auto-updates!
