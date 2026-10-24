import { acceptedAnswers, normalizeAnswer } from '../domain/answers.ts';
import { isChoice, type Car, type Filters, type SessionConfig } from '../domain/types.ts';
export interface CatalogIssue { code: string; detail: string }
export function validateCatalog(data: unknown): {cars: Car[]; issues: CatalogIssue[]} {
 const issues: CatalogIssue[] = [];
 if (!Array.isArray(data)) return {cars:[],issues:[{code:'array',detail:'The catalogue must be a JSON array.'}]};
 const cars: Car[]=[]; const ids=new Set<string>(); const names=new Map<string,string>();const identities=new Map<string,string>();const images=new Map<string,string>();
 for (let i=0;i<data.length;i++) {
  const row=data[i]; const at=`[${i}]`;
  if (!row || typeof row!=='object' || Array.isArray(row)) {issues.push({code:'record',detail:at});continue;}
  const r=row as Record<string,unknown>;
  const required=['id','brand','model','fullName','image'];
  if(required.some(k=>typeof r[k]!=='string'||!(r[k] as string).trim())) {issues.push({code:'required',detail:`${at}: ${required.join(', ')}`});continue;}
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.id as string)||['constructor','prototype','__proto__'].includes(r.id as string)){issues.push({code:'id',detail:`${at}: ${r.id}`});continue;}
  if(ids.has(r.id as string)){issues.push({code:'duplicate',detail:`${r.id}`});continue;} ids.add(r.id as string);
  if(!Array.isArray(r.aliases)||r.aliases.some(a=>typeof a!=='string'||!normalizeAnswer(a))){issues.push({code:'aliases',detail:`${r.id}`});continue;}
  if(!Array.isArray(r.categories)||!r.categories.length||r.categories.some(a=>typeof a!=='string'||!a.trim())){issues.push({code:'categories',detail:`${r.id}`});continue;}
  if(!Number.isInteger(r.difficulty)||Number(r.difficulty)<1||Number(r.difficulty)>5){issues.push({code:'difficulty',detail:`${r.id}`});continue;}
  // Relative, local PNGs only. No external trackers, data URLs or traversal.
  const image=(r.image as string).replace(/^\//,'').replace(/^\.\//,'');
  if(!/^(?:assets\/)?cars\/[a-zA-Z0-9_./-]+\.png$/i.test(image)||image.split('/').includes('..')){issues.push({code:'image',detail:`${r.id}: ${r.image}`});continue;}
  if(['generation','modification','years','info'].some(k=>r[k]!==undefined&&typeof r[k]!=='string')){issues.push({code:'optional',detail:`${r.id}`});continue;}
  if(r.origin!==undefined&&r.origin!=='generated'&&r.origin!=='photograph'){issues.push({code:'origin',detail:String(r.id)});continue;}
  const credit=r.credits as Record<string,unknown>|undefined;
  const keys=['author','sourceUrl','license','licenseUrl','changes'];
  if((r.origin==='photograph'&&!credit)||(credit!==undefined&&(!credit||typeof credit!=='object'||Array.isArray(credit)||keys.some(k=>typeof credit[k]!=='string'||!(credit[k] as string).trim())))){issues.push({code:'credits',detail:String(r.id)});continue;}
  if(credit){const https=(s:string)=>{try{const u=new URL(s);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password;}catch{return false;}};if(!https(credit.sourceUrl as string)||!https(credit.licenseUrl as string)){issues.push({code:'credit-url',detail:String(r.id)});continue;}}
  const car:Car={id:r.id as string,brand:(r.brand as string).trim(),model:(r.model as string).trim(),fullName:(r.fullName as string).trim(),generation:(r.generation as string)||'',modification:(r.modification as string)||'',image,aliases:r.aliases as string[],categories:[...new Set((r.categories as string[]).map(x=>x.trim()))],difficulty:r.difficulty as number,...(r.years?{years:r.years as string}:{}),...(r.info?{info:r.info as string}:{}),...(r.origin?{origin:r.origin as 'generated'|'photograph'}:{}),...(credit?{credits:{author:credit.author as string,sourceUrl:credit.sourceUrl as string,license:credit.license as string,licenseUrl:credit.licenseUrl as string,changes:credit.changes as string}}:{})};
  const identity=JSON.stringify([car.brand,car.model,car.generation,car.modification].map(normalizeAnswer));
  if(identities.has(identity))issues.push({code:'duplicate-model',detail:`${car.id} / ${identities.get(identity)}`});
  identities.set(identity,car.id);
  if(images.has(car.image))issues.push({code:'duplicate-image',detail:`${car.id} / ${images.get(car.image)}`});
  images.set(car.image,car.id);
  for(const answer of acceptedAnswers(car)){
   if(names.has(answer)&&names.get(answer)!==car.id) issues.push({code:'ambiguous',detail:`${car.id} / ${names.get(answer)}`});
   names.set(answer,car.id);
  }
  cars.push(car);
 }
 return {cars:issues.length?[]:cars,issues};
}
export function filterCars(cars:Car[],filter:Filters):Car[]{return cars.filter(c=>(!filter.brand||c.brand===filter.brand)&&(!filter.category||c.categories.includes(filter.category)));}
export function catalogFacets(cars:Car[]){return {brands:[...new Set(cars.map(c=>c.brand))].sort(),categories:[...new Set(cars.flatMap(c=>c.categories))].sort()};}
export function sessionRequirement(cars:Car[],config:SessionConfig):{available:number;required:number;ok:boolean}{const available=filterCars(cars,config).length;const required=config.format==='classic'?10:isChoice(config.mode)?4:1;return {available,required,ok:available>=required};}
