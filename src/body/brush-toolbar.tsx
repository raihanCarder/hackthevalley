"use client";

import { useId } from "react";
import { Eraser, Paintbrush, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAIN_LABELS, PAIN_TYPES, REGION_IDS, type PainType, type RegionalObservation } from "@/domain/contracts";
import { BRUSH_RADII, BRUSH_SIZE_LABELS, BRUSH_SIZES, type BrushSettings } from "./brush";
import { PAIN_COLORS, PainSwatch } from "./pain-swatch";
import { REGION_LABELS } from "./region-labels";
import styles from "./body.module.css";

interface Props {
  brush: BrushSettings;
  onBrush(next: Partial<BrushSettings>): void;
  canUndo: boolean;
  onUndo(): void;
  observations: RegionalObservation[];
  disabled: boolean;
}

export function BrushToolbar({ brush, onBrush, canUndo, onUndo, observations, disabled }: Props) {
  const id = useId();
  const painted = new Set(observations.map(o => o.painType));
  const byRegion = REGION_IDS.map(region => ({ region, rows: observations.filter(o => o.regionId === region) })).filter(group => group.rows.length);
  const largest = BRUSH_RADII["extra-large"];
  return <div className={styles.toolbar} style={{ "--pain-color": PAIN_COLORS[brush.painType] } as React.CSSProperties} aria-label="Brush controls" role="group">
    <fieldset className={styles.sensations} disabled={disabled}>
      <legend>Sensation</legend>
      {PAIN_TYPES.map(type => <label key={type} className={styles.sensation}>
        <input type="radio" name={`${id}-pain-type`} value={type} checked={brush.painType === type} onChange={() => onBrush({ painType: type })} onClick={() => onBrush({ painType: type })} />
        <PainSwatch type={type} />
        <span>{PAIN_LABELS[type]}</span>
        {painted.has(type) && <span className={styles.onMap}>on map</span>}
      </label>)}
    </fieldset>

    <div className={styles.control}>
      <label htmlFor={`${id}-brush-intensity`} className={styles.controlLabel}>Intensity <output htmlFor={`${id}-brush-intensity`}>{brush.intensity}<span> of 10</span></output></label>
      <input id={`${id}-brush-intensity`} type="range" min={1} max={10} step={1} value={brush.intensity} disabled={disabled}
        onChange={event => onBrush({ intensity: Number(event.target.value) })} aria-valuetext={`${brush.intensity} of 10`} />
      <div className={styles.scale} aria-hidden="true"><span>Mild</span><span>Strongest</span></div>
    </div>

    <fieldset className={styles.sizes} disabled={disabled}>
      <legend>Brush size</legend>
      <div>{BRUSH_SIZES.map(size => <label key={size} title={BRUSH_SIZE_LABELS[size]}>
        <input type="radio" name={`${id}-brush-size`} value={size} checked={brush.size === size} onChange={() => onBrush({ size })} />
        <span className={styles.sizeDot} style={{ width: `${8 + 22 * BRUSH_RADII[size] / largest}px` }} aria-hidden="true" />
        <span className={styles.visuallyHidden}>{BRUSH_SIZE_LABELS[size]}</span>
      </label>)}</div>
    </fieldset>

    <div className={styles.tools} role="group" aria-label="Tool">
      <Button variant="outline" type="button" aria-pressed={brush.tool === "brush"} disabled={disabled} onClick={() => onBrush({ tool: "brush" })}><Paintbrush size={16} strokeWidth={1.8} aria-hidden="true" />Brush</Button>
      <Button variant="outline" type="button" aria-pressed={brush.tool === "eraser"} disabled={disabled} onClick={() => onBrush({ tool: "eraser" })}><Eraser size={16} strokeWidth={1.8} aria-hidden="true" />Eraser</Button>
      <Button variant="ghost" type="button" className={styles.undo} disabled={disabled || !canUndo} onClick={onUndo} aria-keyshortcuts="Control+Z Meta+Z"><Undo2 size={16} strokeWidth={1.8} aria-hidden="true" />Undo</Button>
    </div>
    {brush.tool === "eraser" && <p className={styles.toolNote}>Erasing removes {PAIN_LABELS[brush.painType].toLowerCase()} only. Other sensations stay.</p>}

    <section className={styles.marked} aria-labelledby={`${id}-marked-areas-heading`} aria-live="polite">
      <h3 id={`${id}-marked-areas-heading`}>Marked areas</h3>
      {byRegion.length ? <ul>{byRegion.map(({ region, rows }) => <li key={region}>
        <span>{REGION_LABELS[region]}</span>
        <span className={styles.markedTypes}>{rows.map(row => <span key={row.painType} title={`${PAIN_LABELS[row.painType]}, up to ${formatIntensity(row.peakIntensity)} of 10`}>
          <PainSwatch type={row.painType as PainType} size={14} /><span className={styles.visuallyHidden}>{PAIN_LABELS[row.painType]}, up to {formatIntensity(row.peakIntensity)} of 10</span>
        </span>)}</span>
      </li>)}</ul> : <p>Nothing marked yet. Choose a sensation, then drag across the body.</p>}
    </section>
  </div>;
}

const formatIntensity = (value: number) => (Math.round(value * 10) / 10).toString();
