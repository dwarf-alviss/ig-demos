import baking from "./domain/baking.json" with { type: "json" };
import flowers from "./domain/flowers.json" with { type: "json" };
import jewelry from "./domain/jewelry.json" with { type: "json" };
import materials from "./domain/materials.json" with { type: "json" };
import sources from "./domain/sources.json" with { type: "json" };
export { baking, flowers, jewelry, materials, sources };
export const index = (xs) => Object.fromEntries(xs.map((x) => [x.id, x]));
export const recipes = index(baking.recipes),
  ingredients = index(baking.components);
export const plants = index(flowers.plants),
  bouquets = index(flowers.bouquets),
  forms = index(flowers.forms);
export const designs = index(jewelry.patterns),
  jewelParts = index(jewelry.components),
  materialProfiles = index(materials);
export const patternLists = {
  cakes: baking.recipes,
  flowers: flowers.bouquets,
  jewelry: jewelry.patterns,
};
export function resolvePattern(kind, id) {
  return patternLists[kind].find((p) => p.id === id);
}
export function initialTaxonCounts(pattern, size = 19) {
  const p = bouquets[pattern],
    out = {};
  if (!p) return out;
  const count =p.stemCounts[{11:'small',19:'medium',29:'large'}[size]]||size;
  const focal = p.roles.secondary.length ? Math.round(count * 0.55) : count;
  for (let i = 0; i < count; i++) {
    const role = i < focal ? "focal" : "secondary",
      list = p.roles[role].length ? p.roles[role] : p.roles.focal;
    const id = list[(i < focal ? i : i - focal) % list.length];
    out[id] = (out[id] || 0) + 1;
  }
  return out;
}
export function layerStack(recipe, scale = 1) {
  let bottom = 0;
  return recipe.layers.map((layer) => {
    const component = ingredients[layer.component];
    if (!component)
      throw new Error(`Unknown recipe component ${layer.component}`);
    const thickness = layer.thicknessCm * scale,
      result = { component, bottom, thickness };
    bottom += thickness;
    return result;
  });
}
