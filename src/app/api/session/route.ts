import { cookies } from "next/headers";
import { journalFailure, journalPool, journalResponse } from "@/journal/server/runtime";
import { assertSameOrigin, hashToken, newSession, SESSION_COOKIE, validToken } from "@/journal/server/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    const pool = journalPool();
    if (validToken(token)) {
      const existing = await pool.query("SELECT profile_id FROM visitor_sessions WHERE token_hash = $1 AND expires_at > now()", [hashToken(token)]);
      if (existing.rowCount) return journalResponse({ profile: "visitor", storage: "postgresql" });
    }
    const session = newSession();
    await pool.query("INSERT INTO visitor_sessions (token_hash, profile_id, expires_at) VALUES ($1, $2, now() + interval '7 days')", [session.tokenHash, session.profileId]);
    jar.set(SESSION_COOKIE, session.token, { httpOnly: true, sameSite: "strict",
      secure: process.env.NODE_ENV === "production", path: "/" });
    return journalResponse({ profile: "visitor", storage: "postgresql" }, 201);
  } catch (error) { return journalFailure(error); }
}
