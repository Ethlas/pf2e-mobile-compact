const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Mobile-friendly Compendium Search Drawer Application.
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
      width: 400,
      height: 600
    },
    actions: {
      importItem: CompendiumPickerApp.#onImportItem,
      search: CompendiumPickerApp.#onSearch,
      stageItem: CompendiumPickerApp.#onStageItem,
      cancelStage: CompendiumPickerApp.#onCancelStage
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
  
  // Filters
  #rankFilter = "all";
  #traditionFilter = "all";
  
  // Staging state
  #stagedItem = null;

  constructor(actor, options = {}, type = "spells") {
    super(options);
    this.#actor = actor;
    this.#type = type;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.type = this.#type;
    context.query = this.#query;
    context.rankFilter = this.#rankFilter;
    context.traditionFilter = this.#traditionFilter;
    context.isSpells = this.#type === "spells";
    context.stagedItem = this.#stagedItem;

    // Build spellcasting entries list if needed
    if (context.isSpells && this.#actor.spellcasting) {
      context.spellcastingEntries = Array.from(this.#actor.spellcasting.collections).map(entry => {
        return {
          id: entry.id,
          name: entry.name,
          isSpontaneous: entry.isSpontaneous,
          isPrepared: entry.isPrepared,
          highestRank: entry.highestLevel || 10
        };
      });
      
      // Calculate max possible rank
      const maxRank = Math.max(...context.spellcastingEntries.map(e => e.highestRank), 1);
      context.ranks = Array.from({length: maxRank + 1}, (_, i) => i); // 0 (cantrips) to maxRank
    }

    const packName = this.#type === "spells" ? "pf2e.spells-srd" : "pf2e.equipment-srd";
    const pack = game.packs.get(packName);

    if (pack) {
      if (this.#indexEntries.length === 0) {
        const index = await pack.getIndex({ fields: ["img", "system.level", "system.price", "system.traits"] });
        this.#indexEntries = Array.from(index);
      }

      context.entries = this.#indexEntries
        .filter(entry => {
          if (this.#query && !entry.name.toLowerCase().includes(this.#query.toLowerCase())) return false;
          
          if (this.#type === "spells") {
            const level = entry.system?.level?.value ?? 0;
            const traits = entry.system?.traits?.value ?? [];
            
            if (this.#rankFilter !== "all" && parseInt(this.#rankFilter) !== level) return false;
            if (this.#traditionFilter !== "all" && !traits.includes(this.#traditionFilter)) return false;
          }
          
          return true;
        })
        .slice(0, 50);
    } else {
      context.entries = [];
    }

    return context;
  }
  
  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);
    
    const rankSelect = htmlElement.querySelector("[name='rankFilter']");
    if (rankSelect) {
      rankSelect.addEventListener("change", (event) => {
        event.stopPropagation();
        this.#rankFilter = event.target.value;
        this.render();
      });
    }
    
    const tradSelect = htmlElement.querySelector("[name='traditionFilter']");
    if (tradSelect) {
      tradSelect.addEventListener("change", (event) => {
        event.stopPropagation();
        this.#traditionFilter = event.target.value;
        this.render();
      });
    }
  }

  static async #onSearch(event, target) {
    this.#query = target.value ?? "";
    this.render();
  }

  static async #onStageItem(event, target) {
    const entryId = target.dataset.entryId;
    const packName = this.#type === "spells" ? "pf2e.spells-srd" : "pf2e.equipment-srd";
    const pack = game.packs.get(packName);

    if (pack && entryId) {
      const item = await pack.getDocument(entryId);
      if (item) {
        if (this.#type !== "spells") {
          // Import equipment directly
          await this.#actor.createEmbeddedDocuments("Item", [item.toObject()]);
          ui.notifications.info(`Added ${item.name} to ${this.#actor.name}`);
          this.close();
        } else {
          // Stage spell for configuration
          this.#stagedItem = {
            id: item.id,
            name: item.name,
            img: item.img,
            baseRank: item.system.level.value
          };
          this.render();
        }
      }
    }
  }
  
  static async #onCancelStage(event, target) {
    this.#stagedItem = null;
    this.render();
  }

  static async #onImportItem(event, target) {
    if (!this.#stagedItem) return;
    
    const form = target.closest(".spell-config-form");
    const entryId = form.querySelector("[name='targetEntry']").value;
    const targetRank = parseInt(form.querySelector("[name='targetRank']").value, 10);
    
    const pack = game.packs.get("pf2e.spells-srd");
    const item = await pack.getDocument(this.#stagedItem.id);
    
    if (item && entryId) {
      const itemData = item.toObject();
      itemData.system.location = { value: entryId };
      
      // Validation warning for spontaneous casters
      const entry = this.#actor.spellcasting.get(entryId);
      if (entry && entry.isSpontaneous) {
        const currentSpells = entry.spells.filter(s => s.system.location.heightenedLevel === targetRank || s.baseRank === targetRank);
        // We use a simple soft check here based on typical repertoire rules
        const maxSlots = entry.system.slots?.[`slot${targetRank}`]?.max || 0;
        if (maxSlots > 0 && currentSpells.length >= maxSlots) {
          const proceed = await foundry.applications.api.DialogV2.confirm({
            title: "Repertoire Warning",
            content: `<p>This character may already know the maximum number of rank ${targetRank} spells for this spellcasting entry. Do you want to add it anyway?</p>`
          });
          if (!proceed) return;
        }
      }

      await this.#actor.createEmbeddedDocuments("Item", [itemData]);
      ui.notifications.info(`Added ${item.name} to ${this.#actor.name}`);
      
      this.#stagedItem = null;
      this.close();
    }
  }
}
