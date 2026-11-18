import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {liveBrowser} from './helpers/live-browser.js';

for(const chapter of [false,true])test('one life joins personal stories and the three-world campaign across restored archives and a successor'+(chapter?' including the beacon expedition':''),async t=>{
 const fixture=JSON.parse(await readFile(new URL('./fixtures/'+(chapter?'rift-beacon-combined-route.json':'a7ded3d-combined-route.json'),import.meta.url),'utf8'));
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async ({config,route})=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),{importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js');
  let archive=await open('combined-birth'),session=createLiveSession({archive,client:{}}),row=await session.startNew(config,null);
  const checkpoints=[],snapshots=[],restored=[];
  async function checkpoint(name){
   const before=identity.stateHash(row.state),text=await new Response(exportLiveArchive(archive)).text();
   const copied=await open('combined-'+name);await importLiveArchive(new Response(text).body,copied);
   archive=copied;session=createLiveSession({archive,client:{}});await session.load();row=await archive.load();
   checkpoints.push({name,turn:row.state.turnId,exact:identity.stateHash(row.state)===before,bytes:new TextEncoder().encode(text).length});snapshots.push({name,text});
  }
  await checkpoint('arrival');
  for(const [index,key] of route.entries()){
   const c=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));if(!c)throw Error('missing '+key+' at '+row.state.turnId);
   row=await session.choose({choiceId:c.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});if(row.errorCode)throw Error(row.errorCode);
   if(row.state.events.post?.walk?.outcome==='quiet'&&!restored.includes('friends')){restored.push('friends');await checkpoint('friends');}
   if(row.state.events.mountain?.ending==='send'&&!restored.includes('mountain')){restored.push('mountain');await checkpoint('mountain');}
   if(index===route.length-1)await checkpoint('ending');
  }
  const living=row.state,privateRecords=structuredClone(living.events),privateNames=['post','mountain','forms','ferry','cloudPassage','cloudTrials','cloudRift','riftBeacon'];
  for(let n=0;row.state.phase!=='dead'&&n<400;n++){
   const s=row.state,key=s.events.node==='training'?(engine.compileChoices(s,s.currentScene.choices).find(c=>c.id.endsWith(':c:practice')).enabled?'practice':'rest-menu'):s.events.node==='rest'?'recover':'train-menu';
   const c=s.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));if(!c)throw Error('no natural ending action');
   row=await session.choose({choiceId:c.id,baseRevision:s.revision,stateHash:identity.stateHash(s)});if(row.errorCode)throw Error(row.errorCode);
  }
  if(row.state.phase!=='dead')throw Error('natural lifespan not settled');
  const dead=structuredClone(row.state),parentId=row.archiveId;
  row=await session.reincarnate({runId:'combined-successor',seed:7,name:'沈棠'},[],parentId);if(row.errorCode)throw Error(row.errorCode);
  const childHash=identity.stateHash(row.state),retained=await archive.readRetainedArchive(parentId),history=await archive.readRetainedHistory(parentId,null,1);
  const retainedExact=identity.stateHash(retained.state)===identity.stateHash(dead),parentReadDidNotSwitch=identity.stateHash((await archive.load()).state)===childHash;
  await checkpoint('successor');
  return {checkpoints,snapshots,living,dead,child:row.state,privateNames,privateRecords,retainedExact,parentReadDidNotSwitch,parentFirstTurn:history.entries[0].identity.turnId};
 },fixture);
 assert.ok(result.checkpoints.every(c=>c.exact));assert.deepEqual(result.checkpoints.map(c=>c.name),['arrival','friends','mountain','ending','successor']);
 const e=result.living.events;
 if(chapter){assert.equal(e.riftBeacon.ending,'delivered');assert.equal(e.riftBeacon.work,'moor');}
 assert.equal(result.living.phase,'active');assert.equal(result.living.life.realm,'tribulation');assert.equal(result.living.life.cultivationProfile.worldTier,2);
 assert.equal(e.nursery.end,'beans');assert.equal(e.post.ending,'leaves');assert.equal(e.post.walk.outcome,'quiet');
 assert.equal(e.mountain.ending,'send');assert.equal(e.mountain.walk.length,6);assert.equal(e.forms.known,'listen');assert.equal(e.ferry.pages.length,3);assert.equal(e.ferry.reply,'chart');
 assert.equal(e.river.record.length,6);assert.equal(e.council.length,9);assert.equal(e.convoy.chapters.reduce((n,c)=>n+c.loads.length,0),6);
 assert.equal(e.cloudRift.ending,'renew');assert.deepEqual(e.cloudTrials.map(c=>[c.stage,c.method]),[[0,'signal'],[1,'shore'],[2,'rift']]);
 assert.equal(e.watch.record.length,9);assert.equal(e.watch.ding.form,'village');assert.equal(result.dead.lastReceipt.death.cause,'lifespan');
 for(const name of result.privateNames){assert.deepEqual(result.dead.events[name],result.privateRecords[name]);assert.equal(result.child.events[name],undefined);}
 assert.ok(result.retainedExact&&result.parentReadDidNotSwitch);assert.equal(result.parentFirstTurn,1);
 assert.deepEqual(result.child.events.convoy,e.convoy);assert.equal(result.child.reincarnation.inscription.form,'village');assert.equal(result.child.life.realm,'mortal');
 if(process.env.WENDING_COMBINED_EVIDENCE){
  const {mkdir,writeFile}=await import('node:fs/promises');const dir=process.env.WENDING_COMBINED_EVIDENCE+(chapter?'/beacon':'');
  await mkdir(dir,{recursive:true});
  for(const {name,text} of result.snapshots)await writeFile(dir+'/'+name+'.wending.jsonl',text,{flag:'wx'});
  await writeFile(dir+'/summary.json',JSON.stringify({source:fixture.revision,checkpoints:result.checkpoints,turn:result.living.turnId,events:e,cause:result.dead.lastReceipt.death.cause},null,2),{flag:'wx'});
 }
 t.diagnostic(JSON.stringify(result.checkpoints));
});
