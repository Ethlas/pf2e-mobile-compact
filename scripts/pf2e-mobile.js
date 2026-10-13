/**
 * Entry point for pf2e-mobile-compact module.
 */
import { PF2eMobileSheet } from "./apps/mobile-sheet.js";
import { isMobileDevice, isIOSDevice, getStoredRollMode, ensureSafeCanvasTokens } from "./utils/sheet-utils.js";
import { migrateActorPropertyRunes } from "./apps/sheet-helpers/rune-handlers.js";
import { ensureMobileViewButton } from "./utils/view-mode.js";
import { getTargetableToken } from "./tokens/token-adapter.js";

export { isMobileDevice, isIOSDevice };

/**
 * Evaluates whether mobile mode should activate for the current client session,
 * respecting the user's client-side module settings.
 * @returns {boolean}
 */
export function shouldActivateMobile() {
  try {
    const mode = game.settings.get("pf2e-mobile-compact", "mobileActivationMode");
    if (mode === "always") return true;
    if (mode === "never") return false;
    return isMobileDevice();
  } catch {
    // Before settings are ready, fallback to device detection
    return isMobileDevice();
  }
}

/**
 * Injects or updates the viewport meta tag with `viewport-fit=cover` (for iPhone Notch / Dynamic Island
 * and Home Indicator safe-area insets) and injects Apple standalone Web App (PWA) meta tags.
 */
export function injectMobileViewportMeta() {
  if (typeof document === "undefined" || !document.head) return;
  try {
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement("meta");
      viewportMeta.name = "viewport";
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
    );

    const pwaMetaTags = [
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "PF2e Mobile" }
    ];
    for (const tagDef of pwaMetaTags) {
      if (!document.querySelector(`meta[name="${tagDef.name}"]`)) {
        const meta = document.createElement("meta");
        meta.name = tagDef.name;
        meta.content = tagDef.content;
        document.head.appendChild(meta);
      }
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | Failed to inject mobile viewport meta tags:", err);
  }
}

/**
 * Holds active Screen WakeLock sentinel to prevent mobile sleep during sessions.
 */
let wakeLockSentinel = null;

/**
 * Requests a screen wake lock via the Screen Wake Lock API.
 */
export async function acquireWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    if (wakeLockSentinel && !wakeLockSentinel.released) return;
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    console.log("PF2e Mobile Compact | Screen WakeLock acquired.");
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
      console.log("PF2e Mobile Compact | Screen WakeLock released.");
    });
  } catch (err) {
    console.warn("PF2e Mobile Compact | WakeLock request error:", err);
  }
}

/**
 * Releases the active Screen WakeLock sentinel.
 */
export async function releaseWakeLock() {
  if (wakeLockSentinel && !wakeLockSentinel.released) {
    try {
      await wakeLockSentinel.release();
    } catch (err) {
      console.warn("PF2e Mobile Compact | WakeLock release warning:", err);
    }
    wakeLockSentinel = null;
  }
}

/**
 * Initializes keep-alive management to prevent mobile phone lockouts and disconnects.
 */
export function setupKeepAlive() {
  // Request wake lock initially
  acquireWakeLock();

  // Listen for visibility changes (e.g. phone lock/unlock, tab switching)
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible") {
      console.log("PF2e Mobile Compact | App resumed. Re-verifying wake lock and session...");
      await acquireWakeLock();

      // Check socket state and reconnect if dropped while device was locked
      if (game.socket && !game.socket.connected) {
        console.log("PF2e Mobile Compact | Socket disconnected during sleep. Reconnecting...");
        try {
          game.socket.connect();
        } catch (err) {
          console.warn("PF2e Mobile Compact | Socket reconnect failed:", err);
        }
      }
    }
  });
}

/**
 * Returns whether the user has opted to disable the WebGL canvas on mobile.
 * Defaults to false (Canvas Enabled) and persists across mobile sessions via
 * localStorage and Foundry client settings.
 * @returns {boolean}
 */
export function isMobileCanvasDisabled() {
  try {
    const stored = localStorage.getItem("pf2e-mobile-compact.disableCanvas");
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {}
  try {
    if (game?.settings?.settings?.has?.("pf2e-mobile-compact.disableCanvas")) {
      return Boolean(game.settings.get("pf2e-mobile-compact", "disableCanvas"));
    }
  } catch {}
  return false;
}

/**
 * Updates and persists the user's mobile canvas disable preference across sessions.
 * @param {boolean} disabled
 * @returns {Promise<boolean>}
 */
export async function setMobileCanvasDisabled(disabled) {
  const nextState = Boolean(disabled);
  try {
    localStorage.setItem("pf2e-mobile-compact.disableCanvas", nextState ? "true" : "false");
  } catch {}
  try {
    if (game?.settings?.settings?.has?.("pf2e-mobile-compact.disableCanvas")) {
      await game.settings.set("pf2e-mobile-compact", "disableCanvas", nextState);
    }
  } catch {}
  optimizeCanvasForMobile();
  return nextState;
}

/**
 * Optimizes PixiJS canvas WebGL resolution and framerate on mobile (1x resolution, 15 FPS).
 * By default, keeps the canvas stage and ticker active so token animations, geometry, and flanking
 * update natively. If the user enables the `disableCanvas` setting, suspends the ticker and stage rendering.
 */
export function optimizeCanvasForMobile() {
  ensureSafeCanvasTokens();
  const disableCanvas = isMobileCanvasDisabled();
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.toggle("pf2e-canvas-disabled", disableCanvas);
  }

  try {
    if (typeof PIXI !== "undefined") {
      if (PIXI.settings) PIXI.settings.RESOLUTION = 1;
      if (PIXI.Ticker?.shared) PIXI.Ticker.shared.maxFPS = 15;
      if (PIXI.Ticker?.system) PIXI.Ticker.system.maxFPS = 15;
    }
  } catch {}

  if (!canvas?.app) return;
  try {
    if (canvas.app.renderer) {
      canvas.app.renderer.resolution = 1;
    }
    if (canvas.app.stage) {
      canvas.app.stage.renderable = false;
      canvas.app.stage.interactiveChildren = false;
    }
    if (canvas.weather?.clear) {
      canvas.weather.clear();
    }
    if (canvas.app.ticker) {
      canvas.app.ticker.maxFPS = 15;
      canvas.app.ticker.stop();
    }
    console.log(`PF2e Mobile Compact | Canvas WebGL ticker paused & stage rendering suspended for mobile GPU memory protection (disableCanvas=${disableCanvas}).`);
  } catch (err) {
    console.warn("PF2e Mobile Compact | optimizeCanvasForMobile warning:", err);
  }
}

/**
 * Resumes PixiJS canvas rendering if mobile mode is deactivated on a desktop client.
 */
export function resumeCanvasFromMobile() {
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.remove("pf2e-canvas-disabled");
  }
  try {
    if (typeof PIXI !== "undefined") {
      if (PIXI.Ticker?.shared) PIXI.Ticker.shared.maxFPS = 60;
      if (PIXI.Ticker?.system) PIXI.Ticker.system.maxFPS = 60;
    }
  } catch {}

  if (!canvas?.app) return;
  try {
    if (canvas.app.stage) {
      canvas.app.stage.renderable = true;
      canvas.app.stage.interactiveChildren = true;
    }
    if (canvas.app.ticker) {
      canvas.app.ticker.maxFPS = 60;
      if (!canvas.app.ticker.started) {
        canvas.app.ticker.start();
      }
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | resumeCanvasFromMobile warning:", err);
  }
}

/**
 * Detects whether a notification or dialog message pertains to Foundry's
 * low resolution or minimum window dimensions warnings.
 * @param {string|object} msg
 * @param {object} [options={}]
 * @returns {boolean}
 */
export function isResolutionMessage(msg, options = {}) {
  if (options?.format?.reqWidth || options?.format?.reqHeight) return true;
  if (!msg) return false;
  const text = typeof msg === "string" ? msg : (msg.message || msg.toString?.() || "");
  const lower = text.toLowerCase();

  return (
    lower.includes("error.resolution") ||
    lower.includes("resolution.screen") ||
    lower.includes("resolution.scale") ||
    lower.includes("resolution.window") ||
    lower.includes("requires a screen resolution") ||
    lower.includes("requires usable window dimensions") ||
    lower.includes("requires a usable window dimensions") ||
    lower.includes("resolution of your browser")
  );
}

/**
 * Sweeps any low-resolution warning notification elements out of the DOM and queues.
 */
export function sweepResolutionNotifications() {
  if (!shouldActivateMobile()) return;
  try {
    const elements = document.querySelectorAll("#notifications .notification, .ui-notifications .notification");
    for (const el of elements) {
      if (isResolutionMessage(el.textContent)) {
        el.remove();
      }
    }

    if (ui?.notifications) {
      const active = ui.notifications.active ?? {};
      for (const [id, notif] of Object.entries(active)) {
        if (isResolutionMessage(notif.message)) {
          ui.notifications.remove(id);
        }
      }
      if (Array.isArray(ui.notifications.queue)) {
        ui.notifications.queue = ui.notifications.queue.filter(n => !isResolutionMessage(n.message));
      }
    }
  } catch {}
}

/**
 * Suppresses Foundry's low resolution / minimum window dimensions warnings
 * on mobile via ClientIssues and notification error filtering.
 */
export function suppressResolutionWarnings() {
  if (!shouldActivateMobile()) return;

  // 1. Monkey-patch game.issues (ClientIssues in Foundry v14+)
  if (game?.issues) {
    const issues = game.issues;
    const proto = issues.constructor?.prototype;
    if (proto && !proto._mobileResolutionPatched) {
      const origProtoDetect = proto._detectUsabilityIssues;
      if (typeof origProtoDetect === "function") {
        proto._detectUsabilityIssues = function () {
          if (shouldActivateMobile()) {
            if (this.usabilityIssues?.resolutionTooLow) {
              delete this.usabilityIssues.resolutionTooLow;
            }
            return;
          }
          return origProtoDetect.call(this);
        };
      }
      proto._mobileResolutionPatched = true;
    }
    if (issues.usabilityIssues?.resolutionTooLow) {
      delete issues.usabilityIssues.resolutionTooLow;
    }
  }

  // 2. Filter resolution errors on Notifications prototype
  const NotificationsClass = foundry?.applications?.ui?.Notifications ?? (typeof Notifications !== "undefined" ? Notifications : null);
  if (NotificationsClass?.prototype && !NotificationsClass.prototype._mobileResolutionPatched) {
    const origError = NotificationsClass.prototype.error;
    if (typeof origError === "function") {
      NotificationsClass.prototype.error = function (message, options = {}) {
        if (shouldActivateMobile() && isResolutionMessage(message, options)) {
          return null;
        }
        return origError.call(this, message, options);
      };
    }
    NotificationsClass.prototype._mobileResolutionPatched = true;
  }

  // 3. Filter resolution errors on active ui.notifications instance
  if (ui?.notifications && !ui.notifications._mobileResolutionPatched) {
    const origInstError = ui.notifications.error;
    if (typeof origInstError === "function") {
      ui.notifications.error = function (message, options = {}) {
        if (shouldActivateMobile() && isResolutionMessage(message, options)) {
          return null;
        }
        return origInstError.call(this, message, options);
      };
    }
    ui.notifications._mobileResolutionPatched = true;
  }

  sweepResolutionNotifications();
}

/**
 * Prevents mobile browsers (e.g. Firefox Mobile / Safari) from failing with
 * "Invalid URI. Load of media resource failed" when audio/media elements or AudioHelper
 * receive an empty or whitespace-only source URI.
 * Defensively wrapped in try/catch for strict iOS WebKit property descriptors.
 */
export function patchMediaElements() {
  try {
    if (typeof HTMLMediaElement !== "undefined" && HTMLMediaElement.prototype && !HTMLMediaElement.prototype._pf2eMobilePatched) {
      const proto = HTMLMediaElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, "src");
      if (descriptor && descriptor.set && descriptor.configurable !== false) {
        const origSet = descriptor.set;
        Object.defineProperty(proto, "src", {
          set(val) {
            if (val === "" || val === null || val === undefined || (typeof val === "string" && !val.trim())) {
              return;
            }
            return origSet.call(this, val);
          },
          get: descriptor.get,
          configurable: true,
          enumerable: true
        });
      }

      const origSetAttr = proto.setAttribute;
      if (typeof origSetAttr === "function") {
        proto.setAttribute = function (name, val) {
          if (name === "src" && (val === "" || val === null || val === undefined || (typeof val === "string" && !val.trim()))) {
            return;
          }
          return origSetAttr.call(this, name, val);
        };
      }

      HTMLMediaElement.prototype._pf2eMobilePatched = true;
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | HTMLMediaElement patch skipped:", err);
  }

  // Guard window.Audio constructor against empty string URLs
  try {
    if (typeof window !== "undefined" && window.Audio && !window.Audio._pf2eMobilePatched) {
      const OrigAudio = window.Audio;
      window.Audio = function (src) {
        if (src === "" || src === null || src === undefined || (typeof src === "string" && !src.trim())) {
          return new OrigAudio();
        }
        return new OrigAudio(src);
      };
      window.Audio.prototype = OrigAudio.prototype;
      window.Audio._pf2eMobilePatched = true;
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | window.Audio patch skipped:", err);
  }

  // Guard Foundry's AudioHelper.play against empty audio sources
  try {
    const AudioHelperClass = foundry.audio?.AudioHelper ?? (typeof AudioHelper !== "undefined" ? AudioHelper : null);
    if (AudioHelperClass && !AudioHelperClass._pf2eMobilePatched) {
      const origPlay = AudioHelperClass.play;
      if (typeof origPlay === "function") {
        AudioHelperClass.play = function (options, ...args) {
          if (!options || !options.src || typeof options.src !== "string" || !options.src.trim()) {
            return null;
          }
          return origPlay.call(this, options, ...args);
        };
      }
      AudioHelperClass._pf2eMobilePatched = true;
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | AudioHelper patch skipped:", err);
  }
}

/**
 * Monkey-patches User.prototype.getActiveTokens to ensure that when a player operates
 * via the mobile compact sheet, their active character's token is automatically returned
 * as the damage recipient if no token is explicitly controlled on the canvas.
 */
export function patchUserActiveTokens() {
  const UserClass = CONFIG.User?.documentClass ?? (typeof User !== "undefined" ? User : null);
  if (UserClass?.prototype && !UserClass.prototype._pf2eMobileActiveTokensPatched) {
    const origGetActiveTokens = UserClass.prototype.getActiveTokens;
    UserClass.prototype.getActiveTokens = function (...args) {
      // 1. If this user is operating an active mobile sheet, prioritize strictly that character's token
      if (this.id === game.user?.id) {
        try {
          const mobileSheet = (typeof foundry !== "undefined" && foundry.applications?.instances?.values
              ? Array.from(foundry.applications.instances.values()).find(a => a instanceof PF2eMobileSheet && a.rendered)
              : null)
            ?? Object.values(ui.windows ?? {}).find(w => w instanceof PF2eMobileSheet && w.rendered);

          const actor = mobileSheet?.actor;
          if (actor) {
            const activeTokens = typeof actor.getActiveTokens === "function" ? actor.getActiveTokens(true, true) : [];
            if (activeTokens?.length) return [activeTokens[0]];

            const scene = canvas?.scene ?? game.scenes?.viewed ?? game.scenes?.active;
            const tokenDoc = scene?.tokens?.find(t => t.actorId === actor.id);
            if (tokenDoc) return [tokenDoc];

            const fallback = typeof actor.getActiveTokens === "function" ? actor.getActiveTokens(false, true)[0] : null;
            if (fallback) return [fallback];
          }
        } catch (err) {
          console.warn("PF2e Mobile Compact | Error resolving fallback active token:", err);
        }
      }

      // 2. Fallback to native PF2e / Foundry getActiveTokens
      return origGetActiveTokens.apply(this, args);
    };
    UserClass.prototype._pf2eMobileActiveTokensPatched = true;
  }

  const ActorClass = CONFIG.Actor?.documentClass ?? (typeof Actor !== "undefined" ? Actor : null);
  if (ActorClass?.prototype && !ActorClass.prototype._pf2eMobileActiveTokensPatched) {
    const origActorGetActiveTokens = ActorClass.prototype.getActiveTokens;
    ActorClass.prototype.getActiveTokens = function (linked = false, document = false) {
      if (this._pf2eMobileResolvingActiveTokens) {
        return [];
      }
      this._pf2eMobileResolvingActiveTokens = true;
      try {
        const res = typeof origActorGetActiveTokens === "function"
          ? origActorGetActiveTokens.call(this, linked, document)
          : [];
        if (Array.isArray(res) && res.length > 0) {
          return res;
        }

        // Headless fallback when Canvas is disabled (!canvas.ready): resolve from active Scene and attach mobile adapter
        if (typeof canvas === "undefined" || !canvas?.ready) {
          // 1. Synthetic actor: its only token is this.token
          if (this.isToken) {
            const tokenDoc = this.token ?? (this.parent instanceof (foundry.documents?.BaseActorDelta ?? Object) ? this.parent.parent : null);
            if (!tokenDoc) return [];
            if (linked && !tokenDoc.actorLink) return [];
            if (document) return [tokenDoc];
            const adapter = getTargetableToken(tokenDoc.id) ?? tokenDoc;
            return adapter ? [adapter] : [tokenDoc];
          }

          // 2. World actor: resolve tokens from active scene matching this.id
          const scene = game.scenes?.current ?? game.scenes?.viewed ?? game.scenes?.active;
          const tokensList = scene?.tokens?.contents ?? (scene?.tokens ? Array.from(scene.tokens) : []);
          let matchingDocs = tokensList.filter(t => {
            if (linked && !t.actorLink) return false;
            return t.actorId === this.id;
          });
          if (matchingDocs.length === 0 && linked) {
            matchingDocs = tokensList.filter(t => t.actorId === this.id);
          }
          if (matchingDocs.length > 0) {
            if (document) return matchingDocs;
            const adapters = matchingDocs.map(tDoc => getTargetableToken(tDoc.id) ?? tDoc).filter(Boolean);
            return adapters.length > 0 ? adapters : matchingDocs;
          }
        }
        return res;
      } catch (err) {
        console.warn("PF2e Mobile Compact | Error resolving headless Actor.getActiveTokens:", err);
        return [];
      } finally {
        this._pf2eMobileResolvingActiveTokens = false;
      }
    };
    ActorClass.prototype._pf2eMobileActiveTokensPatched = true;
  }

  const TokenDocumentClass = CONFIG.Token?.documentClass ?? (typeof TokenDocument !== "undefined" ? TokenDocument : null);
  if (TokenDocumentClass?.prototype && !TokenDocumentClass.prototype._pf2eMobileObjectSafePatched) {
    const origObjectDescriptor = Object.getOwnPropertyDescriptor(TokenDocumentClass.prototype, "object");
    if (origObjectDescriptor?.get) {
      const origGet = origObjectDescriptor.get;
      Object.defineProperty(TokenDocumentClass.prototype, "object", {
        get() {
          try {
            return origGet.call(this);
          } catch {
            return this._object ?? null;
          }
        },
        configurable: true,
        enumerable: true
      });
      TokenDocumentClass.prototype._pf2eMobileObjectSafePatched = true;
    }
  }
}

/**
 * Ensures the module stylesheet <link> element exists in document.head.
 * @returns {HTMLLinkElement}
 */
export function ensureStylesheetElement() {
  let link = document.querySelector('link[href*="pf2e-mobile.css"]');
  const moduleVersion = game.modules?.get("pf2e-mobile-compact")?.version ?? Date.now();
  if (!link) {
    link = document.createElement("link");
    link.id = "pf2e-mobile-compact-style";
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = `/modules/pf2e-mobile-compact/styles/pf2e-mobile.css?v=${moduleVersion}`;
    link.disabled = true;
    document.head.appendChild(link);
  }
  let kmLink = document.querySelector('link[href*="kingdom.css"]');
  if (!kmLink) {
    kmLink = document.createElement("link");
    kmLink.id = "pf2e-mobile-compact-kingdom-style";
    kmLink.rel = "stylesheet";
    kmLink.type = "text/css";
    kmLink.href = `/modules/pf2e-mobile-compact/styles/kingdom.css?v=${moduleVersion}`;
    kmLink.disabled = true;
    document.head.appendChild(kmLink);
  }
  return link;
}

/**
 * Synchronizes module stylesheet disabled state.
 * On desktop sessions, the mobile stylesheet is completely disabled unless
 * an instance of PF2eMobileSheet is actively rendered.
 */
export function syncStylesheetState(activeSheet = null) {
  const link = ensureStylesheetElement();
  const isMobile = shouldActivateMobile();
  const hasRenderedMobileSheet = Boolean(document.querySelector(".pf2e-mobile-sheet"))
    || Boolean(activeSheet?.rendered && activeSheet?.element?.isConnected)
    || (typeof foundry !== "undefined" && foundry.applications?.instances?.values
      ? Array.from(foundry.applications.instances.values()).some(a => a instanceof PF2eMobileSheet && a.rendered && a.element?.isConnected)
      : false);
  const shouldEnable = isMobile || hasRenderedMobileSheet;

  link.disabled = !shouldEnable;
  document.querySelectorAll('link[href*="pf2e-mobile.css"], link[href*="kingdom.css"]').forEach(l => {
    l.disabled = !shouldEnable;
  });
}

Hooks.once("init", async () => {
  console.log("PF2e Mobile Compact | Initializing module");

  // Client Setting: Mobile Activation Mode (Registered first so shouldActivateMobile() reads it accurately during init)
  game.settings.register("pf2e-mobile-compact", "mobileActivationMode", {
    name: "Mobile Activation Mode",
    hint: "Controls when mobile UI overrides, canvas suppression, and the mobile compact sheet are activated. On a phone, the cog menu in the mobile sheet switches to the desktop view, and a floating button switches back.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "auto": "Auto-Detect (Mobile App / Browser Only)",
      "always": "Always (Force Mobile View on Desktop)",
      "never": "Never (Desktop View Only)"
    },
    default: "auto",
    onChange: () => window.location.reload()
  });

  // Client Setting: Auto-Open Character Sheet
  game.settings.register("pf2e-mobile-compact", "autoOpenSheet", {
    name: "Auto-Open Sheet on Mobile",
    hint: "Automatically launch the assigned character sheet when connecting from a mobile browser or app.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  // Client Setting: Disable Canvas on Mobile (Persistent Battery Saver option, defaults to false so canvas stays enabled)
  let initialDisableCanvas = false;
  try {
    initialDisableCanvas = localStorage.getItem("pf2e-mobile-compact.disableCanvas") === "true";
  } catch {}
  game.settings.register("pf2e-mobile-compact", "disableCanvas", {
    name: "Disable Canvas on Mobile (Battery Saver)",
    hint: "When enabled, tells Foundry to skip initializing the WebGL canvas stage on mobile devices (CONFIG.Canvas.disabled = true) to save battery and memory. Leave unchecked to keep the canvas active.",
    scope: "client",
    config: true,
    type: Boolean,
    default: initialDisableCanvas,
    onChange: (val) => {
      try {
        localStorage.setItem("pf2e-mobile-compact.disableCanvas", val ? "true" : "false");
      } catch {}
      if (shouldActivateMobile()) {
        window.location.reload();
      }
    }
  });
  game.settings.register("pf2e-mobile-compact", "rollMode", {
    name: "Default Roll Mode",
    hint: "Controls whether rolls default to digital dice or manual physical table dice entry.",
    scope: "client",
    config: false,
    type: String,
    choices: {
      "digital": "Digital",
      "physical": "Physical"
    },
    default: "digital"
  });

  // Ensure stylesheet element exists and is strictly dormant on desktop sessions
  syncStylesheetState();

  const isMobile = shouldActivateMobile();
  if (isMobile) {
    const disableCanvas = isMobileCanvasDisabled();
    try {
      if (typeof CONFIG !== "undefined" && CONFIG.Canvas) {
        CONFIG.Canvas.disabled = disableCanvas;
      }
    } catch {}
    document.body?.classList.add("pf2e-mobile-active");
    injectMobileViewportMeta();
    optimizeCanvasForMobile();
    suppressResolutionWarnings();
    patchMediaElements();
    ensureSafeCanvasTokens();
    patchUserActiveTokens();
  } else {
    // Desktop environment: ensure canvas is NEVER disabled by mobile preferences or previous mobile sessions!
    try {
      localStorage.removeItem("core.noCanvas");
      if (game.settings?.settings?.has?.("core.noCanvas") && game.settings.get("core", "noCanvas")) {
        await game.settings.set("core", "noCanvas", false);
      }
      if (typeof CONFIG !== "undefined" && CONFIG.Canvas) {
        CONFIG.Canvas.disabled = false;
      }
    } catch {}
    if (typeof document !== "undefined" && document.body) {
      document.body.classList.remove("pf2e-canvas-disabled");
      document.body.classList.remove("pf2e-mobile-active");
    }
  }

  // Register the custom mobile character and party sheet with Actors collection (namespaced in v13+)
  const ActorsCollection = foundry.documents?.collections?.Actors ?? (typeof Actors !== "undefined" ? Actors : null);
  if (ActorsCollection) {
    ActorsCollection.registerSheet("pf2e", PF2eMobileSheet, {
      types: ["character", "party"],
      makeDefault: false,
      label: "PF2e Mobile Compact Sheet"
    });
  }

  // Dynamically route character and party sheets to PF2eMobileSheet whenever shouldActivateMobile() is true
  const ActorClass = getDocumentClass?.("Actor") ?? CONFIG.Actor?.documentClass ?? (typeof Actor !== "undefined" ? Actor : null);
  if (ActorClass && !ActorClass.prototype._pf2eMobileSheetRouted) {
    const originalGetSheetClass = ActorClass.prototype._getSheetClass;
    ActorClass.prototype._getSheetClass = function () {
      if (shouldActivateMobile() && (this.type === "character" || this.type === "party")) {
        return PF2eMobileSheet;
      }
      return originalGetSheetClass.call(this);
    };

    // Override actor.sheet getter directly so accessing .sheet on mobile is guaranteed to return PF2eMobileSheet
    let sheetDescriptor = null;
    let proto = ActorClass.prototype;
    while (proto && proto !== Object.prototype) {
      sheetDescriptor = Object.getOwnPropertyDescriptor(proto, "sheet");
      if (sheetDescriptor?.get) break;
      proto = Object.getPrototypeOf(proto);
    }
    if (sheetDescriptor?.get) {
      const origSheetGetter = sheetDescriptor.get;
      Object.defineProperty(ActorClass.prototype, "sheet", {
        get() {
          if (shouldActivateMobile() && (this.type === "character" || this.type === "party")) {
            const hasPerm = game.user?.isGM
              || this.isOwner
              || this.testUserPermission(game.user, "LIMITED")
              || (this.type === "party" && (this.canUserModify?.(game.user, "update") || this.members?.some(m => m.isOwner)));
            if (!hasPerm) {
              return origSheetGetter.call(this);
            }
            if (!this._mobileSheetInstance || !(this._mobileSheetInstance instanceof PF2eMobileSheet) || this._mobileSheetInstance.document !== this) {
              this._mobileSheetInstance = new PF2eMobileSheet({ document: this });
            }
            return this._mobileSheetInstance;
          }
          return origSheetGetter.call(this);
        },
        configurable: true,
        enumerable: true
      });
    }
    ActorClass.prototype._pf2eMobileSheetRouted = true;
  }

  // Ensure essential Handlebars comparison and logical helpers are available
  if (!Handlebars.helpers.eq) {
    Handlebars.registerHelper("eq", (a, b) => a === b);
  }
  if (!Handlebars.helpers.gte) {
    Handlebars.registerHelper("gte", (a, b) => a >= b);
  }
  if (!Handlebars.helpers.gt) {
    Handlebars.registerHelper("gt", (a, b) => a > b);
  }
  if (!Handlebars.helpers.not) {
    Handlebars.registerHelper("not", (a) => !a);
  }
  if (!Handlebars.helpers.and) {
    Handlebars.registerHelper("and", (...args) => args.slice(0, -1).every(Boolean));
  }
  if (!Handlebars.helpers.or) {
    Handlebars.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));
  }

  // Preload Handlebars template parts
  const loadTemplatesFn = foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
  await loadTemplatesFn([
    "modules/pf2e-mobile-compact/templates/mobile-sheet.hbs",
    "modules/pf2e-mobile-compact/templates/compendium-picker.hbs",
    "modules/pf2e-mobile-compact/templates/parts/header.hbs",
    "modules/pf2e-mobile-compact/templates/parts/spells.hbs",
    "modules/pf2e-mobile-compact/templates/parts/spells/spell-card.hbs",
    "modules/pf2e-mobile-compact/templates/parts/spells/cast-button.hbs",
    "modules/pf2e-mobile-compact/templates/parts/spells/staff-cast-buttons.hbs",
    "modules/pf2e-mobile-compact/templates/parts/spells/staff-line-cast-button.hbs",
    "modules/pf2e-mobile-compact/templates/parts/spell-picker-dialog.hbs",
    "modules/pf2e-mobile-compact/templates/parts/actions.hbs",
    "modules/pf2e-mobile-compact/templates/parts/actions/action-card.hbs",
    "modules/pf2e-mobile-compact/templates/parts/skills.hbs",
    "modules/pf2e-mobile-compact/templates/parts/character.hbs",
    "modules/pf2e-mobile-compact/templates/parts/toggles.hbs",
    "modules/pf2e-mobile-compact/templates/parts/inventory.hbs",
    "modules/pf2e-mobile-compact/templates/parts/inventory/item-card.hbs",
    "modules/pf2e-mobile-compact/templates/parts/inventory/carry-badge.hbs",
    "modules/pf2e-mobile-compact/templates/parts/carry-type-dialog.hbs",
    "modules/pf2e-mobile-compact/templates/parts/currency-dialog.hbs",
    "modules/pf2e-mobile-compact/templates/parts/party-overview.hbs",
    "modules/pf2e-mobile-compact/templates/parts/party-stash.hbs",
    "modules/pf2e-mobile-compact/templates/parts/chat.hbs",
    "modules/pf2e-mobile-compact/templates/kingdom/kingdom-turn.hbs",
    "modules/pf2e-mobile-compact/templates/kingdom/kingdom-sheet-tab.hbs",
    "modules/pf2e-mobile-compact/templates/kingdom/kingdom-settlements.hbs",
    "modules/pf2e-mobile-compact/templates/kingdom/kingdom-trade.hbs",
    "modules/pf2e-mobile-compact/templates/kingdom/kingdom-notes.hbs"
  ]);
});

let mobileEnvActivated = false;

/**
 * Fully activates mobile engine overrides (canvas WebGL ticker pausing, viewport safe-area meta,
 * wake lock, notification suppression, active token fallback, physical dice interceptor).
 */
export function activateMobileEnvironment() {
  document.body?.classList.add("pf2e-mobile-active");
  injectMobileViewportMeta();
  optimizeCanvasForMobile();
  if (mobileEnvActivated) return;
  mobileEnvActivated = true;
  console.log("PF2e Mobile Compact | Mobile environment confirmed. Activating mobile engine.");
  setupKeepAlive();
  suppressResolutionWarnings();
  patchMediaElements();
  sweepResolutionNotifications();
  ensureSafeCanvasTokens();
  patchUserActiveTokens();
}

/**
 * Deactivates mobile engine overrides and restores desktop Foundry environment
 * (restores canvas ticker, re-enables UI containers, removes mobile body class).
 */
export function deactivateMobileEnvironment() {
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.remove("pf2e-mobile-active");
  }
  mobileEnvActivated = false;
  releaseWakeLock();
  resumeCanvasFromMobile();
  syncStylesheetState();
  updateFabVisibility();
  console.log("PF2e Mobile Compact | Desktop environment restored.");
}

/**
 * Ensures the floating action button (FAB) exists in the DOM for mobile users.
 * @returns {HTMLButtonElement|null}
 */
export function ensureMobileFab() {
  if (!shouldActivateMobile()) {
    const existing = document.getElementById("pf2e-mobile-fab");
    if (existing) existing.remove();
    return null;
  }
  if (typeof document === "undefined" || typeof document.getElementById !== "function") return null;
  let fab = document.getElementById("pf2e-mobile-fab");
  if (!fab) {
    fab = document.createElement("button");
    fab.id = "pf2e-mobile-fab";
    fab.type = "button";
    fab.title = "Open Mobile Sheet";
    fab.innerHTML = '<i class="fas fa-user-shield"></i>';
    fab.style.cssText = "position:fixed;bottom:calc(20px + env(safe-area-inset-bottom, 0px));right:calc(20px + env(safe-area-inset-right, 0px));z-index:9999;width:52px;height:52px;border-radius:50%;background:#e65100;color:#fff;border:2px solid #ffb74d;box-shadow:0 4px 12px rgba(0,0,0,0.6);font-size:22px;display:none;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;";
    fab.addEventListener("click", () => {
      const uChar = game.user?.character;
      const isUCharValid = uChar && (uChar.isOwner || uChar.testUserPermission(game.user, "LIMITED"));

      const char = (isUCharValid ? uChar : null)
        ?? game.actors?.find?.(a => a.type === "character" && a.isOwner)
        ?? game.actors?.find?.(a => a.type === "character" && a.testUserPermission(game.user, "LIMITED"))
        ?? (game.user?.isGM ? game.actors?.find?.(a => a.type === "character") : null);
      if (char) {
        if (!char._mobileSheetInstance || !(char._mobileSheetInstance instanceof PF2eMobileSheet)) {
          char._mobileSheetInstance = new PF2eMobileSheet({ document: char });
        }
        char._mobileSheetInstance.render({ force: true });
      } else {
        ui.notifications?.warn?.("PF2e Mobile: No character actor found for this user.");
      }
    });
    document.body.appendChild(fab);
  }
  updateFabVisibility();
  return fab;
}

/**
 * Updates floating action button (FAB) visibility based on active sheet state.
 */
export function updateFabVisibility() {
  if (typeof document === "undefined" || typeof document.getElementById !== "function") return;
  const fab = document.getElementById("pf2e-mobile-fab");
  if (!fab) return;
  if (!shouldActivateMobile()) {
    fab.style.display = "none";
    return;
  }
  const sheets = Array.from(document.querySelectorAll?.(".pf2e-mobile-sheet") ?? []);
  const isSheetInDom = sheets.some(el => {
    if (!el || el.isConnected === false) return false;
    const style = window?.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    return true;
  });
  const hasAppInstance = typeof foundry !== "undefined" && foundry.applications?.instances?.values
    ? Array.from(foundry.applications.instances.values()).some(a => a instanceof PF2eMobileSheet && a.rendered && a.element?.isConnected)
    : false;
  const isSheetOpen = isSheetInDom || hasAppInstance || Boolean(document.body?.classList?.contains("pf2e-sheet-open"));

  fab.style.display = isSheetOpen ? "none" : "flex";
}

let mobileUiInitialized = false;

/**
 * Initializes mobile UI components, attaches floating launcher, and auto-opens
 * the active character sheet if configured. Designed to execute safely even if
 * third-party canvas exceptions delay or abort Foundry's core "ready" hook.
 */
export async function initMobileUI() {
  if (mobileUiInitialized) return;
  if (!shouldActivateMobile()) return;
  if (!game?.user) return;
  mobileUiInitialized = true;

  console.log("PF2e Mobile Compact | Initializing mobile UI and launchers");
  activateMobileEnvironment();
  syncStylesheetState();
  ensureMobileFab();

  // If auto-open setting is enabled, launch the assigned or owned character sheet
  if (game.settings.get("pf2e-mobile-compact", "autoOpenSheet")) {
    const userChar = game.user.character;
    const isUserCharValid = userChar && (userChar.isOwner || userChar.testUserPermission(game.user, "LIMITED"));

    const character = (isUserCharValid ? userChar : null)
      ?? game.actors?.find?.(a => a.type === "character" && a.isOwner)
      ?? game.actors?.find?.(a => a.type === "character" && a.testUserPermission(game.user, "LIMITED"))
      ?? (game.user.isGM ? game.actors?.find?.(a => a.type === "character") : null);

    if (character) {
      console.log(`PF2e Mobile Compact | Auto-opening mobile sheet for ${character.name}`);
      try {
        if (!character._mobileSheetInstance || !(character._mobileSheetInstance instanceof PF2eMobileSheet)) {
          character._mobileSheetInstance = new PF2eMobileSheet({ document: character });
        }
        character._mobileSheetInstance.render({ force: true });
      } catch (err) {
        console.error("PF2e Mobile Compact | Error auto-opening mobile sheet:", err);
        character.sheet?.render?.({ force: true });
      }
    }
  }
}

Hooks.once("setup", () => {
  setTimeout(initMobileUI, 1200);
  setTimeout(initMobileUI, 3000);
});

Hooks.once("ready", async () => {
  syncStylesheetState();

  if (shouldActivateMobile()) {
    initMobileUI();
  } else {
    deactivateMobileEnvironment();
    console.log("PF2e Mobile Compact | Desktop environment active. Mobile overrides dormant.");
    const existingFab = document.getElementById("pf2e-mobile-fab");
    if (existingFab) existingFab.remove();
    try {
      localStorage.removeItem("core.noCanvas");
      if (game.settings?.settings?.has?.("core.noCanvas") && game.settings.get("core", "noCanvas")) {
        await game.settings.set("core", "noCanvas", false);
      }
      if (typeof CONFIG !== "undefined" && CONFIG.Canvas) {
        CONFIG.Canvas.disabled = false;
      }
      const board = document.getElementById("board");
      if (board && board.style.display === "none") {
        board.style.display = "";
      }
    } catch {}
    // A mobile device switched to the desktop view gets a button to switch back (utils/view-mode.js)
    ensureMobileViewButton();
  }

  // Keep fullscreen icon and classes synchronized across window changes in all environments
  const onFullscreenStateChange = () => {
    if (!shouldActivateMobile() && !document.querySelector(".pf2e-mobile-sheet")) return;
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs) {
      document.body.classList.remove("pf2e-fullscreen");
      document.querySelectorAll(".pf2e-mobile-sheet").forEach(s => s.classList.remove("fullscreen-mode"));
    }
    const icons = document.querySelectorAll(".btn-fullscreen i");
    for (const icon of icons) {
      icon.className = (isFs || document.body.classList.contains("pf2e-fullscreen")) ? "fas fa-compress" : "fas fa-expand";
    }
  };
  document.addEventListener("fullscreenchange", onFullscreenStateChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenStateChange);

  // Dynamic viewport detection: activate mobile overrides if window is resized or rotated into mobile format,
  // or restore desktop environment if window is enlarged back to desktop viewports.
  window.addEventListener("resize", foundry.utils.debounce(() => {
    if (shouldActivateMobile()) {
      activateMobileEnvironment();
      syncStylesheetState();
      updateFabVisibility();
    } else {
      deactivateMobileEnvironment();
      syncStylesheetState();
      updateFabVisibility();
    }
  }, 200));

  // Auto-migrate any legacy kebab-case property rune slugs on owned actors
  try {
    for (const actor of game.actors ?? []) {
      if (actor.isOwner) migrateActorPropertyRunes(actor);
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | Property rune migration warning:", err);
  }
});


// Reactively toggle stylesheet and FAB when mobile character sheet opens or closes
Hooks.on("renderPF2eMobileSheet", (sheet) => {
  if (sheet?.actor) migrateActorPropertyRunes(sheet.actor);
  try {
    patchUserActiveTokens();
  } catch {}
  syncStylesheetState(sheet);
  updateFabVisibility();
  setTimeout(() => {
    syncStylesheetState(sheet);
    updateFabVisibility();
  }, 0);
});
Hooks.on("closePF2eMobileSheet", () => {
  setTimeout(() => {
    syncStylesheetState();
    updateFabVisibility();
  }, 50);
});

// Reactively synchronize roll mode and entry method when physical-dice settings change externally
Hooks.on("physicalDiceRollModeChanged", (mode) => {
  if (foundry.applications?.instances?.values) {
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof PF2eMobileSheet && app.rendered) {
        app._rollMode = mode;
        app.render({ parts: ["header"] });
      }
    }
  }
});

Hooks.on("physicalDiceSettingsChanged", () => {
  if (foundry.applications?.instances?.values) {
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof PF2eMobileSheet && app.rendered) {
        app.render({ parts: ["header"] });
      }
    }
  }
});

// Continuously drop resolution warnings whenever notifications or dialogs render (mobile only)
Hooks.on("renderNotifications", () => {
  if (shouldActivateMobile()) sweepResolutionNotifications();
});

Hooks.on("renderDialog", (dialog, html) => {
  if (shouldActivateMobile()) {
    const text = `${dialog?.title ?? ""} ${html?.[0]?.textContent ?? ""}`;
    if (isResolutionMessage(text)) {
      console.log("PF2e Mobile Compact | Auto-closed low-resolution dialog.");
      dialog.close();
    }
  }
});

// Re-optimize ticker whenever scene transitions or canvas re-draws (mobile only)
Hooks.on("canvasReady", () => {
  ensureSafeCanvasTokens();
  if (shouldActivateMobile()) {
    optimizeCanvasForMobile();
  }
});

function styleKingdomDialog(app, rawElement) {
  const element = rawElement?.[0] || rawElement;
  if (!element || typeof element.querySelector !== "function") return;

  const isKmDialog = element.classList?.contains("km-dialog-form")
    || Boolean(element.querySelector?.(".km-check-dialog"))
    || app?.constructor?.name === "KingdomCheckDialog"
    || String(app?.id || "").startsWith("kmCheck-");

  if (!isKmDialog) return;

  element.classList.add("pf2e-mobile-km-dialog", "compact-theme");
  const rollBtn = element.querySelector?.('button[data-action="roll"]')
    || element.querySelector?.('button[name="roll"]')
    || element.querySelector?.('.dialog-button.roll');

  if (rollBtn && !rollBtn.dataset.mobilePhysicalBound) {
    rollBtn.dataset.mobilePhysicalBound = "true";
    rollBtn.addEventListener("click", () => {
      const openMobileSheet = Array.from(foundry.applications?.instances?.values?.() ?? [])
        .find((inst) => inst instanceof PF2eMobileSheet);
      const isPhys = openMobileSheet?.rollMode === "physical"
        || getStoredRollMode() === "physical";
      if (isPhys) {
        import("./rolls/physical-dice-interceptor.js").then(({ PhysicalDiceManager }) => {
          PhysicalDiceManager.activeContext = {
            title: openMobileSheet?._pendingKingdomRollTitle || app?.title || "Kingdom Check",
            actor: openMobileSheet?.actor,
            isPhysical: true
          };
          setTimeout(() => {
            if (PhysicalDiceManager.activeContext?.isPhysical) {
              PhysicalDiceManager.activeContext = null;
            }
            if (openMobileSheet?.rendered) {
              openMobileSheet.render({ parts: ["header", "sheet"] });
            }
          }, 15000);
        });
      }
    }, true);
  }
}

// Intercept pf2e-kingmaker-tools ApplicationV2 windows on mobile:
// 1. Keep the desktop KingdomSheet (.km-kingdom-sheet) hidden and route/sync to PF2eMobileSheet.
// 2. Apply mobile compact styling and PhysicalDiceManager context to KingdomCheckDialog / StructureBrowser modals.
Hooks.on("renderApplicationV2", (app, element) => {
  if (!shouldActivateMobile() || !element) return;

  const appId = String(app?.id || "");
  if (element.classList?.contains("km-kingdom-sheet") || appId.startsWith("kmKingdomSheet-")) {
    element.classList.add("km-mobile-hidden-proxy");
    element.style.setProperty("display", "none", "important");

    const openMobileSheet = Array.from(foundry.applications?.instances?.values?.() ?? [])
      .find((inst) => inst instanceof PF2eMobileSheet);
    if (openMobileSheet) {
      if (!openMobileSheet._isKingdomMode && !globalThis._initializingKingdomProxy) {
        const partyActor = game.actors?.find?.((a) => a.type === "party" && appId.endsWith(a.uuid))
          ?? game.actors?.party
          ?? game.actors?.find?.((a) => a.type === "party");
        if (partyActor && openMobileSheet.actor?.id !== partyActor.id) {
          openMobileSheet.close({ animate: false }).then(() => {
            if (!partyActor._mobileSheetInstance || !(partyActor._mobileSheetInstance instanceof PF2eMobileSheet)) {
              partyActor._mobileSheetInstance = new PF2eMobileSheet({ document: partyActor });
            }
            partyActor._mobileSheetInstance._isKingdomMode = true;
            partyActor._mobileSheetInstance._activeTab = "turn";
            partyActor._mobileSheetInstance.render({ force: true });
          });
          return;
        }
        openMobileSheet._isKingdomMode = true;
        openMobileSheet._activeTab = "turn";
      }
      if (openMobileSheet._isKingdomMode) {
        clearTimeout(openMobileSheet._kmSyncTimer);
        openMobileSheet._kmSyncTimer = setTimeout(() => {
          if (openMobileSheet.rendered) {
            openMobileSheet.render({ parts: ["header", "sheet"] });
          }
        }, 60);
      }
    }
    return;
  }

  styleKingdomDialog(app, element);
});

Hooks.on("renderApplication", (app, html) => {
  if (!shouldActivateMobile()) return;
  styleKingdomDialog(app, html);
});

Hooks.on("renderDialog", (app, html) => {
  if (!shouldActivateMobile()) return;
  styleKingdomDialog(app, html);
});


