# Spec Delta

## Purpose

Preserve date-specific pain maps and patient context so check-ins can be reused, compared, and summarized without confusing missing records with pain-free days.

## ADDED Requirements

### Requirement: Daily check-in
The system SHALL allow one saved check-in per profile and local calendar date, containing all four pain layers, regional measurements, an optional written note, and the body-map version. Saving an existing date SHALL update that entry rather than create a second daily record.

#### Scenario: Save and reopen
- **WHEN** a user saves a map with a note and reloads that date
- **THEN** the same locations, types, intensities, and note are restored
- **AND** the entry is included exactly once in the profile's timeline

#### Scenario: Update an existing date
- **WHEN** a user changes a saved day's painting and saves again
- **THEN** the entry and its measurements reflect the revised map
- **AND** the timeline and report use the revised entry

### Requirement: Reuse the previous recorded map
The system SHALL let a user start a new check-in blank or copy the most recent earlier saved map. It SHALL identify the source date and require an explicit save for the new date without modifying the source entry.

#### Scenario: Reuse after missing a day
- **WHEN** the latest earlier entry is two days old and the user chooses to reuse it
- **THEN** the copied map is shown as an unsaved draft with its source date
- **AND** the intervening day remains unrecorded

### Requirement: Explicit pain-free and missing days
The system SHALL distinguish an explicitly saved empty map from a date with no entry. Saving an empty map SHALL record a check-in with zero regional measurements; failing to check in SHALL leave the date without an observation.

#### Scenario: Record a pain-free check-in
- **WHEN** a user intentionally saves an empty map
- **THEN** that date is recorded as having no painted pain
- **AND** absent dates remain labeled as having no check-in

### Requirement: Reliable saves and storage disclosure
The system SHALL identify browser-local versus PostgreSQL storage when both modes are provided. A save SHALL be reported successful only after the selected store acknowledges it. Failed saves SHALL preserve the draft and provide a retry action without silently changing the selected store. PostgreSQL persistence SHALL NOT require a time-series extension or a particular hosting vendor.

#### Scenario: Server storage is unavailable
- **WHEN** a check-in cannot be saved to the selected server store
- **THEN** the draft remains editable and the interface reports that it is unsaved
- **AND** the user can retry without producing duplicate daily entries

#### Scenario: Browser storage fails
- **WHEN** browser storage rejects a write
- **THEN** the interface reports the failure and retains the in-memory draft

### Requirement: Isolated demo profiles
The system SHALL visibly separate temporary visitor check-ins from the read-only synthetic Maya profile. It SHALL prevent one visitor session from retrieving or overwriting another session's server-stored entries and SHALL avoid sending notes to external AI without an explicit note-processing or report action.

#### Scenario: Switch to Maya
- **WHEN** a user switches from their visitor profile to Maya
- **THEN** Maya's synthetic records are labeled and cannot overwrite visitor entries
- **AND** returning to the visitor profile restores that profile's records

### Requirement: Optional note extraction
If note extraction is enabled, the system SHALL extract only explicitly mentioned triggers, medications, activities, and reported relief into editable structured fields. It SHALL retain the source note, require review before saving extracted fields, and preserve the note when extraction fails. Voice capture is optional and SHALL NOT block written check-ins.

#### Scenario: Review an extracted note
- **WHEN** a user requests extraction from a note saying sitting worsened pain and ibuprofen helped a little
- **THEN** the suggestions retain those qualified, patient-reported observations without inferring a diagnosis, dose, or treatment recommendation
- **AND** the user can correct or discard the suggestions before saving

#### Scenario: Microphone is unavailable
- **WHEN** optional voice capture cannot obtain microphone access
- **THEN** the user can continue with a written note and save the check-in

### Requirement: Version-compatible restoration
The system SHALL preserve the model and region-map version with each saved entry and SHALL reject incompatible map restoration with a visible explanation rather than display markings on incorrect body locations.

#### Scenario: Saved map uses an unsupported version
- **WHEN** an entry references an unsupported body-map version
- **THEN** the interface explains why that painting cannot be restored
- **AND** the entry is not silently replaced with an empty map
