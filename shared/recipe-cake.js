import * as THREE from "three";
import { recipes, ingredients, layerStack } from "./domain.js";
import { domainMaterial } from "./domain-materials.js";
import { bounds, place } from "./model-library.js";
import { preciseBounds, precisePlace } from "./precise-fit.js";
import { byId } from "./catalogue.js";
import { recipeSeats, supportSizes } from "./recipe-layout.js";
import { pastryHeight } from "./pastry-support.js";
import { foodPose } from "./food-pose.js";
import { outline } from "./recipe-outline.js";

function volume(shape, height, material, y, bevel = 0.035) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel > 0,
    bevelSegments: 3,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 72,
  });
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position,
    normal = geo.attributes.normal,
    uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++)
    uv.setXY(
      i,
      (Math.abs(normal.getY(i)) > 0.7
        ? pos.getX(i)
        : pos.getX(i) + pos.getZ(i)) / 3,
      (Math.abs(normal.getY(i)) > 0.7 ? pos.getZ(i) : pos.getY(i)) / 3,
    );
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = y;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
function piped(radius, height, id = "cream") {
  const points = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    points.push(
      new THREE.Vector2(
        radius * Math.pow(1 - t, 0.55) * (0.9 + 0.08 * Math.sin(t * 30)),
        height * t,
      ),
    );
  }
  const geo = new THREE.LatheGeometry(points, 64),
    pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i),
      y = pos.getY(i),
      a = Math.atan2(z, x),
      k = 1 + 0.12 * Math.sin(a * 8 + y * 1.5);
    pos.setXYZ(i, x * k, y, z * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, domainMaterial(id));
  m.castShadow = true;
  return m;
}
export function foodDetail(id) {
  const root = new THREE.Group(),
    c = ingredients[id],
    mat = domainMaterial(c.material);
  const mesh = (g, m = mat) => {
    const n = new THREE.Mesh(g, m);
    n.castShadow = n.receiveShadow = true;
    root.add(n);
    return n;
  };
  if (["piped-shell", "piped-rope", "cream-dollop"].includes(id)) {
    root.add(
      piped(id === "piped-shell" ? 0.7 : 0.6, id === "piped-shell" ? 0.8 : 1.2),
    );
  } else if (id === "chocolate-curl") {
    const curve = new THREE.CatmullRomCurve3(
      Array.from({ length: 48 }, (_, i) => {
        const t = (i / 47) * Math.PI * 3.2;
        return new THREE.Vector3(
          Math.cos(t) * (0.35 + t * 0.015),
          (i / 47) * 0.95,
          Math.sin(t) * (0.35 + t * 0.015),
        );
      }),
    );
    const geo = new THREE.TubeGeometry(curve, 80, 0.055, 8, false);
    mesh(geo);
  } else if (id === "almond-flake") {
    const m = mesh(new THREE.SphereGeometry(0.5, 24, 12));
    m.scale.set(0.65, 0.045, 1);
    m.position.y = 0.04;
  } else if (id === "lemon-slice") {
    const rind = mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 0.16, 64),
      domainMaterial("lemon-curd", { color: "#eebc39" }),
    );
    rind.position.y = 0.08;
    for (let k = 0; k < 10; k++) {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.absarc(
        0,
        0,
        1.23,
        (k * Math.PI) / 5 + 0.04,
        ((k + 1) * Math.PI) / 5 - 0.04,
      );
      s.closePath();
      root.add(
        volume(
          s,
          0.04,
          domainMaterial("lemon-curd", { color: "#f4d780" }),
          0.17,
          0.01,
        ),
      );
    }
  } else if (id === "strawberry-half") {
    const profile = [
      new THREE.Vector2(0.02, 0),
      new THREE.Vector2(0.22, 0.2),
      new THREE.Vector2(0.47, 0.55),
      new THREE.Vector2(0.64, 1),
      new THREE.Vector2(0.6, 1.4),
      new THREE.Vector2(0.4, 1.65),
      new THREE.Vector2(0, 1.75),
    ];
    mesh(new THREE.LatheGeometry(profile, 48, Math.PI / 2, Math.PI));
    const shape = new THREE.Shape();
    profile.forEach((p, i) => shape[i ? "lineTo" : "moveTo"](p.x, p.y));
    [...profile].reverse().forEach((p) => shape.lineTo(-p.x, p.y));
    shape.closePath();
    const fleshGeometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.035,
        bevelEnabled: false,
      }),
      fp = fleshGeometry.attributes.position,
      uv = fleshGeometry.attributes.uv;
    for (let k = 0; k < fp.count; k++)
      uv.setXY(k, fp.getX(k) / 1.28 + 0.5, fp.getY(k) / 1.75);
    const pixels = new Uint8Array(128 * 256 * 4);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 128; x++) {
        const u = (x / 127 - 0.5) * 2,
          v = y / 255,
          core = Math.exp((-u * u) / (0.025 + 0.035 * v)) * 0.7,
          vein = Math.sin(Math.atan2(u, v - 0.2) * 29 + v * 15) * 0.04,
          noise = Math.sin(x * 127.1 + y * 311.7) * 0.023;
        const k = (y * 128 + x) * 4;
        pixels[k] = Math.round(213 + core * 30 + (vein + noise) * 70);
        pixels[k + 1] = Math.round(76 + core * 92 + (vein + noise) * 100);
        pixels[k + 2] = Math.round(66 + core * 88 + (vein + noise) * 80);
        pixels[k + 3] = 255;
      }
    const cutMap = new THREE.DataTexture(pixels, 128, 256, THREE.RGBAFormat);
    cutMap.colorSpace = THREE.SRGBColorSpace;
    cutMap.needsUpdate = true;
    const cutMaterial = domainMaterial("strawberry", { color: "#ffffff" });
    cutMaterial.map = cutMap;
    const flesh = mesh(fleshGeometry, cutMaterial);
    flesh.position.z = -0.018;
    for (let k = 0; k < 30; k++) {
      const a = Math.PI / 2 + ((k % 10) / 9) * Math.PI,
        y = 0.4 + Math.floor(k / 10) * 0.37,
        r = 0.44 + 0.15 * Math.sin(y);
      const seed = mesh(
        new THREE.SphereGeometry(0.025, 8, 6),
        domainMaterial("nut", { color: "#e2bf6c" }),
      );
      seed.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    }
  } else {
    const size =
      id === "hazelnut" ? 0.65 : id === "pistachio-kernel" ? 0.42 : 0.24;
    const m = mesh(new THREE.SphereGeometry(size, 28, 20));
    m.scale.set(
      id === "pistachio-kernel" ? 0.6 : 1,
      id === "pistachio-kernel" ? 0.8 : 1,
      1.15,
    );
    m.position.y = size;
    m.material.color.set(
      id === "pistachio-kernel"
        ? "#9aaf63"
        : c.material === "nut"
          ? "#ad7a4c"
          : mat.color,
    );
  }
  root.userData.component = id;
  return root;
}
export async function buildRecipeCake(lib, state) {
  const baseRecipe = recipes[state.pattern],
    recipe = baseRecipe && {
      ...baseRecipe,
      cover: state.cover || baseRecipe.cover,
      shape:
        ["vanilla-celebration", "mini-buttercream"].includes(baseRecipe.id) &&
        state.base?.includes("hex")
          ? "hex"
          : baseRecipe.shape,
    },
    root = new THREE.Group();
  if (!recipe) throw new Error("Unknown recipe");
  const tiers = Math.min(state.tiers || 1, recipe.maxTiers),
    isSmall = [
      "macaron",
      "eclair",
      "profiterole",
      "paris-brest",
      "cupcake",
      "donut",
      "cookie",
      "brownie",
    ].includes(recipe.type);
  const diameter = recipe.diameterCm,
    r = diameter / 2;
  const pitch = recipe.type === "eclair" ? 14 : diameter + 1;
  const rows = Math.ceil((state.pieces || 4) / 2);
  const plateRadius = isSmall
    ? Math.max(10, Math.hypot(pitch * 0.5, (rows - 1) * pitch * 0.5) + r + 1)
    : r + 8;
  const plateGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0.12),
      new THREE.Vector2(plateRadius - 1, 0.12),
      new THREE.Vector2(plateRadius, 0.38),
      new THREE.Vector2(plateRadius + 0.2, 0.5),
      new THREE.Vector2(plateRadius, 0.61),
      new THREE.Vector2(plateRadius - 1, 0.28),
      new THREE.Vector2(0, 0.28),
    ],
    96,
  );
  const plate = new THREE.Mesh(
    plateGeo,
    new THREE.MeshPhysicalMaterial({
      color: "#f2ede5",
      roughness: 0.21,
      clearcoat: 0.45,
    }),
  );
  plate.receiveShadow = true;
  root.add(plate);
  const stack = layerStack(recipe),
    total = stack.reduce((n, l) => n + l.thickness, 0);
  const cover = recipe.cover && ingredients[recipe.cover];
  const cakeOffset = isSmall ? 0 : -3.5;
  let top = 0.32;
  const anchors = [];
  const addLayers = (
    slice = false,
    x = cakeOffset,
    z = 0,
    radius = r,
    start = 0.32,
  ) => {
    const group = new THREE.Group();
    group.userData.component = slice ? "recipe-slice" : "recipe-body";
    group.userData.tierRadiusCm = radius;
    for (const l of stack) {
      const material = domainMaterial(l.component.material, {
        color: l.component.id.includes("pistachio")
          ? "#bdc692"
          : l.component.id.includes("coffee")
            ? "#b38b67"
            : l.component.id === "ruby-cream"
              ? "#d790a0"
              : undefined,
      });
      const layer = volume(
        outline(recipe, radius, slice),
        l.thickness,
        material,
        start + l.bottom,
        0.018,
      );
      layer.userData = { component: l.component.id, thicknessCm: l.thickness };
      group.add(layer);
    }
    if (cover) {
      const finish = domainMaterial(cover.material, {
        color:
          recipe.finishColor ||
          (recipe.cover === "cream-coat"
            ? ["#f1e4ce", "#dfb0be", "#c9cda6", "#90705c"][state.palette]
            : undefined),
      });
      group.add(
        volume(
          outline(recipe, radius, slice),
          0.09,
          finish,
          start + total,
          recipe.shape === "heart" && !slice ? 0.18 : 0.025,
        ),
      );
      // A thin conformal lateral shell, rather than replacing the crumb or filling material.
      if (
        !slice &&
        !["fraisier", "opera", "tiramisu", "tart", "cheesecake"].includes(
          recipe.type,
        )
      ) {
        const shell = new THREE.Shape(
          outline(recipe, radius + 0.07, false).getPoints(144),
        );
        const hole = new THREE.Path(
          outline(recipe, radius - 0.04, false)
            .getPoints(144)
            .reverse(),
        );
        shell.holes.push(hole);
        group.add(
          volume(
            shell,
            total,
            finish,
            start,
            recipe.shape === "heart" ? 0.11 : 0.012,
          ),
        );
      }
    }
    group.position.set(x, 0, z);
    root.add(group);
    return group;
  };
  if (isSmall) {
    const pieces = state.pieces || 4;
    for (let i = 0; i < pieces; i++) {
      const x = pieces === 1 ? 0 : ((i % 2) - 0.5) * pitch,
        z =
          (Math.floor(i / 2) - (Math.ceil(pieces / 2) - 1) / 2) *
          (recipe.type === "eclair" ? 5 : pitch);
      if (recipe.nativeBase) {
        const item = await lib.get(recipe.nativeBase, {
          size: diameter,
          axis: "max",
          regional: true,
          rotation:
            recipe.type === "eclair"
              ? [-Math.PI / 2, 0, Math.PI / 2]
              : ["cookie", "donut"].includes(recipe.type)
                ? [-Math.PI / 2, 0, 0]
                : null,
        });
        place(item, x, 0.32, z);
        root.add(item);
        anchors.push({ x, z, y: bounds(item).max.y });
      } else if (recipe.type === "macaron") {
        const shellColor = {
          "macaron-raspberry": "#c97189",
          "macaron-pistachio": "#b6bf87",
          "macaron-caramel": "#c79563",
          "macaron-chocolate": "#795344",
          "macaron-vanilla": "#e6d1ae",
        }[recipe.id];
        for (const y of [0.8, 1.9]) {
          const g = new THREE.SphereGeometry(r, 64, 32);
          g.scale(1, 0.32, 1);
          const n = new THREE.Mesh(
            g,
            domainMaterial("joconde", { color: shellColor }),
          );
          n.position.set(x, y, z);
          n.castShadow = true;
          root.add(n);
          const feet = new THREE.Mesh(
            new THREE.TorusGeometry(r * 0.94, 0.16, 12, 72),
            domainMaterial("joconde", { color: shellColor }),
          );
          feet.rotation.x = Math.PI / 2;
          feet.position.set(x, y + (y < 1 ? 0.3 : -0.3), z);
          root.add(feet);
          const crumbs = new THREE.InstancedMesh(
              new THREE.SphereGeometry(0.055, 8, 6),
              domainMaterial("joconde", { color: shellColor }),
              180,
            ),
            helper = new THREE.Object3D();
          for (let k = 0; k < 180; k++) {
            const a = (k / 180) * Math.PI * 2;
            helper.position.set(
              x + Math.cos(a) * r * 0.96,
              y + (y < 1 ? 0.3 : -0.3) + Math.sin(k * 2.3) * 0.09,
              z + Math.sin(a) * r * 0.96,
            );
            helper.scale.set(1 + Math.sin(k) * 0.3, 0.7 + Math.cos(k) * 0.2, 1);
            helper.updateMatrix();
            crumbs.setMatrixAt(k, helper.matrix);
          }
          root.add(crumbs);
        }
        const filling = new THREE.Mesh(
          new THREE.CylinderGeometry(r * 0.93, r * 0.93, 0.43, 64),
          domainMaterial(stack[1].component.material),
        );
        filling.position.set(x, 1.36, z);
        root.add(filling);
      } else {
        for (const y of [0.8, 2.2]) {
          const geo = new THREE.TorusGeometry(r * 0.66, 0.6, 24, 128),
            p = geo.attributes.position;
          for (let j = 0; j < p.count; j++) {
            const a = Math.atan2(p.getY(j), p.getX(j)),
              ripple = 1 + 0.018 * Math.sin(a * 32);
            p.setXYZ(
              j,
              p.getX(j) * ripple,
              p.getY(j) * ripple,
              p.getZ(j) * (1 + 0.07 * Math.sin(a * 32)),
            );
          }
          geo.computeVertexNormals();
          const n = new THREE.Mesh(geo, domainMaterial("choux"));
          n.rotation.x = Math.PI / 2;
          n.position.set(x, y, z);
          n.castShadow = true;
          root.add(n);
        }
        for (let k = 0; k < 16; k++) {
          const cream = piped(0.56, 1, "cream");
          cream.material.color.set("#d99ba5");
          cream.position.set(
            x + Math.cos((k * Math.PI) / 8) * r * 0.66,
            1.15,
            z + Math.sin((k * Math.PI) / 8) * r * 0.66,
          );
          root.add(cream);
        }
        anchors.push({ x, z, y: 2.8 });
      }
    }
    top = recipe.heightCm + 0.32;
  } else {
    for (let tier = 0; tier < tiers; tier++) {
      const rt = r * Math.pow(0.72, tier);
      addLayers(false, cakeOffset, 0, rt, top);
      if (tier < tiers - 1) {
        for (let j = 0; j < 4; j++) {
          const dowel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, total, 12),
            domainMaterial("fondant"),
          );
          dowel.position.set(
            cakeOffset + Math.cos((j * Math.PI) / 2) * rt * 0.4,
            top + total / 2,
            Math.sin((j * Math.PI) / 2) * rt * 0.4,
          );
          dowel.userData.component = "structural-dowel";
          root.add(dowel);
        }
        const board = new THREE.Mesh(
          new THREE.CylinderGeometry(rt * 0.74, rt * 0.74, 0.08, 72),
          domainMaterial("fondant"),
        );
        board.position.set(cakeOffset, top + total + 0.1, 0);
        board.userData.component = "tier-board";
        root.add(board);
      }
      top += total + 0.18;
    }
    const piece = addLayers(
      true,
      recipe.shape === "rectangle" ? cakeOffset + r * 0.2 + 3 : cakeOffset + 4,
      recipe.shape === "rectangle" ? r * 0.67 + 1.6 : -1.6,
      r,
      0.32,
    );
    piece.rotation.y = 0;
    if (recipe.type === "fraisier")
      for (let k = 0; k < 25; k++) {
        const a = 0.7 + (k / 25) * (Math.PI * 2 - 0.85),
          berry = foodDetail("strawberry-half");
        berry.position.set(
          cakeOffset + Math.cos(a) * (r + 0.015),
          1.14,
          Math.sin(a) * (r + 0.015),
        );
        berry.rotation.y = -a + Math.PI / 2;
        berry.scale.set(1.2, 1.55, 1.2);
        berry.userData.component = "edge-strawberry-in-mousseline";
        root.add(berry);
      }
  }
  const allowed = recipe.compatibleDecor.map((id) => ingredients[id]);
  const decor = allowed.filter((c) => state.foodDecor?.includes(c.id));
  for (const seat of recipeSeats(state).seats) {
    if (seat.id === "topper") continue;
    const c = ingredients[seat.id];
    const n = c.asset
      ? await lib.get(c.asset, {
          size: c.sizeCm,
          axis: "max",
          regional: true,
          rotation: foodPose(
            c.asset,
            seat.index,
            Math.atan2(seat.z, seat.x),
            isSmall,
            isSmall ? "plate" : "cake",
          ),
          rotationOrder: "YXZ",
        })
      : foodDetail(c.id);
    if (c.id === "strawberry-half") {
      n.rotation.x = -Math.PI / 2;
      n.rotation.y = Math.atan2(seat.z, seat.x) + seat.index * 0.31;
    }
    const piece = seat.piece,
      px = state.pieces === 1 ? 0 : ((piece % 2) - 0.5) * pitch,
      pz =
        (Math.floor(piece / 2) - (Math.ceil((state.pieces || 4) / 2) - 1) / 2) *
        (recipe.type === "eclair" ? 5 : pitch);
    const anchor = anchors[piece],
      scale = recipe.nativeBase
        ? diameter / supportSizes[recipe.nativeBase]
        : 1,
      sample = recipe.nativeBase
        ? pastryHeight(recipe.nativeBase, seat.x / scale, seat.z / scale)
        : null;
    let y = isSmall
      ? (sample !== null
          ? 0.32 + sample * scale
          : anchor?.y || recipe.heightCm) - 0.03
      : top - 0.09 - (tiers - 1 - (seat.tier ?? tiers - 1)) * (total + 0.18);
    if (isSmall && recipe.nativeBase) {
      precisePlace(n, px + seat.x, 0, pz + seat.z);
      const b = preciseBounds(n),
        h = b.max.y - b.min.y;
      let supportY = -Infinity;
      n.traverse((mesh) => {
        if (!mesh.isMesh) return;
        const positions = mesh.geometry.attributes.position;
        for (
          let j = 0;
          j < positions.count;
          j += Math.max(1, Math.floor(positions.count / 800))
        ) {
          const p = new THREE.Vector3()
            .fromBufferAttribute(positions, j)
            .applyMatrix4(mesh.matrixWorld);
          if (p.y > h * 0.45) continue;
          const roof = pastryHeight(
            recipe.nativeBase,
            (p.x - px) / scale,
            (p.z - pz) / scale,
          );
          if (roof !== null)
            supportY = Math.max(supportY, 0.32 + roof * scale - p.y);
        }
      });
      if (Number.isFinite(supportY)) y = supportY - 0.025;
    }
    precisePlace(
      n,
      isSmall ? px + seat.x : cakeOffset + seat.x,
      y,
      isSmall ? pz + seat.z : seat.z,
    );
    root.add(n);
  }
  if (state.topper && ["sponge", "mini"].includes(recipe.type)) {
    const topper = await lib.get(state.topper, {
      size: Math.min(byId[state.topper].size || 5, recipe.diameterCm * 0.4),
      axis: "max",
      nativeColor: true,
    });
    place(topper, cakeOffset, top - 0.2, 0);
    root.add(topper);
  }
  root.userData = {
    pattern: recipe.id,
    assembly: {
      layerCount: stack.length,
      tiers,
      source: recipe.sources,
      components: stack.map((l) => l.component.id),
    },
    measure: `${recipe.name} · ${diameter} см · ${tiers} ярус`,
  };
  return root;
}
