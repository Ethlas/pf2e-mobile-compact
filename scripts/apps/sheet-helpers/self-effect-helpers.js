/**
 * Shared helpers for detecting, matching, and toggling self-effect states across
 * action cards, weapon strike auxiliary actions, and the header shield badge.
 */

export const KNOWN_TOGGLE_EFFECT_SLUGS = new Set(["raise-a-shield", "parry"]);

/**
 * Normalizes an arbitrary name or slug string to kebab-case lowercase.
 * @param {string|null|undefined} value
 * @returns {string}
 */
function normalizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Strips PF2e effect/stance prefixes (`effect-`, `stance-`, `spell-effect-`, etc.)
 * to mirror `AbstractEffectPF2e#prepareBaseData` roll-option slug normalization.
 * @param {string|null|undefined} slug
 * @returns {string}
 */
function stripEffectPrefix(slug) {
  return String(slug ?? "").replace(/^(?:[a-z]+-)?(?:effect|stance)-/, "");
}

/**
 * Normalizes a compendium UUID so 4-part `Compendium.<scope>.<pack>.<id>` references
 * (as stored on PF2e `SimpleAction#effect`) match 5-part `...Item.<id>` source IDs.
 * @param {string|null|undefined} uuid
 * @returns {string}
 */
function normalizeUuid(uuid) {
  const trimmed = String(uuid ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("Compendium.")) {
    const parts = trimmed.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.Item.${parts[3]}`;
    }
  }
  return trimmed;
}

/**
 * Safely retrieves all embedded effect items from an actor.
 * @param {Actor|null|undefined} actor
 * @returns {Array<object>}
 */
function getActorEffects(actor) {
  if (Array.isArray(actor?.itemTypes?.effect)) return actor.itemTypes.effect;
  if (Array.isArray(actor?.items)) return actor.items.filter(i => i?.type === "effect");
  return [];
}

/**
 * Collects normalized source UUID candidates from an embedded effect item.
 * @param {object} effect
 * @returns {string[]}
 */
function getEffectSourceIds(effect) {
  return [
    effect?.sourceId,
    effect?._stats?.compendiumSource,
    effect?._stats?.duplicateSource,
    effect?.flags?.core?.sourceId
  ]
    .filter(Boolean)
    .map(normalizeUuid);
}

/**
 * Resolves the normalized roll-option slug for an effect item.
 * @param {object} effect
 * @returns {string}
 */
function getEffectRollOptionSlug(effect) {
  return stripEffectPrefix(
    normalizeSlug(effect?.rollOptionSlug || effect?.slug || effect?.system?.slug || effect?.name || "")
  );
}

/**
 * Extracts the effect compendium UUID string from a PF2e system action entry, if any.
 * @param {object|null|undefined} systemAction
 * @returns {string|null}
 */
function getSystemActionEffectUuid(systemAction) {
  if (typeof systemAction?.effect === "string") return systemAction.effect;
  if (typeof systemAction?.effect?.uuid === "string") return systemAction.effect.uuid;
  return null;
}

/**
 * Whether an action or feat item represents a toggleable self-effect action
 * (via `system.selfEffect`, a `systemAction.effect`, or known self-toggle slugs).
 * @param {object|null|undefined} item
 * @param {object|null} [systemAction=null]
 * @returns {boolean}
 */
export function hasActionSelfEffect(item, systemAction = null) {
  return Boolean(
    item?.system?.selfEffect?.uuid ||
    getSystemActionEffectUuid(systemAction) ||
    KNOWN_TOGGLE_EFFECT_SLUGS.has(normalizeSlug(item?.slug ?? item?.system?.slug ?? ""))
  );
}

/**
 * Finds the active embedded effect on an actor matching a target effect slug
 * (e.g. `"raise-a-shield"` or `"parry"`).
 * @param {Actor|null|undefined} actor
 * @param {string|null|undefined} slug
 * @returns {object|null}
 */
export function findActiveEffectBySlug(actor, slug) {
  const targetSlug = stripEffectPrefix(normalizeSlug(slug));
  if (!targetSlug) return null;

  return getActorEffects(actor).find(e => {
    const rawSlug = normalizeSlug(e?.slug ?? e?.system?.slug ?? "");
    return getEffectRollOptionSlug(e) === targetSlug ||
      rawSlug === targetSlug ||
      rawSlug === `effect-${targetSlug}`;
  }) ?? null;
}

/**
 * Whether an effect identified by slug is currently active on the actor, checking
 * both PF2e's derived `self:effect:<slug>` roll option and embedded effect items.
 * @param {Actor|null|undefined} actor
 * @param {string|null|undefined} slug
 * @returns {boolean}
 */
export function isEffectSlugActive(actor, slug) {
  const targetSlug = stripEffectPrefix(normalizeSlug(slug));
  if (!targetSlug) return false;
  return Boolean(actor?.rollOptions?.all?.[`self:effect:${targetSlug}`] || findActiveEffectBySlug(actor, targetSlug));
}

/**
 * Finds the active embedded effect on an actor corresponding to a self-effect action item.
 * Matches by compendium/source UUID, effect/stance display name, stripped slug, or origin item UUID.
 * @param {Actor|null|undefined} actor
 * @param {object|null|undefined} item
 * @param {object|null} [systemAction=null]
 * @returns {object|null}
 */
export function findActiveSelfEffect(actor, item, systemAction = null) {
  if (!hasActionSelfEffect(item, systemAction)) return null;

  const selfEffect = item?.system?.selfEffect;
  const candidateUuids = new Set(
    [selfEffect?.uuid, getSystemActionEffectUuid(systemAction)]
      .map(normalizeUuid)
      .filter(Boolean)
  );

  const candidateNames = new Set();
  const selfEffectName = String(selfEffect?.name ?? "").trim().toLowerCase();
  if (selfEffectName) candidateNames.add(selfEffectName);
  const itemName = String(item?.name ?? "").trim().toLowerCase();
  if (itemName) {
    candidateNames.add(`effect: ${itemName}`);
    candidateNames.add(`stance: ${itemName}`);
  }

  const candidateSlugs = new Set(
    [item?.slug ?? item?.system?.slug, selfEffect?.name, item?.name]
      .map(v => stripEffectPrefix(normalizeSlug(v)))
      .filter(Boolean)
  );

  return getActorEffects(actor).find(e => {
    if (getEffectSourceIds(e).some(id => candidateUuids.has(id))) return true;
    const effectName = String(e?.name ?? "").trim().toLowerCase();
    if (effectName && candidateNames.has(effectName)) return true;
    if (candidateSlugs.size > 0 && candidateSlugs.has(getEffectRollOptionSlug(e))) return true;
    if (item?.uuid && e?.system?.context?.origin?.item === item.uuid) return true;
    return false;
  }) ?? null;
}

/**
 * Whether a self-effect action's effect is currently active on the actor, checking both
 * embedded effect documents and PF2e's derived `self:effect:<slug>` roll options.
 * @param {Actor|null|undefined} actor
 * @param {object|null|undefined} item
 * @param {object|null} [systemAction=null]
 * @returns {boolean}
 */
export function isActionSelfEffectActive(actor, item, systemAction = null) {
  if (!hasActionSelfEffect(item, systemAction)) return false;
  if (findActiveSelfEffect(actor, item, systemAction)) return true;

  const rollOptions = actor?.rollOptions?.all;
  if (!rollOptions) return false;

  const slugs = [item?.slug ?? item?.system?.slug, item?.system?.selfEffect?.name, item?.name]
    .map(v => stripEffectPrefix(normalizeSlug(v)))
    .filter(Boolean);

  return slugs.some(s => Boolean(rollOptions[`self:effect:${s}`]));
}

/**
 * Whether the actor currently has a shield raised (including via the Shield spell),
 * guarding against broken or destroyed physical shields.
 * @param {Actor|null|undefined} actor
 * @returns {boolean}
 */
export function isShieldRaised(actor) {
  const shield = actor?.system?.attributes?.shield ?? actor?.attributes?.shield ?? null;
  if (shield?.raised || actor?.heldShield?.isRaised) return true;
  if (shield?.broken || shield?.destroyed) return false;
  return isEffectSlugActive(actor, "raise-a-shield");
}
