/**
 * Physical Dice Adapter Bridge for PF2e Mobile Compact
 * Delegates roll context and interception to the standalone 'physical-dice' module
 * while providing seamless fallback when the external module is inactive.
 */
import { getStoredRollMode, isPhysicalDiceActive } from "../utils/sheet-utils.js";

/**
 * Custom error thrown when a user cancels the physical dice entry prompt.
 */
export class PhysicalRollCancelledError extends Error {
  constructor(message = "Physical roll cancelled by user.") {
    super(message);
    this.name = "PhysicalRollCancelledError";
    this.isPhysicalRollCancelled = true;
  }
}

/**
 * Adapter managing roll context delegation to the physical-dice module.
 */
export class PhysicalDiceManager {
  static _activeContext = null;

  /**
   * Active context for the currently executing physical roll.
   * @type {{ title?: string, subtitle?: string, target?: object, actor?: object, isPhysical?: boolean } | null}
   */
  static get activeContext() {
    const extApi = game?.modules?.get("physical-dice")?.api?.PhysicalDiceManager;
    if (extApi) return extApi.activeContext;
    return this._activeContext;
  }

  static set activeContext(ctx) {
    this._activeContext = ctx;
    const extApi = game?.modules?.get("physical-dice")?.api?.PhysicalDiceManager;
    if (extApi) extApi.activeContext = ctx;
  }

  /**
   * Checks whether Physical Dice mode is currently active for this client.
   * @returns {boolean}
   */
  static isPhysicalModeActive() {
    const extApi = game?.modules?.get("physical-dice")?.api?.PhysicalDiceManager;
    if (extApi) return extApi.isPhysicalModeActive();
    if (this._activeContext?.isPhysical === false) return false;
    if (this._activeContext?.isPhysical === true) return true;
    return getStoredRollMode() === "physical";
  }

  /**
   * Evaluates a callback within a physical roll interception context.
   *
   * @param {object} context Context details (title, subtitle, target, actor)
   * @param {Function} fn Async function that executes the roll
   * @param {boolean} [isPhysical=true]
   * @returns {Promise<any>}
   */
  static async withPhysicalMode(context, fn, isPhysical = true) {
    const extApi = game?.modules?.get("physical-dice")?.api?.PhysicalDiceManager;
    if (extApi) {
      return await extApi.withPhysicalMode(context, fn, isPhysical);
    }

    const prevContext = this.activeContext;
    try {
      this.activeContext = { ...context, isPhysical: !!isPhysical };
      return await fn();
    } catch (err) {
      if (err?.isPhysicalRollCancelled) {
        console.log("PF2e Mobile Compact | Physical roll cancelled by user.");
        return null;
      }
      throw err;
    } finally {
      this.activeContext = prevContext;
    }
  }

  /**
   * Checks if a roll should be intercepted (delegated to physical-dice module).
   * @param {object} roll
   * @returns {boolean}
   */
  static shouldIntercept(roll) {
    const extApi = game?.modules?.get("physical-dice")?.api?.PhysicalDiceManager;
    if (extApi?.shouldIntercept) return extApi.shouldIntercept(roll);
    return false;
  }
}

/**
 * Setup hook retained for backward compatibility (no-op; interception is handled by physical-dice module).
 */
export function setupPhysicalDiceInterceptor() {
  // Interception is delegated to the standalone physical-dice module
}
