# Proposal

## Why

The body currently floats against a flat charcoal stage. A quiet perspective grid can make feel's 3D body workspace feel like a place to build a personal pain map, while keeping the body and recorded sensations as the visual focus.

## What Changes

- Add a world-space floor grid beneath the body, with perspective that responds naturally to the existing orbit camera.
- Match the current charcoal and muted sage palette, using thin, low-contrast lines that fade smoothly into the stage background.
- Apply the same backdrop to the interactive check-in body and read-only history and comparison bodies.
- Keep the grid decorative and static: it cannot receive paint, affect measurements, or add autonomous animation.
- Exclude the grid from report captures so exported front/back body images retain their transparent backgrounds.

## Capabilities

### New Capabilities

- `body-scene-backdrop`: Subtle, theme-matched spatial context for interactive and read-only body scenes, including visual hierarchy, interaction isolation, and clean captures.

### Modified Capabilities

None. The main spec inventory is empty; the related `pain-painting` delta in the active `pain-map-journal` change remains unchanged.

## Impact

- Primary integration: `src/body/body-scene.tsx`, with a small scene-local grid helper if useful.
- Reuse the palette in `src/app/globals.css`; any new grid color tokens stay scoped to the body stage.
- Existing `BodyWorkbench` and `BodyViewer` consumers inherit the backdrop without new controls or layout changes.
- Extend focused browser coverage for background misses and transparent captures; visually review the editor, history, and comparisons at desktop and mobile sizes.
- No new dependencies, API/database changes, body-map version changes, or alterations to saved journal data. Model materials, lighting, pain effects, and application navigation are outside this change.
