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

The current acceptance machine reports **MacBook Air (MacBookAir10,1), Apple M1, 8 GB RAM, macOS 26.5.2, Node 22.16.0**. The previous M5 Pro/64 GB device claim is superseded by this direct hardware check. **The user has not confirmed this is the demo laptop, so task 2.8 remains open.**

- **Frame rate:** the Chromium browser check measures rendered FPS while painting with animated effects and asserts at least 30 FPS. The final observed value and browser configuration are recorded in [integration verification](integration-verification.md). This is a headless software-WebGL check, not a claim about another demo device or a manually measured Metal renderer.
- **Cleanup:** unmount cancels animation frames, removes listeners, and disposes scene resources. The remount check navigates three times; the editor handle leaves the live set, history has exactly one distinct read-only scene, and returning to check-in has exactly one working editor. Saved maps continue to paint after remount.
- **Commands:** `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:browser`. Final aggregate counts are in the integration record.

Limits: the atlas is 512 px, about 5–10 mm per texel, so the smallest brush (2 cm radius) is the finest mark. Painting needs WebGL. Keyboard users can rotate and select every control, but painting itself requires a pointer. Measurements are map coverage, not anatomy.

## Consumer integration

The check-in page now passes its handle and edit notifications through the journal bridge. The journal uses the shared map decoder/reducer; history and report use BodyViewer. Feature cases remain in `tests/body/*.cases.ts`, loaded by `tests/body.test.ts`; the runner also discovers nested `*.test.ts` files without running the cases twice. The README links this interface documentation.
