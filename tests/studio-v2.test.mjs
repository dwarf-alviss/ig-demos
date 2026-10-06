import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import validator from "gltf-validator";
import * as THREE from "three";
import { catalogue, byId } from "../shared/catalogue.js";
import {
  defaults,
  normalize,
  preset,
  estimate,
  selectedIds,
  toggleAsset,
} from "../shared/studio-state.js";
import { cartLine, mergeCart, replaceCartDesign } from "../shared/cart.js";
import { bake } from "../shared/model-library.js";
test("188 selectable assets include every valid source and 100 separate stones", async () => {
  assert.equal(catalogue.length, 188);
  assert.equal(new Set(catalogue.map((a) => a.id)).size, 188);
  assert.equal(catalogue.filter((a) => a.pack === "diamond").length, 12);
  assert.equal(catalogue.filter((a) => a.pack === "gem").length, 88);
  const originals = JSON.parse(
    await readFile("shared/models/manifest.json", "utf8"),
  );
  for (const a of originals)
    if (!a.id.includes("shape_set") && !a.id.includes("gemstone_pack"))
      assert.ok(byId[a.id], a.id);
});
test("quantized attributes become floating point before world transforms", () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Int16BufferAttribute(
      [32767, 0, 0, 0, 32767, 0, 0, 0, 32767],
      3,
      true,
    ),
  );
  const mesh = new THREE.Mesh(g);
  mesh.scale.set(10, 20, 30);
  mesh.position.set(100, 200, 300);
  const root = new THREE.Group();
  root.add(mesh);
  const baked = bake(root).children[0].geometry.getAttribute("position");
  assert.ok(baked.array instanceof Float32Array);
  assert.deepEqual(
    Array.from(baked.array),
    [110, 200, 300, 100, 220, 300, 100, 200, 330],
  );
});
test("normalized quantities match visible flowers and totals", () => {
  const s = defaults("flowers");
  s.flowers = catalogue
    .filter((a) => a.category === "flowers")
    .slice(0, 5)
    .map((a) => a.id);
  s.counts = Object.fromEntries(s.flowers.map((id) => [id, 15]));
  const n = normalize("flowers", s);
  assert.equal(
    Object.values(n.counts).reduce((a, b) => a + b, 0),
    33,
  );
  assert.ok(Object.values(n.counts).every((n) => n >= 1));
  assert.equal(
    estimate("flowers", n),
    selectedIds("flowers", n).reduce(
      (sum, id) => sum + byId[id].price * (n.counts[id] || 1),
      0,
    ),
  );
});
test("selecting jewelry findings chooses compatible bases; bases clear fittings", () => {
  let s = toggleAsset("jewelry", defaults("jewelry"), "jw-part-jump-ring");
  assert.equal(s.base, "jw-base-pendant");
  s = toggleAsset("jewelry", s, "jw-base-solitaire");
  assert.deepEqual(s.finding, []);
  assert.equal(
    toggleAsset("jewelry", s, "jw-set-heart").stone,
    "jw-stone-diamond-03",
  );
});
test("all presets produce stable cart identity and exact price", () => {
  for (const kind of ["cakes", "flowers", "jewelry"])
    for (let i = 0; i < 3; i++) {
      const s = normalize(kind, preset(kind, i)),
        line = cartLine(kind, s);
      assert.equal(line.price, estimate(kind, s));
      assert.equal(cartLine(kind, normalize(kind, s)).id, line.id);
      assert.equal(mergeCart([line], line)[0].qty, 2);
      assert.ok(line.price > 0);
    }
});
test("editing a saved design preserves quantity and replaces its prior identity", () => {
  const old = cartLine("cakes", normalize("cakes", defaults("cakes")));
  old.qty = 3;
  const next = cartLine(
    "cakes",
    normalize("cakes", { ...defaults("cakes"), palette: 2 }),
  );
  const result = replaceCartDesign([old], next, old.id);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, next.id);
  assert.equal(result[0].qty, 3);
  assert.equal(replaceCartDesign(result, next, next.id)[0].qty, 3);
});
test("cake fillings scale with tiers; coverings are charged once", () => {
  const plain = normalize("cakes", { ...defaults("cakes"), tiers: 2 }),
    pistachio = normalize("cakes", { ...plain, filling: "pistachio" });
  assert.equal(estimate("cakes", pistachio) - estimate("cakes", plain), 32);
  const covered = normalize("cakes", {
    ...plain,
    decor: ["bk-decor-glaze-drip-ring"],
    counts: { "bk-decor-glaze-drip-ring": 12 },
  });
  assert.equal(covered.counts["bk-decor-glaze-drip-ring"], 1);
});
test("all 100 extracted stones are valid glTF with modest triangle budgets", async () => {
  for (const a of catalogue.filter((a) => a.pack)) {
    const bytes = await readFile(
      new URL("../shared/" + a.url, import.meta.url),
    );
    const report = await validator.validateBytes(new Uint8Array(bytes), {
      maxIssues: 5,
    });
    assert.equal(report.issues.numErrors, 0, a.id);
    assert.ok(report.info.totalTriangleCount <= 40000, a.id);
  }
});
