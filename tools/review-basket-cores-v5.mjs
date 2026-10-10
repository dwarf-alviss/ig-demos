import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { plants } from "../shared/domain.js";
const hash = process.argv[2],
  suite = process.argv[3] || "native";
assert.match(hash, /^[a-f0-9]{12}$/);
assert.ok(["native", "domain"].includes(suite));
const proof = JSON.parse(
  await readFile(
    "reports/revision-5/combinations/" +
      hash +
      "/" +
      suite +
      "/results-flowers.json",
    "utf8",
  ),
);
const byAsset = Object.fromEntries(
  Object.values(plants)
    .filter((p) => p.asset)
    .map((p) => [p.asset, p]),
);
const violations = [],
  cases = [];
for (const row of proof.results) {
  if (row.error) continue;
  const assembly = row.poses.front.assembly;
  if (assembly.container !== "fl-wrap-basket-rattan") continue;
  const crown = assembly.crown;
  let count = 0;
  for (let i = 0; i < crown.length; i++)
    for (let j = i + 1; j < crown.length; j++) {
      const a = crown[i],
        b = crown[j],
        pa = suite === "native" ? byAsset[a.asset] : plants[a.species],
        pb = suite === "native" ? byAsset[b.asset] : plants[b.species];
      assert.ok(pa && pb, "Missing plant core calibration");
      const distance = Math.hypot(...a.center.map((v, k) => v - b.center[k]));
      const minimum =
        ((pa.headCoreRadiusCm ?? pa.headDiameterCm * 0.22) +
          (pb.headCoreRadiusCm ?? pb.headDiameterCm * 0.22)) *
        0.98;
      assert.ok(Number.isFinite(minimum) && Number.isFinite(distance));
      if (distance < minimum - 0.01) {
        violations.push({
          id: row.id,
          pair: [i, j],
          distanceCm: distance,
          minimumCm: minimum,
        });
        count++;
      }
    }
  cases.push({ id: row.id, flowers: crown.length, violations: count });
}
const report = {
  bundleHash: proof.bundleHash,
  suite,
  method:
    "Independent pairwise distances of actual final assembly bloom centres against species central-volume radii; petal overlap permitted.",
  cases,
  violations,
};
await writeFile(
  "reports/revision-5/basket-cores-" + hash + "-" + suite + ".json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log({ cases: cases.length, violations: violations.length });
process.exitCode = violations.length ? 1 : 0;
