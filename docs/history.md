# History & Longitudinal Analysis Architecture

Integrated task 4 implementation.

## Overview

The history feature powers the second core selling point of the pain journal: **analyzing how pain changes over time**. It provides an interactive timeline scrubber, chronological playback, regional trend visualization, date-to-date comparison, and shared evidence calculation.

## Modules and Responsibilities

- `src/timeline/analysis.ts`: Pure, browser- and Node-compatible shared analysis engine. Computes regional trends, date comparisons, and report evidence without React, browser globals, database connections, or AI services.
- `src/timeline/playback.ts`: Chronological playback from the selected date, live speed changes, pause/seek, and end-of-range stops.
- `src/timeline/map-loader.ts`: Eight-entry decoded-map cache; loads the selected map and prefetches the next two calendar dates. Aborted reads are neither displayed nor cached.
- `src/timeline/map-comparison.tsx`: Two labeled read-only saved maps plus regional peak/coverage deltas and missing-date explanations.
- `src/timeline/body-diagram.tsx`: Optional region overview, explicitly schematic. The default 3D BodyViewer restores exact saved layers.
- `src/timeline/trend-chart.tsx`: Lightweight, dependency-free interactive SVG trend chart displaying daily peak intensity and map coverage with visible gaps for unrecorded days.
- `src/timeline/history-view.tsx`: Unified client component combining profile switching, calendar scrubber, visual stage, and analysis rail.
- `src/timeline/timeline.module.css`: Feature-local CSS module adhering to the design system and `frontend-design` principles.
- `src/demo/maya.ts` & `src/demo/maya-data.json`: Immutable synthetic patient dataset (42 days, Sept 6–Oct 17, 2026).
- `scripts/generate-maya.ts`: Reproducible script generating Maya's maps and observations through the standard reduction pipeline.

## Invariants and Behavioral Rules

### 1. Missing Days vs. Saved Empty Maps
- **Saved empty check-in**: An explicitly recorded day with no marked pain. Contributes `0` to intensity and coverage calculations.
- **Unrecorded day (missing check-in)**: A calendar date with no recorded entry. Contributes `null` to daily points, appearing as a visible gap in the trend chart.
- **Recorded-day frequency denominator**: `frequency = presentDays / recordedDays`. Unrecorded dates are excluded from the denominator so missing entries do not artificially depress frequency.

### 2. Presence and Measurement Thresholds
- Texel presence threshold is `13/255` (~0.051). Texels below this value are treated as unpainted soft-edge residue.
- `peakIntensity`: Maximum intensity across all valid texels in the region on the 0–10 scale.
- `mapCoverage`: Proportion of valid region texels with intensity $\ge 13/255$ (0–100%).
- `meanIntensity`: Average intensity across all valid texels in the region. Always $\le$ `peakIntensity`.
- Sensation is considered "present" on a day if `mapCoverage > 0`.

### 3. Date Comparison Without Diagnostic Claims
- Comparing two dates classifies each regional sensation as:
  - `newly-marked`: Unmarked on earlier date, marked on later date.
  - `no-longer-marked`: Marked on earlier date, unmarked on later date.
  - `persistent`: Marked on both dates, computing $\Delta\text{peak}$ and $\Delta\text{coverage}$.
  - `unmarked`: Unmarked on both dates.
- Observations use descriptive statements (e.g., *"Left calf burning newly recorded on 2026-10-10"*). The system explicitly avoids diagnostic claims, causal assertions, or clinical inferences.

### 4. Playback and Cancellation Semantics
- Playback progresses chronologically from start date to end date and stops at the end of the range.
- Scrubbing, stepping, range changes, profile switches, and leaving the page cancel playback and abort outdated map reads/decodes. Selection and loader identity guards prevent late results from reaching the screen.
- Playback is strictly read-only and never modifies saved entries or check-in drafts.
- Playback is disabled when a profile has fewer than two recorded entries.

### 5. Shared Evidence for Appointment Report (Owner D)
`computeReportEvidence` in `src/timeline/analysis.ts` exports the identical aggregated facts, dates, and counts for Milestone 5 (Owner D), preventing duplicate trend or evidence reducers.

## Repository and range integration

Maya reads use the immutable synthetic source. Visitor reads honor the same IndexedDB/PostgreSQL preference as the check-in and report pages. A bounded metadata list supplies analysis; selected/comparison maps and notes are exact date-specific reads. Failures show an error and never become fabricated empty history or another store. Profile switching remembers the selected range/date. Range controls update trends, playback, counts, and comparison dates. A saved empty map contributes zero, a missing date contributes a gap, and comparisons require two recorded dates from the same profile.

Maya's generator imports the actual `PaintEngine`, atlas, intensity conversion, reducer, and lossless encoder. It contains no separate stamp/reducer/PNG implementation. All 42 maps are decoded and re-measured in the credential-free tests; every stored observation must agree exactly. The fixture is deeply frozen, while repository reads return detached copies.

## Acceptance

The browser rehearsal traversed all 42 dates at 2x, verified chronological order, stop-at-end, and cancellation after scrubbing. It verified exact layer hashes after saves/reloads, profile restoration, selected ranges, single-entry playback disabling, missing/empty states, both comparison maps, and saved-only reports. The same daily path passed against real local PostgreSQL with isolated visitor sessions. See [integration verification](integration-verification.md) for commands and limits.
