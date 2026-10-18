import { journalFailure, journalResponse } from "@/journal/server/runtime";
import { assertSameOrigin } from "@/journal/server/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    // Compatibility endpoint; the local journal no longer creates or requires cookies.
    return journalResponse({ profile: "visitor", storage: "postgresql" });
  } catch (error) { return journalFailure(error); }
}
