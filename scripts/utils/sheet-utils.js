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

  if (costType === "reaction" && !isSpell) {
    return { glyph: "R", castActions: "", multiActionLabel: "", actionCostType: "reaction", actionCostValue: 0 };
  }
  if (costType === "free" && !isSpell) {
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

