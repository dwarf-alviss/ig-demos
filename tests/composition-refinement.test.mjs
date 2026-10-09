import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Library } from "./helpers/runtime-geometry-library.mjs";
import { buildCake } from "../shared/assemblers.js";
import { defaults, normalize } from "../shared/studio-state.js";
import {
  cakeSurfaces,
  findCakeSeat,
  cakeParts,
  cakeBlockers,
} from "../shared/assembly-profiles.js";
import { attachBasketStemLeaves } from "../shared/flower-stem-leaves.js";
import { curvedStem } from "../shared/model-library.js";
import { disposeTree } from "../shared/scene-utils.js";
import { cakeSeatsOverlap } from "../shared/cake-seat-overlap.js";
test("wafer collision detects crossed ends and berries along the complete tube", () => {
  const wafer = {
    x: 0,
    z: 0,
    footprint: 0.42,
    capsule: { ax: -3.75, az: 0, bx: 3.75, bz: 0 },
  };
  const crossed = {
    x: 3,
    z: 0,
    footprint: 0.42,
    capsule: { ax: 3, az: -3.75, bx: 3, bz: 3.75 },
  };
  assert.equal(cakeSeatsOverlap(wafer, crossed), true);
  assert.equal(
    cakeSeatsOverlap(wafer, { x: 3, z: 0.6, footprint: 0.58 }),
    true,
  );
  assert.equal(
    cakeSeatsOverlap(wafer, { x: 3, z: 1.3, footprint: 0.58 }),
    false,
  );
  assert.equal(
    cakeSeatsOverlap(wafer, {
      x: 0,
      z: 1.2,
      footprint: 0.42,
      capsule: { ax: -3.75, az: 1.2, bx: 3.75, bz: 1.2 },
    }),
    false,
  );
});
test("flat wafer rolls retain their source proportions and rest wholly on actual tier roofs", async () => {
  const lib = new Library();
  try {
    for (const base of ["bk-struct-tier-round", "bk-struct-tier-hex"]) {
      const state = normalize("cakes", {
        ...defaults("cakes"),
        pattern: null,
        base,
        tiers: 3,
        topper: null,
        decor: ["bk-decor-wafer-roll"],
        counts: { "bk-decor-wafer-roll": 6 },
      });
      const root = await buildCake(lib, state, "#ede1d2");
      root.updateMatrixWorld(true);
      const tiers = root.children.filter((n) => n.userData.asset === base),
        wafers = root.children.filter(
          (n) => n.userData.asset === "bk-decor-wafer-roll",
        );
      assert.equal(wafers.length, state.counts["bk-decor-wafer-roll"]);
      const ray = new THREE.Raycaster();
      for (const wafer of wafers) {
        const box = new THREE.Box3().setFromObject(wafer);
        assert.ok(
          box.max.y - box.min.y > 0.75 && box.max.y - box.min.y < 0.8,
          "wafer must lie on its long side with its original diameter",
        );
        let closestGap = Infinity;
        wafer.traverse((n) => {
          if (!n.isMesh) return;
          const p = n.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const v = new THREE.Vector3()
              .fromBufferAttribute(p, i)
              .applyMatrix4(n.matrixWorld);
            if (
              i % Math.max(1, Math.floor(p.count / 120)) !== 0 &&
              i !== p.count - 1
            )
              continue;
            ray.set(
              new THREE.Vector3(v.x, box.max.y + 0.5, v.z),
              new THREE.Vector3(0, -1, 0),
            );
            const hits = ray.intersectObjects(tiers, true);
            assert.ok(hits.length, "wafer end overhangs the tier roof");
            const gap = v.y - hits[0].point.y;
            assert.ok(
              gap >= -0.05,
              `wafer intersects the cake: ${base}, gap ${gap}`,
            );
            closestGap = Math.min(closestGap, gap);
          }
        });
        assert.ok(closestGap < 0.1, "wafer floats above its actual support");
      }
      disposeTree(root);
    }
  } finally {
    lib.dispose();
  }
});

test("small berries occupy all real round and hexagonal tier ledges without touching the upper body", async () => {
  const lib = new Library();
  try {
    for (const base of ["bk-struct-tier-round", "bk-struct-tier-hex"]) {
      const state = normalize("cakes", {
        ...defaults("cakes"),
        pattern: null,
        base,
        tiers: 3,
        topper: null,
        decor: ["bk-berry-blueberry"],
        counts: { "bk-berry-blueberry": 12 },
      });
      const surfaces = cakeSurfaces(state),
        occupied = cakeBlockers(state),
        seats = [];
      for (let i = 0; i < state.counts["bk-berry-blueberry"]; i++)
        seats.push(
          findCakeSeat(
            surfaces,
            occupied,
            cakeParts["bk-berry-blueberry"].footprint,
            state.layout,
            i,
            cakeParts["bk-berry-blueberry"],
          ),
        );
      assert.deepEqual(
        [...new Set(seats.map((s) => s.surface))].sort(),
        [0, 1, 2],
      );
      for (const tier of [0, 1]) {
        const angles = seats
          .filter((s) => s.surface === tier)
          .map((s) => Math.atan2(s.z, s.x));
        assert.ok(
          Math.max(...angles) - Math.min(...angles) < 0.8,
          "lower-tier berries must form a group instead of a full ring",
        );
      }
      const root = await buildCake(lib, state, "#ede1d2");
      root.updateMatrixWorld(true);
      const tiers = root.children.filter((n) => n.userData.asset === base),
        ray = new THREE.Raycaster();
      assert.equal(tiers.length, 3);
      for (const seat of seats)
        for (let j = 0; j < 12; j++) {
          const a = (j * Math.PI) / 6,
            x = seat.x - 5 + Math.cos(a) * seat.footprint,
            z = seat.z + Math.sin(a) * seat.footprint;
          ray.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
          assert.ok(
            ray.intersectObject(tiers[seat.surface], true).length,
            "footprint falls off actual ledge",
          );
          for (let k = seat.surface + 1; k < 3; k++)
            assert.equal(
              ray.intersectObject(tiers[k], true).length,
              0,
              JSON.stringify({ base, seat, j, k, x, z }),
            );
        }
      disposeTree(root);
    }
  } finally {
    lib.dispose();
  }
});

test("basket flower leaves attach to their stalk and stay inside the mouth; gerberas stay leafless", () => {
  for (const id of ["rose", "lisianthus", "tulip", "lily", "gerbera"]) {
    const root = new THREE.Group(),
      stem = curvedStem(
        [new THREE.Vector3(3, 0, 0), new THREE.Vector3(4, 6, 0)],
        0.1,
      );
    root.add(stem);
    attachBasketStemLeaves(
      root,
      stem,
      { id },
      { top: 5, bottom: 1, centerX: 0, radius: 9, phase: 1 },
    );
    const leaves = root.children.filter(
      (n) => n.userData.component === "basket-flower-stem-leaf",
    );
    assert.equal(leaves.length, id === "gerbera" ? 0 : id === "lily" ? 3 : 2);
    root.updateMatrixWorld(true);
    for (const leaf of leaves)
      leaf.traverse((n) => {
        if (n.isMesh) {
          const p = n.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const v = new THREE.Vector3()
              .fromBufferAttribute(p, i)
              .applyMatrix4(n.matrixWorld);
            assert.ok(Number.isFinite(v.y));
            assert.ok(Math.hypot(v.x, v.z) < 9);
          }
        }
      });
    disposeTree(root);
  }
});

test("plate exclusion bounds contain every transformed vertex of each supplied pastry body", async () => {
  const { pastryBodyClearance } = await import("../shared/pastry-support.js");
  const lib = new Library();
  try {
    for (const base of [
      "bk-pastry-eclair",
      "bk-pastry-brownie-bite",
      "bk-pastry-cupcake",
      "bk-pastry-cookie-heart",
      "bk-pastry-cookie-round",
      "bk-pastry-donut",
      "bk-pastry-profiterole",
    ]) {
      const state = normalize("cakes", {
        ...defaults("cakes"),
        pattern: null,
        base,
        pieces: 1,
        decor: [],
        topper: null,
      });
      const root = await buildCake(lib, state, "#eee");
      root.updateMatrixWorld(true);
      const body = root.children.find((n) => n.userData.asset === base);
      assert.ok(body);
      body.traverse((n) => {
        if (n.isMesh) {
          const p = n.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const v = new THREE.Vector3()
              .fromBufferAttribute(p, i)
              .applyMatrix4(n.matrixWorld);
            assert.ok(
              pastryBodyClearance(base, v.x, v.z) <= 0.001,
              base + " body extends beyond its plate exclusion envelope",
            );
          }
        }
      });
      disposeTree(root);
    }
  } finally {
    lib.dispose();
  }
});
