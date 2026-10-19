#!/usr/bin/env node
/**
 * scripts/build.mjs
 *
 * Packages the module for a release (Foundry VTT packaging guide: runtime files only):
 * - dist/package/  the staged module folder
 * - dist/module.json  the release manifest, with the release version and a tag-specific download URL
 * - dist/module.zip  the module folder zipped at its root, as Foundry installs it
 *
 * The package holds module.json, README.md, LICENSE, styles/, templates/ and scripts/ without the
 * Node tooling: runtime code is .js, so every .mjs file in scripts/ (verify, bump-version, build, ...)
 * stays out.
 *
 * Usage:
 *   node scripts/build.mjs [--tag v2.0.3] [--repo owner/name]
 *
 * --tag   release tag; defaults to `v` + the module.json version.
 * --repo  GitHub repository for the download/manifest URLs; defaults to $GITHUB_REPOSITORY.
 *         Without either, the URLs in module.json are kept (local test builds).
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import semver from "semver";
import yazl from "yazl";
import { isDirectRun, readModuleJson, rootDir } from "./release-utils.mjs";

/** Files and folders copied into the package, relative to the repository root. */
export const PACKAGE_ENTRIES = ["module.json", "README.md", "LICENSE", "styles", "templates", "scripts"];

/**
 * Whether a repository file belongs in the package.
 * @param {string} relPath - path relative to the repository root, with forward slashes
 * @returns {boolean}
 */
export function isPackaged(relPath) {
  return !(relPath.startsWith("scripts/") && relPath.endsWith(".mjs"));
}

/**
 * Lists the files of the package, relative to the repository root, with forward slashes.
 * @returns {string[]}
 */
export function listPackageFiles() {
  const files = [];
  const walk = (relPath) => {
    const full = path.join(rootDir, relPath);
    if (fs.statSync(full).isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) walk(`${relPath}/${name}`);
    } else if (isPackaged(relPath)) {
      files.push(relPath);
    }
  };
  PACKAGE_ENTRIES.forEach(walk);
  return files;
}

/**
 * Builds the release manifest from module.json.
 * @param {string} tag - e.g. "v2.0.3"
 * @param {string|undefined} repo - e.g. "Ethlas/pf2e-mobile-compact"
 * @returns {object}
 */
export function buildManifest(tag, repo) {
  const manifest = readModuleJson();
  manifest.version = tag.replace(/^v/, "");
  if (repo) {
    manifest.download = `https://github.com/${repo}/releases/download/${tag}/module.zip`;
    manifest.manifest = `https://github.com/${repo}/releases/latest/download/module.json`;
  }
  return manifest;
}

/**
 * Zips a folder's files at the root of the archive.
 * @param {string} sourceDir
 * @param {string[]} files - paths relative to sourceDir, with forward slashes
 * @param {string} zipPath
 * @returns {Promise<void>}
 */
function writeZip(sourceDir, files, zipPath) {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    for (const file of files) zip.addFile(path.join(sourceDir, file), file);
    zip.outputStream.pipe(fs.createWriteStream(zipPath)).on("close", resolve).on("error", reject);
    zip.end();
  });
}

/**
 * Stages, writes the manifest and zips the package into dist/.
 * @param {{ tag: string, repo?: string }} options
 * @returns {Promise<{ files: string[], zipPath: string }>}
 */
export async function build({ tag, repo }) {
  if (!semver.valid(tag.replace(/^v/, ""))) {
    throw new Error(`Release tag "${tag}" is not v + a valid SemVer version (MAJOR.MINOR.PATCH).`);
  }

  const distDir = path.join(rootDir, "dist");
  const packageDir = path.join(distDir, "package");
  fs.rmSync(distDir, { recursive: true, force: true });

  const files = listPackageFiles();
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(packageDir, file)), { recursive: true });
    fs.copyFileSync(path.join(rootDir, file), path.join(packageDir, file));
  }

  const manifestJson = JSON.stringify(buildManifest(tag, repo), null, 2) + "\n";
  fs.writeFileSync(path.join(packageDir, "module.json"), manifestJson);
  fs.writeFileSync(path.join(distDir, "module.json"), manifestJson);

  const zipPath = path.join(distDir, "module.zip");
  await writeZip(packageDir, files, zipPath);
  return { files, zipPath };
}

if (isDirectRun(import.meta.url)) {
  const { values } = parseArgs({ options: { tag: { type: "string" }, repo: { type: "string" } } });
  const tag = values.tag || `v${readModuleJson().version}`;
  const repo = values.repo || process.env.GITHUB_REPOSITORY;

  const { files, zipPath } = await build({ tag, repo });

  console.log(`=== Archive contents of ${path.relative(rootDir, zipPath)} (${tag}) ===`);
  for (const file of files) {
    const size = fs.statSync(path.join(rootDir, "dist/package", file)).size;
    console.log(`${String(size).padStart(9)}  ${file}`);
  }
  console.log(`${files.length} files, zip ${fs.statSync(zipPath).size} bytes`);
  if (!repo) console.log("No --repo or $GITHUB_REPOSITORY: download/manifest URLs kept from module.json.");
}
