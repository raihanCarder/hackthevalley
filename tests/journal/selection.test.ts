import test from "node:test";
import assert from "node:assert/strict";
import { parseLocalDate, type LocalDate } from "../../src/domain/contracts";
import { fitRangeToEntries } from "../../src/journal/selection";

const day = (value: string) => parseLocalDate(value);
const entries = (...dates: string[]) => dates.map(localDate => ({ localDate: localDate as LocalDate }));

test("a fitted history range starts at the first recorded check-in, not a preset window", () => {
  assert.deepEqual(fitRangeToEntries(entries("2026-10-16", "2026-10-12", "2026-10-14"), day("2026-10-18"), day("2026-10-18")),
    { from: "2026-10-12", to: "2026-10-18" });
});

test("a fitted history range with no check-ins covers only the selected day", () => {
  assert.deepEqual(fitRangeToEntries([], day("2026-10-18"), day("2026-10-18")), { from: "2026-10-18", to: "2026-10-18" });
});

test("a linked date before the first check-in stays inside the fitted range", () => {
  assert.deepEqual(fitRangeToEntries(entries("2026-10-12"), day("2026-10-01"), day("2026-10-18")), { from: "2026-10-01", to: "2026-10-18" });
});

test("a fitted history range never exceeds the listable window", () => {
  assert.deepEqual(fitRangeToEntries(entries("2024-01-01"), day("2026-10-18"), day("2026-10-18")), { from: "2025-10-18", to: "2026-10-18" });
});
