import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { byId } from "./catalogue.js";
import { fitToScene, disposeTree } from "./scene-utils.js";
export const bounds = (o) => {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
};
export function place(o, x, y, z, anchor = "bottom") {
  let b = bounds(o),
    c = b.getCenter(new THREE.Vector3());
  o.position.add(
    new THREE.Vector3(
      x - c.x,
      y - (anchor === "center" ? c.y : b.min.y),
      z - c.z,
    ),
  );
  o.updateMatrixWorld(true);
  return o;
}
export function physical(color, role = "soft") {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness:
      role === "metal"
        ? 0.2
        : role === "gem"
          ? 0.035
          : role === "petal"
            ? 0.66
            : 0.52,
    metalness: role === "metal" ? 1 : 0,
    transmission: role === "gem" ? 0.45 : role === "glass" ? 0.75 : 0,
    ior: role === "gem" ? 2.4 : 1.5,
    thickness: role === "gem" ? 0.32 : 0.6,
    clearcoat: role === "metal" || role === "gem" ? 0.75 : 0.05,
    envMapIntensity: role === "metal" ? 1.25 : 1,
    side: THREE.DoubleSide,
  });
}
export function bake(root, preserveMaterials = false) {
  root.updateMatrixWorld(true);
  const group = new THREE.Group();
  root.traverse((n) => {
    if (!n.isMesh) return;
    const geo = new THREE.BufferGeometry();
    for (const key of ["position", "normal"]) {
      const a = n.geometry.getAttribute(key);
      if (!a) continue;
      const values = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) {
        values[i * 3] = a.getX(i);
        values[i * 3 + 1] = a.getY(i);
        values[i * 3 + 2] = a.getZ(i);
      }
      geo.setAttribute(key, new THREE.BufferAttribute(values, 3));
    }
    if (n.geometry.index) geo.setIndex(n.geometry.index.clone());
    if (n.geometry.getAttribute("uv"))
      geo.setAttribute("uv", n.geometry.getAttribute("uv").clone());
    geo.applyMatrix4(n.matrixWorld);
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo);
    if (preserveMaterials) {
      mesh.material = n.material.clone();
      for (const key of [
        "map",
        "normalMap",
        "roughnessMap",
        "metalnessMap",
        "aoMap",
      ]) {
        if (mesh.material[key]) {
          mesh.material[key] = mesh.material[key].clone();
          mesh.material[key].needsUpdate = true;
        }
      }
    }
    group.add(mesh);
  });
  return group;
}
export class ModelLibrary {
  constructor() {
    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.cache = new Map();
    this.pending = new Map();
    this.closed = false;
  }
  async original(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    if (!this.pending.has(id))
      this.pending.set(
        id,
        this.loader
          .loadAsync(
            new URL(
              byId[id].project !== "jewelry"
                ? `models/textured/${id}.glb`
                : byId[id].url,
              import.meta.url,
            ).href,
          )
          .then((g) => {
            const baked = bake(g.scene, byId[id].project !== "jewelry");
            disposeTree(g.scene);
            if (this.closed) {
              disposeTree(baked);
              throw Error("Scene closed");
            }
            this.cache.set(id, baked);
            this.pending.delete(id);
            return baked;
          })
          .catch((e) => {
            this.pending.delete(id);
            throw e;
          }),
      );
    return this.pending.get(id);
  }
  async get(
    id,
    {
      size = 1,
      axis = "max",
      color = byId[id].color,
      role = "soft",
      rotation = null,
      regional = false,
      nativeColor = false,
    } = {},
  ) {
    const base = await this.original(id),
      root = base.clone(true);
    root.traverse((n) => {
      if (n.isMesh) {
        n.geometry = n.geometry.clone();
        const textured = byId[id].project !== "jewelry";
        n.material = textured ? n.material.clone() : physical(color, role);
        if (textured) {
          for (const key of [
            "map",
            "normalMap",
            "roughnessMap",
            "metalnessMap",
            "aoMap",
          ]) {
            if (n.material[key]) {
              n.material[key] = n.material[key].clone();
              n.material[key].needsUpdate = true;
            }
          }
          if (role === "glass") {
            const source = n.material;
            n.material = new THREE.MeshPhysicalMaterial({
              color: "#ffffff",
              normalMap: source.normalMap,
              roughness: 0.08,
              metalness: 0,
              transmission: 0.35,
              transparent: true,
              opacity: 0.28,
              depthWrite: false,
              thickness: 0.15,
              ior: 1.46,
              normalScale: new THREE.Vector2(0.25, 0.25),
              side: THREE.DoubleSide,
            });
            for (const key of ["map", "roughnessMap", "metalnessMap", "aoMap"])
              source[key]?.dispose();
            source.dispose();
          }
          n.material.side = THREE.DoubleSide;
          n.material.metalness = 0;
          // Natural food and botanical colors come from the supplied texture.
          // Only neutral icing/wrapping can be tinted without painting leaves and dough.
          n.material.color.set(id.includes("struct-tier") ? color : "#ffffff");
          n.material.userData.textured = true;
          if (id.startsWith("fl-flower") && !nativeColor) {
            const tint = new THREE.Color(color);
            n.material.onBeforeCompile = (shader) => {
              shader.uniforms.flowerTint = { value: tint };
              shader.fragmentShader =
                "uniform vec3 flowerTint;\n" + shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace(
                "#include <map_fragment>",
                `#include <map_fragment>
                vec3 sourcePetal=diffuseColor.rgb;
                bool botanicalGreen=sourcePetal.g>sourcePetal.r*1.07 && sourcePetal.g>sourcePetal.b*1.12;
                bool darkCenter=max(max(sourcePetal.r,sourcePetal.g),sourcePetal.b)<0.12;
                bool goldenCenter=${['fl-flower-chamomile','fl-flower-gerbera','fl-flower-lily-oriental'].includes(id)?'true':'false'} && sourcePetal.r>sourcePetal.b*2.2 && sourcePetal.g>sourcePetal.b*1.65;
                if(!botanicalGreen && !darkCenter && !goldenCenter) {
                  float lightness=max(max(sourcePetal.r,sourcePetal.g),sourcePetal.b);
                  diffuseColor.rgb=flowerTint*lightness;
                }
              `,
              );
            };
            n.material.customProgramCacheKey = () =>
              "botanical-texture-tint-v1";
          }
        }
        n.castShadow = true;
        n.receiveShadow = true;
        n.userData.asset = id;
      }
    });
    if (rotation) root.rotation.set(...rotation);
    root.updateMatrixWorld(true);
    const box = bounds(root),
      s = box.getSize(new THREE.Vector3());
    if (axis === "max")
      axis = s.x >= s.y && s.x >= s.z ? "x" : s.y >= s.z ? "y" : "z";
    const result = fitToScene(root, size, axis);
    result.userData.asset = id;
    result.userData.label = byId[id].name;
    if (regional && byId[id].project === "jewelry") {
      const b = bounds(result);
      result.traverse((n) => {
        if (!n.isMesh) return;
        const pos = n.geometry.getAttribute("position"),
          colors = new Float32Array(pos.count * 3),
          p = new THREE.Vector3(),
          baseColor = new THREE.Color(color),
          green = new THREE.Color("#526a38"),
          heart = new THREE.Color(
            id.includes("anemone") ? "#34302f" : "#c0a14e",
          );
        for (let i = 0; i < pos.count; i++) {
          p.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld);
          const t = (p.y - b.min.y) / (b.max.y - b.min.y),
            c = baseColor.clone();
          if (id.includes("cupcake") && t < 0.36) c.set("#be926b");
          else if (id.includes("donut") && t < 0.45) c.set("#c99a60");
          else if (id.includes("eclair") && t > 0.68) c.set("#4d2c22");
          else if (id.includes("strawberry") && t > 0.78) c.copy(green);
          else if (id.includes("cherry") && t > 0.55) c.copy(green);
          else if (id.startsWith("fl-flower") && t < 0.15) c.copy(green);
          else if (
            (id.includes("chamomile") ||
              id.includes("gerbera") ||
              id.includes("anemone")) &&
            t > 0.45 &&
            Math.hypot(
              p.x - b.getCenter(new THREE.Vector3()).x,
              p.z - b.getCenter(new THREE.Vector3()).z,
            ) <
              (b.max.x - b.min.x) * 0.18
          )
            c.copy(heart);
          const v = 0.91 + 0.09 * Math.sin(p.x * 15 + p.z * 21);
          c.multiplyScalar(v);
          colors.set([c.r, c.g, c.b], i * 3);
        }
        n.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        n.material.color.set("#ffffff");
        n.material.vertexColors = true;
      });
    }
    return result;
  }
  dispose() {
    this.closed = true;
    for (const root of this.cache.values()) disposeTree(root);
    this.cache.clear();
  }
}
export function cylinder(radius, height, color, role = "soft") {
  const o = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 96),
    physical(color, role),
  );
  o.position.y = height / 2;
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
export function stem(start, end, radius = 0.08) {
  const dir = new THREE.Vector3().subVectors(end, start),
    mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.7, radius, dir.length(), 8),
      physical("#526c49"),
    );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize(),
  );
  return mesh;
}
