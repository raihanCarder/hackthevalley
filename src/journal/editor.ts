import type { PaintSnapshot } from "../domain/contracts";
import type { ReadOptions } from "./repository";

/** B's composition boundary; adapt A's actual controller here at integration. */
export interface JournalEditorBridge {
  snapshot(): Promise<PaintSnapshot>;
  /** Check cancellation before committing decoded buffers to the renderer. */
  load(maps: PaintSnapshot, options?: ReadOptions): Promise<void>;
  clear(options?: ReadOptions): Promise<void>;
  /** User edits only; programmatic load/clear must not emit a stroke event. */
  subscribe(onEdit: () => void): () => void;
}
