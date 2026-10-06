/**
 * Context preparation helper for Spells (Cast View and Preparation View).
 */
import { parseActionCostInfo, PROFICIENCY_RANK_LETTERS, PROFICIENCY_RANK_NAMES } from "../../utils/sheet-utils.js";
import { isItemSpellcastingEntry } from "./context-activations.js";
import { preparePreparationContext } from "./context-spell-preparation.js";

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
    sort: spell.sort ?? 0,
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
 * The header data of one spellcasting entry, like the top of an entry on pf2e's sheet: its name, spell DC,
 * spell attack bonus, tradition and proficiency rank. Each entry has its own statistic (an entry granted by a
 * feat can use another attribute or rank than the class entry), so the numbers come from entry.statistic.
 * @param {object} entry  A spellcasting entry of actor.spellcasting
 * @returns {{id: string, name: string, dc: number|null, attack: string, tradition: string, rank: number|null, rankLetter: string, rankName: string}}
 */
function describeEntry(entry) {
  const statistic = entry.statistic ?? null;
  const dc = statistic?.dc?.value ?? null;
  const mod = statistic?.check?.mod ?? statistic?.mod ?? null;
  const rank = statistic?.rank ?? entry.system?.proficiency?.value ?? null;
  const traditionSlug = entry.tradition ?? entry.system?.tradition?.value ?? "";
  const traditionKey = globalThis.CONFIG?.PF2E?.magicTraditions?.[traditionSlug];
  const tradition = traditionKey
    ? (game.i18n?.localize?.(traditionKey) ?? traditionKey)
    : (traditionSlug ? traditionSlug.charAt(0).toUpperCase() + traditionSlug.slice(1) : "");
  return {
    id: entry.id,
    name: entry.name ?? "",
    dc: typeof dc === "number" ? dc : null,
    attack: typeof mod === "number" ? `${mod >= 0 ? "+" : ""}${mod}` : "",
    tradition,
    rank: typeof rank === "number" ? rank : null,
    rankLetter: typeof rank === "number" ? (PROFICIENCY_RANK_LETTERS[rank] ?? "") : "",
    rankName: typeof rank === "number"
      ? (game.i18n?.localize?.(`PF2E.ProficiencyLevel${rank}`) ?? PROFICIENCY_RANK_NAMES[rank] ?? "")
      : ""
  };
}

/**
 * The spell groups of one spellcasting entry: Focus Spells, Cantrips and Rank 1-10, each with its own spells
 * and (for spontaneous and flexible entries) the entry's own slot counter. Collapse keys are scoped to the
 * entry ("<entryId>-<rank>", "<entryId>-focus"), so folding Rank 1 of one entry leaves the others open.
 * @param {Actor} actor
 * @param {object} sheet
 * @param {object} entry  A spellcasting entry of actor.spellcasting
 * @returns {Promise<object[]>}  The groups with spells or slots, Focus Spells first
 */
async function prepareEntryGroups(actor, sheet, entry) {
  const entryId = entry.id;
  const makeGroup = (rank, label) => {
    const collapseKey = `${entryId}-${rank}`;
    return {
      rank,
      label,
      collapseKey,
      isCollapsed: !!sheet._collapsedRankGroups?.has(collapseKey),
      spells: [],
      hasSlots: false,
      slots: { value: 0, max: 0 },
      entryId
    };
  };
  const rankBuckets = Array.from({ length: 11 }, (_, r) => makeGroup(r, r === 0 ? "Cantrips" : `Rank ${r}`));
  // Focus spells get their own group, above the Cantrips. Each spell keeps the rank it is cast at
  // (castRank), so heightening and damage stay correct; the group itself has no rank.
  const focusGroup = makeGroup("focus", "Focus Spells");

  const isPrepared = entry.isPrepared || entry.system?.prepared?.value === "prepared";
  const isSpontaneous = entry.isSpontaneous || entry.system?.prepared?.value === "spontaneous";
  const isFocus = entry.isFocusPool || entry.system?.prepared?.value === "focus" || entry.system?.category === "focus";
  const isInnate = entry.isInnate || entry.system?.prepared?.value === "innate" || entry.system?.category === "innate";

  const systemData = entry.system ?? {};
  const spells = entry.spells?.contents ?? [];

  // Slot counters for ranks 1-10.
  // Only spontaneous and flexible entries spend slots by count (slots.slotN.value). Prepared entries
  // mark the prepared spell itself as expended, which the spell cards already show.
  // Cantrips (rank 0) never get a counter: they are cast at will, and pf2e's slot0 holds how many
  // cantrips the caster knows, not uses.
  const usesSlotCount = isSpontaneous || Boolean(entry.isFlexible);
  for (let r = 1; r <= 10; r++) {
    const slotData = systemData.slots?.[`slot${r}`];
    if (usesSlotCount && slotData && slotData.max > 0) {
      const bucket = rankBuckets[r];
      bucket.hasSlots = true;
      bucket.slots.value = slotData.value ?? 0;
      bucket.slots.max = slotData.max ?? 0;
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

  // Spell order inside a group follows pf2e's sheet (SpellCollection#getSpellData): prepared slots keep their
  // slot order; otherwise by the spell's sort value (set by dragging spells on pf2e's sheet), then by name.
  // Heightened copies of signature spells come after a rank's own spells, as pf2e appends them.
  const lang = game.i18n?.lang;
  const isSignatureCopy = s => !!(s.isSignature && s.isHeightened && !s.isPrepared);
  const bySheetOrder = (a, b) => {
    if (Number.isInteger(a.slotIndex) && Number.isInteger(b.slotIndex)) return a.slotIndex - b.slotIndex;
    // Booleans subtract as numbers: true - false = 1 (a is the copy, so a goes after b), false - true = -1
    // (b is the copy, so a goes first), and 0 when both or neither are copies.
    const copyOrder = isSignatureCopy(a) - isSignatureCopy(b);
    if (copyOrder) return copyOrder;
    if (isSignatureCopy(a)) return a.name.localeCompare(b.name, lang);
    return (a.sort - b.sort) || a.name.localeCompare(b.name, lang);
  };
  for (const b of [focusGroup, ...rankBuckets]) {
    b.spells.sort(bySheetOrder);
  }

  // Keep ranks that have spells OR slots with max > 0; the focus group (if it has spells) comes first.
  const visibleGroups = rankBuckets.filter(b => b.spells.length > 0 || (b.hasSlots && b.slots.max > 0));
  if (focusGroup.spells.length > 0) visibleGroups.unshift(focusGroup);
  return visibleGroups.map(b => ({ ...b, spellCount: b.spells.length }));
}

/**
 * Helper to structure spells for both Cast View (one section per spellcasting entry, by rank inside it) and
 * Preparation View (slots & presets).
 * The Cast View keeps each entry apart, like pf2e's sheet: the class's spells, a focus tradition, spells
 * granted by a feat (e.g. Charm from Enthralling Allure) and a hand-made entry for staff spells each get their
 * own section with their own DC and attack bonus. Entries of staves, wands and scrolls themselves stay on the
 * Activations sub-tab (isItemSpellcastingEntry).
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

  // 1. CAST VIEW: one section per entry, in pf2e's order (the entries' sort value)
  const sortedEntries = [...entries].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const spellEntries = [];
  for (const entry of sortedEntries) {
    const groups = await prepareEntryGroups(actor, sheet, entry);
    if (groups.length) spellEntries.push({ ...describeEntry(entry), groups });
  }
  context.spellEntries = spellEntries;

  // 2. PREPARATION VIEW: slots by rank for prepared entries, and the saved presets
  await preparePreparationContext(actor, sheet, context, entries, hasPreparedEntry);
}
