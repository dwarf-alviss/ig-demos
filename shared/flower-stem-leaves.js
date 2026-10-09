import * as THREE from "three";
import { botanicalLeaf } from "./botanical-components.js";
import { stemPointAtHeight } from "./model-library.js";
// Leaves belong to the selected flower; leafless gerbera stalks stay leafless.
const profiles = {
  rose: [3.2, 0.95],
  "garden-rose": [3.2, 0.95],
  peony: [3.8, 1.25],
  lisianthus: [3.2, 1.1],
  tulip: [4.4, 0.85],
  lily: [4.2, 0.6],
  chrysanthemum: [3.1, 1.0],
  ranunculus: [2.8, 0.9],
};
export function attachBasketStemLeaves(
  root,
  stem,
  plant,
  { top, bottom, centerX, radius, phase = 0 },
) {
  const dimensions = profiles[plant.id];
  if (!dimensions || top - bottom < 1) return;
  for (let j = 0; j < 2; j++) {
    const y = bottom + (top - bottom) * (0.25 + j * 0.32),
      position = stemPointAtHeight(stem, y);
    const radial = Math.hypot(position.x - centerX, position.z);
    // Point into the arrangement, keeping the entire leaf within the basket mouth.
    const length = Math.min(dimensions[0], Math.max(0, radius - radial - 0.5));
    if (length < 1.2) continue;
    const leaf = botanicalLeaf(length, dimensions[1], phase + j);
    leaf.position.copy(position);
    const inward = Math.atan2(centerX - position.x, -position.z);
    leaf.rotation.set(
      -0.3,
      inward + Math.sin(phase * 2.4 + j) * 0.28,
      0,
      "YXZ",
    );
    leaf.userData.component = "basket-flower-stem-leaf";
    leaf.userData.plant = plant.id;
    root.add(leaf);
  }
}
