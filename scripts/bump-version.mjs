#!/usr/bin/env node
/**
 * scripts/bump-version.mjs
 *
 * Semantic version manager for pf2e-mobile-compact:
 * - Bug Fix (Patch): increments the 3rd number (e.g. 1.0.36 -> 1.0.37)
 * - Feature (Minor): increments the middle number (e.g. 1.0.36 -> 1.1.0)
 * - Full New Version (Major): increments the 1st number (e.g. 1.0.36 -> 2.0.0)
 *
 * Usage:
 *   node scripts/bump-version.mjs <patch|minor|major|bugfix|feature|full> [optional description]
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import semver from "semver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export const TYPE_MAP = {
  patch: "patch",
  bugfix: "patch",
  bug: "patch",
  fix: "patch",
  "3rd": "patch",

  minor: "minor",
  feature: "minor",
  feat: "minor",
  middle: "minor",
  "2nd": "minor",

  major: "major",
  full: "major",
  breaking: "major",
  "1st": "major"
};

/**
 * Calculates the next semantic version string based on current version and release type.
 * @param {string} currentVersion - e.g. "1.0.36"
 * @param {string} releaseType - "patch", "minor", or "major"
 * @returns {string} nextVersion - e.g. "1.0.37"
 */
export function calculateNextVersion(currentVersion, releaseType) {
  if (!semver.valid(currentVersion)) {
    throw new Error(`Current version "${currentVersion}" in module.json is not valid SemVer (X.Y.Z).`);
  }
  if (!["patch", "minor", "major"].includes(releaseType)) {
    throw new Error(`Unknown release type "${releaseType}". Expected patch, minor, or major.`);
  }

  // patch: bug fix (3rd number), minor: feature (middle number, resets patch),
  // major: full new version (1st number, resets minor and patch)
  return semver.inc(currentVersion, releaseType);
}

/**
 * Bumps the module version, updates module.json and CHANGELOG.md, and runs verifications.
 * @param {string} rawType - e.g. "bugfix", "feature", "full"
 * @param {string} [changeDescription=""]
 * @param {object} [options={}]
 * @param {boolean} [options.runVerification=true]
 * @returns {{ currentVersion: string, nextVersion: string, releaseType: string }}
 */
export function bumpVersion(rawType, changeDescription = "", options = {}) {
  const { runVerification = true } = options;
  const releaseType = TYPE_MAP[(rawType || "").toLowerCase().trim()];

  if (!releaseType) {
    throw new Error(`Invalid release type "${rawType}". Allowed types: bugfix, feature, full.`);
  }

  const moduleJsonPath = path.join(rootDir, "module.json");
  const packageJsonPath = path.join(rootDir, "package.json");
  const changelogPath = path.join(rootDir, "CHANGELOG.md");

  // 1. Read module.json
  if (!fs.existsSync(moduleJsonPath)) {
    throw new Error(`module.json not found at ${moduleJsonPath}`);
  }

  const modRaw = fs.readFileSync(moduleJsonPath, "utf-8");
  const moduleData = JSON.parse(modRaw);
  const currentVersion = moduleData.version;

  const nextVersion = calculateNextVersion(currentVersion, releaseType);

  console.log(`\n==========================================`);
  console.log(`PF2e Mobile Compact | Semantic Version Bump`);
  console.log(`==========================================`);
  console.log(`Release Type : \x1b[36m${releaseType.toUpperCase()}\x1b[0m (${rawType})`);
  console.log(`Current      : \x1b[33m${currentVersion}\x1b[0m`);
  console.log(`Next Version : \x1b[32m${nextVersion}\x1b[0m`);
  if (changeDescription) {
    console.log(`Description  : "${changeDescription}"`);
  }
  console.log(`------------------------------------------`);

  // 2. Update module.json
  moduleData.version = nextVersion;
  fs.writeFileSync(moduleJsonPath, JSON.stringify(moduleData, null, 2) + "\n", "utf-8");
  console.log(`✔ Updated module.json version to ${nextVersion}`);

  // 3. Update package.json if present
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      pkg.version = nextVersion;
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
      console.log(`✔ Updated package.json version to ${nextVersion}`);
    } catch (err) {
      console.warn(`! Failed to update package.json: ${err.message}`);
    }
  }

  // 4. Update CHANGELOG.md if present
  if (fs.existsSync(changelogPath)) {
    const today = new Date().toISOString().split("T")[0];
    const changelogContent = fs.readFileSync(changelogPath, "utf-8");

    const entryHeader = `## [${nextVersion}] - ${today}`;
    if (!changelogContent.includes(entryHeader)) {
      const summaryTitle = changeDescription || (
        releaseType === "patch" ? "Bug Fixes & Maintenance" :
        releaseType === "minor" ? "New Features & Enhancements" :
        "Major Release & Overhaul"
      );

      const newEntry = `## [${nextVersion}] - ${today}\n\n### ${summaryTitle}\n\n- ${changeDescription ? `**${changeDescription}**:` : "- **Changes**:"}\n  - Document your changes here.\n\n---\n\n`;

      const marker = "# Changelog\n\nAll notable changes and technical implementation milestones for **PF2e Mobile Sheet (Compact)** (`pf2e-mobile-compact`) will be documented in this file.\n\n---\n\n";

      let updatedChangelog = "";
      if (changelogContent.startsWith(marker)) {
        updatedChangelog = marker + newEntry + changelogContent.slice(marker.length);
      } else {
        const firstHeadingIndex = changelogContent.indexOf("## [");
        if (firstHeadingIndex !== -1) {
          updatedChangelog = changelogContent.slice(0, firstHeadingIndex) + newEntry + changelogContent.slice(firstHeadingIndex);
        } else {
          updatedChangelog = `# Changelog\n\n${newEntry}${changelogContent}`;
        }
      }

      fs.writeFileSync(changelogPath, updatedChangelog, "utf-8");
      console.log(`✔ Added [${nextVersion}] draft header to CHANGELOG.md`);
    } else {
      console.log(`ℹ CHANGELOG.md already contains header for [${nextVersion}]`);
    }
  }

  // 5. Run static verifications
  if (runVerification) {
    console.log(`\nRunning automated verification suite (node scripts/verify.mjs)...`);
    execSync("node scripts/verify.mjs", { cwd: rootDir, stdio: "inherit" });
  }

  // 6. Summary and git release guidance
  const ccPrefix = releaseType === "patch" ? "fix" : releaseType === "minor" ? "feat" : "feat!";
  const ccSummary = (changeDescription || "update module").replace(/^(feat|fix)(\([^)]+\))?!?:s*/i, "");
  console.log(`
============================================================
\x1b[32m✔ Version ${nextVersion} prepared and verified successfully!\x1b[0m
============================================================

Next Steps (Reminder: Always obtain explicit user authorization before pushing to git, and NEVER merge PRs):
  1. Review and refine your notes in CHANGELOG.md
  2. Commit changes using Conventional Commits v1.0.0:
     \x1b[36mgit add module.json package.json CHANGELOG.md\x1b[0m
     \x1b[36mgit commit -m "${ccPrefix}: ${ccSummary}"\x1b[0m
  3. Push branch and open a Pull Request with a "${ccPrefix}:" title (do NOT merge):
     \x1b[36mgit push -u origin <branch-name>\x1b[0m
     \x1b[36mgh pr create --base main --head <branch-name> --title "${ccPrefix}: ${ccSummary}"\x1b[0m
`);

  return { currentVersion, nextVersion, releaseType };
}

// Execute CLI directly only when run as main script
const isDirectRun = Boolean(process.argv[1] && path.resolve(process.argv[1]) === __filename);

if (isDirectRun) {
  const releaseTypeRaw = (process.argv[2] || "").toLowerCase().trim();
  const changeDescription = process.argv.slice(3).join(" ").trim();

  if (!releaseTypeRaw || !TYPE_MAP[releaseTypeRaw]) {
    console.error(`
\x1b[31mError: Missing or invalid release type argument.\x1b[0m

Usage:
  node scripts/bump-version.mjs <type> [description]

Allowed types:
  - \x1b[32mbugfix\x1b[0m (or patch, fix, 3rd)   : Updates 3rd number (e.g. 1.0.36 -> 1.0.37)
  - \x1b[34mfeature\x1b[0m (or minor, feat, middle): Updates middle number (e.g. 1.0.36 -> 1.1.0)
  - \x1b[35mfull\x1b[0m (or major, breaking, 1st)   : Updates 1st number (e.g. 1.0.36 -> 2.0.0)

Example:
  node scripts/bump-version.mjs bugfix "Fix targeting distance rounding"
  node scripts/bump-version.mjs feature "Add companion sheet support"
  node scripts/bump-version.mjs full "Foundry v15 major compatibility release"
`);
    process.exit(1);
  }

  try {
    bumpVersion(releaseTypeRaw, changeDescription);
  } catch (err) {
    console.error(`\x1b[31m✖ Error during version bump:\x1b[0m ${err.message}`);
    process.exit(1);
  }
}
