/**
 * Headless Canvas Token Adapter & Geometry for PF2e Mobile Compact Sheet.
 * Provides real-time token coordinate synchronization (even when PIXI.Ticker is paused on iOS),
 * footprint-aware distance calculation, opposite-side & diagonal flanking checks,
 * self-targeting support, and single/multi-token targeting synchronization.
 */

/**
 * Safely retrieves the token's placeable object or adapter without throwing if
 * Foundry's `TokenDocument.prototype.object` getter calls `this.layer.createObject`
 * while canvas is headless or layers are uninitialized.
 * @param {TokenDocument|object} tokenDoc
 * @returns {object|null}
 */
export function getSafeTokenObject(tokenDoc) {
  if (!tokenDoc) return null;
  if (tokenDoc._object) return tokenDoc._object;
  try {
    return tokenDoc.object ?? null;
  } catch {
    return null;
  }
}

/**
 * Reads the authoritative database coordinates (`_source`) of a TokenDocument or Placeable
 * and synchronizes any in-memory placeable/document coordinates that may be frozen when
 * the mobile WebGL ticker (`canvas.app.ticker`) is paused.
 * @param {object} tokenOrDoc
 * @returns {object|null} The underlying TokenDocument, if available.
 */
export function syncTokenPosition(tokenOrDoc) {
  if (!tokenOrDoc) return null;
  const doc = tokenOrDoc.document ?? tokenOrDoc;
  if (!doc) return null;

  const canvasObj = typeof canvas !== "undefined" ? canvas : null;
  const src = doc._source ?? doc;
  const authX = typeof src.x === "number" ? src.x : (doc.x ?? 0);
  const authY = typeof src.y === "number" ? src.y : (doc.y ?? 0);
  const authElev = typeof src.elevation === "number" ? src.elevation : (doc.elevation ?? 0);

  const tickerStopped = Boolean(canvasObj?.app?.ticker && !canvasObj.app.ticker.started);
  if (tickerStopped || doc.x !== authX || doc.y !== authY) {
    try {
      if (doc.x !== authX) doc.x = authX;
      if (doc.y !== authY) doc.y = authY;
      if (doc.elevation !== authElev) doc.elevation = authElev;
    } catch {}

    const placeable = getSafeTokenObject(doc);
    if (placeable && !placeable._isMobileAdapter) {
      try {
        const CanvasAnim = foundry?.canvas?.animation?.CanvasAnimation;
        if (CanvasAnim && placeable.animationName) {
          CanvasAnim.terminateAnimation?.(placeable.animationName);
        }
        if (typeof placeable.stopAnimation === "function") {
          placeable.stopAnimation();
        }
        if (placeable.position && typeof placeable.position.set === "function") {
          placeable.position.set(authX, authY);
        } else {
          placeable.x = authX;
          placeable.y = authY;
        }
        if (placeable.mesh?.position && typeof placeable.mesh.position.set === "function") {
          const gridSize = canvasObj?.grid?.size ?? doc.parent?.grid?.size ?? 100;
          const wPx = (src.width ?? doc.width ?? 1) * gridSize;
          const hPx = (src.height ?? doc.height ?? 1) * gridSize;
          placeable.mesh.position.set(authX + wPx / 2, authY + hPx / 2);
        }
      } catch {}
    }
  }

  return doc;
}

/**
 * Synchronizes all tokens on the active scene so that distances and flanking
 * always reflect the latest database `_source` positions even when PIXI.Ticker is stopped.
 * @param {Scene} [sceneOverride]
 */
export function syncSceneTokenPositions(sceneOverride = null) {
  const canvasObj = typeof canvas !== "undefined" ? canvas : null;
  const scene = sceneOverride ?? canvasObj?.scene ?? game.scenes?.viewed ?? game.scenes?.active;
  const tokens = scene?.tokens?.contents ?? (scene?.tokens ? Array.from(scene.tokens) : []);
  for (const tDoc of tokens) {
    syncTokenPosition(tDoc);
  }
}

/**
 * Computes authoritative pixel bounds and center for any token or TokenDocument.
 * Always prefers `doc._source` coordinates so paused animations never return stale positions.
 * @param {object} tokenOrDoc
 * @param {number} [fallbackGridSize=100]
 * @returns {{ x: number, y: number, width: number, height: number, left: number, right: number, top: number, bottom: number, center: { x: number, y: number }, elevation: number, widthGrid: number, heightGrid: number, gridSize: number }}
 */
export function getAuthoritativeTokenGeometry(tokenOrDoc, fallbackGridSize = 100) {
  const canvasObj = typeof canvas !== "undefined" ? canvas : null;
  const doc = syncTokenPosition(tokenOrDoc) ?? tokenOrDoc?.document ?? tokenOrDoc ?? {};
  const src = doc._source ?? doc;
  const scene = doc.parent ?? tokenOrDoc?.scene ?? canvasObj?.scene ?? game.scenes?.viewed ?? game.scenes?.active;
  const gridSize = canvasObj?.grid?.size ?? scene?.grid?.size ?? scene?.dimensions?.size ?? fallbackGridSize;

  const rawX = typeof src.x === "number" ? src.x : (doc.x ?? tokenOrDoc?.x ?? 0);
  const rawY = typeof src.y === "number" ? src.y : (doc.y ?? tokenOrDoc?.y ?? 0);
  const elevation = typeof src.elevation === "number" ? src.elevation : (doc.elevation ?? tokenOrDoc?.elevation ?? 0);
  const widthGrid = typeof src.width === "number" ? src.width : (doc.width ?? 1);
  const heightGrid = typeof src.height === "number" ? src.height : (doc.height ?? 1);
  const rawWidth = widthGrid * gridSize;
  const rawHeight = heightGrid * gridSize;
  const rawCenterX = rawX + rawWidth / 2;
  const rawCenterY = rawY + rawHeight / 2;

  // In PF2e, Tiny tokens (width < 1 or height < 1) mechanically occupy the full 5-ft grid square containing their center
  const isTinyOrSmaller = widthGrid < 1 || heightGrid < 1;
  const x = isTinyOrSmaller ? Math.floor(rawCenterX / gridSize) * gridSize : Math.round(rawX / gridSize) * gridSize;
  const y = isTinyOrSmaller ? Math.floor(rawCenterY / gridSize) * gridSize : Math.round(rawY / gridSize) * gridSize;
  const width = isTinyOrSmaller ? gridSize : Math.max(1, Math.round(widthGrid)) * gridSize;
  const height = isTinyOrSmaller ? gridSize : Math.max(1, Math.round(heightGrid)) * gridSize;

  return {
    x,
    y,
    rawX,
    rawY,
    width,
    height,
    left: x,
    right: x + width,
    top: y,
    bottom: y + height,
    center: {
      x: x + width / 2,
      y: y + height / 2
    },
    elevation,
    widthGrid,
    heightGrid,
    gridSize
  };
}

/**
 * Inclusive 2D line segment intersection test (including endpoints/corners with epsilon tolerance).
 * Essential for PF2e flanking, where rays through opposite corners of a square must count as intersecting.
 * @param {{x: number, y: number}} p1
 * @param {{x: number, y: number}} p2
 * @param {{x: number, y: number}} p3
 * @param {{x: number, y: number}} p4
 * @returns {boolean}
 */
export function segmentsIntersectInclusive(p1, p2, p3, p4) {
  const eps = 1e-5;
  const d = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (Math.abs(d) < 1e-9) return false;
  const uA = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / d;
  const uB = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / d;
  return uA >= -eps && uA <= 1 + eps && uB >= -eps && uB <= 1 + eps;
}

/**
 * Checks whether two flankers are on opposite sides or opposite corners of `flankee`
 * per PF2e Player Core flanking rules.
 * @param {object} flankerA
 * @param {object} flankerB
 * @param {object} flankee
 * @returns {boolean}
 */
export function areTokensOnOppositeSides(flankerA, flankerB, flankee) {
  const geomA = getAuthoritativeTokenGeometry(flankerA);
  const geomB = getAuthoritativeTokenGeometry(flankerB);
  const b = getAuthoritativeTokenGeometry(flankee);

  const centerA = geomA.center;
  const centerB = geomB.center;

  const topLeft = { x: b.left, y: b.top };
  const topRight = { x: b.right, y: b.top };
  const bottomLeft = { x: b.left, y: b.bottom };
  const bottomRight = { x: b.right, y: b.bottom };

  const hitsLeft = segmentsIntersectInclusive(centerA, centerB, topLeft, bottomLeft);
  const hitsRight = segmentsIntersectInclusive(centerA, centerB, topRight, bottomRight);
  const hitsTop = segmentsIntersectInclusive(centerA, centerB, topLeft, topRight);
  const hitsBottom = segmentsIntersectInclusive(centerA, centerB, bottomLeft, bottomRight);

  return (hitsLeft && hitsRight) || (hitsTop && hitsBottom);
}

/**
 * Conditions that unconditionally prevent an actor/ally from flanking in PF2e.
 * Note: `stunned` is evaluated separately based on whether its value >= the actor's available actions (e.g. Stunned 3+).
 */
const NON_FLANKING_CONDITIONS = new Set([
  "unconscious",
  "dead",
  "dying",
  "paralyzed",
  "petrified",
  "confused",
  "controlled",
  "fleeing",
  "restrained",
  "blinded"
]);

/**
 * Checks whether an actor or token has a specific condition slug.
 * @param {Actor} actor
 * @param {object} tokenDoc
 * @param {string} slug
 * @returns {boolean}
 */
function hasActorCondition(actor, tokenDoc, slug) {
  if (!actor) return false;
  if (typeof actor.hasCondition === "function" && actor.hasCondition(slug)) return true;
  if (typeof actor.conditions?.bySlug === "function" && actor.conditions.bySlug(slug)?.length > 0) return true;
  if (actor.statuses?.has?.(slug) || tokenDoc?.statuses?.has?.(slug)) return true;
  const activeList = actor.conditions?.active ?? (Array.isArray(actor.conditions) ? actor.conditions : []);
  if (Array.isArray(activeList) && activeList.some(c => (c.slug ?? c.system?.slug ?? c.id) === slug)) return true;
  const condItems = actor.itemTypes?.condition ?? [];
  if (Array.isArray(condItems) && condItems.some(c => (c.slug ?? c.system?.slug) === slug)) return true;
  return false;
}

/**
 * Extracts the highest numeric value of a valued condition (such as `stunned` or `slowed`) on an actor.
 * Returns `Infinity` if the condition is present without a numeric value (e.g., duration-based full stun),
 * or `0` if the actor does not have the condition.
 * @param {Actor} actor
 * @param {object} tokenDoc
 * @param {string} slug
 * @returns {number}
 */
function getActorConditionValue(actor, tokenDoc, slug) {
  if (!hasActorCondition(actor, tokenDoc, slug)) return 0;

  const candidates = [];
  if (typeof actor.conditions?.bySlug === "function") {
    const bySlug = actor.conditions.bySlug(slug);
    if (Array.isArray(bySlug)) candidates.push(...bySlug);
  }
  if (typeof actor.getCondition === "function") {
    const single = actor.getCondition(slug);
    if (single) candidates.push(single);
  }
  const activeList = actor.conditions?.active ?? (Array.isArray(actor.conditions) ? actor.conditions : []);
  if (Array.isArray(activeList)) {
    for (const c of activeList) {
      if ((c.slug ?? c.system?.slug ?? c.id) === slug) candidates.push(c);
    }
  }
  const condItems = actor.itemTypes?.condition ?? [];
  if (Array.isArray(condItems)) {
    for (const c of condItems) {
      if ((c.slug ?? c.system?.slug) === slug) candidates.push(c);
    }
  }

  let maxVal = null;
  for (const c of candidates) {
    const rawVal = c?.value ?? c?.badge?.value ?? c?.system?.value?.value;
    if (typeof rawVal === "number" && Number.isFinite(rawVal)) {
      if (maxVal === null || rawVal > maxVal) maxVal = rawVal;
    }
  }

  if (maxVal !== null) return maxVal;
  return Infinity;
}

/**
 * Checks whether an actor is conscious, alive, visible, and free of conditions that prevent flanking
 * in PF2e (unconscious, dying, dead, 0 HP, paralyzed, petrified, confused, controlled, fleeing,
 * restrained, invisible, hidden, undetected, or stunned >= actor's actions [at least Stunned 3]).
 * @param {Actor} actor
 * @param {object} [tokenDoc=null]
 * @returns {boolean}
 */
export function isActorAbleToFlank(actor, tokenDoc = null) {
  if (!actor || actor.isDead) return false;
  if (tokenDoc?.hidden) return false;
  const hpVal = actor.hitPoints?.value ?? actor.system?.attributes?.hp?.value;
  if (typeof hpVal === "number" && hpVal <= 0) return false;
  // System Flanking Capability Flag (Deny Advantage, Feats, etc.)
  const canFlankFlag = actor.attributes?.flanking?.canFlank ?? actor.system?.attributes?.flanking?.canFlank;
  if (canFlankFlag === false) return false;

  // Static blocking conditions
  for (const cond of NON_FLANKING_CONDITIONS) {
    if (hasActorCondition(actor, tokenDoc, cond)) return false;
  }

  // Dynamic Action Depletion (Stunned & Slowed)
  const isStunned = hasActorCondition(actor, tokenDoc, "stunned");
  const isSlowed = hasActorCondition(actor, tokenDoc, "slowed");

  if (isStunned || isSlowed) {
    const rawStunned = getActorConditionValue(actor, tokenDoc, "stunned");

    // Duration-based stun (e.g., "stunned for 1 round" where value is null/undefined)
    // completely prevents actions for the entire duration.
    if (isStunned && (rawStunned === null || rawStunned === undefined || !Number.isFinite(rawStunned))) {
      return false;
    }

    const stunnedVal = rawStunned ?? 0;
    const slowedVal = getActorConditionValue(actor, tokenDoc, "slowed") ?? 0;
    const baseActions = hasActorCondition(actor, tokenDoc, "quickened") ? 4 : 3;

    // PF2e Rules: Stunned and Slowed do NOT stack; take the higher penalty
    const actionPenalty = Math.max(stunnedVal, slowedVal);
    const availableActions = Math.max(0, baseActions - actionPenalty);

    if (availableActions === 0) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluates whether `attackerToken` can flank `flankee` based on consciousness/conditions,
 * reach, visibility, Deny Advantage level thresholds, and creature alignment.
 * @param {object} attackerToken
 * @param {object} flankee
 * @param {object} [context={}]
 * @returns {boolean}
 */
export function canTokenFlank(attackerToken, flankee, context = {}) {
  const actor = attackerToken?.actor ?? attackerToken?.document?.actor;
  const flankeeActor = flankee?.actor ?? flankee?.document?.actor;
  if (!actor || !flankeeActor) return false;

  const attDoc = attackerToken.document ?? attackerToken;
  const flkDoc = flankee.document ?? flankee;
  if (attDoc.hidden || flkDoc.hidden || attDoc.id === flkDoc.id) return false;
  if (typeof actor.isOfType === "function" && !actor.isOfType("creature")) return false;
  if (typeof flankeeActor.isOfType === "function" && !flankeeActor.isOfType("creature")) return false;
  if (typeof actor.isAllyOf === "function" && actor.isAllyOf(flankeeActor)) return false;

  // Verify attacker/ally is conscious and able to flank (not unconscious, paralyzed, dying, 0 HP, etc.)
  if (!isActorAbleToFlank(actor, attDoc)) return false;

  const flankable = context.ignoreFlankable || (flankeeActor.attributes?.flanking?.flankable ?? true);
  if (!flankable) return false;

  // Respect Deny Advantage / level-based flanking immunity on flankee
  const minFlankLevel = flankeeActor.attributes?.flanking?.level;
  if (typeof minFlankLevel === "number" && (actor.level ?? 0) < minFlankLevel && !context.ignoreFlankable) {
    return false;
  }

  const reach = context.reach ?? (typeof actor.getReach === "function" ? actor.getReach({ action: "attack" }) : 5) ?? 5;
  const dist = measurePF2eTokenDistance(attackerToken, flankee, { reach });
  return typeof dist === "number" && Number.isFinite(dist) && reach >= dist;
}

/**
 * Evaluates whether `attackerToken` is currently flanking `flankee` with at least one ally on the scene.
 * Works accurately even when the mobile canvas ticker is paused or running headlessly.
 * @param {object} attackerToken
 * @param {object} flankee
 * @param {object} [context={}]
 * @returns {boolean}
 */
export function computeTokenFlanking(attackerToken, flankee, context = {}) {
  if (!attackerToken || !flankee) return false;
  const canvasObj = typeof canvas !== "undefined" ? canvas : null;
  const thisActor = attackerToken.actor ?? attackerToken.document?.actor;
  const attDoc = attackerToken.document ?? attackerToken;
  const scene = attDoc.parent ?? attackerToken.scene ?? canvasObj?.scene ?? game.scenes?.viewed ?? game.scenes?.active;

  syncSceneTokenPositions(scene);

  if (!thisActor || !canTokenFlank(attackerToken, flankee, context)) return false;

  const flanking = thisActor.attributes?.flanking;
  const sceneTokens = scene?.tokens?.contents ?? (scene?.tokens ? Array.from(scene.tokens) : []);

  const flankingBuddies = sceneTokens
    .filter(tDoc => tDoc.id !== attDoc.id && tDoc.actor && !tDoc.hidden)
    .filter(tDoc => {
      const buddyActor = tDoc.actor;
      const isAlly = (typeof buddyActor.isAllyOf === "function" && buddyActor.isAllyOf(thisActor))
        || (attDoc.isLinked && buddyActor.id === thisActor.id)
        || (attDoc.disposition !== undefined && tDoc.disposition === attDoc.disposition);
      return isAlly && canTokenFlank(tDoc, flankee, { ...context, reach: undefined });
    });

  if (flankingBuddies.length === 0) return false;

  // Gang Up / side-stepping flanking feats check
  if (Array.isArray(flanking?.canGangUp) && flanking.canGangUp.length > 0) {
    const gangingUp = flanking.canGangUp.some(g =>
      (typeof g === "number" && g <= flankingBuddies.length) || (g === true && flankingBuddies.length >= 1)
    ) || flankingBuddies.some(b => b.actor?.attributes?.flanking?.canGangUp?.some?.(g => g === true));
    if (gangingUp) return true;
  }

  return flankingBuddies.some(b => areTokensOnOppositeSides(attackerToken, b, flankee));
}

/**
 * Delegates token distance calculation to PF2e's native `TokenPF2e.prototype.distanceTo`
 * (after syncing `_source` positions) or Foundry's `grid.measurePath` across closest occupied squares.
 * @param {object} tokenA
 * @param {object} tokenB
 * @param {object} [options]
 * @returns {number}
 */
export function measurePF2eTokenDistance(tokenA, tokenB, options = {}) {
  if (!tokenA || !tokenB) return NaN;
  const canvasObj = typeof canvas !== "undefined" ? canvas : null;
  const docA = syncTokenPosition(tokenA) ?? tokenA.document ?? tokenA;
  const docB = syncTokenPosition(tokenB) ?? tokenB.document ?? tokenB;
  if (docA === docB || (docA?.id && docA.id === docB?.id)) return 0;

  const scene = docB?.parent ?? docA?.parent ?? tokenB.scene ?? tokenA.scene ?? canvasObj?.scene ?? game.scenes?.current ?? game.scenes?.viewed ?? game.scenes?.active;
  const grid = canvasObj?.grid ?? scene?.grid;
  const gridDist = scene?.grid?.distance ?? scene?.dimensions?.distance ?? 5;

  // Footprint-aware grid measurement using authoritative `_source` coordinates and Foundry's `grid.measurePath`
  // (or PF2e 5-10-5 grid square distance). Snaps Tiny tokens (width < 1) to the 5-ft grid square containing
  // their center so distances are always in 5-ft steps and never recurse into placeable.distanceTo.
  const geomA = getAuthoritativeTokenGeometry(docA);
  const geomB = getAuthoritativeTokenGeometry(docB);
  const gridSize = geomA.gridSize || 100;

  const cellsA = [];
  const colsA = geomA.widthGrid < 1 ? 1 : Math.max(1, Math.round(geomA.widthGrid));
  const rowsA = geomA.heightGrid < 1 ? 1 : Math.max(1, Math.round(geomA.heightGrid));
  for (let cx = 0; cx < colsA; cx++) {
    for (let cy = 0; cy < rowsA; cy++) {
      cellsA.push({
        x: geomA.x + (cx + 0.5) * gridSize,
        y: geomA.y + (cy + 0.5) * gridSize,
        elevation: geomA.elevation
      });
    }
  }

  const cellsB = [];
  const colsB = geomB.widthGrid < 1 ? 1 : Math.max(1, Math.round(geomB.widthGrid));
  const rowsB = geomB.heightGrid < 1 ? 1 : Math.max(1, Math.round(geomB.heightGrid));
  for (let cx = 0; cx < colsB; cx++) {
    for (let cy = 0; cy < rowsB; cy++) {
      cellsB.push({
        x: geomB.x + (cx + 0.5) * gridSize,
        y: geomB.y + (cy + 0.5) * gridSize,
        elevation: geomB.elevation
      });
    }
  }

  let minDistance = Infinity;
  if (typeof grid?.measurePath === "function") {
    for (const pA of cellsA) {
      for (const pB of cellsB) {
        try {
          const res = grid.measurePath([pA, pB]);
          if (typeof res?.distance === "number" && Number.isFinite(res.distance) && res.distance < minDistance) {
            minDistance = res.distance;
          }
        } catch {}
      }
    }
  }

  if (Number.isFinite(minDistance)) {
    return Math.round(minDistance / gridDist) * gridDist;
  }

  // 3. Fallback PF2e 5-10-5 diagonal Chebyshev/alternating grid calculation when canvas/grid is unavailable
  const startColA = Math.round(geomA.x / gridSize);
  const startRowA = Math.round(geomA.y / gridSize);
  const startColB = Math.round(geomB.x / gridSize);
  const startRowB = Math.round(geomB.y / gridSize);
  const dz = Math.round(Math.abs((geomA.elevation - geomB.elevation) / gridDist));

  for (let cxA = 0; cxA < colsA; cxA++) {
    for (let cyA = 0; cyA < rowsA; cyA++) {
      const colA = startColA + cxA;
      const rowA = startRowA + cyA;
      for (let cxB = 0; cxB < colsB; cxB++) {
        for (let cyB = 0; cyB < rowsB; cyB++) {
          const colB = startColB + cxB;
          const rowB = startRowB + cyB;
          const dx = Math.abs(colA - colB);
          const dy = Math.abs(rowA - rowB);

          // PF2e 5-10-5 diagonal rule: every odd diagonal costs 1 square (5 ft), every even diagonal costs 2 squares (10 ft)
          const sorted = [dx, dy, dz].sort((a, b) => b - a);
          const straight = sorted[0] - sorted[1];
          const diag = sorted[1] + sorted[2];
          const totalSquares = straight + diag + Math.floor(diag / 2);
          const dFeet = totalSquares * gridDist;
          if (dFeet < minDistance) minDistance = dFeet;
        }
      }
    }
  }

  return Number.isFinite(minDistance) ? Math.round(minDistance / gridDist) * gridDist : NaN;
}

/**
 * Ensures a live Canvas Token placeable has `.object` self-reference and mobile-safe `isFlanking` / `distanceTo`.
 * Treats PF2e's native canvas methods as authoritative whenever canvas exists, and falls back to manual
 * headless geometry only when canvas is disabled/unavailable.
 * @param {object} placeable
 * @param {object} tokenDoc
 * @returns {object}
 */
function enhanceLivePlaceableForMobile(placeable, tokenDoc) {
  if (!placeable) return placeable;
  syncTokenPosition(tokenDoc ?? placeable);

  if (placeable.object === undefined) {
    try {
      Object.defineProperty(placeable, "object", {
        get() { return this; },
        configurable: true
      });
    } catch {}
  }

  if (!placeable._pf2eMobileFlankPatched) {
    const origDistanceTo = placeable.distanceTo;
    const origIsFlanking = placeable.isFlanking;
    const origCanFlank = placeable.canFlank;
    placeable._origDistanceTo = origDistanceTo;
    placeable._origIsFlanking = origIsFlanking;
    placeable._origCanFlank = origCanFlank;
    placeable.distanceTo = function (otherToken, options = {}) {
      syncTokenPosition(this);
      syncTokenPosition(otherToken);
      return measurePF2eTokenDistance(this, otherToken, options);
    };
    placeable.canFlank = function (flankee, context = {}) {
      syncSceneTokenPositions(this.scene ?? tokenDoc?.parent);
      if (typeof canvas !== "undefined" && canvas?.ready && typeof origCanFlank === "function") {
        try {
          return origCanFlank.call(this, flankee, context);
        } catch {}
      }
      return canTokenFlank(this, flankee, context);
    };
    placeable.isFlanking = function (flankee, context = {}) {
      syncSceneTokenPositions(this.scene ?? tokenDoc?.parent);
      if (typeof canvas !== "undefined" && canvas?.ready && typeof origIsFlanking === "function") {
        try {
          return origIsFlanking.call(this, flankee, context);
        } catch {}
      }
      return computeTokenFlanking(this, flankee, context);
    };
    placeable._pf2eMobileFlankPatched = true;
  }

  return placeable;
}

/**
 * Resolves a token for targeting or origin, supporting both live Canvas Placeables
 * and headless TokenDocuments when canvas rendering is bypassed or paused on mobile.
 * @param {string} tokenId
 * @returns {object|null}
 */
export function getTargetableToken(tokenId) {
  if (!tokenId) return null;

  const canvasObj = typeof canvas !== "undefined" ? canvas : null;
  const scene = canvasObj?.scene ?? game.scenes?.current ?? game.scenes?.viewed ?? game.scenes?.active;
  const tokenDoc = scene?.tokens?.get(tokenId);
  if (tokenDoc) syncTokenPosition(tokenDoc);

  // 1. Live canvas placeable check (if canvas has a real Token placeable, not a headless adapter)
  const tokenObj = getSafeTokenObject(tokenDoc);
  const rawPlaceable = (tokenObj && !tokenObj._isMobileAdapter ? tokenObj : null)
    ?? (canvasObj?.tokens?.placeables ? canvasObj.tokens.placeables.find(t => t.id === tokenId) : null)
    ?? (canvasObj?.tokens?.get?.(tokenId) instanceof (foundry.canvas?.placeables?.Token ?? Object) ? canvasObj.tokens.get(tokenId) : null);

  if (rawPlaceable && typeof rawPlaceable.setTarget === "function" && !rawPlaceable._isMobileAdapter) {
    return enhanceLivePlaceableForMobile(rawPlaceable, tokenDoc);
  }

  // 2. Headless fallback: construct or return dynamic target adapter from Scene TokenDocument
  if (!tokenDoc) return null;

  if (!tokenDoc.document) {
    try {
      Object.defineProperty(tokenDoc, "document", {
        get() { return this; },
        configurable: true
      });
    } catch {}
  }

  // Reuse existing dynamic adapter if already attached
  if (tokenObj?._isMobileAdapter) {
    return tokenObj;
  }

  const gridDistance = scene?.grid?.distance ?? 5;

  const adapter = {
    _isMobileAdapter: true,
    id: tokenDoc.id,
    get name() { return tokenDoc.name; },
    get actor() { return tokenDoc.actor; },
    document: tokenDoc,
    get object() { return this; },
    scene: scene,
    get x() { return getAuthoritativeTokenGeometry(tokenDoc).x; },
    get y() { return getAuthoritativeTokenGeometry(tokenDoc).y; },
    get elevation() { return getAuthoritativeTokenGeometry(tokenDoc).elevation; },
    get center() { return getAuthoritativeTokenGeometry(tokenDoc).center; },
    get bounds() {
      const g = getAuthoritativeTokenGeometry(tokenDoc);
      return {
        x: g.x,
        y: g.y,
        width: g.width,
        height: g.height,
        left: g.left,
        right: g.right,
        top: g.top,
        bottom: g.bottom,
        pad(padding = 0) {
          return {
            x: g.x - padding,
            y: g.y - padding,
            width: g.width + padding * 2,
            height: g.height + padding * 2,
            left: g.left - padding,
            right: g.right + padding,
            top: g.top - padding,
            bottom: g.bottom + padding
          };
        }
      };
    },
    get mechanicalBounds() {
      return this.bounds;
    },
    get isTargeted() {
      return Array.from(game.user.targets).some(t => t.id === this.id);
    },
    distanceTo(otherToken, options = {}) {
      return measurePF2eTokenDistance(this, otherToken, options);
    },
    isAdjacentTo(otherToken) {
      return this.distanceTo(otherToken) <= gridDistance;
    },
    canFlank(flankee, context = {}) {
      return canTokenFlank(this, flankee, context);
    },
    onOppositeSides(flankerA, flankerB, flankee) {
      return areTokensOnOppositeSides(flankerA, flankerB, flankee);
    },
    isFlanking(flankee, context = {}) {
      return computeTokenFlanking(this, flankee, context);
    },
    setTarget(state = true, { user = game.user, releaseOthers = true } = {}) {
      if (user !== game.user) return;
      const isCurrentlyTargeted = Array.from(user.targets).some(t => t.id === this.id);

      if (releaseOthers) {
        for (const t of Array.from(user.targets)) {
          if (t.id !== this.id) {
            // UserTargets.delete() calls the targetToken hook itself
            user.targets.delete(t);
            if (typeof t.setTarget === "function" && t !== this) {
              try { t.setTarget(false, { user, releaseOthers: false }); } catch {}
            }
          }
        }
      }

      if (state === isCurrentlyTargeted) return;

      // UserTargets.add() and delete() call the targetToken hook themselves
      if (state) {
        user.targets.add(this);
      } else {
        for (const t of Array.from(user.targets)) {
          if (t.id === this.id || t === this) {
            user.targets.delete(t);
          }
        }
      }

      const targetIds = Array.from(user.targets).map(t => t.id).filter(Boolean);
      if (typeof user.broadcastActivity === "function") {
        user.broadcastActivity({
          targets: targetIds,
          sceneId: scene?.id ?? null
        }, { volatile: false });
      }
    },

    // PIXI Container compatibility stubs for UI modules in headless mobile mode
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

  if (!getSafeTokenObject(tokenDoc)) {
    try {
      Object.defineProperty(tokenDoc, "object", {
        value: adapter,
        configurable: true,
        writable: true
      });
    } catch {}
  }

  return adapter;
}

/**
 * Gets the active token adapter/placeable for the actor on the current scene.
 * Ensures the attacker's origin token has synchronized coordinates, `.document`, `.object`, and `.isFlanking`.
 * @param {Actor} actor
 * @param {Scene} [sceneOverride=null]
 * @returns {object|null}
 */
export function getOriginToken(actor, sceneOverride = null) {
  const canvasObj = typeof canvas !== "undefined" ? canvas : null;
  const scene = sceneOverride ?? canvasObj?.scene ?? game.scenes?.current ?? game.scenes?.viewed ?? game.scenes?.active;

  if (actor) {
    if (actor.token?.id) {
      return getTargetableToken(actor.token.id) ?? actor.token;
    }
    const tokensList = scene?.tokens?.contents ?? (scene?.tokens ? Array.from(scene.tokens) : []);
    const activeTokenDoc = tokensList.find(t => t.actorId === actor.id)
      ?? tokensList.find(t => t.name === actor.name)
      ?? (typeof actor.getActiveTokens === "function" ? actor.getActiveTokens(false, true)?.shift() : null);

    if (activeTokenDoc?.id) {
      return getTargetableToken(activeTokenDoc.id) ?? activeTokenDoc;
    }

    const activePlaceables = typeof actor.getActiveTokens === "function" ? actor.getActiveTokens(false, false) : [];
    if (activePlaceables?.length) {
      return getTargetableToken(activePlaceables[0].id) ?? activePlaceables[0];
    }
  }
  const controlled = canvasObj?.tokens?.controlled?.[0];
  if (controlled) return enhanceLivePlaceableForMobile(controlled, controlled.document);
  return null;
}

/**
 * Computes the PF2e grid distance between the actor's origin token and a target token.
 * Supports self-targeting (`Self`), live Canvas placeables, and headless TokenDocument adapters.
 * @param {Actor} actor
 * @param {object|string} targetTokenOrId
 * @returns {{ distance: number, label: string, isSelf?: boolean } | null}
 */
export function getTokenDistanceInfo(actor, targetTokenOrId) {
  if (!actor || !targetTokenOrId) return null;

  const targetId = typeof targetTokenOrId === "string" ? targetTokenOrId : targetTokenOrId.id;
  const targetToken = (targetId ? getTargetableToken(targetId) : null) ?? (typeof targetTokenOrId === "object" ? targetTokenOrId : null);
  if (!targetToken) return null;

  const targetScene = targetToken.scene ?? targetToken.document?.parent ?? null;
  const originToken = getOriginToken(actor, targetScene);

  const targetActorId = targetToken.actor?.id ?? targetToken.document?.actorId;
  if ((originToken && originToken.id === targetToken.id) || (targetActorId && targetActorId === actor.id)) {
    return {
      distance: 0,
      label: "Self",
      isSelf: true
    };
  }

  if (!originToken) return null;

  const dist = measurePF2eTokenDistance(originToken, targetToken);
  if (typeof dist !== "number" || !Number.isFinite(dist)) return null;

  const rounded = Number.isInteger(dist) ? dist : Math.round(dist * 10) / 10;
  return {
    distance: rounded,
    label: String(rounded),
    isSelf: false
  };
}

/**
 * Synchronizes multiple user token targets simultaneously across canvas placeables,
 * headless token docs, and broadcasts targeting reticules to all connected desktop/TV clients.
 * @param {Array<string>|string|null} tokenIds
 */
export async function setTargetTokens(tokenIds) {
  const canvasObj = typeof canvas !== "undefined" ? canvas : null;
  const scene = canvasObj?.scene ?? game.scenes?.viewed ?? game.scenes?.active;
  syncSceneTokenPositions(scene);

  const rawList = Array.isArray(tokenIds) ? tokenIds : (tokenIds ? [tokenIds] : []);
  const validIds = Array.from(new Set(rawList.map(id => String(id || "").trim()).filter(Boolean)));
  const idSet = new Set(validIds);

  // 1. Release any existing targets not in the new set
  for (const t of Array.from(game.user?.targets ?? [])) {
    if (!idSet.has(t.id)) {
      if (typeof t.setTarget === "function") {
        try { t.setTarget(false, { user: game.user, releaseOthers: false, groupSelection: true }); } catch {}
      } else {
        // UserTargets.delete() calls the targetToken hook itself
        game.user.targets.delete(t);
      }
    }
  }

  if (validIds.length === 0) {
    game.user?.targets?.clear?.();
  } else {
    // 2. Add each selected target without releasing the previously added ones in the group
    for (const id of validIds) {
      const token = getTargetableToken(id);
      if (!token) continue;
      if (typeof token.setTarget === "function") {
        try {
          token.setTarget(true, { user: game.user, releaseOthers: false, groupSelection: true });
        } catch {}
      }
      if (!Array.from(game.user.targets).some(t => t.id === id)) {
        // UserTargets.add() calls the targetToken hook itself
        game.user.targets.add(token);
      }
    }
  }

  // 3. Broadcast full target array over socket to TV and GM clients
  const activeTargetIds = Array.from(game.user?.targets ?? []).map(t => t.id).filter(Boolean);
  if (typeof game.user?.broadcastActivity === "function") {
    game.user.broadcastActivity({
      targets: activeTargetIds,
      sceneId: scene?.id ?? null
    }, { volatile: false });
  }
}

/**
 * Synchronizes a single user token target (or array of targets if passed).
 * @param {string|Array<string>} tokenId
 */
export async function setTargetToken(tokenId) {
  return setTargetTokens(tokenId);
}

/**
 * Ensures the actor's token is controlled on canvas if possible.
 * @param {Actor} actor
 */
export function ensureTokenControlled(actor) {
  if (!actor) return;
  const canvasObj = typeof canvas !== "undefined" ? canvas : null;
  const scene = canvasObj?.scene ?? game.scenes?.viewed ?? game.scenes?.active;
  if (!scene) return;
  syncSceneTokenPositions(scene);

  if (canvasObj?.tokens?.placeables) {
    const activePlaceables = typeof actor.getActiveTokens === "function" ? actor.getActiveTokens(true, false) : [];
    const token = activePlaceables?.[0]
      ?? canvasObj.tokens.placeables.find(t => (t.document?.actorId ?? t.actor?.id) === actor.id);

    if (token && typeof token.control === "function") {
      try {
        token.control({ releaseOthers: true });
      } catch {}
    } else if (canvasObj.tokens.controlled?.length > 0) {
      try {
        canvasObj.tokens.releaseAll();
      } catch {}
    }
  }
}
