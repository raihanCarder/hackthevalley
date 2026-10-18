# Homepage and product README verification

Observed October 18, 2026 for `add-homepage-and-product-readme` on `feat/homepage-product-readme`.

## Delivered behavior

- Home at `/home` uses the shared charcoal shell, a large heading and explanatory subtitle, links to the body map and History, and responsive workflow text.
- Home appears first in navigation and the wordmark opens it. `/` still opens the body editor, and `/check-in` still opens its details. Exactly one destination is marked current.
- Both homepage actions retain You or Maya without writing a check-in or requesting a Gemini summary. Home itself requires no body renderer or journal query.
- The shared skip link focuses `main`. Focused navigation links scroll fully into view on narrow screens; this corrects the clipped final link exposed by adding Home to the mobile row.
- The README now covers features, workflow and routes, stack, setup, configuration, directory structure, development commands, contributors, data behavior, documentation, and source-asset attribution.

## Observed checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `PAIN_JOURNAL_DIST_DIR=.next-homepage-build npm run build` | Pass; `/home` is statically prerendered alongside the existing routes |
| `npm run test:local-browser -- homepage.spec.ts foundation.spec.ts` | 9 passed, no skips; 46 seconds |
| `npm run test:local-browser -- homepage.spec.ts --grep 'shared navigation fits'` | 1 passed after adding the report-image readiness checks; 21.7 seconds |
| `openspec validate add-homepage-and-product-readme --strict` | Pass |
| `git diff --check` | Pass |
| Keyboard at 390px, 768px, and 1440px | Skip link, wordmark, all four navigation links, both homepage actions, and the two-item profile menu are reachable |
| Homepage with reduced motion, all API routes returning 503, and WebGL disabled | Readable at all three widths; no canvas or API mutation is created |
| You/Maya navigation | Both retain the selected profile through Home, editor, History, report, and check-in details; returning to the editor mounts one working scene |
| Existing foundation checks | Deep links, hydration, named views, paint/rotate modes, renderer failure, responsive editor sizing, and scene remount checks pass |
| README review | Relative file links resolve, all documented `npm run` commands exist in `package.json`, documented module directories exist, and human credits agree with Git history |

Chromium used the repository's software WebGL flags and an isolated local PostgreSQL schema through the existing acceptance runner. The runner removed its schema and stopped its app after completion; the user's journal was not populated or cleared. The initial sandboxed production build stalled and was stopped; the build completed outside the sandbox. Generated TypeScript configuration changes from isolated build/test directories were checked against the original configuration and removed.

## Visual review

Reviewed the homepage and the shared navigation alongside Check-in, History, and Appointment report at 390px, 768px, and 1440px. Homepage text and actions wrap without horizontal page overflow; the mobile navigation retains its horizontal scroll behavior and the profile control remains available. The existing dark palette and system font continue across the application.

Screenshots are generated in ignored `test-results/`: `homepage-{width}.png` and `homepage-integration-{check-in|history|report}-{width}.png`. The focused integration screenshot check waits for both report composite images before capture.

Computed text contrast for the reused opaque theme colors:

| Foreground / background | Ratio |
| --- | --- |
| `#ededed` / `#202020` | 13.92:1 |
| `#a3a3a3` / `#202020` | 6.46:1 |
| `#a3a3a3` / `#272727` | 5.92:1 |
| `#23271f` / `#c7ccba` | 9.25:1 |

## Limits

These are scoped homepage/navigation checks and documentation review, not a repeat of every domain, database, print-export, or live-provider acceptance gate. No live Gemini request, deployment, or separate demo-device performance claim is made. The existing product's outstanding verification gates remain in its own checklist.

## Follow-up: fixed viewport homepage

Removed the “Start with a little history” card at the user's request. Home now fits `100dvh` without page scrolling. At widths up to 1200px or heights up to 800px, the supporting workflow section is hidden so the heading, subtitle, and both actions remain visible. Short screens use compact type and spacing. The horizontal mobile navigation remains usable.

The focused homepage check passed at 390×844, 768×1024, 1440×900, 1440×720, and 390×600. It checks that the card is absent, page dimensions fit the viewport, the actions and any displayed workflow fit on screen, wheel input leaves `scrollY` at zero, and keyboard navigation works. Final run: `npm run test:local-browser -- homepage.spec.ts --grep 'readable without'`, 1 passed in 6.6 seconds. Strict OpenSpec validation and diff whitespace checks also pass. Earlier build and broader browser results above describe the initial homepage implementation.

## Follow-up: feel branding

The approved product name is **feel**, with the tagline “Map what you feel.” The wordmark, home heading, page metadata, package identity, status response, branded messages, report footer, README, and relevant documentation now use that name. Historical persistence keys, cookie names, database configuration, and Docker Compose identity retain their existing values so saved journals and preferences remain connected.

On `feat/feel-branding`, `npm run test:local-browser -- homepage.spec.ts foundation.spec.ts report-appointment.spec.ts` passed all 16 checks in 55.4 seconds. This includes the renamed accessible wordmark and page title, the fixed viewport homepage at five sizes, You/Maya navigation, saved evidence, and single-page A4/Letter report printing. Reviewed the renamed homepage at phone, tablet, and desktop widths. No live Gemini request was made.

## Follow-up: supporting information in the viewport

Restored the supporting painting, history/comparison, and appointment-report information at all supported screen sizes. The slogan remains “Map what you feel.” Desktop uses the full descriptions; narrower or very short screens show concise descriptions for the same features. Section layout, spacing, and type adapt to the available viewport. Only the secondary section introduction is hidden on short phones; all three feature headings and descriptions stay visible. The removed sample-history card remains absent.

The focused homepage check now requires the supporting section and each feature heading/description to be visible and entirely within the viewport. It also checks page dimensions, actions, wheel scrolling, keyboard navigation, reduced motion, and unavailable services/WebGL. The final run passed in 9.5 seconds at 390×844, 768×1024, 1440×900, 1440×720, 390×600, 768×768, 1280×720, and 1024×768. Phone, tablet, and desktop screenshots were reviewed. TypeScript and strict OpenSpec validation pass.
