import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { ModelLibrary, bake } from "../shared/model-library.js";
import { byId } from "../shared/catalogue.js";
import { buildCake } from "../shared/assemblers.js";
import { defaults, normalize } from "../shared/studio-state.js";
import { cakeParts } from "../shared/assembly-profiles.js";
import { preciseBounds } from "../shared/precise-fit.js";
import { disposeTree } from "../shared/scene-utils.js";

// Decode the runtime's textured GLB geometry in Node without image APIs.
// Vertex buffers, indices, transforms and UVs stay exactly as supplied.
class RuntimeGeometryLibrary extends ModelLibrary {
  async original(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const source = await readFile(new URL(`../shared/${byId[id].project === "jewelry" ? byId[id].url : `models/textured/${id}.glb`}`, import.meta.url));
    const length = source.readUInt32LE(12);
    const json = JSON.parse(source.subarray(20, 20 + length).toString("utf8"));
    delete json.images; delete json.textures; delete json.materials;
    for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
    const encoded = Buffer.from(JSON.stringify(json));
    const padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32); encoded.copy(padded);
    const binary = source.subarray(20 + length);
    const header = Buffer.from(source.subarray(0, 20));
    header.writeUInt32LE(20 + padded.length + binary.length, 8);
    header.writeUInt32LE(padded.length, 12);
    const bytes = Buffer.concat([header, padded, binary]);
    const gltf = await this.loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const root = bake(gltf.scene); disposeTree(gltf.scene); this.cache.set(id, root);
    return root;
  }
}

test("runtime textured raspberries lie on the hard plate with their real geometry inside the reserved footprint", async () => {
  const lib = new RuntimeGeometryLibrary(); let plateContacts = 0;
  try {
    for (const base of ["bk-pastry-cookie-heart", "bk-pastry-brownie-bite", "bk-pastry-eclair", "bk-pastry-donut"])
      for (const pieces of [1, 4]) {
        const state = normalize("cakes", { ...defaults("cakes"), pattern: null, base, pieces, decor: ["bk-berry-raspberry"], counts: { "bk-berry-raspberry": 4 }, topper: null });
        const root = await buildCake(lib, state, "#eee4ce"); root.updateMatrixWorld(true);
        const plateY = preciseBounds(root.children[0]).max.y;
        for (const item of root.children.filter(node => node.userData.asset === "bk-berry-raspberry")) {
          const box = preciseBounds(item), center = box.getCenter(new THREE.Vector3());
          if (box.min.y > plateY + .02) continue;
          plateContacts++;
          assert.ok(box.min.y >= plateY - .05, "the body must touch rather than sink into the hard plate");
          item.traverse(node => {
            if (!node.isMesh) return;
            const axis = new THREE.Vector3(0, 1, 0).transformDirection(node.matrixWorld);
            assert.ok(axis.y < .45, "pointed berry must rest on its flank on the plate");
            const positions = node.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
              const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
              assert.ok(Math.hypot(point.x - center.x, point.z - center.z) <= cakeParts["bk-berry-raspberry"].footprint + .02, "rotated textured berry exceeds its reserved seat");
            }
          });
        }
        disposeTree(root);
      }
    assert.ok(plateContacts >= 4, "test must exercise actual plate placements across native pastries");
  } finally { lib.dispose(); }
});
