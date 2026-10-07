import { readFile, readdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const kind = process.argv[2] || "cakes",
  folder = "reports/revision-3";
assert.ok(["cakes", "flowers", "jewelry"].includes(kind));
const matrix = JSON.parse(
    await readFile(`${folder}/matrix-${kind}.json`, "utf8"),
  ),
  records = new Map();
for (const name of (await readdir(folder)).filter((n) =>
  new RegExp(`^results-${kind}-\\d+-\\d+\\.json$`).test(n),
)) {
  for (const r of JSON.parse(await readFile(`${folder}/${name}`, "utf8"))) {
    const index = Number(r.id.split("-").at(-1));
    assert.deepEqual(r.state, matrix[index]?.state, `${r.id}: stale state`);
    assert.ok(!r.error, `${r.id}: failed render`);
    records.set(r.id, r);
  }
}
assert.equal(records.size, matrix.length, "shards are incomplete");
await writeFile(
  `${folder}/results-${kind}.json`,
  JSON.stringify(
    [...records.values()].sort((a, b) => a.id.localeCompare(b.id)),
    null,
    2,
  ),
);
console.log(kind, "merged", records.size);
