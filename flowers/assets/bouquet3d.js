/* ============================================================
   «Пион» — живой букет в 3D
   ------------------------------------------------------------
   Тот же конструктор, что и в assets/bouquet.js, но букет
   собирается настоящей геометрией и рисуется в WebGL: лепестки,
   стебли, зелень, упаковка и лента — это форма, а не картинка.

   Числа и цвета остаются сайтовыми: палитры, ленты и число
   бутонов модуль читает из window.PION_BOUQUET, цену считает
   прежняя функция сайта. Если bouquet.js на странице нет,
   работает встроенная копия тех же цветов.

   three.js лежит рядом, в assets/vendor — наружу ни одного
   запроса. Если WebGL нет, модуль молча не запускается, и на
   странице остаётся векторный букет из bouquet.js.

   Публично: window.PION_BOUQUET3D
     supported()             — есть ли WebGL
     mount(canvas, getState) — поднять сцену (возвращает Promise)
     update(state, opts)     — пересобрать букет
     snapshot(width)         — снимок JPEG (data-URL) для корзины
     dispose()               — остановить
     lastError               — что не получилось
   Состояние: { occasion, flower, count, palette, pack, ribbon }
   ============================================================ */
(function (root) {
  'use strict';

  var THREE = null;
  /* путь считаем от самого файла модуля: динамический import в обычном скрипте
     разрешается относительно скрипта, а не страницы */
  var SELF = (document.currentScript && document.currentScript.src) || root.location.href;
  var VENDOR = new URL('vendor/three.module.min.js', SELF).href;
  var ENV_JPG = new URL('vendor/studio-env.jpg', SELF).href;

  var CANVAS_RATIO = 700 / 620;          /* высота холста к ширине */
  var HEAD_R = 0.40;                     /* радиус головы при масштабе 1 */
  var SNAP_BG = '#2b2422';               /* тёмная подложка снимка — тон сайта */

  /* ---------- цвета: копия bouquet.js на случай, если он не подключён ---------- */
  var FALLBACK_PALETTES = [
    { id: 'pudra', petal: ['#f7e2e4', '#eabfc6', '#d195a1'], heart: '#c98f7a', leaf: '#6d8f63', leaf2: '#8ba97d' },
    { id: 'white', petal: ['#fffdf8', '#f2ecdd', '#dbcfb6'], heart: '#cbb27a', leaf: '#77906b', leaf2: '#96ab88' },
    { id: 'green', petal: ['#e9f2e0', '#cadebd', '#a2c291'], heart: '#e0c98a', leaf: '#4e7c53', leaf2: '#6c9a66' },
    { id: 'terra', petal: ['#f3b489', '#dc8f5b', '#b45f34'], heart: '#9c5a33', leaf: '#5f7d54', leaf2: '#829c6e' },
    { id: 'bright', petal: ['#f7d784', '#e3a93c', '#bd7621'], heart: '#a8502c', leaf: '#5d8757', leaf2: '#7ea273' }
  ];
  var FALLBACK_RIBBONS = [
    { id: 'cream', main: '#efe4d2', ink: '#b09a78' },
    { id: 'olive', main: '#6a7a4c', ink: '#46532f' },
    { id: 'terra', main: '#c97a4a', ink: '#8f5230' },
    { id: 'ink', main: '#33312e', ink: '#111010' }
  ];
  /* заливки упаковки — те же, что в bouquet.js packMarkup */
  var PACK = {
    craft: { fill: '#d8c29b', edge: '#bda377' },
    paper: { fill: null, edge: null },
    box: { fill: '#cfc6b6', edge: '#b3a894' },
    vase: { fill: '#d6e6ea', edge: '#a3b3b6' }
  };
  var COUNTS = [7, 11, 15, 21, 25];

  /* ---------- состояние сцены ---------- */
  var renderer = null, scene = null, camera = null, group = null, piece = null, stage = null;
  var canvasEl = null, getState = null, raf = 0, key = null;
  var yaw = 0, pitch = 0.20, zoom = 1, dragging = false, lastX = 0, lastY = 0, idle = true, idleTimer = 0;
  var camDist = 5.0, lastW = 0, lastH = 0;
  var viewTY = 0;                        /* куда смотрит камера: центр букета */
  var halfH = 1.4, halfW = 1.3, groundY = -1.4;
  var roughTex = null, blobTex = null, floorTex = null;
  var matCache = {}, liveMats = [];
  var geoCache = {};
  var bound = false, running = false, ro = null;

  /* ============================ помощники ============================ */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* Тот же стабильный генератор, что в bouquet.js: букет не дёргается при пересборке */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(list, id) {
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return list[0];
  }

  function paletteList() {
    var bq = root.PION_BOUQUET;
    return (bq && bq.PALETTES && bq.PALETTES.length) ? bq.PALETTES : FALLBACK_PALETTES;
  }
  function ribbonList() {
    var bq = root.PION_BOUQUET;
    return (bq && bq.RIBBONS && bq.RIBBONS.length) ? bq.RIBBONS : FALLBACK_RIBBONS;
  }

  function seedOf(state) {
    return (state.count || 15) * 7919 + String(state.flower || 'peony').length * 131 +
      String(state.palette || 'pudra').length * 17 + String(state.pack || 'craft').length * 7 +
      String(state.ribbon || 'cream').length * 3;
  }

  function lin(hex) { return new THREE.Color(hex); }

  /* ---------- текстуры ---------- */

  function noiseTexture(THREE) {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = '#e8e8e8';
    x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 320; i++) {
      var r = 6 + Math.random() * 30;
      var g = x.createRadialGradient(Math.random() * 256, Math.random() * 256, 0, Math.random() * 256, Math.random() * 256, r);
      g.addColorStop(0, Math.random() > .5 ? 'rgba(120,120,120,.18)' : 'rgba(255,255,255,.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2); x.fill();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 2);
    return t;
  }

  function blobTexture(THREE) {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(128, 128, 6, 128, 128, 124);
    g.addColorStop(0, 'rgba(0,0,0,.62)');
    g.addColorStop(.45, 'rgba(0,0,0,.26)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  /* Подложка пола: тёплый тёмный центр, к краям растворяется — без жёсткой границы */
  function floorTexture(THREE) {
    var c = document.createElement('canvas');
    c.width = c.height = 512;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(256, 256, 8, 256, 256, 250);
    g.addColorStop(0, 'rgba(43,36,34,.20)');
    g.addColorStop(.55, 'rgba(43,36,34,.09)');
    g.addColorStop(1, 'rgba(43,36,34,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    return new THREE.CanvasTexture(c);
  }

  /* карта окружения: своя студия, пока не подгрузилась HDRI */
  function studioEnv(THREE) {
    var env = new THREE.Scene();
    var dome = new THREE.Mesh(
      new THREE.SphereGeometry(16, 32, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          top: { value: new THREE.Color(0x9a9184) },
          mid: { value: new THREE.Color(0x4e463d) },
          bot: { value: new THREE.Color(0x18140f) }
        },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;' +
          'void main(){ float h = normalize(vP).y;' +
          ' vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.65)) : mix(mid, bot, pow(-h, 0.6));' +
          ' gl_FragColor = vec4(c, 1.0); }'
      })
    );
    env.add(dome);
    var soft = function (w, h, x, y, z, rx, ry, lum) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(lum, lum, lum) }));
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, 0);
      env.add(m);
    };
    soft(11, 7, 0, 7.4, 0.6, Math.PI / 2, 0, 8.6);
    soft(5.4, 8, -6.4, 1.8, 2.6, 0, Math.PI / 2.1, 5.0);
    soft(4.2, 7, 6.4, 1.1, -1.6, 0, -Math.PI / 2.1, 3.0);
    soft(6.5, 3.0, 0, 1.4, -7.2, 0, 0, 1.6);
    soft(5.6, 3.4, 0, -1.4, 7.4, 0, Math.PI, 0.6);
    var pmrem = new THREE.PMREMGenerator(renderer);
    var tex = pmrem.fromScene(env, 0.02).texture;
    pmrem.dispose();
    return tex;
  }

  /* ============================ лепесток ============================
     Лепесток — не плоскость и не шар: это изогнутая по двум осям пластина
     («ложка»). Вдоль длины она выгибается и заворачивает кончик, поперёк —
     собирается жёлобом, а по краю идёт мягкая гофра. Тон берётся вершинными
     цветами: у основания глубже, к краю светлее, у самой кромки чуть темнее —
     из-за этого лепесток читается живым, а не крашеным. */

  function petalProfile(t, o) {
    var s = t < 0.6 ? Math.sin(Math.PI * 0.5 * (t / 0.6)) : 1;
    var w = o.baseW + (1 - o.baseW) * Math.pow(s, o.shoulder);
    var e = t <= 0.6 ? 1 : Math.pow(Math.max(0, 1 - (t - 0.6) / 0.4), o.tipPow);
    return w * e;
  }

  function petalSurface(t, v, o, out) {
    var hw = 0.5 * o.width * petalProfile(t, o);
    var z = o.cup * v * v * (0.34 + 0.66 * Math.pow(t, 0.7))
      - o.dish * (1 - v * v) * (0.35 + 0.65 * t)
      + o.bend * o.len * t * t
      + o.tipCurl * o.len * Math.pow(t, 3)
      + o.ruffle * o.len * 0.085 * Math.sin(v * o.ruffleFreq * Math.PI) * Math.pow(t, 1.6)
      + o.wave * o.len * 0.05 * Math.sin(t * Math.PI * 1.4) * v;
    out[0] = hw * v;
    out[1] = o.len * t;
    out[2] = z;
    return out;
  }

  function petalGeometry(THREE, o) {
    var SU = o.segU || 9, SV = o.segV || 7;
    var nv = (SU + 1) * (SV + 1);
    var pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    var idx = new Uint16Array(SU * SV * 6);
    var a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
    var tu = [0, 0, 0], tv = [0, 0, 0];
    var e = 0.004, iu, iv, k = 0;
    for (iu = 0; iu <= SU; iu++) {
      var t = iu / SU;
      var t1 = t < e ? t : t - e, t2 = t > 1 - e ? t : t + e;
      for (iv = 0; iv <= SV; iv++) {
        var v = (iv / SV) * 2 - 1;
        var v1 = v < -1 + e ? v : v - e, v2 = v > 1 - e ? v : v + e;
        petalSurface(t, v, o, a);
        petalSurface(t2, v, o, b); petalSurface(t1, v, o, c);
        tu[0] = (b[0] - c[0]) / (t2 - t1); tu[1] = (b[1] - c[1]) / (t2 - t1); tu[2] = (b[2] - c[2]) / (t2 - t1);
        petalSurface(t, v2, o, b); petalSurface(t, v1, o, c);
        tv[0] = (b[0] - c[0]) / (v2 - v1); tv[1] = (b[1] - c[1]) / (v2 - v1); tv[2] = (b[2] - c[2]) / (v2 - v1);
        var nx = tv[1] * tu[2] - tv[2] * tu[1];
        var ny = tv[2] * tu[0] - tv[0] * tu[2];
        var nz = tv[0] * tu[1] - tv[1] * tu[0];
        var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        var i3 = (iu * (SV + 1) + iv) * 3;
        pos[i3] = a[0]; pos[i3 + 1] = a[1]; pos[i3 + 2] = a[2];
        nor[i3] = nx / nl; nor[i3 + 1] = ny / nl; nor[i3 + 2] = nz / nl;
        /* тон: основание глубже, край светлее, самая кромка темнее */
        var shade = 0.80 + 0.30 * Math.pow(t, 0.7);
        shade *= 1 - 0.12 * Math.pow(Math.abs(v), 2.6);
        if (t < 0.22) { shade *= 0.86 + 0.14 * (t / 0.22); }
        col[i3] = col[i3 + 1] = col[i3 + 2] = shade;
      }
    }
    for (iu = 0; iu < SU; iu++) {
      for (iv = 0; iv < SV; iv++) {
        var a0 = iu * (SV + 1) + iv, a1 = a0 + 1, a2 = a0 + SV + 1, a3 = a2 + 1;
        idx[k++] = a0; idx[k++] = a2; idx[k++] = a1;
        idx[k++] = a1; idx[k++] = a2; idx[k++] = a3;
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }

  /* ============================ сшивка геометрии ============================
     Головка цветка — это десятки лепестков. Каждый лепесток отдельной сеткой
     рисовать нельзя (сотни вызовов на кадр), поэтому всё складывается в одну
     геометрию: позиции, нормали и вершинные цвета просто дописываются. */

  function GeoBuilder(THREE) {
    this.T = THREE;
    this.pos = []; this.nor = []; this.col = []; this.idx = []; this.n = 0;
  }

  GeoBuilder.prototype.add = function (geo, matrix, tint) {
    var T = this.T;
    var p = geo.attributes.position, nn = geo.attributes.normal, cc = geo.attributes.color;
    var nm = new T.Matrix3();
    if (matrix) { nm.getNormalMatrix(matrix); }
    var v = new T.Vector3(), nv = new T.Vector3();
    var tr = tint ? tint[0] : 1, tg = tint ? tint[1] : 1, tb = tint ? tint[2] : 1;
    var i;
    for (i = 0; i < p.count; i++) {
      v.set(p.array[i * 3], p.array[i * 3 + 1], p.array[i * 3 + 2]);
      if (matrix) { v.applyMatrix4(matrix); }
      this.pos.push(v.x, v.y, v.z);
      if (nn) {
        nv.set(nn.array[i * 3], nn.array[i * 3 + 1], nn.array[i * 3 + 2]);
        if (matrix) { nv.applyMatrix3(nm).normalize(); }
        this.nor.push(nv.x, nv.y, nv.z);
      } else {
        this.nor.push(0, 1, 0);
      }
      if (cc) { this.col.push(cc.array[i * 3] * tr, cc.array[i * 3 + 1] * tg, cc.array[i * 3 + 2] * tb); }
      else { this.col.push(tr, tg, tb); }
    }
    var ix = geo.index ? geo.index.array : null;
    if (ix) {
      for (i = 0; i < ix.length; i++) { this.idx.push(ix[i] + this.n); }
    } else {
      for (i = 0; i < p.count; i++) { this.idx.push(i + this.n); }
    }
    this.n += p.count;
  };

  GeoBuilder.prototype.build = function () {
    var T = this.T;
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  };

  /* Ставит плоскую заготовку так, чтобы её «длина» смотрела в dir,
     а «лицо» — вверх от up. Так лепестки, листья и ленты кладутся куда надо. */
  function placePlane(THREE, m, dir, up, sx, sy, roll, px, py, pz) {
    var d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    var u = new THREE.Vector3(up[0], up[1], up[2]);
    u.addScaledVector(d, -u.dot(d));
    if (u.lengthSq() < 1e-7) {
      u.set(0, 1, 0);
      u.addScaledVector(d, -u.dot(d));
      if (u.lengthSq() < 1e-7) { u.set(1, 0, 0); }
    }
    u.normalize();
    var x = new THREE.Vector3().crossVectors(d, u);
    m.makeBasis(x, d, u);
    if (roll) { m.multiply(new THREE.Matrix4().makeRotationY(roll)); }
    if (sx !== 1 || sy !== 1) { m.multiply(new THREE.Matrix4().makeScale(sx, sy, sy)); }
    m.setPosition(px, py, pz);
    return m;
  }

  /* ============================ головки цветов ============================
     Слои идут от середины наружу: у середины лепестки мелкие и стоят почти
     вертикально, у края — крупные и отогнутые. Каждый слой повёрнут
     относительно предыдущего, поэтому цветок не читается кружками. */

  var HEAD = {
    peony: {
      petal: { len: 1.00, width: 1.06, baseW: .34, shoulder: .58, tipPow: .46, cup: .23, dish: .05, bend: -.05, tipCurl: -.16, ruffle: .95, ruffleFreq: 2.6, wave: .55, segU: 9, segV: 7 },
      layers: [
        { n: 4, p: 10, s: .76, w: .84, ph: 0 },
        { n: 5, p: 26, s: .86, w: .96, ph: 26 },
        { n: 6, p: 44, s: .92, w: 1.06, ph: 12 },
        { n: 5, p: 60, s: .96, w: 1.14, ph: 40 },
        { n: 6, p: 74, s: 1.00, w: 1.20, ph: 6 }
      ],
      core: 'cluster'
    },
    rose: {
      petal: { len: .96, width: .90, baseW: .38, shoulder: .7, tipPow: .95, cup: .34, dish: .02, bend: .07, tipCurl: .13, ruffle: .35, ruffleFreq: 2.1, wave: .35, segU: 9, segV: 7 },
      layers: [
        { n: 3, p: 11, s: .46, w: .92, ph: 0, spiral: 1 },
        { n: 4, p: 26, s: .60, w: 1.02, ph: 0, spiral: 1 },
        { n: 5, p: 44, s: .76, w: 1.26, ph: 0, spiral: 1 },
        { n: 5, p: 62, s: .90, w: 1.48, ph: 0, spiral: 1 }
      ],
      core: 'rose'
    },
    tulip: {
      petal: { len: 1.28, width: .96, baseW: .52, shoulder: .85, tipPow: .52, cup: .44, dish: .03, bend: .04, tipCurl: .12, ruffle: .14, ruffleFreq: 2.0, wave: .30, segU: 10, segV: 7 },
      layers: [
        { n: 3, p: 15, s: 1.00, w: 1.00, ph: 0 },
        { n: 3, p: 31, s: .93, w: 1.06, ph: 60 }
      ],
      core: 'tulip'
    },
    ranunculus: {
      petal: { len: .86, width: .92, baseW: .34, shoulder: .62, tipPow: .60, cup: .28, dish: .03, bend: .02, tipCurl: .06, ruffle: .42, ruffleFreq: 2.3, wave: .40, segU: 8, segV: 6 },
      layers: [
        { n: 5, p: 13, s: .62, w: .90, ph: 0 },
        { n: 6, p: 28, s: .72, w: .96, ph: 18 },
        { n: 7, p: 42, s: .80, w: 1.00, ph: 34 },
        { n: 8, p: 55, s: .88, w: 1.04, ph: 8 },
        { n: 7, p: 68, s: .94, w: 1.08, ph: 46 }
      ],
      core: 'dot'
    },
    evas: {
      petal: { len: .95, width: 1.30, baseW: .40, shoulder: .55, tipPow: .50, cup: .17, dish: .04, bend: -.05, tipCurl: -.10, ruffle: .58, ruffleFreq: 2.4, wave: .48, segU: 9, segV: 7 },
      layers: [
        { n: 6, p: 72, s: 1.00, w: 1.20, ph: 0 },
        { n: 5, p: 42, s: .55, w: .86, ph: 30 }
      ],
      core: 'evas'
    }
  };

  /* Середина цветка: она мельче лепестков, но именно она не даёт головке
     читаться шариком. Держим её отдельной сеткой — у неё свой цвет палитры. */
  function buildCoreGeometry(THREE, kind, rnd) {
    var gb = new GeoBuilder(THREE);
    var m = new THREE.Matrix4();
    var i, a;
    if (kind === 'cluster') {                    /* пион: смятая середина в мелких лепестках */
      var ball = new THREE.SphereGeometry(0.13, 14, 10);
      ball.scale(1, .78, 1);
      m.identity(); m.setPosition(0, 0.42, 0);
      gb.add(ball, m);
      ball.dispose();
      for (i = 0; i < 7; i++) {
        a = i * 0.9;
        var bead = new THREE.SphereGeometry(0.040, 8, 6);
        m.identity(); m.setPosition(Math.cos(a) * 0.115, 0.45 + (i % 2) * 0.05, Math.sin(a) * 0.115);
        gb.add(bead, m, [1.18, 1.10, 1.02]);
        bead.dispose();
      }
    } else if (kind === 'rose') {                /* роза: плотный свиток в середине */
      var bud = new THREE.SphereGeometry(0.115, 14, 10);
      bud.scale(1, 1.25, 1);
      m.identity(); m.setPosition(0, 0.26, 0);
      gb.add(bud, m);
      bud.dispose();
    } else if (kind === 'tulip') {               /* тюльпан: тёмное дно чашки и пыльники */
      var disc = new THREE.SphereGeometry(0.20, 16, 10);
      disc.scale(1, .34, 1);
      m.identity(); m.setPosition(0, 0.30, 0);
      gb.add(disc, m);
      disc.dispose();
      for (i = 0; i < 3; i++) {
        a = i * 2.1 + 0.4;
        var anther = new THREE.CylinderGeometry(0.016, 0.022, 0.20, 6);
        m.identity();
        m.makeRotationZ((i - 1) * 0.26);
        m.setPosition(Math.cos(a) * 0.05, 0.48, Math.sin(a) * 0.05);
        gb.add(anther, m, [0.86, 0.82, 0.70]);
        anther.dispose();
      }
    } else if (kind === 'dot') {                 /* ранункулюс: мелкая тёмная точка */
      var dot = new THREE.SphereGeometry(0.085, 12, 8);
      dot.scale(1, .8, 1);
      m.identity(); m.setPosition(0, 0.24, 0);
      gb.add(dot, m);
      dot.dispose();
    } else {                                     /* эустома: пестик и тычинки на нитях */
      var pistil = new THREE.SphereGeometry(0.20, 16, 12);
      pistil.scale(1, .5, 1);
      m.identity(); m.setPosition(0, 0.24, 0);
      gb.add(pistil, m);
      pistil.dispose();
      for (i = 0; i < 7; i++) {
        a = (i / 7) * Math.PI * 2;
        var fil = new THREE.CylinderGeometry(0.009, 0.012, 0.22, 5);
        m.identity();
        m.makeRotationZ(Math.cos(a) * 0.55);
        m.multiply(new THREE.Matrix4().makeRotationX(Math.sin(a) * 0.55));
        m.setPosition(Math.cos(a) * 0.10, 0.36, Math.sin(a) * 0.10);
        gb.add(fil, m, [0.95, 0.92, 0.80]);
        fil.dispose();
        var tip = new THREE.SphereGeometry(0.022, 6, 5);
        m.identity(); m.setPosition(Math.cos(a) * 0.20, 0.47, Math.sin(a) * 0.20);
        gb.add(tip, m, [1.10, 1.05, 0.90]);
        tip.dispose();
      }
    }
    return gb.build();
  }

  function headGeometry(type, seed) {
    var key2 = type + '|' + seed;
    if (geoCache[key2]) { return geoCache[key2]; }
    var cfg = HEAD[type] || HEAD.peony;
    var rnd = rng(seed);
    var gb = new GeoBuilder(THREE);
    var m = new THREE.Matrix4();
    var petal = petalGeometry(THREE, cfg.petal);
    var baseR = 0.13, radius = 0, i, L;
    for (L = 0; L < cfg.layers.length; L++) {
      var lay = cfg.layers[L];
      var spin = (lay.ph || 0) * Math.PI / 180;
      for (i = 0; i < lay.n; i++) {
        var az = lay.spiral ? (spin + (i + L * lay.n) * 2.39996) : (spin + (i / lay.n) * Math.PI * 2);
        az += (rnd() - 0.5) * 0.12;
        var pol = clamp((lay.p + (rnd() - 0.5) * 7) * Math.PI / 180, 0.02, 1.50);
        var s = lay.s * (0.93 + rnd() * 0.14);
        var roll = (rnd() - 0.5) * 0.55;
        var sp = Math.sin(pol), cp = Math.cos(pol);
        var dir = [sp * Math.cos(az), cp, sp * Math.sin(az)];
        placePlane(THREE, m, dir, [0, 1, 0], s * (lay.w || 1), s, roll,
          dir[0] * baseR, dir[1] * baseR, dir[2] * baseR);
        gb.add(petal, m);
        radius = Math.max(radius, (baseR + s * cfg.petal.len) * sp);
      }
    }
    petal.dispose();
    var geo = gb.build();
    geo.__keep = true;
    geoCache[key2] = { geo: geo, radius: Math.max(0.5, radius * 1.08) };
    return geoCache[key2];
  }

  /* Середину цветка собираем один раз на вид: она одинакова у всех головок */
  function coreGeometry(type, seed) {
    var k = type + '|core';
    if (!geoCache[k]) {
      var g = buildCoreGeometry(THREE, (HEAD[type] || HEAD.peony).core, rng(seed));
      g.__keep = true;
      geoCache[k] = g;
    }
    return geoCache[k];
  }

  /* ============================ раскладка куполом ============================
     Ряды считаем той же формулой, что и в bouquet.js: нижний ряд шире и
     многочисленнее, верхние уже и мельче. В 3D ряд становится кольцом:
     нижнее — самое широкое и низкое, верхнее — узкое и высокое. Головки
     наклонены наружу, поэтому букет читается куполом, а не веером. */

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

  function layout3D(count) {
    var rows = rowsFor(count);
    var n = rows.length;
    var scaleAll = count <= 7 ? 1.42 : count <= 11 ? 1.3 : count <= 15 ? 1.18 : count <= 21 ? 1.08 : 1.02;
    var headR = HEAD_R * scaleAll;
    var step = headR * 1.02;
    var out = [];
    for (var r = 0; r < n; r++) {
      var cnt = rows[r];
      var jitter = rng(r * 977 + count * 31 + 5);
      var profile = (0.46 + r * 0.31) * scaleAll;
      var baseR = cnt <= 1 ? 0 : (cnt * headR * 1.62) / (Math.PI * 2);
      var ringR = Math.min(baseR, profile);
      var y = (n - 1 - r) * step;
      var phase = r * 0.62 + (count % 3) * 0.35;
      var rowScale = 0.98 + r * 0.03;
      for (var j = 0; j < cnt; j++) {
        var a = phase + (j / cnt) * Math.PI * 2 + (jitter() - 0.5) * 0.18;
        var rr = ringR * (0.95 + jitter() * 0.13);
        var t = cnt === 1 ? 0 : (j / (cnt - 1)) * 2 - 1;
        var scale = headR * rowScale * (1 - Math.abs(t) * 0.03) * (0.94 + jitter() * 0.13);
        out.push({
          x: Math.cos(a) * rr,
          y: y + Math.abs(t) * step * 0.16 + (jitter() - 0.5) * step * 0.10,
          z: Math.sin(a) * rr,
          az: a,
          ringR: rr,
          tilt: clamp(rr / (headR * 2.3), 0, 1) * 0.95,
          spin: a * 1.7 + r * 0.9,
          scale: scale,
          back: r < n - 2,
          light: (r * 3 + j) % 5 === 2,
          order: r * 100 + j
        });
      }
    }
    return { items: out, headR: headR, rows: rows, scaleAll: scaleAll, nestY: 0 };
  }

  /* ============================ стебли и зелень ============================ */

  function addTube(gb, curve, radius, seg, tint) {
    var geo = new THREE.TubeGeometry(curve, seg || 10, radius, 6, false);
    gb.add(geo, null, tint);
    geo.dispose();
  }

  function addStem(gb, from, ctrl, to, radius, tint) {
    var curve = new THREE.QuadraticBezierCurve3(from, ctrl, to);
    addTube(gb, curve, radius, 12, tint);
    return curve;
  }

  /* Лист: тот же генератор, но длинный, узкий, с острым кончиком и провисом */
  var LEAF = { len: 1.05, width: .46, baseW: .30, shoulder: .9, tipPow: 1.2, cup: .17, dish: .05, bend: -.30, tipCurl: -.10, ruffle: .20, ruffleFreq: 2.0, wave: .85, segU: 9, segV: 5 };
  var SPRIG_LEAF = { len: .34, width: .30, baseW: .58, shoulder: .8, tipPow: .55, cup: .12, dish: .02, bend: -.06, tipCurl: -.04, ruffle: .10, ruffleFreq: 2.0, wave: .30, segU: 6, segV: 5 };

  function addSprig(gb, palette, rnd, a, len, scale) {
    var ox = Math.cos(a), oz = Math.sin(a);
    var s = new THREE.Vector3(ox * 0.42, -0.14, oz * 0.42);
    var c = new THREE.Vector3(ox * (0.42 + len * 0.20), len * 0.42, oz * (0.42 + len * 0.20));
    var e = new THREE.Vector3(ox * (0.42 + len * 0.38), len * 1.02, oz * (0.42 + len * 0.38));
    var curve = new THREE.CatmullRomCurve3([s, c, e]);
    addTube(gb, curve, 0.016 * scale, 12, lin(palette.leaf).toArray());
    var m = new THREE.Matrix4();
    var deep = lin(palette.leaf).toArray(), pale = lin(palette.leaf2).toArray();
    var leaf = petalGeometry(THREE, SPRIG_LEAF);
    for (var i = 1; i <= 6; i++) {
      var t = i / 7.4;
      var pt = curve.getPointAt(t);
      var side = (i % 2 ? 1 : -1);
      var dir = [pt.x + side * 0.30, 0.30 + (rnd() - 0.5) * 0.3, pt.z + side * 0.18];
      var sc = (0.46 + rnd() * 0.28) * scale * (1 - t * 0.25);
      placePlane(THREE, m, dir, [0, 1, 0], sc, sc, (rnd() - 0.5) * 0.8, pt.x, pt.y, pt.z);
      gb.add(leaf, m, i % 2 ? pale : deep);
    }
    leaf.dispose();
  }

  /* ============================ упаковка ============================ */

  function coneRadius(topR, botR, y, wrapH) {
    /* y отсчитывается от края вниз (отрицательный) */
    return topR + (botR - topR) * clamp(-y / wrapH, 0, 1);
  }

  function buildCraft(THREE, ctx) {
    var g = new THREE.Group();
    var fill = lin(PACK.craft.fill), edge = lin(PACK.craft.edge);
    var geo = new THREE.CylinderGeometry(ctx.topR, ctx.botR, ctx.wrapH, 48, 4, true);
    /* мягкие складки: чуть дышим радиусом по кругу */
    var p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), z = p.getZ(i);
      var a = Math.atan2(z, x);
      var k = 1 + 0.022 * Math.sin(a * 5) + 0.012 * Math.sin(a * 11 + 1.4);
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    geo.computeVertexNormals();
    var mat = new THREE.MeshPhysicalMaterial({
      color: fill, roughness: .9, metalness: 0, side: THREE.DoubleSide,
      sheen: .35, sheenColor: new THREE.Color(0xfff2dd), sheenRoughness: .8,
      roughnessMap: roughTex, envMapIntensity: .75
    });
    liveMats.push(mat);
    /* цилиндр отмеряем от середины, поэтому край куля ставим ровно на линию сборки */
    var body = new THREE.Mesh(geo, mat);
    body.position.y = -ctx.wrapH / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    /* отворот по краю */
    var foldGeo = new THREE.CylinderGeometry(ctx.topR * 1.03, ctx.topR * 0.965, ctx.wrapH * 0.075, 48, 1, true);
    var foldMat = new THREE.MeshPhysicalMaterial({
      color: edge, roughness: .88, metalness: 0, side: THREE.DoubleSide, envMapIntensity: .7
    });
    liveMats.push(foldMat);
    var fold = new THREE.Mesh(foldGeo, foldMat);
    fold.position.y = -ctx.wrapH * 0.0375;
    fold.castShadow = true;
    g.add(fold);
    return g;
  }

  function buildPaper(THREE, ctx, palette) {
    var g = new THREE.Group();
    var outer = lin(palette.petal[1]), inner = lin(palette.petal[2]);
    var mat = new THREE.MeshPhysicalMaterial({
      color: outer, roughness: .84, metalness: 0, side: THREE.DoubleSide,
      sheen: .55, sheenColor: lin(palette.petal[0]), sheenRoughness: .7, envMapIntensity: .8
    });
    liveMats.push(mat);
    /* лист бумаги заходит вокруг с зазором: thetaLength меньше полного круга */
    var sheetGeo = new THREE.CylinderGeometry(ctx.topR * 1.02, ctx.botR * 1.06, ctx.wrapH, 40, 3, true, 0.45, Math.PI * 1.62);
    var sheet = new THREE.Mesh(sheetGeo, mat);
    sheet.position.y = -ctx.wrapH / 2;
    sheet.castShadow = true; sheet.receiveShadow = true;
    g.add(sheet);
    var backGeo = new THREE.CylinderGeometry(ctx.topR * 1.10, ctx.botR * 1.18, ctx.wrapH * 0.92, 40, 3, true, Math.PI * 1.18, Math.PI * 1.48);
    var back = new THREE.Mesh(backGeo, mat);
    back.position.y = -ctx.wrapH / 2 + ctx.wrapH * 0.03;
    back.castShadow = true;
    g.add(back);
    /* вторая, более тёмная подложка внутри — край читается слоем */
    var innerMat = new THREE.MeshPhysicalMaterial({
      color: inner, roughness: .88, metalness: 0, side: THREE.DoubleSide, envMapIntensity: .6
    });
    liveMats.push(innerMat);
    var innerGeo = new THREE.CylinderGeometry(ctx.topR * 0.98, ctx.botR * 0.96, ctx.wrapH * 0.97, 40, 2, true);
    var innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.position.y = -ctx.wrapH / 2 - ctx.wrapH * 0.015;
    g.add(innerMesh);
    return g;
  }

  function buildBox(THREE, ctx, palette) {
    var g = new THREE.Group();
    var fill = lin(PACK.box.fill), edge = lin(PACK.box.edge);
    var wallH = ctx.wrapH * 0.88;
    var half = ctx.topR * 1.34;
    var mat = new THREE.MeshPhysicalMaterial({
      color: fill, roughness: .82, metalness: 0, side: THREE.DoubleSide,
      roughnessMap: roughTex, sheen: .3, sheenColor: new THREE.Color(0xfff6ea), envMapIntensity: .7
    });
    liveMats.push(mat);
    /* стенки: четырёхгранная призма, открытая сверху */
    var walls = new THREE.Mesh(new THREE.CylinderGeometry(half, half * 0.93, wallH, 4, 1, true), mat);
    walls.rotation.y = Math.PI / 4;
    walls.position.y = ctx.wrapH * 0.02 - wallH / 2;
    walls.castShadow = true; walls.receiveShadow = true;
    g.add(walls);
    var bottom = new THREE.Mesh(new THREE.CylinderGeometry(half * 0.93, half * 0.93, 0.06, 4, 1, false), mat);
    bottom.rotation.y = Math.PI / 4;
    bottom.position.y = ctx.wrapH * 0.02 - wallH;
    bottom.castShadow = true;
    g.add(bottom);
    var lip = new THREE.Mesh(new THREE.CylinderGeometry(half * 1.05, half * 1.05, 0.07, 4, 1, false), mat);
    lip.rotation.y = Math.PI / 4;
    lip.position.y = ctx.wrapH * 0.02 + 0.02;
    lip.castShadow = true;
    g.add(lip);
    /* влажная губка внутри: тёмный диск, из него растут стебли */
    var spongeMat = new THREE.MeshPhysicalMaterial({ color: 0x3a322a, roughness: .95, metalness: 0, envMapIntensity: .4 });
    liveMats.push(spongeMat);
    var sponge = new THREE.Mesh(new THREE.CylinderGeometry(half * 0.9, half * 0.86, 0.10, 4, 1, false), spongeMat);
    sponge.rotation.y = Math.PI / 4;
    sponge.position.y = ctx.wrapH * 0.02 - 0.10;
    g.add(sponge);
    return g;
  }

  function vaseProfile(THREE, H, topR, bellyR, baseR) {
    return [
      new THREE.Vector2(0.002, 0.0),
      new THREE.Vector2(baseR * 0.84, 0.0),
      new THREE.Vector2(baseR, H * 0.05),
      new THREE.Vector2(baseR * 0.99, H * 0.15),
      new THREE.Vector2(bellyR, H * 0.46),
      new THREE.Vector2(bellyR * 0.985, H * 0.66),
      new THREE.Vector2(topR * 1.18, H * 0.88),
      new THREE.Vector2(topR, H * 0.985),
      new THREE.Vector2(topR * 0.99, H),
      new THREE.Vector2(topR * 0.84, H * 0.95)
    ];
  }

  function buildVase(THREE, ctx, palette, rnd) {
    var g = new THREE.Group();
    var H = ctx.headR * 5.4;
    var topR = ctx.headR * 1.75, bellyR = ctx.headR * 1.95, baseR = ctx.headR * 1.30;
    var pts = vaseProfile(THREE, H, topR, bellyR, baseR);
    var glass = new THREE.MeshPhysicalMaterial({
      color: 0xdfeef0, roughness: .05, metalness: 0, transmission: 1, thickness: .5, ior: 1.5,
      transparent: false, side: THREE.DoubleSide, envMapIntensity: 1.5, clearcoat: .6, clearcoatRoughness: .08,
      attenuationColor: new THREE.Color(0xcfe4e6), attenuationDistance: 3.0
    });
    liveMats.push(glass);
    var body = new THREE.Mesh(new THREE.LatheGeometry(pts, 56), glass);
    body.position.y = ctx.vaseTop - H;
    body.castShadow = false; body.receiveShadow = false;
    g.add(body);

    /* вода: отдельный цилиндр, стебли внутри видны сквозь стекло */
    var waterH = H * 0.62;
    var waterMat = new THREE.MeshPhysicalMaterial({
      color: 0xa9c9d0, roughness: .10, metalness: 0, transmission: .86, thickness: .35, ior: 1.33,
      transparent: true, opacity: .78, side: THREE.DoubleSide, envMapIntensity: 1.3
    });
    liveMats.push(waterMat);
    var wr = bellyR * 0.94;
    var water = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr * 0.94, waterH, 40, 1, false), waterMat);
    water.position.y = ctx.vaseTop - H + H * 0.11 + waterH / 2;
    water.renderOrder = 1;
    g.add(water);
    var waterTop = water.position.y + waterH / 2;
    ctx.waterTop = waterTop;

    /* пузырьки, как в векторной витрине */
    var bubMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .1, metalness: 0, transparent: true, opacity: .5, envMapIntensity: 1.4 });
    liveMats.push(bubMat);
    for (var i = 0; i < 4; i++) {
      var r = 0.014 + rnd() * 0.016;
      var bub = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), bubMat);
      var ba = rnd() * Math.PI * 2;
      bub.position.set(Math.cos(ba) * wr * 0.7, water.position.y - waterH * 0.3 + rnd() * waterH * 0.6, Math.sin(ba) * wr * 0.7);
      g.add(bub);
    }
    /* подставка-дно: чуть плотнее, чтобы ваза стояла */
    var footMat = new THREE.MeshPhysicalMaterial({ color: 0xbfcfd1, roughness: .3, metalness: 0, transparent: true, opacity: .5, side: THREE.DoubleSide, envMapIntensity: 1.1 });
    liveMats.push(footMat);
    var foot = new THREE.Mesh(new THREE.CylinderGeometry(baseR, baseR * 1.02, 0.03, 40, 1, false), footMat);
    foot.position.y = ctx.vaseTop - H + 0.015;
    g.add(foot);
    return g;
  }

  /* ============================ лента и бант ============================ */

  function buildRibbonBand(THREE, y, r, h, mat, segs, square) {
    var geo = new THREE.CylinderGeometry(r, r * 0.995, h, segs || 64, 1, true);
    var band = new THREE.Mesh(geo, mat);
    band.position.y = y;
    if (square) { band.rotation.y = Math.PI / 4; }   /* на коробке лента тоже четырёхгранная */
    band.castShadow = true;
    return band;
  }

  function buildBow(THREE, ribbon, scale, px, py, pz, gb) {
    var main = lin(ribbon.main);
    var mat = new THREE.MeshPhysicalMaterial({
      color: main, roughness: .42, metalness: 0, side: THREE.DoubleSide,
      sheen: 1.0, sheenColor: new THREE.Color(0xffffff), sheenRoughness: .35, clearcoat: .2, envMapIntensity: 1.1
    });
    liveMats.push(mat);
    var g = new THREE.Group();
    g.position.set(px, py, pz);
    var loopGeo = new THREE.TorusGeometry(0.30 * scale, 0.055 * scale, 10, 26);
    [-1, 1].forEach(function (s) {
      var loop = new THREE.Mesh(loopGeo, mat);
      loop.scale.set(1, 0.74, 0.5);
      loop.rotation.z = s * 0.62;
      loop.position.set(s * 0.26 * scale, 0.03 * scale, 0);
      loop.castShadow = true;
      g.add(loop);
    });
    var knot = new THREE.Mesh(new THREE.SphereGeometry(0.085 * scale, 16, 12), mat);
    knot.scale.set(1, .9, .72);
    knot.castShadow = true;
    g.add(knot);
    /* хвосты: две ленты, согнутые по длине, кладём в общую геометрию букета */
    var tailO = { len: 1.5, width: .22, baseW: 1.0, shoulder: 1, tipPow: .18, cup: .05, dish: 0, bend: -.16, tipCurl: -.34, ruffle: .10, ruffleFreq: 1.4, wave: .9, segU: 9, segV: 3 };
    var tail = petalGeometry(THREE, tailO);
    var m = new THREE.Matrix4();
    [-1, 1].forEach(function (s) {
      var dir = [s * 0.30, -1, 0.06];
      placePlane(THREE, m, dir, [0, 0, 1], 0.30 * scale, 0.34 * scale, s * 0.25,
        px + s * 0.10 * scale, py - 0.10 * scale, pz + 0.02 * scale);
      gb.add(tail, m);
    });
    tail.dispose();
    return { group: g, mat: mat };
  }

  /* ============================ сборка букета ============================ */

  function materialFor(hex, kind) {
    var k = kind + '|' + hex;
    if (matCache[k]) { return matCache[k]; }
    var c = lin(hex);
    var mat;
    if (kind === 'petal') {
      var light = c.clone().lerp(new THREE.Color(0xffffff), 0.42);
      mat = new THREE.MeshPhysicalMaterial({
        color: c, vertexColors: true, roughness: .58, metalness: 0,
        sheen: .95, sheenColor: light, sheenRoughness: .55,
        clearcoat: .18, clearcoatRoughness: .55,
        side: THREE.DoubleSide, envMapIntensity: 1.05
      });
    } else if (kind === 'heart') {
      mat = new THREE.MeshPhysicalMaterial({
        color: c, vertexColors: true, roughness: .72, metalness: 0,
        sheen: .4, sheenColor: c.clone().lerp(new THREE.Color(0xffffff), 0.4), side: THREE.DoubleSide, envMapIntensity: .9
      });
    } else if (kind === 'green') {
      mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, vertexColors: true, roughness: .62, metalness: 0,
        sheen: .55, sheenColor: new THREE.Color(0xdff0d4), sheenRoughness: .6, side: THREE.DoubleSide, envMapIntensity: .9
      });
    } else {
      mat = new THREE.MeshPhysicalMaterial({ color: c, vertexColors: true, roughness: .6, metalness: 0, side: THREE.DoubleSide, envMapIntensity: .9 });
    }
    mat.__keep = true;
    matCache[k] = mat;
    return mat;
  }

  function clearGroup(g) {
    if (!g) { return; }
    while (g.children.length) {
      var c = g.children.pop();
      c.traverse(function (n) {
        if (n.isMesh) {
          if (n.geometry && !n.geometry.__keep) { n.geometry.dispose(); }
          if (n.material && !n.material.__keep) { n.material.dispose(); }
        }
      });
    }
  }

  function rebuild(state) {
    if (!THREE || !piece) { return null; }
    state = state || {};
    clearGroup(piece);
    clearGroup(stage);
    /* материалы прошлой сборки: кэшированные лежат в matCache, разовые освобождаем */
    for (var mi = 0; mi < liveMats.length; mi++) {
      if (liveMats[mi]) { liveMats[mi].dispose(); }
    }
    liveMats = [];

    var palette = pick(paletteList(), state.palette || 'pudra');
    var ribbon = pick(ribbonList(), state.ribbon || 'cream');
    var packId = state.pack || 'craft';
    var type = HEAD[state.flower] ? state.flower : 'peony';
    var count = COUNTS.indexOf(state.count) === -1 ? 15 : state.count;
    var seed = seedOf({ flower: type, count: count, palette: palette.id, pack: packId, ribbon: ribbon.id });
    var rnd = rng(seed);
    var lay = layout3D(count);
    var headR = lay.headR;
    var head = headGeometry(type, 11 + type.length * 7);
    var coreGeo = coreGeometry(type, 3 + type.length * 5);

    /* ---- головки: лепестки одной сеткой, середина — своей ---- */
    var petalMatBack = materialFor(palette.petal[2], 'petal');
    var petalMatMid = materialFor(palette.petal[1], 'petal');
    var petalMatLight = materialFor(palette.petal[0], 'petal');
    var heartMat = materialFor(palette.heart, 'heart');

    var i, it;
    for (i = 0; i < lay.items.length; i++) {
      it = lay.items[i];
      var s = it.scale / head.radius;
      var mat = it.back ? petalMatBack : (it.light ? petalMatLight : petalMatMid);
      var mesh = new THREE.Mesh(head.geo, mat);
      mesh.scale.setScalar(s);
      mesh.position.set(it.x, it.y, it.z);
      mesh.rotation.set(0, it.spin, 0);
      var q = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(Math.sin(it.az), 0, -Math.cos(it.az)).normalize(), it.tilt);
      mesh.quaternion.premultiply(q);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      piece.add(mesh);
      var core = new THREE.Mesh(coreGeo, heartMat);
      core.scale.setScalar(s);
      core.position.copy(mesh.position);
      core.quaternion.copy(mesh.quaternion);
      core.castShadow = false;
      piece.add(core);
    }

    /* ---- размеры упаковки ---- */
    var ringOuter = 0, maxY = 0;
    for (i = 0; i < lay.items.length; i++) {
      it = lay.items[i];
      ringOuter = Math.max(ringOuter, Math.hypot(it.x, it.z) + it.scale * 0.55);
      maxY = Math.max(maxY, it.y + it.scale * 0.85);
    }
    var topR = Math.max(ringOuter * 0.98, headR * 2.0);
    var botR = topR * 0.38;
    var wrapH = topR * 2.5;
    var vaseH = headR * 5.4;
    var ctx = {
      headR: headR, ringOuter: ringOuter, topR: topR, botR: botR, wrapH: wrapH,
      /* у вазы горло ниже линии сборки: головки ложатся на край, стебли уходят в воду */
      vaseTop: -headR * 0.55, bindY: 0, waterTop: 0
    };
    ctx.bindY = packId === 'vase' ? (ctx.vaseTop - vaseH + vaseH * 0.72 - vaseH * 0.30)
      : -wrapH * 0.42;

    /* ---- упаковка: часть под стеблями (ваза), часть поверх ---- */
    if (packId === 'vase') {
      piece.add(buildVase(THREE, ctx, palette, rnd));
    }

    /* ---- стебли: дугой от головки вниз, в одну точку перехвата ---- */
    var gb = new GeoBuilder(THREE);
    var deep = lin(palette.leaf).toArray(), pale = lin(palette.leaf2).toArray();
    for (i = 0; i < lay.items.length; i++) {
      it = lay.items[i];
      var from = new THREE.Vector3(it.x, it.y + it.scale * 0.06, it.z);
      var bindX = (rnd() - 0.5) * headR * 0.16;
      var bindZ = (rnd() - 0.5) * headR * 0.16;
      var to = new THREE.Vector3(bindX, ctx.bindY, bindZ);
      var ctrl;
      if (packId === 'vase') {
        /* в вазе стебли собираются в пучок сразу под головкой, иначе они прошли бы сквозь стекло */
        ctrl = new THREE.Vector3(it.x * 0.22 + bindX * 0.78, it.y * 0.22 + ctx.bindY * 0.78, it.z * 0.22 + bindZ * 0.78);
      } else {
        ctrl = new THREE.Vector3(bindX + (it.x - bindX) * 0.32, ctx.bindY + (it.y - ctx.bindY) * 0.56, bindZ + (it.z - bindZ) * 0.32);
      }
      addStem(gb, to, ctrl, from, headR * 0.055, it.back ? pale : deep);
    }
    /* ---- зелень: листья по краю купола и ветки из-под упаковки ---- */
    var leafGeo = petalGeometry(THREE, LEAF);
    var m = new THREE.Matrix4();
    var rimR = Math.max(ringOuter * 0.92, headR * 1.9);
    for (i = 0; i < 6; i++) {
      var la = (i / 6) * Math.PI * 2 + 0.4;
      var lx = Math.cos(la) * rimR, lz = Math.sin(la) * rimR;
      var dir = [Math.cos(la), 0.62 + (rnd() - 0.5) * 0.3, Math.sin(la)];
      var ls = headR * (1.05 + rnd() * 0.3);
      placePlane(THREE, m, dir, [0, 1, 0], ls * 0.85, ls, (rnd() - 0.5) * 0.7, lx * 0.92, headR * 0.05 + (rnd() - 0.5) * 0.1, lz * 0.92);
      gb.add(leafGeo, m, i % 2 ? pale : deep);
    }
    leafGeo.dispose();
    var sprigCount = 3 + (count >= 15 ? 1 : 0) + (count >= 21 ? 1 : 0);
    for (i = 0; i < sprigCount; i++) {
      var sa = (i / sprigCount) * Math.PI * 2 + 0.9;
      addSprig(gb, palette, rnd, sa, headR * (1.45 + rnd() * 0.35), headR * 0.9);
    }
    var greenMesh = new THREE.Mesh(gb.build(), materialFor('green', 'green'));
    greenMesh.castShadow = true;
    piece.add(greenMesh);

    /* ---- упаковка поверх стеблей ---- */
    if (packId === 'craft') { piece.add(buildCraft(THREE, ctx)); }
    else if (packId === 'paper') { piece.add(buildPaper(THREE, ctx, palette)); }
    else if (packId === 'box') { piece.add(buildBox(THREE, ctx, palette)); }

    /* ---- лента: пояс по упаковке и бант ---- */
    var ribMat = new THREE.MeshPhysicalMaterial({
      color: lin(ribbon.main), roughness: .42, metalness: 0, side: THREE.DoubleSide,
      sheen: 1.0, sheenColor: new THREE.Color(0xffffff), sheenRoughness: .35, clearcoat: .2, envMapIntensity: 1.1
    });
    liveMats.push(ribMat);
    var bowScale = Math.max(0.5, topR * 0.78);
    var bowGeo = new GeoBuilder(THREE);
    var bow;
    if (packId === 'vase') {
      /* пояс идёт по самому горлу: там ваза уже всего, значит лента ложится на стекло */
      var neckY = ctx.vaseTop - vaseH * 0.02;
      var neckR = headR * 1.82;
      piece.add(buildRibbonBand(THREE, neckY, neckR, headR * 0.42, ribMat, 48));
      bow = buildBow(THREE, ribbon, bowScale, neckR * 0.30, neckY + headR * 0.30, neckR * 0.98, bowGeo);
    } else if (packId === 'box') {
      /* у коробки лента идёт по стенке: пояс четырёхгранный, по грани, а не по кругу */
      var boxHalf = topR * 1.34;
      var wallH2 = wrapH * 0.88;
      var boxBandY = wrapH * 0.02 - wallH2 * 0.46;
      piece.add(buildRibbonBand(THREE, boxBandY, boxHalf * 1.05, headR * 0.46, ribMat, 4, true));
      bow = buildBow(THREE, ribbon, bowScale, 0, boxBandY + headR * 0.16, boxHalf * 0.76, bowGeo);
    } else {
      var bandY = ctx.bindY + wrapH * 0.05;
      var bandR = coneRadius(topR, botR, bandY, wrapH) * 1.012;
      piece.add(buildRibbonBand(THREE, bandY, bandR, headR * 0.46, ribMat, 64));
      bow = buildBow(THREE, ribbon, bowScale, 0, bandY + headR * 0.14, bandR * 0.99, bowGeo);
    }
    piece.add(bow.group);
    var tails = new THREE.Mesh(bowGeo.build(), materialFor(ribbon.main, 'ribbon'));
    tails.castShadow = true;
    piece.add(tails);

    /* ---- ставим букет по центру и подбираем кадр ---- */
    var keepRot = group ? group.rotation.y : 0;
    if (group) { group.rotation.y = 0; }            /* габарит считаем без поворота */
    piece.position.set(0, 0, 0);
    piece.updateMatrixWorld(true);
    var bbox = new THREE.Box3().setFromObject(piece);
    var minY = bbox.min.y, maxY2 = bbox.max.y;
    halfH = Math.max(0.8, (maxY2 - minY) / 2);
    halfW = Math.max(bbox.max.x, bbox.max.z, -bbox.min.x, -bbox.min.z);
    piece.position.y = -(minY + maxY2) / 2;
    groundY = minY + piece.position.y;
    if (group) { group.rotation.y = keepRot; }
    fitCamera();

    /* ---- пол и мягкая тень ---- */
    var floorSize = Math.max(4.0, halfW * 5.2);
    var floor = new THREE.Mesh(
      new THREE.PlaneGeometry(floorSize, floorSize),
      new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = groundY + 0.002;
    floor.renderOrder = 0;
    stage.add(floor);

    var blob = new THREE.Mesh(
      new THREE.PlaneGeometry(halfW * 2.1, halfW * 2.1),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: .85, depthWrite: false })
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(0, groundY + 0.006, 0);
    blob.renderOrder = 1;
    stage.add(blob);

    if (key) {
      var fit = Math.max(halfH, halfW) * 1.5;
      key.position.set(fit * 0.55, fit * 1.9 + halfH, fit * 0.95);
      var sc = key.shadow.camera;
      sc.left = -fit; sc.right = fit; sc.top = fit; sc.bottom = -fit;
      sc.near = 0.5; sc.far = fit * 7 + 8;
      sc.updateProjectionMatrix();
    }
    return { count: lay.items.length, headR: headR };
  }

  /* ============================ кадр ============================ */

  /* Дистанцию считаем от габарита букета и пропорции холста:
     букет высокий, поэтому по высоте он и упирается в кадр */
  function fitCamera() {
    if (!camera || !THREE) { return; }
    var aspect = (lastW && lastH) ? lastW / lastH : 620 / 700;
    var tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    var need = Math.max(halfH / tanV, halfW / (tanV * aspect));
    camDist = (need * 1.14) / zoom;
  }

  function render() {
    if (!running) { return; }
    if (idle && !dragging && group) { group.rotation.y += 0.0030; }
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    camera.position.set(Math.sin(yaw) * cp * camDist, sp * camDist + camDist * 0.06, Math.cos(yaw) * cp * camDist);
    camera.lookAt(0, viewTY, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(render);
  }

  function resize() {
    if (!renderer || !canvasEl) { return; }
    var rect = canvasEl.getBoundingClientRect();
    var w = Math.round(rect.width || 0);
    if (w < 60) { return; }                      /* холст ещё скрыт: размер возьмём, когда покажется */
    var h = Math.round(w * CANVAS_RATIO);
    if (w === lastW && h === lastH) { return; }
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitCamera();
  }

  function bind() {
    if (bound || !canvasEl) { return; }
    bound = true;
    canvasEl.addEventListener('pointerdown', function (e) {
      dragging = true; idle = false;
      lastX = e.clientX; lastY = e.clientY;
      try { canvasEl.setPointerCapture(e.pointerId); } catch (err) {}
    });
    canvasEl.addEventListener('pointerup', function () {
      dragging = false;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () { idle = true; }, 2200);
    });
    canvasEl.addEventListener('pointercancel', function () { dragging = false; idle = true; });
    canvasEl.addEventListener('pointermove', function (e) {
      if (!dragging) { return; }
      var dx = e.clientX - lastX;
      yaw += dx * 0.008;
      if (group) { group.rotation.y -= dx * 0.008; }
      pitch = clamp(pitch + (e.clientY - lastY) * 0.006, -0.30, 0.90);
      lastX = e.clientX; lastY = e.clientY;
    });
    canvasEl.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoom = clamp(zoom - e.deltaY * 0.0011, 0.75, 1.5);
      if (getState) { rebuild(getState()); }
    }, { passive: false });
    root.addEventListener('resize', resize);
    if (root.ResizeObserver) {
      try {
        ro = new root.ResizeObserver(function () { resize(); });
        ro.observe(canvasEl);
      } catch (err) { ro = null; }
    }
  }

  /* ============================ публично ============================ */
  var api = {
    lastError: '',

    supported: function () {
      try {
        var c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
      } catch (e) { return false; }
    },

    mount: function (canvas, stateGetter) {
      if (!canvas) { return Promise.resolve(false); }
      if (renderer) { return Promise.resolve(true); }
      canvasEl = canvas;
      getState = stateGetter;
      var ready = function (mod) {
        try {
          THREE = mod;
          renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
          renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.02;
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;

          scene = new THREE.Scene();
          camera = new THREE.PerspectiveCamera(36, 620 / 700, 0.1, 120);
          camera.position.set(0, 0.4, 5);
          scene.environment = studioEnv(THREE);
          scene.environmentIntensity = 1.05;
          var loader = new THREE.TextureLoader();
          loader.load(ENV_JPG, function (tex) {
            tex.mapping = THREE.EquirectangularReflectionMapping;
            tex.colorSpace = THREE.SRGBColorSpace;
            scene.environment = tex;
            scene.environmentIntensity = 1.25;
          }, undefined, function () {});

          key = new THREE.DirectionalLight(0xfff3e0, 2.9);
          key.castShadow = true;
          key.shadow.mapSize.set(1024, 1024);
          key.shadow.radius = 5;
          key.shadow.bias = -0.0008;
          key.shadow.normalBias = 0.022;
          key.shadow.camera.near = 0.5;
          key.shadow.camera.far = 24;
          scene.add(key);
          var fill = new THREE.DirectionalLight(0xcfe0ff, 0.75);
          fill.position.set(-3.4, 1.8, 2.6);
          scene.add(fill);
          var rim = new THREE.DirectionalLight(0xffe9cf, 0.6);
          rim.position.set(1.6, 2.2, -3.4);
          scene.add(rim);
          scene.add(new THREE.HemisphereLight(0xfff6e8, 0x6b6154, 0.35));

          group = new THREE.Group();
          scene.add(group);
          piece = new THREE.Group();
          group.add(piece);
          stage = new THREE.Group();
          group.add(stage);

          roughTex = noiseTexture(THREE);
          blobTex = blobTexture(THREE);
          floorTex = floorTexture(THREE);

          bind();
          resize();
          rebuild(getState ? getState() : { flower: 'peony', count: 15, palette: 'pudra', pack: 'craft', ribbon: 'cream' });
          running = true;
          render();
          return true;
        } catch (e) {
          api.lastError = 'ready: ' + (e && e.name) + ': ' + (e && e.message);
          return false;
        }
      };
      try {
        if (THREE) { return Promise.resolve(ready(THREE)); }
        var dyn = null;
        try { dyn = new Function('u', 'return import(u);'); } catch (e) { dyn = null; }
        if (dyn) {
          return dyn(VENDOR).then(ready).catch(function (e) {
            api.lastError = 'import: ' + (e && e.message);
            return false;
          });
        }
        api.lastError = 'import: dynamic import недоступен';
        return Promise.resolve(false);
      } catch (e) {
        api.lastError = 'mount: ' + (e && e.name) + ': ' + (e && e.message);
        return Promise.resolve(false);
      }
    },

    update: function (state, opts) {
      if (!renderer || !piece) { return false; }
      try {
        resize();
        rebuild(state);
        return true;
      } catch (e) {
        api.lastError = 'update: ' + (e && e.name) + ': ' + (e && e.message);
        return false;
      }
    },

    /* снимок для корзины: тот же букет, что на экране, только уменьшенный */
    snapshot: function (width) {
      if (!renderer || !canvasEl) { return ''; }
      try {
        renderer.render(scene, camera);
        var w = width || 480;
        var h = Math.round(w * (canvasEl.height / canvasEl.width));
        var off = document.createElement('canvas');
        off.width = w; off.height = h;
        var ctx2 = off.getContext('2d');
        ctx2.fillStyle = SNAP_BG;
        ctx2.fillRect(0, 0, w, h);
        ctx2.drawImage(canvasEl, 0, 0, w, h);
        return off.toDataURL('image/jpeg', 0.86);
      } catch (e) {
        api.lastError = 'snapshot: ' + (e && e.name) + ': ' + (e && e.message);
        return '';
      }
    },

    dispose: function () {
      running = false;
      cancelAnimationFrame(raf);
      if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }
      clearGroup(piece); clearGroup(stage);
      var k;
      for (k in geoCache) { if (geoCache[k]) { (geoCache[k].geo || geoCache[k]).dispose(); } }
      geoCache = {};
      for (k in matCache) { if (matCache[k]) { matCache[k].dispose(); } }
      matCache = {};
      liveMats = [];
      if (roughTex) { roughTex.dispose(); roughTex = null; }
      if (blobTex) { blobTex.dispose(); blobTex = null; }
      if (floorTex) { floorTex.dispose(); floorTex = null; }
      if (renderer) { renderer.dispose(); renderer = null; }
      scene = null; camera = null; group = null; piece = null; stage = null; key = null;
      bound = false;
      THREE = null;
    }
  };

  /* Проверка геометрии без браузера: включается только вручную,
     window.PION_BOUQUET3D_TEST = true до загрузки модуля. */
  if (root.PION_BOUQUET3D_TEST) {
    api._test = {
      setThree: function (mod) { THREE = mod; },
      petalGeometry: function (o) { return petalGeometry(THREE, o); },
      headGeometry: function (type, seed) { return headGeometry(type, seed); },
      headConfig: function (type) { return HEAD[type] || HEAD.peony; },
      rowsFor: rowsFor,
      layout3D: layout3D,
      vaseProfile: function (H, t, b, base) { return vaseProfile(THREE, H, t, b, base); },
      GeoBuilder: function () { return new GeoBuilder(THREE); },
      /* Полная сборка букета без рендера: сцены хватает, чтобы проверить,
         что упаковка, стебли, зелень и лента собираются и ничего не роняют. */
      rebuildWith: function (mod, deps, state) {
        THREE = mod;
        group = deps.group; piece = deps.piece; stage = deps.stage;
        camera = deps.camera; key = deps.key;
        roughTex = deps.roughTex; blobTex = deps.blobTex; floorTex = deps.floorTex;
        lastW = deps.w || 620; lastH = deps.h || 700;
        return rebuild(state);
      },
      stats: function () {
        var meshes = 0, tris = 0;
        if (piece) {
          piece.traverse(function (n) {
            if (n.isMesh) {
              meshes++;
              var g = n.geometry;
              tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
            }
          });
        }
        return { meshes: meshes, tris: Math.round(tris), camDist: camDist, halfH: halfH, halfW: halfW, groundY: groundY };
      },
      /* Ручка камеры: в обычной работе не нужна, ею рассматривают головку вблизи.
         viewTY — точка, на которую смотрит камера (0 — центр букета). */
      view: function (v) {
        if (!v) { return { yaw: yaw, pitch: pitch, zoom: zoom, viewTY: viewTY, camDist: camDist }; }
        if (typeof v.yaw === 'number') { yaw = v.yaw; }
        if (typeof v.pitch === 'number') { pitch = v.pitch; }
        if (typeof v.zoom === 'number') { zoom = v.zoom; }
        if (typeof v.viewTY === 'number') { viewTY = v.viewTY; }
        fitCamera();
        return { yaw: yaw, pitch: pitch, zoom: zoom, viewTY: viewTY, camDist: camDist };
      }
    };
  }

  root.PION_BOUQUET3D = api;
})(typeof window !== 'undefined' ? window : this);
