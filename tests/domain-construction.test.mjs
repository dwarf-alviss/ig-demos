import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  baking,
  flowers,
  jewelry,
  sources,
  materialProfiles,
  patternLists,
  layerStack,
} from "../shared/domain.js";
import { byId } from "../shared/catalogue.js";
import { normalize, defaults, estimate } from "../shared/studio-state.js";
import { recipeSeats } from "../shared/recipe-layout.js";
import { floralLayout, stemMouthPoint } from "../shared/composed-bouquet.js";
import { domainMaterial } from "../shared/domain-materials.js";
import { sweptBand } from "../shared/constructed-jewelry.js";
import { cartLine } from "../shared/cart.js";
import { petalGeometry } from "../shared/botanical-components.js";
test("petals expose usable UVs and outward normals on both volumetric faces", () => {
  for (const shape of ["pointed", "fan", "ivy"]) {
    const g = petalGeometry(3, 1.4, 0.6, 0.2, 1, shape);
    const { position, normal, uv } = g.attributes;
    assert.equal(uv.count, position.count);
    const lower = Array.from({ length: position.count / 2 }, (_, i) => i).find(
        (i) =>
          Math.abs(uv.getX(i) - 0.5) < 1e-6 &&
          Math.abs(uv.getY(i) - 0.5) < 1e-6,
      ),
      upper = lower + position.count / 2;
    assert.ok(normal.getY(lower) < -0.5);
    assert.ok(normal.getY(upper) > 0.5);
    assert.ok(position.getY(upper) > position.getY(lower));
    for (let i = 0; i < uv.count; i++) {
      assert.ok(uv.getX(i) >= 0 && uv.getX(i) <= 1);
      assert.ok(uv.getY(i) >= 0 && uv.getY(i) <= 1);
    }
    g.dispose();
  }
});
test("published patterns resolve real assets, ingredients, materials and provenance", () => {
  const all = [
    ...baking.components,
    ...baking.recipes,
    ...flowers.plants,
    ...flowers.forms,
    ...flowers.bouquets,
    ...jewelry.components,
    ...jewelry.cuts,
    ...jewelry.patterns,
  ];
  for (const item of all) {
    assert.ok(item.sources.length, item.id);
    for (const ref of item.sources)
      assert.ok(sources[ref], `${item.id}: ${ref}`);
    if (item.asset) assert.ok(byId[item.asset], item.asset);
    if (item.material) assert.ok(materialProfiles[item.material], item.id);
  }
  for (const recipe of baking.recipes)
    assert.ok(layerStack(recipe).every((l) => l.thickness > 0));
  for (const design of jewelry.patterns)
    if (design.defaultCut)
      assert.ok(design.compatibleCuts.includes(design.defaultCut), design.id);
});
test("all domain patterns survive persistence, cart editing and normalization without changing visible composition", () => {
  for (const [kind, patterns] of Object.entries(patternLists))
    for (const pattern of patterns) {
      const state = normalize(kind, { ...defaults(kind), pattern: pattern.id });
      assert.deepEqual(
        normalize(kind, JSON.parse(JSON.stringify(state))),
        state,
        `${kind}/${pattern.id}`,
      );
      assert.equal(
        cartLine(kind, state).id,
        cartLine(kind, normalize(kind, state)).id,
      );
      assert.ok(
        Number.isFinite(estimate(kind, state)) && estimate(kind, state) > 0,
      );
    }
});
test("recipe decoration counts are bounded by distinct berry footprints and have separated physical seats", () => {
  for (const recipe of baking.recipes)
    for (const tiers of [1, 2, 3]) {
      const s = normalize("cakes", {
        ...defaults("cakes"),
        pattern: recipe.id,
        tiers,
        foodDecor: recipe.compatibleDecor,
        foodCounts: Object.fromEntries(
          recipe.compatibleDecor.map((id) => [id, 12]),
        ),
      });
      assert.ok(s.tiers <= recipe.maxTiers);
      const { seats, counts } = recipeSeats(s);
      assert.deepEqual(counts, s.foodCounts, recipe.id);
      for (let i = 0; i < seats.length; i++)
        for (let j = i + 1; j < seats.length; j++) {
          const a = seats[i],
            b = seats[j];
          if (a.piece === b.piece)
            assert.ok(
              Math.hypot(a.x - b.x, a.z - b.z) + 1e-6 >=
                a.footprint + b.footprint + 0.12,
              recipe.id,
            );
        }
    }
});
test("focal and secondary flower heads of different natural sizes cannot collapse into one universal grid", () => {
  const entries = [
    { plant: { id: "peony", headDiameterCm: 10 }, role: "focal" },
    { plant: { id: "anemone", headDiameterCm: 6 }, role: "secondary" },
    { plant: { id: "rose", headDiameterCm: 7 }, role: "focal" },
  ];
  const positions = floralLayout(entries, {
    shape: "asymmetric-dome",
    density: 0.63,
  });
  for (let i = 0; i < positions.length; i++)
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i],
        b = positions[j];
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.radius + b.radius - 0.02);
    }
  assert.notEqual(positions[0].radius, positions[1].radius);
});
test("ring profiles preserve the requested inner diameter and actual metal thickness", () => {
  for (const profile of [
    "round-court",
    "rounded-flat",
    "knife-edge",
    "comfort-fit",
  ]) {
    const g = sweptBand(1.7, 0.2, 0.17, profile),
      p = g.attributes.position;
    let min = Infinity,
      max = 0;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getY(i));
      min = Math.min(min, r);
      max = Math.max(max, r);
    }
    assert.ok(Math.abs(min - 0.85) < 1e-5);
    assert.ok(Math.abs(max - 1.02) < 1e-5);
    g.dispose();
  }
});
test("mineral optics, metal finishes and edible surfaces use different physical properties", () => {
  const diamond = domainMaterial("diamond"),
    ruby = domainMaterial("ruby"),
    metal = domainMaterial("yellow-gold"),
    satin = domainMaterial("yellow-gold", { finish: "satin" }),
    crumb = domainMaterial("sponge"),
    glaze = domainMaterial("mirror-glaze");
  assert.equal(diamond.ior, 2.42);
  assert.equal(ruby.ior, 1.766);
  assert.equal(metal.metalness, 1);
  assert.ok(satin.roughness > metal.roughness);
  assert.ok(crumb.bumpMap && crumb.map);
  assert.ok(crumb.roughness > glaze.roughness);
  for (const m of [diamond, ruby, metal, satin, crumb, glaze]) {
    m.map?.dispose();
    m.bumpMap?.dispose();
    m.dispose();
  }
});
test("required stones, actual containers and pastry quantity stay consistent with the saved design", () => {
  const ring = normalize("jewelry", {
    ...defaults("jewelry"),
    pattern: "solitaire",
    stone: null,
  });
  assert.ok(ring.stone);
  const plain = normalize("jewelry", { ...ring, pattern: "wedding-band" });
  assert.equal(plain.stone, null);
  for (const [pattern, pack] of [
    ["white-box", "fl-wrap-hatbox-round"],
    ["summer-basket", "fl-wrap-basket-rattan"],
    ["ivory-bridal", null],
  ])
    assert.equal(
      normalize("flowers", { ...defaults("flowers"), pattern }).pack,
      pack,
    );
  const single = normalize("cakes", {
    ...defaults("cakes"),
    pattern: "vanilla-eclair",
    pieces: 1,
  });
  const six = normalize("cakes", { ...single, pieces: 6 });
  assert.ok(estimate("cakes", six) > estimate("cakes", single));
});

test("wide bouquet stems pass through the actual mouth even in a narrow bottle", () => {
  for (const radius of [2.13, 7.82, 11.85])
    for (const x of [-22, 0, 22])
      for (const z of [-18, 0, 18]) {
        const point = stemMouthPoint(
          new THREE.Vector3(x, 40, z),
          1.2,
          23,
          radius,
        );
        assert.ok(Math.hypot(point.x - 1.2, point.z) <= radius * 0.82 + 1e-8);
        assert.equal(point.y, 23.16);
      }
});

test("bouquet volume controls produce distinct counts without truncating a mono bouquet", () => {
  for (const [pattern, expected] of [
    ["rose-mono", [11, 19, 29]],
    ["tulip-line", [5, 7, 11]],
    ["minimal-stems", [5, 7, 9]],
  ])
    assert.deepEqual(
      [11, 19, 29].map((bouquetSize) =>
        Object.values(
          normalize("flowers", { ...defaults("flowers"), pattern, bouquetSize })
            .taxonCounts,
        ).reduce((n, v) => n + v, 0),
      ),
      expected,
    );
});
