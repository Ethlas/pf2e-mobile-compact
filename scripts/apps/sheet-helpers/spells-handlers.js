import { PhysicalDiceManager } from "../../rolls/physical-dice-interceptor.js";
import { setTargetToken } from "../../tokens/token-adapter.js";
import { resolveTargetsForSpell, isMultiTargetOrAreaSpell, promptVariantSelection } from "./sheet-prompts.js";
import { clamp, getGlyph, parseActionCostInfo } from "../../utils/sheet-utils.js";
import { CompendiumPickerApp } from "../compendium-picker.js";

/**
 * Action handler: switch active spell sub-tab (spells, preparation).
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onSwitchSpellSubTab(sheet, event, target) {
  const newSubTab = target.dataset.subtab;
  if (newSubTab && newSubTab !== sheet._spellSubTab) {
    sheet._spellSubTab = newSubTab;
    sheet.render({ parts: ["sheet"] });
  }
}

/**
 * Action handler: toggle expandable rank accordion group in Spells tab.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export function onToggleRankGroup(sheet, event, target) {
  if (event.target?.closest?.(".slot-counter")) return;
  event.preventDefault();
  // Numeric ranks ("0"-"10") are stored as numbers, other group keys ("focus", "staff-2") as text,
  // matching the keys the context builders look up in _collapsedRankGroups.
  const rawRank = String(target.dataset.rank ?? "");
  const rank = /^\d+$/.test(rawRank) ? parseInt(rawRank, 10) : rawRank;
  const groupEl = target.closest(".spell-rank-group");
  if (!groupEl) return;

  const listEl = groupEl.querySelector(".spell-list");
  const iconEl = groupEl.querySelector(".rank-expand-icon");
  const isCollapsed = listEl?.classList?.contains("collapsed");

  if (isCollapsed) {
    listEl?.classList?.remove("collapsed");
    iconEl?.classList?.remove("collapsed");
    sheet._collapsedRankGroups.delete(rank);
  } else {
    listEl?.classList?.add("collapsed");
    iconEl?.classList?.add("collapsed");
    sheet._collapsedRankGroups.add(rank);
  }
}

/**
 * Helper: assign a spell to a prepared slot.
 * @param {Actor} actor
 * @param {string} entryId
 * @param {number} rank
 * @param {number} slotIndex
 * @param {string} spellId
 */
export async function prepareSlot(actor, entryId, rank, slotIndex, spellId) {
  const entry = actor.spellcasting?.get(entryId);
  const spell = actor.items.get(spellId);
  if (!entry || !spell) return;

  const groupId = rank === 0 ? "cantrips" : rank;
  const slotKey = `slot${rank}`;
  const currentPrepared = foundry.utils.deepClone(entry.system.slots?.[slotKey]?.prepared ?? []);
  const nextPrepared = Array.isArray(currentPrepared) ? currentPrepared : Object.values(currentPrepared);

  while (nextPrepared.length <= slotIndex) {
    nextPrepared.push({ id: null, expended: false });
  }
  if (!nextPrepared[slotIndex]) {
    nextPrepared[slotIndex] = { id: null, expended: false };
  }

  // If entry didn't already have an object at slotIndex, update it directly first
  if (!entry.system.slots?.[slotKey]?.prepared?.[slotIndex]) {
    nextPrepared[slotIndex] = { id: spell.id, expended: false };
    await entry.update({ [`system.slots.${slotKey}.prepared`]: nextPrepared });
    return;
  }

  if (typeof entry.prepareSpell === "function") {
    await entry.prepareSpell(spell, groupId, slotIndex);
  } else {
    nextPrepared[slotIndex] = { id: spell.id, expended: false };
    await entry.update({ [`system.slots.${slotKey}.prepared`]: nextPrepared });
  }
}

/**
 * Action handler: open touch-friendly spell selection modal to prepare a spell in a slot.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onOpenSpellPrepPicker(sheet, event, target) {
  const entryId = target.dataset.entryId;
  const rank = parseInt(target.dataset.rank, 10);
  const slotIndex = parseInt(target.dataset.slotIndex, 10);
  if (!entryId || isNaN(rank) || isNaN(slotIndex)) return;

  const entry = sheet.actor.spellcasting?.get(entryId);
  if (!entry) return;

  const spells = (entry.spells?.contents ?? []).filter(s => {
    if (rank === 0) return s.isCantrip;
    const spellBaseRank = s.rank ?? s.system.level?.value ?? 1;
    return !s.isCantrip && spellBaseRank <= rank;
  }).map(s => ({
    id: s.id,
    name: s.name,
    img: s.img || "systems/pf2e/icons/default-icons/spell.svg",
    glyph: parseActionCostInfo(s, null, { isSpell: true }).glyph,
    baseRank: s.rank ?? s.system.level?.value ?? 1,
    range: s.system.range?.value ?? "",
    target: s.system.target?.value ?? ""
  })).sort((a, b) => a.name.localeCompare(b.name));

  const renderTemplateFn = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  const content = await renderTemplateFn("modules/pf2e-mobile-compact/templates/parts/spell-picker-dialog.hbs", {
    rank: rank === 0 ? "Cantrips" : rank,
    slotNumber: slotIndex + 1,
    spells
  });

  let dialogInstance = null;
  let isSelecting = false;
  const onSelect = async (spellId) => {
    if (isSelecting) return;
    isSelecting = true;
    try {
      if (dialogInstance?.close) {
        await dialogInstance.close();
      }
      await prepareSlot(sheet.actor, entryId, rank, slotIndex, spellId);
      sheet.render({ parts: ["sheet"] });
    } finally {
      isSelecting = false;
    }
  };

  function attachPickerEvents(root) {
    if (!root) return;
    const searchInput = root.querySelector(".spell-picker-input");
    const items = root.querySelectorAll(".spell-picker-item");
    searchInput?.addEventListener("input", (e) => {
      const query = (e.target.value ?? "").toLowerCase().trim();
      for (const it of items) {
        const name = (it.dataset.spellName ?? "").toLowerCase();
        it.style.display = (!query || name.includes(query)) ? "" : "none";
      }
    });

    for (const it of items) {
      it.addEventListener("click", async (e) => {
        e.preventDefault();
        const sId = it.dataset.itemId || it.querySelector("[data-item-id]")?.dataset.itemId;
        if (sId) await onSelect(sId);
      });
    }
  }

  const DialogClass = foundry.applications?.api?.DialogV2 ?? Dialog;
  dialogInstance = new DialogClass({
    window: { title: `Prepare Spell - Rank ${rank === 0 ? "Cantrips" : rank}` },
    content,
    buttons: [{
      action: "cancel",
      label: "Cancel",
      icon: "fa-solid fa-times"
    }],
    actions: {
      confirmPrepareSpell: async (event, actionTarget) => {
        const spellId = actionTarget.dataset.itemId || actionTarget.closest("[data-item-id]")?.dataset.itemId;
        if (spellId) await onSelect(spellId);
      }
    },
    render: (event, html) => {
      const root = (html instanceof HTMLElement) ? html : html?.[0];
      attachPickerEvents(root);
    }
  });

  await dialogInstance.render(true);

  const dialogElement = dialogInstance.element instanceof HTMLElement ? dialogInstance.element : dialogInstance.element?.[0];
  attachPickerEvents(dialogElement);
}

/**
 * Action handler: unprepare a slot.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onUnprepareSlot(sheet, event, target) {
  const entryId = target.dataset.entryId;
  const rank = parseInt(target.dataset.rank, 10);
  const slotIndex = parseInt(target.dataset.slotIndex, 10);
  if (!entryId || isNaN(rank) || isNaN(slotIndex)) return;

  const entry = sheet.actor.spellcasting?.get(entryId);
  if (!entry) return;

  const groupId = rank === 0 ? "cantrips" : rank;
  const slotKey = `slot${rank}`;
  const currentPrepared = foundry.utils.deepClone(entry.system.slots?.[slotKey]?.prepared ?? []);
  const nextPrepared = Array.isArray(currentPrepared) ? currentPrepared : Object.values(currentPrepared);

  if (entry.system.slots?.[slotKey]?.prepared?.[slotIndex] && typeof entry.prepareSpell === "function") {
    await entry.prepareSpell(null, groupId, slotIndex);
  } else {
    while (nextPrepared.length <= slotIndex) {
      nextPrepared.push({ id: null, expended: false });
    }
    nextPrepared[slotIndex] = { id: null, expended: false };
    await entry.update({ [`system.slots.${slotKey}.prepared`]: nextPrepared });
  }
  sheet.render({ parts: ["sheet"] });
}

/**
 * Action handler: toggle expended state of a prepared slot.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onToggleSlotExpended(sheet, event, target) {
  event.preventDefault();
  event.stopPropagation();
  const entryId = target.dataset.entryId;
  const rank = parseInt(target.dataset.rank, 10);
  const slotIndex = parseInt(target.dataset.slotIndex, 10);
  if (!entryId || isNaN(rank) || isNaN(slotIndex)) return;

  const entry = sheet.actor.spellcasting?.get(entryId);
  if (!entry) return;

  const slotKey = `slot${rank}`;
  const currentPrepared = foundry.utils.deepClone(entry.system.slots?.[slotKey]?.prepared ?? []);
  const nextPrepared = Array.isArray(currentPrepared) ? currentPrepared : Object.values(currentPrepared);

  if (nextPrepared[slotIndex]) {
    const wasExpended = !!nextPrepared[slotIndex].expended;
    nextPrepared[slotIndex].expended = !wasExpended;
    const curVal = entry.system.slots?.[slotKey]?.value ?? 0;
    const maxVal = entry.system.slots?.[slotKey]?.max ?? 0;
    const nextVal = wasExpended ? Math.min(curVal + 1, maxVal) : Math.max(curVal - 1, 0);
    await entry.update({
      [`system.slots.${slotKey}.prepared`]: nextPrepared,
      [`system.slots.${slotKey}.value`]: nextVal
    });
  }
  sheet.render({ parts: ["sheet"] });
}

/**
 * Action handler: reset all expended slots and restore focus points.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onResetDailySpells(sheet, event, target) {
  let confirmed = false;
  if (foundry.applications?.api?.DialogV2?.confirm) {
    confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Daily Rest" },
      content: `<p>Take a daily rest for <strong>${sheet.actor.name}</strong>? This will restore all spell slots, focus points, and daily preparations.</p>`,
      rejectClose: false,
      modal: true
    }).catch(() => false);
  } else if (typeof Dialog?.confirm === "function") {
    confirmed = await Dialog.confirm({
      title: "Daily Rest",
      content: `<p>Take a daily rest for <strong>${sheet.actor.name}</strong>? This will restore all spell slots, focus points, and daily preparations.</p>`
    });
  } else {
    confirmed = window.confirm(`Take a daily rest for ${sheet.actor.name}? This will restore all spell slots, focus points, and daily preparations.`);
  }
  if (!confirmed) return;

  // Trigger PF2e's native restForTheNight if available for full rest benefits (HP, conditions, etc.)
  if (typeof game.pf2e?.actions?.restForTheNight === "function") {
    try {
      await game.pf2e.actions.restForTheNight({ actors: [sheet.actor] });
    } catch (err) {
      console.warn("PF2e Mobile Compact | PF2e native restForTheNight encountered error:", err);
    }
  }

  const entries = sheet.actor.spellcasting?.contents ?? [];
  for (const entry of entries) {
    const updates = {};
    for (let r = 0; r <= 10; r++) {
      const slotKey = `slot${r}`;
      const slotData = entry.system.slots?.[slotKey];
      if (slotData) {
        updates[`system.slots.${slotKey}.value`] = slotData.max ?? 0;
        if (slotData.prepared) {
          const prepared = foundry.utils.deepClone(slotData.prepared);
          const prepArr = Array.isArray(prepared) ? prepared : Object.values(prepared);
          for (const s of prepArr) {
            if (s) s.expended = false;
          }
          updates[`system.slots.${slotKey}.prepared`] = prepArr;
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      await entry.update(updates);
    }
  }

  const focus = sheet.actor.system.resources?.focus;
  if (focus && focus.max) {
    await sheet.actor.update({ "system.resources.focus.value": focus.max });
  }

  if (typeof game.dailies?.api?.setStaffChargesValue === "function") {
    try {
      game.dailies.api.setStaffChargesValue(sheet.actor);
    } catch {}
  }

  ui.notifications?.info?.("Daily rest complete: All spell slots and focus points restored.");
  sheet.render({ parts: ["sheet"] });
}

export {
  onSaveSpellPreset,
  onApplySpellPreset,
  onDeleteSpellPreset
} from "./spell-presets-handlers.js";

/**
 * Action handler: open compendium browser drawer.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onOpenCompendiumPicker(sheet, event, target) {
  const type = target.dataset.type ?? "spells";
  new CompendiumPickerApp(sheet.actor, {}, type).render(true);
}

/**
 * Action handler: adjust spell slots.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onAdjustSlot(sheet, event, target) {
  const rank = parseInt(target.dataset.rank, 10);
  const delta = parseInt(target.dataset.delta, 10);
  const entryId = target.dataset.entryId;
  if (isNaN(rank) || isNaN(delta) || !entryId) return;

  const entry = sheet.actor.spellcasting?.get(entryId);
  if (!entry) return;

  const rankKey = `slot${rank}`;
  const currentSlot = entry.system.slots?.[rankKey];
  if (currentSlot) {
    const current = currentSlot.value ?? 0;
    const max = currentSlot.max ?? 0;
    const nextVal = clamp(current + delta, 0, max);
    await entry.update({ [`system.slots.${rankKey}.value`]: nextVal });
    sheet.render({ parts: ["sheet"] });
  }
}

/**
 * Action handler: adjust focus points.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onAdjustFocus(sheet, event, target) {
  const delta = parseInt(target.dataset.delta, 10);
  if (isNaN(delta)) return;

  const focus = sheet.actor.system.resources?.focus;
  if (focus) {
    const current = focus.value ?? 0;
    const max = focus.max ?? 0;
    const nextVal = clamp(current + delta, 0, max);
    await sheet.actor.update({ "system.resources.focus.value": nextVal });
  }
}

/**
 * Action handler: cast spell.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onCastSpell(sheet, event, target) {
  const btn = target.closest(".btn-cast") || target;
  if (btn.classList.contains("disabled")) {
    const reason = btn.getAttribute("title");
    if (reason && !reason.startsWith("Cast ")) {
      ui.notifications?.warn?.(reason);
    } else {
      ui.notifications?.warn?.("Cannot cast spell: No available spell slots or resources.");
    }
    return;
  }

  const itemId = target.dataset.itemId;
  const entryId = target.dataset.entryId;
  const rank = parseInt(target.dataset.rank, 10);
  const slotIndex = target.dataset.slotIndex !== undefined ? parseInt(target.dataset.slotIndex, 10) : NaN;

  const entry = sheet.actor.spellcasting?.get(entryId);
  const spell = sheet.actor.items.get(itemId);
  if (!entry || !spell) return;

  // Resource validation
  const isCantrip = spell.isCantrip || rank === 0 || spell.system?.traits?.value?.includes("cantrip");
  if (!isCantrip) {
    const isPrepared = entry.isPrepared || entry.system?.prepared?.value === "prepared";
    const isSpontaneous = entry.isSpontaneous || entry.system?.prepared?.value === "spontaneous";
    const isFocus = entry.isFocusPool || spell.isFocusSpell || entry.system?.prepared?.value === "focus";
    const isInnate = entry.isInnate || spell.isInnate || entry.system?.prepared?.value === "innate";

    if (isPrepared && !isNaN(slotIndex)) {
      const slotKey = `slot${rank}`;
      const prepItem = entry.system?.slots?.[slotKey]?.prepared?.[slotIndex];
      if (prepItem?.expended) {
        ui.notifications?.warn?.("This prepared spell slot has already been expended.");
        return;
      }
    } else if (isFocus) {
      const curFocus = sheet.actor.system.resources?.focus?.value ?? 0;
      if (curFocus <= 0) {
        ui.notifications?.warn?.("No Focus Points remaining.");
        return;
      }
    } else if (isInnate) {
      const maxUses = spell.system?.uses?.max ?? 0;
      const curUses = spell.system?.uses?.value ?? 0;
      if (maxUses > 0 && curUses <= 0) {
        ui.notifications?.warn?.("No uses remaining for this innate spell.");
        return;
      }
    } else if (isSpontaneous && rank > 0) {
      const slotKey = `slot${rank}`;
      const curSlots = entry.system?.slots?.[slotKey]?.value ?? 0;
      if (curSlots <= 0) {
        ui.notifications?.warn?.(`No Rank ${rank} spell slots remaining.`);
        return;
      }
    }
  }

  // Target prompt for attacks, targets, areas, or ranges (supports multi-target AoE, heightened rank, and Self)
  let targetToken = null;
  const hasAttackTrait = spell.system.traits?.value?.includes("attack") || spell.traits?.has?.("attack");
  const isMultiOrArea = isMultiTargetOrAreaSpell(spell, rank);
  if (spell.system.target?.value || spell.system.range?.value || hasAttackTrait || isMultiOrArea) {
    targetToken = await resolveTargetsForSpell(sheet, spell, `Cast ${spell.name}`, { castRank: rank });
    if (targetToken === false) return; // Cancelled
  }

  if (targetToken?.id && !isMultiOrArea) {
    await setTargetToken(targetToken.id);
  }

  if (typeof entry.cast === "function") {
    await PhysicalDiceManager.withPhysicalMode({
      title: `Cast ${spell.name}`,
      target: targetToken,
      actor: sheet.actor
    }, async () => {
      // PF2e's CastOptions are { rank, slotId, consume, message, rollMode }. With consume (default true)
      // the system expends the prepared slot / spontaneous slot / focus point / innate use itself,
      // so no manual slot bookkeeping is done here.
      await entry.cast(spell, {
        rank: rank > 0 ? rank : undefined,
        slotId: Number.isNaN(slotIndex) ? undefined : slotIndex
      });
    }, sheet.rollMode === "physical");
  }

  sheet.render({ parts: ["sheet"] });
}

/**
 * Action handler: Roll damage (or healing) for a spell directly from its spell card
 * without expending spell slots, focus points, innate uses, or staff/wand charges.
 * Supports heightened ranks, overlay variants (e.g., 1/2/3-action Heal, Harm, Force Barrage),
 * inline @Damage fallback, and Physical Dice interception.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onRollSpellDamage(sheet, event, target) {
  event.preventDefault();
  event.stopPropagation();

  const actor = sheet.actor;
  const itemId = target.dataset.itemId;
  const entryId = target.dataset.entryId;
  const rawRank = parseInt(target.dataset.rank, 10);

  const entry = actor.spellcasting?.get(entryId);
  const entryCollection = actor.spellcasting?.collections?.get(entryId);

  let rawItem = entryCollection?.get(itemId)
    ?? entry?.spells?.get(itemId)
    ?? actor.items.get(itemId)
    ?? sheet._activeStaffSpells?.find(s => (s.id || s._id) === itemId);

  // If the item is a wand or scroll consumable, resolve its embedded spell document
  let spell = rawItem;
  if (rawItem && rawItem.type === "consumable") {
    spell = entry?.spells?.contents?.[0] ?? null;
    if (!spell && rawItem.system?.spell) {
      const ItemClass = getDocumentClass?.("Item") ?? Item;
      try {
        spell = new ItemClass(foundry.utils.deepClone(rawItem.system.spell), { parent: actor });
      } catch {
        spell = null;
      }
    }
  }

  if (!spell) {
    ui.notifications?.warn?.("Spell not found for damage roll.");
    return;
  }

  const isCantrip = spell.isCantrip || rawRank === 0 || spell.system?.traits?.value?.includes("cantrip");
  const defaultRank = isCantrip
    ? Math.max(1, Math.ceil((actor.level || 1) / 2))
    : (spell.rank ?? spell.system?.level?.value ?? 1);
  const castRank = (!isNaN(rawRank) && rawRank > 0) ? rawRank : defaultRank;

  // Check if the spell has multiple damage-bearing override overlays (e.g. Heal, Harm, Force Barrage)
  let selectedOverlayId = null;
  if (spell.overlays?.size > 0) {
    const damageOverlays = [];
    for (const [ovId, ov] of spell.overlays.entries()) {
      const ovDmgs = Object.values(ov?.system?.damage ?? {}).filter(d => d && (d.formula || d.value));
      const baseDmgs = Object.values(spell.system?.damage ?? {}).filter(d => d && (d.formula || d.value));
      if (ovDmgs.length > 0 || (ov?.overlayType === "override" && baseDmgs.length > 0)) {
        const costInfo = parseActionCostInfo(ov, null, { isSpell: true });
        const actionCost = ov?.system?.time?.value || costInfo.castActions || "";
        const formulaPreview = ovDmgs.map(d => d.formula || d.value).filter(Boolean).join(" + ");
        const baseName = ov.name || (actionCost ? `${spell.name} (${actionCost}-Action)` : spell.name);
        damageOverlays.push({
          slug: ovId,
          name: formulaPreview ? `${baseName} [${formulaPreview}]` : baseName,
          glyph: costInfo.glyph || (actionCost ? String(actionCost) : "")
        });
      }
    }
    if (damageOverlays.length > 1) {
      selectedOverlayId = await promptVariantSelection(sheet, `${spell.name} (Rank ${castRank} Damage)`, damageOverlays);
      if (selectedOverlayId === false) return; // Cancelled
    } else if (damageOverlays.length === 1) {
      selectedOverlayId = damageOverlays[0].slug;
    }
  }

  // Load heightened / overlay variant of the spell
  let variantSpell = spell;
  if (typeof spell.loadVariant === "function") {
    try {
      const loadOpts = { castRank };
      if (selectedOverlayId) loadOpts.overlayIds = [selectedOverlayId];
      variantSpell = spell.loadVariant(loadOpts) ?? spell;
    } catch {
      variantSpell = spell;
    }
  }
  if (variantSpell === spell && castRank > 0 && spell.rank !== castRank && typeof spell.clone === "function") {
    try {
      variantSpell = spell.clone({ "system.location.heightenedLevel": castRank }, { keepId: true });
    } catch {
      variantSpell = spell;
    }
  }

  // Target resolution (supports multi-target AoE and Self on variantSpell)
  const isMultiOrArea = isMultiTargetOrAreaSpell(variantSpell, castRank);
  const targetToken = await resolveTargetsForSpell(sheet, variantSpell, `${spell.name} (Damage)`, { castRank });
  if (targetToken === false) return; // Cancelled by user

  if (targetToken?.id && !isMultiOrArea) {
    await setTargetToken(targetToken.id);
  }

  const hasSystemDamage = Boolean(variantSpell.hasDamage) || Object.values(variantSpell.system?.damage ?? {}).some(d => d && (d.formula || d.value));

  await PhysicalDiceManager.withPhysicalMode({
    title: `${spell.name} (Rank ${castRank})`,
    subtitle: "Spell Damage Roll",
    target: targetToken,
    actor
  }, async () => {
    if (hasSystemDamage && typeof variantSpell.rollDamage === "function") {
      await variantSpell.rollDamage(event);
      return;
    }

    // Fallback: if the spell defines damage only via inline @Damage[...] links in its description
    const cardEl = target.closest(".spell-card");
    const inlineLinks = cardEl
      ? Array.from(cardEl.querySelectorAll(".action-description-content a.inline-roll[data-formula], .action-description-content a[data-damage-roll], .action-description-content a[data-pf2-damage-roll]"))
      : [];
    if (inlineLinks.length === 1) {
      inlineLinks[0].click();
      return;
    } else if (inlineLinks.length > 1) {
      const linkOptions = inlineLinks.map((link, idx) => ({
        slug: String(idx),
        name: (link.textContent || link.dataset.formula || `Damage Option ${idx + 1}`).trim()
      }));
      const chosenIdx = await promptVariantSelection(sheet, `${spell.name} (Damage)`, linkOptions);
      if (chosenIdx !== false && chosenIdx !== null) {
        const link = inlineLinks[Number(chosenIdx)];
        if (link) link.click();
      }
      return;
    }

    if (typeof variantSpell.rollDamage === "function") {
      await variantSpell.rollDamage(event);
    }
  }, sheet.rollMode === "physical");
}

/**
 * Action handler: Toggle signature state on a spontaneous spell.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onToggleSignatureSpell(sheet, event, target) {
  event.preventDefault();
  event.stopPropagation();
  const itemId = target.dataset.itemId;
  if (!itemId) return;

  const spell = sheet.actor.items.get(itemId);
  if (!spell) return;

  const currentSig = !!(spell.system.location?.signature || spell.isSignature);
  await spell.update({ "system.location.signature": !currentSig });
  ui.notifications?.info?.(`${spell.name} ${!currentSig ? "marked as signature spell" : "removed from signature spells"}.`);
  sheet.render();
}

/**
 * Action handler: Remove / delete a spell from character after confirmation.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onRemoveSpell(sheet, event, target) {
  event.preventDefault();
  event.stopPropagation();
  const itemId = target.dataset.itemId;
  if (!itemId) return;

  const spell = sheet.actor.items.get(itemId);
  if (!spell) return;

  const DialogClass = foundry.applications?.api?.DialogV2 ?? Dialog;
  let confirmed = false;

  if (DialogClass === foundry.applications?.api?.DialogV2) {
    confirmed = await DialogClass.confirm({
      window: { title: "Remove Spell" },
      content: `<p>Are you sure you want to remove <strong>${spell.name}</strong> from ${sheet.actor.name}?</p><p style="font-size:0.85rem; color:#a1a1aa;">This will delete the spell from your character's spell list.</p>`,
      yes: { label: "Remove", icon: "fa-solid fa-trash" },
      no: { label: "Cancel", icon: "fa-solid fa-xmark" },
      rejectClose: false
    });
  } else {
    confirmed = await new Promise(resolve => {
      new Dialog({
        title: "Remove Spell",
        content: `<p>Are you sure you want to remove <strong>${spell.name}</strong> from ${sheet.actor.name}?</p>`,
        buttons: {
          yes: { label: "Remove", callback: () => resolve(true) },
          no: { label: "Cancel", callback: () => resolve(false) }
        },
        default: "no",
        close: () => resolve(false)
      }).render(true);
    });
  }

  if (!confirmed) return;

  // Clear any prepared slots holding this spell
  const entries = sheet.actor.spellcasting?.contents ?? [];
  for (const entry of entries) {
    if (entry.isPrepared || entry.system?.prepared?.value === "prepared") {
      for (let r = 0; r <= 10; r++) {
        const slotKey = `slot${r}`;
        const prepared = entry.system.slots?.[slotKey]?.prepared;
        if (prepared) {
          const arr = Array.isArray(prepared) ? prepared : Object.values(prepared);
          const needsUpdate = arr.some(p => p?.id === itemId);
          if (needsUpdate) {
            const cleaned = arr.map(p => p?.id === itemId ? { id: null, expended: false } : p);
            await entry.update({ [`system.slots.${slotKey}.prepared`]: cleaned });
          }
        }
      }
    }
  }

  // Clean from expanded state set
  sheet._expandedActionIds?.delete?.(itemId);

  await spell.delete();
  ui.notifications?.info?.(`Removed ${spell.name} from ${sheet.actor.name}`);
  sheet.render();
}

