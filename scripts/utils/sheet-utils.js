/**
 * Utility functions for PF2e Mobile Compact Sheet.
 */

/**
 * Safe mathematical clamp.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

/** Proficiency rank letters and English names, indexed by pf2e rank (0 untrained - 4 legendary). */
export const PROFICIENCY_RANK_LETTERS = ["U", "T", "E", "M", "L"];
export const PROFICIENCY_RANK_NAMES = ["Untrained", "Trained", "Expert", "Master", "Legendary"];

/**
 * Health state for colouring HP: "danger" at 25% or less, "warning" at 50% or less, otherwise "healthy".
 * Used by the party overview's HP bars and the character header's HP, so both switch at the same points.
 * @param {number} value Current HP
 * @param {number} max Maximum HP
 * @returns {{percent: number, state: "healthy"|"warning"|"danger"}}
 */
export function getHpState(value, max) {
  const percent = clamp(Math.round(((value ?? 0) / Math.max(max ?? 1, 1)) * 100), 0, 100);
  const state = percent <= 25 ? "danger" : percent <= 50 ? "warning" : "healthy";
  return { percent, state };
}

/**
 * Normalizes a PF2e action count or spell casting time string into a compact 1-3 action representation.
 * Examples:
 * - "1", "2", "3", 2 -> "1", "2", "3"
 * - "1 to 3", "1-3", "1 or 3", "1 to 3 actions" -> "1-3"
 * - "1 to 2", "2 to 3" -> "1-2", "2-3"
 * - "1 minute", "reaction", "free" -> ""
 * @param {string|number|null|undefined} raw
 * @returns {string}
 */
export function normalizeActionCountString(raw) {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim().toLowerCase();
  if (!s) return "";
  if (/(minute|hour|day|week|round)/.test(s)) return "";

  const rangeMatch = s.match(/^([123])\s*(?:to|or|-|–|—)\s*([123])(?:\s*actions?)?$/i);
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]}`;
  }

  const singleMatch = s.match(/^([123])(?:\s*actions?)?$/i);
  if (singleMatch) {
    return singleMatch[1];
  }

  return "";
}

/**
 * Returns a standardized glyph string ('1', '2', '3', '1-3', '1-2', '2-3', 'R', 'F')
 * from an actionCost structure or spell casting time value.
 * @param {object|string|number} actionCost
 * @param {string|number} [rawTime]
 * @returns {string}
 */
export function getGlyph(actionCost, rawTime = "") {
  const timeStr = String(rawTime || actionCost?.system?.time?.value || "").trim().toLowerCase();
  if (timeStr === "reaction") return "R";
  if (timeStr === "free") return "F";
  const normalizedTime = normalizeActionCountString(timeStr);
  if (normalizedTime) return normalizedTime;

  if (!actionCost) return "";
  if (typeof actionCost === "number" || typeof actionCost === "string") {
    const norm = normalizeActionCountString(actionCost);
    if (norm) return norm;
    if (String(actionCost).toLowerCase() === "reaction") return "R";
    if (String(actionCost).toLowerCase() === "free") return "F";
    return String(actionCost);
  }
  const type = actionCost.type ?? actionCost.system?.actionType?.value;
  const value = actionCost.value ?? actionCost.system?.actions?.value;
  if (type === "reaction") return "R";
  if (type === "free") return "F";
  if (value !== undefined && value !== null && value !== "") {
    return normalizeActionCountString(value) || String(value);
  }
  if (type === "action") return "1";
  return "";
}

/**
 * Extracts normalized action cost metadata for spells (1-3 actions, including ranges like 1-3,
 * defaulting to 2 actions for spells) and character/skill actions (highlighting multi-action costs > 1).
 * Reactions and free actions (spells included) get glyph "R" / "F" and an empty castActions,
 * because they have no action count.
 * @param {object} itemOrSpell
 * @param {object|string|number} [fallbackCost]
 * @param {object} [options]
 * @param {boolean} [options.isSpell]
 * @returns {{ glyph: string, castActions: string, multiActionLabel: string, actionCostType: string, actionCostValue: number|string }}
 */
export function parseActionCostInfo(itemOrSpell, fallbackCost = null, options = {}) {
  const isSpell = Boolean(options.isSpell || itemOrSpell?.type === "spell");
  if (!itemOrSpell && !fallbackCost) {
    const defaultSpellVal = isSpell ? "2" : "";
    return {
      glyph: defaultSpellVal,
      castActions: defaultSpellVal,
      multiActionLabel: "",
      actionCostType: "action",
      actionCostValue: isSpell ? 2 : 1
    };
  }

  const rawTime = itemOrSpell?.system?.time?.value ?? "";
  const timeLower = String(rawTime).trim().toLowerCase();
  const actionCost = itemOrSpell?.actionCost
    ?? (itemOrSpell?.system?.actionType?.value
      ? { type: itemOrSpell.system.actionType.value, value: itemOrSpell.system?.actions?.value }
      : itemOrSpell?.system?.actions)
    ?? fallbackCost;

  const costType = timeLower === "reaction" || actionCost?.type === "reaction"
    ? "reaction"
    : (timeLower === "free" || actionCost?.type === "free" ? "free" : (actionCost?.type ?? "action"));

  if (costType === "reaction") {
    return { glyph: "R", castActions: "", multiActionLabel: "", actionCostType: "reaction", actionCostValue: 0 };
  }
  if (costType === "free") {
    return { glyph: "F", castActions: "", multiActionLabel: "", actionCostType: "free", actionCostValue: 0 };
  }

  const countFromTime = normalizeActionCountString(rawTime);
  const rawCostValue = actionCost?.value ?? (typeof actionCost === "number" || typeof actionCost === "string" ? actionCost : "");
  const countFromCost = normalizeActionCountString(rawCostValue);
  const defaultActionCount = isSpell ? "2" : (actionCost?.type === "action" && !rawTime ? "1" : "");
  const countStr = countFromTime || countFromCost || defaultActionCount;

  const glyph = costType === "reaction" ? "R" : (costType === "free" ? "F" : (countStr || getGlyph(actionCost, rawTime) || (isSpell ? "2" : "")));
  const castActions = countStr || (isSpell ? "2" : "");
  const isMultiAction = Boolean(countStr && countStr !== "1");
  const multiActionLabel = isMultiAction ? countStr : "";
  const numericVal = Number(countStr);

  return {
    glyph,
    castActions,
    multiActionLabel,
    actionCostType: costType,
    actionCostValue: !Number.isNaN(numericVal) && numericVal > 0 ? numericVal : (countStr || (isSpell ? 2 : 1))
  };
}

/**
 * Check if the client is running in a mobile context via standalone app mode,
 * mobile user-agent inspection, or touch screen compact viewport.
 * The viewport test uses the short side, so a phone in landscape still counts, and needs a touch screen
 * whose only pointer is coarse (a finger), so a narrow desktop window or a touchscreen laptop with a
 * touchpad or mouse (pointer: fine) does not.
 * @returns {boolean}
 */
export function isMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const isStandaloneApp = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone === true;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
  const isIPad = (navigator.platform === "MacIntel" || /Macintosh/i.test(navigator.userAgent || "")) && (navigator.maxTouchPoints > 1);
  const hasTouch = (navigator.maxTouchPoints > 0 || "ontouchstart" in window);
  const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? hasTouch;
  const hasFinePointer = window.matchMedia?.("(pointer: fine)")?.matches ?? false;
  const width = window.innerWidth ?? 0;
  const height = window.innerHeight ?? width;
  const isCompactViewport = Math.min(width, height) < 1024;
  const isTouchCompact = Boolean(hasTouch && hasCoarsePointer && !hasFinePointer && isCompactViewport);

  return isStandaloneApp || isMobileUA || isIPad || isTouchCompact;
}

/**
 * Check if the client is running on an iOS / iPadOS WebKit device (iPhone, iPad, iPod).
 * @returns {boolean}
 */
export function isIOSDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOSUA = /iPhone|iPad|iPod/i.test(ua);
  const isIPadOS = (navigator.platform === "MacIntel" || /Macintosh/i.test(ua)) && (navigator.maxTouchPoints > 1);
  return Boolean(isIOSUA || isIPadOS);
}

/**
 * Checks whether the external 'physical-dice' module is installed and active.
 * @returns {boolean}
 */
export function isPhysicalDiceActive() {
  return Boolean(globalThis.game?.modules?.get("physical-dice")?.active);
}

/**
 * Returns the saved Digital/Physical roll mode for this browser: the 'physical-dice' module's setting.
 * Without that module active it is always "digital": the module does the manual rolling, so a "physical"
 * mode left in a setting would only switch the roll prompts off without asking for dice.
 * @returns {"digital"|"physical"}
 */
export function getStoredRollMode() {
  try {
    if (isPhysicalDiceActive() && globalThis.game?.settings?.settings?.has?.("physical-dice.rollMode")) {
      return game.settings.get("physical-dice", "rollMode") === "physical" ? "physical" : "digital";
    }
  } catch {}
  return "digital";
}

/**
 * Saves the Digital/Physical roll mode for this browser.
 * Persists to 'physical-dice.rollMode' (if installed) and synchronizes with
 * 'pf2e-mobile-compact.rollMode'.
 * @param {"digital"|"physical"} mode
 * @returns {Promise<void>}
 */
export async function setStoredRollMode(mode) {
  try {
    if (globalThis.game?.settings?.settings?.has?.("physical-dice.rollMode")) {
      await game.settings.set("physical-dice", "rollMode", mode);
    }
  } catch {}
  try {
    if (globalThis.game?.settings?.settings?.has?.("pf2e-mobile-compact.rollMode")) {
      await game.settings.set("pf2e-mobile-compact", "rollMode", mode);
    }
  } catch {}
}

/**
 * Returns the current manual dice entry method ("dialog" | "chat").
 * Defaults to "dialog".
 * @returns {"dialog"|"chat"}
 */
export function getDiceEntryMethod() {
  try {
    if (globalThis.game?.settings?.settings?.has?.("physical-dice.entryMethod")) {
      return game.settings.get("physical-dice", "entryMethod") || "dialog";
    }
  } catch {}
  return "dialog";
}

/**
 * Persists the manual dice entry method ("dialog" | "chat") to physical-dice settings.
 * @param {"dialog"|"chat"} method
 * @returns {Promise<void>}
 */
export async function setDiceEntryMethod(method) {
  try {
    if (globalThis.game?.settings?.settings?.has?.("physical-dice.entryMethod")) {
      await game.settings.set("physical-dice", "entryMethod", method);
    }
  } catch {}
}

/**
 * Returns whether the user has opted to disable the WebGL canvas on mobile.
 * Defaults to false (Canvas Enabled) and persists across mobile sessions via
 * localStorage and Foundry client settings.
 * @returns {boolean}
 */
export function isMobileCanvasDisabled() {
  try {
    const stored = localStorage.getItem("pf2e-mobile-compact.disableCanvas");
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {}
  try {
    if (game?.settings?.settings?.has?.("pf2e-mobile-compact.disableCanvas")) {
      return Boolean(game.settings.get("pf2e-mobile-compact", "disableCanvas"));
    }
  } catch {}
  return false;
}

/**
 * Applies the current mobile canvas state.
 * When `disableCanvas` is true, sets `CONFIG.Canvas.disabled = true` in memory so Foundry v14 skips
 * `Canvas#initialize()` and texture loading during mobile sessions.
 * When `disableCanvas` is false, allows `Canvas#initialize()` so `canvas.tokens` and PF2e system flanking
 * exist in memory, while still pausing the background PIXI frame loop behind the full-screen mobile sheet
 * to prevent mobile WebKit GPU out-of-memory crashes.
 */
export function applyMobileCanvasState() {
  const disableCanvas = isMobileCanvasDisabled();
  if (typeof CONFIG !== "undefined" && CONFIG.Canvas) {
    CONFIG.Canvas.disabled = disableCanvas;
  }
  ensureSafeCanvasTokens();
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.toggle("pf2e-canvas-disabled", disableCanvas);
  }

  try {
    if (typeof PIXI !== "undefined") {
      if (PIXI.settings) PIXI.settings.RESOLUTION = 1;
      if (PIXI.Ticker?.shared) PIXI.Ticker.shared.maxFPS = 15;
      if (PIXI.Ticker?.system) PIXI.Ticker.system.maxFPS = 15;
    }
  } catch {}

  const canvasObj = typeof canvas !== "undefined" ? canvas : null;
  if (!canvasObj?.app) return;
  try {
    if (canvasObj.app.renderer) {
      canvasObj.app.renderer.resolution = 1;
    }
    if (canvasObj.app.stage) {
      canvasObj.app.stage.renderable = false;
      canvasObj.app.stage.interactiveChildren = false;
    }
    if (canvasObj.weather?.clear) {
      canvasObj.weather.clear();
    }
    if (canvasObj.app.ticker) {
      canvasObj.app.ticker.maxFPS = 15;
      canvasObj.app.ticker.stop?.();
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | applyMobileCanvasState warning:", err);
  }
}

/**
 * Updates and persists the user's mobile canvas disable preference across sessions,
 * scoped strictly to pf2e-mobile-compact without polluting Foundry's global core.noCanvas setting.
 * @param {boolean} disabled
 * @returns {Promise<boolean>}
 */
export async function setMobileCanvasDisabled(disabled) {
  const nextState = Boolean(disabled);
  if (typeof CONFIG !== "undefined" && CONFIG.Canvas) {
    CONFIG.Canvas.disabled = nextState;
  }
  try {
    localStorage.setItem("pf2e-mobile-compact.disableCanvas", nextState ? "true" : "false");
  } catch {}
  try {
    if (game?.settings?.settings?.has?.("pf2e-mobile-compact.disableCanvas")) {
      await game.settings.set("pf2e-mobile-compact", "disableCanvas", nextState);
    }
  } catch {}
  applyMobileCanvasState();
  return nextState;
}

const enrichedDescriptionCache = new Map();

/**
 * High-performance cached HTML enrichment.
 * 1. If text has no Foundry syntax ('@' or '[['), returns raw text synchronously without invoking TextEditor.
 * 2. Checks in-memory cache keyed by document ID/UUID, update time/length, and raw text length.
 * 3. Only invokes TextEditor.enrichHTML on cache miss, storing result in memory.
 * @param {string} rawText
 * @param {object} [options]
 * @param {ClientDocument|object} [doc]
 * @returns {Promise<string>}
 */
export async function enrichDescriptionCached(rawText, options = {}, doc = null) {
  if (!rawText || typeof rawText !== "string") return "";

  // Fast path: if there are no Foundry macro/UUID/roll directives, return immediately!
  if (!rawText.includes("@") && !rawText.includes("[[")) {
    return rawText;
  }

  const TextEditorClass = foundry.applications?.ux?.TextEditor ?? globalThis.TextEditor;
  if (typeof TextEditorClass?.enrichHTML !== "function") {
    return rawText;
  }

  const docKey = doc?.uuid ?? doc?.id ?? "transient";
  const modTime = doc?._stats?.modifiedTime ?? doc?._stats?.lastModifiedBy ?? "";
  const cacheKey = `${docKey}:${modTime}:${rawText.length}`;

  const cached = enrichedDescriptionCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const enriched = await TextEditorClass.enrichHTML(rawText, {
      secrets: options.secrets ?? doc?.isOwner ?? false,
      rollData: options.rollData ?? {},
      async: true
    });
    if (enrichedDescriptionCache.size > 1000) {
      const firstKey = enrichedDescriptionCache.keys().next().value;
      enrichedDescriptionCache.delete(firstKey);
    }
    enrichedDescriptionCache.set(cacheKey, enriched);
    return enriched;
  } catch {
    return rawText;
  }
}

/**
 * Helper to create a proxy-backed tokens shim that gracefully absorbs
 * any unhandled method calls (e.g. socket planned movements, layer placeable queries).
 * @param {object} [initial]
 * @returns {object}
 */
function createSafeTokensShim(initial = {}) {
  const safeQuadtree = new Proxy({
    clear: () => {},
    remove: () => {},
    insert: () => {},
    update: () => {},
    get: () => [],
    collide: () => []
  }, {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      if (typeof prop === "string") return () => {};
      return undefined;
    }
  });

  const base = {
    controlled: [],
    placeables: [],
    get: () => null,
    releaseAll: () => {},
    select: () => {},
    activate() { return this; },
    deactivate() { return this; },
    _activate() { return this; },
    _deactivate() { return this; },
    draw() { return Promise.resolve(this); },
    tearDown() { return Promise.resolve(this); },
    createObject: () => null,
    recalculatePlannedMovementPaths: () => {},
    _updatePlannedMovements: () => {},
    updatePlannedMovements: () => {},
    clearPlannedMovements: () => {},
    quadtree: safeQuadtree,
    objects: null,
    preview: null,
    _configPreview: null,
    ...initial
  };
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      if (typeof prop === "string") {
        if (prop === "active") return true;
        if (prop === "quadtree") return safeQuadtree;
        if (prop === "objects" || prop === "preview" || prop === "_configPreview") return null;
        return () => {};
      }
      return undefined;
    }
  });
}

/**
 * Ensures canvas.tokens exists and has safe defaults ({ controlled: [], placeables: [] })
 * and provides a no-op fallback for canvas.app (ticker, stage) to prevent third-party modules
 * (such as pf2e-kingmaker-tools, splatter) from throwing TypeErrors when canvas is disabled,
 * uninitialized, or running headless on mobile.
 */
export function ensureSafeCanvasTokens() {
  const canvasObj = typeof canvas !== "undefined" ? canvas : null;
  if (canvasObj) {
    if (!canvasObj.tokens) {
      const mockTokens = createSafeTokensShim();
      try {
        canvasObj.tokens = mockTokens;
      } catch {
        try {
          Object.defineProperty(canvasObj, "tokens", {
            get() { return this._safeTokensShim ??= mockTokens; },
            set(v) { this._safeTokensShim = v; },
            configurable: true,
            enumerable: true
          });
        } catch {}
      }
    } else {
      if (!Array.isArray(canvasObj.tokens.controlled)) {
        try { canvasObj.tokens.controlled = []; } catch {}
      }
      if (!Array.isArray(canvasObj.tokens.placeables)) {
        try { canvasObj.tokens.placeables = []; } catch {}
      }
      if (typeof canvasObj.tokens.createObject !== "function") {
        try { canvasObj.tokens.createObject = () => null; } catch {}
      }
      if (typeof canvasObj.tokens.recalculatePlannedMovementPaths !== "function") {
        try { canvasObj.tokens.recalculatePlannedMovementPaths = () => {}; } catch {}
      }
      if (typeof canvasObj.tokens._updatePlannedMovements !== "function") {
        try { canvasObj.tokens._updatePlannedMovements = () => {}; } catch {}
      }
      if (typeof canvasObj.tokens.updatePlannedMovements !== "function") {
        try { canvasObj.tokens.updatePlannedMovements = () => {}; } catch {}
      }
      if (typeof canvasObj.tokens.clearPlannedMovements !== "function") {
        try { canvasObj.tokens.clearPlannedMovements = () => {}; } catch {}
      }
      if (typeof canvasObj.tokens.activate !== "function") {
        try { canvasObj.tokens.activate = function() { return this; }; } catch {}
      }
      if (typeof canvasObj.tokens.deactivate !== "function") {
        try { canvasObj.tokens.deactivate = function() { return this; }; } catch {}
      }
      if (canvasObj.tokens.quadtree) {
        if (typeof canvasObj.tokens.quadtree.remove !== "function") {
          try { canvasObj.tokens.quadtree.remove = () => {}; } catch {}
        }
        if (typeof canvasObj.tokens.quadtree.update !== "function") {
          try { canvasObj.tokens.quadtree.update = () => {}; } catch {}
        }
        if (typeof canvasObj.tokens.quadtree.insert !== "function") {
          try { canvasObj.tokens.quadtree.insert = () => {}; } catch {}
        }
        if (typeof canvasObj.tokens.quadtree.clear !== "function") {
          try { canvasObj.tokens.quadtree.clear = () => {}; } catch {}
        }
      }
    }

    if (!canvasObj.app) {
      const mockApp = {
        ticker: {
          add: () => {},
          remove: () => {},
          start: () => {},
          stop: () => {},
          started: false,
          maxFPS: 15
        },
        stage: {
          renderable: false,
          interactiveChildren: false,
          children: []
        },
        renderer: {
          resolution: 1
        }
      };
      try {
        canvasObj.app = mockApp;
      } catch {
        try {
          Object.defineProperty(canvasObj, "app", {
            get() { return this._safeAppShim ??= mockApp; },
            set(v) { this._safeAppShim = v; },
            configurable: true,
            enumerable: true
          });
        } catch {}
      }
    }
  }

  if (typeof game !== "undefined" && game?.canvas) {
    if (!game.canvas.tokens) {
      try {
        game.canvas.tokens = canvasObj?.tokens ?? createSafeTokensShim();
      } catch {}
    } else {
      if (typeof game.canvas.tokens.createObject !== "function") {
        try { game.canvas.tokens.createObject = () => null; } catch {}
      }
      if (typeof game.canvas.tokens.recalculatePlannedMovementPaths !== "function") {
        try { game.canvas.tokens.recalculatePlannedMovementPaths = () => {}; } catch {}
      }
      if (typeof game.canvas.tokens._updatePlannedMovements !== "function") {
        try { game.canvas.tokens._updatePlannedMovements = () => {}; } catch {}
      }
      if (typeof game.canvas.tokens.updatePlannedMovements !== "function") {
        try { game.canvas.tokens.updatePlannedMovements = () => {}; } catch {}
      }
      if (typeof game.canvas.tokens.clearPlannedMovements !== "function") {
        try { game.canvas.tokens.clearPlannedMovements = () => {}; } catch {}
      }
      if (typeof game.canvas.tokens.activate !== "function") {
        try { game.canvas.tokens.activate = function() { return this; }; } catch {}
      }
      if (typeof game.canvas.tokens.deactivate !== "function") {
        try { game.canvas.tokens.deactivate = function() { return this; }; } catch {}
      }
      if (game.canvas.tokens.quadtree) {
        if (typeof game.canvas.tokens.quadtree.remove !== "function") {
          try { game.canvas.tokens.quadtree.remove = () => {}; } catch {}
        }
        if (typeof game.canvas.tokens.quadtree.update !== "function") {
          try { game.canvas.tokens.quadtree.update = () => {}; } catch {}
        }
        if (typeof game.canvas.tokens.quadtree.insert !== "function") {
          try { game.canvas.tokens.quadtree.insert = () => {}; } catch {}
        }
        if (typeof game.canvas.tokens.quadtree.clear !== "function") {
          try { game.canvas.tokens.quadtree.clear = () => {}; } catch {}
        }
      }
    }
  }
}


