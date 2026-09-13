import { PhysicalDiceDialog } from "../apps/physical-dice-dialog.js";

/**
 * Custom error thrown when a user cancels the physical dice entry dialog.
 */
export class PhysicalRollCancelledError extends Error {
  constructor(message = "Physical roll cancelled by user.") {
    super(message);
    this.name = "PhysicalRollCancelledError";
    this.isPhysicalRollCancelled = true;
  }
}

/**
 * Capitalizes or localizes a damage type slug.
 * @param {string} type
 * @returns {string}
 */
export function formatDamageType(type) {
  if (!type) return "Untyped";
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

/**
 * Partitions a total numeric sum across an arbitrary number of dice
 * ensuring that each individual die result is an integer between 1 and faces
 * and the sum of all dice strictly equals the total.
 *
 * @param {number} total Total sum to distribute
 * @param {number} count Number of dice
 * @param {number} faces Die faces
 * @returns {number[]} Array of die results
 */
export function partitionTotal(total, count, faces) {
  if (count <= 1) return [total];

  // Clamp total between min possible (count * 1) and max possible (count * faces)
  const minPossible = count * 1;
  const maxPossible = count * faces;
  const safeTotal = Math.min(Math.max(total, minPossible), maxPossible);

  const base = Math.floor(safeTotal / count);
  const remainder = safeTotal % count;
  const results = [];

  for (let i = 0; i < count; i++) {
    results.push(base + (i < remainder ? 1 : 0));
  }

  return results;
}

/**
 * Manages physical dice interception for PF2e roll executions.
 */
export class PhysicalDiceManager {
  /**
   * Active context for the currently executing physical roll.
   * @type {{ title?: string, subtitle?: string, target?: object, actor?: object } | null}
   */
  static activeContext = null;

  /**
   * Evaluates a callback within a physical roll interception context.
   * When isPhysical is true, any roll.evaluate() called during fn() will be intercepted
   * to prompt the user for manual physical dice results.
   *
   * @param {object} context Context details (title, subtitle, target, actor)
   * @param {Function} fn Async function that executes the roll
   * @param {boolean} [isPhysical=true]
   * @returns {Promise<any>}
   */
  static async withPhysicalMode(context, fn, isPhysical = true) {
    if (!isPhysical) {
      return await fn();
    }

    try {
      this.activeContext = context ?? {};
      return await fn();
    } catch (err) {
      if (err?.isPhysicalRollCancelled) {
        console.log("PF2e Mobile Compact | Physical roll cancelled by user.");
        return null;
      }
      throw err;
    } finally {
      this.activeContext = null;
    }
  }

  /**
   * Determines if a given Roll should be intercepted for physical dice entry.
   * @param {Roll} roll
   * @returns {boolean}
   */
  static shouldIntercept(roll) {
    if (!this.activeContext) return false;
    if (roll._evaluated) return false;

    // Check for unevaluated dice in DamageRoll instances
    if (Array.isArray(roll.instances) && roll.instances.length > 0) {
      return roll.instances.some(inst => {
        const terms = inst.terms ?? [];
        return terms.some(t => !t._evaluated && (typeof t.faces === "number" || typeof t.number === "number"));
      });
    }

    // Check for unevaluated dice in regular roll terms
    if (Array.isArray(roll.terms)) {
      return roll.terms.some(t => !t._evaluated && (typeof t.faces === "number" || typeof t.number === "number"));
    }

    return false;
  }

  /**
   * Intercepts a roll evaluation, prompting the user for physical dice inputs
   * and populating the terms with the entered results.
   *
   * @param {Roll} roll
   * @param {object} [options={}]
   * @returns {Promise<boolean>} True if handled, false if bypassed
   */
  static async interceptRoll(roll, options = {}) {
    const context = this.activeContext ?? {};
    const title = context.title ?? roll.options?.title ?? roll.options?.flavor ?? "Roll";
    const subtitle = context.subtitle ?? roll.options?.action ?? "";
    const target = context.target ?? null;

    // Target information extraction (name only to preserve GM secrecy)
    const targetInfo = target ? {
      name: target.name ?? "Target"
    } : null;

    // -------------------------------------------------------------
    // Scenario A: PF2e DamageRoll (with multiple damage instances)
    // -------------------------------------------------------------
    if (Array.isArray(roll.instances) && roll.instances.length > 0) {
      const pools = [];
      let poolCounter = 0;

      for (let i = 0; i < roll.instances.length; i++) {
        const inst = roll.instances[i];
        const terms = inst.terms ?? [];

        // Find dice terms
        const diceTerms = terms.filter(t => typeof t.faces === "number" && typeof t.number === "number");
        // Find numeric modifier terms
        const modTerms = terms.filter(t => typeof t.number === "number" && typeof t.faces !== "number");
        const instanceMod = modTerms.reduce((sum, t) => sum + (t.number ?? 0), 0);

        for (const term of diceTerms) {
          const count = term.number ?? 1;
          const faces = term.faces ?? 6;
          pools.push({
            id: `pool_${poolCounter++}`,
            instance: inst,
            term: term,
            type: inst.type ?? "untyped",
            typeLabel: formatDamageType(inst.type),
            persistent: !!inst.persistent,
            materials: Array.from(inst.materials ?? []).join(", "),
            formula: `${count}d${faces}`,
            number: count,
            faces: faces,
            min: count * 1,
            max: count * faces,
            mod: instanceMod
          });
        }
      }

      // If no dice were found (e.g. flat damage only), allow normal evaluation
      if (pools.length === 0) {
        return false;
      }

      // Prompt user for damage totals for each pool
      const enteredTotals = await PhysicalDiceDialog.promptDamage({
        title,
        subtitle,
        target: targetInfo,
        pools
      });

      if (!enteredTotals) {
        throw new PhysicalRollCancelledError();
      }

      // Assign manual outcomes to dice terms
      for (const pool of pools) {
        const totalVal = enteredTotals[pool.id];
        const diceResults = partitionTotal(totalVal, pool.number, pool.faces);
        pool.term.results = diceResults.map(r => ({ result: r, active: true }));
        pool.term._total = totalVal;
        pool.term._evaluated = true;
      }

      // Complete evaluation of all instances
      for (const inst of roll.instances) {
        if (typeof inst.evaluate === "function" && !inst._evaluated) {
          await inst.evaluate(options);
        }
      }

      // Compute DamageRoll total
      if (typeof roll._evaluateTotal === "function") {
        roll._total = roll._evaluateTotal();
      } else {
        roll._total = roll.instances.reduce((sum, inst) => sum + (inst.total ?? 0), 0);
      }
      roll._evaluated = true;
      return true;
    }

    // -------------------------------------------------------------
    // Scenario B: CheckRoll or Standard Roll (e.g. 1d20 + mod)
    // -------------------------------------------------------------
    const terms = roll.terms ?? [];
    const diceTerms = terms.filter(t => typeof t.faces === "number" && typeof t.number === "number");

    if (diceTerms.length === 0) {
      return false;
    }

    // Check if this is a d20 check
    const d20Term = diceTerms.find(t => t.faces === 20) ?? diceTerms[0];
    const modTerms = terms.filter(t => typeof t.number === "number" && typeof t.faces !== "number");
    const totalMod = modTerms.reduce((sum, t) => sum + (t.number ?? 0), 0);

    const d20Result = await PhysicalDiceDialog.promptCheck({
      title,
      subtitle,
      target: targetInfo,
      modifier: totalMod,
      term: d20Term
    });

    if (typeof d20Result !== "number" || isNaN(d20Result)) {
      throw new PhysicalRollCancelledError();
    }

    // Populate d20 term
    const count = d20Term.number ?? 1;
    const partitioned = partitionTotal(d20Result, count, d20Term.faces ?? 20);
    d20Term.results = partitioned.map(r => ({ result: r, active: true }));
    d20Term._total = d20Result;
    d20Term._evaluated = true;

    // Evaluate remaining non-dice terms
    for (const term of terms) {
      if (!term._evaluated && typeof term.evaluate === "function") {
        await term.evaluate(options);
      }
    }

    if (typeof roll._evaluateTotal === "function") {
      roll._total = roll._evaluateTotal();
    } else {
      roll._total = d20Result + totalMod;
    }
    roll._evaluated = true;
    return true;
  }
}

/**
 * Monkey-patches Roll prototypes across Foundry and PF2e to route
 * evaluations through PhysicalDiceManager when physical mode is active.
 */
export function setupPhysicalDiceInterceptor() {
  const rollClasses = new Set([
    globalThis.Roll,
    CONFIG.Dice?.rolls?.find(r => r.name === "DamageRoll"),
    CONFIG.Dice?.rolls?.find(r => r.name === "CheckRoll"),
    CONFIG.PF2E?.Dice?.DamageRoll,
    CONFIG.PF2E?.Dice?.CheckRoll,
    game.pf2e?.DamageRoll,
    game.pf2e?.CheckRoll
  ].filter(Boolean));

  for (const RollCls of rollClasses) {
    if (RollCls?.prototype && !RollCls.prototype._pf2eMobilePhysicalPatched) {
      const origEvaluate = RollCls.prototype.evaluate;
      RollCls.prototype.evaluate = async function(options = {}) {
        if (this._evaluated) return this;
        if (PhysicalDiceManager.shouldIntercept(this)) {
          const handled = await PhysicalDiceManager.interceptRoll(this, options);
          if (handled) return this;
        }
        return origEvaluate.call(this, options);
      };
      RollCls.prototype._pf2eMobilePhysicalPatched = true;
    }
  }

  console.log("PF2e Mobile Compact | Physical dice roll interceptor active.");
}
