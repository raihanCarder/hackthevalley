# Pain journal demonstration

The demonstration centers on direct 3D painting and change over time. The report is the final supporting step. Maya is synthetic; these are recorded markings, not a diagnosis or prediction.

## Start without external services

Run `npm ci`, then `npm run dev`, and open http://localhost:3000. Choose **This browser (IndexedDB)**. No database or Gemini key is needed. Avoid overwriting an existing `.env.local`; omit service settings in a fresh demo environment to rehearse the disconnected path.

## Rehearse the demo (3–5 minutes)

1. **Paint and save.** Turn the body to inspect it. Choose aching, an intensity, and Paint; mark the lower back or patient-left calf. Add burning over part of the same location. Show selected-layer erase and Undo, then save with a written note. Reload the same date to show the exact markings and note. A skipped date remains unrecorded. On a later date, copy the previous map, edit a note, and save; the source stays unchanged.
2. **Play Maya.** Open History. Identify Maya's **Synthetic · Read-only** label. Scrub to September 6 and play at 2x. The four early check-ins are explicitly empty; lower-back aching starts September 10, thigh burning October 3, and calf burning October 10. Front/back views expose the actual saved markings. Playback stops October 17; scrubbing pauses it.
3. **Inspect regional trends.** Choose Lower Back / aching: 38 of 42 recorded days, first September 10, last October 17, highest peak 6.0/10. Select Left Thigh / burning (15 recorded days) and Left Calf / burning (8). Change the analysis range. Explain peak intensity versus map coverage; coverage is a body-map fraction, not physical skin area. Missing check-ins are gaps, not zeros.
4. **Compare dates.** Use Thigh Onset (October 2 vs 3) and Calf Spread (October 3 vs 10). Inspect both labeled saved maps and the peak/coverage table. Newly or no-longer marked regions describe the entries without asserting a cause. On narrow screens the two maps stack, retaining their dates and labels.
5. **Return to Visitor.** Visitor history contains the earlier saved drawings and never Maya's entries. With only one recorded date, playback is disabled and that map remains inspectable. Missing and explicitly empty dates have different labels. Switching profiles restores the selected date/range.
6. **Prepare the report.** Open Appointment report, initially showing Maya. Confirm the 42 recorded days, four empty check-ins, front/back range composites, three region/sensation rows, and patient-attributed partial-relief wording. The composite shows the strongest marking saved at each location across the range, not simultaneous pain. Print/Save as PDF fits Maya's default report on one A4 or Letter page in Chromium. Visitor reports use saved records only.
7. **Gemini when configured.** Add your server-side `GEMINI_API_KEY` and `GEMINI_MODEL`, restart, and click Organize with Gemini. This explicit action sends the saved facts/notes. A validated response names Gemini and its model. Missing keys, errors, invalid responses, and timeouts retain the labeled factual summary and retry. Never describe the factual fallback as Gemini output.

## Regeneration and checks

```sh
npm run demo:generate
npm test
npm run typecheck
npm run build
# Start dev or production server first:
npm run test:browser
```

Regeneration uses the normal paint/reducer/encoding pipeline and fixed dates/formulas. All 42 records are checked against decoded maps. The required onset dates and counts are asserted by the generator itself.

For PostgreSQL, follow [journal setup](journal.md), select Local PostgreSQL, and repeat the same visitor save/reload/history/report path. Maya, deterministic analysis, and printing remain independent of the database and Gemini. See [integration verification](integration-verification.md) for observed desktop/touch checks, provider simulation, and outstanding demo-device/live-provider limits.
