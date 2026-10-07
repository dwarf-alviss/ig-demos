# Working checkpoint — 2026-10-07

Continue the existing implementation. Files and fresh verification results take precedence over earlier status messages. This is a working map, not a declaration of completion.

## DONE

- Original GLB conversion, full source audit, extraction of 100 individual stones, preservation of UV/base/normal/roughness maps for 61 food/botanical models are committed in earlier revisions. Preserve these assets, measurements and conversion tools.
- Current uncommitted revision 4 has a real domain database: 55 primary-source records, 48 material profiles, 70 food components (63 used), 30 plants (22 used), 34 jewelry modules, 13 cut profiles. Public constructions: 25 recipes, 12 bouquets, 24 jewelry designs.
- `shared/domain.js` indexes the database. `recipe-cake.js`, `composed-bouquet.js`, `constructed-jewelry.js` assemble domain constructions. `domain-materials.js` implements physical material parameters and locally generated microstructure. `botanical-components.js` models volumetric petals, leaves and branches.
- Cakes: layer stacks with actual thickness, matching plated slice, heart/rectangle/hex cut geometry, separate thin coatings, source pastry textures, measured pastry support, different ingredient footprints, limited decoration capacity, supported tiers with boards/dowels, macaron feet and filling, Fraisier edge strawberries. Cut strawberry flesh now has a generated fibrous color map.
- Flowers: focal/secondary/filler/foliage roles, measured individual head dimensions and calibrated depth, garden species interleaving, mono/fan/foam/bridal/cascade forms, natural color restrictions and appropriate initial palettes. Hidden flower geometry and shadows are clipped at container openings. Actual native branches are retained.
- Jewelry: selected inner diameter, swept metal profiles, individual gemstone contour/girdle measurements, scaled prongs and gallery, channel walls, bypass shoulders, separate parallel three-metal bands, earrings with posts/backs or hinged hoops, connected cable/curb/Figaro links, clasps and repeated tennis settings.
- State/UI corrections: mandatory stones cannot silently disappear from saved state, default cuts are selected when changing a design, boxes/baskets/bound bridal arrangements normalize the actual packaging, pastry quantities and toppers affect estimates, three-metal material labels match the assembly, ingredient quantities stop at physical capacity, bouquet total is capped at 33.
- Domain presets/catalogues and actual scene thumbnails are integrated. Existing undo/redo, draft persistence, camera controls, exports, screenshot capture and cart editing remain. “Свободная сборка” exposes the original asset assembly mode; choosing its native base no longer switches back to a domain construction automatically.
- Project themes remain distinct: rounded warm confectionery, botanical editorial rules, dark metal atelier. Tiny catalogue/control labels were enlarged. Thumbnail white bars were removed. Mobile review capture scrolls to the top before taking a full-page screenshot.
- Encoding mistake from a PowerShell/Python default CP1251 read was repaired in `studio.js` and `recipe-cake.js`. Always read UTF-8 explicitly and write UTF-8 bytes; retain LF endings.
- Latest completed full test suite: 36 passed. Latest domain-only suite: 8 passed, including a newly added stem-opening test (full suite should now contain 37).
- Latest completed browser stress report: 742 cases, no JavaScript errors; includes all 102 catalogue stones in compatible constructions, five metals/four finishes across 24 designs, maximum pastry/decor/flower cases, and context restoration.
- Latest completed UI report: all three studios passed undo/redo, reload, cart editing, mobile overflow and missing-resource checks, plus original asset-mode selection. Reports contain 122 pattern images (61 constructions × two poses).

## IN PROGRESS — exact continuation point

- Last actual action before context restoration: formatted `composed-bouquet.js` and `constructed-jewelry.js`, rebuilt `shared/studio.bundle.js`. Those source files and the bundle are dated approximately 10:24 UTC.
- New stem paths go from binding/foam through `stemMouthPoint()` inside the measured opening before reaching the flower. Leaves attach above that point. The eight domain tests pass; final browser reports still need regeneration after this change.
- New `attachWrapperRibbon()` in `wrap-twine.js` reuses the established measured body-ray calibration for the native jute loop and locates bows on the actual wrapper surface. The jute rotation was briefly inserted into the wrapper load by an imprecise patch, then moved to the ribbon load. Verify actual latest code and jute/null-ribbon cases before accepting.
- Two additional supports now join the Trilogy side casts to the wide shank. They are built but not yet visually reviewed.
- Previous UI/stress reports are dated 10:22–10:23 UTC and therefore DO NOT verify these latest geometry edits. Some flower screenshots were captured before the final jute-rotation correction. Do not reuse them as final evidence.
- No running preview review process is required to preserve: the last flower review session completed. The local Python server at `http://127.0.0.1:8765/` should stay available.

## TODO — proceed without restarting

1. Verify latest source for ribbon rotation, nullable ribbon, measured surface attachment and correct connection of every stem through its opening. Visually inspect native jute in paper, narrow bottle, glass, hatbox and basket; inspect satin/rep bows and bridal binding. Add only meaningful regression checks.
2. Render and inspect Trilogy from front/top/side after its side supports were added; inspect bezel/prong bearing contact, bypass, channel, hoop hinge, tennis links and stone variants. Preserve source contours rather than imposing one generic gemstone shape.
3. Refresh flower/jewelry pattern images affected by the latest edits. Inspect every major class and both poses via actual images, including procedural flower anatomy and large bouquets. Fix observed defects and rerun affected cases.
4. Extend physical browser stress checks to packaging/ribbon combinations and assert recorded mouth points fit measured openings. Existing 742-case report does not cover all packaging variants. Keep numerical constraints separate from visual judgment; do not claim exhaustive arbitrary combinations.
5. Finish material/reference review: primary product screenshots exist privately for Opera, Fraisier sources, heart mousse cake, choux, garden/winter flowers and Trilogy. Some storefronts (Ladurée/Tiffany/Luthers) returned no usable rendered product image. Their absence is not visual validation; use another accessible primary reference when that class needs it.
6. Rerun full `npm test`, current pattern/stress/UI browser tools after final code freeze. Check native free assembly still works and exports/context restoration remain intact. Avoid enormous redundant screenshot matrices; retain structured case results and useful visual evidence.
7. Regenerate domain thumbnails and `reports/revision-4/index.html`/contact sheets only after scene screenshots are current. Inspect fresh desktop/mobile screenshots. Remove obsolete derived UI montages containing blank floating preview stages.
8. Update README and this checkpoint to match actual results and case counts. Document calibrated dimensions/material approximations honestly. The generator script must reproduce the checked-in domain JSON.
9. Normalize text LF, inspect staged diff and artifact size, ensure no secret/private reference photographs are staged, commit revision 4, push the existing branch and update existing draft PR #1. Check CI. Do not create a duplicate PR, merge main or deploy without an explicit request.

## KNOWN ISSUES / limits to retain

- “Technically renders” is insufficient: photographs show rounded/glossy mousse coatings and irregular botanical forms. Current models still require the visual gate above; do not label the result ideal or complete solely because tests pass.
- Primary reference product photographs stay in `.git/reference-review`; only original generated textures, our screenshots and source links belong in the shipped project.
- Some researched components/plants are not used by public patterns. The database records availability; do not present all records as implemented selectable compositions.
- Subsurface is a low-transmission/backlighting approximation, not spectral BSSRDF. Gem transmission is Three.js PBR, not production ray tracing. Jewelry is visual assembly, not manufacturing tolerance CAD.
- Original source defects: spiral candle files are empty; the source folder named red currant contains a spiral candle. Preserve explicit catalogue/source audit labeling.
- Do not use the old revision-3 matrix as evidence for the new domain assemblers. Keep original-source coverage and revision-4 verification distinct.

## REQUIREMENTS

- Read both pasted task files in attachments; the latest one requires continuity/checkpoint and immediate continuation, not a status-only response.
- Substantial researched component database must drive construction, proportions, materials and compatibility. Avoid arbitrary combinations and cosmetic JSON disconnected from rendering.
- Cakes need actual layered interiors, correct pastry materials, realistic relative berry sizes, meaningful tiering and a plated slice. Decorations must be supported and non-overlapping.
- Bouquets must physically assemble with focal/secondary/filler/foliage roles, actual stems, variable flower anatomy, appropriate density, wrapping and ribbon attachment. Prevent leaves/stems escaping through the sides of packaging.
- Jewelry must use actual profiles, casts, girdle contact, compatible cuts, connectors, metal finishes and all supplied stone geometry. Native multi-socket pavé uses one compatible shape/color across its row.
- Preserve all valid supplied assets and existing functional interactions. Visually distinct projects should demonstrate considered UI/UX, including mobile usability.
- Compare rendered major classes against real primary references, inspect actual pixels, iterate until remaining observed failures are resolved. Do not replace work with a long report or end after the first build.
- No repeat questions about already recoverable requirements. No subagent delegation is authorized. Do not print or commit repository credentials.

## DECISIONS / repository continuity

- Worktree: `C:/Users/ph1zpunk/Documents/ChatGPT/портфолио`; existing branch `codex/portfolio-configurators`, last committed head `7150adf`. Current revision 4 is uncommitted; preserve all of it.
- Existing attached draft PR: `https://github.com/dwarf-alviss/ig-demos/pull/1`. Continue it rather than opening another.
- Source geometry: `C:/webcum/3d-models/готово`, including `jw-stone`; conversion instructions and inspector remain external originals, with corrected local tools retained.
- Scene units are centimeters, Y up. GLTF source node transforms, quantized attributes, stone face axes, bottom/socket pivots and native textures must survive conversion/placement.
- Database generated by `tools/create-domain-database.py`; published measurements are separate from renderer calibration. Initial botanical palettes and per-species depth calibration now live in the database.
- Default mode uses curated domain constructions; explicit native free assembly remains available. Saved pattern `null` intentionally means free assembly and survives reload.
- Node/Three.js/Playwright versions are pinned in package files; use installed Chrome for actual WebGL QA. The static bundle avoids runtime CDN imports. Keep the existing local preview server running.


## Continuation — latest verified state

- Database regenerated with 58 primary sources, including RHS Astrantia/ivy and University of Michigan sweet-pea morphology. Individual stem diameters are explicit renderer calibration.
- Procedural petals now have UVs, vertex color variation, outward face/edge normals and finer fan contours. Sweet pea has standard, two wings and two keel halves. Astrantia umbels expose compact individual florets above the receptacle; filler branches use small sparse leaves.
- Hand-tied stems now use individual phyllotactic binding/bottom points, sized by species diameter; previous coincident glass-vase stem appearance corrected. Recorded mouth points remain inside actual openings.
- Latest full tests: 39 passed; procedural UV/normal regression included.
- 36 packaging/ribbon constructions were freshly rendered from front/back/top; inspect contact sheets in containers. Last stem-bundle diameter refinement follows this capture, so final refresh is still required.
- Browser shutdown on this Windows host hung in synchronous taskkill; review-runtime owns a separate Chrome server and terminates only its spawned root PID through Node. Review scripts explicitly exit after artifacts are saved to close lingering browser pipes.
- Current working processes: final flower/jewelry pattern captures, thumbnails/UI/gallery pipeline; stress run with 1562 cases (100 cakes, 880 flower combinations, 582 jewelry combinations). Results are append-only, keyed by bundle SHA256, resumable only for identical builds. Older 742-case results do not validate the latest bundle.
- One screenshot write had a transient Windows UNKNOWN/open error; disk space verified 18+GB free, file readable. Repeat captures running; do not claim that interrupted run completed.
- Remaining: inspect fresh patterns/Trilogy/mobile, finish stress/UI, refresh final container shots, update README/report counts, stage UTF8/LF artifacts, commit/push and update existing draft PR.


## Continuation — geometry frozen, final matrix running

- Current bundle includes the final species-sized separated stem bundle and corrected petal boundary normals. Do not modify source or regenerate the bundle during the matrix run unless an actual failure requires it.
- Full suite rerun after these changes: 39/39 passed. All three UI checks passed; all six JSON/PNG export checks passed. Fresh flower/jewelry two-pose captures and thumbnails/gallery completed.
- 36 three-pose container combinations completed; front/back/top contact sheets inspected, including native jute, both bow assets, glass stems and bridal binding. Trilogy fresh front/top images show joined side supports and real contour seats.
- Stress review now saves and checks a nonempty image for every case, rather than only representative shots. Append-only progress stores visual metadata and actual normalized states, deduplicated for the exact bundle hash. Latest own process session 31274; final target 1562 cases. Do not claim final count until results.json is written and inspected.
- All 100 cake maximum-state shots inspected through cakes-1 contact sheet; all 100 garden bouquet pack/ribbon/palette shots inspected through flowers-garden-pink. More flower/jewelry contact sheets still need inspection as groups complete.
- README target count updated to1562; this remains pending until actual full run completes. Gallery exposes stress/index.html, container contact and export results. Local progress.jsonl is gitignored; final image/results artifacts will be committed. Private reference photos stay in .git.
- Obsolete blank UI montages, unlabeled duplicate container sheets and old flower maximum shots removed by verified literal workspace paths. Credential pattern scan across 78 UTF8 source files found zero matches.
- Remaining: finish actual stress run and inspect all group sheets; ensure final count/hash/noerrors; update checkpoint as current truth; normalize/stage only changed UTF8 files; commit/push existing branch and update existing draft PR; confirm GitHub checks; open review gallery.
