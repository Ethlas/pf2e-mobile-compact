#!/usr/bin/env node
/**
 * scripts/check-pr.mjs
 *
 * Pull request gate run by .github/workflows/ci-verify.yml:
 * 1. The PR title must follow Conventional Commits v1.0.0 (`<type>[optional scope][!]: <description>`).
 * 2. A `feat:` or `fix:` PR packages a release when merged, so it must raise the module.json version
 *    above the base branch, to a version whose `v` tag does not exist yet.
 *
 * Usage (needs the base branch fetched, e.g. actions/checkout with fetch-depth: 0):
 *   PR_TITLE="fix: something" BASE_REF=main node scripts/check-pr.mjs
 *   node scripts/check-pr.mjs "fix: something" [baseRef]
 */

import { execFileSync } from "node:child_process";
import semver from "semver";
import { COMMIT_TYPES, isDirectRun, parseCommitHeader, readModuleJson, rootDir } from "./release-utils.mjs";

/**
 * Reads the module.json version on the base branch.
 * @param {string} baseRef - e.g. "main"
 * @returns {string|null} null when origin/<baseRef> has no readable module.json
 */
function readBaseVersion(baseRef) {
  try {
    const raw = execFileSync("git", ["show", `origin/${baseRef}:module.json`], { cwd: rootDir, encoding: "utf-8" });
    return JSON.parse(raw).version;
  } catch (err) {
    console.warn(`Could not read module.json from origin/${baseRef}: ${err.message}`);
    return null;
  }
}

/**
 * @param {string} tag - e.g. "v2.0.3"
 * @returns {boolean}
 */
function tagExists(tag) {
  try {
    execFileSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], { cwd: rootDir, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs the PR checks and prints the result.
 * @param {string} prTitle
 * @param {string} baseRef
 * @returns {boolean} true when the PR passes
 */
export function checkPullRequest(prTitle, baseRef) {
  console.log(`PR Title: "${prTitle}"`);

  const commit = parseCommitHeader(prTitle);
  if (!commit) {
    console.error(`\n✖ ERROR: Pull Request title must follow Conventional Commits v1.0.0 format:`);
    console.error(`  <type>[optional scope][!]: <description>`);
    console.error(`  Specification: https://www.conventionalcommits.org/en/v1.0.0/`);
    console.error(`  Allowed types: ${COMMIT_TYPES.join(", ")}`);
    console.error(`  Examples:`);
    console.error(`    fix(webkit): draw custom arrows on header dropdowns`);
    console.error(`    feat(spells): add heightened spell damage button`);
    console.error(`    ci(workflow): require conventional commit prefix on PRs`);
    return false;
  }

  const prVersion = readModuleJson().version;
  const baseVersion = readBaseVersion(baseRef) ?? "0.0.0";

  console.log(`Conventional Commit Type : ${commit.type}${commit.scope ? `(${commit.scope})` : ""}${commit.breaking ? "!" : ""}`);
  console.log(`Triggers Release Package : ${commit.isRelease ? "YES (fix/feat)" : "NO"}`);
  console.log(`Base (${baseRef}) version      : ${baseVersion}`);
  console.log(`PR head version          : ${prVersion}`);

  if (!commit.isRelease) {
    console.log(`✔ Non-release PR prefix "${commit.type}:" verified (module packaging will be skipped on merge).`);
    return true;
  }

  for (const [label, version] of [["module.json", prVersion], [`${baseRef} module.json`, baseVersion]]) {
    if (!semver.valid(version)) {
      console.error(`\n✖ ERROR: Invalid SemVer "${version}" in ${label} (expected MAJOR.MINOR.PATCH)`);
      return false;
    }
  }

  if (!semver.gt(prVersion, baseVersion)) {
    console.error(`\n✖ ERROR: PR has release prefix "${commit.type}:" so module.json version (${prVersion}) must be incremented above ${baseRef} (${baseVersion}).`);
    console.error(`  Run: node scripts/bump-version.mjs ${commit.type === "feat" ? "feature" : "bugfix"} "Brief description"`);
    return false;
  }

  if (tagExists(`v${prVersion}`)) {
    console.error(`\n✖ ERROR: Git tag "v${prVersion}" already exists. Please increment module.json to a new unused version.`);
    return false;
  }

  console.log(`✔ Release PR verified: "${commit.type}:" prefix with version increment ${baseVersion} -> ${prVersion} (tag v${prVersion} is available)`);
  return true;
}

if (isDirectRun(import.meta.url)) {
  const prTitle = process.argv[2] ?? process.env.PR_TITLE ?? "";
  const baseRef = process.argv[3] ?? process.env.BASE_REF ?? "main";
  if (!checkPullRequest(prTitle, baseRef)) process.exit(1);
}
