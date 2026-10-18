# Proposal

## Why

The appointment report summarizes a date range but includes only three shortened note excerpts. A person sharing the PDF needs all saved check-ins for that range alongside the summary so the original dated record is available at the appointment.

## What Changes

- Preserve the current appointment summary as the first printed page for the default six-week report.
- Append a section titled **Logs**, starting on the next printed page and continuing for as many pages as needed.
- List every saved check-in within the selected inclusive date range, oldest first, with its saved date, complete written note when present, and recorded regional pain details.
- Include explicitly saved empty maps; omit dates with no saved check-in. Keep logs scoped to the active You or Maya profile and refresh them with the report selection.
- Show the same logs in the report preview so PDF contents can be reviewed before printing.
- Use separate fixed-height preview sheets matching the summary sheet. Automatically move overflow to another sheet, repeating the date when a long entry continues.
- Replace the whole-document one-page expectation with a one-page summary plus complete logs. This intentionally supersedes the conflicting print expectation in the unarchived `pain-map-journal` change; the first-page summary remains compact.

## Capabilities

### New Capabilities

- `appointment-report-logs`: Complete dated check-in records appended to the appointment report, with readable multipage printing.

### Modified Capabilities

None. There are no main specs under `openspec/specs/`; the related appointment-report requirements currently live in the unarchived `pain-map-journal` change. Its one-page whole-report requirement must be reconciled when these changes are synced or archived.

## Impact

- Report rendering and print styles in `src/report/report-view.tsx` and `src/report/report.module.css`; a dedicated log component may keep the report readable.
- Reuse the already filtered and sorted `ReportModel.entries` and existing labels/date formatting; no database, API, Gemini, or paint-map format changes are needed.
- Update `tests/browser/report-appointment.spec.ts` to cover complete logs and multiple PDF pages on A4 and US Letter, replacing its current one-page whole-document assertion.
- Planning assumes a text log containing date, full note, and regional sensation/intensity/coverage measurements. Per-check-in 3D images, new charts, editing, and export formats beyond browser print are outside scope.
