import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { byId } from "../shared/catalogue.js";
import { bake } from "../shared/model-library.js";
import { preciseFit, preciseBounds } from "../shared/precise-fit.js";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
  records = {};
for (const id of ["jw-set-prong4", "jw-set-prong6"]) {
  const bytes = await readFile(
    new URL(`../shared/${byId[id].url}`, import.meta.url),
  );
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const root = preciseFit(bake(gltf.scene), 1),
    box = preciseBounds(root),
    points = [];
  root.traverse((n) => {
    if (!n.isMesh) return;
    const a = n.geometry.attributes.position;
    for (let i = 0; i < a.count; i++)
      points.push(
        new THREE.Vector3()
          .fromBufferAttribute(a, i)
          .applyMatrix4(n.matrixWorld),
      );
  });
  const top = points
    .filter((p) => p.y > box.max.y * 0.96)
    .map((p) => ({
      p,
      angle: (Math.atan2(p.z, p.x) + Math.PI * 2) % (Math.PI * 2),
    }))
    .sort((a, b) => a.angle - b.angle);
  const gaps = top
    .map((p, i) => ({
      index: i,
      gap:
        (top[(i + 1) % top.length].angle - p.angle + Math.PI * 2) %
        (Math.PI * 2),
    }))
    .filter((g) => g.gap > 0.25);
  const caps = gaps.map((g, i) => {
    const start = (g.index + 1) % top.length,
      end = gaps[(i + 1) % gaps.length].index,
      cloud = [];
    for (let k = start; ; k = (k + 1) % top.length) {
      cloud.push(top[k].p);
      if (k === end) break;
    }
    const b = new THREE.Box3().setFromPoints(cloud);
    return {
      center: b.getCenter(new THREE.Vector3()).toArray(),
      width: b.getSize(new THREE.Vector3()).x,
      depth: b.getSize(new THREE.Vector3()).z,
    };
  });
  if (caps.length !== Number(id.at(-1)))
    throw Error(`${id}: expected caps, found ${caps.length}`);
  records[id] = {
    sourceHash: createHash("sha256").update(bytes).digest("hex"),
    height: box.max.y,
    caps,
  };
  console.log(id, JSON.stringify(records[id]));
}
await writeFile("shared/prong-sockets.json", JSON.stringify(records, null, 2));
