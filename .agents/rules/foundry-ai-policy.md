# Foundry VTT AI Content Policy — Mandatory Workspace Rule

All development, refactoring, documentation, and asset handling in `pf2e-mobile-compact` MUST strictly comply with the official **[Foundry Virtual Tabletop AI Content Policy (Revised March 18, 2026)](https://foundryvtt.com/article/ai-policy/)**.

---

## 1. Prepared Media Content (Sections 3.1, 4.2, 4.3)
- **Strict Ban on AI-Generated Images, Illustrations, UI Assets, Video & Audio**:
  - **NEVER** use `generate_image`, diffusion models, or audio generators to create bundled visual or audio assets (`.png`, `.jpg`, `.webp`, `.gif`, `.mp3`, `.ogg`, `.wav`, `.mp4`, `.webm`).
  - Use **FontAwesome icons** (`fa-solid`, `fas`), **Foundry VTT built-in icons** (`icons/...`), **PF2e system icons** (`systems/pf2e/...`), **CSS styling**, or clean geometric UI `<svg>` icons.
  - If any raster image or audio file is ever bundled in the repository, it must be 100% human-created (or licensed human-made stock) and documented in `ASSET_PROVENANCE.json` with creator attribution and license details.
  - **No SVG Evasion (Section 4.2)**: SVG files are permitted as software code for clean vector UI icons only. Never embed raster base64 images inside SVGs or convert AI-generated illustrations into complex vector paths.

## 2. Prepared Written Text & Third-Party Rights (Sections 1.1, 4.1, 4.5)
- **No AI-Generated Lore, Adventure Content, or Rules Text**:
  - Do not bundle AI-written lore, journal entries, item descriptions, or duplicated rules text in templates or scripts.
  - Retrieve all game rules, feat/spell/item descriptions, and Kingdom/Camping data dynamically at runtime from the user's installed PF2e system (`game.pf2e`, `pf2e.*` compendia) or installed companion modules (`pf2e-kingmaker-tools`, `pf2e-dailies`).
- **No Third-Party Content Scraping or Duplication (Section 1.1)**:
  - Never copy or hardcode data tables, constant arrays, or rules definitions from other modules into this repository. Always call their public APIs or read their document flags/context methods at runtime.
- **Marketing & Package Descriptions (Section 4.5)**:
  - The `description` in `module.json` and any text used for the Foundry VTT package listing must be authored and approved by the human creator (`Ethlas`).
- **Translations (Section 4.1)**:
  - Any AI-assisted localization/translation must be reviewed for accuracy by a fluent human speaker of the target language before publication.

## 3. Software Code & Anti-"Vibe Coding" Standard (Sections 4.4 & 7)
- **Human Author Understanding & Maintainability**:
  - Under Section 4.4, AI-assisted coding, refactoring, debugging, documentation, and testing are permitted **provided the human author personally understands, can explain, modify, and maintain every part of the submitted codebase**.
  - **Prohibition on Opaque "Vibe Coding"**: Never dump large, undocumented, monolithic blocks of code.
  - **Modular Domain Boundaries**: Keep `scripts/apps/mobile-sheet.js` under 700 lines as a lean orchestrator, and isolate domain logic into well-named helpers under `scripts/apps/sheet-helpers/`, `scripts/kingdom/`, `scripts/rolls/`, and `scripts/tokens/`.
  - **Self-Documenting Architecture & Design Notes**:
    - Every module file and exported function must include clear JSDoc comments explaining its purpose, inputs/outputs, and how it interacts with Foundry VTT `ApplicationV2` or the `pf2e` system.
    - Every feature or bug fix must be documented in `CHANGELOG.md` with clear technical rationale so the commit history and design notes demonstrate clear human-guided iteration and authorship (Section 7).

## 4. Runtime Code Execution & Categorization (Sections 5, 6.6, 6.7)
- **No Silent Runtime Code Execution (Section 5)**:
  - Never use `eval()` or `new Function()` to execute dynamically generated code at runtime without presenting the code to the user in a readable format and obtaining explicit user confirmation.
- **No "Zero AI" Misrepresentation (Section 6.6)**:
  - Because AI coding assistance is used in software development, **never** label or advertise `pf2e-mobile-compact` as `"Zero AI"` in `module.json`, `README.md`, or Foundry VTT package listings.
