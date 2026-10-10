export const themes = {
  cakes: {
    brand: "Мельница",
    eyebrow: "Кондитерская студия / на ваш вкус",
    title: "Ваш праздник.\nВаш рецепт.",
    description:
      "Соберите торт от первого яруса до последней ягоды. Меняйте детали и рассматривайте композицию со всех сторон.",
    image: "assets/img/berry.jpg",
    unit: "порций",
    colors: [
      ["Сливочный", "#f4e7cd"],
      ["Какао", "#663c2d"],
      ["Розовый", "#e8a9b2"],
      ["Фисташка", "#bbc99b"],
    ],
    base: [
      ["bk-struct-tier-round", "Круглый ярус", 85],
      ["bk-struct-tier-hex", "Шестиугольный ярус", 95],
    ],
    detail: [
      ["bk-berry-strawberry", "Клубника", 12],
      ["bk-berry-blueberry", "Голубика", 10],
      ["bk-berry-raspberry", "Малина", 14],
      ["bk-decor-macaron", "Макароны", 18],
      ["bk-decor-cream-rosette", "Кремовые розы", 12],
      ["bk-decor-chocolate-shard", "Шоколад", 15],
    ],
    extra: [
      ["none", "Без топпера", 0],
      ["bk-topper-heart", "Сердце", 8],
      ["bk-topper-crown", "Корона", 12],
      ["bk-topper-star", "Звезда", 6],
    ],
    quantity: [1, 2, 3],
    quantityLabel: "Количество ярусов",
    presets: [
      ["Тихий праздник", 0, 0, 0, 1],
      ["Ягодное лето", 0, 2, 2, 2],
      ["Большой день", 1, 4, 0, 3],
    ],
  },
  flowers: {
    brand: "Пион",
    eyebrow: "Ботаническая мастерская / соберите своё",
    title: "Маленький сад\nдля большого чувства.",
    description:
      "Один любимый цветок или целая история. Выберите форму букета, оттенок и упаковку — мы покажем, как они звучат вместе.",
    image: "assets/img/mono.jpg",
    unit: "цветов",
    colors: [
      ["Пудра", "#e7a8ba"],
      ["Молочный", "#f2eadb"],
      ["Вино", "#973b58"],
      ["Абрикос", "#ecae83"],
    ],
    base: [
      ["fl-flower-peony-open", "Пион", 12],
      ["fl-flower-rose-garden", "Садовая роза", 10],
      ["fl-flower-tulip", "Тюльпан", 7],
      ["fl-flower-chamomile", "Ромашка", 6],
      ["fl-flower-ranunculus", "Ранункулюс", 11],
      ["fl-flower-anemone", "Анемона", 9],
    ],
    detail: [
      ["fl-wrap-kraft-cone", "Крафт", 12],
      ["fl-wrap-hatbox-round", "Шляпная коробка", 25],
      ["fl-vase-bottle-ceramic", "Керамическая ваза", 35],
      ["fl-wrap-basket-rattan", "Плетёная корзина", 30],
    ],
    extra: [
      ["none", "Только цветы", 0],
      ["fl-green-eucalyptus-silver", "Эвкалипт", 8],
      ["fl-fill-gypsophila", "Гипсофила", 10],
      ["fl-green-fern", "Папоротник", 7],
    ],
    quantity: [3, 5, 9, 15],
    quantityLabel: "Количество цветов",
    presets: [
      ["Нежное утро", 0, 0, 0, 5],
      ["Сад после дождя", 1, 2, 1, 9],
      ["Признание", 4, 1, 2, 15],
    ],
  },
  jewelry: {
    brand: "Латунь",
    eyebrow: "Ателье украшений / личная коллекция",
    title: "Форма, которая\nговорит о вас.",
    description:
      "Начните с силуэта. Найдите свой металл и камень. Рассмотрите каждую грань будущего украшения в свете студии.",
    image: "assets/img/ring.jpg",
    unit: "размер",
    colors: [
      ["Золото", "#d4af68"],
      ["Серебро", "#d8dce0"],
      ["Розовое золото", "#ca9581"],
      ["Графит", "#565b63"],
    ],
    base: [
      ["jw-base-solitaire", "Солитер", 160],
      ["jw-base-signet", "Печатка", 180],
      ["jw-base-pendant", "Подвеска", 140],
      ["jw-base-stud-earring", "Серьга", 120],
      ["jw-base-cuff-bracelet", "Браслет", 210],
    ],
    detail: [
      ["jw-stone-round-brilliant", "Бриллиант", 95],
      ["jw-stone-cabochon-oval", "Кабошон", 65],
    ],
    extra: [
      ["none", "Чистый силуэт", 0],
      ["jw-set-prong4", "Четыре крапана", 30],
      ["jw-set-bezel", "Ободковая оправа", 35],
      ["jw-set-halo", "Ореол", 55],
    ],
    quantity: [16, 17, 18, 19, 20],
    quantityLabel: "Размер кольца, мм",
    presets: [
      ["Первый свет", 0, 0, 0, 17],
      ["Архитектура", 1, 1, 3, 18],
      ["Наследие", 0, 0, 2, 17],
    ],
  },
};
export function price(theme, state) {
  return (
    theme.base[state.base][2] *
      (theme === themes.cakes
        ? state.quantity
        : theme === themes.flowers
          ? state.quantity
          : 1) +
    theme.detail[state.detail][2] +
    theme.extra[state.extra][2]
  );
}
export function sanitize(theme, value = {}) {
  const out = {};
  for (const key of ["base", "detail", "extra", "color"]) {
    const list = key === "color" ? theme.colors : theme[key];
    out[key] =
      Number.isInteger(value[key]) &&
      value[key] >= 0 &&
      value[key] < list.length
        ? value[key]
        : 0;
  }
  out.quantity = theme.quantity.includes(value.quantity)
    ? value.quantity
    : theme.quantity[1] || theme.quantity[0];
  return out;
}
