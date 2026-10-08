import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Library } from "./helpers/runtime-geometry-library.mjs";
import { distanceToSurface } from "./helpers/mesh-surface-distance.mjs";
import { buildComposedBouquet } from "../shared/composed-bouquet.js";
import { normalize } from "../shared/studio-state.js";
import { plants } from "../shared/domain.js";
import { disposeTree } from "../shared/scene-utils.js";
test("summer basket retains separate bloom cores and real calyx contact at all three bouquet sizes", async () => {
  const lib = new Library();
  try {
    for (const bouquetSize of [11, 19, 29]) {
      const state = normalize("flowers", {
        version: 2,
        pattern: "summer-basket",
        bouquetSize,
        palette: 4,
      });
      const root = await buildComposedBouquet(lib, state);
      try {
        const crown = root.userData.assembly.crown,
          heads = root.children.filter(
            (n) =>
              n.isGroup &&
              n.children.some((c) =>
                c.userData.asset?.startsWith("fl-flower-"),
              ),
          );
        assert.equal(heads.length, crown.length);
        assert.equal(heads.length, bouquetSize);
        for (let i = 0; i < crown.length; i++) {
          const gap = distanceToSurface(
            heads[i],
            new THREE.Vector3().fromArray(crown[i].attachment),
          );
          assert.ok(gap <= 0.15, "Detached calyx " + i + " gap " + gap);
          for (let j = i + 1; j < crown.length; j++) {
            const distance = Math.hypot(
              ...crown[i].center.map((v, k) => v - crown[j].center[k]),
            );
            const a = plants[crown[i].species],
              b = plants[crown[j].species],
              minimum =
                ((a.headCoreRadiusCm ?? a.headDiameterCm * 0.22) +
                  (b.headCoreRadiusCm ?? b.headDiameterCm * 0.22)) *
                0.98;
            assert.ok(
              distance >= minimum - 0.01,
              "Compressed central bloom volumes " +
                i +
                "/" +
                j +
                " at " +
                bouquetSize,
            );
          }
        }
      } finally {
        disposeTree(root);
      }
    }
  } finally {
    lib.dispose();
  }
});
