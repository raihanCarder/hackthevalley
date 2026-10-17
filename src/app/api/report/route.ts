import { geminiStatus } from "@/report/server/config";

export const runtime = "nodejs";

/** Independent summary-provider status. "configured" means settings are present, not that a request has succeeded. */
export function GET() {
  return Response.json({ gemini: geminiStatus() }, { headers: { "Cache-Control": "no-store" } });
}
