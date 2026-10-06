import * as THREE from "three";
import { byId } from "./catalogue.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { fitToScene, disposeTree } from "./scene-utils.js";
const canvas = document.querySelector("canvas"),
  r = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
r.setSize(360, 360);
r.setPixelRatio(1);
r.outputColorSpace = THREE.SRGBColorSpace;
r.toneMapping = THREE.ACESFilmicToneMapping;
r.toneMappingExposure = 0.85;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#ecebe5");
const env = new RoomEnvironment(),
  pm = new THREE.PMREMGenerator(r);
scene.environment = pm.fromScene(env, 0.04).texture;
env.dispose();
pm.dispose();
const camera = new THREE.PerspectiveCamera(32, 1, 0.001, 1000);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
scene.add(new THREE.HemisphereLight(0xffffff, 0x5f6156, 0.8));
const light = new THREE.DirectionalLight(0xfff4e5, 2);
light.position.set(3, 7, 6);
scene.add(light);
let current;
window.audit = async function (record, view = "front") {
  if (current) {
    scene.remove(current);
    disposeTree(current);
  }
  const gltf = await loader.loadAsync(
    new URL(record.url, import.meta.url).href,
  );
  const original = gltf.scene;
  const asset = byId[record.id];
  if (record.id === "jw-base-band-plain") original.rotation.y = Math.PI / 2;
  original.traverse((n) => {
    if (n.isMesh)
      n.material = new THREE.MeshPhysicalMaterial({
        color: byId[record.id]?.color || "#c9ad87",
        metalness:
          record.id.startsWith("jw-") && !record.id.includes("stone") ? 0.8 : 0,
        roughness: asset?.category === "stone" ? 0.08 : 0.38,
        clearcoat: asset?.category === "stone" ? 0.85 : 0,
        side: THREE.DoubleSide,
      });
  });
  current = fitToScene(original, 1, "x");
  scene.add(current);
  const box = new THREE.Box3().setFromObject(current),
    size = box.getSize(new THREE.Vector3()),
    center = box.getCenter(new THREE.Vector3()),
    radius = size.length() / 2,
    dist = (radius / Math.sin(THREE.MathUtils.degToRad(16))) * 1.04;
  const direction =
    view === "top"
      ? new THREE.Vector3(0.001, 1, 0.001)
      : view === "side"
        ? new THREE.Vector3(1, 0.1, 0.01)
        : asset?.category === "stone"
          ? asset.face === "z"
            ? new THREE.Vector3(0.1, 0.15, 1)
            : new THREE.Vector3(0.1, 1, 0.32)
          : new THREE.Vector3(0.35, 0.22, 1);
  camera.position.copy(center).add(direction.normalize().multiplyScalar(dist));
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  r.render(scene, camera);
  return {
    size: size.toArray(),
    center: center.toArray(),
    meshes: original.children.map((n) => n.name),
  };
};
window.auditReady = true;
