"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Rotate3D, Paintbrush, UserRound, NotebookPen, X } from "lucide-react";
import type { CameraView, InteractionMode, RegionalObservation } from "@/domain/contracts";
import { DeferredBodyHandle, type BodyChange, type BodyHandle } from "./body-handle";
import { DEFAULT_BRUSH, type BrushSettings } from "./brush";
import { BrushToolbar } from "./brush-toolbar";
import type { PaintLayers } from "./layers";
import type { SceneStatus } from "./body-scene";
import { viewLabel } from "./region-labels";
import { FocusButtons } from "./focus-buttons";
import { BodyShapePanel } from "./body-shape-panel";
import { FEMALE_BODY_SHAPE } from "./body-shape";
import { useBodyShapePreference } from "./body-shape-preference";
import styles from "./body.module.css";

const BodyScene = dynamic(() => import("./body-scene"), {
  ssr: false,
  loading: () => <div className="scene-message" role="status">Preparing your body map…</div>,
});

export interface BodyEditorProps {
  /** Allows the shared workbench to display synthetic records without enabling edits. */
  readOnly?: boolean;
  /** Starting draft; copied, never mutated. Later changes go through `handleRef.current.load()`. */
  initialLayers?: PaintLayers | null;
  /** Receives the editor handle for snapshot/load/undo/capture. */
  handleRef?: RefObject<BodyHandle | null>;
  /** Called after every committed stroke, undo, or load. */
  onChange?: (change: BodyChange) => void;
  panel: "tools" | "body" | "details";
  onPanelChange: (panel: "tools" | "body" | "details") => void;
  checkInDetails: ReactNode;
}

const VIEWS = ["front", "back", "left", "right"] as const;

/** Shared body workspace for editable personal check-ins and read-only synthetic records. */
export function BodyWorkbench({ initialLayers, handleRef, onChange, panel, onPanelChange, checkInDetails, readOnly = false }: BodyEditorProps) {
  const id = useId();
  const [handle] = useState(() => new DeferredBodyHandle(initialLayers));
  const [mode, setMode] = useState<InteractionMode>("rotate");
  const [view, setView] = useState<CameraView>("front");
  const [viewRequest, setViewRequest] = useState(0);
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH);
  const [status, setStatus] = useState<SceneStatus>("loading");
  const [canUndo, setCanUndo] = useState(false);
  const [observations, setObservations] = useState<RegionalObservation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preferredShape, setBodyShape] = useBodyShapePreference();
  // Read-only is Maya's synthetic record, always shown female.
  const bodyShape = readOnly ? FEMALE_BODY_SHAPE : preferredShape;
  const helpId = `${id}-scene-help`;
  const keyboardHelpId = `${id}-scene-keyboard-help`;
  const shapePanelId = `${id}-body-shape-panel`;
  const detailsPanelId = `${id}-check-in-details-panel`;
  const viewpointsId = `${id}-viewpoints-heading`;
  const shapeHeadingId = `${id}-body-shape-heading`;
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
    if (readOnly) return;
    setBrush(current => ({ ...current, ...next }));
    // Picking a sensation or tool means the person wants to mark the body.
    if (next.painType || next.tool) setMode("paint");
  }
  function onKeyDown(event: React.KeyboardEvent) {
    if (readOnly) return;
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
      if (handle.undo()) event.preventDefault();
    }
  }
  const unavailable = status !== "ready";
  const selectedControl = panel === "tools" ? mode : panel;
  const help = status === "error" ? "The body map couldn’t load."
    : readOnly ? "Maya’s sample map. Drag to turn and scroll to zoom."
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
          <BodyScene handle={handle} editable={!readOnly} mode={mode} view={view} viewRequest={viewRequest} brush={brush} onStatus={setStatus} shape={bodyShape}
            label={readOnly ? "Rotatable 3D body showing Maya’s synthetic pain record" : "Rotatable 3D body for painting pain, patient-left is positive X"} describedBy={`${helpId} ${keyboardHelpId}`} />
        </div>
      </div>
      <aside className={styles.controlRail} aria-label="Body map controls">
        <div className={styles.editorHeader}>
          <div className={`mode-switch ${styles.controlSwitch}`} role="group" aria-label="Body map tools">
            <Button variant="ghost" type="button" aria-pressed={selectedControl === "rotate"} onClick={() => { setMode("rotate"); onPanelChange("tools"); }}><Rotate3D size={16} aria-hidden="true" />Rotate</Button>
            <Button variant="ghost" type="button" aria-pressed={selectedControl === "paint"} disabled={readOnly || status === "error"} onClick={() => { setMode("paint"); onPanelChange("tools"); }}><Paintbrush size={16} aria-hidden="true" />Paint</Button>
            <Button variant="ghost" type="button" aria-pressed={selectedControl === "body"} aria-controls={shapePanelId} onClick={() => onPanelChange("body")}><UserRound size={16} aria-hidden="true" />Body</Button>
            <Button variant="ghost" type="button" aria-pressed={selectedControl === "details"} aria-controls={detailsPanelId} onClick={() => onPanelChange("details")}><NotebookPen size={16} aria-hidden="true" />Check-in details</Button>
          </div>
          <p id={helpId} className={styles.visuallyHidden} aria-live="polite">{help}</p>
          <p id={keyboardHelpId} className={styles.visuallyHidden}>Keyboard: use arrow keys to turn, + / − to zoom, or Home to reset.{readOnly ? " Painting and undo are disabled for this synthetic sample." : " Ctrl or ⌘ + Z undoes a stroke."}</p>
        </div>
        <div className={styles.controlPanel} hidden={panel !== "tools"}>
          <section className={styles.viewControls} aria-labelledby={viewpointsId} hidden={mode !== "rotate"}>
            <h3 id={viewpointsId}>Viewpoints</h3>
            <div className="view-switch" role="group" aria-label="Camera views">{VIEWS.map(next =>
              <Button variant="ghost" type="button" key={next} aria-pressed={view === next} onClick={() => changeView(next)}>{viewLabel(next)}</Button>
            )}</div>
            <FocusButtons onFocus={target => handle.focus(target)} />
          </section>
          <div className={styles.controlPanel} hidden={mode !== "paint"}>
            <BrushToolbar brush={brush} onBrush={updateBrush} canUndo={canUndo} onUndo={() => { if (!readOnly) handle.undo(); }} observations={observations} disabled={readOnly || unavailable} />
          </div>
        </div>
        <div id={shapePanelId} className={`${styles.controlPanel} ${styles.shapeControls}`} hidden={panel !== "body"}>
          <h2 id={shapeHeadingId}>Adjust body shape</h2>
          <BodyShapePanel shape={bodyShape} onChange={setBodyShape} disabled={readOnly} />
        </div>
        <div id={detailsPanelId} className={styles.controlPanel} hidden={panel !== "details"}>{checkInDetails}</div>
      </aside>
    </div>
  </section>;
}

export { BodyWorkbench as BodyEditor };
