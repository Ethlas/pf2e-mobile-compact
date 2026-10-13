/**
 * PF2e Mobile Sheet (Compact) - Kingdom Domain Handlers Facade
 * High-level coordinator and backwards-compatible re-export barrier.
 * Domain logic is split into:
 *  - scripts/kingdom/kingdom-context.js  (Data & Context Preparation)
 *  - scripts/kingdom/kingdom-actions.js  (Dice Rolling & Action Dispatch)
 *  - scripts/kingdom/kingdom-dialogs.js  (Modals & Inspections)
 */

import { getOrInitKingdomApp } from "./kingdom-context.js";

// Re-export context builders
export {
  getPartyActor,
  hasKingdomData,
  getKingdomName,
  findExistingKingdomApp,
  getOrInitKingdomApp,
  applyKingdomFlagFallback,
  normalizeKingdomViewData,
  prepareKingdomContext
} from "./kingdom-context.js";

// Re-export actions & dice execution
export {
  dispatchKingdomSheetAction,
  onRollKingdomSkillCheck,
  onPerformKingdomActivity,
  onRollKingdomResourceDice,
  onPostKingdomActivityChat,
  onSkipCollectTaxes,
  onClaimKingdomRefuge,
  onClaimKingdomLandmark,
  onUpdateKingdomField,
  onDispatchKingdomNativeAction
} from "./kingdom-actions.js";

// Re-export dialogs & modals
export {
  onOpenConsumptionBreakdown,
  onInspectKingdomSettlement,
  onResolveKingdomEvent,
  onFilterKingdomLevel
} from "./kingdom-dialogs.js";

/**
 * Opens the Mobile Kingdom Sheet on a party sheet.
 */
export async function onOpenMobileKingdomSheet(sheet) {
  sheet._isKingdomMode = true;
  sheet._activeTab = "turn";
  sheet.render({ parts: ["header", "sheet"] });
}

/**
 * Switches the Turn sub-tab between "status" and "flow".
 */
export async function onSwitchKingdomTurnSubTab(sheet, event, target) {
  const subtab = target.dataset.subtab;
  if (subtab && subtab !== sheet._kingdomTurnSubTab) {
    sheet._kingdomTurnSubTab = subtab;
    sheet.render({ parts: ["sheet"] });
  }
}

/**
 * Switches the Sheet sub-tab between "stats" and "charter".
 */
export async function onSwitchKingdomSheetSubTab(sheet, event, target) {
  const subtab = target.dataset.subtab;
  if (subtab && subtab !== sheet._kingdomSheetSubTab) {
    sheet._kingdomSheetSubTab = subtab;
    sheet.render({ parts: ["sheet"] });
  }
}

/**
 * Toggles accordion collapse for a kingdom phase in the Turn Flow.
 */
export function onToggleKingdomPhase(sheet, event, target) {
  const phaseKey = target.dataset.phase;
  if (!phaseKey) return;
  if (!sheet._collapsedKingdomPhases) {
    sheet._collapsedKingdomPhases = new Set(["upkeep", "region", "civic", "army"]);
  }
  if (sheet._collapsedKingdomPhases.has(phaseKey)) {
    sheet._collapsedKingdomPhases.delete(phaseKey);
  } else {
    sheet._collapsedKingdomPhases.add(phaseKey);
  }

  const section = target.closest(".km-phase-section");
  if (section) {
    section.classList.toggle("is-collapsed", sheet._collapsedKingdomPhases.has(phaseKey));
  } else {
    sheet.render({ parts: ["sheet"] });
  }
}

/**
 * Toggles accordion expansion for an individual activity card in Turn Flow.
 */
export function onToggleKingdomActivity(sheet, event, target) {
  const actId = target.dataset.activityId;
  if (!actId) return;
  if (!sheet._expandedKingdomActivities) {
    sheet._expandedKingdomActivities = new Set();
  }
  if (sheet._expandedKingdomActivities.has(actId)) {
    sheet._expandedKingdomActivities.delete(actId);
  } else {
    sheet._expandedKingdomActivities.add(actId);
  }

  const card = target.closest(".km-activity-card");
  if (card) {
    card.classList.toggle("is-expanded", sheet._expandedKingdomActivities.has(actId));
  } else {
    sheet.render({ parts: ["sheet"] });
  }
}

/**
 * Updates the active leader role context on both the mobile sheet and kmApp.
 */
export async function onSetKingdomActiveLeader(sheet, event, target) {
  const role = target.value;
  if (!role) return;

  sheet._activeKingdomLeader = role;

  try {
    if (game.settings?.pfrpg2eKingdomCampingWeather?.setKingdomActiveLeader) {
      await game.settings.pfrpg2eKingdomCampingWeather.setKingdomActiveLeader(role);
    }
  } catch {}

  try {
    const kmApp = await getOrInitKingdomApp(sheet.actor, true);
    const selectEl = kmApp?.element?.querySelector?.('select[name="activeLeader"]');
    if (selectEl) {
      selectEl.value = role;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } catch {}

  sheet.render({ parts: ["sheet"] });
}

/**
 * Updates the active settlement context on both the mobile sheet and kmApp.
 */
export async function onSetKingdomActiveSettlement(sheet, event, target) {
  const settlementId = target.value;

  sheet._activeKingdomSettlement = settlementId;

  try {
    const kmApp = await getOrInitKingdomApp(sheet.actor, true);
    const selectEl = kmApp?.element?.querySelector?.('select[name="activeSettlement"]');
    if (selectEl) {
      selectEl.value = settlementId;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } catch {}

  sheet.render({ parts: ["sheet"] });
}
