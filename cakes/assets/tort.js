/* ============================================================
   «Мельница» — живой торт в калькуляторе
   ------------------------------------------------------------
   Моделька рисуется кодом в SVG: слева крем снаружи, справа
   разрез, в котором видно, сколько бисквита и сколько начинки.
   Меняешь вес (число ярусов), начинку (цвет коржей и прослоек)
   или декор — торт пересобирается на месте.

   Подключается после data.js и app.js:
     <script src="assets/tort.js" defer></script>
   Публично: window.MELNITSA_TORT
   ============================================================ */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var NS = 'http://www.w3.org/2000/svg';

  /* сколько ярусов и каких при каждом весе: [кг, диаметр в см] */
  var TIERS = {
    1: [[1, 16]],
    1.5: [[1.5, 18]],
    2: [[1.2, 18], [0.8, 13]],
    3: [[1.8, 20], [1.2, 15]],
    4: [[2, 22], [1.2, 16], [0.8, 11]]
  };

  /* цвет коржа, прослойки и крема под каждую начинку из data.js */
  var LOOKS = {
    vanilla: { sponge: '#f2dda9', sponge2: '#e8d094', fill: '#d1295c', cream: '#fdf4e4', edge: '#b8934f' },
    choco: { sponge: '#7c5334', sponge2: '#6b4429', fill: '#c8284a', cream: '#f4e3cf', edge: '#3f2415' },
    straw: { sponge: '#f6e9cd', sponge2: '#efdcb5', fill: '#d13356', cream: '#fdf6e6', edge: '#bfa06a' },
    brulee: { sponge: '#f2d79e', sponge2: '#e9cb88', fill: '#a85f1c', cream: '#fbeed6', edge: '#bb9250' },
    blue: { sponge: '#f0e9f7', sponge2: '#e4dbf1', fill: '#5b4a9a', cream: '#f8f4fb', edge: '#4a3f74' },
    gf: { sponge: '#ecdbba', sponge2: '#e2cfa4', fill: '#a97f1c', cream: '#faf1de', edge: '#b59b6a' }
  };

  var BERRY = ['#c02246', '#5b2140', '#4b4a7d', '#8e1f2f', '#3f3a6b'];

  /* ---------- мелкая математика ---------- */

  /* подмешать тёплый оттенок в крем: белым по белому розетки не видно */
  function tint(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var tr = Math.round(r * (1 - k) + 214 * k);
    var tg = Math.round(g * (1 - k) + 176 * k);
    var tb = Math.round(b * (1 - k) + 146 * k);
    return '#' + ((1 << 24) + (tr << 16) + (tg << 8) + tb).toString(16).slice(1);
  }

  function looks(flavorId) { return LOOKS[flavorId] || LOOKS.vanilla; }
  function tiersFor(weight) { return TIERS[weight] || TIERS[2]; }
  function round1(n) { return Math.round(n * 10) / 10; }

  /* высота яруса: чем больше в нём килограмма, тем он выше */
  function heightFor(kg) { return Math.round(62 + 26 * Math.min(kg, 2)); }

  /* масштаб: крупный торт не должен вылезать из кадра */
  function scaleFor(weight) {
    return weight >= 4 ? 11 : weight >= 3 ? 11.6 : weight >= 2 ? 12.4 : weight >= 1.5 ? 13 : 13.5;
  }

  var CX = 268;          /* ось торта: слева воздух для ломтика, справа место подписям */
  var PLATE_Y = 520;     /* верх тарелки */

  /* ---------- ярус ---------- */

  /* полосы на срезе: корж и начинка чередуются, сумма долей = 1 */
  var BANDS = [
    { kind: 'sponge', share: 0.26 },
    { kind: 'fill', share: 0.20 },
    { kind: 'sponge', share: 0.22 },
    { kind: 'fill', share: 0.16 },
    { kind: 'sponge', share: 0.16 }
  ];

  function tierMarkup(key, top, w, h, look, decor, labelBands, isTop, glaze) {
    var x = CX - w / 2;
    var half = w / 2;
    var out = [];
    var r = Math.min(12, w * 0.06);
    var clipId = 'tier' + key;

    /* левая половина — крем снаружи, правая — разрез */
    out.push('<clipPath id="' + clipId + '"><rect x="' + CX + '" y="' + round1(top) + '" width="' + round1(half) + '" height="' + round1(h) + '" rx="' + r + '"/></clipPath>');

    var inner = [];
    var y = top;
    var bands = [];
    BANDS.forEach(function (b, i) {
      var bh = h * b.share;
      var fill = b.kind === 'fill' ? look.fill : (i % 2 === 0 ? look.sponge : look.sponge2);
      inner.push('<rect x="' + CX + '" y="' + round1(y) + '" width="' + round1(half) + '" height="' + round1(bh + 0.4) + '" fill="' + fill + '"/>');
      /* тонкая тень под полосой: срез читается даже в миниатюре */
      inner.push('<line x1="' + CX + '" y1="' + round1(y + bh) + '" x2="' + (CX + half) + '" y2="' + round1(y + bh) + '" stroke="#2a150c" stroke-width="1.2" opacity=".32"/>');
      bands.push({ kind: b.kind, y: y, h: bh });
      y += bh;
    });
    /* поры мякиша */
    for (var d = 0; d < 16; d++) {
      var dx = CX + 8 + ((d * 41) % Math.max(14, Math.round(half - 22)));
      var dy = top + 8 + ((d * 59) % Math.max(12, Math.round(h - 16)));
      inner.push('<circle cx="' + dx + '" cy="' + dy + '" r="1.25" fill="#2a150c" opacity=".07"/>');
    }
    out.push('<g clip-path="url(#' + clipId + ')">' + inner.join('') + '</g>');
    /* кромка среза слева, чтобы полосы не сливались с торцом */
    out.push('<line x1="' + CX + '" y1="' + round1(top + 1) + '" x2="' + CX + '" y2="' + round1(top + h - 1) + '" stroke="' + look.edge + '" stroke-width="1.5" opacity=".55"/>');

    /* тень под ярусом: ярусы не слипаются */
    out.push('<ellipse cx="' + CX + '" cy="' + round1(top + h) + '" rx="' + round1(half * 0.96) + '" ry="6" fill="#3a1c12" opacity=".22"/>');

    /* корпус снаружи: крем */
    var coat = 'M' + x + ' ' + top + ' h' + (half - r) + ' a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + ' v' + (h - 2 * r) + ' a' + r + ' ' + r + ' 0 0 1 -' + r + ' ' + r + ' h-' + (half - r) + ' z';
    out.push('<path d="' + coat + '" fill="' + look.cream + '"/>');
    out.push('<path d="' + coat + '" fill="none" stroke="' + look.edge + '" stroke-width="1" opacity=".5"/>');

    /* верхняя плоскость: на неё ставится декор */
    if (isTop) {
      out.push('<ellipse cx="' + CX + '" cy="' + round1(top) + '" rx="' + round1(half) + '" ry="' + round1(Math.max(7, half * 0.13)) + '" fill="' + look.cream + '" stroke="' + look.edge + '" stroke-width="1.2"/>');
    }

    /* потёки глазури — приём из присланного 3D-демо, перенесённый на разрез:
       шапка по верху яруса, капли по наружной стенке, слой глазури видно на срезе */
    if (isTop && glaze) {
      var gy = Math.max(5, Math.round(h * 0.1));
      var ry = Math.max(7, half * 0.13);
      out.push('<ellipse cx="' + CX + '" cy="' + round1(top) + '" rx="' + round1(half + 1.5) + '" ry="' + round1(ry + 1.5) + '" fill="' + look.edge + '" opacity=".94"/>');
      /* слой глазури на срезе */
      out.push('<rect x="' + CX + '" y="' + round1(top) + '" width="' + round1(half) + '" height="' + gy + '" fill="' + look.edge + '" opacity=".9"/>');
      /* капли по наружной стенке: разной длины, с закруглённым концом */
      var lens = [gy * 2.4, gy * 1.4, gy * 2.9, gy * 1.1];
      for (var k = 0; k < lens.length; k++) {
        var dx = round1(x + 6 + (half * 0.8) * (k + 0.5) / lens.length);
        var dy = round1(top + ry * 0.6);
        out.push('<path d="M' + (dx - 4) + ' ' + dy + ' h8 v' + round1(lens[k]) +
          ' q0 4 -4 4 q-4 0 -4 -4 z" fill="' + look.edge + '" opacity=".95"/>');
        out.push('<circle cx="' + dx + '" cy="' + round1(dy + lens[k] + 3) + '" r="3.1" fill="' + look.edge + '"/>');
      }
      /* блик на глазури */
      out.push('<path d="M' + round1(x + 10) + ' ' + round1(top - 1) + ' h' + round1(half * 0.46) + '" stroke="#ffffff" stroke-width="2" opacity=".32" fill="none"/>');
    }

    /* бордюр из отсадки по низу яруса */
    var dots = Math.max(3, Math.round(half / 15));
    var step = (half - 6) / dots;
    for (var j = 0; j < dots; j++) {
      var cxp = x + 3 + step * (j + 0.5);
      out.push('<circle cx="' + round1(cxp) + '" cy="' + round1(top + h) + '" r="' + round1(Math.max(3.2, step * 0.34)) + '" fill="' + look.cream + '" stroke="' + look.edge + '" stroke-width=".9" opacity=".98"/>');
    }
    /* силуэт яруса целиком: слева крем, справа срез — одним контуром */
    out.push('<path d="M' + (CX + half) + ' ' + round1(top) + ' H' + round1(x + r) + ' a' + r + ' ' + r + ' 0 0 1 -' + r + ' ' + r + ' V' + round1(top + h - r) + ' a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + ' H' + (CX + half) + ' Z" fill="none" stroke="' + look.edge + '" stroke-width="1.6" opacity=".85"/>');

    if (decor) out.push(decor(key, top, w, h, look));
    if (labelBands) labelBands(bands);
    return out.join('');
  }

  /* ---------- подписи к разрезу ---------- */

  function labelsMarkup(points) {
    var out = [];
    var rows = [
      { text: 'бисквит', pt: points.sponge, y: points.sponge.y - 34 },
      { text: 'начинка', pt: points.fill, y: points.fill.y + 30 }
    ];
    var lx = 452;
    rows.forEach(function (row) {
      if (!row.pt) return;
      out.push('<path d="M' + round1(row.pt.x) + ' ' + round1(row.pt.y) + ' L' + (lx - 16) + ' ' + round1(row.y) + ' L' + (lx - 6) + ' ' + round1(row.y) + '" fill="none" stroke="#a08b6e" stroke-width="1.4" stroke-dasharray="5 4"/>');
      out.push('<circle cx="' + round1(row.pt.x) + '" cy="' + round1(row.pt.y) + '" r="3.2" fill="#a08b6e"/>');
      out.push('<text x="' + lx + '" y="' + round1(row.y + 6) + '" class="tort-label">' + row.text + '</text>');
    });
    /* крем снаружи — подпись слева, к ней ведём линию от левого борта */
    if (points.cream) {
      var cy0 = points.cream.y;
      out.push('<path d="M' + round1(points.cream.x) + ' ' + round1(cy0) + ' L86 ' + round1(cy0) + '" fill="none" stroke="#a08b6e" stroke-width="1.4" stroke-dasharray="5 4"/>');
      out.push('<circle cx="' + round1(points.cream.x) + '" cy="' + round1(cy0) + '" r="3.2" fill="#a08b6e"/>');
      out.push('<text x="80" y="' + round1(cy0 + 6) + '" class="tort-label" text-anchor="end">крем</text>');
    }
    return out.join('');
  }

  /* ---------- декор на верхнем ярусе ---------- */

  /* кремовая розетка: три кольца лепестков и спираль в середине */
  function rosette(cx, cy, r, look, seed) {
    var petal = tint(look.cream, 0.14);
    var out = ['<circle cx="' + round1(cx) + '" cy="' + round1(cy) + '" r="' + round1(r) + '" fill="' + petal + '" stroke="' + look.edge + '" stroke-width="1"/>'];
    var rings = [{ n: 6, rad: r * 0.84, pr: r * 0.5 }, { n: 5, rad: r * 0.52, pr: r * 0.36 }, { n: 4, rad: r * 0.26, pr: r * 0.22 }];
    rings.forEach(function (ring, ri) {
      for (var i = 0; i < ring.n; i++) {
        var a = (i / ring.n) * TAU + seed + ri * 0.6;
        var px = cx + Math.cos(a) * ring.rad;
        var py = cy + Math.sin(a) * ring.rad;
        out.push('<ellipse cx="' + round1(px) + '" cy="' + round1(py) + '" rx="' + round1(ring.pr) + '" ry="' + round1(ring.pr * 0.78) + '" fill="' + petal + '" stroke="' + look.edge + '" stroke-width="1.4" transform="rotate(' + Math.round(a * 180 / Math.PI) + ' ' + round1(px) + ' ' + round1(py) + ')" opacity=".98"/>');
      }
    });
    var pts = [];
    for (var i = 0; i <= 26; i++) {
      var aa = (i / 26) * TAU * 1.6 + seed;
      var rr = (r * 0.23) * (i / 26);
      pts.push(round1(cx + Math.cos(aa) * rr) + ',' + round1(cy + Math.sin(aa) * rr));
    }
    out.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + look.edge + '" stroke-width="1.5" opacity=".85"/>');
    return out.join('');
  }

  function rosesDecor(key, top, w, h, look) {
    var out = [];
    var n = 5;
    for (var i = 0; i < n; i++) {
      var p = (i + 0.5) / n;
      var cx = CX - w / 2 + w * p;
      var cy = top - 12 - Math.sin(p * Math.PI) * 4;
      out.push(rosette(cx, cy, 18 + Math.sin(i * 1.7) * 1.8, look, i * 0.9));
    }
    out.push(rosette(CX - w / 2 + 9, top + h * 0.44, 12, look, 1.2));
    out.push(rosette(CX - w / 2 - 3, top + h * 0.72, 10.5, look, 2.4));
    return out.join('');
  }

  function berriesDecor(key, top, w, h, look) {
    var out = [];
    var n = 9;
    for (var i = 0; i < n; i++) {
      var p = (i + 0.5) / n;
      var cx = CX - w / 2 + 14 + (w - 28) * p;
      var cy = top - 11 - ((i % 3) === 0 ? 8 : 0);
      var rr = 8.4 + ((i * 7) % 3) * 1.3;
      out.push('<circle cx="' + round1(cx) + '" cy="' + round1(cy) + '" r="' + round1(rr) + '" fill="' + BERRY[i % BERRY.length] + '"/>');
      out.push('<circle cx="' + round1(cx - rr * 0.32) + '" cy="' + round1(cy - rr * 0.36) + '" r="' + round1(rr * 0.24) + '" fill="#fff" opacity=".5"/>');
    }
    var shards = [[CX - w / 2 + 26, top - 36, 30, 38], [CX + w / 2 - 56, top - 44, 32, 46], [CX + 8, top - 30, 24, 32]];
    shards.forEach(function (s, i) {
      out.push('<path d="M' + s[0] + ' ' + s[1] + ' l' + s[2] + ' ' + (7 + i * 2) + ' l-' + (6 + i * 3) + ' ' + s[3] + ' l-' + (s[2] - 9) + ' -' + (s[3] - 7) + ' z" fill="#57321f" opacity=".94"/>');
      out.push('<path d="M' + (s[0] + 4) + ' ' + (s[1] + 3) + ' l' + (s[2] - 11) + ' ' + (5 + i) + '" stroke="#8a5637" stroke-width="1.4" opacity=".7"/>');
      out.push('<ellipse cx="' + (s[0] + s[2] / 2) + '" cy="' + (s[1] + s[3] - 1) + '" rx="' + (s[2] / 2 + 2) + '" ry="3" fill="#2a150c" opacity=".16"/>');
    });
    return out.join('');
  }

  function printDecor(key, top, w, h, look) {
    var pw = Math.min(74, w * 0.46);
    var ph = pw * 0.78;
    var px = CX - w / 2 + 16;
    var py = top + h * 0.32 - ph / 2;
    var out = [];
    out.push('<rect x="' + round1(px - 4) + '" y="' + round1(py - 4) + '" width="' + round1(pw + 8) + '" height="' + round1(ph + 8) + '" rx="4" fill="#fff" opacity=".92"/>');
    out.push('<rect x="' + round1(px) + '" y="' + round1(py) + '" width="' + pw + '" height="' + round1(ph) + '" rx="3" fill="#cfe4f2"/>');
    out.push('<path d="M' + round1(px) + ' ' + round1(py + ph * 0.74) + ' q' + (pw * 0.26) + ' -' + (ph * 0.36) + ' ' + (pw * 0.54) + ' 0 q' + (pw * 0.26) + ' ' + (ph * 0.22) + ' ' + (pw * 0.46) + ' 0 v' + (ph * 0.26) + ' h-' + pw + ' z" fill="#8fbf7c"/>');
    out.push('<circle cx="' + round1(px + pw * 0.74) + '" cy="' + round1(py + ph * 0.3) + '" r="' + round1(ph * 0.12) + '" fill="#f6d774"/>');
    out.push('<rect x="' + round1(px - 4) + '" y="' + round1(py - 4) + '" width="' + round1(pw + 8) + '" height="' + round1(ph + 8) + '" rx="4" fill="none" stroke="' + look.edge + '" stroke-width="1" stroke-dasharray="3 3"/>');
    return out.join('');
  }

  function figuresDecor(key, top, w, h, look) {
    var out = [];
    var y = top - 22;
    out.push('<path d="M' + round1(CX - w * 0.32) + ' ' + y + ' l6 -12 13 -1.9 -9.4 -9.4 2.3 -13 -12.2 6 -12.2 -6 2.3 13 -9.4 9.4 13 1.9 z" fill="#f3c6d6" stroke="#d998b0" stroke-width="1.1"/>');
    out.push('<path d="M' + round1(CX + w * 0.26) + ' ' + (y - 3) + ' c-3.4 -8 -15 -8 -15 1.2 0 7 9.2 11.6 15 16.2 5.8 -4.6 15 -9.2 15 -16.2 0 -9.2 -11.6 -9.2 -15 -1.2 z" fill="#cfe0f5" stroke="#9db6d6" stroke-width="1.1"/>');
    out.push('<circle cx="' + CX + '" cy="' + (y - 5) + '" r="12.5" fill="#f5e0bd" stroke="#d3b988" stroke-width="1.1"/>');
    out.push('<circle cx="' + (CX - 10) + '" cy="' + (y - 16) + '" r="5" fill="#f5e0bd" stroke="#d3b988" stroke-width="1.1"/>');
    out.push('<circle cx="' + (CX + 10) + '" cy="' + (y - 16) + '" r="5" fill="#f5e0bd" stroke="#d3b988" stroke-width="1.1"/>');
    out.push('<circle cx="' + (CX - 4.5) + '" cy="' + (y - 6) + '" r="1.7" fill="#6b5140"/>');
    out.push('<circle cx="' + (CX + 4.5) + '" cy="' + (y - 6) + '" r="1.7" fill="#6b5140"/>');
    out.push('<path d="M' + (CX - 3.4) + ' ' + (y + 2) + ' q3.4 3.4 6.8 0" stroke="#6b5140" stroke-width="1.3" fill="none"/>');
    return out.join('');
  }

  function minimalDecor(key, top, w, h, look) {
    var out = [];
    var y = top - 10;
    var x0 = CX - w / 2 + 18;
    var width = w - 36;
    for (var row = 0; row < 2; row++) {
      var pts = [];
      for (var i = 0; i <= 12; i++) {
        var xx = x0 + (width * i) / 12;
        var yy = y - row * 11 + Math.sin(i * 0.95 + row) * 4 * (i === 0 || i === 12 ? 0.2 : 1);
        pts.push(round1(xx) + ',' + round1(yy));
      }
      out.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="#4a2a1d" stroke-width="2.6" stroke-linecap="round" opacity=".84"/>');
    }
    for (var d = 0; d < 6; d++) {
      out.push('<circle cx="' + round1(CX - w * 0.34 + d * (w * 0.68 / 5)) + '" cy="' + round1(top - 1) + '" r="2.6" fill="#4a2a1d" opacity=".55"/>');
    }
    return out.join('');
  }

  var DECOR_FN = {
    minimal: minimalDecor,
    roses: rosesDecor,
    berries: berriesDecor,
    print: printDecor,
    figures: figuresDecor
  };

  /* ---------- ломтик на тарелке: те же слои ---------- */

  function sliceMarkup(look) {
    var x = 92;
    var base = PLATE_Y;
    var w = 62;
    var h = 64;
    var out = [];
    var path = 'M' + x + ' ' + base + ' L' + (x + w) + ' ' + base + ' L' + (x + w) + ' ' + (base - h * 0.42) + ' Q' + (x + w * 0.5) + ' ' + (base - h - 4) + ' ' + x + ' ' + (base - h * 0.5) + ' Z';
    out.push('<clipPath id="sliceClip"><path d="' + path + '"/></clipPath>');
    var inner = [];
    var y = base - h;
    BANDS.forEach(function (b, i) {
      var bh = (h * 1.06) * b.share;
      inner.push('<rect x="' + (x - 4) + '" y="' + round1(y) + '" width="' + (w + 8) + '" height="' + round1(bh + 0.4) + '" fill="' +
        (b.kind === 'fill' ? look.fill : (i % 2 === 0 ? look.sponge : look.sponge2)) + '"/>');
      y += bh;
    });
    out.push('<g clip-path="url(#sliceClip)">' + inner.join('') + '</g>');
    out.push('<path d="' + path + '" fill="none" stroke="' + look.edge + '" stroke-width="1.3"/>');
    return out.join('');
  }

  /* ---------- сборка сцены ---------- */

  function scene(state) {
    state = state || {};
    var weight = Number(state.weight) || 2;
    var flavorId = (state.flavor && state.flavor.id) || state.flavorId || 'vanilla';
    var decorId = (state.decor && state.decor.id) || state.decorId || 'minimal';
    var look = looks(flavorId);
    /* потёки: в состоянии это либо объект из списка, либо флаг */
    var d = state.drip;
    var glaze = d === true || d === 1 || d === 'drip' || !!(d && (d.id === 'drip' || d.drip === true));
    var tiers = tiersFor(weight);
    var s = scaleFor(weight);
    var out = [];
    var plateRx = 232;
    var picked = null;

    /* подложка: у иллюстрации своя тёплая поверхность, иначе крем сливается с карточкой */
    out.push('<defs><linearGradient id="tortBg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#fdf7ec"/><stop offset=".62" stop-color="#f7ead6"/><stop offset="1" stop-color="#efdcc2"/>' +
      '</linearGradient></defs>');
    out.push('<rect x="-80" y="-80" width="760" height="860" fill="url(#tortBg)"/>');
    out.push('<ellipse cx="' + CX + '" cy="' + (PLATE_Y + 26) + '" rx="' + (plateRx + 26) + '" ry="26" fill="#e8d3b4" opacity=".45"/>');
    out.push('<ellipse cx="' + CX + '" cy="' + (PLATE_Y + 16) + '" rx="' + plateRx + '" ry="19" fill="#dcc4a1" opacity=".55"/>');
    out.push('<ellipse cx="' + CX + '" cy="' + PLATE_Y + '" rx="' + plateRx + '" ry="17" fill="#fbf4e9" stroke="#dccab4" stroke-width="1.4"/>');
    out.push('<ellipse cx="' + CX + '" cy="' + PLATE_Y + '" rx="' + (plateRx - 34) + '" ry="12" fill="none" stroke="#e7d9c7" stroke-width="1.1"/>');

    var y = PLATE_Y - 10;
    var parts = [];
    var pick = function (bands) {
      var fills = bands.filter(function (b) { return b.kind === 'fill'; });
      var sponges = bands.filter(function (b) { return b.kind === 'sponge'; });
      var fill = fills[1] || fills[0];
      var sponge = sponges[1] || sponges[0];
      if (fill && sponge) {
        picked = {
          sponge: { x: CX + 34, y: sponge.y + sponge.h / 2 },
          fill: { x: CX + 34, y: fill.y + fill.h / 2 },
          cream: { x: CX - 78, y: sponge.y + sponge.h / 2 }
        };
      }
    };
    for (var i = 0; i < tiers.length; i++) {
      var t = tiers[i];
      var h = heightFor(t[0]);
      var w = round1(t[1] * s);
      y -= h;
      var isTop = (i === tiers.length - 1);
      var fn = isTop ? DECOR_FN[decorId] : null;
      parts.push('<g class="tort-tier">' + tierMarkup(i, round1(y), w, h, look, fn || null, i === 0 ? pick : null, isTop, glaze) + '</g>');
      y -= 14;
    }
    out.push('<g class="tort-tiers">' + parts.join('') + '</g>');
    out.push('<g class="tort-slice">' + sliceMarkup(look) + '</g>');
    if (picked) out.push('<g class="tort-labels">' + labelsMarkup(picked) + '</g>');
    return { body: out.join(''), top: y };
  }

  function body(state) { return scene(state).body; }

  function viewBox(state) {
    var s = scene(state);
    var top = Math.min(s.top - 66, PLATE_Y - 10);
    var bottom = PLATE_Y + 40;
    return [24, round1(top), 566, round1(bottom - top)];
  }

  /* ---------- цена и состав: те же числа, что в калькуляторе ---------- */

  function priceOf(state) {
    if (!state) return 0;
    var weight = Number(state.weight) || 2;
    var flavor = state.flavor || {};
    var decor = state.decor || {};
    var table = (typeof PRICE_PER_KG !== 'undefined') ? PRICE_PER_KG : { 1: 96, 1.5: 89, 2: 84, 3: 78, 4: 74 };
    var perKg = table[weight] !== undefined ? table[weight] : 84;
    return Math.round(perKg * weight + (flavor.extra || 0) * weight + (decor.extra || 0));
  }

  function portionsOf(weight) {
    var table = (typeof WEIGHTS !== 'undefined') ? WEIGHTS : null;
    if (table) {
      for (var i = 0; i < table.length; i++) if (Number(table[i].kg) === Number(weight)) return table[i].note;
    }
    return '';
  }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function summary(state) {
    if (!state) return '';
    var weight = Number(state.weight) || 2;
    var tiers = tiersFor(weight);
    var flavor = (state.flavor && state.flavor.name) || '';
    var decor = (state.decor && state.decor.name) || '';
    var n = tiers.length;
    var bits = [weight + ' кг'];
    bits.push(n === 1 ? 'один ярус' : n + ' ' + plural(n, 'ярус', 'яруса', 'ярусов'));
    bits.push('разрез на ' + BANDS.length + ' ' + plural(BANDS.length, 'слой', 'слоя', 'слоёв'));
    if (flavor) bits.push(flavor.toLowerCase());
    if (decor) bits.push(decor.toLowerCase());
    return bits.join(' · ');
  }

  /* ---------- вывод ---------- */

  function svgString(state, size) {
    var vb = viewBox(state);
    var w = size || 600;
    var h = Math.round(w * vb[3] / vb[2]);
    return '<svg xmlns="' + NS + '" viewBox="' + vb.join(' ') + '" width="' + w + '" height="' + h + '">' + body(state) + '</svg>';
  }

  function dataUrl(state, size) {
    var s = svgString(state, size || 480);
    try {
      return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s)));
    } catch (e) {
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    }
  }

  function prefersReduced() {
    try { return global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function render(svg, state, opts) {
    if (!svg) return false;
    opts = opts || {};
    var vb = viewBox(state);
    svg.innerHTML = body(state);
    svg.setAttribute('viewBox', vb.join(' '));
    svg.setAttribute('data-built', '1');
    if (!svg.getAttribute('role')) svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Разрез торта: ' + summary(state));
    try { svg.style.aspectRatio = vb[2] + ' / ' + vb[3]; } catch (e) {}

    if (opts.animate !== false && !prefersReduced()) {
      var tiers = svg.querySelector('.tort-tiers');
      var groups = tiers ? [].slice.call(tiers.children) : [];
      groups.forEach(function (g, i) {
        var from = groups.length - i - 1;
        if (!g.animate) return;
        g.animate(
          [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }],
          { duration: 340, delay: from * 70, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' }
        );
      });
      var slice = svg.querySelector('.tort-slice');
      if (slice && slice.animate) {
        slice.animate([{ opacity: 0, transform: 'translateX(-14px)' }, { opacity: 1, transform: 'none' }],
          { duration: 420, delay: 240, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' });
      }
      var labels = svg.querySelector('.tort-labels');
      if (labels && labels.animate) {
        labels.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 420, fill: 'both' });
      }
    }
    return true;
  }

  function icon(state, size) {
    var s = size || 44;
    var vb = viewBox(state);
    return '<svg xmlns="' + NS + '" viewBox="' + vb.join(' ') + '" width="' + s + '" height="' + s + '">' + body(state) + '</svg>';
  }

  global.MELNITSA_TORT = {
    TIERS: TIERS,
    LOOKS: LOOKS,
    BANDS: BANDS,
    tiersFor: tiersFor,
    looks: looks,
    priceOf: priceOf,
    portionsOf: portionsOf,
    summary: summary,
    markup: function (state) { return body(state); },
    viewBox: viewBox,
    svgString: svgString,
    dataUrl: dataUrl,
    render: render,
    icon: icon
  };
})(typeof window !== 'undefined' ? window : this);