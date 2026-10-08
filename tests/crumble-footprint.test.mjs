import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Library } from "./helpers/runtime-geometry-library.mjs";
import { cakeParts } from "../shared/assembly-profiles.js";
import { foodPose } from "../shared/food-pose.js";
import { preciseBounds } from "../shared/precise-fit.js";
import { disposeTree } from "../shared/scene-utils.js";

test("textured crumble keeps its flat pose and true footprint through world yaw", async () => {
  const lib = new Library(),
    id = "bk-decor-crumble-cluster";
  try {
    for (let i = 0; i < 16; i++) {
      const node = await lib.get(id, {
        size: cakeParts[id].size,
        axis: "max",
        rotation: foodPose(id, i, i * 0.83),
        rotationOrder: "YXZ",
      });
      try {
        node.updateMatrixWorld(true);
        const box = preciseBounds(node),
          center = box.getCenter(new THREE.Vector3());
        assert.ok(
          box.max.y - box.min.y < 1.5,
          "crumb must lie across the surface rather than stand vertically",
        );
        node.traverse((mesh) => {
          if (!mesh.isMesh) return;
          const axis = new THREE.Vector3(0, 1, 0).transformDirection(
            mesh.matrixWorld,
          );
          assert.ok(
            Math.abs(axis.y) < 0.001,
            "world yaw must retain the calibrated flat orientation",
          );
          const pos = mesh.geometry.attributes.position;
          for (let j = 0; j < pos.count; j++) {
            const p = new THREE.Vector3()
              .fromBufferAttribute(pos, j)
              .applyMatrix4(mesh.matrixWorld);
            assert.ok(
              Math.hypot(p.x - center.x, p.z - center.z) <=
                cakeParts[id].footprint,
              "actual source vertex exceeds its reserved seat",
            );
          }
        });
      } finally {
        disposeTree(node);
      }
    }
  } finally {
    lib.dispose();
  }
});
