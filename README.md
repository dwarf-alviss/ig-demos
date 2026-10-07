# Portfolio studios

Four static stores with distinct visual identities and an interactive portfolio index. Three Three.js studios assemble the supplied cake, flower and jewelry assets; the fashion capsule uses catalogue products and labelled garment sketches.

## Run

```powershell
npm ci
npm run build
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/ . The committed bundle includes Three.js and MeshoptDecoder, without CDN dependencies. The visual review gallery is at `/reports/revision-3/gallery.html`.

## Complete source coverage

`reports/revision-2/source-coverage.json` audits all 242 GLB files in 90 source directories. Every nonempty source group is represented. White/albedo/textured variants have identical position/index data and transforms, verified by geometry hashes; revision 3 retains the supplied base-color, normal and roughness maps for all 61 food/botanical assets. Jewelry uses code-authored metal and gem materials.

188 selectable parts consist of 88 standalone assets and 100 individually extracted stones: 12 diamond cuts and 11 gemstone shapes in 8 colors. Collection labels and grid offsets are omitted from the extracted stones. The original optimized collection files remain available for provenance but are not displayed as single gemstones.

Source defects are explicit: all files in `bk-topper-candle-spiral` are empty. Geometry in `bk-berry-currant-red` is actually a spiral candle, despite its filename and source preview; the catalogue labels the geometry correctly. No usable source geometry is silently excluded.

Optimized GLBs stay below 1 MiB and 40k triangles per asset. The 61 textured models in `shared/models/textured/` retain UVs and three surface maps, compressed to WebP. The original geometry-only conversions remain for provenance. `reports/revision-3/textures.json` lists resulting budgets. Gerbera requires attribute-aware permissive simplification (measured geometric error 0.00267); the other textured conversions use successive tolerance limits of 0.001, 0.01 and 0.03 where necessary. Original dough, chocolate, fruit, leaf and packaging colors are preserved. Flower tint masks leave green leaves and dark/yellow centers unchanged. “Исходные оттенки” bypasses the petal tint and preserves all supplied botanical colors.

## Assembly and interaction

Quantized position and normal attributes are converted to Float32 before world transforms. This prevents clamped geometry when baking large node scales. The supplied inspector's unit conversion is corrected to meters ×1000; normalization computes its final pivot after scaling.

Assembly rules account for each component's actual role and orientation: horizontal pastries, upward flower heads, packaging mouths, ribbon surfaces, whole-ring settings, cuff geometry, gemstone face axes and separate prong sockets. Findings select compatible bases, and changing a base clears its previous fittings. Rings have sizes; other jewelry hides that control. Scene framing samples transformed vertices and preserves the current orbit when changing details. The renderer redraws on scene/camera changes rather than continuously consuming GPU while idle.

Cake studios support one to three physical tiers and a separate tasting slice showing biscuit and four filling choices. Per-asset centimeter dimensions distinguish blueberries from strawberries, macarons and wafers. Footprints measured from the displayed textured meshes reserve tier shelves and topper positions, with at least 3.5% radial margin plus spacing between seats. An 81×81 height field sampled from each displayed pastry places decoration undersides on curved cream and rejects holes and missing support. Long wafers and chocolate shards lie flat on the plate or shallow pastries, with footprints measured in both orientations. Selecting them reserves extra plate area, including six-piece pastry sets. Decorations also fit around pastries on their plate; six eclairs use two rows rather than one circular layout. Small pastries support wide two-stick banners on the plate. Sprinkles and foil respect occupied decoration footprints. Hexagon borders trace the polygon. Glaze and borders are single coverings; quantities and estimates share the normalized state. Flower studios support five varieties and at most 33 visible stems, foliage, seven containers and three ribbons. Each of seven flower containers has its own mouth, rim and body dimensions. Visible foliage is clipped above the rim, stems pass through the opening, bows attach to the body and the supplied twine geometry follows 72 measured body rays, preserving its UVs. Clipped flower and leaf geometry also clips its shadow. Eight foliage profiles set height, spread and inclination. A transparent glass cylinder exposes its stems. Stones from both packs are searchable by shape and collection. Fixed sockets restrict incompatible forms; free bands offer all 102 stones with adapted casts. Pavé uses 44 measured round sockets and one color choice for the row. Cocktail rings hold two stones; halo rings hold one center and 16 accents. The estimate charges for all 44 pavé or two cocktail main stones. These sockets are visual assemblies, not manufacturing tolerances. All studios include undo/redo, presets, camera poses, draft persistence, JSON export, PNG capture and cart integration. Mobile selection keeps a compact live preview visible.

The capsule shows illustrative silhouettes in available colors, real catalogue prices, sizes and stock by store. Unavailable sizes disable adding the three-item capsule; compatible cart lines use the existing store schema.

Designs and demo orders remain in the browser. Preview JPEGs use the existing IndexedDB photo store, and cart JSON keeps image references. WebGL fallback preserves selection and estimates. Jewelry sockets are visual assembly guides rather than manufacturing CAD, and transmission approximates gem optics.

## Reproduce conversion and reviews

```powershell
node tools/convert-models.mjs 'C:/webcum/3d-models/готово'
node tools/extract-stones.mjs
node tools/build-catalogue.mjs
node tools/restore-textures.mjs
node tools/calibrate-sockets.mjs
node tools/measure-cake-footprints.mjs
node tools/calibrate-pastry-surfaces.mjs
node tools/calibrate-container-mouths.mjs
node tools/source-coverage.mjs
python tools/inspect_glb.py --selftest
npm run build
npm test
node tools/browser-checks.mjs
node tools/review-all-models.mjs
node tools/review-presets.mjs
node tools/write-review-gallery.mjs
node tools/review-combinations.mjs flowers
node tools/review-combinations.mjs cakes
node tools/review-combinations.mjs jewelry
node tools/contact-combinations.mjs flowers
node tools/contact-combinations.mjs cakes
node tools/contact-combinations.mjs jewelry
node tools/check-assembly-matrix.mjs
node tools/check-review-images.mjs
node tools/write-combination-gallery.mjs
node tools/check-review-gallery.mjs
```

Conversion resumes existing manifest entries; remove an entry to reconvert its source. `extract-stones.mjs` currently uses the supplied source directory. `render-atlas.mjs` uses the diagnostic viewer in `tools/model-audit.html`; build it with `npx esbuild shared/audit.js --bundle --format=esm --minify --outfile=shared/audit.bundle.js` before regenerating thumbnails.

29 automated tests cover transformed pivots, quantized baking, resource disposal, normalized counts, physical quantity limits, compatible fittings, cart identity, and Khronos validation of all 190 geometry files plus the 61 UV/PBR files, socket compatibility, separated eclair rows, real pastry support masks, wrapping rims, fitted twine and footprint constraints. CI rebuilds the runtime bundle and runs the test suite.

The Chrome integration suite checks category navigation, search, undo/redo, persistence, exports, cart schemas and saved-design editing, presets and camera poses, stable geometry counts, mobile overflow and compact previews, context recovery and disabled-WebGL fallback, all store home pages and the fashion capsule. `reports/revision-2/` includes 564 assembled screenshots from three camera poses per detail, contact sheets, desktop/mobile page captures and machine-readable results. Visual review complements these checks; screenshots do not establish correctness of every possible user combination.


Revision 3 adds a reproducible finite matrix of flower container × flower × foliage × ribbon combinations plus maximum mixed bouquets; cake form × amount × decor × topper and every pair of decorations; jewelry base × compatible setting × stone. The gallery stores the exact normalized state and can reopen it in the studio. Results and framing metrics are in `reports/revision-3/results-*.json`; current totals are in `summary.json`. This matrix does not exhaust arbitrary multi-variety selections, all counts or all colors. Visual findings are recorded separately from automatic rendering/geometry checks; a screenshot alone is not proof of collision-free geometry.

Large matrix reviews can be split with `REVIEW_START` and `REVIEW_END` (exclusive); `REVIEW_RESUME=1` reuses matching completed states from the main result file. After all chunks finish, `node tools/merge-review-shards.mjs cakes` validates states and combines them. A normal invocation needs no environment variables.

For the flat-decoration revision, `REVIEW_REUSE=1 node tools/review-combinations.mjs cakes` keeps exact-state screenshots of unchanged cases and rerenders every wafer or chocolate-shard case. This reuse rule is specific to that revision; other geometry changes require a fresh review.

When only normalization has changed and displayed geometry is identical, `REVIEW_REUSE_STABLE=1` allows reuse of any exact matching state whose visible decoration count agrees with its recorded quantities. Do not use this override after material or geometry changes.
