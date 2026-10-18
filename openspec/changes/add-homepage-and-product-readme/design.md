# Design

## Context

See `proposal.md` for motivation and `specs/product-homepage/spec.md` for observable requirements. This design resolves routing and presentation decisions before implementation across the shared navigation, homepage, and product documentation.

The repository uses Next.js 16.4.2 App Router, React 19, TypeScript, Tailwind CSS 4, Radix primitives, a shared shadcn-style Button, and Lucide icons. `src/app/layout.tsx` owns the profile provider, sidebar, skip link, and main content. The `(journal)` layout mounts `CheckInWorkspace` at `/` and `/check-in`, preserving its editor between the map and details views. History and report are sibling routes. The homepage should use the same sibling arrangement.

`docs/ui-design.md` contains historical light-theme instructions followed by the current charcoal direction. The actual tokens in `src/app/globals.css` and the final charcoal section are the implementation baseline. Existing browser checks rely on `/` mounting the body editor. The root README contains useful operational guidance, but its product description, stack, structure, and team presentation are incomplete.

## Goals / Non-Goals

**Goals:**

- Add an explanatory destination inside the existing shell with a clear route into painting and analysis.
- Make the large headline the memorable visual element while preserving the application's established design.
- Organize onboarding and contributor documentation around the real product and repository.
- Keep the introduction independent of database availability, WebGL support, and Gemini configuration.

**Non-Goals:**

- Replacing the root editor route, restructuring journal panels, or adding account onboarding.
- Adding a second 3D scene, generated marketing assets, new dependencies, analytics, or provider calls to the homepage.
- Changing persistence, historical-data handling, pain analysis, or clinical scope.
- Publishing the site or claiming a production service, software license, or live-provider verification that the repository does not establish.

## Decisions

### 1. Put Home at `/home` alongside the existing route group

Add `src/app/home/page.tsx` outside `(journal)`, using a server-rendered page and a colocated CSS module for its composition. The root layout supplies the existing client-side navigation and profile context. The homepage content needs no journal fetch, canvas, or new client state.

Navigation order becomes Home (`/home`), Check-in (`/`), History (`/history`), Appointment report (`/report`). Keep Check-in active for both `/` and `/check-in`; Home is active only at `/home`. Point the wordmark at `/home`. Include meaningful homepage metadata.

Alternative considered: make `/` the homepage and move the editor to another route. That would also require changing workspace panel routing, history links, and numerous browser checks. A sibling route satisfies the requested homepage on the navigation with a smaller integration surface. Root visits continue opening the editor; the README must explicitly identify `/home` as the product overview.

### 2. Use a restrained typography-led introduction

Use a left-aligned, generously spaced hero within the main content region. Keep the headline around 48–72px on desktop and 36–44px on phones, using responsive sizing; subtitle text is around 18–20px with a readable line length of at most 65 characters. Scope these sizes to the homepage so global editor headings keep their current behavior.

Proposed copy:

> **Give your pain a clearer picture.**
>
> Paint where and how pain feels on a rotatable 3D body, save daily check-ins, and see how intensity, coverage, and patterns change over time.

Below the subtitle, use the existing Button with Next.js links: primary **Open body map** to `/`, secondary **Explore history** to `/history`. Both retain the selected profile. Add a concise supporting section covering the actual sequence: paint location/sensation/intensity, record the day with an optional note, inspect playback and regional comparisons, and bring descriptive observations to an appointment. Use flowing text or simple separated rows rather than equal feature cards. The sample-history card is removed at the user's request. Fit Home to the dynamic viewport without page scrolling; hide the supporting workflow section at widths up to 1200px or heights up to 800px so the title, subtitle, and both actions remain visible.

Reuse these existing theme values through semantic tokens:

| Role | Current value |
| --- | --- |
| Background | `#202020` |
| Surface | `#272727` |
| Foreground | `#ededed` |
| Muted text | `#a3a3a3` |
| Primary accent | `#c7ccba` |
| Border | `#393939` |

Use the current Segoe UI/system font stack, existing radii, and Button variants. Add a Lucide Home icon at the sidebar's existing 18px size and 1.7 stroke. The headline supplies the visual emphasis; gradients, decorative counters, new fonts, animations, and a second rendering of the mannequin add no necessary explanation.

Alternative considered: an interactive 3D hero. It duplicates the editor and adds WebGL loading and failure states before the visitor reaches the actual experience. The prominent headline and direct editor action keep the introduction readable on every device.

### 3. Preserve responsive navigation and accessibility

Retain the current desktop sidebar and mobile navigation row. Check the fourth navigation item at 390px; all destinations must remain reachable in the existing horizontally scrollable row without causing page overflow or covering the profile control. Wrap the hero actions into full-width or stacked controls when needed.

Use one `h1`, an `h2` for supporting content, ordinary descriptive paragraphs, links for navigation, and the existing focus treatment and skip target. Do not nest a second `main`. Verify the skip target actually receives focus and make a minimal shared-target adjustment only if needed. Keep all content available with reduced motion and do not require a canvas for reading the introduction.

Alternative considered: a separate marketing header or theme. Reusing the application shell keeps Home identifiable as part of the journal and maintains access to You/Maya.

### 4. Structure the README as product documentation grounded in source

Rewrite `README.md` under the current name **Pain journal**, with this hierarchy:

1. Product name, concise description, and the value of recording location, sensation, intensity, and change over time.
2. Features: four pain sensations, rotatable paintable body, exact daily saved maps and optional notes, playback, regional intensity/coverage/frequency, two-date comparison, synthetic Maya, printable reports, and explicit Gemini summary generation with a factual fallback.
3. Product workflow and route table identifying `/home`, `/`, `/check-in`, `/history`, and `/report`.
4. Technology stack table derived from `package.json`: Next.js/React/TypeScript, Three.js/custom shaders, Tailwind/Radix/shared UI/Lucide, Node Route Handlers, PostgreSQL with `pg` and SQL migrations, server-side Gemini API, browser printing, and Playwright/Node test tooling. Use versions only where they help and match the manifest.
5. Local setup: Node.js 20.19+, npm, local PostgreSQL or Docker Compose, `npm ci`, `.env.local` settings copied selectively from `.env.example`, `docker compose -f db/compose.yml up -d --wait`, `npm run db:migrate`, and `npm run dev`. Preserve existing secrets when documenting environment setup. Link the native PostgreSQL alternative in `docs/journal.md`.
6. Configuration table: `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and optional `APP_ORIGIN` and `GEMINI_TIMEOUT_MS`. Explain that Maya and factual reports work without the services, You requires local PostgreSQL, and credentials stay server-side. Do not hardcode an assumed currently available Gemini model.
7. Annotated file tree covering `src/app`, `src/body`, `src/components`, `src/domain`, `src/journal`, `src/timeline`, `src/report`, `src/demo`, `db`, `public/body`, `scripts`, `tests`, `docs`, and `openspec`.
8. Development commands from `package.json`, including build/start, type checking, existing unit/browser/database checks, and body/Maya generation. Describe isolated acceptance schemas accurately without claiming checks were run for this proposal.
9. Contributors consolidated from Git history: Raihan C / Raihan (`raihanCarder`), Arshdip Pamma / arshdippamma (`arshdippamma`), and Krish Patel. Use one row per person; link only the GitHub profiles established by repository metadata, omit personal email addresses, and do not invent roles or a handle for Krish.
10. Scope and data behavior: exactly You and Maya; one device-local PostgreSQL journal; synthetic read-only sample; preserved historical data; missing versus explicitly empty check-ins; descriptive reports. Keep this concise and product-facing.
11. Links to detailed documentation and asset provenance. Preserve the useful OpenSpec workflow as a compact development section. Reference `public/body/PROVENANCE.md` and its asset-specific licensing without presenting that as the application's license.

Alternative considered: a promotional README with badges, deployment claims, and contributor role assignments. Those would require evidence the repository does not provide. A professional presentation can remain specific and factual.

## Risks / Trade-offs

- [The name Home implies the root URL] → Show `/home` explicitly in the README and keep the wordmark and first navigation item consistent.
- [Four navigation links consume more phone width] → Review reachability, focus scrolling, and overflow at 390px, 768px, and 1440px; preserve the existing mobile profile control.
- [Older documentation describes obsolete storage choices and light colors] → Ground the README in current source and update only the relevant design guidance; do not reproduce superseded setup instructions from older demo notes.
- [Navigating away from the journal unmounts the editor] → Match the existing History/report navigation lifecycle; do not promise draft persistence through Home or change save behavior as part of this feature.
- [Global styling affects the homepage headline or existing editor] → Use scoped homepage styles and review shared navigation changes against the editor and report layouts.
- [Git aliases can double-count contributors] → Consolidate the two observed aliases for Raihan and Arshdip; omit unverified roles and identities.

## Migration Plan

No schema or data migration is required. Implement on `feat/homepage-product-readme`, add the sibling route and navigation links, then rewrite the README and update the relevant design documentation. Read the installed Next.js route/layout/metadata guides before writing application code. Review the feature and record actual verification before marking implementation tasks complete. Rollback consists of reverting the homepage, navigation, and documentation changes; stored journals and reports are unaffected.
