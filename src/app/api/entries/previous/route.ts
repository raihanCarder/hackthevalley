import { parseJournalDate } from "@/journal/repository";
import { journalFailure, journalResponse, serverRepository } from "@/journal/server/runtime";
import { requestedProfile } from "@/journal/server/security";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const before = parseJournalDate(url.searchParams.get("before"));
    const profile = requestedProfile(url);
    const repository = await serverRepository(profile);
    return journalResponse({ entry: await repository.previous(profile, before, { signal: request.signal }) });
  } catch (error) { return journalFailure(error); }
}
