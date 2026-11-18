import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {liveBrowser} from './helpers/live-browser.js';

test('old rift ready and pending pages restore exactly, then paid beacon travel and all new checkpoints resume',async t=>{
 const ready=gunzipSync(await readFile(new URL('./fixtures/a0ac265-rift-ready.jsonl.gz',import.meta.url))).toString('utf8');
 const pending=gunzipSync(await readFile(new URL('./fixtures/a0ac265-rift-pending.jsonl.gz',import.meta.url))).toString('utf8');
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async ({ready,pending})=>{
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js'),{createLiveSession}=await import('/src/ui/live-session.js');
  const {makeChunk}=await import('/src/game/live-archive.js');
  function seal(rows){let manifest=identity.sha256(JSON.stringify(rows[0]));for(const row of rows.slice(1,-1))manifest=identity.sha256(manifest+row.chunk.hash);rows.at(-1).manifest=manifest;rows.at(-1).headHash=rows.at(-2).chunk.hash;return rows.map(r=>JSON.stringify(r)).join('\n')+'\n';}
  const oldReady=await open('beacon-old-ready');await importLiveArchive(new Response(ready).body,oldReady);const restoredReady=await oldReady.load();
  const readyExact=identity.stateHash(restoredReady.state)===identity.stateHash(JSON.parse(ready.split('\n')[0]).state);
  const forged=ready.trim().split('\n').map(JSON.parse),last=forged.at(-2).chunk;
  last.entries.at(-1).scene.blocks[0].text+='这段话从未发生。';forged.at(-2).chunk=makeChunk(last.index,last.previousHash,last.entries);
  let oldForgeryRejected=false;try{await importLiveArchive(new Response(seal(forged)).body,oldReady);}catch{oldForgeryRejected=true;}
  const readyPreserved=identity.stateHash((await oldReady.load()).state)===identity.stateHash(restoredReady.state);
  let a=await open('beacon-old-pending');await importLiveArchive(new Response(pending).body,a);
  const old=await a.load();let session=createLiveSession({archive:a,client:{}});await session.load();await session.resume();await session.resume();let row=await a.load();
  const resumed=row.state,checks=[],snapshots=[];
  async function go(...keys){for(const key of keys){const c=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));if(!c)throw Error('missing '+key+' at '+row.state.events.node);row=await session.choose({choiceId:c.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});if(row.errorCode)throw Error(row.errorCode);}}
  async function checkpoint(name){
   const text=await new Response(exportLiveArchive(a)).text(),before=identity.stateHash(row.state),copy=await open('beacon-copy-'+name);await importLiveArchive(new Response(text).body,copy);
   a=copy;session=createLiveSession({archive:a,client:{}});await session.load();row=await a.load();checks.push({name,exact:identity.stateHash(row.state)===before,turn:row.state.turnId});snapshots.push({name,text});
  }
  await go('rest-menu','back','journey-menu','workshop-menu','crossing-menu','sky-book','rift-book','beacon-book');
  const invitation=row.state;await go('beacon-launch','beacon-channel','beacon-survey');await checkpoint('survey');
  const before=row.state,c=before.currentScene.choices.find(c=>c.id.endsWith(':c:beacon-enter'));
  await a.prepare(engine.prepareChoice(before,{choiceId:c.id,requestId:'paid-beacon-entry'}));await checkpoint('pending');
  await session.resume();const once=(await a.load()).state;await session.resume();row=await a.load();const entered=row.state;
  const forgedRead=(await new Response(exportLiveArchive(a)).text()).trim().split('\n').map(JSON.parse);forgedRead[0].state.events.riftBeacon.read=entered.life.ageDays;
  let readForgeryRejected=false;try{await importLiveArchive(new Response(seal(forgedRead)).body,a);}catch{readForgeryRejected=true;}
  const enteredPreserved=identity.stateHash((await a.load()).state)===identity.stateHash(entered);
  await go('beacon-read','beacon-works','beacon-moor');await checkpoint('repaired');
  await go('beacon-exit','beacon-return','beacon-deliver');await checkpoint('delivered');
  return {readyExact,readyChoices:restoredReady.state.currentScene.choices.length,oldForgeryRejected,readyPreserved,readForgeryRejected,enteredPreserved,old:old.state,resumed,invitation,before,entered,once,final:row.state,checks,snapshots};
 },{ready,pending});
 assert.ok(result.readyExact);assert.equal(result.readyChoices,2);
 assert.ok(result.oldForgeryRejected&&result.readyPreserved&&result.readForgeryRejected&&result.enteredPreserved);
 assert.equal(result.resumed.turnId,result.old.turnId+1);assert.deepEqual(result.resumed.life,result.old.life);
 assert.equal(result.invitation.events.riftBeacon,undefined);
 assert.equal(result.entered.turnId,result.before.turnId+1);assert.deepEqual(result.entered,result.once);
 assert.equal(result.entered.life.ageDays,result.before.life.ageDays+2);
 assert.equal(result.final.events.riftBeacon.ending,'delivered');assert.deepEqual(result.final.events.cloudRift,result.old.events.cloudRift);
 assert.ok(result.checks.every(r=>r.exact));
 if(process.env.WENDING_BEACON_EVIDENCE){const dir=process.env.WENDING_BEACON_EVIDENCE;await mkdir(dir,{recursive:true});for(const s of result.snapshots)await writeFile(dir+'/'+s.name+'.wending.jsonl',s.text,{flag:'wx'});await writeFile(dir+'/summary.json',JSON.stringify(result.checks,null,2),{flag:'wx'});}
 t.diagnostic(JSON.stringify(result.checks));
});
