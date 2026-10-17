import { BODY_MAP_VERSION, SCHEMA_VERSION } from "@/domain/contracts";

export const runtime = "nodejs";

export function GET() {
  return Response.json({ application: "pain-journal", milestone: "foundation", schemaVersion: SCHEMA_VERSION, bodyMapVersion: BODY_MAP_VERSION });
}
