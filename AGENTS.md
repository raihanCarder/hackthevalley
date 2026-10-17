# Project Summary

We are planning a workable MVP of a browser-based pain journal. The two main selling points are **painting pain directly on a rotatable 3D body** and **analyzing how that pain changes over time**. The 3D interaction and longitudinal analysis must drive the product, interface, build priorities, and demo. A person paints location, sensation, and intensity, then saves a daily check-in with an optional written note. Playback and regional trends show changes in intensity, coverage, frequency, and newly marked regions. A synthetic patient, Maya, supplies six weeks of sample history. A printable appointment report supports this experience with descriptive observations, without diagnosing or recommending treatment.

## Proposed Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Application | Next.js App Router, React, TypeScript | 3D check-in, history analysis, and supporting report screens |
| 3D interaction | Three.js and custom shaders | Body rotation, UV-based painting, and four animated pain types |
| API | Next.js Route Handlers using the Node.js runtime | Save/load check-ins, compute trends, and make server-side AI calls |
| Database | Plain PostgreSQL with the `pg` driver and SQL migrations | Store exact paint maps, dates, notes, and regional measurements |
| Report AI | Gemini API, if included in the agreed MVP | Organize recorded evidence into a descriptive summary, with a factual fallback |
| Export | Browser print / Save as PDF | Printable appointment report |

Use ordinary PostgreSQL tables; Tiger Data, TimescaleDB, hypertables, and a time-series extension are not required. Prioritize a working end-to-end demo over additional infrastructure.

## MVP Priorities and Planning

- Build in this order: body scene → painting → four pain effects → regional measurements and daily saves → Maya's timelapse → appointment report.
- Regional trend analysis and date comparisons are part of the core timeline milestone, before report polish. The demo must show both compelling 3D painting and meaningful change over time.
- Use one Next.js application for the interface and server routes; keep database access and Gemini secrets on the server. The Three.js body runs in a browser-only component.
- Use the [frontend-design skill](.agents/skills/frontend-design/SKILL.md) for non-3D application UI, including layouts, navigation, toolbars, forms, history/trend/comparison screens, and report presentation. This requirement does not cover 3D models, UV/raycasting/paint algorithms, scene lighting, or shaders; controls surrounding the 3D canvas are included.
- Pain types are burning, sharp/stabbing, aching/dull, and tingling/numbness, each with a distinct visual treatment.
- Save the actual paint maps as well as region statistics so playback restores the original markings.
- Distinguish a missing check-in from an explicitly saved empty map. Label Maya's records as synthetic.
- Voice capture, automatic note extraction, and extra charts in the printable report are deferred optional work. The timeline's basic regional trends and comparison view are core MVP features.
- Account scope and whether live Gemini belongs in the first MVP are awaiting clarification. Do not assume production authentication or clinical deployment is required.
- The current workflow is planning only. Do not begin application implementation until the user asks to apply the change.
- Product scope: [proposal](openspec/changes/pain-map-journal/proposal.md).
- Architecture and stack: [design](openspec/changes/pain-map-journal/design.md).
- Ordered implementation checklist: [tasks](openspec/changes/pain-map-journal/tasks.md).

# Git Workflow

## Commits

- Before creating a commit, read `.gitmessage`.
- Follow the commit message format defined there.
- Use descriptive, concise commit messages.
- Use the required format even when running `git commit -m`.
- Do not commit unrelated changes.
- Only create commits when requested by the user.

## Pull Requests

- Before creating a PR, read `.github/PULL_REQUEST_TEMPLATE.md`.
- Follow the template's structure exactly.
- Fill in each relevant section with accurate information.
- Summarize actual changes from the Git diff.
- When using GitHub CLI, provide a populated PR body
  instead of relying on automatically generated commit summaries.
- Do not merge PRs without explicit permission.

## General

- Follow existing branch naming conventions.
- Review changes before committing.
- Prefer small, focused commits.
