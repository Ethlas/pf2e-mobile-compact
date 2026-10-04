import { PhysicalDiceManager } from "../../rolls/physical-dice-interceptor.js";
import { setTargetToken } from "../../tokens/token-adapter.js";
import { resolveTargetsForSpell, isMultiTargetOrAreaSpell, promptSpontaneousSlotSelection } from "./sheet-prompts.js";
import { clamp } from "../../utils/sheet-utils.js";
import { isItemSpellcastingEntry } from "./context-activations.js";

/**
 * Helper to resolve and persist staff charges across both pf2e-mobile-compact flags and pf2e-dailies.
 * @param {Actor} actor
 * @param {string} [hintStaffId]
 */
function resolveActorStaffCharges(actor, hintStaffId) {
  const dailiesApi = game.dailies?.api;
  let dailiesData = null;
  if (typeof dailiesApi?.getStaffData === "function") {
    try {
      dailiesData = dailiesApi.getStaffData(actor);
    } catch {}
  }
  const dailiesFlag = actor.getFlag?.("pf2e-dailies", "extra.dailies.staves");
  if (!dailiesData && dailiesFlag) dailiesData = dailiesFlag;

  let highestRank = Math.max(1, Math.ceil((actor.level || 1) / 2));
  for (const entry of (actor.spellcasting?.contents ?? [])) {
    if (isItemSpellcastingEntry(entry, actor)) continue;
    const entryHighest = typeof entry.highestRank === "number" ? entry.highestRank : 0;
    if (entryHighest > highestRank) highestRank = entryHighest;
    for (let r = 10; r >= 1; r--) {
      if ((entry.system?.slots?.[`slot${r}`]?.max ?? 0) > 0) {
        highestRank = Math.max(highestRank, r);
        break;
      }
    }
  }

  let staffItem = (hintStaffId && hintStaffId !== "staff") ? actor.items.get(hintStaffId) : null;
  if (!staffItem && dailiesData?.staffId) {
    staffItem = actor.items.get(dailiesData.staffId) ?? null;
  }
  if (!staffItem) {
    staffItem = actor.items.find(i => {
      const traits = i.system?.traits?.value ?? i.traits?.value ?? [];
      const traitList = Array.isArray(traits) ? traits : Array.from(traits);
      return traitList.some(t => String(t).toLowerCase() === "staff") || i.name.toLowerCase().includes("staff");
    }) ?? null;
  }

  const staffId = staffItem?.id ?? dailiesData?.staffId ?? ((hintStaffId && hintStaffId !== "staff") ? hintStaffId : "default");
  const flagKey = `staffCharges-${staffId}`;
  const flagVal = actor.getFlag("pf2e-mobile-compact", flagKey);
  const dailiesMax = Number(dailiesData?.charges?.max ?? 0);
  const maxCharges = Math.max(dailiesMax, highestRank, 1);

  let currentCharges = maxCharges;
  if (dailiesData?.charges && typeof dailiesData.charges.value === "number") {
    currentCharges = clamp(Number(dailiesData.charges.value), 0, maxCharges);
  } else if (typeof flagVal === "number" && !isNaN(flagVal)) {
    currentCharges = clamp(flagVal, 0, maxCharges);
  }

  return { staffId, flagKey, currentCharges, maxCharges, dailiesApi, dailiesData };
}

/**
 * Persist updated staff charge value across all active stores.
 */
async function setActorStaffCharges(actor, staffInfo, nextVal) {
  const max = Math.max(1, staffInfo.maxCharges);
  const clamped = clamp(nextVal, 0, max);
  await actor.setFlag("pf2e-mobile-compact", staffInfo.flagKey, clamped);

  const dailiesFlag = actor.getFlag?.("pf2e-dailies", "extra.dailies.staves");
  if (dailiesFlag?.charges || staffInfo.dailiesData?.charges) {
    try {
      await actor.update({
        "flags.pf2e-dailies.extra.dailies.staves.charges.value": clamped,
        "flags.pf2e-dailies.extra.dailies.staves.charges.max": Math.max(Number(dailiesFlag?.charges?.max ?? 0), max)
      });
    } catch {
      if (typeof staffInfo.dailiesApi?.setStaffChargesValue === "function") {
        try {
          await staffInfo.dailiesApi.setStaffChargesValue(actor, clamped);
        } catch {}
      }
    }
  } else if (typeof staffInfo.dailiesApi?.setStaffChargesValue === "function") {
    try {
      await staffInfo.dailiesApi.setStaffChargesValue(actor, clamped);
    } catch {}
  }
  return clamped;
}

/**
 * Action handler: Cast a spell from a Staff (Cantrip, Pure Charges, or 1 Charge + Spontaneous Slot).
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onCastStaffSpell(sheet, event, target) {
  const actor = sheet.actor;
  const itemId = target.dataset.itemId;
  const entryId = target.dataset.entryId;
  const rank = parseInt(target.dataset.rank, 10);
  const chargeCost = parseInt(target.dataset.chargeCost, 10) || rank;
  const castMode = target.dataset.castMode || "charges";

  const entry = actor.spellcasting?.get(entryId);
  const entryCollection = actor.spellcasting?.collections?.get(entryId);
  const spell = entryCollection?.get(itemId)
    ?? entry?.spells?.get(itemId)
    ?? actor.items.get(itemId)
    ?? sheet._activeStaffSpells?.find(s => (s.id || s._id) === itemId);

  if (!spell) {
    ui.notifications?.warn?.("Spell not found.");
    return;
  }

  // 1. CANTRIPS (0 charges, cast at will)
  if (rank === 0 || spell.isCantrip) {
    let targetToken = null;
    const hasAttackTrait = spell.system?.traits?.value?.includes("attack") || spell.traits?.has?.("attack");
    const isMultiOrArea = isMultiTargetOrAreaSpell(spell);
    if (spell.system?.target?.value || spell.system?.range?.value || hasAttackTrait || isMultiOrArea) {
      targetToken = await resolveTargetsForSpell(sheet, spell, `Cast ${spell.name}`);
      if (targetToken === false) return; // Cancelled by user
    }
    if (targetToken?.id && !isMultiOrArea) {
      await setTargetToken(targetToken.id);
    }

    await PhysicalDiceManager.withPhysicalMode({
      title: `Cast ${spell.name}`,
      target: targetToken,
      actor
    }, async () => {
      await spell.toMessage(null, { actualCast: true, rollMode: sheet.rollMode, data: { castRank: 0 } });
    }, sheet.rollMode === "physical");
    sheet.render({ parts: ["sheet"] });
    return;
  }

  // 2. RESOLVE CURRENT STAFF CHARGES
  const staffInfo = resolveActorStaffCharges(actor, target.dataset.staffId);
  const { currentCharges } = staffInfo;

  // 3. RESOURCE & CHARGE VALIDATION (Must occur before targeting prompts)
  if (currentCharges < 1) {
    ui.notifications?.warn?.("No staff charges remaining. Staves require charges to cast spells.");
    return;
  }

  let selectedSpontSlot = null;

  if (castMode === "spontaneous") {
    // Collect all eligible spontaneous spell slots of rank >= spell rank
    const spontaneousEntries = (actor.spellcasting?.contents ?? []).filter(e =>
      !isItemSpellcastingEntry(e, actor) && (e.isSpontaneous || e.system?.prepared?.value === "spontaneous")
    );

    const eligibleSlots = [];
    for (let r = rank; r <= 10; r++) {
      const slotKey = `slot${r}`;
      for (const sEntry of spontaneousEntries) {
        const slotData = sEntry.system?.slots?.[slotKey];
        if (slotData && slotData.max > 0 && slotData.value > 0) {
          eligibleSlots.push({
            entry: sEntry,
            entryId: sEntry.id,
            entryName: sEntry.name,
            slotKey,
            rank: r,
            available: Number(slotData.value),
            max: Number(slotData.max)
          });
        }
      }
    }

    if (eligibleSlots.length === 0) {
      ui.notifications?.warn?.(`No available Rank ${rank}+ spontaneous spell slots to expend.`);
      return;
    }

    // Prompt user to explicitly choose which spontaneous slot to expend, or cancel
    selectedSpontSlot = await promptSpontaneousSlotSelection(sheet, spell.name, rank, eligibleSlots);
    if (!selectedSpontSlot) {
      // User cancelled slot selection — fully cancel the cast process
      return;
    }
  } else {
    // Pure charges mode — never prompt for spontaneous slots
    if (currentCharges < chargeCost) {
      ui.notifications?.warn?.(`Not enough staff charges (${currentCharges}/${chargeCost} required).`);
      return;
    }
  }

  // 4. TARGET RESOLUTION (Only prompted after passing resource & slot selection checks)
  let targetToken = null;
  const effectiveRank = selectedSpontSlot?.rank ?? rank;
  const hasAttackTrait = spell.system?.traits?.value?.includes("attack") || spell.traits?.has?.("attack");
  const isMultiOrArea = isMultiTargetOrAreaSpell(spell, effectiveRank);
  if (spell.system?.target?.value || spell.system?.range?.value || hasAttackTrait || isMultiOrArea) {
    targetToken = await resolveTargetsForSpell(sheet, spell, `Cast ${spell.name}`, { castRank: effectiveRank });
    if (targetToken === false) return; // Cancelled by user
  }

  if (targetToken?.id && !isMultiOrArea) {
    await setTargetToken(targetToken.id);
  }

  // 5. EXECUTE CAST (Directly deduct charges/slots and post spell message so pf2e-dailies never pops its own dialog)
  if (castMode === "spontaneous" && selectedSpontSlot) {
    await PhysicalDiceManager.withPhysicalMode({
      title: `Cast ${spell.name} (1 Charge + Rank ${selectedSpontSlot.rank} Slot)`,
      target: targetToken,
      actor
    }, async () => {
      const curSlots = selectedSpontSlot.entry.system?.slots?.[selectedSpontSlot.slotKey]?.value ?? selectedSpontSlot.available;
      await selectedSpontSlot.entry.update({
        [`system.slots.${selectedSpontSlot.slotKey}.value`]: Math.max(0, curSlots - 1)
      });
      await setActorStaffCharges(actor, staffInfo, currentCharges - 1);
      await spell.toMessage(null, { actualCast: true, rollMode: sheet.rollMode, data: { castRank: rank } });
    }, sheet.rollMode === "physical");

    ui.notifications?.info?.(`Expended 1 staff charge and 1 Rank ${selectedSpontSlot.rank} slot from ${selectedSpontSlot.entryName}.`);
    sheet.render({ parts: ["sheet"] });
    return;
  }

  // Pure charges execution (no spontaneous prompt!)
  let remainingCharges = Math.max(0, currentCharges - chargeCost);
  await PhysicalDiceManager.withPhysicalMode({
    title: `Cast ${spell.name} (${chargeCost} Charges)`,
    target: targetToken,
    actor
  }, async () => {
    remainingCharges = await setActorStaffCharges(actor, staffInfo, currentCharges - chargeCost);
    await spell.toMessage(null, { actualCast: true, rollMode: sheet.rollMode, data: { castRank: rank } });
  }, sheet.rollMode === "physical");

  ui.notifications?.info?.(`Expended ${chargeCost} staff charges (Remaining: ${remainingCharges}).`);
  sheet.render({ parts: ["sheet"] });
}

/**
 * Action handler: Adjust staff charges by a delta (+1 or -1).
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onAdjustStaffCharges(sheet, event, target) {
  event.preventDefault();
  event.stopPropagation();
  const delta = parseInt(target.dataset.delta, 10);
  if (isNaN(delta)) return;

  const actor = sheet.actor;
  const staffInfo = resolveActorStaffCharges(actor, target.dataset.staffId);

  const domCurrent = parseInt(target.dataset.current, 10);
  const domMax = parseInt(target.dataset.max, 10);
  const current = !isNaN(domCurrent) ? domCurrent : staffInfo.currentCharges;
  const max = !isNaN(domMax) && domMax > 0 ? Math.max(domMax, staffInfo.maxCharges) : staffInfo.maxCharges;
  staffInfo.maxCharges = max;

  const nextVal = clamp(current + delta, 0, max);
  await setActorStaffCharges(actor, staffInfo, nextVal);
  sheet.render({ parts: ["sheet"] });
}

/**
 * Action handler: Cast an item spell from a Wand, Scroll, or other activated item.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onCastItemSpell(sheet, event, target) {
  const actor = sheet.actor;
  const itemId = target.dataset.itemId;
  const itemType = target.dataset.itemType;
  const entryId = target.dataset.entryId;

  const item = actor.items.get(itemId);
  if (!item) {
    ui.notifications?.warn?.("Item not found.");
    return;
  }

  // Target prompt (supports AoE multi-target and Self)
  const embeddedSpell = item.system?.spell ?? actor.spellcasting?.get(entryId)?.spells?.contents?.[0] ?? item;
  const spellName = item.system?.spell?.name ?? item.name;
  const isMultiOrArea = isMultiTargetOrAreaSpell(embeddedSpell);
  const targetToken = await resolveTargetsForSpell(sheet, embeddedSpell, `Cast ${spellName}`);
  if (targetToken === false) return; // Cancelled

  if (targetToken?.id && !isMultiOrArea) {
    await setTargetToken(targetToken.id);
  }

  await PhysicalDiceManager.withPhysicalMode({
    title: `Cast ${spellName}`,
    target: targetToken,
    actor
  }, async () => {
    // If native PF2e consumable item, consume() handles chat, template, uses and deduction
    if (typeof item.consume === "function") {
      await item.consume();
      return;
    }

    // Ephemeral entry fallback
    const entry = actor.spellcasting?.get(entryId);
    const spell = entry?.spells?.contents?.[0];
    if (entry && spell && typeof entry.cast === "function") {
      await entry.cast(spell);
    } else if (spell && typeof spell.toMessage === "function") {
      await spell.toMessage();
    }
  }, sheet.rollMode === "physical");

  sheet.render({ parts: ["sheet"] });
}

/**
 * Action handler: Launch the pf2e-dailies preparation interface.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onOpenDailies(sheet, event, target) {
  const dailiesApi = game.dailies?.api;
  if (typeof dailiesApi?.openDailiesInterface !== "function") {
    ui.notifications?.info?.("PF2e Dailies module is not installed or active.");
  } else if (dailiesApi.canPrepareDailies?.(sheet.actor) === false) {
    // pf2e-dailies opens nothing (and says nothing) until the character has rested since the last preparation
    ui.notifications?.info?.(`${sheet.actor.name} must Rest for the Night before preparing dailies again.`);
  } else {
    await dailiesApi.openDailiesInterface(sheet.actor);
  }
}

