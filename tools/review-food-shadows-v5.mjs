import { build } from "esbuild";
import { reviewBrowser } from "./review-runtime.mjs";
import { mkdir, writeFile } from "node:fs/promises";
const built = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import * as THREE from 'three';
      import { ModelLibrary } from './shared/model-library.js';
      import { StudioRenderer } from './shared/studio-renderer.js';
      import { buildCake } from './shared/assemblers.js';
      import { defaults, normalize } from './shared/studio-state.js';
      const lib = new ModelLibrary();
      const stage = new StudioRenderer(document.querySelector('canvas'), document.querySelector('#viewer'), 'cakes');
      const state = normalize('cakes', { ...defaults('cakes'), pattern:null, base:'bk-pastry-cookie-heart', pieces:1, decor:['bk-berry-raspberry'], counts:{'bk-berry-raspberry':4}, topper:null });
      const root = await buildCake(lib, state, '#eee4ce');
      stage.setObject(root); cancelAnimationFrame(stage.raf); stage.loop=()=>{};
      const originalBias = stage.key.shadow.normalBias;
      window.foodShadow = (variant) => {
        stage.key.shadow.normalBias = variant === 'baseline' ? originalBias : 0;
        root.traverse(n => { if(n.isMesh) n.material.shadowSide = variant === 'two-sided' ? THREE.DoubleSide : null; });
        stage.renderer.shadowMap.needsUpdate = true;
        stage.fit('side'); stage.renderer.render(stage.scene, stage.camera);
        return {variant,normalBias:stage.key.shadow.normalBias,items:root.children.filter(n=>n.userData.asset==='bk-berry-raspberry').map(item=> {
          const b=new THREE.Box3().setFromObject(item,true);
          const ray=new THREE.Raycaster(); let minimumGap=Infinity;
          item.traverse(n=>{if(!n.isMesh)return;const a=n.geometry.attributes.position;for(let i=0;i<a.count;i+=Math.max(1,Math.floor(a.count/2000))){
            const p=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld);
            if(p.y>b.min.y+.25)continue;
            ray.set(new THREE.Vector3(p.x,30,p.z),new THREE.Vector3(0,-1,0));
            const hit=ray.intersectObjects(root.children.filter(n=>n===root.children[0]||n.userData.asset===state.base),true)[0];
            if(hit)minimumGap=Math.min(minimumGap,p.y-hit.point.y);
          }});return {minY:b.min.y,minimumGap};
        })};
      };
      window.foodShadowReady=true;
    `,
  },
  bundle: true,
  format: "esm",
  write: false,
});
await mkdir("reports/revision-5/food-shadows", { recursive: true });
const { browser, close } = await reviewBrowser();
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  page.on("pageerror", e=>console.log("PREVIEW ERROR",e.message));
  page.on("requestfailed", r=>console.log("PREVIEW NETWORK",r.url(),r.failure()?.errorText));
  await page.route("**/shared/food-shadow-diagnostic.js", route => route.fulfill({ body: Buffer.from(built.outputFiles[0].contents), contentType: "application/javascript" }));
  await page.goto("http://127.0.0.1:8766/shared/", { waitUntil: "domcontentloaded" });
  await page.setContent('<style>body{margin:0}#viewer{width:1100px;height:800px}canvas{display:block}</style><div id="viewer"><canvas></canvas></div><script type="module" src="/shared/food-shadow-diagnostic.js"></script>', { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => window.foodShadowReady, null, { timeout: 90000 });
  for (const variant of ["baseline", "zero-bias", "two-sided"]) {
    results.push(await page.evaluate(v => window.foodShadow(v), variant));
    await page.locator("canvas").screenshot({ path: `reports/revision-5/food-shadows/${variant}.jpg`, quality: 95 });
  }
  await writeFile("reports/revision-5/food-shadows/results.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await close(); }
process.exit(0);
