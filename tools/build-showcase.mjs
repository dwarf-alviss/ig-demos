import { writeFile } from "node:fs/promises";
const projects = {
  cakes: {
    brand: "Мельница",
    category: "Кондитерская мастерская",
    intro: "Вкус, который<br>остаётся в памяти.",
    description:
      "Большой праздник или вечер для двоих. Начните с любимой начинки — и придумайте торт, который будет только вашим.",
    hero: "assets/img/berry.jpg",
    second: "assets/img/about.jpg",
    cta: "Придумать свой торт",
    step: [
      "Выберите рецепт",
      "Добавьте свой характер",
      "Рассмотрите со всех сторон",
    ],
    products: [
      ["bento.jpg", "Маленький повод", "Бенто и небольшие торты"],
      ["wedding.jpg", "Большой день", "Ярусные композиции"],
      ["chocolate.jpg", "Шоколадный акцент", "Насыщенные вкусы"],
    ],
    variants: [
      [
        "a",
        "Сливочное ателье",
        "Тёплая редакционная подача, крупная типографика, сливочный фон и ягодный акцент. Конструктор — персональная мастерская.",
      ],
      [
        "b",
        "Праздник в цвете",
        "Энергичные блоки, графичная сетка и яркая клубничная палитра. Выбор по поводам и быстрый переход к сборке.",
      ],
      [
        "c",
        "Dessert gallery",
        "Тёмная камерная галерея, крупные фотографии и сдержанные подписи. Торт как центральный экспонат.",
      ],
    ],
  },
  flowers: {
    brand: "Пион",
    category: "Ботаническая мастерская",
    intro: "Чувства.<br>В живой форме.",
    description:
      "Садовая роза, сезонные тюльпаны или свободный полевой букет. Соберите свою историю из цветов, оттенков и деталей.",
    hero: "assets/img/hero.jpg",
    second: "assets/img/studio.jpg",
    cta: "Собрать свой букет",
    step: [
      "Найдите любимые цветы",
      "Выберите форму и упаковку",
      "Посмотрите на букет в объёме",
    ],
    products: [
      ["mono.jpg", "Один любимый цветок", "Монобукеты"],
      ["mix.jpg", "Свободный сад", "Смешанные композиции"],
      ["wedding.jpg", "Ваш особенный день", "Свадебные букеты"],
    ],
    variants: [
      [
        "a",
        "Ботанический журнал",
        "Молочный фон, лесная зелень, асимметричные фотографии и спокойный ритм. Акцент на сезонности и характере цветов.",
      ],
      [
        "b",
        "Цветочный рынок",
        "Лиловый и лаймовый, выразительная типографика, открытая модульная сетка. Быстрый выбор настроения и состава.",
      ],
      [
        "c",
        "Тихий сад",
        "Глубокий зелёный, воздушные отступы и фотографии в крупном масштабе. Камерная флористическая студия.",
      ],
    ],
  },
  jewelry: {
    brand: "Латунь",
    category: "Ателье личных украшений",
    intro: "Ваша история.<br>Её точная форма.",
    description:
      "Силуэт, металл, свет. Создайте украшение, в котором каждая грань и каждый оттенок камня выбраны вами.",
    hero: "assets/img/ring.jpg",
    second: "assets/img/workshop.jpg",
    cta: "Создать украшение",
    step: [
      "Выберите силуэт",
      "Найдите свой металл и камень",
      "Рассмотрите каждую грань",
    ],
    products: [
      ["ring.jpg", "Личный акцент", "Кольца"],
      ["pendant.jpg", "Ближе к сердцу", "Подвески"],
      ["earrings.jpg", "Ритм и свет", "Серьги"],
    ],
    variants: [
      [
        "a",
        "Минеральная галерея",
        "Чёрный графит, мягкое золото и крупная предметная фотография. Конструктор как исследование металла и света.",
      ],
      [
        "b",
        "Предметное бюро",
        "Светлый камень, технические подписи и строгая сетка. Последовательный выбор формы, материала и закрепки.",
      ],
      [
        "c",
        "Личная драгоценность",
        "Винный фон, нежный персиковый и выразительная антиква. Эмоциональная история персонального украшения.",
      ],
    ],
  },
  fashion: {
    brand: "ЛИНИЯ",
    category: "Гардероб без лишнего",
    intro: "Меньше вещей.<br>Больше вас.",
    description:
      "Силуэты, которые работают вместе. Соберите капсулу под свой ритм, найдите нужный размер и сохраните комплект.",
    hero: "assets/img/hero.jpg",
    second: "assets/img/atelier.jpg",
    cta: "Собрать капсулу",
    step: [
      "Выберите основу",
      "Сочетайте цвета и силуэты",
      "Проверьте размеры и состав",
    ],
    products: [
      ["shirt.jpg", "Чёткая основа", "Рубашки"],
      ["knit.jpg", "Мягкий слой", "Трикотаж"],
      ["denim.jpg", "Свобода движения", "Деним"],
    ],
    variants: [
      [
        "a",
        "Городской редактор",
        "Контрастная чёрно-белая сетка, крупный гротеск и полноразмерные фотографии. Капсула — центральный сценарий.",
      ],
      [
        "b",
        "Тактильный гардероб",
        "Песочный, терракота и мягкие формы. Акцент на фактуре и сочетаниях, спокойный подбор комплектов.",
      ],
      [
        "c",
        "Новый ритм",
        "Кобальт, сигнальный лайм и динамичная графика. Коллекция как визуальный манифест, капсула как инструмент.",
      ],
    ],
  },
};
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
for (const [kind, p] of Object.entries(projects))
  for (const [v, name, detail] of p.variants) {
    const active = p.variants
      .map(
        ([id, n]) =>
          `<a ${id === v ? 'aria-current="page"' : ""} href="${id === "a" ? "index.html" : `concept-${id}.html`}">${id.toUpperCase()} · ${n}</a>`,
      )
      .join("");
    const products = p.products
      .map(
        ([img, title, sub], i) =>
          `<a class="piece" href="catalog.html"><figure><img src="assets/img/${img}" alt="${title}" loading="lazy"><span>0${i + 1}</span></figure><div><h3>${title}</h3><p>${sub}</p><span aria-hidden="true">↗</span></div></a>`,
      )
      .join("");
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(p.description)}"><meta name="theme-color" content="${kind === "jewelry" ? "#1b1c1d" : "#f6f2e9"}"><title>${p.brand} — ${name}</title><link rel="stylesheet" href="assets/fonts.css"><link rel="stylesheet" href="../shared/showcase.css"><script src="../shared/showcase.js" defer></script></head><body data-brand="${kind}" data-concept="${v}"><a class="skip" href="#main">Перейти к содержимому</a><aside class="concept-bar" aria-label="Варианты дизайна"><a href="../directions.html">Все 12 направлений ↗</a><div>${active}</div></aside><header class="site-header"><a class="wordmark" href="index.html">${p.brand}<small>${p.category}</small></a><nav aria-label="Главная навигация"><a href="#collection">Коллекция</a><a href="#create">${kind === "fashion" ? "Моя капсула" : "Мастерская"}</a><a href="cart.html">Корзина ↗</a></nav></header><main id="main"><section class="opening"><div class="opening-copy"><span class="eyebrow">${p.category} / Минск</span><h1>${p.intro}</h1><p>${p.description}</p><div class="hero-actions"><a class="primary" href="#create">${p.cta}<span>↗</span></a><a class="text-link" href="catalog.html">Смотреть коллекцию →</a></div><div class="edition"><span>Индивидуальность в деталях</span><span>Коллекция / 01</span></div></div><figure class="opening-image"><img src="${p.hero}" alt="${p.brand}: ${p.products[0][2]}" fetchpriority="high"><figcaption><span>${p.brand} / личный выбор</span><span>01—04</span></figcaption></figure><span class="hero-index" aria-hidden="true">${kind === "fashion" ? "01" : "✳"}</span></section><div class="brand-strip"><span>${kind === "cakes" ? "От рецепта до последней ягоды" : kind === "flowers" ? "Каждый цветок — со своим характером" : kind === "jewelry" ? "Свет меняет форму. Вы меняете детали." : "Одна капсула. Ваши сочетания."}</span><a href="#create">Начать с себя ↗</a></div><section id="collection" class="collection-section"><div class="section-title"><div><span class="eyebrow">Выбор мастерской / 01</span><h2>${kind === "fashion" ? "Работают вместе." : "Найдите своё."}</h2></div><a class="text-link" href="catalog.html">Вся коллекция ↗</a></div><div class="piece-grid">${products}</div></section><section class="story"><figure><img src="${p.second}" alt="${p.category}: материалы и мастерская" loading="lazy"></figure><div><span class="eyebrow">Внимание к деталям / 02</span><h2>${kind === "cakes" ? "Важен вкус.<br>И всё вокруг него." : kind === "flowers" ? "Не просто состав.<br>Живой характер." : kind === "jewelry" ? "От замысла<br>до личной вещи." : "Хороший гардероб<br>начинается с вас."}</h2><p>${kind === "fashion" ? "Начните с вещей, к которым хочется возвращаться. Сравнивайте цвета, собирайте комплект и выбирайте доступные размеры в конструкторе капсулы." : "Выбирайте готовую композицию или начните с чистого листа. В мастерской можно менять детали, сравнивать варианты и сохранять свой замысел."}</p><a class="text-link" href="#create">Войти в мастерскую →</a></div></section><section id="create" class="create-section"><div class="section-title"><div><span class="eyebrow">Ваша личная мастерская / 03</span><h2>${p.cta}.</h2></div><p>${kind === "fashion" ? "Соберите комплект из каталога." : "Меняйте детали и вращайте композицию в 3D."}<br>Сохраняйте вариант и возвращайтесь к нему.</p></div><ol class="steps">${p.step.map((s, i) => `<li><span>0${i + 1}</span>${s}</li>`).join("")}</ol><div class="studio-mount"><div class="studio-placeholder"><span class="eyebrow">${kind === "fashion" ? "Личный гардероб" : "Интерактивная студия"}</span><h3>Теперь — ваша очередь.</h3><p>Конструктор откроется прямо здесь.<br>Ваши сохранённые варианты останутся доступны.</p><button class="primary" data-load-studio>Открыть конструктор <span>↗</span></button><a class="text-link" href="studio.html">Открыть на весь экран →</a></div><iframe title="${p.cta}: интерактивный конструктор" data-src="studio.html" hidden></iframe></div><div class="studio-bottom"><span>${kind === "fashion" ? "Размеры · цвет · состав капсулы" : "Ракурсы · сохранение · экспорт композиции"}</span><a href="studio.html">Полноэкранная мастерская ↗</a></div></section><section class="closing"><span class="eyebrow">Начните с того, что нравится</span><h2>${kind === "cakes" ? "Повод найдётся." : kind === "flowers" ? "Скажите цветами." : kind === "jewelry" ? "Оставьте себе." : "Найдите свой ритм."}</h2><a class="primary" href="catalog.html">Посмотреть коллекцию <span>↗</span></a></section></main><footer><a class="wordmark" href="index.html">${p.brand}</a><div><a href="catalog.html">Каталог</a><a href="studio.html">Конструктор</a><a href="cart.html">Корзина</a></div><p>Портфолио · демонстрационный магазин<br>Оформление реального заказа недоступно</p></footer></body></html>`;
    await writeFile(
      `${kind}/${v === "a" ? "index" : `concept-${v}`}.html`,
      html + "\n",
    );
  }
const cards = Object.entries(projects)
  .map(
    ([kind, p]) =>
      `<section><header><span>${p.category}</span><h2>${p.brand}</h2></header><div class="direction-grid">${p.variants.map(([v, n, d]) => `<a class="direction" href="${kind}/${v === "a" ? "index.html" : `concept-${v}.html`}"><img src="shared/design-previews/${kind}-${v}.jpg" alt="${p.brand}" loading="lazy"><div><span>Вариант ${v.toUpperCase()}${v === "a" ? " · рекомендую" : ""}</span><h3>${n}</h3><p>${d}</p><strong>Открыть живой вариант ↗</strong></div></a>`).join("")}</div></section>`,
  )
  .join("");
await writeFile(
  "directions.html",
  `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Четыре бренда · 12 направлений</title><link rel="stylesheet" href="flowers/assets/fonts.css"><link rel="stylesheet" href="shared/showcase.css"></head><body class="directions"><header class="site-header"><a href="index.html">Digital craft ↗</a><span>Четыре бренда / двенадцать направлений</span></header><main><span class="eyebrow">Дизайн, который можно попробовать</span><h1>Четыре истории.<br>Двенадцать характеров.</h1><p class="direction-intro">У каждого сайта три самостоятельных направления: разные палитры, композиция первого экрана и визуальный ритм. В каждом варианте работают каталог, корзина и встроенный конструктор. Вариант A — моя рекомендация; все направления доступны для сравнения.</p>${cards}</main><footer><span>Портфолио · выбор направления</span><a href="index.html">К проектам →</a></footer></body></html>\n`,
);
console.log("Built 4 storefronts, 8 alternate directions and design gallery");
