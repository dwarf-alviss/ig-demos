import * as THREE from "three";
import { bounds, physical, stem } from "./model-library.js";
import { byId } from "./catalogue.js";
import { disposeTree } from "./scene-utils.js";
export function convexHull(points) {
  const sorted = [
    ...new Map(points.map((p) => [p.join(","), p])).values(),
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [],
    upper = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0)
      lower.pop();
    lower.push(p);
  }
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0)
      upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
export async function fittedCast(lib, id, socket, color, type) {
  const prototype = await lib.get(id, {
    size: socket.width,
    axis: "x",
    role: "gem",
    rotation: (byId[id].face || "y") === "z" ? [-Math.PI / 2, 0, 0] : null,
  });
  const box = bounds(prototype),
    center = box.getCenter(new THREE.Vector3()),
    points = [];
  prototype.traverse((n) => {
    if (!n.isMesh) return;
    const a = n.geometry.getAttribute("position");
    for (let i = 0; i < a.count; i++) {
      const p = new THREE.Vector3()
        .fromBufferAttribute(a, i)
        .applyMatrix4(n.matrixWorld);
      points.push([p.x - center.x, p.z - center.z]);
    }
  });
  const outline = convexHull(points),
    shape = new THREE.Shape(),
    inner = new THREE.Path();
  outline.forEach((p, i) =>
    shape[i ? "lineTo" : "moveTo"](p[0] * 1.07, -p[1] * 1.07),
  );
  shape.closePath();
  [...outline]
    .reverse()
    .forEach((p, i) => inner[i ? "lineTo" : "moveTo"](p[0] * 0.9, -p[1] * 0.9));
  inner.closePath();
  shape.holes.push(inner);
  const rim = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: type === "custom-bezel" ? (box.max.y - box.min.y) * 0.6 : 0.09,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.012,
      bevelThickness: 0.012,
    }),
    physical(color, "metal"),
  );
  rim.geometry.rotateX(-Math.PI / 2);
  rim.position.y = 0.24;
  const root = new THREE.Group();
  root.add(rim);
  const count = type === "custom-trillion" ? 3 : 4;
  if (type !== "custom-bezel")
    for (let i = 0; i < count; i++) {
      const angle =
        count === 3
          ? (i * Math.PI * 2) / 3 - Math.PI / 2
          : (i * Math.PI) / 2 + Math.PI / 4;
      const p = outline.reduce(
        (best, p) =>
          p[0] * Math.cos(angle) + p[1] * Math.sin(angle) >
          best[0] * Math.cos(angle) + best[1] * Math.sin(angle)
            ? p
            : best,
        outline[0],
      );
      const bar = stem(
        new THREE.Vector3(p[0] * 0.72, 0, p[1] * 0.72),
        new THREE.Vector3(p[0] * 1.02, 0.43, p[1] * 1.02),
        0.024,
      );
      bar.material = physical(color, "metal");
      root.add(bar);
    }
  disposeTree(prototype);
  root.userData.outline = outline;
  return root;
}
