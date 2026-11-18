import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBrowser} from './helpers/live-browser.js';

test('preparation navigation is session-authorized, interruptible, saved and does not perform the chosen craft',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),{importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js');
  const a=await open('prep-source'),ss=createLiveSession({archive:a,client:{}});let r=await ss.startNew({runId:'prep-native',seed:42,name:'沈渡',engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1},null);
  for(const key of ['ask','accept','finish-work','continue']){const s=r.state;r=await ss.choose({choiceId:s.currentScene.choices.find(c=>c.id.endsWith(':c:'+key)).id,baseRevision:s.revision,stateHash:identity.stateHash(s)});}
  const text=await new Response(exportLiveArchive(a)).text(),out={};
  for(const mode of ['success','stop','invalid','pending']){
   const db=await open('prep-'+mode);await importLiveArchive(new Response(text).body,db);
   const session=createLiveSession({archive:db,client:{}}),start=await session.load();
   const cmd={node:mode==='invalid'?'recipe-not-real':'recipe-array',archiveId:start.archiveId,baseRevision:start.state.revision,stateHash:identity.stateHash(start.state)};
   if(mode==='pending'){const c=start.state.currentScene.choices[0];await db.prepare(engine.prepareChoice(start.state,{choiceId:c.id,requestId:'pending'}));}
   let steps=0;const commit=db.commitEvent.bind(db);db.commitEvent=async p=>{const row=await commit(p);steps++;return row;};
   const response=await session.openJourneyNote(cmd,()=>mode!=='stop'||steps===0),current=await db.load();
   out[mode]={error:response.errorCode,steps,node:current.state.events.node,page:current.state.events.page,life:JSON.stringify(current.state.life)===JSON.stringify(start.state.life),rng:current.state.rng===start.state.rng,events:JSON.stringify({...current.state.events,node:start.state.events.node,page:start.state.events.page})===JSON.stringify(start.state.events),pending:!!current.pending};
   if(mode==='success'){
    out.success.target=current.state.currentScene.choices[0].targetId;
    out.success.stale=(await session.openJourneyNote(cmd)).errorCode;
    const copy=await open('prep-restored');await importLiveArchive(exportLiveArchive(db),copy);out.success.exact=identity.stateHash((await copy.load()).state)===identity.stateHash(current.state);copy.close();
   }
   db.close();
  }
  a.close();return out;
 });
 assert.equal(result.success.error,null);assert.equal(result.success.target,'array');assert.equal(result.success.page,3);assert.ok(result.success.exact);
 assert.equal(result.success.stale,'STALE_CHOICE');assert.equal(result.stop.steps,1);assert.equal(result.invalid.steps,0);assert.equal(result.pending.steps,0);assert.ok(result.pending.pending);
 assert.equal(result.invalid.error,'STALE_CHOICE');assert.equal(result.pending.error,'STALE_CHOICE');
 for(const row of Object.values(result))assert.ok(row.life&&row.rng&&row.events);
});

test('mobile preparation buttons choose the exact material, leave gathering explicit and survive refresh',async t=>{
 const {page}=await liveBrowser(t);await page.setViewportSize({width:360,height:760});const errors=[];page.on('pageerror',e=>errors.push(e.message));let calls=0;page.on('request',r=>{if(r.url().includes('/api/story/'))calls++;});
 await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),{openLiveArchive}=await import('/src/game/live-archive.js');const a=await openLiveArchive(),ss=createLiveSession({archive:a,client:{}});let r=await ss.startNew({runId:'prep-mobile',seed:42,name:'沈渡',engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1},null);
  for(const key of ['ask','accept','finish-work','continue']){const s=r.state;r=await ss.choose({choiceId:s.currentScene.choices.find(c=>c.id.endsWith(':c:'+key)).id,baseRevision:s.revision,stateHash:identity.stateHash(s)});}a.close();
 });
 await page.reload();await page.locator('[data-title-continue]:enabled').click();await page.locator('[data-live-choice]:enabled').first().waitFor();
 assert.equal(await page.locator('[data-preparation-stops]').count(),1);
 const saved=()=>page.evaluate(async()=>{const{openLiveArchive}=await import('/src/game/live-archive.js');const a=await openLiveArchive();try{return(await a.load()).state;}finally{a.close();}});
 await page.locator('[data-preparation-stops]>summary').click();const before=await saved();
 await page.locator('[data-live-note="resource-iron"]:enabled').click();
 await page.waitForFunction(()=>document.querySelector('[data-live-choice$=":c:gather"]')?.textContent.includes('玄铁'));
 let at=await saved();assert.deepEqual(at.life,before.life);assert.equal(at.rng,before.rng);assert.equal(at.currentScene.choices[0].targetId,'iron');
 assert.equal(await page.locator('[data-live-note="resource-iron"]').count(),0);assert.match(await page.locator('[data-preparation-stops]').innerText(),/正在这一页/);
 for(const [id,label] of [['recipe-array','护身阵盘'],['resource-iron','玄铁']]){
  assert.notEqual(await page.locator('[data-preparation-stops]').getAttribute('open'),null);
  await page.locator('[data-live-note="'+id+'"]:enabled').click();
  await page.waitForFunction(label=>document.querySelector('[data-live-choice]')?.textContent.includes(label),label);
  await page.locator('[data-live-choice$=":c:'+(id==='recipe-array'?'next-recipe':'gather')+'"]:enabled').waitFor();
  at=await saved();assert.deepEqual(at.life,before.life);assert.equal(at.rng,before.rng);
 }
 assert.equal(at.currentScene.choices[0].targetId,'iron');
 await page.locator('[data-live-choice$=":c:gather"]:enabled').click();await page.locator('[data-live-choice$=":c:gather-again"]:enabled').waitFor();
 const after=await saved();assert.ok(after.life.ageDays>at.life.ageDays);assert.equal(after.lastReceipt.action.targetId,'iron');assert.equal(after.lastReceipt.action.intent,'explore');
 await page.reload();await page.locator('[data-live-choice]:enabled').first().waitFor();assert.deepEqual(await saved(),after);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);assert.equal(calls,0);
});
