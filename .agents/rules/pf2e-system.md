# Pathfinder 2e (PF2e) System Rules

Guidelines for integrating with the Foundry VTT `pf2e` system:

## System Calculations & Integrity
- **Do not duplicate PF2e game math**: Never manually calculate modifiers, Multiple Attack Penalty (MAP), Degree of Success (critical success, success, failure, critical failure), or Immunities/Weaknesses/Resistances (IWR).
- Always use native system methods:
  - Checks & Saves: `actor.system.attributes.<attr>.roll(options)` or `actor.skills.<skill>.roll(options)`
  - Strikes: `actor.system.actions[i].variants[v].roll(options)` or `actor.system.actions[i].damage(options)`
  - Spellcasting: `spell.toMessage(event)` or system spell roll hooks.
  - Chat card damage buttons: trigger native damage application via `game.pf2e.actions` or PF2e chat card button handlers.

## Physical Dice Interception
- When intercepting rolls in physical dice mode (`PhysicalDiceManager`):
  - Intercept raw dice terms in `Roll.prototype.evaluate` or PF2e's `CheckRoll` / `DamageRoll`.
  - Collect physical table results from user input.
  - Partition totals across dice terms to keep the Foundry `Roll` instance valid and evaluated.
  - Let PF2e evaluate the total against DCs and render official chat cards.
  - Handle dialog cancellation gracefully without emitting empty chat cards.

## Target & Token Resolution Fallbacks
- On mobile devices, canvas interaction may be disabled or no token may be actively targeted or controlled.
- Always provide fallbacks to the active character's synthetic token document when checking ranges, targets, or applying damage.

