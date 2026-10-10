import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { readFile, writeFile } from "node:fs/promises";
import { bake, bounds } from "../shared/model-library.js";
import { fitToScene } from "../shared/scene-utils.js";
import { containers } from "../shared/assembly-profiles.js";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
  result = {};
for (const [id, p] of Object.entries(containers)) {
  const bytes = await readFile(`shared/models/${id}.glb`),
    gltf = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  const model = fitToScene(bake(gltf.scene), p.width, "x"),
    b = bounds(model),
    ray = new THREE.Raycaster(),
    samples = [],
    x = p.width * p.centerX;
  model.traverse((n) => {
    if (n.isMesh) n.material.side = THREE.DoubleSide;
  });
  if (id.includes("cone") || id.includes("sleeve")) {
    result[id] = {
      referenceWidth: p.width,
      lip: b.max.y * 1.02,
      mouthRadius: p.width * p.mouth,
    };
    continue;
  }
  for (const direction of [-1, 1])
    for (let r = 0; r <= p.width * 0.6; r += p.width / 180) {
      if (id.includes("basket") && r < p.width * p.mouth * 0.6) continue;
      ray.set(
        new THREE.Vector3(x, b.max.y + 1, direction * r),
        new THREE.Vector3(0, -1, 0),
      );
      const hit = ray.intersectObject(model, true)[0];
      if (hit) samples.push({ radius: r, y: hit.point.y });
    }
  const rim = Math.max(...samples.map((p) => p.y)),
    lip = rim + 0.1,
    edge = samples.filter((p) => p.y > rim - 0.2),
    mouthRadius = Math.min(...edge.map((p) => p.radius));
  result[id] = { referenceWidth: p.width, lip, mouthRadius };
  console.log(id, "rim", lip, "opening", mouthRadius);
}
await writeFile(
  "shared/container-mouths.json",
  JSON.stringify(result, null, 2),
);
