const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
import { CompendiumPickerApp } from "./compendium-picker.js";

/** Safe mathematical clamp */
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

/**
 * Resolves a token for targeting or origin, supporting both live Canvas Placeables
 * and headless TokenDocuments when canvas rendering is bypassed on mobile.
 * @param {string} tokenId
 * @returns {object|null}
 */
export function getTargetableToken(tokenId) {
  if (!tokenId) return null;

  const scene = canvas?.scene ?? game.scenes.viewed ?? game.scenes.active;
  const tokenDoc = scene?.tokens?.get(tokenId);

  // 1. Live canvas placeable check (if canvas is drawn and has real placeable with setTarget)
  const placeable = tokenDoc?.object
    ?? (canvas?.tokens?.placeables ? canvas.tokens.placeables.find(t => t.id === tokenId) : null)
    ?? (canvas?.tokens?.get?.(tokenId) instanceof (foundry.canvas?.placeables?.Token ?? Object) ? canvas.tokens.get(tokenId) : null);

  if (placeable && typeof placeable.setTarget === "function") {
    // Non-destructively attach distanceTo if missing on live placeable
    if (typeof placeable.distanceTo !== "function") {
      placeable.distanceTo = function(otherToken) {
        if (!otherToken) return 0;
        const gridSize = canvas?.grid?.size ?? scene?.grid?.size ?? 100;
        const gridDistance = scene?.grid?.distance ?? 5;
        const r0 = this.bounds ?? {
          x: this.x, y: this.y,
          width: (this.document?.width ?? 1) * gridSize,
          height: (this.document?.height ?? 1) * gridSize,
          left: this.x, right: this.x + (this.document?.width ?? 1) * gridSize,
          top: this.y, bottom: this.y + (this.document?.height ?? 1) * gridSize
        };
        const r1 = otherToken.bounds ?? {
          x: otherToken.x, y: otherToken.y,
          width: (otherToken.document?.width ?? 1) * gridSize,
          height: (otherToken.document?.height ?? 1) * gridSize,
          left: otherToken.x, right: otherToken.x + (otherToken.document?.width ?? 1) * gridSize,
          top: otherToken.y, bottom: otherToken.y + (otherToken.document?.height ?? 1) * gridSize
        };
        const dx = r0.right <= r1.left ? r1.left - r0.right : r1.right <= r0.left ? r0.left - r1.right : 0;
        const dy = r0.bottom <= r1.top ? r1.top - r0.bottom : r1.bottom <= r0.top ? r0.top - r1.bottom : 0;
        const distGridX = (dx / gridSize) * gridDistance;
        const distGridY = (dy / gridSize) * gridDistance;
        const maxDim = Math.max(distGridX, distGridY);
        const minDim = Math.min(distGridX, distGridY);
        const dist2D = maxDim + Math.floor(minDim / (gridDistance * 2)) * gridDistance;
        const dz = Math.abs((this.elevation ?? this.document?.elevation ?? 0) - (otherToken.elevation ?? otherToken.document?.elevation ?? 0));
        return dz > 0 ? Math.max(dist2D, dz) : dist2D;
      };
    }
    return placeable;
  }

  // 2. Headless fallback: construct target adapter from Scene TokenDocument
  if (!tokenDoc) return null;

  // Ensure TokenDocument has a .document reference if checked by PF2e CheckContext
  if (!tokenDoc.document) {
    Object.defineProperty(tokenDoc, "document", {
      get() { return this; },
      configurable: true
    });
  }

  const gridSize = canvas?.grid?.size ?? scene?.grid?.size ?? 100;
  const gridDistance = scene?.grid?.distance ?? 5;
  const widthPx = (tokenDoc.width ?? 1) * gridSize;
  const heightPx = (tokenDoc.height ?? 1) * gridSize;

  // Construct PIXI.Rectangle or compatible bounds object
  const bounds = {
    x: tokenDoc.x,
    y: tokenDoc.y,
    width: widthPx,
    height: heightPx,
    get left() { return this.x; },
    get right() { return this.x + this.width; },
    get top() { return this.y; },
    get bottom() { return this.y + this.height; }
  };

  const adapter = {
    id: tokenDoc.id,
    name: tokenDoc.name,
    actor: tokenDoc.actor,
    document: tokenDoc,
    scene: scene,
    x: tokenDoc.x,
    y: tokenDoc.y,
    elevation: tokenDoc.elevation ?? 0,
    center: {
      x: tokenDoc.x + widthPx / 2,
      y: tokenDoc.y + heightPx / 2
    },
    bounds,
    get isTargeted() {
      return Array.from(game.user.targets).some(t => t.id === this.id);
    },
    distanceTo(otherToken, { reach = null } = {}) {
      if (!otherToken) return 0;
      const targetBounds = otherToken.bounds ?? {
        x: otherToken.x, y: otherToken.y,
        width: (otherToken.document?.width ?? 1) * gridSize,
        height: (otherToken.document?.height ?? 1) * gridSize,
        left: otherToken.x, right: otherToken.x + (otherToken.document?.width ?? 1) * gridSize,
        top: otherToken.y, bottom: otherToken.y + (otherToken.document?.height ?? 1) * gridSize
      };

      const selfElevation = this.elevation ?? this.document?.elevation ?? 0;
      const targetElevation = otherToken.elevation ?? otherToken.document?.elevation ?? 0;
      const dz = Math.abs(selfElevation - targetElevation);

      // Distance calculation across bounding boxes (2.5D cuboid measurement)
      const r0 = this.bounds;
      const r1 = targetBounds;

      const dx = r0.right <= r1.left ? r1.left - r0.right : r1.right <= r0.left ? r0.left - r1.right : 0;
      const dy = r0.bottom <= r1.top ? r1.top - r0.bottom : r1.bottom <= r0.top ? r0.top - r1.bottom : 0;

      const distGridX = (dx / gridSize) * gridDistance;
      const distGridY = (dy / gridSize) * gridDistance;

      // Diagonal distance (Pathfinder 2e rules: max(dx, dy) + floor(min(dx, dy) / 2))
      const maxDim = Math.max(distGridX, distGridY);
      const minDim = Math.min(distGridX, distGridY);
      const dist2D = maxDim + Math.floor(minDim / (gridDistance * 2)) * gridDistance;

      const totalDist = dz > 0 ? Math.max(dist2D, dz) : dist2D;
      return totalDist;
    },
    isAdjacentTo(otherToken) {
      return this.distanceTo(otherToken) <= gridDistance;
    },
    canFlank(flankee, context = {}) {
      const actor = this.actor;
      if (!actor || !flankee?.actor) return false;
      if (this.document.hidden || flankee.document?.hidden || this === flankee) return false;
      if (!actor.isOfType?.("creature") || !flankee.actor.isOfType?.("creature")) return false;
      if (actor.isAllyOf?.(flankee.actor)) return false;

      const flankable = context.ignoreFlankable || flankee.actor?.attributes?.flanking?.flankable;
      if (!(actor.attributes?.flanking?.canFlank && flankable)) return false;

      const reach = context.reach ?? actor.getReach?.({ action: "attack" }) ?? 5;
      return reach >= this.distanceTo(flankee, { reach });
    },
    onOppositeSides(flankerA, flankerB, flankee) {
      const centerA = flankerA.center;
      const centerB = flankerB.center;
      const b = flankee.bounds;

      const RayCls = globalThis.Ray ?? class {
        constructor(A, B) { this.A = A; this.B = B; }
      };
      const left = new RayCls({ x: b.left, y: b.top }, { x: b.left, y: b.bottom });
      const right = new RayCls({ x: b.right, y: b.top }, { x: b.right, y: b.bottom });
      const top = new RayCls({ x: b.left, y: b.top }, { x: b.right, y: b.top });
      const bottom = new RayCls({ x: b.left, y: b.bottom }, { x: b.right, y: b.bottom });

      const lineIntersects = foundry?.utils?.lineSegmentIntersects ?? ((p1, p2, p3, p4) => {
        const d = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
        if (d === 0) return false;
        const uA = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / d;
        const uB = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / d;
        return uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1;
      });

      const intersectsSide = (side) => lineIntersects(centerA, centerB, side.A, side.B);
      return (intersectsSide(left) && intersectsSide(right)) || (intersectsSide(top) && intersectsSide(bottom));
    },
    isFlanking(flankee, context = {}) {
      const thisActor = this.actor;
      if (!(thisActor && this.canFlank(flankee, context))) return false;

      const flanking = thisActor.attributes?.flanking;
      const sceneTokens = scene?.tokens?.contents ?? [];

      // Gather potential flanking allies on the scene
      const flankingBuddies = sceneTokens
        .filter(tDoc => tDoc.id !== this.id && tDoc.actor)
        .map(tDoc => tDoc.object ?? {
          id: tDoc.id,
          actor: tDoc.actor,
          document: tDoc,
          bounds: {
            x: tDoc.x,
            y: tDoc.y,
            width: (tDoc.width ?? 1) * gridSize,
            height: (tDoc.height ?? 1) * gridSize,
            get left() { return this.x; },
            get right() { return this.x + this.width; },
            get top() { return this.y; },
            get bottom() { return this.y + this.height; }
          },
          center: { x: tDoc.x + ((tDoc.width ?? 1) * gridSize) / 2, y: tDoc.y + ((tDoc.height ?? 1) * gridSize) / 2 },
          distanceTo(other) { return adapter.distanceTo.call(this, other); },
          canFlank(f, ctx) { return adapter.canFlank.call(this, f, ctx); }
        })
        .filter(t => t && (t.actor?.isAllyOf?.(thisActor) || (this.document.isLinked && t.actor === thisActor)) && t.canFlank(flankee, context));

      if (flankingBuddies.length === 0) return false;

      // Gang Up check
      if (flanking?.canGangUp) {
        const gangingUp = flanking.canGangUp.some(g =>
          (typeof g === "number" && g <= flankingBuddies.length) || (g === true && flankingBuddies.length >= 1)
        ) || flankingBuddies.some(b => b.actor?.attributes?.flanking?.canGangUp?.some?.(g => g === true));
        if (gangingUp) return true;
      }

      // Opposite sides geometry check
      return flankingBuddies.some(b => this.onOppositeSides(this, b, flankee));
    },
    setTarget(state = true, { user = game.user, releaseOthers = true } = {}) {
      if (user !== game.user) return;
      const isCurrentlyTargeted = Array.from(user.targets).some(t => t.id === this.id);
      if (state === isCurrentlyTargeted) return;

      if (releaseOthers) {
        for (const t of Array.from(user.targets)) {
          if (t.id !== this.id) {
            user.targets.delete(t);
            if (typeof t.setTarget === "function" && t !== this) {
              try { t.setTarget(false, { user, releaseOthers: false }); } catch {}
            } else {
              Hooks.callAll("targetToken", user, t, false);
            }
          }
        }
      }

      if (state) {
        user.targets.add(this);
      } else {
        for (const t of Array.from(user.targets)) {
          if (t.id === this.id || t === this) {
            user.targets.delete(t);
          }
        }
      }

      // Broadcast target activity over socket to TV and desktop screens
      const targetIds = Array.from(user.targets).map(t => t.id).filter(Boolean);
      if (typeof user.broadcastActivity === "function") {
        user.broadcastActivity({
          targets: targetIds,
          sceneId: scene?.id ?? null
        }, { volatile: false });
      }

      Hooks.callAll("targetToken", user, this, state);
    },

    // PIXI Container compatibility stubs for UI modules (e.g. pf2e-flatcheck-helper, target markers)
    // when running in headless mobile canvas mode.
    children: [],
    addChild(...children) {
      this.children.push(...children);
      return children[0];
    },
    removeChild(...children) {
      for (const c of children) {
        const idx = this.children.indexOf(c);
        if (idx !== -1) this.children.splice(idx, 1);
      }
      return children[0];
    },
    removeChildren(beginIndex = 0, endIndex = this.children.length) {
      return this.children.splice(beginIndex, endIndex - beginIndex);
    },
    getChildAt(index) {
      return this.children[index];
    },
    destroy() {
      this.children = [];
    }
  };

  // Only assign adapter to tokenDoc.object if tokenDoc has no live placeable object
  if (!tokenDoc.object) {
    try {
      tokenDoc.object = adapter;
    } catch {}
  }

  return adapter;
}

/**
 * Gets the active token adapter for the actor on the current scene.
 * Ensures the attacker's origin token has a complete token adapter with bounds & flanking.
 * @param {Actor} actor
 * @returns {object|null}
 */
export function getOriginToken(actor) {
  if (!actor) return null;
  // If active placeable token is on canvas, prefer it directly!
  const activePlaceables = typeof actor.getActiveTokens === "function" ? actor.getActiveTokens(true, false) : [];
  if (activePlaceables?.length) {
    return activePlaceables[0];
  }
  const scene = canvas?.scene ?? game.scenes.viewed ?? game.scenes.active;
  const activeTokenDoc = scene?.tokens?.find(t => t.actorId === actor.id)
    ?? (typeof actor.getActiveTokens === "function" ? actor.getActiveTokens(true, true)?.shift() : null);

  if (activeTokenDoc?.id) {
    return getTargetableToken(activeTokenDoc.id);
  }
  return null;
}

/**
 * Synchronizes user token targeting across canvas placeables, headless token docs,
 * and broadcasts targeting reticules to all connected desktop clients.
 * @param {string} tokenId
 */
export async function setTargetToken(tokenId) {
  const scene = canvas?.scene ?? game.scenes.viewed ?? game.scenes.active;

  if (tokenId) {
    const token = getTargetableToken(tokenId);
    if (!token) return;

    if (typeof token.setTarget === "function") {
      token.setTarget(true, { user: game.user, releaseOthers: true, groupSelection: false });
    } else {
      for (const t of Array.from(game.user.targets)) {
        if (t.id !== tokenId) {
          game.user.targets.delete(t);
          Hooks.callAll("targetToken", game.user, t, false);
        }
      }
      game.user.targets.add(token);
      Hooks.callAll("targetToken", game.user, token, true);
    }

    // Always ensure user activity broadcast is sent to desktop clients
    const targetIds = Array.from(game.user.targets).map(t => t.id).filter(Boolean);
    if (typeof game.user.broadcastActivity === "function") {
      game.user.broadcastActivity({
        targets: targetIds,
        sceneId: scene?.id ?? null
      }, { volatile: false });
    }
  } else {
    // Release all targets
    for (const t of Array.from(game.user.targets)) {
      if (typeof t.setTarget === "function") {
        try { t.setTarget(false, { user: game.user, releaseOthers: false }); } catch {}
      } else {
        game.user.targets.delete(t);
        Hooks.callAll("targetToken", game.user, t, false);
      }
    }
    game.user.targets.clear();

    if (typeof game.user.broadcastActivity === "function") {
      game.user.broadcastActivity({
        targets: [],
        sceneId: scene?.id ?? null
      }, { volatile: false });
    }
  }
}

/**
 * Mobile-first, compact ActorSheetV2 implementation for PF2e character actors.
 */
export class PF2eMobileSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["pf2e-mobile-sheet"],
    tag: "div",
    position: {
      width: 420,
      height: 750
    },
    actions: {
      applyDamage: PF2eMobileSheet.#onApplyDamage,
      applyHeal: PF2eMobileSheet.#onApplyHeal,
      setTempHP: PF2eMobileSheet.#onSetTempHP,
      adjustTempHP: PF2eMobileSheet.#onAdjustTempHP,
      rollSave: PF2eMobileSheet.#onRollSave,
      rollPerception: PF2eMobileSheet.#onRollPerception,
      rollInitiative: PF2eMobileSheet.#onRollInitiative,
      selectTarget: PF2eMobileSheet.#onSelectTarget,
      toggleRollMode: PF2eMobileSheet.#onToggleRollMode,
      switchTab: PF2eMobileSheet.#onSwitchTab,
      openCompendiumPicker: PF2eMobileSheet.#onOpenCompendiumPicker,
      adjustSlot: PF2eMobileSheet.#onAdjustSlot,
      adjustFocus: PF2eMobileSheet.#onAdjustFocus,
      executeStrike: PF2eMobileSheet.#onExecuteStrike,
      executeDamage: PF2eMobileSheet.#onExecuteDamage,
      executeCritical: PF2eMobileSheet.#onExecuteCritical,
      executeAuxiliaryAction: PF2eMobileSheet.#onExecuteAuxiliaryAction,
      itemToChat: PF2eMobileSheet.#onItemToChat,
      useAction: PF2eMobileSheet.#onUseAction,
      rollActionCheck: PF2eMobileSheet.#onRollActionCheck,
      rollSkill: PF2eMobileSheet.#onRollSkill,
      consumeItem: PF2eMobileSheet.#onConsumeItem,
      castSpell: PF2eMobileSheet.#onCastSpell,
      switchActor: PF2eMobileSheet.#onSwitchActor,
      toggleFullscreen: PF2eMobileSheet.#onToggleFullscreen,
      switchActionSubTab: PF2eMobileSheet.#onSwitchActionSubTab,
      toggleActionSummary: PF2eMobileSheet.#onToggleActionSummary
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
  #activeTab = "actions";

  /** @type {"encounter" | "exploration" | "downtime"} */
  #actionSubTab = "encounter";

  /** @type {"digital" | "physical"} */
  #rollMode = "digital";

  /** @type {Set<string>} */
  #expandedActionIds = new Set();

  /** @type {Array<{name: string, id: number}>} */
  #sceneHookIds = [];

  /** @type {number} */
  #unreadChatCount = 0;

  /** @type {number|null} */
  #chatHookId = null;

  /** @type {DocumentFragment} */
  #tempChatFragment = document.createDocumentFragment();

  /** @type {HTMLElement|null} */
  #chatOriginalParent = null;

  /** @type {Node|null} */
  #chatOriginalNextSibling = null;

  /**
   * Current active tab key.
   * @type {string}
   */
  get activeTab() {
    return this.#activeTab;
  }

  /**
   * Current active action sub-tab key.
   * @type {"encounter" | "exploration" | "downtime"}
   */
  get actionSubTab() {
    return this.#actionSubTab;
  }

  /**
   * Current active roll mode.
   * @type {"digital" | "physical"}
   */
  get rollMode() {
    return this.#rollMode;
  }

  /** @override */
  _replaceHTML(result, content, options) {
    const chatMount = content.querySelector?.(".mobile-chat-mount");
    const chatEl = ui.chat?.element?.[0] ?? document.getElementById("chat");
    if (chatMount && chatEl && chatMount.contains(chatEl)) {
      this.#tempChatFragment.appendChild(chatEl);
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
    this.#registerSceneListeners();
    this.#registerChatListener();
    this.#dockChatElement();
    this.#ensureTokenControlled();

    if (this.#activeTab === "chat") {
      this.#unreadChatCount = 0;
      this.#updateChatBadge();
      setTimeout(() => {
        try {
          ui.chat?.scrollBottom?.();
        } catch {}
      }, 50);
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

    // ApplicationV2 actions only listen for click events by default.
    // Delegate change events for select and input elements carrying data-action.
    if (!this.element._mobileActionChangeBound) {
      this.element.addEventListener("change", (event) => {
        const actionEl = event.target?.closest?.("select[data-action], input[data-action]");
        if (!actionEl) return;
        const actionName = actionEl.dataset.action;
        const handler = this.options.actions?.[actionName];
        if (typeof handler === "function") {
          handler.call(this, event, actionEl);
        }
      });
      this.element._mobileActionChangeBound = true;
    }
  }

  /** @override */
  _onClose(options) {
    this.#unregisterSceneListeners();
    this.#unregisterChatListener();
    this.#restoreChatElement();
    super._onClose(options);
  }

  /**
   * Registers real-time scene token and targeting listeners to keep
   * the header target selector perfectly synchronized with the TV map.
   */
  #registerSceneListeners() {
    if (this.#sceneHookIds.length > 0) return;

    const onTokenChange = () => {
      if (this.rendered) {
        this.render({ parts: ["header"] });
      }
    };

    this.#sceneHookIds.push(
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
  #unregisterSceneListeners() {
    for (const hook of this.#sceneHookIds) {
      Hooks.off(hook.name, hook.id);
    }
    this.#sceneHookIds = [];
  }

  /**
   * Docks Foundry's ui.chat.element into the mobile sheet's chat mount point.
   */
  #dockChatElement() {
    const mount = this.element?.querySelector(".mobile-chat-mount");
    const chatEl = ui.chat?.element?.[0] ?? document.getElementById("chat");
    if (!mount || !chatEl) return;

    if (!mount.contains(chatEl)) {
      if (!this.#chatOriginalParent && chatEl.parentElement) {
        this.#chatOriginalParent = chatEl.parentElement;
        this.#chatOriginalNextSibling = chatEl.nextSibling;
      }
      mount.appendChild(chatEl);
    }

    // Capture damage button clicks to guarantee active token selection immediately
    if (!chatEl._pf2eMobileDamageCapture) {
      chatEl.addEventListener("click", (event) => {
        const btn = event.target?.closest?.("button[data-action]");
        if (btn) {
          const action = btn.dataset.action;
          if (["apply-damage", "half-damage", "double-damage", "triple-damage", "apply-healing", "shield-block"].includes(action)) {
            this.#ensureTokenControlled();
          }
        }
      }, { capture: true });
      chatEl._pf2eMobileDamageCapture = true;
    }
  }

  /**
   * Restores ui.chat.element back to its original parent upon sheet closure.
   */
  #restoreChatElement() {
    const chatEl = ui.chat?.element?.[0] ?? document.getElementById("chat");
    if (!chatEl) return;
    if (this.#chatOriginalParent && this.#chatOriginalParent.isConnected) {
      if (this.#chatOriginalNextSibling && this.#chatOriginalParent.contains(this.#chatOriginalNextSibling)) {
        this.#chatOriginalParent.insertBefore(chatEl, this.#chatOriginalNextSibling);
      } else {
        this.#chatOriginalParent.appendChild(chatEl);
      }
    }
  }

  /**
   * Ensures the current sheet actor's token placeable is selected and controlled on canvas.
   */
  #ensureTokenControlled() {
    const actor = this.actor;
    if (!actor) return;
    const scene = canvas?.scene ?? game.scenes.viewed ?? game.scenes.active;
    if (!scene) return;

    const activePlaceables = typeof actor.getActiveTokens === "function" ? actor.getActiveTokens(true, false) : [];
    const token = activePlaceables?.[0]
      ?? (canvas?.tokens?.placeables ? canvas.tokens.placeables.find(t => t.actor?.id === actor.id) : null);

    if (token && typeof token.control === "function" && !token.controlled) {
      try {
        token.control({ releaseOthers: true });
      } catch {}
    }
  }

  /**
   * Listens for new chat messages to update unread badge when sheet is on another tab.
   */
  #registerChatListener() {
    if (this.#chatHookId !== null) return;
    this.#chatHookId = Hooks.on("createChatMessage", () => {
      if (this.rendered && this.#activeTab !== "chat") {
        this.#unreadChatCount++;
        this.#updateChatBadge();
      }
    });
  }

  /**
   * Unregisters chat message hook.
   */
  #unregisterChatListener() {
    if (this.#chatHookId !== null) {
      Hooks.off("createChatMessage", this.#chatHookId);
      this.#chatHookId = null;
    }
  }

  /**
   * Synchronizes unread badge DOM in bottom navigation bar.
   */
  #updateChatBadge() {
    const badge = this.element?.querySelector(".chat-badge");
    if (!badge) return;
    if (this.#unreadChatCount > 0) {
      badge.textContent = this.#unreadChatCount > 99 ? "99+" : String(this.#unreadChatCount);
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
    const system = actor.system ?? {};

    context.actor = actor;
    context.activeTab = this.#activeTab;
    context.actionSubTab = this.#actionSubTab;
    context.rollMode = this.#rollMode;
    context.unreadChatCount = this.#unreadChatCount;

    // Owned Characters Switcher Context
    const owned = game.actors.filter(a => a.type === "character" && a.isOwner);
    context.ownedCharacters = owned.map(a => ({
      id: a.id,
      name: a.name,
      img: a.img
    }));
    context.hasMultipleCharacters = context.ownedCharacters.length > 1;

    // HP & Shield Context
    context.hp = {
      value: system.attributes?.hp?.value ?? 0,
      max: system.attributes?.hp?.max ?? 0,
      temp: system.attributes?.hp?.temp ?? 0
    };

    const shield = system.attributes?.shield ?? actor.heldShield?.system;
    context.shield = {
      hp: {
        value: shield?.hp?.value ?? 0,
        max: shield?.hp?.max ?? 0
      },
      hardness: shield?.hardness ?? 0
    };

    // Defenses Context: querying actor statistic objects directly with resilient fallbacks
    const fortMod = actor.saves?.fortitude?.mod ?? actor.saves?.fortitude?.check?.mod ?? actor.saves?.fortitude?.totalModifier ?? system.saves?.fortitude?.value ?? system.saves?.fortitude?.mod ?? 0;
    const refMod = actor.saves?.reflex?.mod ?? actor.saves?.reflex?.check?.mod ?? actor.saves?.reflex?.totalModifier ?? system.saves?.reflex?.value ?? system.saves?.reflex?.mod ?? 0;
    const willMod = actor.saves?.will?.mod ?? actor.saves?.will?.check?.mod ?? actor.saves?.will?.totalModifier ?? system.saves?.will?.value ?? system.saves?.will?.mod ?? 0;
    const percMod = actor.perception?.mod ?? actor.perception?.check?.mod ?? actor.perception?.totalModifier ?? system.perception?.mod ?? system.attributes?.perception?.value ?? 0;
    const acVal = actor.armorClass?.value ?? actor.attributes?.ac?.value ?? system.attributes?.ac?.value ?? 10;

    context.defenses = {
      ac: { value: acVal },
      perception: { mod: percMod },
      fortitude: { mod: fortMod },
      reflex: { mod: refMod },
      will: { mod: willMod }
    };

    // Combat & Initiative Context
    const activeCombat = game.combat;
    const combatant = activeCombat ? activeCombat.combatants.find(c => c.actor?.id === actor.id || c.actor === actor) : null;
    const hasRolledInit = combatant?.initiative !== null && combatant?.initiative !== undefined;
    const initStat = actor.initiative;
    const initMod = initStat?.mod ?? initStat?.totalModifier ?? percMod;

    context.initiative = {
      mod: initMod,
      value: hasRolledInit ? combatant.initiative : null
    };

    context.combat = {
      active: !!activeCombat,
      inCombat: !!combatant,
      hasRolled: hasRolledInit,
      initiative: hasRolledInit ? combatant.initiative : null
    };

    // Target Selection: Gather tokens from current scene (supports bypassed canvas)
    const scene = canvas?.scene ?? game.scenes.viewed ?? game.scenes.active;
    const currentTargetId = Array.from(game.user?.targets ?? []).find(t => t.id)?.id ?? "";

    let targetTokens = [];
    if (canvas?.tokens?.placeables?.length) {
      targetTokens = canvas.tokens.placeables
        .filter(t => t.actor && t.actor.id !== actor.id && t.visible)
        .map(t => ({
          id: t.id,
          name: t.name,
          selected: t.id === currentTargetId
        }));
    } else if (scene?.tokens) {
      targetTokens = scene.tokens.contents
        .filter(t => {
          if (!t.actor) return false;
          if (t.actorId === actor.id) return false;
          if (t.hidden && !game.user.isGM) return false;
          return true;
        })
        .map(t => ({
          id: t.id,
          name: t.name,
          selected: t.id === currentTargetId
        }));
    }
    context.targets = targetTokens;

    // Focus Pool
    const focusResource = system.resources?.focus;
    context.focus = {
      value: focusResource?.value ?? 0,
      max: focusResource?.max ?? 0
    };

    // Strikes Context (with Weapon Image, Traits, MAP Variants, Damage, and Auxiliary Actions)
    const strikesList = actor.system.actions ?? [];
    context.strikes = strikesList.map((action, idx) => {
      const item = action.item;
      const rawTraits = action.traits ?? item?.system?.traits?.value ?? [];
      const traits = Array.isArray(rawTraits)
        ? rawTraits.map(t => typeof t === "string" ? { label: t } : { label: t.label ?? t.name ?? "" })
        : [];

      const auxActions = (action.auxiliaryActions ?? []).map((aux, aIdx) => ({
        index: aIdx,
        label: aux.label ?? aux.action ?? "Action",
        glyph: aux.glyph ?? (aux.actions ? String(aux.actions) : ""),
        annotation: aux.annotation ?? null,
        purpose: aux.action ?? ""
      }));

      return {
        index: idx,
        label: action.label ?? action.name,
        type: action.type ?? "strike",
        glyph: action.glyph ?? (action.actionCost ? String(action.actionCost.value || 1) : "1"),
        img: item?.img || "systems/pf2e/icons/default-icons/melee.svg",
        variants: (action.variants ?? []).map((v, vIdx) => ({
          index: vIdx,
          label: v.label
        })),
        damage: !!action.damage,
        critical: typeof action.critical === "function",
        damageFormula: item?.system?.damage?.dice
          ? `${item.system.damage.dice}${item.system.damage.die}`
          : (action.damageFormula ?? "Damage"),
        traits,
        auxiliaryActions: auxActions,
        hasAuxiliary: auxActions.length > 0
      };
    });

    // Character Actions Preparation (Matching PF2e ActorSheet actions tab)
    const encounterActions = [];
    const encounterReactions = [];
    const encounterFree = [];
    const skillActions = [];
    const explorationActions = [];
    const downtimeActions = [];

    const PF2E_SKILL_SLUGS = new Set([
      "acrobatics",
      "arcana",
      "athletics",
      "crafting",
      "deception",
      "diplomacy",
      "intimidation",
      "lore",
      "medicine",
      "nature",
      "occultism",
      "performance",
      "religion",
      "society",
      "stealth",
      "survival",
      "thievery"
    ]);

    const KNOWN_SKILL_ACTION_SLUGS = new Set([
      // Acrobatics
      "balance", "tumble-through", "maneuver-in-flight", "squeeze", "kip-up", "steady-balance",
      // Arcana
      "borrow-an-arcane-spell", "decipher-writing", "identify-magic", "learn-a-spell", "safely-borrow-an-arcane-spell",
      // Athletics
      "climb", "force-open", "grapple", "high-jump", "jump", "long-jump", "shove", "swim", "trip", "disarm", "escape", "reposition",
      // Crafting
      "craft", "earn-income", "identify-alchemy", "repair",
      // Deception
      "create-a-diversion", "feint", "impersonate", "lie",
      // Diplomacy
      "bon-mot", "gather-information", "make-an-impression", "request",
      // Intimidation
      "coerce", "demoralize",
      // Medicine
      "administer-first-aid", "battle-medicine", "treat-disease", "treat-poison", "treat-wounds",
      // Nature
      "command-an-animal",
      // Performance
      "perform",
      // Society
      "create-forgery", "subsist",
      // Stealth
      "conceal-an-object", "hide", "sneak",
      // Survival
      "cover-tracks", "sense-direction", "track",
      // Thievery
      "disable-device", "palm-an-object", "pick-a-lock", "steal",
      // Shared / General
      "recall-knowledge", "seek", "sense-motive", "scramble"
    ]);

    const KNOWN_SKILL_ACTION_NAMES = new Set([
      "administer first aid", "balance", "battle medicine", "bon mot",
      "borrow an arcane spell", "climb", "coerce", "command an animal",
      "conceal an object", "craft", "create a diversion", "create forgery",
      "decipher writing", "demoralize", "disable device", "disarm",
      "earn income", "escape", "feint", "force open", "gather information",
      "grapple", "hide", "high jump", "identify alchemy", "identify magic",
      "impersonate", "jump", "leap", "learn a spell", "lie", "long jump",
      "make an impression", "maneuver in flight", "palm an object", "perform",
      "pick a lock", "recall knowledge", "repair", "reposition", "request",
      "safely borrow an arcane spell", "scramble", "seek", "sense direction",
      "sense motive", "shove", "sneak", "squeeze", "steal", "subsist",
      "swim", "track", "treat disease", "treat poison", "treat wounds",
      "trip", "tumble through"
    ]);

    const getGlyph = (actionCost) => {
      const type = actionCost?.type;
      const value = actionCost?.value;
      if (type === "reaction") return "R";
      if (type === "free") return "F";
      if (type === "action") return String(value || 1);
      return "";
    };

    const elementalBlasts = actor.itemTypes?.action?.filter(i => i.slug === "elemental-blast") ?? [];

    for (const item of actor.items) {
      const isAction = typeof item.isOfType === "function" ? item.isOfType("action") : item.type === "action";
      const isFeat = typeof item.isOfType === "function" ? item.isOfType("feat") : item.type === "feat";
      const isFeatWithAction = isFeat && (item.actionCost || item.system?.actionType?.value === "action" || item.system?.actionType?.value === "reaction" || item.system?.actionType?.value === "free");

      if (!isAction && !isFeatWithAction) continue;
      if (item.suppressed) continue;
      if (actor.flags?.pf2e?.kineticist && item === elementalBlasts[0]) continue;

      const actionCost = item.actionCost;
      const rawTraits = item.system?.traits?.value ?? [];
      const traits = Array.isArray(rawTraits) ? rawTraits.map(t => typeof t === "string" ? t.toLowerCase() : String(t?.value ?? "").toLowerCase()) : [];
      const actionCategory = String(item.system?.actionCategory?.value ?? item.system?.category ?? item.category ?? "").toLowerCase();

      // Exploration & Downtime identification
      const isExploration = traits.includes("exploration") || actionCategory === "exploration";
      const isDowntime = traits.includes("downtime") || actionCategory === "downtime";

      // Check system action registry if available in PF2e
      const actionSlug = item.slug ?? item.system?.slug ?? "";
      const systemAction = game.pf2e?.actions?.get?.(actionSlug);
      const isSystemSkillAction = systemAction?.section === "skill" || !!systemAction?.statistic;

      const itemSlug = String(actionSlug).toLowerCase();
      const normalizedName = String(item.name ?? "").trim().toLowerCase();

      // Skill Action identification:
      // 1. Slug or name matches known PF2e skill actions (e.g. administer-first-aid, balance, demoralize, etc.)
      // 2. System registry declares it as a skill action or assigns a skill statistic
      // 3. Skill feat (item category "skill")
      // 4. Traits match any of the 17 PF2e skills or "skill"
      const isSkillAction = !isExploration && !isDowntime && (
        KNOWN_SKILL_ACTION_SLUGS.has(itemSlug) ||
        KNOWN_SKILL_ACTION_NAMES.has(normalizedName) ||
        isSystemSkillAction ||
        traits.some(t => PF2E_SKILL_SLUGS.has(t) || t === "skill") ||
        actionCategory === "skill" ||
        item.category === "skill" ||
        (item.system?.category === "interaction") ||
        (item.flags?.pf2e?.skillAction)
      );

      const selfEffect = item.system?.selfEffect;
      const isEffectActive = !!(selfEffect?.uuid && actor.itemTypes?.effect?.some(e =>
        e.sourceId === selfEffect.uuid ||
        e.flags?.core?.sourceId === selfEffect.uuid ||
        (selfEffect.name && e.name?.toLowerCase() === selfEffect.name.toLowerCase()) ||
        (item.name && e.name?.toLowerCase() === `effect: ${item.name.toLowerCase()}`) ||
        (actionSlug && (e.system?.slug === actionSlug || e.system?.slug === `effect-${actionSlug}`))
      ));

      const isUsable = !!selfEffect || !!item.system?.frequency || !!item.crafting;
      const isAttack = traits.includes("attack") || systemAction?.traits?.includes("attack");
      const isSkillStatistic = !!systemAction?.statistic || !!item.system?.statistic || KNOWN_SKILL_ACTION_SLUGS.has(itemSlug);
      const hasRoll = !selfEffect && (!!systemAction || isAttack || isSkillStatistic);

      let rawDescription = item.system?.description?.value ?? "";
      if (!rawDescription && systemAction?.description) {
        rawDescription = game.i18n.localize(systemAction.description);
      }
      const TextEditorClass = foundry.applications?.ux?.TextEditor ?? TextEditor;
      let enrichedDescription = rawDescription;
      if (rawDescription && typeof TextEditorClass?.enrichHTML === "function") {
        try {
          enrichedDescription = await TextEditorClass.enrichHTML(rawDescription, {
            secrets: item.isOwner,
            rollData: actor.getRollData(),
            async: true
          });
        } catch {
          enrichedDescription = rawDescription;
        }
      }

      const actionData = {
        id: item.id,
        name: item.name,
        slug: actionSlug,
        img: item.img || "systems/pf2e/icons/actions/Empty.webp",
        glyph: getGlyph(actionCost),
        actionCostType: actionCost?.type ?? "action",
        actionCostValue: actionCost?.value ?? 1,
        usable: isUsable,
        active: isEffectActive,
        isAttack,
        hasRoll,
        traits: traits.map(t => ({ label: t })),
        frequency: item.system?.frequency ? {
          value: item.system.frequency.value ?? 0,
          max: item.system.frequency.max ?? 0,
          per: item.system.frequency.per ?? ""
        } : null,
        description: enrichedDescription || rawDescription,
        isExpanded: this.#expandedActionIds.has(item.id) || this.#expandedActionIds.has(actionSlug)
      };

      if (isDowntime) {
        downtimeActions.push(actionData);
      } else if (isExploration) {
        explorationActions.push(actionData);
      } else if (isSkillAction) {
        skillActions.push(actionData);
      } else if (actionCost?.type === "reaction") {
        encounterReactions.push(actionData);
      } else if (actionCost?.type === "free") {
        encounterFree.push(actionData);
      } else {
        encounterActions.push(actionData);
      }
    }

    const sortByName = (a, b) => a.name.localeCompare(b.name);
    encounterActions.sort(sortByName);
    encounterReactions.sort(sortByName);
    encounterFree.sort(sortByName);
    skillActions.sort(sortByName);
    explorationActions.sort(sortByName);
    downtimeActions.sort(sortByName);

    context.characterActions = {
      actions: encounterActions,
      reactions: encounterReactions,
      free: encounterFree,
      skillActions: skillActions,
      exploration: explorationActions,
      downtime: downtimeActions,
      hasEncounter: encounterActions.length > 0 || encounterReactions.length > 0 || encounterFree.length > 0,
      hasSkillActions: skillActions.length > 0,
      hasExploration: explorationActions.length > 0,
      hasDowntime: downtimeActions.length > 0
    };

    // Skills Context
    const skills = system.skills ?? {};
    context.skills = Object.entries(skills).map(([slug, skillData]) => ({
      slug,
      label: skillData.label ?? (typeof slug.capitalize === "function" ? slug.capitalize() : slug.charAt(0).toUpperCase() + slug.slice(1)),
      mod: skillData.mod ?? skillData.value ?? 0,
      rank: skillData.rank ?? 0
    }));

    // Inventory & Encumbrance Context
    const encumbrance = system.attributes?.encumbrance ?? {};
    context.encumbrance = {
      bulk: (encumbrance.bulk?.value ?? 0).toFixed(1),
      max: encumbrance.bulk?.max ?? 10,
      isEncumbered: encumbrance.isEncumbered ?? false,
      isOverLimit: encumbrance.isOverLimit ?? false
    };

    const items = actor.items;
    context.inventory = {
      weapons: items.filter(i => i.type === "weapon").map(w => ({
        id: w.id,
        name: w.name,
        img: w.img,
        bulk: w.system.bulk?.value ?? "-"
      })),
      armor: items.filter(i => i.type === "armor" || i.type === "shield").map(a => ({
        id: a.id,
        name: a.name,
        img: a.img,
        bulk: a.system.bulk?.value ?? "-"
      })),
      consumables: items.filter(i => i.type === "consumable").map(c => ({
        id: c.id,
        name: c.name,
        img: c.img,
        quantity: c.system.quantity ?? 1
      })),
      gear: items.filter(i => !["weapon", "armor", "shield", "consumable", "spell", "feat", "effect"].includes(i.type)).map(g => ({
        id: g.id,
        name: g.name,
        img: g.img,
        quantity: g.system.quantity ?? 1,
        bulk: g.system.bulk?.value ?? "-"
      }))
    };

    // Spellcasting Groups Context
    context.spellGroups = this.#prepareSpellGroups();

    return context;
  }

  /**
   * Helper to structure spells by rank and spellcasting entries.
   * @returns {Array<object>}
   */
  #prepareSpellGroups() {
    const groups = [];
    const entries = this.actor.spellcasting?.contents ?? [];

    for (const entry of entries) {
      const entryId = entry.id;
      const systemData = entry.system ?? {};

      // Spells in this entry
      const spells = entry.spells?.contents ?? [];

      // Check cantrips
      const cantrips = spells.filter(s => s.isCantrip);
      if (cantrips.length > 0) {
        groups.push({
          label: `${entry.name} - Cantrips`,
          rank: 0,
          entryId,
          hasSlots: false,
          spells: cantrips.map(s => this.#formatSpell(s, entryId))
        });
      }

      // Check ranks 1 through 10
      for (let rank = 1; rank <= 10; rank++) {
        const rankKey = `slot${rank}`;
        const slotData = systemData.slots?.[rankKey];
        const rankSpells = spells.filter(s => !s.isCantrip && (s.rank === rank || s.system.level?.value === rank));

        if ((slotData && slotData.max > 0) || rankSpells.length > 0) {
          groups.push({
            label: `${entry.name} - Rank ${rank}`,
            rank,
            entryId,
            hasSlots: !!(slotData && slotData.max > 0),
            slots: {
              value: slotData?.value ?? 0,
              max: slotData?.max ?? 0
            },
            spells: rankSpells.map(s => this.#formatSpell(s, entryId))
          });
        }
      }
    }

    return groups;
  }

  /**
   * Format spell item details.
   * @param {ItemPF2e} spell
   * @param {string} entryId
   * @returns {object}
   */
  #formatSpell(spell, entryId) {
    return {
      id: spell.id,
      entryId,
      name: spell.name,
      img: spell.img,
      actionCost: spell.system.actions?.value ? `${spell.system.actions.value} Actions` : "",
      range: spell.system.range?.value ?? "",
      target: spell.system.target?.value ?? "",
      save: spell.system.defense?.save?.statistic ?? ""
    };
  }

  // ------------------------------------------------------------------------
  // Action Handlers
  // ------------------------------------------------------------------------

  /**
   * Action handler: apply damage to HP using PF2e's native system calculation.
   */
  static async #onApplyDamage(event, target) {
    const input = this.element.querySelector(".hp-delta-input");
    const amount = parseInt(input?.value, 10) || 1;
    if (amount <= 0) return;

    // Resolve token document per PF2e ApplyDamageParams requirements
    const tokenDoc = this.token ?? this.actor.getActiveTokens(true, true)[0] ?? this.actor.getActiveTokens()[0]?.document ?? null;

    if (typeof this.actor.applyDamage === "function") {
      await this.actor.applyDamage({ damage: amount, token: tokenDoc });
    } else {
      // Fallback manual damage calculation
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
  static async #onApplyHeal(event, target) {
    const input = this.element.querySelector(".hp-delta-input");
    const amount = parseInt(input?.value, 10) || 1;
    if (amount <= 0) return;

    // Resolve token document per PF2e ApplyDamageParams requirements
    const tokenDoc = this.token ?? this.actor.getActiveTokens(true, true)[0] ?? this.actor.getActiveTokens()[0]?.document ?? null;

    if (typeof this.actor.applyDamage === "function") {
      // In PF2e, negative damage represents healing through the native engine
      await this.actor.applyDamage({ damage: -amount, token: tokenDoc });
    } else {
      // Fallback manual heal calculation
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
  static async #onSetTempHP(event, target) {
    const val = parseInt(target.value, 10);
    if (isNaN(val)) return;
    const newTemp = Math.max(0, val);
    await this.actor.update({ "system.attributes.hp.temp": newTemp });
  }

  /**
   * Action handler: adjust temporary HP by delta step (+1 / -1).
   */
  static async #onAdjustTempHP(event, target) {
    const delta = parseInt(target.dataset.delta, 10);
    if (isNaN(delta)) return;

    const currentTemp = this.actor.system.attributes.hp?.temp ?? 0;
    const newTemp = Math.max(0, currentTemp + delta);
    await this.actor.update({ "system.attributes.hp.temp": newTemp });
  }

  /**
   * Action handler: roll saving throw (Fortitude, Reflex, or Will).
   */
  static async #onRollSave(event, target) {
    const saveKey = target.dataset.save;
    if (!saveKey) return;

    const saveStat = this.actor.saves?.[saveKey];
    const saveLabel = saveKey.charAt(0).toUpperCase() + saveKey.slice(1);

    if (this.#rollMode === "physical") {
      const mod = saveStat?.mod ?? saveStat?.check?.mod ?? saveStat?.totalModifier ?? this.actor.system.saves?.[saveKey]?.value ?? 0;
      const manualD20 = await this.#promptPhysicalRoll(`${saveLabel} Save`, "d20 Check");
      if (manualD20 !== null) {
        const total = manualD20 + mod;
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div><strong>${saveLabel} Save</strong>: 🎲 [${manualD20}] + ${mod} = <strong>${total}</strong></div>`
        });
      }
    } else {
      if (typeof saveStat?.roll === "function") {
        await saveStat.roll({ event });
      } else if (typeof this.actor.rollSave === "function") {
        await this.actor.rollSave(event, saveKey);
      }
    }
  }

  /**
   * Action handler: roll Perception check.
   */
  static async #onRollPerception(event, target) {
    if (this.#rollMode === "physical") {
      const percMod = this.actor.perception?.mod ?? this.actor.perception?.check?.mod ?? this.actor.perception?.totalModifier ?? this.actor.system.perception?.mod ?? this.actor.system.attributes?.perception?.value ?? 0;
      const manualD20 = await this.#promptPhysicalRoll("Perception Check", "d20 Check");
      if (manualD20 !== null) {
        const total = manualD20 + percMod;
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div><strong>Perception Check</strong>: 🎲 [${manualD20}] + ${percMod} = <strong>${total}</strong></div>`
        });
      }
    } else {
      if (typeof this.actor.perception?.roll === "function") {
        await this.actor.perception.roll({ event });
      } else if (typeof this.actor.rollPerception === "function") {
        await this.actor.rollPerception({ event });
      }
    }
  }

  /**
   * Action handler: roll Initiative check and add to combat when combat is active.
   */
  static async #onRollInitiative(event, target) {
    const combat = game.combat;
    let combatant = combat ? combat.combatants.find(c => c.actor?.id === this.actor.id || c.actor === this.actor) : null;

    // If combat is active but actor is not yet in it, add actor to combat
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

    if (this.#rollMode === "physical") {
      const initMod = this.actor.initiative?.mod ?? this.actor.initiative?.totalModifier ?? this.actor.perception?.mod ?? 0;
      const manualD20 = await this.#promptPhysicalRoll("Initiative Check", "d20 Check");
      if (manualD20 !== null) {
        const total = manualD20 + initMod;
        if (combatant && typeof combat?.setInitiative === "function") {
          await combat.setInitiative(combatant.id, total);
        }
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div><strong>Initiative Check</strong>: 🎲 [${manualD20}] + ${initMod} = <strong>${total}</strong></div>`
        });
      }
    } else {
      if (typeof this.actor.initiative?.roll === "function" && combat) {
        await this.actor.initiative.roll({ event, combatant: combatant || undefined });
      } else if (typeof this.actor.initiative?.statistic?.roll === "function") {
        // If no combat is active, roll initiative statistic check directly
        await this.actor.initiative.statistic.roll({ event });
      } else if (typeof this.actor.rollInitiative === "function") {
        await this.actor.rollInitiative({ createCombatants: true, initiativeOptions: { event } });
      } else if (typeof this.actor.perception?.roll === "function") {
        await this.actor.perception.roll({ event });
      }
    }
  }

  /**
   * Action handler: select scene token target from header dropdown.
   */
  static async #onSelectTarget(event, target) {
    const tokenId = target.value;
    await setTargetToken(tokenId);
  }

  /**
   * Action handler: toggle digital vs physical roll mode.
   */
  static async #onToggleRollMode(event, target) {
    const newMode = target.value;
    if (newMode === "digital" || newMode === "physical") {
      this.#rollMode = newMode;
      this.render({ parts: ["header"] });
    }
  }

  /**
   * Action handler: toggle fullscreen mode for mobile app view.
   */
  static async #onToggleFullscreen(event, target) {
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
   * Action handler: switch active tab.
   */
  static async #onSwitchTab(event, target) {
    const newTab = target.dataset.tab;
    if (newTab && newTab !== this.#activeTab) {
      this.#activeTab = newTab;
      if (newTab === "chat") {
        this.#unreadChatCount = 0;
      }
      this.render({ parts: ["sheet"] });
    }
  }

  /**
   * Action handler: switch active action sub-tab (encounter, exploration, downtime).
   */
  static async #onSwitchActionSubTab(event, target) {
    const newSubTab = target.dataset.subtab;
    if (newSubTab && newSubTab !== this.#actionSubTab) {
      this.#actionSubTab = newSubTab;
      this.render({ parts: ["sheet"] });
    }
  }

  /**
   * Action handler: open compendium browser drawer.
   */
  static async #onOpenCompendiumPicker(event, target) {
    const type = target.dataset.type ?? "spells";
    new CompendiumPickerApp(this.actor, {}, type).render(true);
  }

  /**
   * Action handler: adjust spell slots.
   */
  static async #onAdjustSlot(event, target) {
    const rank = parseInt(target.dataset.rank, 10);
    const delta = parseInt(target.dataset.delta, 10);
    const entryId = target.dataset.entryId;
    if (isNaN(rank) || isNaN(delta) || !entryId) return;

    const entry = this.actor.spellcasting?.get(entryId);
    if (!entry) return;

    const rankKey = `slot${rank}`;
    const currentSlot = entry.system.slots?.[rankKey];
    if (currentSlot) {
      const current = currentSlot.value ?? 0;
      const max = currentSlot.max ?? 0;
      const nextVal = clamp(current + delta, 0, max);
      await entry.update({ [`system.slots.${rankKey}.value`]: nextVal });
    }
  }

  /**
   * Action handler: adjust focus points.
   */
  static async #onAdjustFocus(event, target) {
    const delta = parseInt(target.dataset.delta, 10);
    if (isNaN(delta)) return;

    const focus = this.actor.system.resources?.focus;
    if (focus) {
      const current = focus.value ?? 0;
      const max = focus.max ?? 0;
      const nextVal = clamp(current + delta, 0, max);
      await this.actor.update({ "system.resources.focus.value": nextVal });
    }
  }

  /**
   * Resolves the target token for an action.
   * If a target is already selected in the header (or on canvas), it returns that token immediately.
   * If no target is selected, it opens a prompt dialog to let the user select one or proceed without a target.
   * @param {string} actionLabel
   * @returns {Promise<object|null|false>} Resolves to target token adapter, null (no target), or false (cancelled).
   */
  async #resolveTargetForAction(actionLabel) {
    const currentTarget = Array.from(game.user?.targets ?? []).find(t => t.id);
    if (currentTarget) {
      const targetToken = getTargetableToken(currentTarget.id) ?? currentTarget;
      if (targetToken) return targetToken;
    }
    return this.#promptTargetSelection(actionLabel);
  }

  /**
   * Action handler: execute strike attack roll with target prompt.
   */
  static async #onExecuteStrike(event, target) {
    const strikeIndex = parseInt(target.dataset.strikeIndex, 10);
    const variantIndex = parseInt(target.dataset.variantIndex, 10);
    const strike = this.actor.system.actions?.[strikeIndex];
    if (!strike) return;

    const variant = strike.variants?.[variantIndex];
    if (!variant) return;

    // Ensure origin token adapter is initialized on scene TokenDocument
    getOriginToken(this.actor);

    // Resolve target: use pre-selected target or prompt user
    const targetToken = await this.#resolveTargetForAction(`${strike.label} (${variant.label})`);
    if (targetToken === false) return; // User cancelled prompt

    // Ensure target is synchronized in Foundry user targets
    if (targetToken?.id) {
      await setTargetToken(targetToken.id);
    }

    if (this.#rollMode === "physical") {
      // Prompt for physical dice entry
      const manualRoll = await this.#promptPhysicalRoll(strike.label, variant.label);
      if (manualRoll !== null) {
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div><strong>${strike.label} (${variant.label})</strong>: 🎲 Physical Result: ${manualRoll}</div>`
        });
      }
    } else {
      // Digital roll via PF2e strike action passing target directly to CheckContext.
      // Ensure origin token placeable / token doc and event/context are passed.
      if (typeof variant.roll === "function") {
        const rollOptions = {
          event,
          target: targetToken || undefined
        };
        const originToken = getOriginToken(this.actor);
        if (originToken) {
          rollOptions.token = originToken;
        }
        await variant.roll(rollOptions);
      }
    }
  }

  /**
   * Action handler: execute damage roll with target prompt.
   */
  static async #onExecuteDamage(event, target) {
    const strikeIndex = parseInt(target.dataset.strikeIndex, 10);
    const strike = this.actor.system.actions?.[strikeIndex];
    if (!strike) return;

    // Ensure origin token adapter is initialized
    const originToken = getOriginToken(this.actor);

    // Resolve target: use pre-selected target or prompt user
    const targetToken = await this.#resolveTargetForAction(`${strike.label} (Damage)`);
    if (targetToken === false) return; // User cancelled prompt

    if (targetToken?.id) {
      await setTargetToken(targetToken.id);
    }

    if (typeof strike.damage === "function") {
      const rollOptions = { event, target: targetToken || undefined };
      if (originToken) rollOptions.token = originToken;
      await strike.damage(rollOptions);
    }
  }

  /**
   * Action handler: execute critical damage roll with target prompt.
   */
  static async #onExecuteCritical(event, target) {
    const strikeIndex = parseInt(target.dataset.strikeIndex, 10);
    const strike = this.actor.system.actions?.[strikeIndex];
    if (!strike) return;

    // Ensure origin token adapter is initialized
    const originToken = getOriginToken(this.actor);

    // Resolve target: use pre-selected target or prompt user
    const targetToken = await this.#resolveTargetForAction(`${strike.label} (Critical)`);
    if (targetToken === false) return; // User cancelled prompt

    if (targetToken?.id) {
      await setTargetToken(targetToken.id);
    }

    if (typeof strike.critical === "function") {
      const rollOptions = { event, target: targetToken || undefined };
      if (originToken) rollOptions.token = originToken;
      await strike.critical(rollOptions);
    }
  }

  /**
   * Action handler: execute a weapon auxiliary action (draw, sheathe, drop, reload, change grip).
   */
  static async #onExecuteAuxiliaryAction(event, target) {
    const strikeIndex = parseInt(target.dataset.strikeIndex, 10);
    const auxIndex = parseInt(target.dataset.auxIndex, 10);
    const strike = this.actor.system.actions?.[strikeIndex];
    if (!strike) return;

    const aux = strike.auxiliaryActions?.[auxIndex];
    if (typeof aux?.execute === "function") {
      await aux.execute({ event });
      return;
    }

    // Fallback if aux.execute is not directly available
    const weapon = strike.item;
    if (!weapon) return;
    const purpose = aux?.action ?? aux?.purpose ?? target.dataset.purpose ?? "";

    if (purpose === "draw") {
      await weapon.update({ "system.equipped.carryType": "held", "system.equipped.handsHeld": 1 });
    } else if (purpose === "sheathe") {
      await weapon.update({ "system.equipped.carryType": "worn", "system.equipped.handsHeld": 0 });
    } else if (purpose === "drop") {
      await weapon.update({ "system.equipped.carryType": "dropped", "system.equipped.handsHeld": 0 });
    }
  }

  /**
   * Action handler: send item / ability card to chat.
   */
  static async #onItemToChat(event, target) {
    const itemId = target.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    if (typeof item.toMessage === "function") {
      await item.toMessage(event);
    }
  }

  /**
   * Action handler: execute character action / feat ability.
   * Handles both self-inflicted actions (selfEffect / self-buffs applied to actor, ignoring targets)
   * and targeted / attack actions (affecting the targeted token).
   */
  static async #onUseAction(event, target) {
    const itemId = target.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    const actionSlug = item.slug ?? item.system?.slug ?? "";
    const rawTraits = item.system?.traits?.value ?? [];
    const traits = Array.isArray(rawTraits) ? rawTraits.map(t => typeof t === "string" ? t.toLowerCase() : String(t?.value ?? "").toLowerCase()) : [];

    // 1. If the action has a selfEffect (e.g. Dueling Parry, Raise a Shield, Marshall Aura, etc.)
    // These actions are explicitly on self and MUST NOT affect any targeted enemy token.
    const selfEffect = item.system?.selfEffect;
    if (selfEffect?.uuid) {
      const targetUuid = selfEffect.uuid;
      const targetName = (selfEffect.name ?? "").trim().toLowerCase();
      const itemName = (item.name ?? "").trim().toLowerCase();
      const itemSlug = (actionSlug || "").toLowerCase();

      // Check if the effect is already active on the actor (self)
      const existingEffect = this.actor.itemTypes?.effect?.find(e =>
        e.sourceId === targetUuid ||
        e.flags?.core?.sourceId === targetUuid ||
        (targetName && e.name?.toLowerCase() === targetName) ||
        (itemName && e.name?.toLowerCase() === `effect: ${itemName}`) ||
        (itemSlug && (e.system?.slug === itemSlug || e.system?.slug === `effect-${itemSlug}`))
      );

      if (existingEffect) {
        // Toggle effect off on actor
        await existingEffect.delete();
        ui.notifications?.info?.(`Deactivated ${existingEffect.name} for ${this.actor.name}.`);
      } else {
        // Fetch and apply the effect to the actor (self only)
        const effectDoc = await fromUuid(selfEffect.uuid);
        if (effectDoc) {
          const effectSource = effectDoc.toObject();
          delete effectSource._id;
          effectSource._id = null;

          const tokenDoc = this.token ?? this.actor.getActiveTokens?.(true, true)?.[0] ?? this.actor.getActiveTokens?.()?.[0]?.document ?? null;
          if (!effectSource.system) effectSource.system = {};
          effectSource.system.context = {
            origin: {
              actor: this.actor.uuid,
              item: item.uuid,
              token: tokenDoc?.uuid ?? null,
              spellcasting: null,
              rollOptions: typeof item.getOriginData === "function" ? (item.getOriginData()?.rollOptions ?? []) : []
            },
            target: {
              actor: this.actor.uuid,
              token: tokenDoc?.uuid ?? null
            },
            roll: null
          };

          await this.actor.createEmbeddedDocuments("Item", [effectSource]);
          ui.notifications?.info?.(`Activated ${effectDoc.name} on ${this.actor.name}.`);
        }
      }

      // Deduct frequency if applicable
      if (item.system?.frequency && item.system.frequency.value > 0) {
        const newVal = Math.max(0, (item.system.frequency.value ?? 0) - 1);
        await item.update({ "system.frequency.value": newVal });
      }

      // Send action card to chat
      if (typeof item.toMessage === "function") {
        await item.toMessage(event);
      }

      this.render({ parts: ["sheet"] });
      return;
    }

    // 2. If PF2e system action registry provides an action implementation (Action.use)
    const systemAction = game.pf2e?.actions?.get?.(actionSlug) ?? game.pf2e?.actions?.[actionSlug];
    if (systemAction) {
      const SELF_ACTION_SLUGS = new Set([
        "raise-a-shield", "take-cover", "end-cover", "point-out", "delay",
        "drop-prone", "stand", "step", "stride", "burrow", "climb", "fly",
        "leap", "swim", "escape", "hide", "sneak"
      ]);

      const isSelfAction = SELF_ACTION_SLUGS.has(actionSlug);

      let targetToken = null;
      if (!isSelfAction) {
        // Targeted action: resolve the selected target or prompt for one
        targetToken = await this.#resolveTargetForAction(item.name);
        if (targetToken === false) return; // User cancelled prompt
      }

      const useOptions = {
        actors: [this.actor],
        event
      };
      if (targetToken) {
        useOptions.target = targetToken.object ?? targetToken;
      }

      // Check if action offers multiple variants (e.g. Administer First Aid, Perform, Create a Diversion, etc.)
      const variantsCollection = systemAction.variants;
      if (variantsCollection && variantsCollection.size > 1) {
        const variantList = Array.from(variantsCollection.values()).map(v => ({
          slug: v.slug,
          name: v.name || v.label || v.slug,
          glyph: v.glyph,
          cost: v.cost
        }));
        const chosenVariant = await this.#promptVariantSelection(item.name, variantList);
        if (chosenVariant === false) return; // User cancelled prompt
        if (chosenVariant) {
          useOptions.variant = chosenVariant;
        }
      }

      // Check if action offers multiple statistics (e.g. Recall Knowledge)
      if (Array.isArray(systemAction.statistic) && systemAction.statistic.length > 1) {
        const chosenStat = await this.#promptStatisticSelection(item.name, systemAction.statistic);
        if (chosenStat === false) return; // User cancelled prompt
        if (chosenStat) {
          useOptions.statistic = chosenStat;
        }
      }

      try {
        if (typeof systemAction.use === "function") {
          await systemAction.use(useOptions);
          return;
        } else if (typeof systemAction === "function") {
          await systemAction(useOptions);
          return;
        }
      } catch (err) {
        console.warn(`pf2e-mobile-compact | Error executing action ${item.name}:`, err);
        ui.notifications?.warn?.(`Action execution: ${err.message}`);
      }
    }

    // 3. Deduct frequency if applicable
    if (item.system?.frequency && item.system.frequency.value > 0) {
      const newVal = Math.max(0, (item.system.frequency.value ?? 0) - 1);
      await item.update({ "system.frequency.value": newVal });
    }

    // 4. Send action card to chat
    if (typeof item.toMessage === "function") {
      await item.toMessage(event);
    }

    this.render({ parts: ["sheet"] });
  }

  /**
   * Action handler: roll an action check (skill check, attack activity, or rolled action).
   * Resolves target token and executes PF2e's native check workflow or statistic roll.
   */
  static async #onRollActionCheck(event, target) {
    const itemId = target.dataset.itemId;
    const actionSlug = target.dataset.actionSlug;
    const item = this.actor.items.get(itemId);
    const label = item?.name ?? actionSlug;

    // 1. Resolve target: check active target or prompt user
    let targetToken = null;
    const currentTarget = Array.from(game.user?.targets ?? []).find(t => t.id);
    if (currentTarget) {
      targetToken = getTargetableToken(currentTarget.id) ?? currentTarget;
    } else {
      targetToken = await this.#resolveTargetForAction(label);
      if (targetToken === false) return; // User cancelled prompt
    }

    // Ensure origin token adapter is initialized
    getOriginToken(this.actor);

    // 2. PF2e System Action Registry (e.g. Demoralize, Trip, Grapple, Disarm, Feint, Administer First Aid, etc.)
    const systemAction = game.pf2e?.actions?.get?.(actionSlug) ?? game.pf2e?.actions?.[actionSlug];
    if (systemAction) {
      const useOptions = {
        actors: [this.actor],
        event
      };
      if (targetToken) {
        useOptions.target = targetToken.object ?? targetToken;
      }

      // Check if action offers multiple variants (e.g. Administer First Aid, Perform, Create a Diversion, etc.)
      const variantsCollection = systemAction.variants;
      if (variantsCollection && variantsCollection.size > 1) {
        const variantList = Array.from(variantsCollection.values()).map(v => ({
          slug: v.slug,
          name: v.name || v.label || v.slug,
          glyph: v.glyph,
          cost: v.cost
        }));
        const chosenVariant = await this.#promptVariantSelection(label, variantList);
        if (chosenVariant === false) return; // User cancelled prompt
        if (chosenVariant) {
          useOptions.variant = chosenVariant;
        }
      }

      // Check if action offers multiple statistics (e.g. Recall Knowledge)
      if (Array.isArray(systemAction.statistic) && systemAction.statistic.length > 1) {
        const chosenStat = await this.#promptStatisticSelection(label, systemAction.statistic);
        if (chosenStat === false) return; // User cancelled prompt
        if (chosenStat) {
          useOptions.statistic = chosenStat;
        }
      }

      try {
        if (typeof systemAction.use === "function") {
          await systemAction.use(useOptions);
          return;
        } else if (typeof systemAction === "function") {
          await systemAction(useOptions);
          return;
        }
      } catch (err) {
        console.warn(`pf2e-mobile-compact | Error executing action check ${label}:`, err);
        ui.notifications?.warn?.(`Action roll: ${err.message}`);
      }
    }

    // 3. Action declaring a specific skill statistic (e.g. item.system.statistic)
    const statistic = item?.system?.statistic;
    if (statistic) {
      const stat = this.actor.getStatistic?.(statistic) ?? this.actor.skills?.[statistic];
      if (stat && typeof stat.roll === "function") {
        await stat.roll({
          event,
          target: targetToken?.object ?? targetToken
        });
        return;
      }
    }

    // 4. Attack Activity Feat: roll strike if action has the attack trait
    const itemTraits = item?.system?.traits?.value ?? [];
    const isAttack = itemTraits.includes("attack") || (Array.isArray(itemTraits) && itemTraits.some(t => (t?.value ?? t) === "attack"));
    if (isAttack) {
      const strikes = this.actor.system.actions ?? [];
      let selectedStrike = strikes[0];
      if (strikes.length > 1) {
        const chosen = await this.#promptStrikeSelection(label, strikes);
        if (chosen === false) return; // User cancelled prompt
        if (chosen) selectedStrike = chosen;
      }

      if (selectedStrike && typeof selectedStrike.roll === "function") {
        await selectedStrike.roll({
          event,
          target: targetToken?.object ?? targetToken
        });
        return;
      }
    }

    // Fallback: send action card to chat
    if (typeof item?.toMessage === "function") {
      await item.toMessage(event);
    }
  }

  /**
   * Action handler: roll skill check.
   */
  static async #onRollSkill(event, target) {
    const skillSlug = target.dataset.skill;
    if (!skillSlug) return;

    if (this.#rollMode === "physical") {
      const skill = this.actor.system.skills?.[skillSlug];
      const mod = skill?.mod ?? 0;
      const manualD20 = await this.#promptPhysicalRoll(skill?.label ?? skillSlug, "d20 Check");
      if (manualD20 !== null) {
        const total = manualD20 + mod;
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div><strong>${skill?.label ?? skillSlug} Check</strong>: 🎲 [${manualD20}] + ${mod} = <strong>${total}</strong></div>`
        });
      }
    } else {
      if (typeof this.actor.rollSkill === "function") {
        await this.actor.rollSkill(event, skillSlug);
      }
    }
  }

  /**
   * Action handler: consume item.
   */
  static async #onConsumeItem(event, target) {
    const itemId = target.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    if (typeof item.consume === "function") {
      await item.consume();
    }
  }

  /**
   * Action handler: cast spell.
   */
  static async #onCastSpell(event, target) {
    const itemId = target.dataset.itemId;
    const entryId = target.dataset.entryId;
    const rank = parseInt(target.dataset.rank, 10);

    const entry = this.actor.spellcasting?.get(entryId);
    const spell = this.actor.items.get(itemId);
    if (!entry || !spell) return;

    // Prompt for target if spell has target or range
    let targetToken = null;
    if (spell.system.target?.value || spell.system.range?.value) {
      targetToken = await this.#resolveTargetForAction(`Cast ${spell.name}`);
      if (targetToken === false) return; // Cancelled
    }

    if (typeof entry.cast === "function") {
      await entry.cast(spell, { slot: rank > 0 ? rank : 0, level: rank, target: targetToken || undefined });
    }
  }

  /**
   * Action handler: switch active character sheet to another owned character.
   */
  static async #onSwitchActor(event, target) {
    const newActorId = target.value;
    if (!newActorId || newActorId === this.actor.id) return;
    const newActor = game.actors.get(newActorId);
    if (!newActor) return;

    console.log(`PF2e Mobile Compact | Switching character to ${newActor.name}`);
    await this.close();
    newActor.sheet.render(true);
  }

  /**
   * Prompts the user to select or confirm their target before executing an action.
   * @param {string} actionLabel
   * @returns {Promise<object|null|false>} Resolves to target token adapter, null (no target), or false (cancelled).
   */
  async #promptTargetSelection(actionLabel) {
    const scene = canvas?.scene ?? game.scenes.viewed ?? game.scenes.active;
    const currentTargetId = Array.from(game.user?.targets ?? []).find(t => t.id)?.id ?? "";

    let availableTokens = [];
    if (canvas?.tokens?.placeables?.length) {
      availableTokens = canvas.tokens.placeables
        .filter(t => t.actor && t.actor.id !== this.actor.id && t.visible)
        .map(t => ({ id: t.id, name: t.name, selected: t.id === currentTargetId }));
    } else if (scene?.tokens) {
      availableTokens = scene.tokens.contents
        .filter(t => t.actor && t.actorId !== this.actor.id && (!t.hidden || game.user.isGM))
        .map(t => ({ id: t.id, name: t.name, selected: t.id === currentTargetId }));
    }

    // If there are no other tokens on the scene, proceed without target
    if (availableTokens.length === 0) return null;

    return new Promise(resolve => {
      const { DialogV2 } = foundry.applications.api;
      const optionsHtml = availableTokens
        .map(t => `<option value="${t.id}" ${t.selected ? "selected" : ""}>${t.name}</option>`)
        .join("");

      const content = `
        <div style="padding: 10px; text-align: center;">
          <p style="margin-bottom: 10px; font-size: 1.05rem;"><strong>Target for ${actionLabel}</strong></p>
          <label for="action-target-select" style="display:block; margin-bottom: 6px; font-size: 0.9rem; color: #bbb;">Select Target Token:</label>
          <select id="action-target-select" style="width: 100%; min-height: 48px; font-size: 1rem; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444;">
            <option value="">-- No Target --</option>
            ${optionsHtml}
          </select>
        </div>
      `;

      if (DialogV2) {
        DialogV2.prompt({
          window: { title: `Target: ${actionLabel}` },
          content,
          ok: {
            label: "Confirm & Roll",
            callback: async (event, button, dialog) => {
              const select = dialog.element.querySelector("#action-target-select");
              const selectedTokenId = select?.value ?? "";
              await setTargetToken(selectedTokenId);
              this.render({ parts: ["header"] });
              const targetToken = selectedTokenId ? getTargetableToken(selectedTokenId) : null;
              resolve(targetToken);
            }
          },
          rejectClose: false
        }).then(res => {
          if (res === null) resolve(false);
        });
      } else {
        const chosen = window.prompt(`Select Target Token ID for ${actionLabel} (leave empty for none):`, currentTargetId);
        if (chosen !== null) {
          setTargetToken(chosen);
          this.render({ parts: ["header"] });
          resolve(chosen ? getTargetableToken(chosen) : null);
        } else {
          resolve(false);
        }
      }
    });
  }

  /**
   * Simple touch-friendly modal for physical roll entry.
   * @param {string} title
   * @param {string} subtitle
   * @returns {Promise<number|null>}
   */
  static async #promptPhysicalRoll(title, subtitle) {
    return new Promise(resolve => {
      const { DialogV2 } = foundry.applications.api;
      if (DialogV2) {
        const content = `
          <div style="padding: 10px; text-align: center;">
            <p><strong>${title}</strong> (${subtitle})</p>
            <label for="physical-die-val" style="display:block; margin: 8px 0;">Enter Raw Die Result:</label>
            <input type="number" id="physical-die-val" style="font-size: 1.5rem; text-align:center; min-height: 48px; width: 100px;" min="1" max="100" value="10" autofocus />
          </div>
        `;
        DialogV2.prompt({
          window: { title: "Physical Die Input" },
          content,
          ok: {
            label: "Submit",
            callback: (event, button, dialog) => {
              const input = dialog.element.querySelector("#physical-die-val");
              const val = parseInt(input?.value, 10);
              resolve(isNaN(val) ? null : val);
            }
          },
          rejectClose: false
        }).then(res => {
          if (res === null) resolve(null);
        });
      } else {
        const res = window.prompt(`Enter raw physical die result for ${title} (${subtitle}):`, "10");
        const val = parseInt(res, 10);
        resolve(isNaN(val) ? null : val);
      }
    });
  }

  /**
   * Prompts user to select an action variant when multiple variants exist.
   * @param {string} actionLabel
   * @param {Array<{slug: string, name: string, glyph?: string, cost?: number}>} variants
   * @returns {Promise<string|false>} Selected variant slug, or false if cancelled.
   */
  async #promptVariantSelection(actionLabel, variants) {
    if (!variants || variants.length === 0) return null;
    if (variants.length === 1) return variants[0].slug;

    return new Promise(resolve => {
      const { DialogV2 } = foundry.applications.api;
      const optionsHtml = variants
        .map((v, i) => {
          const rawName = v.name || v.label || v.slug;
          const name = typeof rawName === "string" ? game.i18n.localize(rawName) : String(rawName?.name ?? rawName?.label ?? v.slug);
          const glyph = v.glyph ? ` [${v.glyph}]` : "";
          return `<option value="${v.slug}" ${i === 0 ? "selected" : ""}>${name}${glyph}</option>`;
        })
        .join("");

      const content = `
        <div style="padding: 10px; text-align: center;">
          <p style="margin-bottom: 10px; font-size: 1.05rem;"><strong>${actionLabel}</strong></p>
          <label for="action-variant-select" style="display:block; margin-bottom: 6px; font-size: 0.9rem; color: #bbb;">Select Action Variant:</label>
          <select id="action-variant-select" style="width: 100%; min-height: 48px; font-size: 1rem; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444;">
            ${optionsHtml}
          </select>
        </div>
      `;

      if (DialogV2) {
        DialogV2.prompt({
          window: { title: `${actionLabel} - Select Variant` },
          content,
          ok: {
            label: "Proceed",
            callback: (event, button, dialog) => {
              const select = dialog.element.querySelector("#action-variant-select");
              resolve(select?.value ?? variants[0].slug);
            }
          },
          rejectClose: false
        }).then(res => {
          if (res === null) resolve(false);
        });
      } else {
        resolve(variants[0].slug);
      }
    });
  }

  /**
   * Prompts user to select a statistic/skill when an action supports multiple statistics (e.g. Recall Knowledge).
   * @param {string} actionLabel
   * @param {Array<string>} statistics
   * @returns {Promise<string|false>} Selected statistic slug, or false if cancelled.
   */
  async #promptStatisticSelection(actionLabel, statistics) {
    if (!statistics || statistics.length === 0) return null;
    if (statistics.length === 1) return statistics[0];

    return new Promise(resolve => {
      const { DialogV2 } = foundry.applications.api;
      const optionsHtml = statistics
        .map((statKey, i) => {
          const stat = this.actor.getStatistic?.(statKey) ?? this.actor.skills?.[statKey];
          const mod = stat?.totalModifier ?? stat?.mod ?? stat?.check?.mod;
          const sign = typeof mod === "number" ? (mod >= 0 ? `+${mod}` : `${mod}`) : "";
          const skillConfig = CONFIG.PF2E?.skills?.[statKey];
          const rawLabel = stat?.label ?? (typeof skillConfig === "object" ? skillConfig?.label : skillConfig) ?? statKey;
          const label = typeof rawLabel === "string" ? game.i18n.localize(rawLabel) : String(rawLabel);
          return `<option value="${statKey}" ${i === 0 ? "selected" : ""}>${label} (${sign})</option>`;
        })
        .join("");

      const content = `
        <div style="padding: 10px; text-align: center;">
          <p style="margin-bottom: 10px; font-size: 1.05rem;"><strong>${actionLabel}</strong></p>
          <label for="action-stat-select" style="display:block; margin-bottom: 6px; font-size: 0.9rem; color: #bbb;">Select Skill to Check:</label>
          <select id="action-stat-select" style="width: 100%; min-height: 48px; font-size: 1rem; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444;">
            ${optionsHtml}
          </select>
        </div>
      `;

      if (DialogV2) {
        DialogV2.prompt({
          window: { title: `${actionLabel} - Select Skill` },
          content,
          ok: {
            label: "Roll Check",
            callback: (event, button, dialog) => {
              const select = dialog.element.querySelector("#action-stat-select");
              resolve(select?.value ?? statistics[0]);
            }
          },
          rejectClose: false
        }).then(res => {
          if (res === null) resolve(false);
        });
      } else {
        resolve(statistics[0]);
      }
    });
  }

  /**
   * Prompts user to select a weapon strike when executing an attack feat (e.g. Combat Grab, Power Attack).
   * @param {string} actionLabel
   * @param {Array<object>} strikes
   * @returns {Promise<object|false>} Selected strike object, or false if cancelled.
   */
  async #promptStrikeSelection(actionLabel, strikes) {
    if (!strikes || strikes.length === 0) return null;
    if (strikes.length === 1) return strikes[0];

    return new Promise(resolve => {
      const { DialogV2 } = foundry.applications.api;
      const optionsHtml = strikes
        .map((s, i) => {
          const mod = s.totalModifier ?? s.variants?.[0]?.totalModifier;
          const sign = typeof mod === "number" ? (mod >= 0 ? `+${mod}` : `${mod}`) : "";
          return `<option value="${i}" ${i === 0 ? "selected" : ""}>${s.label} (${sign})</option>`;
        })
        .join("");

      const content = `
        <div style="padding: 10px; text-align: center;">
          <p style="margin-bottom: 10px; font-size: 1.05rem;"><strong>${actionLabel}</strong></p>
          <label for="action-strike-select" style="display:block; margin-bottom: 6px; font-size: 0.9rem; color: #bbb;">Select Weapon Strike to Attack With:</label>
          <select id="action-strike-select" style="width: 100%; min-height: 48px; font-size: 1rem; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444;">
            ${optionsHtml}
          </select>
        </div>
      `;

      if (DialogV2) {
        DialogV2.prompt({
          window: { title: `${actionLabel} - Select Strike` },
          content,
          ok: {
            label: "Roll Attack",
            callback: (event, button, dialog) => {
              const select = dialog.element.querySelector("#action-strike-select");
              const idx = parseInt(select?.value ?? "0", 10);
              resolve(strikes[idx] ?? strikes[0]);
            }
          },
          rejectClose: false
        }).then(res => {
          if (res === null) resolve(false);
        });
      } else {
        resolve(strikes[0]);
      }
    });
  }

  /**
   * Action handler: toggle expandable description summary on an action card.
   */
  static #onToggleActionSummary(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const card = target.closest(".action-card");
    if (!card) return;
    const itemId = card.dataset.itemId;
    const summary = card.querySelector(".action-summary");
    const icon = card.querySelector(".action-expand-icon");
    if (!summary) return;

    const isExpanded = summary.classList.contains("expanded");
    if (isExpanded) {
      summary.classList.remove("expanded");
      summary.classList.add("collapsed");
      card.classList.remove("expanded");
      icon?.classList?.remove("expanded");
      if (itemId) this.#expandedActionIds.delete(itemId);
    } else {
      summary.classList.remove("collapsed");
      summary.classList.add("expanded");
      card.classList.add("expanded");
      icon?.classList?.add("expanded");
      if (itemId) this.#expandedActionIds.add(itemId);
    }
  }
}
