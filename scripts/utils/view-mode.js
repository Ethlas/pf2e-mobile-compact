import { isMobileDevice } from "./sheet-utils.js";

/**
 * Switching between the mobile view and Foundry's desktop view from the phone itself.
 *
 * The view is chosen by the client setting "Mobile Activation Mode" (auto / always / never, registered in
 * pf2e-mobile.js). That setting sits in Foundry's Configure Settings, which can't be reached while the
 * mobile sheet covers the screen, so:
 * - the cog menu of the mobile sheet sets it to "never" (desktop view), and
 * - a floating button, shown on a mobile device in the desktop view, sets it back to "auto".
 * The setting is per browser (client scope), so this never changes the view on another device. Its
 * onChange reloads the page, which is needed anyway: the body class, sheet routing and stylesheet are all
 * decided at load.
 */

const RETURN_BUTTON_ID = "pf2e-mobile-return";

/**
 * Asks for confirmation, then switches the view by setting Mobile Activation Mode ("auto" for the mobile
 * view, "never" for the desktop view). The page reloads through the setting's onChange.
 * @param {boolean} enabled  True for the mobile view, false for the desktop view
 * @returns {Promise<void>}
 */
export async function setMobileViewEnabled(enabled) {
  const title = enabled ? "Switch to Mobile View?" : "Switch to Desktop View?";
  const content = enabled
    ? "<p>Switch back to the <strong>mobile sheet</strong>? The page will reload.</p>"
    : "<p>Switch to Foundry's <strong>desktop view</strong> on this device? The page will reload.</p>"
      + "<p>To come back, tap the floating phone button, or set Configure Settings → PF2e Mobile Compact → Mobile Activation Mode to Auto-Detect.</p>";

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title },
    classes: ["pf2e-mobile-target-dialog"],
    content,
    rejectClose: false,
    modal: true
  }).catch(() => false);
  if (!confirmed) return;

  if (!enabled) {
    // When switching to desktop view, clean up any persistent core canvas disable state
    try {
      localStorage.removeItem("core.noCanvas");
      if (game?.settings?.settings?.has?.("core.noCanvas") && game.settings.get("core", "noCanvas")) {
        await game.settings.set("core", "noCanvas", false);
      }
      if (typeof CONFIG !== "undefined" && CONFIG.Canvas) {
        CONFIG.Canvas.disabled = false;
      }
    } catch {}
  }

  await game.settings.set("pf2e-mobile-compact", "mobileActivationMode", enabled ? "auto" : "never");
}

/**
 * Adds the floating "Mobile view" button when a mobile device is in the desktop view (the setting is
 * "never"). Styled inline: the module stylesheet is switched off in the desktop view.
 */
export function ensureMobileViewButton() {
  if (document.getElementById(RETURN_BUTTON_ID)) return;
  if (game.settings.get("pf2e-mobile-compact", "mobileActivationMode") !== "never" || !isMobileDevice()) return;

  const button = document.createElement("button");
  button.id = RETURN_BUTTON_ID;
  button.type = "button";
  button.title = "Mobile view";
  button.setAttribute("aria-label", "Switch to mobile view");
  button.innerHTML = '<i class="fas fa-mobile-screen-button"></i>';
  // Bottom-left, clear of the chat input on the right; 44px stays an easy touch target
  button.style.cssText = "position:fixed;bottom:calc(16px + env(safe-area-inset-bottom, 0px));left:calc(16px + env(safe-area-inset-left, 0px));z-index:9999;width:44px;height:44px;padding:0;border-radius:50%;background:#e65100;color:#fff;border:2px solid #ffb74d;box-shadow:0 4px 12px rgba(0,0,0,0.6);font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;";
  button.addEventListener("click", () => setMobileViewEnabled(true));
  document.body.appendChild(button);
}
