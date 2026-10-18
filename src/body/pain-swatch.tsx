import { PAIN_LABELS, PAIN_TYPES, type PainType } from "@/domain/contracts";
import styles from "./body.module.css";

/** sRGB swatch colours that match the shader's rendered appearance. */
export const PAIN_COLORS: Record<PainType, string> = { burning: "#cf4a1f", sharp: "#24212d", aching: "#62368a", tingling: "#2a68ab" };

/** Each swatch carries its own pattern, so sensations are identifiable without colour alone. */
export function PainSwatch({ type, size = 22 }: { type: PainType; size?: number }) {
  return <svg className={styles.swatch} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="11" fill={PAIN_COLORS[type]} />
    {type === "burning" && <g fill="none" stroke="#ffc46b" strokeWidth="1.8" strokeLinecap="round">
      <path d="M6 15c1.5-2 3-2 4.5 0s3 2 4.5 0 2.5-2 3 0" /><path d="M6 10c1.5-2 3-2 4.5 0s3 2 4.5 0 2.5-2 3 0" />
    </g>}
    {type === "sharp" && <path d="M12 3.5l1.3 7.2 7.2 1.3-7.2 1.3-1.3 7.2-1.3-7.2-7.2-1.3 7.2-1.3z" fill="#fffaf0" />}
    {type === "aching" && <g fill="none" stroke="#d8b9f2"><circle cx="12" cy="12" r="6.5" strokeWidth="1.6" /><circle cx="12" cy="12" r="2.6" strokeWidth="1.6" /></g>}
    {type === "tingling" && <g fill="#e0f0ff">
      <circle cx="7.5" cy="8" r="1.3" /><circle cx="14" cy="6.5" r="1.1" /><circle cx="17" cy="12" r="1.4" /><circle cx="10.5" cy="12.5" r="1.1" />
      <circle cx="7" cy="15.5" r="1.1" /><circle cx="13.5" cy="17" r="1.3" />
    </g>}
  </svg>;
}

/** Labelled legend for read-only views (history, reports). `present` marks the types that appear on the map. */
export function PainLegend({ present }: { present?: ReadonlySet<PainType> }) {
  return <ul className={styles.legend} aria-label="Sensation legend">
    {PAIN_TYPES.map(type => <li key={type} data-present={present ? present.has(type) : undefined}>
      <PainSwatch type={type} size={18} />{PAIN_LABELS[type]}{present && !present.has(type) && <span className={styles.visuallyHidden}> (not marked)</span>}
    </li>)}
  </ul>;
}
