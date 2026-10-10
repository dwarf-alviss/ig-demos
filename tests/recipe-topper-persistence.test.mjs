import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  normalize,
  estimate,
  selectedIds,
} from "../shared/studio-state.js";
import { recipes } from "../shared/domain.js";

test("switching to a recipe with no topper mount clears hidden accessories and charges", () => {
  for (const recipe of Object.values(recipes)) {
    const plain = normalize("cakes", {
      ...defaults("cakes"),
      pattern: recipe.id,
      topper: null,
    });
    const saved = normalize("cakes", { ...plain, topper: "bk-topper-crown" });
    if (["sponge", "mini"].includes(recipe.type)) {
      assert.equal(saved.topper, "bk-topper-crown", recipe.id);
      continue;
    }
    assert.equal(saved.topper, null, recipe.id);
    assert.equal(
      estimate("cakes", saved),
      estimate("cakes", plain),
      recipe.id + " must not charge for an invisible crown",
    );
    assert.ok(
      !selectedIds("cakes", saved).includes("bk-topper-crown"),
      recipe.id,
    );
    assert.deepEqual(
      normalize("cakes", JSON.parse(JSON.stringify(saved))),
      saved,
      recipe.id + " cart reload must stay stable",
    );
  }
});
