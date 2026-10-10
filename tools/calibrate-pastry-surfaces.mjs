import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { readFile, writeFile } from "node:fs/promises";
import { bake, bounds } from "../shared/model-library.js";
import { fitToScene } from "../shared/scene-utils.js";
import { pastryDimensions } from "../shared/assembly-profiles.js";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
  result = {},
  resolution = 81;
for (const [id, size] of Object.entries(pastryDimensions)) {
  const source = await readFile(`shared/models/textured/${id}.glb`);
  const json = JSON.parse(
    source.subarray(20, 20 + source.readUInt32LE(12)).toString(),
  );
  delete json.images;
  delete json.textures;
  delete json.materials;
  for (const mesh of json.meshes)
    for (const primitive of mesh.primitives) delete primitive.material;
  const encoded = Buffer.from(JSON.stringify(json)),
    padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32);
  encoded.copy(padded);
  const bin = source.subarray(20 + source.readUInt32LE(12));
  const bytes = Buffer.alloc(20 + padded.length + bin.length);
  source.copy(bytes, 0, 0, 12);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(padded.length, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(bytes, 20);
  bin.copy(bytes, 20 + padded.length);
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const raw = bake(gltf.scene);
  if (id.includes("cookie") || id.includes("donut"))
    raw.rotation.x = -Math.PI / 2;
  if (id.includes("eclair")) raw.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  const d = bounds(raw).getSize(new THREE.Vector3()),
    axis = d.x >= d.y && d.x >= d.z ? "x" : d.y >= d.z ? "y" : "z";
  const model = fitToScene(raw, size, axis),
    box = bounds(model),
    ray = new THREE.Raycaster(),
    samples = [];
  model.traverse((n) => {
    if (n.isMesh) n.material.side = THREE.DoubleSide;
  });
  for (let z = 0; z < resolution; z++)
    for (let x = 0; x < resolution; x++) {
      ray.set(
        new THREE.Vector3(
          box.min.x + ((box.max.x - box.min.x) * x) / (resolution - 1),
          box.max.y + 1,
          box.min.z + ((box.max.z - box.min.z) * z) / (resolution - 1),
        ),
        new THREE.Vector3(0, -1, 0),
      );
      const hit = ray.intersectObject(model, true)[0];
      samples.push(hit ? Math.round(hit.point.y * 1000) / 1000 : null);
    }
  result[id] = {
    resolution,
    minX: box.min.x,
    maxX: box.max.x,
    minZ: box.min.z,
    maxZ: box.max.z,
    samples,
  };
  console.log(id, "surface sampled");
}
await writeFile("shared/pastry-surfaces.json", JSON.stringify(result));
