#!/usr/bin/env python3
"""Инспекция GLB стандартной библиотекой: треугольники, текстуры, bbox, масштаб до целевого.

Запуск:
    python3 inspect_glb.py model.glb
    python3 inspect_glb.py model.glb --target-mm 100 --axis diameter
    python3 inspect_glb.py --selftest          # самопроверка на синтетическом GLB

Основано на реальном потоке приёмки ассетов: контейнер GLB → JSON-чанк → accessors/images.
"""
import argparse
import json
import pathlib
import struct
import sys
import tempfile

GLB_MAGIC = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942


def read_glb(path):
    raw = pathlib.Path(path).read_bytes()
    if len(raw) < 12:
        raise ValueError("файл короче заголовка GLB")
    magic, version, length = struct.unpack_from("<III", raw, 0)
    if magic != GLB_MAGIC:
        raise ValueError("не GLB (нет магии glTF) — возможно, это .gltf или .obj")
    if version != 2:
        raise ValueError("версия контейнера %d, ожидается 2" % version)
    if length != len(raw):
        raise ValueError("длина в заголовке %d, фактически %d" % (length, len(raw)))
    gltf, chunks, off = None, [], 12
    while off + 8 <= len(raw):
        clen, ctype = struct.unpack_from("<II", raw, off)
        chunks.append((ctype, clen))
        if ctype == CHUNK_JSON and gltf is None:
            gltf = json.loads(raw[off + 8: off + 8 + clen].decode("utf-8").rstrip("\x00 \t\r\n"))
        off += 8 + clen + ((4 - clen % 4) % 4 if clen % 4 else 0)
    if gltf is None:
        raise ValueError("в контейнере нет JSON-чанка")
    return gltf, chunks


def triangles(gltf):
    total = 0
    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if "indices" in prim:
                total += gltf["accessors"][prim["indices"]]["count"] // 3
            elif "POSITION" in prim.get("attributes", {}):
                total += gltf["accessors"][prim["attributes"]["POSITION"]]["count"] // 3
    return total


def bbox_mm(gltf):
    """min/max есть только у POSITION-аксессоров; трансформы узлов не применяются."""
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    found = False
    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            pos = prim.get("attributes", {}).get("POSITION")
            if pos is None:
                continue
            acc = gltf["accessors"][pos]
            amin, amax = acc.get("min"), acc.get("max")
            if not amin or not amax:
                continue
            found = True
            for i in range(3):
                lo[i] = min(lo[i], amin[i])
                hi[i] = max(hi[i], amax[i])
    if not found:
        return None
    return [round((hi[i] - lo[i]) * 1000, 2) for i in range(3)]  # glTF в метрах → мм


def texture_bytes(gltf):
    views = gltf.get("bufferViews", [])
    total = 0
    for img in gltf.get("images", []):
        if img.get("bufferView") is not None:
            total += views[img["bufferView"]].get("byteLength", 0)
    return total


def inspect_glb(path):
    gltf, chunks = read_glb(path)
    return {
        "bytes": pathlib.Path(path).stat().st_size,
        "triangles": triangles(gltf),
        "bbox_mm": bbox_mm(gltf),
        "node_scale": [n.get("scale") for n in gltf.get("nodes", []) if n.get("scale")],
        "meshes": len(gltf.get("meshes", [])),
        "textures": len(gltf.get("images", [])),
        "texture_bytes": texture_bytes(gltf),
        "materials": len(gltf.get("materials", [])),
        "extensions": gltf.get("extensionsUsed", []),
        "chunks": [{"type": hex(c), "bytes": n} for c, n in chunks],
    }


def selftest():
    buf = struct.pack("<9f", 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0)
    gltf = {
        "asset": {"version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "scale": [2.0, 2.0, 2.0]}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "mode": 4}]}],
        "accessors": [{"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3",
                       "min": [0.0, 0.0, 0.0], "max": [1.0, 1.0, 0.0]}],
        "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(buf)}],
        "buffers": [{"byteLength": len(buf)}],
    }
    j = json.dumps(gltf).encode("utf-8")
    j += b" " * ((4 - len(j) % 4) % 4)
    b = buf + b"\x00" * ((4 - len(buf) % 4) % 4)
    body = struct.pack("<II", len(j), CHUNK_JSON) + j + struct.pack("<II", len(b), CHUNK_BIN) + b
    blob = struct.pack("<III", GLB_MAGIC, 2, 12 + len(body)) + body
    with tempfile.TemporaryDirectory() as td:
        p = pathlib.Path(td) / "model.glb"
        p.write_bytes(blob)
        info = inspect_glb(p)
    assert info["triangles"] == 1, info
    assert info["bbox_mm"] == [1000.0, 1000.0, 0.0], info
    print("selftest ok:", json.dumps(info, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path", nargs="?")
    ap.add_argument("--target-mm", type=float, help="целевой габарит")
    ap.add_argument("--axis", default="width", choices=["width", "height", "length", "diameter"])
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        selftest()
        return 0
    if not args.path:
        ap.error("нужен путь к GLB или --selftest")
    try:
        info = inspect_glb(args.path)
    except ValueError as exc:
        print("GLB не читается:", exc)
        return 1
    if args.target_mm and info["bbox_mm"]:
        idx = {"width": 0, "height": 1, "length": 2, "diameter": 0}[args.axis]
        cur = info["bbox_mm"][idx]
        if cur:
            ratio = cur / args.target_mm
            info["scale_to_target"] = round(args.target_mm / cur, 4)
            info["size_ratio"] = round(ratio, 3)
            if not 0.2 < ratio < 5:
                info["warning"] = "габарит по %s = %.1f мм против целевых %.1f — проверь, тот ли объект" % (
                    args.axis, cur, args.target_mm)
    if info["bytes"] > 20 * 1024 * 1024:
        info["warning"] = info.get("warning", "") + " | %.1f МБ — сырой вывод, нужна усадка" % (
            info["bytes"] / 1048576)
    print(json.dumps(info, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
