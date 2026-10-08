import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { catalogue } from "../shared/catalogue.js";
import { bake, bounds } from "../shared/model-library.js";
import { preciseFit, preciseBounds } from "../shared/precise-fit.js";
import { principalPlane } from "./geometry-pca.mjs";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
  records = {};
import { vertices, projectedHoles } from "./mesh-silhouette.mjs";
for (const asset of catalogue.filter((a) =>
  [
    "jw-set-heart",
    "jw-set-baguette",
    "jw-set-marquise",
    "jw-set-pear",
  ].includes(a.id),
)) {
  const bytes = await readFile(
      new URL(`../shared/${asset.url}`, import.meta.url),
    ),
    gltf = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    ),
    raw = bake(gltf.scene);
  const initial = asset.id.includes("baguette")
    ? [0, 0, Math.PI / 2]
    : [-Math.PI / 2, 0, 0];
  raw.rotation.set(...initial);
  raw.updateMatrixWorld(true);
  const plane = principalPlane(vertices(raw).points),
    alignment = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(...plane.normal),
      new THREE.Vector3(0, 1, 0),
    );
  const holder = new THREE.Group();
  holder.add(raw);
  holder.quaternion.copy(alignment);
  const model = preciseFit(holder, 1),
    box = preciseBounds(model),
    { points, triangles } = vertices(model),
    hole = projectedHoles(points, triangles, box)[0];
  if (!hole) throw Error("No closed setting opening: " + asset.id);
  // The seat is measured at the inside wall; tallest isolated prong tips are excluded.
  const adjacent = points
    .filter((p) =>
      hole.boundary.some(([x, z]) => Math.hypot(p.x - x, p.z - z) < 0.015),
    )
    .map((p) => p.y)
    .sort((a, b) => a - b);
  if (!adjacent.length) throw Error("No inside-wall vertices: " + asset.id);
  const seatY = adjacent[Math.floor(adjacent.length * 0.7)];
  records[asset.id] = {
    sourceHash: createHash("sha256").update(bytes).digest("hex"),
    initial,
    alignment: alignment.toArray(),
    normal: plane.normal,
    seatY,
    hole,
  };
  console.log(
    asset.id,
    JSON.stringify({
      normal: plane.normal,
      seatY,
      min: hole.min,
      max: hole.max,
      centre: hole.centre,
    }),
  );
}
await writeFile(
  "shared/setting-sockets.json",
  JSON.stringify(records, null, 2),
);
