---
name: version-manager
description: >-
  Use this skill to manage module versions (bug fix, feature, or full new version), update module.json and CHANGELOG.md, run verifications, and trigger GitHub releases.
---

# Semantic Version Manager Skill

This skill defines the procedure for updating the version of `pf2e-mobile-compact`, keeping documentation synchronized, verifying integrity, and packaging releases for Foundry Virtual Tabletop.

---

## 1. Conventional Commits v1.0.0 & Semantic Versioning Rules (Crucial)

All commits and Pull Request titles MUST follow the **[Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)** specification:
```text
<type>[optional scope][!]: <description>
```

The module version in [`module.json`](file:///d:/Dnd/coding/pf2e-mobile-compact/module.json) follows the `MAJOR.MINOR.PATCH` format (e.g., `2.0.2`).
**Only `fix` and `feat` Pull Requests package a new Foundry module release when merged into `main`:**

1. **`fix:` — Bug Fix (Patch)**:
   - **Update the 3rd number** (`MAJOR.MINOR.PATCH + 1`).
   - Example: `2.0.1` -> `2.0.2` (`fix(webkit): draw custom arrows on header dropdowns`).
   - Use for bug fixes, edge case corrections, CSS/styling fixes, or regressions.

2. **`feat:` — Feature (Minor)**:
   - **Update the middle number** (`MAJOR.MINOR + 1.0`) and **reset the 3rd number to 0**.
   - Example: `2.0.2` -> `2.1.0` (`feat(spells): add heightened spell damage button`).
   - Use for new user-facing features, new tabs, new dialogs, new subsystem integrations, or backwards-compatible enhancements.

3. **`feat!:` or `fix!:` — Full New Version (Major / Breaking)**:
   - **Update the 1st number** (`MAJOR + 1.0.0`) and **reset the middle and 3rd numbers to 0**.
   - Example: `2.1.0` -> `3.0.0` (`feat!: migrate sheet to Foundry v15`).
   - Use for major milestones, architectural redesigns, breaking API changes, or major Foundry VTT core upgrades.

4. **Non-Release Types (`docs:`, `ci:`, `chore:`, `style:`, `refactor:`, `perf:`, `test:`, `build:`, `revert:`)**:
   - Used for documentation, CI workflow updates, internal refactors, or test suite additions.
   - Do **not** require a version increment in `module.json` and do **not** package a new release when merged.

---

## 2. Automated Version Bump Command

When preparing a `fix` or `feat` release PR, use the built-in CLI script to calculate versions, update manifests, format the changelog, and run tests automatically:

```bash
# For a bug fix / fix: PR (updates 3rd number)
node scripts/bump-version.mjs bugfix "Brief description of fix"

# For a feature / feat: PR (updates middle number)
node scripts/bump-version.mjs feature "Brief description of feature"

# For a full new version / feat!: PR (updates 1st number)
node scripts/bump-version.mjs full "Brief description of major milestone"
```

### What `bump-version.mjs` Performs:
1. Validates the current version in [`module.json`](file:///d:/Dnd/coding/pf2e-mobile-compact/module.json).
2. Calculates the new version based on the specified release type.
3. Updates `module.json`'s `"version"` field.
4. Prepends a draft entry with today's date in [`CHANGELOG.md`](file:///d:/Dnd/coding/pf2e-mobile-compact/CHANGELOG.md).
5. Runs the automated verification suite (`node scripts/verify.mjs`).
6. Outputs exact Conventional Commits git & PR commands.

---

## 3. Verification & Quality Assurance

Before committing or opening a PR:
1. Always run static and interactive verifications:
   ```bash
   node scripts/verify.mjs
   ```
2. Check that all tests pass with 0 errors and 0 warnings.
3. For `fix:` and `feat:` PRs, ensure [`CHANGELOG.md`](file:///d:/Dnd/coding/pf2e-mobile-compact/CHANGELOG.md) accurately documents the changes and lists affected files.

---

## 4. Git & GitHub Pull Request Workflow

> [!WARNING]
> - **NEVER commit, tag, or push to Git/GitHub without explicit user approval.** Always show the proposed changes and ask the user before running git push commands.
> - **NEVER merge Pull Requests (`gh pr merge` or merging into `main`).** Leave all Pull Requests open for the user to review and merge manually on GitHub.

Once the user authorizes pushing a branch / PR:
1. Stage and commit using a Conventional Commits v1.0.0 message:
   ```bash
   git add <files>
   git commit -m "<type>(<scope>): <summary>"
   ```
2. Push the branch and open a Pull Request with a Conventional Commits v1.0.0 title (do **not** merge it):
   ```bash
   git push -u origin <branch-name>
   gh pr create --base main --head <branch-name> --title "<type>(<scope>): <summary>" --body "<description>"
   ```

### Automated GitHub Verification & Release Actions
- **On Pull Request ([`.github/workflows/ci-verify.yml`](file:///d:/Dnd/coding/pf2e-mobile-compact/.github/workflows/ci-verify.yml))**:
  - Validates that the PR title matches Conventional Commits v1.0.0 (`<type>[optional scope][!]: <description>`).
  - If `<type>` is `fix` or `feat`, verifies that `module.json` version was incremented above `main` and that tag `vX.Y.Z` is unused.
  - Runs `node scripts/verify.mjs`.
- **On Merge to `main` ([`.github/workflows/release.yml`](file:///d:/Dnd/coding/pf2e-mobile-compact/.github/workflows/release.yml))**:
  - Checks whether the merged PR title / commit has a `fix` or `feat` Conventional Commit prefix.
  - **Only when `fix` or `feat` is present**: verifies code integrity, packages runtime assets (`module.json`, `README.md`, `LICENSE`, `scripts/`, `styles/`, `templates/`), and automatically creates the `vX.Y.Z` tag and GitHub Release with `module.zip` and `module.json`.
