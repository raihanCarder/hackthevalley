# Tasks

## 1. Render complete dated logs

- [x] 1.1 Add a Logs renderer after the summary using the same `ReportModel.entries` snapshot, with saved local dates, full patient notes, absent-note labels, and regional sensation/mean/peak/coverage values. Verify all 42 Maya entries render once in chronological order and measurements match the fixture.
- [x] 1.2 Handle explicitly empty check-ins without generating records for missing days, and preserve full multiline notes as escaped text with wrapping. Add browser coverage for a mixed marked/empty/missing range, absent notes, multiple regional observations, and notes exceeding the summary excerpt limit; verify the tests pass.
- [x] 1.3 Add browser coverage for inclusive date boundaries, active-profile isolation, range changes, and refresh after a saved edit. Verify Logs and summary always agree and the existing empty-report state produces no appendix.
- [x] 1.4 Apply the frontend-design skill to the log preview, retain profile/range context and Maya's synthetic identification, and update report-page copy to describe the summary plus logs. Verify accessible dated headings and no horizontal document overflow at a 390px viewport.

## 2. Print summary followed by log pages

- [x] 2.1 Separate summary and appendix print containers, start Logs on a new page, and scope summary compaction and break-avoidance rules. Update the browser print test to verify the default summary stays on page one and Logs begins on page two for A4 and US Letter, with controls and navigation hidden.
- [x] 2.2 Permit long entries to flow across pages while keeping date headings with following content and avoiding fixed-height clipping or blank trailing pages. Add long multiline/unbroken-note and many-observation fixtures; verify generated PDFs retain the final text and measurement rows on both paper formats.
- [x] 2.3 Scope existing report assertions to summary or Logs as appropriate and replace the single-page whole-report assertion. Verify PDF content placement and all 42 sample dates through available PDF text extraction or a recorded rendered-PDF inspection, rather than relying only on page count.
- [x] 2.4 Paginate the preview into fixed-size sheets matching the summary, move overflow to another sheet, and continue oversized entries without dropping text or rows. Verify equal sheet dimensions, no overflow, and exact note reconstruction after resizing at 390px, 820px, and 1440px.

## 3. Integration verification

- [x] 3.1 Run `npm run typecheck` and the report appointment/provider browser suites against the local test environment; verify summary, report loading, existing empty states, and provider behavior still pass with the appendix present. Record any unavailable checks accurately.
- [x] 3.2 Review the combined diff against pre-existing report edits and inspect the default and long-note PDFs on A4 and US Letter. Verify the first-page summary remains readable, Logs is complete, and no unrelated edits were overwritten.

## Workflow follow-up

- When syncing or archiving the related changes, reconcile `pain-map-journal`'s "Printable one-page report" requirement with this change's one-page summary plus Logs appendix contract.

## Verification record

- `npm run typecheck` passed. Isolated PostgreSQL browser acceptance (`npm run test:local-browser -- report-appointment.spec.ts report-logs.spec.ts`) passed all 11 tests after the fixed-sheet refinement.
- Preview checks verify equal summary/log sheet dimensions, no sheet overflow, exact reconstruction of split notes, and responsive layouts at 390px, 820px, and 1440px. Maya's 42 dates, notes, empty maps, and regional measurements match the fixture.
- Generated default PDFs have 11 pages on both A4 and Letter: summary on page one and Logs starting on page two. Native PDF text extraction verified all 42 dates and all original notes (October 3's note required checking separate extraction spans); visual inspection confirmed the summary/log layout. No blank pages or isolated dated headings were found.
- Oversized-entry PDFs have six pages on both formats. All 20 note paragraphs, long unbroken text, final note text, and regional measurement rows remain present. The note is within the application's 4,000-character limit.
- The fake-provider suite was invoked separately; all four tests remain skipped by the pre-existing temporary Gemini-controls switch. Live Gemini was not exercised. Pre-existing report-view and provider-test edits were checked against the initial workspace snapshot and preserved.
- Production build passed using `PAIN_JOURNAL_DIST_DIR=.next-report-logs-webpack npm run build -- --webpack`. The default Turbopack attempt encountered a sandbox process/port permission failure. Print selectors now retain a local report class so both CSS module parsers accept them. All 11 report browser checks were rerun and passed after this compatibility adjustment.
