const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Mobile touch dialog allowing players to input physical table dice roll outcomes
 * for d20 checks and multi-type grouped damage pools.
 */
export class PhysicalDiceDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "pf2e-mobile-physical-dialog",
    tag: "div",
    classes: ["pf2e-mobile-sheet", "physical-dice-dialog-app"],
    window: {
      title: "Physical Dice Entry",
      resizable: false,
      controls: []
    },
    position: {
      width: 380,
      height: "auto"
    },
    actions: {
      cancel: PhysicalDiceDialog._onCancel,
      submit: PhysicalDiceDialog._onSubmit
    }
  };

  static PARTS = {
    content: {
      template: "modules/pf2e-mobile-compact/templates/physical-dice-dialog.hbs"
    }
  };

  /** @type {"check" | "damage"} */
  _mode = "check";
  /** @type {string} */
  _title = "";
  /** @type {string} */
  _subtitle = "";
  /** @type {object|null} */
  _target = null;
  /** @type {number} */
  _modifier = 0;
  /** @type {Array<object>} */
  _pools = [];
  /** @type {Function|null} */
  _resolve = null;
  /** @type {Function|null} */
  _reject = null;
  /** @type {boolean} */
  _settled = false;

  /**
   * @param {object} params
   * @param {"check" | "damage"} params.mode
   * @param {string} params.title
   * @param {string} [params.subtitle]
   * @param {object|null} [params.target]
   * @param {number} [params.modifier]
   * @param {Array<object>} [params.pools]
   * @param {Function} params.resolve
   * @param {Function} params.reject
   */
  constructor(params, options = {}) {
    super(options);
    this._mode = params.mode;
    this._title = params.title;
    this._subtitle = params.subtitle ?? "";
    this._target = params.target ?? null;
    this._modifier = params.modifier ?? 0;
    this._pools = params.pools ?? [];
    this._resolve = params.resolve;
    this._reject = params.reject;
  }

  /**
   * Prompts the player for a physical d20 check outcome.
   * @param {object} params
   * @param {string} params.title
   * @param {string} [params.subtitle]
   * @param {object|null} [params.target]
   * @param {number} [params.modifier]
   * @returns {Promise<number>} Entered d20 value
   */
  static promptCheck(params) {
    return new Promise((resolve, reject) => {
      const app = new PhysicalDiceDialog({
        mode: "check",
        ...params,
        resolve,
        reject
      });
      app.render(true);
    });
  }

  /**
   * Prompts the player for physical damage dice totals across one or more damage pools.
   * @param {object} params
   * @param {string} params.title
   * @param {string} [params.subtitle]
   * @param {object|null} [params.target]
   * @param {Array<object>} params.pools
   * @returns {Promise<Record<string, number>>} Map of pool ID to entered total
   */
  static promptDamage(params) {
    return new Promise((resolve, reject) => {
      const app = new PhysicalDiceDialog({
        mode: "damage",
        ...params,
        resolve,
        reject
      });
      app.render(true);
    });
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.isCheck = this._mode === "check";
    context.title = this._title;
    context.subtitle = this._subtitle;
    context.target = this._target;
    context.modifier = this._modifier;
    context.pools = this._pools;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Focus first input field automatically
    const firstInput = this.element?.querySelector("input.touch-target, input[type='number']");
    if (firstInput) {
      setTimeout(() => {
        try {
          firstInput.focus();
          firstInput.select();
        } catch {}
      }, 50);
    }

    // Support keyboard Enter to submit form
    const form = this.element?.querySelector("form.physical-roll-form");
    if (form && !form._enterListenerBound) {
      form.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          PhysicalDiceDialog._onSubmit.call(this, event, form);
        }
      });
      form._enterListenerBound = true;
    }
  }

  /** @override */
  _onClose(options) {
    if (!this._settled) {
      this._settled = true;
      this._reject?.(null);
    }
    super._onClose(options);
  }

  /**
   * Action handler: user cancels the roll dialog.
   */
  static _onCancel(event, target) {
    if (!this._settled) {
      this._settled = true;
      this._reject?.(null);
    }
    this.close();
  }

  /**
   * Action handler: user submits the entered physical roll outcomes.
   */
  static _onSubmit(event, target) {
    const errorEl = this.element?.querySelector(".physical-error-msg");
    const showError = (msg) => {
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.remove("hidden");
      } else {
        ui.notifications?.warn?.(msg);
      }
    };

    if (this._mode === "check") {
      const input = this.element?.querySelector("input[name='d20-val']");
      const rawVal = input?.value?.trim();
      const val = parseInt(rawVal, 10);

      if (isNaN(val) || val < 1 || val > 20) {
        showError("Please enter a valid d20 roll between 1 and 20.");
        input?.focus();
        return;
      }

      this._settled = true;
      this._resolve?.(val);
      this.close();
      return;
    }

    // Damage Mode
    const results = {};
    for (const pool of this._pools) {
      const input = this.element?.querySelector(`input[data-pool-id='${pool.id}']`);
      const rawVal = input?.value?.trim();
      const val = parseInt(rawVal, 10);

      if (isNaN(val) || val < pool.min || val > pool.max) {
        showError(`Please enter a valid total between ${pool.min} and ${pool.max} for ${pool.typeLabel} (${pool.formula}).`);
        input?.focus();
        return;
      }

      results[pool.id] = val;
    }

    this._settled = true;
    this._resolve?.(results);
    this.close();
  }
}

