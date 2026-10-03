/**
 * Context preparation helper for Party Sheet and Party Stash.
 * Prepares overview summaries, member tactical stats, and stash inventory.
 */
import { getHpState } from "../../utils/sheet-utils.js";

const PHYSICAL_ITEM_TYPES = new Set([
  "ammo",
  "armor",
  "backpack",
  "book",
  "consumable",
  "equipment",
  "shield",
  "treasure",
  "weapon"
]);

const CORE_SKILL_SLUGS = [
  "acrobatics",
  "athletics",
  "crafting",
  "deception",
  "diplomacy",
  "intimidation",
  "medicine",
  "nature",
  "occultism",
  "performance",
  "religion",
  "society",
  "stealth",
  "survival",
  "thievery"
];

const RK_SKILL_SLUGS = [
  "arcana",
  "crafting",
  "medicine",
  "nature",
  "occultism",
  "religion",
  "society"
];

/**
 * Enriches raw HTML item description.
 * @param {Item} item
 * @param {Actor} actor
 * @returns {Promise<string>}
 */
async function enrichItemDescription(item, actor) {
  const rawDescription = item.system?.description?.value ?? "";
  if (!rawDescription) return "";
  const TextEditorClass = foundry.applications?.ux?.TextEditor ?? globalThis.TextEditor;
  if (typeof TextEditorClass?.enrichHTML === "function") {
    try {
      return await TextEditorClass.enrichHTML(rawDescription, {
        secrets: item.isOwner ?? false,
        rollData: actor?.getRollData?.() ?? {},
        async: true
      });
    } catch {
      return rawDescription;
    }
  }
  return rawDescription;
}

/**
 * Prepares party context for the compact mobile sheet.
 * @param {Actor} partyActor
 * @param {object} sheet
 * @param {object} context
 */
export async function preparePartyContext(partyActor, sheet, context) {
  context.isParty = true;
  context.party = {
    id: partyActor.id,
    name: partyActor.name,
    img: partyActor.img
  };

  const members = partyActor.members ?? [];

  // 1. Prepare Members Tactical Cards
  context.partyMembers = members.map((m) => {
    const hpData = m.hitPoints ?? m.system?.attributes?.hp ?? {};
    const hpVal = hpData.value ?? 0;
    const hpMax = Math.max(hpData.max ?? 1, 1);
    const hpTemp = hpData.temp ?? 0;
    const { percent: hpPercent, state: hpState } = getHpState(hpVal, hpMax);

    const fortMod = m.saves?.fortitude?.mod ?? m.saves?.fortitude?.check?.mod ?? m.system?.saves?.fortitude?.value ?? 0;
    const refMod = m.saves?.reflex?.mod ?? m.saves?.reflex?.check?.mod ?? m.system?.saves?.reflex?.value ?? 0;
    const willMod = m.saves?.will?.mod ?? m.saves?.will?.check?.mod ?? m.system?.saves?.will?.value ?? 0;
    const acVal = m.armorClass?.value ?? m.attributes?.ac?.value ?? m.system?.attributes?.ac?.value ?? 10;
    const percMod = m.perception?.mod ?? m.perception?.check?.mod ?? m.system?.attributes?.perception?.value ?? 0;

    let blurb = "";
    if (m.ancestry && m.class) {
      blurb = `Lvl ${m.level ?? 1} ${m.ancestry.name} ${m.class.name}`;
    } else if (m.system?.details?.blurb) {
      blurb = m.system.details.blurb;
    } else {
      blurb = `Level ${m.level ?? 1}`;
    }

    const heroPoints = m.getResource?.("hero-points")?.value ?? m.system?.resources?.heroPoints?.value ?? 0;

    // Senses
    const senses = (m.perception?.senses?.contents ?? m.system?.traits?.senses?.value ?? [])
      .map(s => typeof s === "string" ? s : (s.label || s.type || ""))
      .filter(Boolean);

    // Top 3 Proficient Skills
    const bestSkills = Object.values(m.skills ?? {})
      .filter(s => s && s.proficient && !s.lore && typeof s.mod === "number")
      .sort((a, b) => b.mod - a.mod)
      .slice(0, 3)
      .map(s => ({
        slug: s.slug,
        label: s.label ?? s.slug,
        mod: s.mod
      }));

    return {
      id: m.id,
      uuid: m.uuid,
      name: m.name,
      img: m.img,
      blurb,
      hp: {
        value: hpVal,
        max: hpMax,
        temp: hpTemp,
        percent: hpPercent,
        isLow: hpState === "danger",
        isMedium: hpState === "warning"
      },
      ac: acVal,
      saves: {
        fortitude: fortMod,
        reflex: refMod,
        will: willMod
      },
      perception: percMod,
      senses: senses.length ? senses.join(", ") : "Normal",
      heroPoints,
      bestSkills,
      isOwner: m.isOwner,
      isUserChar: m.id === game.user.character?.id
    };
  });

  // 2. Prepare Overview Summaries: Languages, Core Skills, Recall Knowledge
  const allLanguages = new Map();
  for (const m of members) {
    const langs = m.system?.details?.languages?.value ?? [];
    for (const l of langs) {
      const slug = typeof l === "string" ? l : (l?.value || "");
      if (!slug) continue;
      const label = CONFIG.PF2E?.languages?.[slug] ? game.i18n.localize(CONFIG.PF2E.languages[slug]) : slug;
      if (!allLanguages.has(slug)) {
        allLanguages.set(slug, { slug, label, speakers: [] });
      }
      allLanguages.get(slug).speakers.push(m.name);
    }
  }
  context.partyLanguages = Array.from(allLanguages.values()).sort((a, b) => a.label.localeCompare(b.label));

  // Best skill modifiers across party
  context.partySkills = CORE_SKILL_SLUGS.map(slug => {
    let best = null;
    for (const m of members) {
      const sk = m.skills?.[slug];
      if (sk && typeof sk.mod === "number" && (!best || sk.mod > best.mod)) {
        best = { mod: sk.mod, member: m.name };
      }
    }
    const label = CONFIG.PF2E?.skills?.[slug]?.label
      ? game.i18n.localize(CONFIG.PF2E.skills[slug].label)
      : (slug.charAt(0).toUpperCase() + slug.slice(1));
    return {
      slug,
      label,
      mod: best?.mod ?? null,
      member: best?.member ?? "—"
    };
  }).filter(s => s.mod !== null);

  // Recall Knowledge best skills
  context.partyRecallKnowledge = RK_SKILL_SLUGS.map(slug => {
    let best = null;
    for (const m of members) {
      const sk = m.skills?.[slug];
      if (sk && typeof sk.mod === "number" && (!best || sk.mod > best.mod)) {
        best = { mod: sk.mod, member: m.name };
      }
    }
    const label = CONFIG.PF2E?.skills?.[slug]?.label
      ? game.i18n.localize(CONFIG.PF2E.skills[slug].label)
      : (slug.charAt(0).toUpperCase() + slug.slice(1));
    return {
      slug,
      label,
      mod: best?.mod ?? null,
      member: best?.member ?? "—"
    };
  }).filter(s => s.mod !== null);

  // 3. Stash Wealth, Currency & Bulk
  const coins = partyActor.inventory?.coins ?? partyActor.system?.details?.currency ?? {};
  const wealthString = partyActor.inventory?.totalWealth?.toString?.({ decimal: true })
    ?? (partyActor.inventory?.totalWealth ? `${partyActor.inventory.totalWealth}` : "0 gp");

  context.stashCurrency = {
    pp: coins.pp ?? 0,
    gp: coins.gp ?? 0,
    sp: coins.sp ?? 0,
    cp: coins.cp ?? 0,
    wealth: wealthString
  };

  const bulkVal = partyActor.inventory?.bulk?.value ?? 0;
  const bulkDisplay = typeof bulkVal.toDecimal === "function" ? bulkVal.toDecimal().toFixed(1) : (bulkVal.value ?? bulkVal).toString();
  context.stashBulk = {
    value: bulkDisplay,
    itemsCount: partyActor.items.filter(i => (typeof i.isOfType === "function" ? i.isOfType("physical") : PHYSICAL_ITEM_TYPES.has(i.type))).length
  };

  // 4. Stash Items: Categorized Consumables, Weapons & Armor, and Other Gear/Treasure
  const isPhysical = (i) => {
    if (!i) return false;
    if (typeof i.isOfType === "function") {
      return i.isOfType("physical") || PHYSICAL_ITEM_TYPES.has(i.type);
    }
    return PHYSICAL_ITEM_TYPES.has(i.type);
  };

  const rawPhysicalItems = Array.from(partyActor.items ?? []).filter(isPhysical);

  const formattedItems = await Promise.all(rawPhysicalItems.map(async (item) => {
    const isExpanded = sheet._expandedActionIds?.has(item.id) ?? false;
    const isConsumable = typeof item.isOfType === "function" ? item.isOfType("consumable") : item.type === "consumable";
    const isWeapon = typeof item.isOfType === "function" ? item.isOfType("weapon") : item.type === "weapon";
    const isArmor = typeof item.isOfType === "function" ? (item.isOfType("armor") || item.isOfType("shield")) : (item.type === "armor" || item.type === "shield");

    let category = "gear";
    if (isConsumable) category = "consumables";
    else if (isWeapon || isArmor) category = "equipment";

    const qty = item.quantity ?? item.system?.quantity ?? 1;
    const bulkStr = typeof item.bulk?.value?.toString === "function" ? item.bulk.value.toString() : (item.system?.bulk?.value ?? "-");

    const description = isExpanded ? await enrichItemDescription(item, partyActor) : "";

    return {
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
      category,
      quantity: qty,
      bulk: bulkStr,
      description,
      isExpanded,
      isConsumable,
      isWeapon,
      isArmor
    };
  }));

  context.stash = {
    consumables: formattedItems.filter(i => i.category === "consumables"),
    equipment: formattedItems.filter(i => i.category === "equipment"),
    gear: formattedItems.filter(i => i.category === "gear")
  };
}
