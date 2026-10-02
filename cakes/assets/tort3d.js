/* ============================================================
   «Мельница» — живой торт в 3D
   ------------------------------------------------------------
   Тот же конструктор, что и в assets/tort.js, но торт собирается
   настоящей геометрией и рисуется в WebGL: вес меняет число и
   размер ярусов, начинка — цвет коржей и прослоек на срезе,
   декор — то, что стоит сверху. Из торта вырезан кусок, рядом на
   столе лежит ломтик: тот самый разрез, что и в векторе.

   three.js лежит рядом, в assets/vendor — наружу ни одного
   запроса. Если WebGL нет, модуль молча не запускается, и на
   странице остаётся векторный разрез из tort.js.

   Публично: window.MELNICA_TORT3D
     supported()             — есть ли WebGL
     mount(canvas, getState) — поднять сцену (Promise)
     update(state, opts)     — пересобрать; state.item ('cake'|'cupcake'|
                               'macaron'|'donut') выбирает изделие, без него
                               собирается торт, как раньше; opts.only='decor'
                               пересобирает только верх торта; state.topping
                               ('berries'|'sprinkles'|'swirl'|'none') задаёт
                               верх витрины напрямую, минуя декор калькулятора
     setItem(kind)           — переключить изделие и пересобрать
     item()                  — какое изделие стоит сейчас
     items()                 — какие изделия умеет модуль
     snapshot(width)         — снимок JPEG (data-URL) для корзины
     dispose()               — остановить
     lastError               — последняя ошибка

   Витрина (капкейк, ряд макаронов, пончик) перенесена из присланного демо
   на three r150 и переписана на r180: та же геометрия, тот же
   детерминированный ГПСЧ, но материалы — PBR с clearcoat, посыпка —
   InstancedMesh, а тень и пол общие с тортом.
   ============================================================ */
(function (root) {
  'use strict';

  var THREE = null;
  /* путь считаем от самого файла модуля: динамический import в обычном скрипте
     разрешается относительно скрипта, а не страницы */
  var SELF = (document.currentScript && document.currentScript.src) || root.location.href;
  var VENDOR = new URL('vendor/three.module.min.js', SELF).href;
  var ENV_JPG = new URL('vendor/studio-env.jpg', SELF).href;

  var TAU = Math.PI * 2;

  /* ---------- числа и цвета — те же, что в tort.js ---------- */

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
    vanilla: { sponge: 0xf2dda9, sponge2: 0xe8d094, fill: 0xd1295c, cream: 0xfdf4e4, edge: 0xb8934f },
    choco: { sponge: 0x7c5334, sponge2: 0x6b4429, fill: 0xc8284a, cream: 0xf4e3cf, edge: 0x3f2415 },
    straw: { sponge: 0xf6e9cd, sponge2: 0xefdcb5, fill: 0xd13356, cream: 0xfdf6e6, edge: 0xbfa06a },
    brulee: { sponge: 0xf2d79e, sponge2: 0xe9cb88, fill: 0xa85f1c, cream: 0xfbeed6, edge: 0xbb9250 },
    blue: { sponge: 0xf0e9f7, sponge2: 0xe4dbf1, fill: 0x5b4a9a, cream: 0xf8f4fb, edge: 0x4a3f74 },
    gf: { sponge: 0xecdbba, sponge2: 0xe2cfa4, fill: 0xa97f1c, cream: 0xfaf1de, edge: 0xb59b6a }
  };

  var BERRY = [0xc02246, 0x5b2140, 0x4b4a7d, 0x8e1f2f, 0x3f3a6b];

  /* полосы на срезе: корж и начинка чередуются, сумма долей = 1 */
  var BANDS = [
    { kind: 'sponge', share: 0.26 },
    { kind: 'fill', share: 0.20 },
    { kind: 'sponge', share: 0.22 },
    { kind: 'fill', share: 0.16 },
    { kind: 'sponge', share: 0.16 }
  ];

  var WEDGE = 0.62;                 /* какой кусок вырезан из торта, радианы */
  var BOARD_LIFT = 0.05;            /* высота подставки-борта под тортом */
  var TIER_PAD = 0.04;              /* толщина подложки между ярусами */
  var FLOOR_TINT = 0xe9dcc6;        /* светлая поверхность: тёплая кухня, не ювелирная витрина */
  var SHOT_BG = '#fffcf6';          /* фон снимка для корзины — цвет карточки --surface */

  /* высота яруса: чем больше в нём килограмма, тем он выше (как в tort.js) */
  function heightFor(kg) { return 62 + 26 * Math.min(kg, 2); }
  /* масштаб: крупный торт не должен вылезать из кадра (как в tort.js) */
  function scaleFor(weight) {
    return weight >= 4 ? 11 : weight >= 3 ? 11.6 : weight >= 2 ? 12.4 : weight >= 1.5 ? 13 : 13.5;
  }
  function tiersFor(weight) { return TIERS[weight] || TIERS[2]; }
  function looks(flavorId) { return LOOKS[flavorId] || LOOKS.vanilla; }

  function weightOf(state) { return Number(state && state.weight) || 2; }
  function flavorIdOf(state) {
    return (state && state.flavor && state.flavor.id) || (state && state.flavorId) || 'vanilla';
  }
  function decorIdOf(state) {
    return (state && state.decor && state.decor.id) || (state && state.decorId) || 'minimal';
  }
  /* Потёки: в демо это флаг drip, у нас — то же самое, только со значением по умолчанию */
  function dripOn(state) {
    var v = (state && state.drip !== undefined) ? state.drip : (state && state.dripId);
    return v === true || v === 'drip' || v === 1 || v === '1';
  }

  /* подмешать тёплый оттенок в крем: белым по белому розетки не видно (как в tort.js) */
  function tintHex(hex, k) {
    var r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
    var tr = Math.round(r * (1 - k) + 214 * k);
    var tg = Math.round(g * (1 - k) + 176 * k);
    var tb = Math.round(b * (1 - k) + 146 * k);
    return (tr << 16) | (tg << 8) | tb;
  }

  /* ---------- состояние сцены ---------- */
  var renderer = null, scene = null, camera = null, group = null, pieceRoot = null;
  var floor = null, blob = null, mirrorGroup = null, key = null, decorRoot = null;
  var canvasEl = null, getState = null, raf = 0;
  var yaw = 0, pitch = 0.34, zoom = 1, dragging = false, lastX = 0, lastY = 0;

  /* Инерция вращения, как в присланном 3D-демо: отпустил — торт едет дальше и плавно
     возвращается к спокойному ходу (0.03 — доля приближения за кадр). */
  var IDLE_SPIN = 0.0032;
  var spinVel = IDLE_SPIN;
  var onScreen = true;
  var camDist = 5;
  var shadowTex = null, sliceTex = null, printTex = null, noiseTex = null;
  var topTier = null, lookNow = LOOKS.vanilla, builtKey = '', lastState = null;
  var bound = false, running = false, lastW = 0, lastH = 0;
  var calm = false;                 /* «меньше движения»: торт не крутится сам */
  try { calm = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
  /* кадр: pts — пары (высота, радиус) по вершинам торта, rh/top/bot — те же
     габариты покрупнее, для кадра теневой карты */
  var FRAME = { pts: [[-0.9, 1.4], [0.9, 1.4]], rh: 1.4, top: 0.9, bot: 0.9 };

  /* ---------- текстуры ---------- */

  /* мягкая контактная тень под тортом */
  function blobTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(128, 128, 6, 128, 128, 124);
    g.addColorStop(0, 'rgba(0,0,0,.72)');
    g.addColorStop(.5, 'rgba(0,0,0,.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  /* срез яруса: те же пять полос, что и в векторе, плюс поры мякиша */
  function bandTexture(look) {
    var c = document.createElement('canvas');
    c.width = 96; c.height = 512;
    var x = c.getContext('2d');
    var y = 0, i;
    for (i = 0; i < BANDS.length; i++) {
      var b = BANDS[i];
      var bh = 512 * b.share;
      var col = b.kind === 'fill' ? look.fill : (i % 2 === 0 ? look.sponge : look.sponge2);
      x.fillStyle = '#' + new THREE.Color(col).getHexString();
      x.fillRect(0, y, 96, bh + 1);
      /* тонкая тень под полосой: срез читается даже в миниатюре */
      x.fillStyle = 'rgba(42,21,12,.30)';
      x.fillRect(0, y + bh - 1.4, 96, 1.6);
      y += bh;
    }
    x.fillStyle = 'rgba(42,21,12,.09)';
    for (i = 0; i < 110; i++) {
      x.beginPath();
      x.arc(((i * 37) % 92) + 2, ((i * 71) % 506) + 3, 1 + (i % 3) * 0.5, 0, TAU);
      x.fill();
    }
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  /* съедобная печать: сахарная бумага с картинкой, как в tort.js */
  function printTexture() {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 400;
    var x = c.getContext('2d');
    var sky = x.createLinearGradient(0, 0, 0, 400);
    sky.addColorStop(0, '#eaf4fc');
    sky.addColorStop(1, '#bcd8ec');
    x.fillStyle = sky;
    x.fillRect(0, 0, 512, 400);
    x.fillStyle = '#f6d774';
    x.beginPath(); x.arc(384, 116, 46, 0, TAU); x.fill();
    x.fillStyle = '#8fbf7c';
    x.beginPath();
    x.moveTo(0, 400); x.lineTo(0, 300);
    x.quadraticCurveTo(140, 214, 268, 300);
    x.quadraticCurveTo(400, 374, 512, 292);
    x.lineTo(512, 400); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.92)';
    x.lineWidth = 14;
    x.strokeRect(7, 7, 498, 386);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  /* карта окружения: своя тёплая кухня, пока не подгрузилась HDRI.
     Света много: светлая поверхность снизу и мягкие софтбоксы сверху и по бокам */
  function studioEnv() {
    var env = new THREE.Scene();
    var dome = new THREE.Mesh(
      new THREE.SphereGeometry(16, 32, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          top: { value: new THREE.Color(0xfff7ea) },
          mid: { value: new THREE.Color(0xe4d3ba) },
          bot: { value: new THREE.Color(0x9c8a70) }
        },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;' +
          'void main(){ float h = normalize(vP).y;' +
          ' vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.62)) : mix(mid, bot, pow(-h, 0.55));' +
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
    soft(12, 8, 0, 8, 0.4, Math.PI / 2, 0, 6.2);
    soft(5, 7, -6.6, 2.4, 2.6, 0, Math.PI / 2.1, 3.6);
    soft(4, 6, 6.6, 1.8, -1.6, 0, -Math.PI / 2.1, 2.4);
    soft(6, 3, 0, 1.6, -7.2, 0, 0, 1.8);
    soft(7, 4, 0, -0.4, 7.2, 0, Math.PI, 0.7);
    var pmrem = new THREE.PMREMGenerator(renderer);
    var tex = pmrem.fromScene(env, 0.02).texture;
    pmrem.dispose();
    return tex;
  }

  /* ---------- материалы ---------- */

  function creamMaterial(look) {
    return new THREE.MeshPhysicalMaterial({
      color: look.cream, metalness: 0, roughness: .5,
      clearcoat: .32, clearcoatRoughness: .6, sheen: .45, sheenColor: 0xfff0da,
      envMapIntensity: .85
    });
  }

  function sliceMaterials() {
    var mat = new THREE.MeshPhysicalMaterial({
      map: sliceTex, metalness: 0, roughness: .82, envMapIntensity: .45, side: THREE.DoubleSide
    });
    var inner = new THREE.MeshPhysicalMaterial({
      map: sliceTex, metalness: 0, roughness: .82, envMapIntensity: .45, side: THREE.BackSide
    });
    return { face: mat, inner: inner };
  }

  /* ---------- декор на верхнем ярусе ---------- */

  function starShape(s) {
    var sh = new THREE.Shape();
    var i, a, rr;
    for (i = 0; i < 10; i++) {
      a = -Math.PI / 2 + i * Math.PI / 5;
      rr = i % 2 ? s * 0.44 : s;
      if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    sh.closePath();
    return sh;
  }

  function heartShape(s) {
    var sh = new THREE.Shape();
    sh.moveTo(0, -s * 0.52);
    sh.bezierCurveTo(-s * 0.92, s * 0.26, -s * 0.46, s * 0.96, 0, s * 0.44);
    sh.bezierCurveTo(s * 0.46, s * 0.96, s * 0.92, s * 0.26, 0, -s * 0.52);
    return sh;
  }

  /* кремовая розетка: ядро и три кольца лепестков — как кольца в tort.js */
  function rosette(R, mat, petalGeo) {
    var g = new THREE.Group();
    var core = new THREE.Mesh(new THREE.SphereGeometry(R * .42, 16, 12), mat);
    core.scale.set(1, .58, 1);
    core.position.y = R * .18;
    core.castShadow = true;
    g.add(core);
    var rings = [
      { n: 7, rad: R * .74, pr: R * .46, y: R * .03, tilt: .24 },
      { n: 5, rad: R * .46, pr: R * .34, y: R * .13, tilt: .44 },
      { n: 3, rad: R * .22, pr: R * .25, y: R * .2, tilt: .68 }
    ];
    rings.forEach(function (ring, ri) {
      for (var i = 0; i < ring.n; i++) {
        var a = (i / ring.n) * TAU + ri * 0.55;
        var m = new THREE.Mesh(petalGeo, mat);
        m.position.set(Math.cos(a) * ring.rad, ring.y, Math.sin(a) * ring.rad);
        m.scale.set(ring.pr, ring.pr * .52, ring.pr * .78);
        m.rotation.order = 'YXZ';
        m.rotation.set(ring.tilt, -a, 0);
        m.castShadow = true;
        g.add(m);
      }
    });
    return g;
  }

  function buildDecor(state, tier, look) {
    var g = new THREE.Group();
    var id = decorIdOf(state);
    var R = tier.r, y = tier.y, h = tier.h;
    var i, a, p;
    var choco = new THREE.MeshPhysicalMaterial({ color: 0x4a2a1d, metalness: 0, roughness: .6, clearcoat: .35, envMapIntensity: .55 });

    /* Потёки глазури из присланного демо: шапка по верху яруса, капли по кромке
       с шариком на конце. Сектор выреза оставляем свободным — иначе глазурь
       повисла бы над пустотой. */
    if (dripOn(state)) {
      var glaze = new THREE.MeshPhysicalMaterial({
        color: look.edge, metalness: 0, roughness: .16, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.1
      });
      var cap = new THREE.Mesh(
        new THREE.CylinderGeometry(R - 0.004, R - 0.004, 0.03, 72, 1, false, WEDGE / 2, TAU - WEDGE),
        glaze
      );
      cap.position.y = y + 0.008;
      cap.castShadow = true;
      g.add(cap);
      var drops = Math.max(10, Math.round(R * 16));
      for (i = 0; i < drops; i++) {
        a = (i + .5) / drops * TAU;
        /* угол выреза: от -WEDGE/2 до +WEDGE/2 — там глазури нет */
        var rel = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(rel) < WEDGE * 0.62) { continue; }
        /* капля не длиннее стенки яруса — иначе глазурь повисла бы в воздухе */
        var L = Math.min(0.045 + ((i * 7) % 5) / 5 * 0.16 * (0.4 + R), h * 0.6);
        var dr = new THREE.Mesh(new THREE.CapsuleGeometry(0.03 + R * 0.012, L, 4, 10), glaze);
        dr.position.set(Math.sin(a) * (R - 0.012), y - L / 2 + 0.004, Math.cos(a) * (R - 0.012));
        dr.castShadow = true;
        g.add(dr);
        var tip = new THREE.Mesh(new THREE.SphereGeometry(0.032 + R * 0.014, 10, 8), glaze);
        tip.position.set(dr.position.x, y - L - 0.004, dr.position.z);
        tip.scale.y = 1.2;
        tip.castShadow = true;
        g.add(tip);
      }
    }

    if (id === 'roses') {
      var roseMat = new THREE.MeshPhysicalMaterial({
        color: tintHex(look.cream, .16), metalness: 0, roughness: .46,
        clearcoat: .38, clearcoatRoughness: .5, sheen: .5, sheenColor: 0xfff0da, envMapIntensity: .8
      });
      var petalGeo = new THREE.SphereGeometry(1, 12, 8);
      var n = 5;
      for (i = 0; i < n; i++) {
        p = (i + .5) / n;
        a = TAU * p;
        var ro = rosette(R * (0.23 + Math.sin(i * 1.7) * 0.01), roseMat, petalGeo);
        ro.position.set(Math.sin(a) * R * 0.6, y + R * 0.01, Math.cos(a) * R * 0.6);
        g.add(ro);
      }
      /* две розы на боку яруса: стоят на самой поверхности и смотрят наружу */
      [[-0.95, .44], [-1.35, .72]].forEach(function (sd, k) {
        var a2 = sd[0];
        var nx = Math.sin(a2), nz = Math.cos(a2);
        var pivot = new THREE.Group();
        pivot.position.set(nx * R * 0.99, tier.y0 + h * sd[1], nz * R * 0.99);
        pivot.lookAt(pivot.position.x + nx, pivot.position.y, pivot.position.z + nz);
        var side = rosette(R * (k ? 0.16 : 0.18), roseMat, petalGeo);
        side.rotation.x = Math.PI / 2;
        side.position.z = R * 0.06;
        pivot.add(side);
        g.add(pivot);
      });

    } else if (id === 'berries') {
      var berryGeo = new THREE.SphereGeometry(1, 16, 12);
      var berryMats = BERRY.map(function (c) {
        return new THREE.MeshPhysicalMaterial({ color: c, metalness: 0, roughness: .3, clearcoat: .8, clearcoatRoughness: .18, envMapIntensity: .9 });
      });
      var bn = 9;
      for (i = 0; i < bn; i++) {
        p = (i + .5) / bn;
        a = TAU * p;
        var rr = R * (0.28 + (i % 3) * 0.15);
        var bR = R * (0.115 + ((i * 7) % 3) * 0.014);
        var berry = new THREE.Mesh(berryGeo, berryMats[i % berryMats.length]);
        berry.position.set(Math.sin(a) * rr, y + bR, Math.cos(a) * rr);
        berry.scale.setScalar(bR);
        berry.castShadow = true;
        g.add(berry);
      }
      /* плитки шоколада стоят на торце, как в векторе */
      [[-0.6, -0.18, 0.42], [0.62, 0.06, 0.5], [0.08, -0.66, 0.36]].forEach(function (sd, k) {
        var w = R * 0.46, sh = sd[2] * R * 0.72;
        var shard = new THREE.Mesh(new THREE.BoxGeometry(w, sh, 0.022), choco);
        shard.position.set(R * sd[0], y + sh * 0.5 - 0.005, R * sd[1]);
        shard.rotation.set(0.16 * (k - 1), k * 0.7, 0.2 * (k ? 1 : -1));
        shard.castShadow = true;
        g.add(shard);
      });

    } else if (id === 'print') {
      /* печать обёрнута вокруг бока верхнего яруса: она и правда на бумаге */
      var pw = 0.95, pa = 2.3;
      var print = new THREE.Mesh(
        new THREE.CylinderGeometry(R + 0.007, R + 0.007, h * 0.6, 44, 1, true, pa - pw / 2, pw),
        new THREE.MeshPhysicalMaterial({ map: printTex, metalness: 0, roughness: .55, clearcoat: .3, envMapIntensity: .6 })
      );
      print.position.y = tier.y0 + h * 0.46;
      g.add(print);

    } else if (id === 'figures') {
      var pink = new THREE.MeshPhysicalMaterial({ color: 0xf3c6d6, metalness: 0, roughness: .5, clearcoat: .3, envMapIntensity: .75 });
      var blue = new THREE.MeshPhysicalMaterial({ color: 0xcfe0f5, metalness: 0, roughness: .5, clearcoat: .3, envMapIntensity: .75 });
      var dough = new THREE.MeshPhysicalMaterial({ color: 0xf5e0bd, metalness: 0, roughness: .58, clearcoat: .25, envMapIntensity: .65 });
      var dark = new THREE.MeshPhysicalMaterial({ color: 0x6b5140, metalness: 0, roughness: .5 });
      var fs = Math.min(R * 0.34, 0.24);
      var star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(fs), { depth: fs * 0.22, bevelEnabled: false, curveSegments: 4 }), pink);
      star.rotation.x = -Math.PI / 2;
      star.position.set(-R * 0.44, y, R * 0.16);
      star.castShadow = true;
      g.add(star);
      var heart = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(fs * 0.9), { depth: fs * 0.2, bevelEnabled: false, curveSegments: 6 }), blue);
      heart.rotation.x = -Math.PI / 2;
      heart.rotation.z = 0.18;
      heart.position.set(R * 0.4, y, -R * 0.12);
      heart.castShadow = true;
      g.add(heart);
      /* голова с ушами */
      var head = new THREE.Mesh(new THREE.SphereGeometry(fs * 0.55, 20, 14), dough);
      head.position.set(0, y + fs * 0.55, R * 0.1);
      head.castShadow = true;
      g.add(head);
      [-1, 1].forEach(function (s) {
        var ear = new THREE.Mesh(new THREE.SphereGeometry(fs * 0.22, 14, 10), dough);
        ear.position.set(s * fs * 0.5, y + fs * 0.98, R * 0.1);
        ear.scale.y = 1.25;
        g.add(ear);
        var eye = new THREE.Mesh(new THREE.SphereGeometry(fs * 0.075, 10, 8), dark);
        eye.position.set(s * fs * 0.2, y + fs * 0.62, R * 0.1 + fs * 0.44);
        g.add(eye);
      });
      var smile = new THREE.Mesh(new THREE.TorusGeometry(fs * 0.19, fs * 0.035, 8, 20, Math.PI), dark);
      smile.position.set(0, y + fs * 0.5, R * 0.1 + fs * 0.46);
      smile.rotation.z = Math.PI;
      g.add(smile);

    } else {
      /* минимализм: ровный крем, надпись от руки и точки по борту */
      for (i = 0; i < 2; i++) {
        var pts = [];
        for (var k = 0; k <= 10; k++) {
          var t = k / 10;
          pts.push(new THREE.Vector3(
            (-0.5 + t) * R * 1.15,
            0,
            (i ? 0.24 : -0.16) * R + Math.sin(t * 9 + i) * R * 0.06
          ));
        }
        var tube = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, R * 0.032, 8, false),
          choco
        );
        tube.position.y = y + R * 0.034;
        tube.castShadow = true;
        g.add(tube);
      }
      var dotGeo = new THREE.SphereGeometry(R * 0.026, 10, 8);
      for (i = 0; i < 6; i++) {
        a = (i / 6) * TAU + 0.4;
        var dot = new THREE.Mesh(dotGeo, choco);
        dot.position.set(Math.sin(a) * R * 0.88, y + R * 0.022, Math.cos(a) * R * 0.88);
        g.add(dot);
      }
    }
    return g;
  }

  /* ---------- сам торт ---------- */

  function sliceReach(off, sr, w) {
    var best = 0, i, a, x, z, d;
    for (i = 0; i <= 16; i++) {
      a = -w / 2 + (w * i) / 16;
      x = off + Math.sin(a) * sr;
      z = Math.cos(a) * sr;
      d = Math.sqrt(x * x + z * z);
      if (d > best) best = d;
    }
    return best;
  }

  function buildCake(state) {
    var weight = weightOf(state);
    var look = looks(flavorIdOf(state));
    var tiers = tiersFor(weight);
    var s = scaleFor(weight);
    var g = new THREE.Group();
    var cream = creamMaterial(look);
    var boardMat = new THREE.MeshPhysicalMaterial({ color: 0xfffdf8, metalness: 0, roughness: .32, clearcoat: .5, envMapIntensity: .7 });

    if (sliceTex) { sliceTex.dispose(); sliceTex = null; }
    sliceTex = bandTexture(look);
    var sm = sliceMaterials();

    var i, maxR = 0;
    for (i = 0; i < tiers.length; i++) maxR = Math.max(maxR, tiers[i][1] / 20);

    /* подставка-борт под тортом */
    var boardR = maxR + 0.12;
    var board = new THREE.Mesh(new THREE.CylinderGeometry(boardR, boardR * 0.97, BOARD_LIFT, 72), boardMat);
    board.position.y = BOARD_LIFT / 2;
    board.receiveShadow = true;
    g.add(board);

    var y = BOARD_LIFT;
    var tops = [];

    for (i = 0; i < tiers.length; i++) {
      var kg = tiers[i][0];
      var r = tiers[i][1] / 20;
      var h = heightFor(kg) / (s * 10);
      var y0 = y, y1 = y + h;

      /* корпус яруса: крем снаружи, вырезанный кусок оставляет открытыми две стенки */
      var body = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, h, 72, 1, false, WEDGE / 2, TAU - WEDGE),
        cream
      );
      body.position.y = y0 + h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      /* изнутри выреза видно корж и прослойку — тот же срез */
      var inner = new THREE.Mesh(
        new THREE.CylinderGeometry(r - 0.004, r - 0.004, h, 72, 1, true, WEDGE / 2, TAU - WEDGE),
        sm.inner
      );
      inner.position.y = y0 + h / 2;
      g.add(inner);

      /* две плоские стенки выреза */
      [-WEDGE / 2, WEDGE / 2].forEach(function (a) {
        var face = new THREE.Mesh(new THREE.PlaneGeometry(r, h), sm.face);
        face.rotation.y = a - Math.PI / 2;
        face.position.set(Math.sin(a) * r / 2, y0 + h / 2, Math.cos(a) * r / 2);
        g.add(face);
      });

      /* бордюр из отсадки по низу яруса */
      var rim = new THREE.Mesh(new THREE.TorusGeometry(r + 0.008, 0.028, 10, 72), cream);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = y0 + 0.03;
      rim.castShadow = true;
      g.add(rim);

      tops.push({ y: y1, y0: y0, r: r, h: h, kg: kg });
      y = y1;

      if (i < tiers.length - 1) {
        var nr = tiers[i + 1][1] / 20;
        var pl = new THREE.Mesh(
          new THREE.CylinderGeometry(nr + 0.09, nr + 0.09, TIER_PAD, 64, 1, false, WEDGE / 2, TAU - WEDGE),
          boardMat
        );
        pl.position.y = y + TIER_PAD / 2;
        pl.castShadow = true;
        g.add(pl);
        y += TIER_PAD;
      }
    }

    var topY = y;

    /* ломтик: тот же вырезанный кусок, только сдвинут на стол рядом с тортом */
    var sr = tiers[0][1] / 20;
    var sh = heightFor(tiers[0][0]) / (s * 10);
    var off = boardR + 0.05;
    var slice = new THREE.Group();
    var sw = new THREE.Mesh(new THREE.CylinderGeometry(sr, sr, sh, 48, 1, false, -WEDGE / 2, WEDGE), cream);
    sw.position.y = sh / 2;
    sw.castShadow = true;
    slice.add(sw);
    [-WEDGE / 2, WEDGE / 2].forEach(function (a) {
      var face = new THREE.Mesh(new THREE.PlaneGeometry(sr, sh), sm.face);
      face.rotation.y = a - Math.PI / 2;
      face.position.set(Math.sin(a) * sr / 2, sh / 2, Math.cos(a) * sr / 2);
      slice.add(face);
    });
    /* ломтик лежит на столе срезом вверх: так видно слои, а не торец */
    slice.rotation.set(Math.PI / 2 - 0.22, 0, 0);
    slice.position.y = sr * 0.98;
    var sliceWrap = new THREE.Group();
    sliceWrap.position.set(off + sh * 0.5, 0, 0);
    sliceWrap.rotation.y = -Math.PI / 2 - 0.2;
    sliceWrap.add(slice);
    g.add(sliceWrap);

    /* декор — на верхнем ярусе */
    topTier = tops[tops.length - 1];
    decorRoot = buildDecor(state, topTier, look);
    g.add(decorRoot);

    return { group: g, reach: Math.max(sliceReach(off, sr, WEDGE), boardR) };
  }

  /* ============================================================
     Витрина: капкейк, ряд макаронов, пончик
     ------------------------------------------------------------
     Геометрия перенесена из присланного демо (three r150, глобальный THREE)
     и переписана на ES5 и на r180: те же профили lathe, та же спираль крема,
     тот же детерминированный ГПСЧ, та же посыпка через InstancedMesh.
     Вкус берём из начинок калькулятора, поэтому витрина и торт говорят
     на одном языке. Всё, что стоит на столе, стоит на y=0: пол, мягкая тень
     и отражение у витрины те же, что у торта.
     ============================================================ */

  var ITEMS = ['cake', 'cupcake', 'macaron', 'donut'];
  var itemNow = 'cake';                 /* без state.item работает по-старому — торт */

  function itemOf(state) {
    var k = (state && state.item) || itemNow;
    return ITEMS.indexOf(k) > -1 ? k : 'cake';
  }

  /* детерминированный ГПСЧ из демо: посыпка и лепестки не должны дрожать
     от каждого пересбора */
  function rn(seed) {
    var s = seed;
    return function () {
      s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* вкус витрины: крем, глазурь (ганаш) и тесто — цвета из демо,
     привязанные к пяти начинкам калькулятора */
  var PASTRY = {
    vanilla: { cream: 0xf6ead0, glaze: 0xe0b878, dough: 0xd39a56 },
    choco: { cream: 0x7a4a36, glaze: 0x4a2a1c, dough: 0x8a5a3a },
    straw: { cream: 0xf3b9c4, glaze: 0xc23a5a, dough: 0xd39a56 },
    brulee: { cream: 0xd9a35f, glaze: 0x9b5b23, dough: 0xd39a56 },
    blue: { cream: 0xb9a5dc, glaze: 0x5b4a9a, dough: 0xcfb083 },
    gf: { cream: 0xb8cf8c, glaze: 0x7d9a4d, dough: 0xcfb083 }
  };
  var FLAVOR_RING = ['vanilla', 'choco', 'straw', 'brulee', 'blue', 'gf'];
  function pastryOf(flavorId) { return PASTRY[flavorId] || PASTRY.vanilla; }

  /* декор калькулятора → верх витрины. state.topping задаёт верх напрямую
     ('none'|'berries'|'sprinkles'|'swirl') и минует таблицу — так витрина
     каталога показывает изделие с посыпкой, не притворяясь, что это печать.
     Розетки из крема умеет только капкейк: остальным они ни к чему */
  var TOPPING = { minimal: 'none', roses: 'swirl', berries: 'berries', print: 'sprinkles', figures: 'sprinkles' };
  function toppingOf(state, item) {
    var t = (state && state.topping) || TOPPING[decorIdOf(state)] || 'none';
    if (item === 'cupcake') return t;
    if (t === 'swirl') return 'none';
    return t;
  }

  /* шероховатость теста: канва из демо, но одна на всю сцену */
  function noiseTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    var rnd = rn(4);
    x.fillStyle = '#888';
    x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 900; i++) {
      var v = 90 + (rnd() * 110 | 0);
      x.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',.5)';
      x.beginPath();
      x.arc(rnd() * 256, rnd() * 256, 1 + rnd() * 4, 0, TAU);
      x.fill();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    return t;
  }
  /* карта шероховатости нужна и проверке, где mount() не зовут */
  function noiseTexOf() {
    if (!noiseTex) noiseTex = noiseTexture();
    return noiseTex;
  }

  function doughMaterial(p) {
    return new THREE.MeshPhysicalMaterial({
      color: p.dough, metalness: 0, roughness: .72, envMapIntensity: .5,
      bumpMap: noiseTexOf(), bumpScale: .9, side: THREE.DoubleSide
    });
  }
  function glazeMaterial(p) {
    return new THREE.MeshPhysicalMaterial({
      color: p.glaze, metalness: 0, roughness: .16, clearcoat: 1, clearcoatRoughness: .06,
      envMapIntensity: 1.05, side: THREE.DoubleSide
    });
  }
  function pastryCreamMaterial(p) {
    return new THREE.MeshPhysicalMaterial({
      color: p.cream, metalness: 0, roughness: .5, sheen: .7, sheenColor: 0xfff4e2,
      sheenRoughness: .6, clearcoat: .22, clearcoatRoughness: .5,
      bumpMap: noiseTexOf(), bumpScale: .6, envMapIntensity: .8, side: THREE.DoubleSide
    });
  }

  /* круглый корпус с мягкой фаской: профиль из демо */
  function lathe(r, h, c) {
    var p = [new THREE.Vector2(0, 0)];
    var i, a;
    for (i = 0; i <= 8; i++) {
      a = i / 8 * Math.PI / 2;
      p.push(new THREE.Vector2(r - c + Math.sin(a) * c, c - Math.cos(a) * c));
    }
    for (i = 0; i <= 8; i++) {
      a = i / 8 * Math.PI / 2;
      p.push(new THREE.Vector2(r - c + Math.cos(a) * c, h - c + Math.sin(a) * c));
    }
    p.push(new THREE.Vector2(0, h));
    return new THREE.LatheGeometry(p, 96);
  }

  /* посыпка: один InstancedMesh, цвет каждой палочки — свой (как в демо) */
  function sprinkles(pts, n, rnd) {
    var im = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(.014, .07, 3, 6),
      new THREE.MeshPhysicalMaterial({ roughness: .35, clearcoat: .6, envMapIntensity: .9 }),
      n
    );
    var o = new THREE.Object3D();
    var col = new THREE.Color();
    var C = [0xe63946, 0xf4a261, 0xffd166, 0x2a9d8f, 0x4361ee, 0xffffff, 0xf72585];
    var up = new THREE.Vector3(0, 1, 0);
    for (var i = 0; i < n; i++) {
      var p = pts(i);
      o.position.copy(p.p);
      o.quaternion.setFromUnitVectors(up, p.n.clone().add(new THREE.Vector3(rnd() - .5, rnd() - .5, rnd() - .5).multiplyScalar(1.6)).normalize());
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
      im.setColorAt(i, col.setHex(C[i % 7]));
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = true;
    return im;
  }

  /* ягоды на верх: смородина и голубика, как в демо, только без листика */
  function berryTopping(g, cx, cy, cz, rad, n, rnd) {
    var geo = new THREE.SphereGeometry(1, 18, 12);
    var red = new THREE.MeshPhysicalMaterial({ color: 0xb3122f, metalness: 0, roughness: .3, clearcoat: 1, clearcoatRoughness: .2, envMapIntensity: .9 });
    var blue = new THREE.MeshPhysicalMaterial({ color: 0x2c3e91, metalness: 0, roughness: .25, clearcoat: 1, clearcoatRoughness: .2, envMapIntensity: .9 });
    for (var i = 0; i < n; i++) {
      var a = i * 2.4;
      var r = i ? Math.sqrt(i / n) * rad : 0;
      var s = .1 + rnd() * .03;
      var b = new THREE.Mesh(geo, i % 3 ? red : blue);
      b.scale.setScalar(s);
      b.position.set(cx + Math.cos(a) * r, cy + s + (1 - (rad ? r / rad : 0)) * .06, cz + Math.sin(a) * r);
      b.castShadow = true;
      g.add(b);
    }
  }

  /* изделие ставим на стол: пол, тень и отражение считают от y=0.
     Посыпка (InstancedMesh) в расчёт не идёт: её сырые вершины лежат вокруг
     нуля, а не там, где стоят сами палочки, — из-за них изделие всплывало бы
     над столом на высоту палочки */
  function groundPiece(piece) {
    piece.updateWorldMatrix(false, true);
    var v = new THREE.Vector3();
    var minY = Infinity;
    piece.traverse(function (n) {
      if (!n.isMesh || n.isInstancedMesh || !n.geometry || !n.geometry.attributes.position) return;
      var pos = n.geometry.attributes.position;
      for (var k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(n.matrixWorld);
        if (v.y < minY) minY = v.y;
      }
    });
    if (minY !== Infinity) piece.position.y = -minY;
    return minY;
  }

  function buildCupcake(state, p) {
    var g = new THREE.Group();
    var rnd = rn(21);
    var cr = pastryCreamMaterial(p);
    var i, a, t, f;

    /* бумажная гильза с рубчиком */
    var wg = new THREE.CylinderGeometry(.95, .68, .85, 48, 8, true);
    var pos = wg.attributes.position;
    for (i = 0; i < pos.count; i++) {
      a = Math.atan2(pos.getZ(i), pos.getX(i));
      f = 1 + .045 * Math.sin(a * 14);
      pos.setX(i, pos.getX(i) * f);
      pos.setZ(i, pos.getZ(i) * f);
    }
    wg.computeVertexNormals();
    var cup = new THREE.Mesh(wg, new THREE.MeshPhysicalMaterial({
      color: 0xf0d6d0, metalness: 0, roughness: .7, envMapIntensity: .4,
      bumpMap: noiseTexOf(), bumpScale: .8, side: THREE.DoubleSide
    }));
    cup.position.y = .43;
    cup.castShadow = cup.receiveShadow = true;
    g.add(cup);

    /* бисквит шапкой поверх гильзы */
    var sponge = new THREE.Mesh(new THREE.SphereGeometry(.92, 40, 20, 0, TAU, 0, Math.PI / 2.6), doughMaterial(p));
    sponge.position.y = .66;
    sponge.scale.y = .55;
    sponge.castShadow = sponge.receiveShadow = true;
    g.add(sponge);

    /* крем: спираль от края к центру — трубка из демо */
    var pts = [];
    for (i = 0; i <= 90; i++) {
      t = i / 90;
      a = t * TAU * 3.2;
      var rr = .85 * Math.pow(1 - t, .85) + .03;
      pts.push(new THREE.Vector3(Math.cos(a) * rr, .9 + t * .85, Math.sin(a) * rr));
    }
    var swirl = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, .24, 20), cr);
    swirl.castShadow = swirl.receiveShadow = true;
    g.add(swirl);
    var tip = new THREE.Mesh(new THREE.ConeGeometry(.12, .3, 20), cr);
    tip.position.set(pts[90].x, 1.85, pts[90].z);
    tip.castShadow = true;
    g.add(tip);

    var top = toppingOf(state, 'cupcake');
    if (top === 'berries') {
      berryTopping(g, 0, 1.9, 0, .05, 1, rnd);
    } else if (top === 'sprinkles') {
      g.add(sprinkles(function () {
        var tt = .05 + rnd() * .85;
        var P = pts[Math.floor(tt * 90)];
        var n = new THREE.Vector3(P.x, .3, P.z).normalize();
        return { p: P.clone().add(n.clone().multiplyScalar(.24)), n: n };
      }, 70, rnd));
    } else if (top === 'swirl') {
      /* три мелких розетки поверх спирали — тот же крем, что в калькуляторе */
      var petalGeo = new THREE.SphereGeometry(1, 12, 8);
      for (i = 0; i < 3; i++) {
        a = i / 3 * TAU + .4;
        var ro = rosette(.16, cr, petalGeo);
        ro.position.set(Math.cos(a) * .22, 1.86, Math.sin(a) * .22);
        g.add(ro);
      }
    }
    return { group: g };
  }

  /* профиль верхней половинки макарона: по нему считаем, куда сыпать посыпку */
  var MAC_PROF = [[0, .3], [.5, .29], [.8, .23], [.95, .12], [1, .04]];
  function macTop(r) {
    for (var i = 1; i < MAC_PROF.length; i++) {
      if (r <= MAC_PROF[i][0]) {
        var a = MAC_PROF[i - 1], b = MAC_PROF[i];
        return a[1] + (b[1] - a[1]) * (r - a[0]) / (b[0] - a[0]);
      }
    }
    return MAC_PROF[MAC_PROF.length - 1][1];
  }

  function buildMacaron(state, p) {
    var g = new THREE.Group();
    var prof = [[0, .3], [.5, .29], [.8, .23], [.95, .12], [1, .04], [1, 0], [0, 0]].map(function (a) {
      return new THREE.Vector2(a[0], a[1]);
    });
    var lg = new THREE.LatheGeometry(prof, 72);
    var idx = FLAVOR_RING.indexOf(flavorIdOf(state));
    if (idx < 0) idx = 0;
    var middle = null;
    for (var k = 0; k < 3; k++) {
      var f = pastryOf(FLAVOR_RING[(idx + k) % FLAVOR_RING.length]);
      var sm = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(f.cream).lerp(new THREE.Color(f.glaze), .25),
        metalness: 0, roughness: .55, sheen: .5, sheenColor: 0xfff4e2, sheenRoughness: .6,
        bumpMap: noiseTexOf(), bumpScale: .6, envMapIntensity: .7
      });
      var m = new THREE.Group();
      var up = new THREE.Mesh(lg, sm);
      up.position.y = .2; up.castShadow = up.receiveShadow = true; m.add(up);
      var dn = new THREE.Mesh(lg, sm);
      dn.scale.y = -1; dn.position.y = .2; dn.castShadow = true; m.add(dn);
      [.21, .19].forEach(function (y) {
        var ft = new THREE.Mesh(new THREE.TorusGeometry(.985, .05, 10, 72), sm);
        ft.rotation.x = Math.PI / 2;
        ft.position.y = y;
        ft.scale.set(1, 1, .7);
        ft.castShadow = true;
        m.add(ft);
      });
      var fl = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .14, 64), new THREE.MeshPhysicalMaterial({
        color: f.glaze, metalness: 0, roughness: .4, envMapIntensity: .6,
        bumpMap: noiseTexOf(), bumpScale: .8
      }));
      fl.position.y = .2;
      m.add(fl);
      m.position.set((k - 1) * 2.25, .35, 0);
      m.rotation.set(k === 1 ? .35 : 0, k * .6, k === 2 ? .3 : 0);
      if (k === 1) { m.position.y = .75; middle = m; }
      g.add(m);
    }
    var top = toppingOf(state, 'macaron');
    if (top === 'sprinkles' && middle) {
      var rnd = rn(43);
      middle.add(sprinkles(function () {
        var a = rnd() * TAU, rr = Math.sqrt(rnd()) * .82;
        return { p: new THREE.Vector3(Math.cos(a) * rr, .2 + macTop(rr) + .012, Math.sin(a) * rr), n: new THREE.Vector3(0, 1, 0) };
      }, 60, rnd));
    } else if (top === 'berries' && middle) {
      /* ягоду кладём на средний макарон: его локальные координаты — свои */
      berryTopping(middle, 0, .5, 0, .04, 1, rn(44));
    }
    return { group: g };
  }

  function buildDonut(state, p) {
    var g = new THREE.Group();
    var dg = new THREE.Group();
    var rnd = rn(31);
    var Rr = .95, rr = .42;
    var i, a;

    /* тесто: профиль бублика вращением */
    var pd = [];
    for (i = 0; i <= 40; i++) {
      a = i / 40 * TAU;
      pd.push(new THREE.Vector2(Rr + Math.cos(a) * rr, rr + Math.sin(a) * rr * .95));
    }
    var dough = new THREE.Mesh(new THREE.LatheGeometry(pd, 96), doughMaterial(p));
    dough.castShadow = dough.receiveShadow = true;
    dg.add(dough);

    /* глазурь: та же окружность, но чуть больше и не по всему кольцу */
    var pz = [];
    for (i = 0; i <= 30; i++) {
      a = -.3 + i / 30 * (Math.PI + .6);
      pz.push(new THREE.Vector2(Rr + Math.cos(a) * (rr + .03), rr + Math.sin(a) * (rr + .03) * .95));
    }
    var glaze = new THREE.Mesh(new THREE.LatheGeometry(pz, 96), glazeMaterial(p));
    glaze.castShadow = true;
    dg.add(glaze);

    var top = toppingOf(state, 'donut');
    if (top === 'sprinkles') {
      dg.add(sprinkles(function () {
        var a2 = rnd() * TAU, b = .15 + rnd() * (Math.PI - .3), rr2 = rr + .045;
        return {
          p: new THREE.Vector3((Rr + Math.cos(b) * rr2) * Math.cos(a2), rr + Math.sin(b) * rr2 * .95, (Rr + Math.cos(b) * rr2) * Math.sin(a2)),
          n: new THREE.Vector3(Math.cos(b) * Math.cos(a2), Math.sin(b), Math.cos(b) * Math.sin(a2))
        };
      }, 260, rnd));
    } else if (top === 'berries') {
      for (i = 0; i < 3; i++) {
        a = i / 3 * TAU + .5;
        berryTopping(dg, Math.cos(a) * Rr, rr * 2, Math.sin(a) * Rr, .04, 1, rnd);
      }
    }
    dg.rotation.x = -.5;
    g.add(dg);
    return { group: g };
  }

  /* ---------- сборка ---------- */

  /* Кадр считаем по самим вершинам торта, а не по коробке: коробка врут
     в диагонали и торт получается вдвое мельче, чем может быть.
     Из всех вершин оставляем пары (высота, радиус от оси) — по самой широкой
     и самой узкой вершине в каждой полосе по высоте. Этого хватает, чтобы
     посчитать кадр точно и для любого наклона камеры */
  var BINS = 24;

  function frameOf(obj) {
    obj.updateWorldMatrix(false, true);
    var v = new THREE.Vector3();
    var ys = [], rs = [], i, k, r;
    obj.traverse(function (n) {
      if (!n.isMesh || n.isInstancedMesh || !n.geometry) return;
      var pos = n.geometry.attributes.position;
      if (!pos) return;
      for (k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(n.matrixWorld);
        ys.push(v.y);
        rs.push(Math.sqrt(v.x * v.x + v.z * v.z));
      }
    });
    if (!ys.length) return null;
    var yMin = ys[0], yMax = ys[0], maxR = rs[0];
    for (i = 0; i < ys.length; i++) {
      if (ys[i] < yMin) yMin = ys[i];
      if (ys[i] > yMax) yMax = ys[i];
      if (rs[i] > maxR) maxR = rs[i];
    }
    var yc = (yMin + yMax) / 2;
    var span = Math.max(yMax - yMin, 1e-6);
    var wide = new Array(BINS), narrow = new Array(BINS);
    for (i = 0; i < ys.length; i++) {
      var b = Math.min(BINS - 1, Math.floor((ys[i] - yMin) / span * BINS));
      if (!wide[b] || rs[i] > wide[b][1]) wide[b] = [ys[i] - yc, rs[i]];
      if (!narrow[b] || rs[i] < narrow[b][1]) narrow[b] = [ys[i] - yc, rs[i]];
    }
    var pts = [];
    for (i = 0; i < BINS; i++) {
      if (wide[i]) pts.push(wide[i]);
      if (narrow[i]) pts.push(narrow[i]);
    }
    return { pts: pts, maxR: maxR, yc: yc, top: yMax - yc, bot: yc - yMin };
  }

  function rebuild(state) {
    if (!THREE || !group) return;
    lastState = state;
    if (pieceRoot) { group.remove(pieceRoot); disposeTree(pieceRoot); pieceRoot = null; }
    if (mirrorGroup) { group.remove(mirrorGroup); disposeTree(mirrorGroup); mirrorGroup = null; }
    if (floor) { group.remove(floor); floor.geometry.dispose(); floor.material.dispose(); floor = null; }
    if (blob) { group.remove(blob); blob.geometry.dispose(); blob = null; }
    decorRoot = null;
    topTier = null;

    var kind = itemOf(state);
    lookNow = looks(flavorIdOf(state));

    var built;
    if (kind === 'cake') {
      builtKey = weightOf(state) + '|' + flavorIdOf(state);
      built = buildCake(state);
    } else {
      /* витрина: у каждого изделия свой верх, дешёвый путь «только декор»
         для них не работает — пересобираем целиком */
      builtKey = kind + '|' + flavorIdOf(state) + '|' + decorIdOf(state);
      built = kind === 'cupcake' ? buildCupcake(state, pastryOf(flavorIdOf(state)))
        : kind === 'macaron' ? buildMacaron(state, pastryOf(flavorIdOf(state)))
          : buildDonut(state, pastryOf(flavorIdOf(state)));
      groundPiece(built.group);
    }
    pieceRoot = built.group;
    /* габариты снимаем ДО того, как торт попал в группу: иначе в них
       подмешается прошлый сдвиг группы и кадр уедет с каждым пересбором */
    var fr = frameOf(pieceRoot);
    group.add(pieceRoot);
    var reach = built.reach || (fr && fr.maxR) || 1;

    /* пол: одна большая плоскость — её края всегда за кадром.
       Пол полупрозрачный, иначе он спрячет отражение, которое лежит под ним */
    var floorR = Math.max(reach * 3.5, 40);
    floor = new THREE.Mesh(
      new THREE.PlaneGeometry(floorR * 2, floorR * 2),
      new THREE.MeshPhysicalMaterial({
        color: FLOOR_TINT, metalness: .4, roughness: .48, envMapIntensity: .9,
        transparent: true, opacity: .88, depthWrite: false
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.004;
    floor.renderOrder = -1;
    floor.receiveShadow = true;
    group.add(floor);

    /* мягкая контактная тень: торт не висит в воздухе */
    blob = new THREE.Mesh(
      new THREE.PlaneGeometry(reach * 3, reach * 3),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: .55, depthWrite: false })
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.0005;
    blob.renderOrder = 2;
    group.add(blob);

    /* зеркальное отражение: копия торта вниз от поверхности стола */
    mirrorGroup = new THREE.Group();
    mirrorGroup.scale.set(1, -1, 1);
    mirrorGroup.renderOrder = 1;
    var copy = pieceRoot.clone(true);
    copy.traverse(function (n) {
      if (n.isMesh) {
        n.material = n.material.clone();
        n.material.transparent = true;
        n.material.opacity = .16;
        n.material.depthWrite = false;
        n.material.side = THREE.DoubleSide;   /* отражение вывернуто наизнанку */
        n.castShadow = false;
        n.receiveShadow = false;
      }
    });
    mirrorGroup.add(copy);
    group.add(mirrorGroup);

    /* кадр: настоящие габариты торта вместе с декором и ломтиком */
    if (fr) {
      FRAME.pts = fr.pts;
      FRAME.rh = fr.maxR;
      FRAME.top = Math.max(fr.top, 0.4);
      FRAME.bot = Math.max(fr.bot, 0.4);
      group.position.y = -fr.yc;      /* центр вращения — середина торта */
      applyCamera();
    }

    if (key) {
      var fit = Math.max(FRAME.rh, FRAME.top, FRAME.bot) * 1.8;
      key.position.set(fit * 0.55, fit * 1.9, fit * 1.1);
      var sc = key.shadow.camera;
      sc.left = -fit; sc.right = fit; sc.top = fit; sc.bottom = -fit;
      sc.updateProjectionMatrix();
    }
    return built;
  }

  /* дешёвый путь: меняется только верх — тело торта не пересобираем */
  function repaintDecor(state) {
    if (!decorRoot || !decorRoot.parent || !topTier) return false;
    var body = weightOf(state) + '|' + flavorIdOf(state);
    if (body !== builtKey) return false;
    var host = decorRoot.parent;
    host.remove(decorRoot);
    disposeTree(decorRoot);
    decorRoot = buildDecor(state, topTier, lookNow);
    host.add(decorRoot);
    return true;
  }

  function disposeTree(obj) {
    obj.traverse(function (n) {
      if (n.isMesh) {
        if (n.geometry) n.geometry.dispose();
        if (n.material) {
          var map = n.material.map;
          /* общие текстуры (тень и печать) живут дольше одного пересбора */
          if (map && map.isCanvasTexture && map !== shadowTex && map !== printTex) map.dispose();
          n.material.dispose();
        }
      }
    });
  }

  /* ---------- кадр ---------- */

  function applyCamera() {
    var tanY = Math.tan((camera.fov * Math.PI / 180) / 2);
    var aspect = camera.aspect || 1.22;
    var tanX = tanY * aspect;
    var sp = Math.sin(pitch), cp = Math.cos(pitch);
    var C = Math.sqrt(1 / (tanX * tanX) + cp * cp);
    /* торт крутится вокруг вертикальной оси, поэтому для каждой точки габарита
       берём худший азимут: точка может быть и широкой, и ближней — перспектива
       раздувает её сильнее, чем следует из одного радиуса */
    var need = 0.4, pts = FRAME.pts, i, y, r, f;
    for (i = 0; i < pts.length; i++) {
      y = pts[i][0]; r = pts[i][1];
      f = sp * y + C * r;
      if (f > need) need = f;
      f = Math.abs(cp * y - sp * r) / tanY + sp * y + cp * r;
      if (f > need) need = f;
      f = Math.abs(cp * y + sp * r) / tanY + sp * y - cp * r;
      if (f > need) need = f;
    }
    camDist = need * 1.02 / zoom;
  }

  function render() {
    if (!running) return;
    if (root.document && root.document.hidden) { raf = requestAnimationFrame(render); return; }
    if (onScreen) { stepSpin(); }                                /* торт сам поворачивается на столе */
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    camera.position.set(Math.sin(yaw) * cp * camDist, sp * camDist + 0.12, Math.cos(yaw) * cp * camDist);
    camera.lookAt(0, 0, 0);
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
    group.rotation.y += dx * 0.008;
    pitch = Math.max(-0.12, Math.min(0.9, pitch + dy * 0.006));
  }

  /* Стрелки: тот же поворот, только шагом */
  function nudge(delta) {
    yaw += delta;
    group.rotation.y += delta;
  }

  function resize() {
    if (!renderer || !canvasEl) return false;
    var rect = canvasEl.getBoundingClientRect();
    var w = Math.round(rect.width);
    if (!w) return false;                                       /* холст ещё скрыт — размер возьмём позже */
    var h = Math.round(w * 0.82);
    if (w === lastW && h === lastH) return true;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    applyCamera();
    return true;
  }

  function bind() {
    if (bound || !canvasEl) return;
    bound = true;
    canvasEl.addEventListener('pointerdown', function (e) {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      try { canvasEl.setPointerCapture(e.pointerId); } catch (err) {}
    });
    canvasEl.addEventListener('pointerup', function () { dragging = false; });
    canvasEl.addEventListener('pointercancel', function () { dragging = false; });
    canvasEl.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dragBy(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY;
      applyCamera();                       /* наклон меняет кадр — держим торт целиком */
    });
    /* стрелки поворачивают торт, как в демо */
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
      } catch (e) {}
    }
    canvasEl.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoom = Math.max(0.75, Math.min(1.6, zoom - e.deltaY * 0.0011));
      applyCamera();
    }, { passive: false });
    root.addEventListener('resize', resize);
    if (root.ResizeObserver) {
      try {
        new root.ResizeObserver(function () { root.requestAnimationFrame(resize); }).observe(canvasEl);
      } catch (e) {}
    }
  }

  /* ---------- публично ---------- */
  var api = {
    supported: function () {
      try {
        var c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
      } catch (e) { return false; }
    },

    mount: function (canvas, stateGetter) {
      if (!canvas) return Promise.resolve(false);
      if (renderer) return Promise.resolve(true);
      canvasEl = canvas;
      getState = stateGetter;
      var ready = function (mod) {
        THREE = mod;
        renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
        renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.06;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(36, 1.22, 0.1, 60);
        scene.environment = studioEnv();
        scene.environmentIntensity = 1.15;
        var loader = new THREE.TextureLoader();
        loader.load(ENV_JPG, function (tex) {
          tex.mapping = THREE.EquirectangularReflectionMapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          scene.environment = tex;
          scene.environmentIntensity = 1.25;
        }, undefined, function () {});

        key = new THREE.DirectionalLight(0xfff3df, 2.7);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.radius = 6;
        key.shadow.bias = -0.0012;
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 24;
        scene.add(key);
        var fill = new THREE.DirectionalLight(0xd9e6ff, 0.5);
        fill.position.set(-3.4, 1.6, 2.6);
        scene.add(fill);
        var warm = new THREE.DirectionalLight(0xffd9a8, 0.35);
        warm.position.set(2.6, 0.6, -3.2);
        scene.add(warm);

        group = new THREE.Group();
        scene.add(group);

        shadowTex = blobTexture();
        printTex = printTexture();
        bind();
        if (!resize()) {
          renderer.setSize(520, 426, false);
          camera.aspect = 520 / 426;
          camera.updateProjectionMatrix();
        }
        rebuild(getState ? getState() : { weight: 2, flavor: { id: 'vanilla' }, decor: { id: 'minimal' } });
        running = true;
        render();
        return true;
      };
      try {
        if (THREE) return Promise.resolve(ready(THREE));
        var dyn = null;
        try { dyn = new Function('u', 'return import(u);'); } catch (e) { dyn = null; }
        if (dyn) return dyn(VENDOR).then(ready).catch(function (e) { api.lastError = 'import: ' + (e && e.message); return false; });
        return Promise.resolve(false);
      } catch (e) { api.lastError = 'mount: ' + e.name + ': ' + e.message; return Promise.resolve(false); }
    },

    /* update(state) — пересобрать целиком; state.item выбирает изделие;
       update(state, {only:'decor'}) — перебрать только верх торта, тело не трогаем */
    update: function (state, opts) {
      if (!renderer) return false;
      if (opts && opts.item) itemNow = itemOf({ item: opts.item });
      var only = opts && opts.only;
      if ((only === 'decor' || only === 'print') && itemOf(state) === 'cake' && repaintDecor(state)) return true;
      rebuild(state);
      return true;
    },

    /* витрина: переключить изделие и пересобрать тем же состоянием */
    setItem: function (kind) {
      itemNow = itemOf({ item: kind });
      /* состояние витрины держит изделие внутри себя — иначе оно перебьёт
         setItem при следующем пересборе */
      if (lastState) {
        var s = {}, k;
        for (k in lastState) { if (Object.prototype.hasOwnProperty.call(lastState, k)) s[k] = lastState[k]; }
        s.item = itemNow;
        lastState = s;
      }
      if (renderer) rebuild(lastState);
      return itemNow;
    },

    item: function () { return itemOf(lastState); },

    items: function () { return ITEMS.slice(); },

    /* снимок для корзины: тот же торт, что на экране, только уменьшенный */
    snapshot: function (width) {
      if (!renderer) return '';
      try {
        renderer.render(scene, camera);
        var w = width || 480;
        var h = Math.round(w * (canvasEl.height / canvasEl.width));
        var off = document.createElement('canvas');
        off.width = w; off.height = h;
        var ctx = off.getContext('2d');
        ctx.fillStyle = SHOT_BG;
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(canvasEl, 0, 0, w, h);
        return off.toDataURL('image/jpeg', 0.86);
      } catch (e) { api.lastError = 'snapshot: ' + e.name + ': ' + e.message; return ''; }
    },

    dispose: function () {
      running = false;
      cancelAnimationFrame(raf);
      if (renderer) { renderer.dispose(); renderer = null; }
      if (scene) { disposeTree(scene); scene = null; }
      if (noiseTex) { noiseTex.dispose(); noiseTex = null; }
      pieceRoot = decorRoot = mirrorGroup = floor = blob = null;
      lastState = null;
      THREE = null;
    }
  };

  /* Проверка геометрии без браузера: включается только вручную,
     window.MELNICA_TORT3D_TEST = true до загрузки модуля.
     Тот же блок стоит и в исходной версии файла — иначе числа до и после
     правки не с чем сравнивать. */
  if (root.MELNICA_TORT3D_TEST) {
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
      /* Полная сборка без рендера
: сцены хватает, чтобы проверить, что торт
         и витринные изделия собираются и ничего не роняют. */
      rebuildWith: function (mod, deps, state) {
        THREE = mod;
        group = deps.group; pieceRoot = deps.piece;
        camera = deps.camera; key = deps.key;
        shadowTex = deps.shadowTex; printTex = deps.printTex; sliceTex = null;
        lastW = deps.w || 620; lastH = deps.h || 700;
        return rebuild(state);
      },
      /* дешёвый путь пересборки верха — тот самый opts.only='decor' */
      repaint: function (state) { return repaintDecor(state); },
      rig: function () {
        return { group: group, piece: pieceRoot, camera: camera, key: key, floor: floor, blob: blob, mirror: mirrorGroup };
      },
      stats: function () {
        return { camDist: camDist, frame: FRAME, builtKey: builtKey, topTier: topTier, look: lookNow };
      },
      view: function (v) {
        if (typeof v.pitch === 'number') pitch = v.pitch;
        if (typeof v.zoom === 'number') zoom = v.zoom;
        applyCamera();
        return { pitch: pitch, zoom: zoom, camDist: camDist };
      }
    };
  }

  root.MELNICA_TORT3D = api;
})(typeof window !== 'undefined' ? window : this);
