"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Printer } from "lucide-react";
import { PAIN_LABELS, parseLocalDate, type LocalDate } from "@/domain/contracts";
import { BodyViewer } from "@/body/body-viewer";
import type { BodyCaptures, BodyHandle } from "@/body/body-handle";
import { PainLegend } from "@/body/pain-swatch";
import type { PaintLayers } from "@/body/layers";
import { localToday } from "@/journal/repository";
import { buildRangeComposite } from "./composite";
import { DayStrip } from "./day-strip";
import { buildReportModel, presentSensations, regionPhrase, type ReportModel } from "./facts";
import { deterministicPlan, formatDate, renderStatement } from "./plan";
import { useJournalProfile } from "@/journal/profile-context";
import { initialSelection } from "@/journal/selection";
import { reportRevision } from "./summary-service";
import { loadSavedEntries, type ReportProfileKey } from "./report-data";
import type { SummaryResponse } from "./summary-service";
import styles from "./report.module.css";

type Load =
  | { state: "loading" }
  | { state: "ready"; model: ReportModel; profileId: string }
  | { state: "empty" }
  | { state: "error"; message: string };
type Captures = { state: "pending" } | { state: "ready"; images: BodyCaptures } | { state: "unavailable"; message: string };
type Summary = { state: "factual" } | { state: "loading" } | { state: "done"; result: SummaryResponse } | { state: "error"; message: string };
type GeminiStatus = { state: "configured"; model: string } | { state: "not-configured" } | { state: "unknown" };

const CAPTURE_TIMEOUT_MS = 20_000;
const MAX_RANGE_DAYS = 366;

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export function ReportView() {
  const { profile, ready } = useJournalProfile();
  return ready ? <ProfileReport key={profile} profile={profile} /> : <p role="status">Opening report…</p>;
}

function ProfileReport({ profile }: { profile: ReportProfileKey }) {
  const [range, setRange] = useState(() => initialSelection(profile).range);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [composite, setComposite] = useState<PaintLayers | null>(null);
  const [captures, setCaptures] = useState<Captures>({ state: "pending" });
  const [summary, setSummary] = useState<Summary>({ state: "factual" });
  const [gemini, setGemini] = useState<GeminiStatus>({ state: "unknown" });
  const viewer = useRef<BodyHandle | null>(null);
  const summaryAbort = useRef<AbortController | null>(null);
  const rangeDays = daysBetween(range.from, range.to);
  const rangeError = !range.from || !range.to ? "Choose both dates." : rangeDays < 1 ? "The start date must be on or before the end date."
    : rangeDays > MAX_RANGE_DAYS ? `Choose a range of up to ${MAX_RANGE_DAYS} days.` : null;

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/report", { cache: "no-store", signal: abort.signal }).then(response => response.json())
      .then(body => setGemini(body?.gemini?.state === "configured" ? { state: "configured", model: String(body.gemini.model) } : { state: "not-configured" }))
      .catch(() => { if (!abort.signal.aborted) setGemini({ state: "unknown" }); });
    return () => abort.abort();
  }, []);

  // Load saved entries for the selected profile and range; late results never replace a newer selection.
  useEffect(() => {
    summaryAbort.current?.abort();
    if (rangeError) return;
    const abort = new AbortController();
    setLoad({ state: "loading" }); setComposite(null); setCaptures({ state: "pending" }); setSummary({ state: "factual" });
    const from = parseLocalDate(range.from), to = parseLocalDate(range.to);
    loadSavedEntries(profile, { from, to }, abort.signal).then(({ profileId, entries }) => {
      if (abort.signal.aborted) return;
      const model = buildReportModel(entries, { profileId, start: from, end: to });
      setLoad(model ? { state: "ready", model, profileId } : { state: "empty" });
      if (model) buildRangeComposite(model.entries, abort.signal).then(layers => { if (!abort.signal.aborted) setComposite(layers); })
        .catch(error => { if (!abort.signal.aborted) setCaptures({ state: "unavailable", message: (error as Error).message }); });
    }).catch(error => {
      if (abort.signal.aborted) return;
      setLoad({ state: "error", message: (error as Error).message || "Your saved check-ins couldn’t be loaded." });
    });
    return () => { abort.abort(); summaryAbort.current?.abort(); };
  }, [profile, range.from, range.to, rangeError, reloadKey]);

  // Fixed front/back captures of the range composite, rendered by the read-only body viewer.
  useEffect(() => {
    if (!composite) return;
    let cancelled = false;
    if (!webglAvailable()) { setCaptures({ state: "unavailable", message: "Body maps need WebGL, which isn’t available in this browser." }); return; }
    const timer = setTimeout(() => { if (!cancelled) setCaptures({ state: "unavailable", message: "The body maps took too long to draw." }); }, CAPTURE_TIMEOUT_MS);
    const attempt = async () => {
      while (!viewer.current && !cancelled) await new Promise(resolve => setTimeout(resolve, 50));
      if (cancelled) return;
      const images = await viewer.current!.capture({ layers: composite, views: ["front", "back"], width: 300, height: 520 });
      if (!cancelled) { clearTimeout(timer); setCaptures({ state: "ready", images }); }
    };
    attempt().catch(() => { if (!cancelled) setCaptures({ state: "unavailable", message: "The body maps couldn’t be drawn." }); });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [composite]);

  const ready = load.state === "ready" ? load : null;
  const factual = useMemo(() => ready ? deterministicPlan(ready.model.facts).map(statement => renderStatement(statement, ready.model.facts)) : [], [ready]);

  const requestSummary = useCallback(async () => {
    if (!ready) return;
    summaryAbort.current?.abort();
    const abort = summaryAbort.current = new AbortController();
    setSummary({ state: "loading" });
    try {
      const body = { profile, from: range.from, to: range.to, revision: reportRevision(ready.model.entries) };
      const response = await fetch("/api/report/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: abort.signal });
      const payload = await response.json().catch(() => null);
      if (abort.signal.aborted) return;
      if (response.status === 409) { setReloadKey(key => key + 1); return; }
      if (!response.ok || !payload?.summary) throw new Error(payload?.error?.message ?? "The summary service is unavailable.");
      setSummary({ state: "done", result: payload.summary as SummaryResponse });
    } catch (error) {
      if (abort.signal.aborted) return;
      setSummary({ state: "error", message: (error as Error).message });
    }
  }, [ready, profile, range.from, range.to]);

  const synthetic = profile === "maya";
  return <div className={styles.page} data-report-root="">
    <section className={styles.controls} aria-label="Report options">
      <p className={styles.profileStatus}>{synthetic ? "Maya" : "You"}</p>
      <div className={styles.dates}>
        <label>From<input type="date" value={range.from} max={range.to} onChange={event => setRange(current => ({ ...current, from: event.target.value as LocalDate }))} /></label>
        <label>To<input type="date" value={range.to} min={range.from} onChange={event => setRange(current => ({ ...current, to: event.target.value as LocalDate }))} /></label>
      </div>
      <button type="button" onClick={() => setReloadKey(key => key + 1)}>Refresh report</button>
      <button type="button" className={styles.print} onClick={() => window.print()} disabled={!ready}><Printer size={18} strokeWidth={1.8} aria-hidden="true" />Print or save as PDF</button>
      {rangeError && <p className={styles.fieldError} role="alert">{rangeError}</p>}
    </section>

    {rangeError ? null : load.state === "loading" ? <p className={styles.notice} role="status">Gathering saved check-ins…</p>
      : load.state === "error" ? <div className={styles.notice} role="alert"><p>{load.message}</p><button type="button" onClick={() => setReloadKey(key => key + 1)}>Try again</button></div>
      : load.state === "empty" ? <EmptyState profile={profile} range={range}
        body={synthetic ? "Maya has no sample check-ins in this range. Choose dates within the six-week sample, or return to its full report." : "Reports use only check-ins you save. Days without a check-in stay unrecorded, and are never counted as pain-free."} />
      : <article className={styles.sheet} aria-labelledby="report-title">
        <header className={styles.sheetHeader}>
          <div>
            <h2 id="report-title">{synthetic ? "Pain record for Maya" : "Pain record for You"}</h2>
            <p>{formatDate(range.from)} to {formatDate(range.to)} <span className={styles.quiet}>({ready!.model.facts.range.calendarDays} calendar days)</span></p>
          </div>
          <div className={styles.headerAside}>
            {synthetic && <p className={styles.synthetic}>Synthetic sample data. Maya is not a real patient.</p>}
            <p className={styles.quiet}>Prepared {formatDate(localToday())}</p>
          </div>
        </header>

        <dl className={styles.counts}>
          <div><dt>Days with a check-in</dt><dd>{ready!.model.facts.range.recordedDays}<span> of {ready!.model.facts.range.calendarDays}</span></dd></div>
          <div><dt>Days without a check-in</dt><dd>{ready!.model.facts.range.missingDays}</dd></div>
          <div><dt>Check-ins with nothing marked</dt><dd>{ready!.model.facts.range.emptyDays}</dd></div>
        </dl>

        <div className={styles.overview}>
          <section className={styles.maps} aria-labelledby="maps-heading">
            <h3 id="maps-heading">Where pain was marked</h3>
            {captures.state === "ready" ? <div className={styles.captures}>
              {(["front", "back"] as const).map(side => <figure key={side}>
                <img src={captures.images[side]} alt={`${side === "front" ? "Front" : "Back"} of the body showing every location marked in this range`} width={150} height={260} />
                <figcaption>{side === "front" ? "Front (patient’s left on the right)" : "Back (patient’s left on the left)"}</figcaption>
              </figure>)}
            </div> : <p className={styles.mapsPending} role={captures.state === "unavailable" ? "alert" : "status"}>
              {captures.state === "pending" ? "Drawing body maps…" : `${captures.message} Every marked location is listed in the table below.`}</p>}
            <p className={styles.caption}><strong>Range composite.</strong> Each spot shows the strongest mark saved there on any day in this range. It is not one day’s pain.</p>
            <PainLegend present={new Set(presentSensations(ready!.model))} />
          </section>

          <section className={styles.summary} aria-labelledby="summary-heading">
            <h3 id="summary-heading">Summary</h3>
            <SummaryBlock summary={summary} factual={factual} gemini={gemini} onRequest={requestSummary} onFactual={() => setSummary({ state: "factual" })} />
            {ready!.model.noteExcerpts.length > 0 && <>
              <h3>In the patient’s words</h3>
              <ul className={styles.notes}>{ready!.model.noteExcerpts.map(note => <li key={note.entryId}>
                <span className={styles.noteDate}>{formatDate(note.date)}</span>
                <q>{note.text}{note.truncated ? "…" : ""}</q>
              </li>)}</ul>
              <p className={styles.caption}>Most recent notes, as written by the patient{ready!.model.noteExcerpts.some(note => note.truncated) ? "; longer notes are shortened" : ""}.</p>
            </>}
          </section>
        </div>

        <section aria-labelledby="days-heading">
          <h3 id="days-heading">Day by day</h3>
          <DayStrip days={ready!.model.days} />
        </section>

        <section aria-labelledby="regions-heading">
          <h3 id="regions-heading">Regional observations</h3>
          {ready!.model.facts.regions.length ? <div className={styles.tableScroll}><table className={styles.table}>
            <thead><tr><th scope="col">Location</th><th scope="col">Sensation</th><th scope="col">Days marked</th><th scope="col">First recorded</th><th scope="col">Last recorded</th><th scope="col">Highest peak</th><th scope="col">Largest map coverage</th></tr></thead>
            <tbody>{ready!.model.facts.regions.map(row => <tr key={row.id}>
              <th scope="row">{capitalize(regionPhrase(row.regionId))}</th>
              <td>{PAIN_LABELS[row.painType]}</td>
              <td>{row.presentDays} of {row.recordedDays} recorded</td>
              <td>{formatDate(row.firstDate)}</td>
              <td>{formatDate(row.lastDate)}</td>
              <td>{row.maxPeak} / 10</td>
              <td>{row.maxCoveragePercent}%</td>
            </tr>)}</tbody>
          </table></div> : <p className={styles.quiet}>No pain was marked on any saved check-in in this range.</p>}
        </section>

        <footer className={styles.disclaimer}>
          <p>This report describes the patient’s own journal records. It does not provide a diagnosis or treatment advice. Intensity is the patient’s rating from 0 to 10. Map coverage is the share of a region’s body-map area that was marked, not a measure of skin area. Left and right are the patient’s own sides.</p>
        </footer>
      </article>}

    {composite && <div className={styles.offscreen} aria-hidden="true" inert>
      <BodyViewer layers={composite} label="Range composite for capture" handleRef={viewer} showLegend={false} />
    </div>}
  </div>;
}

function SummaryBlock({ summary, factual, gemini, onRequest, onFactual }: { summary: Summary; factual: string[]; gemini: GeminiStatus; onRequest(): void; onFactual(): void }) {
  const result = summary.state === "done" ? summary.result : null;
  const fromGemini = result?.source === "gemini";
  const sentences = result ? result.sentences : factual;
  const label = fromGemini ? `Organized by Gemini (${result!.model}). Each statement was checked against the records in this report.`
    : "Factual summary, not AI-generated. Selected from the records by fixed rules.";
  return <div aria-busy={summary.state === "loading"}>
    <p className={styles.summaryStatus} data-source={fromGemini ? "gemini" : "factual"}>{label}</p>
    <ul className={styles.sentences}>{sentences.map(sentence => <li key={sentence}>{sentence}</li>)}</ul>
    <div className={styles.summaryActions}>
      {gemini.state === "configured" && summary.state !== "loading" && !fromGemini && <>
        <button type="button" onClick={onRequest}>{result || summary.state === "error" ? "Try Gemini again" : "Generate Gemini summary"}</button>
        {!result && summary.state !== "error" && <p>Sends this report’s facts and saved notes to Gemini. Statements that can’t be verified are not used.</p>}
      </>}
      {summary.state === "loading" && <p role="status">Asking Gemini to organize the summary…</p>}
      {result && !fromGemini && <p role="status">Gemini summary unavailable: {result.detail} The factual summary is shown.</p>}
      {summary.state === "error" && <p role="alert">{summary.message} The factual summary is shown.</p>}
      {fromGemini && <button type="button" onClick={onFactual}>Use the factual summary instead</button>}
      {gemini.state === "not-configured" && <p>Gemini isn’t configured on this server, so this summary is not AI-generated.</p>}
      {gemini.state === "unknown" && <p>Gemini availability is unknown. The factual summary remains available.</p>}
    </div>
  </div>;
}

function EmptyState({ profile, range, body }: { profile: ReportProfileKey; range: { from: LocalDate; to: LocalDate }; body: string }) {
  const maya = profile === "maya";
  const href = maya ? "/report?profile=maya&from=2026-09-06&to=2026-10-17" : "/check-in";
  return <section className={styles.empty} aria-labelledby="empty-report-title">
    <div className={styles.emptyIcon}><CalendarDays size={24} strokeWidth={1.6} aria-hidden="true" /></div>
    <p className={styles.emptyEyebrow}>{maya ? "Maya · Synthetic sample" : "Your appointment report"}</p>
    <h2 id="empty-report-title">No check-ins in this date range</h2>
    <p className={styles.emptyDates}>{formatDate(range.from)} <span aria-hidden="true">→</span> {formatDate(range.to)}</p>
    <p className={styles.emptyBody}>{body}</p>
    <Link className={styles.emptyLink} href={href}>{maya ? "View the full sample report" : "Create a check-in"}</Link>
  </section>;
}

const capitalize = (text: string) => text[0].toUpperCase() + text.slice(1);
function webglAvailable() {
  try {
    const context = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!context;
  }
  catch { return false; }
}
