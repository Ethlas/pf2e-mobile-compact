/**
 * Context preparation for the Spells tab's Preparation view: for every prepared spellcasting entry its
 * slots by rank (cantrips and ranks 1-10, with the spell prepared in each slot), plus the saved spell presets.
 * Called by prepareSpellsContext (context-spells.js), which passes the entries it already filtered (no
 * staff, wand or scroll entries).
 */
import { formatSpell } from "./context-spells.js";

/**
 * Builds context.preparedEntries and context.spellPresets.
 * @param {Actor} actor
 * @param {object} sheet
 * @param {object} context
 * @param {object[]} entries  The actor's spellcasting entries without item entries
 * @param {boolean} hasPreparedEntry
 */
export async function preparePreparationContext(actor, sheet, context, entries, hasPreparedEntry) {
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
