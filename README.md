# Portfolio studios

Four static stores with distinct visual identities and an interactive portfolio index. Three Three.js studios assemble the supplied cake, flower and jewelry assets; the fashion capsule uses catalogue products and labelled garment sketches.

## Run

```powershell
npm ci
npm run build
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/ . The committed bundle includes Three.js and MeshoptDecoder, without CDN dependencies. The visual review gallery is at `/reports/revision-2/gallery.html`.

## Complete source coverage

`reports/revision-2/source-coverage.json` audits all 242 GLB files in 90 source directories. Every nonempty source group is represented. White/albedo/textured variants have identical position/index data and transforms, verified by geometry hashes; the runtime assigns materials in code.

188 selectable parts consist of 88 standalone assets and 100 individually extracted stones: 12 diamond cuts and 11 gemstone shapes in 8 colors. Collection labels and grid offsets are omitted from the extracted stones. The original optimized collection files remain available for provenance but are not displayed as single gemstones.

Source defects are explicit: all files in `bk-topper-candle-spiral` are empty. Geometry in `bk-berry-currant-red` is actually a spiral candle, despite its filename and source preview; the catalogue labels the geometry correctly. No usable source geometry is silently excluded.

Optimized GLBs stay below 1 MiB and 40k triangles per asset. `shared/models/manifest.json` and `reports/asset-conversion.json` contain before/after sizes, triangle counts and tolerances. Large organic assets target 32k triangles with 0.001 simplification error; six require 0.01. Textures are replaced by authored PBR materials and regional vertex colors, so the original photographic surface detail is not retained.

## Assembly and interaction

Quantized position and normal attributes are converted to Float32 before world transforms. This prevents clamped geometry when baking large node scales. The supplied inspector's unit conversion is corrected to meters ×1000; normalization computes its final pivot after scaling.

Assembly rules account for each component's actual role and orientation: horizontal pastries, upward flower heads, packaging mouths, ribbon surfaces, whole-ring settings, cuff geometry, gemstone face axes and separate prong sockets. Findings select compatible bases, and changing a base clears its previous fittings. Rings have sizes; other jewelry hides that control. Scene framing samples transformed vertices and preserves the current orbit when changing details.

Cake studios support layers, pastry sets, fillings, decoration quantities, layout and toppers. Glaze and borders are single coverings; quantities and estimates share the normalized state. Flower studios support five varieties and at most 33 visible stems, foliage, seven containers and three ribbons. Stones from both packs are searchable by shape and collection. All studios include undo/redo, presets, camera poses, draft persistence, JSON export, PNG capture and cart integration. Mobile selection keeps a compact live preview visible.

The capsule shows illustrative silhouettes in available colors, real catalogue prices, sizes and stock by store. Unavailable sizes disable adding the three-item capsule; compatible cart lines use the existing store schema.

Designs and demo orders remain in the browser. Preview JPEGs use the existing IndexedDB photo store, and cart JSON keeps image references. WebGL fallback preserves selection and estimates. Jewelry sockets are visual assembly guides rather than manufacturing CAD, and transmission approximates gem optics.

## Reproduce conversion and reviews

```powershell
node tools/convert-models.mjs 'C:/webcum/3d-models/готово'
node tools/extract-stones.mjs
node tools/build-catalogue.mjs
node tools/source-coverage.mjs
python tools/inspect_glb.py --selftest
npm run build
npm test
node tools/browser-checks.mjs
node tools/review-all-models.mjs
node tools/review-presets.mjs
node tools/write-review-gallery.mjs
```

Conversion resumes existing manifest entries; remove an entry to reconvert its source. `extract-stones.mjs` currently uses the supplied source directory. `render-atlas.mjs` uses the diagnostic viewer in `tools/model-audit.html`; build it with `npx esbuild shared/audit.js --bundle --format=esm --minify --outfile=shared/audit.bundle.js` before regenerating thumbnails.

14 automated tests cover transformed pivots, quantized baking, resource disposal, normalized counts, compatible fittings, cart identity, and Khronos validation of all 190 optimized files. CI rebuilds the runtime bundle and runs the test suite.

The Chrome integration suite checks category navigation, search, undo/redo, persistence, exports, cart schemas and saved-design editing, presets and camera poses, stable geometry counts, mobile overflow and compact previews, context recovery and disabled-WebGL fallback, all store home pages and the fashion capsule. `reports/revision-2/` includes 564 assembled screenshots from three camera poses per detail, contact sheets, desktop/mobile page captures and machine-readable results. Visual review complements these checks; screenshots do not establish correctness of every possible user combination.
