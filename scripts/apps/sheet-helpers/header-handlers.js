import { clamp, isIOSDevice } from "../../utils/sheet-utils.js";
import { PhysicalDiceManager } from "../../rolls/physical-dice-interceptor.js";
import { setTargetToken } from "../../tokens/token-adapter.js";

/**
 * Action handler: Apply delta damage (-) or heal (+) from the left-hand delta input.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLInputElement} target
 */
export async function onApplyDeltaHP(sheet, event, target) {
  const raw = (target.value ?? "").trim();
  if (!raw) return;

  const tokenDoc = sheet.token ?? sheet.actor.getActiveTokens(true, true)[0] ?? sheet.actor.getActiveTokens()[0]?.document ?? null;
  let delta = 0;

  if (raw.startsWith("-")) {
    delta = parseInt(raw.slice(1), 10);
    if (isNaN(delta) || delta <= 0) { target.value = ""; return; }
    if (typeof sheet.actor.applyDamage === "function") {
      await sheet.actor.applyDamage({ damage: delta, token: tokenDoc, final: true });
    } else {
      const hp = sheet.actor.system.attributes.hp;
      const newHP = clamp((hp.value ?? 0) - delta, 0, hp.max ?? 999);
      await sheet.actor.update({ "system.attributes.hp.value": newHP });
    }
  } else {
    // When no '-' is set (e.g. "5" or "+5"), add health
    const cleanStr = raw.startsWith("+") ? raw.slice(1) : raw;
    delta = parseInt(cleanStr, 10);
    if (isNaN(delta) || delta <= 0) { target.value = ""; return; }
    if (typeof sheet.actor.applyDamage === "function") {
      await sheet.actor.applyDamage({ damage: -delta, token: tokenDoc, final: true });
    } else {
      const hp = sheet.actor.system.attributes.hp;
      const newHP = clamp((hp.value ?? 0) + delta, 0, hp.max ?? 999);
      await sheet.actor.update({ "system.attributes.hp.value": newHP });
    }
  }

  target.value = "";
  sheet.render({ parts: ["header"] });
}

/**
 * Action handler: Directly set HP or apply +/- delta to current HP.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLInputElement} target
 */
export async function onSetDirectHP(sheet, event, target) {
  const raw = (target.value ?? "").trim();
  if (!raw) return;

  const tokenDoc = sheet.token ?? sheet.actor.getActiveTokens(true, true)[0] ?? sheet.actor.getActiveTokens()[0]?.document ?? null;
  const hp = sheet.actor.system.attributes.hp;
  const maxHP = hp?.max ?? 999;

  if (raw.startsWith("+")) {
    const delta = parseInt(raw.slice(1), 10);
    if (!isNaN(delta) && delta > 0) {
      if (typeof sheet.actor.applyDamage === "function") {
        await sheet.actor.applyDamage({ damage: -delta, token: tokenDoc, final: true });
      } else {
        await sheet.actor.update({ "system.attributes.hp.value": clamp((hp.value ?? 0) + delta, 0, maxHP) });
      }
    }
  } else if (raw.startsWith("-")) {
    const delta = parseInt(raw.slice(1), 10);
    if (!isNaN(delta) && delta > 0) {
      if (typeof sheet.actor.applyDamage === "function") {
        await sheet.actor.applyDamage({ damage: delta, token: tokenDoc, final: true });
      } else {
        await sheet.actor.update({ "system.attributes.hp.value": clamp((hp.value ?? 0) - delta, 0, maxHP) });
      }
    }
  } else {
    const val = parseInt(raw, 10);
    if (!isNaN(val)) {
      const newHP = clamp(val, 0, maxHP);
      await sheet.actor.update({ "system.attributes.hp.value": newHP });
    }
  }

  sheet.render({ parts: ["header"] });
}

/**
 * Action handler: Directly set Temp HP or apply +/- delta to Temp HP.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLInputElement} target
 */
export async function onSetDirectTempHP(sheet, event, target) {
  const raw = (target.value ?? "").trim();
  if (!raw) return;

  const currentTemp = sheet.actor.system.attributes.hp?.temp ?? 0;

  if (raw.startsWith("+")) {
    const delta = parseInt(raw.slice(1), 10);
    if (!isNaN(delta) && delta > 0) {
      await sheet.actor.update({ "system.attributes.hp.temp": currentTemp + delta });
    }
  } else if (raw.startsWith("-")) {
    const delta = parseInt(raw.slice(1), 10);
    if (!isNaN(delta) && delta > 0) {
      await sheet.actor.update({ "system.attributes.hp.temp": Math.max(0, currentTemp - delta) });
    }
  } else {
    const val = parseInt(raw, 10);
    if (!isNaN(val)) {
      await sheet.actor.update({ "system.attributes.hp.temp": Math.max(0, val) });
    }
  }

  sheet.render({ parts: ["header"] });
}

/**
 * Action handler: Roll Perception check or Initiative roll from perception dropdown.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLSelectElement} target
 */
export async function onRollPerceptionOrInitiative(sheet, event, target) {
  const choice = target.value;
  target.selectedIndex = 0;
  if (choice === "perception") {
    return onRollPerception(sheet, event, target);
  } else if (choice === "initiative") {
    return onRollInitiative(sheet, event, target);
  }
}

/**
 * Action handler: apply damage to HP using PF2e's native system calculation.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onApplyDamage(sheet, event, target) {
  const input = sheet.element.querySelector(".hp-delta-input");
  const amount = parseInt(input?.value, 10) || 1;
  if (amount <= 0) return;

  const tokenDoc = sheet.token ?? sheet.actor.getActiveTokens(true, true)[0] ?? sheet.actor.getActiveTokens()[0]?.document ?? null;

  if (typeof sheet.actor.applyDamage === "function") {
    await sheet.actor.applyDamage({ damage: amount, token: tokenDoc, final: true });
  } else {
    const hp = sheet.actor.system.attributes.hp;
    const temp = hp.temp ?? 0;
    const current = hp.value ?? 0;

    let remainingDamage = amount;
    let newTemp = temp;
    if (temp > 0) {
      if (temp >= remainingDamage) {
        newTemp = temp - remainingDamage;
        remainingDamage = 0;
      } else {
        remainingDamage -= temp;
        newTemp = 0;
      }
    }

    const newHP = clamp(current - remainingDamage, 0, hp.max ?? current);
    const updateData = { "system.attributes.hp.value": newHP };
    if (newTemp !== temp) updateData["system.attributes.hp.temp"] = newTemp;
    await sheet.actor.update(updateData);
  }

  if (input) input.value = "";
}

/**
 * Action handler: apply healing to HP using PF2e's native system calculation.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onApplyHeal(sheet, event, target) {
  const input = sheet.element.querySelector(".hp-delta-input");
  const amount = parseInt(input?.value, 10) || 1;
  if (amount <= 0) return;

  const tokenDoc = sheet.token ?? sheet.actor.getActiveTokens(true, true)[0] ?? sheet.actor.getActiveTokens()[0]?.document ?? null;

  if (typeof sheet.actor.applyDamage === "function") {
    await sheet.actor.applyDamage({ damage: -amount, token: tokenDoc, final: true });
  } else {
    const hp = sheet.actor.system.attributes.hp;
    const current = hp.value ?? 0;
    const max = hp.max ?? 0;
    const newHP = clamp(current + amount, 0, max);
    await sheet.actor.update({ "system.attributes.hp.value": newHP });
  }

  if (input) input.value = "";
}

/**
 * Action handler: set temporary HP directly from input.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onSetTempHP(sheet, event, target) {
  const val = parseInt(target.value, 10);
  if (isNaN(val)) return;
  const newTemp = Math.max(0, val);
  await sheet.actor.update({ "system.attributes.hp.temp": newTemp });
}

/**
 * Action handler: adjust temporary HP by delta step (+1 / -1).
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onAdjustTempHP(sheet, event, target) {
  const delta = parseInt(target.dataset.delta, 10);
  if (isNaN(delta)) return;

  const currentTemp = sheet.actor.system.attributes.hp?.temp ?? 0;
  const newTemp = Math.max(0, currentTemp + delta);
  await sheet.actor.update({ "system.attributes.hp.temp": newTemp });
}

/**
 * Action handler: roll saving throw (Fortitude, Reflex, or Will).
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onRollSave(sheet, event, target) {
  const saveKey = target.dataset.save;
  if (!saveKey) return;

  const saveStat = sheet.actor.saves?.[saveKey];
  const saveLabel = saveKey.charAt(0).toUpperCase() + saveKey.slice(1);

  await PhysicalDiceManager.withPhysicalMode({
    title: `${saveLabel} Save`,
    actor: sheet.actor
  }, async () => {
    if (typeof saveStat?.roll === "function") {
      await saveStat.roll({ event });
    } else if (typeof sheet.actor.rollSave === "function") {
      await sheet.actor.rollSave(event, saveKey);
    }
  }, sheet.rollMode === "physical");
}

/**
 * Action handler: roll Perception check.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onRollPerception(sheet, event, target) {
  await PhysicalDiceManager.withPhysicalMode({
    title: "Perception Check",
    actor: sheet.actor
  }, async () => {
    if (typeof sheet.actor.perception?.roll === "function") {
      await sheet.actor.perception.roll({ event });
    } else if (typeof sheet.actor.rollPerception === "function") {
      await sheet.actor.rollPerception({ event });
    }
  }, sheet.rollMode === "physical");
}

/**
 * Action handler: roll Initiative check and add to combat when combat is active.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onRollInitiative(sheet, event, target) {
  const combat = game.combat;
  let combatant = combat ? combat.combatants.find(c => c.actor?.id === sheet.actor.id || c.actor === sheet.actor) : null;

  if (combat && !combatant) {
    const scene = combat.scene ?? canvas?.scene ?? game.scenes.viewed ?? game.scenes.active;
    const tokenDoc = sheet.token ?? sheet.actor.getActiveTokens(true, true)[0] ?? sheet.actor.getActiveTokens()[0]?.document ?? scene?.tokens?.find(t => t.actorId === sheet.actor.id) ?? null;

    if (tokenDoc) {
      const created = await combat.createEmbeddedDocuments("Combatant", [{
        tokenId: tokenDoc.id,
        actorId: sheet.actor.id,
        sceneId: scene?.id ?? tokenDoc.scene?.id,
        hidden: tokenDoc.hidden ?? false
      }]);
      combatant = created[0] ?? null;
    } else {
      try {
        const created = await combat.createEmbeddedDocuments("Combatant", [{
          actorId: sheet.actor.id,
          sceneId: scene?.id,
          hidden: false
        }]);
        combatant = created[0] ?? null;
      } catch {
        ui.notifications?.warn?.(`No token found on scene for ${sheet.actor.name}.`);
      }
    }
  }

  await PhysicalDiceManager.withPhysicalMode({
    title: "Initiative Check",
    actor: sheet.actor
  }, async () => {
    if (typeof sheet.actor.initiative?.roll === "function" && combat) {
      await sheet.actor.initiative.roll({ event, combatant: combatant || undefined });
    } else if (typeof sheet.actor.initiative?.statistic?.roll === "function") {
      await sheet.actor.initiative.statistic.roll({ event });
    } else if (typeof sheet.actor.rollInitiative === "function") {
      await sheet.actor.rollInitiative({ createCombatants: true, initiativeOptions: { event } });
    } else if (typeof sheet.actor.perception?.roll === "function") {
      await sheet.actor.perception.roll({ event });
    }
  }, sheet.rollMode === "physical");
}

/**
 * Action handler: select scene token target from header dropdown.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLSelectElement} target
 */
export async function onSelectTarget(sheet, event, target) {
  const tokenId = target.value;
  await setTargetToken(tokenId);
  if (sheet?.rendered) {
    sheet.render({ parts: ["header"] });
  }
}

/**
 * Action handler: toggle digital vs physical roll mode.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLSelectElement} target
 */
export async function onToggleRollMode(sheet, event, target) {
  const newMode = target.value;
  if (newMode === "digital" || newMode === "physical") {
    sheet._rollMode = newMode;
    try {
      localStorage.setItem("pf2e-mobile-compact.rollMode", newMode);
    } catch {}
    try {
      if (game.settings?.settings?.has?.("pf2e-mobile-compact.rollMode")) {
        await game.settings.set("pf2e-mobile-compact", "rollMode", newMode);
      }
    } catch {}
    sheet.render({ parts: ["header"] });
  }
}

let iosFullscreenTipShown = false;

/**
 * Action handler: toggle fullscreen mode for mobile app view.
 * Includes graceful CSS fullscreen fallback and iOS Safari Home Screen PWA guidance.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLElement} target
 */
export async function onToggleFullscreen(sheet, event, target) {
  const sheetEl = target?.closest?.(".pf2e-mobile-sheet") ?? sheet?.element;
  const isCurrentlyFs = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.body.classList.contains("pf2e-fullscreen") ||
    sheetEl?.classList.contains("fullscreen-mode")
  );

  if (!isCurrentlyFs) {
    let nativeEntered = false;
    if (document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
        nativeEntered = true;
      } catch (err) {
        console.warn("PF2e Mobile Compact | Fullscreen request failed, using CSS fullscreen fallback:", err);
      }
    } else if (document.documentElement.webkitRequestFullscreen) {
      try {
        await document.documentElement.webkitRequestFullscreen();
        nativeEntered = true;
      } catch (err) {
        console.warn("PF2e Mobile Compact | WebKit fullscreen request failed, using CSS fullscreen fallback:", err);
      }
    }
    document.body.classList.add("pf2e-fullscreen");
    sheetEl?.classList.add("fullscreen-mode");

    // On iPhone Safari (where Apple disables Fullscreen API on non-video elements), show a helpful one-time tip
    const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone === true;
    if (!nativeEntered && isIOSDevice() && !isStandalone && !iosFullscreenTipShown) {
      iosFullscreenTipShown = true;
      ui.notifications?.info?.("Full-bleed view active. Tip: On iPhone Safari, tap Share → 'Add to Home Screen' for true fullscreen without browser toolbars.");
    }
  } else {
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.warn("PF2e Mobile Compact | Exit fullscreen failed:", err);
      }
    } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      try {
        await document.webkitExitFullscreen();
      } catch (err) {
        console.warn("PF2e Mobile Compact | WebKit exit fullscreen failed:", err);
      }
    }
    document.body.classList.remove("pf2e-fullscreen");
    sheetEl?.classList.remove("fullscreen-mode");
    document.querySelectorAll(".pf2e-mobile-sheet").forEach(s => s.classList.remove("fullscreen-mode"));
  }

  const isNowFs = !isCurrentlyFs;
  const icons = document.querySelectorAll(".btn-fullscreen i");
  for (const icon of icons) {
    icon.className = isNowFs ? "fas fa-compress" : "fas fa-expand";
  }
}

/**
 * Ensures we always retrieve or construct the PF2eMobileSheet instance for the target actor
 * when switching actors from within the mobile sheet.
 */
function getMobileSheetForActor(actor, currentSheet) {
  const SheetClass = currentSheet?.constructor;
  if (actor._mobileSheetInstance && (!SheetClass || SheetClass === Object || actor._mobileSheetInstance instanceof SheetClass)) {
    return actor._mobileSheetInstance;
  }
  if (SheetClass && SheetClass !== Object) {
    if (actor.sheet && actor.sheet instanceof SheetClass) {
      actor._mobileSheetInstance = actor.sheet;
      return actor.sheet;
    }
    actor._mobileSheetInstance = new SheetClass({ document: actor });
    return actor._mobileSheetInstance;
  }
  return actor.sheet;
}

/**
 * Action handler: switch active character sheet to another owned character, Party Sheet, or Kingdom Sheet.
 * @param {object} sheet
 * @param {Event} event
 * @param {HTMLSelectElement} target
 */
export async function onSwitchActor(sheet, event, target) {
  const rawVal = target.value;
  if (!rawVal) return;

  if (rawVal.startsWith("kingdom:")) {
    const partyId = rawVal.slice("kingdom:".length);
    const partyActor = game.actors.get(partyId);
    if (!partyActor) return;

    if (sheet.actor.id === partyActor.id) {
      sheet._isKingdomMode = true;
      sheet._activeTab = "turn";
      await sheet.render(sheet.rendered ? { force: true, parts: ["header", "sheet"] } : { force: true });
      return;
    }

    await sheet.close({ animate: false });
    const targetSheet = getMobileSheetForActor(partyActor, sheet);
    targetSheet._isKingdomMode = true;
    targetSheet._activeTab = "turn";
    await targetSheet.render(targetSheet.rendered ? { force: true, parts: ["header", "sheet"] } : { force: true });
    return;
  }

  const newActorId = rawVal;
  if (newActorId === sheet.actor.id) {
    if (sheet._isKingdomMode) {
      sheet._isKingdomMode = false;
      sheet._activeTab = sheet.actor.type === "party" ? "stash" : "actions";
      await sheet.render(sheet.rendered ? { force: true, parts: ["header", "sheet"] } : { force: true });
    }
    return;
  }

  const newActor = game.actors.get(newActorId);
  if (!newActor) return;

  console.log(`PF2e Mobile Compact | Switching character to ${newActor.name}`);
  await sheet.close({ animate: false });
  const targetSheet = getMobileSheetForActor(newActor, sheet);
  targetSheet._isKingdomMode = false;
  if (newActor.type === "party" && (!targetSheet._activeTab || targetSheet._activeTab === "turn")) {
    targetSheet._activeTab = "stash";
  }
  await targetSheet.render(targetSheet.rendered ? { force: true, parts: ["header", "sheet"] } : { force: true });
}


