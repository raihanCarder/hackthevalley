# Pain journal UI direction

Task 1 foundation; check-in persistence, timeline analysis, and report generation are later milestones.

The central object is a person's body map. A quiet inspection workbench gives it most of the screen, with a compact instruction rail. Avoid dashboard metrics and repeated cards: they would compete with the map before there are any records to analyze. The revised direction uses a broad, softly rounded body stage and plain adjoining text instead of a generic grid of feature cards.

## Palette and typography

Six base tokens: background `#f7f9f6`, surface `#ffffff`, stage `#e9efea`, foreground `#203b32`, muted foreground `#52675b`, accent `#365e49`; borders use `#c7d4c9`. Sage and green recall calm observation; the mannequin remains neutral so later orange, white, purple, and blue sensation patterns stand out. Focus is a solid dark green outline. Error uses dark red with text, never color alone. This is a light-only first increment. The tokens borrow the neutral/sage and green roles of Radix Colors without requiring a palette dependency.

Use the local humanist font stack `Trebuchet MS`, `Gill Sans`, sans-serif for legible controls and numerals; Georgia for the short reflective screen heading. No remote font request is required. Type scale: 12, 14, 16, 20, 28, 44px (headline adapts to viewport). Body lines stay below 70 characters. Labels use sentence case.

## Navigation and screen composition

Check-in is the primary route `/`; History at `/history` is the other core destination. Appointment report at `/report` is a secondary destination. Active navigation has text, background, and `aria-current`, not color alone. For task 1, later destinations explicitly describe their pending state without showing fabricated data or saved records.

Check-in: left-aligned heading and compact guidance above a desktop 3:1 layout. The stage contains the dominant full-height body, a mode switch, and named views; patient-side guidance stays in the instruction rail because screen-left changes as the body rotates. A narrow instruction rail explains inspection, the future four sensations, and the current implementation stage. Future brush, intensity, note, date, and save controls will occupy this rail only when functional. Do not show a save action or claim an empty map is a recorded pain-free day.

History plan: retain a large body view with a calendar-date scrubber below it; a narrower analysis rail contains labeled region and sensation selection, peak intensity and map coverage plots, recorded-day frequency, first/last presence, and comparison dates. Missing dates are gaps; explicit empty entries contribute zeros. On desktop, two-date comparison can show two bodies; on phones, use a clearly labeled before/after switch. Maya will be labeled synthetic and read-only. These features belong to task 4.

Report plan: a restrained white document with patient/range header, labeled front/back range composites, sensation legend, recorded/missing counts, compact regional observations, timeline, descriptive summary, and attribution of patient notes. Navigation stays outside the printable area; A4/Letter print excludes app controls. Report stays secondary to painting and history. This belongs to task 5.

## Responsive and accessible controls

At 900px and below, stack the stage above the instruction rail; at phone widths keep the canvas at least 430px tall and wrap view buttons. Use a flexible header and wrapping navigation, with no fixed overlays. All buttons have at least 44px targets, explicit labels and visible 3px keyboard focus. Native buttons with `aria-pressed` suit these simple mode/view choices. shadcn Button/ToggleGroup/Slider are candidates once richer brush controls are introduced; no dialog/menu primitives or Tailwind setup are needed for this foundation. Lucide icons use 18px, 1.8 stroke, next to text; decorative icons are hidden.

Provide keyboard-accessible named views, arrow-key orbit, +/- zoom, and Home reset. Paint mode disables camera interactions; its text explicitly says painting arrives in the next milestone. Loading and WebGL errors remain readable HTML outside the canvas. Motion is user-controlled only; no decorative animations. Future pain effects must honor reduced motion.

## Review criteria

Check at 390px, 768px, and 1440px: no horizontal overflow, no clipped controls, body remains dominant, reading order matches visual order, selected mode is explicit, keyboard focus is visible, and deep links work. Contrast is checked for foreground/muted/control colors against their actual surfaces. The body silhouette and mode/view strip should identify the product even with the title removed.
