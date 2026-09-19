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
 * Returns a standardized glyph string ('1', '2', '3', 'R', 'F') from an actionCost structure.
 * @param {object|string|number} actionCost
 * @returns {string}
 */
export function getGlyph(actionCost) {
  if (!actionCost) return "";
  if (typeof actionCost === "number" || typeof actionCost === "string") return String(actionCost);
  const type = actionCost.type;
  const value = actionCost.value;
  if (type === "reaction") return "R";
  if (type === "free") return "F";
  if (value !== undefined && value !== null && value !== "") return String(value);
  if (type === "action") return "1";
  return "";
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

