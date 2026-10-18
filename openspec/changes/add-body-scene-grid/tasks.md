# Tasks

## 1. Shared body-scene grid

- [x] 1.1 Add the static world-space floor grid and integrate it into `src/body/body-scene.tsx`, using a small helper if useful, the existing disposal list, and the existing render loop. Verify ready editor and read-only scenes display the grid; named views and orbit/zoom retain spatial alignment; below-ground views do not show the underside; loading/error states remain explanatory.
- [x] 1.2 Tune thin minor/major lines, antialiasing, distance/edge fade, and grazing-angle attenuation against the current charcoal/sage palette. Verify desktop, tablet, and mobile screenshots show the body and all four pain effects more prominently than the grid, including faint markings, close-ups, and supported body-shape extremes, with no floor intersection, hard perimeter, or distracting dense patterns.
- [x] 1.3 Keep the floor outside painting raycasts and extend the existing background-miss browser check to drag over visible grid space. Verify maps, regional observations, and camera position remain unchanged in paint mode, then verify painting and erasing on the body and pointer/keyboard camera controls still work.
- [x] 1.4 Document the decorative grid's coordinates, palette tuning, lifecycle ownership, and exclusion from painting in `docs/body-editor.md`. Verify the documented behavior matches the implementation and the existing renderer mount/unmount and reduced-motion browser checks pass.

## 2. Transparent body captures

- [x] 2.1 Hide the grid for every body capture and restore its original visibility in the capture routine's `finally` block. Extend the existing capture browser test to verify front/back images have transparent exterior pixels with no grid, and verify the on-screen grid, camera, and paint state survive capture unchanged.
- [x] 2.2 Add a focused capture-failure regression that forces failure after temporary grid hiding and verifies restoration of backdrop visibility and original camera/paint state. Verify the test passes and document grid exclusion from report captures in `docs/body-editor.md`.

## 3. Integration acceptance

- [x] 3.1 Review editor, Maya history playback, and both comparison bodies at desktop, tablet, and mobile widths, including empty and painted maps. Save representative screenshots and record visual findings; verify shared styling, clear low-intensity markings, responsive controls, and readable spatial depth, allowing the floor to disappear naturally edge-on or outside a close-up frame.
- [x] 3.2 Run `npm run typecheck`, `npm run build`, and the relevant existing browser suites (`foundation.spec.ts`, `body-painting.spec.ts`, `body-shape.spec.ts`, `journal-history.spec.ts`, `history.spec.ts`, and `report-appointment.spec.ts`) against the local app. Verify painting responsiveness, the existing frame-rate/lifecycle checks, and printable report output; record any unavailable demo-device check accurately.
