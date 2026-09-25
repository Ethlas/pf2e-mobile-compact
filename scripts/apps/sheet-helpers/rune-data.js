/**
 * Official PF2e Weapon and Armor Property Rune definitions and matching logic.
 *
 * IMPORTANT: The keys of these tables are the exact slugs PF2e stores in
 * `system.runes.property` and looks up in its own `RUNE_DATA` registry
 * (`src/module/item/physical/runes.ts`). PF2e uses **camelCase** slugs
 * (`greaterFlaming`, `ghostTouch`, `acidResistant`). Writing any other spelling
 * produces a slug PF2e cannot resolve, and its data preparation then throws on
 * `RUNE_DATA.weapon.property[slug].damage` while building strikes.
 *
 * Generated from the PF2e system's rune registry; `name` values are the English
 * strings from the system's `en.json`, and `i18n` is the localization key for
 * clients running another language.
 */

export const WEAPON_PROPERTY_RUNES = {
  ancestralEchoing: { name: "Ancestral Echoing", i18n: "PF2E.WeaponPropertyRune.ancestralEchoing.Name" },
  anchoring: { name: "Anchoring", i18n: "PF2E.WeaponPropertyRune.anchoring.Name" },
  ashen: { name: "Ashen", i18n: "PF2E.WeaponPropertyRune.ashen.Name" },
  astral: { name: "Astral", i18n: "PF2E.WeaponPropertyRune.astral.Name" },
  authorized: { name: "Authorized", i18n: "PF2E.WeaponPropertyRune.authorized.Name" },
  bane: { name: "Bane", i18n: "PF2E.WeaponPropertyRune.bane.Name" },
  bloodbane: { name: "Bloodbane", i18n: "PF2E.WeaponPropertyRune.bloodbane.Name" },
  bloodthirsty: { name: "Bloodthirsty", i18n: "PF2E.WeaponPropertyRune.bloodthirsty.Name" },
  brilliant: { name: "Brilliant", i18n: "PF2E.WeaponPropertyRune.brilliant.Name" },
  called: { name: "Called", i18n: "PF2E.WeaponPropertyRune.called.Name" },
  coating: { name: "Coating", i18n: "PF2E.WeaponPropertyRune.coating.Name" },
  conducting: { name: "Conducting", i18n: "PF2E.WeaponPropertyRune.conducting.Name" },
  corrosive: { name: "Corrosive", i18n: "PF2E.WeaponPropertyRune.corrosive.Name" },
  crushing: { name: "Crushing", i18n: "PF2E.WeaponPropertyRune.crushing.Name" },
  cunning: { name: "Cunning", i18n: "PF2E.WeaponPropertyRune.cunning.Name" },
  dancing: { name: "Animated", i18n: "PF2E.WeaponPropertyRune.dancing.Name" },
  deathdrinking: { name: "Deathdrinking", i18n: "PF2E.WeaponPropertyRune.deathdrinking.Name" },
  decaying: { name: "Decaying", i18n: "PF2E.WeaponPropertyRune.decaying.Name" },
  demolishing: { name: "Demolishing", i18n: "PF2E.WeaponPropertyRune.demolishing.Name" },
  disrupting: { name: "Vitalizing", i18n: "PF2E.WeaponPropertyRune.disrupting.Name" },
  earthbinding: { name: "Earthbinding", i18n: "PF2E.WeaponPropertyRune.earthbinding.Name" },
  energizing: { name: "Energizing", i18n: "PF2E.WeaponPropertyRune.energizing.Name" },
  extending: { name: "Extending", i18n: "PF2E.WeaponPropertyRune.extending.Name" },
  fanged: { name: "Fanged", i18n: "PF2E.WeaponPropertyRune.fanged.Name" },
  fearsome: { name: "Fearsome", i18n: "PF2E.WeaponPropertyRune.fearsome.Name" },
  flaming: { name: "Flaming", i18n: "PF2E.WeaponPropertyRune.flaming.Name" },
  flickering: { name: "Flickering", i18n: "PF2E.WeaponPropertyRune.flickering.Name" },
  flurrying: { name: "Flurrying", i18n: "PF2E.WeaponPropertyRune.flurrying.Name" },
  frost: { name: "Frost", i18n: "PF2E.WeaponPropertyRune.frost.Name" },
  ghostTouch: { name: "Ghost Touch", i18n: "PF2E.WeaponPropertyRune.ghostTouch.Name" },
  giantKilling: { name: "Giant-Killing", i18n: "PF2E.WeaponPropertyRune.giantKilling.Name" },
  greaterAnchoring: { name: "Greater Anchoring", i18n: "PF2E.WeaponPropertyRune.greaterAnchoring.Name" },
  greaterAshen: { name: "Greater Ashen", i18n: "PF2E.WeaponPropertyRune.greaterAshen.Name" },
  greaterAstral: { name: "Greater Astral", i18n: "PF2E.WeaponPropertyRune.greaterAstral.Name" },
  greaterBloodbane: { name: "Greater Bloodbane", i18n: "PF2E.WeaponPropertyRune.greaterBloodbane.Name" },
  greaterBrilliant: { name: "Greater Brilliant", i18n: "PF2E.WeaponPropertyRune.greaterBrilliant.Name" },
  greaterCorrosive: { name: "Greater Corrosive", i18n: "PF2E.WeaponPropertyRune.greaterCorrosive.Name" },
  greaterCrushing: { name: "Greater Crushing", i18n: "PF2E.WeaponPropertyRune.greaterCrushing.Name" },
  greaterDecaying: { name: "Greater Decaying", i18n: "PF2E.WeaponPropertyRune.greaterDecaying.Name" },
  greaterDisrupting: { name: "Greater Vitalizing", i18n: "PF2E.WeaponPropertyRune.greaterDisrupting.Name" },
  greaterExtending: { name: "Greater Extending", i18n: "PF2E.WeaponPropertyRune.greaterExtending.Name" },
  greaterFanged: { name: "Greater Fanged", i18n: "PF2E.WeaponPropertyRune.greaterFanged.Name" },
  greaterFearsome: { name: "Greater Fearsome", i18n: "PF2E.WeaponPropertyRune.greaterFearsome.Name" },
  greaterFlaming: { name: "Greater Flaming", i18n: "PF2E.WeaponPropertyRune.greaterFlaming.Name" },
  greaterFrost: { name: "Greater Frost", i18n: "PF2E.WeaponPropertyRune.greaterFrost.Name" },
  greaterGiantKilling: { name: "Greater Giant-Killing", i18n: "PF2E.WeaponPropertyRune.greaterGiantKilling.Name" },
  greaterHauling: { name: "Greater Hauling", i18n: "PF2E.WeaponPropertyRune.greaterHauling.Name" },
  greaterImpactful: { name: "Greater Impactful", i18n: "PF2E.WeaponPropertyRune.greaterImpactful.Name" },
  greaterRooting: { name: "Greater Rooting", i18n: "PF2E.WeaponPropertyRune.greaterRooting.Name" },
  greaterShock: { name: "Greater Shock", i18n: "PF2E.WeaponPropertyRune.greaterShock.Name" },
  greaterThundering: { name: "Greater Thundering", i18n: "PF2E.WeaponPropertyRune.greaterThundering.Name" },
  grievous: { name: "Grievous", i18n: "PF2E.WeaponPropertyRune.grievous.Name" },
  hauling: { name: "Hauling", i18n: "PF2E.WeaponPropertyRune.hauling.Name" },
  holy: { name: "Holy", i18n: "PF2E.WeaponPropertyRune.holy.Name" },
  hooked: { name: "Hooked", i18n: "PF2E.WeaponPropertyRune.hooked.Name" },
  hopeful: { name: "Hopeful", i18n: "PF2E.WeaponPropertyRune.hopeful.Name" },
  impactful: { name: "Impactful", i18n: "PF2E.WeaponPropertyRune.impactful.Name" },
  impossible: { name: "Impossible", i18n: "PF2E.WeaponPropertyRune.impossible.Name" },
  keen: { name: "Keen", i18n: "PF2E.WeaponPropertyRune.keen.Name" },
  kinWarding: { name: "Kin-Warding", i18n: "PF2E.WeaponPropertyRune.kinWarding.Name" },
  majorFanged: { name: "Major Fanged", i18n: "PF2E.WeaponPropertyRune.majorFanged.Name" },
  majorRooting: { name: "Major Rooting", i18n: "PF2E.WeaponPropertyRune.majorRooting.Name" },
  merciful: { name: "Merciful", i18n: "PF2E.WeaponPropertyRune.merciful.Name" },
  nightmare: { name: "Nightmare", i18n: "PF2E.WeaponPropertyRune.nightmare.Name" },
  pacifying: { name: "Pacifying", i18n: "PF2E.WeaponPropertyRune.pacifying.Name" },
  returning: { name: "Returning", i18n: "PF2E.WeaponPropertyRune.returning.Name" },
  rooting: { name: "Rooting", i18n: "PF2E.WeaponPropertyRune.rooting.Name" },
  serrating: { name: "Serrating", i18n: "PF2E.WeaponPropertyRune.serrating.Name" },
  shifting: { name: "Shifting", i18n: "PF2E.WeaponPropertyRune.shifting.Name" },
  shock: { name: "Shock", i18n: "PF2E.WeaponPropertyRune.shock.Name" },
  shockwave: { name: "Shockwave", i18n: "PF2E.WeaponPropertyRune.shockwave.Name" },
  speed: { name: "Quickstrike", i18n: "PF2E.WeaponPropertyRune.speed.Name" },
  spellStoring: { name: "Spell Reservoir", i18n: "PF2E.WeaponPropertyRune.spellStoring.Name" },
  swarming: { name: "Swarming", i18n: "PF2E.WeaponPropertyRune.swarming.Name" },
  thundering: { name: "Thundering", i18n: "PF2E.WeaponPropertyRune.thundering.Name" },
  trueRooting: { name: "True Rooting", i18n: "PF2E.WeaponPropertyRune.trueRooting.Name" },
  underwater: { name: "Underwater", i18n: "PF2E.WeaponPropertyRune.underwater.Name" },
  unholy: { name: "Unholy", i18n: "PF2E.WeaponPropertyRune.unholy.Name" },
  vorpal: { name: "Vorpal", i18n: "PF2E.WeaponPropertyRune.vorpal.Name" },
  wounding: { name: "Wounding", i18n: "PF2E.WeaponPropertyRune.wounding.Name" }
};

export const ARMOR_PROPERTY_RUNES = {
  acidResistant: { name: "Acid-Resistant", i18n: "PF2E.ArmorPropertyRuneAcidResistant" },
  advancing: { name: "Advancing", i18n: "PF2E.ArmorPropertyRuneAdvancing" },
  aimAiding: { name: "Aim-Aiding", i18n: "PF2E.ArmorPropertyRuneAimAiding" },
  antimagic: { name: "Antimagic", i18n: "PF2E.ArmorPropertyRuneAntimagic" },
  assisting: { name: "Assisting", i18n: "PF2E.ArmorPropertyRuneAssisting" },
  bitter: { name: "Bitter", i18n: "PF2E.ArmorPropertyRuneBitter" },
  coldResistant: { name: "Cold-Resistant", i18n: "PF2E.ArmorPropertyRuneColdResistant" },
  deathless: { name: "Deathless", i18n: "PF2E.ArmorPropertyRuneDeathless" },
  electricityResistant: { name: "Electricity-Resistant", i18n: "PF2E.ArmorPropertyRuneElectricityResistant" },
  energyAdaptive: { name: "Energy Adaptive", i18n: "PF2E.ArmorPropertyRuneEnergyAdaptive" },
  ethereal: { name: "Ethereal", i18n: "PF2E.ArmorPropertyRuneEthereal" },
  fireResistant: { name: "Fire-Resistant", i18n: "PF2E.ArmorPropertyRuneFireResistant" },
  fortification: { name: "Fortification", i18n: "PF2E.ArmorPropertyRuneFortification" },
  glamered: { name: "Glamered", i18n: "PF2E.ArmorPropertyRuneGlamered" },
  gliding: { name: "Gliding", i18n: "PF2E.ArmorPropertyRuneGliding" },
  greaterAcidResistant: { name: "Greater Acid-Resistant", i18n: "PF2E.ArmorPropertyRuneGreaterAcidResistant" },
  greaterAdvancing: { name: "Greater Advancing", i18n: "PF2E.ArmorPropertyRuneGreaterAdvancing" },
  greaterColdResistant: { name: "Greater Cold-Resistant", i18n: "PF2E.ArmorPropertyRuneGreaterColdResistant" },
  greaterDread: { name: "Greater Dread", i18n: "PF2E.ArmorPropertyRuneGreaterDread" },
  greaterElectricityResistant: { name: "Greater Electricity-Resistant", i18n: "PF2E.ArmorPropertyRuneGreaterElectricityResistant" },
  greaterFireResistant: { name: "Greater Fire-Resistant", i18n: "PF2E.ArmorPropertyRuneGreaterFireResistant" },
  greaterFortification: { name: "Greater Fortification", i18n: "PF2E.ArmorPropertyRuneGreaterFortification" },
  greaterInvisibility: { name: "Greater Invisibility", i18n: "PF2E.ArmorPropertyRuneGreaterInvisibility" },
  greaterQuenching: { name: "Greater Quenching", i18n: "PF2E.ArmorPropertyRuneGreaterQuenching" },
  greaterReady: { name: "Greater Ready", i18n: "PF2E.ArmorPropertyRuneGreaterReady" },
  greaterShadow: { name: "Greater Shadow", i18n: "PF2E.ArmorPropertyRuneGreaterShadow" },
  greaterSlick: { name: "Greater Slick", i18n: "PF2E.ArmorPropertyRuneGreaterSlick" },
  greaterStanching: { name: "Greater Stanching", i18n: "PF2E.ArmorPropertyRuneGreaterStanching" },
  greaterSwallowSpike: { name: "Greater Swallow-Spike", i18n: "PF2E.ArmorPropertyRuneGreaterSwallowSpike" },
  greaterWinged: { name: "Greater Winged", i18n: "PF2E.ArmorPropertyRuneGreaterWinged" },
  immovable: { name: "Immovable", i18n: "PF2E.ArmorPropertyRuneImmovable" },
  implacable: { name: "Implacable", i18n: "PF2E.ArmorPropertyRuneImplacable" },
  invisibility: { name: "Invisibility", i18n: "PF2E.ArmorPropertyRuneInvisibility" },
  lesserDread: { name: "Lesser Dread", i18n: "PF2E.ArmorPropertyRuneLesserDread" },
  magnetizing: { name: "Magnetizing", i18n: "PF2E.ArmorPropertyRuneMagnetizing" },
  majorQuenching: { name: "Major Quenching", i18n: "PF2E.ArmorPropertyRuneMajorQuenching" },
  majorShadow: { name: "Major Shadow", i18n: "PF2E.ArmorPropertyRuneMajorShadow" },
  majorSlick: { name: "Major Slick", i18n: "PF2E.ArmorPropertyRuneMajorSlick" },
  majorStanching: { name: "Major Stanching", i18n: "PF2E.ArmorPropertyRuneMajorStanching" },
  majorSwallowSpike: { name: "Major Swallow-Spike", i18n: "PF2E.ArmorPropertyRuneMajorSwallowSpike" },
  malleable: { name: "Malleable", i18n: "PF2E.ArmorPropertyRuneMalleable" },
  misleading: { name: "Misleading", i18n: "PF2E.ArmorPropertyRuneMisleading" },
  moderateDread: { name: "Moderate Dread", i18n: "PF2E.ArmorPropertyRuneModerateDread" },
  portable: { name: "Portable", i18n: "PF2E.ArmorPropertyRunePortable" },
  quenching: { name: "Quenching", i18n: "PF2E.ArmorPropertyRuneQuenching" },
  raiment: { name: "Raiment", i18n: "PF2E.ArmorPropertyRuneRaiment" },
  ready: { name: "Ready", i18n: "PF2E.ArmorPropertyRuneReady" },
  rockBraced: { name: "Rock-Braced", i18n: "PF2E.ArmorPropertyRuneRockBraced" },
  shadow: { name: "Shadow", i18n: "PF2E.ArmorPropertyRuneShadow" },
  sinisterKnight: { name: "Sinister Knight", i18n: "PF2E.ArmorPropertyRuneSinisterKnight" },
  sizeChanging: { name: "Size-Changing", i18n: "PF2E.ArmorPropertyRuneSizeChanging" },
  slick: { name: "Slick", i18n: "PF2E.ArmorPropertyRuneSlick" },
  soaring: { name: "Soaring", i18n: "PF2E.ArmorPropertyRuneSoaring" },
  stanching: { name: "Stanching", i18n: "PF2E.ArmorPropertyRuneStanching" },
  swallowSpike: { name: "Swallow-Spike", i18n: "PF2E.ArmorPropertyRuneSwallowSpike" },
  trueQuenching: { name: "True Quenching", i18n: "PF2E.ArmorPropertyRuneTrueQuenching" },
  trueStanching: { name: "True Stanching", i18n: "PF2E.ArmorPropertyRuneTrueStanching" },
  winged: { name: "Winged", i18n: "PF2E.ArmorPropertyRuneWinged" }
};

/**
 * Splits a camelCase rune slug into hyphen-separated words so that the same
 * comparison logic works for PF2e's camelCase slugs ("greaterFlaming"), the
 * compendium's kebab-case slugs ("greater-flaming-rune"), and display names.
 * @param {string} str
 * @returns {string}
 */
export function decamelize(str) {
  return (str ?? "").replace(/([a-z0-9])([A-Z])/g, "$1-$2");
}

/**
 * Clean and strip tier words & non-alphanumeric characters for core name comparison.
 * @param {string} str
 * @returns {string}
 */
function cleanCoreName(str) {
  return decamelize(str ?? "").toLowerCase()
    .replace(/\b(greater|major|true|minor|lesser|moderate|rune|property)\b/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Matches an actor inventory item against the official property runes rules list.
 * Inspects usage ("Etched onto..."), traits, name, and slug.
 * @param {Item} item - Inventory item to test
 * @param {boolean} isWeapon - True if testing for a weapon, false for armor
 * @returns {{ slug: string, name: string } | null}
 */
export function matchPropertyRune(item, isWeapon) {
  if (!item) return null;

  // Usage in PF2e items can be "etched-onto-a-weapon", "etched onto armor", etc.
  const usage = String(item.system?.usage?.value ?? item.system?.usage ?? "").toLowerCase();
  const traits = (item.system?.traits?.value ?? []).map(t => (typeof t === "string" ? t : t?.value ?? "").toLowerCase());
  const isEtched = usage.includes("etched");
  const hasRuneTrait = traits.includes("rune");

  // Incompatible target usages
  if (isWeapon && usage.includes("armor")) return null;
  if (!isWeapon && usage.includes("weapon")) return null;

  const itemName = (item.name ?? "").toLowerCase().trim();
  const itemSlug = (item.slug ?? "").toLowerCase().trim();

  // Tier flags on the item
  const itemIsGreater = itemName.includes("greater") || itemSlug.includes("greater");
  const itemIsMajor = itemName.includes("major") || itemSlug.includes("major");
  const itemIsTrue = itemName.includes("true") || itemSlug.includes("true");
  const itemIsLesser = itemName.includes("lesser") || itemSlug.includes("lesser");
  const itemIsModerate = itemName.includes("moderate") || itemSlug.includes("moderate");
  const itemIsMinor = itemName.includes("minor") || itemSlug.includes("minor");

  const itemCore = cleanCoreName(itemName);
  const slugCore = cleanCoreName(itemSlug);

  const propRunes = isWeapon ? WEAPON_PROPERTY_RUNES : ARMOR_PROPERTY_RUNES;

  // Test definitions sorted with longer/more specific slugs first
  const entries = Object.entries(propRunes).sort(([a], [b]) => b.length - a.length);

  for (const [slug, def] of entries) {
    const runeName = def.name.toLowerCase().trim();
    const runeSlug = slug.toLowerCase().trim();

    // Check tier consistency across all PF2e tiers
    const runeIsGreater = runeSlug.startsWith("greater") || runeName.startsWith("greater");
    const runeIsMajor = runeSlug.startsWith("major") || runeName.startsWith("major");
    const runeIsTrue = runeSlug.startsWith("true") || runeName.startsWith("true");
    const runeIsLesser = runeSlug.startsWith("lesser") || runeName.startsWith("lesser");
    const runeIsModerate = runeSlug.startsWith("moderate") || runeName.startsWith("moderate");
    const runeIsMinor = runeSlug.startsWith("minor") || runeName.startsWith("minor");

    if (runeIsGreater !== itemIsGreater) continue;
    if (runeIsMajor !== itemIsMajor) continue;
    if (runeIsTrue !== itemIsTrue) continue;
    if (runeIsLesser !== itemIsLesser) continue;
    if (runeIsModerate !== itemIsModerate) continue;
    if (runeIsMinor !== itemIsMinor) continue;

    const runeCore = cleanCoreName(runeName);
    const runeSlugCore = cleanCoreName(runeSlug);

    const isExactMatch = itemCore === runeCore || slugCore === runeSlugCore || itemCore === runeSlugCore || slugCore === runeCore;
    const isPartialMatch = isEtched && runeCore.length >= 4 && (itemCore.includes(runeCore) || slugCore.includes(runeSlugCore));

    if (isExactMatch || isPartialMatch) {
      // Must have etched usage, rune trait, "rune" in name/slug, or be equipment type
      if (isEtched || hasRuneTrait || itemName.includes("rune") || itemSlug.includes("rune") || item.type === "equipment") {
        return { slug, name: getPropertyRuneLabel(slug, isWeapon) || def.name };
      }
    }
  }

  return null;
}

/**
 * Resolves item search metadata (name, slug, search terms) for fundamental and property runes.
 * @param {object} runeInfo
 * @param {string} runeInfo.category - "potency" | "striking" | "resilient" | "reinforcing" | "property"
 * @param {number|string} runeInfo.value - level or property slug
 * @param {"weapon"|"armor"|"shield"} runeInfo.itemType
 * @returns {{ name: string, slug: string, searchTerms: string[], img?: string }}
 */
export function getRuneItemMeta({ category, value, itemType }) {
  const isWeapon = itemType === "weapon";
  const isArmor = itemType === "armor";
  const isShield = itemType === "shield";

  if (category === "potency") {
    const val = Number(value) || 1;
    const prefix = isWeapon ? "Weapon" : "Armor";
    const name = `+${val} ${prefix} Potency`;
    const slug = isWeapon ? `weapon-potency-${val}` : `armor-potency-${val}`;
    return {
      name,
      slug,
      searchTerms: [
        name.toLowerCase(),
        `+${val} ${prefix.toLowerCase()} potency`,
        `${prefix.toLowerCase()} potency (+${val})`,
        `${prefix.toLowerCase()} potency +${val}`,
        slug
      ]
    };
  }

  if (category === "striking") {
    const val = Number(value) || 1;
    const names = { 1: "Striking Rune", 2: "Greater Striking Rune", 3: "Major Striking Rune" };
    const slugs = { 1: "striking", 2: "greater-striking", 3: "major-striking" };
    const name = names[val] ?? "Striking Rune";
    const slug = slugs[val] ?? "striking";
    return {
      name,
      slug,
      searchTerms: [name.toLowerCase(), slug, name.toLowerCase().replace(" rune", "")]
    };
  }

  if (category === "resilient") {
    const val = Number(value) || 1;
    const names = { 1: "Resilient Rune", 2: "Greater Resilient Rune", 3: "Major Resilient Rune" };
    const slugs = { 1: "resilient", 2: "greater-resilient", 3: "major-resilient" };
    const name = names[val] ?? "Resilient Rune";
    const slug = slugs[val] ?? "resilient";
    return {
      name,
      slug,
      searchTerms: [name.toLowerCase(), slug, name.toLowerCase().replace(" rune", "")]
    };
  }

  if (category === "reinforcing") {
    const val = Number(value) || 1;
    const tiers = { 1: "Minor", 2: "Lesser", 3: "Moderate", 4: "Greater", 5: "Major", 6: "True" };
    const tier = tiers[val] ?? "Minor";
    const name = `Reinforcing Rune (${tier})`;
    const slug = `reinforcing-${tier.toLowerCase()}`;
    return {
      name,
      slug,
      searchTerms: [name.toLowerCase(), slug, `reinforcing rune ${tier.toLowerCase()}`]
    };
  }

  if (category === "property") {
    const rawSlug = String(value ?? "");
    const propSlug = normalizePropertyRuneSlug(rawSlug, !isArmor) ?? rawSlug;
    const dict = isArmor ? ARMOR_PROPERTY_RUNES : WEAPON_PROPERTY_RUNES;
    const baseName = getPropertyRuneLabel(propSlug, !isArmor);
    const englishBaseName = dict[propSlug]?.name ?? baseName;
    const name = baseName.toLowerCase().endsWith("rune") ? baseName : `${baseName} Rune`;
    const englishName = englishBaseName.toLowerCase().endsWith("rune") ? englishBaseName : `${englishBaseName} Rune`;

    // PF2e stores property runes camelCase, but compendium item slugs are kebab-case
    // ("greaterFlaming" vs "greater-flaming-rune" or Remaster "flaming-greater"), so offer all spellings.
    const kebabSlug = decamelize(propSlug).toLowerCase();
    const terms = new Set([
      name.toLowerCase(),
      baseName.toLowerCase(),
      englishName.toLowerCase(),
      englishBaseName.toLowerCase(),
      `${kebabSlug}-rune`,
      kebabSlug,
      propSlug.toLowerCase()
    ]);

    const tierMatch = englishBaseName.match(/^(Greater|Major|True|Lesser|Moderate|Minor)\s+(.+)$/i);
    if (tierMatch) {
      const tier = tierMatch[1].toLowerCase();
      const core = tierMatch[2].toLowerCase();
      const coreKebab = core.replace(/[^a-z0-9]+/g, "-");
      terms.add(`${core} (${tier})`);
      terms.add(`${core} (${tier}) rune`);
      terms.add(`${core} rune (${tier})`);
      terms.add(`${coreKebab}-${tier}`);
      terms.add(`${coreKebab}-${tier}-rune`);
    }

    return {
      name,
      slug: propSlug,
      searchTerms: [...terms]
    };
  }

  return {
    name: "Rune",
    slug: "rune",
    searchTerms: ["rune"]
  };
}


/**
 * Resolves the display label for a property rune, preferring the PF2e
 * localization key so non-English clients see their own language.
 * @param {string} slug
 * @param {boolean} isWeapon
 * @returns {string}
 */
export function getPropertyRuneLabel(slug, isWeapon) {
  const normalized = normalizePropertyRuneSlug(slug, isWeapon) ?? slug;
  const def = (isWeapon ? WEAPON_PROPERTY_RUNES : ARMOR_PROPERTY_RUNES)[normalized];
  if (def?.i18n && typeof game !== "undefined") {
    const localized = game.i18n?.localize?.(def.i18n);
    if (localized && localized !== def.i18n) return localized;
  }
  if (def?.name) return def.name;
  const words = decamelize(String(slug ?? "")).replace(/-/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

/**
 * True when a slug is a property rune this PF2e build can resolve.
 * @param {string} slug
 * @param {boolean} isWeapon
 * @returns {boolean}
 */
export function isKnownPropertyRune(slug, isWeapon) {
  if (!slug) return false;
  const dict = isWeapon ? WEAPON_PROPERTY_RUNES : ARMOR_PROPERTY_RUNES;
  return Object.prototype.hasOwnProperty.call(dict, slug);
}

/**
 * Normalizes a property rune slug (e.g. legacy kebab-case "greater-flaming"
 * or suffix "flaming-greater") to PF2e's canonical camelCase slug ("greaterFlaming")
 * if it exists in the property rune registry. Returns null if unrecognised.
 * @param {string} slug
 * @param {boolean} isWeapon
 * @returns {string | null}
 */
export function normalizePropertyRuneSlug(slug, isWeapon) {
  if (!slug || typeof slug !== "string") return null;
  const trimmed = slug.trim();
  if (!trimmed) return null;
  if (isKnownPropertyRune(trimmed, isWeapon)) return trimmed;

  const toCamel = (s) =>
    s
      .replace(/[-_\s]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase())
      .replace(/^[A-Z]/, c => c.toLowerCase());

  const directCamel = toCamel(trimmed);
  if (isKnownPropertyRune(directCamel, isWeapon)) return directCamel;

  const suffixMatch = trimmed.match(/^(.+)-(greater|major|true|lesser|moderate|minor)$/i);
  if (suffixMatch) {
    const prefixCamel = toCamel(`${suffixMatch[2].toLowerCase()}-${suffixMatch[1]}`);
    if (isKnownPropertyRune(prefixCamel, isWeapon)) return prefixCamel;
  }

  return null;
}

/**
 * Filters and normalizes a list of property rune slugs down to the canonical
 * camelCase slugs PF2e can resolve.
 *
 * PF2e's data preparation indexes `RUNE_DATA.<type>.property[slug]` without
 * guarding for unknown keys, so an unrecognised slug reaching
 * `system.runes.property` throws while building the item's strikes. Legacy
 * kebab-case slugs ("greater-flaming") are converted to camelCase ("greaterFlaming"),
 * while genuinely unknown slugs are logged and dropped.
 *
 * @param {string[]} slugs
 * @param {boolean} isWeapon
 * @returns {string[]}
 */
export function sanitizePropertyRunes(slugs, isWeapon) {
  const input = Array.isArray(slugs) ? slugs : [];
  const kept = [];
  const dropped = [];
  for (const raw of input) {
    const slug = typeof raw === "string" ? raw : raw?.slug ?? raw?.value ?? "";
    if (!slug) continue;
    const normalized = normalizePropertyRuneSlug(slug, isWeapon);
    if (normalized) {
      if (!kept.includes(normalized)) kept.push(normalized);
    } else {
      dropped.push(slug);
    }
  }
  if (dropped.length > 0) {
    console.warn(
      `PF2e Mobile Compact | Ignoring property rune(s) unknown to this PF2e build: ${dropped.join(", ")}`
    );
  }
  return kept;
}
