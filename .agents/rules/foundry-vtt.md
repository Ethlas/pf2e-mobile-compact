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

