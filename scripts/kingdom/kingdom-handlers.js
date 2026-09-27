import { PhysicalDiceManager } from "../rolls/physical-dice-interceptor.js";

/**
 * Resolves the active Party Actor from any actor (either the party actor itself,
 * one of the character's parties, or the game's active party).
 * @param {Actor} actor
 * @returns {Actor|null}
 */
export function getPartyActor(actor) {
  if (!actor) return game.actors?.party ?? null;
  if (actor.type === "party") return actor;
  const fromParties = actor.parties ? Array.from(actor.parties)[0] : null;
  if (fromParties) return fromParties;
  if (game.actors?.party) return game.actors.party;
  return game.actors?.find?.((a) => a.type === "party") ?? null;
}

/**
 * Checks whether a Party Actor has active Kingdom data from `pf2e-kingmaker-tools`
 * or native PF2e Kingmaker Campaign mode (`actor.system.campaign`).
 * @param {Actor} partyActor
 * @returns {boolean}
 */
export function hasKingdomData(partyActor) {
  if (!partyActor || partyActor.type !== "party") return false;
  const hasKmTools = Boolean(
    game.modules?.get("pf2e-kingmaker-tools")?.active &&
    (partyActor.flags?.["pf2e-kingmaker-tools"]?.["kingdom-sheet"] ??
      partyActor.getFlag?.("pf2e-kingmaker-tools", "kingdom-sheet"))
  );
  const hasNativeCampaign = Boolean(partyActor.system?.campaign?.level !== undefined);
  return hasKmTools || hasNativeCampaign;
}

/**
 * Retrieves the Kingdom's display name from `pf2e-kingmaker-tools` or native PF2e `actor.system.campaign`.
 * @param {Actor} partyActor
 * @returns {string}
 */
export function getKingdomName(partyActor) {
  if (!partyActor) return "Kingdom";
  const flag = partyActor.flags?.["pf2e-kingmaker-tools"]?.["kingdom-sheet"]
    ?? partyActor.getFlag?.("pf2e-kingmaker-tools", "kingdom-sheet");
  return flag?.name || partyActor.system?.campaign?.name || `${partyActor.name}'s Kingdom`;
}

/**
 * Locates an existing `KingdomSheet` instance from `partyActor.apps` or `foundry.applications.instances`.
 * Note: `FormApp` in `pf2e-kingmaker-tools` registers itself on `partyActor.apps[appId]` synchronously in `init`.
 * @param {Actor} partyActor
 * @returns {object|null}
 */
export function findExistingKingdomApp(partyActor) {
  if (!partyActor) return null;
  const appId = `kmKingdomSheet-${partyActor.uuid}`;
  if (partyActor.apps?.[appId]) return partyActor.apps[appId];
  if (foundry.applications?.instances?.get?.(appId)) {
    return foundry.applications.instances.get(appId);
  }
  for (const app of Object.values(partyActor.apps ?? {})) {
    if (app?.id === appId || String(app?.id || "").startsWith("kmKingdomSheet-")) {
      return app;
    }
  }
  return null;
}

/**
 * Retrieves or initializes the `pf2e-kingmaker-tools` `KingdomSheet` instance (`kmKingdomSheet-${partyActor.uuid}`)
 * as a hidden background data/action engine without ever showing its desktop window on mobile.
 * @param {Actor} partyActor
 * @param {boolean} [openIfMissing=true]
 * @returns {Promise<object|null>}
 */
export async function getOrInitKingdomApp(partyActor, openIfMissing = true) {
  if (!partyActor || typeof foundry === "undefined") return null;
  let kmApp = findExistingKingdomApp(partyActor);

  if (!kmApp && openIfMissing && game.pf2eKingmakerTools?.macros?.openSheet) {
    try {
      globalThis._initializingKingdomProxy = true;
      await game.pf2eKingmakerTools.macros.openSheet("kingdom", partyActor.id);
      for (let i = 0; i < 25 && !kmApp; i++) {
        kmApp = findExistingKingdomApp(partyActor);
        if (!kmApp) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
    } catch (err) {
      console.warn("PF2e Mobile Compact | Could not initialize pf2e-kingmaker-tools KingdomSheet:", err);
    } finally {
      globalThis._initializingKingdomProxy = false;
    }
  }

  if (kmApp?.element) {
    kmApp.element.classList.add("km-mobile-hidden-proxy");
    kmApp.element.style.setProperty("display", "none", "important");
  }

  return kmApp;
}

/**
 * Prepares the Mobile Kingdom Sheet context by calling `kmApp._preparePartContext("form", {}, {})`
 * directly on `pf2e-kingmaker-tools` (with native PF2e `partyActor.system.campaign` fallback).
 * Zero game constants, rules, or activities are duplicated here.
 * @param {Actor} partyActor
 * @param {object} sheet
 * @param {object} context
 */
/**
 * Populates missing fields on `km` directly from the `pf2e-kingmaker-tools` flag stored on `partyActor`
 * (`partyActor.flags["pf2e-kingmaker-tools"]["kingdom-sheet"]`) if `kmApp._preparePartContext` has not yet returned.
 * @param {Actor} partyActor
 * @param {object} km
 */
function applyKingdomFlagFallback(partyActor, km) {
  const flag = partyActor?.flags?.["pf2e-kingmaker-tools"]?.["kingdom-sheet"]
    ?? partyActor?.getFlag?.("pf2e-kingmaker-tools", "kingdom-sheet");
  if (!flag) return;

  km.kingdomNameInput ??= { value: flag.name || getKingdomName(partyActor) };
  km.levelInput ??= { value: flag.level ?? 1 };
  km.xpInput ??= { value: flag.xp ?? 0 };
  km.xpThresholdInput ??= { value: flag.xpThreshold ?? 1000 };
  km.unrestInput ??= { value: flag.unrest ?? 0 };
  km.atWarInput ??= { value: Boolean(flag.atWar) };

  if (!km.fameContext && flag.fame) {
    const fType = flag.fame.type || "Fame";
    km.fameContext = {
      type: {
        value: fType,
        options: [
          { value: "Fame", label: "Fame", selected: fType === "Fame" },
          { value: "Infamy", label: "Infamy", selected: fType === "Infamy" }
        ]
      },
      now: { label: fType, value: flag.fame.now ?? 0 },
      max: { label: `Max ${fType}`, value: flag.fame.max ?? 3 }
    };
  }

  if (!km.resourcePoints && flag.resourcePoints) {
    km.resourcePoints = {
      now: { value: flag.resourcePoints.now ?? 0 },
      prev: { value: flag.resourcePoints.prev ?? 0 }
    };
  }
  if (!km.resourceDice) {
    km.resourceDice = {
      number: (flag.level ?? 1) + 4,
      faces: 6,
      bonus: { value: flag.resourceDice?.bonus ?? 0 },
      penalty: { value: flag.resourceDice?.penalty ?? 0 }
    };
  }

  if (!km.commoditiesContext && flag.commodities) {
    km.commoditiesContext = Object.entries(flag.commodities).map(([type, data]) => ({
      type,
      name: type.charAt(0).toUpperCase() + type.slice(1).toLowerCase(),
      now: { name: `commodities.${type}.now`, value: data?.now ?? 0 },
      max: { name: `commodities.${type}.max`, value: data?.max ?? 4 }
    }));
  }

  if (!km.ruinContext && flag.ruin) {
    km.ruinContext = Object.entries(flag.ruin).map(([type, data]) => ({
      type,
      name: type.charAt(0).toUpperCase() + type.slice(1).toLowerCase(),
      score: { name: `ruin.${type}.score`, value: data?.score ?? 0 },
      penalty: { name: `ruin.${type}.penalty`, value: data?.penalty ?? 0 },
      threshold: { name: `ruin.${type}.threshold`, value: data?.threshold ?? 10 }
    }));
  }

  if (!km.workSitesContext && flag.workSites) {
    km.workSitesContext = Object.entries(flag.workSites).map(([type, data]) => ({
      type,
      name: type.charAt(0).toUpperCase() + type.slice(1).toLowerCase(),
      normal: { name: `workSites.${type}.normal`, value: data?.normal ?? 0 },
      resource: { name: `workSites.${type}.resource`, value: data?.resource ?? 0 }
    }));
  }

  if (!km.consumption && flag.consumption) {
    const base = flag.consumption.base ?? 0;
    const red = flag.consumption.reduction ?? 0;
    km.consumption = {
      total: Math.max(0, base - red),
      base: { value: base },
      reduction: { value: red }
    };
  }

  if (!km.abilities && flag.abilityScores) {
    km.abilities = Object.entries(flag.abilityScores).map(([type, score]) => {
      const s = Number(score ?? 10);
      return {
        type,
        name: type.charAt(0) + type.slice(1).toLowerCase(),
        score: s,
        modifier: Math.floor((s - 10) / 2),
        ruinName: "",
        ruinScore: 0,
        ruinPenalty: 0,
        ruinThreshold: 10
      };
    });
  }

  if (!km.skills && flag.skillRanks) {
    km.skills = Object.entries(flag.skillRanks).map(([skill, rank]) => ({
      skill,
      name: skill.charAt(0) + skill.slice(1).toLowerCase(),
      abilityName: "",
      totalModifier: 0,
      proficiencyRank: {
        value: rank,
        options: ["UNTRAINED", "TRAINED", "EXPERT", "MASTER", "LEGENDARY"].map((r) => ({
          value: r,
          label: r.charAt(0) + r.slice(1).toLowerCase(),
          selected: r === rank
        }))
      }
    }));
  }

  if (!km.settlementInput && Array.isArray(flag.settlements) && flag.settlements.length > 0) {
    const first = flag.settlements[0];
    km.settlementInput = {
      value: first.id,
      options: flag.settlements.map((s, idx) => ({
        value: s.id,
        label: s.name || `Settlement ${idx + 1}`,
        selected: idx === 0
      }))
    };
    km.settlement ??= {
      id: first.id,
      name: { value: first.name || "Settlement" },
      type: { value: first.type || "VILLAGE", options: [{ value: first.type || "VILLAGE", label: first.type || "Village", selected: true }] },
      level: first.level ?? 1,
      consumption: first.consumption ?? 1,
      isCapital: { value: Boolean(first.isCapital) },
      waterBorders: { value: first.waterBorders ?? 0 },
      influence: first.influence ?? 0,
      magicItems: [0, 0, 0],
      notes: { value: first.notes ?? "" },
      lots: []
    };
  }

  if (!km.leadersContext && flag.leaders) {
    const roleMeta = [
      { key: "RULER", id: "ruler", label: "Ruler (Loyalty)" },
      { key: "COUNSELOR", id: "counselor", label: "Counselor (Culture)" },
      { key: "GENERAL", id: "general", label: "General (Stability)" },
      { key: "EMISSARY", id: "emissary", label: "Emissary (Loyalty)" },
      { key: "MAGISTER", id: "magister", label: "Magister (Culture)" },
      { key: "TREASURER", id: "treasurer", label: "Treasurer (Economy)" },
      { key: "VICEROY", id: "viceroy", label: "Viceroy (Economy)" },
      { key: "WARDEN", id: "warden", label: "Warden (Stability)" }
    ];
    km.leadersContext = roleMeta.map((rm) => {
      const ld = flag.leaders[rm.key] ?? flag.leaders[rm.id] ?? {};
      const assignedActor = ld.actorId ? game.actors?.get?.(ld.actorId) : null;
      return {
        leader: rm.id,
        label: rm.label,
        actor: assignedActor
          ? {
              name: assignedActor.name,
              img: assignedActor.img,
              bonus: ld.bonus ?? "",
              uuidInput: { name: `leaders.${rm.id}.uuid`, value: assignedActor.uuid }
            }
          : null,
        type: {
          name: `leaders.${rm.id}.type`,
          value: ld.type || (ld.invested ? "invested" : "uninvested"),
          options: [
            { value: "invested", label: "Invested" },
            { value: "skilled", label: "Skilled" },
            { value: "uninvested", label: "Uninvested" }
          ]
        },
        invested: { name: `leaders.${rm.id}.invested`, value: Boolean(ld.invested), label: "Invested" },
        vacant: { name: `leaders.${rm.id}.vacant`, value: Boolean(ld.vacant), label: rm.label }
      };
    });
  }

  km.charter ??= { name: flag.charter?.name || flag.charter?.type || "None" };
  km.heartland ??= { name: flag.heartland?.name || flag.heartland?.type || "None" };
  km.government ??= { name: flag.government?.name || flag.government?.type || "None" };
  km.notesInput ??= { value: flag.notes ?? "" };
  km.ongoingEventsInput ??= { value: flag.ongoingEvents ?? "" };
}

/**
 * Normalizes `pf2e-kingmaker-tools` `_preparePartContext` fields and flag fallback fields
 * into consistent arrays and objects for the mobile Handlebars templates.
 */
function normalizeKingdomViewData(partyActor, km) {
  const candidateActors = (game.actors?.filter?.((a) => a.type === "character" || a.type === "npc") ?? []).map((a) => ({
    uuid: a.uuid || `Actor.${a.id}`,
    name: a.name
  }));

  if (Array.isArray(km.leadersContext)) {
    for (const role of km.leadersContext) {
      const roleId = role.leader || role.role || "ruler";
      role.fieldId = roleId;
      role.displayName = role.label || role.name || roleId;
      role.actorUuidField = role.actor?.uuidInput?.name || `leaders.${roleId}.uuid`;
      role.selectedActorUuid = role.actor?.uuidInput?.value || "";
      role.leaderBonus = role.actor?.bonus ?? null;
      role.candidateOptions = candidateActors.map((ca) => ({
        uuid: ca.uuid,
        name: ca.name,
        selected: ca.uuid === role.selectedActorUuid
      }));
      if (Array.isArray(role.type?.options)) {
        for (const opt of role.type.options) {
          opt.selected = opt.value === role.type.value;
        }
      }
      role.hasLeaderTypeOptions = Boolean(km.enableLeadershipModifiers && Array.isArray(role.type?.options));
      role.investedFieldName = role.invested?.name || `leaders.${roleId}.invested`;
      role.isInvested = Boolean(role.invested?.value);
      role.vacantFieldName = role.vacant?.name || `leaders.${roleId}.vacant`;
      role.isVacant = Boolean(role.vacant?.value);
    }
  }

  km.rpNowInput = km.resourcePointsContext?.now ?? km.resourcePoints?.now ?? { name: "resourcePoints.now", value: 0 };
  km.rpNextInput = km.resourcePointsContext?.next ?? km.resourcePoints?.prev ?? { name: "resourcePoints.next", value: 0 };
  km.rdNowDisplay = km.resourceDiceContext?.now?.value ?? km.resourceDiceIncome ?? `${km.resourceDice?.number ?? 5}d${km.resourceDice?.faces ?? 6}`;
  km.rdNextDisplay = km.resourceDiceContext?.next?.value ?? "";

  if (km.commoditiesContext && !Array.isArray(km.commoditiesContext) && km.commoditiesContext.now) {
    const keys = ["food", "lumber", "stone", "ore", "luxuries"];
    km.commoditiesArray = keys.map((k) => ({
      type: k,
      name: k.charAt(0).toUpperCase() + k.slice(1),
      now: km.commoditiesContext.now[k] ?? { name: `commodities.${k}.now`, value: 0 },
      max: { value: km.commoditiesContext.capacity?.[k] ?? 4 },
      next: km.commoditiesContext.next?.[k] ?? { name: `commodities.${k}.next`, value: 0 }
    }));
  } else if (Array.isArray(km.commoditiesContext)) {
    km.commoditiesArray = km.commoditiesContext;
  } else {
    km.commoditiesArray = [];
  }

  if (Array.isArray(km.ruinContext)) {
    km.ruinArray = km.ruinContext.map((r) => ({
      name: r.name || r.value?.label || r.type || "Ruin",
      score: r.score ?? r.value ?? { value: 0 },
      threshold: r.threshold ?? { value: r.thresholdValue ?? 10 },
      thresholdDisplay: r.thresholdValue ?? r.threshold?.value ?? 10,
      penalty: r.penalty ?? { value: 0 }
    }));
  } else {
    km.ruinArray = [];
  }

  const rawWorksites = km.worksitesContext ?? km.workSitesContext ?? [];
  km.worksitesArray = Array.isArray(rawWorksites)
    ? rawWorksites.map((ws) => ({
        name: ws.name || ws.label || ws.type || "Worksite",
        normal: ws.normal ?? ws.quantity ?? { value: ws.quantityValue ?? 0 },
        resource: ws.resource ?? ws.resources ?? { value: ws.resourcesValue ?? 0 }
      }))
    : [];

  const rawAbilities = km.abilityScores ?? km.abilities ?? [];
  km.abilitiesArray = Array.isArray(rawAbilities)
    ? rawAbilities.map((ab) => ({
        name: ab.name || ab.label || ab.type || "Ability",
        scoreInput: ab.input ?? { name: `abilityScores.${ab.type || ab.label}`, value: ab.score ?? ab.value ?? 10 },
        scoreValue: ab.value ?? ab.score ?? ab.input?.value ?? 10,
        modifier: ab.mod ?? (ab.modifier >= 0 ? `+${ab.modifier}` : String(ab.modifier ?? 0))
      }))
    : [];

  const rawSkills = km.skillChecks ?? km.skills ?? [];
  km.skillsArray = Array.isArray(rawSkills)
    ? rawSkills.map((sk) => {
        const inputObj = sk.input ?? sk.proficiencyRank ?? { value: "UNTRAINED", options: [] };
        if (Array.isArray(inputObj.options)) {
          for (const opt of inputObj.options) {
            opt.selected = opt.value === inputObj.value;
          }
        }
        return {
          skill: sk.skill,
          name: sk.label || sk.name || sk.skill,
          modifier: sk.modifier !== undefined ? String(sk.modifier) : `+${sk.totalModifier ?? 0}`,
          proficiencyLabel: sk.proficiency || inputObj.value || "Untrained",
          proficiencyInput: inputObj
        };
      })
    : [];

  for (const builderObj of [km.charter?.type, km.heartland?.type, km.government?.type, ...(km.initialProficiencies ?? [])]) {
    if (Array.isArray(builderObj?.options)) {
      for (const opt of builderObj.options) {
        opt.selected = opt.value === builderObj.value;
      }
    }
  }

  const rawGroups = km.groups ?? km.groupsContext ?? [];
  km.groupsArray = Array.isArray(rawGroups)
    ? rawGroups.map((grp, idx) => {
        const relObj = grp.relations ?? { name: `groups.${idx}.relations`, value: "NONE", options: [] };
        if (Array.isArray(relObj.options)) {
          for (const opt of relObj.options) {
            opt.selected = opt.value === relObj.value;
          }
        }
        return {
          index: idx,
          nameInput: grp.name?.name ? grp.name : { name: `groups.${idx}.name`, value: grp.name?.value ?? grp.name ?? `Group ${idx + 1}` },
          negotiationDCInput: grp.negotiationDC?.name ? grp.negotiationDC : { name: `groups.${idx}.negotiationDC`, value: grp.negotiationDC?.value ?? grp.negotiationDC ?? 15 },
          atWarInput: grp.atWar?.name ? grp.atWar : { name: `groups.${idx}.atWar`, value: Boolean(grp.atWar?.value ?? grp.atWar) },
          relationsInput: relObj
        };
      })
    : [];

  km.notesHtml = km.notesContext?.public || km.notesInput?.value || "";
}

export async function prepareKingdomContext(partyActor, sheet, context) {
  context.isKingdom = true;
  context.isParty = false;

  let kmApp = findExistingKingdomApp(partyActor);
  if (!kmApp && game.pf2eKingmakerTools?.macros?.openSheet && !sheet._initializingKmBackground) {
    sheet._initializingKmBackground = true;
    getOrInitKingdomApp(partyActor, true)
      .then((app) => {
        if (app && sheet?._isKingdomMode) {
          sheet.render(sheet.rendered ? { force: true, parts: ["header", "sheet"] } : { force: true });
        }
      })
      .finally(() => {
        sheet._initializingKmBackground = false;
      });
  }

  let km = {};
  if (kmApp && typeof kmApp._preparePartContext === "function") {
    try {
      km = (await kmApp._preparePartContext("form", { partId: "form" }, { parts: ["form"] })) ?? {};
    } catch (err) {
      console.warn("PF2e Mobile Compact | Error calling kmApp._preparePartContext:", err);
    }
  }
  applyKingdomFlagFallback(partyActor, km);
  normalizeKingdomViewData(partyActor, km);
  const nativeCampaign = partyActor.system?.campaign ?? {};

  if (Array.isArray(km.activeLeader?.options)) {
    for (const opt of km.activeLeader.options) {
      opt.selected = opt.value === km.activeLeader.value;
    }
  }
  if (Array.isArray(km.settlementInput?.options)) {
    for (const opt of km.settlementInput.options) {
      opt.selected = opt.value === km.settlementInput.value;
    }
  }

  const expandedActivities = sheet._expandedKingdomActivities ?? new Set();
  const collapsedPhases = sheet._collapsedKingdomPhases ?? new Set(["upkeep", "region", "civic", "army"]);
  const phaseOrder = [
    { key: "upkeep", icon: "fa-sun", isUpkeep: true },
    { key: "commerce", icon: "fa-scale-balanced" },
    { key: "leadership", icon: "fa-crown", countBadge: km.leadershipActivities },
    { key: "region", icon: "fa-map", hasRegionExtras: true },
    { key: "civic", icon: "fa-city" },
    { key: "army", icon: "fa-shield-halved" }
  ];

  const phases = phaseOrder.map((p) => {
    const acts = Array.isArray(km.activities?.[p.key]) ? km.activities[p.key] : [];
    for (const act of acts) {
      act.displayName = act.label || act.name || act.id;
      act.isExpanded = expandedActivities.has(act.id);
    }
    return {
      ...p,
      title: p.key.charAt(0).toUpperCase() + p.key.slice(1) + (p.countBadge ? ` (${p.countBadge})` : ""),
      isCollapsed: collapsedPhases.has(p.key),
      activities: acts
    };
  });

  const level = Number(km.levelInput?.value ?? nativeCampaign.level ?? 1);
  const selectedLevelFilter = sheet._kingdomLevelFilter || "all";
  const filteredLevels = (Array.isArray(km.featuresByLevel) ? km.featuresByLevel : [])
    .filter((f) => selectedLevelFilter === "all" || String(f.level) === selectedLevelFilter)
    .map((f) => ({
      ...f,
      isUnlocked: Number(f.level) <= level
    }));

  context.km = km;
  context.kingdomHeader = {
    name: km.kingdomNameInput?.value || nativeCampaign.name || getKingdomName(partyActor),
    level,
    xp: Number(km.xpInput?.value ?? nativeCampaign.xp?.value ?? 0),
    xpMax: Number(km.xpThresholdInput?.value ?? nativeCampaign.xp?.max ?? 1000),
    fameType: km.fameContext?.now?.label || "Fame",
    fameValue: Number(km.fameContext?.now?.value ?? 0),
    controlDc: Number(km.controlDc ?? nativeCampaign.controlDC ?? 14),
    unrest: Number(km.unrestInput?.value ?? nativeCampaign.unrest ?? 0),
    unrestPenalty: Number(km.unrestPenalty ?? 0),
    atWar: Boolean(km.atWarInput?.value)
  };

  context.kingdomUi = {
    turnSubTab: sheet._kingdomTurnSubTab || "status",
    sheetSubTab: sheet._kingdomSheetSubTab || "stats",
    selectedLevelFilter,
    levelOptions: ["all", ...Array.from({ length: 20 }, (_, i) => String(i + 1))],
    filteredLevels,
    phases
  };
}

/**
 * Helper to invoke a native `pf2e-kingmaker-tools` `KingdomSheet` action (`_onClickAction`)
 * while keeping `PhysicalDiceManager` active when the mobile sheet is in Physical Dice mode.
 */
async function dispatchKingdomSheetAction(sheet, event, actionData, rollTitle = null) {
  const kmApp = await getOrInitKingdomApp(getPartyActor(sheet.actor) || sheet.actor, true);
  if (!kmApp || typeof kmApp._onClickAction !== "function") {
    ui.notifications?.warn?.("pf2e-kingmaker-tools Kingdom Sheet is not available.");
    return;
  }

  const fakeBtn = typeof document !== "undefined" && typeof document.createElement === "function"
    ? document.createElement("button")
    : { dataset: {} };
  for (const [key, val] of Object.entries(actionData)) {
    if (val !== undefined && val !== null) {
      fakeBtn.dataset[key] = String(val);
    }
  }

  // Store active roll context so if a KingdomCheckDialog opens, its Roll button uses this title
  sheet._pendingKingdomRollTitle = rollTitle;

  const runAction = async () => {
    await kmApp._onClickAction(event, fakeBtn);
  };

  if (rollTitle) {
    await PhysicalDiceManager.withPhysicalMode({
      title: rollTitle,
      actor: sheet.actor
    }, runAction, sheet.rollMode === "physical" || sheet._rollMode === "physical");
  } else {
    await runAction();
  }

  if (sheet.rendered) {
    sheet.render({ parts: ["header", "sheet"] });
  }
}

export async function onOpenMobileKingdomSheet(sheet) {
  sheet._isKingdomMode = true;
  sheet._activeTab = "turn";
  sheet.render({ parts: ["header", "sheet"] });
}

export async function onSwitchKingdomTurnSubTab(sheet, event, target) {
  const subtab = target.dataset.subtab;
  if (subtab && subtab !== sheet._kingdomTurnSubTab) {
    sheet._kingdomTurnSubTab = subtab;
    sheet.render({ parts: ["sheet"] });
  }
}

export async function onSwitchKingdomSheetSubTab(sheet, event, target) {
  const subtab = target.dataset.subtab;
  if (subtab && subtab !== sheet._kingdomSheetSubTab) {
    sheet._kingdomSheetSubTab = subtab;
    sheet.render({ parts: ["sheet"] });
  }
}

export function onToggleKingdomPhase(sheet, event, target) {
  const phaseKey = target.dataset.phase;
  if (!phaseKey) return;
  if (!sheet._collapsedKingdomPhases) {
    sheet._collapsedKingdomPhases = new Set(["upkeep", "region", "civic", "army"]);
  }
  if (sheet._collapsedKingdomPhases.has(phaseKey)) {
    sheet._collapsedKingdomPhases.delete(phaseKey);
  } else {
    sheet._collapsedKingdomPhases.add(phaseKey);
  }

  const section = target.closest(".km-phase-section");
  if (section) {
    section.classList.toggle("is-collapsed", sheet._collapsedKingdomPhases.has(phaseKey));
  } else {
    sheet.render({ parts: ["sheet"] });
  }
}

export function onToggleKingdomActivity(sheet, event, target) {
  const actId = target.dataset.activityId;
  if (!actId) return;
  if (!sheet._expandedKingdomActivities) {
    sheet._expandedKingdomActivities = new Set();
  }
  if (sheet._expandedKingdomActivities.has(actId)) {
    sheet._expandedKingdomActivities.delete(actId);
  } else {
    sheet._expandedKingdomActivities.add(actId);
  }

  const card = target.closest(".km-activity-card");
  if (card) {
    card.classList.toggle("is-expanded", sheet._expandedKingdomActivities.has(actId));
  } else {
    sheet.render({ parts: ["sheet"] });
  }
}

export async function onSetKingdomActiveLeader(sheet, event, target) {
  const role = target.value;
  if (!role) return;

  try {
    if (game.settings?.pfrpg2eKingdomCampingWeather?.setKingdomActiveLeader) {
      await game.settings.pfrpg2eKingdomCampingWeather.setKingdomActiveLeader(role);
    }
  } catch {}

  try {
    const kmApp = await getOrInitKingdomApp(sheet.actor, true);
    const selectEl = kmApp?.element?.querySelector?.('select[name="activeLeader"]');
    if (selectEl) {
      selectEl.value = role;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } catch {}

  sheet.render({ parts: ["sheet"] });
}

export async function onSetKingdomActiveSettlement(sheet, event, target) {
  const settlementId = target.value;

  try {
    const kmApp = await getOrInitKingdomApp(sheet.actor, true);
    const selectEl = kmApp?.element?.querySelector?.('select[name="activeSettlement"]');
    if (selectEl) {
      selectEl.value = settlementId;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } catch {}

  sheet.render({ parts: ["sheet"] });
}

export async function onRollKingdomSkillCheck(sheet, event, target) {
  const skillSlug = target.dataset.skill;
  const skillLabel = target.dataset.label || skillSlug || "Kingdom Skill";
  await dispatchKingdomSheetAction(
    sheet,
    event,
    { action: "roll-skill-check", skill: skillSlug },
    `${skillLabel} Check`
  );
}

export async function onPerformKingdomActivity(sheet, event, target) {
  event?.stopPropagation?.();
  const activityId = target.dataset.activityId;
  const activityName = target.dataset.activityName || "Kingdom Activity";
  await dispatchKingdomSheetAction(
    sheet,
    event,
    { action: "perform-activity", activity: activityId },
    activityName
  );
}

export async function onSkipCollectTaxes(sheet, event) {
  event?.stopPropagation?.();
  await dispatchKingdomSheetAction(sheet, event, { action: "skip-collect-taxes" }, "Skip Collect Taxes");
}

export async function onClaimKingdomRefuge(sheet, event) {
  event?.stopPropagation?.();
  await dispatchKingdomSheetAction(sheet, event, { action: "claimed-refuge" });
}

export async function onClaimKingdomLandmark(sheet, event) {
  event?.stopPropagation?.();
  await dispatchKingdomSheetAction(sheet, event, { action: "claimed-landmark" }, "Claimed Landmark");
}

/**
 * Opens a mobile-styled Consumption Breakdown popup populated directly from `pf2e-kingmaker-tools` context.
 */
export async function onOpenConsumptionBreakdown(sheet) {
  const kmApp = await getOrInitKingdomApp(getPartyActor(sheet.actor) || sheet.actor, true);
  const km = (kmApp && typeof kmApp._preparePartContext === "function")
    ? await kmApp._preparePartContext("form", {}, {})
    : {};

  const total = Number(km.consumption?.total ?? km.consumption ?? 0);
  const armyCons = Number(km.consumptionContext?.armies?.value ?? 0);
  const settlements = Array.isArray(km.settlements) ? km.settlements : [];
  const esc = foundry.utils?.escapeHTML ?? ((s) => String(s ?? ""));

  const rowsHtml = settlements.map((s) => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
      <span>${s.isCapital ? "👑 " : "🏙️ "}${esc(s.name)} (${esc(s.size)})</span>
      <strong>Level ${s.level}</strong>
    </div>
  `).join("");

  const content = `
    <div class="km-mobile-modal-body" style="display:flex;flex-direction:column;gap:8px;font-size:0.88rem;">
      <div style="display:flex;justify-content:space-between;padding:8px 10px;background:rgba(225,175,65,0.16);border-radius:8px;">
        <span>Total Kingdom Consumption</span>
        <strong>${total} Food / Turn</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 10px;background:rgba(255,255,255,0.04);border-radius:8px;">
        <span>Armies Consumption</span>
        <strong>${armyCons} Food</strong>
      </div>
      ${rowsHtml ? `<div style="margin-top:4px;"><strong style="color:#f3d486;">Settlements (${settlements.length})</strong>${rowsHtml}</div>` : ""}
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: { title: "Consumption Breakdown", icon: "fa-solid fa-wheat-awn" },
    classes: ["pf2e-mobile-dialog", "compact-theme"],
    content,
    ok: { label: "Close", icon: "fa-solid fa-check" }
  });
}

/**
 * Opens a mobile-styled Settlement Inspection popup by calling `pf2e-kingmaker-tools`'s `InspectSettlement`
 * context builder (`_preparePartContext`) and rendering it inside a compact mobile `DialogV2` modal.
 */
export async function onInspectKingdomSettlement(sheet, event, target) {
  const settlementId = target.dataset.settlementId;
  if (!settlementId) return;

  const kmApp = await getOrInitKingdomApp(getPartyActor(sheet.actor) || sheet.actor, true);
  if (!kmApp || typeof kmApp._onClickAction !== "function") return;

  const beforeIds = new Set(foundry.applications?.instances?.keys?.() ?? []);
  const fakeBtn = typeof document !== "undefined" && typeof document.createElement === "function"
    ? document.createElement("button")
    : { dataset: {} };
  fakeBtn.dataset.action = "inspect-settlement";
  fakeBtn.dataset.id = settlementId;

  await kmApp._onClickAction(event, fakeBtn);

  let inspectApp = null;
  for (let i = 0; i < 20 && !inspectApp; i++) {
    for (const [id, app] of (foundry.applications?.instances?.entries?.() ?? [])) {
      if (!beforeIds.has(id) && (app?.constructor?.name === "InspectSettlement" || app?.element?.querySelector?.(".km-settlement-content"))) {
        inspectApp = app;
        break;
      }
    }
    if (!inspectApp) await new Promise((r) => setTimeout(r, 25));
  }

  if (!inspectApp || typeof inspectApp._preparePartContext !== "function") return;
  if (inspectApp.element) {
    inspectApp.element.style.setProperty("display", "none", "important");
  }

  let sCtx = {};
  try {
    sCtx = (await inspectApp._preparePartContext("form", {}, {})) ?? {};
  } catch {}
  try {
    await inspectApp.close({ animate: false });
  } catch {}

  const sceneName = game.scenes?.get?.(settlementId)?.name || "Settlement";
  const structures = Array.isArray(sCtx.structures) ? sCtx.structures : [];
  const bonuses = Array.isArray(sCtx.bonuses) ? sCtx.bonuses : [];
  const storage = Array.isArray(sCtx.storage) ? sCtx.storage : [];
  const availableItems = sCtx.availableItems && typeof sCtx.availableItems === "object"
    ? Object.entries(sCtx.availableItems)
    : [];

  const structuresHtml = structures.length
    ? structures.map((st) => `<li style="padding:3px 0;"><strong>${st.value}x</strong> ${st.label}</li>`).join("")
    : `<li><em>No structures constructed yet.</em></li>`;

  const bonusesHtml = bonuses.length
    ? bonuses.map((b) => `<li style="padding:2px 0;">${foundry.utils.escapeHTML(String(b))}</li>`).join("")
    : `<li><em>No active structure bonuses.</em></li>`;

  const storageHtml = storage.map((st) => `
    <div style="background:rgba(255,255,255,0.05);padding:4px 8px;border-radius:6px;display:flex;justify-content:space-between;">
      <span>${foundry.utils.escapeHTML(st.label)}</span>
      <strong>${st.value}</strong>
    </div>
  `).join("");

  const marketHtml = availableItems.map(([k, v]) => `
    <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <span>${foundry.utils.escapeHTML(k)}</span>
      <strong>${foundry.utils.escapeHTML(String(v))}</strong>
    </div>
  `).join("");

  const content = `
    <div class="km-mobile-settlement-popup" style="display:flex;flex-direction:column;gap:10px;max-height:72vh;overflow-y:auto;font-size:0.84rem;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center;">
        <div style="background:rgba(225,175,65,0.15);padding:6px;border-radius:8px;">
          <div style="font-size:0.7rem;color:#a8b2c8;">Type &amp; Level</div>
          <strong>${foundry.utils.escapeHTML(sCtx.type || "")} ${sCtx.level ?? 1}</strong>
        </div>
        <div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:8px;">
          <div style="font-size:0.7rem;color:#a8b2c8;">Blocks / Res.</div>
          <strong>${sCtx.blocks ?? 0}/${sCtx.maximumBlocks ?? 0} (${sCtx.residentialLots ?? 0} Res)</strong>
        </div>
        <div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:8px;">
          <div style="font-size:0.7rem;color:#a8b2c8;">Consumption</div>
          <strong>${sCtx.consumption ?? 0} Food</strong>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.04);padding:8px 10px;border-radius:8px;">
        <div style="font-weight:700;color:#f3d486;margin-bottom:4px;"><i class="fa-solid fa-building-columns"></i> Constructed Structures</div>
        <ul style="margin:0;padding-left:16px;">${structuresHtml}</ul>
      </div>

      <div style="background:rgba(255,255,255,0.04);padding:8px 10px;border-radius:8px;">
        <div style="font-weight:700;color:#f3d486;margin-bottom:4px;"><i class="fa-solid fa-circle-plus"></i> Settlement Bonuses (Max +${sCtx.maxItemBonus ?? 1})</div>
        <ul style="margin:0;padding-left:16px;">${bonusesHtml}</ul>
      </div>

      ${storageHtml ? `
      <div style="background:rgba(255,255,255,0.04);padding:8px 10px;border-radius:8px;">
        <div style="font-weight:700;color:#f3d486;margin-bottom:4px;"><i class="fa-solid fa-boxes-stacked"></i> Commodity Storage</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">${storageHtml}</div>
      </div>` : ""}

      ${marketHtml ? `
      <div style="background:rgba(255,255,255,0.04);padding:8px 10px;border-radius:8px;">
        <div style="font-weight:700;color:#f3d486;margin-bottom:4px;"><i class="fa-solid fa-shop"></i> Market Available Item Levels</div>
        <div>${marketHtml}</div>
      </div>` : ""}
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: { title: `${sceneName} — Settlement Overview`, icon: "fa-solid fa-city" },
    classes: ["pf2e-mobile-dialog", "compact-theme"],
    content,
    ok: { label: "Close", icon: "fa-solid fa-check" }
  });
}

export async function onFilterKingdomLevel(sheet, event, target) {
  sheet._kingdomLevelFilter = target.value || "all";
  sheet.render({ parts: ["sheet"] });
}

export async function onResolveKingdomEvent(sheet, event, target) {
  const index = target.dataset.index;
  const eventName = target.dataset.eventName || "Ongoing Event";
  await dispatchKingdomSheetAction(sheet, event, { action: "handle-event", index }, eventName);
}

/**
 * Updates a Kingdom or Kingmaker Tools field (`system.campaign.*` or `flags.pf2e-kingmaker-tools.*`)
 * directly from mobile `<input>`, `<select>`, or `<textarea>` change events.
 */
export async function onUpdateKingdomField(sheet, event, target) {
  const partyActor = getPartyActor(sheet.actor);
  if (!partyActor) return;

  const field = target.dataset?.fieldName || target.dataset?.field || target.name;
  if (!field) return;

  let val;
  if (target.type === "checkbox") {
    val = Boolean(target.checked);
  } else if (target.dataset?.dtype === "Boolean") {
    val = target.value === "true" || target.value === "1";
  } else if (target.dataset?.dtype === "Number" || target.type === "number") {
    const parsed = Number(target.value);
    val = Number.isNaN(parsed) ? 0 : parsed;
  } else {
    val = target.value ?? "";
  }

  try {
    const kmApp = await getOrInitKingdomApp(partyActor, true);
    if (kmApp) {
      const kmInput = kmApp.element?.querySelector?.(`[name="${field}"]`) || {
        name: field,
        type: target.type || "text",
        value: val,
        checked: Boolean(val)
      };
      kmInput.name = field;
      kmInput.type = target.type || kmInput.type || "text";
      if (target.type === "checkbox") {
        kmInput.checked = Boolean(val);
      } else {
        kmInput.value = val;
      }
      if (typeof Event !== "undefined" && typeof kmInput.dispatchEvent === "function") {
        kmInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (typeof kmApp._onChangeForm === "function") {
        await kmApp._onChangeForm(kmApp.options?.form || kmApp.form || {}, { target: kmInput });
      }
    }
  } catch (err) {
    console.warn(`PF2e Mobile Sheet | Failed to sync kingdom field "${field}" via kmApp:`, err);
  }

  try {
    const updatePath = (field.startsWith("system.") || field.startsWith("flags."))
      ? field
      : `flags.pf2e-kingmaker-tools.kingdom-sheet.${field}`;
    await partyActor.update?.({ [updatePath]: val });
  } catch (err) {
    console.warn(`PF2e Mobile Sheet | Failed to update kingdom field "${field}":`, err);
  }
  sheet.render({ parts: ["header", "sheet"] });
}

/**
 * Generic dispatcher for buttons using `data-action="dispatchKingdomNativeAction"` and `data-km-action="..."`.
 * Also provides mobile-friendly dialogs for `inspect-leader-skills` and `inspect-kingdom-skills`.
 */
export async function onDispatchKingdomNativeAction(sheet, event, target) {
  const kmAction = target.dataset.kmAction || target.dataset.actionName;
  if (!kmAction) return;

  const partyActor = getPartyActor(sheet.actor);
  const campaign = partyActor?.system?.campaign;

  if (kmAction === "inspect-leader-skills" || kmAction === "inspect-kingdom-skills") {
    const kmApp = await getOrInitKingdomApp(partyActor, true);
    const km = (kmApp && typeof kmApp._preparePartContext === "function")
      ? await kmApp._preparePartContext("form", {}, {})
      : {};
    const skillList = Array.isArray(km.skills) && km.skills.length > 0
      ? km.skills
      : Object.entries(campaign?.skills || {}).map(([k, v]) => ({
          skill: k,
          name: v?.label || k.charAt(0).toUpperCase() + k.slice(1).toLowerCase(),
          totalModifier: v?.mod ?? v?.value ?? 0
        }));

    if (kmAction === "inspect-leader-skills") {
      const roleKey = target.dataset.role;
      const roleObj = Array.isArray(km.leadersContext)
        ? km.leadersContext.find((l) => l.key === roleKey || l.id === roleKey)
        : null;
      const actorUuid = roleObj?.character?.value || campaign?.leadership?.[roleKey]?.uuid;
      const leaderActor = actorUuid && typeof fromUuidSync === "function"
        ? fromUuidSync(actorUuid)
        : (partyActor?.members?.[0] || null);
      const leaderName = leaderActor?.name || roleObj?.label || "Leader";
      const rows = skillList.map((s) => {
        const slug = String(s.skill || "").toLowerCase();
        const mod = leaderActor?.skills?.[slug]?.mod ?? s.totalModifier ?? 0;
        return `<div style="display:flex;justify-content:space-between;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.78rem;">
          <span>${s.name || s.skill}</span>
          <strong style="color:#f3d486;">${mod >= 0 ? `+${mod}` : mod}</strong>
        </div>`;
      }).join("");
      await foundry.applications.api.DialogV2.prompt({
        window: { title: `${leaderName} — PC Skills Overview`, icon: "fa-solid fa-user-check" },
        classes: ["pf2e-mobile-dialog", "compact-theme"],
        content: `<div style="max-height:360px;overflow-y:auto;">${rows}</div>`,
        ok: { label: "Close", icon: "fa-solid fa-check" }
      });
      return;
    }

    const rows = skillList.map((s) => {
      const mod = s.totalModifier ?? 0;
      const rankLabel = s.proficiencyRank?.value || "";
      return `<div style="display:flex;justify-content:space-between;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.78rem;">
        <span>${s.name || s.skill}</span>
        <strong style="color:#6ee7b7;">${mod >= 0 ? `+${mod}` : mod}${rankLabel ? ` (${rankLabel})` : ""}</strong>
      </div>`;
    }).join("");
    await foundry.applications.api.DialogV2.prompt({
      window: { title: `${getKingdomName(partyActor)} — Kingdom Skills`, icon: "fa-solid fa-crown" },
      classes: ["pf2e-mobile-dialog", "compact-theme"],
      content: `<div style="max-height:360px;overflow-y:auto;">${rows}</div>`,
      ok: { label: "Close", icon: "fa-solid fa-check" }
    });
    return;
  }

  const extraDataset = { ...target.dataset, action: kmAction };
  delete extraDataset.kmAction;
  const label = target.title || target.textContent?.trim() || kmAction;
  await dispatchKingdomSheetAction(sheet, event, extraDataset, label);
}

