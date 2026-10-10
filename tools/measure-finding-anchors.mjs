import * as THREE from "three";
import { createHash } from "node:crypto";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { readFile, writeFile } from "node:fs/promises";
import { bake, bounds } from "../shared/model-library.js";
import { fitToScene } from "../shared/scene-utils.js";
import { catalogue } from "../shared/catalogue.js";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
  records = [],
  measuredModels = new Map();
function projectedHoles(points, triangles, box, axis) {
  const W = 256,
    H = 256,
    min = box.min,
    size = box.getSize(new THREE.Vector3()),
    mask = new Uint8Array(W * H);
  const projected = points.map((p) => [
    ((p[axis] - min[axis]) / size[axis]) * (W - 2) + 1,
    ((p.y - min.y) / size.y) * (H - 2) + 1,
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
      centre[axis] =
        min[axis] + ((sx / queue.length - 1) / (W - 2)) * size[axis];
      centre.y = min.y + ((sy / queue.length - 1) / (H - 2)) * size.y;
      let minX = W,
        maxX = 0,
        minY = H,
        maxY = 0;
      for (const pixel of queue) {
        const x = pixel % W,
          y = Math.floor(pixel / W);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      holes.push({
        area: queue.length,
        centre: centre.toArray(),
        diameter: [
          ((maxX - minX + 1) / (W - 2)) * size[axis],
          ((maxY - minY + 1) / (H - 2)) * size.y,
        ],
      });
    }
  }
  return holes.sort((a, b) => b.centre[1] - a.centre[1]);
}
for (const asset of catalogue.filter(
  (a) => a.project === "jewelry" && ["finding", "base"].includes(a.category),
)) {
  const bytes = await readFile(
    new URL(`../shared/${asset.url}`, import.meta.url),
  );
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const model = fitToScene(bake(gltf.scene), 1, "y"),
    box = bounds(model),
    points = [],
    triangles = [];
  model.traverse((n) => {
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
  measuredModels.set(asset.id, model);
  const parent = points.map((_, i) => i),
    welded = new Map();
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const unite = (a, b) => {
    parent[find(b)] = find(a);
  };
  points.forEach((p, i) => {
    const key = p
      .toArray()
      .map((v) => Math.round(v * 100000))
      .join(":");
    if (welded.has(key)) unite(i, welded.get(key));
    else welded.set(key, i);
  });
  for (const [a, b, c] of triangles) {
    unite(a, b);
    unite(a, c);
  }
  const groups = new Map();
  points.forEach((p, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(p);
  });
  const components = [...groups.values()]
    .filter((p) => p.length > 20)
    .map((p) => {
      const b = new THREE.Box3().setFromPoints(p);
      return {
        vertices: p.length,
        min: b.min.toArray(),
        max: b.max.toArray(),
        center: b.getCenter(new THREE.Vector3()).toArray(),
        size: b.getSize(new THREE.Vector3()).toArray(),
      };
    })
    .sort((a, b) => b.vertices - a.vertices);
  const holes = {
    front: projectedHoles(points, triangles, box, "x"),
    side: projectedHoles(points, triangles, box, "z"),
  };
  const record = {
    id: asset.id,
    sourceHash: createHash("sha256").update(bytes).digest("hex"),
    size: box.getSize(new THREE.Vector3()).toArray(),
    holes,
    components,
  };
  records.push(record);
  if (
    asset.category === "finding" ||
    asset.id.includes("pendant") ||
    asset.id.includes("drop")
  )
    console.log(asset.id, JSON.stringify(holes));
}
await writeFile(
  "reports/revision-5/finding-components.json",
  JSON.stringify(records, null, 2),
);

// These selectors identify the actual connector eye rather than decorative holes.
const selections = {
  "jw-base-drop-earring": { eye: ["front", 0] },
  "jw-base-pendant": { eye: ["front", 0], chainEye: ["side", 0] },
  "jw-part-bail-hinged": { eye: ["front", 0] },
  "jw-part-charm-tag": { eye: ["front", 0] },
  "jw-part-clasp-lobster": { eye: ["front", 2] },
  "jw-part-ear-wire-french": { eye: ["front", 0] },
};
const assets = {},
  provenance = {};
for (const [id, selectors] of Object.entries(selections)) {
  const record = records.find((r) => r.id === id);
  assets[id] = {};
  for (const [name, [view, index]] of Object.entries(selectors)) {
    const hole = record.holes[view][index];
    if (!hole) throw Error(`Missing ${id} ${name}`);
    assets[id][name] = hole.centre;
  }
  provenance[id] = { sourceHash: record.sourceHash, selectors };
}
await writeFile(
  "shared/jewelry-anchors.json",
  JSON.stringify(
    {
      basis:
        "centres of holes in the supplied mesh silhouette; height normalized to 1; 256 x 256 sampling",
      assets,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  "reports/revision-5/finding-anchor-provenance.json",
  JSON.stringify(provenance, null, 2),
);

const ringIds = [
    "jw-base-band-plain",
    "jw-base-cocktail",
    "jw-base-signet",
    "jw-base-solitaire",
    "jw-base-stacking-thin",
    "jw-set-bezel",
    "jw-set-halo",
  ],
  rings = {};
for (const id of ringIds) {
  const r = records.find((r) => r.id === id),
    view = id === "jw-base-band-plain" ? "side" : "front",
    hole = r.holes[view].slice().sort((a, b) => b.area - a.area)[0],
    axis = view === "side" ? 2 : 0;
  if (!hole) throw Error("No finger cavity: " + id);
  const model = measuredModels.get(id);
  model.traverse((n) => {
    if (n.isMesh) n.material.side = THREE.DoubleSide;
  });
  const origin = new THREE.Vector3(...hole.centre);
  const distances = [-1, 1].map(
    (sign) =>
      new THREE.Raycaster(
        origin,
        new THREE.Vector3(axis === 0 ? sign : 0, 0, axis === 2 ? sign : 0),
      ).intersectObject(model, true)[0]?.distance,
  );
  if (!distances.every(Number.isFinite))
    throw Error("Open finger cavity: " + id);
  const diameter = distances[0] + distances[1];
  rings[id] = {
    sourceHash: r.sourceHash,
    view,
    center: hole.centre,
    innerDiameterPerWidth: diameter / r.size[axis],
    measurement:
      "opposing mesh intersections through the finger cavity centre; silhouette locates the cavity only",
  };
}
await writeFile(
  "shared/native-ring-sizes.json",
  JSON.stringify(rings, null, 2),
);
