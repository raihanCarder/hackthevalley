import type { CameraView, RegionId } from "../domain/contracts";
import type { FocusTarget } from "./mannequin";

/** Patient-relative display names. "Your left" always means the patient's own left, regardless of camera. */
export const REGION_LABELS: Record<RegionId, string> = {
  head: "Head and face", neck: "Neck", "front-upper-torso": "Chest", "front-lower-torso": "Abdomen",
  "back-upper-torso": "Upper back", "back-lower-torso": "Lower back", pelvis: "Hips and pelvis",
  "left-upper-arm": "Your left upper arm", "right-upper-arm": "Your right upper arm",
  "left-forearm": "Your left forearm", "right-forearm": "Your right forearm",
  "left-hand": "Your left hand", "right-hand": "Your right hand",
  "left-thigh": "Your left thigh", "right-thigh": "Your right thigh",
  "left-calf": "Your left calf", "right-calf": "Your right calf",
  "left-foot": "Your left foot", "right-foot": "Your right foot",
  "left-eye": "Your left eye", "right-eye": "Your right eye", nose: "Nose", mouth: "Mouth and lips",
  "left-ear": "Your left ear", "right-ear": "Your right ear",
  "left-thumb": "Your left thumb", "right-thumb": "Your right thumb",
  "left-index-finger": "Your left index finger", "right-index-finger": "Your right index finger",
  "left-middle-finger": "Your left middle finger", "right-middle-finger": "Your right middle finger",
  "left-ring-finger": "Your left ring finger", "right-ring-finger": "Your right ring finger",
  "left-little-finger": "Your left little finger", "right-little-finger": "Your right little finger",
  "left-big-toe": "Your left big toe", "right-big-toe": "Your right big toe",
  "left-second-toe": "Your left second toe", "right-second-toe": "Your right second toe",
  "left-third-toe": "Your left third toe", "right-third-toe": "Your right third toe",
  "left-fourth-toe": "Your left fourth toe", "right-fourth-toe": "Your right fourth toe",
  "left-little-toe": "Your left little toe", "right-little-toe": "Your right little toe",
};

export const viewLabel = (view: CameraView) => view === "left" || view === "right" ? `Your ${view}` : view[0].toUpperCase() + view.slice(1);
export const FOCUS_LABELS: Record<FocusTarget, string> = {
  face: "Face", "left-hand": "Your left hand", "right-hand": "Your right hand", "left-foot": "Your left foot", "right-foot": "Your right foot",
};
