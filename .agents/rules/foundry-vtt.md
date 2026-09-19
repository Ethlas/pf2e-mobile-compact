# Foundry VTT Rules (v13 & v14)

Guidelines for developing within Foundry Virtual Tabletop v13 and v14:

## ApplicationV2 Architecture
- Subclass `foundry.applications.sheets.ActorSheetV2` with `foundry.applications.api.HandlebarsApplicationMixin`.
- Use `DEFAULT_OPTIONS` static getter to configure ID, tag, window controls, and template paths.
- Prepare data within `_prepareContext(options)`. Always return an object containing data needed by Handlebars templates.
- Avoid calling `render()` synchronously in tight loops or document modification hooks; allow Foundry's reactive rendering queue to handle batch updates.

## Document Collections & Namespaces
- Do not use global `Actors` or `Items` directly. Use namespaced accessors:
  - `foundry.documents.collections.Actors` or `getDocumentClass("Actor")`.
- When accessing documents from canvas, handle headless/mobile situations where canvas might not be rendered or no tokens are selected.

## Hooks & Cleanup
- When registering global hooks (`Hooks.on` / `Hooks.once`), store registration IDs or ensure hooks don't register duplicates when sheets re-render.
- Ensure all dialogs and modals close cleanly without dangling event listeners or hanging promises.

## Modular Architecture & File Size Discipline
- Keep the main `ActorSheetV2` subclass as a lean coordinator/orchestrator (aim for < 700 lines).
- Factor out context preparation into domain helpers (`scripts/apps/sheet-helpers/context-*.js`).
- Factor out interactive dialogs and user prompts into dedicated prompt modules (`scripts/apps/sheet-helpers/sheet-prompts.js`).
- Factor out domain action/strike and spell management handlers into dedicated handler files (`actions-handlers.js`, `spells-handlers.js`).
- Keep headless canvas geometry and targeting separated in token adapter modules.
- When implementing new features, always maintain this separation of concerns and actively refactor files if they grow past 400-600 lines.


