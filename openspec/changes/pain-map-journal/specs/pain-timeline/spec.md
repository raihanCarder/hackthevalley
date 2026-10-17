# Spec Delta

## Purpose

Make pain analysis over time a core product experience alongside 3D painting, using faithful playback, regional trends, date comparisons, and a repeatable six-week synthetic demonstration.

## ADDED Requirements

### Requirement: Regional trends over time
The system SHALL let users select a region, pain type, and date range to view daily peak intensity, map coverage, recorded-day frequency, and first/last recorded presence. These observations SHALL be available in the timeline without generating an appointment report or using an AI service.

#### Scenario: Analyze six weeks of lower-back aching
- **WHEN** a user selects Maya's lower back and aching across her full history
- **THEN** the timeline shows the saved daily intensity and coverage trends and the count of recorded days with that sensation
- **AND** its first/last presence dates and daily values agree with the saved maps

#### Scenario: Trend includes a missing check-in
- **WHEN** a selected range includes both a saved empty map and an unrecorded date
- **THEN** the saved empty map contributes a zero value and the unrecorded date appears as a gap
- **AND** frequency counts use recorded days as the denominator

### Requirement: Compare recorded dates
The system SHALL let users compare two saved dates, inspect both body maps, and see differences in regional peak intensity and coverage by pain type. It SHALL identify newly marked and no-longer-marked regions between those dates without labeling those observations as a diagnosis or inferring a cause.

#### Scenario: Inspect new left-calf burning
- **WHEN** the earlier date records burning in the left thigh and the later date also records burning in the left calf
- **THEN** the comparison identifies the newly marked calf and shows both dates' saved maps and regional measurements
- **AND** the comparison does not assert why the marked area changed

### Requirement: Analysis remains available without AI
The system SHALL derive trend facts and date comparisons from saved observations and SHALL keep these core features usable when Gemini is unconfigured or unavailable. Generated narrative SHALL NOT replace the underlying regional measurements.

#### Scenario: Analyze records without Gemini
- **WHEN** Gemini is unavailable while a user explores recorded history
- **THEN** playback, regional trends, frequency counts, and date comparisons remain available with the same saved values

### Requirement: Date-specific scrubbing
The system SHALL provide a chronological slider for the active profile's selected date range. Selecting a recorded day SHALL restore that day's exact saved pain layers and display its date and available note without modifying any saved entry.

#### Scenario: Compare two recorded days
- **WHEN** a user scrubs from a day with only lower-back aching to a day that also records left-leg burning
- **THEN** the body changes to the saved locations, types, and intensities for each selected day
- **AND** the displayed date and note match that selected entry

### Requirement: Playback controls
The system SHALL provide play and pause, advance in date order, and stop at the end of the selected range. Scrubbing or switching profiles SHALL stop playback. Playback SHALL be read-only and SHALL NOT write interpolated observations into the journal.

#### Scenario: Pause and inspect
- **WHEN** a user pauses playback on a recorded date
- **THEN** that day's map remains visible for inspection and rotation
- **AND** no check-in or regional measurement is changed

#### Scenario: Finish the range
- **WHEN** playback reaches the final date
- **THEN** playback stops with the final date selected

### Requirement: Faithful missing-day handling
The system SHALL identify dates with no check-in as unrecorded and SHALL NOT show them as zero pain or as a newly recorded continuation of a previous map. Playback transitions SHALL NOT create or imply measurements on unrecorded dates.

#### Scenario: Scrub across a missing day
- **WHEN** the selected calendar date has no entry between two recorded dates
- **THEN** the interface displays a no-check-in state for that date
- **AND** no fabricated pain-free map, note, or measurement is attributed to that date

### Requirement: Maya demonstration
The system SHALL include a read-only profile labeled as synthetic with 42 consecutive dated check-ins. Its saved maps and regional measurements SHALL consistently show lower-back aching followed by left-leg burning that extends from the thigh toward the calf over later days. The demonstration SHALL work without live external services.

#### Scenario: Run the judging demonstration
- **WHEN** a user selects Maya and plays all six weeks
- **THEN** the changing body maps visibly show the seeded progression
- **AND** dates, notes, regional trends, date comparisons, and the appointment report agree with those same seeded entries

### Requirement: Empty and single-entry timelines
The system SHALL explain when no check-ins are available and SHALL disable playback unless the selected range has at least two recorded entries. A single recorded map SHALL remain viewable.

#### Scenario: New visitor
- **WHEN** a visitor opens the timeline before saving a check-in
- **THEN** the interface offers a route to create a check-in and does not display Maya's data as the visitor's history

#### Scenario: One recorded day
- **WHEN** the active profile has one entry in the selected range
- **THEN** the entry can be inspected and playback is disabled
