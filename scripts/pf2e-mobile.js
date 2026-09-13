/**
 * Entry point for pf2e-mobile-compact module.
 */
import { PF2eMobileSheet } from "./apps/mobile-sheet.js";

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
 * @returns {boolean}
 */
export function isResolutionMessage(msg) {
  if (!msg) return false;
  const text = typeof msg === "string" ? msg : (msg.message || msg.toString?.() || "");
  const lower = text.toLowerCase();

  const hasDimension = lower.includes("resolution") || lower.includes("dimension") || lower.includes("lowresolution");
  const hasConstraint = lower.includes("minimum") || lower.includes("recommended") || lower.includes("required") || lower.includes("below") || lower.includes("smaller");

  return hasDimension && hasConstraint;
}

/**
 * Sweeps any low-resolution warning notification elements out of the DOM.
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
  } catch {}
}

/**
 * Suppresses Foundry's low resolution / minimum window dimensions warnings
 * across Game methods, Notifications prototype, and active ui.notifications.
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

  // 2. Monkey-patch game instance methods if present
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

  // 3. Monkey-patch Notifications prototype
  const NotificationsClass = foundry?.applications?.ui?.Notifications ?? (typeof Notifications !== "undefined" ? Notifications : null);
  if (NotificationsClass?.prototype && !NotificationsClass.prototype._mobileResolutionPatched) {
    const origNotify = NotificationsClass.prototype.notify;
    if (typeof origNotify === "function") {
      NotificationsClass.prototype.notify = function (message, type = "info", options = {}) {
        if (shouldActivateMobile() && isResolutionMessage(message)) {
          console.log("PF2e Mobile Compact | Suppressed low-resolution notification.");
          return null;
        }
        return origNotify.call(this, message, type, options);
      };
    }
    const origWarn = NotificationsClass.prototype.warn;
    if (typeof origWarn === "function") {
      NotificationsClass.prototype.warn = function (message, options = {}) {
        if (shouldActivateMobile() && isResolutionMessage(message)) {
          console.log("PF2e Mobile Compact | Suppressed low-resolution notification.");
          return null;
        }
        return origWarn.call(this, message, options);
      };
    }
    NotificationsClass.prototype._mobileResolutionPatched = true;
  }

  // 4. Monkey-patch active ui.notifications instance
  if (ui?.notifications && !ui.notifications._mobileResolutionPatched) {
    const origInstNotify = ui.notifications.notify;
    if (typeof origInstNotify === "function") {
      ui.notifications.notify = function (message, type = "info", options = {}) {
        if (shouldActivateMobile() && isResolutionMessage(message)) {
          console.log("PF2e Mobile Compact | Suppressed low-resolution notification.");
          return null;
        }
        return origInstNotify.call(this, message, type, options);
      };
    }
    const origInstWarn = ui.notifications.warn;
    if (typeof origInstWarn === "function") {
      ui.notifications.warn = function (message, options = {}) {
        if (shouldActivateMobile() && isResolutionMessage(message)) {
          console.log("PF2e Mobile Compact | Suppressed low-resolution notification.");
          return null;
        }
        return origInstWarn.call(this, message, options);
      };
    }
    ui.notifications._mobileResolutionPatched = true;
  }

  sweepResolutionNotifications();
}

Hooks.once("init", async () => {
  console.log("PF2e Mobile Compact | Initializing module");
  suppressResolutionWarnings();

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

  // Preload Handlebars template parts
  await loadTemplates([
    "modules/pf2e-mobile-compact/templates/parts/header.hbs",
    "modules/pf2e-mobile-compact/templates/parts/spells.hbs",
    "modules/pf2e-mobile-compact/templates/parts/actions.hbs",
    "modules/pf2e-mobile-compact/templates/parts/skills.hbs",
    "modules/pf2e-mobile-compact/templates/parts/inventory.hbs"
  ]);


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
  }
});

Hooks.once("ready", () => {
  suppressResolutionWarnings();
  sweepResolutionNotifications();

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

    // If auto-open setting is enabled, launch the assigned or owned character sheet
    if (game.settings.get("pf2e-mobile-compact", "autoOpenSheet")) {
      const character = game.user.character ?? game.actors.find(a => a.type === "character" && a.isOwner);
      if (character) {
        console.log(`PF2e Mobile Compact | Auto-opening mobile sheet for ${character.name}`);
        character.sheet.render(true);
      }
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

