import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { foodPose } from "../shared/food-pose.js";
import { floralLayout } from "../shared/composed-bouquet.js";
import { buildConstructedJewelry } from "../shared/constructed-jewelry.js";
import { defaults, normalize } from "../shared/studio-state.js";
import {
  flowers,
  forms,
  initialTaxonCounts,
  plants,
} from "../shared/domain.js";
import {
  curvedStem,
  bounds,
  stemPointAtHeight,
} from "../shared/model-library.js";
import { disposeTree } from "../shared/scene-utils.js";

test("whole strawberries rest on their flanks with calyx behind the visible flesh", () => {
  for (let i = 0; i < 12; i++)
    for (const angle of [0, 1, 2, 3, 4, 5]) {
      const quaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(...foodPose("bk-berry-strawberry", i, angle), "YXZ"),
      );
      const calyx = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
      assert.ok(calyx.y < 0.4, "fruit must not balance on its pointed end");
      assert.ok(
        calyx.z < -0.45,
        "do not hide the fruit behind an identical front-facing calyx",
      );
    }
});

test("all bouquet counts retain a volumetric crown without expanding the paper envelope", () => {
  for (const bouquet of flowers.bouquets)
    for (const size of [11, 19, 29]) {
      const counts = initialTaxonCounts(bouquet.id, size);
      const entries = Object.entries(counts).flatMap(([id, n]) =>
        Array.from({ length: n }, () => ({ plant: plants[id] })),
      );
      const positions = floralLayout(entries, forms[bouquet.form], 7.82);
      const mean =
        entries.reduce((n, e) => n + e.plant.headDiameterCm, 0) /
        entries.length;
      for (const p of positions)
        assert.ok(
          Math.hypot(p.x, p.z) <= 7.82 * 1.04 + mean * 0.24 + 1e-6,
          bouquet.id,
        );
      assert.ok(
        Math.max(...positions.map((p) => p.y)) -
          Math.min(...positions.map((p) => p.y)) >
          mean * 0.2,
        bouquet.id,
      );
    }
});

test("a flower stem has continuous normals, capped ends and a species-specific diameter", () => {
  const points = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.4, 5, 0.2),
    new THREE.Vector3(2, 10, 0.8),
    new THREE.Vector3(3, 12, 1),
  ];
  for (const radius of [0.06, 0.15]) {
    const mesh = curvedStem(points, radius),
      { position, normal, uv } = mesh.geometry.attributes;
    assert.ok(position.count > 800);
    assert.equal(position.count, uv.count);
    for (let i = 0; i < normal.count; i++)
      assert.ok(
        Math.abs(
          new THREE.Vector3().fromBufferAttribute(normal, i).length() - 1,
        ) < 1e-4,
      );
    assert.ok(bounds(mesh).min.y < 0.01 && bounds(mesh).max.y > 11.99);
    assert.equal(mesh.material.clearcoat, 0);
    disposeTree(mesh);
  }
});

test("all pendant settings face the chain plane and their bail threads across the chain", async () => {
  const lib = {
    async get(id, { size }) {
      return new THREE.Mesh(
        new THREE.OctahedronGeometry(size * 0.5),
        new THREE.MeshBasicMaterial(),
      );
    },
  };
  for (const pattern of ["bezel-pendant", "pear-pendant", "cabochon-pendant"]) {
    const root = await buildConstructedJewelry(
      lib,
      normalize("jewelry", {
        ...defaults("jewelry"),
        pattern,
        stone: undefined,
      }),
    );
    root.updateMatrixWorld(true);
    const setting = root.children.find((n) => n.userData.stone),
      bail = root.children.find(
        (n) => n.userData.component === "threaded-pendant-bail",
      );
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(
      setting.getWorldQuaternion(new THREE.Quaternion()),
    );
    assert.ok(normal.y > 0.999, pattern);
    const threadAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(
      bail.getWorldQuaternion(new THREE.Quaternion()),
    );
    assert.ok(Math.abs(threadAxis.x) > 0.999, pattern);
    assert.ok(bounds(setting).min.z - bounds(bail).max.z < 0.07, pattern);
    disposeTree(root);
  }
});

test("an off-centre finding eye stays connected after a clasp rotates", async () => {
  const { attachFinding, findingEye } = await import(
    "../shared/finding-assembly.js"
  );
  for (const id of [
    "jw-part-ear-wire-french",
    "jw-part-clasp-lobster",
    "jw-part-bail-hinged",
    "jw-part-charm-tag",
  ]) {
    const part = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.9, 0.08),
      new THREE.MeshBasicMaterial(),
    );
    body.position.set(0.2, 0.95, 0.1);
    part.add(body);
    part.position.set(2, 3, -1);
    part.updateMatrixWorld(true);
    const eyeLocal = part.worldToLocal(findingEye(part, id));
    const target = new THREE.Vector3(-1.5, 4.2, 0.15);
    attachFinding(part, id, target, [0, Math.PI / 4, -Math.PI / 2]);
    assert.ok(part.localToWorld(eyeLocal).distanceTo(target) < 1e-10, id);
    assert.equal(body.scale.x, 1, "attachment must not deform source geometry");
    disposeTree(part);
  }
});

test("persisted fittings are compatible and a visible single fitting is priced once", async () => {
  const { compatibleFindings } = await import("../shared/jewelry-rules.js");
  const ids = [
    "jw-part-ear-wire-french",
    "jw-part-clasp-lobster",
    "jw-part-bail-hinged",
    "jw-part-charm-tag",
    "jw-part-jump-ring",
  ];
  for (const base of [
    "jw-base-pendant",
    "jw-base-drop-earring",
    "jw-base-chain-link-cable",
    "jw-base-band-plain",
  ]) {
    const s = normalize("jewelry", {
      ...defaults("jewelry"),
      pattern: null,
      base,
      finding: ids,
      counts: Object.fromEntries(ids.map((id) => [id, 3])),
    });
    assert.deepEqual(
      s.finding.slice().sort(),
      compatibleFindings(s)
        .map((a) => a.id)
        .sort(),
    );
    for (const id of s.finding) assert.equal(s.counts[id], 1);
    assert.deepEqual(normalize("jewelry", s), s);
  }
});

test("the cabochon pendant defaults to a smooth cut rather than a faceted brilliant", async () => {
  const { stoneShape } = await import("../shared/jewelry-rules.js");
  const s = normalize("jewelry", {
    ...defaults("jewelry"),
    pattern: "cabochon-pendant",
    stone: undefined,
  });
  assert.ok(stoneShape(s.stone).includes("cabochon"));
});

test("drop earrings have threaded hooks while studs have posts and backs", async () => {
  const lib = {
    async get(id, { size }) {
      return new THREE.Mesh(
        new THREE.OctahedronGeometry(size * 0.5),
        new THREE.MeshBasicMaterial(),
      );
    },
  };
  for (const pattern of ["drop", "stud", "bezel-stud"]) {
    const root = await buildConstructedJewelry(
      lib,
      normalize("jewelry", {
        ...defaults("jewelry"),
        pattern,
        stone: undefined,
      }),
    );
    const counts = {};
    root.traverse((n) => {
      if (n.userData.component)
        counts[n.userData.component] = (counts[n.userData.component] || 0) + 1;
    });
    if (pattern === "drop") {
      assert.equal(counts["french-ear-wire"], 2);
      assert.equal(counts["drop-connector"], 2);
      assert.equal(counts["stud-post"], undefined);
      assert.equal(counts["stud-back"], undefined);
    } else {
      assert.equal(counts["stud-post"], 2);
      assert.equal(counts["stud-back"], 4);
      assert.equal(counts["french-ear-wire"], undefined);
    }
    disposeTree(root);
  }
});

test("outer petals clear irregular paper folds without lifting an interior calyx", async () => {
  const { clearPaperEdge } = await import("../shared/wrapper-rim.js");
  const root = new THREE.Group();
  const petal = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 8),
    new THREE.MeshBasicMaterial(),
  );
  petal.position.set(3, 4, 0);
  root.add(petal);
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 8),
    new THREE.MeshBasicMaterial(),
  );
  inner.position.set(0, 1, 0);
  root.add(inner);
  const rim = { at: (x, z) => (x > 0 ? 5 : 4) };
  const lift = clearPaperEdge(root, rim, 0, 2);
  assert.ok(lift > 1.2 && lift < 1.4);
  assert.ok(bounds(petal).min.y >= 5.12 - 1e-6);
  assert.ok(
    bounds(inner).min.y < 3,
    "interior geometry need not sit above the paper's highest fold",
  );
  assert.equal(root.scale.y, 1);
  disposeTree(root);
});

test("the lower stem bundle cannot pinch across the axis below its binding", () => {
  const root = curvedStem(
    [
      new THREE.Vector3(1.4, 0.5, 0),
      new THREE.Vector3(1, 15, 0),
      new THREE.Vector3(12, 22, 0),
      new THREE.Vector3(13, 23, 0),
    ],
    0.1,
  );
  const p = root.geometry.attributes.position;
  let samples = 0;
  for (let ring = 0; ring <= 48; ring++) {
    const center = new THREE.Vector3();
    for (let side = 0; side < 16; side++)
      center.add(new THREE.Vector3().fromBufferAttribute(p, ring * 17 + side));
    center.divideScalar(16);
    if (center.y < 15) {
      samples++;
      assert.ok(center.x >= 0.99, "stem overshoots inward below binding");
    }
  }
  assert.ok(samples > 12);
  disposeTree(root);
});
test("paper clearance follows finite source surfaces rather than an infinite rim wall", async () => {
  const { paperRim, clearPaperEdge } = await import("../shared/wrapper-rim.js");
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  paper.rotation.x = -Math.PI / 2;
  paper.position.set(3, 5, 0);
  const rim = paperRim(paper, 0, 8);
  const outside = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 12, 8),
    new THREE.MeshBasicMaterial(),
  );
  outside.position.set(6, 3, 0);
  assert.equal(
    clearPaperEdge(outside, rim, 0, 1),
    0,
    "petal beyond the supplied paper must not float above its highest fold",
  );
  const touching = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 12, 8),
    new THREE.MeshBasicMaterial(),
  );
  touching.position.set(3, 4.8, 0);
  assert.ok(clearPaperEdge(touching, rim, 0, 1) > 0.4);
  assert.ok(bounds(touching).min.y >= 5.12 - 1e-6);
  disposeTree(paper);
  disposeTree(outside);
  disposeTree(touching);
});

test("foliage roots follow the real curved stem instead of a floating straight chord", () => {
  const points = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(1, 10, 0),
    new THREE.Vector3(8, 17, 3),
    new THREE.Vector3(9, 18, 3),
  ];
  const mesh = curvedStem(points, 0.1);
  for (const height of [11, 13, 15, 16, 17.5]) {
    const root = stemPointAtHeight(mesh, height);
    assert.ok(Math.abs(root.y - height) < 1e-8);
    const nearest = Math.min(
      ...Array.from({ length: 4097 }, (_, i) =>
        mesh.stemCurve.getPointAt(i / 4096).distanceTo(root),
      ),
    );
    assert.ok(
      nearest < 0.01,
      "leaf root must touch the measured stem centerline",
    );
  }
  const actual = stemPointAtHeight(mesh, 14);
  const oldChord = points[1].clone().lerp(points[3], 0.5);
  assert.ok(
    actual.distanceTo(oldChord) > 0.2,
    "fixture must reveal the former floating-leaf defect",
  );
  disposeTree(mesh);
});

test("raspberries on hard plates rest on their drupelet flank instead of the pointed end", () => {
  for (let i = 0; i < 12; i++)
    for (const angle of [0, 1, 2, 3, 4, 5]) {
      const axis = new THREE.Vector3(0, 1, 0).applyEuler(
        new THREE.Euler(
          ...foodPose("bk-berry-raspberry", i, angle, false, "plate"),
          "YXZ",
        ),
      );
      assert.ok(
        axis.y < 0.45,
        "hard plate cannot hold a pointed raspberry upright",
      );
    }
});
