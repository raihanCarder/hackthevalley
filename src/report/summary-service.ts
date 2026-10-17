import type { DailyEntry, LocalDate } from "../domain/contracts";
import { MapValidationError, validateEntryPayload } from "../body/map-utils";
import { JournalError, validateRange } from "../journal/repository";
import { buildReportModel } from "./facts";
import { summarize, type FallbackReason, type GeminiConfig } from "./gemini";
import { renderStatement, type PlanStatement } from "./plan";

export type ReportProfileKey = "maya" | "visitor";
export interface SummaryResponse {
  source: "gemini" | "factual";
  model?: string;
  reason?: FallbackReason;
  detail?: string;
  statements: PlanStatement[];
  sentences: string[];
  recordedDays: number;
}
export class ReportRequestError extends Error {
  constructor(readonly code: "invalid" | "empty" | "forbidden", message: string) { super(message); this.name = "ReportRequestError"; }
}
export interface SummaryDependencies {
  gemini: GeminiConfig | null;
  fetcher?: typeof fetch;
  synthetic: { profileId: string; entries: readonly DailyEntry[] };
}

/**
 * Server-side summary preparation. Maya's evidence comes from the immutable synthetic fixture; visitor entries are
 * submitted by the browser that holds them, then re-validated and re-measured from their maps before use, so the
 * evidence Gemini sees is computed on the server. Only an explicit report action reaches this function.
 */
export async function prepareSummary(body: unknown, deps: SummaryDependencies): Promise<SummaryResponse> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ReportRequestError("invalid", "Expected a report request.");
  const request = body as Record<string, unknown>;
  if (Object.keys(request).some(key => !["profile", "from", "to", "entries"].includes(key))) throw new ReportRequestError("invalid", "Report requests accept only profile, from, to, and entries.");
  const profile = request.profile;
  if (profile !== "maya" && profile !== "visitor") throw new ReportRequestError("forbidden", "Unknown report profile.");
  let range: { from: LocalDate; to: LocalDate };
  try { range = validateRange({ from: request.from as LocalDate, to: request.to as LocalDate }); }
  catch (error) { throw new ReportRequestError("invalid", error instanceof JournalError ? error.message : "Choose a valid date range."); }

  let entries: DailyEntry[];
  let profileId: string;
  if (profile === "maya") {
    if (request.entries !== undefined) throw new ReportRequestError("invalid", "Maya's synthetic records are read on the server.");
    entries = [...deps.synthetic.entries];
    profileId = deps.synthetic.profileId;
  } else {
    if (!Array.isArray(request.entries)) throw new ReportRequestError("invalid", "Expected the saved check-ins for this range.");
    entries = await verifyVisitorEntries(request.entries, range);
    profileId = entries[0]?.profileId ?? "";
  }

  const model = buildReportModel(entries, { profileId, start: range.from, end: range.to });
  if (!model) throw new ReportRequestError("empty", "This range has no saved check-ins, so there is nothing to summarize.");
  const result = await summarize(model.facts, deps.gemini, deps.fetcher);
  return {
    source: result.source,
    ...(result.source === "gemini" ? { model: result.model } : { reason: result.reason, detail: result.detail }),
    statements: result.plan,
    sentences: result.plan.map(statement => renderStatement(statement, model.facts)),
    recordedDays: model.facts.range.recordedDays,
  };
}

async function verifyVisitorEntries(values: unknown[], range: { from: LocalDate; to: LocalDate }): Promise<DailyEntry[]> {
  if (values.length > 366) throw new ReportRequestError("invalid", "Too many check-ins for one report.");
  const entries: DailyEntry[] = [];
  for (const value of values) {
    try {
      const { entry, submittedObservationsMatched } = await validateEntryPayload(value);
      if (!submittedObservationsMatched) throw new ReportRequestError("invalid", `The check-in for ${entry.localDate} does not match its saved map.`);
      if (entry.localDate < range.from || entry.localDate > range.to) throw new ReportRequestError("invalid", "A submitted check-in is outside the report range.");
      if (entry.profileId === "maya-synthetic" || (entries.length > 0 && entry.profileId !== entries[0].profileId)) throw new ReportRequestError("invalid", "All check-ins must come from one visitor profile.");
      entries.push(entry);
    } catch (error) {
      if (error instanceof ReportRequestError) throw error;
      throw new ReportRequestError("invalid", error instanceof MapValidationError ? error.message : "A submitted check-in is not valid.");
    }
  }
  if (new Set(entries.map(entry => entry.localDate)).size !== entries.length) throw new ReportRequestError("invalid", "Each date can appear only once.");
  return entries;
}
