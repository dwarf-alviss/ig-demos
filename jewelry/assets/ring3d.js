/* ============================================================
   «Латунь» — живое украшение в 3D
   ------------------------------------------------------------
   Тот же конструктор, что и в assets/ring.js, но моделька
   собирается настоящей геометрией и рисуется в WebGL:
   металл, камень, гравировка и размер меняют саму вещь.

   three.js лежит рядом, в assets/vendor — наружу ни одного
   запроса. Если WebGL нет, модуль молча не запускается, и на
   странице остаётся векторная моделька из ring.js.

   Публично: window.LATUN_RING3D
     supported()  — есть ли WebGL
     mount(canvas, getState) — поднять сцену
     update(state) — пересобрать вещь
     snapshot()    — Promise со снимком корзины: ключ «idb:…» в
                     igdemo_jewelry_photos_v1 или data-URL, если базы нет
     dispose()     — остановить
   ============================================================ */
(function (root) {
  'use strict';

  var THREE = null;
  /* путь считаем от самого файла модуля: динамический import в обычном скрипте
     разрешается относительно скрипта, а не страницы */
  var SELF = (document.currentScript && document.currentScript.src) || root.location.href;
  var VENDOR = new URL('vendor/three.module.min.js', SELF).href;
  var ENV_JPG = new URL('vendor/studio-env.jpg', SELF).href;
  var ENV_GLINT_JPG = new URL('vendor/glint-env.jpg', SELF).href;

  /* ---------- 3.5: снимки корзины лежат в IndexedDB, не в localStorage ---------- */
  var PHOTOS_DB = 'igdemo_jewelry_photos_v1';
  var PHOTOS_STORE = 'shots';

  function dataURLtoBlob3d(dataUrl) {
    try {
      var parts = dataUrl.split(',');
      var mime = ((parts[0].match(/data:(.*?)[;,]/i) || [])[1] || 'image/jpeg');
      var bin = atob(parts[1]);
      var len = bin.length;
      var arr = new Uint8Array(len);
      for (var i = 0; i < len; i++) { arr[i] = bin.charCodeAt(i); }
      return new Blob([arr], { type: mime });
    } catch (e) { return null; }
  }

  function idbOpen() {
    return new Promise(function (resolve) {
      var req;
      try {
        if (typeof indexedDB === 'undefined' || !indexedDB) { return resolve(null); }
        req = indexedDB.open(PHOTOS_DB, 1);
      } catch (e) { return resolve(null); }
      req.onupgradeneeded = function () { req.result.createObjectStore(PHOTOS_STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
      req.onblocked = function () { resolve(null); };
    });
  }

  /* ---------- палитры: числа и цвета те же, что в ring.js ---------- */
  var METALS = {
    brass: { name: 'Латунь', color: 0xc08f2e, roughness: .26, clearcoat: .5, plate: 0x5c4517, rim: 0xf0dcb4 },
    /* розовое золочение по латуни — тон из присланного демо */
    rose: { name: 'Латунь с розовым золочением', color: 0xe2a08a, roughness: .24, clearcoat: .5, plate: 0x6b4636, rim: 0xffe6da },
    silver: { name: 'Серебро 925', color: 0xdcd8d2, roughness: .21, clearcoat: .35, plate: 0x4a4a4a, rim: 0xf4f4f4 },
    /* родирование поверх серебра — холодный тон платины, как четвёртый металл в демо */
    rhodium: { name: 'Серебро с родированием', color: 0xeceef4, roughness: .13, clearcoat: .4, plate: 0x53585f, rim: 0xffffff }
  };
  var STONES = {
    none: { name: 'Без камня', kind: 'dome' },
    pearl: { name: 'Речной жемчуг', kind: 'pearl', color: 0xf3ecdc },
    turquoise: { name: 'Бирюза', kind: 'cabochon', color: 0x2f9c98 },
    zircon: { name: 'Фианит', kind: 'facet', color: 0xdfe7f8, ior: 2.16, dispersion: '' },
    sapphire: { name: 'Выращенный сапфир', kind: 'facet', color: 0x2a48d0, ior: 1.77, dispersion: '' },
    emerald: { name: 'Выращенный изумруд', kind: 'facet', color: 0x14a862, ior: 1.58, dispersion: '' },
    ruby: { name: 'Рубин', kind: 'facet', color: 0xd0203f, ior: 1.77, dispersion: '' },
    pinkzircon: { name: 'Розовый фианит', kind: 'facet', color: 0xf0a6b8, ior: 2.16, dispersion: '' },
    /* гранат и аметист природные: IOR по минералогическому справочнику (compat.json → materials.gem) */
    garnet: { name: 'Гранат', kind: 'facet', color: 0x7d1224, ior: 1.77, dispersion: '' },
    amethyst: { name: 'Аметист', kind: 'facet', color: 0x5b3a86, ior: 1.54, dispersion: '' }
  };
  var FORMS = {
    ring: { title: 'Кольцо', sizes: [15, 16, 17, 18, 19, 20, 21] },
    studs: { title: 'Серьги-каффы', sizes: [25, 35, 45] },
    pendant: { title: 'Подвеска', sizes: [40, 45, 50, 55] },
    bracelet: { title: 'Браслет', sizes: [16, 17, 18, 19] }
  };

  var renderer = null, scene = null, camera = null, group = null;
  var floor = null, blob = null, mirrorGroup = null, key = null;
  var canvasEl = null, getState = null, raf = 0;
  var yaw = 0, pitch = 0.22, zoom = 1, dragging = false, lastX = 0, lastY = 0;

  /* Инерция вращения, как в присланном 3D-демо: отпустил — вещь едет дальше и плавно
     возвращается к спокойному ходу. При «меньше движения» ход нулевой. */
  var IDLE_SPIN = 0.0032;
  var spinVel = IDLE_SPIN;
  var calm = false, onScreen = true;
  try { calm = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
  var camDist = 4.3;
  var camTarget = null;      /* куда смотрит камера: центр изделия */
  var roughMap = null, shadowTex = null, plateTex = null, plateMesh = null;
  var pieceRoot = null;                 /* всё изделие, кроме пола и отражения */
  var stoneMesh = null, stoneKind = null, stoneHost = null;
  var bound = false, running = false;

  /* Гиро-наклон: телефон в руке чуть наклоняет витрину. Плавно, с пределами,
     отключается при «меньше движения». Ключи и drag остаются главнее: откуда
     пришёл последний ввод, тот и рулит, конфликтов нет. */
  var gyroTilt = { x: 0, y: 0 };      /* целевой наклон от датчика */
  var gyroNow = { x: 0, y: 0 };       /* сглаженный наклон, он и уходит в группу */
  var gyroBound = false, gyroPermission = false, gyroLastInput = 0;

  function gyroClamp(v) { return Math.max(-0.16, Math.min(0.16, v)); }

  function onDeviceOrient(e) {
    if (calm || dragging) { return; }
    if (e.gamma == null || e.beta == null) { return; }
    var g = (e.gamma || 0) / 90;      /* -1..1: наклон влево-вправо */
    var b = (e.beta || 0) / 180;      /* 0..1 в кармане, важно только отклонение */
    gyroTilt.y = gyroClamp(g * 0.34);
    gyroTilt.x = gyroClamp((b - 0.45) * 0.2);
    gyroLastInput = Date.now();
  }

  function bindGyro() {
    if (gyroBound || !root.DeviceOrientationEvent) return;
    gyroBound = true;
    /* iOS 13+: DeviceOrientationEvent.requestPermission нельзя звать без жеста,
       поэтому жду первого pointerdown. На Android и в старых браузерах слушаем сразу. */
    var start = function () {
      if (gyroPermission) { return; }
      gyroPermission = true;
      if (typeof root.DeviceOrientationEvent.requestPermission === 'function') {
        root.DeviceOrientationEvent.requestPermission().then(function (res) {
          if (res === 'granted') { root.addEventListener('deviceorientation', onDeviceOrient); }
        }).catch(function () {});
      } else {
        root.addEventListener('deviceorientation', onDeviceOrient);
      }
    };
    root.addEventListener('pointerdown', start, { once: true });
  }

  /* Сглаживание гиро-наклона к целевому — вызвать каждый кадр перед позой камеры */
  function stepGyro() {
    if (!calm) {
      gyroNow.x += (gyroTilt.x - gyroNow.x) * 0.05;
      gyroNow.y += (gyroTilt.y - gyroNow.y) * 0.05;
    } else {
      gyroTilt.x *= 0.9; gyroTilt.y *= 0.9;
      gyroNow.x *= 0.9; gyroNow.y *= 0.9;
    }
    if (group && !dragging && Date.now() - gyroLastInput > 40) {
      /* драг по пальцу правит камерой, гиро крутит саму вещь — совместимо */
      group.rotation.x = gyroNow.x;
    }
  }

  /* ---------- вспомогательное ---------- */
  function noiseTexture(THREE) {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = '#f2f2f2';
    x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 420; i++) {
      var r = 4 + Math.random() * 26;
      var g = x.createRadialGradient(Math.random() * 256, Math.random() * 256, 0, Math.random() * 256, Math.random() * 256, r);
      g.addColorStop(0, Math.random() > .5 ? 'rgba(150,150,150,.20)' : 'rgba(255,255,255,.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2); x.fill();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
    return t;
  }

  function blobTexture(THREE) {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(128, 128, 8, 128, 128, 124);
    g.addColorStop(0, 'rgba(0,0,0,.85)');
    g.addColorStop(.55, 'rgba(0,0,0,.32)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  /* карта окружения: своя студия, пока не подгрузилась HDRI */
  function studioEnv(THREE) {
    var env = new THREE.Scene();
    var dome = new THREE.Mesh(
      new THREE.SphereGeometry(14, 32, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          top: { value: new THREE.Color(0x6f6a63) },
          mid: { value: new THREE.Color(0x35302b) },
          bot: { value: new THREE.Color(0x0e0c0a) }
        },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;' +
          'void main(){ float h = normalize(vP).y;' +
          ' vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.7)) : mix(mid, bot, pow(-h, 0.6));' +
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
    soft(9, 6, 0, 6.4, 0.4, Math.PI / 2, 0, 7.5);
    soft(4.6, 7, -5.6, 1.6, 2.2, 0, Math.PI / 2.1, 4.2);
    soft(3.6, 6, 5.6, 1.0, -1.4, 0, -Math.PI / 2.1, 2.6);
    soft(5.5, 2.6, 0, 1.2, -6.2, 0, 0, 1.4);
    soft(5, 3, 0, -1.2, 6.4, 0, Math.PI, 0.5);
    var pmrem = new THREE.PMREMGenerator(renderer);
    var tex = pmrem.fromScene(env, 0.02).texture;
    pmrem.dispose();
    return tex;
  }

  /* ---------- свет: одна схема на вектор и 3D ----------
     Ключ тёплый сверху-справа (offset lightFit*0.5, 1.7, 0.9), fill холодный
     слева-снизу; направление градиентов и блик камня в ring.js сидят так же,
     чтобы вектор и модель читались как одна витрина. */

  /* --- карта окружения: два света на выбор --------------------------------
     «студия» — ровный спокойный свет по умолчанию,
     «блики» — тёмная витрина с жёсткими точечными источниками: гранёный камень
     стреляет звёздами, металл становится зеркальным. Переключается чипом освещения. */

  var envState = 'studio';          /* 'studio' | 'glint' */
  var envTex = { studio: null, glint: null };

  function applyEnv() {
    if (!scene) return;
    var tex = envTex[envState];
    var int = (envState === 'glint') ? 1.35 : 1.3;
    if (tex) {
      scene.environment = tex;
      scene.environmentIntensity = int;
    } else {
      /* Пока JPEG не подгрузился: универсальная студия стоит у обоих светов,
         «блики» только приглушает общий фон, чтобы металл темнел. */
      scene.environmentIntensity = (envState === 'glint') ? 0.55 : 1.1;
    }
    if (key) { key.intensity = (envState === 'glint') ? 4.6 : 3.1; }
  }

  function envLoad(url, intensity, dimmed, tag) {
    var loader = new THREE.TextureLoader();
    loader.load(url, function (tex) {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      envTex[tag || 'studio'] = tex;
      /* если Another карта уже пришла раньше — не затираем активную */
      if (envState === (tag || 'studio')) {
        scene.environment = tex;
        scene.environmentIntensity = intensity;
      }
    }, undefined, function () {
      /* файла найти не удалось — остаёмся на студии-шейдере */
    });
  }

  /* ============================ камни и оправа ============================
     Огранка — это форма камня: силуэт задаётся вращением профиля
     (площадка, рундист, павильон), число сегментов и поворот делают
     остальное. Круг — 16 сегментов, принцесса — 4 (квадрат), овал и
     изумруд — 16 и 8 с растяжением по ширине. */

  var CUTS = {
    round:    { seg: 16, sx: 1,    sz: 1,    spin: 0,          dome: .36 },
    oval:     { seg: 16, sx: 1.3,  sz: .88,  spin: 0,          dome: .34 },
    princess: { seg: 4,  sx: 1,    sz: 1,    spin: Math.PI / 4, dome: .38 },
    emerald:  { seg: 8,  sx: 1.24, sz: .86,  spin: Math.PI / 8, dome: .3 }
  };

  /* Профиль бриллиантовой огранки: площадка, рундист по экватору, павильон вниз */
  function gemGeometry(THREE, cut) {
    var c = CUTS[cut] || CUTS.round;
    var pts = [
      new THREE.Vector2(0, c.dome),
      new THREE.Vector2(0.55, c.dome),
      new THREE.Vector2(0.8, c.dome * 0.6),
      new THREE.Vector2(1, 0.07),
      new THREE.Vector2(1, 0),
      new THREE.Vector2(0.55, -0.3),
      new THREE.Vector2(0, -0.66)
    ];
    var g = new THREE.LatheGeometry(pts, c.seg);
    if (c.spin) { g.rotateY(c.spin); }
    if (c.sx !== 1 || c.sz !== 1) { g.scale(c.sx, 1, c.sz); }
    g.computeVertexNormals();
    return g;
  }

  /* Камень с огранкой: прозрачная грань с transmission/IOR по справочнику камней
     (compat.json → materials.gem), внутри — зеркальная подложка.
     Цвет берём палитровый из ring.js, поэтому гранат остаётся гранатом. */
  function facetedStone(THREE, st, radius) {
    var g = new THREE.Group();
    var cfg = STONES[st.stone] || STONES.garnet;
    var geo = gemGeometry(THREE, st.cut || 'round');
    var outer = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(cfg.color), roughness: 0.02, metalness: 0.05,
      transmission: 1.0, thickness: radius * 0.9, ior: cfg.ior || 1.6,
      attenuationColor: new THREE.Color(cfg.color), attenuationDistance: radius * 2.4,
      flatShading: true, transparent: true,
      clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 2.8
    }));
    var inner = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(cfg.color).multiplyScalar(.9), roughness: .04, metalness: 1,
      flatShading: true, side: THREE.BackSide, envMapIntensity: 3.2
    }));
    outer.castShadow = true;
    g.add(outer, inner);
    g.scale.setScalar(radius / 0.62);       /* профиль огранки строится радиусом ~0.62 */
    return g;
  }

  /* Оправа: крапаны — четыре когтя по камню, halo — венок мелких камней вокруг */
  function settingGroup(THREE, st, radius, metalMat, rimMat) {
    var g = new THREE.Group();
    var cfg = STONES[st.stone] || STONES.garnet;
    var i, a;
    if ((st.set || 'prongs') === 'halo') {
      var small = new THREE.Group();
      var count = 12;
      for (i = 0; i < count; i++) {
        a = (i / count) * Math.PI * 2;
        var chip = facetedStone(THREE, { stone: st.stone === 'none' ? 'garnet' : st.stone, cut: 'round' }, radius * 0.2);
        chip.position.set(Math.cos(a) * radius * 1.34, 0, Math.sin(a) * radius * 1.34);
        chip.rotation.y = -a;
        small.add(chip);
      }
      var ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.34, radius * 0.075, 10, 48), metalMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -radius * 0.16;
      ring.castShadow = true;
      g.add(ring, small);
    } else {
      for (i = 0; i < 4; i++) {
        a = Math.PI / 4 + i * Math.PI / 2;
        var prong = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.075, radius * 0.12, radius * 0.94, 12), metalMat);
        prong.position.set(Math.cos(a) * radius * 0.98, radius * 0.02, Math.sin(a) * radius * 0.98);
        prong.castShadow = true;
        var ball = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.11, 14, 10), rimMat);
        ball.position.set(prong.position.x * 0.97, radius * 0.4, prong.position.z * 0.97);
        g.add(prong, ball);
      }
    }
    return g;
  }

  /* Паве: мелкие камни в один ряд по шинке (передняя половина обода) */
  function paveStones(THREE, st, radius, count, front) {
    var cfg = STONES[st.stone === 'none' ? 'garnet' : st.stone] || STONES.garnet;
    var geo = gemGeometry(THREE, 'round');
    var mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(cfg.color).lerp(new THREE.Color(0xffffff), .25),
      roughness: .02, metalness: .1, flatShading: true,
      transmission: 1.0, thickness: .12, ior: (STONES[st.stone === 'none' ? 'garnet' : st.stone] || STONES.garnet).ior || 1.6,
      clearcoat: 1, envMapIntensity: 3
    });
    var im = new THREE.InstancedMesh(geo, mat, count);
    var o = new THREE.Object3D();
    for (var i = 0; i < count; i++) {
      var a = (i - (count - 1) / 2) * (front / count);
      o.position.set(Math.sin(a) * radius, 0, Math.cos(a) * radius);
      o.rotation.set(Math.PI / 2, 0, 0);
      o.rotateY(a);
      o.scale.setScalar(.085);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    }
    im.castShadow = true;
    return im;
  }

  /* ---------- камень (как в ring.js: у каждого своя фактура) ---------- */
  function stoneMeshFor(THREE, state, radius) {
    var cfg = STONES[state.stone] || STONES.none;
    var metal = METALS[state.metal] || METALS.brass;
    if (cfg.kind === 'dome') {
      var gd = new THREE.Group();
      var domeGeo = new THREE.SphereGeometry(radius, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.52);
      var dome = new THREE.Mesh(domeGeo, new THREE.MeshPhysicalMaterial({ color: metal.color, metalness: 1, roughness: .22, clearcoat: .5, envMapIntensity: 2.0 }));
      dome.castShadow = true;
      gd.add(dome);
      return gd;
    }
    if (cfg.kind === 'pearl') {
      var gp = new THREE.Group();
      var pearlMesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), new THREE.MeshPhysicalMaterial({
        color: cfg.color, metalness: 0, roughness: .17, clearcoat: 1, clearcoatRoughness: .25,
        iridescence: 1, iridescenceIOR: 1.5, iridescenceThicknessRange: [80, 620],
        sheen: 1.4, sheenColor: 0xffe4c6, envMapIntensity: 2.8, roughnessMap: roughMap
      }));
      pearlMesh.castShadow = true;
      gp.add(pearlMesh);
      return gp;
    }
    if (cfg.kind === 'cabochon') {
      var gc = new THREE.Group();
      var cab = new THREE.SphereGeometry(radius, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.55);
      cab.scale(1, .82, 1);
      var cabMesh = new THREE.Mesh(cab, new THREE.MeshPhysicalMaterial({
        color: cfg.color, metalness: 0, roughness: .42, clearcoat: .55, clearcoatRoughness: .4,
        sheen: .5, sheenColor: 0x9fe4dd, envMapIntensity: 1.2
      }));
      cabMesh.castShadow = true;
      gc.add(cabMesh);
      return gc;
    }
    /* гранат и аметист — огранённый камень: силуэт задаёт выбранная огранка */
    return facetedStone(THREE, state, radius);
  }

  /* Переключение света: «студия» и «блики». Обе карты подгружаются лениво,
     один раз; чип освещения в app.js зовёт публичный setLight. */
  function setLight(kind) {
    envState = (kind === 'glint') ? 'glint' : 'studio';
    if (!THREE) { return envState; }
    if (!envTex[envState]) {
      envLoad(envState === 'glint' ? ENV_GLINT_JPG : ENV_JPG,
        envState === 'glint' ? 1.35 : 1.3, 1.1, envState);
    }
    applyEnv();
    return envState;
  }

  /* ---------- пластинка с гравировкой ---------- */
  function makePlate(THREE, state, width, height) {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 160;
    var x = c.getContext('2d');
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    var mat = new THREE.MeshPhysicalMaterial({ map: tex, metalness: .8, roughness: .38, envMapIntensity: 1.2 });
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.04), mat);
    mesh.castShadow = true;
    mesh.userData.draw = function (text) {
      x.fillStyle = '#' + new THREE.Color((METALS[state.metal] || METALS.brass).plate).getHexString();
      x.fillRect(0, 0, 512, 160);
      x.fillStyle = 'rgba(0,0,0,.35)';
      x.fillRect(0, 0, 512, 8); x.fillRect(0, 152, 512, 8);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      var size = Math.max(46, Math.min(96, 620 / Math.max(4, text.length)));
      x.font = '600 ' + size + 'px Georgia, "Times New Roman", serif';
      x.fillStyle = 'rgba(0,0,0,.55)';
      x.fillText(text, 256, 84);
      x.fillStyle = '#fff8e8';
      x.fillText(text, 256, 82);
      tex.needsUpdate = true;
    };
    return mesh;
  }

  /* Полоса шинки: замкнутый профиль вращается вокруг оси — сверху выходит
     плоская лента с рантом, а не круглый прут. Так шинка и выглядит в жизни. */
  function bandGeometry(THREE, Rd, w, t, ex) {
    var p = [];
    for (var i = 0; i <= 40; i++) {
      var a = i / 40 * Math.PI * 2;
      var c = Math.cos(a), s = Math.sin(a);
      p.push(new THREE.Vector2(Rd + t / 2 * Math.sign(c) * Math.pow(Math.abs(c), ex),
        w / 2 * Math.sign(s) * Math.pow(Math.abs(s), ex)));
    }
    return new THREE.LatheGeometry(p, 128);
  }

  /* Паве по шинке: мелкие камни в один ряд по наружной стороне обода.
     axis='z' — обод стоит к камере лицом (кольцо), axis='y' — лежит плашмя. */
  function paveAlong(THREE, st, Rd, count, from, to, axis, offset) {
    var geo = gemGeometry(THREE, 'round');
    var cfg = STONES[st.stone === 'none' ? 'garnet' : st.stone] || STONES.garnet;
    var mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(cfg.color).lerp(new THREE.Color(0xffffff), .25),
      roughness: .02, metalness: .1, flatShading: true,
      transmission: 1.0, thickness: .12, ior: (STONES[st.stone === 'none' ? 'garnet' : st.stone] || STONES.garnet).ior || 1.6,
      clearcoat: 1, envMapIntensity: 3
    });
    var im = new THREE.InstancedMesh(geo, mat, count);
    var o = new THREE.Object3D();
    for (var i = 0; i < count; i++) {
      var a = from + (to - from) * (count === 1 ? 0 : i / (count - 1));
      if (axis === 'z') {
        o.position.set(Math.cos(a) * Rd, Math.sin(a) * Rd, offset || 0);
        o.rotation.set(0, 0, a + Math.PI / 2);
        o.rotateX(Math.PI / 2);
      } else {
        o.position.set(Math.sin(a) * Rd, offset || 0, Math.cos(a) * Rd);
        o.rotation.set(Math.PI / 2, 0, 0);
        o.rotateY(a);
      }
      o.scale.setScalar(.09);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    }
    im.castShadow = true;
    return im;
  }

  /* ---------- изделия ---------- */
  /* каждое возвращает группу и подсказку, где ставить камень и пластинку */
  var BUILD = {
    ring: function (THREE, state) {
      var g = new THREE.Group();
      var Rd = 1.0, w = 0.34, t = 0.15;
      var metal = METALS[state.metal] || METALS.brass;
      var bandMat = new THREE.MeshPhysicalMaterial({ color: metal.color, metalness: 1, roughness: metal.roughness, clearcoat: metal.clearcoat, roughnessMap: roughMap, envMapIntensity: 2.1 });
      var rimMat = new THREE.MeshPhysicalMaterial({ color: metal.rim, metalness: 1, roughness: .22, envMapIntensity: 2.1 });
      /* шинка: плоская лента с рантом по кромкам, стоит к камере лицом */
      var band = new THREE.Mesh(bandGeometry(THREE, Rd, w, t, (state.band === 'pave') ? .62 : .8), bandMat);
      band.rotation.x = Math.PI / 2;
      band.castShadow = true;
      g.add(band);
      [-1, 1].forEach(function (s) {
        var rim = new THREE.Mesh(new THREE.TorusGeometry(Rd, t * 0.16, 10, 120), rimMat);
        rim.position.z = s * w * 0.46;
        g.add(rim);
      });
      /* паве идёт по бокам шинки, место камня не занимает */
      if (state.band === 'pave') {
        g.add(paveAlong(THREE, state, Rd, 9, Math.PI * 1.28, Math.PI * 1.72, 'z', w * 0.46));
        g.add(paveAlong(THREE, state, Rd, 9, Math.PI * 1.78, Math.PI * 2.22, 'z', w * 0.46));
      }
      var seat = new THREE.Group();
      seat.position.set(0, Rd + w * 0.3, 0);
      g.add(seat);
      var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.1, 32), rimMat);
      cup.position.y = -0.03;
      cup.castShadow = true;
      seat.add(cup);
      seat.add(settingGroup(THREE, state, 0.2, bandMat, rimMat));
      var plate = makePlate(THREE, state, 0.6, 0.2);
      plate.position.set(0, -Rd + w * 0.5 - 0.06, w * 0.52);
      plate.visible = false;
      g.add(plate);
      return { group: g, stone: { host: seat, radius: 0.2, y: 0.14 }, plate: plate, ground: -Rd - 0.44, spread: 1.5 };
    },

    studs: function (THREE, state) {
      var g = new THREE.Group();
      var k = Math.max(0, FORMS.studs.sizes.indexOf(state.size));
      var R = 0.5 + k * 0.11, TUBE = 0.055, gap = 0.62;
      var metal = METALS[state.metal] || METALS.brass;
      var bandMat = new THREE.MeshPhysicalMaterial({ color: metal.color, metalness: 1, roughness: metal.roughness, clearcoat: metal.clearcoat, roughnessMap: roughMap, envMapIntensity: 2.1 });
      var rimMat = new THREE.MeshPhysicalMaterial({ color: metal.rim, metalness: 1, roughness: .22, envMapIntensity: 2.1 });
      var seat = new THREE.Group();
      [-1, 1].forEach(function (side) {
        var cuff = new THREE.Mesh(new THREE.TorusGeometry(R, TUBE, 24, 96, Math.PI * 2 - gap), bandMat);
        cuff.rotation.z = gap / 2;      /* разрыв уходит наверх */
        cuff.position.set(side * (R + 0.16), 0, 0);
        cuff.castShadow = true;
        g.add(cuff);
        [-1, 1].forEach(function (s) {
          var rim = new THREE.Mesh(new THREE.TorusGeometry(R, TUBE * 0.18, 10, 80, Math.PI * 2 - gap), rimMat);
          rim.rotation.z = gap / 2;
          rim.position.set(side * (R + 0.16), 0, s * TUBE * 0.9);
          g.add(rim);
        });
      });
      /* камень — на нижней точке левого каффа, второй кафф получает копию */
      var host = new THREE.Group();
      host.position.set(-(R + 0.16), -R, 0);
      g.add(host);
      var host2 = new THREE.Group();
      host2.position.set(R + 0.16, -R, 0);
      g.add(host2);
      /* оправа камня: крапаны или венок мелких камней вокруг */
      var studSet = settingGroup(THREE, state, R * 0.34, bandMat, rimMat);
      studSet.position.y = -R * 0.06;
      host.add(studSet);
      var studSet2 = studSet.clone(true);
      host2.add(studSet2);
      var plate = makePlate(THREE, state, 0.56, 0.2);
      plate.position.set(0, -R - 0.5, 0);
      plate.visible = false;
      g.add(plate);
      return { group: g, stone: { host: host, extraHost: host2, radius: R * 0.3, y: 0 }, plate: plate, ground: -R - 0.62, spread: (R + 0.16) * 2 + R };
    },

    pendant: function (THREE, state) {
      var g = new THREE.Group();
      var k = Math.max(0, FORMS.pendant.sizes.indexOf(state.size));
      var DISC = 0.72, drop = k * 0.16;
      var metal = METALS[state.metal] || METALS.brass;
      var bandMat = new THREE.MeshPhysicalMaterial({ color: metal.color, metalness: 1, roughness: metal.roughness, clearcoat: metal.clearcoat, roughnessMap: roughMap, envMapIntensity: 2.1 });
      var disc = new THREE.Mesh(new THREE.CylinderGeometry(DISC, DISC, 0.07, 64), bandMat);
      disc.rotation.x = Math.PI / 2;
      disc.position.y = 0.1 - drop;
      disc.castShadow = true;
      g.add(disc);
      var rimMat = new THREE.MeshPhysicalMaterial({ color: metal.rim, metalness: 1, roughness: .22, envMapIntensity: 2.1 });
      var ring = new THREE.Mesh(new THREE.TorusGeometry(DISC * 0.94, 0.02, 10, 72), rimMat);
      ring.position.y = 0.1 - drop;
      g.add(ring);
      /* ушко и цепочка: звенья по дуге */
      var chainMat = bandMat;
      var bail = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 12, 48), chainMat);
      bail.position.set(0, 0.1 - drop + DISC + 0.06, 0);
      g.add(bail);
      var links = 9 + k * 2, topY = 0.1 - drop + DISC + 0.16;
      for (var i = 0; i < links; i++) {
        var t = i / (links - 1);
        var y = topY + t * (1.5 + k * 0.14);
        var x = Math.sin(t * Math.PI * 0.85) * (0.7 + k * 0.1);
        var link = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 8, 28), chainMat);
        link.position.set(x, y, 0);
        link.rotation.y = Math.PI / 2 * (i % 2);
        link.rotation.x = 0.3 * (i % 2 ? 1 : -1);
        g.add(link);
      }
      var seat = new THREE.Group();
      seat.position.set(0, 0.1 - drop + 0.16, 0.02);
      g.add(seat);
      var cast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.08, 40), new THREE.MeshPhysicalMaterial({ color: metal.rim, metalness: 1, roughness: .24, envMapIntensity: 2.0 }));
      cast.castShadow = true;
      seat.add(cast);
      seat.add(settingGroup(THREE, state, 0.28, bandMat, rimMat));
      var plate = makePlate(THREE, state, 0.7, 0.22);
      plate.position.set(0, 0.1 - drop - DISC - 0.16, 0.02);
      plate.visible = false;
      g.add(plate);
      return { group: g, stone: { host: seat, radius: 0.3, y: 0.14 }, plate: plate, ground: 0.1 - drop - DISC - 0.3, spread: Math.max(1.6, 1.5 + k * 0.2) };
    },

    bracelet: function (THREE, state) {
      var g = new THREE.Group();
      var k = Math.max(0, FORMS.bracelet.sizes.indexOf(state.size));
      var RX = 1.02 + k * 0.07, RY = 0.66 + k * 0.05;
      var metal = METALS[state.metal] || METALS.brass;
      var bandMat = new THREE.MeshPhysicalMaterial({ color: metal.color, metalness: 1, roughness: metal.roughness, clearcoat: metal.clearcoat, roughnessMap: roughMap, envMapIntensity: 2.1 });
      var rimMat = new THREE.MeshPhysicalMaterial({ color: metal.rim, metalness: 1, roughness: .22, envMapIntensity: 2.1 });
      /* тело: сплющенный тор, чтобы был овал, а не круг */
      var body = new THREE.Mesh(new THREE.TorusGeometry(1, 0.062, 20, 128), bandMat);
      body.scale.set(RX, RY, 1);
      body.castShadow = true;
      g.add(body);
      /* звенья: кольца по обводу, каждое повёрнуто по касательной */
      var links = 34;
      for (var i = 0; i < links; i++) {
        var a = (i / links) * Math.PI * 2;
        var lx = Math.cos(a) * RX, ly = Math.sin(a) * RY;
        var tangent = Math.atan2(RY * Math.cos(a), -RX * Math.sin(a));
        var link = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.026, 10, 30), i % 2 ? bandMat : rimMat);
        link.position.set(lx, ly, 0);
        link.rotation.z = tangent;
        link.rotation.y = (i % 2) * Math.PI / 2;
        link.castShadow = true;
        g.add(link);
      }
      var seat = new THREE.Group();
      seat.position.set(0, RY + 0.03, 0);
      g.add(seat);
      var cast = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.08, 32), new THREE.MeshPhysicalMaterial({ color: metal.rim, metalness: 1, roughness: .24, envMapIntensity: 2.0 }));
      cast.castShadow = true;
      seat.add(cast);
      seat.add(settingGroup(THREE, state, 0.19, bandMat, rimMat));
      var plate = makePlate(THREE, state, 0.66, 0.22);
      plate.position.set(0, -RY - 0.3, 0.02);
      plate.visible = false;
      g.add(plate);
      return { group: g, stone: { host: seat, radius: 0.2, y: 0.14 }, plate: plate, ground: -RY - 0.4, spread: RX * 2 + 0.6 };
    }
  };

  /* ---------- сборка ---------- */
  function rebuild(state) {
    if (!THREE || !group) return;
    if (pieceRoot) { group.remove(pieceRoot); disposeTree(pieceRoot); }
    var form = FORMS[state.form] ? state.form : 'ring';
    var built = BUILD[form](THREE, state);
    pieceRoot = built.group;
    group.add(pieceRoot);

    /* камень в седло */
    var st = built.stone;
    stoneMesh = stoneMeshFor(THREE, state, st.radius);
    stoneMesh.position.y = st.y || 0;
    st.host.add(stoneMesh);
    if (st.extraHost) {
      var twin = stoneMesh.clone(true);          /* камень — группа, клонируем с детьми */
      twin.position.copy(stoneMesh.position);
      st.extraHost.add(twin);
    }
    /* контактная тень под камнем */
    var contact = new THREE.Mesh(
      new THREE.PlaneGeometry(st.radius * 3, st.radius * 3),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: .5, depthWrite: false })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = (st.y || 0) - st.radius * 0.62;
    st.host.add(contact);

    /* пластинка гравировки */
    plateMesh = built.plate;
    plateMesh.visible = !!state.graving;
    if (plateMesh.userData.draw) plateMesh.userData.draw(state.graving || '');

    /* пол, тень и отражение под изделие */
    var groundY = built.ground;
    var spread = Math.max(1.6, built.spread || 1.6);
    if (floor) { group.remove(floor); floor.geometry.dispose(); }
    floor = new THREE.Mesh(
      new THREE.PlaneGeometry(spread * 3.4, spread * 2.2),
      new THREE.MeshPhysicalMaterial({ color: 0x0d0b0a, metalness: .55, roughness: .32, transparent: true, opacity: .92 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = groundY;
    floor.receiveShadow = true;
    group.add(floor);

    if (blob) { group.remove(blob); blob.geometry.dispose(); }
    blob = new THREE.Mesh(
      new THREE.PlaneGeometry(spread * 1.9, spread * 0.8),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: .95, depthWrite: false })
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(0, groundY + 0.004, 0.06);
    blob.renderOrder = 2;
    group.add(blob);

    /* зеркальное отражение: копия изделия вниз */
    if (mirrorGroup) { group.remove(mirrorGroup); disposeTree(mirrorGroup); }
    mirrorGroup = new THREE.Group();
    mirrorGroup.scale.set(1, -1, 1);
    mirrorGroup.position.y = groundY * 2;
    var copy = pieceRoot.clone(true);
    copy.traverse(function (n) {
      if (n.isMesh) {
        n.material = n.material.clone();
        n.material.transparent = true;
        n.material.opacity = .16;
        n.material.depthWrite = false;
        n.castShadow = false;
        n.receiveShadow = false;
      }
    });
    mirrorGroup.add(copy);
    group.add(mirrorGroup);

    /* кадр под размер изделия */
    /* Кадр по крайним точкам изделия и пола: ничего не обрезается */
    var box = new THREE.Box3().setFromObject(pieceRoot);
    var size = box.getSize(new THREE.Vector3());
    var top = box.max.y;
    var bottom = Math.min(box.min.y, groundY);
    camTarget = new THREE.Vector3(0, (top + bottom) / 2, 0);
    var halfH = Math.max(0.2, (top - bottom) / 2);
    var halfW = Math.max(0.2, Math.max(size.x, size.z) / 2);
    var vFov = camera.fov * Math.PI / 180;
    var needH = (halfH * 1.25) / Math.tan(vFov / 2);
    var needW = (halfW * 1.25) / (Math.tan(vFov / 2) * camera.aspect);
    camDist = Math.max(needH, needW, 1.6) / zoom;
    if (key) {
      var lightFit = Math.max(2.2, camDist * 0.8);
      key.position.set(lightFit * 0.5, lightFit * 1.7, lightFit * 0.9);
      var sc = key.shadow.camera;
      sc.left = -lightFit; sc.right = lightFit; sc.top = lightFit; sc.bottom = -lightFit;
      sc.updateProjectionMatrix();
    }
    return built;
  }

  function disposeTree(obj) {
    obj.traverse(function (n) {
      if (n.isMesh) {
        if (n.geometry) n.geometry.dispose();
        if (n.material) {
          if (n.material.map && n.material.map.isCanvasTexture) n.material.map.dispose();
          n.material.dispose();
        }
      }
    });
  }

  /* ---------- кадр ---------- */
  function render() {
    if (!running) return;
    if (root.document && root.document.hidden) { raf = requestAnimationFrame(render); return; }
    if (onScreen) { stepSpin(); stepGyro(); }              /* вещь сама поворачивается на полу */
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var t = camTarget || { x: 0, y: 0, z: 0 };
    camera.position.set(t.x + Math.sin(yaw) * cp * camDist, t.y + sp * camDist, t.z + Math.cos(yaw) * cp * camDist);
    camera.lookAt(t.x, t.y, t.z);
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
    pitch = Math.max(-0.35, Math.min(0.85, pitch + dy * 0.006));
  }

  /* Стрелки: тот же поворот, только шагом */
  function nudge(delta) {
    yaw += delta;
    group.rotation.y += delta;
  }

  function resize() {
    if (!renderer || !canvasEl) return;
    var rect = canvasEl.getBoundingClientRect();
    var w = Math.max(300, Math.round(rect.width || 520));
    var h = Math.round(w * 0.86);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (getState) rebuild(getState());
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
    });
    /* стрелки поворачивают вещь, как в демо */
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
      zoom = Math.max(0.75, Math.min(1.5, zoom - e.deltaY * 0.0011));
      rebuild(getState ? getState() : null);
    }, { passive: false });
    root.addEventListener('resize', resize);
    bindGyro();
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
        renderer.toneMappingExposure = 1.05;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
        camera.position.set(0, 0.34, 4.3);
        scene.environment = studioEnv(THREE);
        scene.environmentIntensity = 1.1;
        envLoad(ENV_JPG, 1.3, 1.1, 'studio');

        key = new THREE.DirectionalLight(0xfff4e2, 3.1);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.radius = 6;
        key.shadow.bias = -0.0012;
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 20;
        scene.add(key);
        var fill = new THREE.DirectionalLight(0xbfd4ff, 0.55);
        fill.position.set(-3, 1.4, 2.2);
        scene.add(fill);

        group = new THREE.Group();
        scene.add(group);

        roughMap = noiseTexture(THREE);
        shadowTex = blobTexture(THREE);
        bind();
        resize();
        rebuild(getState ? getState() : { form: 'ring', metal: 'brass', stone: 'turquoise', size: 17, graving: '' });
        envLoad(ENV_GLINT_JPG, 1.35, 1.1, 'glint');   /* вторая карта тянется в фоне один раз */
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

    /* update(state, {only:'graving'}) — при наборе букв перерисовываем только пластинку */
    update: function (state, opts) {
      if (!renderer) return false;
      if (opts && opts.only === 'graving' && plateMesh) {
        plateMesh.visible = !!state.graving;
        if (plateMesh.userData.draw) plateMesh.userData.draw(state.graving || '');
        return true;
      }
      if (state && state.light) { setLight(state.light); }
      rebuild(state);
      return true;
    },

    /* свет витрины: 'studio' (ровный) или 'glint' (жёсткие блики) */
    setLight: function (kind) { return setLight(kind); },
    light: function () { return envState; },

    /* снимок для корзины: та же вещь, что на экране, только уменьшенная.
       3.5: JPEG-блоб уезжает в IndexedDB (igdemo_jewelry_photos_v1),
       а в строку корзины возвращается ключ «idb:…», не base64. База не
       поднялась (редкий приватный режим) — остаётся data-URL, как раньше. */
    snapshot: function (width) {
      if (!renderer) return Promise.resolve('');
      return new Promise(function (resolve) {
        try {
          renderer.render(scene, camera);
          var w = width || 480;
          var h = Math.round(w * (canvasEl.height / canvasEl.width));
          var off = document.createElement('canvas');
          off.width = w; off.height = h;
          var ctx = off.getContext('2d');
          ctx.fillStyle = '#171412';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(canvasEl, 0, 0, w, h);
          var put = function (blob) {
            if (!blob) {
              resolve(off.toDataURL ? off.toDataURL('image/jpeg', 0.62) : '');
              return;
            }
            idbOpen().then(function (db) {
              if (!db) { resolve(dataURLfromBlob(blob)); return; }
              var k = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
              var tx = db.transaction('shots', 'readwrite');
              tx.objectStore('shots').put(blob, k);
              tx.oncomplete = function () { resolve('idb:' + k); };
              tx.onerror = function () { resolve(dataURLfromBlob(blob)); };
              tx.onabort = function () { resolve(dataURLfromBlob(blob)); };
            }, function () { resolve(dataURLfromBlob(blob)); });
          };
          var dataURLfromBlob = function (blob) {
            /* запасной путь без FileReader: только для совсем старых движков */
            return new Promise(function (done) {
              try {
                var fr = new FileReader();
                fr.onload = function () { done(String(fr.result)); };
                fr.onerror = function () { done(''); };
                fr.readAsDataURL(blob);
              } catch (e) { done(''); }
            });
          };
          if (off.toBlob) { off.toBlob(put, 'image/jpeg', 0.62); }
          else { put(dataURLtoBlob3d(off.toDataURL('image/jpeg', 0.62))); }
        } catch (e) {
          api.lastError = 'snapshot: ' + e.name + ': ' + e.message;
          resolve('');
        }
      });
    },

    dispose: function () {
      running = false;
      cancelAnimationFrame(raf);
      if (renderer) { renderer.dispose(); renderer = null; }
      if (scene) { disposeTree(scene); scene = null; }
      THREE = null;
    }
  };

  /* Проверка геометрии без браузера: включается вручную,
     window.LATUN_RING3D_TEST = true до загрузки модуля. */
  if (root.LATUN_RING3D_TEST) {
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
      /* Сборка вещи без рендера
: сцены хватает, чтобы проверить форму, оправу и кадр */
      rebuildWith: function (mod, deps, state) {
        THREE = mod;
        group = deps.group;
        scene = deps.scene || null;
        camera = deps.camera;
        key = deps.key || null;
        roughMap = deps.roughMap || null;
        shadowTex = deps.shadowTex || null;
        return rebuild(state);
      },
      rig: function () { return { renderer: renderer, scene: scene, camera: camera, key: key, group: group, piece: pieceRoot, floor: floor }; },
      stats: function () {
        var meshes = 0, tris = 0, inst = 0;
        if (pieceRoot) {
          pieceRoot.traverse(function (n) {
            if (!n.isMesh) { return; }
            meshes++;
            var g = n.geometry;
            var c = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
            var mul = n.isInstancedMesh ? n.count : 1;
            if (n.isInstancedMesh) { inst++; }
            tris += (c / 3) * mul;
          });
        }
        return { meshes: meshes, instanced: inst, tris: Math.round(tris), camDist: camDist, camY: camTarget ? camTarget.y : 0 };
      },
      cutList: function () { return Object.keys(CUTS); }
    };
  }

  root.LATUN_RING3D = api;
})(typeof window !== 'undefined' ? window : this);
