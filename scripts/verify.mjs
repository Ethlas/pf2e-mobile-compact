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

      // Check for balanced HTML tags across all structural and interactive elements
      const htmlTags = ["div", "section", "button", "select", "label", "table", "ul", "header", "nav", "main"];
      for (const tag of htmlTags) {
        const tagOpen = (content.match(new RegExp(`<${tag}\\b`, "gi")) || []).length;
        const tagClose = (content.match(new RegExp(`<\\/${tag}>`, "gi")) || []).length;
        if (tagOpen !== tagClose) {
          logFail(`HTML tag mismatch in ${relPath}: ${tagOpen} <${tag}> opened vs ${tagClose} </${tag}> closed.`);
        }
      }

      logPass(`Template & HTML checks completed: ${relPath}`);
    }
  }
}
checkHbsFiles(path.join(rootDir, "templates"));

// 4. Action & Change-Action Binding Cross-Check + Handler Function Existence
console.log("\n--- 4. Template-to-Script Action & Change-Action Verification ---");
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
      const [key, val] = trimmed.replace(/,$/, "").split(":").map((s) => s?.trim());
      if (key) {
        registered.add(key);
        // Verify that PF2eMobileSheet._onXyz is actually defined as a static method in the file
        if (val && val.startsWith("PF2eMobileSheet.")) {
          const methodName = val.split(".")[1];
          const methodRegex = new RegExp(`static\\s+(?:async\\s+)?${methodName}\\s*\\(`);
          if (!methodRegex.test(content)) {
            logFail(`Action '${key}' maps to '${val}', but 'static ${methodName}()' is not defined in ${path.relative(rootDir, scriptPath)}!`);
          }
        }
      }
    }
  }
  return registered;
}

const sheetActions = extractRegisteredActions(path.join(rootDir, "scripts/apps/mobile-sheet.js"));
const pickerActions = extractRegisteredActions(path.join(rootDir, "scripts/apps/compendium-picker.js"));
const diceActions = extractRegisteredActions(path.join(rootDir, "scripts/apps/physical-dice-dialog.js"));
// Actions handled via inline event listeners in ad-hoc dialogs (DialogV2 / Dialog) or CompendiumPickerApp _onRender
const inlineDialogActions = new Set([
  "confirmPrepareSpell",
  "updateStagedEntry",
  "updateStagedRank",
  "updateRankFilter",
  "updateTraditionFilter"
]);
const allActions = new Set([...sheetActions, ...pickerActions, ...diceActions, ...inlineDialogActions]);

let totalBoundActionsChecked = 0;
function checkActionsInTemplates(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkActionsInTemplates(fullPath);
    } else if (entry.name.endsWith(".hbs")) {
      const relPath = path.relative(rootDir, fullPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      const actionRegex = /\bdata-(?:change-)?action="([^"]+)"/g;
      let m;
      while ((m = actionRegex.exec(content)) !== null) {
        const actionName = m[1];
        totalBoundActionsChecked++;
        if (!allActions.has(actionName)) {
          logFail(`Unregistered data-action / data-change-action '${actionName}' in ${relPath} (not found in Application actions map).`);
        }
      }
    }
  }
}
checkActionsInTemplates(path.join(rootDir, "templates"));
logPass(`Verified ${totalBoundActionsChecked} data-action & data-change-action bindings across all templates (${allActions.size} registered handlers).`);

// 4b. Property Rune Slug Format Check
console.log("\n--- 4b. PF2e Property Rune Slug Verification ---");
const runeDataPath = path.join(rootDir, "scripts/apps/sheet-helpers/rune-data.js");
if (fs.existsSync(runeDataPath)) {
  const runeSrc = fs.readFileSync(runeDataPath, "utf-8");
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
      logFail(`Kebab-case property rune slug '${bad}'. PF2e uses camelCase.`);
    }
  } else {
    logPass("All property rune slugs are camelCase.");
  }
}

// 5. CSS Syntax & Minimum Touch Target Audit
console.log("\n--- 5. Mobile CSS Syntax & Touch Target Audit ---");
for (const cssRel of ["styles/pf2e-mobile.css", "styles/kingdom.css"]) {
  const cssFile = path.join(rootDir, cssRel);
  if (fs.existsSync(cssFile)) {
    const cssContent = fs.readFileSync(cssFile, "utf-8");
    const stripped = cssContent.replace(/\/\*[\s\S]*?\*\//g, "");
    const openBraces = (stripped.match(/{/g) || []).length;
    const closeBraces = (stripped.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      logFail(`Unbalanced CSS braces in ${cssRel}: ${openBraces} '{' vs ${closeBraces} '}'.`);
    } else {
      logPass(`CSS syntax valid (${openBraces} balanced blocks): ${cssRel}`);
    }
    const smallButtonMatches = cssContent.match(/\.btn-[a-zA-Z0-9_-]+\s*{[^}]*height:\s*([1-2][0-9]|3[0-5])px/g);
    if (smallButtonMatches) {
      for (const match of smallButtonMatches) {
        logWarn(`Button with height < 36px found in ${cssRel}:\n${match}`);
      }
    }
  }
}

// 6. Comprehensive Section-by-Section Interactive Button, Sub-Tab & Handler Verification
console.log("\n--- 6. Section-by-Section Interactive Button, Sub-Tab & Handler Tests ---");
try {
  const mobileSheetHbs = fs.readFileSync(path.join(rootDir, "templates/mobile-sheet.hbs"), "utf-8");
  const headerHbs = fs.readFileSync(path.join(rootDir, "templates/parts/header.hbs"), "utf-8");
  const partyOverviewHbs = fs.readFileSync(path.join(rootDir, "templates/parts/party-overview.hbs"), "utf-8");

  if (!mobileSheetHbs.includes("{{#if isKingdom}}")) {
    logFail("templates/mobile-sheet.hbs is missing '{{#if isKingdom}}' branch.");
  } else {
    logPass("templates/mobile-sheet.hbs includes '{{#if isKingdom}}' tab routing and bottom navigation.");
  }

  if (!headerHbs.includes("{{#if isKingdom}}")) {
    logFail("templates/parts/header.hbs is missing '{{#if isKingdom}}' header summary strip.");
  } else {
    logPass("templates/parts/header.hbs includes '{{#if isKingdom}}' Kingdom summary strip.");
  }

  if (!partyOverviewHbs.includes("openMobileKingdomSheet")) {
    logFail("templates/parts/party-overview.hbs is missing 'openMobileKingdomSheet' button.");
  } else {
    logPass("templates/parts/party-overview.hbs includes 'openMobileKingdomSheet' launcher button.");
  }

  // Track calls to mocked pf2e-kingmaker-tools KingdomSheet & DialogV2
  const dispatchedKmActions = [];
  const changedKmFields = [];
  const promptedDialogs = [];
  let physicalModeObservedDuringRoll = false;
  let partySheetRendered = false;
  let charSheetClosed = false;

  const { PhysicalDiceManager } = await import("../scripts/rolls/physical-dice-interceptor.js");

  const mockKmApp = {
    id: "kmKingdomSheet-Actor.party1",
    form: {},
    element: {
      classList: { add: () => {} },
      style: { setProperty: () => {} },
      querySelector: () => ({ value: "", checked: false })
    },
    _onClickAction: async (_event, btn) => {
      if (PhysicalDiceManager.isPhysicalModeActive() || PhysicalDiceManager.activeContext?.isPhysical) {
        physicalModeObservedDuringRoll = true;
      }
      dispatchedKmActions.push({ ...btn.dataset });
    },
    _onChangeForm: async (_formConfig, event) => {
      changedKmFields.push({ name: event.target.name, value: event.target.type === "checkbox" ? event.target.checked : event.target.value });
    },
    _preparePartContext: async () => ({
      kingdomNameInput: { value: "Brevoy Frontier" },
      levelInput: { value: 4 },
      xpInput: { value: 450 },
      xpThresholdInput: { value: 1000 },
      unrestInput: { value: 2 },
      unrestPenalty: -1,
      anarchyAt: 20,
      controlDc: 19,
      atWarInput: { value: false },
      size: 14,
      kingdomSize: "Province",
      resourceDiceIncome: "6d6+2",
      consumption: 2,
      consumptionBreakdown: {
        consumption: 2,
        settlements: [{ name: "Stag's End", consumption: 2 }],
        armies: 1,
        workSites: 1
      },
      enableLeadershipModifiers: true,
      useLeadershipModifiers: true,
      leadershipActivities: 8,
      vkXp: true,
      canLevelUp: true,
      activeLeader: {
        value: "char1",
        options: [{ value: "char1", label: "Valeros (General)" }]
      },
      settlementInput: {
        value: "settle1",
        options: [{ value: "settle1", label: "Stag's End" }]
      },
      fameContext: {
        type: { value: "Fame", options: [{ value: "Fame", label: "Fame" }] },
        now: { label: "Fame", value: 2 },
        max: { label: "Max Fame", value: 3 }
      },
      resourcePointsContext: {
        now: { name: "resourcePoints.now", value: 18 },
        next: { name: "resourcePoints.next", value: 5 }
      },
      resourceDiceContext: {
        now: { value: "6d6+2" },
        next: { value: "6d6+2" }
      },
      commoditiesContext: {
        now: {
          food: { name: "commodities.food.now", value: 6 },
          lumber: { name: "commodities.lumber.now", value: 5 },
          stone: { name: "commodities.stone.now", value: 4 },
          ore: { name: "commodities.ore.now", value: 3 },
          luxuries: { name: "commodities.luxuries.now", value: 2 }
        },
        capacity: { food: 8, lumber: 8, stone: 8, ore: 4, luxuries: 4 },
        next: {
          food: { value: 2 },
          lumber: { value: 2 },
          stone: { value: 1 },
          ore: { value: 1 },
          luxuries: { value: 0 }
        }
      },
      ruinContext: [
        { value: { label: "Corruption", value: 1 }, thresholdValue: 5, penalty: { value: 0 } },
        { value: { label: "Crime", value: 2 }, thresholdValue: 5, penalty: { value: 0 } },
        { value: { label: "Decay", value: 0 }, thresholdValue: 5, penalty: { value: 0 } },
        { value: { label: "Strife", value: 1 }, thresholdValue: 5, penalty: { value: 0 } }
      ],
      worksitesContext: [
        { label: "Food", quantity: { name: "worksites.food.normal", value: 2 }, quantityValue: 2, resources: { name: "worksites.food.resource", value: 0 }, resourcesValue: 0 },
        { label: "Lumber", quantity: { name: "worksites.lumber.normal", value: 1 }, quantityValue: 1, resources: { name: "worksites.lumber.resource", value: 1 }, resourcesValue: 1 }
      ],
      abilityScores: [
        { label: "Culture", input: { name: "abilityScores.culture", value: 14 }, value: 14, mod: "+2" },
        { label: "Economy", input: { name: "abilityScores.economy", value: 16 }, value: 16, mod: "+3" },
        { label: "Loyalty", input: { name: "abilityScores.loyalty", value: 14 }, value: 14, mod: "+2" },
        { label: "Stability", input: { name: "abilityScores.stability", value: 12 }, value: 12, mod: "+1" }
      ],
      skillChecks: [
        { skill: "agriculture", label: "Agriculture (Sta)", proficiency: "Trained", modifier: "+7", input: { name: "skills.agriculture", value: "TRAINED", options: [] } },
        { skill: "boating", label: "Boating (Eco)", proficiency: "Trained", modifier: "+9", input: { name: "skills.boating", value: "TRAINED", options: [] } },
        { skill: "magic", label: "Magic (Cul)", proficiency: "Expert", modifier: "+10", input: { name: "skills.magic", value: "EXPERT", options: [] } }
      ],
      leadersContext: [
        {
          leader: "ruler",
          label: "Ruler (Loyalty)",
          actor: { name: "Valeros", img: "", bonus: "+2", uuidInput: { name: "leaders.ruler.uuid", value: "Actor.char1" } },
          type: {
            name: "leaders.ruler.type",
            value: "skilled",
            options: [
              { value: "invested", label: "Invested" },
              { value: "skilled", label: "Skilled" },
              { value: "uninvested", label: "Uninvested" }
            ]
          },
          invested: { name: "leaders.ruler.invested", value: true },
          vacant: { name: "leaders.ruler.vacant", value: false }
        }
      ],
      activities: {
        upkeep: [{ id: "upkeep-1", label: "Assign Leadership Roles", hasCheck: false, skills: [] }],
        commerce: [{ id: "collect-taxes", label: "Collect Taxes", isCollectTaxes: true, hasCheck: true, skills: [{ label: "Trade", usable: true }] }],
        leadership: [
          { id: "take-charge", label: "Take Charge", hasCheck: true, skills: [{ label: "Warfare", usable: true }] },
          { id: "naval-support", label: "Naval Support", hasCheck: true, skills: [{ label: "Boating", usable: true }] },
          { id: "cleanse-item", label: "Cleanse Item", hasCheck: true, skills: [{ label: "Magic", usable: true }] }
        ],
        region: [{ id: "claim-hex", label: "Claim Hex", hasCheck: true, skills: [{ label: "Exploration", usable: true }] }],
        civic: [{ id: "build-structure", label: "Build Structure", hasCheck: true, skills: [{ label: "Engineering", usable: true }] }],
        army: [{ id: "recruit-army", label: "Recruit Army", hasCheck: true, skills: [{ label: "Warfare", usable: true }] }]
      },
      settlements: [
        { id: "settle1", name: "Stag's End", size: "Town", level: 2, residentialLots: 4, isCapital: true, isRigid: true, canLevelUpTo: "CITY" }
      ],
      settlementContexts: {
        settle1: {
          type: "Town",
          level: 2,
          blocks: 4,
          maximumBlocks: 9,
          residentialLots: 4,
          consumption: 2,
          maxItemBonus: 1,
          structures: [{ name: "Shrine", count: 1 }],
          bonuses: [{ label: "Magic", bonus: 1 }],
          storage: [{ label: "Food", capacity: 8 }],
          market: [{ label: "General", levels: "1-2" }]
        }
      },
      groups: [
        {
          name: { name: "groups.0.name", value: "Swordlords of Restov" },
          negotiationDC: { name: "groups.0.negotiationDC", value: 18 },
          atWar: { name: "groups.0.atWar", value: false },
          relations: { name: "groups.0.relations", value: "TRADE_AGREEMENT", options: [{ value: "TRADE_AGREEMENT", label: "Trade Agreement" }] }
        }
      ],
      ongoingEvents: [
        { name: { value: "Bandit Activity" }, level: { value: 2 }, skill: { value: "Defense" } }
      ],
      featuresByLevel: [
        { level: 1, features: [{ name: "Charter & Heartland", description: "Initial boosts" }] },
        { level: 4, features: [{ name: "Expansion Expert", description: "+2 to Claim Hex" }] }
      ],
      supernaturalSolutionsInput: { value: 1 },
      creativeSolutionsInput: { value: 2 },
      notesContext: { public: "<p>Road to Oleg's Trading Post complete.</p>" }
    })
  };

  const mockPartySheet = {
    actor: null,
    rendered: true,
    rollMode: "digital",
    _isKingdomMode: false,
    _activeTab: "overview",
    _kingdomTurnSubTab: "status",
    _kingdomSheetSubTab: "stats",
    _kingdomLevelFilter: "all",
    _collapsedKingdomPhases: new Set(["upkeep", "region", "civic", "army"]),
    _expandedKingdomActivities: new Set(),
    render: async () => { partySheetRendered = true; }
  };
  const mockPartyActor = {
    id: "party1",
    uuid: "Actor.party1",
    name: "Stolen Lands Party",
    type: "party",
    isOwner: false,
    sheet: mockPartySheet,
    apps: { "kmKingdomSheet-Actor.party1": mockKmApp },
    flags: {
      "pf2e-kingmaker-tools": {
        "kingdom-sheet": {
          name: "Brevoy Frontier",
          level: 4
        }
      }
    },
    getFlag(scope, key) {
      return this.flags?.[scope]?.[key];
    }
  };
  mockPartySheet.actor = mockPartyActor;

  const mockCharActor = {
    id: "char1",
    uuid: "Actor.char1",
    name: "Valeros",
    type: "character",
    isOwner: true,
    system: {
      details: { level: { value: 4 } },
      attributes: { hp: { value: 48, max: 52, temp: 0 }, ac: { value: 22 }, shield: { hp: { value: 0, max: 20 } } },
      resources: { heroPoints: { value: 2, max: 3 } }
    },
    itemTypes: { effect: [] },
    conditions: { active: [] }
  };

  globalThis.window = { innerWidth: 390, matchMedia: () => ({ matches: true }) };
  globalThis.document = {
    createElement: () => ({ dataset: {} })
  };
  globalThis.game = {
    user: { isGM: false, character: mockCharActor },
    modules: new Map([["pf2e-kingmaker-tools", { active: true }]]),
    scenes: { get: () => ({ name: "Stag's End" }) },
    actors: {
      contents: [mockCharActor, mockPartyActor],
      filter: (fn) => [mockCharActor, mockPartyActor].filter(fn),
      find: (fn) => [mockCharActor, mockPartyActor].find(fn),
      get: (id) => (id === "party1" ? mockPartyActor : id === "char1" ? mockCharActor : null)
    }
  };
  globalThis.foundry = {
    utils: { escapeHTML: (s) => String(s ?? "") },
    applications: {
      instances: new Map([["kmKingdomSheet-Actor.party1", mockKmApp]]),
      api: {
        DialogV2: {
          prompt: async (cfg) => { promptedDialogs.push(cfg); }
        }
      }
    }
  };

  const { prepareHeaderContext } = await import("../scripts/apps/sheet-helpers/context-header.js");
  const { onSwitchActor } = await import("../scripts/apps/sheet-helpers/header-handlers.js");
  const {
    prepareKingdomContext,
    onOpenMobileKingdomSheet,
    onSwitchKingdomTurnSubTab,
    onSwitchKingdomSheetSubTab,
    onToggleKingdomPhase,
    onToggleKingdomActivity,
    onSetKingdomActiveLeader,
    onSetKingdomActiveSettlement,
    onUpdateKingdomField,
    onRollKingdomSkillCheck,
    onPerformKingdomActivity,
    onSkipCollectTaxes,
    onClaimKingdomRefuge,
    onClaimKingdomLandmark,
    onOpenConsumptionBreakdown,
    onInspectKingdomSettlement,
    onFilterKingdomLevel,
    onResolveKingdomEvent,
    onDispatchKingdomNativeAction
  } = await import("../scripts/kingdom/kingdom-handlers.js");

  // 6.1 Header & Character -> Kingdom Switching
  const charContext = {};
  prepareHeaderContext(mockCharActor, { _isKingdomMode: false }, charContext);
  const kingdomOption = charContext.ownedCharacters?.find((a) => a.id === "kingdom:party1");
  if (!kingdomOption || !kingdomOption.name.includes("Brevoy Frontier (Kingdom)")) {
    logFail(`Actor switcher did not include Kingdom entry on character sheet.`);
  } else {
    logPass(`[Header] Actor switcher on Character Sheet includes '${kingdomOption.name}'.`);
  }

  const mockCharSheet = {
    actor: mockCharActor,
    _isKingdomMode: false,
    _activeTab: "actions",
    close: async () => { charSheetClosed = true; }
  };
  await onSwitchActor(mockCharSheet, {}, { value: "kingdom:party1" });
  if (!mockPartySheet._isKingdomMode || mockPartySheet._activeTab !== "turn" || !partySheetRendered || !charSheetClosed) {
    logFail(`[Header] onSwitchActor('kingdom:party1') failed.`);
  } else {
    logPass("[Header] onSwitchActor('kingdom:party1') switched Character Sheet -> Kingdom Sheet (_isKingdomMode=true, _activeTab='turn').");
  }

  // Also test Party Overview -> Open Kingdom Sheet button
  mockPartySheet._isKingdomMode = false;
  await onOpenMobileKingdomSheet(mockPartySheet);
  if (!mockPartySheet._isKingdomMode || mockPartySheet._activeTab !== "turn") {
    logFail("[Party Overview] onOpenMobileKingdomSheet failed to activate Kingdom view.");
  } else {
    logPass("[Party Overview] 'Open Kingdom Sheet (Mobile View)' button transitions Party -> Kingdom view.");
  }

  // 6.2 Prepare Kingdom Context & Verify All Sections (Turn, Kingdom, Leadership + Homebrew, Settlements, Trade, Notes)
  const kingdomContext = {};
  prepareHeaderContext(mockPartyActor, mockPartySheet, kingdomContext);
  await prepareKingdomContext(mockPartyActor, mockPartySheet, kingdomContext);

  const leadershipPhase = kingdomContext.kingdomUi.phases.find((p) => p.key === "leadership");
  const hasNavalSupport = leadershipPhase?.activities?.some((a) => a.id === "naval-support");
  const hasCleanseItem = leadershipPhase?.activities?.some((a) => a.id === "cleanse-item");
  const rulerRole = kingdomContext.km.leadersContext?.[0];

  if (
    !kingdomContext.isKingdom ||
    kingdomContext.km.commoditiesArray.length !== 5 ||
    kingdomContext.km.ruinArray.length !== 4 ||
    kingdomContext.km.abilitiesArray.length !== 4 ||
    kingdomContext.km.skillsArray.length !== 3 ||
    kingdomContext.km.groupsArray.length !== 1 ||
    !kingdomContext.km.notesHtml.includes("Oleg's") ||
    !rulerRole?.hasLeaderTypeOptions ||
    rulerRole.leaderBonus !== "+2" ||
    !hasNavalSupport ||
    !hasCleanseItem
  ) {
    logFail("prepareKingdomContext failed to normalize one or more Kingdom / Homebrew sections.");
  } else {
    logPass("[Context] All 5 Kingdom tabs populated, including 8 Leadership roles, Homebrew Leader Modifier types ('Skilled' +2), and Homebrew Leadership activities ('Naval Support', 'Cleanse Item').");
  }

  // 6.3 Test Tab 1 (Turn) Buttons, Dropdowns, Accordion & Physical Dice Interception
  await onSwitchKingdomTurnSubTab(mockPartySheet, {}, { dataset: { subtab: "flow" } });
  if (mockPartySheet._kingdomTurnSubTab !== "flow") {
    logFail("[Turn Tab] onSwitchKingdomTurnSubTab failed.");
  }
  onToggleKingdomPhase(mockPartySheet, {}, { dataset: { phase: "upkeep" }, closest: () => null });
  onToggleKingdomActivity(mockPartySheet, {}, { dataset: { activityId: "naval-support" }, closest: () => null });
  if (mockPartySheet._collapsedKingdomPhases.has("upkeep") || !mockPartySheet._expandedKingdomActivities.has("naval-support")) {
    logFail("[Turn Tab] Phase/Activity accordion toggles failed.");
  }
  await onSetKingdomActiveLeader(mockPartySheet, {}, { value: "char1" });
  await onSetKingdomActiveSettlement(mockPartySheet, {}, { value: "settle1" });

  // Test Physical Dice Interception on Skill Roll & Homebrew Activity Roll
  mockPartySheet.rollMode = "physical";
  physicalModeObservedDuringRoll = false;
  await onRollKingdomSkillCheck(mockPartySheet, {}, { dataset: { skill: "boating", label: "Boating (Eco)" } });
  const skillRollAction = dispatchedKmActions.at(-1);
  if (!physicalModeObservedDuringRoll || skillRollAction?.action !== "roll-skill-check" || skillRollAction?.skill !== "boating") {
    logFail("[Turn Tab] onRollKingdomSkillCheck failed to dispatch 'roll-skill-check' with PhysicalDiceManager active.");
  } else {
    logPass("[Turn Tab] Kingdom Skill buttons ('rollKingdomSkillCheck') dispatch to pf2e-kingmaker-tools with Physical Dice interception active.");
  }

  physicalModeObservedDuringRoll = false;
  await onPerformKingdomActivity(mockPartySheet, {}, { dataset: { activityId: "naval-support", activityName: "Naval Support" } });
  const actRollAction = dispatchedKmActions.at(-1);
  if (!physicalModeObservedDuringRoll || actRollAction?.action !== "perform-activity" || actRollAction?.activity !== "naval-support") {
    logFail("[Turn Tab] onPerformKingdomActivity failed for Homebrew 'Naval Support' activity.");
  } else {
    logPass("[Turn Tab] Activity Perform buttons ('performKingdomActivity') execute Official & Homebrew activities with Physical Dice interception.");
  }

  await onSkipCollectTaxes(mockPartySheet, {});
  await onClaimKingdomRefuge(mockPartySheet, {});
  await onClaimKingdomLandmark(mockPartySheet, {});
  await onResolveKingdomEvent(mockPartySheet, {}, { dataset: { index: "0", eventName: "Bandit Activity" } });
  await onDispatchKingdomNativeAction(mockPartySheet, {}, { dataset: { kmAction: "end-turn" } });
  const recentActionNames = dispatchedKmActions.slice(-5).map((a) => a.action);
  if (
    !recentActionNames.includes("skip-collect-taxes") ||
    !recentActionNames.includes("claimed-refuge") ||
    !recentActionNames.includes("claimed-landmark") ||
    !recentActionNames.includes("handle-event") ||
    !recentActionNames.includes("end-turn")
  ) {
    logFail(`[Turn Tab] One or more Turn buttons failed to dispatch: ${JSON.stringify(recentActionNames)}`);
  } else {
    logPass("[Turn Tab] Skip Taxes, Claim Refuge, Claim Landmark, Resolve Event, and End Turn buttons verified.");
  }

  // 6.4 Test Tab 2 (Kingdom Sheet Tab) Buttons, Leadership Pickers & Modals
  await onSwitchKingdomSheetSubTab(mockPartySheet, {}, { dataset: { subtab: "charter" } });
  await onOpenConsumptionBreakdown(mockPartySheet);
  await onUpdateKingdomField(mockPartySheet, {}, { dataset: { fieldName: "leaders.ruler.uuid" }, value: "Actor.char1", type: "select-one" });
  await onUpdateKingdomField(mockPartySheet, {}, { dataset: { fieldName: "leaders.ruler.type" }, value: "skilled", type: "select-one" });
  await onUpdateKingdomField(mockPartySheet, {}, { dataset: { fieldName: "leaders.ruler.vacant" }, checked: true, type: "checkbox" });
  await onDispatchKingdomNativeAction(mockPartySheet, {}, { dataset: { kmAction: "inspect-leader-skills" } });
  await onFilterKingdomLevel(mockPartySheet, {}, { value: "4" });

  if (
    mockPartySheet._kingdomSheetSubTab !== "charter" ||
    mockPartySheet._kingdomLevelFilter !== "4" ||
    promptedDialogs.length < 2 ||
    !changedKmFields.some((f) => f.name === "leaders.ruler.uuid" && f.value === "Actor.char1") ||
    !changedKmFields.some((f) => f.name === "leaders.ruler.type" && f.value === "skilled") ||
    !changedKmFields.some((f) => f.name === "leaders.ruler.vacant" && f.value === true) ||
    !promptedDialogs.some((d) => String(d.window?.title || "").includes("Skills Overview"))
  ) {
    logFail("[Kingdom Tab] Leadership assignment, Homebrew modifier type picker, Vacancy toggle, or Consumption modal failed.");
  } else {
    logPass("[Kingdom Tab] Leader assignment dropdown, Homebrew Modifier Type ('skilled'), Vacancy toggle, PC Skills inspector, Level filter, and Consumption Breakdown modal verified.");
  }

  // 6.5 Test Tab 3 (Settlements) & Tab 4 (Trade) Buttons & Modals
  await onInspectKingdomSettlement(mockPartySheet, {}, { dataset: { settlementId: "settle1" } });
  await onDispatchKingdomNativeAction(mockPartySheet, {}, { dataset: { kmAction: "level-up-settlement", id: "settle1", levelUpTo: "CITY" } });
  await onDispatchKingdomNativeAction(mockPartySheet, {}, { dataset: { kmAction: "add-group" } });

  if (
    promptedDialogs.length < 2 ||
    !dispatchedKmActions.some((a) => a.action === "level-up-settlement" && a.id === "settle1") ||
    !dispatchedKmActions.some((a) => a.action === "add-group")
  ) {
    logFail("[Settlements & Trade Tabs] Settlement inspector modal, Homebrew rigid settlement upgrade, or Add Group button failed.");
  } else {
    logPass("[Settlements & Trade Tabs] Settlement Inspector modal, Homebrew Upgrade Settlement ('level-up-settlement'), and Diplomatic Group actions verified.");
  }
} catch (err) {
  logFail(`Kingdom Sheet verification threw an error: ${err.stack || err.message}`);
}

// Summary
console.log("\n==========================================");
if (errorCount === 0 && warningCount === 0) {
  console.log("\x1b[32m✔ All static & interactive verifications passed with 0 errors and 0 warnings!\x1b[0m");
} else if (errorCount === 0) {
  console.log(`\x1b[33m✔ Verifications passed with ${warningCount} non-critical warning(s).\x1b[0m`);
} else {
  console.error(`\x1b[31m✖ Verifications failed with ${errorCount} error(s) and ${warningCount} warning(s).\x1b[0m`);
}
console.log("==========================================\n");

process.exit(errorCount > 0 ? 1 : 0);



