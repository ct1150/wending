import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBrowser} from './helpers/live-browser.js';

test('the new opening saves a decision, resumes it after refresh and replays an exported archive',async t=>{
 const {page}=await liveBrowser(t);
 await page.setViewportSize({width:360,height:800});
 const remote=[];
 page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/story/'))remote.push(request.url());});
 const option=key=>page.locator('[data-live-choice$=":c:'+key+'"]:enabled');
 await page.locator('[data-title-new]').click();
 await page.evaluate(async()=>{
  const {saveNavigation}=await import('/src/ui/navigation.js');
  saveNavigation(sessionStorage,{screen:'new',draft:{name:'沈渡',seed:'42',expectedArchiveId:null}});
 });
 await page.reload();
 await page.locator('[data-live-start]').click();
 for(const key of ['leave-village','take-road','buy-passage','save-houses'])await option(key).click();
 await option('first-breakthrough').waitFor();
 const atCamp=await option('first-breakthrough').getAttribute('data-state-hash');
 await page.reload();
 assert.equal(await option('first-breakthrough').getAttribute('data-state-hash'),atCamp);

 for(let attempt=0;attempt<12;attempt++){
  if(await option('take-help').count())break;
  const available=page.locator('[data-live-choice]:enabled').first();
  const before=await available.getAttribute('data-state-hash');
  // The first available action follows the announced recovery path on a failed check.
  await available.click();
  await page.waitForFunction(hash=>{
   const next=document.querySelector('[data-live-choice]:enabled');
   return next&&next.dataset.stateHash!==hash;
  },before);
 }
 await option('take-help').click();
 await option('chapter-river').waitFor();
 const exact=await page.evaluate(async()=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js');
  const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');
  const {stateHash}=await import('/src/game/cultivation/live/identity.js');
  const source=await openLiveArchive(),copy=await openLiveArchive({name:'campaign-opening-restored'});
  try{
   const original=(await source.load()).state;
   await importLiveArchive(exportLiveArchive(source),copy);
   const restored=(await copy.load()).state;
   return {same:stateHash(restored)===stateHash(original),version:restored.events.version,
     realm:restored.life.realm,water:restored.events.prologue.water,help:restored.events.prologue.help};
  }finally{source.close();copy.close();}
 });
 assert.deepEqual(exact,{same:true,version:2,realm:'qi',water:'houses',help:'accepted'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(remote,[]);
 await option('chapter-river').click();
 await option('river-open').waitFor();
 await option('river-back').click();
 await page.locator('[data-preparation-stops] > summary').click();
 await page.locator('[data-live-note="resource-iron"]:enabled').click();
 await option('gather').click();
 const repeat=option('gather-again');
 const beforeBatch=Number(await repeat.getAttribute('data-revision'));
 await page.locator('[data-live-gather]:enabled').click();
 const report=page.locator('[data-practice-report]');
 await report.waitFor();
 const completed=Number((await report.innerText()).match(/已完成 (\d+) 次/)?.[1]);
 assert.ok(completed>=1&&completed<=3);
 assert.equal(Number(await repeat.getAttribute('data-revision')),beforeBatch+completed);
 const afterBatch=await repeat.getAttribute('data-state-hash');
 await page.reload();
 assert.equal(await repeat.getAttribute('data-state-hash'),afterBatch);
 assert.deepEqual(remote,[]);
});
