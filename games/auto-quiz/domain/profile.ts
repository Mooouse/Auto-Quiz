import {FORMATS,MODES,isSilhouette,type Profile,type Settings,type Car,type AnswerResult,type SessionSummary,type SessionConfig,type Language,type ModeStats} from './types.ts';
export const statKey=(config:SessionConfig)=>`${config.mode}:${config.format}`;
export const emptyMode=():ModeStats=>({sessions:0,answered:0,correct:0,points:0,best:0,bestCorrect:0});
export function defaultProfile(language:Language='en'):Profile{return {version:1,nickname:'Driver',xp:0,points:0,sessions:0,answered:0,correct:0,streak:0,bestStreak:0,silhouetteCorrect:0,perfectSessions:0,cars:{},achievements:{},modes:Object.fromEntries(MODES.flatMap(m=>FORMATS.map(f=>[`${m}:${f}`,emptyMode()]))),recent:[],completedSessions:[],settings:{language,sound:true,volume:.4,reducedMotion:false,autoNext:false}};}
const finite=(x:unknown,max=1e12)=>typeof x==='number'&&Number.isFinite(x)?Math.max(0,Math.min(max,Math.floor(x))):0;
export function hydrateProfile(data:unknown,language:Language):Profile{
 const base=defaultProfile(language);if(!data||typeof data!=='object'||Array.isArray(data))return base;
 const d=data as Partial<Profile>;if(d.version!==1)return base;
 if(typeof d.nickname==='string')base.nickname=d.nickname.trim().slice(0,20)||'Driver';
 for(const k of ['xp','points','sessions','answered','correct','streak','bestStreak','silhouetteCorrect','perfectSessions'] as const)base[k]=finite(d[k]);
 base.correct=Math.min(base.correct,base.answered);
 if(d.cars&&typeof d.cars==='object')for(const [id,c] of Object.entries(d.cars)){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||['constructor','prototype','__proto__'].includes(id)||!c||typeof c!=='object')continue;
  base.cars[id]={attempts:finite(c.attempts),correct:Math.min(finite(c.correct),finite(c.attempts)),...(finite(c.unlockedAt)?{unlockedAt:finite(c.unlockedAt)}:{})};
 }
 if(d.achievements&&typeof d.achievements==='object')for(const [id,date] of Object.entries(d.achievements))if(ACHIEVEMENTS.some(a=>a.id===id)&&finite(date))base.achievements[id]=finite(date);
 if(d.modes&&typeof d.modes==='object')for(const key of Object.keys(base.modes)){const m=d.modes[key];if(m&&typeof m==='object')for(const k of Object.keys(emptyMode()) as (keyof ModeStats)[])base.modes[key][k]=finite(m[k]);}
 if(Array.isArray(d.recent))base.recent=d.recent.filter(x=>typeof x==='string').slice(-50);
 if(Array.isArray(d.completedSessions))base.completedSessions=d.completedSessions.filter(x=>typeof x==='string').slice(-100);
 if(d.settings&&typeof d.settings==='object'){
  const s=d.settings;
  if(s.language==='ru'||s.language==='en')base.settings.language=s.language;
  for(const k of ['sound','reducedMotion','autoNext'] as const)if(typeof s[k]==='boolean')base.settings[k]=s[k];
  if(typeof s.volume==='number'&&Number.isFinite(s.volume))base.settings.volume=Math.max(0,Math.min(1,s.volume));
 }
 return base;
}
export function applyAnswer(p:Profile,result:AnswerResult,car:Car,config:SessionConfig,now=Date.now()){
 p.answered++;p.points+=result.points;p.xp+=result.xp;p.streak=result.correct?p.streak+1:0;p.bestStreak=Math.max(p.bestStreak,p.streak);
 if(result.correct){p.correct++;if(isSilhouette(config.mode))p.silhouetteCorrect++;}
 const cs=p.cars[car.id]??{attempts:0,correct:0};cs.attempts++;if(result.correct){cs.correct++;cs.unlockedAt??=now;}p.cars[car.id]=cs;
 const ms=p.modes[statKey(config)]??emptyMode();ms.answered++;ms.correct+=Number(result.correct);ms.points+=result.points;p.modes[statKey(config)]=ms;
}
export function completeSession(p:Profile,result:SessionSummary){
 if(p.completedSessions.includes(result.id))return false;
 p.completedSessions.push(result.id);p.completedSessions=p.completedSessions.slice(-100);
 if(!result.answered)return false;
 p.sessions++;const ms=p.modes[statKey(result.config)]??emptyMode();ms.sessions++;
 if(result.reason!=='quit'&&result.reason!=='image'){ms.best=Math.max(ms.best,result.score);ms.bestCorrect=Math.max(ms.bestCorrect,result.correct);}
 p.modes[statKey(result.config)]=ms;
 if(result.reason==='complete'&&result.config.format==='classic'&&result.correct===10&&result.errors===0)p.perfectSessions++;
 return true;
}
export interface Achievement {id:string;target:number;icon:string;value:(p:Profile,cars:Car[])=>number}
const unlocked=(p:Profile,cars:Car[],categories:string[])=>cars.filter(c=>(p.cars[c.id]?.correct??0)>0&&c.categories.some(t=>categories.some(k=>k.toLowerCase()===t.toLowerCase()))).length;
export const ACHIEVEMENTS:Achievement[]=[
 {id:'first',target:1,icon:'spark',value:p=>p.correct},{id:'ten',target:10,icon:'flag',value:p=>p.correct},{id:'hundred',target:100,icon:'target',value:p=>p.correct},
 {id:'streak10',target:10,icon:'bolt',value:p=>p.bestStreak},{id:'streak20',target:20,icon:'bolt',value:p=>p.bestStreak},{id:'streak25',target:25,icon:'crown',value:p=>p.bestStreak},
 {id:'shadows',target:10,icon:'moon',value:p=>p.silhouetteCorrect},{id:'perfect',target:1,icon:'medal',value:p=>p.perfectSessions},
 {id:'japan',target:10,icon:'globe',value:(p,c)=>unlocked(p,c,['JDM','Japanese','JDM / Japanese','Японские'])},
 {id:'germany',target:10,icon:'shield',value:(p,c)=>unlocked(p,c,['German','Немецкие'])},
 {id:'collector',target:50,icon:'album',value:(p,c)=>c.filter(x=>(p.cars[x.id]?.correct??0)>0).length}
];
export function unlockAchievements(p:Profile,cars:Car[],now=Date.now()):string[]{const fresh:string[]=[];for(const a of ACHIEVEMENTS)if(!p.achievements[a.id]&&a.value(p,cars)>=a.target){p.achievements[a.id]=now;fresh.push(a.id);}return fresh;}
export function settingsPatch(p:Profile,patch:Partial<Settings>){p.settings={...p.settings,...patch};}
