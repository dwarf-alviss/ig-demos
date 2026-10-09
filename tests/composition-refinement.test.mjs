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
  for (const id of ["rose", "lisianthus", "tulip", "gerbera"]) {
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
    assert.equal(leaves.length, id === "gerbera" ? 0 : 2);
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
