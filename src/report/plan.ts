import { regionPhrase, SENSATION_WORDS, type ChangeFact, type NoteFact, type RegionFact, type ReportFacts } from "./facts";

/**
 * A summary is an ordered plan of statements, never free text. Each statement names a supported kind, references
 * evidence IDs, and echoes the values it relies on. Validation rejects any plan whose references or values differ from
 * the computed facts; accepted statements are rendered through fixed descriptive templates using the facts' values.
 */
export const STATEMENT_KINDS = ["recorded-days", "region-frequency", "first-recorded", "highest-peak", "location-added", "coverage-change", "patient-note"] as const;
export type StatementKind = (typeof STATEMENT_KINDS)[number];
export interface PlanStatement {
  kind: StatementKind;
  evidenceIds: string[];
  date?: string;
  laterDate?: string;
  count?: number;
  total?: number;
  value?: number;
  earlierValue?: number;
  laterValue?: number;
  quote?: string;
}
export const MAX_STATEMENTS = 6;
export const MAX_QUOTE_LENGTH = 240;
type Field = Exclude<keyof PlanStatement, "kind" | "evidenceIds">;
const FIELDS: Record<StatementKind, { ids: number; fields: Field[] }> = {
  "recorded-days": { ids: 1, fields: ["count", "total"] },
  "region-frequency": { ids: 1, fields: ["count", "total"] },
  "first-recorded": { ids: 1, fields: ["date"] },
  "highest-peak": { ids: 1, fields: ["value"] },
  "location-added": { ids: 2, fields: ["date", "laterDate"] },
  "coverage-change": { ids: 1, fields: ["date", "laterDate", "earlierValue", "laterValue"] },
  "patient-note": { ids: 1, fields: ["date", "quote"] },
};
const ALL_FIELDS = new Set<string>(["kind", "evidenceIds", "date", "laterDate", "count", "total", "value", "earlierValue", "laterValue", "quote"]);
/** Notes are patient data. Text that reads like instructions to a model is never quoted into the summary. */
const INSTRUCTION_LIKE = /\b(ignore|disregard|forget)\b[^.]{0,40}\b(instruction|prompt|rule|above|previous|prior)|\bsystem prompt\b|\byou are (now )?(a|an|the)\b/i;

export class PlanRejected extends Error {
  constructor(message: string) { super(message); this.name = "PlanRejected"; }
}

/** Validates an untrusted plan (e.g. a model response) against the facts. Throws PlanRejected on any discrepancy. */
export function validatePlan(raw: unknown, facts: ReportFacts): PlanStatement[] {
  if (!isRecord(raw) || Object.keys(raw).some(key => key !== "statements") || !Array.isArray(raw.statements)) throw new PlanRejected("Expected an object with a statements list only.");
  const statements = raw.statements as unknown[];
  if (statements.length < 1 || statements.length > MAX_STATEMENTS) throw new PlanRejected(`Expected 1–${MAX_STATEMENTS} statements.`);
  const seen = new Set<string>();
  return statements.map((value, index) => {
    const statement = checkStatement(value, facts, index);
    const key = JSON.stringify(statement);
    if (seen.has(key)) throw new PlanRejected(`Statement ${index + 1} repeats another statement.`);
    seen.add(key);
    return statement;
  });
}

function checkStatement(value: unknown, facts: ReportFacts, index: number): PlanStatement {
  const fail = (reason: string): never => { throw new PlanRejected(`Statement ${index + 1}: ${reason}`); };
  if (!isRecord(value)) return fail("not an object.");
  for (const key of Object.keys(value)) if (!ALL_FIELDS.has(key)) fail(`unsupported field "${key}".`);
  const kind = value.kind as StatementKind;
  if (!STATEMENT_KINDS.includes(kind)) return fail(`unsupported kind "${String(value.kind)}".`);
  const spec = FIELDS[kind];
  const ids = value.evidenceIds;
  if (!Array.isArray(ids) || ids.length !== spec.ids || ids.some(id => typeof id !== "string")) return fail(`expected ${spec.ids} evidence reference(s).`);
  const statement: PlanStatement = { kind, evidenceIds: [...ids] as string[] };
  for (const field of Object.keys(value) as (keyof PlanStatement)[]) {
    if (field === "kind" || field === "evidenceIds" || value[field] === null) continue;
    if (!spec.fields.includes(field as Field)) fail(`"${field}" does not belong to ${kind}.`);
  }
  for (const field of spec.fields) {
    const item = value[field];
    const textual = field === "date" || field === "laterDate" || field === "quote";
    if (textual ? typeof item !== "string" : typeof item !== "number" || !Number.isFinite(item)) fail(`missing or invalid "${field}".`);
    (statement as unknown as Record<string, unknown>)[field] = item;
  }
  const region = (id: string) => facts.regions.find(row => row.id === id) ?? fail(`unknown evidence "${id}".`);
  const equal = (claimed: unknown, actual: unknown, name: string) => { if (claimed !== actual) fail(`${name} ${String(claimed)} does not match the records (${String(actual)}).`); };

  switch (kind) {
    case "recorded-days":
      if (ids[0] !== "range") fail(`unknown evidence "${ids[0]}".`);
      equal(statement.count, facts.range.recordedDays, "recorded days"); equal(statement.total, facts.range.calendarDays, "calendar days"); break;
    case "region-frequency": {
      const row = region(ids[0]);
      equal(statement.count, row.presentDays, "present days"); equal(statement.total, row.recordedDays, "recorded days"); break;
    }
    case "first-recorded": equal(statement.date, region(ids[0]).firstDate, "first date"); break;
    case "highest-peak": equal(statement.value, region(ids[0]).maxPeak, "peak intensity"); break;
    case "location-added": {
      const first = region(ids[0]), later = region(ids[1]);
      if (first.painType !== later.painType || first.regionId === later.regionId) fail("locations must be different regions with the same sensation.");
      equal(statement.date, first.firstDate, "first date"); equal(statement.laterDate, later.firstDate, "later date");
      if (!(first.firstDate < later.firstDate)) fail("the later location must be first recorded after the earlier one.");
      break;
    }
    case "coverage-change": {
      const change = facts.changes.find(row => row.id === ids[0]) ?? fail(`unknown evidence "${ids[0]}".`);
      equal(statement.date, change.earlierDate, "earlier date"); equal(statement.laterDate, change.laterDate, "later date");
      equal(statement.earlierValue, change.earlierCoveragePercent, "earlier coverage"); equal(statement.laterValue, change.laterCoveragePercent, "later coverage");
      break;
    }
    case "patient-note": {
      const note = facts.notes.find(row => row.id === ids[0]) ?? fail(`unknown evidence "${ids[0]}".`);
      equal(statement.date, note.date, "note date");
      const quote = statement.quote!;
      if (quote.trim().length < 8 || quote.length > MAX_QUOTE_LENGTH || /[\r\n]/.test(quote)) fail("quotes must be 8–240 characters on one line.");
      if (!note.text.includes(quote)) fail("the quote is not the patient's exact words.");
      if (INSTRUCTION_LIKE.test(quote)) fail("the quote reads as instructions rather than patient context.");
      break;
    }
  }
  return statement;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Oct 3, 2026": calendar formatting without time-zone conversion. */
export function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}
const capital = (text: string) => text[0].toUpperCase() + text.slice(1);
const subject = (row: RegionFact | ChangeFact) => `${SENSATION_WORDS[row.painType]} in the ${regionPhrase(row.regionId)}`;
const formatNumber = (value: number) => (Math.round(value * 10) / 10).toString();

/** Renders an already-validated statement with values taken from the facts, not from the statement. */
export function renderStatement(statement: PlanStatement, facts: ReportFacts): string {
  const region = (id: string) => facts.regions.find(row => row.id === id)!;
  const [id, second] = statement.evidenceIds;
  switch (statement.kind) {
    case "recorded-days": {
      const { recordedDays, calendarDays, missingDays } = facts.range;
      return missingDays === 0 ? `Check-ins were saved on all ${calendarDays} calendar days in this range.`
        : `Check-ins were saved on ${recordedDays} of ${calendarDays} calendar days; ${missingDays} ${missingDays === 1 ? "day has" : "days have"} no check-in.`;
    }
    case "region-frequency": { const row = region(id); return `${capital(subject(row))} was marked on ${row.presentDays} of ${row.recordedDays} recorded days.`; }
    case "first-recorded": { const row = region(id); return `${capital(subject(row))} was first recorded on ${formatDate(row.firstDate)}.`; }
    case "highest-peak": { const row = region(id); return `The highest recorded peak intensity for ${subject(row)} was ${formatNumber(row.maxPeak)} out of 10.`; }
    case "location-added": {
      const first = region(id), later = region(second);
      return `${capital(SENSATION_WORDS[first.painType])} was first recorded in the ${regionPhrase(first.regionId)} on ${formatDate(first.firstDate)}, and in the ${regionPhrase(later.regionId)} from ${formatDate(later.firstDate)}.`;
    }
    case "coverage-change": {
      const change = facts.changes.find(row => row.id === id)!;
      return `Map coverage of ${subject(change)} was ${change.earlierCoveragePercent}% on ${formatDate(change.earlierDate)} and ${change.laterCoveragePercent}% on ${formatDate(change.laterDate)}.`;
    }
    case "patient-note": {
      const note: NoteFact = facts.notes.find(row => row.id === id)!;
      return `On ${formatDate(note.date)}, the patient wrote: “${statement.quote}”`;
    }
  }
}

/** The labelled non-AI summary: the same statement kinds, selected by fixed rules from the facts. */
export function deterministicPlan(facts: ReportFacts): PlanStatement[] {
  const plan: PlanStatement[] = [{ kind: "recorded-days", evidenceIds: ["range"], count: facts.range.recordedDays, total: facts.range.calendarDays }];
  for (const row of facts.regions.slice(0, 2)) plan.push({ kind: "region-frequency", evidenceIds: [row.id], count: row.presentDays, total: row.recordedDays });
  // A sensation recorded in a new location: earliest region vs the latest-starting region of the same type.
  for (const painType of new Set(facts.regions.map(row => row.painType))) {
    const rows = facts.regions.filter(row => row.painType === painType).sort((a, b) => a.firstDate.localeCompare(b.firstDate));
    const first = rows[0], last = rows[rows.length - 1];
    if (rows.length > 1 && first.firstDate < last.firstDate) plan.push({ kind: "location-added", evidenceIds: [first.id, last.id], date: first.firstDate, laterDate: last.firstDate });
  }
  const change = [...facts.changes].sort((a, b) => Math.abs(b.laterCoveragePercent - b.earlierCoveragePercent) - Math.abs(a.laterCoveragePercent - a.earlierCoveragePercent))[0];
  if (change && Math.abs(change.laterCoveragePercent - change.earlierCoveragePercent) >= 5) {
    plan.push({ kind: "coverage-change", evidenceIds: [change.id], date: change.earlierDate, laterDate: change.laterDate, earlierValue: change.earlierCoveragePercent, laterValue: change.laterCoveragePercent });
  }
  if (!facts.regions.length) return plan;
  const top = facts.regions[0];
  if (plan.length < MAX_STATEMENTS) plan.push({ kind: "highest-peak", evidenceIds: [top.id], value: top.maxPeak });
  return plan.slice(0, MAX_STATEMENTS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
