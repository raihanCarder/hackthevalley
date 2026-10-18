# Proposal

## Why

A single pain score leaves out location, sensation, and how pain changes between appointments. This project's two main selling points are painting pain directly on a three-dimensional body and analyzing its evolution over time; these must lead the MVP and demonstration, with appointment reporting as a supporting feature.

## What Changes

- Add an interactive 3D mannequin patients can rotate and paint, with intensity control and distinct animated treatments for burning, sharp, aching, and tingling pain.
- Add a quick daily check-in that starts blank or copies the previous recorded map, accepts an optional written note, and saves both the paintings and structured measurements by body region.
- Add chronological scrubbing, playback, and regional trend analysis of saved maps, including a clearly labeled synthetic patient, Maya, whose lower-back pain develops into left-leg burning over 42 days. Core analysis includes intensity/coverage trends, recorded-day frequency, and comparison between two saved dates, including newly marked regions.
- Add a one-page appointment report with worst-area maps, a timeline, regional observations, and a Gemini-generated descriptive summary grounded in recorded data. State explicitly that the report does not provide a diagnosis.
- Use ordinary PostgreSQL for configured server-side persistence; no Tiger Data service, TimescaleDB extension, or hypertables are required. Keep secrets on the server and synthetic data separate from visitor entries. You is one persistent journal in local PostgreSQL; Maya is the fixed read-only sample. The profile icon switches the entire application. Historical browser and visitor data is preserved.
- Treat voice capture and Gemini extraction of note context as a stretch increment. Cut voice first, then extra report charts; protect 3D painting, animated pain types, timelapse, and basic longitudinal analysis ahead of report polish.

## Capabilities

### New Capabilities

- `pain-painting`: Rotating and painting a UV-mapped body, pain-type visualization, intensity, correction, and body-region measurements.
- `daily-pain-journal`: Date-specific check-ins, previous-entry reuse, notes, durable map storage, profile isolation, and optional note extraction.
- `pain-timeline`: Replaying and comparing recorded daily maps, analyzing regional intensity/coverage and frequency over time, missing-day handling, and the synthetic Maya demonstration.
- `appointment-report`: Preparing and printing a bounded, evidence-based summary of recorded locations, sensations, changes, and patient-reported context.

### Modified Capabilities

None. The project has no existing capability specifications.

## Impact

- Greenfield web application in this repository; no existing working application or API is being replaced. The incomplete, uncommitted starter created before planning is not an approved architecture or implementation baseline.
- Stack: Next.js App Router with React and TypeScript, Three.js for browser graphics, Next.js Route Handlers on the Node.js runtime for persistence/analysis and server-side Gemini calls, and ordinary PostgreSQL accessed through `pg`. One Next.js application owns the interface and backend; exact versions are chosen during implementation. The stack table is in `design.md`; the implementation order is in `tasks.md`.
- New data: versioned paint-map snapshots, per-region daily measurements, optional notes, and report evidence. Body mesh and region atlas must be versioned together, with license provenance for any external asset.
- Server configuration for PostgreSQL and Google Gemini. The user has authorized completing the checklist and confirmed Gemini, with the key to be entered by the user. Use the approved two-profile device-local flow without production accounts.
- Scope is a hackathon prototype using synthetic data and temporary visitor drawings. Accounts, production clinical storage, diagnosis, treatment advice, automated risk alerts, EHR integration, and public deployment are outside this change.
