import sharp from "sharp";
import {readFile,writeFile,mkdir} from "node:fs/promises";
const dir="reports/revision-5/patterns", rows=JSON.parse(await readFile(`${dir}/results-all.json`,"utf8"));
await mkdir(`${dir}/contacts`,{recursive:true});
for(let page=0;page<Math.ceil(rows.length/6);page++){
 const batch=rows.slice(page*6,page*6+6),layers=[];
 for(const [row,r] of batch.entries()){
  for(const [col,pose] of ["front","side","top","back"].entries())layers.push({input:await sharp(`${dir}/${r.kind}-${r.pattern}-${pose}.jpg`).resize(300,225).toBuffer(),left:col*300,top:row*250});
  layers.push({input:Buffer.from(`<svg width="1200" height="25"><rect width="1200" height="25" fill="white"/><text x="10" y="18" font-size="14">${r.kind} / ${r.pattern} — front / side / top / back</text></svg>`),left:0,top:row*250+225});
 }
 await sharp({create:{width:1200,height:batch.length*250,channels:3,background:"white"}}).composite(layers).jpeg({quality:94}).toFile(`${dir}/contacts/page-${page}.jpg`);
}
console.log(rows.length,"patterns");
