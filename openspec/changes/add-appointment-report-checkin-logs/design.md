# Design

## Context

See `proposal.md` for motivation. `loadSavedEntries` already reads saved maps, notes, and measurements for You from PostgreSQL and for Maya from the fixture. `buildReportModel` filters by profile and inclusive date range, sorts entries oldest first, and retains complete `DailyEntry` records in `model.entries`. Only `noteExcerpts` is limited to three shortened notes.

`ReportView` currently renders one `article.sheet`. Its print styles compact the default six-week summary onto A4 and US Letter and apply `break-inside: avoid` to every section. The browser test currently requires exactly one PDF page. The earlier unarchived `pain-map-journal` appointment-report spec also requires one page for the whole report; this change intentionally revises that expectation to one summary page plus logs. There are currently no main specs to modify.

Existing uncommitted edits affect the report view and browser tests. Implementation must preserve those edits, including the current summary behavior, and review the combined diff carefully.

## Goals / Non-Goals

**Goals:** Use one loaded snapshot for summary and logs, preserve original patient text, and let browser print paginate a complete appendix without changing summary calculations.

**Non-Goals:** No new data fetching, schema changes, per-entry 3D captures, AI calls for logs, or custom PDF renderer. Raw paint-map payloads and storage metadata are not printed.

## Decisions

### Reuse saved report entries directly

Pass `ready.model.entries` to a focused log renderer, optionally in `src/report/check-in-logs.tsx`. Use `localDate` rather than `updatedAt` for the heading so editing an old record does not change its journal date. Render saved notes as escaped React text with preserved whitespace and wrapping for long unbroken strings. Show "No written note." for missing or whitespace-only notes.

Reuse `formatDate`, patient-relative region labels, and `PAIN_LABELS`. Display each recorded observation's mean and peak intensity with a /10 label, and convert its coverage fraction to a labeled percentage using the report's existing rounding convention. Use stable entry identifiers and region/type pairs for rendering keys. Label an explicitly empty check-in "Nothing marked" using the same empty-record semantics as the existing report analysis. Logs are patient records and do not enter the Gemini summary pipeline.

Alternative: derive logs from summary facts or `noteExcerpts`. Rejected because range aggregates and shortened notes lose daily detail. A second endpoint is unnecessary and could produce a different snapshot.

### Separate summary and logs in the report structure

Keep the existing summary content in its own sheet container and place the Logs section after it inside the report document. A separate sheet container lets print rules compact only the summary and lets the preview clearly show the appendix. Give Logs an accessible heading and each entry a dated subheading, complete note, and readable regional measurements. Include profile/range context and retain synthetic identification for Maya in accordance with the project requirements. Apply the frontend-design skill when implementing the surrounding report UI.

Update `src/app/report/page.tsx` copy to describe a summary with dated logs rather than implying the entire PDF is one page. Leave the existing first-page excerpts and summary generation intact.

Alternative: a print-only appendix. Rejected because the preview should expose what will be shared. Alternative: replace the summary with logs. Rejected because the request places logs after the first page.

### Measure fixed preview sheets and keep browser print pagination

The user refined the preview to require separate sheets with the same fixed dimensions as the first summary sheet. Observe the summary's dimensions, including responsive changes and completed body-map captures. Measure log entries in an invisible, inert sheet of the same width and typography. Fill sheets using actual rendered heights, moving ordinary entries intact to a fresh sheet when necessary. Split oversized entries at regional rows and note text boundaries; retain every original character and repeat the date with a continuation label. Recalculate after fonts load, resizing, or record changes. Only preview sheet containers have fixed heights; content is never clipped.

Apply `break-before: page` to each log sheet in print, remove its screen height, and hide the measurement sheet. Keep existing A4/Letter margins and summary dimensions. Scope section break-avoidance to summary content and allow long log fragments to continue naturally if the chosen paper needs additional pages. Keep date headings with following content and protect regional rows. Avoid a final forced page break. Physical PDF page counts can differ from the responsive preview, while both remain complete. The default summary stays on page one; unusually large non-default summaries may need more pages.

Alternative: one expanding preview appendix with browser-only pagination was the initial implementation. It was replaced by measured preview pagination in response to the user's fixed-sheet request. Arbitrary entry counts per sheet cannot accommodate varying note lengths or phone widths.

### Verify PDF content placement as well as page counts

Scope existing summary assertions to its container so added measurement rows do not alter their meaning. Replace the whole-document one-page assertion with checks for a single first-page summary followed by Logs and complete check-in coverage on A4 and Letter. Use a PDF text inspection tool available in the test environment, or record a rendered PDF inspection if extraction tooling is unavailable; a total page count alone cannot prove that Logs starts on page two or that the final note survived.

Exercise inclusive boundaries, profile switching, refresh after a saved edit, explicit empty records, missing days, absent notes, long multiline notes, long unbroken text, and an entry taller than one page. Also verify responsive preview wrapping. Existing empty-report and hidden-controls checks remain relevant.

Verify every preview sheet has the summary's dimensions at phone, tablet, and desktop widths, no content overflows its sheet, and concatenated note fragments reconstruct the original note exactly.

## Risks / Trade-offs

- [Large notes or many measurements can fragment poorly] → Permit entry fragmentation, keep dates attached to content, and inspect long-note PDFs on both supported paper formats.
- [Existing global print selectors can accidentally prevent appendix pagination] → Scope summary print rules deliberately and validate physical PDF page contents.
- [PDF size and page count grow with history length] → Reuse text measurements without per-day images; retain the existing maximum report range of 366 days and include every saved entry.
- [Earlier planning still promises a one-page whole report] → Treat this change's appendix requirement as the updated product decision and reconcile the earlier print requirement when syncing or archiving, without importing its obsolete single-page assertion.

## Migration Plan

No data migration is required. Deploy the renderer and print-style changes together after report browser checks and PDF inspection pass. Rollback removes the appendix rendering/styles and restores the corresponding print assertion; saved journal records remain unchanged.
