import { FOCUS_TARGETS, type FocusTarget } from "./mannequin";
import { FOCUS_LABELS } from "./region-labels";
import styles from "./body.module.css";
import { Button } from "@/components/ui/button";

/** Close-up camera presets so small parts (eyes, ears, fingers, toes) are easy to see and paint. */
export function FocusButtons({ onFocus }: { onFocus(target: FocusTarget): void }) {
  return <div className={styles.focus}>
    <span className={styles.focusLabel} aria-hidden="true">Zoom to</span>
    <div className={`view-switch ${styles.focusButtons}`} role="group" aria-label="Zoom to a body part">
      {FOCUS_TARGETS.map(target => <Button variant="ghost" type="button" key={target} onClick={() => onFocus(target)}>{FOCUS_LABELS[target]}</Button>)}
    </div>
  </div>;
}
