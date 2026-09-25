/**
 * Action handlers for saved spell loadout presets (Preparation view).
 */

/**
 * Action handler: save current prepared spells as a preset.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onSaveSpellPreset(sheet, event, target) {
  const content = `<div style="margin-bottom: 10px;">
    <label style="display:block; margin-bottom: 5px; font-weight: bold;">Preset Name:</label>
    <input type="text" id="preset-name-input" placeholder="e.g. Combat, Dungeon, Social" style="width: 100%; height: 40px;" autofocus />
  </div>`;

  let name = null;
  if (foundry.applications?.api?.DialogV2?.wait) {
    name = await foundry.applications.api.DialogV2.wait({
      window: { title: "Save Spell Preset" },
      content,
      buttons: [
        {
          action: "save",
          label: "Save",
          icon: "fa-solid fa-save",
          default: true,
          callback: (evt, btn, dialog) => {
            const root = dialog?.element ?? btn?.closest(".window-content") ?? document;
            const input = root.querySelector("#preset-name-input");
            return input?.value?.trim() || "Default Preset";
          }
        },
        {
          action: "cancel",
          label: "Cancel",
          icon: "fa-solid fa-times",
          callback: () => null
        }
      ],
      rejectClose: false
    });
  } else {
    name = await new Promise(resolve => {
      let settled = false;
      const done = (val) => {
        if (!settled) {
          settled = true;
          resolve(val);
        }
      };
      new Dialog({
        title: "Save Spell Preset",
        content,
        buttons: {
          save: {
            label: "Save",
            icon: '<i class="fa-solid fa-save"></i>',
            callback: (html) => {
              const root = html instanceof HTMLElement ? html : html?.[0];
              const input = root?.querySelector("#preset-name-input");
              done(input?.value?.trim() || "Default Preset");
            }
          },
          cancel: {
            label: "Cancel",
            icon: '<i class="fa-solid fa-times"></i>',
            callback: () => done(null)
          }
        },
        default: "save",
        close: () => done(null)
      }).render(true);
    });
  }

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

