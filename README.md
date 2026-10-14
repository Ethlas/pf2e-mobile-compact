# PF2e Mobile Sheet (Compact)

A mobile-optimized, battery-efficient, data-saving character sheet for **Pathfinder Second Edition (PF2e)** on **Foundry Virtual Tabletop (v14+)**.

Designed specifically for **in-person tabletop play**, this module transforms your smartphone or tablet into a lightning-fast, full-featured digital character sheet without clutter, lag, or battery drain.

---

## Table of Contents

1. [Features & Capabilities](#features--capabilities)
2. [How to Use on Mobile](#how-to-use-on-mobile)
3. [Visual & Functional Tour](#visual--functional-tour)
   - [Header Dashboard & Quick Controls](#1-header-dashboard--quick-controls)
   - [Actions & Combat Tab](#2-actions--combat-tab)
   - [Spells & Magic Staff Tab](#3-spells--magic-staff-tab)
   - [Gear & Inventory Tab](#4-gear--inventory-tab)
   - [Skills Tab](#5-skills-tab)
   - [Character Overview & Feats](#6-character-overview--feats)
   - [Persistent In-Sheet Chat](#7-persistent-in-sheet-chat)
   - [Party Sheet Mode](#8-party-sheet-mode)
   - [Kingmaker Kingdom Mode](#9-kingmaker-kingdom-mode)
   - [Physical Dice Integration](#10-physical-dice-integration)
4. [Battery, Network & Performance Optimizations](#battery-network--performance-optimizations)
5. [Installation & Requirements](#installation--requirements)
6. [Recommended Modules](#recommended-modules)
7. [License & Attribution](#license--attribution)

---

## Features & Capabilities

- 📱 **Mobile-First Touch Architecture**: Large, accessible touch targets (38px–44px minimum) adhering to modern touch standards. Native OS select dropdown pickers for iOS and Android.
- ⚡ **Extreme Battery & Heat Saver**:
  - **WebGL Canvas Suspension**: Option to pause the heavy PixiJS WebGL canvas and ticker while retaining 100% headless token geometry, targeting, and distance measurements. Saves up to 80% battery and prevents phone overheating.
  - **Mobile Audio Suppression**: Automatically suppresses ambient sound and playlist network streaming on mobile devices, saving cellular data and preventing unexpected table audio.
- 🎯 **Headless Token Geometry & Flanking**: Select targets, measure distances in 5-foot increments, and automatically calculate opposite-side and corner-to-corner diagonal flanking even with the map canvas turned off!
- 🛡️ **Full PF2e System Integrity**: Never re-implements PF2e math. All strikes, MAP penalties, spells, DCs, saving throws, and IWR (Immunities, Weaknesses, Resistances) delegate directly to native PF2e system methods and official compendia.
- 🎲 **Physical Dice Integration**: Integrates seamlessly with the `physical-dice` module. Roll real dice on the physical table, type in your raw result via a touch modal or in-chat prompt, and let PF2e determine the official degree of success and render rich chat cards.
- 👑 **Kingmaker Kingdom Sheet**: Full mobile interface for Kingdom management and turn tracking (compatible with `pf2e-kingmaker-tools`).
- 👥 **Party Sheet**: Mobile overview of party health, defenses, exploration activities, and shared stash inventory.
- 🔄 **Keep-Alive & Wake Lock**: Uses the Screen Wake Lock API to prevent phone screen dimming/lockouts during game sessions, and auto-reconnects sockets upon unlocking.

---

## How to Use on Mobile

### 1. Connect from Your Phone
Open your mobile browser (Safari on iOS, Chrome on Android) and navigate to your GM's Foundry server address:
```text
https://your-foundry-server.com/join
```
Log in as your player user.

### 2. Add to Home Screen (Progressive Web App)
For the best fullscreen experience without browser URL bars taking up vertical space:
- **iOS (Safari)**: Tap the **Share** button (box with upward arrow) -> Tap **Add to Home Screen**.
- **Android (Chrome)**: Tap the **Three Dots Menu** (⋮) -> Tap **Add to Home screen** (or **Install App**).
- Launch the sheet from your home screen. The module automatically activates `viewport-fit=cover` to support iPhone notch, Dynamic Island, and Android gesture navigation bars.

### 3. Automatic Mobile Activation
- The module automatically detects mobile viewports and coarse touch pointers.
- You can also configure the activation mode under **Game Settings -> Module Settings -> PF2e Mobile Sheet -> Mobile Activation Mode**:
  - `Automatic` (Default: mobile devices only)
  - `Always` (Force mobile layout even on desktop)
  - `Never` (Disable mobile layout)

### 4. Open Your Character Sheet
- If the GM sets **PF2e Mobile Sheet** as the default character sheet, clicking your character opens it automatically.
- Alternatively, tap the floating orange **d20 Launcher Button** on the canvas to open or bring the mobile sheet into focus.

---

## Visual & Functional Tour

### 1. Header Dashboard & Quick Controls

The persistent header gives you instant visibility and one-tap control over your character's vital statistics:

- **Actor Identity & Switcher**: Easily switch between all characters you own, the Party Sheet, or the Kingdom Sheet without navigating Foundry sidebars.
- **Character Overview (👤)**: Opens a dedicated character summary showing senses (Darkvision, Tremorsense), speeds (Land, Fly, Swim, Burrow), attributes, feats, and active effects/conditions with live duration counters.
- **Targeting Dropdown**:
  - Displays all nearby targetable tokens with distance indicators (e.g., `🎯 15ft Goblin`).
  - Supports multi-target picker for area and heightened spells.
  - Automatically factors in headless flanking for attacks.
- **Settings Cog Menu (⚙️)**:
  - 🗺️ **Canvas Mode Toggle**: Suspend or resume the WebGL canvas renderer on the fly.
  - 🔇 **Audio Mode Toggle**: Mute or unmute streaming audio on your phone.
  - 🎲 **Dice Entry Method**: Switch manual physical dice entry between popup dialog and in-chat prompt.
  - 🖥️ **Desktop View Toggle**: Temporarily switch back to desktop Foundry interface.
  - ⛶ **Fullscreen Toggle**: Maximize your screen.
- **Health & Defenses Bar**:
  - **Quick HP Delta (`±Amt`)**: Type `5` to heal 5 HP, or `-12` to deduct 12 damage instantly.
  - **Direct HP / Temp HP**: Tap to edit current HP or temporary HP directly.
  - **Shield Badge**: Displays current Shield HP and Hardness (`🛡️ 20/20`).
  - **Defenses**: One-tap buttons for Armor Class (AC), Fortitude save, Reflex save, and Will save.
  - **Perception & Initiative**: Dropdown to roll Perception checks or roll Initiative with combat status indicators.

---

### 2. Actions & Combat Tab (🥊)

- **Strikes**:
  - Shows equipped melee and ranged weapons with traits, reach, and damage types.
  - Strike buttons with automatic Multiple Attack Penalty (MAP) calculations (+0, -5, -10, or agile +0, -4, -8).
  - Damage roll buttons with critical damage rolls and versatile/modular damage type selection dialog.
  - Auxiliary action buttons (Draw, Stow, Reload, Raise Shield).
- **Categorized Action Cards**:
  - Filter by Single Actions (1A), Two Actions (2A), Three Actions (3A), Free Actions (0A), Reactions (R), and Activities.
  - Displays official PF2e action glyphs and traits.
- **Skill Actions**:
  - Actions like *Recall Knowledge*, *Demoralize*, *Trip*, *Grapple*, *Treat Wounds*, and *Battle Medicine*.
  - Automatically evaluates the highest applicable skill proficiency rank.
  - Supports variant pickers (e.g. choose specific Recall Knowledge Lore skill or Treat Wounds DC).

---

### 3. Spells & Magic Staff Tab (🪄)

- **Unified Spellcasting**:
  - Supports Prepared, Spontaneous, Innate, and Focus casters in clean, collapsible rank buckets (Cantrips, Ranks 1–10, Focus Spells, Rituals).
  - Track and expend spell slots with daily preparation and daily rest buttons.
- **Direct Spell Damage**:
  - Roll spell damage directly from the sheet with automatic heightened rank calculations.
- **Magic Staff Integration**:
  - Automatically calculates maximum staff charges based on your highest spell rank.
  - Supports expending spontaneous spell slots during daily prep to add extra charges.
  - Cast spells directly using staff charges.
- **Compendium Picker**:
  - Add new spells on the go with the mobile-friendly Compendium Browser.

---

### 4. Gear & Inventory Tab (🛡️)

- **Categorized Inventory**: Weapons, Armor, Consumables, Gear, and Treasure.
- **Bulk Tracking**: Visual encumbrance bar showing current bulk vs encumbered and maximum limits.
- **Carry State Management**: Tap carry badges to cycle items between Worn, Held 1-Hand, Held 2-Hands, or Stowed in a Backpack.
- **Currency Purse**: Tap the coins badge to view and convert Platinum, Gold, Silver, and Copper pieces, or add/subtract funds.
- **Property Rune Etching**: Built-in rune manager dialog to add, remove, and etch potency, striking, resilient, and property runes onto weapons and armor.
- **Consumable Usage**: Single-tap buttons to drink potions, apply mutagens, or activate scrolls.

---

### 5. Skills Tab (🎲)

- Clean list of all 16 core Pathfinder 2e skills plus all custom Lore skills.
- Color-coded proficiency rank badges:
  - **U**: Untrained
  - **T**: Trained
  - **E**: Expert
  - **M**: Master
  - **L**: Legendary
- Tap any skill to roll a standard check with a complete breakdown of attribute, proficiency, and item bonuses.

---

### 6. Character Overview & Feats (👤)

Accessed via the silhouette button in the header toolbar:
- **Senses**: Darkvision, Low-light vision, Scent, Tremorsense.
- **Speeds**: Land, Climb, Fly, Swim, and Burrow speeds.
- **Attribute Modifiers**: STR, DEX, CON, INT, WIS, CHA.
- **Feats**: Ancestry, Class, General, Skill, and Bonus Feats organized with nested granted feats and cached enriched descriptions.
- **Active Effects & Conditions**: Real-time list of conditions (e.g. Frightened 1, Flat-Footed, Sickened) with badges and duration countdowns that update during combat rounds.

---

### 7. Persistent In-Sheet Chat (💬)

- Embedded real-time Foundry chat log directly inside the mobile sheet.
- Bottom navigation badge shows unread chat message count.
- Touch-friendly damage application buttons on chat cards (Full, Half, Double, Healing) with automatic fallback to your active sheet actor when no token is selected on canvas.

---

### 8. Party Sheet Mode (👥)

- **Party Overview**: Health bars, AC, saves, Perception, and active exploration activities for all party members.
- **Party Stash**: Shared party inventory, group wealth calculator, and total party bulk.

---

### 9. Kingmaker Kingdom Mode (👑)

*(Requires `pf2e-kingmaker-tools`)*
- **Kingdom Header**: Kingdom Level, XP, Control DC, Fame, Unrest, and War status.
- **Kingdom Turn Tracker**: Interactive step-by-step resolution for Commerce, Leadership, Region, and Event phases.
- **Kingdom Tabs**: Settlements, Trade, and Kingdom Notes.

---

### 10. Physical Dice Integration (🎲)

*(Requires `physical-dice` module)*
- Perfect for in-person tables where players love rolling real polyhedral dice!
- Header toggle switches between **Digital Dice** and **Manual Tabletop Dice**.
- When rolling an attack, damage, save, or skill check, a touch prompt asks for your raw physical roll total.
- PF2e calculates the final modifiers, determines the degree of success (Critical Success, Success, Failure, Critical Failure), and posts the official chat card.
- Choose between a modal popup or an inline in-chat prompt.

---

## Battery, Network & Performance Optimizations

Mobile devices running Foundry often suffer from GPU overheating and severe battery drain caused by the WebGL canvas and continuous ambient audio streaming. This module solves that:

1. **Canvas Suspension**:
   - Suspending the canvas stops the PixiJS WebGL rendering loop and ticker.
   - Headless token tracking remains fully active for targeting, range finding, and flanking.
2. **Audio Network Suppression**:
   - Mutes ambient scene sounds and playlist streaming on mobile devices.
   - Suspends the hardware Web Audio context (`AudioContext.suspend()`) to let mobile audio DACs enter power-saving sleep states.
3. **Screen Wake Lock**:
   - Acquires a wake lock using the W3C Screen Wake Lock API to prevent the phone from locking while you are planning your turn.
4. **Enrichment Caching**:
   - High-performance caching for enriched item and feat descriptions avoids hundreds of expensive asynchronous compendium lookups during sheet rendering.

---

## Installation & Requirements

### System Requirements
- **Foundry Virtual Tabletop**: Version 14 or higher
- **Pathfinder Second Edition (PF2e)**: System Version 6.0.0 or higher

### Installing via Manifest URL
1. Open Foundry VTT and navigate to the **Configuration and Setup** screen.
2. Go to the **Add-on Modules** tab and click **Install Module**.
3. In the **Manifest URL** field at the bottom, paste the following link:
   ```text
   https://github.com/Ethlas/pf2e-mobile-compact/releases/latest/download/module.json
   ```
4. Click **Install**.
5. Enable **PF2e Mobile Sheet (Compact)** inside your Game World under **Manage Modules**.

---

## Recommended Modules

Enhance your mobile in-person tabletop experience with these companion modules:
- **[physical-dice](https://github.com/Ethlas/physical-dice)**: Enables tabletop manual dice rolling with automatic degree of success calculation.
- **[pf2e-kingmaker-tools](https://foundryvtt.com/packages/pf2e-kingmaker-tools)**: Integrates the complete Kingmaker 2e Kingdom Turn engine.

---

## License & Attribution

- **Author**: Ethlas & Vincent Zorge
- **System**: Pathfinder Second Edition is a trademark of Paizo Inc.
- **License**: Released under the [MIT License](LICENSE). This module strictly complies with the Foundry VTT AI Content Policy (zero bundled AI media, zero scraped third-party rules text, 100% human-maintained modular architecture).
