# Maya profile and appointment report UI task

## Goal

Make Maya use the same journal workspace and visual structure as You, while keeping Maya's synthetic records fixed and read-only. Improve the appointment report's controls and empty state, including alignment between the profile label and date inputs.

## Implementation checklist

- [x] Replace Maya's separate preview with the shared body workbench and check-in details layout.
- [x] Keep Maya's body map, date, and note browsing read-only; disable mutation actions and prevent writes in event handlers.
- [x] Keep You's workbench and unsaved draft intact while switching profiles; avoid duplicate element IDs in the mounted workbenches.
- [x] Restyle report controls so profile status and actions align with the date inputs on desktop and stack cleanly on narrow screens.
- [x] Create a designed empty state with a clear date range, useful next action, and profile-aware destination.
- [x] Preserve the populated report and print layout.
- [x] Run the relevant existing checks and record any limits.

## Constraints

- Preserve the current charcoal and muted olive visual system.
- Maya remains synthetic, fixed, and read-only; You remains the PostgreSQL-backed profile.
- Preserve pre-existing user changes in the body workbench and browser tests.

## Verification

- The journal and appointment-report browser suites pass: 15 checks.
- Maya's date switch restores the matching note and canvas marks; edit actions remain disabled.
- The report empty state fits phone width, and the profile label aligns with the calendar inputs.
- Populated appointment reports remain one page on A4 and US Letter.
- TypeScript typecheck, production build, and `git diff --check` pass.
