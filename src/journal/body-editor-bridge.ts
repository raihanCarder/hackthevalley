import type { RefObject } from "react";
import type { BodyHandle, BodyChange } from "../body/body-handle";
import { decodePaintSnapshot, encodePaintSnapshot } from "../body/map-utils";
import type { JournalEditorBridge } from "./editor";
import { checkRead, JournalError } from "./repository";

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
