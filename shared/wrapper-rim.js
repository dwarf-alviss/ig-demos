import * as THREE from "three";

// Paper rims are not horizontal. A maximum-height plane leaves the whole crown
// suspended above the tallest rear fold, exposing an artificial tree of stems.
export function paperRim(wrapper, centerX, width) {
  const bins = Array.from({ length: 32 }, () => []);
  wrapper.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrapper),
    height = box.max.y;
  wrapper.traverse((n) => {
    if (!n.isMesh) return;
    const a = n.geometry.attributes.position,
      p = new THREE.Vector3();
    for (let i = 0; i < a.count; i++) {
      p.fromBufferAttribute(a, i).applyMatrix4(n.matrixWorld);
      if (p.y < height * 0.55 || Math.hypot(p.x - centerX, p.z) < width * 0.18)
        continue;
      const angle =
        (Math.atan2(p.z, p.x - centerX) + Math.PI * 2) % (Math.PI * 2);
      bins[Math.floor((angle / Math.PI / 2) * 32)].push(p.y);
    }
  });
  // Rasterize the actual upper paper surface. A petal beyond the paper's
  // footprint must not be raised to an imaginary infinite wall.
  const resolution = 128,
    extent = box.getSize(new THREE.Vector3());
  const surface = new Float32Array(resolution * resolution).fill(-Infinity);
  const project = (p) => [
    ((p.x - box.min.x) / extent.x) * (resolution - 1),
    ((p.z - box.min.z) / extent.z) * (resolution - 1),
    p.y,
  ];
  wrapper.traverse((n) => {
    if (!n.isMesh) return;
    const a = n.geometry.attributes.position,
      index = n.geometry.index;
    const vertices = Array.from({ length: a.count }, (_, i) =>
      project(
        new THREE.Vector3()
          .fromBufferAttribute(a, i)
          .applyMatrix4(n.matrixWorld),
      ),
    );
    for (let i = 0; i < (index?.count ?? a.count); i += 3) {
      const [a, b, c] = [0, 1, 2].map(
        (j) => vertices[index ? index.getX(i + j) : i + j],
      );
      if (Math.max(a[2], b[2], c[2]) < height * 0.55) continue;
      const denominator =
        (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(denominator) < 1e-8) continue;
      for (
        let z = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
        z <= Math.min(resolution - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
        z++
      )
        for (
          let x = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
          x <= Math.min(resolution - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
          x++
        ) {
          const u =
            ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) /
            denominator;
          const v =
              ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) /
              denominator,
            w = 1 - u - v;
          if (Math.min(u, v, w) < -1e-6) continue;
          surface[z * resolution + x] = Math.max(
            surface[z * resolution + x],
            u * a[2] + v * b[2] + w * c[2],
          );
        }
    }
  });
  const values = bins.map((a) => (a.length ? Math.max(...a) : height));
  const mean = values.reduce((n, v) => n + v, 0) / values.length;
  return {
    mean,
    values,
    surfaceAt(x, z) {
      const ix = Math.round(((x - box.min.x) / extent.x) * (resolution - 1)),
        iz = Math.round(((z - box.min.z) / extent.z) * (resolution - 1));
      if (ix < 0 || iz < 0 || ix >= resolution || iz >= resolution) return null;
      const y = surface[iz * resolution + ix];
      return Number.isFinite(y) ? y : null;
    },
    at(x, z) {
      const angle = (Math.atan2(z, x - centerX) + Math.PI * 2) % (Math.PI * 2),
        f = (angle / Math.PI / 2) * 32;
      return THREE.MathUtils.lerp(
        values[Math.floor(f) % 32],
        values[(Math.floor(f) + 1) % 32],
        f % 1,
      );
    },
  };
}

// Only the bloom's peripheral geometry must clear the paper wall. Its narrow
// calyx and stem may remain inside the sleeve below the opening.
export function clearPaperEdge(head, rim, centerX, mouthRadius) {
  if (!rim) return 0;
  head.updateMatrixWorld(true);
  let lift = 0;
  const p = new THREE.Vector3();
  head.traverse((n) => {
    if (!n.isMesh) return;
    const positions = n.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i).applyMatrix4(n.matrixWorld);
      if (Math.hypot(p.x - centerX, p.z) < mouthRadius * 0.95) continue;
      const wall = rim.surfaceAt ? rim.surfaceAt(p.x, p.z) : rim.at(p.x, p.z);
      if (wall !== null) lift = Math.max(lift, wall + 0.12 - p.y);
    }
  });
  if (lift > 0) {
    head.position.y += lift;
    head.updateMatrixWorld(true);
  }
  return lift;
}
