import { createHash, randomBytes, randomUUID } from "node:crypto";
import { JournalError, MAX_CHECK_IN_BYTES, type JournalProfile } from "../repository";

export const SESSION_COOKIE = "pain-journal-visitor";
export function newSession() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token), profileId: `visitor-${randomUUID()}` };
}
export function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}
export function validToken(token: string | undefined): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
}
/**
 * APP_ORIGIN when set; otherwise the origin the browser addressed (Host header). The request URL alone is not enough:
 * `next dev` normalizes it to localhost even when the page was served from 127.0.0.1.
 */
export function expectedOrigin(request: Request): string {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN;
  const url = new URL(request.url);
  const host = request.headers.get("host");
  return host ? `${url.protocol}//${host}` : url.origin;
}
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const expected = expectedOrigin(request);
  if (origin !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new JournalError("forbidden", "This change must come from the feel app.");
  }
}
export function requestedProfile(url: URL): JournalProfile {
  const profile = url.searchParams.get("profile") ?? "visitor";
  if (profile !== "visitor" && profile !== "maya") throw new JournalError("forbidden", "Unknown journal profile.");
  return profile;
}
export function assertVisitorMutation(request: Request): void {
  assertSameOrigin(request);
  if (requestedProfile(new URL(request.url)) !== "visitor") throw new JournalError("forbidden", "Maya is synthetic and read-only.");
}

/** Enforce the wire limit even for chunked requests without Content-Length. */
export async function readCheckInBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new JournalError("invalid", "Send check-ins as JSON.");
  }
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_CHECK_IN_BYTES) throw new JournalError("invalid", "The complete check-in must be no larger than 6 MiB.");
  const reader = request.body?.getReader();
  if (!reader) throw new JournalError("invalid", "Expected a check-in body.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_CHECK_IN_BYTES) {
        await reader.cancel();
        throw new JournalError("invalid", "The complete check-in must be no larger than 6 MiB.");
      }
      chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)); }
    catch { throw new JournalError("invalid", "The check-in contains invalid JSON."); }
  } finally { reader.releaseLock(); }
}
