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
  const recipe = recipes[state.pattern],
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
  for (const id of state.foodDecor || []) {
    const c = ingredients[id],
      footprint = c.asset
        ? cakeParts[c.asset]?.footprint || 0.8
        : id === "lemon-slice"
          ? 1.4
          : id === "strawberry-half"
            ? 0.8
            : id === "hazelnut"
              ? 0.65
              : 0.5;
    let accepted = 0;
    for (let i = 0; i < (state.foodCounts?.[id] || 3); i++) {
      let seat;
      for (let ring = 0; ring < 5 && !seat; ring++)
        for (let step = 0; step < 80 && !seat; step++) {
          const angle = 0.78 + (step / 80) * (Math.PI * 2 - 0.95),
            rr = radius * (0.65 - ring * 0.13);
          const x = Math.cos(angle) * rr,
            z = Math.sin(angle) * rr;
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
          if (rr + footprint > radius - 0.12) continue;
          const piece = small ? i % (state.pieces || 4) : 0;
          if (
            occupied.some(
              (p) =>
                p.piece === piece &&
                Math.hypot(p.x - x, p.z - z) < p.footprint + footprint + 0.12,
            )
          )
            continue;
          seat = { id, x, z, piece, footprint };
        }
      if (!seat) break;
      occupied.push(seat);
      accepted++;
    }
    if (accepted) counts[id] = accepted;
  }
  return { seats: occupied, counts };
}
