# Mobile UI/UX & CSS Guidelines

Guidelines for building mobile-friendly, battery-conscious user interfaces in `pf2e-mobile-compact`:

## Touch Targets & Ergonomics
- Every interactive element (buttons, tabs, filter pills, dropdowns, expand/collapse chevrons) must have a minimum touch target size of **38px** (ideally 44px on primary actions).
- Keep thumb-zone friendly navigation: persistent bottom bar tabs for primary switching (Actions, Spells, Gear, Skills, Chat).
- Avoid hover-dependent UI patterns. Always provide direct tap or click handlers with visible active/focus states.

## Native Dropdowns vs Touch Events
- Never bind `data-action` to `<select>` elements in ApplicationV2 templates.
- Use `data-change-action` for `<select>` tags and call `event.stopPropagation()` on clicks to prevent ApplicationV2 from calling `preventDefault()`, which suppresses the native mobile OS picker on iOS and Android.

## Responsive Layouts & Viewport Sizing
- Use `100dvh` (dynamic viewport height) or flexbox/grid containers to prevent iOS Safari/Android Chrome address bars from cutting off bottom navigation.
- Account for safe area insets (`env(safe-area-inset-bottom)`, `env(safe-area-inset-top)`) on mobile devices with notches or gesture bars.
- Enforce `overflow-y: auto` with smooth touch scrolling (`-webkit-overflow-scrolling: touch`) within tab scroll containers.

## Performance & Battery Optimization
- Avoid expensive continuous animations, heavy box-shadow blurs, or unnecessary CSS filter repaints on mobile viewports.
- Optimize DOM footprint: keep lists compact and defer rendering of hidden tab content where appropriate.

