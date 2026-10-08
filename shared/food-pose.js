import { cakeParts } from "./assembly-profiles.js";

// Calibrated to the supplied assets: strawberry calyx is local +Y. Laying the
// fruit on its flank gives it a real contact patch instead of balancing its tip.
export function foodPose(
  asset,
  index = 0,
  angle = 0,
  flat = false,
  support = "cake",
) {
  const profile = cakeParts[asset];
  const yaw = angle + Math.sin(index * 2.17) * 0.43;
  if (asset === "bk-berry-strawberry")
    return [
      1.22 + (index % 3) * 0.12,
      Math.PI + ((index % 3) - 1) * 0.72 + Math.sin(angle) * 0.18,
      (index % 2 ? 1 : -1) * 0.12,
    ];
  if (asset === "bk-berry-raspberry")
    return [
      support === "plate"
        ? 1.18 + (index % 3) * 0.08
        : index % 3 === 0
          ? 0.22
          : 0.9,
      yaw,
      0.12,
    ];
  if (asset === "bk-berry-blackberry") return [1.1, yaw, 0.1];
  if (asset === "bk-berry-blueberry") return [0.25 + index * 0.31, yaw, 0.22];
  if (asset === "bk-berry-cherry") return [0.32, yaw, index % 2 ? -0.22 : 0.22];
  if (flat && profile?.flatRotation) return [...profile.flatRotation];
  const r = profile?.rotation || [0, 0, 0];
  return [r[0], r[1] + yaw, r[2]];
}
