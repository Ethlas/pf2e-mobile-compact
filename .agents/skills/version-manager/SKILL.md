---
name: version-manager
description: >-
  Use this skill to pick the Conventional Commit prefix that sets a release's version (bug fix, feature, or full new version), update CHANGELOG.md, run verifications, and trigger GitHub releases.
---

# Semantic Version Manager Skill

This skill defines how releases of `pf2e-mobile-compact` get their version, keeping documentation synchronized, verifying integrity, and packaging releases for Foundry Virtual Tabletop.

---

## 1. Conventional Commits v1.0.0 & Semantic Versioning Rules (Crucial)

All commits and Pull Request titles MUST follow the **[Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)** specification:
```text
<type>[optional scope][!]: <description>
```

Versions follow the `MAJOR.MINOR.PATCH` format (e.g., `2.0.2`) and are **computed automatically** when a PR is merged: the release takes the highest `vX.Y.Z` tag and raises it by the PR title's prefix (or, for a direct push without a PR, the commit subject's; the prefixes of the commits inside a PR don't count). Never edit the version by hand: the `module.json` version in the repository is `0.0.0-dev`, for development checkouts only, and the release writes the computed version into the packaged manifest.
**Only `fix` and `feat` Pull Requests package a new Foundry module release when merged into `main`:**

1. **`fix:` — Bug Fix (Patch)**:
   - **Raises the 3rd number** (`MAJOR.MINOR.PATCH + 1`).
   - Example: `2.0.1` -> `2.0.2` (`fix(webkit): draw custom arrows on header dropdowns`).
   - Use for bug fixes, edge case corrections, CSS/styling fixes, or regressions.

2. **`feat:` — Feature (Minor)**:
   - **Raises the middle number** (`MAJOR.MINOR + 1.0`) and **resets the 3rd number to 0**.
   - Example: `2.0.2` -> `2.1.0` (`feat(spells): add heightened spell damage button`).
   - Use for new user-facing features, new tabs, new dialogs, new subsystem integrations, or backwards-compatible enhancements.

3. **`feat!:` or `fix!:` — Full New Version (Major / Breaking)**:
   - **Raises the 1st number** (`MAJOR + 1.0.0`) and **resets the middle and 3rd numbers to 0**.
   - Example: `2.1.0` -> `3.0.0` (`feat!: migrate sheet to Foundry v15`).
   - Use for major milestones, architectural redesigns, breaking API changes, or major Foundry VTT core upgrades.

4. **Non-Release Types (`docs:`, `ci:`, `chore:`, `style:`, `refactor:`, `perf:`, `test:`, `build:`, `revert:`)**:
   - Used for documentation, CI workflow updates, internal refactors, or test suite additions.
   - Do **not** package a new release when merged. PR titles are not enforced: a PR with any other title merges fine and just doesn't release.

---

## 2. Changelog

Add an entry for every `fix` or `feat` change to [`CHANGELOG.md`](file:///d:/Dnd/coding/pf2e-mobile-compact/CHANGELOG.md) under the `## [Unreleased]` heading at the top. The version isn't known until the PR is merged; GitHub's generated release notes list the merged PRs per version.

After a release, rename `## [Unreleased]` to the released version and date (e.g. `## [2.0.4] - 2026-10-21`, from the release's `vX.Y.Z` tag) in a `docs(changelog):` PR, and start a new empty `## [Unreleased]` above it. The release workflow does not edit the changelog.

---

## 3. Verification & Quality Assurance

Before committing or opening a PR:
1. Always run static and interactive verifications:
   ```bash
   node scripts/verify.mjs
   ```
2. Check that all tests pass with 0 errors and 0 warnings.
3. To test the release package locally, run `node scripts/build.mjs` and inspect `dist/module.zip`.
4. For `fix:` and `feat:` PRs, ensure [`CHANGELOG.md`](file:///d:/Dnd/coding/pf2e-mobile-compact/CHANGELOG.md) accurately documents the changes and lists affected files.

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
- **On Pull Request ([`.github/workflows/ci-verify.yml`](file:///d:/Dnd/coding/pf2e-mobile-compact/.github/workflows/ci-verify.yml))**: runs `node scripts/verify.mjs`.
- **On Merge to `main` ([`.github/workflows/release.yml`](file:///d:/Dnd/coding/pf2e-mobile-compact/.github/workflows/release.yml))**:
  - First runs `ci-verify.yml` as its `verify` job (a reusable workflow, via `workflow_call`); packaging only starts when it passes.
  - Runs `node scripts/release-check.mjs`, which checks whether the merged PR title (or the commit subject) has a `fix` or `feat` Conventional Commit prefix, and computes the version from the highest `vX.Y.Z` tag.
  - **Only when `fix` or `feat` is present**: packages runtime assets with `node scripts/build.mjs` (`module.json`, `README.md`, `LICENSE`, `scripts/` without its `.mjs` tooling, `styles/`, `templates/`), and automatically creates the `vX.Y.Z` tag and GitHub Release with `module.zip` and `module.json`.
