# Spec Delta

## Purpose

Provide a complete dated record of saved check-ins alongside the appointment summary so a printed or saved PDF includes the original journal details for the selected range.

## ADDED Requirements

### Requirement: Complete scoped check-in logs
The report SHALL include a section titled "Logs" in its preview and printed output. It SHALL list every saved check-in for the active profile within the selected inclusive date range exactly once, in ascending saved local-date order. It SHALL use the same saved records as the summary and exclude unsaved edits and other profiles.

#### Scenario: Full Maya range
- **WHEN** Maya's full six-week appointment report is prepared
- **THEN** Logs contains all 42 saved synthetic check-ins, dated oldest to newest
- **AND** no records belonging to You appear

#### Scenario: Range boundaries
- **WHEN** the selected range is October 1 through October 14, 2026
- **THEN** check-ins dated October 1 and October 14 are included when saved
- **AND** records outside those dates are excluded

#### Scenario: Selection and refresh
- **WHEN** a person changes the profile or valid date range, or refreshes after saving an updated entry
- **THEN** the summary and Logs reflect the same newly loaded saved records
- **AND** logs from the previous selection are not included in the resulting PDF

### Requirement: Dated original check-in details
Each log SHALL show its saved local date, the complete written note when present, and each recorded region and pain type with mean intensity, peak intensity on the 0–10 scale, and map coverage as a percentage. Notes SHALL be presented as patient-written text, preserving line breaks and without AI rewriting or excerpt truncation. Absent notes SHALL be identified as "No written note."

#### Scenario: Long multiline note
- **WHEN** a saved check-in contains a note longer than the summary excerpt limit with multiple paragraphs
- **THEN** its log includes the entire note and preserves its paragraph breaks
- **AND** the summary can retain its existing shortened excerpt

#### Scenario: Multiple regional observations
- **WHEN** a check-in records aching in the lower back and burning in the left calf
- **THEN** the log lists both region and sensation pairs with their own saved measurements
- **AND** intensity and coverage are labeled distinctly

### Requirement: Empty records remain distinct from missing dates
Logs SHALL include explicitly saved check-ins with no pain marked, labeled "Nothing marked", and SHALL retain any note on those check-ins. Dates without a saved entry SHALL NOT receive a log. A range without any saved check-ins SHALL retain the existing empty-report state and SHALL NOT create blank log pages.

#### Scenario: Empty and missing days
- **WHEN** a three-day range has a marked check-in, an explicitly empty check-in with a note, and a missing day
- **THEN** Logs contains two dated entries, including "Nothing marked" with its saved note
- **AND** the missing day has no log and remains unrecorded in the summary

#### Scenario: No saved records
- **WHEN** a range contains no saved check-ins
- **THEN** the empty-report state is shown and no printable Logs appendix is generated

### Requirement: Summary followed by readable log pages
On A4 and US Letter, the default six-week report SHALL retain its summary on page one and start Logs on page two. Logs SHALL continue across as many pages as needed without truncating notes or omitting records. Dated headings SHALL remain with their following content, oversized entries SHALL be allowed to continue, and application navigation and report controls SHALL remain excluded.

#### Scenario: Print the full sample
- **WHEN** Maya's full report is printed or saved as PDF on A4 or US Letter
- **THEN** page one contains the summary and page two starts with "Logs"
- **AND** every one of the 42 check-ins appears in the following pages with readable text and no blank trailing page

#### Scenario: Entry taller than a page
- **WHEN** a check-in note or set of regional observations exceeds a printable page
- **THEN** the log continues onto subsequent pages without clipping or losing text
- **AND** its dated heading is not left alone at a page bottom

### Requirement: Fixed-size preview sheets
Every log preview sheet SHALL match the first summary sheet's width and height at the current viewport. Content that exceeds a sheet SHALL continue on another sheet without clipping, omission, or duplication. Ordinary entries SHALL stay together when they fit a fresh sheet. Oversized entries SHALL repeat their date with a continuation label. Pagination SHALL update after resizing or a report selection changes.

#### Scenario: Overflow creates another sheet
- **WHEN** the next saved check-in would exceed the remaining space on a preview sheet
- **THEN** another sheet of the same size is created and the check-in continues there
- **AND** the final sheet retains that same size even when only partly filled

#### Scenario: Long entry and resized preview
- **WHEN** a long note or measurement list spans sheets and the viewport is resized
- **THEN** the preview recalculates its page breaks to match the summary sheet's new dimensions
- **AND** all original note text and measurements remain present once, with dated continuation headings
