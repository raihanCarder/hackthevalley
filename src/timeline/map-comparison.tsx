"use client";

import { useEffect, useState } from "react";
import type { LocalDate } from "../domain/contracts";
import { BodyViewer } from "../body/body-viewer";
import type { BodyShape } from "../body/body-shape";
import { compareDates, formatRegionName } from "./analysis";
import type { HistoryMapLoader, LoadedMap } from "./map-loader";
import styles from "./timeline.module.css";

export function MapComparison({ loader, earlier, later, shape }: { loader: HistoryMapLoader | null; earlier: LocalDate; later: LocalDate; shape?: BodyShape }) {
  const [result, setResult] = useState<{ loader: HistoryMapLoader; earlier: LocalDate; later: LocalDate; maps: LoadedMap[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!loader) return;
    const abort = new AbortController();
    setError(null);
    Promise.all([loader.load(earlier, abort.signal), loader.load(later, abort.signal)]).then(maps => {
      if (!abort.signal.aborted) setResult({ loader, earlier, later, maps });
    }).catch(failure => { if (!abort.signal.aborted) setError((failure as Error).message); });
    return () => abort.abort();
  }, [loader, earlier, later]);
  if (error) return <p role="alert">The comparison maps could not be loaded: {error}</p>;
  if (!loader || result?.loader !== loader || result.earlier !== earlier || result.later !== later) return <p role="status">Loading comparison maps…</p>;
  const [a, b] = result.maps;
  const comparison = a.entry && b.entry ? compareDates(a.entry, b.entry, earlier, later) : null;
  return <section aria-label="Saved map comparison">
    <div className={styles.comparisonMaps}>
      {[a, b].map((map, index) => <div key={index}>
        <h3>{index === 0 ? "Earlier" : "Later"}: {index === 0 ? earlier : later}</h3>
        {map.entry ? <BodyViewer layers={map.layers} label={`${index === 0 ? "Earlier" : "Later"} saved map for ${map.entry.localDate}`} showLegend={false} shape={shape} />
          : <p>No check-in recorded. This date cannot be compared as zero pain.</p>}
      </div>)}
    </div>
    {comparison && <div className={styles.comparisonTable}><table>
      <caption>Regional changes between the two saved maps</caption>
      <thead><tr><th scope="col">Region / sensation</th><th scope="col">Peak A → B</th><th scope="col">Map coverage A → B</th><th scope="col">Change</th></tr></thead>
      <tbody>{comparison.allChanges.map(change => <tr key={`${change.regionId}:${change.painType}`}>
        <th scope="row">{formatRegionName(change.regionId)} / {change.painType}</th>
        <td>{change.earlierPeak} → {change.laterPeak} / 10</td>
        <td>{(change.earlierCoverage * 100).toFixed(1)}% → {(change.laterCoverage * 100).toFixed(1)}%</td>
        <td>{change.status.replaceAll("-", " ")}</td>
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
