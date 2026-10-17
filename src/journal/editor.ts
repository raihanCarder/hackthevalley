import type { PaintSnapshot } from "../domain/contracts";
import type { BodyHandle } from "../body/body-handle";
import { decodePaintSnapshot, encodePaintSnapshot } from "../body/map-utils";
import { checkRead, JournalError, type ReadOptions } from "./repository";

/** B's composition boundary; adapt A's actual controller here at integration. */
export interface JournalEditorBridge {
  snapshot(): Promise<PaintSnapshot>;
  /** Check cancellation before committing decoded buffers to the renderer. */
  load(maps: PaintSnapshot, options?: ReadOptions): Promise<void>;
  clear(options?: ReadOptions): Promise<void>;
  /** User edits only; programmatic load/clear must not emit a stroke event. */
  subscribe(onEdit: () => void): () => void;
}

/** Adapts the body editor handle (owner A) to the journal bridge. `current` returns the mounted editor's handle. */
export function createEditorBridge(current: () => BodyHandle | null): JournalEditorBridge {
  const handle = () => {
    const value = current();
    if (!value) throw new JournalError("unavailable", "The body map is not ready yet. Your draft has not changed.");
    return value;
  };
  return {
    // The buffers are copied synchronously before encoding, so later strokes cannot leak into this save.
    snapshot: async () => encodePaintSnapshot(handle().snapshot()),
    async load(maps, options) {
      const layers = await decodePaintSnapshot(maps);
      checkRead(options);
      handle().load(layers);
    },
    async clear(options) {
      checkRead(options);
      handle().load(null);
    },
    subscribe(onEdit) {
      const target = current();
      if (!target) return () => {};
      // The handle replays its latest change to new subscribers; only later strokes and undos are user edits.
      let live = false;
      const unsubscribe = target.subscribe(change => { if (live && change.reason !== "load") onEdit(); });
      live = true;
      return unsubscribe;
    },
  };
}
