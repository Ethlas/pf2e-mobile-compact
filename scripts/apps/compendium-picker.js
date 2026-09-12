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
      search: CompendiumPickerApp.#onSearch
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

  constructor(actor, options = {}, type = "spells") {
    super(options);
    this.#actor = actor;
    this.#type = type;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.type = this.#type;
    context.query = this.#query;

    const packName = this.#type === "spells" ? "pf2e.spells-srd" : "pf2e.equipment-srd";
    const pack = game.packs.get(packName);

    if (pack) {
      if (this.#indexEntries.length === 0) {
        const index = await pack.getIndex({ fields: ["img", "system.level", "system.price"] });
        this.#indexEntries = Array.from(index);
      }

      context.entries = this.#indexEntries
        .filter(entry => !this.#query || entry.name.toLowerCase().includes(this.#query.toLowerCase()))
        .slice(0, 50);
    } else {
      context.entries = [];
    }

    return context;
  }

  static async #onSearch(event, target) {
    this.#query = target.value ?? "";
    this.render();
  }

  static async #onImportItem(event, target) {
    const entryId = target.dataset.entryId;
    const packName = this.#type === "spells" ? "pf2e.spells-srd" : "pf2e.equipment-srd";
    const pack = game.packs.get(packName);

    if (pack && entryId) {
      const item = await pack.getDocument(entryId);
      if (item) {
        await this.#actor.createEmbeddedDocuments("Item", [item.toObject()]);
        ui.notifications.info(`Added ${item.name} to ${this.#actor.name}`);
        this.close();
      }
    }
  }
}
