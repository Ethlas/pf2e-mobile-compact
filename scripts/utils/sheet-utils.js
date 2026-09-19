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

