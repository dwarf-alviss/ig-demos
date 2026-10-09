import { basketInteriorRadius, fitBasketInsertion } from "./basket-interior.js";
import { attachBasketStemLeaves } from "./flower-stem-leaves.js";
import { basketHandleContact } from "./basket-handle-contact.js";
import { clearRingPavilion } from "./mounted-gallery.js";
import { precisePlace } from "./precise-fit.js";
import { integratedSockets, seatIntegratedGems } from "./integrated-setting.js";
import ringSizes from "./native-ring-sizes.json" with { type: "json" };
import { branchCut } from "./branch-attachment.js";
import { fittedNativeProngs } from "./native-prongs.js";
import { nativeSetting, seatNativeGem } from "./native-setting.js";
import { pastryHeight } from "./pastry-support.js";
import { closeCableLink, attachNativeFindings } from "./finding-assembly.js";
import { foodPose } from "./food-pose.js";
import { buildRecipeCake } from "./recipe-cake.js";
import { buildConstructedJewelry } from "./constructed-jewelry.js";
import {
  buildComposedBouquet,
  floralLayout,
  paperWidth,
  stemMouthPoint,
} from "./composed-bouquet.js";
import { plants } from "./domain.js";
import { domainMaterial } from "./domain-materials.js";
import { paperRim, clearPaperEdge } from "./wrapper-rim.js";
import { fitWrapTwine } from "./wrap-twine.js";
import containerMouths from "./container-mouths.json" with { type: "json" };
import * as THREE from "three";
import { byId } from "./catalogue.js";
import {
  bounds,
  place,
  cylinder,
  stem,
  curvedStem,
  physical,
} from "./model-library.js";
import {
  nativeTierSurface,
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
        ...nativeTierSurface(s.base, diameter, i < s.tiers - 1),
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
        if (seat.rotation) rotation = [...seat.rotation];
      }
      if (
        id.includes("bk-berry-") ||
        ["bk-decor-crumble-cluster", "bk-decor-caramel-spiral"].includes(id)
      )
        rotation = foodPose(
          id,
          i,
          Math.atan2(z, x),
          Boolean(seat?.laidFlat),
          seat?.surface === -1 ? "plate" : "cake",
        );
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
        rotationOrder:
          id.includes("bk-berry-") ||
          ["bk-decor-crumble-cluster", "bk-decor-caramel-spiral"].includes(id)
            ? "YXZ"
            : "XYZ",
        regional: id.includes("berry"),
      });
      if (id.includes("wafer")) {
        if (!seat?.capsule) {
          const d = bounds(decor).getSize(new THREE.Vector3());
          decor.scale.x *= 0.7 / d.x;
          decor.scale.z *= 0.7 / d.z;
        }
        decor.rotation.set(...rotation, seat?.capsule ? "YXZ" : "XYZ");
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
          precisePlace(decor, x, 0, z);
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
      precisePlace(
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
  const entries = s.flowers.flatMap((id) =>
    Array.from({ length: s.counts[id] || 3 }, (_, i) => ({ id, index: i })),
  );
  const count = Math.min(33, entries.length),
    headDiameter =
      entries
        .map((x) => flowerHeads[x.id].diameter)
        .reduce((a, b) => a + b, 0) / entries.length;
  const arranged = entries
    .slice(0, count)
    .sort((a, b) =>
      basket
        ? (Object.values(plants).find((p) => p.asset === b.id)
            ?.headCoreRadiusCm || flowerHeads[b.id].diameter * 0.22) -
            (Object.values(plants).find((p) => p.asset === a.id)
              ?.headCoreRadiusCm || flowerHeads[a.id].diameter * 0.22) ||
          a.index - b.index
        : a.index - b.index,
    );
  const packWidth = cone
    ? paperWidth(
        entries.map((e) => ({
          plant: { headDiameterCm: flowerHeads[e.id].diameter },
        })),
        container.width,
      )
    : basket
      ? Math.min(
          container.width * Math.min(1.3, Math.max(1, Math.sqrt(count / 11))),
          Math.max(
            14,
            2 +
              Math.sqrt(
                entries.reduce(
                  (area, entry) => area + flowerHeads[entry.id].diameter ** 2,
                  0,
                ),
              ) *
                1.15,
          ),
        )
      : container.width;
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
  const rim = cone ? paperRim(wrapper, centerX, packWidth) : null;
  const containerSurface = rim || paperRim(wrapper, centerX, packWidth);
  const measurementScale =
    packWidth / (measuredMouth?.referenceWidth || packWidth);
  const lip =
      measuredMouth?.lip * measurementScale ||
      h * (cone ? 1.02 : container.lip),
    mouthRadius =
      measuredMouth?.mouthRadius * measurementScale ||
      packWidth * container.mouth;
  const handleContact = basket ? basketHandleContact(wrapper, lip) : null;
  const foamTop = lip - (basket ? 6 * (packWidth / container.width) : 2.1);
  let floralFoam;
  const interior = handleContact
    ? basketInteriorRadius(wrapper, centerX, foamTop)
    : null;
  const insertionRadius = interior
    ? Math.min(interior.radius - 0.65, Math.max(0.7, Math.sqrt(count) * 0.18))
    : null;
  const foamAnchors = [];
  if (hat || basket) {
    const foam = new THREE.Mesh(
      new THREE.CylinderGeometry(
        mouthRadius * 0.86,
        mouthRadius * 0.86,
        2.2,
        64,
      ),
      domainMaterial("leaf", { color: "#3c5134" }),
    );
    foam.position.set(centerX, foamTop - 1.1, 0);
    foam.castShadow = foam.receiveShadow = true;
    root.add(foam);
    floralFoam = foam;
  }
  const positions = floralLayout(
    arranged.map((e) => ({
      ...e,
      role: "focal",
      plant: Object.values(plants).find((p) => p.asset === e.id) || {
        headDiameterCm: flowerHeads[e.id].diameter,
      },
    })),
    { shape: "asymmetric-dome", density: 0.65 },
    bottle ? packWidth * 0.48 : mouthRadius,
  );
  const canopyRadius = Math.max(...positions.map((p) => Math.hypot(p.x, p.z))),
    baseY = (rim?.mean ?? lip) + (basket ? -3.0 : hat ? -1.1 : -0.8);
  const crown = [],
    flowerModels = [];
  for (let i = 0; i < count; i++) {
    const { id } = arranged[i],
      p = positions[i],
      a = byId[id],
      rr = Math.hypot(p.x, p.z),
      angle = Math.atan2(p.z, p.x),
      x = centerX + p.x,
      z = p.z,
      // Upright tulip cups need their previous rim clearance; lowering them sinks petals into the weave.
      y = baseY + p.y + (basket && flowerHeads[id].upright ? 1.9 : 0);
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
      Math.cos(angle) * rr * 0.075,
      1,
      Math.sin(angle) * rr * 0.075,
    ).normalize();
    const tilt = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir,
    );
    head.scale.y *= positions[i].entry.plant.headDepthCalibration || 1;
    head.quaternion.premultiply(tilt);
    place(head, x, y, z, "center");
    head.traverse((n) => {
      if (n.isMesh) n.material.clippingPlanes = null;
    });
    root.add(head);
    const centre = new THREE.Vector3(
      x,
      y + clearPaperEdge(head, rim, centerX, mouthRadius),
      z,
    );
    const ray = new THREE.Raycaster(
      centre.clone().addScaledVector(dir, -flowerHeads[id].diameter * 2),
      dir,
    );
    const hit = ray.intersectObject(head, true)[0];
    const headBottom = hit
      ? hit.point.clone().addScaledVector(dir, 0.06)
      : centre.clone().addScaledVector(dir, -flowerHeads[id].diameter * 0.2);
    if ((hat || basket) && headBottom.y < foamTop + 0.2) {
      const lift = foamTop + 0.2 - headBottom.y;
      head.position.y += lift;
      centre.y += lift;
      headBottom.y += lift;
    }
    if (
      handleContact &&
      (handleContact.intersects(head, p.radius) ||
        crown.some((c) => {
          const other = Object.values(plants).find(
            (plant) => plant.asset === c.asset,
          );
          return (
            new THREE.Vector3().fromArray(c.center).distanceTo(centre) <
            (p.radius +
              (other.headCoreRadiusCm ?? other.headDiameterCm * 0.22)) *
              0.98
          );
        }))
    ) {
      const original = head.position.clone(),
        originalCentre = centre.clone(),
        originalBottom = headBottom.clone();
      const side =
        Math.sign(
          new THREE.Vector3(centre.x - centerX, 0, centre.z).dot(
            handleContact.normal,
          ),
        ) || (i % 2 ? 1 : -1);
      let solved = false;
      search: for (const vertical of [
        0, -0.6, 0.6, -1.2, 1.2, -1.8, 1.8, -2.4, 2.4, 3, 3.6, 4.2, 4.8, 5.4, 6,
        6.6, 7.2, 7.8, 8.4, 9, 9.6, 10.2, 10.8, 11.4, 12,
      ])
        for (const distance of [
          0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 3.6, 4, 4.4, 4.8, 5.2, 5.6,
          6, 6.4, 6.8, 7.2, 7.6, 8,
        ]) {
          for (const sign of [side, -side]) {
            const shift = handleContact.normal
              .clone()
              .multiplyScalar(distance * sign);
            shift.y = vertical;
            const trialCentre = originalCentre.clone().add(shift),
              trialBottom = originalBottom.clone().add(shift);
            if (
              trialBottom.y < foamTop + 0.2 ||
              Math.hypot(trialCentre.x - centerX, trialCentre.z) >
                mouthRadius + flowerHeads[id].diameter * 0.35
            )
              continue;
            const coreClear = positions.every((other, j) => {
              if (j >= i) return true;
              const point =
                j < i
                  ? new THREE.Vector3().fromArray(crown[j].center)
                  : new THREE.Vector3(
                      centerX + other.x,
                      baseY + other.y,
                      other.z,
                    );
              return (
                point.distanceTo(trialCentre) >=
                (p.radius + other.radius) * 0.98
              );
            });
            if (!coreClear) continue;
            head.position.copy(original).add(shift);
            if (!handleContact.intersects(head, p.radius)) {
              centre.copy(trialCentre);
              headBottom.copy(trialBottom);
              solved = true;
              break search;
            }
          }
        }
      if (!solved)
        throw new Error("Flower cannot clear actual basket handle: " + id);
    }
    if (!cone && !hat && !basket) {
      const minimum =
        lip +
        Math.max(
          1,
          (Math.hypot(headBottom.x - centerX, headBottom.z) -
            mouthRadius * 0.82) *
            0.45,
        );
      const lift = Math.max(0, minimum - headBottom.y);
      head.position.y += lift;
      centre.y += lift;
      headBottom.y += lift;
      const wallLift = clearPaperEdge(
        head,
        containerSurface,
        centerX,
        mouthRadius,
      );
      centre.y += wallLift;
      headBottom.y += wallLift;
    }
    const angleBundle = i * 2.399963,
      bundleRadius = Math.min(mouthRadius * 0.55, Math.sqrt(count) * 0.16),
      radial = Math.sqrt((i + 0.5) / count) * bundleRadius;
    const bottom = new THREE.Vector3(
      centerX + Math.cos(angleBundle + 0.35) * radial * 1.45,
      hat || basket ? foamTop - 1.8 : h * container.base,
      Math.sin(angleBundle + 0.35) * radial * 1.45,
    );
    const binding = new THREE.Vector3(
      centerX + Math.cos(angleBundle) * radial,
      hat || basket ? foamTop - 0.6 : rim ? lip * 0.45 : lip - 3,
      Math.sin(angleBundle) * radial,
    );
    if (hat || basket) {
      bottom
        .copy(headBottom)
        .addScaledVector(dir, -(headBottom.y - foamTop + 1.8) / dir.y);
      binding
        .copy(headBottom)
        .addScaledVector(dir, -(headBottom.y - foamTop + 0.6) / dir.y);
    }
    if (basket) {
      fitBasketInsertion(bottom, centerX, insertionRadius);
      fitBasketInsertion(binding, centerX, insertionRadius);
      foamAnchors.push(bottom.clone(), binding.clone());
    }
    const mouth = stemMouthPoint(
      headBottom,
      centerX,
      Math.min(
        rim ? rim.at(headBottom.x, headBottom.z) - 1.5 : lip,
        headBottom.y - 0.3,
      ),
      mouthRadius,
    );
    const shoulder = headBottom
      .clone()
      .addScaledVector(
        dir,
        -Math.min(1.4, headBottom.distanceTo(mouth) * 0.45),
      );
    const stemRadius = (p.entry.plant.stemDiameterCm || 0.18) / 2;
    const flowerStem = curvedStem(
      [bottom, binding, mouth, shoulder, headBottom],
      stemRadius,
    );
    root.add(flowerStem);
    if (basket)
      attachBasketStemLeaves(root, flowerStem, p.entry.plant, {
        top: headBottom.y - 0.4,
        bottom: foamTop + 0.3,
        centerX,
        radius: mouthRadius * 0.9,
        phase: crown.length,
      });
    flowerModels.push(head);
    crown.push({
      asset: id,
      center: centre.toArray(),
      attachment: headBottom.toArray(),
      mouthPoint: mouth.toArray(),
      stemRadius,
    });
  }
  // The basket handle is not part of the floral crown.
  const petalTop = basket
    ? Math.max(...flowerModels.map((head) => bounds(head).max.y))
    : bounds(root).max.y;
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
      const widthLimit = Math.max(
        2,
        Math.min(canopyRadius * 0.7, mouthRadius * 1.5),
      );
      if (branchWidth > widthLimit) {
        branch.scale.multiplyScalar(widthLimit / branchWidth);
      }
      const cutLocal = branch.worldToLocal(branchCut(branch));
      branch.rotation.set(
        Math.sin(angle) * profile.lean,
        angle,
        Math.cos(angle) * profile.lean,
      );
      const branchHeight = bounds(branch).getSize(new THREE.Vector3()).y;
      place(
        branch,
        centerX +
          Math.cos(angle) *
            Math.min(canopyRadius * profile.spread * 0.6, mouthRadius * 0.7),
        petalTop + profile.height * (0.65 + (i % 2) * 0.18) - branchHeight,
        Math.sin(angle) *
          Math.min(canopyRadius * profile.spread * 0.6, mouthRadius * 0.7),
      );
      const initialCut = branch.localToWorld(cutLocal.clone());
      branch.position.x +=
        centerX +
        Math.cos(angle) * Math.min(mouthRadius * 0.45, 0.8) -
        initialCut.x;
      branch.position.z +=
        Math.sin(angle) * Math.min(mouthRadius * 0.45, 0.8) - initialCut.z;
      branch.updateMatrixWorld(true);
      clearPaperEdge(branch, containerSurface, centerX, mouthRadius);
      root.add(branch);
      const cut = branch.localToWorld(cutLocal.clone());
      const neck = new THREE.Vector3(
        centerX + Math.cos(angle) * Math.min(mouthRadius * 0.25, 0.8),
        Math.min(lip - 1, cut.y - 0.6),
        Math.sin(angle) * Math.min(mouthRadius * 0.25, 0.8),
      );
      const direction = new THREE.Vector3(0, 1, 0).transformDirection(
        branch.matrixWorld,
      );
      const lower =
        hat || basket
          ? cut
              .clone()
              .addScaledVector(
                direction,
                -(cut.y - foamTop + 1.8) / direction.y,
              )
          : new THREE.Vector3(centerX, h * container.base, 0);
      const entry =
        hat || basket
          ? cut
              .clone()
              .addScaledVector(
                direction,
                -(cut.y - foamTop + 0.6) / direction.y,
              )
          : neck;
      if (basket) {
        fitBasketInsertion(lower, centerX, insertionRadius);
        fitBasketInsertion(entry, centerX, insertionRadius);
        foamAnchors.push(lower.clone(), entry.clone());
      }
      const path = [
        lower,
        entry,
        cut.clone().addScaledVector(direction, -0.6),
        cut,
      ].filter((p, i, a) => i === 0 || p.distanceTo(a[i - 1]) > 0.01);
      root.add(curvedStem(path, 0.07));
    }
  }
  if (basket && foamAnchors.length) {
    // Fit the support to the actual inserted stems, rather than filling the
    // entire basket mouth with an exposed flat green disc.
    const center = new THREE.Vector3(centerX, foamTop - 1.1, 0);
    const radius =
      Math.max(
        ...foamAnchors.map((point) =>
          Math.hypot(point.x - center.x, point.z - center.z),
        ),
      ) + 0.65;
    floralFoam.geometry.dispose();
    floralFoam.geometry = new THREE.CylinderGeometry(radius, radius, 2.2, 64);
    floralFoam.position.x = center.x;
    floralFoam.position.z = center.z;
    floralFoam.userData.role = "floral-support";
    floralFoam.userData.anchors = foamAnchors.map((point) => point.toArray());
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
    widthCm: packWidth,
    lip,
    mouthRadius,
    centerX,
    flowers: count,
    crown,
  };
  root.userData.measure = `${count} ${count === 1 ? "цветок" : "цветов"} · ${basket ? `корзина ${packWidth.toFixed(0)} см` : "ручная сборка"}`;
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
    ? s.size / 10 / ringSizes[s.base].innerDiameterPerWidth
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
      const nativeLink = await lib.get(s.base, {
        size: 0.82,
        axis: "y",
        color: palette,
        role: "metal",
      });
      const link = closeCableLink(nativeLink, palette);
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
    calibratedSetting = null,
    calibratedProng = null,
    mountedFrame = null;
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
    mountedFrame = setting;
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
  } else if (
    mount &&
    [
      "jw-set-heart",
      "jw-set-baguette",
      "jw-set-marquise",
      "jw-set-pear",
    ].includes(mount)
  ) {
    calibratedSetting = await nativeSetting(
      lib,
      mount,
      socket,
      palette,
      s.stone,
    );
    root.add(calibratedSetting.root);
  } else if (["jw-set-prong4", "jw-set-prong6"].includes(mount) && s.stone) {
    calibratedProng = await fittedNativeProngs(
      lib,
      mount,
      s.stone,
      socket,
      palette,
    );
    root.add(calibratedProng.root);
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
    mountedFrame = setting;
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
  if (s.stone && calibratedProng) {
    root.add(calibratedProng.stone);
    root.userData.assembly = {
      stoneCount: 1,
      nativeSeat: calibratedProng.stone.userData.nativeSeat,
    };
  } else if (s.stone && calibratedSetting) {
    const stone = await seatNativeGem(lib, s.stone, calibratedSetting);
    root.add(stone);
    root.userData.assembly = {
      stoneCount: 1,
      nativeSeat: stone.userData.nativeSeat,
    };
  } else if (s.stone && integratedSockets[s.base]) {
    const stones = await seatIntegratedGems(lib, s.base, base, s.stone);
    root.add(...stones);
    root.userData.assembly = {
      stoneCount: stones.length,
      nativeIntegrated: stones.map((stone) => stone.userData.nativeSeat),
    };
  } else if (s.stone && s.base !== "jw-set-pave-band") {
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
  if (isRing && mount && s.stone) {
    const frame =
      calibratedSetting?.root || calibratedProng?.root || mountedFrame;
    const gem =
      root.children.find((c) => c.userData.nativeSeat) ||
      root.children.find((c) => c.userData.asset === s.stone);
    if (frame && gem) {
      const gallery = clearRingPavilion(base, frame, gem, palette);
      if (gallery) {
        root.add(gallery);
        root.userData.assembly = {
          ...root.userData.assembly,
          pavilionClearance: gallery.userData.pavilionClearance,
        };
      }
    }
  }
  await attachNativeFindings(lib, root, base, s, palette);
  const end = bounds(root);
  root.position.y -= end.min.y;
  root.userData.measure = isRing
    ? `Размер ${s.size} · ${byId[s.stone]?.name || "без камня"}`
    : `${byId[s.base].name} · ${palette === "#d1d8de" ? "серебро" : "металл"}`;
  return root;
}
export async function assembleProject(lib, kind, s, palette) {
  if (kind === "cakes" && s.pattern) return buildRecipeCake(lib, s);
  if (kind === "jewelry" && s.pattern) return buildConstructedJewelry(lib, s);
  if (kind === "flowers" && s.pattern) return buildComposedBouquet(lib, s);
  return kind === "cakes"
    ? buildCake(lib, s, palette)
    : kind === "flowers"
      ? buildFlowers(lib, s, palette)
      : buildJewelry(lib, s, palette);
}
