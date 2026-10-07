import {
  supportsDecoration,
  pastryHeight,
  pastryFootprint,
} from "./pastry-support.js";
// Dimensions are centimeters, calibrated per part rather than per category.
export const cakeParts = {
  "bk-decor-sprinkle-ball": { size: 0.35, footprint: 0.19 },
  "bk-decor-sprinkle-star": { size: 0.35, footprint: 0.2 },
  "bk-decor-gold-flake": {
    size: 0.7,
    footprint: 0.37,
    rotation: [Math.PI / 2, 0, 0],
  },
  "bk-berry-blueberry": { size: 1.05, footprint: 0.58 },
  "bk-berry-strawberry": {
    size: 3.8,
    footprint: 1.58,
    rotation: [-0.42, 0, 0],
  },
  "bk-berry-raspberry": { size: 1.9, footprint: 1.04 },
  "bk-berry-blackberry": { size: 2.3, footprint: 1.0 },
  "bk-berry-cherry": { size: 4.1, footprint: 1.47 },
  "bk-decor-macaron": { size: 4.2, footprint: 2.23 },
  "bk-decor-cream-rosette": { size: 3.0, footprint: 1.62 },
  "bk-decor-meringue-kiss": { size: 2.8, footprint: 1.49 },
  "bk-decor-truffle-ball": { size: 2.7, footprint: 1.42 },
  "bk-decor-crumble-cluster": { size: 2.2, footprint: 1.05 },
  "bk-decor-chocolate-shard": {
    size: 5.5,
    footprint: 1.25,
    rotation: [0, 0, -0.25],
    flatFootprint: 3.2,
    flatRotation: [Math.PI / 2, 0, 0],
  },
  "bk-decor-caramel-spiral": { size: 5.2, footprint: 1.63 },
  "bk-decor-wafer-roll": {
    size: 7.5,
    footprint: 1.55,
    rotation: [-0.32, 0, 0],
    flatFootprint: 4,
    flatRotation: [Math.PI / 2, 0, 0],
  },
};
export const containers = {
  "fl-wrap-matte-sleeve": {
    width: 23,
    lip: 0.88,
    mouth: 0.34,
    centerX: 0,
    base: 0.08,
  },
  "fl-wrap-kraft-cone": {
    width: 23,
    lip: 0.86,
    mouth: 0.33,
    centerX: 0,
    base: 0.06,
  },
  "fl-wrap-hatbox-round": {
    width: 29,
    lip: 0.9,
    mouth: 0.25,
    centerX: -0.16,
    base: 0.24,
  },
  "fl-wrap-basket-rattan": {
    width: 27,
    lip: 0.47,
    mouth: 0.36,
    centerX: 0,
    base: 0.15,
  },
  "fl-vase-kraft-bucket": {
    width: 22,
    lip: 0.93,
    mouth: 0.36,
    centerX: 0,
    base: 0.2,
  },
  "fl-vase-bottle-ceramic": {
    width: 16,
    lip: 0.96,
    mouth: 0.095,
    centerX: 0,
    base: 0.22,
  },
  "fl-vase-glass-cylinder": {
    width: 15,
    lip: 0.97,
    mouth: 0.43,
    centerX: 0,
    base: 0.15,
  },
};
export const flowerHeads = {
  "fl-flower-anemone": { diameter: 6.4 },
  "fl-flower-chamomile": { diameter: 4.1 },
  "fl-flower-chrysanthemum-spray": { diameter: 6.5 },
  "fl-flower-eustoma": { diameter: 6 },
  "fl-flower-gerbera": { diameter: 8 },
  "fl-flower-lily-oriental": { diameter: 10 },
  "fl-flower-peony-open": { diameter: 9 },
  "fl-flower-ranunculus": { diameter: 6 },
  "fl-flower-rose-garden": { diameter: 7 },
  "fl-flower-tulip": { diameter: 4.6, upright: true },
};

// Deterministic placement with measured footprints, tier exclusion rings and spacing.
export function findCakeSeat(
  surfaces,
  occupied,
  footprint,
  layout,
  index,
  profile = null,
) {
  const uprightFootprint = footprint;
  const pastries = surfaces.filter((s) => s.asset);
  const ordered = pastries.length
    ? [
        ...pastries.slice(index % pastries.length),
        ...pastries.slice(0, index % pastries.length),
        ...surfaces.filter((s) => !s.asset),
      ]
    : [...surfaces].reverse();
  for (let k = 0; k < ordered.length; k++) {
    const surface = ordered[k];
    const laidFlat = Boolean(
      profile?.flatFootprint &&
        (surface.id < 0 ||
          (surface.asset &&
            !surface.asset.includes("cupcake") &&
            !surface.asset.includes("brownie"))),
    );
    footprint = laidFlat ? profile.flatFootprint : uprightFootprint;
    if (footprint + 0.08 > surface.radius) continue;
    for (let n = 0; n < 1600; n++) {
      let angle = n * 2.399963,
        fraction = Math.sqrt(((n % 130) + 0.5) / 130);
      if (layout === "wreath" && n < 960)
        fraction = Math.max(0.12, 0.96 - Math.floor(n / 160) * 0.16);
      if (layout === "crescent" && n < 960) {
        angle = Math.PI * 0.08 + ((n * 2.399963) % (Math.PI * 0.84));
        fraction = Math.max(0.12, 0.88 - Math.floor(n / 160) * 0.14);
      }
      const radius = (surface.radius - footprint - 0.08) * fraction;
      const x = surface.x + Math.cos(angle) * radius,
        z = surface.z + Math.sin(angle) * radius;
      if (surface.inner > 0 && radius - footprint < surface.inner) continue;
      if (
        surface.asset &&
        !supportsDecoration(
          surface.asset,
          x - surface.x,
          z - surface.z,
          footprint,
        )
      )
        continue;
      if (
        layout === "crescent" &&
        surface.inner === 0 &&
        z < surface.z - 0.2 &&
        n < 1200
      )
        continue;
      if (
        occupied.some(
          (p) =>
            p.surface === surface.id &&
            Math.hypot(x - p.x, z - p.z) < footprint + p.footprint + 0.16,
        )
      )
        continue;
      const seat = {
        x,
        z,
        y: surface.y,
        footprint,
        surface: surface.id,
        ...(laidFlat ? { laidFlat: true } : {}),
      };
      occupied.push(seat);
      return seat;
    }
  }
  return null;
}
export const pastryDimensions = {
  "bk-pastry-cupcake": 7.5,
  "bk-pastry-cookie-heart": 7,
  "bk-pastry-cookie-round": 6.5,
  "bk-pastry-eclair": 12,
  "bk-pastry-profiterole": 4.5,
  "bk-pastry-donut": 8,
  "bk-pastry-brownie-bite": 5,
};
export function pastryPositions(s) {
  if (s.pieces === 1) return [{ x: 0, z: 0 }];
  if (s.base === "bk-pastry-eclair")
    return Array.from({ length: s.pieces }, (_, i) => ({
      x: i % 2 === 0 ? -7 : 7,
      z:
        s.pieces === 4
          ? (Math.floor(i / 2) - 0.5) * 8
          : (Math.floor(i / 2) - 1) * 6,
    }));
  const radius = s.base.includes("profiterole")
    ? 6
    : s.base.includes("brownie") || s.base.includes("cupcake")
      ? 7.5
      : 9;
  return Array.from({ length: s.pieces }, (_, i) => ({
    x: Math.cos((i / s.pieces) * Math.PI * 2) * radius,
    z: Math.sin((i / s.pieces) * Math.PI * 2) * radius,
  }));
}
export const plateRadius = (s) =>
  s.base.includes("pastry")
    ? Math.max(...pastryPositions(s).map((p) => Math.hypot(p.x, p.z))) +
      pastryFootprint(s.base) +
      Math.max(
        s.pieces === 1 ? 4 : 2.2,
        ...(s.decor || []).map(
          (id) => (cakeParts[id]?.flatFootprint || 0) * 2 + 0.5,
        ),
      )
    : 21;
export function cakeSurfaces(s) {
  if (!s.base.includes("pastry"))
    return Array.from({ length: s.tiers }, (_, i) => ({
      id: i,
      x: 0,
      z: 0,
      y: 0,
      radius: (24 - i * 5) / (s.base.includes("hex") ? 2.33 : 2),
      inner: i < s.tiers - 1 ? (19 - i * 5) / 2 + 0.1 : 0,
    }));
  const size = pastryDimensions[s.base],
    rr = s.pieces === 1 ? 0 : s.base.includes("eclair") ? 11 : 9;
  return [
    { id: -1, x: 0, z: 0, y: 0.48, radius: plateRadius(s) - 0.5, inner: 0 },
    ...pastryPositions(s).map((p, i) => ({
      id: i,
      asset: s.base,
      ...p,
      y: 0,
      radius: s.base.includes("eclair")
        ? 1.6
        : s.base.includes("profiterole")
          ? 1.35
          : s.base.includes("cupcake")
            ? 2.1
            : size * 0.37,
      inner: s.base.includes("donut") ? 1.2 : 0,
    })),
  ];
}
export function pastryBlockers(s) {
  return s.base.includes("pastry")
    ? pastryPositions(s).map((p) => ({
        ...p,
        footprint: pastryFootprint(s.base),
        surface: -1,
      }))
    : [];
}

export function topperSeat(s, surfaces = cakeSurfaces(s)) {
  if (!s.topper) return null;
  const pastry = s.base.includes("pastry"),
    surface = surfaces.find((p) => p.id === (pastry ? 0 : s.tiers - 1));
  // Two-stick banners sit on the plate for small pastries, with both feet supported.
  const plate = pastry && s.topper.includes("banner");
  const anchor = plate
    ? { x: 0, z: -plateRadius(s) * 0.68, surface: -1, y: 0.48 }
    : {
        x: surface.x,
        z:
          surface.z +
          (pastry
            ? s.base.includes("donut")
              ? 2.4
              : 0
            : -surface.radius * 0.22),
        surface: surface.id,
        y: surface.y,
      };
  if (pastry && !plate)
    anchor.y =
      (pastryHeight(s.base, anchor.x - surface.x, anchor.z - surface.z) ?? 0) +
      0.5;
  return {
    ...anchor,
    footprint: s.topper.includes("banner")
      ? 3.3
      : s.topper === "bk-berry-currant-red"
        ? 0.4
        : s.topper.includes("horn")
          ? 0.7
          : 0.9,
    plate,
  };
}
export function cakeBlockers(s, surfaces = cakeSurfaces(s)) {
  const blocks = pastryBlockers(s),
    topper = topperSeat(s, surfaces);
  if (topper) blocks.push(topper);
  return blocks;
}

export const greeneryProfiles = {
  "fl-green-eucalyptus-baby-blue": {
    length: 24,
    height: 4,
    spread: 0.52,
    lean: 0.32,
  },
  "fl-green-eucalyptus-silver": {
    length: 26,
    height: 4.5,
    spread: 0.55,
    lean: 0.3,
  },
  "fl-green-fern": { length: 18, height: 2.5, spread: 0.82, lean: 0.45 },
  "fl-green-lagurus": { length: 18, height: 5.5, spread: 0.38, lean: 0.23 },
  "fl-green-olive-branch": { length: 22, height: 5, spread: 0.48, lean: 0.35 },
  "fl-green-ruscus": { length: 22, height: 3, spread: 0.54, lean: 0.38 },
  "fl-fill-gypsophila": { length: 16, height: 2.5, spread: 0.65, lean: 0.24 },
  "fl-fill-solidago": { length: 20, height: 4, spread: 0.45, lean: 0.29 },
};
