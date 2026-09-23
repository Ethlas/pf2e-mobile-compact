# Issue: Separate Item-Granted Spells into Dedicated Activations Tab, Implement PF2e Staff Engine & Dailies Integration

**Type**: Feature Enhancement & UX Architecture  
**Status**: Proposed / Under Review  
**Milestone**: Spells & Activations Overhaul  

---

## 1. Summary & Problem Statement

Currently, the PF2e Mobile Compact Sheet presents all spellcasting entries in a single list or rank accordion inside the **Spells** tab. This architecture creates several critical UX and rules compliance issues:

1. **Item Spells Cluttering Class Spellbook**:
   Spells originating from magical items—such as staves (e.g. *Staff of Air*), wands (*Wand of Heal*), scrolls, and activated items (e.g. relics, talismans)—are grouped indiscriminately with class spells, innate spells, and focus spells. A spellcaster with a staff and multiple scrolls finds their daily spell list overwhelmed by consumable or device-granted spells.

2. **Lack of Native PF2e Staff Charge Tracking & Rules Logic**:
   In Pathfinder 2e Remaster and Legacy rules, staves do not have individual spell slots:
   - A staff holds a pool of daily charges (defaulting to the wielder's highest spell rank).
   - Cantrips cast from a staff cost **0 charges**.
   - Spells of Rank 1+ cast from a staff cost **charges equal to the spell's rank** (e.g., Rank 3 costs 3 charges).
   - **Spontaneous Caster Rule**: A spontaneous spellcaster can expend **1 charge** from the staff **plus one spell slot** of that spell's rank from their own spontaneous spellcasting entry to cast the spell, even if the staff lacks enough charges to cast it directly.
   - Currently, the mobile sheet lacks a dedicated staff charge pool counter, cannot distinguish charge-based casting from regular slots, and does not provide spontaneous slot substitution.

3. **Missing Integration with the `pf2e-dailies` Module**:
   The `pf2e-dailies` module is the community standard in Pathfinder 2e for preparing daily items, staves, familiar abilities, and flexible preparations. While it exposes an API (`game.dailies.api`), the mobile sheet has no button or mechanism to open daily preparations without navigating back to desktop Foundry menus.

4. **Missing "Activations" Sub-Tab**:
   While the Spells tab supports a sub-navigation toggle between "Spells" and "Preparation", it lacks an **"Activations"** sub-tab where item-based spells, staves, wands, and scrolls can be viewed and triggered cleanly.

---

## 2. Technical Design & Architecture

### 2.1. Spellcasting Entry Segregation

Pathfinder 2e categorizes spellcasting entries using `entry.category` and `entry.system.category`:
- **Class / Core Spellcasting**: `prepared`, `spontaneous`, `focus`, `innate`, `ritual`
- **Item-Based Spellcasting**: `items` (scrolls, wands, equipment), `charges` (staves)
- **Consumable / Ephemeral Entries**: `entry.isEphemeral === true`

#### Segregation Rule:
- **Spells Tab (Cast View & Preparation)**:
  Excludes all entries where `entry.category === "items" || entry.category === "charges" || entry.system?.category === "items" || entry.system?.category === "charges" || entry.isEphemeral`.
  Only traditional class, innate, focus, and ritual spellcasting entries appear here.
- **Activations Sub-Tab**:
  Dedicated view for all item-based spellcasting:
  1. **Staves**: Physical staff item + associated charge-based spellcasting entry (`category === "charges"`).
  2. **Wands**: Wand items with daily uses and overcharge risk.
  3. **Scrolls**: Consumable scroll items and ephemeral casting entries.
  4. **Other Item Activations**: Equipment, relics, and items granting activated spells.

---

### 2.2. Dedicated PF2e Staff Engine & Rules Fidelity

The staff engine must strictly enforce PF2e Remaster rules while integrating seamlessly with `pf2e-dailies` (with an autonomous fallback if the module is absent):

1. **Charge Data Resolution**:
   - Check `game.dailies?.api?.getStaffData(actor)`:
     Returns `{ charges: { value, max }, staffId, spellsCount, spells }`.
   - Fallback (pure PF2e): Inspect actor items for `traits.includes("staff")` and spellcasting entries with `category === "charges"`. Store/track charges in actor flag or entry system slots.
2. **Staff Display**:
   - Visual card with staff name, image, and equipped/held status (alerting if not held with sufficient hands).
   - **Charge Meter**: Visual counter (e.g. `Charges: 5 / 5`) with quick `[-]` and `[+]` adjusters (touch target >= 38px).
3. **Casting from a Staff**:
   - **Cantrip**: Costs 0 charges. Can be cast at will.
   - **Charge-based Cast (Rank 1+)**:
     - Check if `charges.value >= spellRank`.
     - Deduct `spellRank` charges via `game.dailies.api.setStaffChargesValue(actor, nextValue)` (or entry update).
     - Call `entry.cast(spell, { rank: spellRank })`.
   - **Spontaneous Spell Slot Cast (1 Charge + Slot)**:
     - Check if actor has spontaneous spellcasting entries with available slots of rank >= `spellRank`.
     - If so, present a touch option:
       - **Option A**: Spend `[Rank]` Staff Charges.
       - **Option B**: Spend `1 Staff Charge + 1 Rank [Rank] Spell Slot`.
     - When Option B is chosen:
       - Deducts 1 charge from the staff.
       - Deducts 1 slot from the designated spontaneous entry (`system.slots[slotKey].value - 1`).
       - Calls `entry.cast(spell, { rank: spellRank, spontaneous: { entryId, slot: slotKey } })`.
     - If `charges.value < spellRank`, Option A is disabled, but Option B remains available if charges >= 1 and an eligible spontaneous slot is open!

---

### 2.3. Sub-Navigation: Spells | Preparation | Activations

In `templates/parts/spells.hbs`, the sub-tab navigation is displayed whenever the character has prepared entries OR activations:
- `<button data-subtab="spells">Spells</button>`
- `<button data-subtab="preparation">Preparation</button>` (rendered if `hasPreparedEntry`)
- `<button data-subtab="activations">Activations</button>` (rendered if `hasActivations`)

Active state is managed in `sheet._spellSubTab` ("spells" | "preparation" | "activations").

---

### 2.4. Dailies Button near Daily Rest Section

In the action bar of the Spells tab:
- Retain the **"Daily Rest"** button (`data-action="resetDailySpells"`).
- Add adjacent **"Dailies"** button (`data-action="openDailies"`):
  - Displays icon `<i class="fas fa-sun"></i> Dailies`.
  - When tapped:
    - If `game.dailies?.api?.openDailiesInterface`: Invokes `await game.dailies.api.openDailiesInterface(sheet.actor)`.
    - If `pf2e-dailies` is not active: Displays an informational notification: `"PF2e Dailies module is not installed or active."`

---

## 3. Modular Architecture & AGENTS.md Compliance

To adhere to file size constraints (`mobile-sheet.js` < 700 lines, domain modules < 500 lines):

1. **Context Builders**:
   - `scripts/apps/sheet-helpers/context-spells.js`: Filter out `category === "items" || category === "charges"`.
   - `scripts/apps/sheet-helpers/context-activations.js` **[NEW]**: Collects and structures staff data, charges, spontaneous slot eligibility, wands, scrolls, and other activations.
2. **Action Handlers**:
   - `scripts/apps/sheet-helpers/activations-handlers.js` **[NEW]**:
     - `onCastStaffSpell`: Validates charges, resolves spontaneous slot choice, executes cast, updates charges.
     - `onAdjustStaffCharges`: Increments/decrements staff charges.
     - `onCastItemSpell`: Casts scroll/wand/item spells with consumable consumption.
     - `onOpenDailies`: Calls `game.dailies.api.openDailiesInterface(actor)`.
3. **Template Decomposition**:
   - Update `templates/parts/spells.hbs` to include subtab switcher and render the activations view.
   - Provide clean, mobile-optimized cards for Staves, Wands, and Scrolls.
4. **Mobile Sheet Orchestrator**:
   - Keep `mobile-sheet.js` strictly lean (< 700 lines) by delegating actions in 1-liner methods to `activations-handlers.js`.

---

## 4. Acceptance Criteria & Verification

- [ ] All item-granted spells (staves, scrolls, wands, equipment) are removed from the primary "Spells" tab.
- [ ] An "Activations" sub-tab appears in the Spells header and renders item activations cleanly.
- [ ] Staves show accurate current / maximum charges with touch-friendly adjusters (>= 38px height).
- [ ] Casting a staff cantrip expends 0 charges.
- [ ] Casting a staff ranked spell expends charges equal to the spell rank.
- [ ] Spontaneous casters can cast staff spells by spending 1 charge + 1 spell slot of that rank.
- [ ] A "Dailies" button appears next to "Daily Rest" and triggers `game.dailies.api.openDailiesInterface(actor)`.
- [ ] All static checks pass (`node scripts/verify.mjs` with 0 errors).
- [ ] `mobile-sheet.js` remains strictly below 700 lines.
- [ ] Valdrin actor on Foundry v14 / PF2e test server is tested live with headless browser test.

