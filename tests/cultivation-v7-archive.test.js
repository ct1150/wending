import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBrowser} from './helpers/live-browser.js';

async function setup(t){
 const browser=await liveBrowser(t);
 await browser.page.evaluate(async()=>{
   const rebirth=await import('/src/game/cultivation/live/reincarnation.js');
   const format=await import('/src/game/live-save-format.js');
   Object.assign(globalThis,{rebirth,format});
   globalThis.v7Scene=(state,combat=false)=>{
     const prefix='r:'+identity.sha256(state.runId).slice(0,16)+':t'+(state.turnId+1)+':',actor={id:'r:'+identity.sha256(state.runId).slice(0,16)+':t1:e:chen',name:'陈砚',kind:'person'};
     return {id:prefix+'s:scene',title:'渡头旧事',location:'落苇渡',blocks:[{kind:'narration',text:'第'+(state.turnId+1)+'次停步，陈砚仍站在落苇渡的旧桥旁。'+'远处的水声遮住了低语，桥栏的刻痕却留下几处值得分辨的线索。你仍能自行决定是否追问，或在原地观察局势。'.repeat(4)}],entities:[actor],choices:[
       {id:prefix+'c:a',label:combat?'与陈砚拼死一搏':'观察旧桥的刻痕',intent:combat?'fight':'interact',targetId:combat?actor.id:'self',approach:combat?'desperate':'observe',stake:combat?'high':'low'},
       {id:prefix+'c:b',label:'询问陈砚渡头的旧事',intent:'interact',targetId:actor.id,approach:'ask',stake:'low'},
       {id:prefix+'c:c',label:'婉拒陈砚，暂不追索旧事',intent:'interact',targetId:actor.id,approach:'decline',stake:'low'},
     ],memoryDeltas:[],story:{pattern:'investigation',beat:'progress',anchors:[0]}};
   };
   globalThis.v7Commit=async(a,combat=false,command=null)=>{
     const loaded=await a.load(),pending=loaded.pending??engine.prepareChoice(loaded.state,{requestId:'turn-'+(loaded.state.turnId+1),...(command??{choiceId:loaded.state.currentScene.choices[0].id})});
     if(!loaded.pending)await a.prepare(pending);
     const scene=pending.receipt.death?null:v7Scene(loaded.state,combat),nextState=scene?engine.commitTurn(loaded.state,pending,scene):engine.settleDeath(loaded.state,pending);
     return a.commit({expectedRevision:loaded.state.revision,nextState,scene,memoryDelta:scene?memory.buildMemoryDelta(pending.receipt,scene):null,requestId:pending.identity.requestId});
   };
   globalThis.v7Born=async(a,id='v7-native',combat=false)=>{
     const state=engine.createLiveGame({runId:id,seed:42,engineVersion:7}),pending=engine.prepareOpening(state,{requestId:'opening'});
     await a.create({state,pending});return v7Commit(a,combat);
   };
 });
 return browser;
}

test('independent birth cannot persist purchased benefits without a real settlement',async t=>{
 const {page}=await setup(t);
 const r=await page.evaluate(async()=>{
   const a=await open('v7-unearned-benefits'),state=engine.createLiveGame({runId:'unearned',engineVersion:7,inheritedBenefits:['former-relic']}),pending=engine.prepareOpening(state,{requestId:'unearned-opening'});
   const codes=[];
   try{await a.create({state,pending});}catch(error){codes.push(error.code);}
   try{await a._stage(state);}catch(error){codes.push(error.code);}
   return {codes,current:await a.load()};
 });
 assert.deepEqual(r.codes,['REINCARNATION_REQUIRES_SETTLEMENT','REINCARNATION_REQUIRES_SETTLEMENT']);assert.equal(r.current,null);
});

test('native v7 custom pending and committed intent roundtrip with director and original receipts',async t=>{
 const {page}=await setup(t);
 const r=await page.evaluate(async()=>{
   const a=await open('v7-custom-source');await v7Born(a);
   const current=await a.load(),pending=engine.prepareChoice(current.state,{requestId:'custom-native',customAction:'询问陈砚：旧桥的刻痕是谁留下的？'});await a.prepare(pending);
   const b=await open('v7-custom-imported'),restored=await format.importLiveArchive(format.exportLiveArchive(a),b);
   const after=await v7Commit(b),c=await open('v7-custom-completed'),again=await format.importLiveArchive(format.exportLiveArchive(b),c);
   return {pending,restored,after,again,history:await c.readHistory(current.state.runId)};
 });
 assert.deepEqual(r.restored.pending,r.pending);assert.equal(r.after.state.lastReceipt.action.label,r.pending.receipt.action.label);assert.deepEqual(r.again.state,r.after.state);assert.equal(r.history.entries.length,2);assert.equal(r.after.state.director.turnId,2);
});

test('native reincarnation claims once across competing tabs and preserves dead history',async t=>{
 const {page}=await setup(t);
 const r=await page.evaluate(async()=>{
   const a=await open('v7-rebirth-race');await v7Born(a,'v7-parent',true);
   for(let i=0;(await a.load()).state.phase!=='dead'&&i<10;i++)await v7Commit(a,true);
   const parent=await a.load(),b=await open('v7-rebirth-race');await b.load();
   const create=runId=>{const state=engine.createLiveGame({runId,seed:71,...rebirth.buildRebirthOptions(parent.state,['past-memory'])});return {state,pending:engine.prepareOpening(state,{requestId:'rebirth-'+runId}),rewardIds:['past-memory'],expectedArchiveId:parent.archiveId};};
   const attempts=await Promise.allSettled([a.reincarnate(create('child-a')),b.reincarnate(create('child-b'))]);
   const winner=attempts.find(result=>result.status==='fulfilled')?.value,old=await a.load(parent.state.runId),history=await a.readHistory(parent.state.runId);
   return {statuses:attempts.map(result=>result.status),winner,old,history,settlement:rebirth.getReincarnationSettlement(parent.state)};
 });
 assert.equal(r.statuses.filter(status=>status==='fulfilled').length,1);assert.equal(r.winner.state.reincarnation.generation,2);assert.equal(r.winner.state.reincarnation.balance,r.settlement.availablePoints-2);assert.equal(r.old.reincarnatedTo,r.winner.state.runId);assert.equal(r.history.entries.at(-1).scene,null);assert.equal(r.old.state.phase,'dead');
});

test('a v7 backup carries a completed reincarnation claim and cannot claim again after import',async t=>{
 const {page}=await setup(t);
 const r=await page.evaluate(async()=>{
   const a=await open('v7-rebirth-export');await v7Born(a,'v7-export-parent',true);
   for(let i=0;(await a.load()).state.phase!=='dead'&&i<10;i++)await v7Commit(a,true);
   const parent=await a.load(),state=engine.createLiveGame({runId:'export-child',seed:71,...rebirth.buildRebirthOptions(parent.state,[])}),pending=engine.prepareOpening(state,{requestId:'export-opening'});
   await a.reincarnate({state,pending,rewardIds:[],expectedArchiveId:parent.archiveId});
   const text=await new Response(format.exportLiveArchive(a,parent.state.runId)).text(),header=JSON.parse(text.split('\n')[0]),b=await open('v7-rebirth-new-device');
   const restored=await format.importLiveArchive(new Blob([text]).stream(),b);let code;
   try{const next=engine.createLiveGame({runId:'duplicate-child',...rebirth.buildRebirthOptions(restored.state,[])});await b.reincarnate({state:next,pending:engine.prepareOpening(next,{requestId:'duplicate-open'}),rewardIds:[],expectedArchiveId:restored.archiveId});}catch(error){code=error.code;}
   return {header,restored,code,current:await b.load()};
 });
 assert.equal(r.header.version,3);assert.equal(r.header.reincarnationClaim.childRunId,'export-child');assert.equal(r.restored.reincarnatedTo,'export-child');assert.equal(r.code,'REINCARNATION_ALREADY_CLAIMED');assert.equal(r.current.archiveId,r.restored.archiveId);
});

test('restoring and exporting an earlier parent backup retains the logical spent claim',async t=>{
 const {page}=await setup(t);
 const r=await page.evaluate(async()=>{
   const a=await open('v7-earlier-parent');await v7Born(a,'earlier-parent',true);
   const earlier=await new Response(format.exportLiveArchive(a)).text();
   for(let i=0;(await a.load()).state.phase!=='dead'&&i<10;i++)await v7Commit(a,true);
   const parent=await a.load(),state=engine.createLiveGame({runId:'earlier-child',seed:71,...rebirth.buildRebirthOptions(parent.state,[])});
   await a.reincarnate({state,pending:engine.prepareOpening(state,{requestId:'earlier-rebirth'}),rewardIds:[],expectedArchiveId:parent.archiveId});
   const restored=await format.importLiveArchive(new Blob([earlier]).stream(),a);
   const exported=await new Response(format.exportLiveArchive(a)).text(),b=await open('v7-earlier-new-device');
   const imported=await format.importLiveArchive(new Blob([exported]).stream(),b);
   return {restored,imported,header:JSON.parse(exported.split('\n')[0])};
 });
 assert.equal(r.restored.state.phase,'active');assert.equal(r.imported.state.phase,'active');
 assert.equal(r.imported.reincarnatedTo,'earlier-child');assert.deepEqual(r.imported.state,r.restored.state);
 assert.equal(r.header.reincarnationClaim.childRunId,'earlier-child');
});
