import { PhysicalDiceManager } from "../../rolls/physical-dice-interceptor.js";
import { setTargetToken } from "../../tokens/token-adapter.js";
import { resolveTargetForAction } from "./sheet-prompts.js";
import { clamp, getGlyph } from "../../utils/sheet-utils.js";
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
  const rank = parseInt(target.dataset.rank, 10);
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

  if (typeof entry.prepareSpell === "function") {
    await entry.prepareSpell(spell, rank, slotIndex);
  } else {
    const slotKey = `slot${rank}`;
    const currentPrepared = foundry.utils.deepClone(entry.system.slots?.[slotKey]?.prepared ?? []);
    const nextPrepared = Array.isArray(currentPrepared) ? currentPrepared : Object.values(currentPrepared);
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
    glyph: getGlyph(s.system.actions) || (s.system.actions?.value ? String(s.system.actions.value) : ""),
    baseRank: s.rank ?? s.system.level?.value ?? 1,
    range: s.system.range?.value ?? "",
    target: s.system.target?.value ?? ""
  })).sort((a, b) => a.name.localeCompare(b.name));

  const content = await renderTemplate("modules/pf2e-mobile-compact/templates/parts/spell-picker-dialog.hbs", {
    rank: rank === 0 ? "Cantrips" : rank,
    slotNumber: slotIndex + 1,
    spells
  });

  let dialogInstance = null;
  const onSelect = async (spellId) => {
    if (dialogInstance?.close) {
      await dialogInstance.close();
    }
    await prepareSlot(sheet.actor, entryId, rank, slotIndex, spellId);
    sheet.render({ parts: ["sheet"] });
  };

  const DialogClass = foundry.applications?.api?.DialogV2 ?? Dialog;
  dialogInstance = new DialogClass({
    window: { title: `Prepare Spell - Rank ${rank === 0 ? "Cantrips" : rank}` },
    content,
    buttons: [{
      action: "cancel",
      label: "Cancel",
      icon: "fa-solid fa-times"
    }],
    render: (event, html) => {
      const root = (html instanceof HTMLElement) ? html : html[0];
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
          const sId = it.dataset.itemId;
          if (sId) await onSelect(sId);
        });
      }
    }
  });

  dialogInstance.render(true);
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

  if (typeof entry.unprepareSpell === "function") {
    await entry.unprepareSpell(rank, slotIndex);
  } else {
    const slotKey = `slot${rank}`;
    const currentPrepared = foundry.utils.deepClone(entry.system.slots?.[slotKey]?.prepared ?? []);
    const nextPrepared = Array.isArray(currentPrepared) ? currentPrepared : Object.values(currentPrepared);
    nextPrepared[slotIndex] = null;
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

  ui.notifications?.info?.("Daily rest complete: All spell slots and focus points restored.");
  sheet.render({ parts: ["sheet"] });
}

/**
 * Action handler: save current prepared spells as a preset.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onSaveSpellPreset(sheet, event, target) {
  const name = await new Promise(resolve => {
    const DialogClass = foundry.applications?.api?.DialogV2 ?? Dialog;
    new DialogClass({
      window: { title: "Save Spell Preset" },
      content: `<div style="margin-bottom: 10px;">
        <label style="display:block; margin-bottom: 5px; font-weight: bold;">Preset Name:</label>
        <input type="text" id="preset-name-input" placeholder="e.g. Combat, Dungeon, Social" style="width: 100%; height: 40px;" autofocus />
      </div>`,
      buttons: [{
        action: "save",
        label: "Save",
        icon: "fa-solid fa-save",
        callback: (evt, btn, form) => {
          const root = btn?.closest(".window-content") ?? document;
          const input = root.querySelector("#preset-name-input");
          resolve(input?.value?.trim() || "Default Preset");
        }
      }, {
        action: "cancel",
        label: "Cancel",
        icon: "fa-solid fa-times",
        callback: () => resolve(null)
      }]
    }).render(true);
  });

  if (!name) return;

  const entries = sheet.actor.spellcasting?.contents ?? [];
  const loadout = [];
  for (const entry of entries) {
    if (entry.isPrepared || entry.system?.prepared?.value === "prepared") {
      for (let r = 0; r <= 10; r++) {
        const slotKey = `slot${r}`;
        const slotData = entry.system.slots?.[slotKey];
        if (slotData?.prepared) {
          const prepArr = Array.isArray(slotData.prepared) ? slotData.prepared : Object.values(slotData.prepared);
          prepArr.forEach((p, idx) => {
            if (p?.id) {
              loadout.push({
                entryId: entry.id,
                rank: r,
                slotIndex: idx,
                spellId: p.id
              });
            }
          });
        }
      }
    }
  }

  const existingPresets = sheet.actor.getFlag("pf2e-mobile-compact", "spellPresets") ?? [];
  const newPreset = {
    id: foundry.utils.randomID(),
    name,
    slots: loadout,
    createdAt: Date.now()
  };
  await sheet.actor.setFlag("pf2e-mobile-compact", "spellPresets", [...existingPresets, newPreset]);
  ui.notifications?.info?.(`Saved spell preset "${name}".`);
  sheet.render({ parts: ["sheet"] });
}

/**
 * Action handler: apply saved spell preset.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onApplySpellPreset(sheet, event, target) {
  const presetId = target.dataset.presetId;
  if (!presetId) return;
  const existingPresets = sheet.actor.getFlag("pf2e-mobile-compact", "spellPresets") ?? [];
  const preset = existingPresets.find(p => p.id === presetId);
  if (!preset) return;

  const entries = sheet.actor.spellcasting?.contents ?? [];
  for (const entry of entries) {
    if (entry.isPrepared || entry.system?.prepared?.value === "prepared") {
      const updates = {};
      for (let r = 0; r <= 10; r++) {
        const slotKey = `slot${r}`;
        const slotData = entry.system.slots?.[slotKey];
        if (slotData?.prepared) {
          const prepArr = Array.isArray(slotData.prepared) ? slotData.prepared : Object.values(slotData.prepared);
          const cleared = prepArr.map(() => null);
          updates[`system.slots.${slotKey}.prepared`] = cleared;
        }
      }
      if (Object.keys(updates).length > 0) {
        await entry.update(updates);
      }
    }
  }

  for (const item of preset.slots) {
    const entry = sheet.actor.spellcasting?.get(item.entryId);
    if (entry) {
      const slotKey = `slot${item.rank}`;
      const currentPrepared = foundry.utils.deepClone(entry.system.slots?.[slotKey]?.prepared ?? []);
      const nextPrepared = Array.isArray(currentPrepared) ? currentPrepared : Object.values(currentPrepared);
      nextPrepared[item.slotIndex] = { id: item.spellId, expended: false };
      await entry.update({ [`system.slots.${slotKey}.prepared`]: nextPrepared });
    }
  }

  ui.notifications?.info?.(`Loaded spell preset "${preset.name}".`);
  sheet.render({ parts: ["sheet"] });
}

/**
 * Action handler: delete saved spell preset.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onDeleteSpellPreset(sheet, event, target) {
  const presetId = target.dataset.presetId;
  if (!presetId) return;
  const existingPresets = sheet.actor.getFlag("pf2e-mobile-compact", "spellPresets") ?? [];
  const filtered = existingPresets.filter(p => p.id !== presetId);
  await sheet.actor.setFlag("pf2e-mobile-compact", "spellPresets", filtered);
  sheet.render({ parts: ["sheet"] });
}

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
  const itemId = target.dataset.itemId;
  const entryId = target.dataset.entryId;
  const rank = parseInt(target.dataset.rank, 10);
  const slotIndex = target.dataset.slotIndex !== undefined ? parseInt(target.dataset.slotIndex, 10) : NaN;

  const entry = sheet.actor.spellcasting?.get(entryId);
  const spell = sheet.actor.items.get(itemId);
  if (!entry || !spell) return;

  // Target prompt for attacks, targets, or ranges
  let targetToken = null;
  const hasAttackTrait = spell.system.traits?.value?.includes("attack") || spell.traits?.has?.("attack");
  if (spell.system.target?.value || spell.system.range?.value || hasAttackTrait) {
    targetToken = await resolveTargetForAction(sheet, `Cast ${spell.name}`);
    if (targetToken === false) return; // Cancelled
  }

  if (targetToken?.id) {
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

