import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { PAIN_LABELS, type DailyEntry, type LocalDate } from "@/domain/contracts";
import { regionPhrase } from "./facts";
import { formatDate } from "./plan";
import styles from "./report.module.css";

export function CheckInLogs({ entries, synthetic, from, to }: {
  entries: readonly DailyEntry[];
  synthetic: boolean;
  from: LocalDate;
  to: LocalDate;
}) {
  const source = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ entries: readonly DailyEntry[] | null; height: number; pages: LogPart[][] }>({ entries: null, height: 0, pages: [] });

  useLayoutEffect(() => {
    const summary = document.querySelector<HTMLElement>("[data-report-summary]");
    const measureSheet = source.current?.closest<HTMLElement>("[data-log-measure]");
    if (!summary || !measureSheet || !source.current || !probe.current) return;
    let active = true;
    const paginate = () => {
      if (!active || window.matchMedia("print").matches) return;
      const bounds = summary.getBoundingClientRect();
      measureSheet.style.width = `${bounds.width}px`;
      const style = getComputedStyle(measureSheet);
      const available = bounds.height - (probe.current!.getBoundingClientRect().top - measureSheet.getBoundingClientRect().top)
        - parseFloat(style.paddingBottom) - parseFloat(style.borderBottomWidth) - 2;
      const originals = Array.from(source.current!.children) as HTMLElement[];
      const measure = (part: LogPart) => {
        const copy = originals[part.entry].cloneNode(true) as HTMLElement;
        const entry = entries[part.entry];
        if (part.continued) copy.querySelector("h3")!.append(" (continued)");
        copy.querySelectorAll("tbody tr").forEach((row, index) => {
          if (index < part.rowStart || index >= part.rowEnd) row.remove();
        });
        if (part.rowStart === part.rowEnd) copy.querySelector("table")?.remove();
        if (part.continued) copy.querySelector("[data-log-empty]")?.remove();
        const note = copy.querySelector<HTMLElement>("[data-log-note-text]");
        if (note && part.noteEnd > part.noteStart) note.textContent = entry.note!.slice(part.noteStart, part.noteEnd);
        else copy.querySelector("[data-log-note]")?.remove();
        if (part.rowEnd < entry.observations.length) copy.querySelector("[data-log-no-note]")?.remove();
        probe.current!.replaceChildren(copy);
        return copy.getBoundingClientRect().height;
      };
      const pages = paginateLogs(entries, available, measure);
      probe.current!.replaceChildren();
      setLayout(current => current.entries === entries && current.height === bounds.height && JSON.stringify(current.pages) === JSON.stringify(pages)
        ? current : { entries, height: bounds.height, pages });
    };
    paginate();
    const observer = new ResizeObserver(paginate);
    observer.observe(summary);
    void document.fonts.ready.then(paginate);
    return () => { active = false; observer.disconnect(); };
  }, [entries]);

  const header = (first: boolean) => <>
    <header className={`${styles.sheetHeader} ${styles.logsHeader}`}>
      <div>
        <h2 id={first ? "logs-heading" : undefined}>Logs</h2>
        <p>{synthetic ? "Maya · Synthetic sample" : "You"} · {formatDate(from)} to {formatDate(to)}</p>
      </div>
      <p className={styles.quiet}>{entries.length} saved {entries.length === 1 ? "check-in" : "check-ins"}</p>
    </header>
    <p className={styles.logsIntro}>Saved check-ins, oldest first. Notes are the patient’s own words. Dates without a check-in are not listed.</p>
  </>;

  return <><section className={styles.logsDocument} aria-labelledby="logs-heading">
    {(layout.entries === entries ? layout.pages : []).map((parts, index) => <div key={index} className={`${styles.sheet} ${styles.logsSheet}`}
      style={{ "--log-sheet-height": `${layout.height}px` } as CSSProperties} data-log-page="">
      {header(index === 0)}
      {parts.map(part => <LogEntry key={`${part.entry}:${part.rowStart}:${part.noteStart}`} entry={entries[part.entry]} part={part} />)}
    </div>)}
  </section>
    <div className={`${styles.sheet} ${styles.logsSheet} ${styles.logsMeasure}`} aria-hidden="true" inert data-log-measure="">
      {header(false)}
      <div ref={probe} />
      <div ref={source}>{entries.map((entry, index) => <LogEntry key={entry.id} entry={entry} part={fullPart(entry, index)} measuring />)}</div>
    </div>
  </>;
}

interface LogPart { entry: number; rowStart: number; rowEnd: number; noteStart: number; noteEnd: number; continued: boolean }
const fullPart = (entry: DailyEntry, index: number): LogPart => ({ entry: index, rowStart: 0, rowEnd: entry.observations.length,
  noteStart: 0, noteEnd: entry.note?.trim() ? entry.note.length : 0, continued: false });

/** Measure actual rendered content; split oversized records at row and text boundaries, never discard overflow. */
function paginateLogs(entries: readonly DailyEntry[], height: number, measure: (part: LogPart) => number): LogPart[][] {
  const pages: LogPart[][] = [[]];
  let used = 0;
  const newPage = () => { pages.push([]); used = 0; };
  const add = (part: LogPart) => { pages[pages.length - 1].push(part); used += measure(part); };
  for (const [index, entry] of entries.entries()) {
    let remaining = fullPart(entry, index);
    while (true) {
      const wholeHeight = measure(remaining);
      if (wholeHeight <= height - used) { add(remaining); break; }
      if (used && wholeHeight <= height) { newPage(); continue; }

      // Fit complete regional rows first, then as much of the original note as space permits.
      const part = { ...remaining, rowEnd: remaining.rowStart, noteEnd: remaining.noteStart };
      while (part.rowEnd < entry.observations.length && measure({ ...part, rowEnd: part.rowEnd + 1 }) <= height - used) part.rowEnd++;
      if (part.rowEnd === entry.observations.length) {
        let low = part.noteStart, high = remaining.noteEnd;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          if (measure({ ...part, noteEnd: middle }) <= height - used) low = middle;
          else high = middle - 1;
        }
        part.noteEnd = low;
        if (low < remaining.noteEnd && low > part.noteStart) {
          const text = entry.note!;
          const space = Math.max(text.lastIndexOf(" ", low - 1), text.lastIndexOf("\n", low - 1));
          if (space > part.noteStart) part.noteEnd = space + 1;
          // Keep a surrogate pair together when a long unbroken string crosses the page.
          if (/[\uDC00-\uDFFF]/.test(text[part.noteEnd] ?? "")) part.noteEnd--;
        }
      }
      if (part.rowEnd === remaining.rowStart && part.noteEnd === remaining.noteStart) {
        if (used) { newPage(); continue; }
        // A single row is indivisible; retain it even if custom fonts make it taller than the sheet.
        if (part.rowEnd < entry.observations.length) part.rowEnd++;
        else part.noteEnd = Math.min(part.noteStart + 1, remaining.noteEnd);
      }
      add(part);
      remaining = { ...remaining, rowStart: part.rowEnd, noteStart: part.noteEnd, continued: true };
      if (remaining.rowStart === remaining.rowEnd && remaining.noteStart === remaining.noteEnd) break;
      newPage();
    }
  }
  return pages;
}

function LogEntry({ entry, part, measuring = false }: { entry: DailyEntry; part: LogPart; measuring?: boolean }) {
  const rows = entry.observations.slice(part.rowStart, part.rowEnd);
  return <div className={styles.logEntry} data-check-in-log={!measuring && !part.continued ? entry.localDate : undefined}
    data-log-continuation={!measuring && part.continued ? entry.localDate : undefined}>
      <h3><time dateTime={entry.localDate}>{formatDate(entry.localDate)}</time>{part.continued && " (continued)"}</h3>
      {rows.length > 0 && <table className={styles.logMeasurements} aria-label={`Pain recorded on ${formatDate(entry.localDate)}`}>
        <thead><tr>
          <th scope="col">Location</th><th scope="col">Sensation</th><th scope="col">Mean intensity</th><th scope="col">Peak intensity</th><th scope="col">Map coverage</th>
        </tr></thead>
        <tbody>{rows.map(row => <tr key={`${row.regionId}:${row.painType}`}>
          <th scope="row">{capitalize(regionPhrase(row.regionId))}</th>
          <td>{PAIN_LABELS[row.painType]}</td>
          <td>{formatIntensity(row.meanIntensity)} / 10</td>
          <td>{formatIntensity(row.peakIntensity)} / 10</td>
          <td>{Math.round(row.mapCoverage * 100)}%</td>
        </tr>)}</tbody>
      </table>}
      {!entry.observations.length && !part.continued && <p className={styles.logEmpty} data-log-empty="">Nothing marked</p>}
      {part.noteEnd > part.noteStart && <div className={styles.logNote} data-log-note="">
        <p className={styles.logNoteLabel}>Patient’s note</p>
        <p className={styles.logNoteText} data-log-note-text="">{entry.note!.slice(part.noteStart, part.noteEnd)}</p>
      </div>}
      {!entry.note?.trim() && part.rowEnd === entry.observations.length
        && <p className={styles.logNoNote} data-log-no-note="">No written note.</p>}
    </div>;
}

const capitalize = (text: string) => text[0].toUpperCase() + text.slice(1);
const formatIntensity = (value: number) => Math.round(value * 10) / 10;
