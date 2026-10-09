import { basketInteriorRadius, fitBasketInsertion } from "./basket-interior.js";
import { attachBasketStemLeaves } from "./flower-stem-leaves.js";
import { basketHandleContact } from "./basket-handle-contact.js";
import { aimBranch } from "./branch-attachment.js";
import * as THREE from "three";
import { bouquets, plants, forms } from "./domain.js";
import { containers, flowerHeads } from "./assembly-profiles.js";
import mouths from "./container-mouths.json" with { type: "json" };
import {
  bounds,
  place,
  stem,
  curvedStem,
  stemPointAtHeight,
} from "./model-library.js";
import { domainMaterial } from "./domain-materials.js";
import { attachWrapperRibbon } from "./wrap-twine.js";
import { paperRim, clearPaperEdge } from "./wrapper-rim.js";
import {
  botanicalHead,
  botanicalLeaf,
  botanicalBranch,
} from "./botanical-components.js";

const colors = {
  ivory: "#ede5d2",
  blush: "#d9a6b4",
  apricot: "#e1ad86",
  burgundy: "#954967",
  yellow: "#e8cb6b",
  orange: "#d79568",
  pink: "#d48aab",
  violet: "#a38bb1",
  blue: "#93aebe",
  green: "#bac4a6",
};
function colorFor(p, palette, i) {
  const allowed = p.naturalColors || ["ivory"];
  const wanted = ["blush", "ivory", "burgundy", "apricot"][palette];
  const variation = new THREE.Color(
    colors[allowed.includes(wanted) ? wanted : allowed[i % allowed.length]] ||
      "#eee5d8",
  );
  variation.offsetHSL(((i % 3) - 1) * 0.008, 0, ((i % 4) - 1.5) * 0.023);
  return variation.getHexString();
}
export function stemMouthPoint(target, centerX, lip, radius) {
  const dx = target.x - centerX,
    dz = target.z,
    k = Math.min(1, (radius * 0.82) / (Math.hypot(dx, dz) || 1));
  return new THREE.Vector3(centerX + dx * k, lip + 0.16, dz * k);
}
export function paperWidth(entries, maximum = 23) {
  if (!entries.length) return maximum;
  const diameters = entries.map((e) => e.plant.headDiameterCm);
  const areaRadius = Math.sqrt(
    diameters.reduce((sum, d) => sum + (d * 0.32) ** 2, 0),
  );
  const mean = diameters.reduce((sum, d) => sum + d, 0) / diameters.length;
  return Math.min(maximum, Math.max(12, 2.1 * (areaRadius + mean * 0.5)));
}
export function floralLayout(entries, form, mouthRadius = null) {
  if (!entries.length) return [];
  const mean =
    entries.reduce((n, e) => n + e.plant.headDiameterCm, 0) / entries.length;
  const areaRadius = Math.sqrt(
    entries.reduce((n, e) => n + (e.plant.headDiameterCm * 0.32) ** 2, 0),
  );
  const radius =
    mouthRadius === null
      ? areaRadius
      : Math.min(areaRadius, mouthRadius * 1.04 + mean * 0.24);
  // Place centres on a deep cap, not a separated flat disk. Flower petals can
  // overlap in projection while calyx/central volumes remain distinct in 3D.
  const height = Math.max(mean * 0.7, areaRadius * 0.65);
  const line = ["directional-fan", "loose-fan"].includes(form.shape);
  const points = entries.map((entry, i) => {
    const f = (i + 0.35) / entries.length,
      angle = i * 2.399963;
    const r = radius * Math.sqrt(f);
    let x = Math.cos(angle) * r,
      z = Math.sin(angle) * r;
    let y = height * Math.pow(1 - f, 0.65) + Math.sin(i * 1.7) * mean * 0.065;
    if (line) {
      x *= 0.7;
      z *= 0.5;
      y += (i % 3) * mean * 0.26;
    }
    if (form.shape === "asymmetric-dome") {
      z *= 0.88;
      y += x * 0.19;
    }
    if (form.shape === "directional-cascade" && f > 0.72) {
      z += mean * 0.32;
      y -= mean * 0.35;
    }
    return {
      entry,
      x,
      y,
      z,
      radius: entry.plant.headCoreRadiusCm ?? entry.plant.headDiameterCm * 0.22,
    };
  });
  // Only the central volumes repel. Resolve crowding vertically as well as
  // laterally, then restore the wrapper envelope instead of inflating the disk.
  for (let iteration = 0; iteration < 64; iteration++) {
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i],
          b = points[j],
          dx = b.x - a.x,
          dy = b.y - a.y,
          dz = b.z - a.z;
        const d = Math.hypot(dx, dy, dz),
          minimum = a.radius + b.radius;
        if (d < minimum) {
          const k = ((minimum - d) * 0.26) / (d || 1);
          a.x -= dx * k;
          a.y -= dy * k;
          a.z -= dz * k;
          b.x += dx * k;
          b.y += dy * k;
          b.z += dz * k;
        }
      }
    for (const p of points) {
      const r = Math.hypot(p.x, p.z);
      if (r > radius) {
        p.x *= radius / r;
        p.z *= radius / r;
      }
      p.y = Math.max(0, p.y);
    }
  }
  return points;
}
export async function buildComposedBouquet(lib, state) {
  const pattern = bouquets[state.pattern],
    form = forms[pattern.form],
    root = new THREE.Group();
  const box = form.stemSystem === "floral-foam",
    bridal = form.packaging.includes("ribbon");
  const packId = box
    ? pattern.form === "basket"
      ? "fl-wrap-basket-rattan"
      : "fl-wrap-hatbox-round"
    : state.pack;
  const roles = pattern.roles,
    entries = [];
  for (const role of ["focal", "secondary"])
    for (const species of roles[role])
      for (let i = 0; i < (state.taxonCounts?.[species] || 3); i++)
        entries.push({ plant: plants[species], role, index: i });
  const originalProfile = containers[packId];
  const profile = originalProfile && {
    ...originalProfile,
    width: /sleeve|cone/.test(packId)
      ? paperWidth(entries, originalProfile.width)
      : pattern.form === "basket"
        ? originalProfile.width * Math.min(1.65, Math.max(1, Math.sqrt(entries.length / 11)))
      : originalProfile.width,
  };
  let rim = null;
  let wrapper,
    lip = 22,
    mouthRadius = 3,
    centerX = 0;
  if (!bridal) {
    wrapper = await lib.get(packId, {
      size: profile.width,
      axis: "x",
      nativeColor: true,
      role: packId.includes("glass") ? "glass" : "soft",
    });
    if (packId.includes("sleeve") || packId.includes("hatbox"))
      wrapper.traverse((n) => {
        if (n.isMesh) {
          n.material.color.set(
            state.palette === 0
              ? "#ddcbd2"
              : state.palette === 2
                ? "#c6b2b9"
                : "#e2d8c3",
          );
          n.material.roughness = 0.82;
        }
      });
    root.add(wrapper);
    const b = bounds(wrapper);
    const measurementScale =
      profile.width / (mouths[packId]?.referenceWidth || profile.width);
    lip = mouths[packId]?.lip * measurementScale || b.max.y * profile.lip;
    mouthRadius =
      mouths[packId]?.mouthRadius * measurementScale ||
      profile.width * profile.mouth;
    centerX = profile.width * profile.centerX;
    if (packId.includes("sleeve") || packId.includes("cone"))
      rim = paperRim(wrapper, centerX, profile.width);
  }
  const containerSurface = wrapper
    ? rim || paperRim(wrapper, centerX, profile.width)
    : null;
  const count = entries.length;
  if (form.shape === "asymmetric-dome") {
    const focal = entries.filter((e) => e.role === "focal"),
      secondary = entries.filter((e) => e.role === "secondary");
    const mixed = [];
    let f = 0,
      s = 0;
    for (let i = 0; i < count; i++)
      mixed.push(
        Math.floor(((i + 1) * secondary.length) / count) >
          Math.floor((i * secondary.length) / count)
          ? secondary[s++]
          : focal[f++],
      );
    entries.splice(0, entries.length, ...mixed);
  }
  const crownOpening = packId?.includes("bottle")
    ? profile.width * 0.48
    : mouthRadius;
  const positions = floralLayout(
      entries,
      form,
      bridal ? null : crownOpening,
    ).sort((a, b) => (pattern.form === "basket" ? b.radius - a.radius : 0)),
    bindingY = bridal ? 15 : rim ? lip * 0.45 : Math.max(2, lip - 3),
    headBase =
      (rim?.mean ?? lip) +
      (pattern.form === "basket" ? -2.4 : box ? -1.1 : rim ? -2.2 : -0.8);
  const handleContact =
    pattern.form === "basket" ? basketHandleContact(wrapper, lip) : null;
  const foamTop = lip - (pattern.form === "basket" ? 6 * profile.width / originalProfile.width : 2.1);
  const interior = handleContact
    ? basketInteriorRadius(wrapper, centerX, foamTop)
    : null;
  const insertionRadius = interior
    ? Math.min(
        interior.radius - 0.65,
        Math.max(1.6, Math.sqrt(positions.length) * 0.35),
      )
    : null;
  const foamAnchors = [];
  let floralFoam;
  if (box) {
    const foam = (floralFoam = new THREE.Mesh(
      new THREE.CylinderGeometry(
        mouthRadius * 0.86,
        mouthRadius * 0.86,
        2.2,
        64,
      ),
      domainMaterial("leaf", { color: "#3c5134" }),
    ));
    foam.position.set(centerX, foamTop - 1.1, 0);
    foam.userData.component = "floral-foam-support";
    foam.castShadow = foam.receiveShadow = true;
    root.add(foam);
  }
  const binding = new THREE.Vector3(centerX, bindingY, 0);
  const crown = [];
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i],
      plant = p.entry.plant,
      a = Math.atan2(p.z, p.x),
      target = new THREE.Vector3(centerX + p.x, headBase + p.y, p.z);
    const color = "#" + colorFor(plant, state.palette, i);
    const model = plant.asset
      ? await lib.get(plant.asset, {
          size: plant.headDiameterCm,
          axis: "x",
          nativeColor: state.palette === 4,
          color,
          role: "petal",
          regional: true,
          rotation: flowerHeads[plant.asset]?.upright
            ? null
            : [-Math.PI / 2, 0, 0],
        })
      : botanicalHead(plant, color, i);
    const head = new THREE.Group();
    head.add(model);
    head.scale.y = plant.headDepthCalibration || 1;
    head.rotation.y = i * 0.53;
    const direction = new THREE.Vector3(
      p.x * 0.075,
      1,
      p.z * 0.075,
    ).normalize();
    head.quaternion.premultiply(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction,
      ),
    );
    place(head, target.x, target.y, target.z, "center");
    target.y += clearPaperEdge(head, rim, centerX, mouthRadius);
    root.add(head);
    crown.push({
      species: plant.id,
      role: p.entry.role,
      center: target.toArray(),
      diameter: plant.headDiameterCm,
    });
    const bundleAngle = i * 2.399963,
      bundleRadius = Math.min(
        mouthRadius * 0.75,
        Math.max(
          0.75,
          Math.sqrt(positions.length) *
            Math.max(...entries.map((e) => e.plant.stemDiameterCm ?? 0.18)) *
            0.62,
        ),
      ),
      radial = Math.sqrt((i + 0.5) / positions.length) * bundleRadius,
      bottom = new THREE.Vector3(
        centerX + Math.cos(bundleAngle + 0.35) * radial * 1.45,
        0.5,
        Math.sin(bundleAngle + 0.35) * radial * 1.45,
      ),
      neck = new THREE.Vector3(
        centerX + Math.cos(bundleAngle) * radial,
        bindingY,
        Math.sin(bundleAngle) * radial,
      );
    const ray = new THREE.Raycaster(
      target.clone().addScaledVector(direction, -plant.headDiameterCm * 2),
      direction,
    );
    const hit = ray.intersectObject(head, true)[0];
    const attach = hit
      ? hit.point.clone().addScaledVector(direction, 0.06)
      : target.clone().addScaledVector(direction, -plant.headDiameterCm * 0.2);
    if (box && attach.y < foamTop + 0.2) {
      const lift = foamTop + 0.2 - attach.y;
      head.position.y += lift;
      target.y += lift;
      attach.y += lift;
      crown[crown.length - 1].center = target.toArray();
    }
    if (
      handleContact &&
      (handleContact.intersects(head, p.radius) ||
        crown
          .slice(0, -1)
          .some(
            (c) =>
              new THREE.Vector3().fromArray(c.center).distanceTo(target) <
              (p.radius +
                (plants[c.species].headCoreRadiusCm ??
                  plants[c.species].headDiameterCm * 0.22)) *
                0.98,
          ))
    ) {
      const original = head.position.clone(),
        originalCentre = target.clone(),
        originalBottom = attach.clone();
      const side =
        Math.sign(
          new THREE.Vector3(target.x - centerX, 0, target.z).dot(
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
                mouthRadius + plant.headDiameterCm * 0.35
            )
              continue;
            const coreClear = positions.every((other, j) => {
              if (j >= i) return true;
              const point =
                j < i
                  ? new THREE.Vector3().fromArray(crown[j].center)
                  : new THREE.Vector3(
                      centerX + other.x,
                      headBase + other.y,
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
              target.copy(trialCentre);
              attach.copy(trialBottom);
              solved = true;
              break search;
            }
          }
        }
      if (!solved)
        throw new Error(
          "Flower cannot clear actual basket handle: " + plant.id,
        );
    }
    crown[crown.length - 1].center = target.toArray();
    if (!bridal && !rim && !box) {
      const minimum =
        lip +
        Math.max(
          1,
          (Math.hypot(attach.x - centerX, attach.z) - mouthRadius * 0.82) *
            0.45,
        );
      const lift = Math.max(0, minimum - attach.y);
      head.position.y += lift;
      target.y += lift;
      attach.y += lift;
      const wallLift = clearPaperEdge(
        head,
        containerSurface,
        centerX,
        mouthRadius,
      );
      target.y += wallLift;
      attach.y += wallLift;
      crown[crown.length - 1].center = target.toArray();
    }
    crown[crown.length - 1].attachment = attach.toArray();
    if (box) {
      // Foam arrangements insert each stem under its own bloom; there is no
      // hand-tied bundle converging in the centre of the box.
      neck
        .copy(attach)
        .addScaledVector(direction, -(attach.y - foamTop + 0.6) / direction.y);
      bottom
        .copy(attach)
        .addScaledVector(direction, -(attach.y - foamTop + 1.8) / direction.y);
    }
    const mouthPoint = bridal
        ? neck
        : stemMouthPoint(
            attach,
            centerX,
            Math.min(
              rim ? rim.at(attach.x, attach.z) - 1.5 : lip,
              attach.y - 0.3,
            ),
            mouthRadius,
          ),
      stemRadius = (plant.stemDiameterCm ?? 0.18) / 2;
    const path = [bottom, neck];
    if (!bridal) path.push(mouthPoint);
    if (attach.distanceTo(path.at(-1)) > 0.1) {
      const shoulder = attach
        .clone()
        .addScaledVector(
          direction,
          -Math.min(1.4, attach.distanceTo(path.at(-1)) * 0.45),
        );
      path.push(shoulder, attach);
    }
    if (handleContact) {
      fitBasketInsertion(bottom, centerX, insertionRadius);
      fitBasketInsertion(neck, centerX, insertionRadius);
      foamAnchors.push(bottom.clone(), neck.clone());
    }
    const flowerStem = curvedStem(path, stemRadius);
    root.add(flowerStem);
    crown[crown.length - 1].mouthPoint = mouthPoint.toArray();
    crown[crown.length - 1].bindingPoint = neck.toArray();
    crown[crown.length - 1].stemRadius = stemRadius;
    const t = bridal ? 0.6 : 0.75,
      leafPosition = stemPointAtHeight(
        flowerStem,
        THREE.MathUtils.lerp(mouthPoint.y, attach.y, t),
      );
    if (pattern.form === "basket") {
      attachBasketStemLeaves(root, flowerStem, plant, {
        top: attach.y - 0.4,
        bottom: foamTop + 0.3,
        centerX,
        radius: mouthRadius * 0.9,
        phase: i,
      });
    } else if (leafPosition.y > (bridal ? bindingY + 1 : lip + 1)) {
      const leaf = botanicalLeaf(
        plant.id === "tulip" ? 4 : bridal ? 4.2 : 3.6,
        plant.id === "tulip" ? 0.9 : bridal ? 1.6 : 0.85,
        i,
      );
      leaf.position.copy(leafPosition);
      leaf.rotation.set(
        -0.25,
        (bridal ? Math.PI / 2 : -Math.PI / 2) - a,
        0.2,
        "YXZ",
      );
      root.add(leaf);
    }
  }
  for (const [role, ids] of [
    ["foliage", roles.foliage],
    ["filler", roles.filler],
  ])
    for (let k = 0; k < ids.length; k++)
      for (let j = 0; j < (role === "filler" ? 4 : 5); j++) {
        const plant = plants[ids[k]],
          a = (j / 5) * Math.PI * 2 + 0.4;
        const rr =
          Math.max(...positions.map((p) => Math.hypot(p.x, p.z))) * 0.65;
        const target = new THREE.Vector3(
          centerX + Math.cos(a) * rr,
          headBase + 1,
          Math.sin(a) * rr,
        );
        const branch = plant.asset
          ? await lib.get(plant.asset, {
              size: role === "filler" ? 6.5 : 7.5,
              axis: "y",
              nativeColor: true,
            })
          : botanicalBranch(plant, role === "filler" ? 4.2 : 3.5, j);
        const heights = crown.map((c) => c.attachment[1]).sort((a, b) => a - b);
        target.y =
          heights[Math.floor(heights.length / 2)] +
          (role === "foliage" ? 1 : 1.6);
        const anchor = aimBranch(branch, binding, target, a + Math.PI);
        if (!bridal)
          clearPaperEdge(branch, containerSurface, centerX, mouthRadius);
        root.add(branch);
        const cut = branch.localToWorld(anchor.cut.clone());
        const entry = bridal
          ? binding.clone()
          : stemMouthPoint(
              cut,
              centerX,
              Math.min(lip, cut.y - 0.2),
              mouthRadius,
            );
        const lower = box
          ? cut
              .clone()
              .addScaledVector(
                anchor.direction,
                -(cut.y - foamTop + 1.8) / anchor.direction.y,
              )
          : binding.clone();
        const neck = box
          ? cut
              .clone()
              .addScaledVector(
                anchor.direction,
                -(cut.y - foamTop + 0.6) / anchor.direction.y,
              )
          : entry;
        if (handleContact) {
          fitBasketInsertion(lower, centerX, insertionRadius);
          fitBasketInsertion(neck, centerX, insertionRadius);
        }
        const path = [
          lower,
          neck,
          cut.clone().addScaledVector(anchor.direction, -0.6),
          cut,
        ].filter((p, i, a) => i === 0 || p.distanceTo(a[i - 1]) > 0.01);
        if (handleContact) foamAnchors.push(lower.clone(), neck.clone());
        root.add(curvedStem(path, 0.05));
      }
  if (handleContact && foamAnchors.length) {
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
    floralFoam.userData.anchors = foamAnchors.map((p) => p.toArray());
  }
  if (bridal) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 2, 48, 1, true),
      domainMaterial("satin", { color: "#e7d9c5" }),
    );
    band.position.copy(binding);
    root.add(band);
  }
  if (state.ribbon) {
    const bow = await lib.get(state.ribbon, {
      size: bridal
        ? 3.3
        : state.ribbon.includes("jute")
          ? profile.width * 0.55
          : profile.width * 0.4,
      axis: "x",
      nativeColor: true,
      rotation: state.ribbon.includes("jute") ? [Math.PI / 2, 0, 0] : null,
    });
    if (!state.ribbon.includes("jute"))
      bow.traverse((n) => {
        if (n.isMesh) {
          n.material.color.set(
            ["#b790a0", "#d7cba8", "#884d65", "#c29472"][state.palette] ||
              "#d7cba8",
          );
          n.material.roughness = 0.43;
        }
      });
    if (bridal) place(bow, centerX, bindingY, 1.1, "center");
    else
      attachWrapperRibbon(bow, wrapper, {
        width: profile.width,
        centerX,
        y: lip * 0.45,
        h: bounds(wrapper).max.y,
        hat: pattern.form === "hatbox",
        twine: state.ribbon.includes("jute"),
      });
    root.add(bow);
  }
  root.userData = {
    pattern: pattern.id,
    assembly: {
      stemSystem: form.stemSystem,
      container: bridal ? null : packId,
      mouthRadius,
      mouthLip: lip,
      paperRim: rim ? { mean: rim.mean, values: rim.values } : null,
      centerX,
      crown,
      binding: binding.toArray(),
      density: form.density,
      roles: pattern.roles,
      sources: pattern.sources,
    },
    measure: `${pattern.name} · ${count} стеблей · ${box ? "композиция на пене" : "спиральная сборка"}`,
  };
  return root;
}
