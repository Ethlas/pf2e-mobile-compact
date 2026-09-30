/**
 * Context preparation helper for Spells (Cast View and Preparation View).
 */
import { parseActionCostInfo } from "../../utils/sheet-utils.js";
import { isItemSpellcastingEntry } from "./context-activations.js";

/**
 * Format spell item details.
 * @param {Actor} actor
 * @param {object} sheet
 * @param {ItemPF2e} spell
 * @param {string} entryId
 * @param {object} [extra]
 * @returns {Promise<object>}
 */
export async function formatSpell(actor, sheet, spell, entryId, extra = {}) {
  const TextEditorClass = foundry.applications?.ux?.TextEditor ?? globalThis.TextEditor;
  const traits = (spell.system?.traits?.value ?? spell.traits?.value ?? []).map(t => ({ label: String(t) }));
  const costInfo = parseActionCostInfo(spell, null, { isSpell: true });
  const glyph = costInfo.glyph;
  // Already "2" for spells without a clear action count; empty for reaction and free-action spells
  const castActions = costInfo.castActions;
  const isAttack = traits.some(t => t.label.toLowerCase() === "attack") || spell.traits?.has?.("attack");

  const entry = actor.spellcasting?.get(entryId);
  const isSpontaneous = extra.isSpontaneous ?? (entry?.isSpontaneous || entry?.system?.prepared?.value === "spontaneous");
  const isCantrip = spell.isCantrip || traits.some(t => t.label.toLowerCase() === "cantrip") || spell.system?.level?.value === 0 || extra.castRank === 0;
  const isFocus = extra.isFocus ?? (spell.isFocusSpell || traits.some(t => t.label.toLowerCase() === "focus"));
  const isInnate = extra.isInnate ?? (entry?.isInnate || entry?.system?.prepared?.value === "innate" || spell.isInnate);
  const isRitual = spell.isRitual || traits.some(t => t.label.toLowerCase() === "ritual");
  const isSignature = !!(spell.system?.location?.signature || spell.isSignature);
  const canSignature = isSpontaneous && !isCantrip && !isFocus && !isRitual;

  // Resolve effective heightened rank for damage & rollData
  const defaultRank = isCantrip
    ? Math.max(1, Math.ceil((actor.level || 1) / 2))
    : (spell.rank ?? spell.system?.level?.value ?? 1);
  const effectiveCastRank = (extra.castRank && extra.castRank > 0) ? extra.castRank : defaultRank;

  let variantSpell = spell;
  if (typeof spell.loadVariant === "function") {
    try {
      variantSpell = spell.loadVariant({ castRank: effectiveCastRank }) ?? spell;
    } catch {
      variantSpell = spell;
    }
  }
  if (variantSpell === spell && effectiveCastRank > 0 && spell.rank !== effectiveCastRank && typeof spell.clone === "function") {
    try {
      variantSpell = spell.clone({ "system.location.heightenedLevel": effectiveCastRank }, { keepId: true });
    } catch {
      variantSpell = spell;
    }
  }

  let rawDescription = variantSpell.system?.description?.value ?? spell.system?.description?.value ?? "";
  let enrichedDescription = rawDescription;
  if (rawDescription && typeof TextEditorClass?.enrichHTML === "function") {
    try {
      const rollData = typeof variantSpell.getRollData === "function"
        ? variantSpell.getRollData()
        : actor.getRollData();
      enrichedDescription = await TextEditorClass.enrichHTML(rawDescription, {
        secrets: spell.isOwner,
        rollData,
        async: true
      });
    } catch {
      enrichedDescription = rawDescription;
    }
  }

  // Detect spell damage / healing capabilities (system.damage, overlays, or inline @Damage tags)
  const rawDamageMap = variantSpell.system?.damage ?? spell.system?.damage ?? {};
  const damageEntries = Object.values(rawDamageMap).filter(d => d && (d.formula || d.value));

  const overlayDamageEntries = [];
  if (spell.overlays?.size > 0) {
    for (const ov of spell.overlays.values()) {
      const ovDmgs = Object.values(ov?.system?.damage ?? {}).filter(d => d && (d.formula || d.value));
      if (ovDmgs.length > 0) {
        overlayDamageEntries.push(...ovDmgs);
      }
    }
  }

  const hasInlineDamage = /@Damage\[([^\]]+)\]/i.test(rawDescription);
  const hasSystemDamage = Boolean(variantSpell.hasDamage) || damageEntries.length > 0 || overlayDamageEntries.length > 0;
  const hasDamage = hasSystemDamage || hasInlineDamage;

  const activeDamageList = damageEntries.length > 0 ? damageEntries : overlayDamageEntries;
  const formulaParts = activeDamageList
    .map(d => String(d.formula || d.value || "").trim())
    .filter(Boolean);
  const damageFormula = formulaParts.length > 0 ? formulaParts.join(" + ") : "";

  const isHealingOnly = activeDamageList.length > 0 && activeDamageList.every(d => {
    const kinds = d.kinds ? Array.from(d.kinds) : [];
    if (kinds.length > 0) {
      return kinds.includes("healing") && !kinds.includes("damage");
    }
    return d.type === "vitality" && Boolean(spell.traits?.has?.("healing"));
  });

  let defenseStr = "";
  if (spell.system?.defense?.save?.statistic) {
    const basic = spell.system.defense.save.basic ? "Basic " : "";
    const stat = String(spell.system.defense.save.statistic);
    const statName = stat.charAt(0).toUpperCase() + stat.slice(1);
    defenseStr = `${basic}${statName} DC`;
  }

  let canCast = extra.canCast ?? true;
  let cannotCastReason = extra.cannotCastReason ?? "";

  if (extra.canCast === undefined) {
    if (isCantrip) {
      canCast = true;
    } else if (extra.isPrepared) {
      if (extra.isExpended) {
        canCast = false;
        cannotCastReason = "Spell slot already expended";
      }
    } else if (isFocus) {
      const focusVal = actor.system.resources?.focus?.value ?? 0;
      if (focusVal <= 0) {
        canCast = false;
        cannotCastReason = "No Focus Points remaining";
      }
    } else if (isInnate) {
      const usesMax = spell.system?.uses?.max ?? 0;
      const usesVal = spell.system?.uses?.value ?? 0;
      if (usesMax > 0 && usesVal <= 0) {
        canCast = false;
        cannotCastReason = "No uses remaining";
      }
    } else if (isSpontaneous) {
      const castRank = extra.castRank ?? spell.rank ?? 1;
      if (castRank > 0) {
        const slotKey = `slot${castRank}`;
        const slotData = entry?.system?.slots?.[slotKey];
        const slotsRemaining = slotData?.value ?? 0;
        if (slotsRemaining <= 0) {
          canCast = false;
          cannotCastReason = `No Rank ${castRank} spell slots remaining`;
        }
      }
    }
  }

  const cardKey = extra.cardKey ?? (extra.castRank !== undefined ? `${spell.id}-${extra.castRank}` : spell.id);

  return {
    id: spell.id,
    cardKey,
    entryId,
    name: spell.name,
    img: spell.img || "systems/pf2e/icons/default-icons/spell.svg",
    glyph,
    castActions,
    actionCost: castActions ? `${castActions} Actions` : "",
    range: spell.system.range?.value ?? "",
    target: spell.system.target?.value ?? "",
    area: spell.system.area?.value ? `${spell.system.area.value}ft ${spell.system.area.type ?? ""}` : "",
    duration: spell.system.duration?.value ?? "",
    defense: defenseStr,
    traits,
    isAttack,
    isCantrip,
    hasDamage,
    isHealingOnly,
    damageFormula,
    effectiveCastRank,
    isSignature,
    canSignature,
    canCast,
    cannotCastReason,
    description: enrichedDescription || rawDescription,
    isExpanded: sheet._expandedActionIds?.has(cardKey) || (!extra.cardKey && sheet._expandedActionIds?.has(spell.id)),
    ...extra
  };
}

/**
 * Helper to structure spells for both Cast View (unified by rank) and Preparation View (slots & presets).
 * @param {Actor} actor
 * @param {object} sheet
 * @param {object} context
 */
export async function prepareSpellsContext(actor, sheet, context) {
  const allEntries = actor.spellcasting?.contents ?? [];
  const entries = allEntries.filter(e => !isItemSpellcastingEntry(e, actor));
  const hasPreparedEntry = entries.some(e => e.isPrepared || e.system?.prepared?.value === "prepared");

  context.hasPreparedEntry = hasPreparedEntry;
  const currentSubTab = sheet._spellSubTab || "spells";
  context.spellSubTab = (currentSubTab === "preparation" && !hasPreparedEntry) ? "spells" : currentSubTab;

  // 1. GATHER ALL SPELLS ACROSS ALL ENTRIES
  // We group by rank: 0 (Cantrips) to 10
  const rankBuckets = Array.from({ length: 11 }, (_, r) => ({
    rank: r,
    label: r === 0 ? "Cantrips" : `Rank ${r}`,
    isCollapsed: sheet._collapsedRankGroups?.has(r),
    spells: [],
    hasSlots: false,
    slots: { value: 0, max: 0 },
    entryId: null
  }));

  // Focus spells get their own group, shown above the Cantrips. Each spell keeps the rank it is
  // cast at (castRank), so heightening and damage stay correct; the group itself has no rank,
  // so its collapse key is the string "focus" instead of a number.
  const focusGroup = {
    rank: "focus",
    label: "Focus Spells",
    isCollapsed: sheet._collapsedRankGroups?.has("focus"),
    spells: [],
    hasSlots: false,
    slots: { value: 0, max: 0 },
    entryId: null
  };

  for (const entry of entries) {
    const entryId = entry.id;
    const isPrepared = entry.isPrepared || entry.system?.prepared?.value === "prepared";
    const isSpontaneous = entry.isSpontaneous || entry.system?.prepared?.value === "spontaneous";
    const isFocus = entry.isFocusPool || entry.system?.prepared?.value === "focus" || entry.system?.category === "focus";
    const isInnate = entry.isInnate || entry.system?.prepared?.value === "innate" || entry.system?.category === "innate";

    const systemData = entry.system ?? {};
    const spells = entry.spells?.contents ?? [];

    // Update slot trackers for ranks 0-10
    for (let r = 0; r <= 10; r++) {
      const slotKey = `slot${r}`;
      const slotData = systemData.slots?.[slotKey];
      if (slotData && slotData.max > 0) {
        const bucket = rankBuckets[r];
        bucket.hasSlots = true;
        bucket.slots.value = Math.max(bucket.slots.value, slotData.value ?? 0);
        bucket.slots.max = Math.max(bucket.slots.max, slotData.max ?? 0);
        if (!bucket.entryId) bucket.entryId = entryId;
      }
    }

    if (isPrepared) {
      // Check cantrip slots (slot0)
      const slot0Prepared = systemData.slots?.slot0?.prepared;
      if (slot0Prepared) {
        const prepArr = Array.isArray(slot0Prepared) ? slot0Prepared : Object.values(slot0Prepared);
        for (let sIdx = 0; sIdx < prepArr.length; sIdx++) {
          const prepItem = prepArr[sIdx];
          if (prepItem?.id) {
            const spell = entry.spells?.get(prepItem.id) ?? actor.items.get(prepItem.id);
            if (spell) {
              const formatted = await formatSpell(actor, sheet, spell, entryId, {
                isPrepared: true,
                isExpended: !!prepItem.expended,
                slotIndex: sIdx,
                castRank: 0,
                cardKey: `${spell.id}-0-${sIdx}`
              });
              rankBuckets[0].spells.push(formatted);
            }
          }
        }
      } else {
        // If no slot0 prepared data, fallback to known cantrips
        const cantrips = spells.filter(s => s.isCantrip);
        for (const s of cantrips) {
          const formatted = await formatSpell(actor, sheet, s, entryId, { isPrepared: true, castRank: 0, cardKey: `${s.id}-0` });
          rankBuckets[0].spells.push(formatted);
        }
      }

      // Check ranks 1 through 10
      for (let r = 1; r <= 10; r++) {
        const slotKey = `slot${r}`;
        const slotPrepared = systemData.slots?.[slotKey]?.prepared;
        if (slotPrepared) {
          const prepArr = Array.isArray(slotPrepared) ? slotPrepared : Object.values(slotPrepared);
          for (let sIdx = 0; sIdx < prepArr.length; sIdx++) {
            const prepItem = prepArr[sIdx];
            if (prepItem?.id) {
              const spell = entry.spells?.get(prepItem.id) ?? actor.items.get(prepItem.id);
              if (spell) {
                const formatted = await formatSpell(actor, sheet, spell, entryId, {
                  isPrepared: true,
                  isExpended: !!prepItem.expended,
                  slotIndex: sIdx,
                  castRank: r,
                  cardKey: `${spell.id}-${r}-${sIdx}`
                });
                rankBuckets[r].spells.push(formatted);
              }
            }
          }
        } else {
          const rankSpells = spells.filter(s => !s.isCantrip && (s.rank === r || s.system.level?.value === r));
          for (const s of rankSpells) {
            const formatted = await formatSpell(actor, sheet, s, entryId, { isPrepared: true, castRank: r, cardKey: `${s.id}-${r}` });
            rankBuckets[r].spells.push(formatted);
          }
        }
      }
    } else {
      // Spontaneous, Focus, Innate, Rituals
      let maxSpellRank = 0;
      if (isSpontaneous) {
        maxSpellRank = typeof entry.highestRank === "number" ? entry.highestRank : 0;
        for (let r = 10; r >= 1; r--) {
          if ((systemData.slots?.[`slot${r}`]?.max ?? 0) > 0) {
            maxSpellRank = Math.max(maxSpellRank, r);
          }
        }
        for (const s of spells) {
          if (!s.isCantrip) {
            const sRank = s.rank ?? s.system.level?.value ?? 1;
            maxSpellRank = Math.max(maxSpellRank, sRank);
          }
        }
        maxSpellRank = Math.min(10, Math.max(1, maxSpellRank));
      }

      for (const spell of spells) {
        // Defensive check: skip if spell originates from an item or staff
        if (spell.system?.location?.value) {
          const locEntry = actor.spellcasting?.get(spell.system.location.value);
          if (locEntry && isItemSpellcastingEntry(locEntry, actor)) continue;
        }

        const traits = spell.system?.traits?.value ?? spell.traits?.value ?? [];
        const traitLabels = Array.isArray(traits) ? traits.map(t => typeof t === "string" ? t.toLowerCase() : String(t?.value ?? t?.label ?? "").toLowerCase()) : [];
        const isCantrip = spell.isCantrip || traitLabels.includes("cantrip") || spell.system?.level?.value === 0;
        const isFocusSpell = isFocus || spell.isFocusSpell || traitLabels.includes("focus");
        const isRitualSpell = spell.isRitual || traitLabels.includes("ritual");

        const minRank = isCantrip ? 0 : (spell.baseRank ?? spell.system.level?.value ?? spell.rank ?? 1);
        const assignedRank = isCantrip ? 0 : (spell.system.location?.heightenedLevel ?? spell.rank ?? minRank);
        const isSignature = isSpontaneous && !isCantrip && !isFocusSpell && !isRitualSpell && !!(spell.system?.location?.signature || spell.isSignature);

        if (isSignature) {
          const startRank = Math.max(0, minRank);
          const endRank = Math.min(10, Math.max(assignedRank, maxSpellRank));
          for (let r = startRank; r <= endRank; r++) {
            const isHeightened = r > minRank;
            const formatted = await formatSpell(actor, sheet, spell, entryId, {
              isSpontaneous,
              isFocus: isFocusSpell,
              isInnate,
              isHeightened,
              baseRank: minRank,
              castRank: r,
              cardKey: `${spell.id}-${r}`
            });
            rankBuckets[r].spells.push(formatted);
          }
        } else {
          const targetRank = assignedRank;
          if (targetRank >= 0 && targetRank <= 10) {
            const isHeightened = targetRank > minRank;
            const formatted = await formatSpell(actor, sheet, spell, entryId, {
              isSpontaneous,
              isFocus: isFocusSpell,
              isInnate,
              isHeightened,
              baseRank: minRank,
              castRank: targetRank,
              cardKey: `${spell.id}-${targetRank}`
            });
            const group = isFocusSpell ? focusGroup : rankBuckets[targetRank];
            group.spells.push(formatted);
          }
        }
      }
    }
  }

  const sortByName = (a, b) => a.name.localeCompare(b.name);
  for (const b of [focusGroup, ...rankBuckets]) {
    b.spells.sort(sortByName);
  }

  // Filter rankBuckets: keep ranks that have spells OR slots with max > 0.
  // The focus group (if it has spells) comes first, above the Cantrips.
  const visibleGroups = rankBuckets.filter(b => b.spells.length > 0 || (b.hasSlots && b.slots.max > 0));
  if (focusGroup.spells.length > 0) visibleGroups.unshift(focusGroup);
  context.spellRanks = visibleGroups.map(b => ({
    ...b,
    spellCount: b.spells.length
  }));

  // 2. PREPARATION VIEW DATA (Slots by rank for prepared entries)
  if (hasPreparedEntry) {
    const preparedEntries = [];
    for (const entry of entries) {
      const isPrepared = entry.isPrepared || entry.system?.prepared?.value === "prepared";
      if (!isPrepared) continue;

      const systemData = entry.system ?? {};
      const ranks = [];

      // Check cantrips (rank 0)
      const slot0Data = systemData.slots?.slot0;
      const maxCantripSlots = slot0Data?.max ?? 0;
      const cantripPrepArr = slot0Data?.prepared ? (Array.isArray(slot0Data.prepared) ? slot0Data.prepared : Object.values(slot0Data.prepared)) : [];
      if (maxCantripSlots > 0 || cantripPrepArr.length > 0) {
        const slotCount = Math.max(maxCantripSlots, cantripPrepArr.length);
        const slots = [];
        for (let i = 0; i < slotCount; i++) {
          const pItem = cantripPrepArr[i];
          let spell = null;
          if (pItem?.id) {
            const sDoc = entry.spells?.get(pItem.id) ?? actor.items.get(pItem.id);
            if (sDoc) {
              spell = await formatSpell(actor, sheet, sDoc, entry.id);
            }
          }
          slots.push({
            slotNumber: i + 1,
            slotIndex: i,
            isEmpty: !spell,
            isExpended: !!pItem?.expended,
            spell
          });
        }
        ranks.push({
          rank: 0,
          label: "Cantrips",
          maxSlots: slotCount,
          preparedCount: slots.filter(s => !s.isEmpty).length,
          slots
        });
      }

      // Check ranks 1 through 10
      for (let r = 1; r <= 10; r++) {
        const slotKey = `slot${r}`;
        const slotData = systemData.slots?.[slotKey];
        const maxSlots = slotData?.max ?? 0;
        const prepArr = slotData?.prepared ? (Array.isArray(slotData.prepared) ? slotData.prepared : Object.values(slotData.prepared)) : [];

        if (maxSlots > 0 || prepArr.length > 0) {
          const slotCount = Math.max(maxSlots, prepArr.length);
          const slots = [];
          for (let i = 0; i < slotCount; i++) {
            const pItem = prepArr[i];
            let spell = null;
            if (pItem?.id) {
              const sDoc = entry.spells?.get(pItem.id) ?? actor.items.get(pItem.id);
              if (sDoc) {
                spell = await formatSpell(actor, sheet, sDoc, entry.id);
              }
            }
            slots.push({
              slotNumber: i + 1,
              slotIndex: i,
              isEmpty: !spell,
              isExpended: !!pItem?.expended,
              spell
            });
          }
          ranks.push({
            rank: r,
            label: `Rank ${r}`,
            maxSlots: slotCount,
            preparedCount: slots.filter(s => !s.isEmpty).length,
            slots
          });
        }
      }

      preparedEntries.push({
        id: entry.id,
        name: entry.name,
        ranks
      });
    }

    context.preparedEntries = preparedEntries;

    // Saved Presets
    const presets = actor.getFlag("pf2e-mobile-compact", "spellPresets") ?? [];
    context.spellPresets = presets;
  } else {
    context.preparedEntries = [];
    context.spellPresets = [];
  }
}

