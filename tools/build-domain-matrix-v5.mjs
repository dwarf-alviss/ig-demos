import { writeFile } from "node:fs/promises";
import { patternLists, forms, initialTaxonCounts } from "../shared/domain.js";
import { catalogue } from "../shared/catalogue.js";
import { defaults, normalize } from "../shared/studio-state.js";
import { compatibleStones } from "../shared/jewelry-rules.js";
const cases = [],
  seen = new Set();
function add(kind, state, label) {
  const s = normalize(kind, state),
    key = kind + JSON.stringify(s);
  if (seen.has(key)) return;
  seen.add(key);
  if (kind === "jewelry" && label.endsWith(" / no-stone") && s.stone)
    label = label.replace(" / no-stone", ` / ${s.stone} (required by design)`);
  if (kind === "cakes" && state.topper && !s.topper)
    label = label.replace(
      ` / ${state.topper}`,
      " / no-topper (unsupported by recipe)",
    );
  cases.push({ kind, state: s, label });
}
for (const pattern of patternLists.jewelry) {
  for (const stone of [null, ...compatibleStones({ pattern: pattern.id })])
    add(
      "jewelry",
      { ...defaults("jewelry"), pattern: pattern.id, stone: stone?.id || null },
      `${pattern.id} / ${stone?.id || "no-stone"}`,
    );
  for (const palette of [0, 1, 2, 3, 4])
    for (const finish of ["polished", "satin", "brushed", "hammered"])
      add(
        "jewelry",
        {
          ...defaults("jewelry"),
          pattern: pattern.id,
          stone: undefined,
          palette,
          finish,
        },
        `${pattern.id} / metal ${palette} / ${finish}`,
      );
}
for (const pattern of patternLists.flowers) {
  const form = forms[pattern.form];
  const packs = form.packaging.includes("ribbon")
    ? [null]
    : form.packaging.includes("box")
      ? ["fl-wrap-hatbox-round"]
      : form.packaging.includes("basket")
        ? ["fl-wrap-basket-rattan"]
        : catalogue
            .filter(
              (a) =>
                a.project === "flowers" &&
                a.category === "pack" &&
                !a.id.includes("hatbox") &&
                !a.id.includes("basket"),
            )
            .map((a) => a.id);
  for (const pack of packs)
    for (const ribbon of [
      null,
      ...catalogue
        .filter((a) => a.project === "flowers" && a.category === "ribbon")
        .map((a) => a.id),
    ])
      for (const bouquetSize of [11, 19, 29]) {
        const s = {
          ...defaults("flowers"),
          pattern: pattern.id,
          pack,
          ribbon,
          bouquetSize,
        };
        add(
          "flowers",
          s,
          `${pattern.id} / ${pack || "bound"} / ${ribbon || "plain"} / ${bouquetSize}`,
        );
        const initial = initialTaxonCounts(pattern.id, bouquetSize);
        for (const id of Object.keys(initial))
          for (const count of [1, 33])
            add(
              "flowers",
              { ...s, taxonCounts: { ...initial, [id]: count } },
              `${pattern.id} / ${pack || "bound"} / ${ribbon || "plain"} / ${id} ${count}`,
            );
      }
}
for (const pattern of patternLists.cakes) {
  const choices = pattern.compatibleDecor;
  for (let mask = 0; mask < 2 ** choices.length; mask++) {
    const foodDecor = choices.filter((_, i) => mask & (1 << i));
    for (const count of [1, 12])
      for (const tiers of new Set([1, pattern.maxTiers])) {
        const s = {
          ...defaults("cakes"),
          pattern: pattern.id,
          foodDecor,
          foodCounts: Object.fromEntries(foodDecor.map((id) => [id, count])),
          tiers,
          pieces: count === 1 ? 1 : 6,
        };
        add(
          "cakes",
          s,
          `${pattern.id} / ${foodDecor.join("+") || "plain"} / ${count} / tiers ${tiers}`,
        );
      }
  }
  for (const cover of pattern.compatibleCovers || [pattern.cover])
    for (const topper of [
      null,
      ...catalogue
        .filter((a) => a.project === "cakes" && a.category === "topper")
        .map((a) => a.id),
    ])
      add(
        "cakes",
        { ...defaults("cakes"), pattern: pattern.id, cover, topper },
        `${pattern.id} / ${cover} / ${topper || "no-topper"}`,
      );
}
await writeFile(
  "reports/revision-5/matrix-domain.json",
  JSON.stringify(cases, null, 2),
);
console.log(
  cases.length,
  Object.fromEntries(
    ["flowers", "cakes", "jewelry"].map((k) => [
      k,
      cases.filter((c) => c.kind === k).length,
    ]),
  ),
);
