import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkAnswer} from '../games/auto-quiz/domain/answers.ts';
import {validateCatalog,sessionRequirement,catalogFacets} from '../games/auto-quiz/data/catalog.ts';
import {LocalSession} from '../games/auto-quiz/domain/session.ts';
import {seededRandom,buildQueue,makeQuestion} from '../games/auto-quiz/domain/questions.ts';
import {scoreAnswer,progress} from '../games/auto-quiz/domain/scoring.ts';
import {defaultProfile,hydrateProfile,applyAnswer,completeSession,unlockAchievements} from '../games/auto-quiz/domain/profile.ts';
import {MODES,FORMATS,isChoice,BASE_POINTS,type Car,type Mode,type Format,type SessionConfig} from '../games/auto-quiz/domain/types.ts';
const cars:Car[]=Array.from({length:30},(_,i)=>({id:`fixture-${i}`,brand:'Fixture Motors',model:`Model ${i}`,generation:'G1',modification:'Sport',fullName:`Fixture Motors Model ${i} G1 Sport`,aliases:[`Fixture Motors Model ${i} Sport G1`],image:`cars/fixture-${i}.png`,categories:[i<15?'Japanese':'German','Sports Cars'],difficulty:2}));
const config=(mode:Mode='photo',format:Format='classic'):SessionConfig=>({mode,format,category:'',brand:''});
const create=(mode:Mode='photo',format:Format='classic',pool=cars)=>new LocalSession(pool,config(mode,format),{random:seededRandom(7),recent:[],now:0,id:`test-${mode}-${format}`});
const answer=(s:LocalSession,mode:Mode,correct=true,now=100)=>{s.resume(now-100);const q=s.snapshot().question!;return s.submit(isChoice(mode)?correct?q.car.id:q.options.find(c=>c.id!==q.car.id)!.id:correct?q.car.fullName:'Wrong Model',now);};
test('strict names normalize punctuation and accept explicit order aliases only',()=>{
 const car=cars[0];assert.equal(checkAnswer(car,' FIXTURE motors Model-0 G1, Sport! '),true);
 assert.equal(checkAnswer(car,'Fixture Motors Model 0 Sport G1'),true);
 for(const wrong of ['Fixture Motors Model 0','Fixture Motors Model 0 G2 Sport','Fixture Motors Model 0 G1 Base','Sport G1 Model 0 Fixture Motors','Fixture Motors Model 1 G1 Sport'])assert.equal(checkAnswer(car,wrong),false,wrong);
});
test('catalog validation rejects duplicates, alias collisions, unsafe paths and invalid metadata atomically',()=>{
 assert.equal(validateCatalog(cars).cars.length,30);
 for(const bad of [[cars[0],cars[0]],[cars[0],{...cars[1],aliases:[cars[0].fullName]}],[{...cars[0],image:'cars/../secret.png'}],[{...cars[0],difficulty:0}],[{...cars[0],id:'constructor'}],[{...cars[0],image:'https://example.com/a.png'}]]){
  const v=validateCatalog(bad);assert.ok(v.issues.length);assert.equal(v.cars.length,0);
 }
 assert.equal(validateCatalog({}).cars.length,0);
});
test('facets and minimum counts reflect the filtered catalogue',()=>{
 assert.deepEqual(catalogFacets(cars).categories,['German','Japanese','Sports Cars']);
 assert.equal(sessionRequirement(cars.slice(0,9),config()).ok,false);
 assert.equal(sessionRequirement(cars.slice(0,3),config('silhouette','timed')).ok,false);
 assert.equal(sessionRequirement(cars.slice(0,1),config('expert','marathon')).ok,true);
 assert.equal(sessionRequirement(cars,{...config(),brand:'Absent'}).available,0);
 assert.throws(()=>create('photo','classic',cars.slice(0,9)),/INSUFFICIENT_CARS/);
});
test('questions prefer related distractors, all unique, with exactly one accepted answer',()=>{
 const q=makeQuestion(cars[0],cars,'photo',0,seededRandom(8));assert.equal(new Set(q.options.map(c=>c.id)).size,4);
 assert.equal(q.options.filter(c=>checkAnswer(cars[0],c.fullName)).length,1);
 assert.ok(q.options.every(c=>c.categories.includes('Japanese')));
 assert.throws(()=>makeQuestion(cars[0],cars.slice(0,3),'photo',0,seededRandom(1)),/INSUFFICIENT_OPTIONS/);
});
test('recent questions move to the back without dropping or repeating cars',()=>{const q=buildQueue(cars,cars.slice(0,10).map(c=>c.id),seededRandom(3));assert.equal(q.length,30);assert.equal(new Set(q.map(c=>c.id)).size,30);assert.ok(q.slice(0,20).every(c=>!cars.slice(0,10).includes(c)));});
for(const mode of MODES)for(const format of FORMATS)test(`${mode}/${format}: full session scores once and never repeats`,()=>{
 const s=create(mode,format),seen=new Set<string>();let count=0;
 while(!s.summary()){
  const car=s.snapshot().question!.car;assert.ok(!seen.has(car.id));seen.add(car.id);
  const r=answer(s,mode,true,++count*100);assert.equal(r?.correct,true);assert.ok(r!.points>=BASE_POINTS[mode]);
  assert.equal(s.submit(isChoice(mode)?car.id:car.fullName,count*100),null);
  s.next(count*100);
 }
 assert.equal(s.summary()!.answered,format==='classic'?10:30);assert.equal(s.summary()!.reason,format==='classic'?'complete':'exhausted');
 assert.equal(s.finish('quit',999999),s.summary());
});
test('marathon ends at the third mistake and resets streak',()=>{const s=create('master','marathon');answer(s,'master');s.next(100);for(let i=0;i<3;i++){const r=answer(s,'master',false,200+i*100);assert.equal(r?.streak,0);s.next(200+i*100);}assert.equal(s.summary()?.reason,'mistakes');assert.equal(s.summary()?.answered,4);});
test('loading and pause do not consume time; exact deadline rejects a late answer',()=>{
 const s=create('expert','timed');s.tick(5000);assert.equal(s.snapshot().remainingMs,60000);s.resume(5000);s.pause(15000);s.tick(90000);assert.equal(s.snapshot().remainingMs,50000);s.resume(100000);s.tick(149999);assert.equal(s.snapshot().remainingMs,1);assert.equal(s.submit(s.snapshot().question!.car.fullName,150000),null);assert.equal(s.summary()?.reason,'time');assert.equal(s.summary()?.answered,0);
});
test('next image loading pauses the clock, blank answers and foreign choice IDs do not score',()=>{
 const s=create('photo','timed');s.resume(0);assert.equal(s.submit('',100),null);assert.equal(s.submit('foreign',200),null);s.submit(s.snapshot().question!.car.id,1000);s.next(2000);s.tick(20000);assert.equal(s.snapshot().remainingMs,58000);assert.equal(s.submit(s.snapshot().question!.car.id,21000),null);
});
test('manual skip can never accidentally match a car alias',()=>{const pool=[{...cars[0],aliases:['__SKIP__']}];const s=create('master','marathon',pool);s.resume(0);assert.equal(s.submit('__SKIP__',100)?.correct,false);});
test('scores include mode, streak and bounded speed bonuses; errors earn nothing',()=>{
 assert.deepEqual(scoreAnswer('master','classic',true,1,0),{points:250,xp:50});
 assert.equal(scoreAnswer('photo','classic',true,5,100).points,115);assert.equal(scoreAnswer('photo','classic',true,10,100).points,130);assert.equal(scoreAnswer('photo','classic',true,20,100).points,150);
 assert.equal(scoreAnswer('photo','timed',true,1,0).points,125);assert.equal(scoreAnswer('photo','timed',true,1,20000).points,100);assert.deepEqual(scoreAnswer('master','timed',false,0,0),{points:0,xp:0});
 assert.equal(progress(20000).rank,6);assert.equal(progress(100).level,2);
});
test('profile unlocks only correct cars, separate format records and idempotent sessions',()=>{
 const p=defaultProfile('ru'),s=create('photo');
 for(let i=0;i<10;i++){const car=s.snapshot().question!.car;const r=answer(s,'photo',i!==0,(i+1)*100)!;applyAnswer(p,r,car,config());s.next((i+1)*100);}
 assert.equal(p.correct,9);assert.equal(Object.values(p.cars).filter(c=>c.unlockedAt).length,9);assert.equal(completeSession(p,s.summary()!),true);assert.equal(completeSession(p,s.summary()!),false);assert.equal(p.sessions,1);assert.ok(p.modes['photo:classic'].best>0);assert.equal(p.modes['photo:timed'].best,0);assert.equal(p.perfectSessions,0);assert.deepEqual(unlockAchievements(p,cars,100),['first']);
});
test('perfect and category achievements require real conditions; abandoned games never update best',()=>{
 const p=defaultProfile();const s=create('silhouette');
 for(let i=0;i<10;i++){const c=s.snapshot().question!.car;applyAnswer(p,answer(s,'silhouette',true,(i+1)*100)!,c,config('silhouette'));s.next((i+1)*100);}
 completeSession(p,s.summary()!);const earned=unlockAchievements(p,cars,100);for(const id of ['first','ten','streak10','shadows','perfect'])assert.ok(earned.includes(id));assert.ok(!earned.includes('japan'));assert.deepEqual(unlockAchievements(p,cars,200),[]);
 const quit=create('expert','timed');applyAnswer(p,answer(quit,'expert')!,quit.snapshot().question!.car,config('expert','timed'));completeSession(p,quit.finish('quit',100));assert.equal(p.modes['expert:timed'].best,0);
});
test('corrupt and older saves safely hydrate without prototype entries',()=>{
 assert.equal(hydrateProfile(null,'ru').settings.language,'ru');assert.equal(hydrateProfile({version:2,xp:400},'en').xp,0);
 const p=hydrateProfile(JSON.parse('{"version":1,"xp":-3,"answered":2,"correct":99,"nickname":"  ","cars":{"constructor":{"attempts":8,"correct":8}},"settings":{"volume":5,"language":"xx"}}'),'ru');
 assert.equal(p.correct,2);assert.equal(p.xp,0);assert.equal(p.nickname,'Driver');assert.deepEqual(p.cars,{});assert.equal(p.settings.volume,1);assert.equal(p.settings.language,'ru');
});

test('same canonical identity or image cannot create two correct options',()=>{
 const duplicate={...cars[0],id:'reordered',fullName:'Fixture Motors Model 0 Sport G1',aliases:[],image:'cars/other.png'};
 assert.ok(validateCatalog([cars[0],duplicate]).issues.some(i=>i.code==='duplicate-model'));
 assert.ok(validateCatalog([cars[0],{...cars[1],image:cars[0].image}]).issues.some(i=>i.code==='duplicate-image'));
});

test('legacy profiles keep progress while requiring nickname onboarding and defaulting to light',()=>{
 const p=hydrateProfile({version:1,nickname:'Existing Racer',xp:240,points:500,answered:5,correct:4,settings:{language:'ru',sound:false}},'en');
 assert.equal(p.nickname,'Existing Racer');assert.equal(p.xp,240);assert.equal(p.points,500);
 assert.equal(p.onboardingCompleted,false);assert.equal(p.settings.theme,'light');assert.equal(p.settings.sound,false);
});
test('theme and completed onboarding survive saving; malformed preferences cannot bypass registration',()=>{
 const p=defaultProfile('ru');p.nickname='Гонщик';p.onboardingCompleted=true;p.settings.theme='dark';
 const loaded=hydrateProfile(JSON.parse(JSON.stringify(p)),'en');
 assert.equal(loaded.onboardingCompleted,true);assert.equal(loaded.nickname,'Гонщик');assert.equal(loaded.settings.theme,'dark');
 for(const nickname of ['', '   ', 'x'.repeat(21), null])assert.equal(hydrateProfile({...p,nickname},'en').onboardingCompleted,false);
 const invalid=hydrateProfile({...p,onboardingCompleted:'true',settings:{...p.settings,theme:'unknown'}},'en');
 assert.equal(invalid.onboardingCompleted,false);assert.equal(invalid.settings.theme,'light');
});

test('photographs require author, license, original source and edit history',()=>{
 const base={...cars[0],origin:'photograph' as const};
 const credit={author:'Example Author',sourceUrl:'https://commons.wikimedia.org/wiki/File:Example.jpg',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',changes:'Background removed'};
 assert.equal(validateCatalog([{...base,credits:credit}]).cars.length,1);
 assert.ok(validateCatalog([base]).issues.some(i=>i.code==='credits'));
 assert.ok(validateCatalog([{...base,credits:{...credit,sourceUrl:'javascript:alert(1)'}}]).issues.some(i=>i.code==='credit-url'));
 assert.ok(validateCatalog([{...base,credits:{...credit,licenseUrl:'http://example.com'}}]).issues.some(i=>i.code==='credit-url'));
 assert.ok(validateCatalog([{...base,credits:{...credit,changes:''}}]).issues.some(i=>i.code==='credits'));
 assert.ok(validateCatalog([{...base,origin:'forged',credits:credit}]).issues.some(i=>i.code==='origin'));
});

test('photo-frame metadata preserves independent transparent silhouette and rejects unsafe files',()=>{
 const credit={author:'Photographer',sourceUrl:'https://commons.wikimedia.org/wiki/File:Car.jpg',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',changes:'Resized for game'};
 const car={...cars[0],origin:'photograph',credits:credit,photo:'cars/fixture-photo.jpg'};
 const v=validateCatalog([car]);assert.equal(v.issues.length,0);assert.equal(v.cars[0].photo,car.photo);assert.equal(v.cars[0].image,cars[0].image);
 for(const bad of ['https://remote/vehicle.jpg','cars/../other.jpg','cars/photo.svg','cars/fixture-0.png'])assert.ok(validateCatalog([{...car,photo:bad}]).issues.length>0,bad);
 assert.ok(validateCatalog([{...car,origin:'generated'}]).issues.some(i=>i.code==='photo-origin'));
 assert.ok(validateCatalog([{...car,photo:7}]).issues.some(i=>i.code==='photo'));
});
