import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { readFile, writeFile } from "node:fs/promises";
import { bake, bounds } from "../shared/model-library.js";
import { fitToScene } from "../shared/scene-utils.js";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const data = await readFile("shared/models/jw-set-pave-band.glb");
const gltf = await loader.parseAsync(
  data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  "",
);
const base = fitToScene(bake(gltf.scene), 5.8, "x");
base.updateMatrixWorld(true);
const b = bounds(base),
  size = b.getSize(new THREE.Vector3());
const W = 181,
  H = 49,
  depth = new Float64Array(W * H).fill(NaN),
  max = new Float64Array(W).fill(-Infinity),
  ray = new THREE.Raycaster();
base.traverse((n) => {
  if (n.isMesh) n.material.side = THREE.DoubleSide;
});
for (let x = 0; x < W; x++)
  for (let y = 0; y < H; y++) {
    const xx = b.min.x + (size.x * x) / (W - 1),
      yy = b.min.y + (size.y * y) / (H - 1);
    ray.set(
      new THREE.Vector3(xx, yy, b.max.z + 1),
      new THREE.Vector3(0, 0, -1),
    );
    const hit = ray.intersectObject(base, true)[0];
    if (hit) {
      depth[y * W + x] = hit.point.z;
      max[x] = Math.max(max[x], hit.point.z);
    }
  }
const mask = Array.from(
  depth,
  (v, i) => Number.isFinite(v) && max[i % W] - v > 0.055,
);
const seen = new Set(),
  groups = [];
for (let y = 2; y < H - 2; y++)
  for (let x = 2; x < W - 2; x++) {
    const index = y * W + x;
    if (!mask[index] || seen.has(index)) continue;
    const queue = [index],
      points = [];
    seen.add(index);
    while (queue.length) {
      const k = queue.pop(),
        xx = k % W,
        yy = Math.floor(k / W);
      points.push([xx, yy]);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = xx + dx,
          ny = yy + dy,
          j = ny * W + nx;
        if (
          nx < 1 ||
          nx >= W - 1 ||
          ny < 1 ||
          ny >= H - 1 ||
          seen.has(j) ||
          !mask[j]
        )
          continue;
        seen.add(j);
        queue.push(j);
      }
    }
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    if (
      points.length < 4 ||
      points.length > 170 ||
      Math.max(...xs) - Math.min(...xs) > 16 ||
      Math.max(...ys) - Math.min(...ys) > 18
    )
      continue;
    const cx = xs.reduce((a, b) => a + b) / xs.length,
      cy = ys.reduce((a, b) => a + b) / ys.length,
      xx = b.min.x + (size.x * cx) / (W - 1),
      yy = b.min.y + (size.y * cy) / (H - 1),
      zz = max[Math.round(cx)];
    const nx = -size.x / 2 + xx; // curved surface direction derived from local baseline slope
    const slope =
      (max[Math.min(W - 1, Math.round(cx) + 2)] -
        max[Math.max(0, Math.round(cx) - 2)]) /
      ((4 * size.x) / (W - 1));
    groups.push({
      x: xx,
      y: yy,
      z: zz - 0.018,
      diameter: Math.max(
        0.11,
        (((Math.max(...xs) - Math.min(...xs) + 1) * size.x) / (W - 1)) * 0.83,
      ),
      normal: new THREE.Vector3(-slope, 0, 1).normalize().toArray(),
      pixels: points.length,
    });
  }
await writeFile(
  "shared/pave-sockets.json",
  JSON.stringify(
    {
      referenceWidth: 5.8,
      bounds: { min: b.min.toArray(), max: b.max.toArray() },
      sockets: groups
        .filter(
          (p) =>
            p.pixels >= 20 && p.y > 0.1 && p.y < 0.74 && Math.abs(p.x) < 2.72,
        )
        .map((p) => ({ ...p, diameter: p.diameter * 1.18 })),
    },
    null,
    2,
  ),
);
console.log(groups.length, "pave sockets detected");
