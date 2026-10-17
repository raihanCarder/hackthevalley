# Tasks

The tech stack is summarized in `design.md` under Tech stack. This checklist assigns four human feature owners; its completion gates describe dependencies, not a requirement that the team work serially. Use Next.js App Router, TypeScript, Three.js, and ordinary PostgreSQL. The two main selling points are direct 3D body painting and analysis of pain over time; complete both before report polish. Resolve the pending local-user/account and Gemini questions before applying the affected tasks; browser-local fallback and visitor sessions remain draft scope until then.

**Required skill for application UI: use `frontend-design` ([SKILL.md](../../../.agents/skills/frontend-design/SKILL.md)).** This applies to navigation, page layouts, brush controls, daily check-in forms, timeline controls, trend/comparison presentation, report layout, and responsive/accessibility states. Read and apply the skill before building these UI portions. It does not govern the 3D mannequin/model, UV atlas, raycasting, paint-buffer algorithms, scene lighting, or pain shaders. Controls around the 3D canvas are application UI and remain in scope for the skill.

The UI work is tracked in 1.5, 2.5, 3.2, 4.2, the presentation portions of 4.5–4.6, 5.2, and 5.5; visual review is part of 6.2.

### Team assignments and independent starts

| Owner | Complete feature assignment | Primary paths | Can start after agreeing interfaces | Completion gate |
| --- | --- | --- | --- | --- |
| A | Task 2: 3D body editor, pain effects, region measurements, and map encoding | `src/body/`, `public/body/` | Painting, shaders, pure map utilities, feature controls/tests | Real four-layer painting, exact restoration, verified region/encoding behavior, and renderer checks |
| B | Task 3: daily journal and persistence; also integration lead | `src/journal/`, check-in page, journal/session/status API routes, `db/` | Date/note UI and repository-contract tests; clarify storage/account scope | A's maps and measurements connected to acknowledged saves/reads and the agreed storage/profile policy |
| C | Task 4: Maya, history playback, trends, and date comparison | `src/timeline/`, `src/demo/`, history page | Pure analysis and playback/UI against typed test fixtures | Maya generated through A's actual map/reducer pipeline; saved-map playback and analysis match the real entries |
| D | Task 5: appointment evidence, summary/fallback, and print report | `src/report/`, report page and report API route | Evidence/empty-state tests and print layout against typed test fixtures | Real saved-entry evidence, shared C analysis, and A's map capture; Gemini scope resolved for affected work |

Names are assigned by the team; Owner B's integration responsibility does not require a fifth person. The exact file boundaries, shared interfaces, branch names, and handoffs are in `design.md` Decisions 1a–1c. Agree those interfaces before parallel implementations, then use separate clones/worktrees and one branch/PR per top-level feature task. A owns the renderer and brush controls; B alone composes them into the check-in page. C/D import the body viewer and analysis rather than editing or duplicating them.

Owner B is the sole editor of shared contracts, global CSS/navigation, root configuration and package/lock files, README, AGENTS.md, and the central OpenSpec checklist. Other owners use feature-local CSS modules and dedicated tests/docs, and provide requested shared-file changes plus verified subtask completion notes in their PRs. B updates checklist boxes per completed subtask on their behalf. The existing test command only covers top-level tests: coordinate runner configuration through B before adding nested feature tests. Tests/mocks cannot stand in for the real completion gates above.

### Unfinished-task ID changes

The five completed task 1 checkboxes and all acceptance requirements are retained. Only unfinished IDs moved so each top-level feature has one owner; use this mapping when reading older PRs or notes. There are still 34 tracked subtasks, with 5 complete.

| Previous ID | Current ID | Reason |
| --- | --- | --- |
| 3.1 | 2.6 | Region attribution stays with the owner of the UVs and painting pipeline |
| 3.2 | 2.7 | Lossless maps and map validation stay with that same owner |
| 2.6 | 2.8 | Renderer verification remains last in the body feature |
| 3.3 | 3.1 | Journal adapter is now the first journal-owned subtask |
| 3.4 | 3.2 | Daily check-in UI |
| 3.5 | 3.3 | PostgreSQL API persistence |
| 3.6 | 3.4 | Profile isolation and service status |
| 3.7 | 3.5 | Journal setup documentation |

## 1. Establish the application and body-map contract

- [x] 1.1 Establish one Next.js App Router application with React/TypeScript, a browser-only Three.js component boundary, and Node-runtime Route Handlers for server operations, without removing unrelated files; verify development startup, production build, and direct page loading succeed without browser-global or hydration errors.
- [x] 1.2 Select or author the mannequin, audit unique UV islands, and record license/provenance plus the body-map version; verify the asset and attribution are present and front, back, hands, and both legs can be inspected.
- [x] 1.3 Implement the body scene, lighting, orbit controls, named camera views, and separate Paint/Rotate modes; verify rotation reaches all surfaces and a paint-mode drag does not move the camera.
- [x] 1.4 Define shared entry, pain-type, region, version, and local-date contracts; verify validation rejects invalid dates, unknown regions, and unsupported versions and document the body coordinate convention.
- [x] 1.5 Use the `frontend-design` skill to establish the non-3D application UI direction, navigation, palette, typography, responsive layouts, and accessible control conventions; verify a documented design plan covers check-in, history analysis, and report screens while keeping the body visually dominant.

## 2. Owner A — body editor, pain effects, measurements, and map encoding

Own the task 1 body renderer/asset files and all body/map implementation. Supply reusable editable/read-only load/snapshot/camera/capture operations to B/C/D, plus server-safe map utilities. Consumers must not import browser-only scene code on the server. Put body feature tests/docs in the dedicated paths from the design; request shared contract/package/runner changes through B. Publish the usable interfaces and pure modules from 2.3, 2.6, and 2.7 early to unblock consumers while effects/UI are tuned; the checklist order does not require delaying those handoffs. Other owners can develop against the agreed interfaces while this feature is in progress.

- [ ] 2.1 Implement raycast-to-UV soft painting for one independent intensity buffer with brush size and a 1–10 intensity slider; verify strokes stay attached during rotation and misses outside the body create no marks.
- [ ] 2.2 Add island gating, seam handling, stroke interpolation, and pointer capture/cancellation; verify rapid strokes do not leave gaps or connect unrelated surfaces and front painting does not mark the back.
- [ ] 2.3 Extend painting to four independent layers with selected-layer erasing and bounded undo, and expose the agreed editable/read-only load/snapshot/camera/front-back capture interface for consumers; verify overlapping sensations survive erasing, undo restores the prior map without changing other layers, snapshots do not alias mutable buffers, and read-only restoration/capture cannot change the check-in draft.
- [ ] 2.4 Implement and visually tune burning shimmer, sharp flicker/spikes, aching pulse, and tingling static; verify each effect matches its labeled type and reduced-motion mode retains identifiable static patterns.
- [ ] 2.5 Use `frontend-design` for the brush toolbar, intensity/size controls, legend, rendering-error message, and responsive layout around the body; verify usable mouse/touch controls, visible keyboard focus, and distinct selected/error states without applying this skill to the model or shaders.
- [ ] 2.6 Create the versioned region-ID atlas and shared measurement reducer; verify known lower-back and patient-left-calf patches map correctly and tests cover mean, peak, coverage, threshold behavior, and untouched regions.
- [ ] 2.7 Add lossless map encode/decode and payload validation as reusable browser/Node-compatible utilities; verify all four buffers round-trip exactly, malformed images, dimensions, oversized notes/maps, and incompatible body versions are rejected visibly, and server consumers can use the utilities without browser globals.
- [ ] 2.8 Verify renderer resource cleanup, remount behavior, and at least 30 FPS painting on the demo laptop; document the observed device, limits, and body interface usage independently of the non-3D UI design work.

## 3. Owner B — daily check-in, persistence, and profile access

Implementation progress on `feat/pain-map-journal-task-3`: repository contracts, both adapters, SQL migrations, session/API access, date/note drafts, service disclosure, and feature tests/docs are implemented for review. The user requested all independent B work while A is in progress. Real editor/PNG/reducer integration, C's immutable Maya source, and the final setup/usability checks remain pending; no subtask below is checked off based only on structural fixtures. See `docs/journal.md` for the precise A/C handoff and verification boundaries.

Own the journal feature and shared-file integration. Establish the bounded repository read/write interface with C/D before they depend on it. Use A's encoder/validator/reducer rather than reimplementing them; import C's immutable Maya fixture through the agreed repository boundary. The date/note form and contract tests can start independently. Storage-mode and visitor/account scope remain decision gates for affected implementation; do not silently build both modes or remove an unapproved option. Ship journal tests/docs with this group.

- [ ] 3.1 Implement the IndexedDB journal adapter with per-profile/date upserts and acknowledged save states once the storage-mode decision is resolved, exposing the shared bounded list/read/upsert repository contract; verify a reload restores the exact map/note, repeated saves create one daily entry, rejected writes preserve the draft, and reads distinguish missing entries from saved empty maps.
- [ ] 3.2 Add date selection, written notes, previous-record copying, explicit empty check-ins, and draft state, composing A's editor inside the check-in page; verify copying identifies its source, does not mutate the original, and skipped days stay unrecorded, then time a previous-map edit against the 30-second usability target.
- [ ] 3.3 Add the PostgreSQL API persistence using `pg`, plain SQL migrations, ordinary daily-entry and regional-observation tables, and transactional daily upserts through the same repository contract; verify local PostgreSQL saves/reloads an entry and replacing a day's map replaces its measurements atomically without requiring TimescaleDB or a cloud service.
- [ ] 3.4 Add session-bound visitor isolation, same-origin mutation checks, immutable synthetic-profile access, independent service-status labels, and server-only secrets once the profile/account scope is resolved; verify a second session cannot read/write the first session's entries and a server failure does not silently switch stores.
- [ ] 3.5 Document the agreed persistence mode, repository interface, local PostgreSQL setup/migration, map versions, and configuration in journal feature documentation and the project README; verify the documented setup saves and reloads a check-in without a cloud database or Gemini credentials.

## 4. Owner C — Maya, history playback, trends, and comparison

Own the history route/UI, synthetic fixture generation, playback state, and shared pure analysis module. Start pure functions, missing-day/cancellation tests, and UI against typed test fixtures while A/B build their producers. This group is complete only after the real handoffs are verified: 4.1 uses A's painting/reducer/encoding pipeline; map restoration uses A's read-only viewer and B's repository. Export the same analysis for D; no second report-specific trend implementation. Keep fixture scripts, tests, and demo documentation in C's paths. Coordinate 4.7's cross-feature rehearsal with B and the other owners.

- [ ] 4.1 Build reproducible Maya fixtures for September 6–October 17, 2026 through the normal map/reducer pipeline; verify 42 check-ins, lower-back aching on 38 recorded days, left-thigh burning first on October 3, and later calf coverage agree with the generated maps and notes.
- [ ] 4.2 Add profile switching and a calendar-date scrubber that restores exact saved states and notes; verify Maya is labeled synthetic/read-only, visitor data remains separate, and returning to the visitor restores that profile.
- [ ] 4.3 Implement play/pause, end-of-range stop, small-window map prefetching, and cancellation on scrub/profile change; verify playback is chronological and read-only and stale loads cannot replace the selected date's map.
- [ ] 4.4 Add missing-day, no-history, and one-entry states; verify unrecorded dates never appear as pain-free and playback is disabled when fewer than two recorded entries are available.
- [ ] 4.5 Implement pure browser/Node-compatible shared analysis functions and a region/type trend view showing daily peak intensity, coverage, recorded-day frequency, and first/last presence, with profile/range/source-entry references for D; verify exact fixture values and tests for empty entries and missing-date gaps, including operation without browser globals or Gemini.
- [ ] 4.6 Add two-date map comparison with regional intensity/coverage changes and newly/no-longer-marked regions; verify Maya's thigh-to-calf changes match the source entries and narrow screens retain a clearly labeled comparison.
- [ ] 4.7 Document and rehearse the core demo of 3D visitor painting followed by Maya playback, trends, and date comparison, with the report as a supporting final step; verify painting and all 42 days of analysis run with external services disabled and the fixture regeneration command is reproducible.

## 5. Owner D — appointment report, summary, and printing

Own report presentation, report API, evidence composition/validation, summary/fallback, and print styles. Start empty states, typed evidence tests, and print layout with test fixtures after agreeing interfaces. Final acceptance depends on A's map utilities/capture, B's saved-entry repository, and C's shared analysis/Maya fixtures. Never modify their producer files or implement parallel storage/analysis logic. Gemini's first-increment scope remains unresolved; gate affected provider work on that decision. Put report tests and configuration/print documentation in D's paths and request README/root-config updates through B.

- [ ] 5.1 Reuse the timeline's shared analysis to build report evidence and add range-composite map generation; verify report facts match the timeline, with tests for profile/range isolation, composite-map values, and exclusion of unsaved drafts.
- [ ] 5.2 Build the report view with front/back composite captures, legend, date range, recorded/missing counts, compact regional observations, timeline, and descriptive disclaimer; verify Maya's report matches the fixture evidence and empty ranges do not generate content.
- [ ] 5.3 Implement the server-side Gemini summary adapter, structured evidence references, validation, constrained sentence rendering, timeout, and retry; verify changed counts, unknown evidence, note-based instruction attempts, diagnostic prose, and invented medication details cannot become accepted report claims.
- [ ] 5.4 Add accurately labeled deterministic fallback and independent Gemini status; verify the report remains usable with no key, provider errors, timeouts, and invalid responses and no fallback is labeled as live Gemini output.
- [ ] 5.5 Add A4 and Letter print styles and browser Print/Save as PDF; verify Maya's default report is one readable page with no navigation, a labeled range composite, and patient-attributed context preserving partial-relief wording.
- [ ] 5.6 Document Gemini configuration, summary boundaries, evidence validation, and fallback behavior; when credentials are available, verify one live report request and record the observed provider/model, otherwise explicitly record the live-verification limit.

## 6. Owner B leads — integrate and verify all four features

All four owners supply their feature's passing checks and assist with the assembled demo. B owns shared test-runner/config changes and central checklist updates, and coordinates cross-feature fixes; route fixes inside A/C/D-owned files back to that owner. This group is for integration checks after each feature ships its own tests/docs, not a substitute for those checks.

- [ ] 6.1 Run focused automated checks for map round trips, region attribution, daily upserts, missing days, playback cancellation, regional trends, date comparisons, and report evidence, plus the Next.js production build; verify the checks pass with no external credentials required.
- [ ] 6.2 Rehearse visitor 3D painting → Maya's six-week playback → regional trends/date comparison → supporting appointment report in desktop and narrow touch layouts; visually review the application UI against `frontend-design` and verify both selling points work clearly, with no console errors, clipped controls, profile leaks, or mismatches between maps and analysis/report observations.
- [ ] 6.3 Rehearse the same path against local PostgreSQL with Gemini unavailable and, if included/configured, live Gemini; verify storage and summary labels accurately identify each mode and failed database saves retain the draft.

## Deferred optional increments

- Voice capture and Gemini extraction are outside the core tracked checklist. If explicitly brought into scope after the core works, add extraction/review tasks with tests for microphone denial, unsupported input formats, omitted/invented facts, provider failure, source-note retention, and discardable suggestions before implementing them.
- Extra charts inside the printable report are optional after the readable one-page report works. Add them only if they preserve required content and the A4/Letter print checks. The timeline's basic regional trends and date comparison are core work and are not included in this deferral. If time runs short, omit voice first and extra report charts second.

## Workflow follow-up

- Use the approved four-owner assignments when applying future tasks. This planning revision itself implements no additional feature; each owner works only on their assigned requested task and commits, pushes, and creates a PR under the user's Git workflow. Merge only with explicit permission.
- Archive the change only after implementation is complete and the user requests the archive workflow; identify any deliberately deferred optional work accurately.
