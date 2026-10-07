# Revision 4 — current working checkpoint

Implementation and visual verification are complete for the supported constructions. Read actual Git state before continuing; do not repeat the original conversion or replace working assemblies.

## DONE

- Source database: 58 primary references, 48 material profiles, 70 food components (63 used), 30 plants (22 used), 34 jewelry modules, 13 cut profiles. Public constructions: 25 cake/pastry recipes, 12 bouquets, 24 jewelry designs.
- Original conversion and source coverage retained: 242 GLBs in 90 groups, 188 selectable parts, 100 individually extracted stones; 61 food/botanical models retain UV/base/normal/roughness maps. Empty spiral-candle sources and mislabeled red-currant geometry remain explicitly documented.
- Cakes: actual layers and matching plated slice, individual berry/decor footprints, measured source pastry support, supported tiers with boards/dowels, textured pastries, macaron shells/feet/filling, Paris-Brest choux, cut Fraisier strawberries and recipe-specific finishes.
- Flowers: focal/secondary/filler/foliage roles, individual dimensions/depth/stem diameter, natural palettes, garden/mono/line/foam/bridal/cascade assemblies. Separate stems pass through measured mouths; leaves remain above wrapping. Native ribbons fit the actual wrapper body. Procedural flowers have volumetric petals, UVs, outward normals, vertex variation, correct sweet-pea petal roles and compact Astrantia umbels.
- Detailed procedural heads are batched by material without removing triangles. Actual maximum autumn reference:8,295 → 1,533 draw calls; matrix maximum 1,537, below the 2,000 budget. Source garden geometry remains 497 calls. Performance regression and reproducible browser measurement retained.
- Jewelry: selected inner diameter, native gemstone contours/girdles, prong/bezel/channel support, bypass shoulders, supported Trilogy side stones, separate three-metal bands, earring posts/backs/hinges, connected chains and clasps, repeated tennis settings. All 100 extracted stones and 2 original stones available in compatible constructions.
- UI: three distinct themes; contextual materials/covers/cuts/counts; meaningful bouquet sizes and pastry quantities. Free assembly retains all valid native parts. Undo/redo, persistence, cart editing, mobile controls and actual PNG/JSON exports remain working.

## VERIFIED

- npm test: 40 passed, 0 failed, including valid GLBs, texture retention, source coverage, seats, openings, UV/normals, flower mesh batching and stable configurations.
- All 61 patterns freshly captured front/top:122images. All 36 container/ribbon cases captured front/back/top:108images; contact sheets inspected.
- Final browser matrix: 1,562 distinct cases, successful exit 0; 100 cakes, 880 flowers, 582 jewelry. Every case saves a scene image and checks actual normalized state, nonempty pixels, projected framing; flowers additionally check mouth points and draw-call budget. WebGL context loss/restoration passed in all 3 studios.
- UI checks passed all 3 studios: selection, undo/redo, reload, cart editing, mobile overflow, resources and native free mode. All 6 actual JSON/PNG downloads passed.
- Inspected cake/flower/jewelry pattern sheets, packing front/back/top, procedural component thumbnails, desktop/mobile pages, all flower combination groups and all 6 jewelry combination sheets. Major classes compared with actual primary-source product photographs; those photos remain private in.git/reference-review.
- Tested bundle SHA256:e072fe40bc5b3f19676292de92cdd379ec5974abd3332583ffae78386a22951c. Source has not changed since this run. validation.json and stress/results.json are the final numerical proof; gallery:index.html, combination gallery:stress/index.html.

## IN PROGRESS / TODO

- No remaining implementation or verification failures in the reviewed supported cases. Git/PR synchronization is performed separately; inspect git log/status and GitHub checks for HEAD before further changes.
- Local progress.jsonl is a gitignored resumable cache keyed by bundle SHA256. Do not reuse old-cache rows for a changed bundle. Historical working notes preserved locally in.git/checkpoint-revision4-history.md.

## DECISIONS / LIMITS TO PRESERVE

- Workspace:C:/Users/ph1zpunk/Documents/ChatGPT/портфолио; branch:codex/portfolio-configurators; existingdraftPR:https://github.com/dwarf-alviss/ig-demos/pull/1. Continue this branch/PR; do not merge or deploy main without a request.
- Database generator:tools/create-domain-database.py. Published measurements are separate from renderer calibration. Do not present researched but inactive records as selectable finished constructions.
- Scene units: centimeters, Y up. Preserve source transforms, quantized-attribute decoding, UVs, native colors and individual stone contours. These are visual constructions/reference adaptations, not manufacturing CAD; PBR transmission is not ray-traced gemstone optics or spectral BSSRDF.
- The 1,562-case matrix covers the enumerated compatible variants and maximum loads; do not claim every possible continuous angle or arbitrary future free combination is flawless.
- InstalledChrome/Playwright is used for actual WebGL QA. review-runtime owns its browser root and terminates only that process; never kill the user's Chrome. Scripts exit after artifacts are saved because browser pipes can linger on this Windows host.
- Read/write UTF-8 explicitly, retain LF. Never print or commit the repository credential from the external variables file. No subagent delegation was authorized.
- Local preview remains at http://127.0.0.1:8765/ . Rebuild/capture only what a new change actually affects.
