/**
 * Action and prompt handlers for Party Sheet and Stash item transfers.
 */

/**
 * Prompts user with a touch-friendly dialog to transfer an item to a party member.
 * @param {object} sheet
 * @param {Item} item
 * @param {Array<Actor>} partyMembers
 * @param {string} [defaultRecipientId]
 * @returns {Promise<{recipient: Actor, quantity: number}|null>}
 */
export async function promptItemTransfer(sheet, item, partyMembers, defaultRecipientId = null) {
  const maxQty = item.quantity ?? item.system?.quantity ?? 1;
  const userCharId = defaultRecipientId ?? game.user.character?.id ?? partyMembers[0]?.id;

  const memberOptionsHtml = partyMembers.map(m => {
    const isSelected = m.id === userCharId;
    const isSelf = m.id === game.user.character?.id;
    return `<option value="${m.id}" ${isSelected ? "selected" : ""}>${isSelf ? "👤 " : ""}${m.name}${isSelf ? " (You)" : ""}</option>`;
  }).join("");

  const qtyHtml = maxQty > 1 ? `
    <div class="form-group" style="margin-bottom: 12px;">
      <label style="display:block; margin-bottom: 6px; font-weight: bold;">Quantity (Max ${maxQty}):</label>
      <div style="display:flex; align-items:center; gap: 8px;">
        <input type="number" id="transfer-qty" name="quantity" value="1" min="1" max="${maxQty}" style="flex:1; text-align:center; font-size:16px; height:42px; border-radius:6px; border:1px solid #444; background:#222; color:#fff;" />
        <button type="button" class="btn-max-qty" style="padding: 0 14px; height:42px; border-radius:6px; background:#444; color:#fff; border:1px solid #666; font-size:14px; font-weight:bold;">All</button>
      </div>
    </div>
  ` : `<input type="hidden" id="transfer-qty" name="quantity" value="1" />`;

  const content = `
    <div class="item-transfer-dialog" style="padding: 6px 0;">
      <div style="display:flex; align-items:center; gap: 10px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #444;">
        <img src="${item.img}" width="38" height="38" style="border-radius:4px; border:1px solid #666;" />
        <div>
          <div style="font-weight:bold; font-size:16px;">${item.name}</div>
          <div style="font-size:12px; color:#aaa;">In Stash: ${maxQty} | Bulk: ${item.bulk ?? item.system?.bulk?.value ?? "-"}</div>
        </div>
      </div>
      <div class="form-group" style="margin-bottom: 12px;">
        <label for="transfer-recipient" style="display:block; margin-bottom: 6px; font-weight: bold;">Give to Member:</label>
        <select id="transfer-recipient" name="recipient" style="width:100%; height:44px; font-size:15px; border-radius:6px; border:1px solid #444; background:#222; color:#fff; padding: 0 8px;">
          ${memberOptionsHtml}
        </select>
      </div>
      ${qtyHtml}
    </div>
  `;

  const DialogClass = foundry.applications?.api?.DialogV2 ?? globalThis.Dialog;
  if (foundry.applications?.api?.DialogV2?.wait) {
    return await foundry.applications.api.DialogV2.wait({
      window: { title: `Transfer Item: ${item.name}` },
      content,
      buttons: [
        {
          action: "transfer",
          label: "Transfer",
          icon: "fa-solid fa-hand-holding",
          default: true,
          callback: (event, button, dialog) => {
            const html = dialog.element;
            const recipientId = html.querySelector("#transfer-recipient")?.value;
            const qtyInput = html.querySelector("#transfer-qty")?.value;
            const quantity = Math.min(Math.max(parseInt(qtyInput, 10) || 1, 1), maxQty);
            const recipient = partyMembers.find(m => m.id === recipientId);
            return recipient ? { recipient, quantity } : null;
          }
        },
        {
          action: "cancel",
          label: "Cancel",
          icon: "fa-solid fa-times"
        }
      ],
      render: (event, dialog) => {
        const html = dialog.element;
        const allBtn = html.querySelector(".btn-max-qty");
        const qtyInput = html.querySelector("#transfer-qty");
        if (allBtn && qtyInput) {
          allBtn.addEventListener("click", () => {
            qtyInput.value = maxQty;
          });
        }
        // Guard native mobile dropdown
        const sel = html.querySelector("select");
        if (sel) {
          sel.addEventListener("click", e => e.stopPropagation());
        }
      }
    });
  }

  // Classic Dialog fallback
  return new Promise((resolve) => {
    new Dialog({
      title: `Transfer Item: ${item.name}`,
      content,
      buttons: {
        transfer: {
          icon: '<i class="fas fa-hand-holding"></i>',
          label: "Transfer",
          callback: (html) => {
            const recipientId = html.find("#transfer-recipient").val();
            const qtyInput = html.find("#transfer-qty").val();
            const quantity = Math.min(Math.max(parseInt(qtyInput, 10) || 1, 1), maxQty);
            const recipient = partyMembers.find(m => m.id === recipientId);
            resolve(recipient ? { recipient, quantity } : null);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      default: "transfer",
      render: (html) => {
        html.find(".btn-max-qty").on("click", () => {
          html.find("#transfer-qty").val(maxQty);
        });
      }
    }).render(true);
  });
}

/**
 * Action handler: Transfer an item from the Party Stash to a party member.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onTransferStashItem(sheet, event, target) {
  const itemId = target.dataset.itemId;
  if (!itemId) return;

  const item = sheet.actor.items.get(itemId);
  if (!item) {
    ui.notifications.warn("Item not found in party stash.");
    return;
  }

  const partyMembers = sheet.actor.members ?? [];
  if (!partyMembers.length) {
    ui.notifications.warn("No members in this party to receive items.");
    return;
  }

  const result = await promptItemTransfer(sheet, item, partyMembers);
  if (!result || !result.recipient) return;

  const { recipient, quantity } = result;

  try {
    if (typeof sheet.actor.transferItemToActor === "function") {
      await sheet.actor.transferItemToActor(recipient, item, quantity);
    } else {
      ui.notifications.error("Native transfer method not supported on this actor.");
      return;
    }

    ui.notifications.info(`Transferred ${quantity}x ${item.name} to ${recipient.name}.`);
    sheet.render({ parts: ["sheet"] });
  } catch (err) {
    console.error("PF2e Mobile Compact | Error transferring stash item:", err);
    ui.notifications.error(`Transfer failed: ${err.message}`);
  }
}

/**
 * Action handler: Send an item from a character's inventory directly into the party stash.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onSendToPartyStash(sheet, event, target) {
  const itemId = target.dataset.itemId;
  if (!itemId) return;

  const item = sheet.actor.items.get(itemId);
  if (!item) {
    ui.notifications.warn("Item not found in inventory.");
    return;
  }

  const party = Array.from(sheet.actor.parties ?? [])[0]
    ?? (game.actors.party?.members.some(m => m.id === sheet.actor.id) ? game.actors.party : null)
    ?? game.actors.find(a => a.type === "party" && a.members?.some(m => m.id === sheet.actor.id));

  if (!party) {
    ui.notifications.warn("Character does not belong to any active party.");
    return;
  }

  const maxQty = item.quantity ?? item.system?.quantity ?? 1;
  let quantity = 1;

  if (maxQty > 1) {
    const DialogClass = foundry.applications?.api?.DialogV2 ?? globalThis.Dialog;
    const content = `
      <div style="padding: 6px 0;">
        <p style="margin-bottom: 10px;">Send <strong>${item.name}</strong> to <strong>${party.name}</strong> Stash:</p>
        <div style="display:flex; align-items:center; gap: 8px;">
          <input type="number" id="stash-qty" value="1" min="1" max="${maxQty}" style="flex:1; text-align:center; font-size:16px; height:42px; border-radius:6px; border:1px solid #444; background:#222; color:#fff;" />
          <button type="button" class="btn-max-qty" style="padding: 0 14px; height:42px; border-radius:6px; background:#444; color:#fff; border:1px solid #666; font-size:14px; font-weight:bold;">All</button>
        </div>
      </div>
    `;

    if (foundry.applications?.api?.DialogV2?.wait) {
      const confirmed = await foundry.applications.api.DialogV2.wait({
        window: { title: `Deposit to Party Stash` },
        content,
        buttons: [
          {
            action: "send",
            label: "Send to Stash",
            icon: "fa-solid fa-box-archive",
            default: true,
            callback: (e, btn, dialog) => {
              const qtyInput = dialog.element.querySelector("#stash-qty")?.value;
              return Math.min(Math.max(parseInt(qtyInput, 10) || 1, 1), maxQty);
            }
          },
          { action: "cancel", label: "Cancel", icon: "fa-solid fa-times" }
        ],
        render: (e, dialog) => {
          const allBtn = dialog.element.querySelector(".btn-max-qty");
          const input = dialog.element.querySelector("#stash-qty");
          if (allBtn && input) allBtn.addEventListener("click", () => { input.value = maxQty; });
        }
      });
      if (!confirmed) return;
      quantity = confirmed;
    } else {
      quantity = await new Promise((resolve) => {
        new Dialog({
          title: `Deposit to Party Stash`,
          content,
          buttons: {
            send: {
              icon: '<i class="fas fa-box-archive"></i>',
              label: "Send to Stash",
              callback: (html) => {
                const val = parseInt(html.find("#stash-qty").val(), 10) || 1;
                resolve(Math.min(Math.max(val, 1), maxQty));
              }
            },
            cancel: { label: "Cancel", callback: () => resolve(null) }
          },
          default: "send"
        }).render(true);
      });
      if (!quantity) return;
    }
  }

  try {
    if (typeof sheet.actor.transferItemToActor === "function") {
      await sheet.actor.transferItemToActor(party, item, quantity);
    } else {
      ui.notifications.error("Native transfer method not supported on this actor.");
      return;
    }

    ui.notifications.info(`Sent ${quantity}x ${item.name} to ${party.name} Stash.`);
    sheet.render({ parts: ["sheet"] });
  } catch (err) {
    console.error("PF2e Mobile Compact | Error sending item to party stash:", err);
    ui.notifications.error(`Deposit failed: ${err.message}`);
  }
}

/**
 * Action handler: Open or switch sheet to the Party Stash actor.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onOpenPartyStash(sheet, event, target) {
  const partyId = target?.dataset?.partyId
    ?? Array.from(sheet.actor.parties ?? [])[0]?.id
    ?? game.actors.party?.id
    ?? game.actors.find(a => a.type === "party" && a.members?.some(m => m.id === sheet.actor.id))?.id;

  if (!partyId) {
    ui.notifications.warn("No party found for this character.");
    return;
  }

  const partyActor = game.actors.get(partyId);
  if (!partyActor) return;

  await sheet.close();
  partyActor.sheet.render(true);
}

/**
 * Action handler: Switch from Party Overview to an owned party member's sheet.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onSwitchToPartyMember(sheet, event, target) {
  const actorId = target?.dataset?.actorId;
  if (!actorId) return;

  const memberActor = game.actors.get(actorId);
  if (!memberActor) return;

  await sheet.close();
  memberActor.sheet.render(true);
}

/**
 * Action handler: Transfer coins between party stash and a party member.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onTransferCoins(sheet, event, target) {
  const isParty = sheet.actor.type === "party";
  const party = isParty ? sheet.actor : (Array.from(sheet.actor.parties ?? [])[0] ?? game.actors.party);
  if (!party) {
    ui.notifications.warn("No active party available.");
    return;
  }

  const partyMembers = party.members ?? [];
  if (!partyMembers.length) {
    ui.notifications.warn("No party members found.");
    return;
  }

  const userCharId = game.user.character?.id ?? partyMembers[0]?.id;
  const memberOptionsHtml = partyMembers.map(m => {
    const isSelected = m.id === userCharId;
    return `<option value="${m.id}" ${isSelected ? "selected" : ""}>${m.name}</option>`;
  }).join("");

  const stashCoins = party.inventory?.coins ?? { pp: 0, gp: 0, sp: 0, cp: 0 };

  const content = `
    <div class="m-dialog" style="padding: 6px 0;">
      <div class="form-group m-flex-col" style="margin-bottom: 10px; align-items: stretch;">
        <label style="display:block; margin-bottom: 4px; font-weight: bold;">Direction:</label>
        <select id="coin-direction" style="width:100%; height:42px; border-radius:6px; background:#222; color:#fff; border:1px solid #444; padding:0 8px;">
          <option value="withdraw" selected>Withdraw from Stash to Member</option>
          <option value="deposit">Deposit from Member to Stash</option>
        </select>
      </div>
      <div class="form-group m-flex-col" style="margin-bottom: 10px; align-items: stretch;">
        <label style="display:block; margin-bottom: 4px; font-weight: bold;">Party Member:</label>
        <select id="coin-member" style="width:100%; height:42px; border-radius:6px; background:#222; color:#fff; border:1px solid #444; padding:0 8px;">
          ${memberOptionsHtml}
        </select>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;">
        <div>
          <label style="font-weight:bold; font-size:12px;">Platinum (PP):</label>
          <input type="number" id="coin-pp" value="0" min="0" style="width:100%; height:38px; text-align:center; border-radius:6px; background:#222; color:#fff; border:1px solid #444;" />
        </div>
        <div>
          <label style="font-weight:bold; font-size:12px;">Gold (GP):</label>
          <input type="number" id="coin-gp" value="0" min="0" style="width:100%; height:38px; text-align:center; border-radius:6px; background:#222; color:#fff; border:1px solid #444;" />
        </div>
        <div>
          <label style="font-weight:bold; font-size:12px;">Silver (SP):</label>
          <input type="number" id="coin-sp" value="0" min="0" style="width:100%; height:38px; text-align:center; border-radius:6px; background:#222; color:#fff; border:1px solid #444;" />
        </div>
        <div>
          <label style="font-weight:bold; font-size:12px;">Copper (CP):</label>
          <input type="number" id="coin-cp" value="0" min="0" style="width:100%; height:38px; text-align:center; border-radius:6px; background:#222; color:#fff; border:1px solid #444;" />
        </div>
      </div>
      <div style="font-size:12px; color:#aaa; margin-top:8px;">
        Stash balance: ${stashCoins.pp ?? 0} pp, ${stashCoins.gp ?? 0} gp, ${stashCoins.sp ?? 0} sp, ${stashCoins.cp ?? 0} cp
      </div>
    </div>
  `;

  if (foundry.applications?.api?.DialogV2?.wait) {
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: "Transfer Currency" },
      content,
      buttons: [
        {
          action: "transfer",
          label: "Execute Transfer",
          icon: "fa-solid fa-coins",
          default: true,
          callback: (e, btn, dialog) => {
            const html = dialog.element;
            const dir = html.querySelector("#coin-direction")?.value;
            const memId = html.querySelector("#coin-member")?.value;
            const pp = Math.max(parseInt(html.querySelector("#coin-pp")?.value, 10) || 0, 0);
            const gp = Math.max(parseInt(html.querySelector("#coin-gp")?.value, 10) || 0, 0);
            const sp = Math.max(parseInt(html.querySelector("#coin-sp")?.value, 10) || 0, 0);
            const cp = Math.max(parseInt(html.querySelector("#coin-cp")?.value, 10) || 0, 0);
            return { dir, memId, coins: { pp, gp, sp, cp } };
          }
        },
        { action: "cancel", label: "Cancel", icon: "fa-solid fa-times" }
      ],
      render: (e, dialog) => {
        dialog.element.querySelectorAll("select").forEach(sel => {
          sel.addEventListener("click", ev => ev.stopPropagation());
        });
      }
    });

    if (!result) return;
    const { dir, memId, coins } = result;
    const targetMember = partyMembers.find(m => m.id === memId);
    if (!targetMember) return;

    const CoinsClass = CONFIG.PF2E?.Coins ?? globalThis.Coins;
    const coinsObj = CoinsClass ? new CoinsClass(coins) : coins;

    try {
      if (dir === "withdraw") {
        if (typeof party.inventory?.removeCoins === "function") {
          const success = await party.inventory.removeCoins(coinsObj);
          if (success) {
            await targetMember.inventory?.addCoins?.(coinsObj);
            ui.notifications.info(`Withdrew coins from stash to ${targetMember.name}.`);
          } else {
            ui.notifications.warn("Insufficient coins in party stash.");
          }
        }
      } else {
        if (typeof targetMember.inventory?.removeCoins === "function") {
          const success = await targetMember.inventory.removeCoins(coinsObj);
          if (success) {
            await party.inventory?.addCoins?.(coinsObj);
            ui.notifications.info(`Deposited coins from ${targetMember.name} to stash.`);
          } else {
            ui.notifications.warn(`Insufficient coins on ${targetMember.name}.`);
          }
        }
      }
      sheet.render({ parts: ["sheet", "header"] });
    } catch (err) {
      console.error("PF2e Mobile Compact | Error transferring coins:", err);
      ui.notifications.error(`Currency transfer failed: ${err.message}`);
    }
  }
}
