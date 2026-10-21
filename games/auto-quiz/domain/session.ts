import {checkAnswer} from './answers.ts';
import {filterCars,sessionRequirement} from '../data/catalog.ts';
import {buildQueue,makeQuestion} from './questions.ts';
import {scoreAnswer} from './scoring.ts';
import {isChoice,type Car,type SessionConfig,type SessionController,type SessionSnapshot,type SessionSummary,type AnswerResult,type EndReason,type Question} from './types.ts';
export class LocalSession implements SessionController {
 private config:SessionConfig; private id:string; private queue:Car[]; private pool:Car[]; private random:()=>number;
 private index=0; private score=0; private correct=0; private errors=0; private streak=0; private maxStreak=0;
 private elapsed=0;private questionElapsed=0;private last:number;private paused=true;
 private phase:'question'|'feedback'|'finished'='question';private current:Question;private answer:AnswerResult|null=null;private answers:AnswerResult[]=[];private result:SessionSummary|null=null;
 constructor(cars:Car[],config:SessionConfig,opts:{random:()=>number;recent:string[];now:number;id:string}){
  if(!sessionRequirement(cars,config).ok)throw new Error('INSUFFICIENT_CARS');
  this.config={...config};this.id=opts.id;this.random=opts.random;this.last=opts.now;this.pool=filterCars(cars,config);
  this.queue=buildQueue(this.pool,opts.recent,opts.random);if(config.format==='classic')this.queue=this.queue.slice(0,10);
  this.current=makeQuestion(this.queue[0],this.pool,config.mode,0,this.random);
 }
 private advanceClock(now:number){const dt=Math.max(0,now-this.last);this.last=now;if(!this.paused&&this.phase!=='finished'){this.elapsed+=dt;if(this.phase==='question')this.questionElapsed+=dt;}}
 tick(now:number){this.advanceClock(now);if(this.config.format==='timed'&&this.elapsed>=60000&&this.phase!=='finished')this.finish('time',now);}
 snapshot():SessionSnapshot{return {phase:this.phase,question:this.phase==='finished'?null:this.current,index:this.index+1,score:this.score,correct:this.correct,errors:this.errors,streak:this.streak,remainingMs:Math.max(0,60000-this.elapsed),answer:this.answer,paused:this.paused};}
 submit(value:string,now:number):AnswerResult|null{
  this.tick(now);if(this.phase!=='question'||this.paused||!value.trim())return null;
  if(isChoice(this.config.mode)&&!this.current.options.some(c=>c.id===value))return null;
  const correct=isChoice(this.config.mode)?value===this.current.car.id:value!=='__SKIP__'&&checkAnswer(this.current.car,value);
  this.streak=correct?this.streak+1:0;this.maxStreak=Math.max(this.streak,this.maxStreak);if(correct)this.correct++;else this.errors++;
  const rewards=scoreAnswer(this.config.mode,this.config.format,correct,this.streak,this.questionElapsed);
  this.score+=rewards.points;this.answer={questionId:this.current.id,carId:this.current.car.id,correct,submitted:value,...rewards,streak:this.streak,responseMs:Math.round(this.questionElapsed)};
  this.answers.push(this.answer);this.phase='feedback';return {...this.answer};
 }
 next(now:number):boolean{
  this.tick(now);if(this.phase!=='feedback'||this.paused)return false;
  if(this.config.format==='marathon'&&this.errors>=3){this.finish('mistakes',now);return false;}
  if(this.index+1>=this.queue.length){this.finish(this.config.format==='classic'?'complete':'exhausted',now);return false;}
  this.index++;this.current=makeQuestion(this.queue[this.index],this.pool,this.config.mode,this.index,this.random);this.answer=null;this.questionElapsed=0;this.phase='question';this.paused=true;return true;
 }
 pause(now:number){this.tick(now);this.paused=true;}
 resume(now:number){this.last=now;if(this.phase!=='finished')this.paused=false;}
 finish(reason:EndReason,now:number):SessionSummary{if(this.result)return this.result;this.advanceClock(now);this.phase='finished';this.paused=true;this.result={id:this.id,config:{...this.config},score:this.score,correct:this.correct,errors:this.errors,answered:this.answers.length,maxStreak:this.maxStreak,elapsedMs:Math.round(this.elapsed),reason,answers:[...this.answers]};return this.result;}
 summary(){return this.result;}
 peekNext(){return this.queue[this.index+1]??null;}
}
