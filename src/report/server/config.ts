import "server-only";
import type { GeminiConfig } from "../gemini";

/** Gemini is optional. Both a key and an explicit model are required; nothing is assumed about available models. */
export function geminiConfig(): GeminiConfig | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim();
  if (!apiKey || !model) return null;
  const timeout = Number(process.env.GEMINI_TIMEOUT_MS);
  return { apiKey, model, endpoint: process.env.GEMINI_API_BASE?.trim() || undefined, timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : undefined };
}

export type GeminiStatus = { state: "configured"; model: string } | { state: "not-configured"; missing: ("GEMINI_API_KEY" | "GEMINI_MODEL")[] };
export function geminiStatus(): GeminiStatus {
  const config = geminiConfig();
  if (config) return { state: "configured", model: config.model };
  const missing: ("GEMINI_API_KEY" | "GEMINI_MODEL")[] = [];
  if (!process.env.GEMINI_API_KEY?.trim()) missing.push("GEMINI_API_KEY");
  if (!process.env.GEMINI_MODEL?.trim()) missing.push("GEMINI_MODEL");
  return { state: "not-configured", missing };
}
