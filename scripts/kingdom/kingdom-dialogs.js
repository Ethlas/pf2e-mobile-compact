/**
 * PF2e Mobile Sheet (Compact) - Kingdom Dialogs & Modals
 * Mobile-optimized modals for Kingdom Consumption, Settlement Inspection,
 * Event Resolution, and Level Progression filtering.
 */

import { getPartyActor, getOrInitKingdomApp } from "./kingdom-context.js";
import { dispatchKingdomSheetAction } from "./kingdom-actions.js";

/**
 * Filters the displayed Kingdom Level timeline in the Charter tab.
 */
export async function onFilterKingdomLevel(sheet, event, target) {
  sheet._kingdomLevelFilter = target.value || "all";
  sheet.render({ parts: ["sheet"] });
}

/**
 * Resolves an ongoing Kingdom Event.
 */
export async function onResolveKingdomEvent(sheet, event, target) {
  const index = target.dataset.index;
  const eventName = target.dataset.eventName || "Ongoing Event";
  await dispatchKingdomSheetAction(sheet, event, { action: "handle-event", index }, eventName);
}

/**
 * Opens a mobile-styled Consumption Breakdown popup populated directly from `pf2e-kingmaker-tools` context.
 */
export async function onOpenConsumptionBreakdown(sheet) {
  const kmApp = await getOrInitKingdomApp(getPartyActor(sheet.actor) || sheet.actor, true);
  const km = (kmApp && typeof kmApp._preparePartContext === "function")
    ? await kmApp._preparePartContext("form", {}, {})
    : {};

  const total = Number(km.consumption?.total ?? km.consumption ?? 0);
  const armyCons = Number(km.consumptionContext?.armies?.value ?? 0);
  const settlements = Array.isArray(km.settlements) ? km.settlements : [];
  const esc = foundry.utils?.escapeHTML ?? ((s) => String(s ?? ""));

  const rowsHtml = settlements.map((s) => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
      <span>${s.isCapital ? "👑 " : "🏙️ "}${esc(s.name)} (${esc(s.size)})</span>
      <strong>Level ${s.level}</strong>
    </div>
  `).join("");

  const content = `
    <div class="km-mobile-modal-body" style="display:flex;flex-direction:column;gap:8px;font-size:0.88rem;">
      <div style="display:flex;justify-content:space-between;padding:8px 10px;background:rgba(225,175,65,0.16);border-radius:8px;">
        <span>Total Kingdom Consumption</span>
        <strong>${total} Food / Turn</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 10px;background:rgba(255,255,255,0.04);border-radius:8px;">
        <span>Armies Consumption</span>
        <strong>${armyCons} Food</strong>
      </div>
      ${rowsHtml ? `<div style="margin-top:4px;"><strong style="color:#f3d486;">Settlements (${settlements.length})</strong>${rowsHtml}</div>` : ""}
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: { title: "Consumption Breakdown", icon: "fa-solid fa-wheat-awn" },
    classes: ["pf2e-mobile-dialog", "compact-theme"],
    content,
    ok: { label: "Close", icon: "fa-solid fa-check" }
  });
}

/**
 * Opens a mobile-styled Settlement Inspection popup by calling `pf2e-kingmaker-tools`'s `InspectSettlement`
 * context builder (`_preparePartContext`) and rendering it inside a compact mobile `DialogV2` modal.
 */
export async function onInspectKingdomSettlement(sheet, event, target) {
  const settlementId = target.dataset.settlementId;
  if (!settlementId) return;

  const kmApp = await getOrInitKingdomApp(getPartyActor(sheet.actor) || sheet.actor, true);
  if (!kmApp || typeof kmApp._onClickAction !== "function") return;

  const beforeIds = new Set(foundry.applications?.instances?.keys?.() ?? []);
  const fakeBtn = typeof document !== "undefined" && typeof document.createElement === "function"
    ? document.createElement("button")
    : { dataset: {} };
  fakeBtn.dataset.action = "inspect-settlement";
  fakeBtn.dataset.id = settlementId;

  await kmApp._onClickAction(event, fakeBtn);

  let inspectApp = null;
  for (let i = 0; i < 20 && !inspectApp; i++) {
    for (const [id, app] of (foundry.applications?.instances?.entries?.() ?? [])) {
      if (!beforeIds.has(id) && (app?.constructor?.name === "InspectSettlement" || app?.element?.querySelector?.(".km-settlement-content"))) {
        inspectApp = app;
        break;
      }
    }
    if (!inspectApp) await new Promise((r) => setTimeout(r, 25));
  }

  if (!inspectApp || typeof inspectApp._preparePartContext !== "function") return;
  if (inspectApp.element) {
    inspectApp.element.style.setProperty("display", "none", "important");
  }

  let sCtx = {};
  try {
    sCtx = (await inspectApp._preparePartContext("form", {}, {})) ?? {};
  } catch {}
  try {
    await inspectApp.close({ animate: false });
  } catch {}

  const sceneName = game.scenes?.get?.(settlementId)?.name || "Settlement";
  const structures = Array.isArray(sCtx.structures) ? sCtx.structures : [];
  const bonuses = Array.isArray(sCtx.bonuses) ? sCtx.bonuses : [];
  const storage = Array.isArray(sCtx.storage) ? sCtx.storage : [];
  const availableItems = sCtx.availableItems && typeof sCtx.availableItems === "object"
    ? Object.entries(sCtx.availableItems)
    : [];

  const structuresHtml = structures.length
    ? structures.map((st) => `<li style="padding:3px 0;"><strong>${st.value}x</strong> ${st.label}</li>`).join("")
    : `<li><em>No structures constructed yet.</em></li>`;

  const bonusesHtml = bonuses.length
    ? bonuses.map((b) => `<li style="padding:2px 0;">${foundry.utils.escapeHTML(String(b))}</li>`).join("")
    : `<li><em>No active structure bonuses.</em></li>`;

  const storageHtml = storage.map((st) => `
    <div style="background:rgba(255,255,255,0.05);padding:4px 8px;border-radius:6px;display:flex;justify-content:space-between;">
      <span>${foundry.utils.escapeHTML(st.label)}</span>
      <strong>${st.value}</strong>
    </div>
  `).join("");

  const marketHtml = availableItems.map(([k, v]) => `
    <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <span>${foundry.utils.escapeHTML(k)}</span>
      <strong>${foundry.utils.escapeHTML(String(v))}</strong>
    </div>
  `).join("");

  const content = `
    <div class="km-mobile-settlement-popup" style="display:flex;flex-direction:column;gap:10px;max-height:72vh;overflow-y:auto;font-size:0.84rem;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center;">
        <div style="background:rgba(225,175,65,0.15);padding:6px;border-radius:8px;">
          <div style="font-size:0.7rem;color:#a8b2c8;">Type &amp; Level</div>
          <strong>${foundry.utils.escapeHTML(sCtx.type || "")} ${sCtx.level ?? 1}</strong>
        </div>
        <div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:8px;">
          <div style="font-size:0.7rem;color:#a8b2c8;">Blocks / Res.</div>
          <strong>${sCtx.blocks ?? 0}/${sCtx.maximumBlocks ?? 0} (${sCtx.residentialLots ?? 0} Res)</strong>
        </div>
        <div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:8px;">
          <div style="font-size:0.7rem;color:#a8b2c8;">Consumption</div>
          <strong>${sCtx.consumption ?? 0} Food</strong>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.04);padding:8px 10px;border-radius:8px;">
        <div style="font-weight:700;color:#f3d486;margin-bottom:4px;"><i class="fa-solid fa-building-columns"></i> Constructed Structures</div>
        <ul style="margin:0;padding-left:16px;">${structuresHtml}</ul>
      </div>

      <div style="background:rgba(255,255,255,0.04);padding:8px 10px;border-radius:8px;">
        <div style="font-weight:700;color:#f3d486;margin-bottom:4px;"><i class="fa-solid fa-circle-plus"></i> Settlement Bonuses (Max +${sCtx.maxItemBonus ?? 1})</div>
        <ul style="margin:0;padding-left:16px;">${bonusesHtml}</ul>
      </div>

      ${storageHtml ? `
      <div style="background:rgba(255,255,255,0.04);padding:8px 10px;border-radius:8px;">
        <div style="font-weight:700;color:#f3d486;margin-bottom:4px;"><i class="fa-solid fa-boxes-stacked"></i> Commodity Storage</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">${storageHtml}</div>
      </div>` : ""}

      ${marketHtml ? `
      <div style="background:rgba(255,255,255,0.04);padding:8px 10px;border-radius:8px;">
        <div style="font-weight:700;color:#f3d486;margin-bottom:4px;"><i class="fa-solid fa-shop"></i> Market Available Item Levels</div>
        <div>${marketHtml}</div>
      </div>` : ""}
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: { title: `${sceneName} — Settlement Overview`, icon: "fa-solid fa-city" },
    classes: ["pf2e-mobile-dialog", "compact-theme"],
    content,
    ok: { label: "Close", icon: "fa-solid fa-check" }
  });
}
