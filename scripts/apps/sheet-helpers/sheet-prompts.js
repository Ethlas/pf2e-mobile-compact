import {
  getTargetableToken,
  setTargetToken,
  setTargetTokens,
  getTokenDistanceInfo,
  syncSceneTokenPositions
} from "../../tokens/token-adapter.js";

/**
 * Collects all targetable tokens on the current scene, with synchronized coordinates and distances.
 * Supports including the actor's own token (`Self`) when `includeSelf` is true.
 * @param {Actor} actor
 * @param {object} [options={}]
 * @param {boolean} [options.includeSelf=true]
 * @returns {Array<{id: string, rawName: string, name: string, displayName: string, distance: number|null, distanceLabel: string|null, isSelf: boolean, isEnemy: boolean, isAlly: boolean, selected: boolean}>}
 */
export function collectSceneCandidateTokens(actor, { includeSelf = true } = {}) {
  const canvasObj = typeof canvas !== "undefined" ? canvas : null;
  const scene = canvasObj?.scene ?? game.scenes?.viewed ?? game.scenes?.active;
  syncSceneTokenPositions(scene);

  const selectedIds = new Set(Array.from(game.user?.targets ?? []).map(t => t.id).filter(Boolean));
  const rawTokens = scene?.tokens?.contents
    ?? (scene?.tokens ? Array.from(scene.tokens) : null)
    ?? (canvasObj?.tokens?.placeables ?? []);

  const candidates = [];
  for (const t of rawTokens) {
    const tDoc = t.document ?? t;
    const tActor = t.actor ?? tDoc.actor;
    if (!tActor) continue;
    const isHidden = Boolean(tDoc.hidden ?? (t.visible === false));
    if (isHidden && !game.user?.isGM) continue;

    const isSelf = (tActor.id === actor?.id) || (tDoc.actorId === actor?.id);
    if (isSelf && !includeSelf) continue;

    const distInfo = getTokenDistanceInfo(actor, tDoc.id);
    const disp = tDoc.disposition ?? 0;
    const isEnemy = !isSelf && disp < 0;
    const isAlly = isSelf || disp > 0 || Boolean(tActor.hasPlayerOwner);

    let formatted = tDoc.name;
    if (isSelf) {
      formatted = `Self: ${tDoc.name} (Self)`;
    } else if (distInfo?.label) {
      formatted = `${tDoc.name} (${distInfo.label})`;
    }

    candidates.push({
      id: tDoc.id,
      rawName: tDoc.name,
      name: formatted,
      displayName: formatted,
      distance: isSelf ? 0 : (distInfo?.distance ?? null),
      distanceLabel: isSelf ? "Self" : (distInfo?.label ?? null),
      isSelf,
      isEnemy,
      isAlly,
      selected: selectedIds.has(tDoc.id)
    });
  }

  candidates.sort((a, b) => {
    if (a.isSelf && !b.isSelf) return -1;
    if (!a.isSelf && b.isSelf) return 1;
    if (a.distance !== null && b.distance !== null && a.distance !== b.distance) return a.distance - b.distance;
    if (a.distance !== null && b.distance === null) return -1;
    if (a.distance === null && b.distance !== null) return 1;
    return (a.rawName || a.name || "").localeCompare(b.rawName || b.name || "");
  });

  return candidates;
}

/**
 * Helper to test whether a single target string describes multiple targets.
 * Avoids false positives on strings like "any 1 creature" or "any single ally".
 * @param {string} rawTargetStr
 * @returns {boolean}
 */
function isTargetStringMulti(rawTargetStr) {
  const targetStr = String(rawTargetStr ?? "").trim().toLowerCase();
  if (!targetStr) return false;

  // Explicit single-target guard (e.g. "1 creature", "any 1 creature", "any single ally", "1 willing creature or 1 undead creature")
  if (/^(?:any\s+)?(?:1|one|a|an|single)\s+(?:[a-z-]+\s+)*(?:creature|ally|enemy|target|object|corpse)(?:\s+or\s+(?:any\s+)?(?:1|one|a|an|single)\s+(?:[a-z-]+\s+)*(?:creature|ally|enemy|target|object|corpse))?$/i.test(targetStr)) {
    return false;
  }

  // Multi-target quantifiers (uses "any number" instead of bare "any" so "any 1 creature" is never matched)
  if (/\b([2-9]|\d{2,}|two|three|four|five|six|seven|eight|nine|ten|multiple|several|all|any\s+number|up\s+to|or\s+more)\b/i.test(targetStr)) {
    return true;
  }

  // Plural target nouns when not preceded by a single-target quantifier
  if (/\b(creatures|enemies|allies|targets|objects)\b/i.test(targetStr)) {
    return true;
  }

  return false;
}

/**
 * Determines whether a PF2e spell (or heightened/overlay variant at `castRank`) is an Area of Effect (AoE)
 * or multi-target spell that should allow selecting multiple targets simultaneously.
 * @param {Item} spell
 * @param {number} [castRank]
 * @returns {boolean}
 */
export function isMultiTargetOrAreaSpell(spell, castRank) {
  if (!spell) return false;

  const effectiveRank = (typeof castRank === "number" && !Number.isNaN(castRank) && castRank > 0)
    ? castRank
    : (spell.rank ?? spell.system?.location?.heightenedLevel ?? spell.system?.level?.value ?? 1);

  // If spell supports loadVariant, inspect the heightened variant at effectiveRank as well
  let variant = spell;
  if (typeof spell.loadVariant === "function" && effectiveRank > 0) {
    try {
      variant = spell.loadVariant({ castRank: effectiveRank }) ?? spell;
    } catch {
      variant = spell;
    }
  }

  const docsToCheck = variant && variant !== spell ? [variant, spell] : [spell];

  for (const doc of docsToCheck) {
    const sys = doc.system ?? {};

    // 1. Explicit area of effect (burst, cone, emanation, line, cube, cylinder)
    if (doc.area?.value || doc.area?.type || sys.area?.value || sys.area?.type) {
      return true;
    }

    // 2. Inline @Template in description
    const desc = String(sys.description?.value ?? "");
    if (desc.includes("@Template[")) {
      return true;
    }

    // 3. Target text specifying multiple creatures/targets
    if (isTargetStringMulti(sys.target?.value)) {
      return true;
    }

    // 4. Heightened fixed-level overrides (e.g. Rank 6 Slow, Rank 7 Haste, Rank 4 Invisibility)
    const heightenLevels = sys.heightening?.levels;
    if (heightenLevels && typeof heightenLevels === "object") {
      for (const [lvlKey, lvlData] of Object.entries(heightenLevels)) {
        const reqRank = parseInt(lvlKey, 10);
        if (!Number.isNaN(reqRank) && reqRank <= effectiveRank && lvlData) {
          if (lvlData.area?.value || lvlData.area?.type) return true;
          if (isTargetStringMulti(lvlData.target?.value)) return true;
        }
      }
    }
  }

  return false;
}

/**
 * Formats a concise subtitle describing a spell's area, range, or target specification.
 * @param {Item} spell
 * @returns {string}
 */
export function formatSpellTargetSummary(spell) {
  if (!spell) return "";
  const sys = spell.system ?? {};
  const parts = [];
  const areaType = spell.area?.type || sys.area?.type;
  const areaVal = spell.area?.value || sys.area?.value;
  if (areaVal && areaType) {
    parts.push(`Area: ${areaVal}-ft ${areaType}`);
  } else if (areaType) {
    parts.push(`Area: ${areaType}`);
  }
  if (sys.target?.value) {
    parts.push(`Targets: ${sys.target.value}`);
  }
  if (sys.range?.value) {
    parts.push(`Range: ${sys.range.value}`);
  }
  return parts.join(" • ");
}

/**
 * Resolves the target token(s) for an action or spell.
 * - If `allowMulti` is false (default) and `currentTargets.length === 1` (and valid for `includeSelf`), fast-paths to that 1 target.
 * - If `allowMulti` is false and `currentTargets.length > 1`, prompts the user via `promptTargetSelection` to narrow down to 1 target.
 * - If `allowMulti` is true and `currentTargets.length >= 1` (and valid for `includeSelf`), fast-paths or opens the multi-target picker when 0 targets are selected.
 * @param {object} sheet - Application instance
 * @param {string} actionLabel
 * @param {object} [options={}]
 * @param {boolean} [options.includeSelf=true]
 * @param {boolean} [options.allowMulti=false]
 * @param {string} [options.subtitle=""]
 * @returns {Promise<object|Array<object>|null|false>}
 */
export async function resolveTargetForAction(sheet, actionLabel, options = {}) {
  const includeSelf = options.includeSelf ?? true;
  const allowMulti = options.allowMulti ?? false;
  const currentTargets = Array.from(game.user?.targets ?? []).filter(t => t.id);

  // If exactly 1 target, or if multi-target is allowed and >1 targets are selected, fast-path it
  if (currentTargets.length === 1 || (allowMulti && currentTargets.length > 1)) {
    const resolvedTokens = currentTargets.map(t => getTargetableToken(t.id) ?? t).filter(Boolean);
    const primary = resolvedTokens[0];
    if (primary) {
      const hasDisallowedSelf = !includeSelf && resolvedTokens.some(t => (t.actor?.id ?? t.document?.actorId) === sheet?.actor?.id);
      if (!hasDisallowedSelf) {
        return allowMulti ? resolvedTokens : primary;
      }
    }
  }

  // If 0 targets, self-targeted inappropriately, OR multiple targets on a single-target action:
  return promptTargetSelection(sheet, actionLabel, {
    includeSelf,
    allowMulti,
    subtitle: options.subtitle
  });
}

/**
 * Resolves target(s) for a spell cast or spell damage roll, evaluating heightened rank variants.
 * @param {object} sheet
 * @param {Item} spell
 * @param {string} actionLabel
 * @param {object} [options={}]
 * @param {number} [options.castRank]
 * @returns {Promise<object|null|false>} Resolves to primary target token (or null if none), or false if cancelled.
 */
export async function resolveTargetsForSpell(sheet, spell, actionLabel, options = {}) {
  const allowMulti = isMultiTargetOrAreaSpell(spell, options.castRank);
  const subtitle = formatSpellTargetSummary(spell);
  const res = await resolveTargetForAction(sheet, actionLabel, {
    includeSelf: true,
    allowMulti,
    subtitle
  });
  if (res === false) return false;
  if (Array.isArray(res)) return res[0] ?? null;
  return res ?? null;
}

/**
 * Prompts the user to select a target (or multiple targets when `options.allowMulti` is true) before executing an action.
 * When `allowMulti` is false and multiple tokens were previously targeted, prompts the user to select a single target
 * and automatically unselects the other targets.
 * @param {object} sheet - Application instance
 * @param {string} actionLabel
 * @param {object} [options={}]
 * @param {boolean} [options.includeSelf=true]
 * @param {boolean} [options.allowMulti=false]
 * @param {string} [options.subtitle=""]
 * @returns {Promise<object|Array<object>|null|false>}
 */
export async function promptTargetSelection(sheet, actionLabel, options = {}) {
  const includeSelf = options.includeSelf ?? true;
  const allowMulti = options.allowMulti ?? false;
  if (allowMulti) {
    return promptMultiTargetSelection(sheet, actionLabel, {
      includeSelf,
      subtitle: options.subtitle ?? ""
    });
  }

  const availableTokens = collectSceneCandidateTokens(sheet.actor, { includeSelf });

  // If there are no candidate tokens on the scene, proceed without target
  if (availableTokens.length === 0) return null;

  const currentTargetsCount = Array.from(game.user?.targets ?? []).filter(t => t.id).length;
  const multiWarningHtml = currentTargetsCount > 1
    ? `<p style="margin: 0 0 8px 0; padding: 5px 8px; border-radius: 5px; background: rgba(245, 158, 11, 0.16); border: 1px solid rgba(245, 158, 11, 0.4); font-size: 0.82rem; color: #fcd34d;">⚠️ ${currentTargetsCount} targets currently selected. Choose 1 target for this single-target action:</p>`
    : "";

  return new Promise(resolve => {
    const { DialogV2 } = foundry.applications.api;
    const firstSelectedIdx = availableTokens.findIndex(t => t.selected);
    const optionsHtml = availableTokens
      .map((t, idx) => `<option value="${t.id}" ${idx === firstSelectedIdx ? "selected" : ""}>${t.displayName}</option>`)
      .join("");

    const content = `
      <div style="padding: 10px; text-align: center;">
        <p style="margin-bottom: 8px; font-size: 1.05rem;"><strong>Target for ${actionLabel}</strong></p>
        ${multiWarningHtml}
        <label for="action-target-select" style="display:block; margin-bottom: 6px; font-size: 0.9rem; color: #bbb;">Select Target Token:</label>
        <select id="action-target-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 48px; font-size: 16px; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          <option value="">-- No Target --</option>
          ${optionsHtml}
        </select>
      </div>
    `;

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `Target: ${actionLabel}` },
        content,
        ok: {
          label: "Confirm & Roll",
          callback: async (event, button, dialog) => {
            const select = dialog.element.querySelector("#action-target-select");
            const selectedTokenId = select?.value ?? "";
            await setTargetToken(selectedTokenId);
            sheet.render({ parts: ["header"] });
            const targetToken = selectedTokenId ? getTargetableToken(selectedTokenId) : null;
            resolve(targetToken);
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) resolve(false);
      });
    } else {
      const currentTargetId = availableTokens.find(t => t.selected)?.id ?? "";
      const chosen = window.prompt(`Select Target Token ID for ${actionLabel} (leave empty for none):`, currentTargetId);
      if (chosen !== null) {
        setTargetToken(chosen);
        sheet.render({ parts: ["header"] });
        resolve(chosen ? getTargetableToken(chosen) : null);
      } else {
        resolve(false);
      }
    }
  });
}

/**
 * Prompts the user with a touch-friendly multi-target checklist for Area of Effect (AoE)
 * and multi-target spells, or when selecting multiple targets from the header.
 * @param {object} sheet - Application instance
 * @param {string} actionLabel
 * @param {object} [options={}]
 * @param {string} [options.subtitle=""]
 * @param {boolean} [options.includeSelf=true]
 * @returns {Promise<Array<object>|false>} Array of targeted token adapters (may be empty), or false if cancelled.
 */
export async function promptMultiTargetSelection(sheet, actionLabel, options = {}) {
  const includeSelf = options.includeSelf ?? true;
  const subtitle = options.subtitle ?? "";
  const availableTokens = collectSceneCandidateTokens(sheet.actor, { includeSelf });

  if (availableTokens.length === 0) return [];

  return new Promise(resolve => {
    let isResolved = false;
    const finish = (val) => {
      if (!isResolved) {
        isResolved = true;
        resolve(val);
      }
    };

    const { DialogV2 } = foundry.applications.api;

    const rowsHtml = availableTokens.map(t => {
      const badgeText = t.isSelf ? "Self" : (t.isEnemy ? "Enemy" : "Ally");
      const badgeBg = t.isSelf
        ? "rgba(59, 130, 246, 0.25); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.5);"
        : (t.isEnemy
          ? "rgba(239, 68, 68, 0.22); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.45);"
          : "rgba(34, 197, 94, 0.22); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.45);");
      const distBadge = t.distanceLabel ? `<span style="font-size: 0.82rem; color: #aaa;">${t.distanceLabel}</span>` : "";

      return `
        <label class="multi-target-row" data-token-id="${t.id}" data-is-enemy="${t.isEnemy ? "1" : "0"}" data-is-self="${t.isSelf ? "1" : "0"}"
          style="display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 6px 10px; margin-bottom: 5px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid #3a3a42; cursor: pointer; user-select: none;">
          <span style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
            <input type="checkbox" class="multi-target-checkbox" value="${t.id}" ${t.selected ? "checked" : ""}
              style="width: 20px; height: 20px; accent-color: #e65100; cursor: pointer; flex-shrink: 0;" />
            <span style="font-size: 0.95rem; font-weight: 600; color: #f4f4f5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.rawName}</span>
          </span>
          <span style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: 8px;">
            ${distBadge}
            <span style="font-size: 0.72rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; ${badgeBg}">${badgeText}</span>
          </span>
        </label>
      `;
    }).join("");

    const subtitleHtml = subtitle
      ? `<p style="margin: 0 0 8px 0; font-size: 0.82rem; color: #a1a1aa;">${subtitle}</p>`
      : "";

    const content = `
      <div class="mobile-multi-target-dialog" style="padding: 6px 2px;">
        <p style="margin: 0 0 4px 0; font-size: 1rem; font-weight: 700; color: #fff;">Select Targets: ${actionLabel}</p>
        ${subtitleHtml}
        <div style="display: flex; gap: 6px; margin-bottom: 8px;">
          <button type="button" class="multi-target-quick-btn" data-quick="enemies"
            style="flex: 1; min-height: 38px; padding: 4px 8px; font-size: 0.8rem; font-weight: 600; border-radius: 5px; background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); cursor: pointer;">
            🎯 Enemies
          </button>
          <button type="button" class="multi-target-quick-btn" data-quick="self"
            style="flex: 1; min-height: 38px; padding: 4px 8px; font-size: 0.8rem; font-weight: 600; border-radius: 5px; background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4); cursor: pointer;">
            👤 +Self
          </button>
          <button type="button" class="multi-target-quick-btn" data-quick="clear"
            style="flex: 1; min-height: 38px; padding: 4px 8px; font-size: 0.8rem; font-weight: 600; border-radius: 5px; background: rgba(255, 255, 255, 0.08); color: #d4d4d8; border: 1px solid #444; cursor: pointer;">
            ✖ Clear
          </button>
        </div>
        <div class="multi-target-list" style="max-height: 280px; overflow-y: auto; padding-right: 2px;">
          ${rowsHtml}
        </div>
      </div>
    `;

    const bindQuickButtons = (root) => {
      if (!root) return;
      const checkboxes = Array.from(root.querySelectorAll(".multi-target-checkbox"));
      root.querySelectorAll(".multi-target-quick-btn").forEach(btn => {
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const mode = btn.dataset.quick;
          for (const cb of checkboxes) {
            const row = cb.closest(".multi-target-row");
            if (mode === "clear") {
              cb.checked = false;
            } else if (mode === "enemies") {
              cb.checked = row?.dataset.isEnemy === "1";
            } else if (mode === "self" && row?.dataset.isSelf === "1") {
              cb.checked = true;
            }
          }
        });
      });
    };

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `Targets: ${actionLabel}` },
        content,
        render: (event, dialog) => {
          bindQuickButtons(dialog.element);
        },
        ok: {
          label: "Confirm Targets",
          callback: async (event, button, dialog) => {
            const checkedIds = Array.from(dialog.element.querySelectorAll(".multi-target-checkbox:checked"))
              .map(cb => cb.value)
              .filter(Boolean);
            await setTargetTokens(checkedIds);
            sheet.render({ parts: ["header"] });
            const resolvedTokens = checkedIds.map(id => getTargetableToken(id)).filter(Boolean);
            finish(resolvedTokens);
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) finish(false);
      });
    } else {
      finish([]);
    }
  });
}

/**
 * Prompts user to select an action variant when multiple variants exist.
 * @param {object} sheet - Application instance
 * @param {string} actionLabel
 * @param {Array<{slug: string, name: string, glyph?: string, cost?: number}>} variants
 * @returns {Promise<string|false>} Selected variant slug, or false if cancelled.
 */
export async function promptVariantSelection(sheet, actionLabel, variants) {
  if (!variants || variants.length === 0) return null;
  if (variants.length === 1) return variants[0].slug;

  return new Promise(resolve => {
    const { DialogV2 } = foundry.applications.api;
    const optionsHtml = variants
      .map((v, i) => {
        const rawName = v.name || v.label || v.slug;
        const name = typeof rawName === "string" ? game.i18n.localize(rawName) : String(rawName?.name ?? rawName?.label ?? v.slug);
        const glyph = v.glyph ? ` [${v.glyph}]` : "";
        return `<option value="${v.slug}" ${i === 0 ? "selected" : ""}>${name}${glyph}</option>`;
      })
      .join("");

    const content = `
      <div style="padding: 10px; text-align: center;">
        <p style="margin-bottom: 10px; font-size: 1.05rem;"><strong>${actionLabel}</strong></p>
        <label for="action-variant-select" style="display:block; margin-bottom: 6px; font-size: 0.9rem; color: #bbb;">Select Action Variant:</label>
        <select id="action-variant-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 48px; font-size: 16px; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          ${optionsHtml}
        </select>
      </div>
    `;

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `${actionLabel} - Select Variant` },
        content,
        ok: {
          label: "Proceed",
          callback: (event, button, dialog) => {
            const select = dialog.element.querySelector("#action-variant-select");
            resolve(select?.value ?? variants[0].slug);
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) resolve(false);
      });
    } else {
      resolve(variants[0].slug);
    }
  });
}

/**
 * Prompts user to select a statistic/skill when an action supports multiple statistics (e.g. Recall Knowledge).
 * @param {object} sheet - Application instance
 * @param {string} actionLabel
 * @param {Array<string>} statistics
 * @returns {Promise<string|false>} Selected statistic slug, or false if cancelled.
 */
export async function promptStatisticSelection(sheet, actionLabel, statistics) {
  if (!statistics || statistics.length === 0) return null;
  if (statistics.length === 1) return statistics[0];

  return new Promise(resolve => {
    const { DialogV2 } = foundry.applications.api;
    const optionsHtml = statistics
      .map((statKey, i) => {
        const stat = sheet.actor.getStatistic?.(statKey) ?? sheet.actor.skills?.[statKey];
        const mod = stat?.totalModifier ?? stat?.mod ?? stat?.check?.mod;
        const sign = typeof mod === "number" ? (mod >= 0 ? `+${mod}` : `${mod}`) : "";
        const skillConfig = CONFIG.PF2E?.skills?.[statKey];
        const rawLabel = stat?.label ?? (typeof skillConfig === "object" ? skillConfig?.label : skillConfig) ?? statKey;
        const label = typeof rawLabel === "string" ? game.i18n.localize(rawLabel) : String(rawLabel);
        return `<option value="${statKey}" ${i === 0 ? "selected" : ""}>${label} (${sign})</option>`;
      })
      .join("");

    const content = `
      <div style="padding: 10px; text-align: center;">
        <p style="margin-bottom: 10px; font-size: 1.05rem;"><strong>${actionLabel}</strong></p>
        <label for="action-stat-select" style="display:block; margin-bottom: 6px; font-size: 0.9rem; color: #bbb;">Select Skill to Check:</label>
        <select id="action-stat-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 48px; font-size: 16px; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          ${optionsHtml}
        </select>
      </div>
    `;

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `${actionLabel} - Select Skill` },
        content,
        ok: {
          label: "Roll Check",
          callback: (event, button, dialog) => {
            const select = dialog.element.querySelector("#action-stat-select");
            resolve(select?.value ?? statistics[0]);
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) resolve(false);
      });
    } else {
      resolve(statistics[0]);
    }
  });
}

/**
 * Prompts user to select a weapon strike when executing an attack feat (e.g. Combat Grab, Power Attack).
 * @param {object} sheet - Application instance
 * @param {string} actionLabel
 * @param {Array<object>} strikes
 * @returns {Promise<object|false>} Selected strike object, or false if cancelled.
 */
export async function promptStrikeSelection(sheet, actionLabel, strikes) {
  if (!strikes || strikes.length === 0) return null;
  if (strikes.length === 1) return strikes[0];

  return new Promise(resolve => {
    const { DialogV2 } = foundry.applications.api;
    const optionsHtml = strikes
      .map((s, i) => {
        const mod = s.totalModifier ?? s.variants?.[0]?.totalModifier;
        const sign = typeof mod === "number" ? (mod >= 0 ? `+${mod}` : `${mod}`) : "";
        return `<option value="${i}" ${i === 0 ? "selected" : ""}>${s.label} (${sign})</option>`;
      })
      .join("");

    const content = `
      <div style="padding: 10px; text-align: center;">
        <p style="margin-bottom: 10px; font-size: 1.05rem;"><strong>${actionLabel}</strong></p>
        <label for="action-strike-select" style="display:block; margin-bottom: 6px; font-size: 0.9rem; color: #bbb;">Select Weapon Strike to Attack With:</label>
        <select id="action-strike-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 48px; font-size: 16px; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          ${optionsHtml}
        </select>
      </div>
    `;

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `${actionLabel} - Select Strike` },
        content,
        ok: {
          label: "Roll Attack",
          callback: (event, button, dialog) => {
            const select = dialog.element.querySelector("#action-strike-select");
            const idx = parseInt(select?.value ?? "0", 10);
            resolve(strikes[idx] ?? strikes[0]);
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) resolve(false);
      });
    } else {
      resolve(strikes[0]);
    }
  });
}

/**
 * Prompts user to select whether to consume an item on self or administer it to an ally on the scene.
 * @param {object} sheet - Application instance
 * @param {Item} item - Consumable item
 * @returns {Promise<{mode: "self"|"ally", targetToken?: object, targetId?: string}|false>}
 */
export async function promptConsumableUsage(sheet, item) {
  const candidates = collectSceneCandidateTokens(sheet.actor, { includeSelf: false })
    .filter(c => c.isAlly);

  return new Promise(resolve => {
    const { DialogV2 } = foundry.applications.api;

    const comradeOptions = candidates.map(c =>
      `<option value="${c.id}" ${c.selected ? "selected" : ""}>Comrade: ${c.displayName}</option>`
    ).join("");

    const content = `
      <div style="padding: 10px; text-align: center;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px;">
          <img src="${item.img}" alt="${item.name}" width="36" height="36" style="border: 1px solid #444; border-radius: 4px;" />
          <span style="font-size: 1.1rem; font-weight: bold;">${item.name}</span>
        </div>
        <p style="margin-bottom: 12px; font-size: 0.9rem; color: #bbb;">Choose who receives this consumable:</p>
        <label for="consumable-recipient-select" style="display:block; margin-bottom: 6px; font-size: 0.85rem; color: #888;">Recipient:</label>
        <select id="consumable-recipient-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 48px; font-size: 16px; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          <option value="self">Self (${sheet.actor.name})</option>
          ${comradeOptions}
        </select>
      </div>
    `;

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `Use Consumable: ${item.name}` },
        content,
        ok: {
          label: "Use / Administer",
          callback: (event, button, dialog) => {
            const select = dialog.element.querySelector("#consumable-recipient-select");
            const val = select?.value ?? "self";
            if (val === "self") {
              resolve({ mode: "self" });
            } else {
              const targetToken = getTargetableToken(val) ?? canvas?.tokens?.get(val) ?? null;
              resolve({ mode: "ally", targetToken, targetId: val });
            }
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) resolve(false);
      });
    } else {
      resolve({ mode: "self" });
    }
  });
}

/**
 * Prompts user to select a weapon to apply a poison or oil onto.
 * @param {object} sheet - Application instance
 * @param {Item} consumable - Poison or oil item
 * @param {Array<Item>} weapons - Available weapons
 * @returns {Promise<Item|false>} Selected weapon item, or false if cancelled.
 */
export async function promptWeaponSelectionForAttachment(sheet, consumable, weapons) {
  if (!weapons || weapons.length === 0) {
    ui.notifications?.warn("No weapons available to apply poison to.");
    return false;
  }

  return new Promise(resolve => {
    const { DialogV2 } = foundry.applications.api;

    const weaponOptions = weapons.map(w => {
      const hasPoison = (w.subitems?.contents ?? []).some(s => s.category === "poison" || s.system?.traits?.value?.includes("injury"));
      const poisonSuffix = hasPoison ? " (Already Poisoned)" : "";
      return `<option value="${w.id}">${w.name}${poisonSuffix}</option>`;
    }).join("");

    const content = `
      <div style="padding: 10px; text-align: center;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px;">
          <img src="${consumable.img}" alt="${consumable.name}" width="36" height="36" style="border: 1px solid #444; border-radius: 4px;" />
          <span style="font-size: 1.1rem; font-weight: bold;">${consumable.name}</span>
        </div>
        <p style="margin-bottom: 12px; font-size: 0.9rem; color: #bbb;">Select weapon to apply this poison or oil to (1 Interact Action):</p>
        <label for="weapon-attach-select" style="display:block; margin-bottom: 6px; font-size: 0.85rem; color: #888;">Weapon:</label>
        <select id="weapon-attach-select" onclick="event.stopPropagation()" style="width: 100%; min-height: 48px; font-size: 16px; border-radius: 6px; padding: 8px; background: #222; color: #fff; border: 1px solid #444; touch-action: manipulation;">
          ${weaponOptions}
        </select>
      </div>
    `;

    if (DialogV2) {
      DialogV2.prompt({
        window: { title: `Apply ${consumable.name}` },
        content,
        ok: {
          label: "Apply to Weapon",
          callback: (event, button, dialog) => {
            const select = dialog.element.querySelector("#weapon-attach-select");
            const weaponId = select?.value;
            const chosen = weapons.find(w => w.id === weaponId) ?? weapons[0];
            resolve(chosen);
          }
        },
        rejectClose: false
      }).then(res => {
        if (res === null) resolve(false);
      });
    } else {
      resolve(weapons[0]);
    }
  });
}

export async function promptSpontaneousSlotSelection(sheet, spellName, minRank, eligibleSlots) {
  if (!Array.isArray(eligibleSlots) || eligibleSlots.length === 0) return null;

  return new Promise((resolve) => {
    let isResolved = false;
    const finish = (val) => {
      if (!isResolved) {
        isResolved = true;
        resolve(val);
      }
    };

    const DialogV2 = foundry.applications?.api?.DialogV2;

    const buttonsHtml = eligibleSlots.map((slot, idx) => `
      <button type="button" class="spont-slot-choice-btn" data-slot-idx="${idx}"
        style="width: 100%; min-height: 44px; margin-bottom: 6px; padding: 8px 12px; font-size: 0.95rem; font-weight: 600; border-radius: 6px; background: rgba(120, 80, 220, 0.22); color: #e8ddff; border: 1px solid rgba(155, 115, 255, 0.5); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
        <span><i class="fas fa-wand-magic-sparkles"></i> Rank ${slot.rank} — ${slot.entryName}</span>
        <span style="font-size: 0.85rem; color: #c4b0f5;">${slot.available} / ${slot.max} left</span>
      </button>
    `).join("");

    const content = `
      <div class="mobile-spont-slot-prompt" style="padding: 6px 2px;">
        <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #ccc;">
          Select a <strong>Rank ${minRank}+</strong> spontaneous spell slot to expend alongside <strong>1 Staff Charge</strong> for <strong>${spellName}</strong>:
        </p>
        <div class="spont-slot-choices" style="display: flex; flex-direction: column;">
          ${buttonsHtml}
        </div>
      </div>
    `;

    if (DialogV2) {
      let dialogInstance = null;
      dialogInstance = new DialogV2({
        window: { title: `1 Chg + Slot: ${spellName}` },
        content,
        buttons: [
          {
            action: "cancel",
            label: "Cancel",
            icon: "fas fa-times",
            callback: () => finish(null)
          }
        ],
        render: (event, dialog) => {
          const root = dialog.element;
          root.querySelectorAll(".spont-slot-choice-btn").forEach(btn => {
            btn.addEventListener("click", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const idx = parseInt(btn.dataset.slotIdx, 10);
              finish(eligibleSlots[idx] ?? null);
              dialogInstance?.close();
            });
          });
        },
        close: () => finish(null)
      });
      dialogInstance.render(true);
    } else {
      let d = null;
      d = new Dialog({
        title: `1 Chg + Slot: ${spellName}`,
        content,
        buttons: {
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => finish(null)
          }
        },
        render: (html) => {
          const root = html instanceof HTMLElement ? html : html[0];
          root?.querySelectorAll(".spont-slot-choice-btn").forEach(btn => {
            btn.addEventListener("click", (ev) => {
              ev.preventDefault();
              const idx = parseInt(btn.dataset.slotIdx, 10);
              finish(eligibleSlots[idx] ?? null);
              d?.close();
            });
          });
        },
        close: () => finish(null)
      });
      d.render(true);
    }
  });
}

export { promptRuneConfiguration, scanInventoryRunes } from "./rune-handlers.js";
