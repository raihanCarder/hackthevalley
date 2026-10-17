import type { CameraView, RegionId } from "../domain/contracts";

/** Patient-relative display names. "Your left" always means the patient's own left, regardless of camera. */
export const REGION_LABELS: Record<RegionId, string> = {
  head: "Head", neck: "Neck", "front-upper-torso": "Chest", "front-lower-torso": "Abdomen",
  "back-upper-torso": "Upper back", "back-lower-torso": "Lower back", pelvis: "Hips and pelvis",
  "left-upper-arm": "Your left upper arm", "right-upper-arm": "Your right upper arm",
  "left-forearm": "Your left forearm", "right-forearm": "Your right forearm",
  "left-hand": "Your left hand", "right-hand": "Your right hand",
  "left-thigh": "Your left thigh", "right-thigh": "Your right thigh",
  "left-calf": "Your left calf", "right-calf": "Your right calf",
  "left-foot": "Your left foot", "right-foot": "Your right foot",
};

export const viewLabel = (view: CameraView) => view === "left" || view === "right" ? `Your ${view}` : view[0].toUpperCase() + view.slice(1);
