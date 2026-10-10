import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  weld,
  simplify,
  prune,
  dedup,
  meshopt,
  textureCompress,
  compactPrimitive,
} from "@gltf-transform/functions";
import {
  MeshoptDecoder,
  MeshoptEncoder,
  MeshoptSimplifier,
} from "meshoptimizer";
import sharp from "sharp";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { catalogue } from "../shared/catalogue.js";
await Promise.all([
  MeshoptDecoder.ready,
  MeshoptEncoder.ready,
  MeshoptSimplifier.ready,
]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });
const folder = "shared/models/textured";
await mkdir(folder, { recursive: true });
await mkdir("reports/revision-3", { recursive: true });
let report = [];
try {
  report = JSON.parse(
    await readFile("reports/revision-3/textures.json", "utf8"),
  );
} catch {}
const only = process.argv[2],
  sourceRoot = process.argv[3] || "C:/webcum/3d-models/готово";
for (const a of catalogue.filter(
  (a) => a.project !== "jewelry" && (!only || a.id === only),
)) {
  const output = `${folder}/${a.id}.glb`;
  if (!only)
    try {
      await stat(output);
      continue;
    } catch {}
  const input = `${sourceRoot}/${a.source}/текстура.glb`;
  const doc = await io.read(input);
  const triangleCount = () =>
    doc
      .getRoot()
      .listMeshes()
      .reduce(
        (s, m) =>
          s +
          m
            .listPrimitives()
            .reduce(
              (n, p) =>
                n +
                (p.getIndices()?.getCount() ||
                  p.getAttribute("POSITION").getCount()) /
                  3,
              0,
            ),
        0,
      );
  const before = triangleCount();
  await doc.transform(
    dedup(),
    weld(),
    simplify({
      simplifier: MeshoptSimplifier,
      ratio: Math.min(1, 32000 / before),
      error: 0.001,
    }),
  );
  if (triangleCount() > 40000)
    await doc.transform(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: 32000 / triangleCount(),
        error: 0.01,
      }),
    );
  if (triangleCount() > 40000)
    await doc.transform(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: 32000 / triangleCount(),
        error: 0.03,
      }),
    );
  if (triangleCount() > 40000)
    for (const mesh of doc.getRoot().listMeshes())
      for (const p of mesh.listPrimitives()) {
        const pos = p.getAttribute("POSITION").getArray(),
          normal = p.getAttribute("NORMAL").getArray(),
          uv = p.getAttribute("TEXCOORD_0").getArray(),
          attributes = new Float32Array((pos.length / 3) * 5);
        for (let i = 0; i < pos.length / 3; i++) {
          attributes.set(normal.subarray(i * 3, i * 3 + 3), i * 5);
          attributes.set(uv.subarray(i * 2, i * 2 + 2), i * 5 + 3);
        }
        const [indices, error] = MeshoptSimplifier.simplifyWithAttributes(
          new Uint32Array(p.getIndices().getArray()),
          pos,
          3,
          attributes,
          5,
          [0.2, 0.2, 0.2, 0.3, 0.3],
          null,
          96000,
          0.015,
          ["Permissive"],
        );
        p.getIndices().setArray(indices);
        compactPrimitive(p);
        console.log(
          "Attribute-aware simplification",
          a.id,
          indices.length / 3,
          error,
        );
      }
  // Preserve UV seams, base color, normal and roughness maps.
  await doc.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [1024, 1024],
      quality: 82,
      effort: 3,
    }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
  await io.write(output, doc);
  let bytes = (await stat(output)).size;
  if (bytes > 1048576) {
    await doc.transform(
      textureCompress({
        encoder: sharp,
        targetFormat: "webp",
        resize: [768, 768],
        quality: 76,
        effort: 3,
      }),
    );
    await io.write(output, doc);
    bytes = (await stat(output)).size;
  }
  report = report.filter((r) => r.id !== a.id);
  report.push({
    id: a.id,
    triangles: triangleCount(),
    bytes,
    textures: doc.getRoot().listTextures().length,
  });
  await writeFile(
    "reports/revision-3/textures.json",
    JSON.stringify(report, null, 2),
  );
  console.log(a.id, triangleCount(), Math.round(bytes / 1024) + " KB");
}
