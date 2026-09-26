/* data.js — кондитерская «Мельница»: настройки, ассортимент, начинки, декор.
   Данные лежат в JS-константах, а не в JSON: сайт открывается по file:// без сервера
   и без fetch(). Всё, что меняется для реального клиента, — здесь. */

const SHOP = {
  name: 'Мельница',
  tagline: 'домашняя кондитерская',
  city: 'Минск',
  phone: '+375 (29) 123-45-67',
  phoneHref: 'tel:+375291234567',
  mail: 'zakaz@example.by',
  instagram: '@melnitsa.cake',
  address: 'Минск, ул. Кальварийская, 17 — самовывоз со двора',
  hours: 'Пн–Сб 9:00–20:00, Вс 10:00–18:00',
  deliveryFee: 15,        // доставка по Минску, BYN
  freeFrom: 200,          // бесплатная доставка от суммы, BYN
  leadTime: 'от 2 дней',  // базовый срок
  since: 2016
};

/* ---------- ассортимент ---------- */
const PRODUCTS = [
  {
    id: 'bento-vanilla',
    name: 'Бенто «Ваниль и малина»',
    format: '12 см · 0,9 кг · 2–4 порции',
    weight: '0,9 кг',
    price: 78,
    img: 'assets/img/bento.jpg',
    alt: 'Бенто-торт 12 см с кремом и надписью «Happy Birthday»',
    tags: ['bento', 'birthday'],
    features: ['custom', 'glutenfree', 'fast'],
    prep: 2,
    popular: 1,
    badge: 'Хит',
    desc: 'Влажный ванильный бисквит, малиновое конфи и крем-чиз. Свечи и топпер — в подарок.'
  },
  {
    id: 'berry-cream',
    name: 'Торт «Клубника и сливки»',
    format: '1,6 кг · 6–8 порций',
    weight: '1,6 кг',
    price: 132,
    img: 'assets/img/berry.jpg',
    alt: 'Слоёный торт с клубникой и кремом, вид сверху',
    tags: ['cake', 'birthday'],
    features: ['custom', 'glutenfree', 'fast'],
    prep: 2,
    popular: 2,
    badge: '',
    desc: 'Лёгкий крем-чиз, свежая клубника и бисквит на йогурте. Самый «летний» торт.'
  },
  {
    id: 'choco-nut',
    name: 'Торт «Шоколад с орехами»',
    format: '1,8 кг · 8–10 порций',
    weight: '1,8 кг',
    price: 148,
    img: 'assets/img/chocolate.jpg',
    alt: 'Шоколадный торт с кремом и ореховой обсыпкой',
    tags: ['cake', 'birthday', 'corporate'],
    features: ['custom', 'fast'],
    prep: 2,
    popular: 3,
    badge: '',
    desc: 'Шоколадный бисквит, ганаш на тёмном шоколаде, обжаренный фундук и соль.'
  },
  {
    id: 'kids-sun',
    name: 'Детский «Цыплёнок»',
    format: '1,8 кг · 8–10 порций',
    weight: '1,8 кг',
    price: 165,
    img: 'assets/img/kids.jpg',
    alt: 'Детский торт с фигурками цыплят и белыми цветами',
    tags: ['cake', 'kids', 'birthday'],
    features: ['custom', 'figures'],
    prep: 3,
    popular: 5,
    badge: '',
    desc: 'Съедобные фигурки, натуральные красители, начинка на выбор ребёнка.'
  },
  {
    id: 'wedding-creme',
    name: 'Свадебный «Крем-брюле»',
    format: '3 кг · 14–18 порций · 4 яруса',
    weight: '3 кг',
    price: 420,
    img: 'assets/img/wedding.jpg',
    alt: 'Четырёхъярусный белый свадебный торт с цветами',
    tags: ['wedding', 'cake'],
    features: ['custom', 'tiered', 'figures'],
    prep: 5,
    popular: 4,
    badge: 'Под заказ',
    desc: 'Четыре яруса, крем-брюле с солёной карамелью, живые цветы и дегустация до заказа.'
  },
  {
    id: 'cupcakes-12',
    name: 'Капкейки «Праздник», 12 шт.',
    format: '12 шт · 0,9 кг · топперы под повод',
    weight: '0,9 кг',
    price: 96,
    img: 'assets/img/cupcakes.jpg',
    alt: 'Коробка с двенадцатью шоколадными капкейками и топперами',
    tags: ['cupcakes', 'birthday', 'corporate'],
    features: ['custom', 'glutenfree', 'fast', 'figures'],
    prep: 2,
    popular: 6,
    badge: '',
    desc: 'Шоколад и ваниль пополам, крем-чиз, топперы с буквами или цифрами.'
  }
];

/* ---------- фильтры каталога ---------- */
const CATEGORIES = [
  { id: 'all', label: 'Всё' },
  { id: 'bento', label: 'Бенто' },
  { id: 'cake', label: 'Торты' },
  { id: 'kids', label: 'Детские' },
  { id: 'wedding', label: 'Свадебные' },
  { id: 'cupcakes', label: 'Капкейки' }
];

const PRICE_RANGES = [
  { id: 'any', label: 'Любая цена', min: 0, max: Infinity },
  { id: 'low', label: 'до 100 BYN', min: 0, max: 99.99 },
  { id: 'mid', label: '100–200 BYN', min: 100, max: 200 },
  { id: 'high', label: 'от 200 BYN', min: 200.01, max: Infinity }
];

const FEATURES = [
  { id: 'custom', label: 'Своя начинка' },
  { id: 'glutenfree', label: 'Можно без глютена' },
  { id: 'fast', label: 'Готов за 2 дня' },
  { id: 'tiered', label: 'Ярусами' },
  { id: 'figures', label: 'Фигурки и декор' }
];

const SORTS = [
  { id: 'popular', label: 'Сначала популярные' },
  { id: 'cheap', label: 'Сначала дешёвые' },
  { id: 'expensive', label: 'Сначала дорогие' }
];

/* ---------- калькулятор заказа ---------- */
const WEIGHTS = [
  { kg: 1, label: '1 кг', note: '4–6 порций' },
  { kg: 1.5, label: '1,5 кг', note: '6–8 порций' },
  { kg: 2, label: '2 кг', note: '8–10 порций' },
  { kg: 3, label: '3 кг', note: '14–18 порций' },
  { kg: 4, label: '4 кг', note: '20–24 порции' }
];

/* цена за килограмм падает с весом — как в настоящей кондитерской */
const PRICE_PER_KG = { 1: 96, 1.5: 89, 2: 84, 3: 78, 4: 74 };

const FLAVORS = [
  { id: 'vanilla', name: 'Ваниль и малина', note: 'ванильный бисквит, малиновое конфи', extra: 0 },
  { id: 'choco', name: 'Шоколад и вишня', note: 'шоколадный бисквит, вишнёвое конфи', extra: 0 },
  { id: 'straw', name: 'Клубника и сливки', note: 'бисквит на йогурте, свежая клубника', extra: 6 },
  { id: 'brulee', name: 'Крем-брюле', note: 'крем-брюле и солёная карамель', extra: 12 },
  { id: 'gf', name: 'Миндаль и груша', note: 'без глютена: миндальная мука, груша', extra: 18 }
];

const DECORS = [
  { id: 'minimal', name: 'Минимализм', note: 'ровный крем, надпись', extra: 0, prep: 0 },
  { id: 'roses', name: 'Кремовые розы', note: 'крупные розы из крема', extra: 25, prep: 0 },
  { id: 'berries', name: 'Ягоды и шоколад', note: 'сезонные ягоды, шоколадные фигуры', extra: 30, prep: 0 },
  { id: 'print', name: 'Съедобная печать', note: 'картинка или фото на сахарной бумаге', extra: 35, prep: 1 },
  { id: 'figures', name: 'Фигурки из мастики', note: 'мастичные фигурки по вашему сюжету', extra: 55, prep: 1 }
];

const STATUSES = [
  { id: 'new', label: 'новый' },
  { id: 'accepted', label: 'принят' },
  { id: 'done', label: 'выполнен' },
  { id: 'cancelled', label: 'отменён' }
];
