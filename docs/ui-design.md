# Pain journal UI direction

Task 1 UI foundation with Owner B's date/note panel. Full painting/persistence integration, timeline analysis, and report generation remain later acceptance gates.

The central object is a person's body map. A quiet inspection workbench gives it most of the screen, with a compact instruction rail. Avoid dashboard metrics and repeated cards: they would compete with the map before there are any records to analyze. The revised direction uses a broad, softly rounded body stage and plain adjoining text instead of a generic grid of feature cards.

## Palette and typography

Six base tokens: background `#f7f9f6`, surface `#ffffff`, stage `#e9efea`, foreground `#203b32`, muted foreground `#52675b`, accent `#365e49`; borders use `#c7d4c9`. Sage and green recall calm observation; the mannequin remains neutral so later orange, white, purple, and blue sensation patterns stand out. Focus is a solid dark green outline. Error uses dark red with text, never color alone. This is a light-only first increment. The tokens borrow the neutral/sage and green roles of Radix Colors without requiring a palette dependency.

Use the local humanist font stack `Trebuchet MS`, `Gill Sans`, sans-serif for legible controls and numerals; Georgia for the short reflective screen heading. No remote font request is required. Type scale: 12, 14, 16, 20, 28, 44px (headline adapts to viewport). Body lines stay below 70 characters. Labels use sentence case.

## Navigation and screen composition

Check-in is the primary route `/`; History at `/history` is the other core destination. Appointment report at `/report` is a secondary destination. Active navigation has text, background, and `aria-current`, not color alone. For task 1, later destinations explicitly describe their pending state without showing fabricated data or saved records.

Check-in: left-aligned heading and compact guidance above a desktop 3:1 layout. The stage contains the dominant full-height body, a mode switch, and named views. The narrow rail contains date/note drafts and map actions; A owns the brush/intensity controls. Map actions stay disabled until A's editor is connected, with an explicit explanation. A blank preview or a note-only draft must never imply a recorded pain-free day. Patient-left/right wording stays consistent as the camera rotates.

History plan: retain a large body view with a calendar-date scrubber below it; a narrower analysis rail contains labeled region and sensation selection, peak intensity and map coverage plots, recorded-day frequency, first/last presence, and comparison dates. Missing dates are gaps; explicit empty entries contribute zeros. On desktop, two-date comparison can show two bodies; on phones, use a clearly labeled before/after switch. Maya will be labeled synthetic and read-only. These features belong to task 4.

Report plan: a restrained white document with patient/range header, labeled front/back range composites, sensation legend, recorded/missing counts, compact regional observations, timeline, descriptive summary, and attribution of patient notes. Navigation stays outside the printable area; A4/Letter print excludes app controls. Report stays secondary to painting and history. This belongs to task 5.

## Responsive and accessible controls

At 900px and below, stack the stage above the instruction rail; at phone widths keep the canvas at least 430px tall and wrap view buttons. Use a flexible header and wrapping navigation, with no fixed overlays. All buttons have at least 44px targets, explicit labels and visible 3px keyboard focus. Native buttons with `aria-pressed` suit these simple mode/view choices. shadcn Button/ToggleGroup/Slider are candidates once richer brush controls are introduced; no dialog/menu primitives or Tailwind setup are needed for this foundation. Lucide icons use 18px, 1.8 stroke, next to text; decorative icons are hidden.

Provide keyboard-accessible named views, arrow-key orbit, +/- zoom, and Home reset. Paint mode disables camera interactions; its text explicitly says painting arrives in the next milestone. Loading and WebGL errors remain readable HTML outside the canvas. Motion is user-controlled only; no decorative animations. Future pain effects must honor reduced motion.

## Review criteria

Owner B's journal increment preserves these tokens, fonts, stage proportions, and native accessible controls. The rail now contains a labeled local date, draft status, optional note with a character limit, and the map-copy/empty/save actions. A compact strip above the body discloses the selected store and independent PostgreSQL/Gemini status. Disabled map actions explain that saving is unavailable until the editor handoff is connected; typing a note never implies a recorded check-in. Feature styles remain in `src/journal/journal.module.css`. The body remains the dominant element on desktop and comes first in the stacked phone/tablet layout. Visual review covered 390px, 768px, and 1440px with no horizontal overflow.

Check at 390px, 768px, and 1440px: no horizontal overflow, no clipped controls, body remains dominant, reading order matches visual order, selected mode is explicit, keyboard focus is visible, and deep links work. Contrast is checked for foreground/muted/control colors against their actual surfaces. The body silhouette and mode/view strip should identify the product even with the title removed.

## Integrated review — October 17, 2026

The editor, journal form, history, and report now use the established tokens and controls. History defaults to the exact read-only 3D saved map; the optional region overview is schematic. The date/range scrubber sits above the body, with deterministic trends and comparisons alongside it. Comparison viewers stack with their labels on narrow screens. Viewer containers grow to include their camera controls and legend, rather than clipping them at the original placeholder height. Report printing uses fixed front/back range composites.

Mouse, real touch events at 390px, keyboard focus, reduced motion, selected/error states, and renderer-failure checks pass. The complete touch path reaches saved history, comparison, and the report. See the integration record for final desktop/tablet/phone screenshot review and verification limits.
