# Pain journal

### Give your pain a clearer picture.

Pain journal is a browser-based journal for recording pain on a rotatable 3D body and understanding how it changes over time. Paint where pain occurs, choose its sensation and intensity, and save a daily check-in. Revisit the exact markings through playback, regional trends, and date comparisons, then prepare a printable summary for an appointment.

Built at Hack the Valley, the application combines a visual daily record with descriptive analysis. Its focus is helping people document and communicate their experience.

## Features

- **Paint directly on a 3D body.** Rotate, zoom, and use named views to mark locations. Record burning, sharp/stabbing, aching/dull, and tingling/numbness as independent layers, each with a distinct visual effect and intensity control. Erase, undo, and adjust the body shape.
- **Keep a daily record.** Save exact paint maps with a date and optional note, reopen a saved day, or copy an earlier map before editing a new check-in.
- **See changes over time.** Scrub or play back saved maps. Explore regional peak intensity, map coverage, and frequency across recorded days, and compare two saved dates to identify newly marked or no-longer marked areas.
- **Explore a complete example.** Maya provides 42 synthetic, read-only check-ins over six weeks, showing how lower-back aching and left-leg burning develop over time.
- **Prepare for an appointment.** Print or save a report as PDF with front/back range composites, regional observations, saved notes, and a descriptive summary.
- **Organize a summary with Gemini.** An explicit report action sends recorded facts and notes to Google's Gemini API. The application validates the response against the evidence and retains a labeled factual summary when Gemini is unavailable or its response cannot be verified.

## How it works

1. Open the body map, choose a sensation and intensity, and paint where you feel it.
2. Save the day with an optional written note.
3. Open History to replay your records, inspect regional trends, or compare dates.
4. Prepare an appointment report from your saved check-ins.

Use the profile icon to switch between **You**, your persistent local journal, and **Maya**, the synthetic read-only example. The selection follows you between pages.

| Route | Purpose |
| --- | --- |
| `/home` | Product introduction and links into the journal |
| `/` | Interactive body map and painting workspace |
| `/check-in` | Daily check-in details, note, and save controls |
| `/history` | Playback, regional trends, and date comparison |
| `/report` | Appointment report and print/PDF export |

## Technology stack

| Layer | Technology | Role |
| --- | --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript | One application for the interface and server routes |
| 3D interaction | Three.js, custom shaders | Rotatable mannequin, UV painting, body morphs, and pain effects |
| Interface | Tailwind CSS 4, Radix UI, shared shadcn/ui components, Lucide | Accessible controls and a consistent charcoal interface |
| Server | Next.js Route Handlers on Node.js | Journal persistence, server-side measurements, and report endpoints |
| Database | PostgreSQL, `pg`, SQL migrations | Exact paint maps, dates, notes, profile ownership, and regional observations |
| Analysis | Shared TypeScript domain and timeline modules | Deterministic trends, comparisons, and report evidence |
| Report AI | Google Gemini API, called from the server | Evidence-validated summary organization with a factual fallback |
| Export | Browser printing | Printable reports and Save as PDF |
| Verification | Node.js test runner, Playwright | Domain, persistence, and browser acceptance checks |

PostgreSQL uses ordinary tables; no time-series extension or cloud database service is required. Dependency versions and available commands are recorded in [package.json](package.json).

## Run locally

### Prerequisites

- Node.js **20.19 or newer** and npm.
- PostgreSQL for saving your journal. The included Docker Compose configuration runs PostgreSQL 17; an existing local PostgreSQL installation also works.
- A browser with WebGL support for the interactive body.

The homepage, Maya's sample history, and her factual appointment report work without PostgreSQL or Gemini credentials.

### Setup

Install dependencies and start the included local database:

```sh
npm ci
docker compose -f db/compose.yml up -d --wait
```

Create or edit `.env.local` using [.env.example](.env.example) as a reference. Add the following connection string for the included Compose database, preserving any existing settings:

```dotenv
DATABASE_URL=postgresql://pain_journal:pain_journal@127.0.0.1:5432/pain_journal
```

Apply the SQL migrations, then start the application:

```sh
npm run db:migrate
npm run dev
```

Open [the homepage](http://localhost:3000/home), or go directly to [the body editor](http://localhost:3000). Select You to save your own check-ins, or Maya to explore the sample.

If you already run PostgreSQL locally, set `DATABASE_URL` for that database and skip the Compose command. The configured database and login must exist. See [local journal setup](docs/journal.md) for the native PostgreSQL alternative and storage details.

### Configuration

All settings below belong on the server in `.env.local`. Restart the application after changing them.

| Variable | Required for | Description |
| --- | --- | --- |
| `DATABASE_URL` | Your journal | PostgreSQL connection string for the persistent local journal |
| `GEMINI_API_KEY` | Gemini summaries | Your Google Gemini API key |
| `GEMINI_MODEL` | Gemini summaries | An API model ID available to your key; both Gemini settings are required |
| `GEMINI_TIMEOUT_MS` | Optional | Positive timeout in milliseconds for the Gemini request |
| `APP_ORIGIN` | Optional | Canonical application origin when running behind a reverse proxy |

Use **Generate Gemini summary** in the appointment report to request AI organization. This sends the selected report's saved facts and notes to Gemini. Saving a check-in never calls Gemini. Missing configuration, provider failures, timeouts, and rejected responses leave the factual summary available.

Keep credentials out of client code and source control; never prefix these variables with `NEXT_PUBLIC_`. See [report documentation](docs/report.md) for evidence validation and provider behavior.

## Repository structure

```text
src/
  app/                  Next.js routes, layouts, homepage, and server endpoints
    (journal)/          Shared body editor and check-in details workspace
    home/               Product homepage and scoped styles
    history/            History and analysis route
    report/             Appointment report route
    api/                Journal, status, and report Route Handlers
  body/                 Three.js scene, shaders, paint engine, UV maps, and regions
  components/           Shared navigation and UI primitives
  domain/               Versioned data contracts and validation
  journal/              Profiles, editor integration, repositories, and persistence
  timeline/             Playback, regional analysis, charts, and comparisons
  report/               Report evidence, composites, Gemini adapter, and presentation
  demo/                 Deterministic synthetic Maya history and read-only source
db/
  migrations/           Ordered SQL schema migrations
  compose.yml           Local PostgreSQL service
  migrate.ts            Migration runner
public/body/            Generated mannequin assets, atlas, and provenance
scripts/                Asset generators and development/acceptance runners
tests/                  Domain, body, journal, report, and browser checks
docs/                   Architecture, feature guides, and verification records
openspec/               Product requirements, change proposals, and task tracking
```

Database access and provider configuration stay in server modules. The body renderer runs only in the browser. Exact versioned paint maps are saved alongside regional measurements so History can restore the original markings.

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build the production application |
| `npm start` | Serve a completed production build |
| `npm run typecheck` | Check TypeScript without emitting files |
| `npm test` | Run the main automated test suite |
| `npm run test:journal` | Run journal unit checks |
| `npm run test:journal:postgres` | Run PostgreSQL integration checks using `TEST_DATABASE_URL` |
| `npm run test:browser` | Run Playwright against a running application; optional `TEST_BASE_URL` |
| `npm run test:local-browser` | Start an isolated app and run browser acceptance with a temporary local database schema |
| `npm run db:migrate` | Apply pending database migrations |
| `npm run body:generate` | Regenerate the mannequin and region assets |
| `npm run body:shape` | Regenerate the body-shape morph pack |
| `npm run demo:generate` | Regenerate Maya's deterministic sample records |

Install Chromium before running browser acceptance:

```sh
npx playwright install chromium
npm run test:local-browser
```

The local browser runner uses `DATABASE_URL` to create and remove a generated test schema, starts a separate app instance, and disables live Gemini. It does not populate or clear your journal. The PostgreSQL integration command likewise uses a disposable schema:

```sh
TEST_DATABASE_URL=<local-connection-string> npm run test:journal:postgres
```

For focused browser checks, pass Playwright arguments through the runner:

```sh
npm run test:local-browser -- homepage.spec.ts foundation.spec.ts
```

Existing verification records describe the environment and limits of their observed runs; they do not establish production clinical readiness or a successful live Gemini request in every installation.

### Planning changes

The repository uses OpenSpec to keep proposals, requirements, designs, and implementation tasks alongside the code. It is already initialized. With the OpenSpec CLI installed, use the included Codex skills:

```text
$openspec-propose "Describe the feature or fix"
$openspec-apply-change
$openspec-archive-change
```

Review the proposed artifacts before applying a change. See [the current product proposal](openspec/changes/pain-map-journal/proposal.md) and [implementation checklist](openspec/changes/pain-map-journal/tasks.md) for the MVP scope.

## Contributors

Human contributors recorded in this repository's Git history:

| Contributor | GitHub |
| --- | --- |
| Raihan C | [raihanCarder](https://github.com/raihanCarder) |
| Arshdip Pamma | [arshdippamma](https://github.com/arshdippamma) |
| Krish Patel | — |

Git aliases are consolidated per person. This list credits recorded contributions without assigning project roles.

## Data and product scope

**You** is one persistent journal in local PostgreSQL on this device. Browsers connected to the same local installation share that journal; clearing cookies or restarting the app does not change its ownership. **Maya** is a fixed synthetic, read-only sample, separate from your records. Historical IndexedDB and visitor records are preserved without being automatically imported or exposed as additional storage choices.

A missing date stays unrecorded. An explicitly saved empty map is a recorded check-in with no marked regions. History can display an earlier map on a missed day with a carried-over label; trends, comparisons, and reports use actual saved check-ins. Coverage describes a fraction of the body map, not physical skin area.

Reports describe recorded observations without diagnosing or recommending treatment. This project is a local MVP; production authentication, clinical deployment, voice capture, and automatic note extraction are outside the implemented product scope.

## Documentation and attribution

- [Local journal and storage](docs/journal.md)
- [Body editor](docs/body-editor.md) and [body-map contract](docs/body-contract.md)
- [History and analysis](docs/history.md)
- [Reports and Gemini](docs/report.md)
- [Interface design](docs/ui-design.md)
- [Local journal verification](docs/local-journal-verification.md) and [integration verification](docs/integration-verification.md)

The mannequin is derived from MakeHuman assets released under CC0. Asset sources, processing, versioning, and attribution are documented in [body asset provenance](public/body/PROVENANCE.md), with the [source asset license](scripts/body/source/LICENSE-CC0.md). Those terms describe the source assets and do not establish a license for the application as a whole.
