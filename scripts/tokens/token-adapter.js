/**
 * Headless Canvas Token Adapter & Geometry for PF2e Mobile Compact Sheet.
 * Provides virtual token bounds, distance calculation, flanking checks,
 * and targeting synchronization when running in headless mobile canvas mode.
 */

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
 * Ensures the actor's token is controlled on canvas if possible.
 * @param {Actor} actor
 */
export function ensureTokenControlled(actor) {
  if (!actor) return;
  const scene = canvas?.scene ?? game.scenes.viewed ?? game.scenes.active;
  if (!scene) return;

  if (canvas?.tokens?.placeables) {
    const activePlaceables = typeof actor.getActiveTokens === "function" ? actor.getActiveTokens(true, false) : [];
    const token = activePlaceables?.[0]
      ?? canvas.tokens.placeables.find(t => t.actor?.id === actor.id);

    if (token && typeof token.control === "function") {
      try {
        token.control({ releaseOthers: true });
      } catch {}
    } else if (canvas.tokens.controlled?.length > 0) {
      try {
        canvas.tokens.releaseAll();
      } catch {}
    }
  }
}

