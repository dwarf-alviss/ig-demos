import test from "node:test";
import * as THREE from "three";
import { fitWrapTwine } from "../shared/wrap-twine.js";
import { canIncreaseCount, canSelectCakeDecoration } from "../shared/studio-state.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import validator from "gltf-validator";
import { catalogue } from "../shared/catalogue.js";
import { defaults, normalize, estimate } from "../shared/studio-state.js";
import {
  cakeParts,
  cakeSurfaces,
  findCakeSeat,
  pastryBlockers,
  pastryPositions,
  cakeBlockers,
} from "../shared/assembly-profiles.js";
import { compatibleStones, stoneShape } from "../shared/jewelry-rules.js";
import {
  pastryHeight,
  supportsDecoration,
  pastryFootprint,
} from "../shared/pastry-support.js";
import { plateRadius } from "../shared/assembly-profiles.js";
test("pastry seats respect real holes, curved cream and the complete body footprint", () => {
  assert.equal(pastryHeight("bk-pastry-donut", 0, 0), null);
  assert.equal(supportsDecoration("bk-pastry-donut", 0, 0, 0.58), false);
  assert.ok(
    pastryHeight("bk-pastry-cupcake", 0, 0) >
      pastryHeight("bk-pastry-cupcake", 2, 0) + 1,
  );
  for (const base of [
    "bk-pastry-eclair",
    "bk-pastry-cookie-heart",
    "bk-pastry-donut",
    "bk-pastry-cupcake",
  ]) {
    const s = normalize("cakes", { ...defaults("cakes"), base, pieces: 6 });
    assert.ok(
      cakeSurfaces(s)
        .filter((p) => p.id >= 0)
        .every((p) => p.asset === base),
    );
    for (const p of pastryPositions(s))
      assert.ok(Math.hypot(p.x, p.z) + pastryFootprint(base) < plateRadius(s));
  }
});
test("container openings use their body rim instead of handle and lid height", async () => {
  const profiles = JSON.parse(
    await readFile(
      new URL("../shared/container-mouths.json", import.meta.url),
      "utf8",
    ),
  );
  assert.ok(
    profiles["fl-wrap-basket-rattan"].lip > 14 &&
      profiles["fl-wrap-basket-rattan"].lip < 15,
  );
  assert.ok(profiles["fl-wrap-hatbox-round"].lip < 16);
  for (const p of Object.values(profiles))
    assert.ok(
      p.lip > 0 && p.mouthRadius > 0 && p.mouthRadius <= p.referenceWidth * 0.6,
    );
});
test("all 61 textured assets retain UVs and base, normal, roughness maps within budget", async () => {
  for (const a of catalogue.filter((a) => a.project !== "jewelry")) {
    const bytes = await readFile(
      new URL(`../shared/models/textured/${a.id}.glb`, import.meta.url),
    );
    const json = JSON.parse(
      bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
    );
    assert.ok(json.images.length >= 3, a.id);
    assert.ok(
      json.meshes.every((m) =>
        m.primitives.every((p) => p.attributes.TEXCOORD_0 !== undefined),
      ),
      a.id,
    );
    assert.ok(
      json.materials.some(
        (m) =>
          m.pbrMetallicRoughness?.baseColorTexture &&
          m.normalTexture &&
          m.pbrMetallicRoughness?.metallicRoughnessTexture,
      ),
      a.id,
    );
    const validation = await validator.validateBytes(new Uint8Array(bytes), {
      maxIssues: 5,
    });
    assert.equal(validation.issues.numErrors, 0, a.id);
    assert.ok(bytes.length <= 1048576, a.id);
    assert.ok(validation.info.totalTriangleCount <= 40000, a.id);
  }
});
test("mixed cake counts have non-overlapping seats inside each tier or plate", () => {
  for (const base of catalogue.filter(
    (a) => a.project === "cakes" && a.category === "base",
  ))
    for (const tiers of [1, 2, 3]) {
      const s = normalize("cakes", {
        ...defaults("cakes"),
        base: base.id,
        tiers,
        pieces: 6,
        decor: Object.keys(cakeParts).slice(0, 6),
        counts: Object.fromEntries(
          Object.keys(cakeParts).map((id) => [id, 14]),
        ),
      });
      const surfaces = cakeSurfaces(s),
        occupied = pastryBlockers(s);
      for (const id of [...s.decor].sort(
        (x, y) => cakeParts[y].footprint - cakeParts[x].footprint,
      ))
        for (let i = 0; i < s.counts[id]; i++)
          assert.ok(
            findCakeSeat(
              surfaces,
              occupied,
              cakeParts[id].footprint,
              s.layout,
              i,
            ),
            base.id + " " + id,
          );
    }
  assert.ok(
    cakeParts["bk-berry-strawberry"].size /
      cakeParts["bk-berry-blueberry"].size >
      3,
  );
});
test("fixed jewelry sockets expose compatible forms and pavé has calibrated multiple seats", async () => {
  for (const base of ["jw-set-pave-band", "jw-base-solitaire", "jw-set-halo"])
    assert.ok(
      compatibleStones({ ...defaults("jewelry"), base }).every(
        (a) => stoneShape(a.id) === "round",
      ),
    );
  for (const base of ["jw-base-cocktail", "jw-base-pendant"]) {
    const stones = compatibleStones({ ...defaults("jewelry"), base });
    assert.ok(stones.length > 0);
    assert.ok(stones.every((a) => stoneShape(a.id) === "oval"));
  }
  const map = JSON.parse(
    await readFile(
      new URL("../shared/pave-sockets.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(map.sockets.length, 44);
  assert.ok(
    map.sockets.every(
      (p) => p.diameter > 0.1 && p.diameter < 0.45 && p.normal.length === 3,
    ),
  );
  const plain = normalize("jewelry", {
    ...defaults("jewelry"),
    base: "jw-base-cuff-bracelet",
  });
  assert.equal(plain.stone, null);
});
test("six eclairs use separated rows rather than overlapping circular positions", () => {
  const positions = pastryPositions({
    ...defaults("cakes"),
    base: "bk-pastry-eclair",
    pieces: 6,
  });
  for (let i = 0; i < positions.length; i++)
    for (let j = i + 1; j < positions.length; j++)
      assert.ok(
        Math.abs(positions[i].x - positions[j].x) >= 14 ||
          Math.abs(positions[i].z - positions[j].z) >= 6,
      );
});

test("topper reservation prevents decoration seats from sharing the insertion area", () => {
  const requested = {
    ...defaults("cakes"),
    tiers: 3,
    topper: "bk-topper-crown",
    decor: ["bk-berry-strawberry", "bk-decor-sprinkle-ball"],
    counts: { "bk-berry-strawberry": 14, "bk-decor-sprinkle-ball": 60 },
  };
  const s = normalize("cakes", requested),
    surfaces = cakeSurfaces(s),
    occupied = cakeBlockers(s);
  for (const id of s.decor)
    for (let i = 0; i < s.counts[id]; i++)
      assert.ok(
        findCakeSeat(surfaces, occupied, cakeParts[id].footprint, s.layout, i),
      );
  const seat = occupied[0];
  for (const p of occupied.slice(1).filter((p) => p.surface === seat.surface))
    assert.ok(
      Math.hypot(p.x - seat.x, p.z - seat.z) >=
        p.footprint + seat.footprint + 0.159,
    );
});
test("pave and cocktail estimates charge for each visible main stone", () => {
  for (const [base, count] of [
    ["jw-set-pave-band", 44],
    ["jw-base-cocktail", 2],
  ]) {
    const s = normalize("jewelry", {
      ...defaults("jewelry"),
      base,
      stone: "jw-stone-diamond-08",
      setting: null,
      finding: [],
    });
    assert.equal(
      estimate("jewelry", s) - estimate("jewelry", { ...s, stone: null }),
      catalogue.find((a) => a.id === s.stone).price * count,
    );
  }
});

test("every decoration footprint encloses its measured, rotated source projection", async () => {
  const rows = JSON.parse(
    await readFile(
      new URL("../reports/revision-3/cake-footprints.json", import.meta.url),
      "utf8",
    ),
  );
  for (const r of rows)
    assert.ok(
      (r.pose === "flat"
        ? cakeParts[r.id].flatFootprint
        : cakeParts[r.id].footprint) >=
        r.projectedRadius * 1.035,
      `${r.id} ${r.pose}`,
    );
});
test("wreath stays on the edge while center and crescent have distinct positions", () => {
  const surface = [{ id: 0, x: 0, z: 0, y: 1, radius: 12, inner: 0 }],
    rows = {};
  for (const layout of ["center", "wreath", "crescent"]) {
    const occupied = [];
    for (let i = 0; i < 3; i++)
      findCakeSeat(surface, occupied, 0.58, layout, i);
    rows[layout] = occupied;
  }
  const mean = (r) =>
    r.reduce((n, p) => n + Math.hypot(p.x, p.z), 0) / r.length;
  assert.ok(mean(rows.wreath) > mean(rows.center) * 2);
  assert.ok(rows.crescent.every((p) => p.z > 0));
});

test("native flower colors remain selectable without leaking into other palettes", () => {
  assert.equal(
    normalize("flowers", { ...defaults("flowers"), palette: 4 }).palette,
    4,
  );
  assert.equal(
    normalize("cakes", { ...defaults("cakes"), palette: 4 }).palette,
    0,
  );
  assert.equal(
    normalize("jewelry", { ...defaults("jewelry"), palette: 5 }).palette,
    0,
  );
});

test("persisted decorations reject incompatible pastry coverings and hexagon glaze", () => {
  for (const base of [
    "bk-pastry-eclair",
    "bk-pastry-donut",
    "bk-struct-tier-hex",
  ]) {
    const s = normalize("cakes", {
      ...defaults("cakes"),
      base,
      decor: ["bk-decor-glaze-drip-ring", "bk-decor-shell-border"],
    });
    assert.ok(!s.decor.includes("bk-decor-glaze-drip-ring"));
    assert.ok(!Object.hasOwn(s.counts, "bk-decor-glaze-drip-ring"));
    if (base.includes("pastry"))
      assert.ok(!s.decor.includes("bk-decor-shell-border"));
  }
});

test("quantity increase stops at physical capacity before the numeric maximum", () => {
  const s = normalize("cakes", {
    ...defaults("cakes"),
    base: "bk-pastry-cupcake",
    pieces: 4,
    decor: ["bk-decor-wafer-roll", "bk-decor-sprinkle-star"],
    counts: { "bk-decor-wafer-roll": 14, "bk-decor-sprinkle-star": 60 },
  });
  assert.ok(s.counts["bk-decor-wafer-roll"] < 14);
  assert.equal(canIncreaseCount("cakes", s, "bk-decor-wafer-roll"), false);
  const reduced = normalize("cakes", {
    ...s,
    counts: { ...s.counts, "bk-decor-wafer-roll": 3 },
  });
  assert.equal(canIncreaseCount("cakes", reduced, "bk-decor-wafer-roll"), true);
});

test("twine follows an elliptical body without entering its back wall and retains UVs", () => {
  const wrapper = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 8, 10, 96),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  wrapper.scale.z = 0.6;
  const ribbon = new THREE.Mesh(
    new THREE.TorusGeometry(8.1, 0.22, 12, 96),
    new THREE.MeshBasicMaterial(),
  );
  ribbon.rotation.x = Math.PI / 2;
  const uv = ribbon.geometry.attributes.uv.array.slice();
  fitWrapTwine(ribbon, wrapper, {
    x: 0,
    y: 0,
    z: 0,
    rx: 8.1,
    rz: 8.1,
    limit: 10,
    thickness: 0.44,
  });
  const a = ribbon.geometry.attributes.position;
  ribbon.updateMatrixWorld(true);
  for (let i = 0; i < a.count; i++) {
    const p = new THREE.Vector3()
      .fromBufferAttribute(a, i)
      .applyMatrix4(ribbon.matrixWorld);
    assert.ok((p.x / 8) ** 2 + (p.z / 4.8) ** 2 > 1.01);
  }
  assert.deepEqual(ribbon.geometry.attributes.uv.array, uv);
});

test("long decorations lie on the plate and reserve their full horizontal projection", () => {
  const sparse = normalize("cakes", {
    ...defaults("cakes"),
    base: "bk-pastry-cookie-heart",
    pieces: 1,
    decor: ["bk-berry-cherry", "bk-decor-chocolate-shard"],
    counts: { "bk-berry-cherry": 14, "bk-decor-chocolate-shard": 14 },
  });
  assert.deepEqual(normalize("cakes", sparse), sparse);
  for (const base of [
    "bk-pastry-eclair",
    "bk-pastry-cookie-round",
    "bk-pastry-donut",
  ]) {
    const plated = normalize("cakes", {
      ...defaults("cakes"),
      base,
      pieces: 6,
      decor: ["bk-decor-wafer-roll"],
      counts: { "bk-decor-wafer-roll": 4 },
    });
    assert.equal(plated.counts["bk-decor-wafer-roll"], 4, base);
    const mixed = normalize("cakes", {
      ...plated,
      decor: ["bk-decor-wafer-roll", "bk-decor-caramel-spiral"],
      counts: { "bk-decor-wafer-roll": 4, "bk-decor-caramel-spiral": 4 },
    });
    assert.equal(mixed.counts["bk-decor-wafer-roll"], 4, base);
    assert.equal(mixed.counts["bk-decor-caramel-spiral"], 4, base);
  }
  const surfaces = [{ id: -1, x: 0, z: 0, y: 0.48, radius: 12, inner: 0 }];
  for (const id of ["bk-decor-wafer-roll", "bk-decor-chocolate-shard"]) {
    const p = cakeParts[id],
      occupied = [],
      seat = findCakeSeat(surfaces, occupied, p.footprint, "center", 0, p);
    assert.ok(seat.laidFlat);
    assert.equal(seat.footprint, p.flatFootprint);
    assert.ok(seat.footprint > p.footprint * 2);
  }
  const s = normalize("cakes", {
      ...defaults("cakes"),
      base: "bk-pastry-cookie-round",
      pieces: 4,
      decor: ["bk-decor-wafer-roll"],
      counts: { "bk-decor-wafer-roll": 8 },
    }),
    occupied = cakeBlockers(s);
  for (let i = 0; i < s.counts["bk-decor-wafer-roll"]; i++)
    assert.equal(
      findCakeSeat(
        cakeSurfaces(s),
        occupied,
        1.55,
        s.layout,
        i,
        cakeParts["bk-decor-wafer-roll"],
      ).surface,
      -1,
    );
});

test("decoration selection reports actual plate capacity rather than silently dropping a choice", () => {
  const single = normalize("cakes", { ...defaults("cakes"), pattern: null, base: "bk-pastry-brownie-bite", pieces: 1, decor: [], counts: {} });
  const saved = structuredClone(single);
  assert.equal(canSelectCakeDecoration(single, "bk-berry-strawberry"), false);
  assert.equal(canSelectCakeDecoration(single, "bk-berry-blueberry"), true);
  const set = normalize("cakes", { ...single, pieces: 4 });
  assert.equal(canSelectCakeDecoration(set, "bk-berry-strawberry"), true);
  assert.deepEqual(single, saved, "checking catalogue capacity must not change the saved composition");
});
