const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
import { CompendiumPickerApp } from "./compendium-picker.js";
import { PhysicalDiceManager } from "../rolls/physical-dice-interceptor.js";
import { clamp, getGlyph } from "../utils/sheet-utils.js";
import { getTargetableToken, getOriginToken, setTargetToken, ensureTokenControlled } from "../tokens/token-adapter.js";
import { prepareHeaderContext } from "./sheet-helpers/context-header.js";
import { preparePartyContext } from "./sheet-helpers/context-party.js";
import { prepareActionsContext } from "./sheet-helpers/context-actions.js";
import { prepareSkillsContext } from "./sheet-helpers/context-skills.js";
import { prepareInventoryContext } from "./sheet-helpers/context-inventory.js";
import { prepareSpellsContext, formatSpell } from "./sheet-helpers/context-spells.js";
import { prepareActivationsContext } from "./sheet-helpers/context-activations.js";
import { onTransferStashItem, onSendToPartyStash, onOpenPartyStash, onSwitchToPartyMember, onTransferCoins } from "./sheet-helpers/party-handlers.js";
import { resolveTargetForAction, promptTargetSelection, promptVariantSelection, promptStatisticSelection, promptStrikeSelection } from "./sheet-helpers/sheet-prompts.js";
import { onExecuteStrike, onExecuteDamage, onExecuteCritical, onExecuteAuxiliaryAction, onItemToChat, onUseAction, onRollActionCheck, onRollSkill, onToggleActionSummary } from "./sheet-helpers/actions-handlers.js";
import { onUseConsumable, onApplyPoison, onDetachSubitem, onChangeCarryType, onToggleInventorySection, onConfigureRunes, onToggleInvested, onToggleEquipped } from "./sheet-helpers/inventory-handlers.js";
import { onSwitchSpellSubTab, onToggleRankGroup, onOpenSpellPrepPicker, prepareSlot, onUnprepareSlot, onToggleSlotExpended, onResetDailySpells, onSaveSpellPreset, onApplySpellPreset, onDeleteSpellPreset, onOpenCompendiumPicker, onAdjustSlot, onAdjustFocus, onCastSpell, onToggleSignatureSpell, onRemoveSpell } from "./sheet-helpers/spells-handlers.js";
import { onCastStaffSpell, onAdjustStaffCharges, onCastItemSpell, onOpenDailies } from "./sheet-helpers/activations-handlers.js";
import { onApplyDeltaHP, onSetDirectHP, onSetDirectTempHP, onRollPerceptionOrInitiative, onApplyDamage, onApplyHeal, onSetTempHP, onAdjustTempHP, onRollSave, onRollPerception, onRollInitiative, onSelectTarget, onToggleRollMode, onToggleFullscreen, onSwitchActor } from "./sheet-helpers/header-handlers.js";
import { disableChatInputs, dockChatElement, restoreChatElement, scrollChatToBottom, setupScrollBottomListener, registerChatListener, unregisterChatListener, updateChatBadge } from "./sheet-helpers/chat-handler.js";

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
      applyDeltaHP: PF2eMobileSheet._onApplyDeltaHP,
      setDirectHP: PF2eMobileSheet._onSetDirectHP,
      setDirectTempHP: PF2eMobileSheet._onSetDirectTempHP,
      rollPerceptionOrInitiative: PF2eMobileSheet._onRollPerceptionOrInitiative,
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
      applyPoison: PF2eMobileSheet._onApplyPoison,
      detachSubitem: PF2eMobileSheet._onDetachSubitem,
      changeCarryType: PF2eMobileSheet._onChangeCarryType,
      toggleInventorySection: PF2eMobileSheet._onToggleInventorySection,
      configureRunes: PF2eMobileSheet._onConfigureRunes,
      toggleInvested: PF2eMobileSheet._onToggleInvested,
      toggleEquipped: PF2eMobileSheet._onToggleEquipped,
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
      removeSpell: PF2eMobileSheet._onRemoveSpell,
      castStaffSpell: PF2eMobileSheet._onCastStaffSpell,
      adjustStaffCharges: PF2eMobileSheet._onAdjustStaffCharges,
      castItemSpell: PF2eMobileSheet._onCastItemSpell,
      openDailies: PF2eMobileSheet._onOpenDailies,
      transferStashItem: PF2eMobileSheet._onTransferStashItem,
      sendToPartyStash: PF2eMobileSheet._onSendToPartyStash,
      openPartyStash: PF2eMobileSheet._onOpenPartyStash,
      switchToPartyMember: PF2eMobileSheet._onSwitchToPartyMember,
      transferCoins: PF2eMobileSheet._onTransferCoins
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

  constructor(...args) {
    super(...args);
    if (this.actor?.type === "party") {
      this._activeTab = "stash";
    }
  }

  /** @type {string} */
  _activeTab = "actions";

  /** @type {"encounter" | "exploration" | "downtime"} */
  _actionSubTab = "encounter";

  /** @type {"spells" | "preparation"} */
  _spellSubTab = "spells";

  /** @type {Set<number>} */
  _collapsedRankGroups = new Set();

  /** @type {Set<string>} */
  _collapsedInventorySections = new Set();

  /** @type {Map<string, number>} */
  _tabScrollPositions = new Map();

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
    try {
      const scrollEl = this.element?.querySelector?.(".mobile-tab-content") ?? content.querySelector?.(".mobile-tab-content");
      if (scrollEl) {
        this._tabScrollPositions.set(this._activeTab, scrollEl.scrollTop);
      }
    } catch {}

    const chatMount = content.querySelector?.(".mobile-chat-mount");
    const chatEl = (ui.chat?.element instanceof HTMLElement ? ui.chat.element : ui.chat?.element?.[0]) ?? document.getElementById("chat");
    if (chatMount && chatEl && chatMount.contains(chatEl)) {
      this._tempChatFragment.appendChild(chatEl);
    }

    super._replaceHTML(result, content, options);

    const newChatMount = (result instanceof HTMLElement ? result.querySelector?.(".mobile-chat-mount") : null)
      ?? this.element?.querySelector?.(".mobile-chat-mount");
    if (newChatMount && chatEl) {
      newChatMount.appendChild(chatEl);
    }

    const savedScroll = this._tabScrollPositions.get(this._activeTab);
    if (typeof savedScroll === "number" && savedScroll > 0) {
      const newScrollEl = (result instanceof HTMLElement ? result.querySelector?.(".mobile-tab-content") : null)
        ?? this.element?.querySelector?.(".mobile-tab-content");
      if (newScrollEl) newScrollEl.scrollTop = savedScroll;
    }
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this._registerSceneListeners();
    this._registerChatListener();
    this._dockChatElement();
    this._ensureTokenControlled();
    document.querySelectorAll('link[href*="pf2e-mobile.css"]').forEach(link => { link.disabled = false; });
    Hooks.callAll("renderPF2eMobileSheet", this, this.element, context);

    const savedScroll = this._tabScrollPositions.get(this._activeTab);
    if (typeof savedScroll === "number" && savedScroll > 0) {
      const newScrollEl = this.element?.querySelector?.(".mobile-tab-content");
      if (newScrollEl) {
        newScrollEl.scrollTop = savedScroll;
        requestAnimationFrame(() => {
          if (newScrollEl && this.rendered) {
            newScrollEl.scrollTop = savedScroll;
          }
        });
      }
    }

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

    if (!this.element._mobileActionKeydownBound) {
      this.element.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          const actionEl = event.target?.closest?.("input[data-change-action], input[data-action]");
          if (actionEl) {
            actionEl.blur();
          }
        }
      });
      this.element._mobileActionKeydownBound = true;
    }
  }

  /** @override */
  _onClose(options) {
    this._unregisterSceneListeners();
    this._unregisterChatListener();
    this._restoreChatElement();
    super._onClose(options);
    Hooks.callAll("closePF2eMobileSheet", this);
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

  _disableChatInputs(chatEl) { disableChatInputs(chatEl, this); }
  _dockChatElement() { dockChatElement(this); }
  _restoreChatElement() { restoreChatElement(this); }
  _scrollChatToBottom(smooth = false) { scrollChatToBottom(this, smooth); }
  _setupScrollBottomListener() { setupScrollBottomListener(this); }
  _ensureTokenControlled() { ensureTokenControlled(this.actor); }
  _registerChatListener() { registerChatListener(this); }
  _unregisterChatListener() { unregisterChatListener(this); }
  _updateChatBadge() { updateChatBadge(this); }

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

    try {
      prepareHeaderContext(actor, this, context);
    } catch (err) {
      console.error("PF2e Mobile Compact | Error preparing header context:", err);
    }

    if (actor.type === "party") {
      try {
        await preparePartyContext(actor, this, context);
      } catch (err) {
        console.error("PF2e Mobile Compact | Error preparing party context:", err);
      }
      return context;
    }

    try {
      await prepareActionsContext(actor, this, context);
    } catch (err) {
      console.error("PF2e Mobile Compact | Error preparing actions context:", err);
      context.strikes = context.strikes ?? [];
      context.characterActions = context.characterActions ?? {
        actions: [],
        reactions: [],
        free: [],
        skillActions: [],
        exploration: [],
        downtime: [],
        hasEncounter: false,
        hasSkillActions: false,
        hasExploration: false,
        hasDowntime: false
      };
    }

    try {
      await prepareSpellsContext(actor, this, context);
    } catch (err) {
      console.error("PF2e Mobile Compact | Error preparing spells context:", err);
      context.spells = { entries: [], focus: null };
    }

    try {
      await prepareActivationsContext(actor, this, context);
    } catch (err) {
      console.error("PF2e Mobile Compact | Error preparing activations context:", err);
      context.activations = { staff: null, wands: [], scrolls: [], other: [] };
      context.hasActivations = false;
      context.activationsCount = 0;
    }

    try {
      prepareSkillsContext(actor, this, context);
    } catch (err) {
      console.error("PF2e Mobile Compact | Error preparing skills context:", err);
      context.skills = [];
    }

    try {
      await prepareInventoryContext(actor, this, context);
    } catch (err) {
      console.error("PF2e Mobile Compact | Error preparing inventory context:", err);
      context.inventory = { consumables: [], weapons: [], armor: [], gear: [] };
    }

    return context;
  }

  // --- Header Action Handlers ---

  static async _onApplyDeltaHP(event, target) {
    return onApplyDeltaHP(this, event, target);
  }

  static async _onSetDirectHP(event, target) {
    return onSetDirectHP(this, event, target);
  }

  static async _onSetDirectTempHP(event, target) {
    return onSetDirectTempHP(this, event, target);
  }

  static async _onRollPerceptionOrInitiative(event, target) {
    return onRollPerceptionOrInitiative(this, event, target);
  }

  static async _onApplyDamage(event, target) {
    return onApplyDamage(this, event, target);
  }

  static async _onApplyHeal(event, target) {
    return onApplyHeal(this, event, target);
  }

  static async _onSetTempHP(event, target) {
    return onSetTempHP(this, event, target);
  }

  static async _onAdjustTempHP(event, target) {
    return onAdjustTempHP(this, event, target);
  }

  static async _onRollSave(event, target) {
    return onRollSave(this, event, target);
  }

  static async _onRollPerception(event, target) {
    return onRollPerception(this, event, target);
  }

  static async _onRollInitiative(event, target) {
    return onRollInitiative(this, event, target);
  }

  static async _onSelectTarget(event, target) {
    return onSelectTarget(this, event, target);
  }

  static async _onToggleRollMode(event, target) {
    return onToggleRollMode(this, event, target);
  }

  static async _onToggleFullscreen(event, target) {
    return onToggleFullscreen(this, event, target);
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
      const scrollEl = this.element?.querySelector?.(".mobile-tab-content");
      if (scrollEl) {
        this._tabScrollPositions.set(this._activeTab, scrollEl.scrollTop);
      }
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
    return onSwitchActor(this, event, target);
  }

  // --- Target & Selection Prompts ---

  async _resolveTargetForAction(actionLabel) { return resolveTargetForAction(this, actionLabel); }
  async _promptTargetSelection(actionLabel) { return promptTargetSelection(this, actionLabel); }
  async _promptVariantSelection(actionLabel, variants) { return promptVariantSelection(this, actionLabel, variants); }
  async _promptStatisticSelection(actionLabel, statistics) { return promptStatisticSelection(this, actionLabel, statistics); }
  async _promptStrikeSelection(actionLabel, strikes) { return promptStrikeSelection(this, actionLabel, strikes); }

  // --- Delegated Action & Strike Handlers ---
  static async _onExecuteStrike(event, target) { return onExecuteStrike(this, event, target); }
  static async _onExecuteDamage(event, target) { return onExecuteDamage(this, event, target); }
  static async _onExecuteCritical(event, target) { return onExecuteCritical(this, event, target); }
  static async _onExecuteAuxiliaryAction(event, target) { return onExecuteAuxiliaryAction(this, event, target); }
  static async _onItemToChat(event, target) { return onItemToChat(this, event, target); }
  static async _onUseAction(event, target) { return onUseAction(this, event, target); }
  static async _onRollActionCheck(event, target) { return onRollActionCheck(this, event, target); }
  static async _onRollSkill(event, target) { return onRollSkill(this, event, target); }
  static async _onConsumeItem(event, target) { return onUseConsumable(this, event, target); }
  static async _onApplyPoison(event, target) { return onApplyPoison(this, event, target); }
  static async _onDetachSubitem(event, target) { return onDetachSubitem(this, event, target); }
  static async _onChangeCarryType(event, target) { return onChangeCarryType(this, event, target); }
  static _onToggleInventorySection(event, target) { return onToggleInventorySection(this, event, target); }
  static async _onConfigureRunes(event, target) { return onConfigureRunes(this, event, target); }
  static async _onToggleInvested(event, target) { return onToggleInvested(this, event, target); }
  static async _onToggleEquipped(event, target) { return onToggleEquipped(this, event, target); }
  static _onToggleActionSummary(event, target) { return onToggleActionSummary(this, event, target); }

  // --- Delegated Spell Handlers ---
  static async _onSwitchSpellSubTab(event, target) { return onSwitchSpellSubTab(this, event, target); }
  static _onToggleRankGroup(event, target) { return onToggleRankGroup(this, event, target); }
  static async _onOpenSpellPrepPicker(event, target) { return onOpenSpellPrepPicker(this, event, target); }
  static async _prepareSlot(actor, entryId, rank, slotIndex, spellId) { return prepareSlot(actor, entryId, rank, slotIndex, spellId); }
  static async _onUnprepareSlot(event, target) { return onUnprepareSlot(this, event, target); }
  static async _onToggleSlotExpended(event, target) { return onToggleSlotExpended(this, event, target); }
  static async _onResetDailySpells(event, target) { return onResetDailySpells(this, event, target); }
  static async _onSaveSpellPreset(event, target) { return onSaveSpellPreset(this, event, target); }
  static async _onApplySpellPreset(event, target) { return onApplySpellPreset(this, event, target); }
  static async _onDeleteSpellPreset(event, target) { return onDeleteSpellPreset(this, event, target); }
  static async _onOpenCompendiumPicker(event, target) { return onOpenCompendiumPicker(this, event, target); }
  static async _onAdjustSlot(event, target) { return onAdjustSlot(this, event, target); }
  static async _onAdjustFocus(event, target) { return onAdjustFocus(this, event, target); }
  static async _onCastSpell(event, target) { return onCastSpell(this, event, target); }
  static async _onToggleSignatureSpell(event, target) { return onToggleSignatureSpell(this, event, target); }
  static async _onRemoveSpell(event, target) { return onRemoveSpell(this, event, target); }

  // --- Delegated Activations Handlers ---
  static async _onCastStaffSpell(event, target) { return onCastStaffSpell(this, event, target); }
  static async _onAdjustStaffCharges(event, target) { return onAdjustStaffCharges(this, event, target); }
  static async _onCastItemSpell(event, target) { return onCastItemSpell(this, event, target); }
  static async _onOpenDailies(event, target) { return onOpenDailies(this, event, target); }

  // --- Delegated Party Handlers ---
  static async _onTransferStashItem(event, target) { return onTransferStashItem(this, event, target); }
  static async _onSendToPartyStash(event, target) { return onSendToPartyStash(this, event, target); }
  static async _onOpenPartyStash(event, target) { return onOpenPartyStash(this, event, target); }
  static async _onSwitchToPartyMember(event, target) { return onSwitchToPartyMember(this, event, target); }
  static async _onTransferCoins(event, target) { return onTransferCoins(this, event, target); }
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
