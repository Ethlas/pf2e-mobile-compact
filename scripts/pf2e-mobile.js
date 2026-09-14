/**
 * Entry point for pf2e-mobile-compact module.
 */
import { PF2eMobileSheet } from "./apps/mobile-sheet.js";
import { setupPhysicalDiceInterceptor } from "./rolls/physical-dice-interceptor.js";

/**
 * Check if the client is running in a mobile context via standalone app mode,
 * mobile user-agent inspection, or touch screen compact viewport.
 * @returns {boolean}
 */
export function isMobileDevice() {
  const isStandaloneApp = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIPad = (navigator.platform === "MacIntel" || /Macintosh/i.test(navigator.userAgent)) && (navigator.maxTouchPoints > 1);
  const isMobileViewport = window.innerWidth < 768;
  const isTouchCompact = (navigator.maxTouchPoints > 0 || "ontouchstart" in window) && window.innerWidth < 1024;

  return isStandaloneApp || isMobileUA || isIPad || isMobileViewport || isTouchCompact;
}

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

  // Periodic heartbeat every 25 seconds to prevent mobile browser / proxy socket timeouts
  setInterval(() => {
    if (game.socket?.connected) {
      try {
        game.socket.emit("status", { status: "active" });
      } catch {}
    }
  }, 25000);
}

/**
 * Configures canvas ticker on mobile to cap frame rate at 30 FPS to conserve battery
 * while keeping token coordinates and animations fully functional.
 */
export function optimizeCanvasForMobile() {
  if (canvas?.app?.ticker) {
    try {
      canvas.app.ticker.maxFPS = 30;
      console.log("PF2e Mobile Compact | Canvas ticker capped at 30 FPS for mobile battery optimization.");
    } catch {}
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
    lower.includes("resolution of your browser window is") ||
    lower.includes("resolution of your browser") ||
    lower.includes("display resolution") ||
    lower.includes("resolution of 1366px") ||
    (lower.includes("resolution") && (lower.includes("screen") || lower.includes("minimum") || lower.includes("recommended") || lower.includes("required") || lower.includes("below") || lower.includes("greater") || lower.includes("display")))
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
 * across Game methods, ClientIssues, Notifications prototype, active ui.notifications,
 * and dev console output.
 */
export function suppressResolutionWarnings() {
  // 1. Monkey-patch Game.prototype resolution methods
  if (typeof Game !== "undefined" && Game.prototype) {
    for (const key of Object.getOwnPropertyNames(Game.prototype)) {
      if (/resolution/i.test(key)) {
        const original = Game.prototype[key];
        Game.prototype[key] = function (...args) {
          if (shouldActivateMobile()) return;
          return original?.apply(this, args);
        };
      }
    }
  }

  // 2. Monkey-patch game.issues (ClientIssues in Foundry v14+)
  if (game?.issues) {
    const issues = game.issues;
    const origDetect = issues._detectUsabilityIssues;
    if (typeof origDetect === "function") {
      issues._detectUsabilityIssues = function () {
        if (shouldActivateMobile()) return;
        return origDetect.call(this);
      };
    }

    const proto = issues.constructor?.prototype;
    if (proto && !proto._mobileResolutionPatched) {
      const origProtoDetect = proto._detectUsabilityIssues;
      if (typeof origProtoDetect === "function") {
        proto._detectUsabilityIssues = function () {
          if (shouldActivateMobile()) return;
          return origProtoDetect.call(this);
        };
      }
      proto._mobileResolutionPatched = true;
    }
  }

  // 3. Monkey-patch game instance methods if present
  if (typeof game !== "undefined") {
    for (const key of Object.keys(game)) {
      if (/resolution/i.test(key) && typeof game[key] === "function") {
        const orig = game[key];
        game[key] = function (...args) {
          if (shouldActivateMobile()) return;
          return orig.apply(this, args);
        };
      }
    }
  }

  // 4. Monkey-patch Notifications prototype
  const NotificationsClass = foundry?.applications?.ui?.Notifications ?? (typeof Notifications !== "undefined" ? Notifications : null);
  if (NotificationsClass?.prototype && !NotificationsClass.prototype._mobileResolutionPatched) {
    const origNotify = NotificationsClass.prototype.notify;
    if (typeof origNotify === "function") {
      NotificationsClass.prototype.notify = function (message, type = "info", options = {}) {
        if (shouldActivateMobile() && isResolutionMessage(message, options)) {
          return null;
        }
        return origNotify.call(this, message, type, options);
      };
    }
    const origWarn = NotificationsClass.prototype.warn;
    if (typeof origWarn === "function") {
      NotificationsClass.prototype.warn = function (message, options = {}) {
        if (shouldActivateMobile() && isResolutionMessage(message, options)) {
          return null;
        }
        return origWarn.call(this, message, options);
      };
    }
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

  // 5. Monkey-patch active ui.notifications instance
  if (ui?.notifications && !ui.notifications._mobileResolutionPatched) {
    const origInstNotify = ui.notifications.notify;
    if (typeof origInstNotify === "function") {
      ui.notifications.notify = function (message, type = "info", options = {}) {
        if (shouldActivateMobile() && isResolutionMessage(message, options)) {
          return null;
        }
        return origInstNotify.call(this, message, type, options);
      };
    }
    const origInstWarn = ui.notifications.warn;
    if (typeof origInstWarn === "function") {
      ui.notifications.warn = function (message, options = {}) {
        if (shouldActivateMobile() && isResolutionMessage(message, options)) {
          return null;
        }
        return origInstWarn.call(this, message, options);
      };
    }
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

  // 6. Suppress resolution warning in dev console
  if (!console._mobileResolutionPatched) {
    const isSuppressed = (first) => {
      if (!first) return false;
      return isResolutionMessage(first);
    };

    const origConsoleError = console.error;
    console.error = function (...args) {
      if (shouldActivateMobile() && isSuppressed(args[0])) {
        return;
      }
      return origConsoleError.apply(console, args);
    };

    const origConsoleWarn = console.warn;
    console.warn = function (...args) {
      if (shouldActivateMobile() && isSuppressed(args[0])) {
        return;
      }
      return origConsoleWarn.apply(console, args);
    };
    console._mobileResolutionPatched = true;
  }

  sweepResolutionNotifications();
}

/**
 * Prevents mobile browsers (e.g. Firefox Mobile / Safari) from failing with
 * "Invalid URI. Load of media resource failed" when audio/media elements or AudioHelper
 * receive an empty or whitespace-only source URI.
 */
export function patchMediaElements() {
  if (typeof HTMLMediaElement !== "undefined" && HTMLMediaElement.prototype && !HTMLMediaElement.prototype._pf2eMobilePatched) {
    const proto = HTMLMediaElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "src");
    if (descriptor && descriptor.set) {
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
    proto.setAttribute = function (name, val) {
      if (name === "src" && (val === "" || val === null || val === undefined || (typeof val === "string" && !val.trim()))) {
        return;
      }
      return origSetAttr.call(this, name, val);
    };

    HTMLMediaElement.prototype._pf2eMobilePatched = true;
  }

  // Guard window.Audio constructor against empty string URLs
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

  // Guard Foundry's AudioHelper.play against empty audio sources
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
      const tokens = origGetActiveTokens.apply(this, args);
      if (tokens && tokens.length > 0) return tokens;

      // Fallback: Resolve active token document from currently open mobile sheet
      try {
        const mobileSheet = Object.values(ui.windows ?? {}).find(w => w instanceof PF2eMobileSheet && w.rendered)
          ?? (typeof foundry !== "undefined" && foundry.applications?.instances?.values
            ? Array.from(foundry.applications.instances.values()).find(a => a instanceof PF2eMobileSheet && a.rendered)
            : null);

        const actor = mobileSheet?.actor;
        if (actor) {
          const activeTokens = typeof actor.getActiveTokens === "function" ? actor.getActiveTokens(true, true) : [];
          if (activeTokens?.length) return activeTokens;

          const scene = canvas?.scene ?? game.scenes.viewed ?? game.scenes.active;
          const tokenDoc = scene?.tokens?.find(t => t.actorId === actor.id);
          if (tokenDoc) return [tokenDoc];
        }
      } catch (err) {
        console.warn("PF2e Mobile Compact | Error resolving fallback active token:", err);
      }

      return tokens;
    };
    UserClass.prototype._pf2eMobileActiveTokensPatched = true;
  }
}

Hooks.once("init", async () => {
  console.log("PF2e Mobile Compact | Initializing module");
  suppressResolutionWarnings();
  patchMediaElements();
  patchUserActiveTokens();

  // Register the custom mobile character sheet with Actors collection (namespaced in v13+)
  const ActorsCollection = foundry.documents?.collections?.Actors ?? (typeof Actors !== "undefined" ? Actors : null);
  if (ActorsCollection) {
    ActorsCollection.registerSheet("pf2e", PF2eMobileSheet, {
      types: ["character"],
      makeDefault: false,
      label: "PF2e Mobile Compact Sheet"
    });
  }

  // Dynamically route character sheets to PF2eMobileSheet on mobile clients
  const ActorClass = getDocumentClass?.("Actor") ?? CONFIG.Actor?.documentClass ?? (typeof Actor !== "undefined" ? Actor : null);
  if (ActorClass) {
    const originalGetSheetClass = ActorClass.prototype._getSheetClass;
    ActorClass.prototype._getSheetClass = function () {
      if (shouldActivateMobile() && this.type === "character") {
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
      Object.defineProperty(ActorClass.prototype, "sheet", {
        get() {
          if (shouldActivateMobile() && this.type === "character") {
            const hasPerm = game.user?.isGM || this.isOwner || this.testUserPermission(game.user, "LIMITED");
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
  }

  // Ensure essential Handlebars comparison helpers are available
  if (!Handlebars.helpers.eq) {
    Handlebars.registerHelper("eq", (a, b) => a === b);
  }
  if (!Handlebars.helpers.gte) {
    Handlebars.registerHelper("gte", (a, b) => a >= b);
  }
  if (!Handlebars.helpers.gt) {
    Handlebars.registerHelper("gt", (a, b) => a > b);
  }

  // Client Setting: Mobile Activation Mode
  game.settings.register("pf2e-mobile-compact", "mobileActivationMode", {
    name: "Mobile Activation Mode",
    hint: "Controls when mobile UI overrides, canvas suppression, and the mobile compact sheet are activated.",
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

  // Client Setting: Default Roll Mode (Digital vs Physical Dice)
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

  // Preload Handlebars template parts
  await loadTemplates([
    "modules/pf2e-mobile-compact/templates/mobile-sheet.hbs",
    "modules/pf2e-mobile-compact/templates/physical-dice-dialog.hbs",
    "modules/pf2e-mobile-compact/templates/parts/header.hbs",
    "modules/pf2e-mobile-compact/templates/parts/spells.hbs",
    "modules/pf2e-mobile-compact/templates/parts/actions.hbs",
    "modules/pf2e-mobile-compact/templates/parts/skills.hbs",
    "modules/pf2e-mobile-compact/templates/parts/inventory.hbs",
    "modules/pf2e-mobile-compact/templates/parts/chat.hbs"
  ]);
});

Hooks.once("ready", () => {
  suppressResolutionWarnings();
  sweepResolutionNotifications();
  patchUserActiveTokens();
  try {
    setupPhysicalDiceInterceptor();
  } catch (err) {
    console.warn("PF2e Mobile Compact | setupPhysicalDiceInterceptor error:", err);
  }

  if (shouldActivateMobile()) {
    console.log("PF2e Mobile Compact | Mobile environment confirmed. Activating mobile engine.");
    document.body.classList.add("pf2e-mobile-active");
    setupKeepAlive();
    optimizeCanvasForMobile();

    // Enable browser pinch-to-zoom on mobile devices
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute(
        "content",
        "width=device-width, initial-scale=1.0, minimum-scale=0.5, maximum-scale=3.0, user-scalable=yes"
      );
    }

    // Resolve assigned or owned character
    const userChar = game.user.character;
    const isUserCharValid = userChar && (userChar.isOwner || userChar.testUserPermission(game.user, "LIMITED"));

    const character = (isUserCharValid ? userChar : null)
      ?? game.actors.find(a => a.type === "character" && a.isOwner)
      ?? game.actors.find(a => a.type === "character" && a.testUserPermission(game.user, "LIMITED"))
      ?? (game.user.isGM ? game.actors.find(a => a.type === "character") : null);

    // If auto-open setting is enabled, launch the assigned or owned character sheet
    if (game.settings.get("pf2e-mobile-compact", "autoOpenSheet")) {
      if (character) {
        console.log(`PF2e Mobile Compact | Auto-opening mobile sheet for ${character.name}`);
        try {
          if (!character._mobileSheetInstance || !(character._mobileSheetInstance instanceof PF2eMobileSheet)) {
            character._mobileSheetInstance = new PF2eMobileSheet({ document: character });
          }
          character._mobileSheetInstance.render(true);
        } catch (err) {
          console.error("PF2e Mobile Compact | Error auto-opening mobile sheet:", err);
          character.sheet?.render?.(true);
        }
      }
    }

    // Floating launcher button (FAB) for mobile in case sheet was closed or needs opening
    if (!document.getElementById("pf2e-mobile-fab")) {
      const fab = document.createElement("button");
      fab.id = "pf2e-mobile-fab";
      fab.type = "button";
      fab.title = "Open Mobile Sheet";
      fab.innerHTML = '<i class="fas fa-user-shield"></i>';
      fab.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999;width:52px;height:52px;border-radius:50%;background:#e65100;color:#fff;border:2px solid #ffb74d;box-shadow:0 4px 12px rgba(0,0,0,0.6);font-size:22px;display:none;align-items:center;justify-content:center;cursor:pointer;";
      fab.addEventListener("click", () => {
        const uChar = game.user.character;
        const isUCharValid = uChar && (uChar.isOwner || uChar.testUserPermission(game.user, "LIMITED"));

        const char = (isUCharValid ? uChar : null)
          ?? game.actors.find(a => a.type === "character" && a.isOwner)
          ?? game.actors.find(a => a.type === "character" && a.testUserPermission(game.user, "LIMITED"))
          ?? (game.user.isGM ? game.actors.find(a => a.type === "character") : null);
        if (char) {
          if (!char._mobileSheetInstance || !(char._mobileSheetInstance instanceof PF2eMobileSheet)) {
            char._mobileSheetInstance = new PF2eMobileSheet({ document: char });
          }
          char._mobileSheetInstance.render(true);
        } else {
          ui.notifications?.warn?.("PF2e Mobile: No character actor found for this user.");
        }
      });
      document.body.appendChild(fab);

      setInterval(() => {
        if (shouldActivateMobile()) {
          const isOpen = !!document.querySelector(".pf2e-mobile-sheet");
          fab.style.display = isOpen ? "none" : "flex";
        } else {
          fab.style.display = "none";
        }
      }, 1000);
    }
  } else {
    console.log("PF2e Mobile Compact | Desktop environment active. Mobile overrides dormant.");
  }

  // Keep fullscreen icon and classes synchronized across window changes in all environments
  const onFullscreenStateChange = () => {
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

  // Dynamic viewport detection: activate mobile overrides if window is resized or rotated into mobile format
  window.addEventListener("resize", foundry.utils.debounce(() => {
    if (shouldActivateMobile() && !document.body.classList.contains("pf2e-mobile-active")) {
      console.log("PF2e Mobile Compact | Viewport entered mobile mode. Activating mobile engine.");
      document.body.classList.add("pf2e-mobile-active");
      optimizeCanvasForMobile();
      suppressResolutionWarnings();
      sweepResolutionNotifications();
    }
  }, 200));
});

// Continuously drop resolution warnings whenever notifications or dialogs render
Hooks.on("renderNotifications", () => {
  sweepResolutionNotifications();
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

// Re-optimize ticker whenever scene transitions or canvas re-draws
Hooks.on("canvasReady", () => {
  if (shouldActivateMobile()) {
    optimizeCanvasForMobile();
  }
});

