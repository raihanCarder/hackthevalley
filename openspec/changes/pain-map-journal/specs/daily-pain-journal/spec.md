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

### Requirement: Reliable local saves
The system SHALL save You's check-ins to PostgreSQL on this device and acknowledge success only after commit. Failed saves SHALL preserve the draft and offer retry. Historical browser and visitor records SHALL remain intact without automatic import or fallback writes.

#### Scenario: Database write fails
- **WHEN** PostgreSQL rejects a save
- **THEN** the painting and note remain an unsaved draft with retry
- **AND** no browser-storage fallback records the check-in

### Requirement: Two device-local profiles
The system SHALL expose exactly You and Maya through an accessible profile-icon menu shared across screens. You SHALL use one persistent local profile independent of cookies and browser restarts. Maya SHALL use immutable synthetic data. Switching profiles SHALL preserve You's in-memory editor draft and prevent stale asynchronous results from appearing under the other profile.

#### Scenario: Reopen You
- **WHEN** a browser reconnects after restarting or clearing its preferences
- **THEN** You opens the same journal in local PostgreSQL
- **AND** no temporary identity is required

#### Scenario: Switch to Maya
- **WHEN** You switches to Maya through the profile icon
- **THEN** the body, history, and report show Maya's labeled read-only sample
- **AND** switching back restores You's editor draft without saving it

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
