# Issue: Fix Gear Section Filtering, Implement Consumable Administration to Comrades & Weapon Poisoning

**Type**: Bug Fix & Feature Enhancement  
**Status**: Proposed / Under Review  
**Milestone**: Inventory & Gear Overhaul  

---

## 1. Summary & Problem Statement

The Gear section of the PF2e Mobile Compact Sheet currently exhibits two major deficiencies:

1. **Non-Gear Items Cluttering Inventory (Bug)**:
   In `scripts/apps/sheet-helpers/context-inventory.js`, items were filtered with a negative blacklist:
   ```javascript
   gear: items.filter(i => !["weapon", "armor", "shield", "consumable", "spell", "feat", "effect"].includes(i.type))
   ```
   Because Pathfinder 2e Actor documents store numerous non-physical item types (`action`, `ancestry`, `background`, `class`, `condition`, `affliction`, `deity`, `heritage`, `lore`, `melee`, `spellcastingEntry`, `campaignFeature`), all non-physical character options are erroneously dumped into the "Other Gear" list.

2. **Lack of Native PF2e Consumable & Poison Workflows (Missing Features)**:
   - **Consumable Administration**: Consumables only have a simple `item.consume()` call. Players cannot choose to administer a potion or elixir to an ally/comrade on the scene.
   - **Poison Application**: Players cannot apply injury poisons or oils to their carried weapons or ammunition using PF2e's native subitem attachment engine (`weapon.attach()`).

---

## 2. Technical Design & Architecture

### 2.1. Strict Physical Item Categorization
All inventory queries must leverage PF2e's official physical item predicate:
```javascript
const physicalItems = actor.items.filter(i => typeof i.isOfType === "function" ? i.isOfType("physical") : false);
```
Categorization will be cleanly split into:
- **Consumables**: `item.isOfType("consumable")` (potions, elixirs, poisons, oils, scrolls, wands, talismans)
- **Weapons**: `item.isOfType("weapon")` (with equipped state, hands held, attached subitems)
- **Armor & Shields**: `item.isOfType("armor", "shield")` (with equipped/invested state, shield HP)
- **Other Gear**: `item.isOfType("equipment", "backpack", "book", "treasure", "ammo")` (purely physical gear)

### 2.2. Consumable Usage & Administration on Comrades
- **Workflow**:
  1. Tapping **"Use"** on a potion, elixir, or drug opens a touch modal with two primary choices:
     - **Drink / Use on Self** (1 Action - Interact)
     - **Administer to Comrade** (1 Action - Interact)
  2. If "Administer to Comrade" is selected:
     - Displays candidate scene comrades (player-owned or friendly tokens on the active scene).
     - Upon selection, synchronizes the Foundry user target to the ally token (`setTargetToken`).
     - Executes `await item.consume()`.
     - Creates a Paizo-styled chat card indicating: `"[Actor] administers [Item] to [Comrade]"`.
     - For healing potions/elixirs, the resulting `DamageRoll` allows 1-click healing application directly to the designated comrade token.

### 2.3. Weapon Poisoning via Native PF2e Subitems
- **Workflow**:
  1. Any consumable with `category === "poison"` or trait `injury`/`contact`/`oil` features an **"Apply to Weapon"** action button.
  2. Tapping this button opens a modal listing all weapons carried or held by the actor.
  3. Upon weapon selection:
     - Executes PF2e's native attachment method:
       ```javascript
       await weapon.attach(poisonItem, { quantity: 1 });
       ```
     - Deducts 1 poison from inventory and embeds it inside `weapon.system.subitems`.
     - Posts chat card: `"[Actor] applies [Poison Name] to [Weapon Name] (1 Action - Interact)"`.
  4. **Weapon Card & Strike Display**:
     - The weapon card displays a green badge: `Poisoned: [Poison Name]`.
     - Provides a **Detach / Clean** button calling native `await subitem.detach()`.
     - Striking with this weapon highlights the loaded poison for easy Fortitude save roll triggers.

---

## 3. Modular Code Structure & AGENTS.md Compliance

To adhere to the architectural rules in `AGENTS.md` (< 700 lines for `mobile-sheet.js`, < 500 lines for helpers):

1. **Extract Dedicated Handler**:
   Create `scripts/apps/sheet-helpers/inventory-handlers.js` to manage all gear interactions (`onUseConsumable`, `onApplyPoison`, `onDetachSubitem`, `onChangeCarryType`).
2. **Lean Context Builder**:
   Refactor `scripts/apps/sheet-helpers/context-inventory.js` to enrich physical items without mutating underlying actor documents.
3. **Interactive Prompts**:
   Add `promptConsumableUsage` and `promptWeaponSelectionForAttachment` to `scripts/apps/sheet-helpers/sheet-prompts.js`.

---

## 4. Acceptance Criteria & Verification

- [ ] "Other Gear" contains only physical items; no feats, classes, ancestries, conditions, or actions appear.
- [ ] Potions and elixirs can be used on self or administered to an ally token on the scene.
- [ ] Administering to an ally correctly sets the target, emits proper chat flavor, and deducts item usage.
- [ ] Injury poisons can be applied to weapons using PF2e's native `weapon.attach()` method.
- [ ] Weapons with applied poisons show a poison badge and allow detaching/cleaning the poison.
- [ ] All static verifications pass (`node scripts/verify.mjs` with 0 errors).

