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

  // Lightning badge on the Character overview button: only while an effect, condition or affliction is active
  const effectHeaderCtx = {};
  prepareHeaderContext({ ...mockCharActor, itemTypes: { effect: [{ id: "e1" }] } }, { _isKingdomMode: false }, effectHeaderCtx);
  if (charContext.hasActiveEffects !== false || effectHeaderCtx.hasActiveEffects !== true) {
    logFail(`[Header] hasActiveEffects should be false without effects and true with one: ${charContext.hasActiveEffects} / ${effectHeaderCtx.hasActiveEffects}`);
  } else {
    logPass("[Header] hasActiveEffects is false without effects and true with an active effect (lightning badge on the Character overview button).");
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

  // 6.6 Test Target Distance Calculation (BaseGrid#measurePath), Sorting, and Target Selection
  const { onSelectTarget } = await import("./apps/sheet-helpers/header-handlers.js");
  const mockTokens = [
    { id: "tok-char1", name: "Valeros", actorId: "char1", actor: mockCharActor, x: 100, y: 100, width: 1, height: 1, elevation: 0, hidden: false },
    { id: "tok-goblin", name: "Goblin Warrior", actorId: "npc-goblin", actor: { id: "npc-goblin", name: "Goblin Warrior" }, x: 400, y: 100, width: 1, height: 1, elevation: 0, hidden: false },
    { id: "tok-orc", name: "Orc Brute", actorId: "npc-orc", actor: { id: "npc-orc", name: "Orc Brute" }, x: 200, y: 100, width: 1, height: 1, elevation: 0, hidden: false }
  ];
  const mockGrid = {
    size: 100,
    distance: 5,
    measurePath(waypoints) {
      const [a, b] = waypoints;
      const dx = Math.abs((b.x ?? 0) - (a.x ?? 0)) / 100;
      const dy = Math.abs((b.y ?? 0) - (a.y ?? 0)) / 100;
      const dz = Math.abs((b.elevation ?? 0) - (a.elevation ?? 0)) / 5;
      const dims = [dx, dy, dz].sort((x, y) => y - x);
      return { distance: (dims[0] + Math.floor((dims[1] + dims[2]) / 2)) * 5 };
    }
  };
  const mockScene = {
    id: "scene-combat",
    grid: mockGrid,
    tokens: {
      contents: mockTokens,
      get: (id) => mockTokens.find(t => t.id === id),
      find: (fn) => mockTokens.find(fn)
    }
  };
  globalThis.canvas = { scene: mockScene, grid: mockGrid, ready: false };
  globalThis.game.scenes.viewed = mockScene;
  globalThis.game.scenes.active = mockScene;
  globalThis.game.user.targets = new Set();

  let headerRenderedAfterSelect = false;
  const mockCharSheetForTarget = {
    actor: mockCharActor,
    rendered: true,
    render: ({ parts } = {}) => {
      if (parts?.includes("header")) headerRenderedAfterSelect = true;
    }
  };

  const targetCtxBefore = {};
  prepareHeaderContext(mockCharActor, mockCharSheetForTarget, targetCtxBefore);

  if (
    targetCtxBefore.targets?.length !== 3 ||
    targetCtxBefore.targets[0].displayName !== "Self: Valeros (Self)" ||
    targetCtxBefore.targets[0].isSelf !== true ||
    targetCtxBefore.targets[1].displayName !== "Orc Brute (5)" ||
    targetCtxBefore.targets[2].displayName !== "Goblin Warrior (15)"
  ) {
    logFail(`[Target Distance & Self] Expected sorted targets ['Self: Valeros (Self)', 'Orc Brute (5)', 'Goblin Warrior (15)'], got: ${JSON.stringify(targetCtxBefore.targets?.map(t => t.displayName))}`);
  } else {
    logPass("[Target Distance & Self] Includes Self ('Self: Valeros (Self)') and sorts scene targets closest-first ('Orc Brute (5)', 'Goblin Warrior (15)').");
  }

  await onSelectTarget(mockCharSheetForTarget, {}, { value: "tok-goblin" });
  const targetCtxAfter = {};
  prepareHeaderContext(mockCharActor, mockCharSheetForTarget, targetCtxAfter);
  const headerTplText = fs.readFileSync(path.join(rootDir, "templates/parts/header.hbs"), "utf8");

  if (
    !headerRenderedAfterSelect ||
    targetCtxAfter.activeTarget?.id !== "tok-goblin" ||
    targetCtxAfter.activeTarget?.displayName !== "Goblin Warrior (15)" ||
    targetCtxAfter.activeTarget?.distanceLabel !== "15" ||
    !headerTplText.includes("{{this.distanceLabel}}ft {{/if}}{{this.rawName}}")
  ) {
    logFail(`[Target Distance] Selecting target failed to update activeTarget or header.hbs template bindings: ${JSON.stringify(targetCtxAfter.activeTarget)}`);
  } else {
    logPass("[Target Distance] Selecting target ('tok-goblin') updates activeTarget ('Goblin Warrior (15)'), triggers header re-render, and header.hbs shows the range first in the option ('🎯 15ft Goblin Warrior').");
  }

  // Test iOS paused-ticker _source movement update, AoE multi-targeting, and diagonal/opposite-side flanking
  const { setTargetTokens, areTokensOnOppositeSides } = await import("../scripts/tokens/token-adapter.js");
  const { isMultiTargetOrAreaSpell } = await import("../scripts/apps/sheet-helpers/sheet-prompts.js");

  // 1) Simulate iOS paused ticker where tokGoblin._source.x moves from 300 -> 100 while tokGoblin.x stays frozen at 300
  const tokGoblin = mockScene.tokens.get("tok-goblin");
  globalThis.canvas.app = { ticker: { started: false } };
  tokGoblin._source = { x: 100, y: 0, width: 1, height: 1, elevation: 0 };
  const targetCtxMoved = {};
  prepareHeaderContext(mockCharActor, mockCharSheetForTarget, targetCtxMoved);
  const movedGoblin = targetCtxMoved.targets?.find(t => t.id === "tok-goblin");
  if (movedGoblin?.distance !== 5 || movedGoblin?.displayName !== "Goblin Warrior (5)") {
    logFail(`[iOS Distance Update] Expected tok-goblin distance to update from _source to 5 ('Goblin Warrior (5)') when ticker is stopped, got: ${JSON.stringify(movedGoblin)}`);
  } else {
    logPass("[iOS Distance Update] Synchronizes TokenDocument._source coordinates when PIXI.Ticker is paused on iPhone ('Goblin Warrior (15)' -> 'Goblin Warrior (5)').");
  }

  // 2) Test AoE / Multi-Target spell detection & setTargetTokens
  const aoeFireball = { name: "Fireball", system: { area: { value: 20, type: "burst" }, range: { value: "500 feet" } } };
  const multiElectricArc = { name: "Electric Arc", system: { target: { value: "1 or 2 creatures" }, range: { value: "30 feet" } } };
  const singleHeal = { name: "Heal (1-Action)", system: { target: { value: "1 willing living creature or 1 undead creature" }, range: { value: "touch" } } };
  await setTargetTokens(["tok-orc", "tok-goblin"]);
  const multiTargetCtx = {};
  prepareHeaderContext(mockCharActor, mockCharSheetForTarget, multiTargetCtx);
  if (
    !isMultiTargetOrAreaSpell(aoeFireball) ||
    !isMultiTargetOrAreaSpell(multiElectricArc) ||
    isMultiTargetOrAreaSpell(singleHeal) ||
    !multiTargetCtx.hasMultipleTargets ||
    multiTargetCtx.activeTargetCount !== 2
  ) {
    logFail("[AoE Multi-Targeting] Failed AoE/multi-target detection or multi-token setTargetTokens header state.");
  } else {
    logPass("[AoE Multi-Targeting] Detects AoE & multi-target spells ('Fireball', 'Electric Arc') and synchronizes multiple active targets in game.user.targets and header.");
  }
  await setTargetTokens(["tok-orc"]);

  // 3) Test Opposite-Sides AND Diagonal (Corner-to-Corner) Flanking
  const flankerTopLeft = { x: 0, y: 0, width: 1, height: 1, _source: { x: 0, y: 0, width: 1, height: 1 } };
  const enemyCenter = { x: 100, y: 100, width: 1, height: 1, _source: { x: 100, y: 100, width: 1, height: 1 } };
  const flankerBottomRight = { x: 200, y: 200, width: 1, height: 1, _source: { x: 200, y: 200, width: 1, height: 1 } };
  const flankerTopRight = { x: 200, y: 0, width: 1, height: 1, _source: { x: 200, y: 0, width: 1, height: 1 } };
  const isDiagonalFlanking = areTokensOnOppositeSides(flankerTopLeft, flankerBottomRight, enemyCenter);
  const isNotFlankingSameSide = areTokensOnOppositeSides(flankerTopLeft, flankerTopRight, enemyCenter);
  if (!isDiagonalFlanking || isNotFlankingSameSide) {
    logFail(`[Flanking Geometry] Expected diagonal corner-to-corner flanking=true (${isDiagonalFlanking}) and same-side=false (${isNotFlankingSameSide}).`);
  } else {
    logPass("[Flanking Geometry] Accurately detects both opposite-side and diagonal corner-to-corner flanking while rejecting non-opposite positions.");
  }
} catch (err) {
  logFail(`Kingdom Sheet / Target Distance verification threw an error: ${err.stack || err.message}`);
}

// 6.6b Test Skill Action labels (skill + proficiency) and sort order (feats first, then best rank, then name)
try {
  const { getActionSkillInfo, compareSkillActions } = await import("./apps/sheet-helpers/context-actions.js");
  const skills = {
    stealth: { slug: "stealth", label: "Stealth", rank: 3 },
    medicine: { slug: "medicine", label: "Medicine", rank: 1 },
    arcana: { slug: "arcana", label: "Arcana", rank: 2 },
    occultism: { slug: "occultism", label: "Occultism", rank: 0 }
  };
  const actor = { getStatistic: (slug) => skills[slug] ?? null };

  const hide = getActionSkillInfo(actor, "stealth");
  const recall = getActionSkillInfo(actor, ["arcana", "occultism", "unknown-skill"]);
  const none = getActionSkillInfo(actor, undefined);

  const order = [
    { name: "Hide", fromFeat: false, skill: hide },
    { name: "Treat Wounds", fromFeat: false, skill: getActionSkillInfo(actor, "medicine") },
    { name: "Battle Medicine", fromFeat: true, skill: getActionSkillInfo(actor, "medicine") },
    { name: "Aid", fromFeat: false, skill: null },
    { name: "Sneak", fromFeat: false, skill: hide }
  ].sort(compareSkillActions).map(a => a.name).join(",");

  if (
    hide?.label !== "Stealth" || hide.rank !== 3 || hide.rankLetter !== "M" || hide.rankName !== "Master" ||
    recall?.label !== "Multiple" || recall.rank !== 2 || recall.options !== "Arcana, Occultism" ||
    none !== null ||
    order !== "Battle Medicine,Hide,Sneak,Treat Wounds,Aid"
  ) {
    logFail(`[Skill Action Labels] Unexpected skill info or sort order (order: ${order}).`);
  } else {
    logPass("[Skill Action Labels] Skill actions get their skill and rank (best rank for a choice of skills, 'Multiple'), and sort feats first, then best rank, then name.");
  }
} catch (err) {
  logFail(`Skill Action Labels verification threw an error: ${err.stack || err.message}`);
}

// 6.7 Test Spell Action Cost (1-3, default 2) & Multi-Action Button Labels (> 1)
try {
  const { parseActionCostInfo } = await import("./utils/sheet-utils.js");
  const { formatSpell } = await import("./apps/sheet-helpers/context-spells.js");

  const spell1Cost = parseActionCostInfo({ type: "spell", system: { time: { value: "1" } } }, null, { isSpell: true });
  const spellDefaultCost = parseActionCostInfo({ type: "spell", system: { time: { value: "" } } }, null, { isSpell: true });
  const spellVarCost = parseActionCostInfo({ type: "spell", system: { time: { value: "1 to 3" } } }, null, { isSpell: true });
  const spellReactionCost = parseActionCostInfo({ type: "spell", system: { time: { value: "reaction" } } }, null, { isSpell: true });
  const action1Cost = parseActionCostInfo({ type: "action", actionCost: { type: "action", value: 1 } });
  const action2Cost = parseActionCostInfo({ type: "action", actionCost: { type: "action", value: 2 } });
  const formattedHeal = await formatSpell({ getRollData: () => ({}) }, {}, {
    id: "spell-heal",
    name: "Heal",
    type: "spell",
    system: { time: { value: "1 to 3" }, traits: { value: ["healing", "vitality"] } }
  }, "entry-1");
  const formattedReactionSpell = await formatSpell({ getRollData: () => ({}) }, {}, {
    id: "spell-hidebound",
    name: "Hidebound",
    type: "spell",
    system: { time: { value: "reaction" }, traits: { value: ["concentrate", "manipulate"] } }
  }, "entry-1");


  if (
    spell1Cost.castActions !== "1" ||
    spellDefaultCost.castActions !== "2" ||
    spellVarCost.castActions !== "1-3" ||
    formattedHeal.castActions !== "1-3" ||
    spellReactionCost.glyph !== "R" ||
    spellReactionCost.castActions !== "" ||
    formattedReactionSpell.glyph !== "R" ||
    formattedReactionSpell.castActions !== "" ||
    action1Cost.multiActionLabel !== "" ||
    action2Cost.multiActionLabel !== "2"
  ) {
    logFail("[Action Cost Labels] Failed verification for spell castActions (1-3, default 2) or multi-action labels (>1).");
  } else {
    logPass("[Action Cost Labels] Spells resolve 1-3 actions (defaulting to '2' and normalizing '1 to 3' -> '1-3'), reaction spells get glyph 'R' and no action count, and actions >1 get a multi-action label ('2').");
  }

  // Verify Repeatable Spell Damage Button (Issue #15)
  const { onRollSpellDamage } = await import("./apps/sheet-helpers/spells-handlers.js");
  let rolledDamageAtRank = null;
  let slotExpendedMutated = false;
  const mockFloatingFlame = {
    id: "sp-floating-flame",
    name: "Floating Flame",
    rank: 2,
    hasDamage: true,
    system: {
      time: { value: "2" },
      level: { value: 2 },
      damage: {
        "0": { formula: "3d6", type: "fire", kinds: new Set(["damage"]) }
      }
    },
    loadVariant({ castRank }) {
      return {
        ...this,
        rank: castRank,
        hasDamage: true,
        system: {
          ...this.system,
          damage: {
            "0": { formula: `${castRank + 1}d6`, type: "fire", kinds: new Set(["damage"]) }
          }
        },
        rollDamage: async () => {
          rolledDamageAtRank = castRank;
        }
      };
    }
  };
  const testSpellActor = {
    id: "char-spell-test",
    level: 7,
    getRollData: () => ({}),
    items: new Map([["sp-floating-flame", mockFloatingFlame]]),
    spellcasting: {
      get: () => ({
        id: "entry-prep",
        isPrepared: true,
        spells: new Map([["sp-floating-flame", mockFloatingFlame]]),
        system: {
          slots: {
            slot4: { value: 0, max: 2, prepared: [{ id: "sp-floating-flame", expended: true }] }
          }
        },
        update: async () => { slotExpendedMutated = true; }
      })
    }
  };
  const formattedFlameRank4 = await formatSpell(testSpellActor, {}, mockFloatingFlame, "entry-prep", {
    isPrepared: true,
    isExpended: true,
    slotIndex: 0,
    castRank: 4
  });
  await onRollSpellDamage(
    { actor: testSpellActor, rollMode: "digital", render: () => {} },
    { preventDefault() {}, stopPropagation() {} },
    {
      dataset: { itemId: "sp-floating-flame", entryId: "entry-prep", rank: "4", slotIndex: "0" },
      closest: () => null
    }
  );
  if (
    !formattedFlameRank4.hasDamage ||
    formattedFlameRank4.isHealingOnly ||
    formattedFlameRank4.damageFormula !== "5d6" ||
    rolledDamageAtRank !== 4 ||
    slotExpendedMutated
  ) {
    logFail(`[Spell Damage Button] Failed verification: hasDamage=${formattedFlameRank4.hasDamage}, formula=${formattedFlameRank4.damageFormula}, rolledRank=${rolledDamageAtRank}, mutated=${slotExpendedMutated}`);
  } else {
    logPass("[Spell Damage Button] Damaging spells expose heightened damage button ('5d6' at Rank 4) and roll repeatable damage even when slot is expended without consuming slots.");
  }

  // Verify Issue #16: Distance on iOS, AoE / Heightened Multi-Target, Single-Target Enforcement, Flanking & Unconscious Check, Self-Targeting, and Persistent Canvas Toggle
  const {
    syncTokenPosition,
    getTokenDistanceInfo,
    computeTokenFlanking,
    isActorAbleToFlank
  } = await import("./tokens/token-adapter.js");
  const {
    isMultiTargetOrAreaSpell,
    collectSceneCandidateTokens
  } = await import("./apps/sheet-helpers/sheet-prompts.js");
  const {
    isMobileCanvasDisabled,
    setMobileCanvasDisabled
  } = await import("./utils/sheet-utils.js");

  // 1. iOS Frozen Animation Distance Check
  const testSceneDims = { dimensions: { size: 100, distance: 5 } };
  const originTokenDoc = {
    id: "tok-hero",
    name: "Hero",
    actorId: "actor-hero",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    parent: testSceneDims,
    _source: { x: 0, y: 0, width: 1, height: 1 },
    actor: {
      id: "actor-hero",
      getActiveTokens: () => [originTokenDoc],
      isAllyOf: (other) => other?.id === "actor-ally",
      system: { attributes: { hp: { value: 30 } } }
    }
  };
  const enemyTokenDoc = {
    id: "tok-goblin-2",
    name: "Goblin",
    actorId: "actor-goblin",
    x: 100, // Stale animated position (5 ft)
    y: 0,
    width: 1,
    height: 1,
    parent: testSceneDims,
    _source: { x: 300, y: 0, width: 1, height: 1 }, // Authoritative updated server position (15 ft)
    actor: { id: "actor-goblin", system: { attributes: { hp: { value: 20 } } } }
  };
  syncTokenPosition(enemyTokenDoc);
  const distInfo = getTokenDistanceInfo(originTokenDoc.actor, enemyTokenDoc);
  if (distInfo?.distance !== 15 || enemyTokenDoc.x !== 300) {
    logFail(`[Issue #16 Distance] Expected distance=15 after _source sync, got ${distInfo?.distance}`);
  } else {
    logPass("[Issue #16 Distance] syncTokenPosition & getTokenDistanceInfo accurately read authoritative _source coordinates (15 ft).");
  }

  // 2. AoE & Heightened Multi-Target vs Ambiguous 'any 1 creature'
  const singleAnySpell = { system: { target: { value: "any 1 creature" } } };
  const singleAllySpell = { system: { target: { value: "any single ally" } } };
  const heightenedSlowSpell = {
    rank: 3,
    system: {
      target: { value: "1 creature" },
      heightening: {
        type: "fixed",
        levels: {
          6: { target: { value: "up to 10 creatures" } }
        }
      }
    }
  };
  const aoeFireball = { system: { area: { value: 20, type: "burst" } } };
  if (
    isMultiTargetOrAreaSpell(singleAnySpell) !== false ||
    isMultiTargetOrAreaSpell(singleAllySpell) !== false ||
    isMultiTargetOrAreaSpell(heightenedSlowSpell, 3) !== false ||
    isMultiTargetOrAreaSpell(heightenedSlowSpell, 6) !== true ||
    isMultiTargetOrAreaSpell(aoeFireball) !== true
  ) {
    logFail("[Issue #16 Multi-Target Spell] Failed edge-case checks for 'any 1 creature', 'any single ally', or heightened Slow (Rank 3 vs Rank 6).");
  } else {
    logPass("[Issue #16 Multi-Target Spell] Correctly excludes 'any 1 creature'/'any single ally' and detects heightened multi-target spells (Slow Rank 6) & AoE spells.");
  }

  // 3. Flanking with Ally + Unconscious / Incapacitated Ally Check
  const allyTokenDoc = {
    id: "tok-ally",
    actorId: "actor-ally",
    x: 200,
    y: 0,
    width: 1,
    height: 1,
    _source: { x: 200, y: 0, width: 1, height: 1 },
    actor: {
      id: "actor-ally",
      isAllyOf: (other) => other?.id === "actor-hero",
      hasCondition: () => false,
      conditions: { active: [] },
      system: { attributes: { hp: { value: 25 } } }
    }
  };
  // Position goblin at (100, 0) between hero at (0, 0) and ally at (200, 0)
  enemyTokenDoc._source.x = 100;
  syncTokenPosition(enemyTokenDoc);
  const mockFlankScene = {
    dimensions: { size: 100, distance: 5 },
    tokens: { contents: [originTokenDoc, enemyTokenDoc, allyTokenDoc] }
  };
  originTokenDoc.parent = mockFlankScene;
  enemyTokenDoc.parent = mockFlankScene;
  allyTokenDoc.parent = mockFlankScene;

  const flankedHealthy = computeTokenFlanking(originTokenDoc, enemyTokenDoc, { reach: 5 });
  allyTokenDoc.actor.hasCondition = (slug) => slug === "unconscious";
  const flankedWhenAllyUnconscious = computeTokenFlanking(originTokenDoc, enemyTokenDoc, { reach: 5 });

  // Test controlled, fleeing, blinded, and stunned (Stunned 2 vs Stunned 3)
  allyTokenDoc.actor.hasCondition = (slug) => slug === "controlled";
  const flankedControlled = computeTokenFlanking(originTokenDoc, enemyTokenDoc, { reach: 5 });

  allyTokenDoc.actor.hasCondition = (slug) => slug === "fleeing";
  const flankedFleeing = computeTokenFlanking(originTokenDoc, enemyTokenDoc, { reach: 5 });

  allyTokenDoc.actor.hasCondition = (slug) => slug === "blinded";
  const flankedBlinded = computeTokenFlanking(originTokenDoc, enemyTokenDoc, { reach: 5 });

  allyTokenDoc.actor.hasCondition = (slug) => slug === "stunned";
  allyTokenDoc.actor.conditions = { active: [{ slug: "stunned", value: 2 }] };
  const flankedStunned2 = computeTokenFlanking(originTokenDoc, enemyTokenDoc, { reach: 5 });

  allyTokenDoc.actor.conditions = { active: [{ slug: "stunned", value: 3 }] };
  const flankedStunned3 = computeTokenFlanking(originTokenDoc, enemyTokenDoc, { reach: 5 });

  // Test Tiny creature (0.5 x 0.5 at sub-grid offset x=425, y=225 -> square (4, 2) -> 2 diagonals (15 ft) + 2 straight (10 ft) = 25 ft, never 23 ft)
  const tinyTokenDoc = {
    id: "tok-tiny-sprite",
    name: "Sprite",
    actorId: "actor-sprite",
    x: 425,
    y: 225,
    width: 0.5,
    height: 0.5,
    parent: testSceneDims,
    _source: { x: 425, y: 225, width: 0.5, height: 0.5 },
    actor: { id: "actor-sprite" }
  };
  const tinyDistInfo = getTokenDistanceInfo(originTokenDoc.actor, tinyTokenDoc);

  if (
    !flankedHealthy ||
    flankedWhenAllyUnconscious ||
    flankedControlled ||
    flankedFleeing ||
    flankedBlinded ||
    !flankedStunned2 ||
    flankedStunned3 ||
    tinyDistInfo?.distance !== 25
  ) {
    logFail(`[Issue #16 Flanking & Tiny Distance] Failed: healthy=${flankedHealthy}, unc=${flankedWhenAllyUnconscious}, ctrl=${flankedControlled}, flee=${flankedFleeing}, blind=${flankedBlinded}, stun2=${flankedStunned2}, stun3=${flankedStunned3}, tinyDist=${tinyDistInfo?.distance}`);
  } else {
    logPass("[Issue #16 Flanking & Tiny Distance] Tiny tokens snap to 5-ft grid steps with PF2e 5-10-5 diagonals (25 ft, never 23 ft); headless flanking allows Stunned 1-2 but blocks Stunned 3+, Controlled, Fleeing, Blinded, and Unconscious.");
  }

  // 4. Canvas Default Enabled & Persistent Setting Toggle (CONFIG.Canvas.disabled)
  globalThis.CONFIG = { ...(globalThis.CONFIG || {}), Canvas: { disabled: false } };
  const mockStorage = new Map();
  globalThis.localStorage = {
    getItem: (k) => mockStorage.get(k) ?? null,
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k)
  };
  const defaultCanvasDisabled = isMobileCanvasDisabled();
  await setMobileCanvasDisabled(true);
  const afterDisable = isMobileCanvasDisabled();
  const configDisabledWhenTrue = globalThis.CONFIG.Canvas.disabled;
  await setMobileCanvasDisabled(false);
  const afterReEnable = isMobileCanvasDisabled();
  const configDisabledWhenFalse = globalThis.CONFIG.Canvas.disabled;
  if (
    defaultCanvasDisabled !== false ||
    afterDisable !== true ||
    configDisabledWhenTrue !== true ||
    afterReEnable !== false ||
    configDisabledWhenFalse !== false
  ) {
    logFail(`[Issue #16 Canvas Toggle] Expected default=false, afterDisable=true (CONFIG.Canvas.disabled=true), afterReEnable=false; got ${defaultCanvasDisabled}, ${afterDisable} (${configDisabledWhenTrue}), ${afterReEnable} (${configDisabledWhenFalse})`);
  } else {
    logPass("[Issue #16 Canvas Toggle] Canvas is enabled by default (disableCanvas=false), sets CONFIG.Canvas.disabled=true when disabled, and persists user toggle state across sessions.");
  }

  // 7. Headless No-Canvas TokenDocument.prototype.object Getter & Non-Recursive distanceTo Guard
  const { getTargetableToken } = await import("./tokens/token-adapter.js");
  class MockGetterTokenDoc {
    constructor(data) {
      Object.assign(this, data);
    }
    get object() {
      return null; // Simulates Foundry v14 CanvasDocumentMixin getter when canvas.ready === false
    }
  }
  const headlessScene = {
    id: "scene-headless",
    dimensions: { size: 100, distance: 5 },
    grid: { size: 100, distance: 5 },
    tokens: {
      contents: [],
      get(id) { return this.contents.find(t => t.id === id) ?? null; }
    }
  };
  const hHeroDoc = new MockGetterTokenDoc({
    id: "h-hero", name: "Hero", actorId: "a-hero", x: 0, y: 0, width: 1, height: 1,
    _source: { x: 0, y: 0, width: 1, height: 1 }, parent: headlessScene,
    actor: { id: "a-hero", isAllyOf: (o) => o?.id === "a-ally", hasCondition: () => false, system: { attributes: { hp: { value: 30 } } } }
  });
  const hEnemyDoc = new MockGetterTokenDoc({
    id: "h-enemy", name: "Orc", actorId: "a-enemy", x: 100, y: 0, width: 1, height: 1,
    _source: { x: 100, y: 0, width: 1, height: 1 }, parent: headlessScene,
    actor: { id: "a-enemy", isAllyOf: () => false, hasCondition: () => false, system: { attributes: { hp: { value: 20 } } } }
  });
  const hAllyDoc = new MockGetterTokenDoc({
    id: "h-ally", name: "Ally", actorId: "a-ally", x: 200, y: 0, width: 1, height: 1,
    _source: { x: 200, y: 0, width: 1, height: 1 }, parent: headlessScene,
    actor: { id: "a-ally", isAllyOf: (o) => o?.id === "a-hero", hasCondition: () => false, system: { attributes: { hp: { value: 25 } } } }
  });
  headlessScene.tokens.contents.push(hHeroDoc, hEnemyDoc, hAllyDoc);
  globalThis.game.scenes.current = headlessScene;
  globalThis.canvas = { ready: false, scene: null };

  const heroAdapter = getTargetableToken("h-hero");
  const enemyAdapter = getTargetableToken("h-enemy");
  const tStart = performance.now();
  for (let i = 0; i < 200; i++) {
    heroAdapter.distanceTo(enemyAdapter);
  }
  const elapsedMs = performance.now() - tStart;

  if (
    !hHeroDoc.object ||
    !hEnemyDoc.object ||
    typeof hHeroDoc.object.isFlanking !== "function" ||
    hHeroDoc.object.isFlanking(hEnemyDoc.object, { reach: 5 }) !== true ||
    elapsedMs > 50
  ) {
    logFail(`[Issue #16 Headless Adapter & Performance] Failed: hHeroDoc.object=${Boolean(hHeroDoc.object)}, isFlanking=${hHeroDoc.object?.isFlanking?.(hEnemyDoc.object, { reach: 5 })}, 200x distanceTo=${elapsedMs.toFixed(2)}ms`);
  } else {
    logPass(`[Issue #16 Headless Adapter & Performance] Getter-only TokenDocument.object overridden via Object.defineProperty, headless isFlanking=true, and 200x distanceTo ran in ${elapsedMs.toFixed(2)}ms.`);
  }
} catch (err) {
  logFail(`Action Cost / Spell Damage / Issue #16 verification threw an error: ${err.stack || err.message}`);
}

// 6b. Character overview: header user button and pf2e feat groups
try {
  const { prepareCharacterContext } = await import("../scripts/apps/sheet-helpers/context-character.js");
  const headerHbs = fs.readFileSync(path.join(rootDir, "templates/parts/header.hbs"), "utf-8");
  const mobileSheetHbs = fs.readFileSync(path.join(rootDir, "templates/mobile-sheet.hbs"), "utf-8");
  const entryJs = fs.readFileSync(path.join(rootDir, "scripts/pf2e-mobile.js"), "utf-8");

  const slot = (feat, level, children = []) => ({ feat, level, children });
  const featItem = (id, name, level) => ({ id, name, system: { level: { value: level } } });
  const ancestryGroup = { id: "ancestry", label: "Ancestry Feats", feats: [slot(featItem("f1", "Natural Ambition", 1), 1), slot(null, 5)] };
  const classGroup = { id: "class", label: "Class Feats", feats: [slot(featItem("f2", "Champion Dedication", 2), 2, [slot(featItem("f3", "Deity's Domain", 2))])] };
  const emptyGroup = { id: "general", label: "General Feats", feats: [slot(null, 3)] };
  const mockOverviewActor = {
    name: "Valeros",
    level: 5,
    ancestry: { name: "Human" },
    class: { name: "Fighter" },
    abilities: { str: { mod: 4 }, dex: { mod: 2 }, con: { mod: 2 }, int: { mod: 0 }, wis: { mod: 1 }, cha: { mod: -1 } },
    movement: { speeds: { land: { label: "Land Speed", value: 25 }, swim: null, travel: { label: "Travel Speed", value: 25 } } },
    perception: { senses: { contents: [{ label: "Low-Light Vision" }] } },
    attributes: { immunities: [], weaknesses: [], resistances: [{ label: "Fire 5" }] },
    classDC: { dc: { value: 21 } },
    system: { details: { languages: { value: ["common"] } } },
    feats: { contents: [ancestryGroup, classGroup, emptyGroup], bonus: { id: "bonus", label: "Bonus Feats", feats: [] } }
  };

  const closedCtx = {};
  prepareCharacterContext(mockOverviewActor, { _activeTab: "actions" }, closedCtx);
  const ctx = {};
  prepareCharacterContext(mockOverviewActor, { _activeTab: "character" }, ctx);
  const c = ctx.character;
  const groupIds = c?.featGroups?.map(g => g.id).join(",");

  if (
    closedCtx.character !== undefined ||
    groupIds !== "ancestry,class" ||
    c.featGroups[0].feats.length !== 1 ||
    c.featGroups[1].feats[0].children[0]?.name !== "Deity's Domain" ||
    c.attributes.find(a => a.key === "str")?.mod !== 4 ||
    c.speeds.map(s => `${s.type}:${s.value}`).join(",") !== "land:25,swim:null,climb:null,fly:null,burrow:null" ||
    c.defenses.classDC !== 21 ||
    c.defenses.resistances[0] !== "Fire 5" ||
    c.identity.className !== "Fighter" ||
    c.identity.level !== 5 ||
    c.identity.deity !== null
  ) {
    logFail(`[Character Overview] Unexpected context: ${JSON.stringify(c)} (closed: ${JSON.stringify(closedCtx.character)})`);
  } else {
    logPass("[Character Overview] Context only builds while open, keeps pf2e's feat group order, skips empty slots and groups, nests granted feats, and lists land, swim, climb, fly and burrow speed (null when missing, no travel speed).");
  }

  // Feat descriptions: nothing is enriched when the overview opens; the first tap enriches one feat
  // and caches it, a second open of the same feat uses the cache, and a re-render keeps it open with its text.
  const { onToggleItemDescription } = await import("../scripts/apps/sheet-helpers/character-handlers.js");
  const mockClassList = (initial) => {
    const set = new Set(initial);
    return { contains: c => set.has(c), add: c => set.add(c), remove: c => set.delete(c), replace: (a, b) => (set.delete(a), set.add(b)) };
  };
  const content = { innerHTML: "" };
  const drawer = { classList: mockClassList(["action-summary", "collapsed"]), querySelector: () => content };
  const featEl = { dataset: { itemId: "f1" }, classList: mockClassList(["character-item"]), querySelector: () => drawer };
  const itemLine = { closest: () => featEl };
  let enrichCalls = 0;
  const previousUx = globalThis.foundry.applications.ux;
  globalThis.foundry.applications.ux = { TextEditor: { enrichHTML: async (html) => { enrichCalls++; return `<p>${html}</p>`; } } };
  const featSheet = {
    _activeTab: "character",
    actor: { ...mockOverviewActor, items: { get: id => (id === "f1" ? { system: { description: { value: "Ambition text" } } } : null) } }
  };
  const callsBeforeTap = enrichCalls;
  await onToggleItemDescription(featSheet, {}, itemLine);
  const openedHtml = content.innerHTML;
  await onToggleItemDescription(featSheet, {}, itemLine);
  const closed = drawer.classList.contains("collapsed");
  await onToggleItemDescription(featSheet, {}, itemLine);
  const reopenCtx = {};
  prepareCharacterContext(featSheet.actor, featSheet, reopenCtx);
  globalThis.foundry.applications.ux = previousUx;
  const reopenedFeat = reopenCtx.character.featGroups[0].feats[0];
  const otherFeat = reopenCtx.character.featGroups[1].feats[0];

  if (
    callsBeforeTap !== 0 ||
    enrichCalls !== 1 ||
    openedHtml !== "<p>Ambition text</p>" ||
    !closed ||
    !reopenedFeat.isExpanded ||
    reopenedFeat.description !== "<p>Ambition text</p>" ||
    otherFeat.isExpanded ||
    otherFeat.description !== ""
  ) {
    logFail(`[Character Overview] Lazy feat description failed: enrichCalls=${enrichCalls}, opened=${openedHtml}, closed=${closed}, reopened=${JSON.stringify(reopenedFeat)}`);
  } else {
    logPass("[Character Overview] Feat descriptions are enriched on the first tap only, cached for later opens, and kept open with their text on re-render.");
  }

  // Effects: afflictions, conditions, effects in that order; badge value after the name (not for conditions,
  // whose name pf2e already gives the value); pf2e's duration strings
  const previousI18n = globalThis.game.i18n;
  globalThis.game.i18n = { format: (key, data) => `${key}${data && Object.keys(data).length ? JSON.stringify(data) : ""}` };
  const effectsActor = {
    ...mockOverviewActor,
    conditions: { active: [{ id: "c1", name: "Frightened 2", type: "condition", badge: { type: "counter", value: 2, label: null } }] },
    itemTypes: {
      affliction: [{ id: "a1", name: "Spider Venom", type: "affliction", badge: { type: "counter", value: 1, labels: ["Stage 1", "Stage 2"] } }],
      effect: [
        { id: "e1", name: "Effect: Bless", type: "effect", badge: null, totalDuration: 60, remainingDuration: { remaining: 18 }, system: { duration: { unit: "minutes" } } },
        { id: "e2", name: "Stance: Mountain", type: "effect", badge: null, totalDuration: Infinity, system: { duration: { unit: "unlimited" } } }
      ]
    }
  };
  const effectsCtx = {};
  prepareCharacterContext(effectsActor, { _activeTab: "character" }, effectsCtx);
  globalThis.game.i18n = previousI18n;
  const effects = effectsCtx.character?.effects ?? [];
  const effectSummary = effects.map(e => `${e.name}|${e.badge ?? ""}|${e.remaining ?? ""}`).join(";");
  const expectedEffects = "Spider Venom|Stage 1|;Frightened 2||;Effect: Bless||PF2E.EffectPanel.RemainingDuration.MultipleRounds{\"rounds\":3};Stance: Mountain||PF2E.EffectPanel.UnlimitedDuration";
  if (effectSummary !== expectedEffects) {
    logFail(`[Character Overview] Effects list: expected ${expectedEffects}, got ${effectSummary}`);
  } else {
    logPass("[Character Overview] Effects list afflictions, conditions and effects like pf2e's effects panel, with badge values and pf2e's remaining duration strings.");
  }

  if (
    !headerHbs.includes('data-action="toggleCharacterOverview"') ||
    !mobileSheetHbs.includes("templates/parts/character.hbs") ||
    !entryJs.includes("templates/parts/character.hbs")
  ) {
    logFail("[Character Overview] header.hbs button, mobile-sheet.hbs routing or the character.hbs preload is missing.");
  } else {
    logPass("[Character Overview] Header user button, mobile-sheet.hbs routing and character.hbs preload are in place.");
  }
} catch (err) {
  logFail(`Character overview verification threw an error: ${err.stack || err.message}`);
}

// 7. Foundry VTT AI Content Policy Compliance Audit (https://foundryvtt.com/article/ai-policy/)
console.log("\n--- 7. Foundry VTT AI Content Policy Compliance Audit ---");
try {
  // 7.1 Prepared Media & SVG Evasion Audit (Sections 4.2 & 4.3)
  const mediaExts = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".mp3", ".ogg", ".wav", ".flac", ".mp4", ".webm"]);
  const bundledMedia = [];
  const svgFiles = [];

  function scanMediaFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanMediaFiles(full);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        const rel = path.relative(rootDir, full).replace(/\\/g, "/");
        if (mediaExts.has(ext)) bundledMedia.push(rel);
        if (ext === ".svg") svgFiles.push(full);
      }
    }
  }
  scanMediaFiles(rootDir);

  if (bundledMedia.length > 0) {
    const provPath = path.join(rootDir, "ASSET_PROVENANCE.json");
    if (!fs.existsSync(provPath)) {
      logFail(`[AI Policy 4.2/4.3] Bundled media files found without ASSET_PROVENANCE.json verifying human creation: ${bundledMedia.join(", ")}`);
    } else {
      const provData = JSON.parse(fs.readFileSync(provPath, "utf-8"));
      const unverified = bundledMedia.filter((f) => !provData[f]?.humanCreated || !provData[f]?.creator);
      if (unverified.length > 0) {
        logFail(`[AI Policy 4.2/4.3] Bundled media files missing human creator attestation in ASSET_PROVENANCE.json: ${unverified.join(", ")}`);
      } else {
        logPass(`[AI Policy 4.2/4.3] All ${bundledMedia.length} bundled media files have verified human provenance.`);
      }
    }
  } else {
    logPass("[AI Policy 4.2/4.3] Zero bundled raster images, audio, or video assets (uses pure CSS & Foundry/FontAwesome icons).");
  }

  let svgEvasionDetected = false;
  for (const svgFull of svgFiles) {
    const svgContent = fs.readFileSync(svgFull, "utf-8");
    if (svgContent.length > 10240 || /data:image\//i.test(svgContent) || /<image\b/i.test(svgContent)) {
      logFail(`[AI Policy 4.2] Prohibited SVG media evasion or embedded raster image in ${path.relative(rootDir, svgFull)}`);
      svgEvasionDetected = true;
    }
  }
  if (!svgEvasionDetected) {
    logPass("[AI Policy 4.2] No SVG media evasion or embedded base64 raster images detected.");
  }

  // 7.2 Runtime Code Generation Safety (Section 5) & Third-Party Scraping/Duplication Check (Section 1.1)
  if (fs.existsSync(path.join(rootDir, "scripts/apps/sheet-helpers/context-kingdom.js"))) {
    logFail("[AI Policy 1.1/4.1] Duplicate third-party rules file 'context-kingdom.js' must not exist; delegate to pf2e-kingmaker-tools API.");
  } else {
    logPass("[AI Policy 1.1/4.1] Zero duplicated third-party Kingdom constant files (delegates directly to pf2e-kingmaker-tools & PF2e APIs).");
  }

  let unsafeEvalFound = false;
  let undocumentedModules = 0;
  function auditJsCompliance(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        auditJsCompliance(full);
      } else if (entry.name.endsWith(".js")) {
        const rel = path.relative(rootDir, full).replace(/\\/g, "/");
        const content = fs.readFileSync(full, "utf-8");
        if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(content)) {
          logFail(`[AI Policy 5] Unconfirmed runtime code execution (eval / new Function) detected in ${rel}`);
          unsafeEvalFound = true;
        }
        if (!/\/\*\*[\s\S]*?\*\//.test(content)) {
          logWarn(`[AI Policy 4.4] Module ${rel} is missing JSDoc architectural documentation comments.`);
          undocumentedModules++;
        }
      }
    }
  }
  auditJsCompliance(path.join(rootDir, "scripts"));

  if (!unsafeEvalFound) {
    logPass("[AI Policy 5] Zero unconfirmed runtime code execution ('eval' / 'new Function') across all scripts.");
  }

  // 7.3 Author Maintainability & Anti-"Vibe Coding" Architecture Check (Section 4.4 & Section 7)
  const orchestratorLines = fs.readFileSync(path.join(rootDir, "scripts/apps/mobile-sheet.js"), "utf-8").split("\n").length;
  if (orchestratorLines > 700) {
    logFail(`[AI Policy 4.4] mobile-sheet.js is ${orchestratorLines} lines (exceeds 700-line modular maintainability limit).`);
  } else if (undocumentedModules === 0) {
    logPass(`[AI Policy 4.4] Modular architecture & JSDoc documentation verified (mobile-sheet.js: ${orchestratorLines}/700 lines, 100% documented modules).`);
  }

  // 7.4 Honest Package Categorization (Section 6.6)
  const modRaw = fs.readFileSync(path.join(rootDir, "module.json"), "utf-8");
  if (/zero[\s-]*ai/i.test(modRaw)) {
    logFail("[AI Policy 6.6] module.json must not claim the 'Zero AI' category when AI coding assistance is used.");
  } else {
    logPass("[AI Policy 6.6] Package manifest does not misrepresent 'Zero AI' categorization.");
  }
} catch (err) {
  logFail(`AI Policy verification threw an error: ${err.stack || err.message}`);
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




