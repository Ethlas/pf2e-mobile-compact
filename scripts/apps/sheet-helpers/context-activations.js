/**
 * Context preparation helper for Item Activations (Staves, Wands, Scrolls, and Activated Item Spells).
 */
import { formatSpell } from "./context-spells.js";
import { clamp, parseActionCostInfo } from "../../utils/sheet-utils.js";

/**
/**
 * Checks if a spellcasting entry is item-based, staff-based, or ephemeral.
 * @param {object} entry
 * @param {Actor} [actor]
 * @returns {boolean}
 */
export function isItemSpellcastingEntry(entry, actor = null) {
  if (!entry) return false;
  const category = String(entry.category ?? entry.system?.category ?? "").toLowerCase();
  const prepValue = String(entry.system?.prepared?.value ?? "").toLowerCase();
  const entryName = String(entry.name ?? "").toLowerCase();
  const entryId = String(entry.id ?? "");

  // 1. Explicit item, charges, or staff categories / preparation types
  if (category === "items" || category === "charges" || category === "staff") return true;
  if (prepValue === "staff" || prepValue === "items" || prepValue === "charges") return true;
  if (Boolean(entry.isEphemeral) || Boolean(entry.isStaff)) return true;

  // 2. Dailies and pf2e module flags
  if (Boolean(entry.flags?.["pf2e-dailies"]?.staff) || Boolean(entry.flags?.pf2e?.staff)) return true;

  // 3. Ephemeral / generated ID conventions (e.g. <itemId>-casting)
  if (entryId.endsWith("-casting")) return true;

  // 4. Name heuristics for staves, wands, scrolls
  if (entryName.includes("staff") || entryName.includes("wand") || entryName.includes("scroll")) {
    return true;
  }

  // 5. Match against physical inventory items on actor (if actor available)
  const act = actor ?? entry.actor;
  if (act?.items?.contents) {
    const hasMatchingItem = act.items.contents.some(i => {
      const traits = i.system?.traits?.value ?? i.traits?.value ?? [];
      const traitList = Array.isArray(traits) ? traits : Array.from(traits);
      const isStaffItem = traitList.some(t => String(t).toLowerCase() === "staff") || i.name.toLowerCase().includes("staff");
      if (isStaffItem) {
        return entryName.includes(i.name.toLowerCase()) || entryId.includes(i.id);
      }
      if (i.type === "consumable" && (i.system?.category === "wand" || i.system?.category === "scroll")) {
        return entryName.includes(i.name.toLowerCase()) || entryId.includes(i.id);
      }
      return false;
    });
    if (hasMatchingItem) return true;
  }

  return false;
}

/**
 * Helper to prepare context for the Activations sub-tab in Spells view.
 * @param {Actor} actor
 * @param {object} sheet
 * @param {object} context
 */
export async function prepareActivationsContext(actor, sheet, context) {
  const allEntries = actor.spellcasting?.contents ?? [];
  const items = actor.items?.contents ?? [];

  // ==========================================================
  // 1. PF2e STAVES ENGINE & CHARGES RESOLUTION
  // ==========================================================
  let staffData = null;

  // Attempt resolution via pf2e-dailies module API first
  const dailiesApi = game.dailies?.api;
  let dailiesStaffData = null;
  let dailiesStaffItem = null;
  if (typeof dailiesApi?.getStaffData === "function") {
    try {
      dailiesStaffData = dailiesApi.getStaffData(actor);
    } catch (err) {
      console.warn("PF2e Mobile Compact | Error reading pf2e-dailies staff data:", err);
    }
  }
  // Check actor flags for pf2e-dailies staff preparation if API returned nothing
  const dailiesFlag = actor.getFlag?.("pf2e-dailies", "extra.dailies.staves");
  if (!dailiesStaffData && dailiesFlag) {
    dailiesStaffData = dailiesFlag;
  }

  // Resolve the morning-prepared staff ID
  const preparedStaffId = dailiesStaffData?.staffId;

  // Resolve the physical staff item in actor inventory:
  // 1. Direct match with the morning-prepared staffId
  // 2. dailiesApi.getStaffItem(actor)
  // 3. Fallback to equipped/held staff in inventory
  // 4. Fallback to any staff in inventory
  let staffItem = preparedStaffId ? (actor.items.get(preparedStaffId) ?? null) : null;
  if (!staffItem && typeof dailiesApi?.getStaffItem === "function") {
    try {
      staffItem = dailiesApi.getStaffItem(actor);
    } catch {}
  }
  if (!staffItem) {
    const allStaves = items.filter(i => {
      const traits = i.system?.traits?.value ?? i.traits?.value ?? [];
      const traitList = Array.isArray(traits) ? traits : Array.from(traits);
      return traitList.some(t => String(t).toLowerCase() === "staff") || i.name.toLowerCase().includes("staff");
    });
    // Prefer staff currently held in hand
    staffItem = allStaves.find(i => (i.system?.equipped?.carryType ?? (i.isEquipped ? "held" : "stowed")) === "held")
      ?? allStaves[0]
      ?? null;
  }

  // Find associated charges or staff spellcasting entry specifically matching staffItem
  const staffEntry = allEntries.find(e => {
    if (staffItem) {
      if (e.id === `${staffItem.id}-casting` || e.id === staffItem.id) return true;
      if (e.flags?.["pf2e-dailies"]?.staff === staffItem.id || e.flags?.pf2e?.staff === staffItem.id) return true;
      if (e.name.toLowerCase().includes(staffItem.name.toLowerCase())) return true;
    }
    // Only match generic charges/staff entry if it doesn't belong to another specific staff item in inventory
    const cat = String(e.category ?? e.system?.category ?? "").toLowerCase();
    if (cat === "charges" || cat === "staff") {
      const belongsToOther = items.some(i => i.id !== staffItem?.id && (e.id === `${i.id}-casting` || e.name.toLowerCase().includes(i.name.toLowerCase())));
      return !belongsToOther;
    }
    return false;
  });

  if (staffItem || staffEntry || dailiesStaffData) {
    // Resolve Max and Current Charges
    let highestRank = Math.max(1, Math.ceil((actor.level || 1) / 2));
    for (const entry of allEntries) {
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

    const staffKeyId = staffItem?.id ?? preparedStaffId ?? "default";
    const flagVal = actor.getFlag("pf2e-mobile-compact", `staffCharges-${staffKeyId}`);
    const dailiesMax = Number(dailiesStaffData?.charges?.max ?? 0);
    const maxCharges = Math.max(dailiesMax, highestRank, 1);

    let currentCharges = maxCharges;
    if (dailiesStaffData?.charges && typeof dailiesStaffData.charges.value === "number") {
      currentCharges = clamp(Number(dailiesStaffData.charges.value), 0, maxCharges);
    } else if (typeof flagVal === "number" && !isNaN(flagVal)) {
      currentCharges = clamp(flagVal, 0, maxCharges);
    }

    // Check equipped status and hands held
    const carryType = staffItem?.system?.equipped?.carryType ?? (staffItem?.isEquipped ? "held" : "stowed");
    const handsHeld = staffItem?.system?.equipped?.handsHeld ?? (carryType === "held" ? 1 : 0);
    const isEquipped = carryType === "held" && handsHeld >= 1;

    // Detect spontaneous spellcasting entries for 1 Charge + Spell Slot rule (excluding item/staff entries)
    const spontaneousEntries = allEntries.filter(e =>
      !isItemSpellcastingEntry(e, actor) && (e.isSpontaneous || e.system?.prepared?.value === "spontaneous")
    );

    // Collect available spontaneous slots by rank (ranks 1 to 10)
    const availableSpontaneousSlots = new Map();
    for (const sEntry of spontaneousEntries) {
      for (let r = 1; r <= 10; r++) {
        const slotKey = `slot${r}`;
        const slotData = sEntry.system?.slots?.[slotKey];
        if (slotData && slotData.value > 0) {
          const list = availableSpontaneousSlots.get(r) ?? [];
          list.push({
            entryId: sEntry.id,
            entryName: sEntry.name,
            rank: r,
            slotKey,
            available: slotData.value
          });
          availableSpontaneousSlots.set(r, list);
        }
      }
    }

    // Enrich staff item description
    const TextEditorClass = foundry.applications?.ux?.TextEditor ?? globalThis.TextEditor;
    let rawStaffDesc = staffItem?.system?.description?.value ?? "";
    let enrichedStaffDesc = rawStaffDesc;
    if (rawStaffDesc && typeof TextEditorClass?.enrichHTML === "function") {
      try {
        enrichedStaffDesc = await TextEditorClass.enrichHTML(rawStaffDesc, {
          secrets: staffItem?.isOwner,
          rollData: actor.getRollData(),
          async: true
        });
      } catch {
        enrichedStaffDesc = rawStaffDesc;
      }
    }

    // Collect staff spells with strict priority given to morning preparation:
    // 1. pf2e-dailies morning-prepared spells for this staff
    // 2. Ephemeral spell collection strictly belonging to this staff item
    // 3. pf2e-dailies getSpells API for this specific staff item
    // 4. Physical staff item description HTML parser
    // 5. Existing staffEntry.spells strictly filtered to avoid spells from other staves
    let staffSpellDocs = [];
    const ItemClass = getDocumentClass?.("Item") ?? Item;
    const entryId = staffEntry?.id ?? `${staffItem?.id}-casting`;

    // Priority 1: Morning-prepared spells from pf2e-dailies
    if (Array.isArray(dailiesStaffData?.spells) && dailiesStaffData.spells.length > 0 && (!preparedStaffId || staffItem?.id === preparedStaffId)) {
      staffSpellDocs = dailiesStaffData.spells.map(source => {
        if (source instanceof Item) return source;
        const spellData = foundry.utils.mergeObject(source, { "system.location.value": entryId }, { inplace: false });
        return new ItemClass(spellData, { parent: actor });
      });
    }

    // Priority 2: Ephemeral collection specifically created for this staff item
    if (!staffSpellDocs.length && staffItem) {
      const staffCollection = actor.spellcasting?.collections?.get(`${staffItem.id}-casting`);
      if (staffCollection?.contents?.length) {
        staffSpellDocs = staffCollection.contents;
      }
    }

    // Priority 3: pf2e-dailies getSpells API for this specific staff item
    if (!staffSpellDocs.length && staffItem && typeof dailiesApi?.getSpells === "function") {
      try {
        const rawSpells = await dailiesApi.getSpells(staffItem, maxCharges, entryId);
        if (Array.isArray(rawSpells) && rawSpells.length > 0) {
          staffSpellDocs = rawSpells.map(source => (source instanceof Item ? source : new ItemClass(source, { parent: actor })));
        }
      } catch (e) {
        console.warn("PF2e Mobile Compact | Error in dailies getSpells:", e);
      }
    }

    // Priority 4: Parse staff description HTML for this specific staff item
    if (!staffSpellDocs.length && staffItem) {
      staffSpellDocs = await getSpellsFromStaffDescription(staffItem, maxCharges, entryId, actor);
    }

    // Priority 5: Existing staffEntry.spells, strictly filtered to exclude spells belonging to other staves
    if (!staffSpellDocs.length && staffEntry?.spells?.contents?.length) {
      staffSpellDocs = staffEntry.spells.contents.filter(spell => {
        const otherStaff = items.find(i => i.id !== staffItem?.id && (spell.system?.location?.value?.includes(i.id) || i.name.toLowerCase().includes(spell.name.toLowerCase())));
        return !otherStaff;
      });
    }

    // Cache active staff spells for casting execution lookup
    sheet._activeStaffSpells = staffSpellDocs;

    const staffRankBuckets = Array.from({ length: 11 }, (_, r) => ({
      rank: r,
      label: r === 0 ? "Cantrips" : `Rank ${r}`,
      isCollapsed: sheet._collapsedRankGroups?.has(`staff-${r}`),
      spells: []
    }));

    let totalStaffSpells = 0;
    for (const spell of staffSpellDocs) {
      const traits = spell.system?.traits?.value ?? spell.traits?.value ?? [];
      const traitLabels = Array.isArray(traits) ? traits.map(t => String(t?.value ?? t?.label ?? t).toLowerCase()) : [];
      const isCantrip = spell.isCantrip || traitLabels.includes("cantrip") || spell.system?.level?.value === 0;
      const spellRank = isCantrip ? 0 : (spell.system?.location?.heightenedLevel ?? spell.rank ?? spell.system?.level?.value ?? 1);
      const chargeCost = isCantrip ? 0 : spellRank;

      // Pure charges cast check (requires charges >= chargeCost)
      const canCastCharges = isCantrip ? true : currentCharges >= chargeCost;

      // In PF2e Remaster, a spontaneous caster can expend 1 charge and a slot of the spell's rank OR HIGHER
      let eligibleSpontSlots = [];
      if (!isCantrip) {
        for (let r = spellRank; r <= 10; r++) {
          const slotsAtRank = availableSpontaneousSlots.get(r) ?? [];
          if (slotsAtRank.length > 0) {
            eligibleSpontSlots.push(...slotsAtRank);
          }
        }
      }

      // Check if actor has any true spontaneous spellcasting capable of casting spells of this rank
      const hasSpontaneousForRank = spontaneousEntries.some(e => {
        for (let r = spellRank; r <= 10; r++) {
          if ((e.system?.slots?.[`slot${r}`]?.max ?? 0) > 0) return true;
        }
        return false;
      });

      // Remaster rule: spontaneous casting strictly requires at least 1 charge AND 1 available slot
      const canCastSpontaneous = !isCantrip && currentCharges >= 1 && eligibleSpontSlots.length > 0;

      let spontaneousDisabledReason = "";
      if (!isCantrip && hasSpontaneousForRank && !canCastSpontaneous) {
        if (currentCharges < 1) {
          spontaneousDisabledReason = "No staff charges remaining (requires at least 1 charge)";
        } else if (eligibleSpontSlots.length === 0) {
          spontaneousDisabledReason = `No available Rank ${spellRank}+ spontaneous slots`;
        }
      }

      const chargesDisabledReason = isCantrip ? "" : (canCastCharges ? "" : `Insufficient charges (requires ${chargeCost}, current ${currentCharges})`);

      const formatted = await formatSpell(actor, sheet, spell, staffEntry?.id ?? `${staffItem?.id}-casting`, {
        isCantrip,
        castRank: spellRank,
        chargeCost,
        currentCharges,
        canCastCharges,
        canCastSpontaneous,
        chargesDisabledReason,
        spontaneousDisabledReason,
        hasSpontaneousOption: hasSpontaneousForRank,
        spontaneousOptions: eligibleSpontSlots,
        cardKey: `staff-${spell.id || spell._id}-${spellRank}`
      });

      staffRankBuckets[spellRank].spells.push(formatted);
      totalStaffSpells++;
    }

    const sortByName = (a, b) => a.name.localeCompare(b.name);
    for (const b of staffRankBuckets) {
      b.spells.sort(sortByName);
    }

    const activeStaffRanks = staffRankBuckets.filter(b => b.spells.length > 0).map(b => ({
      ...b,
      spellCount: b.spells.length
    }));

    staffData = {
      id: staffItem?.id ?? "staff",
      cardKey: "staff-summary",
      name: staffItem?.name ?? staffEntry?.name ?? "Staff",
      img: staffItem?.img ?? staffEntry?.img ?? "systems/pf2e/icons/default-icons/weapon.svg",
      entryId: staffEntry?.id ?? `${staffItem?.id}-casting`,
      description: enrichedStaffDesc,
      isExpanded: sheet._expandedActionIds?.has("staff-summary"),
      charges: {
        value: currentCharges,
        max: maxCharges
      },
      isEquipped,
      handsHeld,
      ranks: activeStaffRanks,
      spellCount: totalStaffSpells
    };
  }

  // ==========================================================
  // 2. WANDS RESOLUTION
  // ==========================================================
  const wands = [];
  const wandItems = items.filter(i => i.type === "consumable" && i.system?.category === "wand");
  for (const wand of wandItems) {
    const spellData = wand.system?.spell;
    const uses = {
      value: Number(wand.system?.uses?.value ?? 1),
      max: Number(wand.system?.uses?.max ?? 1)
    };
    const isOvercharged = uses.value === 0;

    // Look for corresponding ephemeral casting entry
    const entryId = `${wand.id}-casting`;
    const wandEntry = allEntries.find(e => e.id === entryId);
    let formattedSpell = null;
    let spellDoc = wandEntry?.spells?.contents?.[0] ?? (spellData?.id ? actor.items.get(spellData.id) : null);
    if (!spellDoc && spellData) {
      const ItemClass = getDocumentClass?.("Item") ?? Item;
      try {
        spellDoc = new ItemClass(foundry.utils.deepClone(spellData), { parent: actor });
      } catch {
        spellDoc = null;
      }
    }
    const wandRank = wand.system?.level?.value ?? spellDoc?.rank ?? 1;
    if (spellDoc) {
      formattedSpell = await formatSpell(actor, sheet, spellDoc, entryId, {
        castRank: wandRank,
        cardKey: `wand-${wand.id}-${spellDoc.id}`
      });
    }

    const wandSpellCost = parseActionCostInfo(spellDoc ?? spellData ?? wand, null, { isSpell: true });

    wands.push({
      id: wand.id,
      name: wand.name,
      img: wand.img || "systems/pf2e/icons/default-icons/consumable.svg",
      rank: wandRank,
      uses,
      isOvercharged,
      spell: formattedSpell,
      // The spell's own count (empty for reactions / free actions); "2" only when there is no spell
      castActions: formattedSpell ? formattedSpell.castActions : (wandSpellCost.castActions || "2"),
      entryId: wandEntry?.id ?? entryId
    });
  }

  // ==========================================================
  // 3. SCROLLS RESOLUTION
  // ==========================================================
  const scrolls = [];
  const scrollItems = items.filter(i => i.type === "consumable" && i.system?.category === "scroll");
  for (const scroll of scrollItems) {
    const quantity = Number(scroll.system?.quantity ?? 1);
    const entryId = `${scroll.id}-casting`;
    const scrollEntry = allEntries.find(e => e.id === entryId);
    const scrollSpellData = scroll.system?.spell;
    let spellDoc = scrollEntry?.spells?.contents?.[0] ?? (scrollSpellData?.id ? actor.items.get(scrollSpellData.id) : null);
    if (!spellDoc && scrollSpellData) {
      const ItemClass = getDocumentClass?.("Item") ?? Item;
      try {
        spellDoc = new ItemClass(foundry.utils.deepClone(scrollSpellData), { parent: actor });
      } catch {
        spellDoc = null;
      }
    }
    const scrollRank = scroll.system?.level?.value ?? spellDoc?.rank ?? 1;
    let formattedSpell = null;
    if (spellDoc) {
      formattedSpell = await formatSpell(actor, sheet, spellDoc, entryId, {
        castRank: scrollRank,
        cardKey: `scroll-${scroll.id}-${spellDoc.id}`
      });
    }
    const scrollSpellCost = parseActionCostInfo(spellDoc ?? scroll.system?.spell ?? scroll, null, { isSpell: true });

    scrolls.push({
      id: scroll.id,
      name: scroll.name,
      img: scroll.img || "systems/pf2e/icons/default-icons/consumable.svg",
      rank: scrollRank,
      quantity,
      spell: formattedSpell,
      castActions: formattedSpell ? formattedSpell.castActions : (scrollSpellCost.castActions || "2"),
      entryId: scrollEntry?.id ?? entryId
    });
  }

  // ==========================================================
  // 4. OTHER ACTIVATED ITEM SPELLS
  // ==========================================================
  const otherActivations = [];
  const otherItemEntries = allEntries.filter(e => {
    if (!isItemSpellcastingEntry(e)) return false;
    if (staffData?.entryId && e.id === staffData.entryId) return false;
    if (wands.some(w => w.entryId === e.id)) return false;
    if (scrolls.some(s => s.entryId === e.id)) return false;
    return true;
  });

  for (const entry of otherItemEntries) {
    for (const spell of entry.spells?.contents ?? []) {
      const formatted = await formatSpell(actor, sheet, spell, entry.id, {
        cardKey: `item-${entry.id}-${spell.id}`
      });
      otherActivations.push({
        id: spell.id,
        entryName: entry.name,
        entryId: entry.id,
        spell: formatted
      });
    }
  }

  // ==========================================================
  // 5. AGGREGATE ACTIVATIONS CONTEXT
  // ==========================================================
  const totalActivations = (staffData?.spellCount ?? 0) + wands.length + scrolls.length + otherActivations.length;
  const hasActivations = Boolean(staffData || wands.length > 0 || scrolls.length > 0 || otherActivations.length > 0);

  context.activations = {
    staff: staffData,
    wands,
    scrolls,
    other: otherActivations
  };
  context.hasActivations = hasActivations;
  context.activationsCount = totalActivations;
  context.hasDailies = Boolean(game.modules?.get("pf2e-dailies")?.active);

  // Validate active subtab
  if (sheet._spellSubTab === "activations" && !hasActivations) {
    sheet._spellSubTab = "spells";
    context.spellSubTab = "spells";
  } else if (sheet._spellSubTab === "activations") {
    context.spellSubTab = "activations";
  }
}

/**
 * Fallback parser that extracts staff spells by inspecting the staff item's HTML description.
 * Remaster PF2e staves list spells in the last <ul> of their description formatted like:
 * - Cantrip: @UUID[...]
 * - 1st: @UUID[...]
 * - 2nd: @UUID[...]
 *
 * @param {Item} staffItem
 * @param {number} maxRank
 * @param {string} entryId
 * @param {Actor} actor
 * @returns {Promise<Item[]>}
 */
export async function getSpellsFromStaffDescription(staffItem, maxRank, entryId, actor) {
  if (!staffItem) return [];
  const rawDesc = staffItem.system?.description?.value ?? staffItem.description ?? "";
  if (!rawDesc) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawDesc, "text/html");
  const uls = doc.querySelectorAll("ul");
  const lastUl = uls[uls.length - 1];
  if (!lastUl) return [];

  const uuidRegex = /@(uuid|compendium)\[([a-z0-9._-]+)\]/gi;
  const rankRegex = /\d+/;
  const spellEntries = [];

  for (const li of lastUl.querySelectorAll("li")) {
    const text = li.textContent ?? "";
    const prefix = (li.firstChild?.textContent ?? "").split("@")[0].toLowerCase();
    let rank = 0;
    if (prefix.includes("cantrip")) {
      rank = 0;
    } else {
      const match = prefix.match(rankRegex);
      rank = match ? Number(match[0]) : 0;
    }

    if (rank > maxRank) continue;

    for (const match of text.matchAll(uuidRegex)) {
      const isCompendium = match[1].toLowerCase() === "compendium";
      const uuid = isCompendium ? `Compendium.${match[2]}` : match[2];
      spellEntries.push({ rank, uuid });
    }
  }

  const ItemClass = getDocumentClass?.("Item") ?? Item;
  const spellDocs = await Promise.all(spellEntries.map(async ({ rank, uuid }) => {
    try {
      const sourceSpell = await fromUuid(uuid);
      if (!sourceSpell || sourceSpell.type !== "spell") return null;
      const spellData = sourceSpell.toObject();
      spellData._id = foundry.utils.randomID();
      if (!spellData.system) spellData.system = {};
      if (!spellData.system.location) spellData.system.location = {};
      spellData.system.location.value = entryId;
      if (!sourceSpell.isCantrip && rank > 0) {
        spellData.system.location.heightenedLevel = rank;
      }
      return new ItemClass(spellData, { parent: actor });
    } catch (err) {
      console.warn(`PF2e Mobile Compact | Failed to resolve staff spell from UUID ${uuid}:`, err);
      return null;
    }
  }));

  return spellDocs.filter(Boolean);
}

