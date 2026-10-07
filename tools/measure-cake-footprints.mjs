import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { readFile, writeFile } from "node:fs/promises";
import { bake, bounds, place } from "../shared/model-library.js";
import { fitToScene } from "../shared/scene-utils.js";
import { cakeParts } from "../shared/assembly-profiles.js";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
  rows = [];
for (const [id, p] of Object.entries(cakeParts)) {
  for (const pose of p.flatRotation ? ["upright", "flat"] : ["upright"]) {
    const rotation = pose === "flat" ? p.flatRotation : p.rotation;
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
    const bin = source.subarray(20 + source.readUInt32LE(12)),
      bytes = Buffer.alloc(20 + padded.length + bin.length);
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
    const model = bake(gltf.scene);
    if (rotation && !id.includes("wafer")) model.rotation.set(...rotation);
    const raw = bounds(model).getSize(new THREE.Vector3());
    const axis =
      raw.x >= raw.y && raw.x >= raw.z ? "x" : raw.y >= raw.z ? "y" : "z";
    const fitted = fitToScene(model, p.size, axis);
    if (id.includes("wafer")) {
      const d = bounds(fitted).getSize(new THREE.Vector3());
      fitted.scale.x *= 0.7 / d.x;
      fitted.scale.z *= 0.7 / d.z;
      fitted.rotation.set(...rotation);
    }
    place(fitted, 0, 0, 0);
    fitted.updateMatrixWorld(true);
    let radius = 0;
    fitted.traverse((n) => {
      if (!n.isMesh) return;
      const pos = n.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3()
          .fromBufferAttribute(pos, i)
          .applyMatrix4(n.matrixWorld);
        radius = Math.max(radius, Math.hypot(v.x, v.z));
      }
    });
    rows.push({
      id,
      pose,
      dimensions: bounds(fitted).getSize(new THREE.Vector3()).toArray(),
      projectedRadius: radius,
      footprint: pose === "flat" ? p.flatFootprint : p.footprint,
      required: Math.ceil(radius * 1.035 * 100) / 100,
    });
  }
}
await writeFile(
  "reports/revision-3/cake-footprints.json",
  JSON.stringify(rows, null, 2),
);
console.table(
  rows.map(({ id, projectedRadius, footprint, required }) => ({
    id,
    projectedRadius,
    footprint,
    required,
  })),
);
