import * as THREE from "three";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { Library } from "../tests/helpers/runtime-geometry-library.mjs";
import { disposeTree } from "../shared/scene-utils.js";
import { preciseBounds } from "../shared/precise-fit.js";
import { buildCake } from "../shared/assemblers.js";
import { normalize } from "../shared/studio-state.js";
import { cakeParts } from "../shared/assembly-profiles.js";
const rows = JSON.parse(
  await readFile("reports/revision-5/matrix-all.json", "utf8"),
);
const lib = new Library(),
  seen = new Set(),
  results = [];
let pieces = 0;
try {
  for (const row of rows) {
    if (
      row.kind !== "cakes" ||
      row.state.pattern ||
      !row.state.decor.includes("bk-decor-caramel-spiral")
    )
      continue;
    const state = normalize("cakes", row.state),
      key = JSON.stringify(state);
    if (seen.has(key)) continue;
    seen.add(key);
    let root;
    try {
      root = await buildCake(lib, state, "#eee4ce");
      root.updateMatrixWorld(true);
      const nodes = root.children.filter(
        (n) => n.userData.asset === "bk-decor-caramel-spiral",
      );
      assert.equal(
        nodes.length,
        state.counts["bk-decor-caramel-spiral"] || 0,
        "Requested caramel count must be built",
      );
      for (const node of nodes) {
        const center = preciseBounds(node).getCenter(new THREE.Vector3());
        let radial = 0;
        node.traverse((mesh) => {
          if (!mesh.isMesh) return;
          const pos = mesh.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const p = new THREE.Vector3()
              .fromBufferAttribute(pos, i)
              .applyMatrix4(mesh.matrixWorld);
            radial = Math.max(
              radial,
              Math.hypot(p.x - center.x, p.z - center.z),
            );
          }
        });
        assert.ok(
          radial <= cakeParts["bk-decor-caramel-spiral"].footprint + 0.001,
          `Real vertices exceed reservation: ${radial}`,
        );
        pieces++;
      }
      results.push({ state, passed: true });
    } catch (e) {
      results.push({ state, error: e.message });
    } finally {
      if (root) disposeTree(root);
    }
    if (results.length % 50 === 0) console.log(results.length);
  }
} finally {
  lib.dispose();
}
await writeFile(
  "reports/revision-5/caramel-geometry-probe.json",
  JSON.stringify({ candidate: false, results, pieces }, null, 2),
);
console.log({
  cases: results.length,
  pieces,
  failed: results.filter((r) => r.error).length,
});
if (results.some((r) => r.error)) process.exitCode = 1;
