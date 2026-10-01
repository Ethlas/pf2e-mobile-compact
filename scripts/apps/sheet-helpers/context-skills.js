/**
 * Context preparation helper for Core and Lore Skills.
 */
import { PROFICIENCY_RANK_LETTERS, PROFICIENCY_RANK_NAMES } from "../../utils/sheet-utils.js";

/**
 * Prepares skills context from actor statistics.
 * Populates context.skills, context.coreSkills, and context.loreSkills with localized labels,
 * accurate modifiers, and proficiency rank metadata.
 *
 * @param {Actor} actor
 * @param {object} sheet
 * @param {object} context
 */
export function prepareSkillsContext(actor, sheet, context) {
  const skillEntries = [];
  const processedSlugs = new Set();

  // 1. Gather from actor.skills (Statistic instances - most up-to-date and complete in PF2e)
  if (actor.skills && typeof actor.skills === "object") {
    for (const [slug, stat] of Object.entries(actor.skills)) {
      if (!stat || processedSlugs.has(slug)) continue;
      processedSlugs.add(slug);

      const rawLabel = stat.label ?? slug;
      const label = typeof rawLabel === "string" ? (game.i18n?.localize?.(rawLabel) ?? rawLabel) : String(rawLabel);
      const mod = stat.totalModifier ?? stat.mod ?? stat.check?.mod ?? stat.value ?? 0;
      const rank = typeof stat.rank === "number" ? stat.rank : (actor.system?.skills?.[slug]?.rank ?? 0);
      const isLore = !!(stat.lore || actor.system?.skills?.[slug]?.lore);
      const rankLetter = PROFICIENCY_RANK_LETTERS[rank] ?? "U";
      const rankName = game.i18n?.localize?.(`PF2E.ProficiencyLevel${rank}`) ?? (PROFICIENCY_RANK_NAMES[rank] ?? "Untrained");

      skillEntries.push({
        slug,
        label,
        mod,
        rank,
        rankLetter,
        rankName,
        isLore,
        itemId: stat.item?.id ?? actor.system?.skills?.[slug]?.itemId ?? null
      });
    }
  }

  // 2. Fallback to actor.system.skills if actor.skills was omitted or missed any skills
  const systemSkills = actor.system?.skills ?? {};
  for (const [slug, skillData] of Object.entries(systemSkills)) {
    if (processedSlugs.has(slug)) continue;
    processedSlugs.add(slug);

    const stat = actor.getStatistic?.(slug);
    const rawLabel = stat?.label ?? skillData?.label ?? (typeof slug.capitalize === "function" ? slug.capitalize() : slug.charAt(0).toUpperCase() + slug.slice(1));
    const label = typeof rawLabel === "string" ? (game.i18n?.localize?.(rawLabel) ?? rawLabel) : String(rawLabel);
    const mod = stat?.totalModifier ?? stat?.mod ?? stat?.check?.mod ?? skillData?.mod ?? skillData?.value ?? 0;
    const rank = stat?.rank ?? skillData?.rank ?? 0;
    const isLore = !!(stat?.lore || skillData?.lore);
    const rankLetter = PROFICIENCY_RANK_LETTERS[rank] ?? "U";
    const rankName = game.i18n?.localize?.(`PF2E.ProficiencyLevel${rank}`) ?? (PROFICIENCY_RANK_NAMES[rank] ?? "Untrained");

    skillEntries.push({
      slug,
      label,
      mod,
      rank,
      rankLetter,
      rankName,
      isLore,
      itemId: stat?.item?.id ?? skillData?.itemId ?? null
    });
  }

  // 3. Sort: Core skills alphabetically by label, Lore skills alphabetically by label
  const lang = game.i18n?.lang || "en";
  skillEntries.sort((a, b) => {
    if (a.isLore !== b.isLore) return a.isLore ? 1 : -1;
    return a.label.localeCompare(b.label, lang);
  });

  const coreSkills = skillEntries.filter(s => !s.isLore);
  const loreSkills = skillEntries.filter(s => s.isLore);

  context.skills = skillEntries;
  context.coreSkills = coreSkills;
  context.loreSkills = loreSkills;
}
