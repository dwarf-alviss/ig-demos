import * as THREE from "three";
export function distanceToSurface(root, point) {
  let nearest = Infinity;
  const triangle = new THREE.Triangle(),
    closest = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.attributes.position,
      index = mesh.geometry.index;
    for (
      let offset = 0;
      offset < (index?.count ?? position.count);
      offset += 3
    ) {
      for (const [j, v] of [triangle.a, triangle.b, triangle.c].entries())
        v.fromBufferAttribute(
          position,
          index ? index.getX(offset + j) : offset + j,
        ).applyMatrix4(mesh.matrixWorld);
      triangle.closestPointToPoint(point, closest);
      nearest = Math.min(nearest, point.distanceTo(closest));
    }
  });
  return nearest;
}
