import { parseJournalDate, validateRange } from "@/journal/repository";
import { journalFailure, journalResponse, serverRepository } from "@/journal/server/runtime";
import { requestedProfile } from "@/journal/server/security";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const profile = requestedProfile(url);
    const range = validateRange({ from: parseJournalDate(url.searchParams.get("from")), to: parseJournalDate(url.searchParams.get("to")) });
    const repository = await serverRepository(profile);
    return journalResponse({ entries: await repository.list(profile, range, { signal: request.signal }) });
  } catch (error) { return journalFailure(error); }
}
