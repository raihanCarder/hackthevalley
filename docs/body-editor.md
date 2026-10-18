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
| `reduceRegions(layers)`, `getRegionRaster()` | The single shared region reducer and the embedded region raster it uses (synchronous everywhere) |
| `MapValidationError` (`code`), `MAX_ENTRY_PAYLOAD_BYTES`, `MAX_NOTE_CHARACTERS`, `PRESENCE_THRESHOLD` | Limits and error handling |
| `PaintEngine`, `buildBodyAtlas`, `surfaceHitNear` | CPU painting for fixture generation (e.g. Maya, task 4.1): feed it `SurfaceHit`s (`{ point, triangle }`) to produce maps through the same geodesic pipeline as the editor. In Node scripts and tests, `loadBodyAtlas()` from `@/body/node-atlas` reads the checked-in asset. `asset.landmarks` names surface points such as `left-calf-middle`, `lower-back`, or `left-index-tip` |

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

## The body model (mannequin-v2)

The editor and viewers render a realistic, neutral figure built from the CC0 MakeHuman base mesh: smooth skin with a modelled face, eyes, ears, separate fingers, and toes. Hair, clothing, and genital helpers are removed. `npm run body:generate` turns the pinned source (`scripts/body/source/`) into these files:

- `public/body/mannequin-v2.json`: render mesh, UV charts, welded topology, 45-region labels, landmarks, and camera presets.
- The embedded region raster.
- The traced 2D diagram.

Provenance and licensing are in `public/body/PROVENANCE.md` and `public/body/LICENSE.txt`.

Both the editor and `BodyViewer` offer "Zoom to" close-ups (Face, Your left/right hand, Your left/right foot) next to the named views. The handle exposes the same presets as `focus(target)`. Small parts are painted in close-up; the brush and the regions list work the same at any zoom.

## Body shape and appearance

The figure is neutral grey with a painted-on crop top and shorts, so it reads clearly as a mannequin and every pain color stands out. There is no skin-tone setting.

"Adjust body shape" in the editor opens these optional sliders:

- **Main:** sex, height, weight, muscle, and waist and belly.
- **Proportions:** shoulders, hips, and leg length.
- **More options:** age (25–70).
- **Reset body shape** returns to the default figure.

The shape is a per-browser preference (`useBodyShapePreference`, `localStorage` key `pain-journal-body-shape`), shared live by the editor and viewers. History playback and date comparison use it for the visitor's own maps; Maya and the printed report always use the default figure.

Shapes only move vertices. Triangles, UVs, region labels, and texel data never change, so a map looks the same on every shape and measures identically, and the body-map version stays `mannequin-v2`. `src/body/body-shape.ts` (pure) blends the CC0 morphs with MakeHuman's macro weights. `src/body/body-morph.ts` reshapes the welded painting surface in place, so geodesic painting follows the new shape, and recomputes seam-free normals, the close-up presets, and the framing. Shorter figures stay smaller in the frame; taller ones zoom out to fit.

The 2 MB shape pack is fetched only when a non-default shape is used. `BodyViewer` takes an optional `shape` prop.

## Decorative scene floor

The editor, history playback, and comparison viewers share a quiet perspective floor grid (`src/body/scene-grid.ts`). Its 12 m plane sits at Y=-0.025 m, beneath the body; body morphing keeps the lowest vertex at Y=0. The grid stays anchored in world space as the existing camera moves. Its front face is visible from above only, so orbiting below the body does not draw a floor over it.

The line color comes from the containing stage's existing `--accent` sage token against the charcoal `--stage`. Minor lines are spaced 0.2 m apart with 0.14 opacity; major lines use 1 m spacing and 0.22 opacity. Derivative antialiasing, attenuation of densely projected lines, grazing-angle attenuation, and a radial fade from 1.5 to 5.5 m keep the floor quiet and conceal its perimeter. These values control decoration, not a measurement scale.

The scene owns and disposes the grid geometry/material alongside other resources. It uses the existing render loop, has no time uniform or animation, and is never included in body raycasts, paint maps, or regional measurements. The body depth-occludes its lines. The floor can naturally disappear edge-on or outside a close-up frame.

Report captures temporarily hide the grid and restore its previous visibility in `finally`, including after encoding/rendering failures. Front/back images retain transparent backgrounds and static pain patterns. Browser regression coverage checks visible floor pixels before capture, transparent exterior pixels in both exports, unchanged scene pixels and map fingerprints afterward, and recovery from a forced encoding failure.

Grid verification on 2026-10-18:

- Visually reviewed editor, Maya history (empty and painted dates), and date comparison at 390, 768, and 1440 px. The sage floor stays subordinate to the figure and all four sensations at intensities 1 and 8. Reviewed named/oblique/below-ground views, zoom limits, hand/face/foot focus, and combined shape-slider extremes (including age). No floor intersections, visible perimeter, or dense horizon patterns were observed. Screenshots are local review artifacts in `test-results/body-grid-review/` (ignored by Git).
- All 36 selected browser cases passed across the main run (33 passed) and targeted rerun (3 passed), using `npm run test:local-browser -- body-painting.spec.ts foundation.spec.ts body-shape.spec.ts journal-history.spec.ts history.spec.ts report-appointment.spec.ts`, then `npm run test:local-browser -- --last-failed`. The runner used disposable PostgreSQL schemas. The new transparency check was corrected to sample outside the hands; two stale assertions were updated for the existing generated help ID/error copy and profile switcher UI.
- The existing animated-painting check passed its 30 FPS minimum under headless Chromium with software WebGL. Renderer lifecycle, touch painting, exact saved-map reload, history playback, and one-page A4/Letter printing checks passed. `npm run typecheck` and `npm run build` passed.
- This verifies the local automated environment. The user has not confirmed the demo device, so performance on that device remains unverified; this change does not close the main journal's demo-device gate.

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
- **mannequin-v2 check** (2026-10-17, development machine, not necessarily the demo laptop): painting continuously for 4 s with animated effects on the 27k-triangle realistic body, 1440x900 at DPR 2, Chromium with the Metal GPU (`ANGLE Metal Renderer: Apple M5 Pro`): mean 60 FPS, p95 frame 16.7 ms (vsync-capped). CPU costs in Node: atlas build about 44 ms per mount, one geodesic stamp 0.01–0.04 ms for 2–8 cm brushes, region reduction about 1 ms per committed stroke.
- **Cleanup:** unmount cancels animation frames, removes listeners, and disposes scene resources. The remount check navigates three times; the editor handle leaves the live set, history has exactly one distinct read-only scene, and returning to check-in has exactly one working editor. Saved maps continue to paint after remount.
- **Commands:** `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:browser`. Final aggregate counts are in the integration record.

Limits: the atlas is 512 px, about 4.5 mm per texel on `mannequin-v2`, so the smallest brush (2 cm radius) is the finest mark; use the hand, foot, and face close-ups to mark individual fingers, toes, and facial features. Painting needs WebGL. Keyboard users can rotate and select every control, but painting itself requires a pointer. Measurements are map coverage, not anatomy.

## Consumer integration

The check-in page now passes its handle and edit notifications through the journal bridge. The journal uses the shared map decoder/reducer; history and report use BodyViewer. Feature cases remain in `tests/body/*.cases.ts`, loaded by `tests/body.test.ts`; the runner also discovers nested `*.test.ts` files without running the cases twice. The README links this interface documentation.
