import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { readFile } from "node:fs/promises";
import validator from "gltf-validator";
import { themes, sanitize, price } from "../shared/config.js";
import { fitToScene, disposeTree } from "../shared/scene-utils.js";
test("normalization respects transformed nodes and bottom pivot", () => {
  for (const axis of ["x", "y", "z"]) {
    const root = new THREE.Group();
    root.scale.set(2, 3, 4);
    root.position.set(50, -20, 8);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(3, 4, 5),
      new THREE.MeshBasicMaterial(),
    );
    mesh.position.set(-4, 8, 10);
    root.add(mesh);
    const normalized = fitToScene(root, 24, axis),
      box = new THREE.Box3().setFromObject(normalized),
      size = box.getSize(new THREE.Vector3()),
      center = box.getCenter(new THREE.Vector3());
    assert.ok(Math.abs(size[axis] - 24) < 0.001);
    assert.ok(Math.abs(box.min.y) < 0.001);
    assert.ok(Math.abs(center.x) < 0.001 && Math.abs(center.z) < 0.001);
    disposeTree(normalized);
  }
});
test("shared resources are disposed once", () => {
  const g = new THREE.BoxGeometry(),
    t = new THREE.Texture(),
    m = new THREE.MeshBasicMaterial({ map: t });
  const root = new THREE.Group();
  root.add(new THREE.Mesh(g, m), new THREE.Mesh(g, m));
  let ge = 0,
    ma = 0,
    te = 0;
  g.addEventListener("dispose", () => ge++);
  m.addEventListener("dispose", () => ma++);
  t.addEventListener("dispose", () => te++);
  disposeTree(root);
  assert.deepEqual([ge, ma, te], [1, 1, 1]);
});
test("invalid persisted values are rejected; estimates remain finite", () => {
  for (const theme of Object.values(themes)) {
    const clean = sanitize(theme, {
      base: -1,
      detail: 1e6,
      extra: NaN,
      color: "0",
      quantity: 999,
    });
    assert.equal(clean.base, 0);
    assert.equal(clean.detail, 0);
    assert.ok(Number.isFinite(price(theme, clean)));
  }
});
test("every selectable model exists and meets the budget", async () => {
  const manifest = JSON.parse(
      await readFile("shared/models/manifest.json", "utf8"),
    ),
    ids = new Set(manifest.map((m) => m.id));
  for (const t of Object.values(themes))
    for (const key of ["base", "detail", "extra"])
      for (const item of t[key])
        if (item[0] !== "none") assert.ok(ids.has(item[0]), item[0]);
  assert.equal(manifest.length, 90);
  for (const m of manifest) {
    assert.ok(m.budgetPass, m.id);
    assert.ok(m.after.bytes <= 1048576 && m.after.triangles <= 40000, m.id);
  }
});
test("all optimized GLBs validate", async () => {
  const manifest = JSON.parse(
    await readFile("shared/models/manifest.json", "utf8"),
  );
  const reports = [];
  for (const m of manifest) {
    const bytes = await readFile("shared/" + m.url);
    const result = await validator.validateBytes(new Uint8Array(bytes), {
      uri: m.url,
      maxIssues: 50,
    });
    reports.push({
      id: m.id,
      errors: result.issues.numErrors,
      warnings: result.issues.numWarnings,
      messages: result.issues.messages,
    });
    assert.equal(result.issues.numErrors, 0, m.id);
  }
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    "reports/gltf-validation.json",
    JSON.stringify(reports, null, 2),
  );
});
import { cartLine, mergeCart } from "../shared/cart.js";
test("custom configurations use each existing store cart schema and merge only identical designs", () => {
  for (const kind of Object.keys(themes)) {
    const a = cartLine(kind, {}, "idb:test");
    assert.equal(a.qty, 1);
    assert.ok(a.price > 0);
    assert.equal(a.img, "idb:test");
    assert.ok(kind === "flowers" ? a.name : a.title);
    if (kind === "cakes") assert.ok(a.meta);
    if (kind === "jewelry") assert.ok(a.key && a.material);
    let list = mergeCart([], a);
    list = mergeCart(list, cartLine(kind, {}));
    assert.equal(list.length, 1);
    assert.equal(list[0].qty, 2);
    list = mergeCart(list, cartLine(kind, { color: 1 }));
    assert.equal(list.length, 2);
  }
});
