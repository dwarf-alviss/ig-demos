import { selectedConcepts, conceptPath } from "./selected-concepts.mjs";
import { writeFile } from "node:fs/promises";
import { projects } from "./showcase-data.mjs";
const img = (src, alt, cls = "") =>
  `<img class="${cls}" src="${src}" alt="${alt}" loading="lazy">`;
const photo = (file, alt, cls = "") => img(`assets/img/${file}`, alt, cls);
const render = (kind, pattern, alt, cls = "") =>
  img(`../shared/domain-thumbnails/${kind}-${pattern}.jpg`, alt, cls);
const eyebrow = (t) => `<span class="eyebrow">${t}</span>`;
const cta = (t, href = "#create") =>
  `<a class="primary" href="${href}">${t} <span>↗</span></a>`;
const card = (src, title, caption) =>
  `<a class="object-card" href="catalog.html">${img(src, title)}<h3>${title}</h3><p>${caption}</p></a>`;
const choice = (title, pattern, src, desc = "", extra = "") =>
  `<button class="choice" data-choice data-pattern="${pattern}" data-preview="${src}" data-title="${title}" data-description="${desc}" ${extra}><span>${title}</span><small>${desc}</small><b>↗</b></button>`;
const studio = (kind, title, pattern) =>
  `<section id="create" class="studio-section" data-initial-pattern="${pattern}"><div class="studio-heading">${eyebrow(kind === "fashion" ? "Капсула / рабочий инструмент" : "Мастерская / рабочий инструмент")}<h2>${title}</h2><a href="studio.html">Открыть отдельно ↗</a></div><div class="studio-mount"><div class="studio-placeholder"><p>${kind === "fashion" ? "Сочетайте реальные позиции каталога, выбирайте размер и сохраняйте комплект." : "Выбранная композиция откроется в 3D. Меняйте детали, вращайте модель и сохраняйте вариант."}</p><button class="primary" data-load-studio>Войти в конструктор <span>↗</span></button></div><iframe title="${title}" data-src="studio.html" hidden></iframe></div></section>`;
const names = {
  cakes: [
    [
      "Мастерская праздника",
      "Сценарий начинается с события. Выбор повода меняет стартовый рецепт; торт и короткий маршрут сборки стоят на первом экране.",
    ],
    [
      "Дегустационное меню",
      "Сайт как меню кондитерского ресторана: рецепты, слои, вкусовые заметки и интерактивная дегустация.",
    ],
    [
      "Праздничный плакат",
      "Графичный постер и планировщик события: дата, повод и список пожеланий. Подача через праздник, а не витрину.",
    ],
  ],
  flowers: [
    [
      "Цветочный бар",
      "Сайт как стол флориста: выбор сезонного направления, ботанические карточки и рабочая композиция.",
    ],
    [
      "Письмо с цветами",
      "Подарочный сценарий: сначала чувство и текст открытки, затем букет. Живая открытка — центр интерфейса.",
    ],
    [
      "Цветы в вашем ритме",
      "Редакция о цветах дома: календарь смены букетов и выбор ритма. Сценарий регулярного обновления интерьера.",
    ],
  ],
  jewelry: [
    [
      "Галерея одного предмета",
      "Музейный просмотр: один предмет занимает экран, смена экспоната и описание формы предшествуют каталогу.",
    ],
    [
      "Ювелирное бюро",
      "Сайт как проектный стол: силуэт, камень, закрепка, карточка спецификации и переход к сборке.",
    ],
    [
      "Архив личных историй",
      "Украшение как памятная вещь: личная запись, выбор символа и архив заметок. Объект возникает из истории.",
    ],
  ],
  fashion: [
    [
      "Журнал городской формы",
      "Редакционный журнал с крупными номерами выпусков, разворотами и подборками образов.",
    ],
    [
      "Планировщик гардероба",
      "Рабочая доска из трёх слоёв: выбор контекста меняет комплект. Пользователь собирает гардероб, а не листает рекламу.",
    ],
    [
      "Функциональный магазин",
      "Каталог на первом экране: поиск, категории, сортировка и реальные позиции. Капсула — отдельный инструмент выбора.",
    ],
  ],
};
const pages = {};
pages["cakes-a"] =
  `${eyebrow("Мельница / мастерская праздника")}<section class="cake-occasion"><div class="occasion-copy"><h1>Какой у вас<br><em>повод?</em></h1><p>Начнём с события. А вкус, форму и последнюю ягоду вы выберете сами.</p><div class="occasion-choices">${choice("День рождения", "vanilla-celebration", "../shared/domain-thumbnails/cakes-vanilla-celebration.jpg", "Ванильный торт для общего стола")}${choice("Вечер для двоих", "chocolate-strawberry-heart", "../shared/domain-thumbnails/cakes-chocolate-strawberry-heart.jpg", "Шоколад, клубника и небольшая форма")}${choice("Просто хочется", "fraisier", "../shared/domain-thumbnails/cakes-fraisier.jpg", "Клубника и нежный крем")}</div></div><div class="cake-stage"><span class="stamp">ВЫ ПРИДУМАЛИ<br>МЫ СОБРАЛИ</span>${render("cakes", "vanilla-celebration", "Ванильный торт", "selection-image")}<div class="selection-caption"><h3 data-selection-title>День рождения</h3><p data-selection-description>Ванильный торт для общего стола</p></div></div></section><section class="numbered-path"><h2>Три шага<br>до вашего торта.</h2><ol><li><b>01</b><h3>Вкус</h3><p>Выберите рецепт, который хочется попробовать.</p></li><li><b>02</b><h3>Характер</h3><p>Добавьте ярусы и совместимые украшения.</p></li><li><b>03</b><h3>Последняя деталь</h3><p>Рассмотрите композицию и сохраните вариант.</p></li></ol></section>${studio("cakes", "Теперь сделайте его своим.", "vanilla-celebration")}`;
pages["cakes-b"] =
  `<section class="tasting-heading">${eyebrow("Мельница / дегустационная комната")}<h1>Сначала —<br>вкус.</h1><p>Три рецепта. Три разных характера.<br>Найдите свой, прежде чем выбирать декор.</p><span class="menu-number">MENU<br>01</span></section><section class="tasting-menu"><div class="menu-list">${choice("01 / Опера", "opera", "assets/img/chocolate.jpg", "Жоконд · кофе · ганаш")}${choice("02 / Фрезье", "fraisier", "assets/img/berry.jpg", "Клубника · муслин · бисквит")}${choice("03 / Лимонное облако", "lemon-cloud", "../shared/domain-thumbnails/cakes-lemon-cloud.jpg", "Цитрус · крем · воздушная текстура")}<p class="fine">Выбор рецепта станет отправной точкой в конструкторе.</p></div><figure class="tasting-dish">${photo("chocolate.jpg", "Шоколадный десерт", "selection-image")}<figcaption><h2 data-selection-title>01 / Опера</h2><p data-selection-description>Жоконд · кофе · ганаш</p></figcaption></figure></section><section class="flavour-notes"><span>КОФЕ</span><span>ТЕКСТУРА</span><span>ПОСЛЕВКУСИЕ</span><p>У каждого рецепта своя структура слоёв. В 3D-мастерской можно увидеть начинку на отдельном кусочке.</p></section>${studio("cakes", "Подайте вкус по-своему.", "opera")}`;
pages["cakes-c"] =
  `<section class="party-poster"><div class="poster-text"><span>МЕЛЬНИЦА / СОБИРАЕМ ПОВОДЫ</span><h1>ДАВАЙТЕ<br>ПРАЗДНОВАТЬ<span>!</span></h1><a href="#plan">Сначала план. Потом торт. ↓</a></div>${photo("bento.jpg", "Небольшой праздничный торт", "poster-cake")}<span class="poster-label">СВОЙ ТОРТ.<br>СВОИ ПРАВИЛА.</span></section><section id="plan" class="party-planner"><div><h2>Что отмечаем?</h2><p>Сохраните идею события вместе с пожеланиями к торту. Это ваша заметка, без бронирования даты.</p></div><form class="draft-form" data-draft="party"><label>Повод<input name="occasion" placeholder="Например, 30 лет и всё впереди" maxlength="80"></label><label>Дата<input type="date" name="date"></label><label>Пожелания<textarea name="note" placeholder="Любимые вкусы, цвета, детали" maxlength="500"></textarea></label><button class="primary" type="submit">Сохранить план ↗</button><output aria-live="polite"></output></form></section><section class="party-picks"><h2>Не все праздники<br>должны быть большими.</h2><div>${card("assets/img/bento.jpg", "Маленькая радость", "Бенто")}${card("assets/img/cupcakes.jpg", "Для всей компании", "Капкейки")}${card("assets/img/wedding.jpg", "Большой день", "Ярусный торт")}</div></section>${studio("cakes", "Придумайте главный акцент.", "vanilla-celebration")}`;
pages["flowers-a"] =
  `<section class="flower-bar"><aside><span class="vertical-label">ПИОН / СТОЛ ФЛОРИСТА</span><h1>Собираем<br>живое.</h1><p>Выберите направление — и посмотрите, с каких цветов начинается композиция.</p><div>${choice("Весенняя линия", "tulip-line", "assets/img/hero.jpg", "Тюльпан · выразительные стебли")}${choice("Сад без правил", "garden-pink", "assets/img/mix.jpg", "Розы · ранункулюсы · анемоны")}${choice("Только пионы", "peony-mono", "assets/img/mono.jpg", "Один цветок · большой характер")}</div></aside><figure>${photo("hero.jpg", "Сезонные цветы", "selection-image")}<figcaption><h2 data-selection-title>Весенняя линия</h2><p data-selection-description>Тюльпан · выразительные стебли</p></figcaption></figure></section><section class="botanical-specimens"><header><h2>У каждого —<br>свой характер.</h2><span>БОТАНИЧЕСКИЕ КАРТОЧКИ / 01—03</span></header><div>${card("assets/img/mono.jpg", "Пион", "Объём и мягкость")}${card("assets/img/hero.jpg", "Тюльпан", "Линия и движение")}${card("assets/img/mix.jpg", "Садовая роза", "Ритм и фактура")}</div></section>${studio("flowers", "Ваш стол флориста.", "tulip-line")}`;
pages["flowers-b"] =
  `<section class="letter-intro">${eyebrow("Пион / письмо без лишних слов")}<h1>Что вы хотите<br><em>сказать?</em></h1><p>Начните не с количества цветов. Начните с чувства.</p></section><section class="letter-workspace"><div class="letter-options">${choice("Спасибо, что ты рядом", "garden-pink", "assets/img/mix.jpg", "Свободный садовый букет")}${choice("Я думаю о тебе", "rose-mono", "assets/img/wedding.jpg", "Монобукет садовых роз")}${choice("Сегодня — твой день", "peony-mono", "assets/img/mono.jpg", "Объёмный монобукет пионов")}<label class="message-input">Ваши слова<textarea data-letter placeholder="Напишите короткое послание" maxlength="220"></textarea></label></div><figure class="gift-preview">${photo("mix.jpg", "Букет для близкого человека", "selection-image")}<div class="postcard"><span>ДЛЯ ТЕБЯ</span><p data-letter-preview>Спасибо, что ты рядом.</p><small>Пион / ваша открытка</small></div></figure></section><section class="gift-detail"><h2>Послание остаётся.<br>Букет говорит первым.</h2><p>Текст открытки сохраняется в этом браузере. Форму и состав букета можно подобрать в мастерской ниже.</p></section>${studio("flowers", "Букет к вашим словам.", "garden-pink")}`;
pages["flowers-c"] =
  `<section class="home-flowers"><div>${eyebrow("Пион / цветы как привычка")}<h1>Новая неделя.<br>Живой дом.</h1><p>Цветы для кухни, рабочего стола и спокойного воскресенья. Придумайте свой ритм смены композиций.</p>${cta("Выбрать ритм", "#rhythm")}</div>${photo("subscription.jpg", "Цветы в домашнем интерьере")}<span class="home-mark">ЖИТЬ<br>С ЦВЕТАМИ</span></section><section id="rhythm" class="rhythm-board"><header><h2>Ваш ритм.</h2><div class="rhythm-switch" role="group" aria-label="Ритм смены букета"><button data-rhythm="Каждую неделю" aria-pressed="true">Каждую неделю</button><button data-rhythm="Раз в две недели" aria-pressed="false">Раз в две недели</button></div></header><p data-rhythm-output>Каждую неделю — новая композиция для вашего пространства.</p><div class="week-grid"><article><span>01 / КУХНЯ</span>${photo("mono.jpg", "Монобукет для кухни")}<h3>Утренний акцент</h3><a href="#create" data-set-pattern="peony-mono">Подобрать пионы ↗</a></article><article><span>02 / РАБОЧИЙ СТОЛ</span>${photo("hero.jpg", "Тюльпаны для рабочего стола")}<h3>Линия и воздух</h3><a href="#create" data-set-pattern="tulip-line">Подобрать тюльпаны ↗</a></article><article><span>03 / ГОСТИНАЯ</span>${photo("mix.jpg", "Садовый букет для гостиной")}<h3>Небольшой сад</h3><a href="#create" data-set-pattern="garden-pink">Подобрать композицию ↗</a></article></div><p class="fine">Это планировщик идей. Регулярная доставка и оплата не подключены.</p></section>${studio("flowers", "Композиция для вашего дома.", "peony-mono")}`;
pages["jewelry-a"] =
  `<section class="museum-object"><div class="museum-title">${eyebrow("Латунь / галерея личных вещей")}<h1>Форма.<br>Материал.<br>Свет.</h1></div><figure>${render("jewelry", "solitaire", "Солитер с шестью крапанами", "selection-image")}<figcaption><span>ЭКСПОНАТ / 001</span><h2 data-selection-title>Солитер</h2><p data-selection-description>Кольцо · открытая закрепка · свет со всех сторон</p></figcaption></figure><aside><span>ВЫБЕРИТЕ ЭКСПОНАТ</span>${choice("Солитер", "solitaire", "../shared/domain-thumbnails/jewelry-solitaire.jpg", "Кольцо · открытая закрепка")}${choice("Подвеска", "bezel-pendant", "../shared/domain-thumbnails/jewelry-bezel-pendant.jpg", "Камень · цепь · спокойный контур")}${choice("Браслет", "bangle", "../shared/domain-thumbnails/jewelry-bangle.jpg", "Металл · объём · чистая линия")}${cta("Рассмотреть в 3D")}</aside></section><section class="museum-label"><span>ОБЪЕКТ, КОТОРЫЙ СТАНОВИТСЯ ЛИЧНЫМ</span><p>В галерее важен взгляд. В мастерской — ваш выбор. Измените металл, оттенок камня и детали изделия, сохранив его характер.</p></section>${studio("jewelry", "Перейдите от взгляда к выбору.", "solitaire")}`;
pages["jewelry-b"] =
  `<section class="design-desk"><header>${eyebrow("Латунь / проектное бюро")}<h1>Спроектируйте<br>личный акцент.</h1><span class="drawing-id">ПРОЕКТ № 001<br>ФОРМА / ЗАКРЕПКА / МЕТАЛЛ</span></header><div class="desk-grid"><aside><h2>01 / Силуэт</h2>${choice("Круглый солитер", "solitaire", "../shared/domain-thumbnails/jewelry-solitaire.jpg", "Шесть крапанов · круглый камень")}${choice("Овальный солитер", "oval-solitaire", "../shared/domain-thumbnails/jewelry-oval-solitaire.jpg", "Вытянутая форма · открытая закрепка")}${choice("Глухая закрепка", "bezel-ring", "../shared/domain-thumbnails/jewelry-bezel-ring.jpg", "Непрерывный металлический контур")}</aside><figure class="technical-preview"><span class="axis axis-x"></span><span class="axis axis-y"></span>${render("jewelry", "solitaire", "Проект кольца", "selection-image")}<span class="dimension">ФОРМА В МАСШТАБЕ ПРЕДПРОСМОТРА</span></figure><section class="specification"><h2>Карточка проекта</h2><dl><dt>Силуэт</dt><dd data-selection-title>Круглый солитер</dd><dt>Особенность</dt><dd data-selection-description>Шесть крапанов · круглый камень</dd><dt>Следующий шаг</dt><dd>Металл, камень и размер в 3D-студии</dd></dl>${cta("Настроить изделие")}<p class="fine">Визуальная сборка, не производственный CAD.</p></section></div></section><section class="bench-process"><article><span>02</span><h3>Металл</h3><p>Найдите свой оттенок и фактуру поверхности.</p></article><article><span>03</span><h3>Камень</h3><p>Совместимые формы и цвета, с посадкой под изделие.</p></article><article><span>04</span><h3>Детали</h3><p>Размер, ракурс, сохранение и сравнение.</p></article></section>${studio("jewelry", "Ваш проект в объёме.", "solitaire")}`;
pages["jewelry-c"] =
  `<section class="memory-opening"><div>${eyebrow("Латунь / архив личных историй")}<h1>Есть вещи,<br>которые хранят<br><em>больше.</em></h1><p>Не дату покупки. Момент, человека, обещание себе.</p><a href="#memory">Оставить свою историю ↓</a></div>${photo("pendant.jpg", "Личная подвеска")}<span class="archive-mark">ЛИЧНЫЙ<br>АРХИВ<br>001—∞</span></section><section id="memory" class="memory-desk"><div class="archive-paper"><span>ЗАПИСЬ В ЛИЧНОМ АРХИВЕ</span><h2 data-memory-title>Для себя.</h2><p data-memory-preview>Напишите, что хочется запомнить.</p><span class="paper-line"></span><small>Ваши слова сохраняются только в этом браузере.</small></div><form class="draft-form" data-draft="memory"><label>Кому посвящается<input name="occasion" data-memory-heading placeholder="Для себя. Для близкого человека." maxlength="70"></label><label>Что хочется сохранить<textarea name="note" data-memory-text placeholder="Один момент или несколько слов" maxlength="300"></textarea></label><button class="primary" type="submit">Сохранить запись ↗</button><output aria-live="polite"></output></form></section><section class="memory-symbols"><h2>Выберите символ.</h2><div>${choice("Тихий контур", "cabochon-pendant", "../shared/domain-thumbnails/jewelry-cabochon-pendant.jpg", "Подвеска с кабошоном")}${choice("Обещание себе", "wedding-band", "../shared/domain-thumbnails/jewelry-wedding-band.jpg", "Чистая форма кольца")}${choice("Личный свет", "pear-pendant", "../shared/domain-thumbnails/jewelry-pear-pendant.jpg", "Подвеска с грушевидным камнем")}</div></section>${studio("jewelry", "Придайте истории форму.", "cabochon-pendant")}`;
pages["fashion-a"] =
  `<section class="fashion-cover"><div class="issue-line"><span>ЛИНИЯ / ГОРОДСКОЙ ЖУРНАЛ</span><span>ВЫПУСК 01</span></div><h1>ФОРМА<br>ВАШЕГО<br>ДНЯ.</h1>${photo("rack.jpg", "Городской гардероб", "cover-photo")}<a class="cover-link" href="#issue">Открыть выпуск ↓</a><span class="issue-number">01</span></section><section id="issue" class="editorial-spread"><div>${eyebrow("01 / мягкая структура")}<h2>Не переодеваться.<br>Менять ритм.</h2><p>Одна рубашка, джинсы и жакет. От утреннего кофе до последней встречи — вещи, которые работают вместе.</p>${cta("Собрать свою редакцию")}</div>${photo("shirt.jpg", "Рубашка как основа образа")}${photo("denim.jpg", "Деним для ежедневного гардероба")}</section><section class="issue-index"><a href="catalog.html">01 / Чёткий силуэт <span>Рубашки ↗</span></a><a href="catalog.html">02 / Мягкий слой <span>Трикотаж ↗</span></a><a href="catalog.html">03 / Свобода движения <span>Деним ↗</span></a></section>${studio("fashion", "Ваша редакция гардероба.", "")}`;
const wardrobe = [
  ["assets/img/shirt.jpg", "Рубашка", "Чёткая основа"],
  ["assets/img/denim.jpg", "Джинсы", "Свобода движения"],
  ["assets/img/knit.jpg", "Трикотаж", "Мягкий слой"],
];
pages["fashion-b"] =
  `<section class="wardrobe-board"><header>${eyebrow("ЛИНИЯ / планировщик гардероба")}<h1>Один день.<br>Три слоя.</h1><p>Не начинайте с очередной покупки. Начните с сочетания.</p></header><div class="wardrobe-context" role="group" aria-label="Контекст гардероба"><button data-outfit="work" aria-pressed="true">Рабочий день</button><button data-outfit="weekend" aria-pressed="false">Свободный день</button><button data-outfit="travel" aria-pressed="false">В дорогу</button></div><div class="outfit-board">${wardrobe.map(([src, t, d], i) => `<article><span>СЛОЙ / 0${i + 1}</span>${img(src, t, `outfit-image-${i}`)}<h2 class="outfit-title-${i}">${t}</h2><p class="outfit-note-${i}">${d}</p></article>`).join("")}</div><div class="outfit-total"><p data-outfit-output>Чёткая основа для рабочего дня.</p>${cta("Подобрать вещи и размеры")}</div></section><section class="wardrobe-checklist"><h2>Вещь остаётся,<br>когда работает.</h2><ul><li>Сочетается с тем, что уже есть</li><li>Подходит вашему ритму</li><li>Нужный размер доступен в каталоге</li></ul></section>${studio("fashion", "Соберите настоящую капсулу.", "")}`;
pages["fashion-c"] =
  `<section class="utility-intro"><span>ЛИНИЯ / ФУНКЦИОНАЛЬНЫЙ ГАРДЕРОБ</span><h1>НАЙТИ.<br>СОЧЕТАТЬ.<br>НОСИТЬ.</h1><a href="#create">Есть идея комплекта? Соберите капсулу ↗</a></section><section class="live-catalog"><header><div><h2>Вещи без лишнего.</h2><p><span data-result-count></span> моделей из каталога</p></div><label>Поиск<input type="search" data-product-search placeholder="Рубашка, деним, трикотаж"></label><label>Порядок<select data-product-sort><option value="default">По коллекции</option><option value="price-up">Цена по возрастанию</option><option value="price-down">Цена по убыванию</option></select></label></header><div class="catalog-chips" role="group" aria-label="Категории"><button data-category="all" aria-pressed="true">Все</button><button data-category="shirt" aria-pressed="false">Рубашки</button><button data-category="knit" aria-pressed="false">Трикотаж</button><button data-category="jeans" aria-pressed="false">Джинсы</button><button data-category="jacket" aria-pressed="false">Жакеты</button></div><div data-live-products class="live-product-grid"></div><p class="catalog-empty" data-empty hidden>Ничего не найдено. Измените запрос или категорию.</p></section>${studio("fashion", "Отдельные вещи. Цельный комплект.", "")}`;
for (const [kind, p] of Object.entries(projects))
  for (let i = 0; i < 3; i++) {
    const v = ["a", "b", "c"][i],
      [name, description] = names[kind][i],
      id = `${kind}-${v}`;
    const links = names[kind]
      .map(
        ([n], j) =>
          `<a ${i === j ? 'aria-current="page"' : ""} href="${conceptPath(kind, ["a", "b", "c"][j])}">${["A", "B", "C"][j]} · ${n}</a>`,
      )
      .join("");
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${p.brand} — ${name}</title><meta name="description" content="${description}"><link rel="stylesheet" href="assets/fonts.css"><link rel="stylesheet" href="../shared/concepts.css">${kind === "fashion" ? '<script src="assets/data.js" defer></script>' : ""}<script src="../shared/concepts.js" defer></script></head><body data-brand="${kind}" data-concept="${v}" data-architecture="${id}"><a class="skip" href="#main">Перейти к содержимому</a><aside class="concept-bar"><a href="../directions.html">12 самостоятельных концепций ↗</a><div>${links}</div></aside><header class="site-header"><a class="wordmark" href="index.html">${p.brand}</a><nav aria-label="Основная навигация"><a href="catalog.html">Каталог</a><a href="#create">${kind === "fashion" ? "Капсула" : "Конструктор"}</a><a href="cart.html">Корзина ↗</a></nav></header><main id="main">${pages[id]}</main><footer><a class="wordmark" href="index.html">${p.brand}</a><a href="../directions.html">Сравнить концепции ↗</a><p>Демонстрационный магазин · реальное оформление заказа не подключено.</p></footer></body></html>`;
    await writeFile(`${kind}/${conceptPath(kind, v)}`, html + "\n");
    if (selectedConcepts[kind] === v)
      await writeFile(`${kind}/concept-${v}.html`, html + "\n");
  }
const cards = Object.entries(projects)
  .map(
    ([kind, p]) =>
      `<section><header><span>${p.category}</span><h2>${p.brand}</h2></header><div class="direction-grid">${names[
        kind
      ]
        .map(([name, desc], i) => {
          const v = ["a", "b", "c"][i];
          return `<a class="direction" href="${kind}/${conceptPath(kind, v)}"><img src="shared/design-previews/${kind}-${v}.jpg" alt="${name}" loading="lazy"><div><span>Концепция ${v.toUpperCase()}${selectedConcepts[kind] === v ? " · Выбрана" : ""}</span><h3>${name}</h3><p>${desc}</p><strong>Попробовать сценарий ↗</strong></div></a>`;
        })
        .join("")}</div></section>`,
  )
  .join("");
await writeFile(
  "directions.html",
  `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>12 самостоятельных концепций</title><link rel="stylesheet" href="flowers/assets/fonts.css"><link rel="stylesheet" href="shared/concepts.css"></head><body class="directions"><header class="site-header"><a href="index.html">Digital craft ↗</a><span>Четыре бренда / двенадцать разных сценариев</span></header><main><span class="eyebrow">Не палитры. Разные способы выбора.</span><h1>Как начинается<br>личная вещь?</h1><p class="direction-intro">С повода, чувства, формы или привычки. Здесь двенадцать разных структур страниц и сценариев взаимодействия. У всех работает конструктор; каждая концепция по-своему приводит к нему.</p>${cards}</main><footer><a href="index.html">Все проекты ↗</a></footer></body></html>\n`,
);
console.log("Built twelve distinct page architectures");
