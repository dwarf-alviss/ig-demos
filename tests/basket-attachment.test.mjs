import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Library } from "./helpers/runtime-geometry-library.mjs";
import { buildFlowers } from "../shared/assemblers.js";
import { byId } from "../shared/catalogue.js";
import { disposeTree } from "../shared/scene-utils.js";
import { distanceToSurface } from "./helpers/mesh-surface-distance.mjs";

test("basket stems stay attached to actual textured calyx surfaces after handle clearance", async () => {
  const library = new Library();
  try {
    for (const id of Object.keys(byId).filter((id) =>
      id.startsWith("fl-flower-"),
    )) {
      const root = await buildFlowers(
        library,
        {
          pack: "fl-wrap-basket-rattan",
          flowers: [id],
          counts: { [id]: 7 },
          green: [],
          ribbon: null,
          palette: 4,
        },
        "#d9a6b4",
      );
      try {
        const heads = root.children.filter((n) => n.userData.asset === id),
          crown = root.userData.assembly.crown;
        assert.equal(heads.length, 7, id);
        assert.equal(crown.length, 7, id);
        for (let i = 0; i < 7; i++) {
          const gap = distanceToSurface(
            heads[i],
            new THREE.Vector3().fromArray(crown[i].attachment),
          );
          assert.ok(
            gap <= 0.15,
            id + " stem " + i + " calyx gap " + gap + "cm",
          );
        }
      } finally {
        disposeTree(root);
      }
    }
  } finally {
    library.dispose();
  }
});
