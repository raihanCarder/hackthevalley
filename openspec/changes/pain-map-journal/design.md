# Design

## Context

See `proposal.md` for motivation and the four capability deltas for observable behavior. The repository originally contained Git workflow instructions, optional OpenSpec setup, and a local prize brief. There are no existing main specs, working application, database migrations, or tests to preserve. The abandoned starter created before planning is not an architecture baseline. The user has selected Next.js and identified 3D body painting and pain analysis over time as the two main selling points. This change creates planning artifacts only.

The intended setting is a laptop-first hackathon demonstration in a browser, with usable touch controls. The user wants a workable MVP and has explicitly allowed ordinary PostgreSQL. Real integrations must be independently demonstrable rather than implied by fixture data. No time-series service or database extension is required.

### What we are building

One Next.js application centered on two experiences: painting pain directly on a rotatable 3D body, and exploring how recorded pain changes over time through playback, regional trends, and comparisons. A printable appointment report supports those experiences. Maya is a clearly labeled sample profile with 42 days of synthetic history. Painting, four pain effects, saved history, playback, and basic longitudinal analysis are the protected core; voice input, automatic note extraction, and extra printable-report charts are deferred.

### Tech stack

| Layer | Choice | Why it belongs in this MVP |
| --- | --- | --- |
| Application | Next.js App Router + React + TypeScript | One app for the 3D check-in, longitudinal analysis, and supporting report |
| Graphics | Direct Three.js + custom shaders | Rotate the mannequin, paint using UV hits, and animate pain types |
| Backend | Next.js Route Handlers on the Node.js runtime | Daily records, analysis queries, and server-only AI requests in the same application |
| Persistence | PostgreSQL + `pg` + plain SQL migrations | Ordinary tables for daily entries and regional measurements |
| AI | Gemini API, pending first-increment confirmation | Descriptive report summary; a factual report remains usable without AI |
| Export | Browser Print / Save as PDF | Avoid an additional PDF generation service |

The architecture is browser → Next.js Route Handlers → PostgreSQL, with a server-side call to Gemini when enabled. The Three.js renderer lives behind a browser-only component boundary. The detailed build sequence is in `tasks.md`.

### Pending MVP scope clarification

Two questions are awaiting the user: whether this is a single-person local demo or a hosted app with private accounts, and whether live Gemini belongs in the first increment. The existing visitor-session/browser-fallback design below remains a draft until that answer; it is not authorization to build account infrastructure or a second storage engine. The recommended smaller MVP is one local editable profile plus read-only Maya, PostgreSQL as the only persistent store, and a factual report with optional configured Gemini.

## Goals / Non-Goals

**Goals:**

- Keep painting coordinates, saved maps, regional measurements, playback, and reports aligned to one versioned body-map contract.
- Prioritize the quality of direct 3D painting and understandable analysis of pain over time; these are the two acceptance gates for a convincing MVP.
- Deliver basic region/type intensity and coverage trends, recorded-day frequency, and two-date comparisons without depending on AI or report generation.
- Separate the responsive graphics loop from persistence and AI latency.
- Make the three-part judging demo repeatable: visitor painting, Maya playback, appointment report.
- Establish measurable checkpoints so optional work cannot consume the time needed for painting and playback.

**Non-Goals:**

- Anatomical simulation, medically validated severity scores, or interpreting spread as a diagnosis.
- Production patient identity, clinical data governance, or storing identifiable health records.
- Native applications, multi-device synchronization, collaborative editing, direct PDF generation, or deployment in this proposal.

## Decisions

### 1. One Next.js application with browser-only graphics

Use the user-selected Next.js App Router with React and TypeScript. Keep API endpoints in `app/api/**/route.ts` using the Node.js runtime, with server-only `pg` access and Gemini requests. This keeps interface and backend in one project and development process. Direct Three.js keeps the UV pipeline and shader lifecycle explicit; React Three Fiber is an alternative abstraction but is not required for the MVP.

Mount the body scene through a Client Component wrapper that dynamically imports the renderer with prerendering disabled, so canvas, WebGL, pointer events, and offscreen paint buffers are initialized only in the browser. Keep the page shell and loading/error states separate from the renderer. Navigation and remounting must release graphics resources and retain saved entry state. Database connections and secrets belong only in server modules. This boundary follows the official [Next.js lazy-loading guidance](https://nextjs.org/docs/app/guides/lazy-loading); endpoint organization follows [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers).

Organize by responsibility beneath the Next.js app shell: `body/` owns rendering, UV coordinates, region attribution, and resource disposal; `journal/` owns entries and storage adapters; `timeline/` owns playback, trends, and comparison; `report/` owns print rendering and summary selection; `demo/` owns reproducible fixtures. Shared analysis functions supply both the timeline and report. React controls state and UI; a body controller exposes load, snapshot, undo, and camera operations. Shader time does not drive React renders.

Use a shared domain package or directory for input validation, region IDs, entry versions, and report evidence. The backend recomputes or verifies regional values from submitted maps rather than trusting client-provided report counts.

### 2. One licensed, stylized body with a fixed atlas

Select a clean neutral mannequin with non-overlapping UVs and accessible limbs. Freeze the model before authoring its region atlas. Record the source URL, author, exact license, local license text, and any required attribution alongside the asset. Do not assume a downloadable mesh is CC0. If a suitable licensed asset cannot be obtained, author a procedural mannequin with unique UV islands and record its provenance; the painting contract remains the same.

Model and region atlas share a `bodyMapVersion`. Atlas changes require a new version; the prototype rejects incompatible snapshots rather than remapping silently. Patient-left and patient-right are fixed in model space, independent of the camera.

Use stable IDs for head, neck, front upper/lower torso, back upper/lower torso, pelvis, and bilateral upper arms, forearms, hands, thighs, calves, and feet. A hidden lossless ID texture maps valid body texels to regions; unused atlas texels have an invalid ID. Nearest-neighbor lookup prevents blended IDs. A parallel island mask prevents marks bleeding onto an unrelated UV island. Test front/back, patient-left/right, seams, hands, and adjacent limbs before building data features.

An arbitrary imported mesh without a documented UV and region contract is rejected: attractive rendering alone is insufficient for reliable measurements.

### 3. CPU paint maps are the source of truth

Keep four independent 512 × 512 unsigned-byte intensity buffers, one per pain type. Their values represent 0–10 on a normalized scale. Offscreen canvases expose them as linear-data textures. For each stroke, raycast the visible mesh, convert hit UV to the canvas coordinate convention, and stamp a soft circle into the active buffer. Restrict writes to the hit island, wrap only documented seam neighbors, and interpolate successive hits within the same island so fast dragging does not leave gaps or connect separate surfaces.

Use maximum blending for a paint stamp: the target value is the larger of the existing value and the selected intensity multiplied by radial falloff. Repeated hovering does not inflate a selected intensity. Erasing reduces the active layer; repainting at a lower intensity requires erasing first. Pen pressure scales intensity only when supported, while the slider always remains available. Pointer capture, cancel handling, and explicit Paint/Rotate controls prevent a drag from invoking both operations. Pinch/scroll zoom and named front/back views supplement orbit rotation.

Bound undo history to ten completed strokes using buffer patches, not an unbounded image stack. Dispose textures, materials, geometry, event handlers, and animation loops on unmount. A rendered screenshot is not the saved map: it loses hidden surfaces and is camera-dependent.

### 4. Effects communicate sensation without altering data

A single body material samples four paint textures, blends their contributions with a neutral surface, and uses time-dependent procedural patterns: slow thermal noise for burning, sparse flicker and radial spikes for sharp pain, a slow purple luminance pulse for aching, and blue high-frequency sparkles for tingling. Spikes are shader marks on the surface rather than geometry growth. Overlapping layers remain stored separately, with a deterministic normalized visual blend and labels for identification.

Use restrained studio lighting and a clear silhouette. Display a usable static body before any optional decorative transition. Reduced motion freezes procedural effects while retaining pain colors and static identifying patterns. Cap device pixel ratio and begin with modest mesh density; target at least 30 frames per second while painting on the demo laptop. Avoid bloom and additional render passes until this target is met. WebGL failure shows an explicit state; do not substitute an inert image that appears paintable.

### 5. Store exact maps and derived observations together

Proposed domain records:

| Record | Fields |
| --- | --- |
| Daily entry | ID, profile ID, local date, time-zone label, updated timestamp, schema version, body-map version, four compressed intensity maps, optional original note, optional reviewed context |
| Regional observation | Entry ID, local date, region ID, pain type, mean intensity, peak intensity, map coverage |
| Reviewed context | Patient-reported triggers, medication names, activities, relief descriptions, source note references, review status |
| Report evidence | Profile and range, recorded/missing days, per-region presence counts and first dates, observed location changes, source-entry references |

Use a single shared reduction rule: a texel value below 13/255 is treated as unpainted to exclude soft-edge residue; mean intensity includes zeros across all valid texels in the region; peak is the maximum; coverage is the fraction at or above that threshold. A region/type is present when coverage is nonzero. This threshold is a rendering/data convention, not a clinical threshold. Call coverage “map coverage,” since UV area is not skin surface area. Do not add the intensities of different pain types into a supposedly clinical total.

Persist the paint buffers as losslessly compressed PNGs and validate dimensions, type, version, and total payload size before decoding. Cap a complete check-in payload at 6 MiB, the original note at 4,000 characters, and daily history queries to a bounded requested range. Initial timeline queries load dates and measurements; decode images on demand and prefetch the next two days rather than retaining all 42 decoded days.

Use an explicit local calendar date, not a UTC conversion of midnight. Uniqueness is per profile/date. An explicit empty saved map is an observation; the absence of an entry is not.

### 6. Two explicit persistence modes

Default credential-free demonstration storage is IndexedDB, which handles binary snapshots without localStorage's tight text quota. A storage adapter makes browser-local and server-backed operations consistent. Show the active mode and preserve drafts on rejected writes. A server outage does not silently switch the active store; an explicit user choice is required to use a different store.

For server persistence, use ordinary PostgreSQL tables: `daily_entries` holds profile/date metadata, compressed snapshots, and notes; `regional_observations` holds the region/type measurements for an entry. Use a unique profile/date key for entries and a unique entry/region/type key for observations. A transaction upserts the entry, deletes that day's previous measurements, and inserts the replacement set. No TimescaleDB extension, hypertable, time partitioning, or Tiger Data account is required. Parameterize queries and return saved revisions to the client. A local PostgreSQL instance is sufficient.

Use a server-issued, high-entropy session cookie to identify temporary visitor profiles; do not accept a caller-selected visitor profile ID as authorization. Cookies are HttpOnly and SameSite, Secure outside local development. Reject cross-origin mutations. Maya comes from an immutable fixture endpoint and cannot be updated. Keep secrets in server environment variables and out of client bundles, logs, and reports. Require an explicit processing action before transmitting a note to Gemini. This limited isolation supports a synthetic-data demo; it is not production patient authentication.

Proposed routes are a service-status endpoint, session bootstrap, bounded daily-entry listing, date-specific entry read/upsert, report generation, and optional note extraction. Services report configured/unavailable/error status accurately. Gemini credentials and database credentials remain independent.

### 7. Replay and analyze recorded states using the same pipeline

The slider spans calendar dates. Playback advances one date at a time, displays a distinct no-check-in state for missing dates, and stops at the end. Load the exact four maps for each recorded day; do not interpolate intermediate observations. Scrubbing, leaving the timeline, or changing profiles cancels playback and any outdated pending map load. Keep draft editing separate from read-only playback state.

Analysis is a first-class part of the timeline screen. For a selected region and pain type, show daily peak intensity on the 0–10 scale, map coverage, recorded-day frequency, and first/last recorded presence within the selected range. Use a compact trend plot and a small facts panel beside the body; a simple SVG plot is sufficient, with no new chart library required. Explicit empty check-ins contribute zeros; missing dates show gaps. Explain that intensity and map coverage are different measurements.

Allow selection of two saved dates and compute changes in peak intensity and coverage for each region/type. Identify newly marked and no-longer-marked regions between those dates, using the existing presence threshold. Show the two maps side by side or provide a labeled before/after toggle on narrow screens. Use descriptive wording such as “left calf first recorded on October 10”; do not infer clinical progression, a diagnosis, or a cause. These calculations are deterministic, derived from saved records, and available without Gemini. Report generation reuses this analysis rather than introducing a separate set of facts.

Generate Maya deterministically from a fixed seed and fixed dates: September 6–October 17, 2026, inclusive. Record lower-back aching on 38 of 42 days, leaving four explicitly saved empty early maps. First paint left-thigh burning on October 3, then progressively extend it toward the calf. Store all 42 daily maps, derive their measurements using the same region reducer, and attach synthetic notes that support the sitting and partial-relief narrative. Report counts are computed from these records, never separately hardcoded. A seed script or checked-in fixture build makes the demonstration reproducible without runtime AI or a database.

### 8. Compute evidence before asking Gemini to summarize

Aggregate saved observations into a compact evidence object with entry references and exact counts, dates, and region/type facts. A worst-area composite takes the maximum value per texel across the selected range and is explicitly labeled as a range composite. It does not imply all marked pain occurred simultaneously. Use the same evidence for charts, tables, and AI inputs.

Gemini is a server-side optional provider. Request structured output describing an ordered summary plan: supported observation kinds, evidence IDs, region/type IDs, counts/dates, and reviewed context references. Validate those fields against server-computed evidence and render the accepted plan through bounded descriptive sentence templates. This allows Gemini to select and organize salient observations while preventing unconstrained diagnostic prose from becoming report content. Free-form notes are quoted data, never instructions. Reject unknown evidence, changed quantities, invented medication attributes, and unsupported claims; on rejection, use the labeled deterministic summary. Do not stream unvalidated model text directly into the report.

Use a server-configured model, bounded request size, a request timeout, and a user-triggered retry. Keep the report usable during generation. Clearly distinguish live Gemini output, deterministic fallback, and synthetic demonstration data. External-provider errors preserve all report evidence.

The printable report uses fixed front/back body captures, compact regional observations, a six-week timeline, and a short summary. Bound the number of summary statements and use a compact region table for all recorded regions. Optional charts display selected regions and are omitted before required content is compressed into illegibility. Verify the default Maya report fits A4 and Letter at normal print scale; longer arbitrary notes are summarized rather than printed in full. Browser printing supplies Save as PDF without another PDF dependency.

### 9. Voice follows the working core

Written notes work first. If time permits, add microphone capture with capability detection and explicit permission, a short-duration limit, and a typed fallback. Send audio to a supported server-side Gemini input or transcribe through an explicitly supported provider, then request structured triggers, medications, activities, and qualified relief. Verify provider formats during implementation rather than assume browser speech recognition is universal. Show editable suggestions and require review before persistence. Do not retain raw audio after processing in the prototype.

Voice and extraction are a separately identified stretch increment. Omitting them does not remove daily written notes or the report summary. Extra charts inside the printable report are the next removable increment. Painting, four sensory effects, saved records, Maya playback, and the timeline's basic trends and date comparison remain the protected demonstration path.

### 10. Calm controls around a vivid body

Use the repository's `frontend-design` skill for application UI: navigation, screen composition, toolbars, forms, timeline and comparison controls, trend presentation, report layout, responsive behavior, and accessible states. This requirement excludes the 3D models, UV/painting algorithms, lighting, and pain shaders. The toolbar and page layout surrounding the 3D canvas are application UI and must follow the skill. Read its instructions and establish the UI direction before implementing those screens, then visually review the rendered result.

Propose an off-white background, dark green text, muted sage controls, and a pale neutral body stage. Reserve red-orange, purple, blue, and bright white for the pain meanings. A humanist sans-serif with clear numeric forms supports daily use. Do not fix a product name during implementation without review; “pain journal” is sufficient for the prototype.

Desktop gives the 3D body the dominant visual area beside compact brush controls and a save/note panel. The timeline keeps the body prominent while adding a date scrubber, regional trend plot, and comparison controls. Keep reporting secondary in navigation and in the demo. On narrow screens, stack the body above controls and preserve touch targets. Include visible keyboard focus, labeled ranges and buttons, named camera views, and unsaved-draft state. The 30-second check-in is a usability target to test with a previous-map edit, not an unsupported performance claim.

## Risks / Trade-offs

- [UV distortion, seams, or overlapping islands misplace marks] → Audit the model/atlas together and test known locations from multiple camera views before persistence work; replace the mesh if its UV contract is unsuitable.
- [Mean intensity hides a small intense patch] → Retain peak intensity and coverage alongside the mean and report sensations by region rather than one global pain number.
- [Supporting features consume time needed for the selling points] → Gate work on compelling 3D painting and working longitudinal analysis before report polish; voice and extra report charts remain removable increments.
- [Sparse or artificial history looks like a clinical prediction] → Label Maya synthetic and describe recorded changes without diagnosing or inferring causes.
- [Cloud dependencies fail during judging] → Ship local fixtures, local persistence, and a visibly labeled deterministic report; rehearse a separate live integration check when credentials are configured.
- [AI fabricates facts or follows note instructions] → Validate structured references against computed evidence and render constrained descriptive sentences; reject unsupported output.
- [Large snapshots cause quota or playback stalls] → Compress sparse maps, limit payloads, prefetch a small window, and retain drafts on storage failures.
- [Temporary session isolation is mistaken for production readiness] → Scope the prototype to synthetic records and temporary drawings; production identity and data policy require a separate change.

## Migration Plan

No existing records require migration. During the later apply workflow, first reconcile the incomplete starter with this reviewed plan, then add the application and versioned body assets. Introduce an ordinary PostgreSQL schema migration and fixture seed command; verify daily save/reload behavior against local PostgreSQL. Verify live Gemini separately if it is included and configured. Resolve the pending MVP scope questions before implementation.

Do not publish or commit as part of this proposal. For later rollback, retain versioned fixtures and the previous schema; disable optional service adapters without changing the selected store or deleting entries. A body-map contract change requires a new version and explicit compatibility handling rather than overwriting prior maps.
