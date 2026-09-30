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
 * @returns {boolean}
 */
export function isMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const isStandaloneApp = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone === true;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
  const isIPad = (navigator.platform === "MacIntel" || /Macintosh/i.test(navigator.userAgent || "")) && (navigator.maxTouchPoints > 1);
  const isMobileViewport = window.innerWidth < 768;
  const isTouchCompact = (navigator.maxTouchPoints > 0 || "ontouchstart" in window) && window.innerWidth < 1024;

  return Boolean(isStandaloneApp || isMobileUA || isIPad || isMobileViewport || isTouchCompact);
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
 * When `disableCanvas` is true, sets Foundry's native `core.noCanvas` setting (and `CONFIG.Canvas.disabled = true`)
 * so Foundry v14 skips `Canvas#initialize()` and texture loading completely.
 * When `disableCanvas` is false, allows `Canvas#initialize()` so `canvas.tokens` and PF2e system flanking
 * exist in memory, while still pausing the background PIXI frame loop behind the full-screen mobile sheet
 * to prevent mobile WebKit GPU out-of-memory crashes.
 */
export function applyMobileCanvasState() {
  const disableCanvas = isMobileCanvasDisabled();
  if (typeof CONFIG !== "undefined" && CONFIG.Canvas) {
    CONFIG.Canvas.disabled = disableCanvas;
  }
  try {
    localStorage.setItem("core.noCanvas", disableCanvas ? "true" : "false");
  } catch {}
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
 * synchronizing Foundry's native `core.noCanvas` setting so `Canvas#initialize()` is skipped when disabled.
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
    localStorage.setItem("core.noCanvas", nextState ? "true" : "false");
  } catch {}
  try {
    if (game?.settings?.settings?.has?.("core.noCanvas")) {
      await game.settings.set("core", "noCanvas", nextState);
    }
  } catch {}
  try {
    if (game?.settings?.settings?.has?.("pf2e-mobile-compact.disableCanvas")) {
      await game.settings.set("pf2e-mobile-compact", "disableCanvas", nextState);
    }
  } catch {}
  applyMobileCanvasState();
  return nextState;
}


