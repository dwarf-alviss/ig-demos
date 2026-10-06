# Portfolio studios

Four static stores and a portfolio index. Three dedicated WebGL studios use the supplied models; the fashion project has a photographic capsule editor.

## Run

```powershell
npm ci
npm run build
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/ . No CDN or remote decoder is required. `shared/studio.bundle.js` is committed so static hosting needs no build step.

## Assets

90 optimized GLBs in `shared/models/`, approximately 12 MB total. Each model is below 1 MiB and 40,000 triangles. The runtime uses GLTFLoader, a bundled MeshoptDecoder, PBR materials authored in code, and RoomEnvironment. Scene units are centimetres. Normalization applies nested node transforms before fitting and aligns the bottom and centre using the final world bounding box.

`shared/models/manifest.json` and `reports/asset-conversion.json` record source/output inspection, sizes, triangles and simplification tolerances. The provided inspector incorrectly converted metres to millimetres using ×10: `tools/inspect_glb.py` fixes it to ×1000, including its self-test. The reference normalization example also translated before scaling; the implementation fits inside a parent group then computes the final translation.

All three source files for `bk-topper-candle-spiral` are empty (0 bytes), so this model could not be converted. The studio offers a valid star topper instead. Generated previews are not substitutes for missing source geometry.

Textures and material extensions are deliberately removed to support code-controlled colours and avoid downloading multi-megabyte texture maps. UV seams and tangents are removed before welding. Simplification targets 32k triangles at 0.001 error; six assets require 0.01 error to meet the budget. That exception is recorded per asset. Complex natural shapes therefore lose fine surface detail. The gemstone pack files are preserved as collections rather than pretending each collection is a single gemstone.

Reconvert (large source files should normally be processed by a CI runner with access to the source asset directory):

```powershell
node tools/convert-models.mjs 'C:/webcum/3d-models/готово'
python tools/inspect_glb.py --selftest
```

Existing manifest entries are resumed rather than recomputed. Remove the corresponding manifest entry when replacing a source model. Failed files cause a nonzero exit code while remaining valid files continue.

## Verification

`npm test` checks transformed pivots, shared GPU resource disposal, invalid persisted configuration, all selectable asset references and budgets, and Khronos glTF validation of all 90 GLBs. CI runs these checks and rebuilds the local bundle.

`node tools/browser-checks.mjs` uses an installed Chrome browser and the local server. It checks every studio option, undo, persistence, downloads, mobile overflow, WebGL fallback, all four store pages and the capsule editor. Screenshots and reports are under `reports/`.

## Interaction and limitations

Studios show photos during loading or when WebGL is unavailable. Configuration and price controls remain usable without WebGL. Designs are local drafts; prices are demonstrative and no order is submitted. Change detection prevents stale async scene assemblies from replacing a newer design. Scene clones own their geometry and materials; replacement disposes resources, cached originals are released at page unload.

Original inline procedural configurators remain available inside the stores for their existing cart flows; primary constructor links lead to the new model studios. The new studios save/export designs and add compatible custom line items to each store cart. JPEG previews are stored in the existing IndexedDB photo store; localStorage holds only the reference. Checkout continues through the existing demo order flow. Gem transmission is a realtime approximation, not an optical simulation. Jewelry placement uses approximate component sockets rather than manufacturing CAD tolerances.
