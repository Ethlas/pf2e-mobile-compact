const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Mobile-friendly Compendium Search Drawer Application.
 * Supports filtering spells by rank and tradition, and configuring target spellcasting entry and rank.
 */
export class CompendiumPickerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "pf2e-mobile-compendium-picker",
    tag: "div",
    classes: ["pf2e-mobile-compendium-picker"],
    window: {
      title: "Compendium Browser",
      resizable: false
    },
    position: {
      width: 420,
      height: 640
    },
    actions: {
      importItem: CompendiumPickerApp.#onImportItem,
      search: CompendiumPickerApp.#onSearch,
      stageItem: CompendiumPickerApp.#onStageItem,
      cancelStage: CompendiumPickerApp.#onCancelStage,
      selectTargetEntry: CompendiumPickerApp.#onSelectTargetEntry
    }
  };

  static PARTS = {
    picker: {
      template: "modules/pf2e-mobile-compact/templates/compendium-picker.hbs"
    }
  };

  /** @type {ActorPF2e} */
  #actor;
  /** @type {string} */
  #type;
  /** @type {Array<object>} */
  #indexEntries = [];
  /** @type {string} */
  #query = "";

  // Filter states
  #rankFilter = "all";
  #traditionFilter = "my"; // Default to actor's own traditions if any

  // Staging state
  #stagedItem = null;
  #selectedEntryId = null;
  #selectedRank = null;

  constructor(actor, options = {}, type = "spells") {
    super(options);
    this.#actor = actor;
    this.#type = type;
  }

  /**
   * Extract tradition strings from an index entry or document.
   * @param {object} itemData
   * @returns {string[]}
   */
  static #extractTraditions(itemData) {
    const rawTraditions = itemData.system?.traits?.traditions;
    const tradArr = Array.isArray(rawTraditions)
      ? rawTraditions
      : (rawTraditions?.value ?? []);
    const traitsArr = Array.isArray(itemData.system?.traits?.value)
      ? itemData.system.traits.value
      : [];
    const combined = [...tradArr, ...traitsArr].map(t => String(t).toLowerCase());
    const validTraditions = ["arcane", "divine", "occult", "primal"];
    return Array.from(new Set(combined.filter(t => validTraditions.includes(t))));
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.type = this.#type;
    context.query = this.#query;
    context.isSpells = this.#type === "spells";
    context.rankFilter = this.#rankFilter;
    context.traditionFilter = this.#traditionFilter;

    // Collect actor spellcasting entries and traditions
    const entries = this.#actor.spellcasting?.contents ?? [];
    const actorTraditions = new Set();
    const spellcastingEntries = [];

    for (const entry of entries) {
      const tradition = (entry.tradition ?? entry.system?.tradition?.value ?? "").toLowerCase();
      if (tradition) actorTraditions.add(tradition);

      let highestRank = entry.highestRank ?? entry.highestLevel ?? 10;
      if (!highestRank || highestRank < 1) {
        // Fallback check against slots
        for (let r = 1; r <= 10; r++) {
          if ((entry.system?.slots?.[`slot${r}`]?.max ?? 0) > 0) highestRank = r;
        }
      }

      spellcastingEntries.push({
        id: entry.id,
        name: entry.name,
        tradition: tradition || "None",
        isSpontaneous: entry.isSpontaneous || entry.system?.prepared?.value === "spontaneous",
        isPrepared: entry.isPrepared || entry.system?.prepared?.value === "prepared",
        isInnate: entry.isInnate || entry.system?.prepared?.value === "innate",
        isFocus: entry.isFocusPool || entry.system?.prepared?.value === "focus",
        highestRank: highestRank || 10
      });
    }

    context.spellcastingEntries = spellcastingEntries;
    context.hasEntries = spellcastingEntries.length > 0;
    context.actorTraditions = Array.from(actorTraditions);
    context.myTraditionsLabel = context.actorTraditions.length
      ? context.actorTraditions.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")
      : "None";

    // If character has no traditions and filter is set to "my", fall back to "all"
    if (context.actorTraditions.length === 0 && this.#traditionFilter === "my") {
      this.#traditionFilter = "all";
      context.traditionFilter = "all";
    }

    // Staging context for the Add confirmation overlay
    if (this.#stagedItem) {
      const activeEntryId = this.#selectedEntryId || (spellcastingEntries[0]?.id ?? null);
      const activeEntry = spellcastingEntries.find(e => e.id === activeEntryId);

      const baseRank = this.#stagedItem.isCantrip ? 0 : (this.#stagedItem.baseRank || 1);
      const maxRank = activeEntry ? activeEntry.highestRank : 10;

      const availableRanks = [];
      if (this.#stagedItem.isCantrip) {
        availableRanks.push({ rank: 0, label: "Cantrip" });
      } else {
        for (let r = baseRank; r <= Math.max(maxRank, baseRank); r++) {
          availableRanks.push({ rank: r, label: `Rank ${r}` });
        }
      }

      const activeRank = this.#selectedRank !== null
        ? this.#selectedRank
        : baseRank;

      context.staged = {
        ...this.#stagedItem,
        selectedEntryId: activeEntryId,
        selectedRank: activeRank,
        availableRanks,
        entryMatchesTradition: activeEntry && this.#stagedItem.traditions.length
          ? this.#stagedItem.traditions.includes(activeEntry.tradition.toLowerCase())
          : true
      };
    } else {
      context.staged = null;
    }

    // Query compendium pack
    const packName = this.#type === "spells" ? "pf2e.spells-srd" : "pf2e.equipment-srd";
    const pack = game.packs.get(packName);

    if (pack) {
      if (this.#indexEntries.length === 0) {
        const fields = this.#type === "spells"
          ? ["img", "system.level", "system.traits", "system.category"]
          : ["img", "system.level", "system.price"];
        const index = await pack.getIndex({ fields });
        this.#indexEntries = Array.from(index);
      }

      const queryLower = this.#query.trim().toLowerCase();

      context.entries = this.#indexEntries
        .filter(entry => {
          // Search query
          if (queryLower && !entry.name.toLowerCase().includes(queryLower)) return false;

          // Spell filters
          if (this.#type === "spells") {
            const rawLevel = entry.system?.level?.value ?? 0;
            const traits = entry.system?.traits?.value ?? [];
            const isCantrip = rawLevel === 0 || traits.includes("cantrip");
            const traditions = CompendiumPickerApp.#extractTraditions(entry);

            // Rank filter
            if (this.#rankFilter === "cantrip") {
              if (!isCantrip) return false;
            } else if (this.#rankFilter !== "all") {
              const filterRankNum = parseInt(this.#rankFilter, 10);
              if (isCantrip || rawLevel !== filterRankNum) return false;
            }

            // Tradition filter
            if (this.#traditionFilter === "my") {
              if (context.actorTraditions.length > 0) {
                const matchesAny = traditions.some(t => context.actorTraditions.includes(t));
                if (!matchesAny) return false;
              }
            } else if (this.#traditionFilter !== "all") {
              if (!traditions.includes(this.#traditionFilter)) return false;
            }
          }

          return true;
        })
        .slice(0, 60);
    } else {
      context.entries = [];
    }

    return context;
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);

    // Rank filter select listener (Native touch-safe)
    const rankSelect = htmlElement.querySelector("[data-change-action='updateRankFilter']");
    if (rankSelect) {
      rankSelect.addEventListener("change", (event) => {
        event.stopPropagation();
        this.#rankFilter = event.target.value;
        this.render();
      });
    }

    // Tradition filter select listener (Native touch-safe)
    const tradSelect = htmlElement.querySelector("[data-change-action='updateTraditionFilter']");
    if (tradSelect) {
      tradSelect.addEventListener("change", (event) => {
        event.stopPropagation();
        this.#traditionFilter = event.target.value;
        this.render();
      });
    }

    // Staging form entry change listener
    const entrySelect = htmlElement.querySelector("[data-change-action='updateStagedEntry']");
    if (entrySelect) {
      entrySelect.addEventListener("change", (event) => {
        event.stopPropagation();
        this.#selectedEntryId = event.target.value;
        this.#selectedRank = null; // Reset rank to default for new entry
        this.render();
      });
    }

    // Staging form rank change listener
    const rankChoiceSelect = htmlElement.querySelector("[data-change-action='updateStagedRank']");
    if (rankChoiceSelect) {
      rankChoiceSelect.addEventListener("change", (event) => {
        event.stopPropagation();
        this.#selectedRank = parseInt(event.target.value, 10);
      });
    }
  }

  /**
   * Search input handler.
   */
  static async #onSearch(event, target) {
    this.#query = target.value ?? "";
    this.render();
  }

  /**
   * Action handler: Stage an item before importing.
   */
  static async #onStageItem(event, target) {
    const entryId = target.dataset.entryId;
    const packName = this.#type === "spells" ? "pf2e.spells-srd" : "pf2e.equipment-srd";
    const pack = game.packs.get(packName);

    if (!pack || !entryId) return;

    const item = await pack.getDocument(entryId);
    if (!item) return;

    // If equipment, directly import to actor
    if (this.#type !== "spells") {
      await this.#actor.createEmbeddedDocuments("Item", [item.toObject()]);
      ui.notifications.info(`Added ${item.name} to ${this.#actor.name}`);
      this.close();
      return;
    }

    // Stage spell for mobile configuration overlay
    const traits = item.system?.traits?.value ?? [];
    const isCantrip = item.isCantrip || traits.includes("cantrip") || item.system?.level?.value === 0;
    const traditions = CompendiumPickerApp.#extractTraditions(item);

    this.#stagedItem = {
      id: item.id,
      name: item.name,
      img: item.img,
      baseRank: item.system.level.value ?? 1,
      isCantrip,
      traditions,
      traditionsLabel: traditions.length
        ? traditions.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")
        : "Special / None"
    };

    // Auto-select best matching entry
    const entries = this.#actor.spellcasting?.contents ?? [];
    const matchingEntry = entries.find(e => {
      const trad = (e.tradition ?? e.system?.tradition?.value ?? "").toLowerCase();
      return trad && traditions.includes(trad);
    });

    this.#selectedEntryId = matchingEntry ? matchingEntry.id : (entries[0]?.id ?? null);
    this.#selectedRank = isCantrip ? 0 : this.#stagedItem.baseRank;

    this.render();
  }

  /**
   * Action handler: Cancel staging.
   */
  static async #onCancelStage(event, target) {
    this.#stagedItem = null;
    this.#selectedEntryId = null;
    this.#selectedRank = null;
    this.render();
  }

  /**
   * Action handler: Dummy action for selectTargetEntry (handled via change event).
   */
  static async #onSelectTargetEntry(event, target) {
    // Handled in _attachPartListeners
  }

  /**
   * Action handler: Confirm and import spell into selected spellcasting entry.
   */
  static async #onImportItem(event, target) {
    if (!this.#stagedItem) return;

    const form = target.closest(".spell-config-card");
    const entryIdSelect = form?.querySelector("[name='targetEntry']");
    const targetRankSelect = form?.querySelector("[name='targetRank']");

    const entryId = entryIdSelect ? entryIdSelect.value : this.#selectedEntryId;
    const targetRank = targetRankSelect
      ? parseInt(targetRankSelect.value, 10)
      : (this.#selectedRank ?? this.#stagedItem.baseRank);

    if (!entryId) {
      ui.notifications.warn("Please select a spellcasting entry to add this spell to.");
      return;
    }

    const pack = game.packs.get("pf2e.spells-srd");
    if (!pack) return;

    const item = await pack.getDocument(this.#stagedItem.id);
    if (!item) return;

    const entry = this.#actor.spellcasting?.get(entryId);
    if (!entry) {
      ui.notifications.warn("Selected spellcasting entry was not found on character.");
      return;
    }

    // Soft PF2e rule validation: Spontaneous repertoire limits
    const isSpontaneous = entry.isSpontaneous || entry.system?.prepared?.value === "spontaneous";
    if (isSpontaneous && targetRank > 0) {
      const currentSpells = (entry.spells?.contents ?? []).filter(s => {
        const spellRank = s.system?.location?.heightenedLevel ?? s.baseRank ?? s.rank;
        return spellRank === targetRank;
      });

      const maxSlots = entry.system.slots?.[`slot${targetRank}`]?.max ?? 0;
      if (maxSlots > 0 && currentSpells.length >= maxSlots) {
        const DialogClass = foundry.applications?.api?.DialogV2 ?? Dialog;
        let confirmed = false;

        if (DialogClass === foundry.applications?.api?.DialogV2) {
          confirmed = await DialogClass.confirm({
            window: { title: "Repertoire Capacity Warning" },
            content: `<p><strong>${entry.name}</strong> already has <strong>${currentSpells.length} / ${maxSlots}</strong> rank ${targetRank} spells in its repertoire.</p><p>Adding <em>${item.name}</em> exceeds standard limits. Do you want to add it anyway (e.g. from a boon or archetype)?</p>`,
            yes: { label: "Add Anyway", icon: "fa-solid fa-plus" },
            no: { label: "Cancel", icon: "fa-solid fa-xmark" },
            rejectClose: false
          });
        } else {
          confirmed = await new Promise(resolve => {
            new Dialog({
              title: "Repertoire Capacity Warning",
              content: `<p><strong>${entry.name}</strong> already has <strong>${currentSpells.length} / ${maxSlots}</strong> rank ${targetRank} spells in its repertoire.</p><p>Adding <em>${item.name}</em> exceeds standard limits. Do you want to add it anyway?</p>`,
              buttons: {
                yes: { label: "Add Anyway", callback: () => resolve(true) },
                no: { label: "Cancel", callback: () => resolve(false) }
              },
              default: "no",
              close: () => resolve(false)
            }).render(true);
          });
        }

        if (!confirmed) return;
      }
    }

    // Delegate spell addition to PF2e's native system methods
    try {
      if (typeof entry.addSpell === "function") {
        await entry.addSpell(item, { groupId: targetRank });
      } else if (typeof entry.spells?.addSpell === "function") {
        await entry.spells.addSpell(item, { groupId: targetRank });
      } else {
        const itemData = item.toObject();
        itemData.system.location = { value: entryId };
        if (isSpontaneous && targetRank > (item.system?.level?.value ?? 1)) {
          itemData.system.location.heightenedLevel = targetRank;
        }
        await this.#actor.createEmbeddedDocuments("Item", [itemData]);
      }

      const rankDisplay = targetRank === 0 ? "Cantrip" : `Rank ${targetRank}`;
      ui.notifications.info(`Added ${item.name} (${rankDisplay}) to ${entry.name}`);

      this.#stagedItem = null;
      this.#selectedEntryId = null;
      this.#selectedRank = null;
      this.close();
    } catch (err) {
      console.error("PF2e Mobile | Error adding spell to entry:", err);
      ui.notifications.error(`Failed to add spell: ${err.message}`);
    }
  }
}
