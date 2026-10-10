import { open, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { catalogue } from "../shared/catalogue.js";
const source = process.argv[2] || "C:/webcum/3d-models/готово";
const groups = [];
async function fingerprint(file) {
  const handle = await open(file);
  try {
    const stat = await handle.stat();
    if (stat.size < 20) return { bytes: stat.size, empty: true };
    const head = Buffer.alloc(20);
    await handle.read(head, 0, 20, 0);
    const jsonSize = head.readUInt32LE(12),
      buffer = Buffer.alloc(jsonSize);
    await handle.read(buffer, 0, jsonSize, 20);
    const json = JSON.parse(buffer.toString()),
      offset = 28 + jsonSize,
      hash = createHash("sha256");
    hash.update(
      JSON.stringify(
        (json.nodes || []).map(
          ({ mesh, children, matrix, rotation, scale, translation }) => ({
            mesh,
            children,
            matrix,
            rotation,
            scale,
            translation,
          }),
        ),
      ),
    );
    for (const mesh of json.meshes || [])
      for (const primitive of mesh.primitives || [])
        for (const id of [
          primitive.attributes.POSITION,
          primitive.indices,
        ].filter((n) => n !== undefined)) {
          const accessor = json.accessors[id],
            view = json.bufferViews[accessor.bufferView],
            data = Buffer.alloc(view.byteLength);
          await handle.read(
            data,
            0,
            data.length,
            offset + (view.byteOffset || 0),
          );
          hash.update(data);
        }
    return { bytes: stat.size, geometrySHA256: hash.digest("hex") };
  } finally {
    await handle.close();
  }
}
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(source, entry.name),
    files = (await readdir(dir)).filter((f) => f.endsWith(".glb")),
    variants = [];
  for (const file of files)
    variants.push({ file, ...(await fingerprint(path.join(dir, file))) });
  const geometries = new Set(
    variants.filter((v) => !v.empty).map((v) => v.geometrySHA256),
  );
  groups.push({
    source: entry.name,
    variants,
    uniqueGeometrySets: geometries.size,
    selectable: catalogue
      .filter(
        (a) => a.source === entry.name || (entry.name === "jw-stone" && a.pack),
      )
      .map((a) => a.id),
    note:
      entry.name === "bk-topper-candle-spiral"
        ? "All source files are empty."
        : entry.name === "bk-berry-currant-red"
          ? "Geometry is a spiral candle, despite the currant filename and thumbnail."
          : entry.name === "jw-stone"
            ? "12 diamond cuts and 88 gemstones extracted; text labels excluded."
            : geometries.size > 1
              ? "Distinct source geometries: inspect before treating variants as identical."
              : "Equivalent geometry across material variants.",
  });
}
await writeFile(
  "reports/revision-2/source-coverage.json",
  JSON.stringify(
    {
      source,
      files: groups.reduce((n, g) => n + g.variants.length, 0),
      groups: groups.length,
      selectable: catalogue.length,
      uncovered: groups
        .filter(
          (g) => !g.selectable.length && !g.variants.every((v) => v.empty),
        )
        .map((g) => g.source),
      distinctVariants: groups
        .filter((g) => g.source !== "jw-stone" && g.uniqueGeometrySets > 1)
        .map((g) => g.source),
      records: groups,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    groups: groups.length,
    files: groups.reduce((n, g) => n + g.variants.length, 0),
    uncovered: groups
      .filter((g) => !g.selectable.length && !g.variants.every((v) => v.empty))
      .map((g) => g.source),
    distinctVariants: groups
      .filter((g) => g.source !== "jw-stone" && g.uniqueGeometrySets > 1)
      .map((g) => g.source),
  }),
);
