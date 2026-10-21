import { BASE_POINTS, type Mode, type Format } from './types.ts';
export function scoreAnswer(mode:Mode,format:Format,correct:boolean,streak:number,responseMs:number){
 if(!correct)return {points:0,xp:0};
 const multiplier=streak>=20?1.5:streak>=10?1.3:streak>=5?1.15:1;
 const speed=format==='timed'?Math.max(0,Math.round(25*(1-Math.max(0,responseMs)/10000))):0;
 return {points:Math.round(BASE_POINTS[mode]*multiplier)+speed,xp:Math.round(BASE_POINTS[mode]/5)};
}
export const RANK_XP=[0,300,1000,2500,5000,10000,20000];
export function progress(xp:number){const level=Math.floor(Math.sqrt(Math.max(0,xp)/100))+1;const floor=(level-1)**2*100;const next=level**2*100;return {level,rank:Math.max(0,RANK_XP.findLastIndex(x=>xp>=x)),floor,next,percent:Math.max(0,Math.min(100,(xp-floor)/(next-floor)*100))};}
