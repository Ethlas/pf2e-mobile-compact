/**
 * Context preparation helper for Core and Lore Skills.
 */

/**
 * Prepares skills context from actor statistics.
 * @param {Actor} actor
 * @param {object} sheet
 * @param {object} context
 */
export function prepareSkillsContext(actor, sheet, context) {
  const skills = actor.system?.skills ?? {};
  context.skills = Object.entries(skills).map(([slug, skillData]) => ({
    slug,
    label: skillData.label ?? (typeof slug.capitalize === "function" ? slug.capitalize() : slug.charAt(0).toUpperCase() + slug.slice(1)),
    mod: skillData.mod ?? skillData.value ?? 0,
    rank: skillData.rank ?? 0
  }));
}

