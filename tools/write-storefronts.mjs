import { readFile, writeFile } from "node:fs/promises";
const shops = {
  cakes: {
    brand: "Мельница",
    label: "Кондитерская мастерская · Минск",
    title: "Счастье<br>на десерт.",
    text: "Торты для больших событий и маленьких радостей. Свежие ягоды, нежный крем и детали, которые говорят о вас.",
    hero: "assets/img/berry.jpg",
    caption: "Клубника, сливки и повод собраться",
    collection: "Любимые поводы",
    edit: "Праздник начинается<br>с вашей идеи.",
    editText:
      "Выберите форму, составьте ягодный декор и добавьте финальный штрих. Вращайте торт и смотрите, как он получается.",
    cta: "Придумать свой торт",
    promise: [
      "От 2 дней на приготовление",
      "Самовывоз или доставка по Минску",
      "Ваш декор — ваша история",
    ],
  },
  flowers: {
    brand: "Пион",
    label: "Ботаническая мастерская · Минск",
    title: "Красота<br>живого.",
    text: "Цветы не требуют большого повода. Собираем букеты, которые передают нежность, благодарность и всё, для чего не хватает слов.",
    hero: "assets/img/hero.jpg",
    caption: "Сезонные цветы. Свободный характер.",
    collection: "Цветы для ваших чувств",
    edit: "Букет, который<br>говорит за вас.",
    editText:
      "Пионы или полевые цветы, зелень или лёгкий моно-букет. Найдите своё сочетание, упаковку и оттенок ленты.",
    cta: "Собрать свой букет",
    promise: [
      "Сезонные сочетания",
      "Упаковка на ваш выбор",
      "Доставка по Минску",
    ],
  },
  jewelry: {
    brand: "Латунь",
    label: "Маленькое ателье · Личные украшения",
    title: "Личная история.<br>Точная форма.",
    text: "Тихие акценты на каждый день. Силуэты, которые хочется рассматривать, и украшения, которые хочется оставить себе.",
    hero: "../shared/presets/jewelry-0.jpg",
    caption: "Солитер / исследование света и формы",
    collection: "Предметы привязанности",
    edit: "Найдите свой<br>оттенок света.",
    editText:
      "От классического солитера до подвески. Исследуйте огранки, оттенки камней и металл — и рассмотрите результат со всех сторон.",
    cta: "Создать украшение",
    promise: [
      "Ручная работа",
      "Латунь и серебро в каталоге",
      "Индивидуальная композиция",
    ],
  },
  fashion: {
    brand: "ЛИНИЯ",
    label: "Гардероб без лишнего · Минск",
    title: "ВАШ РИТМ.<br>ВАША<br>ЛИНИЯ.",
    text: "Вещи, которые работают вместе. Чёткие силуэты, приятные ткани и свобода быть собой каждый день.",
    hero: "assets/img/hero.jpg",
    caption: "Ежедневная форма / коллекция 01",
    collection: "ОСНОВА ВАШЕГО ДНЯ",
    edit: "МЕНЬШЕ ВЕЩЕЙ.<br>БОЛЬШЕ ОБРАЗОВ.",
    editText:
      "Соберите капсулу из настоящего каталога. Выберите размер, проверьте наличие и сохраните комплект для следующей примерки.",
    cta: "Собрать капсулу",
    promise: ["Размеры XS — XL", "Две точки в Минске", "Доставка с примеркой"],
  },
};
for (const [kind, s] of Object.entries(shops)) {
  const data = JSON.parse(await readFile(`reports/${kind}-data.json`, "utf8"));
  const products = data.products.slice(0, 4);
  const preview =
    kind === "fashion"
      ? "assets/img/atelier.jpg"
      : `../shared/presets/${kind}-${kind === "flowers" ? 2 : 1}.jpg`;
  await writeFile(
    `${kind}/index.html`,
    `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${s.brand} — ${s.label}</title><meta name="description" content="${s.text}"><link rel="stylesheet" href="assets/fonts.css"><link rel="stylesheet" href="../shared/storefront.css"></head><body data-shop="${kind}"><a class="skip" href="#main">Перейти к содержимому</a><header class="shop-header"><a class="brand" href="index.html">${s.brand}</a><nav aria-label="Основная навигация"><a href="catalog.html">Коллекция</a><a class="edit" href="studio.html">${kind === "fashion" ? "Моя капсула" : "Своя композиция"} ↗</a><a href="cart.html">Корзина</a></nav></header><main id="main"><section class="hero"><div class="hero-copy"><p class="overline">${s.label}</p><h1>${s.title}</h1><p>${s.text}</p><div class="actions"><a class="button" href="catalog.html">${kind === "fashion" ? "Смотреть коллекцию" : "Выбрать в каталоге"} <span>↗</span></a><a href="studio.html">${s.cta} →</a></div><p class="hero-note">${kind === "jewelry" ? "Форма. Материал. Свет." : kind === "flowers" ? "Для близких. Для себя. Просто так." : kind === "cakes" ? "Сделано руками. Придумано с любовью." : "13 моделей. Бесконечно ваш гардероб."}</p></div><figure class="hero-visual"><img src="${s.hero}" alt="${s.caption}" fetchpriority="high"><figcaption><span>${s.caption}</span><span>01 / ${s.brand}</span></figcaption></figure></section><div class="promise">${s.promise.map((t) => `<span>${t}</span>`).join("")}</div><section class="collection"><div class="section-head"><div><p class="overline">Выбор мастерской / 01—04</p><h2>${s.collection}</h2><p>Начните с любимого — и найдите что-то своё.</p></div><a href="catalog.html">Вся коллекция ↗</a></div><div class="products">${products.map((p, i) => `<a class="product" href="catalog.html"><div class="photo"><img src="${kind === "fashion" ? "assets/img/looks/" + p.id + ".svg" : p.img}" alt="${kind === "fashion" ? "Эскиз силуэта: " + p.name : p.alt}" loading="lazy"><span class="number">0${i + 1}</span></div><h3>${p.name || p.title}</h3><div class="row"><p>${p.format || p.size || p.sizes?.join(" / ") || p.cat}</p><strong>${p.price || p.materials[0].price} BYN</strong></div></a>`).join("")}</div></section><section class="edit-section"><img src="${preview}" alt="Пример ${kind === "fashion" ? "гардероба" : "собранной композиции"}" loading="lazy"><div class="edit-copy"><p class="overline">${kind === "fashion" ? "Персональная редакция" : "Ваша мастерская"}</p><h2>${s.edit}</h2><p>${s.editText}</p><div class="steps"><span><b>01</b>Форма</span><span><b>02</b>Сочетание</span><span><b>03</b>Ваш выбор</span></div><a class="button" href="studio.html">${s.cta} <span>↗</span></a></div></section></main><footer class="shop-footer"><div><a class="brand" href="index.html">${s.brand}</a><span>${s.label}</span></div><div><a href="catalog.html">Каталог</a><a href="studio.html">${s.cta}</a><a href="cart.html">Корзина и заказ</a></div><div class="legal">Демонстрационный проект портфолио. Заказы сохраняются в браузере.<br><a href="../">Все проекты ↗</a></div></footer></body></html>`,
  );
}
