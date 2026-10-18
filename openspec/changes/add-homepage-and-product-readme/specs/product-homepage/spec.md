# Spec Delta

## Purpose

Introduce feel's 3D mapping and change-over-time analysis through a homepage that matches the application and connects visitors to its existing workflows.

## ADDED Requirements

### Requirement: Homepage is available through shared navigation

The application SHALL provide a homepage at `/home`, list Home before Check-in in shared navigation, and link the product wordmark to `/home`. Exactly one destination SHALL be marked as the current page on each supported application route.

#### Scenario: Open Home from another destination

- **WHEN** a user activates Home from Check-in, History, or Appointment report
- **THEN** the application opens `/home` within the existing application shell
- **AND** Home is the only navigation destination marked as current

#### Scenario: Open Home through the wordmark

- **WHEN** a user activates the feel wordmark
- **THEN** the application opens `/home`

#### Scenario: Existing editor routes remain available

- **WHEN** a user opens `/` or `/check-in` directly
- **THEN** the existing body editor or check-in details opens respectively
- **AND** Check-in is the only navigation destination marked as current

### Requirement: Homepage explains the product's primary experience

The homepage SHALL display one prominent main heading and an explanatory subtitle describing painting location, sensation, and intensity on a rotatable 3D body and tracking changes over time. Supporting copy SHALL explain daily check-ins with optional notes, saved-map playback, regional trends, date comparisons, and the printable appointment report without making diagnostic or treatment claims.

#### Scenario: A visitor reads the product introduction

- **WHEN** a user opens `/home`
- **THEN** the main heading and subtitle explain 3D pain mapping and analysis over time
- **AND** the introduction gives visual priority to those two core experiences
- **AND** the appointment report is described as a supporting way to share recorded observations

### Requirement: Homepage actions open existing workflows

The homepage SHALL provide a primary action labeled "Open body map" leading to `/` and a secondary action labeled "Explore history" leading to `/history`. Opening either destination SHALL preserve the selected You or Maya profile without creating or changing a check-in.

#### Scenario: Open the body map under You

- **GIVEN** You is the selected profile
- **WHEN** a user activates Open body map
- **THEN** the application opens the body editor at `/` under You
- **AND** no check-in is saved as a result of navigation

#### Scenario: Explore history under Maya

- **GIVEN** Maya is the selected profile
- **WHEN** a user activates Explore history
- **THEN** the application opens `/history` under Maya
- **AND** Maya remains a synthetic read-only profile

### Requirement: Homepage respects profile and data boundaries

The homepage SHALL retain the shared profile switcher with exactly You and Maya, identify any sample-history references as synthetic and read-only, and present product explanations without fabricating user statistics. Its introduction SHALL remain readable when PostgreSQL or Gemini is unavailable.

#### Scenario: Read the homepage without configured services

- **GIVEN** PostgreSQL and Gemini are unavailable
- **WHEN** a user opens `/home`
- **THEN** the product introduction and navigation actions remain available
- **AND** reading the page does not attempt to save a check-in or generate a Gemini summary

#### Scenario: Read a sample-history description

- **WHEN** the homepage mentions Maya or her six-week history
- **THEN** that description identifies the sample as synthetic and read-only
- **AND** it does not present the sample as the user's own records

### Requirement: Homepage follows the current visual and accessibility conventions

The homepage SHALL use the application's current charcoal palette, muted sage accents, system typography, shared navigation, and control styles. It SHALL retain a logical heading order, visible keyboard focus, working skip navigation, readable text, and accessible actions across phone, tablet, and desktop widths.

#### Scenario: Read and navigate on a narrow screen

- **WHEN** a user views `/home` at 390 pixels wide
- **THEN** the heading, subtitle, and actions remain readable without horizontal page overflow
- **AND** the homepage fits the dynamic viewport without vertical page scrolling
- **AND** all three supporting feature headings and descriptions remain visible, using concise copy where space is limited
- **AND** all four main navigation destinations remain reachable
- **AND** the profile control remains available

#### Scenario: Navigate with a keyboard

- **WHEN** a user navigates the homepage using a keyboard
- **THEN** Home, the wordmark, profile switching, and both workflow actions are operable with visible focus
- **AND** Skip to content moves focus to the main content

#### Scenario: Read with reduced motion enabled

- **GIVEN** reduced motion is enabled
- **WHEN** a user opens the homepage
- **THEN** essential content and actions are available without depending on animation
