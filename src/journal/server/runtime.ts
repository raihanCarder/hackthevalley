import "server-only";
import { Pool } from "pg";
import { cookies } from "next/headers";
import { PostgresJournal } from "../postgres";
import { journalMapServices, syntheticJournalSource } from "../integrations";
import { JournalError, type JournalProfile } from "../repository";
import { hashToken, SESSION_COOKIE, validToken } from "./security";

const shared = globalThis as typeof globalThis & { journalPool?: Pool };
export function journalPool(): Pool {
  if (!process.env.DATABASE_URL) throw new JournalError("unavailable", "PostgreSQL is not configured. Your selected store has not changed.");
  if (!shared.journalPool) {
    shared.journalPool = new Pool({ connectionString: process.env.DATABASE_URL,
      max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 5000 });
    // An idle connection failure must not crash Next or log connection secrets.
    shared.journalPool.on("error", () => {});
  }
  return shared.journalPool;
}

export async function visitorProfile(): Promise<string> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!validToken(token)) throw new JournalError("forbidden", "Start a visitor session before opening the server journal.");
  const { rows } = await journalPool().query("SELECT profile_id FROM visitor_sessions WHERE token_hash = $1 AND expires_at > now()", [hashToken(token)]);
  if (!rows[0]) throw new JournalError("forbidden", "Your visitor session has expired. Start a new session to continue.");
  return rows[0].profile_id;
}

export async function serverRepository(profile: JournalProfile) {
  // Maya never requires a visitor cookie, database, or runtime synthetic copies.
  if (profile === "maya") {
    if (!syntheticJournalSource) throw new JournalError("unavailable", "Maya's synthetic history is not connected yet.");
    return syntheticJournalSource;
  }
  return serverVisitorRepository();
}

export async function serverVisitorRepository(): Promise<PostgresJournal> {
  return new PostgresJournal(journalPool(), await visitorProfile(), journalMapServices, syntheticJournalSource);
}

export function journalResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
export function journalFailure(error: unknown): Response {
  if (error instanceof JournalError) {
    return journalResponse({ error: { code: error.code, message: error.message } },
      error.code === "forbidden" ? 403 : error.code === "invalid" ? 400 : error.code === "cancelled" ? 408 : 503);
  }
  return journalResponse({ error: { code: "unavailable", message: "The journal service is unavailable. Your selected store has not changed." } }, 503);
}
