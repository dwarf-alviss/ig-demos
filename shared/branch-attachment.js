import * as THREE from "three";
import { preciseBounds } from "./precise-fit.js";

export function branchCut(object) {
  const box = preciseBounds(object),
    height = box.max.y - box.min.y,
    point = new THREE.Vector3();
  let count = 0;
  object.traverse((n) => {
    if (!n.isMesh) return;
    const a = n.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const p = new THREE.Vector3()
        .fromBufferAttribute(a, i)
        .applyMatrix4(n.matrixWorld);
      if (p.y <= box.min.y + height * 0.012) {
        point.add(p);
        count++;
      }
    }
  });
  if (!count) throw Error("Branch has no cut-end geometry");
  return point.divideScalar(count);
}
export function aimBranch(branch, origin, tip, yaw = 0) {
  const height = preciseBounds(branch).getSize(new THREE.Vector3()).y;
  const cut = branch.worldToLocal(branchCut(branch)),
    direction = tip.clone().sub(origin).normalize();
  branch.quaternion.copy(
    new THREE.Quaternion()
      .setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          yaw,
        ),
      ),
  );
  branch.updateMatrixWorld(true);
  const desired = tip.clone().addScaledVector(direction, -height);
  branch.position.add(desired.sub(branch.localToWorld(cut.clone())));
  branch.updateMatrixWorld(true);
  return { cut, direction };
}
