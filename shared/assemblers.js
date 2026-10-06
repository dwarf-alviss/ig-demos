import * as THREE from "three";
import { byId } from "./catalogue.js";
import { bounds, place, cylinder, stem, physical } from "./model-library.js";
const TAU = Math.PI * 2;
export async function buildCake(lib, s, palette) {
  const root = new THREE.Group(),
    pastry = s.base.includes("-pastry-");
  const board = cylinder(pastry ? 17 : 16, 0.45, "#ece5d8");
  root.add(board);
  let top = 0.45,
    radius = 12;
  const pastryAnchors = [];
  if (!pastry) {
    for (let i = 0; i < s.tiers; i++) {
      const diameter = 24 - i * 5;
      const tier = await lib.get(s.base, {
        size: diameter,
        axis: "x",
        color: palette,
      });
      const height = bounds(tier).getSize(new THREE.Vector3()).y;
      tier.scale.y *= 7.3 / height;
      place(tier, 0, top, 0);
      root.add(tier);
      top = bounds(tier).max.y;
      radius = diameter / 2;
    }
  } else {
    const horizontal = s.base.includes("cookie") || s.base.includes("donut"),
      side = s.base.includes("eclair");
    const size = s.base.includes("cupcake")
      ? 8
      : s.base.includes("cookie")
        ? 7
        : 8;
    for (let i = 0; i < s.pieces; i++) {
      const a = (i / s.pieces) * TAU,
        rr = s.pieces === 1 ? 0 : 9;
      const pastryModel = await lib.get(s.base, {
        size,
        axis: "max",
        color: s.base.includes("brownie")
          ? "#563427"
          : s.base.includes("cookie")
            ? "#c28c52"
            : s.base.includes("cupcake") || s.base.includes("donut")
              ? palette
              : "#c7a275",
        regional: true,
        rotation: horizontal
          ? [-Math.PI / 2, 0, 0]
          : side
            ? [-Math.PI / 2, 0, Math.PI / 2]
            : null,
      });
      place(pastryModel, Math.cos(a) * rr, 0.5, Math.sin(a) * rr);
      root.add(pastryModel);
      pastryAnchors.push({
        x: Math.cos(a) * rr,
        z: Math.sin(a) * rr,
        y: bounds(pastryModel).max.y,
      });
      top = Math.max(top, bounds(pastryModel).max.y);
    }
    radius = 12;
  }
  const normalTotal = s.decor
    .filter(
      (id) => !["glaze", "border", "sprinkle", "foil"].includes(byId[id].role),
    )
    .reduce((n, id) => n + (s.counts[id] || 3), 0);
  let slot = 0;
  const decorRanks = new Map(),
    normal = s.decor.filter(
      (id) => !["glaze", "border", "sprinkle", "foil"].includes(byId[id].role),
    );
  let rank = 0;
  for (let i = 0; i < 14; i++)
    for (const id of normal)
      if (i < (s.counts[id] || 3)) decorRanks.set(id + ":" + i, rank++);
  for (const id of s.decor) {
    const a = byId[id],
      count = s.counts[id] || 3;
    if (a.role === "glaze") {
      const cap = cylinder(radius + 0.035, 2.15, "#493023");
      place(cap, 0, top - 2.12, 0);
      root.add(cap);
      const glaze = await lib.get(id, {
        size: radius * 2.025,
        axis: "x",
        color: "#493023",
      });
      glaze.scale.y *= 4.2 / bounds(glaze).getSize(new THREE.Vector3()).y;
      place(glaze, 0, top - 4.05, 0);
      root.add(glaze);
      continue;
    }
    const actualCount =
      a.role === "border"
        ? Math.max(18, Math.floor(radius * 2.3))
        : a.role === "sprinkle"
          ? count
          : count;
    for (let i = 0; i < actualCount; i++) {
      let x,
        z,
        rotation = [0, 0, 0],
        size = a.size;
      if (a.role === "border") {
        const angle = (i / actualCount) * TAU;
        size = 2.4;
        x = Math.cos(angle) * (radius - 0.55);
        z = Math.sin(angle) * (radius - 0.55);
        rotation = [0, angle, Math.PI / 2];
      } else if (a.role === "sprinkle" || a.role === "foil") {
        const t = i * 2.3999,
          rr = Math.sqrt((i + 0.5) / actualCount) * (radius - 1.3);
        x = Math.cos(t) * rr;
        z = Math.sin(t) * rr;
        size = a.role === "sprinkle" ? 0.35 : 0.7;
        rotation = [a.role === "foil" ? Math.PI / 2 : 0, i * 0.7, 0];
      } else {
        slot++;
        const n = decorRanks.get(id + ":" + i) || 0,
          angle =
            s.layout === "wreath"
              ? n * 0.83
              : s.layout === "center"
                ? n * 2.3999
                : Math.PI * 0.42 +
                  (n / Math.max(1, normalTotal - 1)) * Math.PI * 1.13;
        const rr =
          s.layout === "center"
            ? Math.sqrt(n + 1) * 1.25
            : s.layout === "wreath"
              ? radius - a.size * 0.45 - 1
              : radius - 1.9 - (n % 2) * 2.15;
        x = Math.cos(angle) * rr;
        z = Math.sin(angle) * rr;
        rotation = [
          id.includes("strawberry") ? -0.95 : id.includes("wafer") ? -0.45 : 0,
          angle,
          id.includes("shard") ? -0.3 : 0,
        ];
        size *= 0.9 + (i % 3) * 0.055;
      }
      if (id.includes("rosette")) size *= 1.4;
      if (id.includes("blueberry")) size *= 1.4;
      if (pastry) {
        const p = pastryAnchors[(slot + i) % pastryAnchors.length];
        x = p.x + Math.cos(i * 2.4) * 0.6;
        z = p.z + Math.sin(i * 2.4) * 0.6;
      }
      const decor = await lib.get(id, {
        size,
        axis: "max",
        color: id.includes("wafer")
          ? "#b78953"
          : id.includes("rosette")
            ? "#f4dec5"
            : id.includes("macaron")
              ? "#ce98ab"
              : a.color,
        rotation: id.includes("wafer") ? null : rotation,
        regional: id.includes("berry"),
      });
      if (id.includes("wafer")) {
        const d = bounds(decor).getSize(new THREE.Vector3());
        decor.scale.x *= 0.7 / d.x;
        decor.scale.z *= 0.7 / d.z;
        decor.rotation.set(...rotation);
      }
      place(
        decor,
        x,
        pastry
          ? pastryAnchors[(slot + i) % pastryAnchors.length].y - 0.75
          : top - 0.09,
        z,
      );
      root.add(decor);
    }
  }
  if (s.topper) {
    const a = byId[s.topper];
    const topper = await lib.get(a.id, {
      size:
        a.id === "bk-berry-currant-red" ? 7 : a.id.includes("banner") ? 11 : 9,
      axis: "y",
      color: a.id.includes("heart")
        ? "#bc6f86"
        : a.id.includes("banner")
          ? "#b59178"
          : a.id === "bk-berry-currant-red"
            ? a.color
            : "#c5a86b",
      role: a.id.includes("crown") ? "metal" : "soft",
    });
    const height = bounds(topper).getSize(new THREE.Vector3()).y;
    place(
      topper,
      pastry ? pastryAnchors[0].x : 0,
      (pastry ? pastryAnchors[0].y : top) -
        height * (a.id === "bk-berry-currant-red" ? 0.13 : 0.33),
      pastry ? pastryAnchors[0].z : -radius * 0.22,
    );
    root.add(topper);
  }
  root.userData.measure = `${pastry ? s.pieces + " изделий" : s.tiers + " " + (s.tiers === 1 ? "ярус" : "яруса")} · ${pastry ? "34" : 24} см`;
  return root;
}
export async function buildFlowers(lib, s, palette) {
  const root = new THREE.Group();
  const pack = byId[s.pack];
  const cone = pack.id.includes("cone") || pack.id.includes("sleeve"),
    hat = pack.id.includes("hatbox"),
    basket = pack.id.includes("basket"),
    bottle = pack.id.includes("bottle"),
    glass = pack.id.includes("glass");
  const packWidth = hat ? 29 : bottle ? 15 : glass ? 13 : 20;
  const wrapper = await lib.get(pack.id, {
    size: packWidth,
    axis: "x",
    color: glass
      ? "#d2e1d9"
      : cone
        ? s.palette === 0
          ? "#e1cbd2"
          : "#d8c7a9"
        : hat
          ? "#dbc8c6"
          : basket
            ? "#b19b73"
            : "#d3c2a2",
    role: glass ? "glass" : "soft",
  });
  root.add(wrapper);
  const b = bounds(wrapper),
    h = b.max.y,
    centerX = hat ? -packWidth * 0.16 : 0;
  const lip = basket ? h * 0.47 : hat ? h * 0.9 : bottle ? h * 0.96 : h * 0.93;
  const entries = s.flowers.flatMap((id) =>
    Array.from({ length: s.counts[id] || 3 }, (_, i) => ({ id, index: i })),
  );
  const count = Math.min(33, entries.length),
    headDiameter =
      entries.map((x) => byId[x.id].size).reduce((a, b) => a + b, 0) /
      entries.length;
  const canopyRadius = Math.max(8, Math.sqrt(count) * headDiameter * 0.44),
    baseY = lip + (bottle ? 1.5 : -2.5);
  const arranged = entries.slice(0, count).sort((a, b) => a.index - b.index);
  for (let i = 0; i < count; i++) {
    const { id } = arranged[i],
      a = byId[id],
      rr = count === 1 ? 0 : canopyRadius * Math.sqrt((i + 0.1) / count),
      angle = i * 2.399963,
      x = centerX + Math.cos(angle) * rr,
      z = Math.sin(angle) * rr,
      y = baseY + (1 - Math.pow(rr / canopyRadius, 2)) * 3.2;
    const head = await lib.get(id, {
      size: a.size,
      axis: "x",
      color: id.includes("chamomile")
        ? "#f3ead5"
        : id.includes("anemone")
          ? s.palette === 1
            ? "#f2e6db"
            : palette
          : new THREE.Color(palette)
              .multiplyScalar(0.95 + (i % 3) * 0.06)
              .getHex(),
      role: "petal",
      rotation: id.includes("tulip") ? null : [-Math.PI / 2, 0, 0],
      regional: true,
    });
    const dir = new THREE.Vector3(
      Math.cos(angle) * rr * 0.038,
      1,
      Math.sin(angle) * rr * 0.038,
    ).normalize();
    const tilt = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir,
    );
    head.quaternion.premultiply(tilt);
    place(head, x, y, z);
    head.traverse((n) => {
      if (n.isMesh)
        n.material.clippingPlanes = [
          new THREE.Plane(new THREE.Vector3(0, 1, 0), -lip * 0.9),
        ];
    });
    root.add(head);
    const bb = bounds(head),
      headBottom = new THREE.Vector3(x, bb.min.y + 0.35, z),
      bottom = new THREE.Vector3(
        centerX + (x - centerX) * 0.1,
        cone ? 0.5 : h * 0.25,
        z * 0.1,
      );
    root.add(stem(bottom, headBottom, 0.09));
  }
  for (const [gIndex, id] of s.green.entries()) {
    const filler = id.includes("fill"),
      stemHeight = bottle ? 28 : Math.max(24, h * 0.86);
    for (let i = 0; i < (filler ? 3 : 4); i++) {
      const angle = (i / 4) * TAU + gIndex * 0.7;
      const branch = await lib.get(id, {
        size: stemHeight,
        axis: "y",
        color: byId[id].color,
      });
      branch.rotation.set(Math.sin(angle) * 0.2, angle, Math.cos(angle) * 0.22);
      place(
        branch,
        centerX + Math.cos(angle) * canopyRadius * 0.82,
        Math.max(0, baseY - stemHeight * 0.64),
        Math.sin(angle) * canopyRadius * 0.82,
      );
      branch.traverse((n) => {
        if (n.isMesh)
          n.material.clippingPlanes = [
            new THREE.Plane(new THREE.Vector3(0, 1, 0), -lip * 0.75),
          ];
      });
      root.add(branch);
    }
  }
  if (s.ribbon) {
    const twine = s.ribbon.includes("jute"),
      ribbon = await lib.get(s.ribbon, {
        size: twine ? packWidth * 0.5 : 7.5,
        axis: "x",
        color: twine ? "#ad9069" : s.palette === 1 ? "#a1ac82" : "#a8778f",
        rotation: twine ? [-Math.PI / 2, 0, 0] : null,
      });
    const bowY = cone
      ? h * 0.28
      : bottle
        ? h * 0.77
        : hat
          ? h * 0.45
          : h * 0.63;
    let frontZ = 0;
    wrapper.traverse((n) => {
      if (!n.isMesh) return;
      const a = n.geometry.getAttribute("position");
      for (let i = 0; i < a.count; i += 8) {
        const p = new THREE.Vector3(
          a.getX(i),
          a.getY(i),
          a.getZ(i),
        ).applyMatrix4(n.matrixWorld);
        if (
          Math.abs(p.y - bowY) < h * 0.05 &&
          Math.abs(p.x - centerX) < packWidth * 0.18
        )
          frontZ = Math.max(frontZ, p.z);
      }
    });
    frontZ += 0.35;
    place(ribbon, centerX, bowY, twine ? 0 : frontZ, "center");
    root.add(ribbon);
  }
  root.userData.measure = `${count} ${count === 1 ? "цветок" : "цветов"} · ручная сборка`;
  return root;
}
const ringIds = new Set([
  "jw-base-band-plain",
  "jw-base-cocktail",
  "jw-base-signet",
  "jw-base-solitaire",
  "jw-base-stacking-thin",
  "jw-set-bezel",
  "jw-set-halo",
]);
export async function buildJewelry(lib, s, palette) {
  const root = new THREE.Group();
  const isRing = ringIds.has(s.base),
    pendant = s.base.includes("pendant"),
    drop = s.base.includes("drop-earring"),
    stud = s.base.includes("stud-earring"),
    chain = s.base.includes("chain"),
    cuff = s.base.includes("cuff") || s.base === "jw-set-pave-band";
  const baseSize = isRing
    ? s.size / 10 + 0.35
    : pendant
      ? 2.4
      : drop
        ? 3
        : stud
          ? 0.65
          : chain
            ? 0.42
            : cuff
              ? 5.8
              : 1.8;
  let base;
  if (chain) {
    for (let i = 0; i < 11; i++) {
      const link = await lib.get(s.base, {
        size: 0.82,
        axis: "y",
        color: palette,
        role: "metal",
      });
      link.rotation.z = Math.PI / 2;
      link.rotation.x = i % 2 ? Math.PI / 2 : 0;
      place(link, (i - 5) * 0.54, 0.65, 0, "center");
      root.add(link);
    }
    base = root;
  } else {
    base = await lib.get(s.base, {
      size: baseSize,
      axis: isRing || cuff ? "x" : "y",
      color: palette,
      role: "metal",
      rotation: s.base === "jw-base-band-plain" ? [0, Math.PI / 2, 0] : null,
    });
    if (pendant && s.finding.includes("jw-part-bail-hinged")) {
      const bb = bounds(base);
      base.traverse((n) => {
        if (n.isMesh)
          n.material.clippingPlanes = [
            new THREE.Plane(new THREE.Vector3(0, -1, 0), bb.max.y * 0.77),
          ];
      });
    }
    root.add(base);
  }
  const b = bounds(base),
    size = b.getSize(new THREE.Vector3());
  let socket = {
    x: 0,
    y: b.max.y - 0.15,
    z: 0,
    face: "y",
    width: baseSize * 0.35,
  };
  if (s.base === "jw-base-solitaire")
    socket = {
      x: 0,
      y: b.max.y - 0.32,
      z: 0,
      face: "y",
      width: baseSize * 0.36,
    };
  else if (s.base === "jw-base-cocktail" || s.base === "jw-set-halo")
    socket = {
      x: 0,
      y: b.max.y - (s.base === "jw-set-halo" ? 0.45 : 0.22),
      z: 0,
      face: "y",
      width: baseSize * 0.42,
    };
  else if (pendant || drop)
    socket = {
      x: 0,
      y: size.y * (pendant ? 0.37 : 0.2),
      z: b.max.z * 0.6,
      face: "z",
      width: baseSize * (pendant ? 0.29 : 0.26),
    };
  else if (stud)
    socket = { x: 0, y: b.max.y - 0.08, z: 0, face: "y", width: 0.23 };
  else if (cuff)
    socket = {
      x: 0,
      y: size.y * 0.48,
      z: b.max.z - 0.07,
      face: "z",
      width: s.base === "jw-base-ear-cuff" ? 0.26 : 0.65,
    };
  else if (chain) socket = { x: 0, y: 0.03, z: 0.15, face: "z", width: 0.44 };
  const integrated = [
    "jw-base-solitaire",
    "jw-base-cocktail",
    "jw-set-halo",
    "jw-set-bezel",
    "jw-base-stud-earring",
    "jw-base-pendant",
    "jw-base-drop-earring",
  ];
  const mount =
    s.setting ||
    (!integrated.includes(s.base) && s.stone ? "jw-set-prong4" : null);
  if (mount) {
    const a = byId[mount],
      prong = a.id.includes("prong");
    const setting = await lib.get(a.id, {
      size: socket.width * 1.32,
      axis: prong ? "x" : "x",
      color: palette,
      role: "metal",
      rotation:
        a.id === "jw-set-baguette"
          ? [0, 0, Math.PI / 2]
          : !prong && socket.face === "y"
            ? [-Math.PI / 2, 0, 0]
            : prong && socket.face === "z"
              ? [Math.PI / 2, 0, 0]
              : null,
    });
    if (socket.face === "y") {
      place(setting, socket.x, socket.y, socket.z);
      socket.y =
        bounds(setting).min.y +
        bounds(setting).getSize(new THREE.Vector3()).y * 0.58;
      socket.width *= prong ? 0.9 : 0.84;
    } else {
      place(setting, socket.x, socket.y, socket.z, "center");
      socket.z = bounds(setting).max.z - 0.08;
      socket.width *= 0.8;
    }
    root.add(setting);
  }
  if (chain && s.stone) {
    const connector = await lib.get("jw-part-jump-ring", {
      size: 0.43,
      axis: "y",
      color: palette,
      role: "metal",
    });
    place(connector, 0, 0.4, 0.14, "center");
    root.add(connector);
  }
  if (s.stone) {
    const a = byId[s.stone],
      face = a.face || "y",
      rotation =
        face === socket.face
          ? null
          : face === "z"
            ? [-Math.PI / 2, 0, 0]
            : [Math.PI / 2, 0, 0];
    const stone = await lib.get(a.id, {
      size: socket.width,
      axis: "x",
      color: a.color,
      role: "gem",
      rotation,
    });
    const sb = bounds(stone),
      ss = sb.getSize(new THREE.Vector3());
    if (socket.face === "y") place(stone, socket.x, socket.y, socket.z);
    else {
      place(stone, socket.x, socket.y, socket.z + ss.z * 0.13, "center");
    }
    root.add(stone);
  }
  for (const id of s.finding) {
    const a = byId[id],
      wire = id.includes("ear-wire"),
      bail = id.includes("bail"),
      clasp = id.includes("clasp"),
      jump = id.includes("jump");
    const part = await lib.get(id, {
      size: wire ? 1.9 : bail ? 0.85 : clasp ? 1.0 : jump ? 0.4 : 0.9,
      axis: wire || bail || clasp ? "y" : "x",
      color: palette,
      role: "metal",
    });
    if (wire || bail)
      place(
        part,
        0,
        bail && pendant ? b.max.y * 0.76 - 0.08 : b.max.y - 0.08,
        0,
      );
    else if (clasp) place(part, size.x * 0.5 + 0.3, 0.65, 0, "center");
    else if (jump) place(part, 0, b.max.y - 0.06, 0, "center");
    else place(part, chain ? -0.8 : size.x * 0.62, 0.4, 0.25, "center");
    root.add(part);
  }
  const end = bounds(root);
  root.position.y -= end.min.y;
  root.userData.measure = isRing
    ? `Размер ${s.size} · ${byId[s.stone]?.name || "без камня"}`
    : `${byId[s.base].name} · ${palette === "#d1d8de" ? "серебро" : "металл"}`;
  return root;
}
export async function assembleProject(lib, kind, s, palette) {
  return kind === "cakes"
    ? buildCake(lib, s, palette)
    : kind === "flowers"
      ? buildFlowers(lib, s, palette)
      : buildJewelry(lib, s, palette);
}
