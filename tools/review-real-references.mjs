import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('.git/reference-review',{recursive:true});
const references=[
 ['trilogy','https://nodeform.com/products/trudy-three-stone-engagement-ring-bezel-set-round-moissanite-trillion-side-accents'],
 ['garden','https://www.davidaustinrosebouquets.com/products/pink-taffeta'],
 ['opera','https://www.meilleurduchef.com/fr/recette/biscuit-joconde-opera-cap-patissier-video.html'],
 ['cheesecake','https://www.callebaut.com/en/recipes/caramel-cheesecake/2132'],
 ['heart','https://lafuong.com/roll-in-love'],
 ['macaron','https://laduree.com/en/pages/macarons-flavors'],
 ['stacking','https://luthersdiamonds.com/products/triple-stacking-modular-band-ring-in-14k-yellow-rose-white-gold'],
 ['stud','https://www.tiffany.com/jewelry/earrings/platinum-round-brilliant-diamonds-earrings-60006719.html'],
 ['winter','https://www.davidaustin.com/5-winter-wedding-bouquets/'],
 ['choux','https://www.kingarthurbaking.com/recipes/cream-puffs-and-eclairs-recipe']
];
const browser=await chromium.launch({channel:'chrome',headless:true});const report=[];
try{for(const [id,url]of references){const p=await browser.newPage({viewport:{width:1400,height:1000}});try{await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(1200);
 if(id==='garden'&&await p.locator('select').count()){console.log('garden options',await p.locator('select').first().locator('option').allTextContents());await p.locator('select').first().selectOption({index:1});await p.waitForTimeout(1800);}
 const imgs=await p.locator('img').evaluateAll(xs=>xs.filter(x=>x.naturalWidth>300&&x.naturalHeight>150).map(x=>({src:x.currentSrc,alt:x.alt,width:x.naturalWidth,height:x.naturalHeight})));report.push({id,url,images:imgs});
 await p.screenshot({path:'.git/reference-review/'+id+'.png'});console.log(id,imgs.slice(0,3));
 }catch(e){report.push({id,url,error:e.message});}await p.close();}}
finally{await browser.close();await writeFile('.git/reference-review/index.json',JSON.stringify(report,null,2));}
