import * as THREE from "three";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildComposedBouquet } from "../shared/composed-bouquet.js";
import { normalize } from "../shared/studio-state.js";
import { bouquets } from "../shared/domain.js";
import { ModelLibrary, bake } from "../shared/model-library.js";
import { byId } from "../shared/catalogue.js";
import { buildFlowers } from "../shared/assemblers.js";
import { disposeTree } from "../shared/scene-utils.js";
class Library extends ModelLibrary {
  async original(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const source = await readFile(
      new URL(`../shared/models/textured/${id}.glb`, import.meta.url),
    );
    const length = source.readUInt32LE(12),
      json = JSON.parse(source.subarray(20, 20 + length).toString());
    delete json.images;
    delete json.textures;
    delete json.materials;
    for (const mesh of json.meshes)
      for (const primitive of mesh.primitives) delete primitive.material;
    const encoded = Buffer.from(JSON.stringify(json)),
      padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32);
    encoded.copy(padded);
    const binary = source.subarray(20 + length),
      header = Buffer.from(source.subarray(0, 20));
    header.writeUInt32LE(20 + padded.length + binary.length, 8);
    header.writeUInt32LE(padded.length, 12);
    const bytes = Buffer.concat([header, padded, binary]);
    const g = await this.loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    const root = bake(g.scene);
    disposeTree(g.scene);
    this.cache.set(id, root);
    return root;
  }
}
function triangles(root) {
  const out = [];
  root.updateMatrixWorld(true);
  root.traverse((n) => {
    if (!n.isMesh) return;
    const p = n.geometry.attributes.position,
      idx = n.geometry.index;
    for (let i = 0; i < (idx?.count ?? p.count); i += 3)
      out.push(
        [0, 1, 2].map((j) =>
          new THREE.Vector3()
            .fromBufferAttribute(p, idx ? idx.getX(i + j) : i + j)
            .applyMatrix4(n.matrixWorld),
        ),
      );
  });
  return out;
}
const cell = 1.5,
  key = (x, y, z) => `${x},${y},${z}`;
function cells(t) {
  const box = new THREE.Box3().setFromPoints(t),
    out = [];
  for (
    let x = Math.floor(box.min.x / cell);
    x <= Math.floor(box.max.x / cell);
    x++
  )
    for (
      let y = Math.floor(box.min.y / cell);
      y <= Math.floor(box.max.y / cell);
      y++
    )
      for (
        let z = Math.floor(box.min.z / cell);
        z <= Math.floor(box.max.z / cell);
        z++
      )
        out.push(key(x, y, z));
  return out;
}
const ray = new THREE.Ray(),
  target = new THREE.Vector3();
function edgesHit(a, b) {
  for (let i = 0; i < 3; i++) {
    const from = a[i],
      to = a[(i + 1) % 3],
      delta = to.clone().sub(from),
      length = delta.length();
    if (length < 1e-8) continue;
    ray.set(from, delta.divideScalar(length));
    const hit = ray.intersectTriangle(...b, false, target);
    if (hit) {
      const d = hit.distanceTo(from);
      if (d > 1e-5 && d < length - 1e-5) return true;
    }
  }
  return false;
}
const bundle = createHash("sha256")
  .update(await readFile("shared/studio.bundle.js"))
  .digest("hex");
const lib = new Library(),
  results = [];
const domain = process.argv.includes("--domain");
const cases = domain
  ? Object.values(bouquets)
      .filter((p) => p.form === "basket")
      .flatMap((p) =>
        [11, 19, 29].map((bouquetSize) => ({
          id: p.id,
          state: normalize("flowers", {
            version: 2,
            pattern: p.id,
            bouquetSize,
            palette: 4,
          }),
        })),
      )
  : Object.keys(byId)
      .filter((id) => id.startsWith("fl-flower-"))
      .map((id) => ({
        id,
        state: {
          pack: "fl-wrap-basket-rattan",
          flowers: [id],
          counts: { [id]: 7 },
          green: [],
          ribbon: null,
          palette: 4,
        },
      }));
try {
  for (const { id, state } of cases) {
    const root = domain
      ? await buildComposedBouquet(lib, state)
      : await buildFlowers(lib, state, "#d9a6b4");
    const assembly = root.userData.assembly || root.userData;
    const lip = assembly.lip ?? assembly.mouthLip,
      grid = new Map(),
      handle = triangles(root.children[0]).filter(
        (t) => Math.max(...t.map((p) => p.y)) > lip + 0.3,
      );
    for (const t of handle)
      for (const k of cells(t)) {
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(t);
      }
    let hits = 0,
      headHits = [];
    for (const head of root.children.filter((n) =>
      domain
        ? n.isGroup &&
          n.children.some((c) => c.userData.asset?.startsWith("fl-flower-"))
        : n.userData.asset === id,
    )) {
      let n = 0;
      for (const t of triangles(head)) {
        const candidates = new Set(cells(t).flatMap((k) => grid.get(k) || []));
        for (const h of candidates)
          if (edgesHit(t, h) || edgesHit(h, t)) {
            n++;
            break;
          }
      }
      hits += n;
      headHits.push(n);
    }
    if (headHits.length !== assembly.crown.length)
      throw new Error(
        "Missing actual heads in diagnostic: " +
          id +
          " " +
          headHits.length +
          "/" +
          assembly.crown.length,
      );
    results.push({
      id,
      state,
      handleTriangles: handle.length,
      intersectingFlowerTriangles: hits,
      headHits,
    });
    console.log(id, hits);
    disposeTree(root);
  }
} finally {
  lib.dispose();
}
await writeFile(
  "reports/revision-5/basket-handle-" +
    (domain ? "domain" : "current") +
    "-diagnostic.json",
  JSON.stringify(
    {
      bundle,
      method:
        "Real runtime textured GLB triangle edges versus actual basket geometry above measured lip; both segment directions; no AABB-only acceptance.",
      results,
    },
    null,
    2,
  ),
);
