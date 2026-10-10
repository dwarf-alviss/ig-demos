import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { Library } from "../tests/helpers/runtime-geometry-library.mjs";
import { buildFlowers } from "../shared/assemblers.js";
import { disposeTree } from "../shared/scene-utils.js";
import { plants } from "../shared/domain.js";
const bundleHash = createHash("sha256")
  .update(await readFile("shared/studio.bundle.js"))
  .digest("hex");
const rows = JSON.parse(
  await readFile("reports/revision-5/matrix-basket.json", "utf8"),
);
const byAsset = Object.fromEntries(
  Object.values(plants)
    .filter((p) => p.asset)
    .map((p) => [p.asset, p]),
);
const lib = new Library(),
  results = [];
try {
  for (const r of rows) {
    let root;
    try {
      root = await buildFlowers(lib, r.state, "#d9a6b4");
      let violations = 0;
      const c = root.userData.assembly.crown;
      if (
        !c.every((item) =>
          [...item.center, ...item.attachment].every(Number.isFinite),
        )
      )
        throw Error("Nonfinite crown metadata");
      root.traverse((node) => {
        if (!node.matrixWorld.elements.every(Number.isFinite))
          throw Error("Nonfinite world transform");
      });
      for (let i = 0; i < c.length; i++)
        for (let j = i + 1; j < c.length; j++) {
          const dist = Math.hypot(
              ...c[i].center.map((v, k) => v - c[j].center[k]),
            ),
            minimum =
              ((byAsset[c[i].asset].headCoreRadiusCm ??
                byAsset[c[i].asset].headDiameterCm * 0.22) +
                (byAsset[c[j].asset].headCoreRadiusCm ??
                  byAsset[c[j].asset].headDiameterCm * 0.22)) *
              0.98;
          if (dist < minimum - 0.01) violations++;
        }
      results.push({ label: r.label, violations });
      if (results.length % 25 === 0 || violations)
        console.log(results.length, violations);
    } catch (e) {
      results.push({ label: r.label, error: e.message });
      console.log(results.length, e.message);
    } finally {
      if (root) disposeTree(root);
    }
  }
} finally {
  lib.dispose();
}
await writeFile(
  "reports/revision-5/native-basket-compact-support-probe.json",
  JSON.stringify({
    bundleHash,
    cases: results.length,
    failures: results.filter((r) => r.error || r.violations).length,
    results,
  }),
);
console.log("Failures", results.filter((r) => r.error || r.violations).length);
if (results.some((r) => r.error || r.violations)) process.exitCode = 1;
