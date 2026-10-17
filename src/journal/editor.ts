import type { PaintSnapshot } from "../domain/contracts";
import type { RefObject } from "react";
import type { BodyHandle, BodyChange } from "../body/body-handle";
import { decodePaintSnapshot, encodePaintSnapshot } from "../body/map-utils";
import { checkRead, JournalError, type ReadOptions } from "./repository";

/** The journal's boundary for saving, restoring, and observing body maps. */
export interface JournalEditorBridge {
  snapshot(): Promise<PaintSnapshot>;
  /** Check cancellation before committing decoded buffers to the renderer. */
  load(maps: PaintSnapshot, options?: ReadOptions): Promise<void>;
  clear(options?: ReadOptions): Promise<void>;
  /** User edits only; programmatic load/clear must not emit a stroke event. */
  subscribe(onEdit: () => void): () => void;
}

/** Subscribe before the workbench mounts; its onChange callback forwards later user edits. */
export function createEditorBridge(ref: RefObject<BodyHandle | null>): JournalEditorBridge & { notify(change: BodyChange): void } {
  const listeners = new Set<() => void>();
  const handle = () => {
    if (!ref.current) throw new JournalError("unavailable", "The body editor is still loading.");
    return ref.current;
  };
  return {
    async snapshot() { return encodePaintSnapshot(handle().snapshot()); },
    async load(maps, options) {
      checkRead(options);
      const layers = await decodePaintSnapshot(maps);
      checkRead(options);
      handle().load(layers);
    },
    async clear(options) { checkRead(options); handle().load(null); },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    notify(change) { if (change.reason !== "load") for (const listener of listeners) listener(); },
  };
}
