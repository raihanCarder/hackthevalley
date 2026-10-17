# Task 1 verification

Verified 2026-10-17 on macOS arm64 with Node 22.16.0, npm 11.12.1, Next.js 16.4.2, React 19.3.1, Three.js 0.186.1, and Playwright 1.64.1 / Chromium 156. Browser checks use SwiftShader software WebGL, so these results do not establish the later painting FPS target or hardware GPU performance.

- `npm run dev -- --hostname 127.0.0.1`: ready on port 3000; direct check-in, history, report, and Node `/api/status` requests succeeded. No browser-global, hydration, page, or console errors in the normal-load browser check.
- `npm run build`: passed, with three application pages and the Node Route Handler. `npm start -- --hostname 127.0.0.1 --port 3001` started the production build successfully.
- `npm run typecheck`: passed.
- `npm test`: all 8 tests passed. These cover Gregorian dates, unknown regions/types, version rejection, entry metadata, all four layer fields, UV island bounds/non-overlap, valid world/UV triangles, outward winding, left/right limb assignment, asset reproducibility, and local attribution.
- `npm run body:generate`: reproducibly exports `mannequin-v1`, 34 unique UV islands, 15,360 triangles; the checked-in export matches its source.
- `npm run test:browser`: all 5 checks passed against development. `TEST_BASE_URL=http://127.0.0.1:3001 npm run test:browser`: all 5 passed against production. Checks cover deep links and the status route, four distinct named camera positions, mouse/keyboard rotation, locked camera in Paint mode (drag/wheel/keyboard), narrow/tablet/desktop layouts, WebGL failure messaging, and navigation/remounting with one canvas.
- Screenshots reviewed at 390, 768, and 1440px, plus named back/patient-side views. Head, torso front/back, stylized hands, both legs, and feet are visible and inspectable. No horizontal overflow or clipped mode/view controls. Body occupies the main visual area; phone controls remain above the instruction rail. Captures are reproducible under ignored `test-results/`.
- Calculated text contrast ratios: foreground/background 11.45:1, muted/background 5.75:1, muted/stage 5.22:1, white/active control 7.36:1. Native labeled buttons and the canvas have explicit keyboard focus outlines.

The first error-state test run found an ambiguous test locator because Next.js also supplies a route-announcement alert. The selector now targets the scene alert; all final checks pass. Local sandbox permissions were required for dependency/browser downloads, production port binding, and Chromium process startup.

Next.js automatically appended its local-documentation instruction block to `AGENTS.md` during startup. The version's bundled lazy-loading, Route Handler, and layout/page documentation was reviewed. Original project instructions remain intact.

Only task 1 is implemented. Paint mode establishes interaction separation and does not apply strokes. No entries, storage adapters, auth/session mechanism, region raster/reducer, pain shaders, synthetic history, trend computation, or report generation are implemented. History and report are explicitly labeled navigation placeholders; their intended UI is documented in `ui-design.md`.
