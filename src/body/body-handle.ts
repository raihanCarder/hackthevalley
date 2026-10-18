import type { CameraView, RegionalObservation } from "../domain/contracts";
import { cloneLayers, createEmptyLayers, type PaintLayers } from "./layers";
import { decodePaintSnapshot } from "./map-codec";
import type { FocusTarget } from "./mannequin";

export type CaptureView = "front" | "back";
export interface CaptureOptions {
  /** Layers to render instead of the displayed map; the displayed map and draft are never modified. */
  layers?: PaintLayers | null;
  views?: CaptureView[];
  /** Output size in CSS pixels; the image is rendered at 2x and downsampled. Defaults to 360x600. */
  width?: number;
  height?: number;
}
export type BodyCaptures = Partial<Record<CaptureView, string>>;
export interface BodyChange {
  /** Increments on every committed stroke, undo, or load. */
  revision: number;
  isEmpty: boolean;
  canUndo: boolean;
  undoDepth: number;
  /** Present region/type observations from the shared reducer. */
  observations: RegionalObservation[];
  reason: "stroke" | "undo" | "load";
}

/**
 * Operations shared with check-in (B), history (C), and report (D) code. Every method is safe to call before the
 * renderer finishes loading: loads are queued and capture waits until the body is ready.
 */
export interface BodyHandle {
  isReady(): boolean;
  whenReady(): Promise<void>;
  /** A deep copy of the current four layers. Never aliases renderer buffers. */
  snapshot(): PaintLayers;
  /** Replaces the displayed map with a copy (null = blank) and clears undo history. */
  load(layers: PaintLayers | null): void;
  /** Decodes and validates a stored snapshot, then loads it. Rejects (and shows an error) for incompatible maps. */
  loadSnapshot(snapshot: unknown): Promise<void>;
  /** Reverts the most recent completed stroke; false when there is nothing to undo or the body is read-only. */
  undo(): boolean;
  setView(view: CameraView): void;
  /** Moves the camera close to a small part: the face, either hand, or either foot. */
  focus(target: FocusTarget): void;
  /** Renders fixed front/back PNG data URLs with static (reduced-motion) pain patterns. */
  capture(options?: CaptureOptions): Promise<BodyCaptures>;
  /** Subscribes to map changes; returns an unsubscribe function. */
  subscribe(listener: (change: BodyChange) => void): () => void;
}

/** Implemented by the browser-only scene. */
export interface SceneController {
  snapshot(): PaintLayers;
  load(layers: PaintLayers | null): void;
  undo(): boolean;
  setView(view: CameraView): void;
  focus(target: FocusTarget): void;
  capture(options: CaptureOptions): Promise<BodyCaptures>;
}

export class DeferredBodyHandle implements BodyHandle {
  private target: SceneController | null = null;
  private pending: PaintLayers | null | undefined;
  private ready!: Promise<void>;
  private resolveReady!: () => void;
  private listeners = new Set<(change: BodyChange) => void>();
  private errorListeners = new Set<(message: string | null) => void>();
  private lastChange: BodyChange | null = null;

  constructor(initial?: PaintLayers | null) {
    this.pending = initial ? cloneLayers(initial) : undefined;
    this.resetReady();
  }
  private resetReady() { this.ready = new Promise(resolve => { this.resolveReady = resolve; }); }

  /** Called by the scene once its asset and renderer are ready. Applies any queued load. */
  attach(target: SceneController) {
    this.target = target;
    if (this.pending !== undefined) { target.load(this.pending); this.pending = undefined; }
    this.resolveReady();
  }
  /** Called on unmount: keeps the current draft so a remount restores it. */
  detach(target: SceneController) {
    if (this.target !== target) return;
    this.pending = target.snapshot();
    this.target = null;
    this.resetReady();
  }

  isReady() { return this.target !== null; }
  whenReady() { return this.ready; }
  snapshot() {
    if (this.target) return this.target.snapshot();
    return this.pending ? cloneLayers(this.pending) : createEmptyLayers();
  }
  load(layers: PaintLayers | null) {
    this.reportError(null);
    if (this.target) this.target.load(layers);
    else this.pending = layers ? cloneLayers(layers) : null;
  }
  async loadSnapshot(snapshot: unknown) {
    try { this.load(await decodePaintSnapshot(snapshot)); }
    catch (error) { this.reportError((error as Error).message); throw error; }
  }
  undo() { return this.target?.undo() ?? false; }
  setView(view: CameraView) { this.target?.setView(view); }
  focus(target: FocusTarget) { this.target?.focus(target); }
  async capture(options: CaptureOptions = {}) {
    await this.ready;
    return this.target!.capture(options);
  }
  subscribe(listener: (change: BodyChange) => void) {
    this.listeners.add(listener);
    if (this.lastChange) listener(this.lastChange);
    return () => { this.listeners.delete(listener); };
  }
  /** Body-feature internal: renderer/load error messages for the surrounding UI. */
  subscribeErrors(listener: (message: string | null) => void) {
    this.errorListeners.add(listener);
    return () => { this.errorListeners.delete(listener); };
  }
  emit(change: BodyChange) {
    this.lastChange = change;
    for (const listener of this.listeners) listener(change);
  }
  reportError(message: string | null) { for (const listener of this.errorListeners) listener(message); }
}
