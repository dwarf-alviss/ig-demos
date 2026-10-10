import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  weld,
  simplify,
  prune,
  dedup,
  meshopt,
} from "@gltf-transform/functions";
import {
  MeshoptDecoder,
  MeshoptEncoder,
  MeshoptSimplifier,
} from "meshoptimizer";
import { readdir, mkdir, writeFile, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
const failures = [];
const source = process.argv[2] || "C:/webcum/3d-models/готово";
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
await mkdir("shared/models", { recursive: true });
await mkdir("reports", { recursive: true });
const counts = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .reduce(
      (n, m) =>
        n +
        m
          .listPrimitives()
          .reduce(
            (a, p) =>
              a +
              (p.getIndices()?.getCount() ||
                p.getAttribute("POSITION").getCount()) /
                3,
            0,
          ),
      0,
    );
let manifest = [];
try {
  manifest = JSON.parse(await readFile("shared/models/manifest.json", "utf8"));
} catch {}
for (const dir of await readdir(source, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const files = (await readdir(path.join(source, dir.name))).filter((f) =>
    f.endsWith(".glb"),
  );
  const picks =
    dir.name === "jw-stone"
      ? files
      : [files.includes("белая.glb") ? "белая.glb" : files[0]];
  for (const file of picks) {
    const id =
      dir.name === "jw-stone"
        ? dir.name + "-" + path.parse(file).name
        : dir.name;
    if (manifest.some((e) => e.id === id)) continue;
    let input = path.join(source, dir.name, file);
    if ((await stat(input)).size < 12) {
      input = path.join(
        source,
        dir.name,
        files.find(
          (f) => f !== file && (f === "текстура.glb" || f === "альбедо.glb"),
        ) || file,
      );
    }
    const output = `shared/models/${id}.glb`;
    try {
      const before = JSON.parse(
        execFileSync("python", ["tools/inspect_glb.py", input], {
          encoding: "utf8",
        }),
      );
      const doc = await io.read(input);
      for (const m of doc.getRoot().listMaterials()) m.dispose();
      for (const t of doc.getRoot().listTextures()) t.dispose();
      for (const ext of doc.getRoot().listExtensionsUsed())
        if (ext.extensionName.startsWith("KHR_materials")) ext.dispose();
      // Material is authored by the studio. Removing texture seams permits useful welding.
      for (const m of doc.getRoot().listMeshes())
        for (const p of m.listPrimitives())
          for (const s of p.listSemantics())
            if (
              s.startsWith("TEXCOORD") ||
              s === "TANGENT" ||
              s.startsWith("COLOR")
            )
              p.setAttribute(s, null);
      await doc.transform(prune(), dedup(), weld());
      const original = counts(doc);
      await doc.transform(
        simplify({
          simplifier: MeshoptSimplifier,
          ratio: Math.min(1, 32000 / original),
          error: 0.001,
        }),
      );
      let error = 0.001;
      if (counts(doc) > 40000) {
        error = 0.01;
        await doc.transform(
          simplify({
            simplifier: MeshoptSimplifier,
            ratio: 32000 / counts(doc),
            error,
          }),
        );
      }
      await doc.transform(
        prune(),
        meshopt({ encoder: MeshoptEncoder, level: "high" }),
      );
      await io.write(output, doc);
      const after = JSON.parse(
        execFileSync("python", ["tools/inspect_glb.py", output], {
          encoding: "utf8",
        }),
      );
      const entry = {
        id,
        url: `models/${id}.glb`,
        before,
        after,
        simplifyError: error,
        budgetPass: after.bytes <= 1048576 && after.triangles <= 40000,
      };
      manifest.push(entry);
      await writeFile(
        "shared/models/manifest.json",
        JSON.stringify(manifest, null, 2),
      );
      console.log(
        `${id}: ${before.triangles} → ${after.triangles} triangles; ${(after.bytes / 1024).toFixed(0)} KB${entry.budgetPass ? "" : " OVER BUDGET"}`,
      );
    } catch (e) {
      failures.push({ id, error: e.message, source: input });
      console.error(id, e.message);
      process.exitCode = 1;
    }
  }
}
await writeFile(
  "reports/asset-conversion.json",
  JSON.stringify(manifest, null, 2),
);

await writeFile(
  "reports/asset-failures.json",
  JSON.stringify(failures, null, 2),
);
