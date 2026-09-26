/* bouquet.js — живой конструктор букета для «Пиона».
   Рисует букет из SVG-моделек: вид цветка, количество, палитра, упаковка, лента.
   Ни одного внешнего запроса: всё считается здесь, картинка получается из этого же кода.

   Публично: window.PION_BOUQUET = {
     W, H, BASE, FLOWERS, PALETTES, PACKS, RIBBONS, COUNTS, COVER,
     find, plural, priceOf(state), summary(state), markup(state),
     render(svgEl, state, opts), icon(id, size), svgString(state, size), dataUrl(state, size)
   }
   Состояние: { occasion, flower, count, palette, pack, ribbon }

   Как устроена картинка: снизу упаковка, в её край посажен букет, набранный куполом.
   Ряды считаются от нижнего (NEST_Y) вверх, головы в ряду почти касаются: так букет
   читается шапкой, а не веером на длинных стеблях. */
(function (root) {
  'use strict';

  var W = 600, H = 660;
  var NEST_Y = 386;                /* нижний ряд голов: на нём стоит упаковка */
  var WRAP = { x: 300, y: 430 };   /* точка сборки: тут лента, отсюда расходятся стебли */
  var BASE = 20;                   /* работа и упаковка — одна сумма в любом букете */
  var COUNTS = [7, 11, 15, 21, 25];
  var COVER = {
    min: 'Минимум 7 бутонов: меньше — это уже не букет',
    max: 'Больше 25 не соберу одной рукой, нужен второй человек'
  };

  /* ---------- виды цветов ---------- */
  var FLOWERS = [
    { id: 'peony', title: 'Пион', forms: ['пион', 'пиона', 'пионов'], stem: 6, hint: 'Крупная голова, от 7 до 25 бутонов' },
    { id: 'rose', title: 'Роза', forms: ['роза', 'розы', 'роз'], stem: 6, hint: 'Собираю плотно, держит форму' },
    { id: 'ranunculus', title: 'Ранункулюс', forms: ['раннукулюс', 'раннукулюса', 'раннукулюсов'], stem: 6, hint: 'Многослойный, люблю его больше всех' },
    { id: 'tulip', title: 'Тюльпан', forms: ['тюльпан', 'тюльпана', 'тюльпанов'], stem: 4, hint: 'Весной берут чаще всего' },
    { id: 'evas', title: 'Эустома', forms: ['эустома', 'эустомы', 'эустом'], stem: 3, hint: 'Мелкие головы, букет кажется воздушнее' }
  ];

  /* ---------- палитры: три тона лепестков, сердцевина, зелень, линия ---------- */
  var PALETTES = [
    { id: 'pudra', title: 'Пудровая', swatch: '#e6c3c6', add: 0, petal: ['#f7e2e4', '#eabfc6', '#d195a1'], heart: '#c98f7a', leaf: '#6d8f63', leaf2: '#8ba97d', line: 'rgba(122,72,84,.32)' },
    { id: 'white', title: 'Белая', swatch: '#f2ece0', add: 0, petal: ['#fffdf8', '#f2ecdd', '#dbcfb6'], heart: '#cbb27a', leaf: '#77906b', leaf2: '#96ab88', line: 'rgba(118,104,80,.32)' },
    { id: 'green', title: 'Зелёная', swatch: '#cfe0c4', add: 10, petal: ['#e9f2e0', '#cadebd', '#a2c291'], heart: '#e0c98a', leaf: '#4e7c53', leaf2: '#6c9a66', line: 'rgba(70,96,60,.3)' },
    { id: 'terra', title: 'Терракотовая', swatch: '#c97a4a', add: 15, petal: ['#f3b489', '#dc8f5b', '#b45f34'], heart: '#9c5a33', leaf: '#5f7d54', leaf2: '#829c6e', line: 'rgba(96,52,30,.34)' },
    { id: 'bright', title: 'Яркая', swatch: '#e5b23c', add: 20, petal: ['#f7d784', '#e3a93c', '#bd7621'], heart: '#a8502c', leaf: '#5d8757', leaf2: '#7ea273', line: 'rgba(120,80,30,.34)' }
  ];

  /* ---------- упаковка ---------- */
  var PACKS = [
    { id: 'craft', title: 'Крафт', add: 0, hint: 'Классика, ничего лишнего' },
    { id: 'paper', title: 'Матовая бумага', add: 10, hint: 'Бумага в тон палитре' },
    { id: 'box', title: 'Шляпная коробка', add: 25, hint: 'С влажной губкой, ваза не понадобится' },
    { id: 'vase', title: 'Стеклянная ваза', add: 35, hint: 'Можно подарить сразу с водой' }
  ];

  /* ---------- лента ---------- */
  var RIBBONS = [
    { id: 'cream', title: 'Кремовая', swatch: '#eadfc9', add: 0, ink: '#b09a78', main: '#efe4d2' },
    { id: 'olive', title: 'Оливковая', swatch: '#6a7a4c', add: 0, ink: '#46532f', main: '#6a7a4c' },
    { id: 'terra', title: 'Терракотовая', swatch: '#c97a4a', add: 5, ink: '#8f5230', main: '#c97a4a' },
    { id: 'ink', title: 'Чёрная', swatch: '#2b2b2b', add: 5, ink: '#111010', main: '#33312e' }
  ];

  /* ============================ помощники ============================ */
  function round(n) { return Math.round(n * 10) / 10; }

  function el(name, attrs) {
    var s = '<' + name;
    for (var k in attrs) {
      if (attrs[k] === null || attrs[k] === undefined || attrs[k] === '') { continue; }
      s += ' ' + k + '="' + attrs[k] + '"';
    }
    return s + '/>';
  }

  /* Стабильный генератор: букет не дёргается при каждом пересчёте */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function find(list, id) {
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return list[0];
  }

  function plural(n, forms) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) { return forms[0]; }
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) { return forms[1]; }
    return forms[2];
  }

  function seedOf(state) {
    return state.count * 7919 + state.flower.length * 131 + state.palette.length * 17 +
      state.pack.length * 7 + state.ribbon.length * 3;
  }

  /* ============================ модельки цветов ============================
     Каждая рисуется вокруг нуля, радиус головы 18–26.
     c[0] — светлый тон, c[1] — основной, c[2] — тёмный. */

  function peony(c, rnd) {
    var s = '', i, a;
    /* шесть крупных наружных долей — они дают махровость */
    for (i = 0; i < 6; i++) {
      a = i * 60 + (rnd() * 10 - 5);
      s += el('ellipse', { rx: 15.5, ry: 11.5, transform: 'rotate(' + round(a) + ') translate(12 0)', fill: c[1], stroke: c.line, 'stroke-width': .8 });
    }
    /* пять средних долей в шахматку */
    for (i = 0; i < 5; i++) {
      a = i * 72 + 36 + (rnd() * 8 - 4);
      s += el('ellipse', { rx: 11, ry: 8.4, transform: 'rotate(' + round(a) + ') translate(7.4 0)', fill: c[0], stroke: c.line, 'stroke-width': .6 });
    }
    /* четыре внутренних лепестка и смятая сердцевина */
    for (i = 0; i < 4; i++) {
      s += el('ellipse', { rx: 6.4, ry: 4.6, transform: 'rotate(' + (i * 90 + 18) + ') translate(4 0)', fill: c[1], opacity: .95 });
    }
    s += el('circle', { r: 3.4, fill: c[2], opacity: .85 });
    for (i = 0; i < 5; i++) {
      s += el('circle', { r: 1.5, fill: c.heart, transform: 'rotate(' + (i * 72 + 20) + ') translate(4 0)' });
    }
    return s;
  }

  /* Контур из долей: роза и пион без него читаются кружками */
  function lobedPath(n, rOut, rIn, phase) {
    var d = '';
    for (var i = 0; i < n; i++) {
      var a0 = phase + (i / n) * Math.PI * 2;
      var a1 = phase + ((i + 0.5) / n) * Math.PI * 2;
      var a2 = phase + ((i + 1) / n) * Math.PI * 2;
      var x0 = round(Math.cos(a0) * rOut), y0 = round(Math.sin(a0) * rOut);
      var xm = round(Math.cos(a1) * rIn), ym = round(Math.sin(a1) * rIn);
      var x2 = round(Math.cos(a2) * rOut), y2 = round(Math.sin(a2) * rOut);
      if (i === 0) { d += 'M' + x0 + ' ' + y0; }
      d += ' Q' + xm + ' ' + ym + ' ' + x2 + ' ' + y2;
    }
    return d + ' Z';
  }

  function rose(c, rnd) {
    var s = '';
    s += '<path d="' + lobedPath(7, 23, 15, 0.4) + '" fill="' + c[1] + '" stroke="' + c.line + '" stroke-width=".9"/>';
    s += '<path d="' + lobedPath(5, 16, 10, 1.2) + '" fill="' + c[0] + '" stroke="' + c.line + '" stroke-width=".7"/>';
    s += '<path d="' + lobedPath(4, 10, 6, 2.4) + '" fill="' + c[1] + '" opacity=".92"/>';
    s += '<path d="M0 -8.6 A 8.6 8.6 0 1 1 -7.4 4.7" fill="none" stroke="' + c[2] + '" stroke-width="3" stroke-linecap="round" opacity=".85"/>';
    s += '<path d="M0 -4.2 A 4.2 4.2 0 1 0 3.6 2.2" fill="none" stroke="' + c.heart + '" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>';
    s += el('ellipse', { cx: -7, cy: -8, rx: 5, ry: 3, fill: '#ffffff', opacity: .22, transform: 'rotate(-38 -7 -8)' });
    return s;
  }

  function ranunculus(c, rnd) {
    var s = '', i;
    for (i = 0; i < 9; i++) {
      s += el('ellipse', { rx: 15, ry: 6, transform: 'rotate(' + round(i * 40 + rnd() * 8 - 4) + ') translate(10.5 0)', fill: i % 2 ? c[1] : c[0], stroke: c.line, 'stroke-width': .55 });
    }
    for (i = 0; i < 6; i++) {
      s += el('ellipse', { rx: 9, ry: 4.2, transform: 'rotate(' + (i * 60 + 26) + ') translate(6 0)', fill: c[1], stroke: c.line, 'stroke-width': .5 });
    }
    s += el('circle', { r: 3, fill: c[2] });
    s += el('circle', { r: 1.3, fill: c.heart, transform: 'translate(1.8 -1.2)' });
    return s;
  }

  function tulip(c) {
    var s = '';
    /* чашка: три лепестка, широкое донышко, заострённые кончики */
    s += '<path d="M-15 5 C-15.5 -5, -8 -10, 0 -10 C8 -10, 15.5 -5, 15 5 C8 13, -8 13, -15 5 Z" fill="' + c[1] +
      '" stroke="' + c.line + '" stroke-width=".8"/>';
    s += '<path d="M-14 2 C-15 -12, -9 -23, -5.5 -25.5 C-2.5 -19, -0.5 -16, -0.5 -12 L-0.5 6 Z" fill="' + c[2] + '" opacity=".92"/>';
    s += '<path d="M14 2 C15 -12, 9 -23, 5.5 -25.5 C2.5 -19, 0.5 -16, 0.5 -12 L0.5 6 Z" fill="' + c[2] + '" opacity=".92"/>';
    s += '<path d="M-9.5 2 C-10 -9, -4.5 -19, -0.5 -21.5 C3.5 -19, 9 -9, 9.5 2 C5 9, -5 9, -9.5 2 Z" fill="' + c[0] + '"/>';
    s += el('ellipse', { cx: -4.4, cy: -8, rx: 2.8, ry: 8, fill: '#ffffff', opacity: .22 });
    s += el('ellipse', { cx: 0, cy: 9, rx: 11, ry: 3.4, fill: c[2], opacity: .28 });
    return s;
  }

  function evas(c, rnd) {
    var s = '', i;
    for (i = 0; i < 11; i++) {
      s += el('ellipse', { rx: 15.5, ry: 4.6, transform: 'rotate(' + round(i * 32.7 + rnd() * 7 - 3.5) + ') translate(10.5 0)', fill: i % 2 ? c[1] : c[0], stroke: c.line, 'stroke-width': .5 });
    }
    for (i = 0; i < 6; i++) {
      s += el('ellipse', { rx: 8, ry: 3.2, transform: 'rotate(' + (i * 60 + 30) + ') translate(5.6 0)', fill: c[0], stroke: c.line, 'stroke-width': .45 });
    }
    s += el('circle', { r: 5.6, fill: c.heart, opacity: .9 });
    s += el('circle', { r: 2.6, fill: c[2], opacity: .65 });
    return s;
  }

  /* Нераскрытый бутон: им добираем задний ряд, чтобы букет не выглядел витриной шаров */
  function bud(c) {
    var s = '';
    s += '<path d="M0 -24 C 12 -19, 16 -6, 11 12 C 5.5 18, -5.5 18, -11 12 C -16 -6, -12 -19, 0 -24 Z" fill="' + c[1] +
      '" stroke="' + c.line + '" stroke-width=".8"/>';
    s += '<path d="M-3.4 -22 C 2 -24, 5.5 -20, 5.5 -13 C 5.5 -6.5, 2 -2, -1 -4.5 C -5.5 -8, -6.6 -17, -3.4 -22 Z" fill="' + c[0] + '" opacity=".88"/>';
    s += '<path d="M-11 7 C -5.5 -3, 5.5 -3, 11 7 C 5.5 16, -5.5 16, -11 7 Z" fill="' + c.leaf + '"/>';
    s += '<path d="M0 7 L0 24" stroke="' + c.leaf + '" stroke-width="2.8" stroke-linecap="round"/>';
    return s;
  }

  var MODELS = { peony: peony, rose: rose, ranunculus: ranunculus, tulip: tulip, evas: evas };

  function bloom(type, colors, seed) {
    var draw = MODELS[type] || peony;
    return draw(colors, rng(seed));
  }

  /* light — часть голов берём светлым тоном: так купол не выглядит печатью */
  function colorsFor(palette, back, light) {
    var petal = palette.petal;
    var a = light ? petal[1] : petal[0];
    var b = light ? petal[2] : petal[1];
    return {
      0: back ? b : a,
      1: back ? petal[2] : b,
      2: petal[2],
      heart: palette.heart,
      leaf: palette.leaf,
      leaf2: palette.leaf2,
      line: palette.line
    };
  }

  /* ---------- ряды: нижний шире, верхние уже и мельче ---------- */
  function rowsFor(count) {
    var n = count <= 9 ? 2 : count <= 18 ? 3 : count <= 26 ? 4 : 5;
    var weights = [], sum = 0, r;
    for (r = 0; r < n; r++) { var w = 2 + r * 1.35; weights.push(w); sum += w; }
    var out = [], acc = 0;
    for (var i = 0; i < n; i++) {
      var take = (i === n - 1) ? count - acc : Math.max(1, Math.round(count * weights[i] / sum));
      out.push(take); acc += take;
    }
    return out;
  }

  /* ---------- раскладка: купол, головы почти касаются ---------- */
  function layout(count) {
    var rows = rowsFor(count);
    var scaleAll = count <= 7 ? 1.42 : count <= 11 ? 1.3 : count <= 15 ? 1.18 : count <= 21 ? 1.08 : 1.02;
    var n = rows.length;
    var out = [];
    for (var r = 0; r < n; r++) {
      var cnt = rows[r];
      var y = NEST_Y - (n - 1 - r) * 66;
      var profile = 104 + r * 62;
      var bySpacing = Math.max(0, (cnt - 1) / 2) * 43 * scaleAll;   /* 42 при голове 50 — малый нахлёст */
      var half = Math.min(profile * scaleAll, bySpacing);
      var jitter = rng(r * 977 + count);
      for (var j = 0; j < cnt; j++) {
        var t = cnt === 1 ? 0 : (j / (cnt - 1)) * 2 - 1;
        var x = W / 2 + t * half + (jitter() * 7 - 3.5);
        out.push({
          x: x,
          y: y + Math.abs(t) * 24 + (jitter() * 6 - 3),
          scale: (0.98 + r * 0.03) * scaleAll * (1 - Math.abs(t) * 0.04) * (0.95 + jitter() * 0.12),
          rot: round((x - WRAP.x) * 0.05 + (jitter() * 14 - 7)),
          back: r < n - 2,
          light: (r * 3 + j) % 5 === 2,
          order: r * 100 + j
        });
      }
    }
    return out;
  }

  /* ---------- зелень ---------- */
  function leaf(x, y, rot, scale, color) {
    return '<path d="M0 0 C 9 -7, 21 -5.5, 28 0 C 21 5.5, 9 7, 0 0 Z" fill="' + color + '" transform="translate(' +
      round(x) + ' ' + round(y) + ') rotate(' + round(rot) + ') scale(' + round(scale) + ')" opacity=".95"/>';
  }

  /* Ветка эвкалипта: стебель дугой и круглые листья вразнобой */
  function sprig(angle, len, palette, seed, wide) {
    var rnd = rng(seed), s = '';
    s += '<path d="M0 0 Q ' + round((wide ? 30 : 12) + rnd() * 8) + ' ' + round(-len * .55) + ' ' +
      round((wide ? 18 : 5) + rnd() * 8) + ' ' + round(-len) + '" fill="none" stroke="' + palette.leaf + '" stroke-width="2" opacity=".9"/>';
    for (var i = 1; i <= 9; i++) {
      var t = i / 10;
      var lx = round(t * (7 + rnd() * 7) + (i % 2 ? 9 : -9));
      var ly = round(-len * t);
      s += el('ellipse', {
        cx: lx, cy: ly, rx: round(4.6 + rnd() * 2.6), ry: round(7 + rnd() * 3.4),
        transform: 'rotate(' + round((i % 2 ? 24 : -24) + rnd() * 14) + ' ' + lx + ' ' + ly + ')',
        fill: i % 2 ? palette.leaf2 : palette.leaf, opacity: .9
      });
    }
    return '<g transform="translate(' + WRAP.x + ' ' + (WRAP.y + 14) + ') rotate(' + angle + ')">' + s + '</g>';
  }

  /* ---------- упаковка ---------- */
  function packMarkup(packId, palette, ribbon) {
    if (packId === 'vase') {
      return '<path d="M268 372 C253 412, 258 500, 270 580 L270 618 Q300 634 330 618 L330 580 C342 500, 347 412, 332 372 Z" ' +
        'fill="rgba(214,230,234,.32)" stroke="#a3b3b6" stroke-width="1.8"/>' +
        '<path d="M261 466 Q300 479 339 466 L331 578 Q300 592 269 578 Z" fill="rgba(118,176,186,.42)"/>' +
        '<path d="M261 466 Q300 479 339 466" fill="none" stroke="rgba(88,146,156,.85)" stroke-width="1.8"/>' +
        '<path d="M264 474 Q300 486 336 474" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/>' +
        '<ellipse cx="300" cy="572" rx="27" ry="6.5" fill="rgba(255,255,255,.4)"/>' +
        '<circle cx="286" cy="524" r="3" fill="rgba(255,255,255,.55)"/>' +
        '<circle cx="313" cy="548" r="2.2" fill="rgba(255,255,255,.5)"/>' +
        '<circle cx="298" cy="500" r="1.7" fill="rgba(255,255,255,.5)"/>' +
        '<path d="M288 476 L284 590 M300 478 L300 594 M312 476 L316 588" stroke="rgba(96,132,96,.5)" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path d="M281 392 C271 440, 274 520, 284 600" fill="none" stroke="#ffffff" stroke-width="4" opacity=".5" stroke-linecap="round"/>' +
        '<path d="M323 396 C330 444, 328 520, 319 596" fill="none" stroke="rgba(255,255,255,.34)" stroke-width="2.6" stroke-linecap="round"/>' +
        '<ellipse cx="300" cy="372" rx="33" ry="7.5" fill="rgba(255,255,255,.3)" stroke="#a3b3b6" stroke-width="1.8"/>' +
        '<ellipse cx="300" cy="618" rx="30" ry="6.5" fill="rgba(190,205,205,.55)" stroke="rgba(150,170,172,.7)" stroke-width="1.2"/>';
    }
    var fill = packId === 'craft' ? '#d8c29b' : (packId === 'paper' ? palette.petal[1] : '#cfc6b6');
    var edge = packId === 'craft' ? '#bda377' : (packId === 'paper' ? palette.petal[2] : '#b3a894');
    if (packId === 'box') {
      return '<path d="M226 400 h148 a13 13 0 0 1 13 13 v206 a13 13 0 0 1 -13 13 h-148 a13 13 0 0 1 -13 -13 v-206 a13 13 0 0 1 13 -13 z" ' +
        'fill="' + fill + '" stroke="' + edge + '" stroke-width="1.7"/>' +
        '<path d="M213 424 h161" fill="none" stroke="' + edge + '" stroke-width="1.5" opacity=".75"/>' +
        '<path d="M300 400 v232" fill="none" stroke="' + ribbon.main + '" stroke-width="15" opacity=".55"/>';
    }
    /* крафт и матовая бумага: кулёк, в край которого посажен букет */
    return '<path d="M216 384 Q300 420 384 384 L334 640 Q300 654 266 640 Z" fill="' + fill + '" stroke="' + edge + '" stroke-width="1.6"/>' +
      '<path d="M216 384 Q300 420 384 384 Q300 398 216 384 Z" fill="#ffffff" opacity=".2"/>' +
      '<path d="M262 404 Q272 520 278 636" fill="none" stroke="#ffffff" stroke-width="2.4" opacity=".28"/>' +
      '<path d="M338 404 Q328 520 322 636" fill="none" stroke="' + edge + '" stroke-width="1.7" opacity=".45"/>' +
      '<path d="M300 410 Q300 520 300 646" fill="none" stroke="' + edge + '" stroke-width="1.3" opacity=".35"/>';
  }

  /* Объёмный бант: петли залиты цветом, сверху — тёмный контур и узел */
  function bow(main, ink, scale) {
    return '<g transform="scale(' + scale + ')">' +
      '<path d="M-2 2 C-20 -16, -44 -12, -40 2 C-37 14, -14 14, -2 6 Z" fill="' + main + '" stroke="' + ink + '" stroke-width="1.6"/>' +
      '<path d="M2 2 C20 -16, 44 -12, 40 2 C37 14, 14 14, 2 6 Z" fill="' + main + '" stroke="' + ink + '" stroke-width="1.6"/>' +
      '<path d="M-38 0 C-30 -6, -14 -6, -5 2" fill="none" stroke="' + ink + '" stroke-width="1.2" opacity=".5"/>' +
      '<path d="M38 0 C30 -6, 14 -6, 5 2" fill="none" stroke="' + ink + '" stroke-width="1.2" opacity=".5"/>' +
      '<path d="M-2 6 C-10 26, -18 44, -30 60 C-22 62, -12 58, -6 46 C-2 34, 0 20, 0 8 Z" fill="' + main + '" stroke="' + ink + '" stroke-width="1.4"/>' +
      '<path d="M2 6 C10 26, 18 44, 30 60 C22 62, 12 58, 6 46 C2 34, 0 20, 0 8 Z" fill="' + main + '" stroke="' + ink + '" stroke-width="1.4"/>' +
      '</g>' + el('circle', { r: 6.2, cx: 0, cy: 2, fill: main, stroke: ink, 'stroke-width': 1.6 });
  }

  function ribbonMarkup(packId, ribbon) {
    if (packId === 'vase') {
      /* на вазе лента идёт поясом по горлу, бант — сбоку */
      return '<path d="M264 380 Q300 390 336 380 Q300 372 264 380 Z" fill="' + ribbon.main +
        '" stroke="' + ribbon.ink + '" stroke-width="1.3"/>' +
        '<g transform="translate(' + (WRAP.x + 44) + ' 384) scale(.8)">' + bow(ribbon.main, ribbon.ink, 1) + '</g>';
    }
    var dy = packId === 'box' ? 14 : -18;
    return '<g transform="translate(' + WRAP.x + ' ' + (WRAP.y + dy) + ') scale(.92)">' + bow(ribbon.main, ribbon.ink, 1) + '</g>';
  }

  /* ============================ сборка букета ============================ */
  function markup(state) {
    var flower = find(FLOWERS, state.flower);
    var palette = find(PALETTES, state.palette);
    var pack = find(PACKS, state.pack);
    var ribbon = find(RIBBONS, state.ribbon);
    var items = layout(state.count);
    var seed = seedOf(state);
    var s = '';

    /* 1. ваза — за стеблями, сквозь стекло видно воду и ножки */
    if (pack.id === 'vase') { s += '<g class="bq-pack bq-pack--back">' + packMarkup('vase', palette, ribbon) + '</g>'; }

    /* 2. стебли: дугой от точки сборки к каждой голове */
    var stems = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var cx = WRAP.x + (it.x - WRAP.x) * 0.3;
      var cy = WRAP.y + (it.y + 10 - WRAP.y) * 0.55;
      stems += '<path d="M' + WRAP.x + ' ' + WRAP.y + ' Q ' + round(cx) + ' ' + round(cy) + ' ' + round(it.x) + ' ' + round(it.y + 12) +
        '" fill="none" stroke="' + (it.back ? palette.leaf2 : palette.leaf) + '" stroke-width="' + (it.back ? 2.2 : 2.6) +
        '" opacity="' + (it.back ? .55 : .85) + '"/>';
    }
    s += '<g class="bq-stems">' + stems + '</g>';

    /* 3. зелень: ветки из-под упаковки и крупные листья по краям купола */
    var green = sprig(-34, 200, palette, seed + 3, true) + sprig(36, 178, palette, seed + 11, true) +
      sprig(-4, 214, palette, seed + 23, false) + sprig(64, 150, palette, seed + 31, true) + sprig(-62, 146, palette, seed + 41, true);
    for (var g = 0; g < items.length; g++) {
      var gi = items[g];
      var t = (gi.x - W / 2) / (W * 0.44);
      if (Math.abs(t) > 0.5) {
        green += leaf(gi.x + t * 26, gi.y + 6, round(t * 46 - 12), 1.0, palette.leaf);
        green += leaf(gi.x + t * 34, gi.y + 30, round(t * 58 + 6), .86, palette.leaf2);
      } else if (g % 2 === 1) {
        green += leaf(gi.x + (g % 4 ? 24 : -24), gi.y + 20, g % 4 ? 34 : -34, .8, palette.leaf2);
      }
    }
    s += '<g class="bq-greenery">' + green + '</g>';

    /* 4. упаковка поверх стеблей: головы лягут на её край */
    if (pack.id !== 'vase') { s += '<g class="bq-pack">' + packMarkup(pack.id, palette, ribbon) + '</g>'; }

    /* 5. головы: задние ряды первыми, передние ложатся сверху.
       Тень под головой отделяет цветок от соседа — без неё светлая палитра сливается. */
    var bloomGroup = '';
    for (var b = 0; b < items.length; b++) {
      var f = items[b];
      var colors = colorsFor(palette, f.back, f.light);
      var body = (f.back && b % 3 === 1) ? bud(colors) : bloom(flower.id, colors, seed + b * 17);
      bloomGroup += '<g class="bq-flower" transform="translate(' + round(f.x) + ' ' + round(f.y) + ') rotate(' + f.rot +
        ') scale(' + round(f.scale) + ')">' +
        el('ellipse', { cx: 2, cy: 6, rx: 18, ry: 15, fill: '#2b2422', opacity: f.back ? .12 : .07 }) +
        body + '</g>';
    }
    s += '<g class="bq-bloom">' + bloomGroup + '</g>';

    /* 6. тень на плоскости и лента поверх упаковки */
    s += '<ellipse cx="300" cy="646" rx="118" ry="13" fill="#2b2422" opacity=".07"/>';
    s += '<g class="bq-ribbon">' + ribbonMarkup(pack.id, ribbon) + '</g>';
    return s;
  }

  /* ============================ анимация сборки ============================ */
  function animate(svgEl, count) {
    var nodes = svgEl.querySelectorAll('.bq-flower');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node.animate) { continue; }
      var base = node.getAttribute('transform');
      node.animate(
        [{ opacity: 0, transform: base + ' scale(.55)' }, { opacity: 1, transform: base }],
        { duration: 480, delay: 60 + i * 24, easing: 'cubic-bezier(.2,.85,.3,1.15)', fill: 'both' }
      );
    }
    var rest = svgEl.querySelectorAll('.bq-pack, .bq-ribbon, .bq-greenery, .bq-stems');
    for (var j = 0; j < rest.length; j++) {
      if (!rest[j].animate) { continue; }
      rest[j].animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 40 + count * 24, fill: 'both' });
    }
  }

  function render(svgEl, state, opts) {
    var title = svgEl.querySelector('title');
    svgEl.innerHTML = (title ? '<title>' + title.innerHTML + '</title>' : '') + markup(state);
    if (!opts || opts.animate !== false) { animate(svgEl, state.count); }
  }

  /* Мини-иконка цветка для чипа: та же моделька в нейтральной палитре */
  function icon(id, size) {
    var neut = {
      petal: ['#f7e6e3', '#e5cbc8', '#c9a6a5'], heart: '#bb8f7e',
      leaf: '#7d9070', leaf2: '#9aab8c', line: 'rgba(96,74,74,.34)'
    };
    return '<svg viewBox="-27 -27 54 54" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' +
      bloom(id, colorsFor(neut, false, false), 7) + '</svg>';
  }

  function svgString(state, size) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + size + '" height="' +
      Math.round(size * H / W) + '">' + markup(state) + '</svg>';
  }

  function dataUrl(state, size) {
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString(state, size || 480))));
  }

  /* ============================ цена и подпись ============================ */
  function priceOf(state) {
    var flower = find(FLOWERS, state.flower);
    var pal = find(PALETTES, state.palette);
    var pack = find(PACKS, state.pack);
    var ribbon = find(RIBBONS, state.ribbon);
    return BASE + flower.stem * state.count + pal.add + pack.add + ribbon.add;
  }

  function summary(state) {
    var flower = find(FLOWERS, state.flower);
    var pal = find(PALETTES, state.palette);
    var pack = find(PACKS, state.pack);
    var ribbon = find(RIBBONS, state.ribbon);
    return state.count + ' ' + plural(state.count, flower.forms) + ' · ' + pal.title.toLowerCase() +
      ' палитра · ' + pack.title.toLowerCase() + ' · лента ' + ribbon.title.toLowerCase();
  }

  root.PION_BOUQUET = {
    W: W, H: H, BASE: BASE, FLOWERS: FLOWERS, PALETTES: PALETTES, PACKS: PACKS, RIBBONS: RIBBONS,
    COUNTS: COUNTS, COVER: COVER, find: find, plural: plural, priceOf: priceOf, summary: summary,
    markup: markup, render: render, icon: icon, svgString: svgString, dataUrl: dataUrl
  };
}(window));
