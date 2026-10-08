import * as THREE from "three";
import { readFile } from "node:fs/promises";
import { ModelLibrary, bake } from "../../shared/model-library.js";
import { disposeTree } from "../../shared/scene-utils.js";
export class Library extends ModelLibrary {
  async original(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const source = await readFile(
      new URL(`../../shared/models/textured/${id}.glb`, import.meta.url),
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
