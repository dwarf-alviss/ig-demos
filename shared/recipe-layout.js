import { recipeFootprintSupported } from "./recipe-outline.js";
import { tierClusterPoint } from "./tier-clusters.js";
import culinaryCompositions from "./culinary-compositions.json" with { type: "json" };
import { recipes, ingredients } from "./domain.js";
import { cakeParts } from "./assembly-profiles.js";
import { supportsDecoration } from "./pastry-support.js";
export const supportSizes = {
  "bk-pastry-cupcake": 7.5,
  "bk-pastry-eclair": 12,
  "bk-pastry-profiterole": 4.5,
  "bk-pastry-donut": 8,
  "bk-pastry-cookie-heart": 7,
  "bk-pastry-cookie-round": 6.5,
  "bk-pastry-brownie-bite": 5,
};
export function recipeSeats(state) {
  const original = recipes[state.pattern],
    recipe = original && {
      ...original,
      shape:
        ["vanilla-celebration", "mini-buttercream"].includes(original.id) &&
        state.base?.includes("hex")
          ? "hex"
          : original.shape,
    },
    occupied = [],
    counts = {};
  if (!recipe) return { seats: [], counts };
  const small = [
    "macaron",
    "eclair",
    "profiterole",
    "paris-brest",
    "cupcake",
    "donut",
    "cookie",
    "brownie",
  ].includes(recipe.type);
  const radius =
    (recipe.diameterCm / 2) * Math.pow(0.72, (state.tiers || 1) - 1);
  if (state.topper && ["sponge", "mini"].includes(recipe.type))
    occupied.push({ id: "topper", x: 0, z: 0, piece: 0, footprint: 2.2 });
  const requests = [],
    blocked = new Set();
  for (let i = 0; i < 12; i++)
    for (const id of state.foodDecor || [])
      if (i < (state.foodCounts?.[id] || 3)) requests.push({ id, index: i });
  for (const { id, index: i } of requests) {
    if (blocked.has(id)) continue;
    const c = ingredients[id],
      footprint = c.asset
        ? (cakeParts[c.asset]?.footprint || 0.8) *
          (c.sizeCm / (cakeParts[c.asset]?.size || c.sizeCm))
        : id === "lemon-slice"
          ? 1.4
          : id === "strawberry-half"
            ? 1.0
            : id === "hazelnut"
              ? 0.65
              : id === "piped-shell"
                ? 0.74
                : ["piped-rope", "cream-dollop"].includes(id)
                  ? 0.65
                  : 0.5;
    const composition = culinaryCompositions[recipe.id]?.layout;
    let seat;
    const tierCount = small ? 1 : Math.min(state.tiers || 1, recipe.maxTiers),
      preferred = (i + recipe.compatibleDecor.indexOf(id)) % tierCount;
    for (let pass = 0; pass < tierCount && !seat; pass++) {
      const tier = (preferred + pass) % tierCount,
        radius = (recipe.diameterCm / 2) * Math.pow(0.72, tier),
        inner = tier < tierCount - 1 ? radius * 0.72 + 0.12 : 0;
      if (inner && radius - inner < footprint * 2 + 0.28) continue;
      for (let ring = 0; ring < 5 && !seat; ring++)
        for (let step = 0; step < 80 && !seat; step++) {
          const angle =
              step < 40
                ? 1.9 + ((step * 2.399963 + i * 0.61) % 2.1)
                : 0.78 + ((step * 2.399963 + i * 0.61) % (Math.PI * 2 - 0.95)),
            rr =
              radius *
              (0.68 - ring * 0.13) *
              (0.88 + 0.12 * Math.sin(step * 1.7));
          let x = Math.cos(angle) * rr,
            z = Math.sin(angle) * rr;
          if (step < 40 && !small) {
            if (composition === "wreath") {
              const a =
                1.05 +
                ((i * 2.399963 +
                  step * 0.3 +
                  recipe.compatibleDecor.indexOf(id) * 0.6) %
                  (Math.PI * 2 - 1.25));
              const r = Math.min(
                radius - footprint - 0.25,
                radius * (0.79 - ring * 0.1),
              );
              x = Math.cos(a) * r;
              z = Math.sin(a) * r;
            } else if (composition === "diagonal") {
              x = radius * (-0.65 + ((i * 0.37 + step * 0.16) % 1.25));
              z =
                x * 0.36 -
                radius * 0.16 +
                Math.sin(step * 1.7) * footprint * 0.7;
            } else if (composition === "paired-clusters") {
              const a = i % 2 ? 4.15 : 2.6,
                spread =
                  Math.sqrt(Math.floor(i / 2) + step * 0.12) * footprint * 1.45;
              x =
                Math.cos(a) * radius * 0.48 +
                Math.cos(i * 2.4 + step * 0.5) * spread;
              z =
                Math.sin(a) * radius * 0.48 +
                Math.sin(i * 2.4 + step * 0.5) * spread;
            } else if (composition === "edge-fan") {
              const a = 2.2 + ((i * 0.34 + step * 0.19) % 1.4);
              const r = radius * (0.74 - ring * 0.12);
              x = Math.cos(a) * r;
              z = Math.sin(a) * r;
            }
          }
          if (inner) {
            const point = tierClusterPoint(
              { id: tier, radius, inner },
              footprint,
              ring * 80 + step,
              composition,
            );
            if (!point) continue;
            ({ x, z } = point);
          }
          if (Math.hypot(x, z) - footprint < inner) continue;
          if (
            recipe.shape === "rectangle" &&
            x > radius * 0.2 - footprint &&
            z > radius * 0.3 - footprint
          )
            continue;
          if (recipe.nativeBase) {
            const scale = recipe.diameterCm / supportSizes[recipe.nativeBase];
            if (
              !supportsDecoration(
                recipe.nativeBase,
                x / scale,
                z / scale,
                footprint / scale,
              )
            )
              continue;
          }
          if (
            recipe.type === "paris-brest" &&
            Math.abs(rr - recipe.diameterCm * 0.33) > recipe.diameterCm * 0.1
          )
            continue;
          if (
            recipe.shape === "rectangle" &&
            (Math.abs(z) + footprint > radius * 0.67 ||
              Math.abs(x) + footprint > radius)
          )
            continue;
          if (Math.hypot(x, z) + footprint > radius - 0.12) continue;
          if (
            !small &&
            !recipeFootprintSupported(recipe, radius, x, z, footprint)
          )
            continue;
          const piece = small ? i % (state.pieces || 4) : 0;
          if (
            occupied.some(
              (p) =>
                p.piece === piece &&
                (p.tier ?? tierCount - 1) === tier &&
                Math.hypot(p.x - x, p.z - z) < p.footprint + footprint + 0.12,
            )
          )
            continue;
          seat = { id, x, z, piece, footprint, index: i, tier };
        }
    }
    if (!seat) {
      blocked.add(id);
      continue;
    }
    occupied.push(seat);
    counts[id] = (counts[id] || 0) + 1;
  }
  return { seats: occupied, counts };
}
