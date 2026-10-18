import { MAYA_ENTRIES, MAYA_PROFILE } from "@/demo/maya";
import { JournalError } from "@/journal/repository";
import { serverVisitorRepository } from "@/journal/server/runtime";
import { assertSameOrigin } from "@/journal/server/security";
import { geminiConfig } from "@/report/server/config";
import { prepareSummary, ReportRequestError } from "@/report/summary-service";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 128 * 1024;

/** Explicit report action: the only path that sends report facts and notes to Gemini. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const summary = await prepareSummary(body, { gemini: geminiConfig(), loadVisitorEntries: async range => (await serverVisitorRepository()).readRange(range, { signal: request.signal }), synthetic: { profileId: MAYA_PROFILE.id, entries: MAYA_ENTRIES } });
    return respond({ summary }, 200);
  } catch (error) {
    // The summary action may send notes to Gemini, so it must come from this app's own page.
    if (error instanceof JournalError && error.code === "forbidden") return respond({ error: { code: "forbidden", message: "Summaries can only be requested from the appointment report page." } }, 403);
    if (error instanceof ReportRequestError) return respond({ error: { code: error.code, message: error.message } }, error.code === "forbidden" ? 403 : error.code === "empty" ? 422 : error.code === "changed" ? 409 : 400);
    return respond({ error: { code: "unavailable", message: "The summary could not be prepared. The report's recorded observations are unchanged." } }, 503);
  }
}

function respond(value: unknown, status: number) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new ReportRequestError("invalid", "Send report requests as JSON.");
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new ReportRequestError("invalid", "The report request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new ReportRequestError("invalid", "Expected a report request.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) { await reader.cancel(); throw new ReportRequestError("invalid", "The report request is too large."); }
    chunks.push(value);
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)); }
  catch { throw new ReportRequestError("invalid", "The report request contains invalid JSON."); }
}
