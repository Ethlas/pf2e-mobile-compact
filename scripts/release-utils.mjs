/**
 * scripts/release-utils.mjs
 *
 * Shared helpers for the release tooling (check-pr.mjs, release-check.mjs, build.mjs):
 * - Conventional Commits v1.0.0 title parsing (one regex for the PR check and the release gate)
 * - reading the module version from module.json
 * - writing step outputs for GitHub Actions ($GITHUB_OUTPUT)
 *
 * Node tooling only: like every .mjs file in scripts/, this file is not packaged into module.zip.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Conventional Commit types accepted in PR titles. */
export const COMMIT_TYPES = ["build", "chore", "ci", "docs", "feat", "fix", "perf", "refactor", "revert", "style", "test"];

/** Commit types that package a new module release when merged into main. */
export const RELEASE_TYPES = ["feat", "fix"];

// <type>[optional scope][!]: <description>
const HEADER_PATTERN = new RegExp(`^(${COMMIT_TYPES.join("|")})(\\(([a-zA-Z0-9_./-]+)\\))?(!)?:\\s+(.+)$`);

/**
 * Parses a Conventional Commits v1.0.0 header (a PR title or a commit subject).
 * @param {string} header - e.g. "fix(webkit): draw custom arrows on header dropdowns"
 * @returns {{ type: string, scope: string|null, breaking: boolean, description: string, isRelease: boolean }|null}
 *   null when the header does not follow the format or uses an unknown type.
 */
export function parseCommitHeader(header) {
  const match = (header || "").trim().match(HEADER_PATTERN);
  if (!match) return null;
  const [, type, , scope = null, bang, description] = match;
  return { type, scope, breaking: Boolean(bang), description, isRelease: RELEASE_TYPES.includes(type) };
}

/**
 * Reads module.json from the repository root.
 * @returns {object} The parsed manifest.
 */
export function readModuleJson() {
  return JSON.parse(fs.readFileSync(path.join(rootDir, "module.json"), "utf-8"));
}

/**
 * Sets step outputs for GitHub Actions. Outside Actions ($GITHUB_OUTPUT unset) it only logs them.
 * @param {Record<string, string|boolean>} outputs
 */
export function setGithubOutputs(outputs) {
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
  }
  for (const line of lines) console.log(`  output ${line}`);
}

/**
 * True when the given module file is the script Node was started with (not imported, e.g. by verify.mjs).
 * @param {string} moduleUrl - import.meta.url of the calling module
 */
export function isDirectRun(moduleUrl) {
  return Boolean(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(moduleUrl));
}
