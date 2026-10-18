"use client";

import React from "react";
import { PAIN_LABELS, type RegionId, type RegionalObservation } from "../domain/contracts";
import { getBodyDiagram, type DiagramView } from "../body/diagram";
import { PAIN_COLORS } from "../body/pain-swatch";
import { formatRegionName } from "./analysis";
import styles from "./timeline.module.css";

interface Props {
  observations: RegionalObservation[];
  selectedRegionId?: RegionId;
  onSelectRegion?: (regionId: RegionId) => void;
}

const SMALL_PARTS = /finger|thumb|toe|eye|ear|nose|mouth/;
/** The view where a region is easiest to see and select: close-ups for small parts, otherwise front, then back. */
function primaryView(regionId: RegionId, views: DiagramView[]): string {
  const has = (id: string) => views.find(view => view.id === id)?.regions.some(region => region.regionId === regionId);
  if (SMALL_PARTS.test(regionId) || /hand|foot/.test(regionId)) {
    const closeUp = views.find(view => view.id !== "front" && view.id !== "back" && has(view.id));
    if (closeUp) return closeUp.id;
  }
  return has("front") ? "front" : "back";
}

/**
 * 2D body map traced from the 3D body's own mesh and regions, with close-ups of the face, hands, and feet so each
 * finger, toe, and facial feature can be selected. Shows regional measurements, not exact painted locations.
 */
export function BodyDiagram({ observations, selectedRegionId, onSelectRegion }: Props) {
  const { views } = getBodyDiagram();
  // Strongest observation per region (a region can carry several sensations).
  const strongest = new Map<RegionId, RegionalObservation>();
  for (const obs of observations) {
    if (obs.mapCoverage <= 0) continue;
    const current = strongest.get(obs.regionId);
    if (!current || obs.peakIntensity > current.peakIntensity) strongest.set(obs.regionId, obs);
  }
  const byRegion = (regionId: RegionId) => observations.filter(obs => obs.regionId === regionId && obs.mapCoverage > 0);
  const describe = (regionId: RegionId) => {
    const rows = byRegion(regionId);
    return `${formatRegionName(regionId)}: ${rows.length ? rows.map(row => `${PAIN_LABELS[row.painType]}, peak ${row.peakIntensity}/10`).join("; ") : "nothing marked"}`;
  };

  const renderView = (view: DiagramView) => <figure key={view.id} className={view.id === "front" || view.id === "back" ? styles.diagramMain : styles.diagramDetail}>
    <svg viewBox={`-2 -2 ${view.width + 4} ${view.height + 4}`} className={styles.diagramSvg} role="group" aria-label={`${view.label} view`}>
      {view.regions.map(region => {
        const obs = strongest.get(region.regionId);
        const selected = selectedRegionId === region.regionId;
        const focusable = primaryView(region.regionId, views) === view.id;
        return <path
          key={region.regionId}
          d={region.d}
          fillRule="evenodd"
          fill={obs ? PAIN_COLORS[obs.painType] : "#d5ded7"}
          fillOpacity={obs ? Math.min(1, Math.max(.55, obs.peakIntensity / 10)) : 1}
          stroke={selected ? "#203b32" : "#9fb2a4"}
          strokeWidth={selected ? 2.2 : .6}
          className={styles.diagramRegion}
          data-region={region.regionId}
          data-selected={selected || undefined}
          tabIndex={focusable ? 0 : -1}
          role="button"
          aria-pressed={selected}
          aria-label={describe(region.regionId)}
          onClick={() => onSelectRegion?.(region.regionId)}
          onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectRegion?.(region.regionId); }
          }}
        ><title>{describe(region.regionId)}</title></path>;
      })}
      <path d={view.outline} fill="none" stroke="#6d8476" strokeWidth={1} fillRule="evenodd" pointerEvents="none" />
    </svg>
    <figcaption><strong>{view.label}</strong>{view.note ? <span>{view.note}</span> : null}</figcaption>
  </figure>;

  return (
    <div className={styles.diagramStage} aria-label="Body pain map by region">
      <span className={styles.srOnly}>Regional measurements, not exact painted locations. Use the 3D body to inspect saved markings.</span>
      <div className={styles.diagramMainRow}>{views.filter(view => view.id === "front" || view.id === "back").map(renderView)}</div>
      <div className={styles.diagramDetailRow}>{views.filter(view => view.id !== "front" && view.id !== "back").map(renderView)}</div>
    </div>
  );
}
