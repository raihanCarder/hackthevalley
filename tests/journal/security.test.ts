import test from "node:test";
import assert from "node:assert/strict";
import { assertSameOrigin, assertVisitorMutation, hashToken, newSession, readCheckInBody, requestedProfile, validToken } from "../../src/journal/server/security";
import { MAX_CHECK_IN_BYTES } from "../../src/journal/repository";

function request(origin?: string, url = "http://localhost:3000/api/entries/2026-10-17") {
  return new Request(url, { method: "PUT", headers: origin ? { Origin: origin } : {} });
}
test("visitor tokens are independent, high entropy, and hashed before database lookup", () => {
  const one = newSession(), two = newSession();
  assert.equal(validToken(one.token), true);
  assert.notEqual(one.token, two.token);
  assert.notEqual(one.profileId, two.profileId);
  assert.deepEqual(hashToken(one.token), one.tokenHash);
  assert.equal(one.tokenHash.byteLength, 32);
  for (const invalid of [undefined, "", "chosen-profile", "a".repeat(63)]) assert.equal(validToken(invalid), false);
});
test("mutations require the same origin and Maya can never be a mutation target", () => {
  assert.doesNotThrow(() => assertSameOrigin(request("http://localhost:3000")));
  assert.throws(() => assertSameOrigin(request()), { code: "forbidden" });
  assert.throws(() => assertSameOrigin(request("https://elsewhere.test")), { code: "forbidden" });
  assert.throws(() => assertVisitorMutation(request("http://localhost:3000", "http://localhost:3000/api/entries/2026-10-17?profile=maya")), { code: "forbidden" });
  assert.throws(() => requestedProfile(new URL("http://localhost/?profile=another-session")), { code: "forbidden" });
});
test("same-origin uses the host the browser addressed when the server normalizes its URL", () => {
  // next dev reports http://localhost:3000 even when the page was opened at http://127.0.0.1:3000.
  const at = (origin: string, host: string) => new Request("http://localhost:3000/api/session", { method: "POST", headers: { Origin: origin, Host: host } });
  assert.doesNotThrow(() => assertSameOrigin(at("http://127.0.0.1:3000", "127.0.0.1:3000")));
  assert.throws(() => assertSameOrigin(at("http://localhost:3000", "127.0.0.1:3000")), { code: "forbidden" });
  assert.throws(() => assertSameOrigin(at("https://elsewhere.test", "127.0.0.1:3000")), { code: "forbidden" });
  const crossSite = new Request("http://localhost:3000/api/session", { method: "POST", headers: { Origin: "http://localhost:3000", "Sec-Fetch-Site": "cross-site" } });
  assert.throws(() => assertSameOrigin(crossSite), { code: "forbidden" });
});
test("wire validation rejects malformed JSON, wrong content type, and oversized chunked bodies", async () => {
  await assert.rejects(readCheckInBody(new Request("http://localhost", { method: "PUT", body: "{}" })), { code: "invalid" });
  await assert.rejects(readCheckInBody(new Request("http://localhost", { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{" })), { code: "invalid" });
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(MAX_CHECK_IN_BYTES)); controller.enqueue(new Uint8Array(1)); controller.close();
  } });
  const init = { method: "PUT", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half" };
  await assert.rejects(readCheckInBody(new Request("http://localhost", init as RequestInit)), { code: "invalid" });
});
