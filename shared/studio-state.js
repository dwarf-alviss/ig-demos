import culinaryCompositions from "./culinary-compositions.json" with { type: "json" };
import { catalogue, byId } from "./catalogue.js";
import {
  resolvePattern,
  recipes,
  bouquets,
  forms,
  initialTaxonCounts,
  ingredients,
  designs,
} from "./domain.js";
import {
  cakeParts,
  cakeSurfaces,
  findCakeSeat,
  cakeBlockers,
} from "./assembly-profiles.js";
import { normalizeJewelry, compatibleFindings } from "./jewelry-rules.js";
import { recipeSeats } from "./recipe-layout.js";
export const projectSpecs = {
  cakes: {
    brand: "Мельница",
    tag: "Кондитерская мастерская",
    title: "Придумайте свой праздник.",
    subtitle:
      "Форма, вкус и маленькие детали — соберите торт, который будет только вашим.",
    categories: [
      ["base", "Форма"],
      ["decor", "Декор"],
      ["topper", "Топперы"],
    ],
    palette: [
      ["Сливочный", "#edd6b6"],
      ["Розовый", "#dfa2b0"],
      ["Оливковый", "#b4c3a0"],
      ["Какао", "#754432"],
    ],
    presets: [
      ["Ягодный сад", "Торт с кремом и свежими ягодами"],
      ["Праздничный", "Два яруса, макароны и корона"],
      ["Сладкий сет", "Капкейки для маленького праздника"],
    ],
  },
  flowers: {
    brand: "Пион",
    tag: "Ботаническая мастерская",
    title: "У каждого букета — своё чувство.",
    subtitle:
      "Сочетайте цветы, добавьте воздушную зелень и найдите красивую форму для вашей истории.",
    categories: [
      ["flowers", "Цветы"],
      ["green", "Зелень"],
      ["pack", "Упаковка"],
      ["ribbon", "Ленты"],
    ],
    palette: [
      ["Пудровый", "#d994ae"],
      ["Молочный", "#f3ebd7"],
      ["Винный", "#a44d6c"],
      ["Абрикосовый", "#e3a17e"],
      ["Исходные оттенки", "#e8dbc7"],
    ],
    presets: [
      ["Нежное утро", "Пионы, розы и эвкалипт"],
      ["Полевой этюд", "Ромашки, гипсофила и джут"],
      ["Сад в коробке", "Ранункулюсы с зеленью"],
    ],
  },
  jewelry: {
    brand: "Латунь",
    tag: "Ателье личных украшений",
    title: "Ваша история. В драгоценной форме.",
    subtitle:
      "Выберите силуэт и огранку, найдите свой оттенок металла. Рассмотрите каждую деталь.",
    categories: [
      ["base", "Изделие"],
      ["stone", "Камни"],
      ["setting", "Оправы"],
      ["finding", "Фурнитура"],
    ],
    palette: [
      ["Золото", "#cfac65"],
      ["Серебро", "#d1d8de"],
      ["Розовое золото", "#c7907c"],
      ["Графит", "#6a7378"],
    ],
    presets: [
      ["Первый свет", "Классический солитер с бриллиантом"],
      ["Лесной свет", "Кольцо с изумрудом и ореолом"],
      ["Личная история", "Подвеска с рубиновым камнем"],
    ],
  },
};
for (const [kind, label] of Object.entries({
  cakes: "Рецептуры",
  flowers: "Композиции",
  jewelry: "Конструкции",
}))
  projectSpecs[kind].categories.unshift(["pattern", label]);
projectSpecs.jewelry.palette = [
  ["Жёлтое золото", "#d8b56b"],
  ["Белое золото", "#e0ded3"],
  ["Розовое золото", "#d79e88"],
  ["Серебро", "#d5dbde"],
  ["Платина", "#c9cccf"],
];
export const presetPatterns = {
  cakes: ["vanilla-celebration", "fraisier", "macaron-pistachio"],
  flowers: ["garden-pink", "peony-mono", "white-box"],
  jewelry: ["solitaire", "halo-ring", "bezel-pendant"],
};
projectSpecs.cakes.presets = [
  ["Ванильный праздник", "Бисквит и масляный крем"],
  ["Фрезье", "Муслин, клубника и миндальная паста"],
  ["Фисташковые макароны", "Миндальная оболочка и фисташковый крем"],
];
projectSpecs.flowers.presets = [
  ["Розовый сад", "Розы, ранункулюсы и анемоны"],
  ["Пионы", "Круглый монобукет"],
  ["Светлая коробка", "Розы, эустома и гвоздика"],
];
projectSpecs.jewelry.presets = [
  ["Первый свет", "Солитер с шестью крапанами"],
  ["Ореол", "Центральный камень и обрамление"],
  ["Личная история", "Подвеска на тонкой цепочке"],
];
const counts = {
  "bk-berry-strawberry": 3,
  "bk-berry-blueberry": 7,
  "bk-decor-cream-rosette": 5,
  "fl-flower-peony-open": 5,
  "fl-flower-rose-garden": 4,
};
export function preset(kind, index = 0) {
  return normalize(kind, {
    ...defaults(kind),
    stone: undefined,
    palette: kind === "flowers" ? undefined : defaults(kind).palette,
    pattern: presetPatterns[kind][index] || presetPatterns[kind][0],
  });
}

export function defaults(kind) {
  return kind === "cakes"
    ? {
        version: 2,
        base: "bk-struct-tier-round",
        decor: [
          "bk-berry-strawberry",
          "bk-berry-blueberry",
          "bk-decor-cream-rosette",
        ],
        counts: Object.fromEntries(
          Object.entries(counts).filter(([id]) => id.startsWith("bk-")),
        ),
        topper: null,
        tiers: 1,
        pieces: 4,
        filling: "vanilla",
        palette: 0,
        layout: "crescent",
      }
    : kind === "flowers"
      ? {
          version: 2,
          flowers: ["fl-flower-peony-open", "fl-flower-rose-garden"],
          green: ["fl-green-eucalyptus-silver"],
          pack: "fl-wrap-matte-sleeve",
          ribbon: "fl-ribbon-satin-bow",
          counts: Object.fromEntries(
            Object.entries(counts).filter(([id]) => id.startsWith("fl-")),
          ),
          palette: 0,
        }
      : {
          version: 2,
          base: "jw-base-solitaire",
          stone: "jw-stone-diamond-08",
          setting: null,
          finding: [],
          counts: {},
          palette: 0,
          size: 17,
        };
}
export function normalize(kind, value) {
  const d = defaults(kind);
  if (!value || value.version !== 2) return d;
  const valid = (id, category) =>
    byId[id]?.project === kind && byId[id]?.category === category;
  const out = { ...d, counts: {} };
  out.pattern = resolvePattern(kind, value.pattern)?.id || null;
  out.finish = ["polished", "satin", "brushed", "hammered"].includes(
    value.finish,
  )
    ? value.finish
    : "polished";
  out.bouquetSize = [11, 19, 29].includes(Number(value.bouquetSize))
    ? Number(value.bouquetSize)
    : 19;
  if (out.pattern && kind === "flowers") {
    const initial = initialTaxonCounts(out.pattern, out.bouquetSize),
      validPlants = Object.keys(initial);
    out.taxonCounts = Object.fromEntries(
      validPlants.map((id) => [
        id,
        Math.max(
          1,
          Math.min(
            33,
            Math.round(Number(value.taxonCounts?.[id]) || initial[id]),
          ),
        ),
      ]),
    );
    let total = Object.values(out.taxonCounts).reduce((n, v) => n + v, 0);
    while (total > 33) {
      const id = validPlants.reduce((a, b) =>
        out.taxonCounts[a] >= out.taxonCounts[b] ? a : b,
      );
      out.taxonCounts[id]--;
      total--;
    }
  }
  if (out.pattern && kind === "cakes") {
    const recipe = recipes[out.pattern];
    out.cover = (recipe.compatibleCovers || [recipe.cover]).includes(
      value.cover,
    )
      ? value.cover
      : recipe.cover;
    out.foodDecor = Array.isArray(value.foodDecor)
      ? [...new Set(value.foodDecor)].filter((id) =>
          recipes[out.pattern].compatibleDecor.includes(id),
        )
      : Object.keys(culinaryCompositions[out.pattern]?.decor || {}).filter(
            (id) => recipes[out.pattern].compatibleDecor.includes(id),
          ).length
        ? Object.keys(culinaryCompositions[out.pattern].decor).filter((id) =>
            recipes[out.pattern].compatibleDecor.includes(id),
          )
        : recipes[out.pattern].defaultDecor ||
          recipes[out.pattern].compatibleDecor.slice(0, 2);
    out.foodCounts = Object.fromEntries(
      out.foodDecor.map((id) => [
        id,
        Math.max(
          1,
          Math.min(
            12,
            Math.round(
              Number(value.foodCounts?.[id]) ||
                (culinaryCompositions[out.pattern]?.decor[id] || 3) *
                  (culinaryCompositions[out.pattern]?.layout === "per-piece"
                    ? Number(value.pieces) || 4
                    : 1),
            ),
          ),
        ),
      ]),
    );
  }
  for (const key of ["base", "topper", "pack", "ribbon", "stone", "setting"])
    if (key in d)
      out[key] = valid(value[key], key)
        ? value[key]
        : value[key] === null &&
            ["topper", "ribbon", "stone", "setting"].includes(key)
          ? null
          : d[key];
  for (const key of ["decor", "flowers", "green", "finding"])
    if (key in d)
      out[key] = Array.isArray(value[key])
        ? [...new Set(value[key].filter((id) => valid(id, key)))].slice(
            0,
            key === "flowers" ? 5 : 6,
          )
        : d[key];
  if (kind === "flowers" && !out.flowers.length) out.flowers = d.flowers;
  if (kind === "cakes")
    out.decor = out.decor.filter(
      (id) =>
        !(
          out.base.includes("pastry") &&
          ["glaze", "border"].includes(byId[id].role)
        ) && !(out.base.includes("hex") && byId[id].role === "glaze"),
    );
  for (const id of [...(out.decor || []), ...(out.flowers || [])])
    out.counts[id] = Math.max(
      1,
      Math.min(
        kind === "flowers" ? 15 : byId[id].role === "sprinkle" ? 60 : 14,
        Math.round(Number(value.counts?.[id]) || d.counts[id] || 3),
      ),
    );
  for (const id of out.decor || [])
    if (["glaze", "border"].includes(byId[id].role)) out.counts[id] = 1;
  if (kind === "flowers") {
    let remaining = 33;
    for (const id of out.flowers) {
      out.counts[id] = Math.min(
        out.counts[id],
        remaining - (out.flowers.length - out.flowers.indexOf(id) - 1),
      );
      remaining -= out.counts[id];
    }
  }
  out.palette =
    Number.isInteger(value.palette) &&
    value.palette >= 0 &&
    value.palette < projectSpecs[kind].palette.length
      ? value.palette
      : kind === "flowers"
        ? bouquets[out.pattern]?.defaultPalette || 0
        : 0;
  if (kind === "cakes") {
    if (out.pattern && !["sponge", "mini"].includes(recipes[out.pattern].type))
      out.topper = null;
    if (out.pattern)
      out.tiers = Math.min(value.tiers || 1, recipes[out.pattern].maxTiers);
    out.filling = ["vanilla", "berry", "chocolate", "pistachio"].includes(
      value.filling,
    )
      ? value.filling
      : "vanilla";
    out.tiers = out.pattern
      ? Math.max(
          1,
          Math.min(Number(value.tiers) || 1, recipes[out.pattern].maxTiers),
        )
      : [1, 2, 3].includes(value.tiers)
        ? value.tiers
        : 1;
    out.pieces = [1, 4, 6].includes(value.pieces) ? value.pieces : 4;
    out.layout = ["crescent", "wreath", "center"].includes(value.layout)
      ? value.layout
      : "crescent";
    // A spiral is a focal garnish: one per small pastry, with its original dimensions.
    if (out.base.includes("pastry") && out.counts["bk-decor-caramel-spiral"])
      out.counts["bk-decor-caramel-spiral"] = Math.min(out.pieces,out.counts["bk-decor-caramel-spiral"]);
    const surfaces = cakeSurfaces(out),
      occupied = cakeBlockers(out);
    const originalDecorCount = out.decor.length;
    for (const id of [...out.decor].sort(
      (x, y) =>
        (out.base.includes("pastry")
          ? cakeParts[y]?.flatFootprint || cakeParts[y]?.footprint || 0
          : cakeParts[y]?.footprint || 0) -
        (out.base.includes("pastry")
          ? cakeParts[x]?.flatFootprint || cakeParts[x]?.footprint || 0
          : cakeParts[x]?.footprint || 0),
    )) {
      if (["glaze", "border"].includes(byId[id].role)) continue;
      const footprint = cakeParts[id]?.footprint || byId[id].size * 0.42;
      let accepted = 0;
      for (let i = 0; i < out.counts[id]; i++) {
        if (
          !findCakeSeat(
            surfaces,
            occupied,
            footprint,
            out.layout,
            i,
            cakeParts[id],
          )
        )
          break;
        accepted++;
      }
      if (accepted) out.counts[id] = accepted;
      else {
        out.decor = out.decor.filter((x) => x !== id);
        delete out.counts[id];
      }
    }
    if (out.decor.length < originalDecorCount) return normalize(kind, out);
  }
  if (kind === "jewelry")
    out.size = [16, 17, 18, 19, 20].includes(value.size) ? value.size : 17;
  if (kind === "jewelry" && out.pattern && value.stone === undefined)
    out.stone = null;
  if (kind === "jewelry" && designs[out.pattern]?.fixedMetals) out.palette = 0;
  if (out.pattern && kind === "flowers") {
    const form = forms[bouquets[out.pattern].form];
    if (form.packaging.includes("box")) out.pack = "fl-wrap-hatbox-round";
    else if (form.packaging.includes("basket"))
      out.pack = "fl-wrap-basket-rattan";
    else if (form.packaging.includes("ribbon")) out.pack = null;
    else if (
      !out.pack ||
      ["fl-wrap-hatbox-round", "fl-wrap-basket-rattan"].includes(out.pack)
    )
      out.pack = d.pack;
  }
  if (out.pattern && kind === "cakes") {
    const layout = recipeSeats(out);
    out.foodCounts = layout.counts;
    out.foodDecor = out.foodDecor.filter((id) => layout.counts[id]);
  }
  return kind === "jewelry" ? normalizeJewelry(out) : out;
}
export function selectedIds(kind, s) {
  return [
    ...new Set(
      [
        s.base,
        s.topper,
        s.pack,
        s.ribbon,
        s.stone,
        s.setting,
        ...(s.decor || []),
        ...(s.flowers || []),
        ...(s.green || []),
        ...(s.finding || []),
      ].filter(Boolean),
    ),
  ];
}
export function canSelectCakeDecoration(s, id) {
  if (s.decor.includes(id)) return true;
  const next = normalize("cakes", {
    ...s,
    decor: [...s.decor, id],
    counts: { ...s.counts, [id]: 1 },
  });
  return (
    next.decor.includes(id) &&
    s.decor.every((other) => next.counts[other] === s.counts[other])
  );
}
export function canIncreaseCount(kind, s, id) {
  const count = s.counts[id] || 0,
    limit = kind === "flowers" ? 15 : byId[id]?.role === "sprinkle" ? 60 : 14;
  if (count >= limit) return false;
  if (kind === "flowers")
    return Object.values(s.counts).reduce((n, v) => n + v, 0) < 33;
  if (kind !== "cakes") return false;
  const next = normalize(kind, {
    ...s,
    counts: { ...s.counts, [id]: count + 1 },
  });
  return (
    next.counts[id] === count + 1 &&
    s.decor.every(
      (other) => other === id || next.counts[other] === s.counts[other],
    )
  );
}
export function estimate(kind, s) {
  const pattern = resolvePattern(kind, s.pattern);
  if (pattern) {
    if (kind === "cakes") {
      const small = [
        "macaron",
        "eclair",
        "profiterole",
        "paris-brest",
        "cupcake",
        "donut",
        "cookie",
        "brownie",
      ].includes(pattern.type);
      const base = small
        ? (5 + pattern.diameterCm * 0.6 + pattern.layers.length) *
          (s.pieces || 1)
        : (35 + pattern.diameterCm * 1.8 + pattern.layers.length * 3) *
          (s.tiers || 1);
      return Math.round(
        base +
          (s.foodDecor || []).reduce(
            (n, id) => n + (s.foodCounts?.[id] || 3) * 1.4,
            0,
          ) +
          (s.topper && !small ? byId[s.topper]?.price || 0 : 0),
      );
    }
    if (kind === "flowers")
      return Math.round(
        Object.values(s.taxonCounts || {}).reduce((n, v) => n + v, 0) * 7.5 +
          18,
      );
    return Math.round(
      { ring: 220, earring: 170, pendant: 185, bracelet: 350, chain: 240 }[
        pattern.type
      ] +
        (pattern.stoneSizeMm || 0) * 35 +
        (["yellow-gold", "white-gold", "rose-gold", "silver", "platinum"][
          s.palette
        ] === "platinum"
          ? 90
          : 0),
    );
  }
  let total = 0;
  for (const id of selectedIds(kind, s)) {
    const a = byId[id];
    let count = s.counts[id] || 1;
    if (a.category === "base")
      count =
        kind === "cakes" ? (a.id.includes("-struct-") ? s.tiers : s.pieces) : 1;
    if (kind === "jewelry" && a.category === "stone")
      count =
        s.base === "jw-set-pave-band"
          ? 44
          : s.base === "jw-base-cocktail"
            ? 2
            : 1;
    total += a.price * count;
  }
  if (kind === "cakes" && !s.base.includes("pastry"))
    total +=
      ({ vanilla: 0, berry: 8, chocolate: 10, pistachio: 16 }[s.filling] || 0) *
      s.tiers;
  return Math.round(total * 100) / 100;
}
export function describe(kind, s) {
  const pattern = resolvePattern(kind, s.pattern);
  if (pattern)
    return [
      pattern.name,
      kind === "cakes"
        ? `${["macaron", "eclair", "profiterole", "paris-brest", "cupcake", "donut", "cookie", "brownie"].includes(pattern.type) ? s.pieces + " шт." : s.tiers + " ярус"} · ${pattern.diameterCm} см`
        : kind === "flowers"
          ? `${Object.values(s.taxonCounts || {}).reduce((n, v) => n + v, 0)} стеблей`
          : pattern.fixedMetals
            ? "Три оттенка золота"
            : projectSpecs.jewelry.palette[s.palette][0],
      kind === "jewelry" && s.stone
        ? byId[s.stone]?.variant || byId[s.stone]?.name
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    kind === "cakes" && !s.base.includes("pastry")
      ? [
          {
            vanilla: "Ванильный бисквит",
            berry: "Ваниль и малина",
            chocolate: "Шоколадный ганаш",
            pistachio: "Фисташка и клубника",
          }[s.filling] || "Ванильный бисквит",
        ]
      : []
  )
    .concat(
      selectedIds(kind, s).map(
        (id) => byId[id].name + (s.counts[id] ? ` ×${s.counts[id]}` : ""),
      ),
    )
    .join(" · ");
}
export function toggleAsset(kind, s, id) {
  const a = byId[id],
    next = structuredClone(s);
  if (a.project !== kind) return s;
  if (kind === "cakes") {
    if (["glaze", "border"].includes(a.role) && next.base.includes("pastry"))
      next.base = "bk-struct-tier-round";
    if (a.role === "glaze") next.base = "bk-struct-tier-round";
    if (a.category === "base" && (id.includes("pastry") || id.includes("hex")))
      next.decor = next.decor.filter(
        (x) =>
          !["glaze", ...(id.includes("pastry") ? ["border"] : [])].includes(
            byId[x].role,
          ),
      );
  }
  if (a.category === "finding") {
    const baseFor = {
      "jw-part-ear-wire-french": "jw-base-drop-earring",
      "jw-part-bail-hinged": "jw-base-pendant",
      "jw-part-clasp-lobster": "jw-base-chain-link-cable",
      "jw-part-charm-tag": "jw-base-chain-link-cable",
      "jw-part-jump-ring": "jw-base-pendant",
    };
    if (baseFor[id] && !compatibleFindings(next).some((a) => a.id === id))
      next.base = baseFor[id];
  }
  if (["decor", "flowers", "green", "finding"].includes(a.category)) {
    const list = next[a.category];
    if (list.includes(id)) {
      if (a.category === "flowers" && list.length === 1) return s;
      next[a.category] = list.filter((x) => x !== id);
      delete next.counts[id];
    } else {
      if (a.category === "flowers" && list.length >= 5) return s;
      if (list.length >= 6) list.shift();
      list.push(id);
      next.counts[id] =
        a.category === "flowers"
          ? 3
          : a.role === "sprinkle"
            ? 12
            : a.role === "foil"
              ? 4
              : 3;
    }
  } else {
    if (a.category === "setting") {
      const shape = {
        "jw-set-heart": "jw-stone-diamond-03",
        "jw-set-marquise": "jw-stone-diamond-10",
        "jw-set-pear": "jw-stone-diamond-11",
        "jw-set-baguette": "jw-stone-diamond-01",
      };
      if (shape[id]) next.stone = shape[id];
      if (
        [
          "jw-base-solitaire",
          "jw-base-cocktail",
          "jw-set-halo",
          "jw-set-bezel",
        ].includes(next.base)
      )
        next.base = "jw-base-band-plain";
    }
    if (a.category === "finding") {
      const baseFor = {
        "jw-part-ear-wire-french": "jw-base-drop-earring",
        "jw-part-bail-hinged": "jw-base-pendant",
        "jw-part-clasp-lobster": "jw-base-chain-link-cable",
        "jw-part-charm-tag": "jw-base-chain-link-cable",
        "jw-part-jump-ring": "jw-base-pendant",
      };
      if (baseFor[id]) next.base = baseFor[id];
    }
    next[a.category] =
      next[a.category] === id &&
      ["setting", "finding", "topper", "ribbon", "stone"].includes(a.category)
        ? null
        : id;
    if (a.category === "base" && kind === "jewelry") {
      next.setting = null;
      next.finding = [];
    }
  }
  return normalize(kind, next);
}
