import type { Car, Mode, Question } from './types.ts';
import { isChoice } from './types.ts';
export function shuffle<T>(values:readonly T[],random:()=>number):T[]{const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
export function buildQueue(cars:Car[],recent:readonly string[],random:()=>number):Car[]{const last=new Set(recent.slice(-Math.min(50,Math.floor(cars.length/2))));return [...shuffle(cars.filter(c=>!last.has(c.id)),random),...shuffle(cars.filter(c=>last.has(c.id)),random)];}
export function makeQuestion(car:Car,pool:Car[],mode:Mode,index:number,random:()=>number):Question{
 if(!isChoice(mode))return {id:`${index}:${car.id}`,car,options:[]};
 const candidates=shuffle(pool.filter(c=>c.id!==car.id),random).map(c=>({car:c,similarity:(c.brand===car.brand?4:0)+c.categories.filter(x=>car.categories.includes(x)).length*2+(c.difficulty===car.difficulty?1:0)})).sort((a,b)=>b.similarity-a.similarity);
 if(candidates.length<3)throw new Error('INSUFFICIENT_OPTIONS');
 return {id:`${index}:${car.id}`,car,options:shuffle([car,...candidates.slice(0,3).map(x=>x.car)],random)};
}
export function seededRandom(seed:number):()=>number{return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
