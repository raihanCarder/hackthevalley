"use client";

import { useId } from "react";
import { RotateCcw } from "lucide-react";
import { DEFAULT_BODY_SHAPE, isDefaultShape, type BodyShape, type BodyShapeSlider } from "./body-shape";
import styles from "./body.module.css";

interface SliderSpec { id: BodyShapeSlider; label: string; low: string; high: string }
const MAIN: SliderSpec[] = [
  { id: "sex", label: "Sex", low: "Female", high: "Male" },
  { id: "height", label: "Height", low: "Shorter", high: "Taller" },
  { id: "weight", label: "Weight", low: "Lighter", high: "Heavier" },
  { id: "muscle", label: "Muscle", low: "Less", high: "More" },
  { id: "waist", label: "Waist and belly", low: "Narrower", high: "Wider" },
];
const PROPORTIONS: SliderSpec[] = [
  { id: "shoulders", label: "Shoulders", low: "Narrower", high: "Broader" },
  { id: "hips", label: "Hips", low: "Narrower", high: "Wider" },
  { id: "legs", label: "Leg length", low: "Shorter", high: "Longer" },
];
const AGE: SliderSpec = { id: "age", label: "Age", low: "25", high: "70" };

/** Optional body-shape sliders. The shape only changes how the body looks; marks and measurements stay the same. */
export function BodyShapePanel({ shape, onChange }: { shape: BodyShape; onChange(next: BodyShape): void }) {
  const id = useId();
  const slider = (spec: SliderSpec) => {
    const value = shape[spec.id];
    const describe = (n: number) => spec.id === "age" ? `about ${Math.round(25 + n * 45)} years` : n < .45 ? spec.low.toLowerCase() : n > .55 ? spec.high.toLowerCase() : "average";
    return <div key={spec.id} className={styles.shapeSlider}>
      <label htmlFor={`${id}-${spec.id}`}>{spec.label}</label>
      <input id={`${id}-${spec.id}`} type="range" min={0} max={1} step={.01} value={value} aria-valuetext={describe(value)}
        onChange={event => onChange({ ...shape, [spec.id]: Number(event.target.value) })} />
      <div className={styles.scale} aria-hidden="true"><span>{spec.low}</span><span>{spec.high}</span></div>
    </div>;
  };
  return <section className={styles.shapePanel} aria-label="Body shape">
    <p className={styles.shapeNote}>Shape the figure to look more like you. This only changes how the body looks: your marks and measurements stay the same, and the shape is saved in this browser only.</p>
    <div className={styles.shapeGrid}>{MAIN.map(slider)}</div>
    <fieldset className={styles.shapeGroup}>
      <legend>Proportions</legend>
      <div className={styles.shapeGrid}>{PROPORTIONS.map(slider)}</div>
    </fieldset>
    <details className={styles.shapeMore}>
      <summary>More options</summary>
      <div className={styles.shapeGrid}>{slider(AGE)}</div>
    </details>
    <button type="button" className={styles.shapeReset} disabled={isDefaultShape(shape)} onClick={() => onChange(DEFAULT_BODY_SHAPE)}>
      <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />Reset body shape
    </button>
  </section>;
}
