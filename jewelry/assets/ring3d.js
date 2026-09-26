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
     snapshot()    — снимок PNG (data-URL) для корзины
     dispose()     — остановить
   ============================================================ */
(function (root) {
  'use strict';

  var THREE = null;
  var VENDOR = './assets/vendor/three.module.min.js';
  var ENV_JPG = './assets/vendor/studio-env.jpg';

  /* ---------- палитры: числа и цвета те же, что в ring.js ---------- */
  var METALS = {
    brass: { name: 'Латунь', color: 0xc08f2e, roughness: .26, clearcoat: .5, plate: 0x5c4517, rim: 0xf0dcb4 },
    silver: { name: 'Серебро 925', color: 0xdcd8d2, roughness: .21, clearcoat: .35, plate: 0x4a4a4a, rim: 0xf4f4f4 }
  };
  var STONES = {
    none: { name: 'Без камня', kind: 'dome' },
    pearl: { name: 'Речной жемчуг', kind: 'pearl', color: 0xf3ecdc },
    turquoise: { name: 'Бирюза', kind: 'cabochon', color: 0x2f9c98 },
    garnet: { name: 'Гранат', kind: 'facet', color: 0x7d1224 },
    amethyst: { name: 'Аметист', kind: 'facet', color: 0x5b3a86 }
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
  var yaw = 0, pitch = 0.22, zoom = 1, dragging = false, lastX = 0, lastY = 0, idle = true, idleTimer = 0;
  var camDist = 4.3;
  var roughMap = null, shadowTex = null, plateTex = null, plateMesh = null;
  var pieceRoot = null;                 /* всё изделие, кроме пола и отражения */
  var stoneMesh = null, stoneKind = null, stoneHost = null;
  var bound = false, running = false;

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

  /* ---------- камень ---------- */
  function stoneMeshFor(THREE, state, radius) {
    var cfg = STONES[state.stone] || STONES.none;
    var metal = METALS[state.metal] || METALS.brass;
    var geo, mat;
    if (cfg.kind === 'dome') {
      geo = new THREE.SphereGeometry(radius, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.52);
      mat = new THREE.MeshPhysicalMaterial({ color: metal.color, metalness: 1, roughness: .22, clearcoat: .5, envMapIntensity: 2.0 });
    } else if (cfg.kind === 'pearl') {
      geo = new THREE.SphereGeometry(radius, 64, 48);
      mat = new THREE.MeshPhysicalMaterial({
        color: cfg.color, metalness: 0, roughness: .17, clearcoat: 1, clearcoatRoughness: .25,
        iridescence: 1, iridescenceIOR: 1.5, iridescenceThicknessRange: [80, 620],
        sheen: 1.4, sheenColor: 0xffe4c6, envMapIntensity: 2.8, roughnessMap: roughMap
      });
    } else if (cfg.kind === 'cabochon') {
      geo = new THREE.SphereGeometry(radius, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.55);
      geo.scale(1, .82, 1);
      mat = new THREE.MeshPhysicalMaterial({
        color: cfg.color, metalness: 0, roughness: .42, clearcoat: .55, clearcoatRoughness: .4,
        sheen: .5, sheenColor: 0x9fe4dd, envMapIntensity: 1.2
      });
    } else {
      geo = new THREE.IcosahedronGeometry(radius, 0);
      mat = new THREE.MeshPhysicalMaterial({
        color: cfg.color, metalness: 0, roughness: .08, flatShading: true,
        clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 2.1
      });
    }
    var m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
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

  /* ---------- изделия ---------- */
  /* каждое возвращает группу и подсказку, где ставить камень и пластинку */
  var BUILD = {
    ring: function (THREE, state) {
      var g = new THREE.Group();
      var R = 1.0, TUBE = 0.155;
      var metal = METALS[state.metal] || METALS.brass;
      var bandMat = new THREE.MeshPhysicalMaterial({ color: metal.color, metalness: 1, roughness: metal.roughness, clearcoat: metal.clearcoat, roughnessMap: roughMap, envMapIntensity: 2.1 });
      var band = new THREE.Mesh(new THREE.TorusGeometry(R, TUBE, 32, 112), bandMat);
      band.castShadow = true;
      g.add(band);
      var rimMat = new THREE.MeshPhysicalMaterial({ color: metal.rim, metalness: 1, roughness: .22, envMapIntensity: 2.1 });
      [-1, 1].forEach(function (s) {
        var rim = new THREE.Mesh(new THREE.TorusGeometry(R, TUBE * 0.16, 12, 96), rimMat);
        rim.position.z = s * TUBE * 0.92;
        g.add(rim);
      });
      var seat = new THREE.Group();
      seat.position.set(0, R + 0.02, 0);
      g.add(seat);
      var castMat = new THREE.MeshPhysicalMaterial({ color: metal.rim, metalness: 1, roughness: .24, roughnessMap: roughMap, envMapIntensity: 2.0 });
      var cast = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.09, 32), castMat);
      cast.position.y = -0.02;
      cast.castShadow = true;
      seat.add(cast);
      var plate = makePlate(THREE, state, 0.66, 0.22);
      plate.position.set(0, -R + TUBE + 0.085, 0.012);
      plate.visible = false;
      g.add(plate);
      return { group: g, stone: { host: seat, radius: 0.2, y: 0.16 }, plate: plate, ground: -R - 0.44, spread: 1.5 };
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
      var ring = new THREE.Mesh(new THREE.TorusGeometry(DISC * 0.94, 0.02, 10, 72), new THREE.MeshPhysicalMaterial({ color: metal.rim, metalness: 1, roughness: .22, envMapIntensity: 2.1 }));
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
      var twin = stoneMesh.clone();
      twin.material = stoneMesh.material;
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
    var fit = Math.max(spread, Math.abs(groundY) + 0.6, 2.2);
    camDist = fit * 1.62 / zoom;
    if (key) {
      key.position.set(fit * 0.5, fit * 1.6, fit * 0.9);
      var sc = key.shadow.camera;
      sc.left = -fit; sc.right = fit; sc.top = fit; sc.bottom = -fit;
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
    if (idle && !dragging) group.rotation.y += 0.0032;          /* вещь сама поворачивается на полу */
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    camera.position.set(Math.sin(yaw) * cp * camDist, sp * camDist + 0.18, Math.cos(yaw) * cp * camDist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(render);
  }

  function resize() {
    if (!renderer || !canvasEl) return;
    var rect = canvasEl.getBoundingClientRect();
    var w = Math.max(300, Math.round(rect.width || 520));
    var h = Math.round(w * 0.86);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function bind() {
    if (bound || !canvasEl) return;
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
    canvasEl.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.008;
      group.rotation.y -= (e.clientX - lastX) * 0.008;
      pitch = Math.max(-0.35, Math.min(0.85, pitch + (e.clientY - lastY) * 0.006));
      lastX = e.clientX; lastY = e.clientY;
    });
    canvasEl.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoom = Math.max(0.75, Math.min(1.5, zoom - e.deltaY * 0.0011));
      rebuild(getState ? getState() : null);
    }, { passive: false });
    root.addEventListener('resize', resize);
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
      if (!canvas || renderer) return !!renderer;
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
        var loader = new THREE.TextureLoader();
        loader.load(ENV_JPG, function (tex) {
          tex.mapping = THREE.EquirectangularReflectionMapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          scene.environment = tex;
          scene.environmentIntensity = 1.3;
        }, undefined, function () {});

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
        running = true;
        render();
        return true;
      };
      if (THREE) return ready(THREE);
      var dyn = null;
      try { dyn = new Function('u', 'return import(u);'); } catch (e) { dyn = null; }
      if (dyn) return dyn(VENDOR).then(ready).catch(function () { return false; });
      return false;
    },

    /* update(state, {only:'graving'}) — при наборе букв перерисовываем только пластинку */
    update: function (state, opts) {
      if (!renderer) return false;
      if (opts && opts.only === 'graving' && plateMesh) {
        plateMesh.visible = !!state.graving;
        if (plateMesh.userData.draw) plateMesh.userData.draw(state.graving || '');
        return true;
      }
      rebuild(state);
      return true;
    },

    /* снимок для корзины: та же вещь, что на экране, только уменьшенная */
    snapshot: function (width) {
      if (!renderer) return '';
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
        return off.toDataURL('image/jpeg', 0.86);
      } catch (e) { return ''; }
    },

    dispose: function () {
      running = false;
      cancelAnimationFrame(raf);
      if (renderer) { renderer.dispose(); renderer = null; }
      if (scene) { disposeTree(scene); scene = null; }
      THREE = null;
    }
  };

  root.LATUN_RING3D = api;
})(typeof window !== 'undefined' ? window : this);
