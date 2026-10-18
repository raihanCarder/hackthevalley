/**
 * Server-safe body-map utilities for journal (B), timeline (C), and report (D) code.
 * Runs in Node Route Handlers and the browser: no React, DOM, canvas, WebGL, or Three.js imports.
 */
export { buildBodyAtlas, regionIdRaster, surfaceHitNear, texelPosition, type BodyAtlas, type RegionRaster } from "./atlas";
export { getRegionRaster } from "./region-raster";
export {
  assertLayers, byteToIntensity, cloneLayers, createEmptyLayers, intensityToByte, layersAreEmpty, uvToTexel,
  MAX_UNDO_STROKES, PRESENCE_THRESHOLD, TEXEL_COUNT, type PaintLayers,
} from "./layers";
export { decodePaintSnapshot, encodePaintSnapshot, validateEntryPayload, MAX_ENTRY_PAYLOAD_BYTES, MAX_NOTE_CHARACTERS, type ValidatedEntry } from "./map-codec";
export { MapValidationError, type MapErrorCode } from "./png";
export { reduceRegions } from "./regions";
export { PaintEngine, type BrushTool, type StrokeOptions, type SurfaceHit } from "./paint-engine";
