import * as THREE from "three";

// Rotated bounding-box corners can be far outside the actual setting walls.
export function preciseBounds(root) {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root, true);
}
export function precisePlace(root, x, y, z, anchor = "bottom") {
  const box = preciseBounds(root),
    center = box.getCenter(new THREE.Vector3());
  root.position.add(
    new THREE.Vector3(
      x - center.x,
      y - (anchor === "center" ? center.y : box.min.y),
      z - center.z,
    ),
  );
  root.updateMatrixWorld(true);
  return root;
}
export function preciseFit(root, width) {
  const holder = new THREE.Group();
  holder.add(root);
  let b = preciseBounds(holder);
  holder.scale.setScalar(width / (b.max.x - b.min.x));
  b = preciseBounds(holder);
  const center = b.getCenter(new THREE.Vector3());
  holder.position.set(-center.x, -b.min.y, -center.z);
  holder.updateMatrixWorld(true);
  return holder;
}
