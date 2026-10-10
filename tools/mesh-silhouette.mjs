import * as THREE from "three";
export function vertices(root) {
  const points = [],
    triangles = [];
  root.updateMatrixWorld(true);
  root.traverse((n) => {
    if (!n.isMesh) return;
    const p = n.geometry.attributes.position,
      offset = points.length;
    for (let i = 0; i < p.count; i++)
      points.push(
        new THREE.Vector3()
          .fromBufferAttribute(p, i)
          .applyMatrix4(n.matrixWorld),
      );
    const index = n.geometry.index;
    for (let i = 0; i < (index?.count ?? p.count); i += 3)
      triangles.push(
        [0, 1, 2].map((j) => offset + (index ? index.getX(i + j) : i + j)),
      );
  });
  return { points, triangles };
}
export function projectedHoles(points, triangles, box) {
  const W = 256,
    H = 256,
    min = box.min,
    size = box.getSize(new THREE.Vector3()),
    mask = new Uint8Array(W * H);
  const projected = points.map((p) => [
    ((p.x - min.x) / size.x) * (W - 2) + 1,
    ((p.z - min.z) / size.z) * (H - 2) + 1,
  ]);
  const cross = (a, b, p) =>
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  for (const t of triangles) {
    const [a, b, c] = t.map((i) => projected[i]),
      area = cross(a, b, c);
    if (Math.abs(area) < 1e-7) continue;
    for (
      let y = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
      y <= Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
        x <= Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
        x++
      ) {
        const p = [x + 0.5, y + 0.5];
        if (
          cross(a, b, p) * area >= 0 &&
          cross(b, c, p) * area >= 0 &&
          cross(c, a, p) * area >= 0
        )
          mask[y * W + x] = 1;
      }
  }
  const visited = new Uint8Array(mask.length),
    holes = [];
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    let sx = 0,
      sy = 0,
      edge = false;
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q],
        x = i % W,
        y = Math.floor(i / W);
      sx += x + 0.5;
      sy += y + 0.5;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      for (const n of [
        x > 0 ? i - 1 : -1,
        x < W - 1 ? i + 1 : -1,
        y > 0 ? i - W : -1,
        y < H - 1 ? i + W : -1,
      ])
        if (n >= 0 && !mask[n] && !visited[n]) {
          visited[n] = 1;
          queue.push(n);
        }
    }
    if (!edge && queue.length > 8) {
      const centre = new THREE.Vector3();
      centre.x = min.x + ((sx / queue.length - 1) / (W - 2)) * size.x;
      centre.z = min.z + ((sy / queue.length - 1) / (H - 2)) * size.z;
      const pixels = queue.map((i) => [i % W, Math.floor(i / W)]);
      const extent = (k) => [
        Math.min(...pixels.map((p) => p[k])),
        Math.max(...pixels.map((p) => p[k])),
      ];
      const ex = extent(0),
        ez = extent(1);
      const x = (px) => min.x + ((px + 0.5 - 1) / (W - 2)) * size.x,
        z = (px) => min.z + ((px + 0.5 - 1) / (H - 2)) * size.z;
      const boundary = queue
        .filter((i) => [i - 1, i + 1, i - W, i + W].some((n) => mask[n]))
        .filter((_, i) => i % 3 === 0)
        .map((i) => [x(i % W), z(Math.floor(i / W))]);
      holes.push({
        area: queue.length,
        centre: centre.toArray(),
        min: [x(ex[0]), z(ez[0])],
        max: [x(ex[1]), z(ez[1])],
        boundary,
      });
    }
  }
  return holes.sort((a, b) => b.area - a.area);
}
