"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useMemo, useState, type RefObject } from "react";
import { PAIN_TYPES, type CameraView, type PainType } from "@/domain/contracts";
import { DeferredBodyHandle, type BodyHandle } from "./body-handle";
import { DEFAULT_BRUSH } from "./brush";
import { PRESENCE_THRESHOLD, type PaintLayers } from "./layers";
import { PainLegend } from "./pain-swatch";
import { viewLabel } from "./region-labels";
import styles from "./body.module.css";

const BodyScene = dynamic(() => import("./body-scene"), {
  ssr: false,
  loading: () => <div className="scene-message" role="status">Preparing your body map…</div>,
});

export interface BodyViewerProps {
  /** The map to show. Copied on load; the viewer never edits it. `null` shows a blank body. */
  layers: PaintLayers | null;
  /** Accessible name for the body, e.g. "Maya’s map for October 10". */
  label: string;
  handleRef?: RefObject<BodyHandle | null>;
  initialView?: CameraView;
  /** Hides the legend when the surrounding screen shows its own. */
  showLegend?: boolean;
}

/** Read-only body for history playback, comparison, and report capture. Rotation only; it has no draft of its own to alter. */
export function BodyViewer({ layers, label, handleRef, initialView = "front", showLegend = true }: BodyViewerProps) {
  const [handle] = useState(() => new DeferredBodyHandle(layers));
  const [view, setView] = useState<CameraView>(initialView);
  const [viewRequest, setViewRequest] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const helpId = useId();

  useEffect(() => { handle.load(layers); }, [handle, layers]);
  useEffect(() => {
    if (handleRef) handleRef.current = handle;
    return () => { if (handleRef?.current === handle) handleRef.current = null; };
  }, [handle, handleRef]);
  useEffect(() => handle.subscribeErrors(setLoadError), [handle]);

  const present = useMemo(() => new Set<PainType>(layers ? PAIN_TYPES.filter(type => layers[type].some(value => value >= PRESENCE_THRESHOLD)) : []), [layers]);
  return <section className={`body-workbench ${styles.viewer}`} aria-label={label}>
    {loadError && <div className={styles.loadError} role="alert"><p><strong>This painting can’t be shown.</strong> {loadError}</p></div>}
    <div className={`body-stage ${styles.viewerStage}`} data-mode="rotate">
      <BodyScene handle={handle} editable={false} mode="rotate" view={view} viewRequest={viewRequest} brush={DEFAULT_BRUSH} label={label} describedBy={helpId} />
    </div>
    <div className="stage-bottom">
      <div className="view-switch" role="group" aria-label="Camera views">{(["front", "back", "left", "right"] as const).map(next =>
        <button type="button" key={next} onClick={() => { setView(next); setViewRequest(value => value + 1); }}>{viewLabel(next)}</button>
      )}</div>
      <p id={helpId}>Read-only map. Drag to turn · Scroll to zoom</p>
      {showLegend && <PainLegend present={present} />}
    </div>
  </section>;
}
