import { FOCUS_TARGETS, type FocusTarget } from "./mannequin";
import { FOCUS_LABELS } from "./region-labels";
import styles from "./body.module.css";

/** Close-up camera presets so small parts (eyes, ears, fingers, toes) are easy to see and paint. */
export function FocusButtons({ onFocus }: { onFocus(target: FocusTarget): void }) {
  return <div className={`view-switch ${styles.focus}`} role="group" aria-label="Zoom to a body part">
    <span className={styles.focusLabel} aria-hidden="true">Zoom to</span>
    {FOCUS_TARGETS.map(target => <button type="button" key={target} onClick={() => onFocus(target)}>{FOCUS_LABELS[target]}</button>)}
  </div>;
}
