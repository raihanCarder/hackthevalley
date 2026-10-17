import { PAIN_LABELS, PAIN_TYPES } from "@/domain/contracts";
import { PAIN_COLORS } from "@/body/pain-swatch";
import type { DayCell } from "./facts";
import { formatDate } from "./plan";
import styles from "./report.module.css";

const CELL = 14, ROW = 13, TOP = 16, LEFT = 4;

/** One column per calendar day, one row per sensation. Hatched columns have no check-in; they are not pain-free days. */
export function DayStrip({ days }: { days: DayCell[] }) {
  const width = LEFT + days.length * CELL + 2;
  const height = TOP + PAIN_TYPES.length * ROW + 4;
  const missing = days.filter(day => !day.recorded).length;
  const label = `Day-by-day record from ${formatDate(days[0].date)} to ${formatDate(days[days.length - 1].date)}: ${days.length - missing} days with a check-in, ${missing} without.`;
  return <figure className={styles.strip}>
    <div className={styles.stripScroll}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} preserveAspectRatio="xMinYMin meet">
        <defs>
          <pattern id="report-missing" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="#9aab9f" strokeWidth="1.2" />
          </pattern>
        </defs>
        {days.map((day, index) => {
          const x = LEFT + index * CELL;
          // Weekly ticks from the range start; the month name appears on the first tick and whenever the month changes.
          const tick = index % 7 === 0;
          const monthChanged = index === 0 || day.date.slice(5, 7) !== days[Math.max(0, index - 7)].date.slice(5, 7);
          const label = !tick ? "" : monthChanged ? formatDate(day.date).split(",")[0] : String(Number(day.date.slice(8)));
          return <g key={day.date}>
            {label && <text x={x + 1} y={10} className={styles.stripLabel}>{label}</text>}
            {day.recorded
              ? <rect x={x + 1} y={TOP - 2} width={CELL - 2} height={PAIN_TYPES.length * ROW + 2} rx={2} fill="#f2f5f2" />
              : <rect x={x + 1} y={TOP - 2} width={CELL - 2} height={PAIN_TYPES.length * ROW + 2} rx={2} fill="url(#report-missing)" stroke="#c7d4c9" strokeWidth=".6" />}
            {PAIN_TYPES.map((type, row) => {
              const peak = day.peaks[type];
              if (!peak) return null;
              return <circle key={type} cx={x + CELL / 2} cy={TOP + row * ROW + ROW / 2 - 1} r={1.8 + 3.2 * Math.min(10, peak) / 10} fill={PAIN_COLORS[type]}>
                <title>{`${formatDate(day.date)}: ${PAIN_LABELS[type]}, peak ${peak} of 10`}</title>
              </circle>;
            })}
          </g>;
        })}
      </svg>
    </div>
    <figcaption>
      <span className={styles.stripKey}><svg width="12" height="12" aria-hidden="true"><rect width="12" height="12" rx="2" fill="url(#report-missing)" stroke="#c7d4c9" /></svg>No check-in</span>
      <span className={styles.stripKey}><svg width="12" height="12" aria-hidden="true"><rect width="12" height="12" rx="2" fill="#f2f5f2" stroke="#c7d4c9" /></svg>Check-in saved</span>
      <span>Rows, top to bottom: {PAIN_TYPES.map(type => PAIN_LABELS[type].toLowerCase()).join(", ")}. Larger dots mean a higher peak intensity that day.</span>
    </figcaption>
  </figure>;
}
