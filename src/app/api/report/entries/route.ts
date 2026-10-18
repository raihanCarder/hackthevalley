import { MAYA_PROFILE } from "@/demo/maya";
import { parseJournalDate, validateRange, LOCAL_PROFILE_ID } from "@/journal/repository";
import { requestedProfile } from "@/journal/server/security";
import { journalFailure, journalResponse, serverVisitorRepository } from "@/journal/server/runtime";
import { syntheticJournalSource } from "@/journal/integrations";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const profile = requestedProfile(url);
    const range = validateRange({ from: parseJournalDate(url.searchParams.get("from")), to: parseJournalDate(url.searchParams.get("to")) });
    const entries = profile === "maya"
      ? await Promise.all((await syntheticJournalSource.list("maya", range, { signal: request.signal })).map(row => syntheticJournalSource.read("maya", row.localDate, { signal: request.signal })))
      : await (await serverVisitorRepository()).readRange(range, { signal: request.signal });
    return journalResponse({ profileId: profile === "maya" ? MAYA_PROFILE.id : LOCAL_PROFILE_ID, entries });
  } catch (error) { return journalFailure(error); }
}
