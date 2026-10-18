"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Layers,
  Rotate3D,
  HelpCircle,
} from "lucide-react";

import {
  REGION_IDS,
  PAIN_TYPES,
  PAIN_LABELS,
  parseLocalDate,
  type LocalDate,
  type PainType,
  type RegionId,
} from "../domain/contracts";
import { MAYA_ENTRIES, MAYA_PROFILE } from "../demo/maya";
import { BodyViewer } from "../body/body-viewer";
import { useBodyShapePreference } from "../body/body-shape-preference";
import { useJournalProfile } from "../journal/profile-context";
import { initialSelection } from "../journal/selection";
import { openVisitorJournal, closeJournal } from "../journal/client-repository";
import { syntheticJournalSource } from "../journal/integrations";
import { validateRange, type EntrySummary, type JournalRepository, type DateRange } from "../journal/repository";
import { HistoryMapLoader, type LoadedMap } from "./map-loader";
import { MapComparison } from "./map-comparison";
import {
  computeRegionTrend,
  compareDates,
  formatDisplayDate,
  formatRegionName,
  listCalendarDates,
} from "./analysis";
import { TimelinePlaybackController } from "./playback";
import { BodyDiagram } from "./body-diagram";
import { TrendChart } from "./trend-chart";
import styles from "./timeline.module.css";

const PAIN_COLORS: Record<PainType, string> = {
  burning: "#ce542e",
  aching: "#73528c",
  tingling: "#3c79a8",
  sharp: "#52675b",
};

export function HistoryView() {
  const { profile, ready } = useJournalProfile();
  return ready ? <ProfileHistory key={profile} activeProfileId={profile} /> : <p role="status">Opening history…</p>;
}

function ProfileHistory({ activeProfileId }: { activeProfileId: "maya" | "visitor" }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const [initial] = useState(() => initialSelection(activeProfileId));
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const refresh = () => setReloadKey(value => value + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const [visitorEntries, setVisitorEntries] = useState<EntrySummary[]>([]);
  const [repository, setRepository] = useState<JournalRepository | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const isSynthetic = activeProfileId === "maya";
  // The visitor's own maps show on their chosen body shape; Maya always uses the default figure.
  const [preferredShape] = useBodyShapePreference();
  const viewerShape = isSynthetic ? undefined : preferredShape;
  const [range, setRange] = useState<DateRange>(initial.range);
  const { from: startDate, to: endDate } = range;
  const [currentDate, setCurrentDate] = useState<LocalDate>(initial.date);
  const allDates = useMemo(() => listCalendarDates(startDate, endDate), [startDate, endDate]);
  const entries = useMemo(() => (isSynthetic ? MAYA_ENTRIES : visitorEntries).filter(e => e.localDate >= startDate && e.localDate <= endDate), [isSynthetic, visitorEntries, startDate, endDate]);
  const [viewMode, setViewMode] = useState<"diagram" | "3d">("3d");
  const loader = useMemo(() => isSynthetic ? new HistoryMapLoader(syntheticJournalSource, "maya")
    : repository ? new HistoryMapLoader(repository, "visitor") : null, [isSynthetic, repository]);
  const [loaded, setLoaded] = useState<{ loader: HistoryMapLoader; date: LocalDate; value: LoadedMap } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (isSynthetic) return;
    const abort = new AbortController();
    let opened: JournalRepository | null = null;
    setRepository(null); setVisitorEntries([]); setHistoryLoading(true); setHistoryError(null);
    openVisitorJournal().then(async source => {
      opened = source;
      if (abort.signal.aborted) { closeJournal(source); return; }
      const summaries = await source.list("visitor", range, { signal: abort.signal });
      if (!abort.signal.aborted) { setVisitorEntries(summaries); setRepository(source); }
    }).catch(error => { if (!abort.signal.aborted) setHistoryError((error as Error).message); })
      .finally(() => { if (!abort.signal.aborted) setHistoryLoading(false); });
    return () => { abort.abort(); closeJournal(opened); };
  }, [isSynthetic, range, reloadKey]);

  useEffect(() => {
    if (!loader) return;
    const abort = new AbortController();
    setMapError(null);
    loader.load(currentDate, abort.signal).then(value => {
      if (!abort.signal.aborted) setLoaded({ loader, date: currentDate, value });
    }).catch(error => { if (!abort.signal.aborted) setMapError((error as Error).message); });
    // Decode only a small window ahead. Date/profile/range changes abort outdated reads.
    const index = allDates.indexOf(currentDate);
    for (const date of allDates.slice(index + 1, index + 3)) void loader.load(date, abort.signal).catch(() => {});
    return () => abort.abort();
  }, [loader, currentDate, allDates]);
  const selectedMap = loaded?.loader === loader && loaded.date === currentDate ? loaded.value : null;
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(1000);
  const playbackRef = useRef<TimelinePlaybackController | null>(null);

  // Analysis rail tab: "trends" or "comparison"
  const [activeTab, setActiveTab] = useState<"trends" | "comparison">("trends");

  // Trends selection
  const [selectedRegion, setSelectedRegion] = useState<RegionId>("back-lower-torso");
  const [selectedPainType, setSelectedPainType] = useState<PainType>("aching");

  // Comparison selection
  const [compareDateA, setCompareDateA] = useState<LocalDate>(initial.range.from);
  const [compareDateB, setCompareDateB] = useState<LocalDate>(initial.range.to);

  // Map of entries by date for fast lookup
  const entryMap = useMemo(() => {
    const map = new Map<LocalDate, EntrySummary>();
    for (const e of entries) {
      map.set(e.localDate, e);
    }
    return map;
  }, [entries]);

  // Active entry on current date
  const currentEntry = selectedMap?.entry ?? null;
  const currentSummary = entryMap.get(currentDate) ?? null;
  const visitorUnavailable = !isSynthetic && (!repository || historyLoading || Boolean(historyError));

  // Initialize and tear down playback controller
  const handleDateChange = useCallback((date: LocalDate) => {
    setCurrentDate(date);
  }, []);

  const handlePlaybackEnd = useCallback(() => {
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    const controller = new TimelinePlaybackController(
      entries,
      startDate,
      endDate,
      handleDateChange,
      handlePlaybackEnd,
      speedMs
    );
    // Initializing after metadata arrives must not replay an older render's date into React.
    controller.seek(currentDate, false);
    setIsPlaying(false);
    playbackRef.current = controller;

    return () => {
      controller.dispose();
      playbackRef.current = null;
    };
  }, [entries, startDate, endDate, handleDateChange, handlePlaybackEnd]);

  useEffect(() => { playbackRef.current?.setSpeed(speedMs); }, [speedMs]);

  // Handle play / pause toggle
  const togglePlayPause = () => {
    if (!playbackRef.current) return;
    if (isPlaying) {
      playbackRef.current.pause();
      setIsPlaying(false);
    } else {
      playbackRef.current.seek(currentDate, false);
      const started = playbackRef.current.play();
      if (started) setIsPlaying(true);
    }
  };

  const handleSeek = (date: LocalDate) => {
    if (playbackRef.current) {
      playbackRef.current.seek(date);
      setIsPlaying(false);
    } else {
      setCurrentDate(date);
    }
  };

  const handleStepBack = () => {
    if (playbackRef.current) {
      playbackRef.current.seek(currentDate, false);
      playbackRef.current.stepBackward();
      setIsPlaying(false);
    }
  };

  const handleStepForward = () => {
    if (playbackRef.current) {
      playbackRef.current.seek(currentDate, false);
      playbackRef.current.stepForward();
      setIsPlaying(false);
    }
  };

  function changeRange(next: DateRange) {
    try {
      validateRange(next);
      playbackRef.current?.pause(); setIsPlaying(false);
      setRange(next);
      setCurrentDate(date => date < next.from ? next.from : date > next.to ? next.to : date);
      setCompareDateA(next.from); setCompareDateB(next.to); setHistoryError(null);
    } catch (error) { setHistoryError((error as Error).message); }
  }

  // Trend analysis calculation (pure and reactive)
  const trendSummary = useMemo(() => {
    return computeRegionTrend(entries, {
      profileId: isSynthetic ? MAYA_PROFILE.id : visitorEntries[0]?.profileId ?? "visitor",
      regionId: selectedRegion,
      painType: selectedPainType,
      startDate,
      endDate,
    });
  }, [entries, isSynthetic, visitorEntries, selectedRegion, selectedPainType, startDate, endDate]);

  // Comparison calculation
  const comparisonResult = useMemo(() => {
    const entryA = entryMap.get(compareDateA) ?? null;
    const entryB = entryMap.get(compareDateB) ?? null;
    return compareDates(entryA, entryB, compareDateA, compareDateB);
  }, [entryMap, compareDateA, compareDateB]);

  // Scrubber date slider index
  const currentIndex = Math.max(0, allDates.indexOf(currentDate));
  const canPlay = entries.length >= 2;

  return (
    <div className={styles.timelineContainer} data-history-root="" data-selected-date={currentDate}>
      <section className={styles.profileBar} aria-label="Active profile and status">
        <div><strong>{isSynthetic ? "Maya" : "You"}</strong><p className={styles.syntheticNotice}>{isSynthetic
          ? "Maya · Synthetic sample · Six weeks of check-ins."
          : "Your saved check-ins from PostgreSQL on this device."}</p></div>
        <Link className="text-link" href={`/report?${new URLSearchParams({ profile: activeProfileId, from: startDate, to: endDate })}`}>Generate report</Link>
        {!isSynthetic && <button type="button" disabled={historyLoading} onClick={() => setReloadKey(value => value + 1)}>Refresh history</button>}
      </section>

      {historyError && <p role="alert">{historyError}</p>}
      {historyLoading && <p role="status">Loading saved history…</p>}
      <div className={`${styles.selectorGrid} ${styles.rangeControls}`} role="group" aria-label="Analysis date range">
        <label className={styles.fieldGroup}><span className={styles.fieldLabel}>From</span><input className={styles.selectInput} aria-label="History from" type="date" value={startDate} max={endDate} onChange={e => { if (e.target.value) changeRange({ ...range, from: e.target.value as LocalDate }); }} /></label>
        <label className={styles.fieldGroup}><span className={styles.fieldLabel}>To</span><input className={styles.selectInput} aria-label="History to" type="date" value={endDate} min={startDate} onChange={e => { if (e.target.value) changeRange({ ...range, to: e.target.value as LocalDate }); }} /></label>
      </div>
      {/* Date Scrubber & Playback Controls */}
      <section className={styles.scrubberCard} hidden={!isSynthetic && Boolean(historyError)} aria-label="Calendar date scrubber and playback">
        <div className={styles.scrubberHeader}>
          <div>
            <span className={styles.dateCounter}>
              Day {currentIndex + 1} of {allDates.length} · {currentDate}
            </span>
            <div className={styles.currentDateLabel}>{formatDisplayDate(currentDate)}</div>
          </div>

          <div className={styles.speedSelector}>
            <span>Speed:</span>
            <button
              type="button"
              className={styles.speedButton}
              aria-pressed={speedMs === 1000}
              onClick={() => setSpeedMs(1000)}
            >
              1x
            </button>
            <button
              type="button"
              className={styles.speedButton}
              aria-pressed={speedMs === 500}
              onClick={() => setSpeedMs(500)}
            >
              2x
            </button>
          </div>
        </div>

        {/* Date Slider & Tick Bars */}
        <div className={styles.sliderRow}>
          <input
            type="range"
            disabled={!hydrated || historyLoading}
            min={0}
            max={Math.max(0, allDates.length - 1)}
            value={currentIndex}
            onChange={e => {
              const idx = Number(e.target.value);
              if (allDates[idx]) handleSeek(allDates[idx]);
            }}
            className={styles.dateSlider}
            aria-label="Scrub calendar dates"
          />

          {/* Timeline distribution ticks */}
          <div className={styles.scrubberTicks} aria-hidden="true">
            {allDates.map(d => {
              const e = entryMap.get(d);
              if (!e) return <div key={d} className={styles.tickMissing} title={`${d}: Unrecorded`} />;
              if (e.observations.length === 0)
                return <div key={d} className={styles.tickEmpty} title={`${d}: Pain-free (0)`} />;
              return <div key={d} className={styles.tickRecorded} title={`${d}: Recorded check-in`} />;
            })}
          </div>
        </div>

        {/* Playback Button Group */}
        <div className={styles.playbackControls}>
          <div className={styles.playbackButtonGroup}>
            <button
              type="button"
              className={styles.controlButton}
              onClick={handleStepBack}
              disabled={currentIndex <= 0}
              aria-label="Previous day"
            >
              <ChevronLeft size={18} />
              <span>Previous</span>
            </button>

            <button
              type="button"
              className={`${styles.controlButton} ${styles.playPauseButton}`}
              onClick={togglePlayPause}
              disabled={!canPlay}
              aria-label={isPlaying ? "Pause timeline playback" : "Play timeline playback"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              <span>{isPlaying ? "Pause" : "Play"}</span>
            </button>

            <button
              type="button"
              className={styles.controlButton}
              onClick={handleStepForward}
              disabled={currentIndex >= allDates.length - 1}
              aria-label="Next day"
            >
              <span>Next</span>
              <ChevronRight size={18} />
            </button>
          </div>

          {!canPlay && (
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Playback disabled: requires at least two recorded check-ins.
            </span>
          )}
        </div>
      </section>

      {/* Main Grid: Body Stage & Inspection (Left) vs Analysis Rail (Right) */}
      <div className={styles.mainGrid}>
        {/* Left Column: Visual Body Map & Daily Observations */}
        <div className={styles.visualColumn}>
          <div className={styles.bodyStageWrapper}>
            {/* View Mode & Camera View Switcher */}
            <div className={styles.viewModeToggleRow}>
              <div className={styles.modeToggleButtons} role="group" aria-label="Visualization mode">
                <button
                  type="button"
                  className={styles.modeToggleButton}
                  aria-pressed={viewMode === "diagram"}
                  onClick={() => setViewMode("diagram")}
                >
                  <Layers size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  Region overview
                </button>
                <button
                  type="button"
                  className={styles.modeToggleButton}
                  aria-pressed={viewMode === "3d"}
                  onClick={() => setViewMode("3d")}
                >
                  <Rotate3D size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  3D Mannequin
                </button>
              </div>

            </div>

            {/* Stage: 2D Anatomical Diagram or 3D Scene */}
            {viewMode === "diagram" ? (
              <BodyDiagram
                observations={currentSummary?.observations ?? []}
                selectedRegionId={selectedRegion}
                onSelectRegion={regionId => {
                  setSelectedRegion(regionId);
                  setActiveTab("trends");
                }}
              />
            ) : (
              <div className={styles.canvasStage}>
                {visitorUnavailable ? <p role="status">{historyError ? "Saved maps are unavailable from local PostgreSQL." : "Loading saved history…"}</p>
                  : mapError ? <p role="alert">This saved map cannot be shown: {mapError}</p>
                  : !selectedMap && (isSynthetic || repository) ? <p role="status">Loading saved map…</p>
                  : currentEntry ? <BodyViewer layers={selectedMap?.layers ?? null} label={`Saved map for ${currentDate}`} shape={viewerShape} />
                  : <p className={styles.missingStateBanner}>No check-in recorded for this date. No map is attributed to this day.</p>}
              </div>
            )}
          </div>

          {/* Active Date Card: Note & Regional Observations */}
          <div className={styles.activeDayCard}>
            <div className={styles.activeDayHeader}>
              <h2 className={styles.activeDayTitle}>Check-in for {formatDisplayDate(currentDate)}</h2>
              {visitorUnavailable ? <span>History unavailable</span> : currentSummary && !selectedMap ? <span role="status">Opening saved check-in…</span> : currentEntry ? (
                currentEntry.observations.length === 0 ? (
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Explicitly empty check-in</span>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 600 }}>
                    {currentEntry.observations.length} area{currentEntry.observations.length > 1 ? "s" : ""} marked
                  </span>
                )
              ) : (
                <span style={{ fontSize: "12px", color: "var(--error)", fontWeight: 600 }}>
                  Unrecorded gap
                </span>
              )}
            </div>

            {visitorUnavailable ? <p>Saved entries must be loaded before this date can be inspected.</p> : currentSummary && !selectedMap ? <p role="status">Loading the saved map and note…</p> : currentEntry ? (
              <>
                {/* Note */}
                {currentEntry.note && (
                  <div className={styles.noteBox}>
                    <div className={styles.noteLabel}>Patient Journal Note</div>
                    <div>{currentEntry.note}</div>
                  </div>
                )}

                {/* Regional Observations Badges */}
                {currentEntry.observations.length > 0 ? (
                  <div className={styles.observationTags}>
                    {currentEntry.observations.map(obs => (
                      <button type="button"
                        key={`${obs.regionId}-${obs.painType}`}
                        className={styles.observationTag}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setSelectedRegion(obs.regionId);
                          setSelectedPainType(obs.painType);
                          setActiveTab("trends");
                        }}
                      >
                        <span
                          className={styles.observationTagDot}
                          style={{ background: PAIN_COLORS[obs.painType] }}
                        />
                        <span>
                          <strong>{formatRegionName(obs.regionId)}</strong>: {PAIN_LABELS[obs.painType]} · Peak{" "}
                          {obs.peakIntensity.toFixed(1)}/10 ({(obs.mapCoverage * 100).toFixed(0)}% map coverage)
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyStateBanner}>
                    Saved with nothing marked on this calendar day.
                  </div>
                )}
              </>
            ) : (
              <div className={styles.missingStateBanner}>
                <strong>No check-in recorded for this date.</strong>
                <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
                  This calendar day is an unrecorded gap. It is not assumed to be pain-free.
                </p>
              </div>
            )}

            {/* Visitor zero entries state */}
            {activeProfileId === "visitor" && !historyLoading && !historyError && visitorEntries.length === 0 && (
              <div style={{ textAlign: "center", paddingTop: 8 }}>
                <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 12px" }}>
                  You have not saved any check-ins in this range yet.
                </p>
                <Link
                  href="/"
                  className={styles.controlButton}
                  style={{ textDecoration: "none", display: "inline-flex" }}
                >
                  Go to 3D check-in to paint pain
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Analysis Rail (Trends & Comparison) */}
        <div className={styles.analysisColumn} hidden={visitorUnavailable}>
          {/* Tab Bar */}
          <div className={styles.tabBar} role="tablist">
            <button
              type="button"
              role="tab"
              className={styles.tabButton}
              aria-selected={activeTab === "trends"}
              onClick={() => setActiveTab("trends")}
            >
              Regional Trends
            </button>
            <button
              type="button"
              role="tab"
              className={styles.tabButton}
              aria-selected={activeTab === "comparison"}
              onClick={() => setActiveTab("comparison")}
            >
              Compare Dates
            </button>
          </div>

          {/* TAB 1: Regional Trends */}
          {activeTab === "trends" && (
            <div className={styles.analysisPanel} role="tabpanel">
              {/* Selectors */}
              <div className={styles.selectorGrid}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="trend-region-select" className={styles.fieldLabel}>
                    Body Region
                  </label>
                  <select
                    id="trend-region-select"
                    value={selectedRegion}
                    onChange={e => setSelectedRegion(e.target.value as RegionId)}
                    className={styles.selectInput}
                  >
                    {REGION_IDS.map(r => (
                      <option key={r} value={r}>
                        {formatRegionName(r)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="trend-pain-select" className={styles.fieldLabel}>
                    Sensation Type
                  </label>
                  <select
                    id="trend-pain-select"
                    value={selectedPainType}
                    onChange={e => setSelectedPainType(e.target.value as PainType)}
                    className={styles.selectInput}
                  >
                    {PAIN_TYPES.map(t => (
                      <option key={t} value={t}>
                        {PAIN_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary Metric Cards */}
              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>
                    {trendSummary.presentDays} / {trendSummary.recordedDays}
                  </div>
                  <div className={styles.statLabel}>
                    Recorded-Day Frequency ({(trendSummary.frequency * 100).toFixed(1)}%)
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statValue}>{trendSummary.maxPeakIntensity} / 10</div>
                  <div className={styles.statLabel}>Highest Peak Intensity</div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statValue}>
                    {trendSummary.firstPresentDate ? trendSummary.firstPresentDate.slice(5) : "None"}
                  </div>
                  <div className={styles.statLabel}>First Recorded Presence</div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statValue}>
                    {(trendSummary.maxMapCoverage * 100).toFixed(0)}%
                  </div>
                  <div className={styles.statLabel}>Max Map Coverage</div>
                </div>
              </div>

              <p>Last recorded presence: {trendSummary.lastPresentDate ?? "None"}</p>
              {/* Interactive Trend SVG Chart */}
              <TrendChart
                trend={trendSummary}
                activeDate={currentDate}
                onSelectDate={date => handleSeek(date as LocalDate)}
              />

              <p className={styles.chartNote}>
                <strong>Measurement guide:</strong> Peak intensity (0–10) reflects perceived severity, while
                map coverage measures the proportion of marked surface area in this region. Missing dates
                appear as gaps and do not skew frequency counts.
              </p>
            </div>
          )}

          {/* TAB 2: Date Comparison */}
          {activeTab === "comparison" && (
            <div className={styles.analysisPanel} role="tabpanel">
              <div className={styles.compareDateRow}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="compare-date-a" className={styles.fieldLabel}>
                    Earlier Date (A)
                  </label>
                  <select
                    id="compare-date-a"
                    value={compareDateA}
                    onChange={e => setCompareDateA(e.target.value as LocalDate)}
                    className={styles.selectInput}
                  >
                    {allDates.map(d => (
                      <option key={`a-${d}`} value={d} disabled={d >= compareDateB}>
                        {d} ({formatDisplayDate(d).slice(0, 3)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="compare-date-b" className={styles.fieldLabel}>
                    Later Date (B)
                  </label>
                  <select
                    id="compare-date-b"
                    value={compareDateB}
                    onChange={e => setCompareDateB(e.target.value as LocalDate)}
                    className={styles.selectInput}
                  >
                    {allDates.map(d => (
                      <option key={`b-${d}`} value={d} disabled={d <= compareDateA}>
                        {d} ({formatDisplayDate(d).slice(0, 3)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Presets for Demo */}
              {activeProfileId === "maya" && (
                <div className={styles.quickCompareRow}>
                  <span style={{ fontSize: "12px", color: "var(--muted)", alignSelf: "center" }}>
                    Presets:
                  </span>
                  <button
                    type="button"
                    className={styles.quickCompareButton}
                    onClick={() => {
                      setCompareDateA("2026-10-02" as LocalDate);
                      setCompareDateB("2026-10-03" as LocalDate);
                    }}
                  >
                    Thigh Onset (Oct 2 vs Oct 3)
                  </button>
                  <button
                    type="button"
                    className={styles.quickCompareButton}
                    onClick={() => {
                      setCompareDateA("2026-10-03" as LocalDate);
                      setCompareDateB("2026-10-10" as LocalDate);
                    }}
                  >
                    Calf Spread (Oct 3 vs Oct 10)
                  </button>
                  <button
                    type="button"
                    className={styles.quickCompareButton}
                    onClick={() => {
                      setCompareDateA("2026-09-06" as LocalDate);
                      setCompareDateB("2026-10-17" as LocalDate);
                    }}
                  >
                    Full 6 Weeks (Sept 6 vs Oct 17)
                  </button>
                </div>
              )}

              <MapComparison loader={loader} earlier={compareDateA} later={compareDateB} shape={viewerShape} />
              {/* Comparison Observations */}
              <div className={styles.changesSummaryList} hidden={!entryMap.has(compareDateA) || !entryMap.has(compareDateB)}>
                {/* Newly marked areas */}
                {comparisonResult.newlyMarked.length > 0 && (
                  <div className={styles.newlyMarkedBox}>
                    <h3 className={styles.changeBoxTitle}>
                      Newly Marked Pain Regions on {compareDateB}
                    </h3>
                    <div className={styles.observationTags}>
                      {comparisonResult.newlyMarked.map(item => (
                        <div key={`${item.regionId}-${item.painType}`} className={styles.observationTag}>
                          <span
                            className={styles.observationTagDot}
                            style={{ background: PAIN_COLORS[item.painType] }}
                          />
                          <span>
                            <strong>{formatRegionName(item.regionId)}</strong>: {PAIN_LABELS[item.painType]}{" "}
                            (Peak {item.laterPeak}/10, {(item.laterCoverage * 100).toFixed(0)}% coverage)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Descriptive observation sentences */}
                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 8px", color: "var(--foreground)" }}>
                    Descriptive Observations
                  </h3>
                  {comparisonResult.descriptiveObservations.length > 0 ? (
                    <ul className={styles.observationSentenceList}>
                      {comparisonResult.descriptiveObservations.map((obs, i) => (
                        <li key={i} className={styles.observationSentenceItem}>
                          {obs}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
                      No regional sensation changes recorded between {compareDateA} and {compareDateB}.
                    </p>
                  )}
                </div>

                <p className={styles.chartNote} style={{ marginTop: 8 }}>
                  <strong>Disclaimer:</strong> Differences reflect recorded markings only and do not constitute
                  a clinical progression or diagnosis.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
