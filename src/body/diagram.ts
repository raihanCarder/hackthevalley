import type { RegionId } from "../domain/contracts";
import { BODY_DIAGRAM } from "./diagram-data";

/**
 * 2D body diagram traced from the 3D body's own mesh and region labels (`npm run body:generate`), so the history
 * diagram and the 3D model always show the same regions. Coordinates are SVG pixels within each view.
 */
export interface DiagramRegion { regionId: RegionId; d: string }
export interface DiagramView {
  id: string;
  label: string;
  /** Orientation hint shown with the view, e.g. which side is the patient's left. */
  note?: string;
  width: number;
  height: number;
  /** Silhouette of everything visible in the view. */
  outline: string;
  regions: DiagramRegion[];
}
export interface BodyDiagramData { bodyMapVersion: string; views: DiagramView[] }

export function getBodyDiagram(): BodyDiagramData { return BODY_DIAGRAM; }
