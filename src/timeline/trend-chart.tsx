"use client";

import React, { useState } from "react";
import type { RegionTrendSummary } from "./analysis";
import styles from "./timeline.module.css";

interface Props {
  trend: RegionTrendSummary;
  activeDate: string;
  onSelectDate: (date: string) => void;
}

export function TrendChart({ trend, activeDate, onSelectDate }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { points } = trend;
  if (!points || points.length === 0) {
    return <div className={styles.emptyStateBanner}>No recorded data in this range.</div>;
  }

  // Chart dimensions
  const width = 500;
  const height = 180;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 30;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const count = points.length;
  const getX = (idx: number) => padLeft + (idx / Math.max(1, count - 1)) * chartW;
  const getYIntensity = (val: number) => padTop + chartH - (val / 10) * chartH;
  const getYCoverage = (val: number) => padTop + chartH - val * chartH;

  // Build SVG path segments (breaking on missing days)
  const intensitySegments: string[] = [];
  const coverageSegments: string[] = [];

  let currentIntSegment: string[] = [];
  let currentCovSegment: string[] = [];

  for (let i = 0; i < count; i++) {
    const pt = points[i];
    if (pt.status === "missing" || pt.peakIntensity === null || pt.mapCoverage === null) {
      if (currentIntSegment.length > 0) {
        intensitySegments.push(currentIntSegment.join(" "));
        currentIntSegment = [];
      }
      if (currentCovSegment.length > 0) {
        coverageSegments.push(currentCovSegment.join(" "));
        currentCovSegment = [];
      }
    } else {
      const x = getX(i);
      const yInt = getYIntensity(pt.peakIntensity);
      const yCov = getYCoverage(pt.mapCoverage);

      if (currentIntSegment.length === 0) {
        currentIntSegment.push(`M ${x.toFixed(1)} ${yInt.toFixed(1)}`);
      } else {
        currentIntSegment.push(`L ${x.toFixed(1)} ${yInt.toFixed(1)}`);
      }

      if (currentCovSegment.length === 0) {
        currentCovSegment.push(`M ${x.toFixed(1)} ${yCov.toFixed(1)}`);
      } else {
        currentCovSegment.push(`L ${x.toFixed(1)} ${yCov.toFixed(1)}`);
      }
    }
  }

  if (currentIntSegment.length > 0) intensitySegments.push(currentIntSegment.join(" "));
  if (currentCovSegment.length > 0) coverageSegments.push(currentCovSegment.join(" "));

  return (
    <div className={styles.chartContainer}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={styles.chartSvg}
        role="img"
        aria-label="Timeline trend chart: peak intensity and map coverage over time"
      >
        {/* Horizontal grid lines */}
        {[0, 2.5, 5, 7.5, 10].map(val => {
          const y = getYIntensity(val);
          return (
            <g key={val}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#dbe3dd"
                strokeWidth="1"
                strokeDasharray={val === 0 ? undefined : "3 3"}
              />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#677c70">
                {val}
              </text>
            </g>
          );
        })}

        {/* Date labels on X axis */}
        {points.length > 0 && (
          <>
            <text x={padLeft} y={height - 10} textAnchor="start" fontSize="10" fill="#677c70">
              {points[0].localDate.slice(5)}
            </text>
            <text
              x={width - padRight}
              y={height - 10}
              textAnchor="end"
              fontSize="10"
              fill="#677c70"
            >
              {points[points.length - 1].localDate.slice(5)}
            </text>
          </>
        )}

        {/* Coverage Path (dashed terracotta line) */}
        {coverageSegments.map((d, idx) => (
          <path
            key={`cov-${idx}`}
            d={d}
            fill="none"
            stroke="#ce542e"
            strokeWidth="2"
            strokeDasharray="4 3"
            opacity="0.8"
          />
        ))}

        {/* Intensity Path (solid dark sage line) */}
        {intensitySegments.map((d, idx) => (
          <path
            key={`int-${idx}`}
            d={d}
            fill="none"
            stroke="#203b32"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ))}

        {/* Individual points */}
        {points.map((pt, i) => {
          const x = getX(i);
          const isActive = pt.localDate === activeDate;
          const isHovered = hoveredIdx === i;

          if (pt.status === "missing") {
            // Gap indicator
            return (
              <circle
                key={pt.localDate}
                cx={x}
                cy={padTop + chartH}
                r="2"
                fill="#b88"
                opacity="0.5"
              >
                <title>{pt.localDate}: Unrecorded gap</title>
              </circle>
            );
          }

          const yInt = getYIntensity(pt.peakIntensity ?? 0);

          return (
            <g
              key={pt.localDate}
              tabIndex={0}
              role="button"
              aria-label={`${pt.localDate}: Peak ${pt.peakIntensity}/10, Coverage ${((pt.mapCoverage ?? 0) * 100).toFixed(0)}%`}
              onClick={() => onSelectDate(pt.localDate)}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDate(pt.localDate);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              {/* Highlight bar for active or hovered date */}
              {(isActive || isHovered) && (
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + chartH}
                  stroke="#365e49"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
              )}

              {/* Point circle */}
              <circle
                cx={x}
                cy={yInt}
                r={isActive ? 6 : isHovered ? 5 : 3.5}
                fill={isActive ? "#ce542e" : "#203b32"}
                stroke="#ffffff"
                strokeWidth={isActive ? 2 : 1}
              />
            </g>
          );
        })}
      </svg>

      <div className={styles.chartLegend}>
        <div className={styles.legendItem}>
          <span className={styles.legendLineIntensity} />
          <span>Peak Intensity (0–10 scale)</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendLineCoverage} />
          <span>Map Coverage (0–100%)</span>
        </div>
      </div>
    </div>
  );
}
