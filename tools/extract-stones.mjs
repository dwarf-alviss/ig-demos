import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import * as THREE from "three";
import { writeFile, mkdir } from "node:fs/promises";
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
await mkdir("shared/models/stones", { recursive: true });
const records = [];
for (const [pack, file] of [
  ["diamond", "diamond_gem_shape_set_-_1_collectibles.glb"],
  ["gem", "gemstone_pack.glb"],
]) {
  const source = await io.read("C:/webcum/3d-models/готово/jw-stone/" + file);
  let i = 0;
  for (const node of source.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || node.getName().startsWith("Text")) continue;
    const doc = new Document(),
      buf = doc.createBuffer();
    const outMesh = doc.createMesh();
    let triangles = 0;
    const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix());
    for (const prim of mesh.listPrimitives()) {
      const p = doc.createPrimitive().setMode(prim.getMode());
      for (const semantic of ["POSITION", "NORMAL"]) {
        const attr = prim.getAttribute(semantic);
        if (!attr) continue;
        const array = new Float32Array(attr.getArray());
        const ba = new THREE.BufferAttribute(array, 3);
        if (semantic === "POSITION") ba.applyMatrix4(matrix);
        else ba.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(matrix));
        p.setAttribute(
          semantic,
          doc.createAccessor().setType("VEC3").setArray(array).setBuffer(buf),
        );
      }
      if (prim.getIndices())
        p.setIndices(
          doc
            .createAccessor()
            .setType("SCALAR")
            .setArray(new Uint16Array(prim.getIndices().getArray()))
            .setBuffer(buf),
        );
      triangles +=
        (p.getIndices()?.getCount() || p.getAttribute("POSITION").getCount()) /
        3;
      outMesh.addPrimitive(p);
    }
    const newNode = doc.createNode().setMesh(outMesh);
    doc.createScene().addChild(newNode);
    const id = `jw-stone-${pack}-${String(++i).padStart(2, "0")}`;
    await doc.transform(
      prune(),
      meshopt({ encoder: MeshoptEncoder, level: "high" }),
    );
    await io.write(`shared/models/stones/${id}.glb`, doc);
    records.push({
      id,
      url: `models/stones/${id}.glb`,
      pack,
      index: i,
      sourceFile: file,
      sourceNode: node.getName(),
      sourceMaterial: mesh.listPrimitives()[0].getMaterial()?.getName(),
      triangles,
    });
  }
}
await writeFile(
  "shared/models/stones/catalog.json",
  JSON.stringify(records, null, 2),
);
console.log(
  "Extracted",
  records.length,
  "individual stones without collection labels",
);
