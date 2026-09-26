/* ring.js — живой конструктор украшения для «Латуни».
   Изделие рисуется вектором прямо здесь: форма, металл, камень, гравировка и
   размер меняют и модельку, и цену. Ни одного внешнего запроса, ни одной
   картинки-заглушки: SVG получается из этого же кода.

   Цены не выдуманы. База — цена лота этой формы в выбранном металле из
   assets/data.js, гравировка — SHOP.engravingPrice (15 BYN, до 16 знаков).
   За размер и камень отдельной строки на сайте нет, поэтому и в конструкторе
   её нет: подгонка по мерке бесплатная, камень уже в цене лота. Складываем
   только то, что есть в прайсе.

   Публично: window.LATUN_RING = {
     W, H, FORMS, METALS, STONES, GRAVING, DEFAULT, FREE_FROM,
     find, plural, normalize, sizesOf, priceOf(state), lines(state), summary(state),
     markup(state), render(svgEl, state, opts), icon(id, size),
     svgString(state, size), dataUrl(state, size)
   }
   Состояние: { form, metal, stone, size, graving }

   Как устроена картинка: снизу свет витринной лампы и тень, выше — изделие
   в натуральную форму. Обод, каст и камень — отдельные группы: их появление
   анимируется по шагам (WAAPI), блик металла и искра камня живут в CSS. */
(function (root) {
  'use strict';

  var W = 600, H = 660;

  /* ---------- числа из data.js: ничего не выдумываем ---------- */
  var SHOPREF = (typeof SHOP !== 'undefined' && SHOP) ? SHOP : null;
  var PRODUCTSREF = (typeof PRODUCTS !== 'undefined' && PRODUCTS) ? PRODUCTS : null;
  var ENGRAVING = SHOPREF && SHOPREF.engravingPrice ? SHOPREF.engravingPrice : 15;
  var MAX = SHOPREF && SHOPREF.engravingMax ? SHOPREF.engravingMax : 16;
  var FREE_FROM = SHOPREF && SHOPREF.freeDeliveryFrom ? SHOPREF.freeDeliveryFrom : 150;

  /* Цена лота в металле: берём из витрины, если data.js подключён */
  function lotPrice(lotId, metalId, fallback) {
    if (!PRODUCTSREF) { return fallback; }
    for (var i = 0; i < PRODUCTSREF.length; i++) {
      var p = PRODUCTSREF[i];
      if (p.id !== lotId) { continue; }
      var list = p.materials || [];
      for (var j = 0; j < list.length; j++) { if (list[j].id === metalId) { return list[j].price; } }
    }
    return fallback;
  }

  /* ---------- изделия: форма, прообраз-лот, размеры ---------- */
  var FORMS = [
    {
      id: 'ring', title: 'Кольцо', lot: 'kolco-gran', lotTitle: 'Грань',
      hint: 'Обод с рантом и камнем, размеры 15–21',
      word: 'размер', def: '17',
      base: { brass: 62, silver: 165 },
      sizes: [
        { id: '15', title: '15' }, { id: '16', title: '16' }, { id: '17', title: '17' },
        { id: '18', title: '18' }, { id: '19', title: '19' }, { id: '20', title: '20' }, { id: '21', title: '21' }
      ]
    },
    {
      id: 'studs', title: 'Серьги-каффы', lot: 'sergi-kaplya', lotTitle: 'Капля',
      hint: 'Пара дуг с камнями, держатся без замка',
      word: 'высота', def: '35',
      base: { brass: 78, silver: 196 },
      sizes: [{ id: '25', title: '2,5 см' }, { id: '35', title: '3,5 см' }, { id: '45', title: '4,5 см' }]
    },
    {
      id: 'pendant', title: 'Подвеска', lot: 'podveska-biryza', lotTitle: 'Бирюза',
      hint: 'Диск на цепочке, камень в касте',
      word: 'цепочка', def: '45',
      base: { brass: 95, silver: 205 },
      sizes: [{ id: '40', title: '40 см' }, { id: '45', title: '45 см' }, { id: '50', title: '50 см' }, { id: '55', title: '55 см' }]
    },
    {
      id: 'bracelet', title: 'Браслет', lot: 'braslet-zhgut', lotTitle: 'Жгут',
      hint: 'Плетение из мелких колец, обхват 16–19 см',
      word: 'обхват', def: '17',
      base: { brass: 88, silver: 190 },
      sizes: [{ id: '16', title: '16 см' }, { id: '17', title: '17 см' }, { id: '18', title: '18 см' }, { id: '19', title: '19 см' }]
    }
  ];

  /* ---------- металл: палитра всего изделия ---------- */
  var METALS = [
    {
      id: 'brass', title: 'Латунь', prep: 'латуни', swatch: '#cfa96b', note: 'тёплый золотистый тон, лак держит цвет',
      light: '#f4dfae', main: '#d9b273', mid: '#b98f4a', dark: '#7c5c26', deep: '#553d16',
      line: 'rgba(20,17,15,.55)', rim: '#fdf3da', spec: '#fff8e6'
    },
    {
      id: 'silver', title: 'Серебро 925', prep: 'серебре 925', swatch: '#dedfe1', note: 'холодный белый блеск, проба 925',
      light: '#fbfbfa', main: '#dcdcda', mid: '#b4b4b2', dark: '#70706e', deep: '#4a4a49',
      line: 'rgba(16,16,18,.5)', rim: '#ffffff', spec: '#ffffff'
    }
  ];

  /* ---------- камень: у каждого своя фактура ---------- */
  var STONES = [
    {
      id: 'none', title: 'Без камня', kind: 'none', swatch: '#2b2521',
      note: 'гладкая полировка вместо камня',
      body: '#241f1a', light: '#3b332b', mid: '#2b2521', dark: '#1b1714',
      vein: '#1b1714', spark: '#ffffff', line: 'rgba(207,169,107,.45)'
    },
    {
      id: 'pearl', title: 'Речной жемчуг', kind: 'pearl', swatch: '#f0e4d2',
      note: 'кремовый, мягкий блеск, воду не любит',
      body: '#efe2cd', light: '#fffaf0', mid: '#dccbaa', dark: '#a89274',
      vein: '#c9b79c', spark: '#ffffff', line: 'rgba(92,74,52,.45)'
    },
    {
      id: 'turquoise', title: 'Бирюза', kind: 'cabochon', swatch: '#5fa9a1',
      note: 'матовый сине-зелёный, камень как есть',
      body: '#5fa9a1', light: '#8fc9c0', mid: '#4b8d86', dark: '#2c625c',
      vein: '#24443f', spark: '#eafaf7', line: 'rgba(18,42,40,.6)'
    },
    {
      id: 'garnet', title: 'Гранат', kind: 'facet', swatch: '#8e2b2f',
      note: 'тёмно-красный, огранка с искрой',
      body: '#8e2b2f', light: '#d2605a', mid: '#a63a38', dark: '#4e1418',
      vein: '#3d0f12', spark: '#ffe6d8', line: 'rgba(58,12,16,.6)'
    },
    {
      id: 'amethyst', title: 'Аметист', kind: 'facet', swatch: '#7a5aa8',
      note: 'сиреневый, грани держат свет',
      body: '#7a5aa8', light: '#b79cd8', mid: '#8f6cbb', dark: '#432c66',
      vein: '#33204f', spark: '#f0e6ff', line: 'rgba(40,24,64,.6)'
    }
  ];

  var GRAVING = { price: ENGRAVING, max: MAX, hint: 'до ' + MAX + ' знаков, +' + ENGRAVING + ' BYN' };
  var DEFAULT = { form: 'ring', metal: 'brass', stone: 'turquoise', size: '17', graving: '' };

  /* ============================ помощники ============================ */

  function round(n) { return Math.round(n * 10) / 10; }
  function clamp(n, a, b) { return n < a ? a : (n > b ? b : n); }

  function el(name, attrs) {
    var s = '<' + name;
    for (var k in attrs) {
      if (attrs[k] === null || attrs[k] === undefined || attrs[k] === '') { continue; }
      s += ' ' + k + '="' + attrs[k] + '"';
    }
    return s + '/>';
  }

  /* Текст гравировки попадает и в XML: амперсанд и кавычки экранируем */
  function xesc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function rng(seed) {
    var a = (seed || 1) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function find(list, id) {
    for (var i = 0; i < list.length; i++) { if (String(list[i].id) === String(id)) { return list[i]; } }
    return list[0];
  }
  function byId(list, id) {
    for (var i = 0; i < list.length; i++) { if (String(list[i].id) === String(id)) { return list[i]; } }
    return null;
  }
  function plural(n, forms) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) { return forms[0]; }
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) { return forms[1]; }
    return forms[2];
  }

  /* Правило гравировки то же, что в лоте: буквы, цифры, точка, запятая,
     дефис, амперсанд, апостроф, слэш и не больше 16 знаков. */
  function clean(s) {
    return String(s == null ? '' : s)
      .replace(/[^0-9A-Za-zА-Яа-яЁё .,\-&'\/]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX);
  }

  function sizesOf(formId) { return find(FORMS, formId).sizes; }

  function normalize(state) {
    state = state || {};
    var form = find(FORMS, state.form == null ? DEFAULT.form : state.form);
    var metal = find(METALS, state.metal == null ? DEFAULT.metal : state.metal);
    var stone = find(STONES, state.stone == null ? DEFAULT.stone : state.stone);
    var size = String(state.size == null ? form.def : state.size);
    var ok = false;
    for (var i = 0; i < form.sizes.length; i++) { if (form.sizes[i].id === size) { ok = true; } }
    if (!ok) { size = form.def; }
    return { form: form.id, metal: metal.id, stone: stone.id, size: size, graving: clean(state.graving) };
  }

  function sizeIndex(form, sizeId) {
    for (var i = 0; i < form.sizes.length; i++) { if (form.sizes[i].id === String(sizeId)) { return i; } }
    return 0;
  }

  function basePrice(form, metalId) { return lotPrice(form.lot, metalId, form.base[metalId]); }

  /* ============================ цена и слова ============================ */

  /* Цена конструктора: лот в металле + гравировка. Размер и камень отдельной
     строкой не считаются — подгонка по мерке бесплатная, камень в цене лота. */
  function priceOf(state) {
    var st = normalize(state);
    var form = find(FORMS, st.form);
    return basePrice(form, st.metal) + (st.graving ? ENGRAVING : 0);
  }

  function lines(state) {
    var st = normalize(state);
    var form = find(FORMS, st.form);
    var metal = find(METALS, st.metal);
    var stone = find(STONES, st.stone);
    var size = find(form.sizes, st.size);
    var out = [];
    out.push({
      label: form.title + ' в ' + (metal.prep || metal.title.toLowerCase()) + ' · лот «' + form.lotTitle + '»',
      value: basePrice(form, st.metal) + ' BYN'
    });
    out.push({
      label: st.graving ? 'Гравировка «' + st.graving + '»' : 'Без гравировки',
      value: st.graving ? '+' + ENGRAVING + ' BYN' : '0 BYN'
    });
    out.push({
      label: form.word.charAt(0).toUpperCase() + form.word.slice(1) + ' ' + size.title + ' — подгоняю по мерке',
      value: '0 BYN'
    });
    out.push({
      label: stone.id === 'none' ? 'Без камня — ничего не прибавляю' : stone.title + ' — камень уже в цене лота',
      value: '0 BYN'
    });
    out.push({ label: 'Итого', value: priceOf(st) + ' BYN', total: true });
    return out;
  }

  function summary(state) {
    var st = normalize(state);
    var form = find(FORMS, st.form);
    var metal = find(METALS, st.metal);
    var stone = find(STONES, st.stone);
    var size = find(form.sizes, st.size);
    return form.title + ' · ' + metal.title.toLowerCase() + ' · ' + stone.title.toLowerCase() +
      ' · ' + form.word + ' ' + size.title + (st.graving ? ' · гравировка «' + st.graving + '»' : '');
  }

  /* ============================ геометрия ============================ */

  function arcPath(cx, cy, r, a0, a1) {
    var x0 = round(cx + r * Math.cos(a0 * Math.PI / 180)), y0 = round(cy + r * Math.sin(a0 * Math.PI / 180));
    var x1 = round(cx + r * Math.cos(a1 * Math.PI / 180)), y1 = round(cy + r * Math.sin(a1 * Math.PI / 180));
    return 'M' + x0 + ' ' + y0 + 'A' + r + ' ' + r + ' 0 ' + ((a1 - a0) > 180 ? 1 : 0) + ' 1 ' + x1 + ' ' + y1;
  }

  function ellipseArc(cx, cy, rx, ry, a0, a1) {
    var x0 = round(cx + rx * Math.cos(a0 * Math.PI / 180)), y0 = round(cy + ry * Math.sin(a0 * Math.PI / 180));
    var x1 = round(cx + rx * Math.cos(a1 * Math.PI / 180)), y1 = round(cy + ry * Math.sin(a1 * Math.PI / 180));
    return 'M' + x0 + ' ' + y0 + 'A' + rx + ' ' + ry + ' 0 ' + ((a1 - a0) > 180 ? 1 : 0) + ' 1 ' + x1 + ' ' + y1;
  }

  /* Тень под изделием: без неё светлая латунь висит в воздухе */
  function groundMarkup(y, metal) {
    return '<ellipse cx="300" cy="' + y + '" rx="196" ry="46" fill="url(#rg-light)"/>' +
      '<ellipse cx="300" cy="' + (y - 6) + '" rx="146" ry="21" fill="url(#rg-shadow)" opacity=".75"/>' +
      '<ellipse cx="300" cy="' + (y - 10) + '" rx="96" ry="10" fill="#0b0908" opacity=".4"/>';
  }

  function defs(metal, stone) {
    var s = '<defs>' +
      '<linearGradient id="rg-metal" x1="0" y1="0" x2=".85" y2="1">' +
        '<stop offset="0" stop-color="' + metal.light + '"/>' +
        '<stop offset=".45" stop-color="' + metal.main + '"/>' +
        '<stop offset="1" stop-color="' + metal.dark + '"/>' +
      '</linearGradient>' +
      '<linearGradient id="rg-metal-2" x1="1" y1="0" x2=".15" y2="1">' +
        '<stop offset="0" stop-color="' + metal.mid + '"/>' +
        '<stop offset="1" stop-color="' + metal.deep + '"/>' +
      '</linearGradient>' +
      '<radialGradient id="rg-light" cx=".5" cy=".5" r=".5">' +
        '<stop offset="0" stop-color="' + metal.main + '" stop-opacity=".22"/>' +
        '<stop offset="1" stop-color="' + metal.main + '" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<radialGradient id="rg-shadow" cx=".5" cy=".5" r=".5">' +
        '<stop offset="0" stop-color="#000000" stop-opacity=".6"/>' +
        '<stop offset="1" stop-color="#000000" stop-opacity="0"/>' +
      '</radialGradient>';
    if (stone.kind === 'pearl') {
      s += '<radialGradient id="rg-stone" cx=".36" cy=".3" r=".78">' +
        '<stop offset="0" stop-color="' + stone.light + '"/><stop offset=".55" stop-color="' + stone.body + '"/>' +
        '<stop offset="1" stop-color="' + stone.dark + '"/></radialGradient>';
    } else if (stone.kind === 'cabochon') {
      s += '<radialGradient id="rg-stone" cx=".34" cy=".28" r=".92">' +
        '<stop offset="0" stop-color="' + stone.light + '" stop-opacity=".8"/>' +
        '<stop offset=".66" stop-color="' + stone.body + '" stop-opacity="0"/></radialGradient>' +
        '<clipPath id="rg-clip-stone"><circle r="40"/></clipPath>';
    } else {
      s += '<radialGradient id="rg-stone" cx=".38" cy=".32" r=".8">' +
        '<stop offset="0" stop-color="' + stone.light + '"/><stop offset=".6" stop-color="' + stone.body + '"/>' +
        '<stop offset="1" stop-color="' + stone.dark + '"/></radialGradient>';
    }
    return s + '</defs>';
  }

  /* ============================ камни ============================
     Каждый рисуется вокруг нуля: вызывающий ставит группу на место. */

  function sparkle(x, y, s, fill, op) {
    var k = s * .24;
    return '<path d="M ' + round(x) + ' ' + round(y - s) + ' L ' + round(x + k) + ' ' + round(y - k) +
      ' L ' + round(x + s) + ' ' + round(y) + ' L ' + round(x + k) + ' ' + round(y + k) +
      ' L ' + round(x) + ' ' + round(y + s) + ' L ' + round(x - k) + ' ' + round(y + k) +
      ' L ' + round(x - s) + ' ' + round(y) + ' L ' + round(x - k) + ' ' + round(y - k) +
      ' Z" fill="' + fill + '" opacity="' + op + '"/>';
  }

  function shadowUnder(r) {
    return '<ellipse cy="' + round(r * .88) + '" rx="' + round(r * .94) + '" ry="' + round(r * .3) + '" fill="url(#rg-shadow)"/>';
  }

  /* Без камня: полированная площадка того же металла */
  function polished(metal, r, opt) {
    return ((opt && opt.noShadow) ? '' : shadowUnder(r)) +
      '<circle r="' + round(r + 1.6) + '" fill="url(#rg-metal-2)" stroke="' + metal.line + '" stroke-width="1.6"/>' +
      '<circle r="' + round(r - 2.2) + '" fill="url(#rg-metal)" stroke="' + metal.dark + '" stroke-width="1.3" opacity=".75"/>' +
      '<path d="' + arcPath(0, 0, round(r * .74), 198, 302) + '" fill="none" stroke="' + metal.rim +
        '" stroke-width="' + round(r * .22) + '" stroke-linecap="round" opacity=".6"/>' +
      '<path d="' + arcPath(0, 0, round(r * .66), 22, 122) + '" fill="none" stroke="' + metal.deep +
        '" stroke-width="' + round(r * .16) + '" stroke-linecap="round" opacity=".35"/>' +
      '<circle cx="' + round(-r * .3) + '" cy="' + round(-r * .34) + '" r="' + round(r * .1) + '" fill="#ffffff" opacity=".5"/>';
  }

  /* Жемчуг: сфера с мягким бликом и своим светом по краю */
  function pearl(stone, r, opt) {
    return ((opt && opt.noShadow) ? '' : shadowUnder(r)) +
      '<circle r="' + r + '" fill="url(#rg-stone)" stroke="' + stone.line + '" stroke-width="1.3"/>' +
      '<circle r="' + round(r * .94) + '" fill="none" stroke="' + stone.dark + '" stroke-width="' + round(r * .14) + '" opacity=".32"/>' +
      '<path d="' + arcPath(0, 0, round(r * .78), 196, 286) + '" fill="none" stroke="' + stone.light +
        '" stroke-width="' + round(r * .2) + '" stroke-linecap="round" opacity=".7"/>' +
      el('ellipse', {
        cx: round(-r * .32), cy: round(-r * .36), rx: round(r * .22), ry: round(r * .15),
        fill: '#ffffff', opacity: .9, transform: 'rotate(-28 ' + round(-r * .32) + ' ' + round(-r * .36) + ')'
      }) +
      '<circle cx="' + round(r * .34) + '" cy="' + round(r * .42) + '" r="' + round(r * .1) + '" fill="#ffffff" opacity=".3"/>';
  }

  /* Бирюза: матовый кабошон в ранте, с тёмными прожилками */
  function cabochon(stone, metal, r, seed, opt) {
    var rnd = rng(seed || 5), s = '', i;
    if (!(opt && opt.noShadow)) { s += shadowUnder(r); }
    s += '<circle r="' + round(r + 4.4) + '" fill="url(#rg-metal-2)" stroke="' + metal.line + '" stroke-width="1.4"/>';
    s += '<circle r="' + round(r + 1.4) + '" fill="none" stroke="' + metal.rim + '" stroke-opacity=".22" stroke-width="1.2"/>';
    s += '<circle r="' + r + '" fill="' + stone.body + '" stroke="' + stone.line + '" stroke-width="1.4"/>';
    s += '<circle r="' + r + '" fill="url(#rg-stone)"/>';
    var veins = '';
    for (i = 0; i < 3; i++) {
      var a = rnd() * Math.PI * 2, d = r * (.3 + rnd() * .3);
      var x0 = round(Math.cos(a) * d), y0 = round(Math.sin(a) * d);
      var x1 = round(x0 + (rnd() * 1.6 - .8) * r * .5), y1 = round(y0 + (rnd() * 1.6 - .8) * r * .5);
      var x2 = round(x1 + (rnd() * 1.4 - .7) * r * .45), y2 = round(y1 + (rnd() * 1.4 - .7) * r * .45);
      veins += '<path d="M ' + x0 + ' ' + y0 + ' Q ' + x1 + ' ' + y1 + ' ' + x2 + ' ' + y2 +
        '" fill="none" stroke="' + stone.vein + '" stroke-width="' + round(Math.max(1, r * .09)) +
        '" stroke-linecap="round" opacity=".65"/>';
    }
    s += '<g clip-path="url(#rg-clip-stone)" transform="scale(' + round(r / 40) + ')">' + veins + '</g>';
    s += '<path d="' + arcPath(0, 0, round(r * .74), 200, 292) + '" fill="none" stroke="' + stone.light +
      '" stroke-width="' + round(r * .13) + '" stroke-linecap="round" opacity=".4"/>';
    return s;
  }

  /* Грань: огранка восьмиугольником, грани от площадки к кромке, искра */
  function facet(stone, r, seed, opt) {
    var rnd = rng(seed || 9), s = '', i;
    var pts = [], inner = [], off = { x: -r * .1, y: -r * .12 };
    for (i = 0; i < 8; i++) {
      var a = (Math.PI * 2 * i / 8) - Math.PI / 2 + 0.2;
      pts.push([round(Math.cos(a) * r), round(Math.sin(a) * r)]);
      inner.push([round(Math.cos(a) * r * .5 + off.x), round(Math.sin(a) * r * .5 + off.y)]);
    }
    function poly(p) {
      var out = [];
      for (var j = 0; j < p.length; j++) { out.push(p[j][0] + ',' + p[j][1]); }
      return out.join(' ');
    }
    if (!(opt && opt.noShadow)) { s += shadowUnder(r); }
    s += '<polygon points="' + poly(pts) + '" fill="url(#rg-stone)" stroke="' + stone.line + '" stroke-width="1.6"/>';
    for (i = 0; i < 8; i++) {
      s += '<line x1="' + inner[i][0] + '" y1="' + inner[i][1] + '" x2="' + pts[i][0] + '" y2="' + pts[i][1] +
        '" stroke="' + (i % 2 ? stone.light : stone.dark) + '" stroke-width="1" opacity=".5"/>';
    }
    s += '<polygon points="' + poly(inner) + '" fill="' + stone.light + '" opacity=".34" stroke="' + stone.light +
      '" stroke-width=".9" stroke-opacity=".55"/>';
    s += '<polygon points="' + [pts[2], pts[3], inner[3], inner[2]].map(function (q) { return q[0] + ',' + q[1]; }).join(' ') +
      '" fill="' + stone.dark + '" opacity=".4"/>';
    s += '<polygon points="' + [pts[4], pts[5], inner[5], inner[4]].map(function (q) { return q[0] + ',' + q[1]; }).join(' ') +
      '" fill="' + stone.dark + '" opacity=".28"/>';
    s += '<g class="rg-spark">' + sparkle(round(-r * .34), round(-r * .38), round(r * .32), stone.spark, .8) +
      sparkle(round(r * .42), round(r * .3), round(r * .18), stone.spark, .5) + '</g>';
    return s;
  }

  function stoneBody(stone, metal, r, seed, opt) {
    if (stone.kind === 'none') { return polished(metal, r, opt); }
    if (stone.kind === 'pearl') { return pearl(stone, r, opt); }
    if (stone.kind === 'cabochon') { return cabochon(stone, metal, r, seed, opt); }
    return facet(stone, r, seed, opt);
  }

  /* ============================ гравировочная пластинка ============================
     Пластинка со своим контуром и засечками: текст читается и на 480 px,
     а по буквам он проступает в render() через WAAPI. */

  function plateWidth(text, maxW) {
    var len = text.length;
    var fs = clamp((maxW - 22) / (len * 0.86), 8.6, 13.5);
    var ls = round(fs * 0.16);
    return { w: Math.round(Math.min(maxW, 22 + len * (fs * 0.72 + ls))), fs: round(fs), ls: ls };
  }

  function letters(text, x, y, fs, ls, fill) {
    var chars = text.split(''), out = '';
    for (var i = 0; i < chars.length; i++) {
      out += '<tspan class="rg-ch">' + xesc(chars[i] === ' ' ? '\u00a0' : chars[i]) + '</tspan>';
    }
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="Georgia, \'Times New Roman\', serif"' +
      ' font-size="' + fs + '" letter-spacing="' + ls + '" fill="' + fill + '" xml:space="preserve">' + out + '</text>';
  }

  function plate(text, x, y, maxW, metal, opt) {
    opt = opt || {};
    var h = opt.h || 30, rx = opt.rx || 8, rot = opt.rot || 0;
    var m = plateWidth(text, maxW);
    var x0 = round(x - m.w / 2), y0 = round(y - h / 2);
    var body = '<rect x="' + x0 + '" y="' + y0 + '" width="' + m.w + '" height="' + h + '" rx="' + rx +
        '" fill="' + metal.deep + '" stroke="' + metal.line + '" stroke-width="1.4"/>' +
      '<rect x="' + round(x0 + 3.2) + '" y="' + round(y0 + 3.2) + '" width="' + round(m.w - 6.4) + '" height="' + round(h - 6.4) +
        '" rx="' + Math.max(2, rx - 3) + '" fill="none" stroke="' + metal.rim + '" stroke-opacity=".16" stroke-width="1"/>' +
      '<rect x="' + round(x0 + 2) + '" y="' + round(y0 + 2) + '" width="' + round(m.w - 4) + '" height="' + round(h - 4) +
        '" rx="' + Math.max(2, rx - 2) + '" fill="#1d1408" opacity=".28"/>' +
      letters(text, x, round(y + m.fs * .35), m.fs, m.ls, '#fff8e8');
    return '<g' + (rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : '') + '>' + body + '</g>';
  }

  /* Куда встаёт гравировка — у каждой формы своё место */
  function graveInner(st, form, metal) {
    if (!st.graving) { return ''; }
    if (form.id === 'ring') { return plate(st.graving, 300, 331, 156, metal, { h: 30, rx: 8 }); }
    if (form.id === 'studs') { return plate(st.graving, 300, 398, 150, metal, { h: 28, rx: 14 }); }
    if (form.id === 'pendant') { return plate(st.graving, 300, 300 + pendantShift(st, form) + 110, 150, metal, { h: 28, rx: 14 }); }
    return plate(st.graving, 300, 306 + braceletRy(st, form) + 34, 150, metal, { h: 28, rx: 14 });
  }

  /* ============================ формы ============================ */

  function pendantShift(st, form) { return (sizeIndex(form, st.size) - 1) * 14; }
  function braceletRy(st, form) { return 82 + sizeIndex(form, st.size) * 6; }

  /* Кольцо: обод с рантом, каст и камень сверху, пластинка внутри обода */
  function ringBody(metal, stone, st, form) {
    var k = sizeIndex(form, st.size);
    var scale = 1 + k * .018;
    var R = 112, bw = 32, rIn = R - bw / 2, rOut = R + bw / 2;
    var g = '';
    g += '<circle class="rg-band" cx="300" cy="300" r="' + R + '" fill="none" stroke="url(#rg-metal)" stroke-width="' + bw + '"/>';
    /* рант: две волосяные линии по кромкам, внутри — свет и тень */
    g += '<circle cx="300" cy="300" r="' + rIn + '" fill="none" stroke="' + metal.line + '" stroke-width="1.6" opacity=".85"/>';
    g += '<circle cx="300" cy="300" r="' + rOut + '" fill="none" stroke="' + metal.line + '" stroke-width="1.6" opacity=".85"/>';
    g += '<circle cx="300" cy="300" r="' + round(rIn + 3) + '" fill="none" stroke="' + metal.rim + '" stroke-opacity=".16" stroke-width="1"/>';
    g += '<path d="' + arcPath(300, 300, R, 22, 112) + '" fill="none" stroke="' + metal.deep +
      '" stroke-width="' + (bw - 8) + '" stroke-linecap="round" opacity=".38"/>';
    g += '<path d="' + arcPath(300, 300, R, 198, 286) + '" fill="none" stroke="' + metal.rim +
      '" stroke-width="11" stroke-linecap="round" opacity=".5"/>';
    g += '<path class="rg-glint" d="' + arcPath(300, 300, R, 214, 336) + '" fill="none" stroke="' + metal.spec +
      '" stroke-width="6" stroke-linecap="round" stroke-dasharray="52 520" stroke-dashoffset="0" opacity=".45"/>';
    /* каст: два когтя по краям камня и седло под ним */
    g += '<g class="rg-cast">' +
      '<path d="M 272 200 Q 266 178 276 162" fill="none" stroke="' + metal.main + '" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M 328 200 Q 334 178 324 162" fill="none" stroke="' + metal.main + '" stroke-width="7" stroke-linecap="round"/>' +
      el('ellipse', { cx: 300, cy: 206, rx: 30, ry: 11, fill: 'url(#rg-metal-2)', stroke: metal.line, 'stroke-width': 1.3 }) +
      '<path d="' + arcPath(300, 206, 30, 200, 340) + '" fill="none" stroke="' + metal.rim + '" stroke-opacity=".2" stroke-width="1"/>' +
      '</g>';
    g += '<g class="rg-stone" transform="translate(300 190)">' + stoneBody(stone, metal, 26, 3 + k) + '</g>';
    g += '<g class="rg-grave">' + graveInner(st, form, metal) + '</g>';
    return {
      body: '<g transform="translate(300 300) scale(' + round(scale) + ') translate(-300 -300)">' + g + '</g>',
      ground: 300 + round(rOut * scale) + 26
    };
  }

  /* Серьги-каффы: пара дуг с камнями и бирка с гравировкой под парой */
  function studsBody(metal, stone, st, form) {
    var k = sizeIndex(form, st.size);
    var r = 46 + k * 8, cy = 300, rr = round(Math.max(14, r * .32));
    var s = '';
    [215, 385].forEach(function (cx, idx) {
      s += '<path class="rg-band" d="' + arcPath(cx, cy, r, 250, 650) + '" fill="none" stroke="url(#rg-metal)" stroke-width="18" stroke-linecap="round"/>';
      s += '<path d="' + arcPath(cx, cy, r - 9, 250, 650) + '" fill="none" stroke="' + metal.line + '" stroke-width="1.3" opacity=".8"/>';
      s += '<path d="' + arcPath(cx, cy, r + 9, 250, 650) + '" fill="none" stroke="' + metal.line + '" stroke-width="1.3" opacity=".8"/>';
      s += '<path d="' + arcPath(cx, cy, r, 34, 126) + '" fill="none" stroke="' + metal.deep + '" stroke-width="13" stroke-linecap="round" opacity=".32"/>';
      s += '<path d="' + arcPath(cx, cy, r, 200, 292) + '" fill="none" stroke="' + metal.rim + '" stroke-width="6" stroke-linecap="round" opacity=".5"/>';
      /* камень вставлен в тело дуги: под ним только тень-полумесяц, без ореола вокруг */
      s += '<path d="' + arcPath(cx, cy + r, round(rr + 3), 18, 162) + '" fill="none" stroke="' + metal.dark +
        '" stroke-width="3.2" stroke-linecap="round" opacity=".32"/>';
      s += '<path d="' + arcPath(cx, cy + r, round(rr + 3), 200, 340) + '" fill="none" stroke="' + metal.rim +
        '" stroke-width="2.6" stroke-linecap="round" opacity=".4"/>';
      s += '<g class="rg-cast">' +
        '<circle cx="' + cx + '" cy="' + (cy + r) + '" r="' + round(rr + 4.2) + '" fill="none" stroke="' + metal.mid + '" stroke-width="3.6"/>' +
        '<circle cx="' + cx + '" cy="' + (cy + r) + '" r="' + round(rr + 6.4) + '" fill="none" stroke="' + metal.line + '" stroke-width="1.3" opacity=".75"/>' +
        '<path d="' + arcPath(cx, cy + r, round(rr + 5.2), 200, 340) + '" fill="none" stroke="' + metal.rim + '" stroke-width="1.6" opacity=".45"/>' +
        '</g>';
      s += '<g class="rg-stone" transform="translate(' + cx + ' ' + (cy + r) + ')">' + stoneBody(stone, metal, rr, 7 + idx + k, { noShadow: true }) + '</g>';
    });
    /* бирка мастера: два коротких звена от дуг и пластинка под парой */
    s += '<g class="rg-chain">' +
      '<circle cx="279" cy="339" r="5" fill="url(#rg-metal-2)" stroke="' + metal.line + '" stroke-width="1.2"/>' +
      '<circle cx="288" cy="359" r="5" fill="url(#rg-metal-2)" stroke="' + metal.line + '" stroke-width="1.2"/>' +
      '<circle cx="321" cy="339" r="5" fill="url(#rg-metal-2)" stroke="' + metal.line + '" stroke-width="1.2"/>' +
      '<circle cx="312" cy="359" r="5" fill="url(#rg-metal-2)" stroke="' + metal.line + '" stroke-width="1.2"/>' +
      '</g>';
    s += '<g class="rg-grave">' + graveInner(st, form, metal) + '</g>';
    return { body: s, ground: 452 };
  }

  /* Подвеска: цепочка, ушко, диск с камнем и пластинкой на обороте */
  function pendantBody(metal, stone, st, form) {
    var k = sizeIndex(form, st.size);
    var dy = (k - 1) * 14, top = 62 - k * 6, spread = 92 + k * 10, cy = 300 + dy;
    var s = '';
    s += '<g class="rg-chain">' +
      '<path d="M ' + (300 - spread) + ' ' + top + ' Q ' + (300 - spread * .6) + ' ' + (top + 44) + ' 292 ' + (cy - 98) +
        '" fill="none" stroke="' + metal.mid + '" stroke-width="5.4" stroke-linecap="round" stroke-dasharray="7 6" opacity=".95"/>' +
      '<path d="M ' + (300 + spread) + ' ' + top + ' Q ' + (300 + spread * .6) + ' ' + (top + 44) + ' 308 ' + (cy - 98) +
        '" fill="none" stroke="' + metal.mid + '" stroke-width="5.4" stroke-linecap="round" stroke-dasharray="7 6" opacity=".95"/>' +
      '<circle cx="300" cy="' + (cy - 90) + '" r="11" fill="none" stroke="url(#rg-metal)" stroke-width="5"/>' +
      '<circle cx="300" cy="' + (cy - 90) + '" r="14" fill="none" stroke="' + metal.line + '" stroke-width="1.2" opacity=".7"/>' +
      '</g>';
    s += '<circle class="rg-band" cx="300" cy="' + cy + '" r="86" fill="url(#rg-metal)" stroke="' + metal.line + '" stroke-width="1.6"/>';
    s += '<circle cx="300" cy="' + cy + '" r="70" fill="none" stroke="' + metal.deep + '" stroke-width="1.3" opacity=".45"/>';
    s += '<path d="' + arcPath(300, cy, 78, 16, 164) + '" fill="none" stroke="' + metal.deep + '" stroke-width="15" opacity=".22"/>';
    s += '<path d="' + arcPath(300, cy, 78, 198, 320) + '" fill="none" stroke="' + metal.rim + '" stroke-width="11" stroke-linecap="round" opacity=".42"/>';
    s += '<path class="rg-glint" d="' + arcPath(300, cy, 78, 212, 340) + '" fill="none" stroke="' + metal.spec +
      '" stroke-width="5" stroke-linecap="round" stroke-dasharray="46 526" opacity=".4"/>';
    s += '<g class="rg-cast">' +
      '<circle cx="300" cy="' + (cy - 34) + '" r="40" fill="none" stroke="url(#rg-metal-2)" stroke-width="9"/>' +
      '<circle cx="300" cy="' + (cy - 34) + '" r="44" fill="none" stroke="' + metal.line + '" stroke-width="1.3" opacity=".75"/>' +
      '</g>';
    s += '<g class="rg-stone" transform="translate(300 ' + (cy - 34) + ')">' + stoneBody(stone, metal, 30, 11 + k) + '</g>';
    s += '<g class="rg-chain">' +
      '<circle cx="300" cy="' + (cy + 94) + '" r="6" fill="none" stroke="url(#rg-metal)" stroke-width="3.4"/>' +
      '</g>';
    s += '<g class="rg-grave">' + graveInner(st, form, metal) + '</g>';
    return { body: s, ground: cy + 110 + 26 };
  }

  /* Браслет: плетение из мелких колец, камень на переде и бирка с гравировкой */
  function braceletBody(metal, stone, st, form) {
    var k = sizeIndex(form, st.size);
    var rx = 132 + k * 10, ry = 82 + k * 6, cy = 306;
    var s = '';
    s += '<ellipse class="rg-band" cx="300" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="url(#rg-metal)" stroke-width="11"/>';
    s += '<ellipse cx="300" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="' + metal.line + '" stroke-width="1.3" opacity=".7"/>';
    s += '<ellipse cx="300" cy="' + cy + '" rx="' + round(rx - 7) + '" ry="' + round(ry - 7) + '" fill="none" stroke="' + metal.line + '" stroke-width="1.2" opacity=".7"/>';
    /* звенья: отдельные кольца по всему обводу с зазорами между ними */
    s += '<ellipse cx="300" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="' + metal.deep +
      '" stroke-width="14" opacity=".45"/>';
    var links = 30, li;
    for (li = 0; li < links; li++) {
      var la = (li / links) * Math.PI * 2;
      var lx = round(300 + rx * Math.cos(la)), ly = round(cy + ry * Math.sin(la));
      var tilt = round(Math.atan2(ry * Math.cos(la), -rx * Math.sin(la)) * 180 / Math.PI);
      s += '<g transform="rotate(' + tilt + ' ' + lx + ' ' + ly + ')">' +
        '<rect x="' + round(lx - 6.6) + '" y="' + round(ly - 9) + '" width="13.2" height="18" rx="6.6" fill="url(#rg-metal)" stroke="' + metal.line + '" stroke-width="1.1"/>' +
        '<rect x="' + round(lx - 3.4) + '" y="' + round(ly - 5.6) + '" width="6.8" height="11.2" rx="3.4" fill="none" stroke="' + metal.deep + '" stroke-width="1" opacity=".45"/>' +
        '</g>';
    }
    s += '<path d="' + ellipseArc(300, cy, rx - 7, ry - 7, 198, 322) + '" fill="none" stroke="' + metal.rim + '" stroke-width="5" stroke-linecap="round" opacity=".45"/>';
    s += '<path d="' + ellipseArc(300, cy, rx - 6, ry - 6, 24, 140) + '" fill="none" stroke="' + metal.deep + '" stroke-width="7" stroke-linecap="round" opacity=".3"/>';
    var i, a;
    for (i = 0; i < 9; i++) {
      a = 52 + i * 9.5;
      var cx = round(300 + rx * Math.cos(a * Math.PI / 180)), yy = round(cy + ry * Math.sin(a * Math.PI / 180));
      s += '<circle cx="' + cx + '" cy="' + yy + '" r="8.4" fill="url(#rg-metal)" stroke="' + metal.line + '" stroke-width="1.2"/>';
      s += '<circle cx="' + cx + '" cy="' + yy + '" r="4.4" fill="none" stroke="' + metal.deep + '" stroke-width="1" opacity=".5"/>';
    }
    s += '<g class="rg-cast">' +
      '<circle cx="300" cy="' + (cy - ry) + '" r="27" fill="none" stroke="url(#rg-metal-2)" stroke-width="7"/>' +
      '<circle cx="300" cy="' + (cy - ry) + '" r="30.5" fill="none" stroke="' + metal.line + '" stroke-width="1.2" opacity=".75"/>' +
      '</g>';
    s += '<g class="rg-stone" transform="translate(300 ' + (cy - ry) + ')">' + stoneBody(stone, metal, 21, 17 + k) + '</g>';
    s += '<g class="rg-chain">' +
      '<circle cx="300" cy="' + (cy + ry + 8) + '" r="6" fill="none" stroke="url(#rg-metal)" stroke-width="3.4"/>' +
      '</g>';
    s += '<g class="rg-grave">' + graveInner(st, form, metal) + '</g>';
    return { body: s, ground: cy + ry + 34 + 14 + 26 };
  }

  var BODIES = { ring: ringBody, studs: studsBody, pendant: pendantBody, bracelet: braceletBody };

  function markup(state) {
    var st = normalize(state);
    var form = find(FORMS, st.form);
    var metal = find(METALS, st.metal);
    var stone = find(STONES, st.stone);
    var drawn = (BODIES[form.id] || ringBody)(metal, stone, st, form);
    return defs(metal, stone) +
      '<g class="rg-ground">' + groundMarkup(drawn.ground, metal) + '</g>' +
      '<g class="rg-piece">' + drawn.body + '</g>';
  }

  /* ============================ анимация ============================ */

  function reducedMotion() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }

  /* Появление по шагам: снизу вверх, обод → каст → камень → гравировка.
     fill: 'both' держит кадр до старта, иначе деталь мигает в конце. */
  var STEPS = [
    ['.rg-chain', 40], ['.rg-band', 90], ['.rg-cast', 190], ['.rg-stone', 270], ['.rg-grave', 340]
  ];

  function animate(svgEl) {
    if (!svgEl || reducedMotion()) { return; }
    for (var i = 0; i < STEPS.length; i++) {
      var nodes = svgEl.querySelectorAll(STEPS[i][0]);
      for (var j = 0; j < nodes.length; j++) {
        if (!nodes[j].animate) { continue; }
        nodes[j].animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 420, delay: STEPS[i][1] + j * 60, easing: 'cubic-bezier(.2,.85,.3,1.1)', fill: 'both' }
        );
      }
    }
  }

  /* Гравировка проступает по буквам — по одной, слева направо */
  function animateLetters(svgEl, delay) {
    if (!svgEl || reducedMotion()) { return; }
    var chars = svgEl.querySelectorAll('.rg-ch');
    for (var i = 0; i < chars.length; i++) {
      if (!chars[i].animate) { continue; }
      chars[i].animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 260, delay: (delay || 0) + i * 45, easing: 'linear', fill: 'both' }
      );
    }
  }

  /* render: opts.only === 'graving' перерисовывает только пластинку —
     буква появляется по букве, не перезапуская всё изделие */
  function render(svgEl, state, opts) {
    opts = opts || {};
    var st = normalize(state);
    if (!svgEl) { return st; }
    if (opts.only === 'graving') {
      var box = svgEl.querySelector('.rg-grave');
      if (box) {
        box.innerHTML = graveInner(st, find(FORMS, st.form), find(METALS, st.metal));
        animateLetters(svgEl, 0);
        return st;
      }
    }
    var title = svgEl.querySelector('title');
    svgEl.innerHTML = (title ? '<title>' + title.innerHTML + '</title>' : '') + markup(st);
    if (opts.animate !== false) { animate(svgEl); animateLetters(svgEl, 380); }
    return st;
  }

  /* ============================ мини-иконки для чипов ============================
     Те же формы, но сведённые к контуру и одной акцентной детали: на 32 px
     фактура не читается, читается силуэт. */

  var IC = {
    metal: { light: '#f4dfae', main: '#d9b273', mid: '#b98f4a', dark: '#7c5c26', deep: '#553d16', line: 'rgba(20,17,15,.6)', rim: '#fdf3da' },
    stone: { body: '#5fa9a1', light: '#8fc9c0', dark: '#2c625c', vein: '#24443f', spark: '#eafaf7' }
  };

  function iconStone(cx, cy, r) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + IC.stone.body + '" stroke="rgba(16,14,12,.75)" stroke-width="1.3"/>' +
      '<path d="' + arcPath(cx, cy, r * .74, 200, 292) + '" fill="none" stroke="' + IC.stone.light + '" stroke-width="' + round(r * .3) + '" stroke-linecap="round" opacity=".7"/>' +
      '<circle cx="' + round(cx - r * .3) + '" cy="' + round(cy - r * .3) + '" r="' + round(r * .18) + '" fill="#eafaf7" opacity=".85"/>';
  }

  function formIcon(id) {
    var m = IC.metal, s = '';
    if (id === 'studs') {
      [-13, 13].forEach(function (cx) {
        s += '<path d="' + arcPath(cx, 1, 10.5, 250, 650) + '" fill="none" stroke="' + m.main + '" stroke-width="5.4" stroke-linecap="round"/>';
        s += '<path d="' + arcPath(cx, 1, 10.5, 200, 292) + '" fill="none" stroke="' + m.rim + '" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>';
        s += iconStone(cx, 11.5, 4.6);
      });
      return s;
    }
    if (id === 'pendant') {
      s += '<path d="M-22 -25 Q -14 -14 -5 -8" fill="none" stroke="' + m.mid + '" stroke-width="3" stroke-linecap="round"/>';
      s += '<path d="M22 -25 Q 14 -14 5 -8" fill="none" stroke="' + m.mid + '" stroke-width="3" stroke-linecap="round"/>';
      s += '<circle cx="0" cy="-7" r="3.4" fill="none" stroke="' + m.main + '" stroke-width="2.6"/>';
      s += '<circle cx="0" cy="7" r="13.5" fill="' + m.main + '" stroke="rgba(16,14,12,.7)" stroke-width="1.4"/>';
      s += '<path d="' + arcPath(0, 7, 13.5, 196, 300) + '" fill="none" stroke="' + m.rim + '" stroke-width="2.4" stroke-linecap="round" opacity=".65"/>';
      s += iconStone(0, 4, 5.6);
      return s;
    }
    if (id === 'bracelet') {
      s += '<ellipse cx="0" cy="3" rx="20" ry="13.5" fill="none" stroke="' + m.main + '" stroke-width="5"/>';
      s += '<ellipse cx="0" cy="3" rx="20" ry="13.5" fill="none" stroke="' + m.deep + '" stroke-width="4.6" stroke-dasharray="2 8" opacity=".55"/>';
      s += '<path d="' + ellipseArc(0, 3, 20, 13.5, 200, 320) + '" fill="none" stroke="' + m.rim + '" stroke-width="2" stroke-linecap="round" opacity=".6"/>';
      s += iconStone(0, -10.5, 5.4);
      return s;
    }
    /* кольцо */
    s += '<circle cx="0" cy="3" r="19" fill="none" stroke="' + m.main + '" stroke-width="8"/>';
    s += '<circle cx="0" cy="3" r="23.4" fill="none" stroke="rgba(16,14,12,.6)" stroke-width="1.2"/>';
    s += '<circle cx="0" cy="3" r="14.6" fill="none" stroke="rgba(16,14,12,.6)" stroke-width="1.2"/>';
    s += '<path d="' + arcPath(0, 3, 19, 198, 286) + '" fill="none" stroke="' + m.rim + '" stroke-width="3" stroke-linecap="round" opacity=".7"/>';
    s += iconStone(0, -19, 7.6);
    return s;
  }

  function stoneIcon(id) {
    var st = byId(STONES, id) || STONES[0], r = 16.5, i;
    if (st.kind === 'none') {
      return '<circle r="' + r + '" fill="none" stroke="rgba(207,169,107,.5)" stroke-width="2" stroke-dasharray="4 5"/>' +
        '<path d="M-8 8 L8 -8" stroke="rgba(207,169,107,.55)" stroke-width="2" stroke-linecap="round"/>';
    }
    if (st.kind === 'pearl') {
      return '<circle r="' + r + '" fill="' + st.body + '" stroke="' + st.line + '" stroke-width="1.4"/>' +
        '<circle r="' + round(r * .88) + '" fill="none" stroke="' + st.dark + '" stroke-width="2.4" opacity=".4"/>' +
        '<ellipse cx="-5" cy="-6" rx="4" ry="2.8" fill="#ffffff" opacity=".85" transform="rotate(-28 -5 -6)"/>' +
        '<path d="' + arcPath(0, 0, round(r * .8), 200, 290) + '" fill="none" stroke="' + st.light + '" stroke-width="3.4" stroke-linecap="round" opacity=".6"/>';
    }
    if (st.kind === 'cabochon') {
      var v = '';
      for (i = 0; i < 3; i++) {
        var a = (i * 2.1) + .4, d = 4 + i * 2.2;
        var x0 = round(Math.cos(a) * d), y0 = round(Math.sin(a) * d);
        v += '<path d="M ' + x0 + ' ' + y0 + ' q ' + round(Math.cos(a + 1) * 7) + ' ' + round(Math.sin(a + 1) * 7) + ' ' +
          round(Math.cos(a + .4) * 13) + ' ' + round(Math.sin(a + .4) * 13) + '" fill="none" stroke="' + st.vein +
          '" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>';
      }
      return '<circle r="' + r + '" fill="' + st.body + '" stroke="' + st.line + '" stroke-width="1.4"/>' +
        '<path d="' + arcPath(0, 0, round(r * .78), 200, 290) + '" fill="none" stroke="' + st.light + '" stroke-width="3" stroke-linecap="round" opacity=".45"/>' + v;
    }
    /* грань: восьмиугольник с площадкой и искрой */
    var pts = [], inner = [];
    for (i = 0; i < 8; i++) {
      var ang = (Math.PI * 2 * i / 8) - Math.PI / 2 + 0.2;
      pts.push(round(Math.cos(ang) * r) + ',' + round(Math.sin(ang) * r));
      inner.push(round(Math.cos(ang) * r * .5 - 1.6) + ',' + round(Math.sin(ang) * r * .5 - 2));
    }
    return '<polygon points="' + pts.join(' ') + '" fill="' + st.body + '" stroke="' + st.line + '" stroke-width="1.5"/>' +
      '<polygon points="' + inner.join(' ') + '" fill="' + st.light + '" opacity=".4"/>' +
      '<polygon points="' + [pts[2], pts[3], inner[3], inner[2]].join(' ') + '" fill="' + st.dark + '" opacity=".45"/>' +
      '<polygon points="' + [pts[4], pts[5], inner[5], inner[4]].join(' ') + '" fill="' + st.dark + '" opacity=".3"/>' +
      '<g class="rg-spark">' + sparkle(-6, -7, 6, st.spark, .85) + sparkle(7, 5, 3.4, st.spark, .5) + '</g>';
  }

  function metalIcon(id) {
    var m = byId(METALS, id) || METALS[0];
    return '<path d="' + arcPath(0, 0, 16, 202, 338) + '" fill="none" stroke="' + m.main + '" stroke-width="10" stroke-linecap="round"/>' +
      '<path d="' + arcPath(0, 0, 16, 208, 268) + '" fill="none" stroke="' + m.rim + '" stroke-width="3" stroke-linecap="round" opacity=".75"/>' +
      '<path d="' + arcPath(0, 0, 16, 290, 332) + '" fill="none" stroke="' + m.deep + '" stroke-width="3.4" stroke-linecap="round" opacity=".5"/>';
  }

  function icon(id, size) {
    size = size || 34;
    var head = '<svg viewBox="-30 -30 60 60" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">';
    if (byId(FORMS, id)) { return head + formIcon(String(id)) + '</svg>'; }
    if (byId(STONES, id)) { return head + stoneIcon(String(id)) + '</svg>'; }
    if (byId(METALS, id)) { return head + metalIcon(String(id)) + '</svg>'; }
    return head + formIcon('ring') + '</svg>';
  }

  /* ============================ снимок для корзины ============================ */

  function svgString(state, size) {
    size = size || 480;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + size +
      '" height="' + Math.round(size * H / W) + '">' + markup(state) + '</svg>';
  }

  /* base64 считаем сами: btoa спотыкается на кириллице в гравировке */
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function utf8Bytes(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) { out.push(c); }
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
      else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
        var cp = 0x10000 + ((c - 0xD800) << 10) + (str.charCodeAt(++i) - 0xDC00);
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return out;
  }
  function b64(str) {
    var bytes = utf8Bytes(str), out = '', i, b0, b1, b2;
    for (i = 0; i < bytes.length; i += 3) {
      b0 = bytes[i]; b1 = bytes[i + 1]; b2 = bytes[i + 2];
      out += B64.charAt(b0 >> 2);
      out += B64.charAt(((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4));
      out += b1 === undefined ? '=' : B64.charAt(((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6));
      out += b2 === undefined ? '=' : B64.charAt(b2 & 63);
    }
    return out;
  }

  function dataUrl(state, size) {
    return 'data:image/svg+xml;base64,' + b64(svgString(state, size || 480));
  }

  /* ============================ публично ============================ */

  root.LATUN_RING = {
    W: W, H: H, FORMS: FORMS, METALS: METALS, STONES: STONES, GRAVING: GRAVING,
    DEFAULT: DEFAULT, FREE_FROM: FREE_FROM,
    find: find, plural: plural, normalize: normalize, sizesOf: sizesOf,
    priceOf: priceOf, lines: lines, summary: summary,
    markup: markup, render: render, icon: icon, svgString: svgString, dataUrl: dataUrl
  };
}(window));
