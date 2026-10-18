# Proposal

## Why

The application opens directly into the body editor without first explaining its purpose, and the README reads primarily as setup notes. A dedicated homepage and a product-focused README will help new visitors understand how 3D pain mapping connects daily check-ins with changes over time and appointment preparation.

## What Changes

- Add a Home destination at `/home` to the shared navigation, with the wordmark linking there. Keep the existing Check-in editor at `/` and its details at `/check-in`.
- Introduce a prominent title and explanatory subtitle using the current charcoal surfaces, muted sage accent, system typography, and shared controls. Lead with painting pain on a rotatable 3D body and tracking its changes over time.
- Provide clear actions to open the body editor and History, plus a concise explanation of daily recording, regional analysis, and the supporting printable report.
- Preserve the shared You/Maya profile switcher and label any sample-data references as synthetic and read-only.
- Rewrite the root README as a professional product overview covering features, the actual technology stack, local setup and configuration, repository structure, development commands, contributors, scope, and asset attribution. Preserve useful setup details and link to the deeper technical documentation.

## Capabilities

### New Capabilities

- `product-homepage`: An accessible, responsive product introduction connected to the application's shared navigation and existing journal workflows.

### Modified Capabilities

None. There are no published main specifications; the in-progress `pain-map-journal` capabilities remain unchanged. The README rewrite is documentation work covered by the design and tasks rather than an additional system capability.

## Impact

- Add `src/app/home/page.tsx` and scoped homepage styling; update `src/components/app-nav.tsx` for Home and wordmark navigation.
- Reuse the root layout, semantic theme tokens in `src/app/globals.css`, existing Button component, and Lucide conventions. No new runtime dependency, database migration, API, or provider integration is needed.
- Update `README.md` and the navigation portion of `docs/ui-design.md`, whose earlier sections still describe the original light theme and route hierarchy.
- Keep current editor deep links and journal data behavior. Account for a fourth navigation item on narrow screens and review the existing navigation/browser checks when implementing.
- Credit human contributors from Git history without inventing roles, affiliations, or an application license. Clearly distinguish the local MVP from production clinical software and describe Gemini's factual fallback accurately.
