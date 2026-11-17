import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {liveBrowser} from './helpers/live-browser.js';

test('the pre-seed crossing menu still replays exactly while rehashed invented prose is rejected',async t=>{
 const ready=gunzipSync(await readFile(new URL('./fixtures/5a9c838-home-ready.jsonl.gz',import.meta.url))).toString(),{page}=await liveBrowser(t);
 const result=await page.evaluate(async text=>{
  const {importLiveArchive}=await import('/src/game/live-save-format.js'),{makeChunk}=await import('/src/game/live-archive.js'),{createLiveSession}=await import('/src/ui/live-session.js');
  // Synthetic exact historical menu on a real native history; not a claimed pre-seed export.
  function older(invented=false){
   const rows=text.trim().split('\n').map(JSON.parse),s=rows[0].state,scene=s.currentScene,old=scene.choices[2];
   scene.choices[2]={...old,id:old.id.slice(0,old.id.lastIndexOf(':c:'))+':c:back',label:'暂且放下，回去安排修行'};
   if(invented)scene.blocks[0].text+='这句话没有在原来的港口出现。';
   const last=rows.at(-2).chunk;last.entries.at(-1).scene=structuredClone(scene);last.entries.at(-1).stateHash=identity.stateHash(s);rows.at(-2).chunk=makeChunk(last.index,last.previousHash,last.entries);
   let manifest=identity.sha256(JSON.stringify(rows[0]));for(const row of rows.slice(1,-1))manifest=identity.sha256(manifest+row.chunk.hash);rows.at(-1).manifest=manifest;rows.at(-1).headHash=rows.at(-2).chunk.hash;
   return rows.map(r=>JSON.stringify(r)).join('\n')+'\n';
  }
  const a=await open('home-pre-seed');await importLiveArchive(new Response(older()).body,a);const before=await a.load(),hash=identity.stateHash(before.state);
  let rejected=false;try{await importLiveArchive(new Response(older(true)).body,a);}catch{rejected=true;}
  const preserved=identity.stateHash((await a.load()).state)===hash,session=createLiveSession({archive:a,client:{}});await session.load();const c=before.state.currentScene.choices.find(c=>c.id.endsWith(':c:back'));
  const row=await session.choose({choiceId:c.id,baseRevision:before.state.revision,stateHash:hash});if(row.errorCode)throw Error(row.errorCode);
  return {rejected,preserved,node:row.state.events.node,choices:before.state.currentScene.choices.map(c=>c.id.split(':c:')[1])};
 },ready);
 assert.deepEqual(result,{rejected:true,preserved:true,node:'hub',choices:['sky-book','packet-book','back']});
});

test('old upper crossing and pending choices survive, then a complete homebound life restores and ends naturally',async t=>{
 const files={};for(const key of ['ready','pending'])files[key]=gunzipSync(await readFile(new URL('./fixtures/5a9c838-home-'+key+'.jsonl.gz',import.meta.url))).toString();
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async ({ready,pending})=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),{importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js'),{noteRoutes}=await import('/src/game/cultivation/live/journey-notes.js');
  const first=await open('home-old-ready');await importLiveArchive(new Response(ready).body,first);const oldReady=await first.load(),readyExact=identity.stateHash(oldReady.state)===identity.stateHash(JSON.parse(ready.split('\n')[0]).state);
  let a=await open('home-old-pending');await importLiveArchive(new Response(pending).body,a);let row=await a.load();const old=row.state;
  let session=createLiveSession({archive:a,client:{}});await session.load();await session.resume();const resumed=(await a.load()).state;await session.resume();row=await a.load();const repeated=identity.stateHash(row.state)===identity.stateHash(resumed),checks=[],snapshots=[];
  async function go(...keys){for(const key of keys){const c=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));if(!c)throw Error('missing '+key+' at '+row.state.events.node);row=await session.choose({choiceId:c.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});if(row.errorCode)throw Error(row.errorCode);}}
  async function reach(node){const path=noteRoutes(row.state,[{node}]).get(node);if(!path)throw Error('no route '+node);await go(...path);}
  async function checkpoint(name){const text=await new Response(exportLiveArchive(a)).text(),hash=identity.stateHash(row.state),copy=await open('home-copy-'+name);await importLiveArchive(new Response(text).body,copy);a=copy;session=createLiveSession({archive:a,client:{}});await session.load();row=await a.load();checks.push({name,turn:row.state.turnId,exact:identity.stateHash(row.state)===hash,bytes:new TextEncoder().encode(text).length});snapshots.push({name,text});}
  await reach('crossing');await go('harbor-book','home-book','home-restore');await checkpoint('promise');
  const before=row.state,c=before.currentScene.choices.find(c=>c.id.endsWith(':c:home-depart'));await a.prepare(engine.prepareChoice(before,{choiceId:c.id,requestId:'home-paid-departure'}));await checkpoint('pending');
  await session.resume();const entered=(await a.load()).state;await session.resume();row=await a.load();const paidOnce=identity.stateHash(row.state)===identity.stateHash(entered);
  await go('home-see-0','home-decide','home-leave','home-retreat');await checkpoint('retreated');
  await go('home-depart','home-decide','home-hull','home-return');
  await go('home-depart','home-see-0','home-see-1','home-decide','home-seal','home-return');
  await go('home-depart','home-see-0','home-see-1','home-decide','home-harbor','home-return');
  await go('home-depart','home-see-0','home-see-1','home-decide','home-unseal');await checkpoint('unsealed');
  await go('home-decide','home-sail','home-return');await checkpoint('finished');const living=row.state;
  const forged=(await new Response(exportLiveArchive(a)).text()).trim().split('\n').map(JSON.parse);forged[0].state.events.homebound.visits[0].seen=3;
  let manifest=identity.sha256(JSON.stringify(forged[0]));for(const part of forged.slice(1,-1))manifest=identity.sha256(manifest+part.chunk.hash);forged.at(-1).manifest=manifest;
  let rejected=false;try{await importLiveArchive(new Response(forged.map(x=>JSON.stringify(x)).join('\n')+'\n').body,a);}catch{rejected=true;}
  if(!rejected||identity.stateHash((await a.load()).state)!==identity.stateHash(living))throw Error('forged earlier investigation accepted or active save lost');
  for(let n=0;row.state.phase!=='dead'&&n<400;n++){const s=row.state,key=s.events.node==='training'?(engine.compileChoices(s,s.currentScene.choices).find(c=>c.id.endsWith(':c:practice')).enabled?'practice':'rest-menu'):s.events.node==='rest'?'recover':'train-menu';await go(key);}
  if(row.state.phase!=='dead')throw Error('no natural death');const dead=row.state,parent=row.archiveId;
  row=await session.reincarnate({runId:'home-successor',seed:7,name:'归禾'},[],parent);if(row.errorCode)throw Error(row.errorCode);
  const retained=await a.readRetainedArchive(parent),parentExact=identity.stateHash(retained.state)===identity.stateHash(dead);await checkpoint('successor');
  return {readyExact,old,resumed,repeated,before,entered,paidOnce,living,dead,child:row.state,parentExact,checks,snapshots,rejected};
 },files);
 assert.ok(result.readyExact&&result.repeated&&result.paidOnce&&result.parentExact&&result.rejected);
 assert.equal(result.resumed.turnId,result.old.turnId+1);assert.deepEqual(result.resumed.life,result.old.life);assert.equal(result.resumed.events.node,'seed-book');
 assert.equal(result.entered.life.ageDays,result.before.life.ageDays+2);assert.equal(result.entered.life.items.supplies,result.before.life.items.supplies-1);
 assert.equal(result.living.events.homebound.ending,'sail');assert.equal(result.living.events.homebound.released,true);
 assert.deepEqual(result.living.events.riftBeacon,result.old.events.riftBeacon);assert.equal(result.dead.lastReceipt.death.cause,'lifespan');
 assert.deepEqual(result.dead.events.homebound,result.living.events.homebound);assert.equal(result.child.events.homebound,undefined);
 assert.ok(result.checks.every(c=>c.exact));
 if(process.env.WENDING_HOMEBOUND_EVIDENCE){const dir=process.env.WENDING_HOMEBOUND_EVIDENCE;await mkdir(dir,{recursive:true});for(const s of result.snapshots)await writeFile(dir+'/'+s.name+'.wending.jsonl',s.text,{flag:'wx'});await writeFile(dir+'/summary.json',JSON.stringify(result.checks,null,2),{flag:'wx'});}
 t.diagnostic(JSON.stringify(result.checks));
});
