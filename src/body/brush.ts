import type { PainType } from "../domain/contracts";
import type { BrushTool } from "./paint-engine";

export type BrushSize = "small" | "medium" | "large" | "extra-large";
/** World-space brush radius in metres. A 512px atlas tile spans roughly 5–10 mm per texel on this mannequin. */
export const BRUSH_RADII: Record<BrushSize, number> = { small: .02, medium: .035, large: .055, "extra-large": .08 };
export const BRUSH_SIZES = Object.keys(BRUSH_RADII) as BrushSize[];
export const BRUSH_SIZE_LABELS: Record<BrushSize, string> = { small: "Small", medium: "Medium", large: "Large", "extra-large": "Extra large" };

export interface BrushSettings {
  tool: BrushTool;
  painType: PainType;
  /** 1–10. Pen pressure scales it when available. */
  intensity: number;
  size: BrushSize;
}
export const DEFAULT_BRUSH: BrushSettings = { tool: "brush", painType: "aching", intensity: 5, size: "medium" };
