---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Use for frontend development, React and Next.js interfaces, landing pages, dashboards, component design, and UI redesigns. Prioritize shadcn/ui, Radix Colors, and Lucide Icons when compatible with the project, while maintaining original visual identity, accessibility, and responsive design.
license: Complete terms in LICENSE.txt
---

# Frontend Design

Approach this as the design lead at a design studio known for giving every client a distinct visual identity that is not mistaken for anyone else's.

This client has already rejected proposals that felt cliché or templated, and is paying for a distinctive point of view: make deliberate, opinionated choices about palette, typography, and layout that are specific to this brief, and take aesthetic risk if justified.

Use established, accessible UI libraries to accelerate implementation without allowing their default appearance to dictate the design.

**The goal is not to make something that looks like shadcn/ui. The goal is to use shadcn/ui to build something that looks uniquely designed for the product.**

## Ground your designs in the subject matter

If the brief does not identify what the product or subject matter is, identify it yourself before designing, and confirm with the client.

You can come up with one concrete subject, the design's audience, and the design's primary job, as a proposal.

If there's any information in your memory about the client's preferences or context about what they're building, use that as a hint.

The subject's industry, subject matter, materials, and vernacular are where distinctive visual choices come from — a design for a toy for girls aged 8–11 will be very aesthetically different from a dashboard for financial analysts.

Build with the brief's real content and subject matter throughout.

---

# Preferred Frontend Toolkit

When working in a compatible React, Next.js, and Tailwind CSS project, prefer the following tools:

1. **shadcn/ui** — Component foundation
2. **Radix Colors** — Color palettes and color scales
3. **Lucide Icons** — Iconography
4. **Tailwind CSS** — Utility-first styling and responsive layouts

Official documentation:

- shadcn/ui: https://ui.shadcn.com
- shadcn/ui Blocks: https://ui.shadcn.com/blocks
- Radix Colors: https://www.radix-ui.com/colors
- Lucide Icons: https://lucide.dev
- Tailwind CSS: https://tailwindcss.com

These are preferred tools, not mandatory dependencies.

Before introducing them, inspect the existing project.

If the project already has an established design system, preserve its conventions unless the user explicitly requests a migration or redesign.

Do not force React-specific dependencies into Angular, Vue, or other incompatible frameworks.

Do not install additional libraries merely because they appear in this skill.

## 1. shadcn/ui — Component foundation

Use shadcn/ui as the preferred source of accessible, customizable UI components.

Prefer established components over implementing standard interaction primitives from scratch.

Examples include:

- Button
- Input and Textarea
- Select
- Checkbox and Radio Group
- Dialog and Alert Dialog
- Dropdown Menu
- Popover
- Tooltip
- Tabs
- Table
- Sheet
- Sidebar
- Accordion
- Command
- Form
- Skeleton

Consult the official component documentation before implementing unfamiliar components.

### Component selection rules

Before creating a component:

1. Search the existing project's component library.
2. Check whether shadcn/ui already provides the required component.
3. Use or adapt the existing component where appropriate.
4. Build a custom component only when the design or behavior genuinely requires one.

Do not recreate standard functionality unnecessarily.

Use accessible component primitives for complex interactions such as dialogs, menus, and keyboard-driven navigation.

### Customization rules

Treat shadcn/ui components as building blocks, not finished designs.

Customize their appearance to match the product's visual identity through:

- Typography
- Color tokens
- Spacing
- Border radii
- Borders
- Shadows
- Component variants
- Layout and composition
- Interaction states

Maintain shared variants and reusable styling patterns.

Avoid applying arbitrary one-off styles throughout the application when a semantic component variant would be more appropriate.

Do not blindly copy shadcn/ui demo layouts.

A shadcn/ui Card does not imply that every section should be a card.

Use cards only where a visual grouping communicates meaningful information.

### Installation and configuration

Before installation:

- Inspect `package.json`.
- Inspect the existing UI component directories.
- Check for `components.json`.
- Identify the Tailwind version and CSS organization.
- Check for existing Radix or other component primitives.

If shadcn/ui is not configured and the project supports it, use the official installation instructions appropriate to the project's framework and package manager.

Typical CLI commands:

    npx shadcn@latest init

    npx shadcn@latest add button

Install only the components needed for the task.

Do not overwrite existing themes, globals, or component customizations without reviewing their impact.

---

## 2. Radix Colors — Intentional color systems

Use Radix Colors as a preferred foundation for accessible, coordinated color palettes.

Color choices must still be driven by the product's subject matter and brand personality.

Do not automatically choose blue, purple, or another common SaaS accent.

### Palette construction

Before implementation, define a compact palette containing:

- Primary background
- Secondary or elevated surface
- Primary foreground
- Secondary foreground
- Brand or accent color
- Border and separator colors

Include semantic states where required:

- Success
- Warning
- Error
- Information

Use as few distinct palettes as the design requires.

### Radix color scales

Radix Colors provides 12-step color scales designed for different UI roles.

Use these guidelines:

| Scale | Recommended usage |
|-------|-------------------|
| 1–2 | App backgrounds and subtle surfaces |
| 3–5 | Component backgrounds and interactive states |
| 6–8 | Borders, separators, and focus treatments |
| 9–10 | Solid fills and active states |
| 11 | Secondary or lower-emphasis text |
| 12 | High-emphasis text |

These are guidelines, not rigid assignments.

Verify contrast whenever combining foreground and background colors.

Do not assume that white text is readable on every step-9 accent.

### Semantic color tokens

Prefer semantic tokens over scattering literal hex codes or raw palette references throughout components.

Examples:

- `background`
- `foreground`
- `card`
- `card-foreground`
- `primary`
- `primary-foreground`
- `secondary`
- `muted`
- `muted-foreground`
- `accent`
- `border`
- `input`
- `ring`
- `destructive`

When using shadcn/ui, map the selected Radix palettes into the project's existing semantic theme tokens.

Use one coherent source of truth for component colors.

Do not maintain two unrelated theme systems.

An example token relationship:

    background        → neutral scale 1
    foreground        → neutral scale 12
    card              → neutral scale 2
    muted-foreground  → neutral scale 11
    border            → neutral scale 6
    primary           → selected accent scale 9
    ring              → selected accent scale 8

These mappings are starting points. Adjust for the actual brand, contrast, and interaction requirements.

### Light and dark modes

When the interface supports both themes:

- Define deliberate light and dark palettes.
- Preserve semantic meaning between themes.
- Check text, border, and interactive contrast in each.
- Avoid simply inverting light-mode colors.
- Check overlays, charts, illustrations, and selected states.

A dark theme should feel intentionally designed, not automatically generated.

---

## 3. Lucide Icons — Consistent iconography

Use Lucide Icons as the preferred icon library for compatible projects.

For React, use `lucide-react`.

Official documentation: https://lucide.dev

### Icon rules

- Reuse Lucide icons instead of mixing multiple icon libraries.
- Use consistent icon sizes within similar contexts.
- Use consistent stroke widths.
- Align icons optically with their accompanying text.
- Prefer recognizable metaphors over obscure icons.
- Keep icons subordinate to primary content.

Typical sizes:

- 16px for compact UI controls
- 18–20px for standard actions and navigation
- 24px for larger controls or emphasis

These are guidelines, not universal requirements.

### Accessibility

Icons must not replace meaningful text when the action would become ambiguous.

For icon-only buttons, provide an accessible name.

Decorative icons should be hidden from assistive technology.

Maintain adequate hit targets for interactive controls.

### Avoid icon overuse

Do not add icons merely to make a design appear more polished.

Avoid:

- An icon beside every heading
- Decorative icons on every card
- Unnecessary arrows on every link
- Multiple icons communicating the same action
- Icons where plain text communicates more clearly

Every icon should help users understand or operate the interface.

---

# Design Principles

## 1. Build around the subject

For web designs, the hero is the first thing viewers will see.

Open with the most characteristic thing in the subject's world, in the form that is most appropriate: a headline, an image, an animation, a live demo, an interactive moment, or other treatments.

Be deliberate with your choice: a big number with a small label, supporting stats, and a gradient accent is the default treatment, so only use it if that's truly the best option.

A product's specific purpose should influence its visual hierarchy, composition, and interaction design.

## 2. Typography carries personality

Typography carries the personality of the page.

You don't need a different typeface for display or headline text and body content: use one family or two, and if two, make them clearly distinct.

Choose your typefaces deliberately, not the default families you would reach for on any other project, and set a clear type scale following the default guidance of The Elements of Typographic Style with intentional weights, widths, and spacing.

When type is used as a headline or visual element, use the type treatment itself as an active part of the design, not a neutral delivery vehicle for the content.

Default to line lengths of less than 80 characters.

Serif typefaces can have slightly longer line lengths; give serif body text slightly more line-height than a sans-serif.

Avoid these default typographic treatments; they are the commonest tells of a generated page:

- Accenting just a single word or phrase in a headline, like putting one word in italic/bold or a different color.
- Using all caps for labels.
- Adding unnecessary typographic labels above content.

## 3. Visual structure is information

Visual structure is information.

Structural devices like outlines, borders, numbering, eyebrows, dividers, labels, etc., encode useful information about the content rather than decorate it.

Many generic designs use numbered markers (01 / 02 / 03), but that's only appropriate if the content actually is a sequence — like a stepped process or a timeline.

Before adding numbered markers, check the content really is a sequence.

### Layout rules

Choose layout patterns based on the information's hierarchy.

Do not default to equal-width cards or three-column grids simply because they are easy to implement.

Consider:

- Asymmetrical compositions
- Editorial layouts
- Dense data-oriented arrangements
- Full-width feature sections
- Split-screen experiences
- Strong typography-led layouts
- Intentional whitespace
- Unconventional but usable navigation

Use the structure that serves the product.

Maintain consistent spacing relationships even when using an unconventional layout.

## 4. Motion must communicate something

Use non-user-triggered motion sparingly and deliberately, only to draw attention.

A single orchestrated moment — one page-load sequence or one reveal — lands better than scattered effects.

Fade-and-slide-up entrances on each section and hover transitions on every card are the generic default and read as AI-generated.

Motion that answers a person's action (opening, expanding, confirming) is welcome when it shows what changed.

When adding animation:

- Respect reduced-motion preferences.
- Avoid delaying essential interactions.
- Prioritize responsiveness.
- Use animation to communicate state or hierarchy.
- Do not add animation solely for spectacle.

## 5. Content is part of the design

Consider written content carefully.

Often a design brief may not contain real content, and it's up to you to come up with copy and placeholder content.

Copy can make a design feel as templated as the design itself.

Avoid generic marketing language and vague placeholder content.

Use content specific to the product whenever possible.

---

# Process: Plan, Review, Build, Critique

For calibration, AI-generated design right now clusters around some traits:

1. A warm cream background (near #F4F1EA) with a high-contrast serif display and a terracotta or warm-clay accent (often near #D97757 — Anthropic's own Claude-interaction accent, so on a user's brief it reads as a tell).

2. A near-black background with a single bright acid-green or vermilion accent.

3. A broadsheet-style layout with hairline rules, zero border-radius, and dense newspaper-like columns.

4. The SaaS-card kit: content chopped into identical rounded cards, one border-radius on everything regardless of hierarchy, the same soft grey shadow (rgba(0,0,0,.1)) under each, and gradient washes as decoration.

5. Template chrome that appears whatever the subject: a tracked-out ALL-CAPS eyebrow label above every heading; meta strings joined with middle dots ('A · B · C'); labels built as 'WORD — fragment' with a spaced em dash; tinted near-black (#0B0B0B, #111) standing in for black; a monospace face for small data labels; a '→' appended to link and button text.

All traits are legitimate for some briefs, but they are defaults rather than choices, and they appear regardless of subject.

Where the brief pins down a visual direction, follow it exactly — the brief's own words always win, including when it asks for one of these looks.

Where it leaves an axis free, don't spend that freedom on one of these defaults.

As with a hired human designer, there's often a careful balance between doing what you're good at and taking each project as a chance to experiment and learn.

## Phase 1: Inspect the project

Before writing UI code:

1. Identify the framework and version.
2. Identify the styling solution.
3. Inspect existing components and design tokens.
4. Check whether shadcn/ui is configured.
5. Check existing fonts and icon libraries.
6. Identify established layouts and conventions.
7. Review the requested feature and intended users.

Preserve the existing architecture unless changes are necessary.

If a working design system exists, improve it rather than introducing an unrelated one.

## Phase 2: Establish the design direction

Work in two passes.

First, brainstorm a short design plan based on the client's design brief.

Create a compact token system with color, type, layout, and principles.

### Color

Describe the core base palette as 4–6 named hex values.

When using Radix Colors, identify the selected neutral and accent scales and how they map to semantic tokens.

Explain why these colors fit the product.

### Typography

Specify the typefaces and their roles.

Define a consistent type scale and hierarchy.

### Layout

Describe the layout concept using concise prose.

Use ASCII wireframes to ideate and compare when helpful.

Specify alignment decisions:

- Left aligned
- Center aligned
- Justified
- Asymmetrical
- Grid-based

Explain why the arrangement suits the content.

### Components

Identify the shadcn/ui components that would be useful.

Identify where custom components are justified.

Do not let component availability determine the overall layout.

### Iconography

Identify the Lucide icon conventions:

- Standard sizes
- Stroke treatment
- Placement
- Appropriate icon usage

### Principles

Summarize the distinctive qualities that make this page specific to the product.

## Phase 3: Review against generic defaults

Review the design plan before building.

Ask:

- Could this layout belong to almost any SaaS product?
- Are the colors justified by the product?
- Is typography contributing personality?
- Are components grouped for meaningful reasons?
- Is the design overly dependent on cards?
- Are icons and decorative elements necessary?
- Would the interface remain recognizable without its logo?

If any part reads like the generic default you would produce for a similar page rather than a choice made for this specific brief, revise it.

State what changed and why when explaining the plan.

Only after confirming the relative uniqueness of the design plan should implementation begin.

## Phase 4: Implement

Build the interface using the revised design plan.

When compatible with the project:

- Use shadcn/ui for reusable interface primitives.
- Use Radix Colors for systematic color selection.
- Use Lucide Icons for consistent iconography.
- Use Tailwind CSS for responsive composition and styling.

Implementation priorities:

1. Semantic HTML and correct component structure.
2. Responsive layout.
3. Clear information hierarchy.
4. Accessible interactions.
5. Consistent design tokens.
6. Reusable component architecture.
7. Appropriate loading, error, and empty states.
8. Purposeful motion.

Avoid unnecessary dependencies.

Prefer adapting existing components over duplicating functionality.

### Component architecture

Separate reusable interface primitives from product-specific compositions.

Keep styles coherent with shared tokens and variants.

Avoid large monolithic components when meaningful component boundaries exist.

Do not over-abstract components used only once unless their complexity justifies separation.

When writing code, be careful of CSS selector specificity.

It's easy to generate CSS classes that cancel each other out, especially with conflicting selectors or overlapping utility classes.

Watch for inconsistent padding and margins between sections.

### Data and states

Design and implement realistic states:

- Default
- Loading
- Empty
- Error
- Disabled
- Hover
- Focus
- Selected
- Success

A component is not finished merely because its default state looks good.

Do not populate interfaces with misleading hardcoded metrics presented as real data.

Use clearly identified sample data where actual data is unavailable.

## Phase 5: Visual critique

Review the actual rendered interface whenever a browser or screenshot workflow is available.

Evaluate at:

- Mobile width
- Tablet width
- Desktop width

Review both light and dark themes when supported.

Check for:

- Overflow
- Misalignment
- Inconsistent spacing
- Poor contrast
- Awkward text wrapping
- Excessive empty space
- Crowded controls
- Repetitive components
- Weak visual hierarchy
- Generic design patterns

Compare the rendered result against the intended design direction.

Do not treat successful compilation as proof of visual quality.

Iterate where the implementation falls short.

---

# Restraint and Self-Critique

Spend your boldness in one place.

Let one element be the memorable thing, keep everything around it quiet and disciplined, and cut any decoration that does not serve the brief.

Build to a quality floor without announcing it:

- Responsive down to mobile
- Visible keyboard focus
- Reduced motion respected
- Visually accessible
- Harmonious color palettes
- Consistent interaction behavior

Critique your own work as you build, taking screenshots to review if your environment supports it — a picture is worth 1000 tokens.

Consider Chanel's advice: before leaving the house, take a look in the mirror and remove one accessory.

Human creatives have memory and always try to do something new, so if you have a space to quickly jot down notes about what you've tried, it can help you in future passes.

### Avoid unnecessary complexity

Do not introduce:

- Unnecessary component abstractions
- Decorative animations without purpose
- Multiple competing UI libraries
- Excessive colors
- Redundant icons
- Inconsistent component variants
- Gratuitous borders and shadows
- Complicated layouts where simpler ones communicate better

Prefer a few carefully designed components over many mediocre ones.

---

# More on Writing in Design

Words appear in a design for one reason: to make it easier to understand and use.

They are design content, not decoration.

Bring the same intentionality and minimalism to copywriting that you would bring to spacing and color.

Before writing anything, ask what the design needs to say, and how it can best be said to help the person navigate the experience.

Write from the end user's perspective.

Name things by what users will understand in simple language, not by how the system is built.

A user manages notifications, not webhook config.

Describe what something is or does in plain terms rather than selling it.

Being specific and legible to new users is always better than being clever.

Use active voice as default.

A CTA says exactly what happens when it is used: "Save changes," not "Submit."

An action keeps the same name through the whole flow, so the button that says "Publish" produces a toast that says "Published."

The vocabulary of an interface is the signposting for someone navigating the product.

Cohesion and consistency are how people learn their way around.

Treat failure and emptiness as moments for direction, not mood.

Explain what went wrong and how to fix it, in the interface's voice rather than a person's.

Errors don't apologize, and they are never vague about what happened.

An empty screen is an invitation to act.

Keep the tone conversational:

- Plain verbs
- Sentence case
- No filler
- Tone matched to brand and audience
- Every written element has one job

---

# Final Quality Checklist

Before declaring frontend work complete, verify:

## Design

- [ ] The design has an identifiable visual direction.
- [ ] Colors reflect the product rather than generic defaults.
- [ ] Typography has a deliberate hierarchy.
- [ ] Layout choices support the content.
- [ ] Components have consistent styling.
- [ ] Decoration is purposeful.
- [ ] The page does not resemble a generic AI-generated template.

## Component system

- [ ] Existing components were reused where appropriate.
- [ ] shadcn/ui components follow project conventions.
- [ ] No unnecessary or duplicate UI dependencies were added.
- [ ] Component variants are consistent.
- [ ] Custom components are justified.

## Colors and icons

- [ ] Semantic color tokens are used consistently.
- [ ] Radix Colors are mapped correctly where used.
- [ ] Text and control contrast is sufficient.
- [ ] Light and dark themes work where supported.
- [ ] Lucide icon sizing and stroke are consistent.
- [ ] Icon-only controls have accessible names.

## Functionality

- [ ] Responsive layouts work on mobile and desktop.
- [ ] Keyboard navigation works.
- [ ] Focus states are visible.
- [ ] Reduced-motion preferences are respected.
- [ ] Loading, error, and empty states are handled.
- [ ] Controls behave as their labels suggest.
- [ ] No obvious layout overflow or clipping remains.

## Code quality

- [ ] Components are reusable where appropriate.
- [ ] No unnecessary abstractions were introduced.
- [ ] Existing project conventions were preserved.
- [ ] Relevant tests, linting, and type checks pass.
- [ ] The final interface was visually reviewed when possible.

**Final rule: Use libraries to make implementation reliable, not to make design decisions for you. Every interface should feel designed for its specific product, not assembled from a component showcase.**
