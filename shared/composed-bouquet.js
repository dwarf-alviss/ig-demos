import * as THREE from "three";
import { bouquets, plants, forms } from "./domain.js";
import { containers, flowerHeads } from "./assembly-profiles.js";
import mouths from "./container-mouths.json" with { type: "json" };
import { bounds, place, stem } from "./model-library.js";
import { domainMaterial } from "./domain-materials.js";
import { attachWrapperRibbon } from "./wrap-twine.js";
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
export function floralLayout(entries, form) {
  // Focal blooms occupy the core. Secondary species form alternating, staggered
  // rings, with a deliberate raised flank for a garden bouquet or a fan for line work.
  const mean =
    entries.reduce((n, e) => n + e.plant.headDiameterCm, 0) / entries.length;
  const radius =
    Math.sqrt(
      entries.reduce((n, e) => n + (e.plant.headDiameterCm * 0.43) ** 2, 0),
    ) / Math.sqrt(form.density);
  const points = [];
  let cursor = 0,
    ring = 0;
  while (cursor < entries.length) {
    const capacity = ring === 0 ? 1 : ring * 6,
      number = Math.min(capacity, entries.length - cursor);
    for (let j = 0; j < number; j++) {
      const e = entries[cursor++],
        a = (j / number) * Math.PI * 2 + ring * 0.43,
        r = ring * mean * 0.73;
      let x = Math.cos(a) * r,
        z = Math.sin(a) * r,
        y = Math.max(0, 1 - (r / (radius + 1)) ** 2) * mean * 0.42;
      if (["directional-fan", "loose-fan"].includes(form.shape)) {
        x = (cursor - (entries.length + 1) / 2) * mean * 0.36;
        z = Math.sin(cursor * 0.8) * mean * 0.48;
        y = Math.sin((cursor / entries.length) * Math.PI) * mean * 0.7;
      }
      if (form.shape === "asymmetric-dome") {
        x *= 1.12;
        y += x * 0.17;
        z *= 0.86;
      }
      if (
        form.shape === "directional-cascade" &&
        cursor > entries.length * 0.65
      ) {
        z += mean * 1.2;
        y -= mean * 0.7;
      }
      points.push({ entry: e, x, y, z, radius: e.plant.headDiameterCm * 0.4 });
    }
    ring++;
  }
  // Pairwise relaxation accommodates different head diameters; it does not assign
  // a single universal flower size. Keep a slight overlap for natural petal contact.
  for (let iteration = 0; iteration < 48; iteration++)
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i],
          b = points[j],
          dx = b.x - a.x,
          dz = b.z - a.z,
          d = Math.hypot(dx, dz),
          minimum = a.radius + b.radius;
        if (d < minimum) {
          const k = ((minimum - d) * 0.22) / (d || 1),
            vx = d ? dx : 1,
            vz = d ? dz : 0.3;
          a.x -= vx * k;
          a.z -= vz * k;
          b.x += vx * k;
          b.z += vz * k;
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
  const profile = containers[packId];
  let wrapper,
    lip = 9,
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
    lip = mouths[packId]?.lip ?? b.max.y * profile.lip;
    mouthRadius = mouths[packId]?.mouthRadius ?? profile.width * profile.mouth;
    centerX = profile.width * profile.centerX;
  }
  const roles = pattern.roles,
    entries = [];
  for (const role of ["focal", "secondary"])
    for (const species of roles[role])
      for (let i = 0; i < (state.taxonCounts?.[species] || 3); i++)
        entries.push({ plant: plants[species], role, index: i });
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
  const positions = floralLayout(entries, form),
    bindingY = bridal ? 8 : Math.max(2, lip - 3),
    headBase = lip + (box ? 0.5 : 1.1);
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
    const direction = new THREE.Vector3(p.x * 0.07, 1, p.z * 0.07).normalize();
    head.quaternion.premultiply(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction,
      ),
    );
    place(head, target.x, target.y, target.z, "center");
    root.add(head);
    crown.push({
      species: plant.id,
      role: p.entry.role,
      center: target.toArray(),
      diameter: plant.headDiameterCm,
    });
    if (!bridal)
      head.traverse((n) => {
        if (n.isMesh) {
          n.material.clippingPlanes = [
            new THREE.Plane(new THREE.Vector3(0, 1, 0), -lip),
          ];
          n.material.clipShadows = true;
        }
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
        centerX - Math.cos(bundleAngle + 0.8) * radial * 1.6,
        0.5,
        -Math.sin(bundleAngle + 0.8) * radial * 1.6,
      ),
      neck = new THREE.Vector3(
        centerX + Math.cos(bundleAngle) * radial,
        bindingY,
        Math.sin(bundleAngle) * radial,
      );
    const attach = new THREE.Vector3(
      target.x,
      bounds(head).max.y - (bounds(head).max.y - bounds(head).min.y) * 0.32,
      target.z,
    );
    if (box) {
      neck.set(centerX + p.x * 0.25, lip - 1, p.z * 0.25);
      bottom.set(neck.x, lip - 4, neck.z);
    }
    const mouthPoint = bridal
        ? neck
        : stemMouthPoint(attach, centerX, lip, mouthRadius),
      stemRadius = (plant.stemDiameterCm ?? 0.18) / 2;
    root.add(stem(bottom, neck, stemRadius));
    if (!bridal) root.add(stem(neck, mouthPoint, stemRadius));
    root.add(stem(mouthPoint, attach, stemRadius));
    crown[crown.length - 1].mouthPoint = mouthPoint.toArray();
    crown[crown.length - 1].bindingPoint = neck.toArray();
    crown[crown.length - 1].stemRadius = stemRadius;
    const t = 0.62,
      leafPosition = mouthPoint.clone().lerp(attach, t);
    if (leafPosition.y > lip + 1) {
      const leaf = botanicalLeaf(
        plant.id === "tulip" ? 5 : 2.8,
        plant.id === "tulip" ? 1.1 : 1.5,
        i,
      );
      leaf.position.copy(leafPosition);
      leaf.rotation.set(-0.25, a + Math.PI, 0.2);
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
        branch.rotation.y = a + Math.PI;
        place(
          branch,
          target.x,
          Math.max(lip + 0.25, target.y - (plant.asset ? 5 : 3)),
          target.z,
        );
        root.add(branch);
        const entry = bridal
          ? binding
          : stemMouthPoint(branch.position, centerX, lip, mouthRadius);
        if (!bridal) root.add(stem(binding, entry, 0.05));
        root.add(stem(entry, branch.position, 0.05));
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
