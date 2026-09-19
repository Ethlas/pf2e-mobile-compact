const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
import { CompendiumPickerApp } from "./compendium-picker.js";
import { PhysicalDiceManager } from "../rolls/physical-dice-interceptor.js";
import { clamp, getGlyph } from "../utils/sheet-utils.js";
import {
  getTargetableToken,
  getOriginToken,
  setTargetToken,
  ensureTokenControlled
} from "../tokens/token-adapter.js";
import { prepareHeaderContext } from "./sheet-helpers/context-header.js";
import { prepareActionsContext } from "./sheet-helpers/context-actions.js";
import { prepareSkillsContext } from "./sheet-helpers/context-skills.js";
import { prepareInventoryContext } from "./sheet-helpers/context-inventory.js";
import { prepareSpellsContext, formatSpell } from "./sheet-helpers/context-spells.js";
import {
  resolveTargetForAction,
  promptTargetSelection,
  promptVariantSelection,
  promptStatisticSelection,
  promptStrikeSelection
} from "./sheet-helpers/sheet-prompts.js";
import {
  onExecuteStrike,
  onExecuteDamage,
  onExecuteCritical,
  onExecuteAuxiliaryAction,
  onItemToChat,
  onUseAction,
  onRollActionCheck,
  onRollSkill,
  onConsumeItem,
  onToggleActionSummary
} from "./sheet-helpers/actions-handlers.js";
import {
  onSwitchSpellSubTab,
  onToggleRankGroup,
  onOpenSpellPrepPicker,
  prepareSlot,
  onUnprepareSlot,
  onToggleSlotExpended,
  onResetDailySpells,
  onSaveSpellPreset,
  onApplySpellPreset,
  onDeleteSpellPreset,
  onOpenCompendiumPicker,
  onAdjustSlot,
  onAdjustFocus,
  onCastSpell,
  onToggleSignatureSpell,
  onRemoveSpell
} from "./sheet-helpers/spells-handlers.js";

/**
 * Mobile-optimized compact character sheet application subclassing Foundry VTT's modern ActorSheetV2.
 * High-performance mobile UI with physical dice support, headless token targeting,
 * unified spellcasting, and integrated mobile chat tab.
 */
export class PF2eMobileSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "pf2e-mobile-sheet-{id}",
    classes: ["pf2e-mobile-sheet", "compact-theme"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "PF2e Mobile Sheet",
      icon: "fa-solid fa-mobile-screen-button",
      resizable: true
    },
    position: {
      width: 420,
      height: 750
    },
    actions: {
      applyHeaderDamage: PF2eMobileSheet._onApplyDamage,
      applyHeaderHeal: PF2eMobileSheet._onApplyHeal,
      setTempHP: PF2eMobileSheet._onSetTempHP,
      adjustTempHP: PF2eMobileSheet._onAdjustTempHP,
      rollSave: PF2eMobileSheet._onRollSave,
      rollPerception: PF2eMobileSheet._onRollPerception,
      rollInitiative: PF2eMobileSheet._onRollInitiative,
      selectTarget: PF2eMobileSheet._onSelectTarget,
      toggleRollMode: PF2eMobileSheet._onToggleRollMode,
      switchTab: PF2eMobileSheet._onSwitchTab,
      scrollChatToBottom: PF2eMobileSheet._onScrollChatToBottom,
      openCompendiumPicker: PF2eMobileSheet._onOpenCompendiumPicker,
      adjustSlot: PF2eMobileSheet._onAdjustSlot,
      adjustFocus: PF2eMobileSheet._onAdjustFocus,
      executeStrike: PF2eMobileSheet._onExecuteStrike,
      executeDamage: PF2eMobileSheet._onExecuteDamage,
      executeCritical: PF2eMobileSheet._onExecuteCritical,
      executeAuxiliaryAction: PF2eMobileSheet._onExecuteAuxiliaryAction,
      itemToChat: PF2eMobileSheet._onItemToChat,
      useAction: PF2eMobileSheet._onUseAction,
      rollActionCheck: PF2eMobileSheet._onRollActionCheck,
      rollSkill: PF2eMobileSheet._onRollSkill,
      consumeItem: PF2eMobileSheet._onConsumeItem,
      castSpell: PF2eMobileSheet._onCastSpell,
      switchActor: PF2eMobileSheet._onSwitchActor,
      toggleFullscreen: PF2eMobileSheet._onToggleFullscreen,
      switchActionSubTab: PF2eMobileSheet._onSwitchActionSubTab,
      toggleActionSummary: PF2eMobileSheet._onToggleActionSummary,
      switchSpellSubTab: PF2eMobileSheet._onSwitchSpellSubTab,
      toggleRankGroup: PF2eMobileSheet._onToggleRankGroup,
      openSpellPrepPicker: PF2eMobileSheet._onOpenSpellPrepPicker,
      unprepareSlot: PF2eMobileSheet._onUnprepareSlot,
      toggleSlotExpended: PF2eMobileSheet._onToggleSlotExpended,
      resetDailySpells: PF2eMobileSheet._onResetDailySpells,
      saveSpellPreset: PF2eMobileSheet._onSaveSpellPreset,
      applySpellPreset: PF2eMobileSheet._onApplySpellPreset,
      deleteSpellPreset: PF2eMobileSheet._onDeleteSpellPreset,
      toggleSignatureSpell: PF2eMobileSheet._onToggleSignatureSpell,
      removeSpell: PF2eMobileSheet._onRemoveSpell
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: "modules/pf2e-mobile-compact/templates/parts/header.hbs"
    },
    sheet: {
      template: "modules/pf2e-mobile-compact/templates/mobile-sheet.hbs"
    }
  };

  /** @type {string} */
  _activeTab = "actions";

  /** @type {"encounter" | "exploration" | "downtime"} */
  _actionSubTab = "encounter";

  /** @type {"spells" | "preparation"} */
  _spellSubTab = "spells";

  /** @type {Set<number>} */
  _collapsedRankGroups = new Set();

  /** @type {"digital" | "physical"} */
  _rollMode = "digital";

  /** @type {Set<string>} */
  _expandedActionIds = new Set();

  /** @type {Array<{name: string, id: number}>} */
  _sceneHookIds = [];

  /** @type {number} */
  _unreadChatCount = 0;

  /** @type {number|null} */
  _chatHookId = null;

  /** @type {DocumentFragment} */
  _tempChatFragment = document.createDocumentFragment();

  /** @type {HTMLElement|null} */
  _chatOriginalParent = null;

  /** @type {Node|null} */
  _chatOriginalNextSibling = null;

  /**
   * Current active tab key.
   * @type {string}
   */
  get activeTab() {
    return this._activeTab;
  }

  /**
   * Current active action sub-tab key.
   * @type {"encounter" | "exploration" | "downtime"}
   */
  get actionSubTab() {
    return this._actionSubTab;
  }

  /**
   * Current active roll mode.
   * @type {"digital" | "physical"}
   */
  get rollMode() {
    return this._rollMode;
  }

  /** @override */
  _canRender(options) {
    if (!this.document) return false;
    const hasPerm = game.user?.isGM || this.document.isOwner || this.document.testUserPermission(game.user, this.options.viewPermission ?? "LIMITED");
    if (!hasPerm) return false;
    return true;
  }

  /** @override */
  _replaceHTML(result, content, options) {
    const chatMount = content.querySelector?.(".mobile-chat-mount");
    const chatEl = (ui.chat?.element instanceof HTMLElement ? ui.chat.element : ui.chat?.element?.[0]) ?? document.getElementById("chat");
    if (chatMount && chatEl && chatMount.contains(chatEl)) {
      this._tempChatFragment.appendChild(chatEl);
    }
    super._replaceHTML(result, content, options);
    const newChatMount = content.querySelector?.(".mobile-chat-mount");
    if (newChatMount && chatEl) {
      newChatMount.appendChild(chatEl);
    }
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this._registerSceneListeners();
    this._registerChatListener();
    this._dockChatElement();
    this._ensureTokenControlled();

    if (this._activeTab === "chat") {
      this._unreadChatCount = 0;
      this._updateChatBadge();
      this._scrollChatToBottom(false);
      this._setupScrollBottomListener();
    }

    // Synchronize fullscreen toggle button icon and mode
    const isFs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.body.classList.contains("pf2e-fullscreen") ||
      this.element.classList.contains("fullscreen-mode")
    );
    const fsIcon = this.element.querySelector(".btn-fullscreen i");
    if (fsIcon) {
      fsIcon.className = isFs ? "fas fa-compress" : "fas fa-expand";
    }

    // ApplicationV2 actions only listen for click events by default and invoke preventDefault().
    // We prevent select elements from triggering ApplicationV2's click delegator so that the native
    // mobile picker opens properly, and delegate change events for select and input elements.
    this.element.querySelectorAll("select").forEach(sel => {
      if (!sel._mobileClickGuard) {
        sel.addEventListener("click", e => e.stopPropagation());
        sel._mobileClickGuard = true;
      }
    });

    if (!this.element._mobileActionChangeBound) {
      this.element.addEventListener("change", (event) => {
        const actionEl = event.target?.closest?.("select[data-change-action], select[data-action], input[data-change-action], input[data-action]");
        if (!actionEl) return;
        const actionName = actionEl.dataset.changeAction || actionEl.dataset.action;
        let handler = this.options.actions?.[actionName] ?? this.constructor.DEFAULT_OPTIONS?.actions?.[actionName];
        if (typeof handler === "object" && handler !== null) {
          handler = handler.handler;
        }
        if (typeof handler === "function") {
          handler.call(this, event, actionEl);
        }
      });
      this.element._mobileActionChangeBound = true;
    }
  }

  /** @override */
  _onClose(options) {
    this._unregisterSceneListeners();
    this._unregisterChatListener();
    this._restoreChatElement();
    super._onClose(options);
  }

  /**
   * Registers real-time scene token and targeting listeners to keep
   * the header target selector perfectly synchronized with the TV map.
   */
  _registerSceneListeners() {
    if (this._sceneHookIds.length > 0) return;

    const onTokenChange = () => {
      if (this.rendered) {
        this.render({ parts: ["header"] });
      }
    };

    this._sceneHookIds.push(
      { name: "createToken", id: Hooks.on("createToken", onTokenChange) },
      { name: "deleteToken", id: Hooks.on("deleteToken", onTokenChange) },
      { name: "updateToken", id: Hooks.on("updateToken", onTokenChange) },
      {
        name: "targetToken",
        id: Hooks.on("targetToken", (user) => {
          if (user.id === game.user.id && this.rendered) {
            this.render({ parts: ["header"] });
          }
        })
      },
      { name: "canvasReady", id: Hooks.on("canvasReady", onTokenChange) },
      { name: "createCombat", id: Hooks.on("createCombat", onTokenChange) },
      { name: "deleteCombat", id: Hooks.on("deleteCombat", onTokenChange) },
      { name: "updateCombat", id: Hooks.on("updateCombat", onTokenChange) },
      { name: "createCombatant", id: Hooks.on("createCombatant", onTokenChange) },
      { name: "deleteCombatant", id: Hooks.on("deleteCombatant", onTokenChange) },
      { name: "updateCombatant", id: Hooks.on("updateCombatant", onTokenChange) }
    );
  }

  /**
   * Unregisters real-time scene hooks when the sheet is closed.
   */
  _unregisterSceneListeners() {
    for (const hook of this._sceneHookIds) {
      Hooks.off(hook.name, hook.id);
    }
    this._sceneHookIds = [];
  }

  /**
   * Completely removes/hides chat input controls, forms, textareas ("Enter Message"),
   * and option dropdowns within the mobile chat view, dedicating the tab strictly
   * to roll card reviews and damage calculation buttons.
   * @param {HTMLElement} [chatEl]
   */
  _disableChatInputs(chatEl) {
    const root = chatEl ?? this.element?.querySelector(".mobile-chat-mount");
    if (!root) return;

    // Target forms, controls bar, textareas, inputs, and selects outside of messages
    const targets = root.querySelectorAll(
      "#chat-controls, #chat-form, form, textarea, select, .chat-controls, .chat-form, .control-tools, header.chat-header, footer"
    );
    for (const el of targets) {
      if (el.closest("#chat-log, .chat-log, .message")) continue;

      el.style.setProperty("display", "none", "important");
      el.style.setProperty("visibility", "hidden", "important");
      el.style.setProperty("height", "0px", "important");
      el.style.setProperty("min-height", "0px", "important");
      el.style.setProperty("max-height", "0px", "important");
      el.style.setProperty("margin", "0px", "important");
      el.style.setProperty("padding", "0px", "important");
      el.style.setProperty("border", "none", "important");
      el.style.setProperty("overflow", "hidden", "important");
      el.style.setProperty("pointer-events", "none", "important");
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT") {
        el.disabled = true;
        el.tabIndex = -1;
      }
    }

    const chatScroll = root.querySelector(".chat-scroll");
    if (chatScroll) {
      chatScroll.style.setProperty("flex", "1 1 100%", "important");
      chatScroll.style.setProperty("height", "100%", "important");
      chatScroll.style.setProperty("min-height", "0", "important");
      chatScroll.style.setProperty("max-height", "100%", "important");
      chatScroll.style.setProperty("width", "100%", "important");
      chatScroll.style.setProperty("overflow-y", "auto", "important");
      chatScroll.style.setProperty("overflow-x", "hidden", "important");
      chatScroll.style.setProperty("-webkit-overflow-scrolling", "touch", "important");
      chatScroll.style.setProperty("position", "relative", "important");
    }

    const chatLog = root.querySelector("#chat-log, .chat-log");
    if (chatLog) {
      chatLog.style.setProperty("display", "flex", "important");
      chatLog.style.setProperty("flex-direction", "column", "important");
      chatLog.style.setProperty("flex-wrap", "nowrap", "important");
      chatLog.style.setProperty("width", "100%", "important");
      chatLog.style.setProperty("max-width", "100%", "important");

      if (chatScroll) {
        chatLog.style.setProperty("flex", "1 1 auto", "important");
        chatLog.style.setProperty("height", "auto", "important");
        chatLog.style.setProperty("min-height", "100%", "important");
        chatLog.style.removeProperty("max-height");
        chatLog.style.setProperty("overflow-y", "visible", "important");
        chatLog.style.setProperty("overflow-x", "hidden", "important");
      } else {
        chatLog.style.setProperty("flex", "1 1 100%", "important");
        chatLog.style.setProperty("height", "100%", "important");
        chatLog.style.setProperty("max-height", "100%", "important");
        chatLog.style.setProperty("overflow-y", "auto", "important");
        chatLog.style.setProperty("overflow-x", "hidden", "important");
      }

      for (const msg of chatLog.children) {
        msg.style.setProperty("display", "flex", "important");
        msg.style.setProperty("flex-direction", "column", "important");
        msg.style.setProperty("width", "100%", "important");
        msg.style.setProperty("min-width", "100%", "important");
        msg.style.setProperty("max-width", "100%", "important");
        msg.style.setProperty("box-sizing", "border-box", "important");
        msg.style.setProperty("flex-shrink", "0", "important");
      }
    }
  }

  /**
   * Docks Foundry's ui.chat.element into the mobile sheet's chat mount point.
   */
  _dockChatElement() {
    try {
      const mount = this.element?.querySelector(".mobile-chat-mount");
      const chatEl = (ui.chat?.element instanceof HTMLElement ? ui.chat.element : ui.chat?.element?.[0]) ?? document.getElementById("chat");
      if (!mount || !chatEl) return;

      if (!mount.contains(chatEl)) {
        if (!this._chatOriginalParent && chatEl.parentElement) {
          this._chatOriginalParent = chatEl.parentElement;
          this._chatOriginalNextSibling = chatEl.nextSibling;
        }
        mount.appendChild(chatEl);
      }

      this._disableChatInputs(chatEl);

      if (!chatEl._pf2eMobileInputObserver) {
        const observer = new MutationObserver(() => {
          this._disableChatInputs(chatEl);
        });
        observer.observe(chatEl, { childList: true, subtree: true });
        chatEl._pf2eMobileInputObserver = observer;
      }

      if (!mount._pf2eChatEventShield) {
        mount.addEventListener("click", (event) => {
          event.stopPropagation();
        });
        mount._pf2eChatEventShield = true;
      }

      if (!chatEl._pf2eMobileDamageCapture) {
        chatEl.addEventListener("click", (event) => {
          const btn = event.target?.closest?.("button[data-action]");
          if (btn) {
            const action = btn.dataset.action;
            if (["apply-damage", "half-damage", "double-damage", "triple-damage", "apply-healing", "shield-block"].includes(action)) {
              this._ensureTokenControlled();
            }
          }
        }, { capture: true });
        chatEl._pf2eMobileDamageCapture = true;
      }
    } catch (err) {
      console.warn("pf2e-mobile-compact | Error docking chat element:", err);
    }
  }

  /**
   * Restores ui.chat.element back to its original parent upon sheet closure.
   */
  _restoreChatElement() {
    try {
      const chatEl = (ui.chat?.element instanceof HTMLElement ? ui.chat.element : ui.chat?.element?.[0]) ?? document.getElementById("chat");
      if (!chatEl) return;
      if (chatEl._pf2eMobileInputObserver) {
        chatEl._pf2eMobileInputObserver.disconnect();
        chatEl._pf2eMobileInputObserver = null;
      }
      const scrollEl = chatEl.querySelector(".chat-scroll") ?? chatEl.querySelector("#chat-log, .chat-log");
      if (scrollEl?._pf2eScrollBottomHandler) {
        scrollEl.removeEventListener("scroll", scrollEl._pf2eScrollBottomHandler);
        scrollEl._pf2eScrollBottomHandler = null;
      }
      if (this._chatOriginalParent && this._chatOriginalParent.isConnected) {
        if (this._chatOriginalNextSibling && this._chatOriginalParent.contains(this._chatOriginalNextSibling)) {
          this._chatOriginalParent.insertBefore(chatEl, this._chatOriginalNextSibling);
        } else {
          this._chatOriginalParent.appendChild(chatEl);
        }
      }
    } catch (err) {
      console.warn("pf2e-mobile-compact | Error restoring chat element:", err);
    }
  }

  /**
   * Scrolls the mobile chat container to the newest/latest message.
   * @param {boolean} [smooth=false]
   */
  _scrollChatToBottom(smooth = false) {
    const doScroll = (isSmooth) => {
      const mount = this.element?.querySelector(".mobile-chat-mount");
      if (!mount) return;

      const chatScroll = mount.querySelector(".chat-scroll");
      const chatLog = mount.querySelector("#chat-log, .chat-log");
      const lastMsg = chatLog?.lastElementChild;
      const behavior = isSmooth ? "smooth" : "instant";

      if (chatScroll) {
        chatScroll.scrollTo({
          top: chatScroll.scrollHeight + 10000,
          behavior
        });
      }

      if (chatLog && chatLog !== chatScroll) {
        chatLog.scrollTo({
          top: chatLog.scrollHeight + 10000,
          behavior
        });
      }

      if (lastMsg && typeof lastMsg.scrollIntoView === "function") {
        try {
          lastMsg.scrollIntoView({ block: "end", inline: "nearest", behavior });
        } catch {
          try {
            lastMsg.scrollIntoView(false);
          } catch {}
        }
      }

      try {
        ui.chat?.scrollBottom?.({ popout: false });
      } catch {}
    };

    doScroll(smooth);
    requestAnimationFrame(() => {
      doScroll(smooth);
      setTimeout(() => doScroll(false), 60);
      setTimeout(() => doScroll(false), 160);
    });
  }

  /**
   * Sets up a passive scroll listener on the chat container to toggle visibility
   * of the floating "Latest" jump button when scrolled away from bottom.
   */
  _setupScrollBottomListener() {
    const mount = this.element?.querySelector(".mobile-chat-mount");
    const btn = this.element?.querySelector(".btn-scroll-bottom");
    if (!mount || !btn) return;

    const targets = Array.from(new Set([
      mount.querySelector(".chat-scroll"),
      mount.querySelector("#chat-log, .chat-log"),
      mount.querySelector("#chat")
    ].filter(Boolean)));

    if (targets.length === 0) return;

    const updateBtnVisibility = () => {
      const scrollable = targets.find(el => el.scrollHeight > el.clientHeight) ?? targets[0];
      const distanceFromBottom = scrollable.scrollHeight - scrollable.scrollTop - scrollable.clientHeight;
      if (distanceFromBottom > 80) {
        btn.classList.remove("is-hidden");
      } else {
        btn.classList.add("is-hidden");
      }
    };

    for (const target of targets) {
      if (target._pf2eScrollBottomHandler) {
        target.removeEventListener("scroll", target._pf2eScrollBottomHandler);
      }
      target._pf2eScrollBottomHandler = updateBtnVisibility;
      target.addEventListener("scroll", updateBtnVisibility, { passive: true });
    }

    if (!btn._pf2eScrollClickBound) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._scrollChatToBottom(true);
      });
      btn._pf2eScrollClickBound = true;
    }

    updateBtnVisibility();
    setTimeout(updateBtnVisibility, 100);
    setTimeout(updateBtnVisibility, 300);
  }

  /**
   * Ensures the current sheet actor's token placeable is selected and controlled on canvas.
   */
  _ensureTokenControlled() {
    ensureTokenControlled(this.actor);
  }

  /**
   * Listens for new chat messages to update unread badge or auto-scroll to bottom.
   */
  _registerChatListener() {
    if (this._chatHookId !== null) return;
    this._chatHookId = Hooks.on("createChatMessage", () => {
      if (this.rendered) {
        if (this._activeTab !== "chat") {
          this._unreadChatCount++;
          this._updateChatBadge();
        } else {
          this._scrollChatToBottom(false);
        }
      }
    });
  }

  /**
   * Unregisters chat message hook.
   */
  _unregisterChatListener() {
    if (this._chatHookId !== null) {
      Hooks.off("createChatMessage", this._chatHookId);
      this._chatHookId = null;
    }
  }

  /**
   * Synchronizes unread badge DOM in bottom navigation bar.
   */
  _updateChatBadge() {
    const badge = this.element?.querySelector(".chat-badge");
    if (!badge) return;
    if (this._unreadChatCount > 0) {
      badge.textContent = this._unreadChatCount > 99 ? "99+" : String(this._unreadChatCount);
      badge.classList.remove("hidden");
    } else {
      badge.textContent = "0";
      badge.classList.add("hidden");
    }
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;

    context.actor = actor;
    context.activeTab = this._activeTab;
    context.actionSubTab = this._actionSubTab;
    try {
      const savedMode = localStorage.getItem("pf2e-mobile-compact.rollMode");
      if (savedMode === "physical" || savedMode === "digital") {
        this._rollMode = savedMode;
      } else if (game.settings?.settings?.has?.("pf2e-mobile-compact.rollMode")) {
        const settingMode = game.settings.get("pf2e-mobile-compact", "rollMode");
        if (settingMode) this._rollMode = settingMode;
      }
    } catch {}
    context.rollMode = this._rollMode;
    context.isPhysicalRollMode = this._rollMode === "physical";
    context.unreadChatCount = this._unreadChatCount;

    prepareHeaderContext(actor, this, context);
    await prepareActionsContext(actor, this, context);
    await prepareSpellsContext(actor, this, context);
    prepareSkillsContext(actor, this, context);
    prepareInventoryContext(actor, this, context);

    return context;
  }

  // --- Header Action Handlers ---

  /**
   * Action handler: apply damage to HP using PF2e's native system calculation.
   */
  static async _onApplyDamage(event, target) {
    const input = this.element.querySelector(".hp-delta-input");
    const amount = parseInt(input?.value, 10) || 1;
    if (amount <= 0) return;

    const tokenDoc = this.token ?? this.actor.getActiveTokens(true, true)[0] ?? this.actor.getActiveTokens()[0]?.document ?? null;

    if (typeof this.actor.applyDamage === "function") {
      await this.actor.applyDamage({ damage: amount, token: tokenDoc, final: true });
    } else {
      const hp = this.actor.system.attributes.hp;
      const temp = hp.temp ?? 0;
      const current = hp.value ?? 0;

      let remainingDamage = amount;
      let newTemp = temp;
      if (temp > 0) {
        if (temp >= remainingDamage) {
          newTemp = temp - remainingDamage;
          remainingDamage = 0;
        } else {
          remainingDamage -= temp;
          newTemp = 0;
        }
      }

      const newHP = clamp(current - remainingDamage, 0, hp.max ?? current);
      const updateData = { "system.attributes.hp.value": newHP };
      if (newTemp !== temp) updateData["system.attributes.hp.temp"] = newTemp;
      await this.actor.update(updateData);
    }

    if (input) input.value = "";
  }

  /**
   * Action handler: apply healing to HP using PF2e's native system calculation.
   */
  static async _onApplyHeal(event, target) {
    const input = this.element.querySelector(".hp-delta-input");
    const amount = parseInt(input?.value, 10) || 1;
    if (amount <= 0) return;

    const tokenDoc = this.token ?? this.actor.getActiveTokens(true, true)[0] ?? this.actor.getActiveTokens()[0]?.document ?? null;

    if (typeof this.actor.applyDamage === "function") {
      await this.actor.applyDamage({ damage: -amount, token: tokenDoc, final: true });
    } else {
      const hp = this.actor.system.attributes.hp;
      const current = hp.value ?? 0;
      const max = hp.max ?? 0;
      const newHP = clamp(current + amount, 0, max);
      await this.actor.update({ "system.attributes.hp.value": newHP });
    }

    if (input) input.value = "";
  }

  /**
   * Action handler: set temporary HP directly from input.
   */
  static async _onSetTempHP(event, target) {
    const val = parseInt(target.value, 10);
    if (isNaN(val)) return;
    const newTemp = Math.max(0, val);
    await this.actor.update({ "system.attributes.hp.temp": newTemp });
  }

  /**
   * Action handler: adjust temporary HP by delta step (+1 / -1).
   */
  static async _onAdjustTempHP(event, target) {
    const delta = parseInt(target.dataset.delta, 10);
    if (isNaN(delta)) return;

    const currentTemp = this.actor.system.attributes.hp?.temp ?? 0;
    const newTemp = Math.max(0, currentTemp + delta);
    await this.actor.update({ "system.attributes.hp.temp": newTemp });
  }

  /**
   * Action handler: roll saving throw (Fortitude, Reflex, or Will).
   */
  static async _onRollSave(event, target) {
    const saveKey = target.dataset.save;
    if (!saveKey) return;

    const saveStat = this.actor.saves?.[saveKey];
    const saveLabel = saveKey.charAt(0).toUpperCase() + saveKey.slice(1);

    await PhysicalDiceManager.withPhysicalMode({
      title: `${saveLabel} Save`,
      actor: this.actor
    }, async () => {
      if (typeof saveStat?.roll === "function") {
        await saveStat.roll({ event });
      } else if (typeof this.actor.rollSave === "function") {
        await this.actor.rollSave(event, saveKey);
      }
    }, this.rollMode === "physical");
  }

  /**
   * Action handler: roll Perception check.
   */
  static async _onRollPerception(event, target) {
    await PhysicalDiceManager.withPhysicalMode({
      title: "Perception Check",
      actor: this.actor
    }, async () => {
      if (typeof this.actor.perception?.roll === "function") {
        await this.actor.perception.roll({ event });
      } else if (typeof this.actor.rollPerception === "function") {
        await this.actor.rollPerception({ event });
      }
    }, this.rollMode === "physical");
  }

  /**
   * Action handler: roll Initiative check and add to combat when combat is active.
   */
  static async _onRollInitiative(event, target) {
    const combat = game.combat;
    let combatant = combat ? combat.combatants.find(c => c.actor?.id === this.actor.id || c.actor === this.actor) : null;

    if (combat && !combatant) {
      const scene = combat.scene ?? canvas?.scene ?? game.scenes.viewed ?? game.scenes.active;
      const tokenDoc = this.token ?? this.actor.getActiveTokens(true, true)[0] ?? this.actor.getActiveTokens()[0]?.document ?? scene?.tokens?.find(t => t.actorId === this.actor.id) ?? null;

      if (tokenDoc) {
        const created = await combat.createEmbeddedDocuments("Combatant", [{
          tokenId: tokenDoc.id,
          actorId: this.actor.id,
          sceneId: scene?.id ?? tokenDoc.scene?.id,
          hidden: tokenDoc.hidden ?? false
        }]);
        combatant = created[0] ?? null;
      } else {
        try {
          const created = await combat.createEmbeddedDocuments("Combatant", [{
            actorId: this.actor.id,
            sceneId: scene?.id,
            hidden: false
          }]);
          combatant = created[0] ?? null;
        } catch {
          ui.notifications?.warn?.(`No token found on scene for ${this.actor.name}.`);
        }
      }
    }

    await PhysicalDiceManager.withPhysicalMode({
      title: "Initiative Check",
      actor: this.actor
    }, async () => {
      if (typeof this.actor.initiative?.roll === "function" && combat) {
        await this.actor.initiative.roll({ event, combatant: combatant || undefined });
      } else if (typeof this.actor.initiative?.statistic?.roll === "function") {
        await this.actor.initiative.statistic.roll({ event });
      } else if (typeof this.actor.rollInitiative === "function") {
        await this.actor.rollInitiative({ createCombatants: true, initiativeOptions: { event } });
      } else if (typeof this.actor.perception?.roll === "function") {
        await this.actor.perception.roll({ event });
      }
    }, this.rollMode === "physical");
  }

  /**
   * Action handler: select scene token target from header dropdown.
   */
  static async _onSelectTarget(event, target) {
    const tokenId = target.value;
    await setTargetToken(tokenId);
  }

  /**
   * Action handler: toggle digital vs physical roll mode.
   */
  static async _onToggleRollMode(event, target) {
    const newMode = target.value;
    if (newMode === "digital" || newMode === "physical") {
      this._rollMode = newMode;
      try {
        localStorage.setItem("pf2e-mobile-compact.rollMode", newMode);
      } catch {}
      try {
        if (game.settings?.settings?.has?.("pf2e-mobile-compact.rollMode")) {
          await game.settings.set("pf2e-mobile-compact", "rollMode", newMode);
        }
      } catch {}
      this.render({ parts: ["header"] });
    }
  }

  /**
   * Action handler: toggle fullscreen mode for mobile app view.
   */
  static async _onToggleFullscreen(event, target) {
    const sheetEl = target?.closest?.(".pf2e-mobile-sheet");
    const isCurrentlyFs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.body.classList.contains("pf2e-fullscreen") ||
      sheetEl?.classList.contains("fullscreen-mode")
    );

    if (!isCurrentlyFs) {
      if (document.documentElement.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch (err) {
          console.warn("PF2e Mobile Compact | Fullscreen request failed, using CSS fullscreen fallback:", err);
        }
      } else if (document.documentElement.webkitRequestFullscreen) {
        try {
          await document.documentElement.webkitRequestFullscreen();
        } catch (err) {
          console.warn("PF2e Mobile Compact | WebKit fullscreen request failed, using CSS fullscreen fallback:", err);
        }
      }
      document.body.classList.add("pf2e-fullscreen");
      sheetEl?.classList.add("fullscreen-mode");
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch (err) {
          console.warn("PF2e Mobile Compact | Exit fullscreen failed:", err);
        }
      } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        try {
          await document.webkitExitFullscreen();
        } catch (err) {
          console.warn("PF2e Mobile Compact | WebKit exit fullscreen failed:", err);
        }
      }
      document.body.classList.remove("pf2e-fullscreen");
      sheetEl?.classList.remove("fullscreen-mode");
      document.querySelectorAll(".pf2e-mobile-sheet").forEach(s => s.classList.remove("fullscreen-mode"));
    }

    const isNowFs = !isCurrentlyFs;
    const icons = document.querySelectorAll(".btn-fullscreen i");
    for (const icon of icons) {
      icon.className = isNowFs ? "fas fa-compress" : "fas fa-expand";
    }
  }

  /**
   * Action handler: scroll chat to the latest message.
   */
  static async _onScrollChatToBottom(event, target) {
    this._scrollChatToBottom(true);
  }

  /**
   * Action handler: switch active tab.
   */
  static async _onSwitchTab(event, target) {
    const newTab = target.dataset.tab;
    if (newTab === "chat" && this._activeTab === "chat") {
      this._scrollChatToBottom(true);
      return;
    }
    if (newTab && newTab !== this._activeTab) {
      this._activeTab = newTab;
      if (newTab === "chat") {
        this._unreadChatCount = 0;
      }
      this.render({ parts: ["sheet"] });
    }
  }

  /**
   * Action handler: switch active action sub-tab (encounter, exploration, downtime).
   */
  static async _onSwitchActionSubTab(event, target) {
    const newSubTab = target.dataset.subtab;
    if (newSubTab && newSubTab !== this._actionSubTab) {
      this._actionSubTab = newSubTab;
      this.render({ parts: ["sheet"] });
    }
  }

  /**
   * Action handler: switch active character sheet to another owned character.
   */
  static async _onSwitchActor(event, target) {
    const newActorId = target.value;
    if (!newActorId || newActorId === this.actor.id) return;
    const newActor = game.actors.get(newActorId);
    if (!newActor) return;

    console.log(`PF2e Mobile Compact | Switching character to ${newActor.name}`);
    await this.close();
    newActor.sheet.render(true);
  }

  // --- Target & Selection Prompts ---

  async _resolveTargetForAction(actionLabel) {
    return resolveTargetForAction(this, actionLabel);
  }

  async _promptTargetSelection(actionLabel) {
    return promptTargetSelection(this, actionLabel);
  }

  async _promptVariantSelection(actionLabel, variants) {
    return promptVariantSelection(this, actionLabel, variants);
  }

  async _promptStatisticSelection(actionLabel, statistics) {
    return promptStatisticSelection(this, actionLabel, statistics);
  }

  async _promptStrikeSelection(actionLabel, strikes) {
    return promptStrikeSelection(this, actionLabel, strikes);
  }

  // --- Delegated Action & Strike Handlers ---

  static async _onExecuteStrike(event, target) {
    return onExecuteStrike(this, event, target);
  }

  static async _onExecuteDamage(event, target) {
    return onExecuteDamage(this, event, target);
  }

  static async _onExecuteCritical(event, target) {
    return onExecuteCritical(this, event, target);
  }

  static async _onExecuteAuxiliaryAction(event, target) {
    return onExecuteAuxiliaryAction(this, event, target);
  }

  static async _onItemToChat(event, target) {
    return onItemToChat(this, event, target);
  }

  static async _onUseAction(event, target) {
    return onUseAction(this, event, target);
  }

  static async _onRollActionCheck(event, target) {
    return onRollActionCheck(this, event, target);
  }

  static async _onRollSkill(event, target) {
    return onRollSkill(this, event, target);
  }

  static async _onConsumeItem(event, target) {
    return onConsumeItem(this, event, target);
  }

  static _onToggleActionSummary(event, target) {
    return onToggleActionSummary(this, event, target);
  }

  // --- Delegated Spell Handlers ---

  static async _onSwitchSpellSubTab(event, target) {
    return onSwitchSpellSubTab(this, event, target);
  }

  static _onToggleRankGroup(event, target) {
    return onToggleRankGroup(this, event, target);
  }

  static async _onOpenSpellPrepPicker(event, target) {
    return onOpenSpellPrepPicker(this, event, target);
  }

  static async _prepareSlot(actor, entryId, rank, slotIndex, spellId) {
    return prepareSlot(actor, entryId, rank, slotIndex, spellId);
  }

  static async _onUnprepareSlot(event, target) {
    return onUnprepareSlot(this, event, target);
  }

  static async _onToggleSlotExpended(event, target) {
    return onToggleSlotExpended(this, event, target);
  }

  static async _onResetDailySpells(event, target) {
    return onResetDailySpells(this, event, target);
  }

  static async _onSaveSpellPreset(event, target) {
    return onSaveSpellPreset(this, event, target);
  }

  static async _onApplySpellPreset(event, target) {
    return onApplySpellPreset(this, event, target);
  }

  static async _onDeleteSpellPreset(event, target) {
    return onDeleteSpellPreset(this, event, target);
  }

  static async _onOpenCompendiumPicker(event, target) {
    return onOpenCompendiumPicker(this, event, target);
  }

  static async _onAdjustSlot(event, target) {
    return onAdjustSlot(this, event, target);
  }

  static async _onAdjustFocus(event, target) {
    return onAdjustFocus(this, event, target);
  }

  static async _onCastSpell(event, target) {
    return onCastSpell(this, event, target);
  }

  static async _onToggleSignatureSpell(event, target) {
    return onToggleSignatureSpell(this, event, target);
  }

  static async _onRemoveSpell(event, target) {
    return onRemoveSpell(this, event, target);
  }
}

// Backwards-compatibility re-exports
export {
  clamp,
  getGlyph,
  getTargetableToken,
  getOriginToken,
  setTargetToken,
  ensureTokenControlled,
  resolveTargetForAction,
  promptTargetSelection,
  promptVariantSelection,
  promptStatisticSelection,
  promptStrikeSelection,
  formatSpell
};
