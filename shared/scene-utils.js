import * as THREE from "three";
export function disposeTree(root) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  root.traverse((n) => {
    if (!n.isMesh) return;
    geometries.add(n.geometry);
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      materials.add(m);
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    }
  });
  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
  geometries.forEach((g) => g.dispose());
}
export function fitToScene(root, targetCm, axis = "x") {
  const holder = new THREE.Group();
  holder.add(root);
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(holder),
    size = box.getSize(new THREE.Vector3());
  if (!Number.isFinite(size[axis]) || size[axis] <= 0)
    throw Error("Пустая геометрия");
  holder.scale.setScalar(targetCm / size[axis]);
  holder.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(holder);
  const center = box.getCenter(new THREE.Vector3());
  holder.position.set(-center.x, -box.min.y, -center.z);
  holder.updateMatrixWorld(true);
  return holder;
}
