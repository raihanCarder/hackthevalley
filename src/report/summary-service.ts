import type { DailyEntry, LocalDate } from "../domain/contracts";
import { JournalError, LOCAL_PROFILE_ID, validateRange, type DateRange } from "../journal/repository";
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
  constructor(readonly code: "invalid" | "empty" | "forbidden" | "changed", message: string) { super(message); this.name = "ReportRequestError"; }
}
export interface SummaryDependencies {
  gemini: GeminiConfig | null;
  fetcher?: typeof fetch;
  loadVisitorEntries?: (range: DateRange) => Promise<DailyEntry[]>;
  synthetic: { profileId: string; entries: readonly DailyEntry[] };
}

/** Server-owned evidence only. No browser-provided entries or profile IDs are accepted. */
export function reportRevision(entries: readonly DailyEntry[]): string {
  return JSON.stringify(entries.map(entry => [entry.id, entry.updatedAt]).sort((a, b) => a[0].localeCompare(b[0])));
}

export async function prepareSummary(body: unknown, deps: SummaryDependencies): Promise<SummaryResponse> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ReportRequestError("invalid", "Expected a report request.");
  const request = body as Record<string, unknown>;
  if (Object.keys(request).some(key => !["profile", "from", "to", "revision"].includes(key))) throw new ReportRequestError("invalid", "Report requests accept only profile, from, to, and revision.");
  const profile = request.profile;
  if (profile !== "maya" && profile !== "visitor") throw new ReportRequestError("forbidden", "Unknown report profile.");
  let range: { from: LocalDate; to: LocalDate };
  try { range = validateRange({ from: request.from as LocalDate, to: request.to as LocalDate }); }
  catch (error) { throw new ReportRequestError("invalid", error instanceof JournalError ? error.message : "Choose a valid date range."); }

  let entries: DailyEntry[];
  let profileId: string;
  if (profile === "maya") {
    entries = [...deps.synthetic.entries];
    profileId = deps.synthetic.profileId;
  } else {
    if (!deps.loadVisitorEntries) throw new ReportRequestError("invalid", "The saved journal is not connected.");
    entries = await deps.loadVisitorEntries(range);
    profileId = LOCAL_PROFILE_ID;
  }
  const selected = entries.filter(entry => entry.localDate >= range.from && entry.localDate <= range.to && entry.profileId === profileId);
  if (request.revision !== undefined && (typeof request.revision !== "string" || request.revision !== reportRevision(selected))) {
    throw new ReportRequestError("changed", "Saved check-ins changed. Refresh the report before generating a summary.");
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
