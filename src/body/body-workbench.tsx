"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Rotate3D, Paintbrush } from "lucide-react";
import type { CameraView, InteractionMode } from "@/domain/contracts";

const BodyScene = dynamic(() => import("./body-scene"), {
  ssr: false,
  loading: () => <div className="scene-message" role="status">Preparing your body map…</div>,
});

export function BodyWorkbench() {
  const [mode, setMode] = useState<InteractionMode>("rotate");
  const [view, setView] = useState<CameraView>("front");
  const [viewRequest, setViewRequest] = useState(0);
  function changeView(next: CameraView) { setView(next); setViewRequest(value => value + 1); }
  return <section className="body-workbench" aria-label="Body map preview">
    <div className="stage-topbar"><span>Explore your body map</span><div className="mode-switch" role="group" aria-label="Interaction mode">
      <button type="button" aria-pressed={mode === "rotate"} onClick={() => setMode("rotate")}><Rotate3D size={18} aria-hidden="true" />Rotate</button>
      <button type="button" aria-pressed={mode === "paint"} onClick={() => setMode("paint")}><Paintbrush size={18} aria-hidden="true" />Paint</button>
    </div></div>
    <div className="body-stage" data-mode={mode}><BodyScene mode={mode} view={view} viewRequest={viewRequest} /></div>
    <div className="stage-bottom"><div className="view-switch" role="group" aria-label="Camera views">{(["front", "back", "left", "right"] as const).map(next =>
      <button type="button" key={next} onClick={() => changeView(next)}>{next === "left" || next === "right" ? `Your ${next}` : next[0].toUpperCase() + next.slice(1)}</button>
    )}</div><p id="scene-help" aria-live="polite">{mode === "rotate" ? "Drag to turn · Scroll to zoom" : "Camera locked · Painting arrives in milestone 2"}</p></div>
    <p className="keyboard-help">Keyboard: focus the body, then use arrow keys to turn, + / − to zoom, or Home to reset.</p>
  </section>;
}
