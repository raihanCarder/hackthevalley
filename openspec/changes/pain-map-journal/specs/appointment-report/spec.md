# Spec Delta

## Purpose

Prepare a concise appointment document that accurately describes recorded pain patterns and patient-reported context without diagnosing or recommending treatment.

## ADDED Requirements

### Requirement: Scoped appointment preparation
The system SHALL generate an appointment report for the active profile and selected date range from saved entries only. The report SHALL show the profile, range, recorded-day count, missing-day count, pain-type legend, worst-area body maps, timeline, and regional observations. Synthetic reports SHALL be clearly labeled.

#### Scenario: Prepare Maya's report
- **WHEN** a user chooses Prepare for my appointment for Maya's full history
- **THEN** the report describes the same 42 saved synthetic check-ins used by the timelapse
- **AND** no visitor drawings or unsaved edits are included

### Requirement: Deterministic descriptive evidence
The system SHALL compute regional presence counts, first recorded dates, and recorded changes from saved measurements before requesting an AI summary. Counts SHALL distinguish recorded days from calendar days, and changes SHALL be described as observed locations or coverage rather than a confirmed clinical process.

#### Scenario: Missing check-ins in a report range
- **WHEN** a 14-day range contains 10 check-ins and lower-back aching appears in 7 of them
- **THEN** the report states 7 of 10 recorded days with 4 days unrecorded
- **AND** it does not claim aching on only 7 of 14 observed days

### Requirement: Descriptive AI summary
When Gemini is configured, the system SHALL request a summary using computed evidence and saved patient notes. Displayed summary statements SHALL be verifiable against that evidence and SHALL contain no diagnosis, inferred medication details, treatment recommendations, or causal claims. The report SHALL explicitly state that it describes patient records and does not provide a diagnosis.

#### Scenario: Describe a new region
- **WHEN** saved evidence first records burning in the left thigh and later also records it in the left calf
- **THEN** the summary can describe those recorded locations and dates
- **AND** it does not name a disease or infer why the observations changed

#### Scenario: Note contains instructions or unsupported medical claims
- **WHEN** a saved note asks the model to ignore instructions or assert a diagnosis
- **THEN** the note is treated as patient-provided data rather than instructions
- **AND** the generated report does not adopt the requested diagnosis as a system conclusion

### Requirement: Qualified patient context
The report SHALL attribute note-derived statements to the patient, preserve uncertainty and reported degree of relief, and avoid presenting associations as established causes. If structured note extraction is enabled, only reviewed fields SHALL be included as confirmed extracted context.

#### Scenario: Partial relief is reported
- **WHEN** a saved note says prolonged sitting worsened pain and ibuprofen helped a little
- **THEN** any included context describes patient-reported partial relief and sitting-associated worsening
- **AND** it does not recommend ibuprofen or invent a dose

### Requirement: Honest integration fallback
If Gemini is unconfigured, fails, or returns unverifiable content, the system SHALL retain the report's deterministic observations and display a labeled non-AI summary or an unavailable-summary state. It SHALL NOT label fallback or prewritten text as a successful Gemini response.

#### Scenario: AI request fails
- **WHEN** the summary request times out or returns unsupported statements
- **THEN** the report remains available with factual observations and an accurate summary-status label
- **AND** the interface offers a retry without changing saved journal entries

### Requirement: Printable one-page report
The system SHALL provide a compact one-page print layout for the default six-week report on A4 and US Letter. It SHALL identify worst-area maps as a composite across the range, distinguish absent check-ins on the timeline, and keep required observations readable. Regional charts are optional and SHALL NOT displace required content.

#### Scenario: Print the demonstration report
- **WHEN** a user prints Maya's default report or saves it as PDF through browser printing
- **THEN** controls and navigation are excluded and the required report content fits one page
- **AND** the composite map is not presented as one day's simultaneous pain

### Requirement: Empty report state
The system SHALL explain when the selected range contains no saved entries and SHALL NOT generate invented observations or an AI summary for that range.

#### Scenario: Prepare without check-ins
- **WHEN** a user requests a report for a range containing no saved check-ins
- **THEN** the interface explains that recorded entries are needed and offers a route to the journal

### Requirement: Server-owned local evidence
The system SHALL read You's report records from the fixed local PostgreSQL profile and Maya's records from the immutable fixture. A summary request SHALL NOT accept client-supplied records or ownership IDs. If a report's saved-record revision changes, the system SHALL refresh the report and require another explicit Gemini action.

#### Scenario: Saved records changed
- **WHEN** a check-in changes after the report loads and before its Gemini request
- **THEN** the server rejects the old revision without calling Gemini
- **AND** the interface refreshes saved evidence before the user can request a new summary
