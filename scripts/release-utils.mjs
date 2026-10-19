/**
 * scripts/release-utils.mjs
 *
 * Shared helpers for the release tooling (release-check.mjs, build.mjs): the repository root,
 * reading module.json, and telling a direct run from an import (verify.mjs imports every .mjs file).
 *
 * Node tooling only: like every .mjs file in scripts/, this file is not packaged into module.zip.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Reads module.json from the repository root.
 * @returns {object} The parsed manifest.
 */
export function readModuleJson() {
  return JSON.parse(fs.readFileSync(path.join(rootDir, "module.json"), "utf-8"));
}

/**
 * True when the given module file is the script Node was started with (not imported, e.g. by verify.mjs).
 * @param {string} moduleUrl - import.meta.url of the calling module
 */
export function isDirectRun(moduleUrl) {
  return Boolean(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(moduleUrl));
}
