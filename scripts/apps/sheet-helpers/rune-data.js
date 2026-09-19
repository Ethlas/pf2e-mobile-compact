/**
 * Official PF2e Weapon and Armor Property Rune definitions and matching logic.
 * Sourced directly from official Pathfinder 2e Remaster & Legacy rules.
 */

export const WEAPON_PROPERTY_RUNES = {
  "greater-corrosive": { name: "Greater Corrosive" },
  "corrosive": { name: "Corrosive" },
  "greater-crushing": { name: "Greater Crushing" },
  "crushing": { name: "Crushing" },
  "greater-decaying": { name: "Greater Decaying" },
  "decaying": { name: "Decaying" },
  "greater-demolishing": { name: "Greater Demolishing" },
  "demolishing": { name: "Demolishing" },
  "greater-disrupting": { name: "Greater Disrupting" },
  "disrupting": { name: "Disrupting" },
  "greater-extending": { name: "Greater Extending" },
  "extending": { name: "Extending" },
  "greater-fanged": { name: "Greater Fanged" },
  "fanged": { name: "Fanged" },
  "greater-fearsome": { name: "Greater Fearsome" },
  "fearsome": { name: "Fearsome" },
  "greater-flaming": { name: "Greater Flaming" },
  "flaming": { name: "Flaming" },
  "greater-frost": { name: "Greater Frost" },
  "frost": { name: "Frost" },
  "greater-ghoul-bane": { name: "Greater Ghoul Bane" },
  "ghoul-bane": { name: "Ghoul Bane" },
  "greater-grievous": { name: "Greater Grievous" },
  "grievous": { name: "Grievous" },
  "greater-hauling": { name: "Greater Hauling" },
  "hauling": { name: "Hauling" },
  "greater-impactful": { name: "Greater Impactful" },
  "impactful": { name: "Impactful" },
  "greater-merciful": { name: "Greater Merciful" },
  "merciful": { name: "Merciful" },
  "greater-phantasmal": { name: "Greater Phantasmal" },
  "phantasmal": { name: "Phantasmal" },
  "greater-reverberating": { name: "Greater Reverberating" },
  "reverberating": { name: "Reverberating" },
  "greater-rooting": { name: "Greater Rooting" },
  "major-rooting": { name: "Major Rooting" },
  "rooting": { name: "Rooting" },
  "greater-serrating": { name: "Greater Serrating" },
  "serrating": { name: "Serrating" },
  "greater-shock": { name: "Greater Shock" },
  "shock": { name: "Shock" },
  "greater-thundering": { name: "Greater Thundering" },
  "thundering": { name: "Thundering" },
  "greater-vitalizing": { name: "Greater Vitalizing" },
  "vitalizing": { name: "Vitalizing" },
  "greater-ashen": { name: "Greater Ashen" },
  "ashen": { name: "Ashen" },
  "greater-bloodbane": { name: "Greater Bloodbane" },
  "bloodbane": { name: "Bloodbane" },
  "greater-brilliant": { name: "Greater Brilliant" },
  "brilliant": { name: "Brilliant" },
  "greater-flurrying": { name: "Greater Flurrying" },
  "flurrying": { name: "Flurrying" },
  "ancestry-paragon": { name: "Ancestry Paragon" },
  "ancestral-echoing": { name: "Ancestral Echoing" },
  "authorized": { name: "Authorized" },
  "bane": { name: "Bane" },
  "bloodthirsty": { name: "Bloodthirsty" },
  "bloody": { name: "Bloody" },
  "called": { name: "Called" },
  "coating": { name: "Coating" },
  "conducting": { name: "Conducting" },
  "cunning": { name: "Cunning" },
  "dancing": { name: "Dancing" },
  "deathdrinking": { name: "Deathdrinking" },
  "earthbinding": { name: "Earthbinding" },
  "energizing": { name: "Energizing" },
  "flickering": { name: "Flickering" },
  "ghost-touch": { name: "Ghost Touch" },
  "goring": { name: "Goring" },
  "holy": { name: "Holy" },
  "hopeful": { name: "Hopeful" },
  "hooked": { name: "Hooked" },
  "impossible": { name: "Impossible" },
  "infusing": { name: "Infusing" },
  "keen": { name: "Keen" },
  "kin-warding": { name: "Kin-Warding" },
  "nightfall": { name: "Nightfall" },
  "pacifying": { name: "Pacifying" },
  "peaceful": { name: "Peaceful" },
  "protecting": { name: "Protecting" },
  "resplendent": { name: "Resplendent" },
  "returning": { name: "Returning" },
  "shattering": { name: "Shattering" },
  "shifting": { name: "Shifting" },
  "skirmishing": { name: "Skirmishing" },
  "speed": { name: "Speed" },
  "spell-consuming": { name: "Spell-Consuming" },
  "spell-storing": { name: "Spell-Storing" },
  "spider-foot": { name: "Spider Foot" },
  "surprise-strike": { name: "Surprise Strike" },
  "swarming": { name: "Swarming" },
  "underwater": { name: "Underwater" },
  "unholy": { name: "Unholy" },
  "vorpal": { name: "Vorpal" },
  "wounding": { name: "Wounding" }
};

export const ARMOR_PROPERTY_RUNES = {
  "greater-acid-resistant": { name: "Greater Acid-Resistant" },
  "acid-resistant": { name: "Acid-Resistant" },
  "greater-assisting": { name: "Greater Assisting" },
  "assisting": { name: "Assisting" },
  "greater-cold-resistant": { name: "Greater Cold-Resistant" },
  "cold-resistant": { name: "Cold-Resistant" },
  "greater-dread": { name: "Greater Dread" },
  "major-dread": { name: "Major Dread" },
  "dread": { name: "Dread" },
  "greater-electricity-resistant": { name: "Greater Electricity-Resistant" },
  "electricity-resistant": { name: "Electricity-Resistant" },
  "greater-energy-resistant": { name: "Greater Energy-Resistant" },
  "energy-resistant": { name: "Energy-Resistant" },
  "greater-fire-resistant": { name: "Greater Fire-Resistant" },
  "fire-resistant": { name: "Fire-Resistant" },
  "greater-fortification": { name: "Greater Fortification" },
  "fortification": { name: "Fortification" },
  "greater-glamered": { name: "Greater Glamered" },
  "glamered": { name: "Glamered" },
  "greater-immaterial": { name: "Greater Immaterial" },
  "immaterial": { name: "Immaterial" },
  "greater-invisibility": { name: "Greater Invisibility" },
  "invisibility": { name: "Invisibility" },
  "greater-mending": { name: "Greater Mending" },
  "mending": { name: "Mending" },
  "greater-ready": { name: "Greater Ready" },
  "ready": { name: "Ready" },
  "greater-shadow": { name: "Greater Shadow" },
  "major-shadow": { name: "Major Shadow" },
  "shadow": { name: "Shadow" },
  "greater-slick": { name: "Greater Slick" },
  "major-slick": { name: "Major Slick" },
  "slick": { name: "Slick" },
  "greater-spell-eating": { name: "Greater Spell-Eating" },
  "spell-eating": { name: "Spell-Eating" },
  "greater-stanching": { name: "Greater Stanching" },
  "major-stanching": { name: "Major Stanching" },
  "true-stanching": { name: "True Stanching" },
  "stanching": { name: "Stanching" },
  "aim-aiding": { name: "Aim-Aiding" },
  "antimagic": { name: "Antimagic" },
  "bitter": { name: "Bitter" },
  "deathless": { name: "Deathless" },
  "magnetizing": { name: "Magnetizing" },
  "rock-braced": { name: "Rock-Braced" },
  "sinister-knight": { name: "Sinister Knight" },
  "soaring": { name: "Soaring" },
  "swallow-spite": { name: "Swallow-Spite" },
  "titanic": { name: "Titanic" },
  "vitalizing": { name: "Vitalizing" },
  "winged": { name: "Winged" }
};

/**
 * Clean and strip tier words & non-alphanumeric characters for core name comparison.
 * @param {string} str
 * @returns {string}
 */
function cleanCoreName(str) {
  return (str ?? "").toLowerCase()
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

  const itemCore = cleanCoreName(itemName);
  const slugCore = cleanCoreName(itemSlug);

  const propRunes = isWeapon ? WEAPON_PROPERTY_RUNES : ARMOR_PROPERTY_RUNES;

  // Test definitions sorted with longer/more specific slugs first
  const entries = Object.entries(propRunes).sort(([a], [b]) => b.length - a.length);

  for (const [slug, def] of entries) {
    const runeName = def.name.toLowerCase().trim();
    const runeSlug = slug.toLowerCase().trim();

    // Check tier consistency
    const runeIsGreater = runeSlug.startsWith("greater-") || runeName.startsWith("greater");
    const runeIsMajor = runeSlug.startsWith("major-") || runeName.startsWith("major");
    const runeIsTrue = runeSlug.startsWith("true-") || runeName.startsWith("true");

    if (runeIsGreater !== itemIsGreater) continue;
    if (runeIsMajor !== itemIsMajor) continue;
    if (runeIsTrue !== itemIsTrue) continue;

    const runeCore = cleanCoreName(runeName);
    const runeSlugCore = cleanCoreName(runeSlug);

    const isExactMatch = itemCore === runeCore || slugCore === runeSlugCore || itemCore === runeSlugCore || slugCore === runeCore;
    const isPartialMatch = isEtched && runeCore.length >= 4 && (itemCore.includes(runeCore) || slugCore.includes(runeSlugCore));

    if (isExactMatch || isPartialMatch) {
      // Must have etched usage, rune trait, "rune" in name/slug, or be equipment type
      if (isEtched || hasRuneTrait || itemName.includes("rune") || itemSlug.includes("rune") || item.type === "equipment") {
        return { slug, name: def.name };
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
    const propSlug = String(value);
    const dict = isArmor ? ARMOR_PROPERTY_RUNES : WEAPON_PROPERTY_RUNES;
    const baseName = dict[propSlug]?.name ?? (propSlug.charAt(0).toUpperCase() + propSlug.slice(1).replace(/-/g, " "));
    const name = baseName.toLowerCase().endsWith("rune") ? baseName : `${baseName} Rune`;
    return {
      name,
      slug: propSlug,
      searchTerms: [
        name.toLowerCase(),
        baseName.toLowerCase(),
        `${propSlug}-rune`,
        propSlug
      ]
    };
  }

  return {
    name: "Rune",
    slug: "rune",
    searchTerms: ["rune"]
  };
}

