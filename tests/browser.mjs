// Browser fixtures are fictional, generated only in test memory, never shipped.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const dist=resolve('dist'),out=resolve('qa');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve(dist,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!path.startsWith(dist+sep)&&path!==dist){res.writeHead(403).end();return;}const file=path===dist?resolve(dist,'index.html'):path;const body=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.woff2':'font/woff2'})[extname(file)]??'application/octet-stream');res.end(body);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const errors=[];let passed=0;
const cars=Array.from({length:12},(_,i)=>({id:`test-${i}`,brand:'Fixture Motors',model:`Model ${i}`,generation:'G1',modification:'Test',fullName:`Fixture Motors Model ${i} G1 Test`,aliases:[`Fixture Motors Model ${i} Test G1`],image:`cars/test-${i}.png`,categories:[i<10?'Japanese':'German','Sports Cars'],difficulty:2}));
const canvasPage=await browser.newPage();
const png=Buffer.from((await canvasPage.evaluate(()=>{const c=document.createElement('canvas');c.width=1000;c.height=350;const x=c.getContext('2d');x.fillStyle='#718dff';x.beginPath();x.moveTo(80,230);x.lineTo(100,170);x.lineTo(270,155);x.lineTo(365,80);x.lineTo(640,80);x.lineTo(740,160);x.lineTo(900,180);x.lineTo(930,240);x.lineTo(80,240);x.closePath();x.fill();x.fillStyle='#17233d';x.fillRect(360,100,265,55);for(const a of [250,780]){x.beginPath();x.arc(a,240,54,0,Math.PI*2);x.fill();x.fillStyle='#bac9ef';x.beginPath();x.arc(a,240,29,0,Math.PI*2);x.fill();x.fillStyle='#17233d';}x.fillStyle='white';x.font='bold 28px sans-serif';x.fillText('FICTIONAL TEST FIXTURE',335,210);return c.toDataURL('image/png').split(',')[1];})), 'base64');await canvasPage.close();
async function pageFor({fixture=false,width=1440,height=900,locale='en-US',delay=false}={}){
 const context=await browser.newContext({viewport:{width,height},locale});const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 if(fixture)await page.route('**/data/cars.json',r=>r.fulfill({json:cars}));
 let release;const gate=new Promise(r=>release=r);
 if(fixture)await page.route('**/cars/*.png',async r=>{if(delay)await gate;await r.fulfill({contentType:'image/png',body:png});});
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.home-hero').waitFor();
 return {page,context,release};
}
async function nav(page,screen){const target=page.locator(`[data-action="nav"][data-screen="${screen}"]:visible`).first();await target.click();}
async function setup(page,mode,format='classic'){await nav(page,'modes');await page.locator(`[data-action="mode"][data-mode="${mode}"]`).click();await page.locator(`[data-action="format"][data-format="${format}"]`).click();await page.locator('[data-action="start"]').click();}
async function current(page){const img=page.locator('.question-car');await img.waitFor();const src=await img.getAttribute('src');return cars.find(c=>src.endsWith(c.image));}
async function answer(page,mode,correct=true){const car=await current(page);assert.ok(car);if(['photo','silhouette'].includes(mode)){const opt=correct?page.locator(`[data-action="answer"][data-value="${car.id}"]`):page.locator(`[data-action="answer"]:not([data-value="${car.id}"])`).first();await opt.click();}else{await page.locator('#typed-answer').fill(correct?car.aliases[0]:'Different Model');await page.locator('#answer-form button[type="submit"]').click();}await page.locator('.reveal-name').waitFor();return car;}
async function check(name,fn){await fn();console.log(`PASS ${++passed}: ${name}`);}
try{
 await check('empty catalogue is honest; all screens and language settings work',async()=>{
  const {page,context}=await pageFor({locale:'ru-RU'});await page.screenshot({path:resolve(out,'home-ru.png'),fullPage:true});
  await page.locator('[data-action="quick"]').click();assert.equal(await page.locator('[data-action="start"]').isDisabled(),true);
  await nav(page,'settings');await page.locator('#nickname').fill('Test Driver');await page.locator('[data-action="save-name"]').click();await page.locator('#language').selectOption('en');assert.equal(await page.locator('html').getAttribute('lang'),'en');
  await page.reload();await page.locator('.home-hero').waitFor();assert.ok((await page.locator('.header-xp').innerText()).includes('Test Driver'));
  for(const screen of ['collection','profile','stats','settings']){await nav(page,screen);assert.ok((await page.locator('#main').innerText()).length>30);}
  await context.close();
 });
 for(const mode of ['photo','expert','silhouette','master'])await check(`${mode}: complete 10-question run, reveal, score, collection and saved record`,async()=>{
  const {page,context}=await pageFor({fixture:true});await setup(page,mode);const ids=new Set();
  if(['silhouette','master'].includes(mode))assert.equal(await page.locator('.question-car').evaluate(e=>getComputedStyle(e).filter),'brightness(0)');
  await page.screenshot({path:resolve(out,`${mode}-desktop.png`),fullPage:true});
  for(let i=0;i<10;i++){const car=await answer(page,mode);assert.ok(!ids.has(car.id));ids.add(car.id);if(i===0&&mode==='silhouette'){await page.waitForTimeout(950);assert.notEqual(await page.locator('.question-car').evaluate(e=>getComputedStyle(e).filter),'brightness(0)');await page.screenshot({path:resolve(out,'silhouette-reveal.png'),fullPage:true});}await page.locator('[data-action="next"]').click();}
  await page.locator('.result-score').waitFor();const p=await page.evaluate(()=>JSON.parse(localStorage.getItem('autoquiz.profile.v1')));assert.equal(p.correct,10);assert.equal(p.sessions,1);assert.equal(p.perfectSessions,1);assert.ok(p.modes[`${mode}:classic`].best>0);assert.equal(Object.keys(p.cars).length,10);
  if(mode==='photo')await page.screenshot({path:resolve(out,'results-desktop.png'),fullPage:true});
  await page.reload();await page.locator('.home-hero').waitFor();await nav(page,'collection');assert.ok(await page.locator('.car-card:not(.locked)').count()>0);await page.locator('.car-card:not(.locked)').first().click();await page.locator('dialog[open] .detail-meta').waitFor();await context.close();
 });
 await check('marathon: wrong option highlights both answers and third mistake finishes',async()=>{
  const {page,context}=await pageFor({fixture:true});await setup(page,'photo','marathon');for(let i=0;i<3;i++){await answer(page,'photo',false);assert.equal(await page.locator('.is-wrong').count(),1);assert.equal(await page.locator('.is-correct').count(),1);await page.locator('[data-action="next"]').click();}await page.locator('.result-score').waitFor();assert.equal(parseInt(await page.locator('.result-score').innerText()),0);await context.close();
 });
 await check('60-second deadline and manual pause use active time only',async()=>{
  const {page,context}=await pageFor({fixture:true});await page.clock.install();await setup(page,'expert','timed');await current(page);await page.clock.runFor(5000);await page.locator('[data-action="pause"]').click();const before=await page.locator('#game-timer').innerText();await page.clock.runFor(15000);assert.equal(await page.locator('#game-timer').innerText(),before);await page.locator('[data-local="resume"]').click();await answer(page,'expert');await page.locator('[data-action="next"]').click();await current(page);await page.clock.runFor(61000);await page.locator('.result-score').waitFor();assert.ok((await page.locator('#main').innerText()).includes('Time’s up'));await context.close();
 });
 await check('slow image + nested quit confirmation preserves modal and paused timer',async()=>{
  const {page,context,release}=await pageFor({fixture:true,delay:true});await setup(page,'photo','timed');await page.locator('[data-action="pause"]').click();await page.locator('[data-local="quit"]').click();release();await page.locator('.question-car').waitFor();assert.equal(await page.locator('#confirm-dialog[open]').count(),1);assert.equal(await page.locator('#pause-dialog[open]').count(),1);const before=await page.locator('#game-timer').innerText();await page.waitForTimeout(1100);assert.equal(await page.locator('#game-timer').innerText(),before);await page.locator('[data-confirm="no"]').click();await page.locator('[data-local="resume"]').click();await answer(page,'photo');await context.close();
 });
 await check('mobile/tablet/landscape controls fit and statistics remains reachable',async()=>{
  const {page,context}=await pageFor({fixture:true,width:390,height:844,locale:'ru-RU'});await page.screenshot({path:resolve(out,'home-mobile.png'),fullPage:true});
  await nav(page,'profile');await page.locator('#main [data-action="stats"]').click();await page.locator('.stats-panel').waitFor();
  await setup(page,'master');await current(page);await page.screenshot({path:resolve(out,'master-mobile.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await answer(page,'master');
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:resolve(out,'master-landscape.png'),fullPage:true});assert.ok(await page.locator('[data-action="next"]').isVisible());
  await page.locator('[data-action="pause"]').click();await page.locator('[data-local="quit"]').click();await page.locator('[data-confirm="yes"]').click();await page.locator('[data-action="home"]').first().click();
  await page.setViewportSize({width:1024,height:768});await nav(page,'collection');assert.equal(await page.locator('#collection-sort').isVisible(),true);await page.screenshot({path:resolve(out,'collection-tablet.png'),fullPage:true});await context.close();
 });
 await check('import validates missing images; successful import and progress survive reload; reset confirms',async()=>{
  const {page,context}=await pageFor();await page.locator('[data-action="data"]').first().click();const json={name:'cars.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cars))};await page.locator('#import-files').setInputFiles([json]);await page.locator('.import-errors').waitFor();assert.ok((await page.locator('.import-errors').innerText()).includes('MISSING_PNG'));await page.locator('.modal-close').click();
  await page.locator('#import-files').setInputFiles([json,...cars.map(c=>({name:c.image.split('/').pop(),mimeType:'image/png',buffer:png}))]);await page.locator('[data-action="restore"]').waitFor();await page.reload();await page.locator('.home-hero').waitFor();await nav(page,'modes');assert.equal(await page.locator('[data-action="start"]').isDisabled(),false);
  await nav(page,'settings');await page.locator('#nickname').fill('Reset test');await page.locator('[data-action="save-name"]').click();await page.locator('[data-action="reset"]').click();await page.locator('[data-confirm="no"]').click();assert.equal(await page.locator('#nickname').inputValue(),'Reset test');await page.locator('[data-action="reset"]').click();await page.locator('[data-confirm="yes"]').click();assert.equal(await page.locator('#nickname').inputValue(),'Driver');await context.close();
 });
 assert.deepEqual(errors,[]);console.log(`Browser checks passed: ${passed}. No uncaught browser errors.`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
