"use client";

import React from "react";
import type { PainType, RegionId, RegionalObservation } from "../domain/contracts";
import styles from "./timeline.module.css";

interface Props {
  observations: RegionalObservation[];
  selectedRegionId?: RegionId;
  onSelectRegion?: (regionId: RegionId) => void;
}

const PAIN_COLORS: Record<PainType, string> = {
  burning: "#ce542e",
  aching: "#73528c",
  tingling: "#3c79a8",
  sharp: "#405247",
};

interface DiagramRegionDef {
  id: RegionId;
  name: string;
  side: "front" | "back";
  // SVG path or rectangle definition for stylized mannequin silhouette
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
}

const DIAGRAM_REGIONS: DiagramRegionDef[] = [
  // Front regions
  { id: "head", name: "Head", side: "front", x: 90, y: 15, w: 40, h: 48, rx: 20 },
  { id: "neck", name: "Neck", side: "front", x: 98, y: 65, w: 24, h: 20, rx: 4 },
  { id: "front-upper-torso", name: "Chest / Upper Torso", side: "front", x: 70, y: 88, w: 80, h: 56, rx: 8 },
  { id: "front-lower-torso", name: "Abdomen / Lower Torso", side: "front", x: 74, y: 147, w: 72, h: 46, rx: 6 },
  { id: "pelvis", name: "Pelvis", side: "front", x: 72, y: 196, w: 76, h: 36, rx: 8 },
  // Front arms
  { id: "left-upper-arm", name: "Left Upper Arm", side: "front", x: 154, y: 92, w: 22, h: 54, rx: 8 },
  { id: "right-upper-arm", name: "Right Upper Arm", side: "front", x: 44, y: 92, w: 22, h: 54, rx: 8 },
  { id: "left-forearm", name: "Left Forearm", side: "front", x: 168, y: 150, w: 20, h: 52, rx: 6 },
  { id: "right-forearm", name: "Right Forearm", side: "front", x: 32, y: 150, w: 20, h: 52, rx: 6 },
  { id: "left-hand", name: "Left Hand", side: "front", x: 180, y: 205, w: 18, h: 30, rx: 6 },
  { id: "right-hand", name: "Right Hand", side: "front", x: 22, y: 205, w: 18, h: 30, rx: 6 },
  // Front legs
  { id: "left-thigh", name: "Left Thigh", side: "front", x: 114, y: 236, w: 32, h: 84, rx: 12 },
  { id: "right-thigh", name: "Right Thigh", side: "front", x: 74, y: 236, w: 32, h: 84, rx: 12 },
  { id: "left-calf", name: "Left Calf", side: "front", x: 116, y: 325, w: 28, h: 82, rx: 10 },
  { id: "right-calf", name: "Right Calf", side: "front", x: 76, y: 325, w: 28, h: 82, rx: 10 },
  { id: "left-foot", name: "Left Foot", side: "front", x: 116, y: 412, w: 32, h: 20, rx: 6 },
  { id: "right-foot", name: "Right Foot", side: "front", x: 72, y: 412, w: 32, h: 20, rx: 6 },

  // Back regions
  { id: "head", name: "Head", side: "back", x: 290, y: 15, w: 40, h: 48, rx: 20 },
  { id: "neck", name: "Neck", side: "back", x: 298, y: 65, w: 24, h: 20, rx: 4 },
  { id: "back-upper-torso", name: "Upper Back", side: "back", x: 270, y: 88, w: 80, h: 56, rx: 8 },
  { id: "back-lower-torso", name: "Lower Back", side: "back", x: 274, y: 147, w: 72, h: 46, rx: 6 },
  { id: "pelvis", name: "Pelvis / Gluteals", side: "back", x: 272, y: 196, w: 76, h: 36, rx: 8 },
  // Back arms (patient-left is screen-left when viewing back)
  { id: "left-upper-arm", name: "Left Upper Arm", side: "back", x: 244, y: 92, w: 22, h: 54, rx: 8 },
  { id: "right-upper-arm", name: "Right Upper Arm", side: "back", x: 354, y: 92, w: 22, h: 54, rx: 8 },
  { id: "left-forearm", name: "Left Forearm", side: "back", x: 232, y: 150, w: 20, h: 52, rx: 6 },
  { id: "right-forearm", name: "Right Forearm", side: "back", x: 368, y: 150, w: 20, h: 52, rx: 6 },
  { id: "left-hand", name: "Left Hand", side: "back", x: 222, y: 205, w: 18, h: 30, rx: 6 },
  { id: "right-hand", name: "Right Hand", side: "back", x: 380, y: 205, w: 18, h: 30, rx: 6 },
  // Back legs
  { id: "left-thigh", name: "Left Thigh", side: "back", x: 274, y: 236, w: 32, h: 84, rx: 12 },
  { id: "right-thigh", name: "Right Thigh", side: "back", x: 314, y: 236, w: 32, h: 84, rx: 12 },
  { id: "left-calf", name: "Left Calf", side: "back", x: 276, y: 325, w: 28, h: 82, rx: 10 },
  { id: "right-calf", name: "Right Calf", side: "back", x: 316, y: 325, w: 28, h: 82, rx: 10 },
  { id: "left-foot", name: "Left Foot", side: "back", x: 272, y: 412, w: 32, h: 20, rx: 6 },
  { id: "right-foot", name: "Right Foot", side: "back", x: 316, y: 412, w: 32, h: 20, rx: 6 },
];

export function BodyDiagram({ observations, selectedRegionId, onSelectRegion }: Props) {
  const obsMap = new Map<RegionId, RegionalObservation>();
  for (const obs of observations) {
    if (obs.mapCoverage > 0) {
      obsMap.set(obs.regionId, obs);
    }
  }

  return (
    <div className={styles.diagramStage} aria-label="Anatomical body pain map">
      <span className="sr-only">Regional measurements, not exact painted locations. Use the 3D mannequin to inspect saved markings.</span>
      <svg
        viewBox="0 0 420 445"
        className={styles.diagramSvg}
        role="img"
        aria-label="Stylized front and back body pain diagram"
      >
        <text x="110" y="440" textAnchor="middle" className={styles.diagramSideLabel}>
          FRONT (Your view)
        </text>
        <text x="310" y="440" textAnchor="middle" className={styles.diagramSideLabel}>
          BACK (Your view)
        </text>

        {DIAGRAM_REGIONS.map((region, idx) => {
          const obs = obsMap.get(region.id);
          const isSelected = selectedRegionId === region.id;

          let fill = "#c6d3c9"; // Neutral unpainted mannequin tone
          let stroke = "#a5b8aa";
          let strokeWidth = 1;

          if (obs) {
            fill = PAIN_COLORS[obs.painType];
            stroke = "#203b32";
            strokeWidth = 1.5;
          }

          if (isSelected) {
            stroke = "#203b32";
            strokeWidth = 2.5;
          }

          const opacity = obs ? Math.min(1, Math.max(0.55, obs.peakIntensity / 10)) : 0.85;

          return (
            <g key={`${region.id}-${region.side}-${idx}`}>
              <rect
                x={region.x}
                y={region.y}
                width={region.w}
                height={region.h}
                rx={region.rx ?? 4}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                fillOpacity={opacity}
                className={styles.diagramRegion}
                tabIndex={0}
                role="button"
                aria-label={`${region.name} (${region.side})${
                  obs ? `: ${obs.painType} (Peak ${obs.peakIntensity}/10)` : ": unpainted"
                }`}
                onClick={() => onSelectRegion?.(region.id)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectRegion?.(region.id);
                  }
                }}
              >
                <title>{`${region.name} (${region.side})${obs
                    ? ` — ${obs.painType.toUpperCase()} (Peak ${obs.peakIntensity}/10, ${(obs.mapCoverage * 100).toFixed(0)}% coverage)`
                    : " — No markings recorded"}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
