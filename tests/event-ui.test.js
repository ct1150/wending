import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBrowser,loadClassicEventOpening} from './helpers/live-browser.js';

test('the default game starts immediately without AI and keeps both the event and cultivation goal visible after refresh',async t=>{
 const {page}=await liveBrowser(t);let calls=0;
 await page.route('**/api/story/**',route=>{calls++;return route.abort();});
 await page.locator('[data-title-new]').click();await page.locator('[data-live-start]').click();
 await page.locator('[data-live-choice$=":c:leave-village"]').click();
 await page.waitForSelector('[data-live-choice$=":c:ask-terms"]');
 assert.equal(calls,0);assert.match(await page.locator('[data-live-goal]').innerText(),/吐纳/);
 assert.match(await page.locator('[data-event-growth]').innerText(),/炼气|完整功法/);
 const first=await page.locator('[data-live-prose]').innerText();
 await page.locator('[data-live-prose-expand]').click();
 await page.waitForSelector('[data-event-prose-status]');
 assert.equal(await page.locator('[data-live-prose]').innerText(),first);
 assert.equal(await page.locator('[data-live-choice]:enabled').count(),3);
 await page.locator('[data-live-choice$=":c:join-gate"]').click();await page.waitForSelector('[data-live-choice$=":c:work-bank"]');
 await page.locator('[data-live-choice$=":c:work-bank"]').click();await page.waitForSelector('[data-live-choice$=":c:save-canal"]');
 assert.match(await page.locator('[data-live-prose]').innerText(),/溢洪口/);
 await page.reload();await page.waitForSelector('[data-live-choice$=":c:save-canal"]');
 assert.match(await page.locator('[data-live-prose]').innerText(),/溢洪口/);assert.equal(calls,0);
});

test('event choices remain readable and operable on a narrow screen with larger text',async t=>{
 const {page}=await liveBrowser(t);await page.setViewportSize({width:320,height:760});
 await page.route('**/api/story/**',route=>route.abort());
 await page.locator('[data-title-new]').click();await page.locator('[data-live-start]').click();
 await page.locator('[data-live-choice$=":c:leave-village"]').click();
 await page.waitForSelector('[data-live-choice$=":c:ask-terms"]');
 await page.evaluate(()=>document.documentElement.dataset.fontSize='large');
 const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('[data-live-choice]')].map(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height,disabled:button.disabled}))}));
 assert.ok(dimensions.scroll<=dimensions.width+1,JSON.stringify(dimensions));assert.equal(dimensions.buttons.length,3);assert.ok(dimensions.buttons.every(b=>!b.disabled&&b.width>200&&b.height>=40));
});

test('a classic event save can play and resume the six river chapters without inference',async t=>{
 const {page}=await liveBrowser(t);let calls=0;
 await page.route('**/api/story/**',route=>{calls++;return route.abort();});
 const samples=[];
 await page.exposeFunction('recordChoiceLatency',ms=>samples.push(ms));
 await page.addInitScript(()=>{
  document.addEventListener('click',event=>{
   const button=event.target.closest('[data-live-choice]');
   if(!button)return;
   const revision=button.dataset.revision,start=performance.now();
   function afterRender(){
    const next=document.querySelector('[data-live-choice]:enabled');
    if(next&&next.dataset.revision!==revision)window.recordChoiceLatency(performance.now()-start);
    else if(performance.now()-start<10000)requestAnimationFrame(afterRender);
   }
   requestAnimationFrame(afterRender);
  },true);
 });
 await loadClassicEventOpening(page);
 const pick=key=>page.locator('[data-live-choice$=":c:'+key+'"]:enabled').click();
 for(const key of ['decline','journey-menu','river-book','river-open','clue-1'])await pick(key);
 await page.locator('[data-live-choice$=":c:river-return"]:enabled').waitFor();
 await page.reload();await pick('river-return');
 assert.match(await page.locator('[data-live-prose]').innerText(),/闸脚/);
 for(let i=0;i<6;i++){
  if(i>0)await pick('river-open');
  await pick('deliberate');await pick('policy-'+(i%2));await pick('next-case');
 }
 await page.getByRole('heading',{name:'问川图 · 河簿合卷'}).waitFor();
 for(const key of ['voyage-book','voyage-go','to-kiln','to-store','to-tower','voyage-finish','voyage-book','voyage-go','to-east','to-west','to-peak','voyage-finish','voyage-book','voyage-go','to-pass','to-well','to-camp','voyage-finish','voyage-book'])await pick(key);
 await page.getByRole('heading',{name:'行旅录 · 三程归来'}).waitFor();
 await pick('train-menu');
 const beforePractice=await page.locator('[data-live-choice$=":c:practice"]:enabled').getAttribute('data-state-hash');
 await pick('practice');
 await page.waitForFunction(hash=>{
  const next=document.querySelector('[data-live-choice]:enabled');
  return next&&next.dataset.stateHash!==hash;
 },beforePractice);
 assert.match(await page.locator('[data-live-feedback]').innerText(),/修炼/);
 assert.equal(calls,0);
 samples.sort((a,b)=>a-b);assert.ok(samples.length>=30);
 t.diagnostic('Local click to next enabled choices (ms): '+JSON.stringify({count:samples.length,median:samples[Math.floor(samples.length/2)],p95:samples[Math.ceil(samples.length*.95)-1]}));
});
