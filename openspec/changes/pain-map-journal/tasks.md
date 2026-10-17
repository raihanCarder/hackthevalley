# Tasks

The tech stack is summarized in `design.md` under Tech stack. This checklist is the build order, not a list of features already implemented. Use Next.js App Router, TypeScript, Three.js, and ordinary PostgreSQL. The two main selling points are direct 3D body painting and analysis of pain over time; complete both before report polish. Resolve the pending local-user/account and Gemini questions before applying the affected tasks; browser-local fallback and visitor sessions remain draft scope until then.

**Required skill for application UI: use `frontend-design` ([SKILL.md](../../../.agents/skills/frontend-design/SKILL.md)).** This applies to navigation, page layouts, brush controls, daily check-in forms, timeline controls, trend/comparison presentation, report layout, and responsive/accessibility states. Read and apply the skill before building these UI portions. It does not govern the 3D mannequin/model, UV atlas, raycasting, paint-buffer algorithms, scene lighting, or pain shaders. Controls around the 3D canvas are application UI and remain in scope for the skill.

The UI work is tracked in 1.5, 2.5, 3.4, 4.2, the presentation portions of 4.5–4.6, 5.2, and 5.5; visual review is part of 6.2.

## 1. Establish the application and body-map contract

- [ ] 1.1 Establish one Next.js App Router application with React/TypeScript, a browser-only Three.js component boundary, and Node-runtime Route Handlers for server operations, without removing unrelated files; verify development startup, production build, and direct page loading succeed without browser-global or hydration errors.
- [ ] 1.2 Select or author the mannequin, audit unique UV islands, and record license/provenance plus the body-map version; verify the asset and attribution are present and front, back, hands, and both legs can be inspected.
- [ ] 1.3 Implement the body scene, lighting, orbit controls, named camera views, and separate Paint/Rotate modes; verify rotation reaches all surfaces and a paint-mode drag does not move the camera.
- [ ] 1.4 Define shared entry, pain-type, region, version, and local-date contracts; verify validation rejects invalid dates, unknown regions, and unsupported versions and document the body coordinate convention.
- [ ] 1.5 Use the `frontend-design` skill to establish the non-3D application UI direction, navigation, palette, typography, responsive layouts, and accessible control conventions; verify a documented design plan covers check-in, history analysis, and report screens while keeping the body visually dominant.

## 2. Make painting and sensory effects work

- [ ] 2.1 Implement raycast-to-UV soft painting for one independent intensity buffer with brush size and a 1–10 intensity slider; verify strokes stay attached during rotation and misses outside the body create no marks.
- [ ] 2.2 Add island gating, seam handling, stroke interpolation, and pointer capture/cancellation; verify rapid strokes do not leave gaps or connect unrelated surfaces and front painting does not mark the back.
- [ ] 2.3 Extend painting to four independent layers with selected-layer erasing and bounded undo; verify overlapping sensations survive erasing and undo restores the prior map without changing other layers.
- [ ] 2.4 Implement and visually tune burning shimmer, sharp flicker/spikes, aching pulse, and tingling static; verify each effect matches its labeled type and reduced-motion mode retains identifiable static patterns.
- [ ] 2.5 Use `frontend-design` for the brush toolbar, intensity/size controls, legend, rendering-error message, and responsive layout around the body; verify usable mouse/touch controls, visible keyboard focus, and distinct selected/error states without applying this skill to the model or shaders.
- [ ] 2.6 Verify renderer resource cleanup, remount behavior, and at least 30 FPS painting on the demo laptop; document the observed device and limits independently of the non-3D UI design work.

## 3. Measure regions and save daily entries

- [ ] 3.1 Create the versioned region-ID atlas and shared measurement reducer; verify known lower-back and patient-left-calf patches map correctly and tests cover mean, peak, coverage, threshold behavior, and untouched regions.
- [ ] 3.2 Add lossless map encode/decode and payload validation; verify all four buffers round-trip exactly and malformed images, dimensions, oversized notes/maps, and incompatible body versions are rejected visibly.
- [ ] 3.3 Implement the IndexedDB journal adapter with per-profile/date upserts and acknowledged save states; verify a reload restores the exact map/note, repeated saves create one daily entry, and rejected writes preserve the draft.
- [ ] 3.4 Add date selection, written notes, previous-record copying, explicit empty check-ins, and draft state; verify copying identifies its source, does not mutate the original, and skipped days stay unrecorded, then time a previous-map edit against the 30-second usability target.
- [ ] 3.5 Add the PostgreSQL API persistence using `pg`, plain SQL migrations, ordinary daily-entry and regional-observation tables, and transactional daily upserts; verify local PostgreSQL saves/reloads an entry and replacing a day's map replaces its measurements atomically without requiring TimescaleDB or a cloud service.
- [ ] 3.6 Add session-bound visitor isolation, same-origin mutation checks, immutable synthetic-profile access, independent service-status labels, and server-only secrets; verify a second session cannot read/write the first session's entries and a server failure does not silently switch stores.
- [ ] 3.7 Document the agreed persistence mode, local PostgreSQL setup/migration, map versions, and configuration in the project README; verify the documented setup saves and reloads a check-in without a cloud database or Gemini credentials.

## 4. Deliver Maya, the timelapse, and longitudinal analysis

- [ ] 4.1 Build reproducible Maya fixtures for September 6–October 17, 2026 through the normal map/reducer pipeline; verify 42 check-ins, lower-back aching on 38 recorded days, left-thigh burning first on October 3, and later calf coverage agree with the generated maps and notes.
- [ ] 4.2 Add profile switching and a calendar-date scrubber that restores exact saved states and notes; verify Maya is labeled synthetic/read-only, visitor data remains separate, and returning to the visitor restores that profile.
- [ ] 4.3 Implement play/pause, end-of-range stop, small-window map prefetching, and cancellation on scrub/profile change; verify playback is chronological and read-only and stale loads cannot replace the selected date's map.
- [ ] 4.4 Add missing-day, no-history, and one-entry states; verify unrecorded dates never appear as pain-free and playback is disabled when fewer than two recorded entries are available.
- [ ] 4.5 Implement shared analysis functions and a region/type trend view showing daily peak intensity, coverage, recorded-day frequency, and first/last presence; verify exact fixture values and tests for empty entries and missing-date gaps, including operation without Gemini.
- [ ] 4.6 Add two-date map comparison with regional intensity/coverage changes and newly/no-longer-marked regions; verify Maya's thigh-to-calf changes match the source entries and narrow screens retain a clearly labeled comparison.
- [ ] 4.7 Document and rehearse the core demo of 3D visitor painting followed by Maya playback, trends, and date comparison, with the report as a supporting final step; verify painting and all 42 days of analysis run with external services disabled and the fixture regeneration command is reproducible.

## 5. Prepare the appointment report

- [ ] 5.1 Reuse the timeline's shared analysis to build report evidence and add range-composite map generation; verify report facts match the timeline, with tests for profile/range isolation, composite-map values, and exclusion of unsaved drafts.
- [ ] 5.2 Build the report view with front/back composite captures, legend, date range, recorded/missing counts, compact regional observations, timeline, and descriptive disclaimer; verify Maya's report matches the fixture evidence and empty ranges do not generate content.
- [ ] 5.3 Implement the server-side Gemini summary adapter, structured evidence references, validation, constrained sentence rendering, timeout, and retry; verify changed counts, unknown evidence, note-based instruction attempts, diagnostic prose, and invented medication details cannot become accepted report claims.
- [ ] 5.4 Add accurately labeled deterministic fallback and independent Gemini status; verify the report remains usable with no key, provider errors, timeouts, and invalid responses and no fallback is labeled as live Gemini output.
- [ ] 5.5 Add A4 and Letter print styles and browser Print/Save as PDF; verify Maya's default report is one readable page with no navigation, a labeled range composite, and patient-attributed context preserving partial-relief wording.
- [ ] 5.6 Document Gemini configuration, summary boundaries, evidence validation, and fallback behavior; when credentials are available, verify one live report request and record the observed provider/model, otherwise explicitly record the live-verification limit.

## 6. Rehearse and verify the complete demonstration

- [ ] 6.1 Run focused automated checks for map round trips, region attribution, daily upserts, missing days, playback cancellation, regional trends, date comparisons, and report evidence, plus the Next.js production build; verify the checks pass with no external credentials required.
- [ ] 6.2 Rehearse visitor 3D painting → Maya's six-week playback → regional trends/date comparison → supporting appointment report in desktop and narrow touch layouts; visually review the application UI against `frontend-design` and verify both selling points work clearly, with no console errors, clipped controls, profile leaks, or mismatches between maps and analysis/report observations.
- [ ] 6.3 Rehearse the same path against local PostgreSQL with Gemini unavailable and, if included/configured, live Gemini; verify storage and summary labels accurately identify each mode and failed database saves retain the draft.

## Deferred optional increments

- Voice capture and Gemini extraction are outside the core tracked checklist. If explicitly brought into scope after the core works, add extraction/review tasks with tests for microphone denial, unsupported input formats, omitted/invented facts, provider failure, source-note retention, and discardable suggestions before implementing them.
- Extra charts inside the printable report are optional after the readable one-page report works. Add them only if they preserve required content and the A4/Letter print checks. The timeline's basic regional trends and date comparison are core work and are not included in this deferral. If time runs short, omit voice first and extra report charts second.

## Workflow follow-up

- Review these artifacts before starting the apply workflow. No implementation, commit, or publication is authorized by this proposal.
- Archive the change only after implementation is complete and the user requests the archive workflow; identify any deliberately deferred optional work accurately.
