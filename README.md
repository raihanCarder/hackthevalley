# Hack the Valley

## Pain journal foundation

Task 1 of `pain-map-journal` establishes a Next.js App Router / React / TypeScript app with a browser-only Three.js mannequin. Rotate by dragging, use the named front/back/patient-side views, or focus the canvas and use arrow keys, +/−, and Home. Paint mode locks camera gestures; painting, saves, history analysis, and reports are later milestones. History and report routes are labeled placeholders. No database or Gemini credentials are required for this increment.

Requires Node.js 20.19+ and npm (verified with Node 22.16.0).

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The Node-runtime foundation endpoint is `/api/status`.

```sh
npm test
npm run typecheck
npm run build
npm start
```

Browser verification (start the dev or production server first):

```sh
npx playwright install chromium
npm run test:browser
# For another port: TEST_BASE_URL=http://127.0.0.1:3001 npm run test:browser
```

The original procedural mannequin and attribution live in `public/body/`; regenerate the checked-in asset with `npm run body:generate`. The [body/entry contract](docs/body-contract.md) records coordinates, UVs, region IDs, and version rules. The [UI direction](docs/ui-design.md) covers check-in, future history/comparison, report, and accessible responsive controls. Account/store mode and live Gemini scope remain open for the affected later tasks.

## OpenSpec (optional)

[OpenSpec](https://github.com/Fission-AI/OpenSpec) helps you plan changes with an AI coding assistant before implementing them. It keeps proposals, requirements, designs, and task lists in `openspec/` so the team can review the plan alongside the code.

This repo already includes OpenSpec configuration and Codex skills in `.agents/skills/`.

### Install

Requires Node.js 20.19.0 or newer and npm. Install the CLI on your machine:

```sh
npm install -g @fission-ai/openspec@latest
openspec --version
```

For a new project, initialize OpenSpec from its root with Codex selected:

```sh
openspec init --tools codex
```

This repo is already initialized, so you can skip that step.

### Use with Codex

In a Codex conversation opened in this repo, start a proposal:

```text
$openspec-propose "Describe the feature or fix"
```

Review the generated plan, then use `$openspec-apply-change` to implement it. After implementation is complete, use `$openspec-archive-change` to archive it.

See the [installation guide](https://github.com/Fission-AI/OpenSpec/blob/main/docs/installation.md) for more setup options.
