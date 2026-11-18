import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {liveBrowser} from './helpers/live-browser.js';

test('one native life interleaves the four voyages with realm growth and restores every interval before its final inheritance',async t=>{
 const fixture=JSON.parse(await readFile(new URL('./fixtures/homebound-interleaved-route.json',import.meta.url),'utf8'));
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async ({config,route,checkpoints})=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),{importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js'),{journeyNotes,noteRoutes}=await import('/src/game/cultivation/live/journey-notes.js');
  let archive=await open('home-growth-birth'),session=createLiveSession({archive,client:{}}),row=await session.startNew(config,null);
  const checks=[],snapshots=[],visits=[],wanted=new Map(checkpoints.map(c=>[c.turn,c]));let priorDays=0;
  async function checkpoint(name){
   const hash=identity.stateHash(row.state),text=await new Response(exportLiveArchive(archive)).text(),copy=await open('home-growth-'+name);
   await importLiveArchive(new Response(text).body,copy);archive=copy;session=createLiveSession({archive,client:{}});await session.load();row=await archive.load();
   checks.push({name,turn:row.state.turnId,realm:row.state.life.realm,ageDays:row.state.life.ageDays,exact:identity.stateHash(row.state)===hash,bytes:new TextEncoder().encode(text).length});snapshots.push({name,text});
  }
  async function go(key){
   const s=row.state,c=s.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));if(!c)throw Error('missing '+key+' at '+s.turnId);
   row=await session.choose({choiceId:c.id,baseRevision:s.revision,stateHash:identity.stateHash(s)});if(row.errorCode)throw Error(row.errorCode);
  }
  await checkpoint('arrival');
  for(const key of route){
   await go(key);const expected=wanted.get(row.state.turnId);if(!expected)continue;
   if(expected.realm!==row.state.life.realm||expected.ageDays!==row.state.life.ageDays)throw Error('realm or calendar changed at '+expected.name);
   if(expected.homebound){
    if(JSON.stringify(expected.homebound)!==JSON.stringify(row.state.events.homebound))throw Error('voyage history differs');
    const h=row.state.events.homebound,i=h.visits.length-1;
    if(!h.visits[i].done||h.visits[i].done!==row.state.life.ageDays||row.state.life.ageDays<=priorDays)throw Error('not an actual later return');
    priorDays=row.state.life.ageDays;
    visits.push({realm:row.state.life.realm,history:structuredClone(h)});
    if(i<3){
     if(row.state.currentScene.choices.some(c=>c.id.endsWith(':c:home-depart')))throw Error('next voyage bypassed realm gate');
     if(!journeyNotes(row.state).some(n=>n.node==='home-book')||!noteRoutes(row.state,[{node:'training'}]).has('training'))throw Error('no route back to growth');
    }
   }
   await checkpoint(expected.name);
  }
  const living=structuredClone(row.state),parentHome=structuredClone(row.state.events.homebound);
  const training=noteRoutes(row.state,[{node:'training'}]).get('training');if(!training)throw Error('no actual route from inscription to training');for(const key of training)await go(key);
  for(let n=0;row.state.phase!=='dead'&&n<400;n++){
   const s=row.state,key=s.events.node==='training'?(engine.compileChoices(s,s.currentScene.choices).find(c=>c.id.endsWith(':c:practice')).enabled?'practice':'rest-menu'):s.events.node==='rest'?'recover':'train-menu';await go(key);
  }
  if(row.state.phase!=='dead')throw Error('lifespan ending not reached');const dead=structuredClone(row.state),parentId=row.archiveId;
  row=await session.reincarnate({runId:'home-growth-successor',seed:7,name:'潮生'},[],parentId);if(row.errorCode)throw Error(row.errorCode);
  const childHash=identity.stateHash(row.state),retained=await archive.readRetainedArchive(parentId),first=await archive.readRetainedHistory(parentId,null,1);
  const parentExact=identity.stateHash(retained.state)===identity.stateHash(dead),activeUnchanged=identity.stateHash((await archive.load()).state)===childHash;
  await checkpoint('successor');
  return {checks,snapshots,visits,living,parentHome,dead,child:row.state,parentExact,activeUnchanged,parentFirstTurn:first.entries[0].identity.turnId};
 },fixture);
 assert.deepEqual(result.visits.map(x=>x.realm),['spirit','void','unity','mahayana']);
 for(const [i,v] of result.visits.entries()){
  assert.equal(v.history.pledge,'restore');assert.equal(v.history.visits.length,i+1);
  if(i)assert.deepEqual(v.history.visits.slice(0,i),result.visits[i-1].history.visits);
 }
 assert.equal(result.living.life.realm,'tribulation');assert.equal(result.living.events.watch.ding.form,'village');assert.equal(result.living.events.homebound.ending,'sail');
 assert.equal(result.living.turnId,fixture.route.length+1);assert.ok(result.checks.every(c=>c.exact));
 assert.deepEqual(result.checks.map(c=>c.name),['arrival',...fixture.checkpoints.map(c=>c.name),'successor']);
 assert.equal(result.dead.lastReceipt.death.cause,'lifespan');assert.deepEqual(result.dead.events.homebound,result.parentHome);assert.equal(result.child.events.homebound,undefined);
 assert.equal(result.child.reincarnation.inscription.form,'village');assert.ok(result.parentExact&&result.activeUnchanged);assert.equal(result.parentFirstTurn,1);
 if(process.env.WENDING_HOME_GROWTH_EVIDENCE){const dir=process.env.WENDING_HOME_GROWTH_EVIDENCE;await mkdir(dir,{recursive:true});for(const s of result.snapshots)await writeFile(dir+'/'+s.name+'.wending.jsonl',s.text,{flag:'wx'});await writeFile(dir+'/summary.json',JSON.stringify({checks:result.checks,visits:result.visits,cause:result.dead.lastReceipt.death.cause},null,2),{flag:'wx'});}
 t.diagnostic(JSON.stringify(result.checks));
});
