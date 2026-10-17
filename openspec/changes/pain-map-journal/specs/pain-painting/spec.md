# Spec Delta

## Purpose

Let patients record pain location, sensation, and intensity directly on a rotatable body and turn those markings into consistent regional observations.

## ADDED Requirements

### Requirement: Inspect the whole body
The system SHALL provide a rotatable three-dimensional body with reachable front, back, left, and right surfaces. Users SHALL be able to switch between painting and rotating without one action unintentionally performing the other.

#### Scenario: Paint the lower back
- **WHEN** a user rotates to the back and switches to paint mode
- **THEN** dragging over the lower back marks that visible surface without rotating the body
- **AND** rotating afterward keeps the marks attached to the same body location

### Requirement: Paint location and intensity
The system SHALL let users select a pain type, brush size, and intensity from 1 to 10 and paint soft-edged marks on the visible body surface. Pointer pressure SHALL be optional; mouse and touch users SHALL have a usable intensity slider.

#### Scenario: Separate pain types overlap
- **WHEN** a user paints aching at intensity 4 and burning at intensity 7 on the same location
- **THEN** both pain types and their intensities are retained independently
- **AND** marks do not appear on a hidden opposite surface

#### Scenario: Miss the body
- **WHEN** the pointer moves or drags outside the body in paint mode
- **THEN** no new mark is recorded

### Requirement: Distinguishable pain appearances
The system SHALL render burning in red-orange with a slow heat shimmer, sharp pain as white-hot points with flickering spikes, aching in deep purple with a slow pulse, and tingling in blue with static-like sparkles. A labeled legend SHALL identify each type without requiring color recognition alone.

#### Scenario: Compare sensations
- **WHEN** all four pain types have been painted
- **THEN** their colors and animation patterns are visibly distinguishable
- **AND** the legend identifies the corresponding sensations

### Requirement: Correct a painting
The system SHALL provide erasing for the selected pain layer and undo of the most recent completed brush stroke or erase stroke. Corrections SHALL update both the displayed map and subsequently saved regional observations.

#### Scenario: Undo an accidental mark
- **WHEN** a user adds an accidental stroke and chooses undo
- **THEN** the selected map returns to its state before that stroke
- **AND** other pain layers retain their previous contents

### Requirement: Stable body-region measurements
The system SHALL assign painted surfaces to stable, patient-relative body regions, distinguishing front and back torso and left and right limbs. For each region and pain type, it SHALL derive mean intensity including unpainted areas, peak intensity, and painted coverage from the same saved map. Coverage SHALL be labeled as map coverage rather than physical skin area.

#### Scenario: Track the patient's left calf
- **WHEN** a user paints only the patient's left calf while viewing the body from the front
- **THEN** the left-calf region has nonzero coverage and intensity
- **AND** the right calf has zero coverage and intensity

### Requirement: Reduced-motion and rendering failure states
The system SHALL honor reduced-motion preferences by showing static pain colors and patterns. If three-dimensional rendering is unavailable, it SHALL display an explanation rather than a blank or apparently interactive body.

#### Scenario: Reduced motion enabled
- **WHEN** the device requests reduced motion
- **THEN** all four pain types remain identifiable and painting remains usable without animated effects

#### Scenario: Renderer cannot initialize
- **WHEN** the device cannot initialize the body renderer
- **THEN** the interface explains the limitation and does not claim painting is ready
