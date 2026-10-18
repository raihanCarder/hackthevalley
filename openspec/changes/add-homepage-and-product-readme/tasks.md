# Tasks

## 1. Homepage and shared navigation

- [x] 1.1 Read the installed Next.js guides relevant to pages, layouts, linking, and metadata before editing application code; verify the chosen `/home` page sits outside `(journal)` and inherits the root shell without mounting `CheckInWorkspace`.
- [x] 1.2 Implement `src/app/home/page.tsx` with homepage metadata, a large main heading, the explanatory subtitle, responsive workflow text and the two specified actions using the existing Button; verify the rendered content matches the `product-homepage` requirements and neither action changes the selected profile or saves a record.
- [x] 1.3 Add scoped homepage styles using the current charcoal/sage tokens and system typography; visually review the page at 390px, 768px, and 1440px for heading hierarchy, wrapping actions, readable line lengths, contrast, and absence of page scrolling, including reduced motion and unavailable PostgreSQL/Gemini.
- [x] 1.4 Add Home first in `AppNav`, point the wordmark to `/home`, and preserve Check-in selection for `/` and `/check-in`; verify Home, Check-in, History, and Appointment report each have exactly one correct current-page indication, with all links and the profile control reachable on mobile and by keyboard.
- [x] 1.5 Verify Home-to-editor and Home-to-History navigation under You and Maya, wordmark navigation back to Home, skip-link focus, and returning to one working editor canvas; extend the existing browser navigation coverage proportionally and record the actual checks and any unavailable checks.
- [x] 1.6 Update the current navigation/design guidance in `docs/ui-design.md` to describe `/home`, the four destinations, and the typography-led homepage; verify the guidance agrees with the actual routes and active charcoal theme without rewriting historical verification records.

## 2. Professional product README

- [x] 2.1 Rewrite the README introduction, feature overview, and product workflow around 3D painting and analysis over time, with reports as a supporting feature; verify each feature against the current source and include a route table that explicitly identifies `/home` and the existing editor routes.
- [x] 2.2 Add the technology table, annotated repository tree, and development command reference; verify every dependency, directory, and command against `package.json` and the repository rather than describing planned or absent infrastructure.
- [x] 2.3 Preserve and organize local setup, environment configuration, You/Maya behavior, Gemini's explicit action and factual fallback, and links to detailed documentation; verify command ordering and variable names against `.env.example`, `db/compose.yml`, migration scripts, and current server code, without replacing existing local secrets or claiming live-provider validation.
- [x] 2.4 Add a consolidated contributors section for Raihan, Arshdip Pamma, and Krish Patel, plus scope and asset attribution; compare credits with Git authors and existing provenance, omit unverified roles and personal email addresses, and verify README file links resolve and asset licensing is not presented as an application-wide license.

## 3. Integration review

- [x] 3.1 Run appropriate type/build checks and the affected browser navigation checks after implementation; review the homepage together with Check-in, History, and Appointment report at phone/tablet/desktop widths, record actual results, and mark only completed verification gates as done.
- [x] 3.2 Review the final diff for scope and consistency between implementation, README, design guidance, and the `product-homepage` specification; run `openspec validate add-homepage-and-product-readme --strict` and verify the completed checklist accurately represents delivered behavior.
