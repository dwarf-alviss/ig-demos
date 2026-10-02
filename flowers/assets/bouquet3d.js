/* ============================================================
   «Пион» — живой букет в 3D
   ------------------------------------------------------------
   Тот же конструктор, что и в assets/bouquet.js, но букет
   собирается настоящей геометрией и рисуется в WebGL: лепестки,
   стебли, зелень, упаковка и лента — это форма, а не картинка.

   Головка цветка — лепестковые полотна, поставленные кольцами:
   одна таблица чисел (FD) описывает и пион, и тюльпан, и ромашку,
   и подсолнух. Микс («mix») берёт вид на каждую головку отдельно.

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
     snapshot(width)         — снимок корзины: Promise с { url, revoke } (JPEG object-URL)
     dispose()               — остановить
     lastError               — что не получилось
   Состояние: { occasion, flower, count, palette, pack, ribbon, green }
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
    { id: 'bright', petal: ['#f7d784', '#e3a93c', '#bd7621'], heart: '#a8502c', leaf: '#5d8757', leaf2: '#7ea273' },
    { id: 'wine', petal: ['#c9647f', '#a13355', '#7a1731'], heart: '#6d1226', leaf: '#5b7350', leaf2: '#7c9269' }
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
  var COUNTS = [1, 3, 5, 9, 15, 25];

  /* ---------- состояние сцены ---------- */
  var renderer = null, scene = null, camera = null, group = null, piece = null, stage = null;
  var canvasEl = null, getState = null, raf = 0, key = null;
  var yaw = 0, pitch = 0.20, zoom = 1, dragging = false, lastX = 0, lastY = 0;

  /* Инерция вращения, как в присланном 3D-демо: пока тянешь — букет идёт за рукой,
     отпустил — едет по инерции и плавно возвращается к спокойному ходу (0.03 —
     доля приближения к целевому ходу за кадр). При «меньше движения» ход нулевой. */
  var IDLE_SPIN = 0.0030;
  var spinVel = IDLE_SPIN;
  var calm = false, onScreen = true;
  try { calm = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
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

  /* ============================ двигатель головки ============================
     Головка собирается из лепестковых полотен: одно полотно — это лопасть с
     лодочкой, заворотом и зубчатым или волнистым краем. Из десятков таких
     полотен, поставленных кольцами под разными углами, получается и пион, и
     ромашка, и подсолнух: разница только в числах таблицы FD.

     Геометрия сорта считается один раз и живёт в кэше — на букет уходит один
     меш на головку вместо сотни мешей на лепесток. Полотно несёт серый
     множитель в цвете вершин (край светлее, середина темнее), поэтому палитра
     сайта умножается на него и головка не выглядит плоской заливкой. */

  var HR_REF = 0.72;               /* средний радиус головы: с ним сравниваем размер вида */

  /* Кольца лепестков: [число, угол от центра, угол края, длина, ширина,
     лодочка, заворот, смещение кольца, острота кончика, светлота]. */
  var FD = {
    rose: { hr: .62, r: [
      [3, .08, .2, .32, .22, 1.5, 0, 0, 1, .45],
      [5, .35, .5, .4, .3, 1.2, 0, .03, 1, .6],
      [7, .6, .8, .48, .4, 1, .1, .06, 1, .75],
      [8, .95, 1.15, .55, .48, .75, .3, .09, 1, .9],
      [9, 1.25, 1.4, .6, .52, .6, .5, .12, 1, 1]
    ] },
    peony: { hr: .8, ruf: .05, r: [
      [4, .05, .2, .4, .4, 1.3, 0, 0, 1, .45],
      [6, .3, .5, .5, .5, 1.1, .05, .03, 1, .55],
      [8, .6, .8, .6, .58, .9, .15, .06, 1, .68],
      [10, .9, 1.1, .68, .64, .75, .3, .1, 1, .8],
      [12, 1.2, 1.35, .74, .7, .6, .45, .14, 1, .9],
      [13, 1.4, 1.5, .76, .72, .5, .6, .18, 1, 1]
    ] },
    ranunculus: { hr: .55, r: [
      [4, .05, .15, .28, .26, 1.6, 0, 0, 1, .4],
      [6, .25, .4, .32, .3, 1.4, 0, .02, 1, .5],
      [8, .5, .65, .36, .34, 1.2, .05, .04, 1, .6],
      [9, .8, .95, .4, .38, 1, .1, .06, 1, .7],
      [10, 1.05, 1.2, .44, .4, .9, .2, .08, 1, .8],
      [12, 1.3, 1.45, .48, .44, .7, .35, .1, 1, .9],
      [13, 1.45, 1.55, .5, .44, .5, .5, .12, 1, 1]
    ] },
    tulip: { hr: .5, r: [
      [3, .22, .26, .95, .56, 1.1, -.12, .03, .9, .65],
      [3, .26, .3, 1, .56, 1.1, -.08, .05, .9, 1]
    ] },
    /* эустома: мелкая голова, много узких волнистых лепестков в шахматку */
    evas: { hr: .58, ruf: .14, r: [
      [6, .2, .32, .38, .26, 1.35, 0, .01, 1.2, .5],
      [7, .45, .58, .42, .3, 1.2, .04, .03, 1.3, .62],
      [8, .68, .82, .46, .32, 1.05, .1, .05, 1.4, .76],
      [9, .92, 1.05, .5, .34, .9, .2, .07, 1.5, .9],
      [8, 1.15, 1.28, .52, .34, .75, .32, .09, 1.5, 1]
    ] },
    daisy: { hr: .85, r: [
      [16, 1.42, 1.5, .78, .17, .05, .06, .18, 1.6, .85],
      [14, 1.3, 1.4, .72, .17, .05, .05, .16, 1.6, 1]
    ] },
    sunflower: { hr: 1.25, r: [
      [24, 1.38, 1.46, .95, .22, .05, .15, .5, 1.7, .7],
      [22, 1.2, 1.32, .9, .22, .05, .2, .5, 1.7, 1]
    ] },
    lily: { hr: 1, r: [
      [3, .72, .82, 1.15, .44, .5, .6, .03, 1.4, .8],
      [3, .8, .9, 1.15, .44, .5, .9, .04, 1.4, 1]
    ] }
  };

  var MODULE_MIX = ['peony', 'rose', 'ranunculus', 'tulip', 'evas', 'daisy', 'sunflower', 'lily'];

  /* Насколько голова вида крупнее средней: подсолнух в букете и правда больше пиона */
  var SIZE = { rose: .94, peony: 1.07, ranunculus: .89, tulip: .85, evas: .93, daisy: 1.1, sunflower: 1.25, lily: 1.2 };

  /* Полотно лепестка: единица длины вверх, ширина раздувается у середины,
     кончик сужается по степени tip, лодочка выгибает лопасть по ширине,
     заворот закручивает её наружу, волнистость даёт зубчатый край. */
  function petalSheet(w, l, cup, curl, tip, ruf, s0) {
    var SU = 10, SV = 6;      /* сетка полотна: 10 по ширине, 6 по длине — хватает на зубчатый край */
    var g = new THREE.PlaneGeometry(1, 1, SU, SV);
    var p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (var i = 0; i < p.count; i++) {
      var v = p.getX(i) * 2, t = p.getY(i) + .5;
      var hw = w / 2 * (t < .55
        ? .35 + .65 * Math.sin(t / .55 * Math.PI / 2)
        : Math.pow(Math.max(0, 1 - (t - .55) / .45), .5 * tip));
      var z = -cup * .25 * w * v * v * (.3 + .7 * t) + curl * l * t * t + ruf * w * Math.sin(v * 4.5 * Math.PI) * t * t;
      p.setXYZ(i, hw * v, l * t, z);
      var s = s0 * (.62 + .38 * Math.pow(t, .6)) * (1 - .1 * v * v);
      c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = s;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.computeVertexNormals();
    return g;
  }

  function headGeometry(type, seed) {
    var key2 = 'hd|' + type;
    if (geoCache[key2]) { return geoCache[key2]; }
    var D = FD[type] || FD.peony;
    var rnd = rng(seed);
    var gb = new GeoBuilder(THREE);
    var m = new THREE.Matrix4();
    var radius = 0, i, k;
    for (i = 0; i < D.r.length; i++) {
      var r = D.r[i];
      var n = r[0], t0 = r[1], t1 = r[2], l = r[3], w = r[4];
      var cup = r[5], curl = r[6], off = r[7], tip = r[8], s0 = r[9];
      var sheet = petalSheet(w, l, cup, curl, tip, D.ruf || 0, s0);
      for (k = 0; k < n; k++) {
        var a = (k + (i % 2) * .5) / n * Math.PI * 2 + rnd() * .22;
        var tl = t0 + (t1 - t0) * rnd();
        var s = .92 + rnd() * .16;
        m.makeRotationY(a);
        m.multiply(new THREE.Matrix4().makeTranslation(0, i * .004, off));
        m.multiply(new THREE.Matrix4().makeRotationX(tl));
        m.multiply(new THREE.Matrix4().makeScale(s, s, s));
        gb.add(sheet, m);
        radius = Math.max(radius, Math.sin(Math.min(tl, 1.55)) * l * s);
      }
      sheet.dispose();
    }
    var geo = gb.build();
    var rad = Math.max(.25, radius * 1.06);
    /* нормируем на радиус 1: раскладка задаёт размер головы в мировых единицах */
    geo.scale(1 / rad, 1 / rad, 1 / rad);
    geo.computeBoundingSphere();
    geo.__keep = true;
    geoCache[key2] = { geo: geo, rad: rad };
    return geoCache[key2];
  }

  /* Середина цветка: у ромашки — выпуклая жёлтая головка, у подсолнуха — диск
     с семечками, у лилии и тюльпана — тычинки, у остальных мелкая точка. */
  function coreGeometry(type, seed) {
    var k = 'core|' + type;
    if (geoCache[k]) { return geoCache[k]; }
    var T = THREE, gb = new GeoBuilder(T), m = new T.Matrix4(), i, a;
    var kind = type === 'daisy' || type === 'sunflower' ? 'disc'
      : (type === 'lily' || type === 'tulip') ? 'stamen' : 'dot';
    if (kind === 'dot') {
      var dot = new T.SphereGeometry(.075, 12, 8);
      dot.scale(1, .8, 1);
      m.identity(); m.setPosition(0, .12, 0);
      gb.add(dot, m);
      dot.dispose();
    } else if (kind === 'disc') {
      var big = type === 'sunflower';
      var disc = new T.CylinderGeometry(big ? .48 : .2, big ? .43 : .18, big ? .1 : .08, 40);
      m.identity(); m.setPosition(0, big ? .04 : .03, 0);
      gb.add(disc, m, big ? [1, .96, .9] : [1.06, 1.02, .92]);
      disc.dispose();
    } else {
      for (i = 0; i < 6; i++) {
        a = i * 1.05;
        var fil = new T.CylinderGeometry(.012, .012, .62, 6);
        m.identity();
        m.makeRotationZ(Math.cos(a) * .26);
        m.multiply(new T.Matrix4().makeRotationX(-Math.sin(a) * .26));
        m.setPosition(Math.sin(a) * .16, .3, Math.cos(a) * .16);
        gb.add(fil, m, [.95, .93, .8]);
        fil.dispose();
        var ant = new T.SphereGeometry(.045, 8, 6);
        ant.scale(1.6, 1, 1);
        m.identity(); m.setPosition(Math.sin(a) * .3, .6, Math.cos(a) * .3);
        gb.add(ant, m, [.9, .62, .34]);
        ant.dispose();
      }
    }
    var geo = gb.build();
    geo.__keep = true;
    geoCache[k] = { geo: geo, kind: kind };
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

  /* Диск подсолнуха: семечки считаем спиралью на канве — так их видно вблизи */
  function discTexture(THREE) {
    if (matCache.__discTex) { return matCache.__discTex; }
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = '#3a2410';
    x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 420; i++) {
      var a = i * 2.39996, r = Math.sqrt(i / 420) * 118;
      x.fillStyle = (i % 3) ? '#7a4d1c' : '#c08a2c';
      x.beginPath();
      x.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 4.2 - r * .02, 0, 7);
      x.fill();
    }
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    matCache.__discTex = t;
    return t;
  }

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
    } else if (kind === 'disc') {
      /* диск подсолнуха: канва с семечками вместо гладкой заливки */
      var dt = discTexture(THREE);
      mat = new THREE.MeshPhysicalMaterial({
        color: c, map: dt, bumpMap: dt, bumpScale: 2, roughness: .82, metalness: 0,
        side: THREE.DoubleSide, envMapIntensity: .8
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
    var type = FD[state.flower] ? state.flower : 'peony';
    var greenMode = state.green || 'euc';
    var count = COUNTS.indexOf(state.count) === -1 ? 15 : state.count;
    var seed = seedOf({ flower: type, count: count, palette: palette.id, pack: packId, ribbon: ribbon.id });
    var rnd = rng(seed);
    var lay = layout3D(count);
    var headR = lay.headR;

    var i, it, kindI;
    var mixRnd = rng(seed + 977);
    var kinds = [], heads = {}, cores = {};
    for (i = 0; i < lay.items.length; i++) {
      kindI = type === 'mix' ? MODULE_MIX[Math.floor(mixRnd() * MODULE_MIX.length) % MODULE_MIX.length] : type;
      kinds.push(kindI);
      if (!heads[kindI]) {
        heads[kindI] = headGeometry(kindI, 11 + kindI.length * 7);
        cores[kindI] = coreGeometry(kindI, 3 + kindI.length * 5);
      }
    }

    /* ---- головки: лепестки одной сеткой, середина — своей ----
       Микс берёт вид на каждую головку по отдельности, поэтому головки
       собираем по списку и держим кэш по видам. */
    var petalMatBack = materialFor(palette.petal[2], 'petal');
    var petalMatMid = materialFor(palette.petal[1], 'petal');
    var petalMatLight = materialFor(palette.petal[0], 'petal');
    var heartMat = materialFor(palette.heart, 'heart');
    var discMat = materialFor(palette.heart, 'disc');

    /* ---- головки: 3.4, инстансы по умолчанию ----
       Головки группируются по (вид × цветовой слой): все бутоны слоя ложатся
       в один InstancedMesh + один на середину. На 25 бутонов вместо 50 мешей
       уходит 2 меша на слой (всего 14). Отключается флагом
       PION_BOUQUET3D_INSTANCED = false до загрузки модуля. */
    var USE_INSTANCED = true;
    try { USE_INSTANCED = root.PION_BOUQUET3D_INSTANCED !== false; } catch (e) {}

    if (USE_INSTANCED) {
      /* группируем бутоны по виду и слою цвета */
      var layers = {};
      for (i = 0; i < lay.items.length; i++) {
        it = lay.items[i];
        kindI = kinds[i];
        var lk = kindI + '|' + (it.back ? 'back' : (it.light ? 'light' : 'mid'));
        if (!layers[lk]) { layers[lk] = { kind: kindI, back: it.back, light: it.light, items: [] }; }
        layers[lk].items.push(it);
      }
      var q = new THREE.Quaternion(), qSpin = new THREE.Quaternion(), axisV = new THREE.Vector3(), m4 = new THREE.Matrix4();
      var Y_UP = new THREE.Vector3(0, 1, 0);
      for (var lk in layers) {
        var gr = layers[lk];
        var hd = heads[gr.kind], cr = cores[gr.kind];
        var mat2 = materialFor(palette.petal[gr.back ? 2 : (gr.light ? 0 : 1)], 'petal');
        var inst = new THREE.InstancedMesh(hd.geo, mat2, gr.items.length);
        for (i = 0; i < gr.items.length; i++) {
          it = gr.items[i];
          var s = it.scale * (SIZE[gr.kind] || 1);
          axisV.set(Math.sin(it.az), 0, -Math.cos(it.az)).normalize();
          /* тот же поворот, что у отдельной головки: наклон от центра × собственный спин */
          q.setFromAxisAngle(axisV, it.tilt);
          q.multiply(qSpin.setFromAxisAngle(Y_UP, it.spin));
          m4.compose(
            new THREE.Vector3(it.x, it.y, it.z), q,
            new THREE.Vector3(s / hd.rad, s / hd.rad, s / hd.rad)
          );
          inst.setMatrixAt(i, m4);
        }
        inst.instanceMatrix.needsUpdate = true;
        inst.castShadow = true;
        inst.receiveShadow = true;
        piece.add(inst);
        var crMat = cr.kind === 'disc' ? discMat : heartMat;
        var cinst = new THREE.InstancedMesh(cr.geo, crMat, gr.items.length);
        for (i = 0; i < gr.items.length; i++) {
          it = gr.items[i];
          var s2 = it.scale * (SIZE[gr.kind] || 1) / hd.rad;
          axisV.set(Math.sin(it.az), 0, -Math.cos(it.az)).normalize();
          q.setFromAxisAngle(axisV, it.tilt);
          q.multiply(qSpin.setFromAxisAngle(Y_UP, it.spin));
          m4.compose(
            new THREE.Vector3(it.x, it.y, it.z), q,
            new THREE.Vector3(s2, s2, s2)
          );
          cinst.setMatrixAt(i, m4);
        }
        cinst.instanceMatrix.needsUpdate = true;
        piece.add(cinst);
      }
    } else {

    for (i = 0; i < lay.items.length; i++) {
      it = lay.items[i];
      kindI = kinds[i];
      var hd = heads[kindI], cr = cores[kindI];
      var s = it.scale * (SIZE[kindI] || 1);
      var mat = it.back ? petalMatBack : (it.light ? petalMatLight : petalMatMid);
      var mesh = new THREE.Mesh(hd.geo, mat);
      mesh.scale.setScalar(s);
      mesh.position.set(it.x, it.y, it.z);
      mesh.rotation.set(0, it.spin, 0);
      var q = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(Math.sin(it.az), 0, -Math.cos(it.az)).normalize(), it.tilt);
      mesh.quaternion.premultiply(q);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      piece.add(mesh);
      var core = new THREE.Mesh(cr.geo, cr.kind === 'disc' ? discMat : heartMat);
      core.scale.setScalar(s / hd.rad);
      core.position.copy(mesh.position);
      core.quaternion.copy(mesh.quaternion);
      core.castShadow = false;
      piece.add(core);
    }
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
    /* ---- зелень: ветки из-под упаковки и крупные листья по краю купола ----
       «Без зелени» оставляет чистые головы, «только листья» — без веток */
    var leafGeo = petalGeometry(THREE, LEAF);
    var m = new THREE.Matrix4();
    var rimR = Math.max(ringOuter * 0.92, headR * 1.9);
    if (greenMode !== 'none') {
      for (i = 0; i < 6; i++) {
        var la = (i / 6) * Math.PI * 2 + 0.4;
        var lx = Math.cos(la) * rimR, lz = Math.sin(la) * rimR;
        var dir = [Math.cos(la), 0.62 + (rnd() - 0.5) * 0.3, Math.sin(la)];
        var ls = headR * (1.05 + rnd() * 0.3);
        placePlane(THREE, m, dir, [0, 1, 0], ls * 0.85, ls, (rnd() - 0.5) * 0.7, lx * 0.92, headR * 0.05 + (rnd() - 0.5) * 0.1, lz * 0.92);
        gb.add(leafGeo, m, i % 2 ? pale : deep);
      }
    }
    leafGeo.dispose();
    if (greenMode === 'euc') {
      var sprigCount = 3 + (count >= 15 ? 1 : 0) + (count >= 21 ? 1 : 0);
      for (i = 0; i < sprigCount; i++) {
        var sa = (i / sprigCount) * Math.PI * 2 + 0.9;
        addSprig(gb, palette, rnd, sa, headR * (1.45 + rnd() * 0.35), headR * 0.9);
      }
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
    if (root.document && root.document.hidden) { raf = requestAnimationFrame(render); return; }
    if (onScreen) { stepSpin(); }
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    camera.position.set(Math.sin(yaw) * cp * camDist, sp * camDist + camDist * 0.06, Math.cos(yaw) * cp * camDist);
    camera.lookAt(0, viewTY, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(render);
  }

  /* Шаг вращения: сдвиг угла и возврат хода к спокойному. Вынесено отдельно,
     чтобы инерцию можно было проверить без рендера. */
  function stepSpin() {
    if (!group) { return; }
    group.rotation.y += spinVel;
    if (!dragging) { spinVel += ((calm ? 0 : IDLE_SPIN) - spinVel) * 0.03; }
  }

  /* Палец: поворот за рукой, скорость броска уходит в инерцию, наклон меняет кадр */
  function dragBy(dx, dy) {
    yaw += dx * 0.008;
    spinVel = dx * 0.008;
    if (group) { group.rotation.y += dx * 0.008; }
    pitch = clamp(pitch + dy * 0.006, -0.30, 0.90);
  }

  /* Стрелки: тот же поворот, только шагом */
  function nudge(delta) {
    yaw += delta;
    if (group) { group.rotation.y += delta; }
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
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      try { canvasEl.setPointerCapture(e.pointerId); } catch (err) {}
    });
    canvasEl.addEventListener('pointerup', function () { dragging = false; });
    canvasEl.addEventListener('pointercancel', function () { dragging = false; });
    canvasEl.addEventListener('pointermove', function (e) {
      if (!dragging) { return; }
      dragBy(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY;
    });
    /* стрелки поворачивают букет, как в демо */
    canvasEl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { nudge(-0.15); }
      else if (e.key === 'ArrowRight') { nudge(0.15); }
      else { return; }
      e.preventDefault();
    });
    /* кадры считаем, только когда холст в кадре */
    if (root.IntersectionObserver) {
      try {
        new root.IntersectionObserver(function (es) {
          onScreen = !!(es[0] && es[0].isIntersecting);
        }, { rootMargin: '120px' }).observe(canvasEl);
      } catch (err) {}
    }
    canvasEl.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoom = clamp(zoom - e.deltaY * 0.0011, 0.75, 1.5);
      if (getState) { rebuild(getState()); }
    }, { passive: false });
    root.addEventListener('resize', resize);
    if (root.ResizeObserver) {
      try {
        ro = new root.ResizeObserver(function () { root.requestAnimationFrame(resize); });
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

    /* снимок для корзины: тот же букет, что на экране, только уменьшенный.
       3.5: JPEG-объект вместо base64-data-URL — картинка до 480px весит
       десятки килобайт, а не сотни, и строка корзины не упирается в 5 МБ
       localStorage. Возвращаем Promise с { url, revoke }: url кладут в img,
       revoke() можно вызвать, когда снимок больше не нужен. */
    snapshot: function (width) {
      if (!renderer || !canvasEl) { return Promise.resolve(null); }
      return new Promise(function (resolve) {
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
          /* toBlob и objectURL: файл JPEG, а не строка base64 */
          if (off.toBlob) {
            off.toBlob(function (blob) {
              if (blob && root.URL && root.URL.createObjectURL) {
                var url = root.URL.createObjectURL(blob);
                resolve({ url: url, revoke: function () { root.URL.revokeObjectURL(url); } });
              } else {
                var fallbackUrl = off.toDataURL('image/jpeg', 0.82);
                resolve(fallbackUrl ? { url: fallbackUrl, revoke: function () {} } : null);
              }
            }, 'image/jpeg', 0.82);
            return;
          }
          var url2 = off.toDataURL('image/jpeg', 0.82);
          resolve(url2 ? { url: url2, revoke: function () {} } : null);
        } catch (e) {
          api.lastError = 'snapshot: ' + (e && e.name) + ': ' + (e && e.message);
          resolve(null);
        }
      });
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
      /* Проверка вращения без рендера: инерция, бросок пальцем, стрелки, «меньше движения» */
      spin: function () { return spinVel; },
      step: function (n) { for (var i = 0; i < n; i++) { stepSpin(); } return spinVel; },
      drag: function (dx, dy) { dragBy(dx, dy); return spinVel; },
      nudge: function (d) { nudge(d); return yaw; },
      setCalm: function (v) { calm = !!v; },
      setOnScreen: function (v) { onScreen = !!v; },
      angles: function () { return { yaw: yaw, pitch: pitch, spin: spinVel, model: group ? group.rotation.y : null }; },
      petalGeometry:
 function (o) { return petalGeometry(THREE, o); },
      headGeometry: function (type, seed) { return headGeometry(type, seed); },
      headConfig: function (type) { return FD[type] || FD.peony; },
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
      /* Пульт сцены: нужен только проверке — она гасит тени и снижает
         разрешение, чтобы софтверный WebGL на слабой машине успел отрисовать кадр. */
      rig: function () {
        return { renderer: renderer, scene: scene, camera: camera, key: key, group: group, piece: piece, stage: stage };
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
