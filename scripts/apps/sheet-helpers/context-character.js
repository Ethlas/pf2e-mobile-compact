/**
 * Context preparation for the Character overview, the pseudo-tab opened by the user button
 * next to the character name in the header (see onToggleCharacterOverview in character-handlers.js).
 *
 * Everything here is read from values pf2e has already prepared on the actor (attribute
 * modifiers, speeds, senses, IWR, class DC, effects, feat groups). Nothing is recalculated.
 */

const ATTRIBUTE_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

// The speed types pf2e's own character tab always lists, in its order (the list is private to its sheet)
const SPEED_TYPES = ["land", "swim", "climb", "fly", "burrow"];

/**
 * Localizes a key when Foundry's i18n is available, otherwise returns the key unchanged.
 * @param {string} key
 * @returns {string}
 */
function localize(key) {
  if (!key) return "";
  return globalThis.game?.i18n?.localize?.(key) ?? key;
}

/**
 * Ancestry, heritage, background, class, level, deity, size and the creature traits pf2e shows as tags
 * (e.g. "Gnome", "Humanoid"). Values that don't apply (e.g. no deity) are null; the template decides labels,
 * order and which rows to show.
 * @param {Actor} actor
 * @returns {{ancestry: ?string, heritage: ?string, background: ?string, className: ?string, level: ?number, deity: ?string, size: ?string, traits: string[]}}
 */
function buildIdentity(actor) {
  const size = actor.size ?? actor.system?.traits?.size?.value;
  return {
    ancestry: actor.ancestry?.name ?? null,
    heritage: actor.heritage?.name ?? null,
    background: actor.background?.name ?? null,
    className: actor.class?.name ?? null,
    level: actor.level ?? actor.system?.details?.level?.value ?? null,
    deity: actor.deity?.name ?? null,
    size: size ? localize(globalThis.CONFIG?.PF2E?.actorSizes?.[size] ?? size) : null,
    traits: (actor.system?.traits?.value ?? []).map(slug => localize(globalThis.CONFIG?.PF2E?.creatureTraits?.[slug] ?? slug))
  };
}

/**
 * The six attribute modifiers, as pf2e prepared them.
 * @param {Actor} actor
 * @returns {{key: string, title: string, mod: number}[]}
 */
function buildAttributes(actor) {
  return ATTRIBUTE_KEYS.map(key => ({
    key,
    title: localize(globalThis.CONFIG?.PF2E?.abilities?.[key] ?? key),
    mod: actor.abilities?.[key]?.mod ?? actor.system?.abilities?.[key]?.mod ?? 0
  }));
}

/**
 * pf2e's short label for a speed type ("Land", "Swim"), or the type itself when that string doesn't exist.
 * @param {string} type
 * @returns {string}
 */
function speedTypeLabel(type) {
  const name = `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  const key = `PF2E.Actor.Speed.Type.${name}`;
  const label = localize(key);
  return label !== key ? label : name;
}

/**
 * Land, swim, climb, fly and burrow speed, like pf2e's character tab: every type is listed, with
 * value null when the character doesn't have that speed. Labels are pf2e's PF2E.Actor.Speed.Type strings.
 * pf2e 8 keeps SpeedStatistics in actor.movement.speeds; older versions use system.attributes.speed.
 * @param {Actor} actor
 * @returns {{type: string, label: string, value: ?number}[]}
 */
function buildSpeeds(actor) {
  const speeds = actor.movement?.speeds ?? actor.system?.movement?.speeds;
  const legacy = actor.system?.attributes?.speed;
  const valueOf = (type) => {
    if (speeds) return speeds[type]?.value || null;
    if (!legacy) return null;
    if (type === "land") return legacy.total ?? legacy.value ?? null;
    const other = (legacy.otherSpeeds ?? []).find(s => s.type === type);
    return other ? (other.total ?? other.value ?? null) : null;
  };
  return SPEED_TYPES.map(type => ({ type, label: speedTypeLabel(type), value: valueOf(type) }));
}

// Vision senses made redundant by a better one, like pf2e's character sheet shows them: darkvision
// supersedes low-light vision, greater darkvision both. Mirrors pf2e's condenseSenses(), which isn't exposed.
const SUPERSEDED_SENSES = {
  "greater-darkvision": ["darkvision", "low-light-vision"],
  darkvision: ["low-light-vision"]
};

/**
 * Sense labels (e.g. "Darkvision", "Scent (imprecise) 30 feet"), without the ones a better sense supersedes.
 * @param {Actor} actor
 * @returns {string[]}
 */
function buildSenses(actor) {
  const senses = Array.from(actor.perception?.senses?.contents ?? actor.system?.perception?.senses ?? []);
  const types = new Set(senses.map(s => s?.type));
  const hidden = new Set([...types].flatMap(type => SUPERSEDED_SENSES[type] ?? []));
  return senses.filter(s => !hidden.has(s?.type)).map(s => s?.label ?? s?.type).filter(Boolean);
}

/**
 * Known languages, localized through pf2e's language list, plus any free-text details.
 * @param {Actor} actor
 * @returns {string[]}
 */
function buildLanguages(actor) {
  const languages = actor.system?.details?.languages;
  const names = (languages?.value ?? []).map(slug => localize(globalThis.CONFIG?.PF2E?.languages?.[slug] ?? slug));
  if (languages?.details) names.push(languages.details);
  return names;
}

/**
 * Immunities, weaknesses and resistances (using pf2e's own labels) and class DC.
 * AC and saves are not repeated here; they are already in the header.
 * @param {Actor} actor
 * @returns {object}
 */
function buildDefenseDetails(actor) {
  const iwrLabels = (key) => (actor.attributes?.[key] ?? actor.system?.attributes?.[key] ?? [])
    .map(entry => entry?.label ?? entry?.type)
    .filter(Boolean);
  return {
    immunities: iwrLabels("immunities"),
    weaknesses: iwrLabels("weaknesses"),
    resistances: iwrLabels("resistances"),
    classDC: actor.classDC?.dc?.value ?? null
  };
}

/**
 * Remaining duration label for an effect, like pf2e's effects panel shows it ("2 rounds remaining").
 * pf2e calculates the remaining time (effect.remainingDuration, in seconds); this only picks the
 * matching pf2e text. pf2e's own formatter is private to its EffectsPanel, so its choice of unit is
 * mirrored here, using the same PF2E.EffectPanel strings.
 * @param {Item} effect
 * @returns {string|null}
 */
function remainingDurationLabel(effect) {
  const system = effect.system ?? {};
  const i18n = globalThis.game?.i18n;
  const format = (key, data) => i18n?.format?.(`PF2E.EffectPanel.${key}`, data) ?? key;
  if (effect.totalDuration === Infinity) {
    if (system.duration?.unit !== "encounter") return format("UnlimitedDuration");
    return format(system.expired ? "Expired" : "UntilEncounterEnds");
  }
  if (system.expired) return format("Expired");
  const seconds = effect.remainingDuration?.remaining;
  if (typeof seconds !== "number") return null;
  // [from seconds, pf2e string, placeholder, seconds per unit]; same thresholds as pf2e's EffectsPanel
  const units = [
    [63072e3, "MultipleYears", "years", 31536e3], [31536e3, "SingleYear"],
    [1209600, "MultipleWeeks", "weeks", 604800], [604801, "SingleWeek"],
    [172800, "MultipleDays", "days", 86400], [7201, "MultipleHours", "hours", 3600],
    [121, "MultipleMinutes", "minutes", 60], [12, "MultipleRounds", "rounds", 6],
    [6, "SingleRound"], [2, "MultipleSeconds", "seconds", 1], [1, "SingleSecond"]
  ];
  for (const [min, key, unit, size] of units) {
    if (seconds >= min) return format(`RemainingDuration.${key}`, unit ? { [unit]: Math.floor(seconds / size) } : {});
  }
  const expiry = system.duration?.expiry === "turn-end" ? "ZeroRoundsExpireTurnEnd" : "ZeroRoundsExpireTurnStart";
  return format(`RemainingDuration.${expiry}`, { initiative: system.start?.initiative ?? 0 });
}

/**
 * Afflictions, active conditions and effects: the same three lists as pf2e's effects panel.
 * Effects and afflictions show their badge value after the name (a counter, or an affliction's stage).
 * Conditions don't: pf2e already puts their value in the name ("Frightened 2", persistent damage's formula).
 * Descriptions load on tap, like the feats (see mapFeatSlot).
 * @param {Actor} actor
 * @param {object} sheet
 * @returns {object[]}
 */
function buildEffects(actor, sheet) {
  const items = [
    ...(actor.itemTypes?.affliction ?? []),
    ...(actor.conditions?.active ?? []),
    ...(actor.itemTypes?.effect ?? [])
  ];
  return items.map(item => {
    const badge = item.type === "condition" ? null : item.badge;
    const isExpanded = Boolean(sheet?._expandedItemIds?.has(item.id));
    return {
      id: item.id,
      name: item.name,
      img: item.img ?? null,
      badge: badge ? (badge.labels?.[badge.value - 1] ?? badge.label ?? badge.value ?? null) : null,
      remaining: item.type === "effect" ? remainingDurationLabel(item) : null,
      isExpanded,
      description: isExpanded ? (sheet._itemDescriptions?.get(item.id) ?? "") : ""
    };
  });
}

/**
 * Turns a pf2e feat slot ({feat, level, children}) into a template row. Empty slots return null.
 * Granted feats (children) are kept nested, so the template can indent them under their parent.
 * Descriptions are not enriched here: onToggleItemDescription (character-handlers.js) does that on the
 * first tap and caches it on the sheet. A feat that is open gets its cached text back on re-render.
 * @param {object} slot
 * @param {object} sheet
 * @returns {object|null}
 */
function mapFeatSlot(slot, sheet) {
  const feat = slot?.feat;
  if (!feat) return null;
  const isExpanded = Boolean(sheet?._expandedItemIds?.has(feat.id));
  return {
    id: feat.id,
    name: feat.name,
    level: slot.level ?? feat.system?.level?.value ?? null,
    isExpanded,
    description: isExpanded ? (sheet._itemDescriptions?.get(feat.id) ?? "") : "",
    children: (slot.children ?? []).map(child => mapFeatSlot(child, sheet)).filter(Boolean)
  };
}

/**
 * Feats and features in pf2e's own groups and order (ancestry features, class features,
 * ancestry, class, archetype, skill, general, ... and bonus feats), skipping empty groups.
 * Falls back to one flat list when the actor has no pf2e feat groups.
 * @param {Actor} actor
 * @param {object} sheet
 * @returns {{id: string, label: string, feats: object[]}[]}
 */
function buildFeatGroups(actor, sheet) {
  const featGroups = actor.feats;
  if (!featGroups) {
    const feats = (actor.itemTypes?.feat ?? []).map(feat => mapFeatSlot({ feat }, sheet)).filter(Boolean);
    return feats.length ? [{ id: "feats", label: "Feats", feats }] : [];
  }
  const groups = [...Array.from(featGroups.contents ?? featGroups), featGroups.bonus].filter(Boolean);
  return groups
    .map(group => ({
      id: group.id,
      label: localize(group.label),
      feats: (group.feats ?? []).map(slot => mapFeatSlot(slot, sheet)).filter(Boolean)
    }))
    .filter(group => group.feats.length > 0);
}

/**
 * Prepares context.character for the Character overview. Only runs while that view is open,
 * so the other tabs don't pay for it.
 * @param {Actor} actor
 * @param {object} sheet
 * @param {object} context
 */
export function prepareCharacterContext(actor, sheet, context) {
  if (sheet?._activeTab !== "character") return;
  context.character = {
    identity: buildIdentity(actor),
    attributes: buildAttributes(actor),
    speeds: buildSpeeds(actor),
    senses: buildSenses(actor),
    languages: buildLanguages(actor),
    defenses: buildDefenseDetails(actor),
    effects: buildEffects(actor, sheet),
    featGroups: buildFeatGroups(actor, sheet)
  };
}
