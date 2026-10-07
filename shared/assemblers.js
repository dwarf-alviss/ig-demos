import { pastryHeight } from "./pastry-support.js";
import { fitWrapTwine } from "./wrap-twine.js";
import containerMouths from "./container-mouths.json" with { type: "json" };
import * as THREE from "three";
import { byId } from "./catalogue.js";
import { bounds, place, cylinder, stem, physical } from "./model-library.js";
import {
  cakeParts,
  containers,
  flowerHeads,
  findCakeSeat,
  pastryPositions,
  plateRadius,
  cakeBlockers,
  topperSeat,
  greeneryProfiles,
} from "./assembly-profiles.js";
import { cakeSlice } from "./cake-slice.js";
import { requiredSetting } from "./jewelry-rules.js";
import paveSockets from "./pave-sockets.json" with { type: "json" };
import { fittedCast } from "./fitted-cast.js";
const TAU = Math.PI * 2;
export async function buildCake(lib, s, palette) {
  const root = new THREE.Group(),
    pastry = s.base.includes("-pastry-");
  const board = cylinder(plateRadius(s), 0.45, "#ece5d8");
  root.add(board);
  let top = 0.45,
    radius = 12;
  const pastryAnchors = [],
    surfaces = [],
    occupied = [];
  const supportMeshes = new Map([[-1, board]]),
    supportRay = new THREE.Raycaster();
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
      supportMeshes.set(i, tier);
      top = bounds(tier).max.y;
      radius = diameter / 2;
      surfaces.push({
        id: i,
        x: 0,
        z: 0,
        y: top,
        radius: s.base.includes("hex") ? diameter / 2.33 : radius,
        inner: i < s.tiers - 1 ? (diameter - 5) / 2 + 0.1 : 0,
      });
    }
  } else {
    const horizontal = s.base.includes("cookie") || s.base.includes("donut"),
      side = s.base.includes("eclair");
    const size = {
      "bk-pastry-cupcake": 7.5,
      "bk-pastry-cookie-heart": 7,
      "bk-pastry-cookie-round": 6.5,
      "bk-pastry-eclair": 12,
      "bk-pastry-profiterole": 4.5,
      "bk-pastry-donut": 8,
      "bk-pastry-brownie-bite": 5,
    }[s.base];
    surfaces.push({
      id: -1,
      x: 0,
      z: 0,
      y: 0.48,
      radius: plateRadius(s) - 0.5,
      inner: 0,
    });
    for (let i = 0; i < s.pieces; i++) {
      const a = (i / s.pieces) * TAU,
        rr = s.pieces === 1 ? 0 : s.base.includes("eclair") ? 11 : 9;
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
      const position = pastryPositions(s)[i];
      place(pastryModel, position.x, 0.5, position.z);
      root.add(pastryModel);
      supportMeshes.set(i, pastryModel);
      pastryAnchors.push({
        x: position.x,
        z: position.z,
        y: bounds(pastryModel).max.y,
      });
      top = Math.max(top, bounds(pastryModel).max.y);
      surfaces.push({
        id: i,
        asset: s.base,
        x: position.x,
        z: position.z,
        y: bounds(pastryModel).max.y,
        radius: s.base.includes("eclair")
          ? 1.6
          : s.base.includes("profiterole")
            ? 1.35
            : s.base.includes("cupcake")
              ? 2.1
              : size * 0.37,
        inner: s.base.includes("donut") ? 1.2 : 0,
      });
    }
    radius = 12;
  }
  occupied.push(...cakeBlockers(s, surfaces));
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
  for (const id of [...s.decor].sort(
    (x, y) =>
      (s.base.includes("pastry")
        ? cakeParts[y]?.flatFootprint || cakeParts[y]?.footprint || 0
        : cakeParts[y]?.footprint || 0) -
      (s.base.includes("pastry")
        ? cakeParts[x]?.flatFootprint || cakeParts[x]?.footprint || 0
        : cakeParts[x]?.footprint || 0),
  )) {
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
        size = cakeParts[id]?.size || a.size;
      if (a.role === "border") {
        const angle = (i / actualCount) * TAU;
        size = 2.4;
        let edgeRadius = s.base.includes("hex")
          ? (radius * Math.cos(Math.PI / 6)) /
              Math.cos(((angle + Math.PI / 6) % (Math.PI / 3)) - Math.PI / 6) -
            0.65
          : radius - 0.55;
        if (s.base.includes("hex")) {
          const tier = supportMeshes.get(s.tiers - 1);
          tier.updateMatrixWorld(true);
          supportRay.set(
            new THREE.Vector3(0, top - 0.15, 0),
            new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
          );
          const edge = supportRay.intersectObject(tier, true).at(-1);
          if (edge) edgeRadius = Math.hypot(edge.point.x, edge.point.z) - 0.65;
        }
        x = Math.cos(angle) * edgeRadius;
        z = Math.sin(angle) * edgeRadius;
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
      if (cakeParts[id]) size = cakeParts[id].size;
      if (cakeParts[id]?.rotation) rotation = [...cakeParts[id].rotation];
      let seat;
      if (a.role !== "border") {
        seat = findCakeSeat(
          surfaces,
          occupied,
          cakeParts[id]?.footprint || size * 0.42,
          s.layout,
          i,
          cakeParts[id],
        );
        if (!seat) throw Error("Слишком много декора для выбранной формы");
        x = seat.x;
        z = seat.z;
        if (seat.laidFlat) rotation = [...cakeParts[id].flatRotation];
      }
      if (pastry && !seat) {
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
      if (seat?.laidFlat)
        decor.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), i * 0.83);
      if (seat) {
        const target = surfaces.find((t) => t.id === seat.surface),
          support = supportMeshes.get(seat.surface);
        support.updateMatrixWorld(true);
        supportRay.set(
          new THREE.Vector3(x, top + 30, z),
          new THREE.Vector3(0, -1, 0),
        );
        const hit = supportRay.intersectObject(support, true)[0];
        if (hit) seat.y = hit.point.y;
        if (target.asset) {
          place(decor, x, 0, z);
          const height = bounds(decor).getSize(new THREE.Vector3()).y;
          let supportY = -Infinity;
          decor.traverse((n) => {
            if (!n.isMesh) return;
            const pos = n.geometry.getAttribute("position");
            for (
              let j = 0;
              j < pos.count;
              j += Math.max(1, Math.floor(pos.count / 500))
            ) {
              const p = new THREE.Vector3()
                .fromBufferAttribute(pos, j)
                .applyMatrix4(n.matrixWorld);
              if (p.y > height * 0.45) continue;
              const roof = pastryHeight(
                target.asset,
                p.x - target.x,
                p.z - target.z,
              );
              if (roof !== null)
                supportY = Math.max(supportY, roof + 0.5 - p.y);
            }
          });
          if (Number.isFinite(supportY)) seat.y = supportY;
        }
      }
      place(
        decor,
        x,
        seat
          ? seat.y - 0.03
          : pastry
            ? pastryAnchors[(slot + i) % pastryAnchors.length].y - 0.03
            : top - 0.03,
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
    const seat = topperSeat(s, surfaces);
    if (pastry && !seat.plate) {
      const width = bounds(topper).getSize(new THREE.Vector3()).x;
      const available = surfaces.find((p) => p.id === 0).radius * 1.5;
      if (width > available) topper.scale.multiplyScalar(available / width);
    }
    const height = bounds(topper).getSize(new THREE.Vector3()).y;
    place(
      topper,
      seat.x,
      seat.y -
        Math.min(
          seat.plate ? 0 : pastry ? 0.24 : 1.2,
          height * (a.id === "bk-berry-currant-red" ? 0.13 : 0.33),
        ),
      seat.z,
    );
    root.add(topper);
  }
  if (!pastry) {
    for (const child of root.children)
      if (child !== board) child.position.x -= 5;
    const slice = cakeSlice(s.filling, palette);
    slice.position.set(12, 0.47, 6);
    root.add(slice);
  }
  root.userData.assembly = { surfaces, decorSeats: occupied };
  root.userData.measure = `${pastry ? s.pieces + " изделий" : s.tiers + " " + (s.tiers === 1 ? "ярус" : "яруса")} · ${pastry ? (plateRadius(s) * 2).toFixed(0) : 24} см`;
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
  const container = containers[pack.id];
  const packWidth = container.width;
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
    centerX = packWidth * container.centerX;
  const measuredMouth = containerMouths[pack.id];
  const lip = measuredMouth?.lip ?? h * (cone ? 1.02 : container.lip),
    mouthRadius = measuredMouth?.mouthRadius ?? packWidth * container.mouth;
  const entries = s.flowers.flatMap((id) =>
    Array.from({ length: s.counts[id] || 3 }, (_, i) => ({ id, index: i })),
  );
  const count = Math.min(33, entries.length),
    headDiameter =
      entries
        .map((x) => flowerHeads[x.id].diameter)
        .reduce((a, b) => a + b, 0) / entries.length;
  const canopyRadius = Math.max(8, Math.sqrt(count) * headDiameter * 0.44),
    baseY = lip + (bottle ? 7 : cone ? 0.8 : 1.1);
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
      size: flowerHeads[id].diameter,
      nativeColor: s.palette === 4,
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
      rotation: flowerHeads[id].upright ? null : [-Math.PI / 2, 0, 0],
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
    place(head, x, y, z, "center");
    head.traverse((n) => {
      if (n.isMesh) {
        n.material.clipShadows = true;
        n.material.clippingPlanes = [
          new THREE.Plane(new THREE.Vector3(0, 1, 0), -lip),
        ];
      }
    });
    root.add(head);
    const bb = bounds(head),
      headBottom = new THREE.Vector3(
        x,
        Math.max(lip + 1.5, bb.max.y - (bb.max.y - bb.min.y) * 0.32),
        z,
      ),
      bottom = new THREE.Vector3(
        centerX + Math.cos(angle) * Math.min(mouthRadius * 0.25, 1.1),
        h * container.base,
        Math.sin(angle) * Math.min(mouthRadius * 0.25, 1.1),
      );
    const neck = new THREE.Vector3(
      centerX + Math.cos(angle) * Math.min(mouthRadius * 0.4, 1.2),
      lip,
      Math.sin(angle) * Math.min(mouthRadius * 0.4, 1.2),
    );
    root.add(stem(bottom, neck, 0.09));
    root.add(stem(neck, headBottom, 0.09));
  }
  const petalTop = bounds(root).max.y;
  for (const [gIndex, id] of s.green.entries()) {
    const filler = id.includes("fill"),
      stemHeight = greeneryProfiles[id].length;
    for (let i = 0; i < (filler ? 3 : 4); i++) {
      const angle = (i / (filler ? 3 : 4)) * TAU + gIndex * 0.7,
        profile = greeneryProfiles[id];
      const branch = await lib.get(id, {
        size: stemHeight,
        axis: "y",
        color: byId[id].color,
      });
      const branchWidth = bounds(branch).getSize(new THREE.Vector3()).x;
      const widthLimit = filler
        ? Math.max(5, canopyRadius * 0.75)
        : Math.max(6, canopyRadius * 0.95);
      if (branchWidth > widthLimit) {
        branch.scale.x *= widthLimit / branchWidth;
        branch.scale.z *= widthLimit / branchWidth;
      }
      branch.rotation.set(
        Math.sin(angle) * profile.lean,
        angle,
        Math.cos(angle) * profile.lean,
      );
      const branchHeight = bounds(branch).getSize(new THREE.Vector3()).y;
      place(
        branch,
        centerX + Math.cos(angle) * canopyRadius * profile.spread,
        petalTop + profile.height * (0.65 + (i % 2) * 0.18) - branchHeight,
        Math.sin(angle) * canopyRadius * profile.spread,
      );
      branch.traverse((n) => {
        if (n.isMesh) {
          n.material.clipShadows = true;
          n.material.clippingPlanes = [
            new THREE.Plane(new THREE.Vector3(0, 1, 0), -(lip + 0.15)),
          ];
        }
      });
      root.add(branch);
      const neck = new THREE.Vector3(
        centerX + Math.cos(angle) * Math.min(mouthRadius * 0.25, 0.8),
        lip + 0.18,
        Math.sin(angle) * Math.min(mouthRadius * 0.25, 0.8),
      );
      root.add(
        stem(new THREE.Vector3(centerX, h * container.base, 0), neck, 0.07),
      );
      root.add(
        stem(
          neck,
          new THREE.Vector3(
            centerX + Math.cos(angle) * canopyRadius * profile.spread,
            lip + 1.5,
            Math.sin(angle) * canopyRadius * profile.spread,
          ),
          0.07,
        ),
      );
    }
  }
  if (s.ribbon) {
    const twine = s.ribbon.includes("jute"),
      ribbon = await lib.get(s.ribbon, {
        size: twine ? packWidth * 0.5 : 7.5,
        axis: "x",
        color: twine ? "#ad9069" : s.palette === 1 ? "#a1ac82" : "#a8778f",
        rotation: twine ? [Math.PI / 2, 0, 0] : null,
      });
    const bowY = cone
      ? h * 0.28
      : bottle
        ? h * 0.77
        : hat
          ? h * 0.45
          : basket
            ? h * 0.25
            : h * 0.63;
    let ringCenterZ = 0,
      ringCenterY = 0,
      ringFit;
    if (twine) {
      wrapper.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(),
        origin = new THREE.Vector3(centerX, bowY, 0);
      const radius = (direction, limit = packWidth * 0.6) => {
        ray.set(origin, new THREE.Vector3(...direction));
        return ray
          .intersectObject(wrapper, true)
          .filter((h) => h.distance <= limit)
          .at(-1)?.distance;
      };
      const rz = radius([0, 0, 1]),
        lz = radius([0, 0, -1]),
        bodyLimit = hat && rz && lz ? (rz + lz) * 0.58 : packWidth * 0.6;
      const rx = radius([1, 0, 0], bodyLimit),
        lx = radius([-1, 0, 0], bodyLimit);
      const originalBounds = bounds(ribbon),
        dimensions = originalBounds.getSize(new THREE.Vector3()),
        originalCenter = originalBounds.getCenter(new THREE.Vector3());
      const sidePoints = [];
      ribbon.traverse((n) => {
        if (!n.isMesh) return;
        const positions = n.geometry.getAttribute("position");
        for (let i = 0; i < positions.count; i++) {
          const p = new THREE.Vector3()
            .fromBufferAttribute(positions, i)
            .applyMatrix4(n.matrixWorld);
          if (Math.abs(p.x - originalCenter.x) > dimensions.x * 0.495)
            sidePoints.push(p);
        }
      });
      const middle = (values) =>
        values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
      const sourceRingZ = middle(sidePoints.map((p) => p.z)),
        sourceRingY = middle(sidePoints.map((p) => p.y));
      ringCenterY = sourceRingY - originalCenter.y;
      if (rx && lx) ribbon.scale.x *= (rx + lx + 0.22) / dimensions.x;
      if (rz && lz) {
        const zFactor =
          (rz + lz + 0.22) / (2 * (sourceRingZ - originalBounds.min.z));
        ribbon.scale.z *= zFactor;
        ribbon.updateMatrixWorld(true);
        ringCenterZ =
          (sourceRingZ - originalCenter.z) * zFactor - (rz - lz) * 0.5;
        if (rx && lx)
          ringFit = {
            x: centerX + (rx - lx) * 0.5,
            y: bowY,
            z: (rz - lz) * 0.5,
            rx: (rx + lx + 0.22) * 0.5,
            rz: (rz + lz + 0.22) * 0.5,
            limit: Math.max(rx + lx, rz + lz) * 0.62,
            thickness:
              Math.max(...sidePoints.map((p) => p.y)) -
              Math.min(...sidePoints.map((p) => p.y)),
          };
      }
    }
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
    place(
      ribbon,
      ringFit?.x ?? centerX,
      bowY - ringCenterY,
      twine ? -ringCenterZ : frontZ,
      "center",
    );
    if (ringFit) fitWrapTwine(ribbon, wrapper, ringFit);
    root.add(ribbon);
  }
  root.userData.assembly = {
    container: pack.id,
    lip,
    mouthRadius,
    centerX,
    flowers: count,
  };
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
        if (n.isMesh) {
          n.material.clipShadows = true;
          n.material.clippingPlanes = [
            new THREE.Plane(new THREE.Vector3(0, -1, 0), bb.max.y * 0.77),
          ];
        }
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
  let facePlane = null,
    castDimensions = null;
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
      y: b.max.y - (s.base === "jw-set-halo" ? 0.29 : 0.26),
      z: 0,
      face: "y",
      width: baseSize * (s.base === "jw-set-halo" ? 0.28 : 0.29),
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
    (!integrated.includes(s.base) && s.stone && s.base !== "jw-set-pave-band"
      ? requiredSetting(s.stone)
      : null);
  if (mount?.startsWith("custom-")) {
    const setting = await fittedCast(lib, s.stone, socket, palette, mount);
    if (socket.face === "z") setting.rotation.x = Math.PI / 2;
    place(
      setting,
      socket.x,
      socket.y,
      socket.z,
      socket.face === "y" ? "bottom" : "center",
    );
    facePlane =
      socket.face === "y"
        ? bounds(setting).max.y + (mount === "custom-bezel" ? 0.01 : -0.045)
        : bounds(setting).max.z - 0.025;
    root.add(setting);
  } else if (mount) {
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
      facePlane = bounds(setting).max.y - (prong ? 0.04 : -0.03);
    } else {
      place(setting, socket.x, socket.y, socket.z, "center");
      socket.z = bounds(setting).max.z - 0.08;
      socket.width *= 0.8;
      facePlane = bounds(setting).max.z - 0.025;
    }
    if (!prong) castDimensions = bounds(setting).getSize(new THREE.Vector3());
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
  if (s.base === "jw-set-pave-band" && s.stone) {
    for (const socket of paveSockets.sockets) {
      const stone = await lib.get(s.stone, {
        size: socket.diameter,
        axis: "x",
        role: "gem",
        color: byId[s.stone].color,
        rotation:
          (byId[s.stone].face || "y") === "y" ? [Math.PI / 2, 0, 0] : null,
      });
      const normal = new THREE.Vector3(...socket.normal),
        center = new THREE.Vector3(socket.x, socket.y, socket.z);
      stone.quaternion.premultiply(
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          normal,
        ),
      );
      place(stone, ...center.toArray(), "center");
      root.add(stone);
    }
    root.userData.assembly = { stoneCount: paveSockets.sockets.length };
  }
  if (s.stone && s.base !== "jw-set-pave-band") {
    const a = byId[s.stone],
      face = a.face || "y",
      rotation =
        face === socket.face
          ? null
          : face === "z"
            ? [-Math.PI / 2, 0, 0]
            : [Math.PI / 2, 0, 0];
    let stone = await lib.get(a.id, {
      size: socket.width,
      axis: "x",
      color: a.color,
      role: "gem",
      rotation,
    });
    if (mount === "jw-set-baguette") {
      if (socket.face === "y") stone.rotateY(Math.PI / 2);
      else stone.rotateZ(Math.PI / 2);
      stone.updateMatrixWorld(true);
    }
    if (mount === "jw-set-heart" && a.pack === "gem") {
      if (socket.face === "y") stone.rotateY(-Math.PI / 2);
      else stone.rotateZ(-Math.PI / 2);
      stone.updateMatrixWorld(true);
    }
    if (castDimensions) {
      const wrapper = new THREE.Group();
      wrapper.add(stone);
      stone = wrapper;
      stone.updateMatrixWorld(true);
      const measured = bounds(stone).getSize(new THREE.Vector3());
      const ratios = {
        "jw-set-baguette": [0.65, 0.68],
        "jw-set-heart": [0.63, 0.66],
        "jw-set-marquise": [0.64, 0.72],
        "jw-set-pear": [0.64, 0.68],
      }[mount];
      if (ratios) {
        stone.scale.x *= (castDimensions.x * ratios[0]) / measured.x;
        const depth = socket.face === "y" ? "z" : "y";
        stone.scale[depth] *=
          (castDimensions[depth] * ratios[1]) / measured[depth];
      }
      stone.updateMatrixWorld(true);
    }
    const sb = bounds(stone),
      ss = sb.getSize(new THREE.Vector3());
    if (socket.face === "y")
      place(
        stone,
        socket.x,
        mount === "custom-bezel"
          ? facePlane - 0.035 - (a.pack === "gem" ? ss.y * 0.45 : 0)
          : (facePlane ??
              b.max.y - (s.base === "jw-set-bezel" ? -0.035 : 0.04)) - ss.y,
        socket.z,
      );
    else {
      place(
        stone,
        socket.x,
        socket.y,
        (facePlane ?? b.max.z + 0.025) - ss.z / 2,
        "center",
      );
    }
    root.add(stone);
    if (s.base === "jw-base-cocktail") {
      stone.position.x -= baseSize * 0.235;
      const twin = stone.clone(true);
      twin.position.x += baseSize * 0.47;
      root.add(twin);
      root.userData.assembly = { stoneCount: 2 };
    }
    if (s.base === "jw-set-halo") {
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * TAU;
        const accent = await lib.get("jw-stone-diamond-08", {
          size: baseSize * 0.062,
          axis: "x",
          color: "#f0f6ff",
          role: "gem",
          rotation: [-Math.PI / 2, 0, 0],
        });
        place(
          accent,
          Math.cos(angle) * baseSize * 0.21,
          b.max.y - 0.22,
          Math.sin(angle) * baseSize * 0.21,
        );
        root.add(accent);
      }
      root.userData.assembly = { stoneCount: 17 };
    }
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
