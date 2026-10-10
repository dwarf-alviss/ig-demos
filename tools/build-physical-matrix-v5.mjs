import { cakeBlockers } from "../shared/assembly-profiles.js";
import { catalogue, byId } from "../shared/catalogue.js";
import { defaults, normalize } from "../shared/studio-state.js";
import {
  compatibleStones,
  compatibleSettings,
  compatibleFindings,
} from "../shared/jewelry-rules.js";
import { mkdir, writeFile } from "node:fs/promises";
const requested = process.argv[2] || "all",
  filter = process.argv[3];
const folder = "reports/revision-5";
await mkdir(`${folder}/combinations`, { recursive: true });
const cases = [],
  seenCases = new Set();
const assets = (kind, category) =>
  catalogue.filter((a) => a.project === kind && a.category === category);
const add = (kind, state, label) => {
  const s = normalize(kind, { ...state, pattern: null }),
    key = JSON.stringify(s);
  if (seenCases.has(kind + key)) return;
  seenCases.add(kind + key);
  cases.push({ kind, state: s, label, key });
};
if (["all", "flowers"].includes(requested)) {
  for (const pack of assets("flowers", "pack"))
    for (const flower of assets("flowers", "flowers"))
      for (const green of [null, ...assets("flowers", "green")])
        for (const ribbon of [null, ...assets("flowers", "ribbon")]) {
          add(
            "flowers",
            {
              ...defaults("flowers"),
              pack: pack.id,
              flowers: [flower.id],
              counts: { [flower.id]: 7 },
              green: green ? [green.id] : [],
              ribbon: ribbon?.id || null,
            },
            [
              pack.id,
              flower.id,
              green?.id || "no-green",
              ribbon?.id || "no-ribbon",
            ].join(" / "),
          );
        }
  for (const pack of assets("flowers", "pack"))
    for (let offset = 0; offset < 10; offset++) {
      const flowers = assets("flowers", "flowers")
          .filter((_, i) => (i + offset) % 10 < 5)
          .map((a) => a.id),
        green = assets("flowers", "green")
          .filter((_, i) => i % 2 === offset % 2)
          .map((a) => a.id);
      add(
        "flowers",
        {
          ...defaults("flowers"),
          pack: pack.id,
          flowers,
          green,
          counts: Object.fromEntries(flowers.map((id) => [id, 15])),
          ribbon: assets("flowers", "ribbon")[offset % 3].id,
        },
        `${pack.id} / mixed maximum ${offset}`,
      );
    }
}
if (["all", "flowers"].includes(requested))
  for (const pack of assets("flowers", "pack"))
    for (const flower of assets("flowers", "flowers"))
      add(
        "flowers",
        {
          ...defaults("flowers"),
          pack: pack.id,
          flowers: [flower.id],
          counts: { [flower.id]: 7 },
          green: [],
          ribbon: null,
          palette: 4,
        },
        `${pack.id} / ${flower.id} / native colors`,
      );
if (["all", "cakes"].includes(requested)) {
  const decor = assets("cakes", "decor"),
    toppers = [null, ...assets("cakes", "topper")];
  for (const base of assets("cakes", "base"))
    for (const amount of [1, 2, 3]) {
      const s = {
        ...defaults("cakes"),
        base: base.id,
        decor: [],
        topper: null,
        tiers: amount,
        pieces: [1, 4, 6][amount - 1],
      };
      for (const d of decor)
        for (const topper of toppers) {
          if (
            ["glaze", "border"].includes(d.role) &&
            base.id.includes("pastry")
          )
            continue;
          if (d.role === "glaze" && base.id.includes("hex")) continue;
          add(
            "cakes",
            {
              ...s,
              decor: [d.id],
              counts: { [d.id]: d.role === "sprinkle" ? 24 : 4 },
              topper: topper?.id || null,
            },
            `${base.id} / ${amount} / ${d.id} / ${topper?.id || "no-topper"}`,
          );
        }
      // Each decoration pair at high quantity tests mixed dimensions and capacity.
      for (let i = 0; i < decor.length; i++)
        for (let j = i + 1; j < decor.length; j++) {
          const pair = [decor[i], decor[j]];
          if (
            pair.some((d) => ["glaze", "border"].includes(d.role)) &&
            base.id.includes("pastry")
          )
            continue;
          if (pair.some((d) => d.role === "glaze") && base.id.includes("hex"))
            continue;
          add(
            "cakes",
            {
              ...s,
              decor: pair.map((d) => d.id),
              counts: Object.fromEntries(pair.map((d) => [d.id, 14])),
            },
            `${base.id} / ${amount} / pair ${pair.map((d) => d.id).join("+")}`,
          );
        }
    }
  for (const filling of ["vanilla", "berry", "chocolate", "pistachio"])
    for (const layout of ["crescent", "wreath", "center"])
      add(
        "cakes",
        { ...defaults("cakes"), filling, layout, tiers: 3 },
        `three tiers / ${filling} / ${layout}`,
      );
}
if (["all", "jewelry"].includes(requested)) {
  for (const base of assets("jewelry", "base")) {
    const s = {
      ...defaults("jewelry"),
      base: base.id,
      setting: null,
      finding: [],
    };
    for (const setting of [null, ...compatibleSettings(s)]) {
      const design = { ...s, setting: setting?.id || null };
      for (const stone of [null, ...compatibleStones(design)]) {
        add(
          "jewelry",
          { ...design, stone: stone?.id || null },
          `${base.id} / ${setting?.id || "native-socket"} / ${stone?.id || "no-stone"}`,
        );
      }
    }
  }
}
if (["all", "jewelry"].includes(requested)) {
  for (const base of assets("jewelry", "base")) {
    const s = {
      ...defaults("jewelry"),
      base: base.id,
      setting: null,
      finding: [],
      pattern: null,
    };
    const choices = compatibleFindings(s);
    for (let mask = 1; mask < 2 ** choices.length; mask++) {
      const finding = choices
        .filter((_, i) => mask & (1 << i))
        .map((a) => a.id);
      for (const stone of [null, ...compatibleStones(s)])
        add(
          "jewelry",
          { ...s, finding, stone: stone?.id || null },
          `${base.id} / findings ${finding.join("+")} / ${stone?.id || "no-stone"}`,
        );
    }
  }
}
await writeFile(
  `${folder}/matrix-${requested}.json`,
  JSON.stringify(
    cases.map(({ key, ...c }) => c),
    null,
    2,
  ),
);
console.log(requested, cases.length, "configurations");
