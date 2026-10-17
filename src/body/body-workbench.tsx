"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Rotate3D, Paintbrush, X } from "lucide-react";
import type { CameraView, InteractionMode, RegionalObservation } from "@/domain/contracts";
import { DeferredBodyHandle, type BodyChange, type BodyHandle } from "./body-handle";
import { DEFAULT_BRUSH, type BrushSettings } from "./brush";
import { BrushToolbar } from "./brush-toolbar";
import type { PaintLayers } from "./layers";
import type { SceneStatus } from "./body-scene";
import { viewLabel } from "./region-labels";
import styles from "./body.module.css";

const BodyScene = dynamic(() => import("./body-scene"), {
  ssr: false,
  loading: () => <div className="scene-message" role="status">Preparing your body map…</div>,
});

export interface BodyEditorProps {
  /** Starting draft; copied, never mutated. Later changes go through `handleRef.current.load()`. */
  initialLayers?: PaintLayers | null;
  /** Receives the editor handle for snapshot/load/undo/capture. */
  handleRef?: RefObject<BodyHandle | null>;
  /** Called after every committed stroke, undo, or load. */
  onChange?: (change: BodyChange) => void;
}

const VIEWS = ["front", "back", "left", "right"] as const;

/** Editable body with brush controls. The check-in page (owner B) composes this with date, note, and save controls. */
export function BodyWorkbench({ initialLayers, handleRef, onChange }: BodyEditorProps) {
  const [handle] = useState(() => new DeferredBodyHandle(initialLayers));
  const [mode, setMode] = useState<InteractionMode>("rotate");
  const [view, setView] = useState<CameraView>("front");
  const [viewRequest, setViewRequest] = useState(0);
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH);
  const [status, setStatus] = useState<SceneStatus>("loading");
  const [canUndo, setCanUndo] = useState(false);
  const [observations, setObservations] = useState<RegionalObservation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Held in a ref so an inline callback does not resubscribe (and replay the last change) on every render.
  const changeListener = useRef(onChange);
  useEffect(() => { changeListener.current = onChange; }, [onChange]);

  useEffect(() => {
    if (handleRef) handleRef.current = handle;
    return () => { if (handleRef?.current === handle) handleRef.current = null; };
  }, [handle, handleRef]);
  useEffect(() => handle.subscribe(change => {
    setCanUndo(change.canUndo);
    setObservations(change.observations);
    changeListener.current?.(change);
  }), [handle]);
  useEffect(() => handle.subscribeErrors(setLoadError), [handle]);

  function changeView(next: CameraView) { setView(next); setViewRequest(value => value + 1); }
  function updateBrush(next: Partial<BrushSettings>) {
    setBrush(current => ({ ...current, ...next }));
    // Picking a sensation or tool means the person wants to mark the body.
    if (next.painType || next.tool) setMode("paint");
  }
  function onKeyDown(event: React.KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
      if (handle.undo()) event.preventDefault();
    }
  }
  const unavailable = status !== "ready";
  const help = status === "error" ? "Painting is unavailable because the body map couldn’t load."
    : mode === "rotate" ? "Drag to turn · Scroll to zoom"
    : brush.tool === "eraser" ? "Drag over a mark to erase it. Switch to Rotate to turn the body." : "Drag on the body to paint. Switch to Rotate to turn the body.";

  return <section className={`body-workbench ${styles.workbench}`} aria-label="Body map" onKeyDown={onKeyDown}>
    <div className="stage-topbar"><span>Mark where you feel it</span><div className="mode-switch" role="group" aria-label="Interaction mode">
      <button type="button" aria-pressed={mode === "rotate"} onClick={() => setMode("rotate")}><Rotate3D size={18} aria-hidden="true" />Rotate</button>
      <button type="button" aria-pressed={mode === "paint"} disabled={status === "error"} onClick={() => setMode("paint")}><Paintbrush size={18} aria-hidden="true" />Paint</button>
    </div></div>
    {loadError && <div className={styles.loadError} role="alert">
      <p><strong>This painting can’t be shown.</strong> {loadError} The saved entry has not been changed.</p>
      <button type="button" onClick={() => setLoadError(null)} aria-label="Dismiss message"><X size={18} aria-hidden="true" /></button>
    </div>}
    <div className={styles.stageRow}>
      <div className={styles.stageColumn}>
        <div className={`body-stage ${styles.stage}`} data-mode={mode}>
          <BodyScene handle={handle} editable mode={mode} view={view} viewRequest={viewRequest} brush={brush} onStatus={setStatus}
            label="Rotatable 3D body for painting pain, patient-left is positive X" describedBy="scene-help" />
        </div>
        <div className="stage-bottom"><div className="view-switch" role="group" aria-label="Camera views">{VIEWS.map(next =>
          <button type="button" key={next} onClick={() => changeView(next)}>{viewLabel(next)}</button>
        )}</div><p id="scene-help" aria-live="polite">{help}</p></div>
      </div>
      <BrushToolbar brush={brush} onBrush={updateBrush} canUndo={canUndo} onUndo={() => handle.undo()} observations={observations} disabled={unavailable} />
    </div>
    <p className="keyboard-help">Keyboard: focus the body, then use arrow keys to turn, + / − to zoom, or Home to reset. Ctrl or ⌘ + Z undoes a stroke.</p>
  </section>;
}

export { BodyWorkbench as BodyEditor };
