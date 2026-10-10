import * as THREE from "three";
import anchors from "./jewelry-anchors.json" with { type: "json" };
import { bounds, physical } from "./model-library.js";

export function findingEye(object, id, which = "eye") {
  const b = bounds(object),
    c = b.getCenter(new THREE.Vector3()),
    h = b.max.y - b.min.y;
  const a = anchors.assets[id][which];
  return new THREE.Vector3(c.x + a[0] * h, b.min.y + a[1] * h, c.z + a[2] * h);
}
export function attachFinding(object, id, target, rotation = null) {
  const local = object.worldToLocal(findingEye(object, id));
  if (rotation) object.rotation.set(...rotation);
  object.updateMatrixWorld(true);
  object.position.add(target.clone().sub(object.localToWorld(local.clone())));
  object.updateMatrixWorld(true);
  object.userData.connection = {
    target: target.toArray(),
    actual: object.localToWorld(local).toArray(),
  };
  return object;
}
export async function closedJumpRing(lib, size, color) {
  const native = await lib.get("jw-part-jump-ring", {
      size,
      axis: "x",
      color,
      role: "metal",
    }),
    b = bounds(native),
    dimensions = b.getSize(new THREE.Vector3()),
    centre = b.getCenter(new THREE.Vector3()),
    group = new THREE.Group();
  group.add(native);
  const weld = new THREE.Mesh(
    new THREE.TorusGeometry(
      dimensions.x * 0.44,
      dimensions.z * 0.5,
      16,
      12,
      0.25,
    ),
    physical(color, "metal"),
  );
  weld.rotation.z = Math.PI / 2 - 0.125;
  weld.position.copy(centre);
  weld.castShadow = weld.receiveShadow = true;
  group.add(weld);
  group.userData.component = "closed-native-jump-ring";
  return group;
}
export function closeCableLink(native, color) {
  const b = bounds(native),
    size = b.getSize(new THREE.Vector3()),
    group = new THREE.Group();
  group.add(native);
  for (const side of [-1, 1]) {
    const weld = new THREE.Mesh(
      new THREE.CylinderGeometry(size.z * 0.5, size.z * 0.5, size.y * 0.15, 24),
      physical(color, "metal"),
    );
    weld.position.set(side * (size.x * 0.5 - size.z * 0.5), size.y * 0.5, 0);
    weld.castShadow = weld.receiveShadow = true;
    group.add(weld);
  }
  group.userData.component = "closed-native-cable-link";
  return group;
}
export async function attachNativeFindings(lib, root, base, state, color) {
  if (!state.finding.length) return;
  const has = (id) => state.finding.includes(id),
    connections = [];
  const connector = async (centre, normal = "x") => {
    const ring = await closedJumpRing(lib, 0.4, color);
    if (normal === "x") ring.rotation.y = Math.PI / 2;
    const b = bounds(ring),
      c = b.getCenter(new THREE.Vector3());
    ring.position.add(centre.clone().sub(c));
    root.add(ring);
    return ring;
  };
  const add = async (id, target, rotation = null) => {
    const part = await lib.get(id, {
      size: id.includes("ear-wire")
        ? 1.9
        : id.includes("bail")
          ? 0.85
          : id.includes("clasp")
            ? 1
            : 0.9,
      axis: id.includes("charm") ? "x" : "y",
      color,
      role: "metal",
    });
    attachFinding(part, id, target, rotation);
    root.add(part);
    connections.push({ id, ...part.userData.connection });
  };
  if (state.base === "jw-base-drop-earring") {
    const eye = findingEye(base, state.base);
    await connector(eye.clone().add(new THREE.Vector3(0, 0.13, 0)));
    if (has("jw-part-ear-wire-french"))
      await add(
        "jw-part-ear-wire-french",
        eye.clone().add(new THREE.Vector3(0, 0.28, 0)),
      );
  } else if (state.base === "jw-base-pendant") {
    if (has("jw-part-bail-hinged")) {
      const eye = findingEye(base, state.base);
      await connector(eye.clone().add(new THREE.Vector3(0, 0.13, 0)));
      await add(
        "jw-part-bail-hinged",
        eye.clone().add(new THREE.Vector3(0, 0.28, 0)),
      );
    } else if (has("jw-part-jump-ring")) {
      const eye = findingEye(base, state.base, "chainEye");
      await connector(eye.clone().add(new THREE.Vector3(0, 0.13, 0)), "z");
    }
  } else if (state.base === "jw-base-chain-link-cable") {
    if (has("jw-part-clasp-lobster")) {
      const eye = new THREE.Vector3(2.74, 0.65, 0.15);
      await connector(
        new THREE.Vector3(
          2.7,
          0.65 + Math.sqrt(0.176 ** 2 - 0.075 ** 2),
          0.075,
        ),
      );
      await add("jw-part-clasp-lobster", eye, [0, 0, -Math.PI / 2]);
    }
    if (has("jw-part-charm-tag")) {
      await connector(new THREE.Vector3(-0.54, 0.65 - 0.13, 0));
      await add("jw-part-charm-tag", new THREE.Vector3(-0.54, 0.65 - 0.28, 0));
    }
    if (
      has("jw-part-jump-ring") &&
      !has("jw-part-clasp-lobster") &&
      !has("jw-part-charm-tag")
    )
      await connector(new THREE.Vector3(2.7, 0.78, 0));
  }
  root.userData.assembly = {
    ...root.userData.assembly,
    findingConnections: connections,
  };
}
