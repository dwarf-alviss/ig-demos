import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { byId } from "../shared/catalogue.js";
import { bake } from "../shared/model-library.js";
import { preciseFit, preciseBounds } from "../shared/precise-fit.js";
import { vertices, projectedHoles } from "./mesh-silhouette.mjs";
import { principalPlane } from "./geometry-pca.mjs";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
  records = {};
for (const id of [
  "jw-base-pendant",
  "jw-base-drop-earring",
  "jw-base-cocktail",
  "jw-base-solitaire",
  "jw-set-halo",
  "jw-set-bezel",
  "jw-base-stud-earring",
]) {
  const bytes = await readFile(
      new URL("../shared/" + byId[id].url, import.meta.url),
    ),
    g = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  const baked = bake(g.scene),
    dimensions = preciseBounds(baked).getSize(new THREE.Vector3()),
    root = preciseFit(baked, dimensions.x / dimensions.y),
    raw = vertices(root),
    face = id.includes("pendant") || id.includes("drop") ? "z" : "y";
  const points = raw.points.map((p) =>
    face === "z" ? new THREE.Vector3(p.x, p.z, p.y) : p.clone(),
  );
  const triangles = raw.triangles.filter(
    (t) => face === "z" || t.every((i) => points[i].y > 0.92),
  );
  const box = new THREE.Box3().setFromPoints(points),
    holes = projectedHoles(points, triangles, box);
  console.log(
    id,
    JSON.stringify(holes.slice(0, 5).map(({ boundary, ...h }) => h)),
  );
  let selected =
    face === "z"
      ? id.includes("drop")
        ? holes.filter((h) => h.centre[2] < 0.23 && h.area > 1000).slice(0, 1)
        : holes.slice(0, 1)
      : holes
          .filter((h) => h.area > 200)
          .slice(0, id.includes("cocktail") ? 2 : 1);
  root.traverse((n) => {
    if (n.isMesh) n.material.side = THREE.DoubleSide;
  });
  let caliperSeat = null;
  if (!selected.length && face === "y") {
    caliperSeat = 0.96;
    const samples = [];
    for (let i = 0; i < 1440; i++) {
      const angle = (i / 1440) * Math.PI * 2;
      const ray = new THREE.Raycaster(
        new THREE.Vector3(0, caliperSeat, 0),
        new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
      );
      const hit = ray.intersectObject(root, true)[0];
      if (hit && hit.distance < 0.35)
        samples.push({ angle, radius: hit.distance });
    }
    if (samples.length < 20) throw Error("No upper cup/prong contacts " + id);
    const radius = Math.min(...samples.map((p) => p.radius));
    selected = [
      {
        area: null,
        centre: [0, 0, 0],
        min: [-radius, -radius],
        max: [radius, radius],
        boundary: Array.from({ length: 96 }, (_, i) => [
          Math.cos((i / 96) * Math.PI * 2) * radius,
          Math.sin((i / 96) * Math.PI * 2) * radius,
        ]),
        caliperSamples: samples.filter((_, i) => i % 8 === 0),
      },
    ];
  }
  if (!selected.length) throw Error("No integrated opening " + id);
  records[id] = {
    sourceHash: createHash("sha256").update(bytes).digest("hex"),
    face,
    sockets: selected.map((hole) => {
      const adjacent = points
        .filter(
          (p) =>
            (face === "z" || p.y > 0.92) &&
            hole.boundary.some(
              ([x, z]) => Math.hypot(p.x - x, p.z - z) < 0.008,
            ),
        )
        .map((p) => p.y)
        .sort((a, b) => a - b);
      if (!adjacent.length && caliperSeat === null)
        throw Error("No seat wall " + id);
      return {
        hole,
        seat: caliperSeat ?? adjacent[Math.floor(adjacent.length * 0.7)],
        measurement:
          caliperSeat === null
            ? "upper opening triangle silhouette"
            : "actual mesh calipers at upper cup/prong plane",
      };
    }),
  };
}
await writeFile(
  "shared/integrated-sockets.json",
  JSON.stringify(records, null, 2),
);
