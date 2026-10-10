import * as THREE from "three";
function signature(points) {
  const box = new THREE.Box2().setFromPoints(
      points.map((p) => new THREE.Vector2(...p)),
    ),
    center = box.getCenter(new THREE.Vector2()),
    size = box.getSize(new THREE.Vector2()),
    bins = Array(72).fill(null);
  for (const p of points) {
    const x = (p[0] - center.x) / size.x,
      z = (p[1] - center.y) / size.y,
      angle = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2),
      i = Math.floor((angle / (Math.PI * 2)) * bins.length);
    bins[i] = Math.max(bins[i] ?? 0, Math.hypot(x, z));
  }
  return bins.map((r, i) => {
    if (r !== null) return r;
    let a = 1,
      b = 1;
    while (bins[(i - a + 72) % 72] === null) a++;
    while (bins[(i + b) % 72] === null) b++;
    return (bins[(i - a + 72) % 72] * b + bins[(i + b) % 72] * a) / (a + b);
  });
}
export function openingRotation(points, holeBoundary) {
  const target = signature(holeBoundary);
  let best = { error: Infinity };
  for (let quarter = 0; quarter < 4; quarter++) {
    const angle = (quarter * Math.PI) / 2,
      c = Math.cos(angle),
      s = Math.sin(angle),
      rotated = points.map(([x, z]) => [c * x + s * z, -s * x + c * z]),
      shape = signature(rotated),
      error =
        shape.reduce((v, r, i) => v + (r - target[i]) ** 2, 0) / shape.length;
    if (error < best.error) best = { quarter, angle, error };
  }
  return best;
}
