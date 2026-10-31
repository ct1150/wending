import test from 'node:test';
import assert from 'node:assert/strict';
import { liveBrowser } from './helpers/live-browser.js';

test('physical history and backup reads retain earlier revisions of the same logical life without rebinding writes',async t=>{
 const {page}=await liveBrowser(t);
 const r=await page.evaluate(async()=>{
  const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');
  const archive=await open('readonly-revisions');await born(archive,'same-life');await advance(archive);
  const old=await archive.load();
  const imported=await importLiveArchive(exportLiveArchive(archive),archive);await advance(archive);
  const current=await archive.load(),bound=archive.bound;
  const stage=await archive._stage(engine.createLiveGame({runId:'unfinished-stage',seed:8}));
  const list=await archive.listRetainedArchives();
  const read=await archive.readRetainedArchive(old.archiveId);
  const history=await archive.readRetainedHistory(old.archiveId);
  const bytes=await new Response(exportLiveArchive(archive,'same-life',old.archiveId)).text();
  const afterReads={bound:archive.bound,current:await archive._capture(),mapped:await archive._capture('same-life')};
  let wrongRun=false,staging=false;
  try{await new Response(exportLiveArchive(archive,'wrong-life',old.archiveId)).text();}catch{wrongRun=true;}
  try{await new Response(exportLiveArchive(archive,undefined,stage)).text();}catch{staging=true;}
  await advance(archive);const continued=await archive.load();
  return {old,imported,current,bound,list,read,history,header:JSON.parse(bytes.split('\n')[0]),afterReads,wrongRun,staging,continued};
 });
 assert.notEqual(r.old.archiveId,r.imported.archiveId);
 assert.deepEqual(r.list.entries.map(row=>row.archiveId),[r.old.archiveId]);
 assert.deepEqual(r.read.state,r.old.state);assert.equal(r.history.entries.length,1);
 assert.deepEqual(r.header.state,r.old.state);assert.equal(r.header.state.revision,1);
 assert.equal(r.afterReads.bound,r.bound);assert.equal(r.afterReads.current.run.archiveId,r.current.archiveId);
 assert.equal(r.afterReads.mapped.run.archiveId,r.current.archiveId);
 assert.equal(r.wrongRun,true);assert.equal(r.staging,true);
 assert.equal(r.continued.archiveId,r.current.archiveId);assert.equal(r.continued.state.revision,3);
});

test('retained listings paginate without exposing staging, validated, or pointer rows and reject invalid reads',async t=>{
 const {page}=await liveBrowser(t);
 const r=await page.evaluate(async()=>{
  const archive=await open('readonly-pages');await born(archive,'life-1');const a=await archive.load();
  for(let i=2;i<=4;i++){
   const state=engine.createLiveGame({runId:'life-'+i,seed:i});
   await archive.create({state,pending:engine.prepareOpening(state,{requestId:'opening-'+i}),expectedArchiveId:(await archive.load()).archiveId});
  }
  const stage=await archive._stage(engine.createLiveGame({runId:'staged-life',seed:5}));
  const validated=await archive._stage(engine.createLiveGame({runId:'validated-life',seed:6}));
  const c=await archive._capture(null,validated);await archive._validateStage(validated,c.run.state,null,null);
  const ids=[];let cursor=null,pages=0;
  do{const result=await archive.listRetainedArchives(cursor,1);ids.push(...result.entries.map(row=>row.archiveId));cursor=result.cursor;pages++;}while(cursor&&pages<20);
  const rejected=[];
  for(const id of [stage,validated,'@active','absent',null,undefined,''])try{await archive.readRetainedArchive(id);rejected.push(false);}catch{rejected.push(true);}
  return {ids,pages,rejected,current:await archive.load(),first:await archive.readRetainedArchive(a.archiveId)};
 });
 assert.equal(r.ids.length,3);assert.equal(new Set(r.ids).size,3);assert.ok(r.pages<20);
 assert.ok(!r.ids.includes(r.current.archiveId));assert.deepEqual(r.rejected,[true,true,true,true,true,true,true]);
 assert.equal(r.first.state.runId,'life-1');assert.equal(r.current.state.runId,'life-4');
});

test('historical reads and export reject corrupted snapshots without changing the current pointer',async t=>{
 const {page}=await liveBrowser(t);
 const r=await page.evaluate(async()=>{
  const {exportLiveArchive}=await import('/src/game/live-save-format.js');
  const archive=await open('readonly-corruption');await born(archive,'corrupt-life');await advance(archive);
  const old=await archive.load(),state=engine.createLiveGame({runId:'current-life',seed:5});
  await archive.create({state,pending:engine.prepareOpening(state,{requestId:'current-opening'}),expectedArchiveId:old.archiveId});
  const before=await archive.load();
  await new Promise((resolve,reject)=>{
   const tx=archive.db.transaction('runs','readwrite'),store=tx.objectStore('runs'),request=store.get(old.archiveId);
   request.onsuccess=()=>store.put({...request.result,hash:'0'.repeat(64)});
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
  });
  const rejected=[];
  for(const read of [()=>archive.readRetainedArchive(old.archiveId),()=>archive.readRetainedHistory(old.archiveId),()=>new Response(exportLiveArchive(archive,'corrupt-life',old.archiveId)).text()])try{await read();rejected.push(false);}catch{rejected.push(true);}
  return {before,after:await archive.load(),rejected};
 });
 assert.deepEqual(r.rejected,[true,true,true]);assert.deepEqual(r.after,r.before);
});
