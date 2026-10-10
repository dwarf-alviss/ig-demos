import test from "node:test";
import { defaults, normalize } from "../shared/studio-state.js";
import { buildRecipeCake } from "../shared/recipe-cake.js";
import { recipes, ingredients } from "../shared/domain.js";
import { buildCake } from "../shared/assemblers.js";
import assert from "node:assert/strict";
import * as THREE from "three";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { ModelLibrary, bake } from "../shared/model-library.js";
import { preciseBounds } from "../shared/precise-fit.js";
import { nativeSetting, seatNativeGem } from "../shared/native-setting.js";
import { byId, catalogue } from "../shared/catalogue.js";
import { stoneShape } from "../shared/jewelry-rules.js";
import profiles from "../shared/setting-sockets.json" with { type: "json" };
import { disposeTree } from "../shared/scene-utils.js";

class LocalLibrary extends ModelLibrary {
  async original(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const bytes = await readFile(
      new URL(`../shared/${byId[id].url}`, import.meta.url),
    );
    const g = await this.loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    const root = bake(g.scene);
    root.traverse((n) => {
      if (n.isMesh && byId[id].project !== "jewelry")
        n.material = new THREE.MeshStandardMaterial();
    });
    disposeTree(g.scene);
    this.cache.set(id, root);
    return root;
  }
}

test("calibrated openings belong to the exact native metal assets", async () => {
  for (const [id, p] of Object.entries(profiles)) {
    const bytes = await readFile(
      new URL(`../shared/${byId[id].url}`, import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      p.sourceHash,
      id,
    );
    assert.ok(p.hole.area > 100 && p.hole.boundary.length > 30, id);
  }
});

test("every native figured cut retains its proportions and seats in both face planes", async () => {
  const lib = new LocalLibrary();
  try {
    for (const mount of Object.keys(profiles)) {
      const shape = mount.slice(7);
      const stones = catalogue.filter(
        (a) => a.category === "stone" && stoneShape(a.id) === shape,
      );
      assert.ok(stones.length > 0, mount);
      for (const asset of stones)
        for (const face of ["y", "z"]) {
          const setting = await nativeSetting(
            lib,
            mount,
            { x: 0.3, y: 2, z: 0.4, width: 0.7, face },
            "#c9a866",
            asset.id,
          );
          if (asset.id === "jw-stone-diamond-03")
            assert.equal(
              setting.profile.orientationQuarter,
              0,
              "diamond heart notch",
            );
          if (asset.id === "jw-stone-gem-41")
            assert.equal(
              setting.profile.orientationQuarter,
              3,
              "colored heart notch",
            );
          const stone = await seatNativeGem(lib, asset.id, setting);
          const pivot = stone.children[0],
            native = pivot.children[0];
          assert.equal(pivot.scale.x, pivot.scale.y, asset.id);
          assert.equal(pivot.scale.y, pivot.scale.z, asset.id);
          // Compare geometry in the same local plane, without trusting reported metrics.
          native.removeFromParent();
          native.updateMatrixWorld(true);
          const projected = preciseBounds(native).getSize(new THREE.Vector3());
          pivot.add(native);
          stone.updateMatrixWorld(true);
          const angle = pivot.rotation.y,
            swap = Math.abs(Math.sin(angle)) > 0.5;
          const w = (swap ? projected.z : projected.x) * pivot.scale.x;
          const d = (swap ? projected.x : projected.z) * pivot.scale.z;
          const h = setting.profile.hole;
          assert.ok(
            Math.abs(w / ((h.max[0] - h.min[0]) * setting.width) - 1.035) <
              1e-5,
            asset.id + " width",
          );
          assert.ok(
            Math.abs(d / ((h.max[1] - h.min[1]) * setting.width) - 1.035) <
              1e-5,
            asset.id + " depth",
          );
          const plane = new THREE.Vector3(0, 1, 0).transformDirection(
            stone.matrixWorld,
          );
          assert.ok(
            plane.dot(
              face === "y"
                ? new THREE.Vector3(0, 1, 0)
                : new THREE.Vector3(0, 0, 1),
            ) > 0.999999,
          );
          const actual = stone.localToWorld(pivot.position.clone()),
            expected = setting.root.localToWorld(pivot.position.clone());
          assert.ok(
            actual.distanceTo(expected) < 1e-9,
            asset.id + " shared seat frame",
          );
          if (face === "y")
            assert.ok(
              Math.abs(preciseBounds(setting.root).min.y - 2) < 1e-8,
              mount + " physical bottom",
            );
          disposeTree(setting.root);
          disposeTree(stone);
        }
    }
  } finally {
    for (const root of lib.cache.values()) disposeTree(root);
  }
});

test("native four and six prongs reach every compatible gem perimeter", async () => {
  const { fittedNativeProngs, outlineAt } = await import(
    "../shared/native-prongs.js"
  );
  const { convexHull } = await import("../shared/fitted-cast.js");
  const { compatibleStones } = await import("../shared/jewelry-rules.js");
  const { default: prongs } = await import("../shared/prong-sockets.json", {
    with: { type: "json" },
  });
  const lib = new LocalLibrary();
  try {
    for (const mount of Object.keys(prongs)) {
      const bytes = await readFile(
        new URL(`../shared/${byId[mount].url}`, import.meta.url),
      );
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        prongs[mount].sourceHash,
      );
      for (const asset of compatibleStones({
        base: "jw-base-band-plain",
        setting: mount,
        pattern: null,
      }))
        for (const face of ["y", "z"]) {
          const width = 0.7 * 1.32,
            pair = await fittedNativeProngs(
              lib,
              mount,
              asset.id,
              { x: 0.3, y: 2, z: 0.4, width: 0.7, face },
              "#c9a866",
            );
          const gem = pair.stone.children[0];
          assert.equal(gem.scale.x, gem.scale.y);
          assert.equal(gem.scale.y, gem.scale.z);
          pair.stone.updateMatrixWorld(true);
          pair.root.updateMatrixWorld(true);
          const cloud = [];
          gem.traverse((n) => {
            if (!n.isMesh) return;
            const a = n.geometry.attributes.position;
            for (let i = 0; i < a.count; i++)
              cloud.push(
                pair.root.worldToLocal(
                  new THREE.Vector3()
                    .fromBufferAttribute(a, i)
                    .applyMatrix4(n.matrixWorld),
                ),
              );
          });
          const hull = convexHull(cloud.map((p) => [p.x, p.z])),
            seat = pair.stone.userData.nativeSeat.girdle;
          const metal = pair.root.children[0];
          for (const cap of prongs[mount].caps) {
            const angle = Math.atan2(cap.center[2], cap.center[0]),
              dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
              radius = outlineAt(hull, angle);
            const origin = pair.root.localToWorld(
              dir
                .clone()
                .multiplyScalar(radius - width * 0.05)
                .setY(seat + width * 0.007),
            );
            const ray = new THREE.Raycaster(
              origin,
              dir.clone().transformDirection(pair.root.matrixWorld),
            );
            const hit = ray.intersectObject(metal, true)[0];
            assert.ok(
              hit && hit.distance < width * 0.12,
              `${mount}/${asset.id}/${face}: open prong gap`,
            );
          }
          disposeTree(pair.root);
          disposeTree(pair.stone);
        }
    }
  } finally {
    for (const root of lib.cache.values()) disposeTree(root);
  }
});

test("each native ring uses its measured finger cavity at both size limits", async () => {
  const { buildJewelry } = await import("../shared/assemblers.js");
  const { default: rings } = await import("../shared/native-ring-sizes.json", {
    with: { type: "json" },
  });
  const lib = new LocalLibrary();
  try {
    for (const [id, profile] of Object.entries(rings))
      for (const size of [16, 24]) {
        const root = await buildJewelry(
          lib,
          {
            base: id,
            stone: null,
            setting: null,
            finding: [],
            counts: {},
            size,
          },
          "#c9a866",
        );
        root.updateMatrixWorld(true);
        const box = preciseBounds(root),
          h = box.max.y - box.min.y;
        const center = new THREE.Vector3(
          box.getCenter(new THREE.Vector3()).x +
            profile.center[profile.view === "side" ? 2 : 0] * h,
          box.min.y + profile.center[1] * h,
          box.getCenter(new THREE.Vector3()).z,
        );
        const hits = [-1, 1].map(
          (sign) =>
            new THREE.Raycaster(
              center,
              new THREE.Vector3(sign, 0, 0),
            ).intersectObject(root, true)[0],
        );
        assert.ok(hits.every(Boolean), id + " open cavity rays");
        assert.ok(
          Math.abs(hits.reduce((v, hit) => v + hit.distance, 0) - size / 10) <
            0.025,
          `${id}/${size}: wrong finger diameter`,
        );
        disposeTree(root);
      }
  } finally {
    for (const root of lib.cache.values()) disposeTree(root);
  }
});
test("every native flower enters each vase above its real opening at both count limits", async () => {
  const { buildFlowers } = await import("../shared/assemblers.js");
  const lib = new LocalLibrary();
  try {
    for (const asset of catalogue.filter(
      (a) => a.project === "flowers" && a.category === "flowers",
    ))
      for (const pack of [
        "fl-vase-bottle-ceramic",
        "fl-vase-glass-cylinder",
        "fl-vase-kraft-bucket",
      ])
        for (const count of [1, 15]) {
          const root = await buildFlowers(
            lib,
            {
              pack,
              flowers: [asset.id],
              counts: { [asset.id]: count },
              green: [],
              ribbon: null,
              palette: 0,
            },
            "#d9a6b4",
          );
          const a = root.userData.assembly;
          assert.equal(a.crown.length, count);
          for (const head of root.children.filter(
            (n) => n.userData.asset === asset.id,
          ))
            head.traverse((n) => {
              if (n.isMesh)
                assert.equal(
                  n.material.clippingPlanes,
                  null,
                  `${asset.id}/${pack}: original petals are clipped`,
                );
            });
          for (const head of a.crown) {
            assert.ok(
              head.attachment[1] >= a.lip + 1 - 1e-6,
              `${asset.id}/${pack}/${count}: calyx below vase lip`,
            );
            assert.ok(
              Math.abs(head.mouthPoint[1] - a.lip - 0.16) < 1e-6,
              `${asset.id}/${pack}/${count}: stem enters the side of the vase`,
            );
          }
          disposeTree(root);
        }
  } finally {
    for (const root of lib.cache.values()) disposeTree(root);
  }
});
test("native integrated sockets keep each compatible cut uniform and in contact with their actual metal", async () => {
  const { buildJewelry } = await import("../shared/assemblers.js");
  const { integratedSockets } = await import("../shared/integrated-setting.js");
  const { compatibleStones } = await import("../shared/jewelry-rules.js");
  const { convexHull } = await import("../shared/fitted-cast.js");
  const { outlineAt } = await import("../shared/native-prongs.js");
  const lib = new LocalLibrary();
  try {
    for (const [id, profile] of Object.entries(integratedSockets)) {
      const bytes = await readFile(
        new URL("../shared/" + byId[id].url, import.meta.url),
      );
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        profile.sourceHash,
      );
      for (const asset of compatibleStones({ base: id, setting: null }))
        for (const size of [16, 24]) {
          const root = await buildJewelry(
            lib,
            {
              base: id,
              stone: asset.id,
              setting: null,
              finding: [],
              counts: {},
              size,
            },
            "#c9a866",
          );
          root.updateMatrixWorld(true);
          const base = root.children[0],
            metal = preciseBounds(base),
            h = metal.max.y - metal.min.y;
          const mounts = root.children.filter(
            (n) => n.userData.nativeSeat?.base === id,
          );
          assert.equal(mounts.length, profile.sockets.length);
          for (const mount of mounts) {
            const cut = mount.children[0];
            assert.equal(cut.scale.x, cut.scale.y);
            assert.equal(cut.scale.y, cut.scale.z);
            const center = new THREE.Vector3(
                ...mount.userData.nativeSeat.openingCenter,
              ),
              cloud = [];
            mount.traverse((n) => {
              if (!n.isMesh) return;
              const p = n.geometry.attributes.position;
              for (let i = 0; i < p.count; i++) {
                const point = new THREE.Vector3()
                  .fromBufferAttribute(p, i)
                  .applyMatrix4(n.matrixWorld)
                  .sub(center);
                cloud.push([point.x, profile.face === "z" ? point.y : point.z]);
              }
            });
            const hull = convexHull(cloud),
              diameter = Math.max(...cloud.map((p) => Math.hypot(...p))) * 2;
            const good = [];
            const angles =
              profile.sockets[mounts.indexOf(mount)].hole.caliperSamples?.map(
                (p) => p.angle,
              ) ||
              Array.from({ length: 120 }, (_, i) => (i / 120) * Math.PI * 2);
            for (const angle of angles) {
              const radius = outlineAt(hull, angle);
              const direction =
                profile.face === "z"
                  ? new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0)
                  : new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
              const ray = new THREE.Raycaster(center.clone(), direction);
              const hit = ray.intersectObject(base, true)[0];
              if (hit && Math.abs(hit.distance - radius) < diameter * 0.08)
                good.push(angle);
            }
            assert.ok(
              good.length >= 4,
              `${id}/${asset.id}/${size}: gem is not held by the native metal (${good.length} close directions)`,
            );
            const groups = new Set(
              good.map((angle) => Math.floor(angle / (Math.PI / 2))),
            );
            assert.ok(
              groups.size >= 3,
              `${id}/${asset.id}/${size}: contact exists on only one side`,
            );
            const normal = new THREE.Vector3(0, 1, 0).transformDirection(
              mount.matrixWorld,
            );
            assert.ok(
              normal.distanceTo(
                new THREE.Vector3(...mount.userData.nativeSeat.normal),
              ) < 1e-8,
            );
            assert.ok(Number.isFinite(h));
          }
          disposeTree(root);
        }
    }
  } finally {
    for (const root of lib.cache.values()) disposeTree(root);
  }
});

test("every extracted cut clears the native ring shank and raised galleries touch both metal parts", async () => {
  const { buildJewelry } = await import("../shared/assemblers.js");
  const { defaults, normalize } = await import("../shared/studio-state.js");
  const lib = new LocalLibrary();
  try {
    for (const asset of catalogue.filter((a) => a.category === "stone"))
      for (const baseId of ["jw-base-band-plain", "jw-base-stacking-thin"])
        for (const size of [16, 24]) {
          const state = normalize("jewelry", {
            ...defaults("jewelry"),
            pattern: null,
            base: baseId,
            stone: asset.id,
            setting: null,
            finding: [],
            size,
          });
          const root = await buildJewelry(lib, state, "#c9a866");
          root.updateMatrixWorld(true);
          const base = root.children.find((c) => c.userData.asset === baseId);
          const gem =
            root.children.find((c) => c.userData.nativeSeat) ||
            root.children.find((c) => c.userData.asset === asset.id);
          assert.ok(gem, asset.id);
          const bb = preciseBounds(base),
            gb = preciseBounds(gem);
          assert.ok(
            gb.min.y >= bb.max.y + 0.0249,
            `${baseId}/${asset.id}/${size}: pavilion intersects the shank`,
          );
          const gallery = root.children.find(
            (c) => c.userData.component === "native-ring-gallery",
          );
          if (gallery) {
            const frame = root.children.find(
              (c) => c !== base && c !== gem && c !== gallery,
            );
            for (const connection of gallery.userData.pavilionClearance
              .connections) {
              const start = new THREE.Vector3(...connection.start),
                end = new THREE.Vector3(...connection.end);
              const ray = new THREE.Raycaster(
                start.clone().add(new THREE.Vector3(0, 0.05, 0)),
                new THREE.Vector3(0, -1, 0),
              );
              assert.ok(
                ray
                  .intersectObject(base, true)
                  .some((h) => h.point.distanceTo(start) < 1e-5),
                "gallery misses actual shank surface",
              );
              let nearest = Infinity;
              frame.traverse((n) => {
                if (!n.isMesh) return;
                const p = n.geometry.attributes.position;
                for (let i = 0; i < p.count; i++)
                  nearest = Math.min(
                    nearest,
                    new THREE.Vector3()
                      .fromBufferAttribute(p, i)
                      .applyMatrix4(n.matrixWorld)
                      .distanceTo(end),
                  );
              });
              assert.ok(
                nearest < 1e-5,
                "gallery misses the original setting geometry",
              );
            }
          }
          disposeTree(root);
        }
  } finally {
    lib.dispose();
  }
});

test("rotated food rests on the actual cake surface, rather than its empty bounding-box corners", async () => {
  const lib = new LocalLibrary();
  try {
    for (const base of ["bk-struct-tier-round", "bk-struct-tier-hex"])
      for (const tiers of [1, 3])
        for (const id of [
          "bk-berry-cherry",
          "bk-berry-strawberry",
          "bk-berry-blueberry",
          "bk-berry-raspberry",
          "bk-berry-blackberry",
          "bk-decor-wafer-roll",
          "bk-decor-chocolate-shard",
        ]) {
          const state = normalize("cakes", {
            ...defaults("cakes"),
            pattern: null,
            base,
            tiers,
            decor: [id],
            counts: { [id]: 3 },
            topper: null,
          });
          const root = await buildCake(lib, state, "#eee4ce");
          root.updateMatrixWorld(true);
          const supports = root.children.filter(
            (n) => n.userData.asset === base,
          );
          const items = root.children.filter((n) => n.userData.asset === id);
          assert.equal(items.length, 3, id);
          for (const item of items) {
            const low = new THREE.Vector3(0, Infinity, 0);
            item.traverse((n) => {
              if (!n.isMesh) return;
              const a = n.geometry.getAttribute("position");
              for (let i = 0; i < a.count; i++) {
                const p = new THREE.Vector3()
                  .fromBufferAttribute(a, i)
                  .applyMatrix4(n.matrixWorld);
                if (p.y < low.y) low.copy(p);
              }
            });
            const ray = new THREE.Raycaster(
              new THREE.Vector3(low.x, 50, low.z),
              new THREE.Vector3(0, -1, 0),
            );
            const hit = ray.intersectObjects(supports, true)[0];
            assert.ok(
              hit,
              `${base}/${tiers}/${id}: real support beneath the lowest vertex`,
            );
            const gap = low.y - hit.point.y;
            assert.ok(
              gap < 0.15 && gap > -0.18,
              `${base}/${tiers}/${id}: actual contact gap ${gap} cm`,
            );
          }
          disposeTree(root);
        }
  } finally {
    lib.dispose();
  }
});

test("recipe fruit seats use real transformed bottoms on every flat cake recipe", async () => {
  const lib = new LocalLibrary();
  try {
    for (const recipe of Object.values(recipes).filter(
      (r) => !r.nativeBase && !["macaron", "paris-brest"].includes(r.type),
    )) {
      const selected = recipe.compatibleDecor.filter((id) =>
        ingredients[id].asset?.startsWith("bk-berry-"),
      );
      for (const ingredient of selected) {
        const state = normalize("cakes", {
          ...defaults("cakes"),
          pattern: recipe.id,
          foodDecor: [ingredient],
          foodCounts: { [ingredient]: 3 },
          tiers: 1,
          topper: null,
        });
        if (!state.foodDecor.includes(ingredient)) continue;
        const root = await buildRecipeCake(lib, state);
        root.updateMatrixWorld(true);
        const items = root.children.filter(
          (n) => n.userData.asset === ingredients[ingredient].asset,
        );
        assert.ok(items.length > 0, recipe.id);
        for (const item of items) {
          const box = preciseBounds(item),
            center = box.getCenter(new THREE.Vector3());
          const support = root.children.filter(
            (n) => n !== item && !n.userData.asset?.startsWith("bk-berry-"),
          );
          const ray = new THREE.Raycaster(
            new THREE.Vector3(center.x, 50, center.z),
            new THREE.Vector3(0, -1, 0),
          );
          const hit = ray.intersectObjects(support, true)[0];
          assert.ok(hit, recipe.id);
          const gap = box.min.y - hit.point.y;
          assert.ok(
            gap < 0.12 && gap > -0.2,
            `${recipe.id}/${ingredient}: actual contact gap ${gap} cm`,
          );
        }
        disposeTree(root);
      }
    }
  } finally {
    lib.dispose();
  }
});

test("basket greenery follows the actual flower crown rather than the tall handle", async () => {
  const { buildFlowers } = await import("../shared/assemblers.js");
  const { greeneryProfiles } = await import("../shared/assembly-profiles.js");
  const lib = new LocalLibrary();
  try {
    for (const flower of [
      "fl-flower-anemone",
      "fl-flower-rose-garden",
      "fl-flower-lily-oriental",
    ])
      for (const green of Object.keys(greeneryProfiles)) {
        const root = await buildFlowers(
          lib,
          {
            pack: "fl-wrap-basket-rattan",
            flowers: [flower],
            counts: { [flower]: 7 },
            green: [green],
            ribbon: null,
            palette: 0,
          },
          "#d9a6b4",
        );
        const headTop = Math.max(
          ...root.children
            .filter((n) => n.userData.asset === flower)
            .map((n) => preciseBounds(n).max.y),
        );
        for (const branch of root.children.filter(
          (n) => n.userData.asset === green,
        ))
          assert.ok(
            preciseBounds(branch).max.y <=
              headTop + greeneryProfiles[green].height + 0.5,
            `${flower}/${green}: greenery is raised to the basket handle`,
          );
        assert.ok(root.userData.assembly.widthCm <= 27);
        if (flower === "fl-flower-anemone") assert.ok(root.userData.assembly.widthCm < 22, "small flowers need the smaller basket variant");
        const support = root.children.find(
          (node) => node.userData.role === "floral-support",
        );
        assert.ok(support, "basket requires a fitted stem support");
        const radius = support.geometry.parameters.radiusTop;
        for (const anchor of support.userData.anchors) {
          assert.ok(
            Math.hypot(
              anchor[0] - support.position.x,
              anchor[2] - support.position.z,
            ) <=
              radius - 0.6,
          );
          assert.ok(Math.abs(anchor[1] - support.position.y) <= 1.1);
        }
        if (flower === "fl-flower-anemone")
          assert.ok(
            radius < 5,
            "small crown must not expose a basket-wide foam disc",
          );
        disposeTree(root);
      }
  } finally {
    for (const root of lib.cache.values()) disposeTree(root);
  }
});
