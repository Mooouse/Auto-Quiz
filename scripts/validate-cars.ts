import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateCatalog} from '../games/auto-quiz/data/catalog.ts';
const root=resolve('public');const data=JSON.parse(readFileSync(resolve(root,'data/cars.json'),'utf8'));const result=validateCatalog(data);const errors=result.issues.map(x=>`${x.code}: ${x.detail}`);
for(const c of result.cars){const file=resolve(root,c.image);if(!file.startsWith(root+'/'))errors.push(`Unsafe path: ${c.image}`);else if(!existsSync(file))errors.push(`Missing PNG: ${c.image}`);else {const b=readFileSync(file);if(b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')errors.push(`Invalid PNG: ${c.image}`);}}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Catalogue valid: ${result.cars.length} cars.${result.cars.length?'':' Empty by design: add your PNGs and explicit metadata before playing.'}`);
