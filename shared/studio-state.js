import { catalogue, byId } from "./catalogue.js";
import {
  cakeParts,
  cakeSurfaces,
  findCakeSeat,
  cakeBlockers,
} from "./assembly-profiles.js";
import { normalizeJewelry } from "./jewelry-rules.js";
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
const counts = {
  "bk-berry-strawberry": 3,
  "bk-berry-blueberry": 7,
  "bk-decor-cream-rosette": 5,
  "fl-flower-peony-open": 5,
  "fl-flower-rose-garden": 4,
};
export function preset(kind, index = 0) {
  if (kind === "cakes")
    return index === 1
      ? {
          ...defaults(kind),
          base: "bk-struct-tier-round",
          tiers: 2,
          decor: [
            "bk-decor-macaron",
            "bk-berry-raspberry",
            "bk-decor-gold-flake",
          ],
          counts: {
            "bk-decor-macaron": 4,
            "bk-berry-raspberry": 5,
            "bk-decor-gold-flake": 5,
          },
          topper: "bk-topper-crown",
          palette: 1,
        }
      : index === 2
        ? {
            ...defaults(kind),
            base: "bk-pastry-cupcake",
            decor: ["bk-berry-blueberry"],
            counts: { "bk-berry-blueberry": 5 },
            pieces: 4,
          }
        : defaults(kind);
  if (kind === "flowers")
    return index === 1
      ? {
          ...defaults(kind),
          flowers: ["fl-flower-chamomile"],
          green: ["fl-fill-gypsophila", "fl-green-lagurus"],
          pack: "fl-wrap-kraft-cone",
          ribbon: "fl-ribbon-jute-twine",
          counts: { "fl-flower-chamomile": 11 },
          palette: 1,
        }
      : index === 2
        ? {
            ...defaults(kind),
            flowers: ["fl-flower-ranunculus", "fl-flower-eustoma"],
            green: ["fl-green-ruscus"],
            pack: "fl-wrap-hatbox-round",
            ribbon: "fl-ribbon-rep-bow",
            counts: { "fl-flower-ranunculus": 7, "fl-flower-eustoma": 4 },
            palette: 3,
          }
        : defaults(kind);
  return index === 1
    ? {
        ...defaults(kind),
        base: "jw-set-halo",
        stone: "jw-stone-gem-18",
        palette: 0,
      }
    : index === 2
      ? {
          ...defaults(kind),
          base: "jw-base-pendant",
          stone: "jw-stone-gem-19",
          finding: ["jw-part-bail-hinged"],
          palette: 2,
        }
      : defaults(kind);
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
      : 0;
  if (kind === "cakes") {
    out.filling = ["vanilla", "berry", "chocolate", "pistachio"].includes(
      value.filling,
    )
      ? value.filling
      : "vanilla";
    out.tiers = [1, 2, 3].includes(value.tiers) ? value.tiers : 1;
    out.pieces = [1, 4, 6].includes(value.pieces) ? value.pieces : 4;
    out.layout = ["crescent", "wreath", "center"].includes(value.layout)
      ? value.layout
      : "crescent";
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
    if (baseFor[id]) next.base = baseFor[id];
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
