import { readFile, writeFile } from "node:fs/promises";
const manifest = JSON.parse(
    await readFile("shared/models/manifest.json", "utf8"),
  ),
  stones = JSON.parse(
    await readFile("shared/models/stones/catalog.json", "utf8"),
  );
const names = {
  "bk-berry-blackberry": "Ежевика",
  "bk-berry-blueberry": "Голубика",
  "bk-berry-cherry": "Вишня",
  "bk-berry-currant-red": "Спиральная свеча",
  "bk-berry-raspberry": "Малина",
  "bk-berry-strawberry": "Клубника",
  "bk-decor-caramel-spiral": "Карамельная спираль",
  "bk-decor-chocolate-shard": "Шоколадный лепесток",
  "bk-decor-cream-rosette": "Кремовая розетка",
  "bk-decor-crumble-cluster": "Хрустящий крамбл",
  "bk-decor-glaze-drip-ring": "Шоколадные подтёки",
  "bk-decor-gold-flake": "Сусальное золото",
  "bk-decor-macaron": "Макарон",
  "bk-decor-meringue-kiss": "Безе",
  "bk-decor-shell-border": "Кремовый бордюр",
  "bk-decor-sprinkle-ball": "Сахарные жемчужины",
  "bk-decor-sprinkle-star": "Сахарные звёзды",
  "bk-decor-truffle-ball": "Шоколадный трюфель",
  "bk-decor-wafer-roll": "Вафельная трубочка",
  "bk-pastry-brownie-bite": "Брауни",
  "bk-pastry-cookie-heart": "Печенье-сердце",
  "bk-pastry-cookie-round": "Сахарное печенье",
  "bk-pastry-cupcake": "Капкейк",
  "bk-pastry-donut": "Пончик",
  "bk-pastry-eclair": "Эклер",
  "bk-pastry-profiterole": "Профитроль",
  "bk-struct-tier-hex": "Шестиугольный торт",
  "bk-struct-tier-round": "Круглый торт",
  "bk-topper-banner-blank": "Праздничный флажок",
  "bk-topper-crown": "Корона",
  "bk-topper-heart": "Сердце",
  "bk-topper-horn": "Единорог",
  "bk-topper-star": "Звезда",
  "fl-fill-gypsophila": "Гипсофила",
  "fl-fill-solidago": "Солидаго",
  "fl-flower-anemone": "Анемона",
  "fl-flower-chamomile": "Ромашка",
  "fl-flower-chrysanthemum-spray": "Хризантема",
  "fl-flower-eustoma": "Эустома",
  "fl-flower-gerbera": "Гербера",
  "fl-flower-lily-oriental": "Восточная лилия",
  "fl-flower-peony-open": "Пион",
  "fl-flower-ranunculus": "Ранункулюс",
  "fl-flower-rose-garden": "Садовая роза",
  "fl-flower-tulip": "Тюльпан",
  "fl-green-eucalyptus-baby-blue": "Эвкалипт Baby Blue",
  "fl-green-eucalyptus-silver": "Серебристый эвкалипт",
  "fl-green-fern": "Папоротник",
  "fl-green-lagurus": "Лагурус",
  "fl-green-olive-branch": "Оливковая ветвь",
  "fl-green-ruscus": "Рускус",
  "fl-ribbon-jute-twine": "Джутовая нить",
  "fl-ribbon-rep-bow": "Репсовый бант",
  "fl-ribbon-satin-bow": "Атласный бант",
  "fl-vase-bottle-ceramic": "Керамическая ваза",
  "fl-vase-glass-cylinder": "Стеклянная ваза",
  "fl-vase-kraft-bucket": "Крафтовое ведёрко",
  "fl-wrap-basket-rattan": "Плетёная корзина",
  "fl-wrap-hatbox-round": "Шляпная коробка",
  "fl-wrap-kraft-cone": "Крафтовый конверт",
  "fl-wrap-matte-sleeve": "Матовая упаковка",
  "jw-base-band-plain": "Гладкое кольцо",
  "jw-base-chain-link-cable": "Звеньевая цепь",
  "jw-base-cocktail": "Коктейльное кольцо",
  "jw-base-cuff-bracelet": "Браслет-манжета",
  "jw-base-drop-earring": "Серьга-капля",
  "jw-base-ear-cuff": "Кафф",
  "jw-base-pendant": "Ажурная подвеска",
  "jw-base-signet": "Печатка",
  "jw-base-solitaire": "Солитер",
  "jw-base-stacking-thin": "Тонкое кольцо",
  "jw-base-stud-earring": "Серьга-гвоздик",
  "jw-part-bail-hinged": "Держатель подвески",
  "jw-part-charm-tag": "Шарм-медальон",
  "jw-part-clasp-lobster": "Замок-карабин",
  "jw-part-ear-wire-french": "Французская швенза",
  "jw-part-jump-ring": "Соединительное кольцо",
  "jw-set-baguette": "Оправа багет",
  "jw-set-bezel": "Кольцо с глухой оправой",
  "jw-set-halo": "Кольцо с ореолом",
  "jw-set-heart": "Оправа-сердце",
  "jw-set-marquise": "Оправа-маркиз",
  "jw-set-pave-band": "Браслет паве",
  "jw-set-pear": "Оправа-капля",
  "jw-set-prong4": "Четыре крапана",
  "jw-set-prong6": "Шесть крапанов",
  "jw-stone-cabochon-oval": "Овальный кабошон",
  "jw-stone-round-brilliant": "Круглый бриллиант",
};
const fruitColors = {
  blackberry: "#38223b",
  blueberry: "#414571",
  cherry: "#982331",
  raspberry: "#bf3d55",
  strawberry: "#bb3341",
};
const catalogue = [];
for (const m of manifest) {
  if (!names[m.id]) continue;
  const id = m.id;
  let project = id.startsWith("bk-")
      ? "cakes"
      : id.startsWith("fl-")
        ? "flowers"
        : "jewelry",
    category,
    role,
    size,
    color;
  if (project === "cakes") {
    category =
      id.includes("-struct-") || id.includes("-pastry-")
        ? "base"
        : id.includes("-topper-") || id === "bk-berry-currant-red"
          ? "topper"
          : "decor";
    role = id.includes("glaze")
      ? "glaze"
      : id.includes("shell-border")
        ? "border"
        : id.includes("sprinkle")
          ? "sprinkle"
          : id.includes("gold-flake")
            ? "foil"
            : category;
    size = id.includes("strawberry")
      ? 3.2
      : id.includes("blueberry")
        ? 1.2
        : id.includes("cherry")
          ? 3.5
          : id.includes("blackberry")
            ? 2.2
            : id.includes("raspberry")
              ? 2
              : id.includes("wafer")
                ? 5
                : id.includes("shard")
                  ? 5
                  : id.includes("caramel")
                    ? 4
                    : id.includes("meringue")
                      ? 2.4
                      : id.includes("rosette")
                        ? 2.4
                        : 3;
    color = id.includes("berry")
      ? fruitColors[id.split("-").at(-1)]
      : id.includes("chocolate") ||
          id.includes("truffle") ||
          id.includes("glaze")
        ? "#4d2c22"
        : id.includes("caramel")
          ? "#b2702f"
          : id.includes("crumble")
            ? "#be8c50"
            : id.includes("gold")
              ? "#c4a358"
              : "#f2dfcf";
    if (id === "bk-berry-currant-red") {
      color = "#f1c58a";
      size = 7;
    }
  } else if (project === "flowers") {
    category = id.includes("-flower-")
      ? "flowers"
      : id.includes("-green-") || id.includes("-fill-")
        ? "green"
        : id.includes("-ribbon-")
          ? "ribbon"
          : "pack";
    role = category;
    size = id.includes("peony")
      ? 8
      : id.includes("lily")
        ? 9
        : id.includes("tulip")
          ? 4.5
          : id.includes("chamomile")
            ? 5.5
            : 7;
    color =
      category === "green"
        ? id.includes("gypsophila")
          ? "#e7e5cf"
          : id.includes("solidago")
            ? "#c3a545"
            : "#57705a"
        : category === "pack"
          ? "#cab594"
          : "#cf829d";
  } else {
    category =
      id.includes("-base-") ||
      ["jw-set-bezel", "jw-set-halo", "jw-set-pave-band"].includes(id)
        ? "base"
        : id.includes("-stone-")
          ? "stone"
          : id.includes("-part-")
            ? "finding"
            : "setting";
    role = category;
    size = 1;
    color =
      category === "stone"
        ? id.includes("cabochon")
          ? "#397b68"
          : "#e6edf0"
        : "#c9a866";
  }
  const cakePrices = {
    "bk-pastry-brownie-bite": 7,
    "bk-pastry-cookie-heart": 5,
    "bk-pastry-cookie-round": 4,
    "bk-pastry-cupcake": 8,
    "bk-pastry-donut": 6,
    "bk-pastry-eclair": 9,
    "bk-pastry-profiterole": 5,
  };
  catalogue.push({
    id,
    name: names[id],
    project,
    category,
    role,
    url: m.url,
    size,
    color,
    price:
      project === "cakes"
        ? category === "base"
          ? cakePrices[id] || 85
          : category === "topper"
            ? 8
            : role === "glaze" || role === "border"
              ? 12
              : role === "sprinkle"
                ? 0.3
                : role === "foil"
                  ? 2
                  : id.includes("macaron")
                    ? 5
                    : id.includes("berry")
                      ? 1.5
                      : 2
        : project === "flowers"
          ? category === "flowers"
            ? 10
            : category === "pack"
              ? 20
              : 7
          : category === "base"
            ? 160
            : category === "stone"
              ? 75
              : 25,
    thumbnail: `thumbnails/${id}.jpg`,
    source: id,
  });
}
const diamondNames = [
  "Багет",
  "Кушон",
  "Сердце",
  "Ашер",
  "Ступенчатая огранка",
  "Изумрудная",
  "Принцесса",
  "Круглая",
  "Овал",
  "Маркиз",
  "Груша",
  "Триллион",
];
const gemNames = [
  "Овальный кабошон",
  "Круглый кабошон",
  "Бриллиант",
  "Изумрудная",
  "Ашер",
  "Сердце",
  "Маркиз",
  "Овал",
  "Груша",
  "Радиант",
  "Принцесса",
];
const colorMap = {
  White: ["Бесцветный", "#e6edf0"],
  Light_Blue: ["Аквамарин", "#8fcee3"],
  Green: ["Изумруд", "#2b886b"],
  Red: ["Рубин", "#a92445"],
  Purple: ["Аметист", "#8e66b3"],
  Orange: ["Цитрин", "#d18b3d"],
  Blue: ["Сапфир", "#345caa"],
  Yellow: ["Жёлтый топаз", "#d9b351"],
};
for (const s of stones) {
  const colorKey =
    s.pack === "gem" ? s.sourceMaterial.split("_-_")[0] : "White";
  const [tone, color] = colorMap[colorKey] || colorMap.White;
  catalogue.push({
    ...s,
    name:
      s.pack === "diamond"
        ? diamondNames[s.index - 1]
        : gemNames[Math.floor((s.index - 1) / 8)],
    variant: s.pack === "gem" ? tone : "Бриллиант",
    project: "jewelry",
    category: "stone",
    role: "stone",
    size: 1,
    color,
    price: s.pack === "diamond" ? 95 : 65,
    thumbnail: `thumbnails/${s.id}.jpg`,
    face: s.pack === "diamond" ? "z" : "y",
    source: "jw-stone/" + s.sourceFile,
  });
}
await writeFile(
  "shared/catalogue.js",
  "export const catalogue = " +
    JSON.stringify(catalogue, null, 2) +
    ";\nexport const byId = Object.fromEntries(catalogue.map(a=>[a.id,a]));\n",
);
console.log("Catalogue", catalogue.length, "models");
