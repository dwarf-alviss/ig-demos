import * as THREE from "three";
import profiles from "./integrated-sockets.json" with { type: "json" };
import { byId } from "./catalogue.js";
import { preciseBounds } from "./precise-fit.js";

export { profiles as integratedSockets };

export async function seatIntegratedGems(lib, baseId, base, stoneId) {
  const profile = profiles[baseId],
    box = preciseBounds(base);
  const height = box.max.y - box.min.y,
    centre = box.getCenter(new THREE.Vector3());
  const stones = [];
  for (const socket of profile.sockets) {
    const stone = await lib.get(stoneId, {
      size: 1,
      axis: "x",
      color: byId[stoneId].color,
      role: "gem",
      rotation: byId[stoneId].face === "z" ? [-Math.PI / 2, 0, 0] : null,
    });
    const b = preciseBounds(stone),
      c = b.getCenter(new THREE.Vector3()),
      size = b.getSize(new THREE.Vector3());
    const width = socket.hole.max[0] - socket.hole.min[0],
      depth = socket.hole.max[1] - socket.hole.min[1];
    const choices = [0, Math.PI / 2]
      .map((angle) => {
        const x = angle ? size.z : size.x,
          z = angle ? size.x : size.z;
        return {
          angle,
          scale:
            Math.min(width / x, depth / z) *
            (baseId === "jw-set-bezel" ? 0.995 : 1.035),
          error: Math.abs(Math.log(x / z / (width / depth))),
        };
      })
      .sort((a, b) => a.error - b.error);
    const fit = choices[0],
      vertices = [];
    stone.traverse((n) => {
      if (!n.isMesh) return;
      const p = n.geometry.attributes.position;
      for (let i = 0; i < p.count; i++)
        vertices.push(
          new THREE.Vector3()
            .fromBufferAttribute(p, i)
            .applyMatrix4(n.matrixWorld),
        );
    });
    const radii = vertices.map((p) => Math.hypot(p.x - c.x, p.z - c.z)),
      maximum = Math.max(...radii);
    const girdles = vertices
      .filter((_, i) => radii[i] > maximum * 0.94)
      .map((p) => p.y)
      .sort((a, b) => a - b);
    const girdle = girdles[Math.floor(girdles.length / 2)];
    stone.position.sub(new THREE.Vector3(c.x, girdle, c.z));
    const cut = new THREE.Group();
    cut.add(stone);
    cut.rotation.y = fit.angle;
    cut.scale.setScalar(fit.scale * height);
    const mount = new THREE.Group();
    mount.add(cut);
    const x = (socket.hole.min[0] + socket.hole.max[0]) / 2,
      z = (socket.hole.min[1] + socket.hole.max[1]) / 2;
    if (profile.face === "z") {
      mount.rotation.x = Math.PI / 2;
      mount.position.set(
        centre.x + x * height,
        box.min.y + z * height,
        centre.z + socket.seat * height,
      );
    } else
      mount.position.set(
        centre.x + x * height,
        box.min.y + socket.seat * height,
        centre.z + z * height,
      );
    mount.updateMatrixWorld(true);
    mount.userData.nativeSeat = {
      base: baseId,
      sourceHash: profile.sourceHash,
      normal: profile.face === "z" ? [0, 0, 1] : [0, 1, 0],
      uniformScale: fit.scale * height,
      girdle: socket.seat * height,
      openingCenter: mount.position.toArray(),
      rotation: fit.angle,
      aspectError: fit.error,
    };
    stones.push(mount);
  }
  return stones;
}
