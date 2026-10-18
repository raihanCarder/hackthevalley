# Design

## Context

See `proposal.md` for motivation. `src/body/body-scene.tsx` creates a transparent Three.js canvas over `.body-stage`, whose current `--stage` color is `#202020`. Both `BodyWorkbench` and `BodyViewer` use this scene; the latter serves history, comparisons, and a report capture source. No floor or environment is currently rendered.

`docs/body-contract.md` defines Y-up world coordinates with ground at Y=0. The camera can orbit nearly above or below the body, zoom from 0.3 to 5 units, and focus on small parts. Shape preferences morph vertices without changing map coordinates. Painting raycasts use a dedicated `rayMeshes` list. The render loop draws on demand unless pain effects are animating, and the scene owns a disposal list. Report capture renders the same scene to a transparent target with a separate camera and already restores temporary state in `finally`.

The main spec inventory is empty. The active `pain-map-journal` change contains the related painting contract; this change adds a separate presentation capability without rewriting that work.

## Goals / Non-Goals

**Goals:**

- Use one small scene addition shared by editor and viewers, with predictable camera-relative perspective.
- Keep the grid below the body in both visual emphasis and depth, including body-shape and foot-focus cases.
- Preserve the existing demand-driven render and resource lifecycle.

**Non-Goals:**

- A full modeling editor environment, measuring tool, alternate theme, new lighting, or interactive ground plane.
- Changing camera framing, body shaders, UVs, journal contracts, or report composition.
- A backdrop toggle, additional UI libraries, image assets, or grid motion effects.

## Decisions

### 1. Use a world-space floor plane with an analytic grid shader

Add one finite plane centered beneath the figure. Start with a 12-unit square at Y=-0.025, using X/Z coordinates for approximately 0.2-unit minor cells and a slightly stronger major line every five cells. Fade to fully transparent before the plane boundary. These are initial tuning values, not user-facing measurements.

Render thin grid lines using screen-space derivatives for antialiasing, with a smooth radial/distance fade and attenuation at grazing viewing angles where cells become too dense. Keep the shader independent of time and draw it in the existing scene and render loop. Use a transparent material with depth testing enabled and depth writing disabled; render the opaque body before the transparent grid. The body must occlude the grid normally.

Use a top-facing plane so below-ground orbit views naturally lose the floor rather than seeing it over the body. The floor stays in world space, without tracking the camera or rescaling with body shape. Confirm all supported shape extremes keep feet above it; if necessary lower the fixed plane to clear the full supported range.

Alternatives: a CSS perspective pattern would not track the actual orbit camera or participate in depth occlusion. A basic line grid would require additional fading and antialiasing work to avoid a hard perimeter and dense horizon lines. An enclosing wireframe room introduces lines behind the head and torso and competes with the model. The floor plane provides the requested construction feel with less visual clutter.

### 2. Reuse feel's established palette

Keep the stage background `#202020`. Use a muted sage-gray line color derived from the existing `--accent: #59644e`, starting near `#50564a` with about 0.14 minor-line opacity and 0.22 major-line opacity. Tune the rendered result, including color-space conversion, so the body silhouette and low-intensity markings dominate. Do not change the body's existing material or pain colors to compensate for the grid.

If CSS tokens are needed, scope semantic grid tokens to `.body-stage`, read their computed values from the containing stage during scene initialization, and pass them as shader uniforms. A single shared palette source prevents the editor and viewers from diverging. Existing app typography, spacing, controls, and iconography stay as established.

Alternative: bright blueprint blue, saturated axes, or luminous sage lines would give a stronger modeling-editor cue but draw attention away from pain markings.

### 3. Keep the grid outside painting and capture content

Never add the grid to `rayMeshes`, the atlas, the paint engine, or body geometry. All existing pointer routing and controls continue to use the same canvas.

Extend the capture routine's saved state to include grid visibility. Hide the grid before rendering any capture views and restore its original visibility in the existing `finally` block along with material and renderer state. The capture camera remains separate from the interactive camera. Exercise both successful and failed capture restoration. This retains transparent report images and prevents screen decoration from becoming part of the recorded evidence.

Alternative: keeping the grid in report images adds visual noise and dark lines to the printable body illustrations. A separate capture scene would duplicate scene ownership unnecessarily.

### 4. Share lifecycle and verification with the existing scene

Keep grid creation/material configuration in a small `src/body/scene-grid.ts` helper if that keeps `body-scene.tsx` readable. Register geometry and material in the existing disposal list. Do not introduce another canvas, renderer, animation loop, or dependency. Loading/error overlays continue to cover unavailable scenes.

Extend meaningful existing browser coverage in `tests/browser/body-painting.spec.ts`: background-only strokes must leave observations and maps unchanged, exported images must contain transparent exterior pixels despite a visible screen grid, and capture must restore the visible backdrop. Retain existing painting, shape, reduced-motion, renderer lifecycle, and report checks. A focused capture failure test should force a failure inside the protected capture block and verify restoration through the scene diagnostics or rendered output, without adding a product control.

Use visual review for line strength and depth: editor, history, and comparison; empty and painted maps; all four sensations; front/back/side and oblique views; minimum/maximum zoom; foot/hand/face focus; supported shape extremes; desktop, tablet, and mobile. A static floor may disappear edge-on or outside a close-up frame; that is acceptable. It must remain spatially consistent rather than being forced into every view.

## Risks / Trade-offs

- [Dense or flickering lines at the horizon] → Use derivative antialiasing, angle attenuation, and distance fading; inspect at different zoom levels and device pixel ratios.
- [Grid competes with pale sharp pain or faint markings] → Tune opacity against all four effects at low and high intensities; keep axes and labels absent.
- [Floor intersects feet after morphing] → Verify shape extremes and foot focus; lower the fixed floor if needed without touching model coordinates.
- [Grid leaks into exports or stays hidden after failure] → Restore visibility in `finally` and verify both capture paths, including transparent exterior pixels.
- [Extra fragment shading reduces performance with two comparison viewers] → Use one plane per scene, no extra render pass, and no time uniform; compare painting responsiveness and existing frame-rate checks with the baseline.

## Migration Plan

No data migration is needed. Integrate through the shared scene so all existing consumers receive the treatment. Rollback removes the grid helper/integration and any scoped grid tokens while retaining the original body scene and saved entries unchanged.
