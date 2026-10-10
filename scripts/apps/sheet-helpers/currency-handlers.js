/**
 * Coins on the Gear tab: the money bar under the bulk line, like the currency row of pf2e's inventory.
 * - prepareCurrencyContext: the pp/gp/sp/cp counts, total currency and total wealth, as pf2e's sheet shows them.
 * - onManageCoins: the bar's + (add coins) and − (remove coins) buttons, and Sell All Treasure in the header
 *   of the Treasure section. They call the
 *   same pf2e methods as pf2e's own dialogs (actor.inventory.addCurrency, removeCurrency, sellAllTreasure),
 *   with a touch dialog instead of pf2e's 300px window. Labels are pf2e's own (PF2E.*), so they follow the
 *   Foundry language.
 */

const DENOMINATIONS = ["pp", "gp", "sp", "cp"];
const COIN_IMAGES = {
  pp: "systems/pf2e/icons/equipment/treasure/currency/platinum-pieces.webp",
  gp: "systems/pf2e/icons/equipment/treasure/currency/gold-pieces.webp",
  sp: "systems/pf2e/icons/equipment/treasure/currency/silver-pieces.webp",
  cp: "systems/pf2e/icons/equipment/treasure/currency/copper-pieces.webp"
};

/**
 * The money bar's data, the same values as pf2e's sheet (ActorSheetPF2e#prepareCurrency).
 * @param {Actor} actor
 * @returns {{units: Array<{key: string, label: string, value: number, img: string}>, totalCurrency: string, totalWealth: string}|null}
 */
export function prepareCurrencyContext(actor) {
  const inventory = actor?.inventory;
  const currency = inventory?.currency;
  if (!currency) return null;
  return {
    units: DENOMINATIONS.map(key => ({
      key,
      label: game.i18n.localize(CONFIG.PF2E?.currencies?.[key] ?? key),
      value: currency[key] ?? 0,
      img: COIN_IMAGES[key]
    })),
    totalCurrency: currency.toString?.({ decimal: true }) ?? "",
    totalWealth: inventory.totalWealth?.toString?.({ decimal: true }) ?? ""
  };
}

/**
 * Action handler for the money bar's buttons (data-mode "add", "remove" or "sell").
 * @param {object} sheet - Mobile sheet instance
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onManageCoins(sheet, event, target) {
  event?.preventDefault?.();
  const actor = sheet.actor;
  if (!actor?.inventory || !actor.isOwner) return;
  const mode = target.dataset.mode;
  if (mode === "sell") return sellAllTreasure(actor);
  if (mode === "add" || mode === "remove") return updateCoins(actor, mode);
}

/**
 * Asks for confirmation, then turns every treasure item that is not a coin into coins (pf2e's
 * "Sell All Treasure": each item's value is added as coins and the item is deleted).
 * @param {Actor} actor
 */
async function sellAllTreasure(actor) {
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("PF2E.SellAllTreasureTitle") },
    content: `<p>${game.i18n.localize("PF2E.SellAllTreasureQuestion")}</p>`,
    rejectClose: false,
    modal: true
  }).catch(() => false);
  if (confirmed) await actor.inventory.sellAllTreasure();
}

/**
 * Shows the add or remove coins dialog and applies it through pf2e.
 * Add: "Combine Stacks" adds to the existing coin items. Remove: "Remove by value" makes change from other
 * coins when there are not enough of one kind.
 * @param {Actor} actor
 * @param {"add"|"remove"} mode
 */
async function updateCoins(actor, mode) {
  const isAdd = mode === "add";
  const title = game.i18n.localize(isAdd ? "PF2E.AddCoinsTitle" : "PF2E.RemoveCoinsTitle");
  const renderTemplateFn = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  const content = await renderTemplateFn("modules/pf2e-mobile-compact/templates/parts/currency-dialog.hbs", {
    units: prepareCurrencyContext(actor)?.units ?? [],
    optionLabel: game.i18n.localize(isAdd ? "PF2E.AddCoinsCombineStacksLabel" : "PF2E.RemoveCoinsByValueLabel"),
    optionChecked: isAdd
  });

  const values = await foundry.applications.api.DialogV2.prompt({
    window: { title },
    content,
    ok: {
      label: title,
      icon: isAdd ? "fa-solid fa-plus" : "fa-solid fa-minus",
      callback: (_event, button) => {
        const form = button.form;
        const coins = Object.fromEntries(DENOMINATIONS.map(key => [key, Math.max(0, Math.floor(Number(form.elements[key]?.value) || 0))]));
        return { coins, option: Boolean(form.elements.option?.checked) };
      }
    },
    rejectClose: false,
    modal: true
  }).catch(() => null);
  if (!values || DENOMINATIONS.every(key => !values.coins[key])) return;

  if (isAdd) {
    await actor.inventory.addCurrency(values.coins, { combineStacks: values.option });
  } else if (!await actor.inventory.removeCurrency(values.coins, { byValue: values.option })) {
    ui.notifications.warn("PF2E.ErrorMessage.NotEnoughCoins", { localize: true });
  }
}
