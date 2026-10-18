"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Rotate3D, Paintbrush, X } from "lucide-react";
import type { CameraView, InteractionMode, RegionalObservation } from "@/domain/contracts";
import { DeferredBodyHandle, type BodyChange, type BodyHandle } from "./body-handle";
import { DEFAULT_BRUSH, type BrushSettings } from "./brush";
import { BrushToolbar } from "./brush-toolbar";
import type { PaintLayers } from "./layers";
import type { SceneStatus } from "./body-scene";
import { viewLabel } from "./region-labels";
import { FocusButtons } from "./focus-buttons";
import { BodyShapePanel } from "./body-shape-panel";
import { useBodyShapePreference } from "./body-shape-preference";
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
  const [bodyShape, setBodyShape] = useBodyShapePreference();
  const [shapeOpen, setShapeOpen] = useState(false);
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
    {loadError && <div className={styles.loadError} role="alert">
      <p><strong>This painting can’t be shown.</strong> {loadError} The saved entry has not been changed.</p>
      <button type="button" onClick={() => setLoadError(null)} aria-label="Dismiss message"><X size={18} aria-hidden="true" /></button>
    </div>}
    <div className={styles.stageRow}>
      <div className={styles.stageColumn}>
        <div className={`body-stage ${styles.stage}`} data-mode={mode}>
          <BodyScene handle={handle} editable mode={mode} view={view} viewRequest={viewRequest} brush={brush} onStatus={setStatus} shape={bodyShape}
            label="Rotatable 3D body for painting pain, patient-left is positive X" describedBy="scene-help scene-keyboard-help" />
        </div>
      </div>
      <aside className={styles.controlRail} aria-label="Body map controls">
        <div className={styles.editorHeader}>
          <div className="mode-switch" role="group" aria-label="Interaction mode">
            <Button variant="ghost" type="button" aria-pressed={mode === "rotate"} onClick={() => setMode("rotate")}><Rotate3D size={16} aria-hidden="true" />Rotate</Button>
            <Button variant="ghost" type="button" aria-pressed={mode === "paint"} disabled={status === "error"} onClick={() => setMode("paint")}><Paintbrush size={16} aria-hidden="true" />Paint</Button>
          </div>
          <p id="scene-help" className={styles.sceneHelp} aria-live="polite">{help}</p>
          <p id="scene-keyboard-help" className={styles.visuallyHidden}>Keyboard: use arrow keys to turn, + / − to zoom, or Home to reset. Ctrl or ⌘ + Z undoes a stroke.</p>
        </div>
        <section className={styles.viewControls} aria-labelledby="viewpoints-heading">
          <h3 id="viewpoints-heading">Viewpoints</h3>
          <div className="view-switch" role="group" aria-label="Camera views">{VIEWS.map(next =>
            <Button variant="ghost" type="button" key={next} aria-pressed={view === next} onClick={() => changeView(next)}>{viewLabel(next)}</Button>
          )}</div>
          <FocusButtons onFocus={target => handle.focus(target)} />
        </section>
        <BrushToolbar brush={brush} onBrush={updateBrush} canUndo={canUndo} onUndo={() => handle.undo()} observations={observations} disabled={unavailable} />
        <div className={styles.shapeControls}>
          <Button variant="outline" type="button" className={styles.shapeToggle} aria-expanded={shapeOpen} aria-controls="body-shape-panel" onClick={() => setShapeOpen(open => !open)}>
            {shapeOpen ? "Hide body shape" : "Adjust body shape"}
          </Button>
          <div id="body-shape-panel" hidden={!shapeOpen}><BodyShapePanel shape={bodyShape} onChange={setBodyShape} /></div>
        </div>
      </aside>
    </div>
  </section>;
}

export { BodyWorkbench as BodyEditor };
