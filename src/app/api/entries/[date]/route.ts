import { JournalError, parseCheckInInput, parseJournalDate } from "@/journal/repository";
import { journalFailure, journalResponse, serverRepository, serverVisitorRepository } from "@/journal/server/runtime";
import { assertVisitorMutation, readCheckInBody, requestedProfile } from "@/journal/server/security";

export const runtime = "nodejs";
type Context = { params: Promise<{ date: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const date = parseJournalDate((await context.params).date);
    const profile = requestedProfile(new URL(request.url));
    const repository = await serverRepository(profile);
    return journalResponse({ entry: await repository.read(profile, date, { signal: request.signal }) });
  } catch (error) { return journalFailure(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    assertVisitorMutation(request);
    const date = parseJournalDate((await context.params).date);
    const input = parseCheckInInput(await readCheckInBody(request));
    if (input.localDate !== date) throw new JournalError("invalid", "The check-in date must match the selected date.");
    const repository = await serverVisitorRepository();
    return journalResponse({ entry: await repository.upsert(input) });
  } catch (error) { return journalFailure(error); }
}
