import { BODY_MAP_VERSION, SCHEMA_VERSION } from "@/domain/contracts";
import { journalPool, journalResponse } from "@/journal/server/runtime";
import { journalMapServices, syntheticJournalSource } from "@/journal/integrations";
import { geminiConfig } from "@/report/server/config";

export const runtime = "nodejs";

export async function GET() {
  let postgresql = "Not configured";
  if (process.env.DATABASE_URL) {
    try {
      const { rows } = await journalPool().query("SELECT to_regclass('daily_entries') IS NOT NULL AND to_regclass('regional_observations') IS NOT NULL AND to_regclass('journal_profiles') IS NOT NULL AS ready");
      postgresql = rows[0]?.ready ? "Ready" : "Migration required";
    } catch { postgresql = "Unavailable"; }
  }
  return journalResponse({ application: "feel", milestone: "foundation", schemaVersion: SCHEMA_VERSION, bodyMapVersion: BODY_MAP_VERSION,
    services: { postgresql, gemini: geminiConfig() ? "Configured; not verified" : "Not configured",
      bodyMaps: journalMapServices ? "Connected" : "Pending integration", maya: syntheticJournalSource ? "Connected; synthetic/read-only" : "Pending integration" } });
}
