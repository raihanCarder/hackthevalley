import test from "node:test";
import assert from "node:assert/strict";
import { parseLocalDate } from "../../src/domain/contracts";
import { acknowledgeSave, copyPreviousMap, createDraft, editDraft, JournalSelection, rejectSave, restoreDraft, saveInput } from "../../src/journal/draft";
import type { JournalRepository } from "../../src/journal/repository";
import { entry, maps } from "./fixtures";

test("copying an earlier map preserves its source and today's note/date without recording skipped days", () => {
  const source = entry("2026-10-15");
  const original = structuredClone(source);
  const draft = editDraft(createDraft(parseLocalDate("2026-10-17"), "America/Toronto"), { note: "Today's note" });
  const copy = copyPreviousMap(draft, source);
  assert.equal(copy.copiedFrom, "2026-10-15");
  assert.equal(copy.localDate, "2026-10-17");
  assert.equal(copy.note, "Today's note");
  assert.equal(copy.saveState, "unsaved");
  assert.equal(copy.savedEntry, null);
  copy.maps!.layers.aching = "changed draft";
  assert.deepEqual(source, original);
  assert.throws(() => copyPreviousMap(draft, entry("2026-10-17")));
});

test("a missing snapshot cannot become a saved empty day, and write failures retain all draft content", () => {
  const blank = createDraft(parseLocalDate("2026-10-17"), "America/Toronto");
  assert.throws(() => saveInput(blank));
  const draft = editDraft(blank, { maps: maps("test-only-empty"), note: "Intentionally empty today" });
  const rejected = rejectSave(draft);
  assert.deepEqual(rejected.maps, draft.maps);
  assert.equal(rejected.note, draft.note);
  assert.equal(rejected.saveState, "error");
  assert.deepEqual(saveInput(rejected), saveInput(draft));
});

test("only a matching acknowledged revision becomes saved; newer edits stay unsaved", () => {
  const saved = entry();
  const submitted = editDraft(restoreDraft(saved), { note: "Submitted" });
  const newer = editDraft(submitted, { note: "Typed while saving" });
  assert.equal(acknowledgeSave(submitted, submitted, saved).saveState, "saved");
  const result = acknowledgeSave(newer, submitted, saved);
  assert.equal(result.saveState, "unsaved");
  assert.equal(result.note, "Typed while saving");
  saved.maps.layers.aching = "changed elsewhere";
  assert.notEqual(result.savedEntry!.maps.layers.aching, saved.maps.layers.aching);
  assert.throws(() => acknowledgeSave(newer, submitted, entry("2026-10-16")));
});

test("stale and cancelled reads cannot replace a newer selected date, even if the adapter ignores cancellation", async () => {
  const selection = new JournalSelection();
  let finishOld!: (value: ReturnType<typeof entry>) => void;
  const repository: Pick<JournalRepository, "read"> = { read: (_profile: string, date: string) => date === "2026-10-15"
    ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve(entry(date)) };
  const old = selection.read(repository, parseLocalDate("2026-10-15"));
  const current = await selection.read(repository, parseLocalDate("2026-10-17"));
  finishOld(entry("2026-10-15"));
  assert.equal(await old, undefined);
  assert.equal(current?.localDate, "2026-10-17");
});
