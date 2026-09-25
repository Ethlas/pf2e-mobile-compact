import { PhysicalDiceManager } from "../../rolls/physical-dice-interceptor.js";
import { setTargetToken } from "../../tokens/token-adapter.js";
import { resolveTargetForAction } from "./sheet-prompts.js";
import { clamp } from "../../utils/sheet-utils.js";
import { isItemSpellcastingEntry } from "./context-activations.js";

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
    if (spell.system?.target?.value || spell.system?.range?.value || hasAttackTrait) {
      targetToken = await resolveTargetForAction(sheet, `Cast ${spell.name}`);
      if (targetToken === false) return; // Cancelled by user
    }
    if (targetToken?.id) {
      await setTargetToken(targetToken.id);
    }

    await PhysicalDiceManager.withPhysicalMode({
      title: `Cast ${spell.name}`,
      target: targetToken,
      actor
    }, async () => {
      if (typeof entry?.cast === "function") {
        await entry.cast(spell, { rank: 0, rollMode: sheet.rollMode });
      } else {
        await spell.toMessage(null, { data: { castRank: 0 } });
      }
    }, sheet.rollMode === "physical");
    sheet.render({ parts: ["sheet"] });
    return;
  }

  // 2. RESOLVE CURRENT STAFF CHARGES
  const dailiesApi = game.dailies?.api;
  let currentCharges = 0;
  let maxCharges = rank;
  let staffId = target.dataset.staffId || "staff";

  if (typeof dailiesApi?.getStaffData === "function") {
    const sData = dailiesApi.getStaffData(actor);
    if (sData?.charges) {
      currentCharges = Number(sData.charges.value ?? 0);
      maxCharges = Number(sData.charges.max ?? currentCharges);
      staffId = sData.staffId ?? staffId;
    }
  } else {
    const dailiesFlag = actor.getFlag?.("pf2e-dailies", "extra.dailies.staves");
    if (dailiesFlag?.charges) {
      currentCharges = Number(dailiesFlag.charges.value ?? 0);
      maxCharges = Number(dailiesFlag.charges.max ?? currentCharges);
      staffId = dailiesFlag.staffId ?? staffId;
    } else {
      staffId = staffId !== "staff" ? staffId : (entry?.id?.replace(/-casting$/, "") ?? "staff");
      const flagVal = actor.getFlag("pf2e-mobile-compact", `staffCharges-${staffId}`);
      currentCharges = typeof flagVal === "number" ? flagVal : maxCharges;
    }
  }

  // 3. RESOURCE & CHARGE VALIDATION (Must occur before targeting prompts)
  if (currentCharges < 1) {
    ui.notifications?.warn?.("No staff charges remaining. Staves require charges to cast spells.");
    return;
  }

  let chosenEntry = null;
  let chosenSlotKey = null;
  let chosenSlotRank = null;

  if (castMode === "spontaneous") {
    // Find eligible spontaneous spellcasting entries with an open slot of rank >= spell rank
    const spontaneousEntries = (actor.spellcasting?.contents ?? []).filter(e =>
      !isItemSpellcastingEntry(e, actor) && (e.isSpontaneous || e.system?.prepared?.value === "spontaneous")
    );

    // Search exact rank first, then higher ranks (PF2e Remaster rule)
    for (let r = rank; r <= 10; r++) {
      const slotKey = `slot${r}`;
      for (const sEntry of spontaneousEntries) {
        const slotData = sEntry.system?.slots?.[slotKey];
        if (slotData && slotData.value > 0) {
          chosenEntry = sEntry;
          chosenSlotKey = slotKey;
          chosenSlotRank = r;
          break;
        }
      }
      if (chosenEntry) break;
    }

    if (!chosenEntry || !chosenSlotKey) {
      ui.notifications?.warn?.(`No available Rank ${rank}+ spontaneous spell slots to expend.`);
      return;
    }
  } else {
    // Pure charges mode
    if (currentCharges < chargeCost) {
      ui.notifications?.warn?.(`Not enough staff charges (${currentCharges}/${chargeCost} required).`);
      return;
    }
  }

  // 4. TARGET RESOLUTION (Only prompted after passing resource checks)
  let targetToken = null;
  const hasAttackTrait = spell.system?.traits?.value?.includes("attack") || spell.traits?.has?.("attack");
  if (spell.system?.target?.value || spell.system?.range?.value || hasAttackTrait) {
    targetToken = await resolveTargetForAction(sheet, `Cast ${spell.name}`);
    if (targetToken === false) return; // Cancelled by user
  }

  if (targetToken?.id) {
    await setTargetToken(targetToken.id);
  }

  // 5. EXECUTE CAST
  if (castMode === "spontaneous") {
    await PhysicalDiceManager.withPhysicalMode({
      title: `Cast ${spell.name} (1 Charge + Slot)`,
      target: targetToken,
      actor
    }, async () => {
      if (typeof entry?.cast === "function") {
        await entry.cast(spell, {
          rank,
          rollMode: sheet.rollMode,
          spontaneous: {
            entryId: chosenEntry.id,
            slot: chosenSlotKey
          }
        });
      } else {
        // Fallback deduction
        if (typeof dailiesApi?.setStaffChargesValue === "function") {
          await dailiesApi.setStaffChargesValue(actor, Math.max(0, currentCharges - 1));
        } else {
          await actor.setFlag("pf2e-mobile-compact", `staffCharges-${staffId}`, Math.max(0, currentCharges - 1));
        }
        const curSlots = chosenEntry.system?.slots?.[chosenSlotKey]?.value ?? 1;
        await chosenEntry.update({ [`system.slots.${chosenSlotKey}.value`]: Math.max(0, curSlots - 1) });
        await spell.toMessage(null, { data: { castRank: rank } });
      }
    }, sheet.rollMode === "physical");

    ui.notifications?.info?.(`Expended 1 staff charge and 1 Rank ${chosenSlotRank} slot from ${chosenEntry.name}.`);
    sheet.render({ parts: ["sheet"] });
    return;
  }

  // Pure charges execution
  await PhysicalDiceManager.withPhysicalMode({
    title: `Cast ${spell.name} (${chargeCost} Charges)`,
    target: targetToken,
    actor
  }, async () => {
    if (typeof entry?.cast === "function") {
      await entry.cast(spell, { rank, rollMode: sheet.rollMode });
    } else {
      if (typeof dailiesApi?.setStaffChargesValue === "function") {
        await dailiesApi.setStaffChargesValue(actor, Math.max(0, currentCharges - chargeCost));
      } else {
        await actor.setFlag("pf2e-mobile-compact", `staffCharges-${staffId}`, Math.max(0, currentCharges - chargeCost));
      }
      await spell.toMessage(null, { data: { castRank: rank } });
    }
  }, sheet.rollMode === "physical");

  ui.notifications?.info?.(`Expended ${chargeCost} staff charges (Remaining: ${currentCharges - chargeCost}).`);
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
  const dailiesApi = game.dailies?.api;

  if (typeof dailiesApi?.getStaffData === "function" && typeof dailiesApi?.setStaffChargesValue === "function") {
    const sData = dailiesApi.getStaffData(actor);
    if (sData?.charges) {
      const current = Number(sData.charges.value ?? 0);
      const max = Number(sData.charges.max ?? current);
      const nextVal = clamp(current + delta, 0, max);
      await dailiesApi.setStaffChargesValue(actor, nextVal);
      sheet.render({ parts: ["sheet"] });
      return;
    }
  }

  // Fallback
  const targetStaffId = target.dataset.staffId;
  const dailiesFlag = actor.getFlag?.("pf2e-dailies", "extra.dailies.staves");
  const preparedStaffId = dailiesFlag?.staffId ?? targetStaffId;
  const staffItem = preparedStaffId ? (actor.items.get(preparedStaffId) ?? null) : actor.items.find(i => {
    const traits = i.system?.traits?.value ?? i.traits?.value ?? [];
    const traitList = Array.isArray(traits) ? traits : Array.from(traits);
    return traitList.some(t => String(t).toLowerCase() === "staff") || i.name.toLowerCase().includes("staff");
  });
  const staffId = staffItem?.id ?? targetStaffId ?? "default";
  const flagKey = `staffCharges-${staffId}`;
  const current = Number(actor.getFlag("pf2e-mobile-compact", flagKey) ?? 0);
  const nextVal = Math.max(0, current + delta);
  await actor.setFlag("pf2e-mobile-compact", flagKey, nextVal);
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
  const entry = entryId ? actor.spellcasting?.get(entryId) : null;
  const entrySpell = entry?.spells?.get(itemId) ?? entry?.spells?.contents?.[0] ?? null;

  if (!item && !entrySpell) {
    ui.notifications?.warn?.("Item or spell not found.");
    return;
  }

  // Target prompt
  const spellName = item?.system?.spell?.name ?? entrySpell?.name ?? item?.name ?? "Spell";
  const targetToken = await resolveTargetForAction(sheet, `Cast ${spellName}`);
  if (targetToken === false) return; // Cancelled

  if (targetToken?.id) {
    await setTargetToken(targetToken.id);
  }

  await PhysicalDiceManager.withPhysicalMode({
    title: `Cast ${spellName}`,
    target: targetToken,
    actor
  }, async () => {
    // If native PF2e consumable item, consume() handles chat, template, uses and deduction
    if (item && typeof item.consume === "function") {
      await item.consume();
      return;
    }

    // Ephemeral / item spellcasting entry fallback
    const spell = entrySpell ?? (item?.type === "spell" ? item : null);
    if (entry && spell && typeof entry.cast === "function") {
      await entry.cast(spell);
    } else if (spell && typeof spell.toMessage === "function") {
      await spell.toMessage();
    } else if (item && typeof item.toMessage === "function") {
      await item.toMessage();
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
  if (typeof dailiesApi?.openDailiesInterface === "function") {
    await dailiesApi.openDailiesInterface(sheet.actor);
  } else {
    ui.notifications?.info?.("PF2e Dailies module is not installed or active.");
  }
}

