# Spec Delta

## Purpose

Give feel's body scenes a subtle construction-workspace sense of depth while preserving the visibility of the body, pain markings, and clean report images.

## ADDED Requirements

### Requirement: Spatial grid backdrop
The system SHALL show a perspective floor grid beneath the body in ready check-in, history playback, and date-comparison scenes. The grid SHALL remain anchored in the body's world space as the user rotates or zooms the camera.

#### Scenario: Inspect the body from different views
- **WHEN** a user rotates, zooms, or selects a front, back, left, or right view
- **THEN** the grid perspective follows the camera while its position relative to the body stays fixed
- **AND** the grid fades into the surrounding stage without a visible rectangular boundary

#### Scenario: Review saved maps
- **WHEN** a user opens a saved history map or two saved maps in comparison
- **THEN** each displayed body scene uses the same grid treatment as the check-in scene
- **AND** grid styling does not encode pain intensity, date, or entry availability

### Requirement: Subdued app-matched appearance
The grid SHALL use the app's charcoal and muted sage-gray palette, thin low-contrast lines, and a smooth distance fade. The body silhouette and all four pain appearances SHALL remain more prominent than the grid at desktop and mobile widths, including close-up views.

#### Scenario: Review all pain types
- **WHEN** burning, sharp, aching, and tingling markings are visible against the grid
- **THEN** each sensation remains distinguishable and the body outline remains clear
- **AND** the grid has no bright colored axes, labels, glowing lines, or enclosing wireframe cage

#### Scenario: Inspect feet and smaller body details
- **WHEN** a user selects a foot, hand, or face focus view or changes body shape
- **THEN** grid lines do not cover body surfaces or obscure paint markings
- **AND** distant or densely projected lines fade rather than forming distracting patterns

### Requirement: Decorative interaction isolation
The grid SHALL remain decorative and SHALL NOT receive paint or erasing, change saved maps or regional measurements, or intercept existing pointer and keyboard controls. It SHALL introduce no focusable controls or autonomous animation, including when reduced motion is enabled.

#### Scenario: Paint on the background
- **WHEN** a user drags over visible grid space outside the body in paint mode
- **THEN** no stroke or regional measurement is added and the camera does not move
- **AND** subsequent painting on the body works normally

#### Scenario: Use the existing controls
- **WHEN** a user rotates or zooms with pointer or keyboard controls, including with reduced motion enabled
- **THEN** the existing camera interactions remain available
- **AND** the grid changes only as a consequence of camera interaction

### Requirement: Clean report captures
Exported front and back body captures SHALL exclude the grid and preserve transparent pixels outside the body. Capturing SHALL preserve the displayed scene's grid visibility, paint maps, and camera state after completion or failure.

#### Scenario: Generate report body images
- **WHEN** a front or back body image is captured for a report
- **THEN** the image contains the body and its markings without grid lines
- **AND** its background is transparent
- **AND** the interactive scene retains its grid and original camera and paint state

#### Scenario: Recover after capture failure
- **WHEN** image capture fails after temporarily hiding the grid
- **THEN** the displayed scene's grid visibility and camera and paint state are restored
