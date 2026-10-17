# Body editor, pain effects, and map utilities (task 2, owner A)

This feature owns `src/body/**`, `public/body/**`, and `scripts/generate-body.ts`. Coordinates, the atlas, the painting rule, and measurements are specified in [body-contract.md](body-contract.md).

## Interfaces for other owners

### Server-safe utilities: `@/body/map-utils`

No React, DOM, canvas, WebGL, or Three.js imports; a test walks the module graph to keep it that way. Works in Node 20+ Route Handlers and the browser.

| Export | Use |
| --- | --- |
| `PaintLayers`, `createEmptyLayers`, `cloneLayers`, `layersAreEmpty` | Four 512x512 `Uint8Array` layers keyed by pain type |
| `encodePaintSnapshot(layers)` | Async; returns the contract's `PaintSnapshot` (base64 PNG per layer) |
| `decodePaintSnapshot(snapshot)` | Async; validates and decodes, rejects incompatible versions |
| `validateEntryPayload(entry, { byteLength })` | Async; size/note/version/structure/map validation, returns `{ entry, layers, submittedObservationsMatched }` with recomputed observations |
| `reduceRegions(layers)` | The single shared region reducer |
| `MapValidationError` (`code`), `MAX_ENTRY_PAYLOAD_BYTES`, `MAX_NOTE_CHARACTERS`, `PRESENCE_THRESHOLD` | Limits and error handling |
| `PaintEngine`, `getBodyAtlas` | CPU painting for fixture generation (e.g. Maya, task 4.1): feed it `SurfaceHit`s (point, normal, island) to produce maps through the same pipeline as the editor |

### Browser components (client only)

- `BodyWorkbench` (alias `BodyEditor`) from `@/body/body-workbench`: the editable body plus brush toolbar. Props: `initialLayers?`, `handleRef?`, `onChange?(change)`. `change` carries `revision`, `isEmpty`, `canUndo`, `undoDepth`, current `observations`, and `reason` (`stroke`, `undo`, or `load`). B composes it into the check-in page with date, note, and save controls.
- `BodyViewer` from `@/body/body-viewer`: a read-only body for history, comparison, and reports. Props: `layers`, `label`, `handleRef?`, `initialView?`, `showLegend?`. It has its own buffers, so loading or capturing never touches a check-in draft.
- `PainLegend`, `PainSwatch`, and `PAIN_COLORS` from `@/body/pain-swatch`, and `REGION_LABELS` from `@/body/region-labels`.

`BodyHandle` methods (from `handleRef.current`) are safe before the renderer is ready: loads are queued, and `capture` waits.

```ts
handle.snapshot();               // deep copy, never aliases renderer buffers
handle.load(layers | null);      // replace the map (null = blank) and clear undo
await handle.loadSnapshot(snap); // decode + validate; shows an alert and rejects on incompatible maps
handle.undo(); handle.setView("back");
await handle.capture({ layers?, views: ["front", "back"], width: 360, height: 600 });
// -> { front: "data:image/png;base64,…", back: "…" }, static (reduced-motion) patterns, transparent background
handle.subscribe(change => …);   // returns unsubscribe
```

Typical save path for B: `encodePaintSnapshot(handle.snapshot())` plus `reduceRegions` (or let the server recompute through `validateEntryPayload`).

## Pain effects (task 2.4)

A single `ShaderMaterial` samples one RGBA paint texture (R burning, G sharp, B aching, A tingling) and keeps the task 1 hemisphere + key + fill lighting for the body. Pain colors use gentler shading so their hue stays readable.

- **Burning:** red-orange with slow rising fbm heat shimmer and hot highlights.
- **Sharp / stabbing:** white-hot points on a dark ground with four-point spikes that flicker per cell.
- **Aching / dull:** deep purple with a slow pulse (about 4 s period) over static mottling.
- **Tingling / numbness:** blue with static-like sparkles that re-seed 12 times per second.

Overlaps use a deterministic, intensity-weighted, normalized blend. The legend and toolbar swatches repeat each pattern in SVG, so sensations are not identified by color alone. Under `prefers-reduced-motion: reduce`, shader time freezes: colors and static patterns (spikes, specks, mottling, heat texture) remain. Island edges are copied two texels into the gutter in the display texture only, so linear filtering does not darken seams. Saved data is unaffected.

## Brush controls (task 2.5, `frontend-design`)

The toolbar is a "sensation palette" docked inside the body stage. It sits beside the canvas when the workbench is at least 780 px wide (a container query, independent of the page grid) and below it otherwise. On phones the order is body, views, controls. It keeps the task 1 tokens (sage stage, dark-green focus, Trebuchet/Gill Sans). The one distinctive element is the patterned swatch per sensation, matching its on-body effect. Everything around it stays quiet.

- **Sensation:** native radios styled as wells, with an "on map" tag once a layer has paint. Picking one (even the current one) switches to Paint mode.
- **Intensity:** native range 1–10 with a live "N of 10" output; its track takes the selected sensation's color.
- **Brush size:** four radios shown as dots of relative size.
- **Brush / Eraser** toggle, plus **Undo** (also Ctrl/⌘+Z), disabled when there is nothing to undo.
- **Marked areas:** a live, patient-relative list such as "Your left calf", so people can confirm sides.
- **States:** a brush ring previews size on the surface (dark red for the eraser). If WebGL fails, all controls are disabled with the reason shown. Incompatible maps show a dismissible alert and the draft is kept.

All targets are at least 44 px with a visible 3 px focus outline.

## Verification (task 2.8)

Measured 2026-10-17 on the development machine: MacBook Pro, Apple M5 Pro (20-core GPU), 64 GB, macOS 26.4, 3024x1964 Retina, Node 24.21.0, Chromium 156 (Playwright headless shell). **It has not been confirmed that this is the demo laptop; re-run the measurement below on the demo machine before judging.**

- **Frame rate:** painting continuously for 4 s with animated effects (all four layers present), 1440x900 at DPR 2, Metal GPU (`ANGLE Metal Renderer: Apple M5 Pro`): mean 60 FPS, p95 frame 16.7 ms, worst 16.8 ms (vsync-capped). With SwiftShader software WebGL: also 60 FPS. The browser test asserts at least 30 rendered FPS from the canvas `data-fps` value.
- **CPU costs** (Node, same machine): atlas build about 40 ms once per mount; region reduction about 7 ms per committed stroke; one stamp under 0.1 ms; PNG encode of four sparse layers about 8 ms, about 2 KB each.
- **Cleanup:** unmount cancels the animation frame, removes every listener (including the reduced-motion query), and disposes geometry (body, ring, 34 raycast islands), materials, the paint texture, controls, and the renderer. `globalThis.__painJournalBodyScenes` counts created/live/disposed scenes and live handles. The browser test navigates away and back three times and checks one live scene, zero after leaving, and painting after remount.
- **Commands:** `npm test` (29 passing, including 21 body cases), `npm run typecheck`, `npm run build`, and `npm run test:browser`. All 16 browser checks pass against both `next dev` and `next start`.

Limits: the atlas is 512 px, about 5–10 mm per texel, so the smallest brush (2 cm radius) is the finest mark. Painting needs WebGL. Keyboard users can rotate and select every control, but painting itself requires a pointer. Measurements are map coverage, not anatomy.

## Requested shared-file changes (owner B)

- `src/app/page.tsx`: the instruction rail still says painting "arrives in the next milestones" and repeats the legend that is now in the toolbar. Replace it with the date/note/save panel and pass `handleRef`/`onChange` to `BodyWorkbench`.
- `src/domain/contracts.ts`: optionally move `MAX_ENTRY_PAYLOAD_BYTES`, `MAX_NOTE_CHARACTERS`, and `REGION_LABELS` into shared contracts. The `parseDailyEntry` comment should point to task 2.7 / `src/body/map-codec.ts` for decoding and limits.
- Test runner: body cases live in `tests/body/*.cases.ts`, loaded by `tests/body.test.ts`, so `tests/*.test.ts` needs no change. If the glob is widened later, keep `*.cases.ts` out of it.
- `README.md`: link this document.
