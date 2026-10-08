import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { disposeTree } from "./scene-utils.js";
import { bounds } from "./model-library.js";
function studioEnvironment(renderer, kind) {
  const room = new RoomEnvironment();
  if (kind === "cakes") {
    for (const [width, height, position] of [
      [1.4, 4, [-3, 3, -4]],
      [4, 2, [0, 5, 0]],
    ]) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(5, 5, 5),
          side: THREE.DoubleSide,
        }),
      );
      panel.position.set(...position);
      panel.lookAt(0, 0, 0);
      room.add(panel);
    }
  }
  const pmrem = new THREE.PMREMGenerator(renderer),
    env = pmrem.fromScene(room, 0.025);
  room.dispose();
  pmrem.dispose();
  return env;
}
export class StudioRenderer {
  constructor(canvas, host, kind) {
    this.kind = kind;
    this.host = host;
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = kind === "jewelry" ? 0.84 : 0.76;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    this.camera = new THREE.PerspectiveCamera(
      kind === "jewelry" ? 35 : 36,
      1,
      0.01,
      1000,
    );
    this.env = studioEnvironment(this.renderer, kind);
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = kind === "cakes" ? 0.45 : 1;
    this.scene.add(
      new THREE.HemisphereLight(
        0xffffff,
        kind === "jewelry" ? 0x363326 : 0x998b77,
        0.32,
      ),
    );
    this.key = new THREE.DirectionalLight(0xfff5e7, 1.8);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.normalBias = 0.025;
    this.key.shadow.bias = -0.00015;
    this.key.shadow.radius = 4;
    this.scene.add(this.key);
    const rim = new THREE.DirectionalLight(0xe3e8ff, 0.75);
    rim.position.set(-20, 18, -12);
    this.scene.add(rim);
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShadowMaterial({ opacity: kind === "jewelry" ? 0.22 : 0.12 }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.025;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.enablePan = false;
    this.controls.autoRotateSpeed = 0.7;
    this.controls.listenToKeyEvents(canvas);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(this.loop);
      if (document.hidden || this.renderer.getContext().isContextLost()) return;
      if (this.controls.update() || this.controls.autoRotate)
        this.renderer.render(this.scene, this.camera);
    };
    this.loop();
    canvas.addEventListener(
      "webglcontextlost",
      (this.onLost = (e) => {
        e.preventDefault();
        host.dispatchEvent(new CustomEvent("contextlost"));
      }),
    );
    canvas.addEventListener(
      "webglcontextrestored",
      (this.onRestored = () => {
        this.env.dispose();
        this.env = studioEnvironment(this.renderer, this.kind);
        this.scene.environment = this.env.texture;
        host.dispatchEvent(new CustomEvent("contextrestored"));
      }),
    );
    this.canvas = canvas;
    this.resize();
  }
  resize() {
    const r = this.host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    if (this.active) this.fit(this.pose || "front");
  }
  setObject(object, { reset = true } = {}) {
    const viewDirection = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();
    if (this.active) {
      this.scene.remove(this.active);
      disposeTree(this.active);
    }
    this.active = object;
    this.scene.add(object);
    const box = bounds(object),
      size = box.getSize(new THREE.Vector3()),
      r = Math.max(size.x, size.y, size.z),
      c = box.getCenter(new THREE.Vector3());
    this.floor.scale.setScalar(r * 8);
    this.key.position
      .copy(c)
      .add(
        this.kind === "cakes"
          ? new THREE.Vector3(r * 0.8, r * 1.8, r * 0.9)
          : new THREE.Vector3(r * 0.18, r * 2.5, r * 0.75),
      );
    this.key.target.position.copy(c);
    this.scene.add(this.key.target);
    const sh = this.key.shadow.camera;
    sh.left = sh.bottom = -r * 1.3;
    sh.right = sh.top = r * 1.3;
    sh.near = 0.001;
    sh.far = r * 7;
    sh.updateProjectionMatrix();
    this.key.shadow.normalBias = r * 0.001;
    this.camera.near = Math.max(0.001, r / 1000);
    this.camera.far = r * 30;
    this.controls.minDistance = r * 0.55;
    this.controls.maxDistance = r * 8;
    this.fit(
      reset ? "front" : this.pose || "front",
      reset ? null : viewDirection,
    );
    this.renderer.render(this.scene, this.camera);
  }
  fit(pose = "front", directionOverride = null) {
    if (!this.active) return;
    this.pose = pose;
    const box = bounds(this.active),
      size = box.getSize(new THREE.Vector3()),
      center = box.getCenter(new THREE.Vector3());
    const direction =
      pose === "top"
        ? new THREE.Vector3(0.001, 1, 0.001)
        : pose === "side"
          ? new THREE.Vector3(1, 0.32, 0.08)
          : pose === "back"
            ? new THREE.Vector3(-0.35, 0.4, -1)
            : this.kind === "jewelry"
              ? new THREE.Vector3(0.48, 0.44, 1)
              : new THREE.Vector3(
                  0.28,
                  this.kind === "flowers" ? 0.44 : 0.62,
                  1,
                );
    if (directionOverride) direction.copy(directionOverride);
    direction.normalize();
    const corners = [];
    this.active.updateMatrixWorld(true);
    this.active.traverse((n) => {
      if (!n.isMesh) return;
      const a = n.geometry.getAttribute("position");
      for (let i = 0; i < a.count; i += Math.max(1, Math.floor(a.count / 700)))
        corners.push(
          new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i)).applyMatrix4(
            n.matrixWorld,
          ),
        );
    });
    let low = Math.max(size.x, size.y, size.z) * 0.65,
      high = Math.max(size.x, size.y, size.z) * 12;
    this.controls.target.copy(center);
    this.camera.updateProjectionMatrix();
    for (let i = 0; i < 16; i++) {
      const distance = (low + high) / 2;
      this.camera.position.copy(center).addScaledVector(direction, distance);
      this.camera.lookAt(center);
      this.camera.updateMatrixWorld(true);
      let x = 0,
        y = 0;
      for (const v of corners) {
        const p = v.clone().project(this.camera);
        x = Math.max(x, Math.abs(p.x));
        y = Math.max(y, Math.abs(p.y));
      }
      if (x > 0.85 || y > 0.82) low = distance;
      else high = distance;
    }
    this.camera.position.copy(center).addScaledVector(direction, high);
    this.camera.lookAt(center);
    this.camera.updateMatrixWorld(true);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  rotate(enabled) {
    this.controls.autoRotate =
      enabled && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  metrics() {
    const framing = { maxX: 0, maxY: 0 };
    if (this.active) {
      this.active.updateMatrixWorld(true);
      this.camera.updateMatrixWorld(true);
      this.active.traverse((n) => {
        if (!n.isMesh) return;
        const a = n.geometry.getAttribute("position");
        for (
          let i = 0;
          i < a.count;
          i += Math.max(1, Math.floor(a.count / 700))
        ) {
          const p = new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i))
            .applyMatrix4(n.matrixWorld)
            .project(this.camera);
          framing.maxX = Math.max(framing.maxX, Math.abs(p.x));
          framing.maxY = Math.max(framing.maxY, Math.abs(p.y));
        }
      });
    }
    return {
      assembly: this.active?.userData.assembly || null,
      framing,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      box: this.active
        ? bounds(this.active).getSize(new THREE.Vector3()).toArray()
        : null,
    };
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.controls.dispose();
    if (this.active) disposeTree(this.active);
    disposeTree(this.floor);
    this.env.dispose();
    this.renderer.dispose();
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
  }
}
