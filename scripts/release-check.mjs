#!/usr/bin/env node
/**
 * scripts/release-check.mjs
 *
 * Release gate run by .github/workflows/release.yml on every push (merge) to main. Works out the
 * release tag and version and whether this push should package a release, and hands them to the
 * next steps as outputs (`tag`, `version`, `should_release`).
 *
 * - The tag is `v` + the module.json version.
 * - A release is only packaged when the merged PR title or the commit subject has a `feat:` or
 *   `fix:` Conventional Commit prefix, and when no release with that tag exists yet.
 *
 * The GitHub calls go through the `gh` CLI (preinstalled on GitHub runners, authenticated with GH_TOKEN).
 *
 * Usage: node scripts/release-check.mjs   (reads GITHUB_REPOSITORY and GITHUB_SHA, set by Actions)
 */

import { execFileSync } from "node:child_process";
import semver from "semver";
import { isDirectRun, parseCommitHeader, readModuleJson, rootDir, setGithubOutputs } from "./release-utils.mjs";

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
 * Decides whether this push should package a release.
 * @param {NodeJS.ProcessEnv} env
 * @param {string} tag
 * @returns {boolean}
 */
export function shouldRelease(env, tag) {
  const commitSubject = tryRun("git", ["log", "-1", "--pretty=%s"]) ?? "";
  const prTitle = tryRun("gh", ["api", `repos/${env.GITHUB_REPOSITORY}/commits/${env.GITHUB_SHA}/pulls`, "--jq", ".[0].title // empty"]) ?? "";

  console.log(`Commit subject : ${commitSubject}`);
  console.log(`Merged PR title: ${prTitle}`);

  if (!parseCommitHeader(prTitle)?.isRelease && !parseCommitHeader(commitSubject)?.isRelease) {
    console.log("Commit/PR does not have a 'fix' or 'feat' Conventional Commit prefix. Skipping module packaging.");
    return false;
  }

  if (tryRun("gh", ["release", "view", tag]) !== null) {
    console.log(`Release ${tag} already exists. Skipping duplicate packaging.`);
    return false;
  }

  return true;
}

if (isDirectRun(import.meta.url)) {
  const version = readModuleJson().version;
  if (!semver.valid(version)) {
    throw new Error(`module.json version "${version}" is not valid SemVer (MAJOR.MINOR.PATCH).`);
  }
  const tag = `v${version}`;
  const release = shouldRelease(process.env, tag);

  if (release) console.log(`Releasing version ${version} with tag ${tag}`);
  setGithubOutputs({ tag, version, should_release: release });
}
