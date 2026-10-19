#!/usr/bin/env node
/**
 * scripts/release-check.mjs
 *
 * Release gate run by .github/workflows/release.yml on every push (merge) to main. Decides whether
 * this push packages a release and computes its version, and hands them to the next steps as
 * outputs (`tag`, `version`, `should_release`).
 *
 * - Only a `feat` or `fix` Conventional Commit prefix on the merged PR title (or, without a PR,
 *   the commit subject) releases. PR titles are not enforced: any other title just doesn't release.
 * - The version is the highest existing `vX.Y.Z` tag, raised by the prefix:
 *   `fix` -> patch, `feat` -> minor, `!` (e.g. `feat!:`) -> major.
 *   The module.json version in the repository (0.0.0-dev) is only for development checkouts;
 *   build.mjs writes the computed version into the released manifest.
 * - A commit that already has a `v` tag is not released again (e.g. when a finished run is re-run).
 *
 * The GitHub call goes through the `gh` CLI (preinstalled on GitHub runners, authenticated with
 * GH_TOKEN). The tags need the full history (actions/checkout with fetch-depth: 0).
 *
 * Usage: node scripts/release-check.mjs   (reads GITHUB_REPOSITORY and GITHUB_SHA, set by Actions)
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import semver from "semver";
import { isDirectRun, rootDir } from "./release-utils.mjs";

// `feat` or `fix`, optional scope, optional `!` for a breaking change
const RELEASE_HEADER = /^(feat|fix)(\([^)]*\))?(!)?: /;

/**
 * Runs a command and returns its trimmed stdout, or null when it fails.
 * @param {string} cmd
 * @param {string[]} args
 */
function tryRun(cmd, args) {
  try {
    return execFileSync(cmd, args, { cwd: rootDir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/**
 * The semver increment for a Conventional Commit header, or null when it doesn't release.
 * @param {string} header - e.g. "feat(spells): add heightened spell damage button"
 * @returns {"major"|"minor"|"patch"|null}
 */
export function releaseType(header) {
  const match = header.match(RELEASE_HEADER);
  if (!match) return null;
  if (match[3]) return "major";
  return match[1] === "feat" ? "minor" : "patch";
}

/**
 * The next version after the highest `vX.Y.Z` tag (pre-release tags are ignored).
 * @param {string[]} tags - e.g. ["v2.0.2", "v2.0.3"]
 * @param {"major"|"minor"|"patch"} type
 * @returns {string}
 */
export function nextVersion(tags, type) {
  const latest = semver.maxSatisfying(tags.map((tag) => semver.valid(tag)).filter(Boolean), "*") ?? "0.0.0";
  return semver.inc(latest, type);
}

if (isDirectRun(import.meta.url)) {
  const commitSubject = tryRun("git", ["log", "-1", "--pretty=%s"]) ?? "";
  const prTitle = tryRun("gh", ["api", `repos/${process.env.GITHUB_REPOSITORY}/commits/${process.env.GITHUB_SHA}/pulls`, "--jq", ".[0].title // empty"]) ?? "";
  console.log(`Commit subject : ${commitSubject}`);
  console.log(`Merged PR title: ${prTitle}`);

  const type = releaseType(prTitle || commitSubject);
  const existingTag = tryRun("git", ["tag", "--points-at", "HEAD", "--list", "v*"]);
  let outputs = "should_release=false\n";

  if (!type) {
    console.log("No 'fix' or 'feat' Conventional Commit prefix. Skipping module packaging.");
  } else if (existingTag) {
    console.log(`This commit is already released as ${existingTag}. Skipping.`);
  } else {
    const version = nextVersion((tryRun("git", ["tag", "--list", "v*"]) ?? "").split("\n"), type);
    console.log(`Releasing ${type} version ${version} with tag v${version}`);
    outputs = `tag=v${version}\nversion=${version}\nshould_release=true\n`;
  }

  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, outputs);
  console.log(outputs);
}
