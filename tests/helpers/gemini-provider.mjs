// Loopback-only acceptance provider. This file never calls Google or uses a real key.
import { createServer } from "node:http";
let mode = "valid";
let count = 0;
const server = createServer(async (request, response) => {
  const reply = (status, body) => { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(body)); };
  if (request.url.startsWith("/mode/")) { mode = request.url.split("/").at(-1); return reply(200, { mode }); }
  if (request.url === "/status") return reply(200, { count });
  count++;
  let raw = "";
  for await (const part of request) raw += part;
  const body = JSON.parse(raw);
  if (!request.headers["x-goog-api-key"]) return reply(401, {});
  const { evidence } = JSON.parse(body.contents[0].parts[0].text);
  if (mode === "timeout") return; // The app must abort the request and render its factual fallback.
  if (mode === "error") return reply(503, { error: "fake provider unavailable" });
  const statement = { kind: "recorded-days", evidenceIds: ["range"], count: evidence.range.recordedDays, total: evidence.range.calendarDays };
  if (mode === "invalid") statement.count--;
  if (mode === "diagnosis") statement.text = "Invented diagnostic prose";
  reply(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ statements: [statement] }) }] }, finishReason: "STOP" }] });
});
server.listen(3199, "127.0.0.1", () => console.log("Acceptance Gemini provider listening on loopback port 3199"));
