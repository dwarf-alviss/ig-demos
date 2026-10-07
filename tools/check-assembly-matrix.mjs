import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { byId } from "../shared/catalogue.js";
import { cakeBlockers } from "../shared/assembly-profiles.js";
import { supportsDecoration } from "../shared/pastry-support.js";
const report = {};
for (const kind of ["cakes", "flowers", "jewelry"]) {
  const rows = JSON.parse(
    await readFile(`reports/revision-3/results-${kind}.json`, "utf8"),
  );
  const matrix = JSON.parse(
    await readFile(`reports/revision-3/matrix-${kind}.json`, "utf8"),
  );
  assert.equal(rows.length, matrix.length, `${kind}: incomplete matrix`);
  for (const r of rows) {
    assert.ok(!r.error, `${r.id}: ${r.error}`);
    assert.ok(
      r.metrics.framing.maxX < 1 && r.metrics.framing.maxY < 1,
      `${r.id}: outside frame`,
    );
    if (kind === "flowers")
      assert.equal(
        r.metrics.assembly.flowers,
        Object.values(r.state.counts).reduce((n, v) => n + v, 0),
        `${r.id}: stem count`,
      );
    if (kind === "cakes") {
      const { decorSeats, surfaces } = r.metrics.assembly,
        blockers = cakeBlockers(r.state).length;
      const seats = decorSeats.slice(blockers),
        expected = r.state.decor
          .filter((id) => !["border", "glaze"].includes(byId[id].role))
          .reduce((n, id) => n + r.state.counts[id], 0);
      assert.equal(seats.length, expected, `${r.id}: visible/charged count`);
      for (let i = 0; i < seats.length; i++) {
        const p = seats[i],
          surface = surfaces.find((s) => s.id === p.surface),
          radius = Math.hypot(p.x - surface.x, p.z - surface.z);
        assert.ok(
          radius + p.footprint <= surface.radius + 1e-6,
          `${r.id}: outside support`,
        );
        if (surface.inner)
          assert.ok(
            radius - p.footprint >= surface.inner - 1e-6,
            `${r.id}: reserved inner tier/hole`,
          );
        if (surface.asset)
          assert.ok(
            supportsDecoration(
              surface.asset,
              p.x - surface.x,
              p.z - surface.z,
              p.footprint,
            ),
            `${r.id}: unsupported pastry decoration`,
          );
        for (const q of decorSeats.slice(0, blockers + i))
          if (p.surface === q.surface)
            assert.ok(
              Math.hypot(p.x - q.x, p.z - q.z) >=
                p.footprint + q.footprint + 0.16 - 1e-6,
              `${r.id}: overlapping footprints`,
            );
      }
    }
  }
  report[kind] = {
    configurations: rows.length,
    errors: 0,
    checks:
      kind === "cakes"
        ? "counts, calibrated support masks, footprints, reserved tiers/topper/plate bodies, camera frame"
        : kind === "flowers"
          ? "visible stem counts, camera frame"
          : "render completion, camera frame",
  };
}
await writeFile(
  "reports/revision-3/assembly-checks.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
