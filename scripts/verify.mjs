import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir = process.cwd();
let errorCount = 0;
let warningCount = 0;

function logPass(msg) {
  console.log(`\x1b[32m✔ [PASS]\x1b[0m ${msg}`);
}

function logFail(msg) {
  console.error(`\x1b[31m✖ [FAIL]\x1b[0m ${msg}`);
  errorCount++;
}

function logWarn(msg) {
  console.warn(`\x1b[33m▲ [WARN]\x1b[0m ${msg}`);
  warningCount++;
}

console.log("\n🔍 Running PF2e Mobile Sheet Static Verifications...\n");

// 1. Check JavaScript Syntax & Full ESM Evaluation
console.log("--- 1. JavaScript Syntax & ESM Module Tree Verification ---");

// Mock global Foundry runtime environment so ES modules can be evaluated cleanly
global.foundry = {
  applications: {
    api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (b) => b, DialogV2: class {} },
    sheets: { ActorSheetV2: class {} }
  },
  documents: { collections: { Actors: class {} } },
  audio: { AudioHelper: class {} }
};
global.CONFIG = { PF2E: {}, Actor: {}, User: {} };
global.Hooks = { once: () => {}, on: () => {}, off: () => {} };
global.Handlebars = { helpers: {}, registerHelper: () => {} };
global.game = { settings: { register: () => {}, get: () => "auto" }, user: { id: "test-user" } };

async function checkJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await checkJsFiles(fullPath);
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) {
      if (entry.name === "verify.mjs") continue;
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
      try {
        await import(`../${relPath}`);
        logPass(`Syntax & ESM valid: ${relPath}`);
      } catch (err) {
        logFail(`Syntax/ESM error in ${relPath}:\n${err.stack || err.message}`);
      }

      // Check for illegal this.# private field accesses that trigger TS1111 in IDEs
      const fileContent = fs.readFileSync(fullPath, "utf-8");
      const staticWithPrivateThis = fileContent.match(/static\s+(?:async\s+)?(?:#?[a-zA-Z_]\w*)\s*\([^)]*\)\s*\{[^}]*\bthis\.#[a-zA-Z_]\w*/g);
      if (staticWithPrivateThis) {
        logFail(`TS1111 Violation in ${relPath}: accessing this.# inside static method causes 'Private field must be declared in enclosing class' IDE errors.`);
      }
    }
  }
}
await checkJsFiles(path.join(rootDir, "scripts"));

// 2. Check Module JSON Integrity
console.log("\n--- 2. module.json Verification ---");
const moduleJsonPath = path.join(rootDir, "module.json");
if (fs.existsSync(moduleJsonPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(moduleJsonPath, "utf-8"));
    if (!data.id) logFail("module.json is missing 'id' field.");
    else if (!data.version) logFail("module.json is missing 'version' field.");
    else if (!data.compatibility) logWarn("module.json is missing 'compatibility' section.");
    else logPass(`module.json valid (id: ${data.id}, version: ${data.version})`);
  } catch (err) {
    logFail(`module.json contains invalid JSON: ${err.message}`);
  }
} else {
  logFail("module.json not found.");
}

// 3. Check Handlebars Templates
console.log("\n--- 3. Handlebars Template Verifications ---");
function checkHbsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkHbsFiles(fullPath);
    } else if (entry.name.endsWith(".hbs")) {
      const relPath = path.relative(rootDir, fullPath);
      const content = fs.readFileSync(fullPath, "utf-8");

      // Critical Mobile UX rule: No data-action on <select> elements
      const selectWithDataActionRegex = /<select[^>]*\bdata-action\b[^>]*>/gi;
      let match;
      while ((match = selectWithDataActionRegex.exec(content)) !== null) {
        logFail(`Mobile UX Violation in ${relPath}: <select> has 'data-action'. Use 'data-change-action' and e.stopPropagation() instead to prevent click-suppression on mobile.`);
      }

      // Check balanced block helpers
      const blocks = ["if", "each", "unless", "with"];
      for (const block of blocks) {
        const openMatches = content.match(new RegExp(`{{#${block}\\b`, "g")) || [];
        const closeMatches = content.match(new RegExp(`{{/${block}}}`, "g")) || [];
        if (openMatches.length !== closeMatches.length) {
          logFail(`Unbalanced {{#${block}}} in ${relPath}: ${openMatches.length} opened vs ${closeMatches.length} closed.`);
        }
      }

      // Check for unclosed HTML tags like <div>
      const divOpen = (content.match(/<div\b/gi) || []).length;
      const divClose = (content.match(/<\/div>/gi) || []).length;
      if (divOpen !== divClose) {
        logWarn(`Potential tag mismatch in ${relPath}: ${divOpen} <div opened vs ${divClose} </div> closed.`);
      }

      logPass(`Template checks completed: ${relPath}`);
    }
  }
}
checkHbsFiles(path.join(rootDir, "templates"));

// 4. Action Binding Cross-Check
console.log("\n--- 4. Template-to-Script Action Verification ---");
function extractRegisteredActions(scriptPath) {
  if (!fs.existsSync(scriptPath)) return new Set();
  const content = fs.readFileSync(scriptPath, "utf-8");
  const actionsMatch = content.match(/actions:\s*{([^}]+)}/s);
  if (!actionsMatch) return new Set();
  const actionLines = actionsMatch[1].split("\n");
  const registered = new Set();
  for (const line of actionLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("//")) {
      const key = trimmed.split(":")[0]?.trim();
      if (key) registered.add(key);
    }
  }
  return registered;
}

const sheetActions = extractRegisteredActions(path.join(rootDir, "scripts/apps/mobile-sheet.js"));
const pickerActions = extractRegisteredActions(path.join(rootDir, "scripts/apps/compendium-picker.js"));
const diceActions = extractRegisteredActions(path.join(rootDir, "scripts/apps/physical-dice-dialog.js"));
// Actions handled via inline event listeners in ad-hoc dialogs (DialogV2 / Dialog)
const inlineDialogActions = new Set(["confirmPrepareSpell"]);
const allActions = new Set([...sheetActions, ...pickerActions, ...diceActions, ...inlineDialogActions]);

// Scan templates for data-action values
function checkActionsInTemplates(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkActionsInTemplates(fullPath);
    } else if (entry.name.endsWith(".hbs")) {
      const relPath = path.relative(rootDir, fullPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      const actionRegex = /\bdata-action="([^"]+)"/g;
      let m;
      while ((m = actionRegex.exec(content)) !== null) {
        const actionName = m[1];
        if (!allActions.has(actionName)) {
          logWarn(`Unregistered action '${actionName}' in ${relPath} (not found in Application actions map).`);
        }
      }
    }
  }
}
checkActionsInTemplates(path.join(rootDir, "templates"));

// 4b. Property Rune Slug Format Check
console.log("\n--- 4b. PF2e Property Rune Slug Verification ---");
const runeDataPath = path.join(rootDir, "scripts/apps/sheet-helpers/rune-data.js");
if (fs.existsSync(runeDataPath)) {
  const runeSrc = fs.readFileSync(runeDataPath, "utf-8");
  // PF2e stores property runes under camelCase slugs ("greaterFlaming", "ghostTouch").
  // A kebab-case key here is a slug PF2e cannot resolve; its data preparation then
  // throws on RUNE_DATA.<type>.property[slug].damage while building strikes.
  const badSlugs = [];
  const tableRegex = /export const (WEAPON|ARMOR)_PROPERTY_RUNES = \{([\s\S]*?)\n\};/g;
  let tableMatch;
  let tablesFound = 0;
  while ((tableMatch = tableRegex.exec(runeSrc)) !== null) {
    tablesFound++;
    const keyRegex = /^\s{2}"?([A-Za-z0-9_-]+)"?\s*:/gm;
    let keyMatch;
    while ((keyMatch = keyRegex.exec(tableMatch[2])) !== null) {
      if (keyMatch[1].includes("-")) badSlugs.push(`${tableMatch[1]}: ${keyMatch[1]}`);
    }
  }
  if (tablesFound !== 2) {
    logFail(`Expected 2 property rune tables in rune-data.js, found ${tablesFound}.`);
  } else if (badSlugs.length > 0) {
    for (const bad of badSlugs) {
      logFail(`Kebab-case property rune slug '${bad}'. PF2e uses camelCase (e.g. greaterFlaming, ghostTouch); a mismatched slug throws during item data preparation.`);
    }
  } else {
    logPass("All property rune slugs are camelCase.");
  }
}

// 5. CSS Minimum Touch Target & Brace Balance Check
console.log("\n--- 5. Mobile CSS Touch Target & Syntax Audit ---");
const cssPath = path.join(rootDir, "styles/pf2e-mobile.css");
if (fs.existsSync(cssPath)) {
  const cssContent = fs.readFileSync(cssPath, "utf-8");
  const strippedCss = cssContent.replace(/\/\*[\s\S]*?\*\//g, "");
  let braceDepth = 0;
  let braceError = false;
  const cssLines = strippedCss.split("\n");
  for (let i = 0; i < cssLines.length; i++) {
    for (const ch of cssLines[i]) {
      if (ch === "{") braceDepth++;
      else if (ch === "}") {
        braceDepth--;
        if (braceDepth < 0) {
          logFail(`Unmatched closing '}' in styles/pf2e-mobile.css at line ${i + 1}`);
          braceError = true;
          braceDepth = 0;
        }
      }
    }
  }
  if (braceDepth !== 0) {
    logFail(`Unbalanced braces in styles/pf2e-mobile.css (remaining depth: ${braceDepth})`);
    braceError = true;
  }
  if (!braceError) {
    logPass("CSS brace balance valid in styles/pf2e-mobile.css.");
  }

  // Look for fixed heights under 36px on buttons
  const smallButtonMatches = cssContent.match(/\.btn-[a-zA-Z0-9_-]+\s*{[^}]*height:\s*([1-2][0-9]|3[0-5])px/g);
  if (smallButtonMatches) {
    for (const match of smallButtonMatches) {
      logWarn(`Button with height < 36px found in CSS:\n${match}`);
    }
  } else {
    logPass("No button styles with height < 36px detected.");
  }
}

// Summary
console.log("\n==========================================");
if (errorCount === 0 && warningCount === 0) {
  console.log("\x1b[32m✔ All static verifications passed with 0 errors and 0 warnings!\x1b[0m");
} else if (errorCount === 0) {
  console.log(`\x1b[33m✔ Verifications passed with ${warningCount} non-critical warning(s).\x1b[0m`);
} else {
  console.error(`\x1b[31m✖ Verifications failed with ${errorCount} error(s) and ${warningCount} warning(s).\x1b[0m`);
}
console.log("==========================================\n");

process.exit(errorCount > 0 ? 1 : 0);

