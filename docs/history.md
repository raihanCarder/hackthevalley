# History & Longitudinal Analysis Architecture

Owner C documentation for Task 4.

## Overview

The history feature powers the second core selling point of the pain journal: **analyzing how pain changes over time**. It provides an interactive timeline scrubber, chronological playback, regional trend visualization, date-to-date comparison, and shared evidence calculation.

## Modules and Responsibilities

- `src/timeline/analysis.ts`: Pure, browser- and Node-compatible shared analysis engine. Computes regional trends, date comparisons, and report evidence without React, browser globals, database connections, or AI services.
- `src/timeline/playback.ts`: Playback controller state machine handling chronological playback, small-window prefetching, cancellation on seek/profile change, and end-of-range stops.
- `src/timeline/body-diagram.tsx`: Stylized 2D anatomical map showing front and back views with color-coded sensation highlights and interactive region selection.
- `src/timeline/trend-chart.tsx`: Lightweight, dependency-free interactive SVG trend chart displaying daily peak intensity and map coverage with visible gaps for unrecorded days.
- `src/timeline/history-view.tsx`: Unified client component combining profile switching, calendar scrubber, visual stage, and analysis rail.
- `src/timeline/timeline.module.css`: Feature-local CSS module adhering to the design system and `frontend-design` principles.
- `src/demo/maya.ts` & `src/demo/maya-data.json`: Immutable synthetic patient dataset (42 days, Sept 6–Oct 17, 2026).
- `scripts/generate-maya.ts`: Reproducible script that paints Maya's maps with the body feature's paint engine at real surface points (lower back, front-outer left thigh, then left calf), encodes them with the shared lossless codec, and measures them with the shared region reducer. `tests/demo.test.ts` checks that every mark lies on the body, that stored observations equal a re-measurement of the maps, and that regeneration reproduces the checked-in fixture.
- 3D playback uses the read-only `BodyViewer` with the selected day's decoded maps; a missing day shows an explicit no-check-in message rather than a blank body.

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
- Scrubbing the slider, stepping back/forward, or switching profiles immediately cancels active playback and increments a sequence token to discard any in-flight asynchronous requests.
- Playback is strictly read-only and never modifies saved entries or check-in drafts.
- Playback is disabled when a profile has fewer than two recorded entries.

### 5. Shared Evidence for Appointment Report (Owner D)
`computeReportEvidence` in `src/timeline/analysis.ts` exports the identical aggregated facts, dates, and counts for Milestone 5 (Owner D), preventing duplicate trend or evidence reducers.
