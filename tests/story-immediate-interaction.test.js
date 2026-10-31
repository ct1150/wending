import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBrowser} from './helpers/live-browser.js';

test('legacy refusals and farewells wait for the model and keep their receipt across retry and import',async t=>{
  const {page}=await liveBrowser(t),r=await page.evaluate(async()=>{
    const {createLiveSession}=await import('/src/ui/live-session.js'),{exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');
    async function setup(name){
      const a=await open(name),{state,pending}=await born(a,name),scene=fixture(state),prefix='r:'+identity.sha256(state.runId).slice(0,16)+':t1:',npc={id:prefix+'e:npc',kind:'person',name:'陈叔',status:'alive'},place={id:prefix+'e:road',kind:'place',name:'山道'};
      scene.entities=[npc,place];scene.blocks=[{kind:'narration',text:'陈叔在林边询问你是否愿意帮忙，山道就在村外。'}];scene.choices=[{id:prefix+'c:decline',label:'婉拒陈叔的请求',intent:'interact',targetId:npc.id,approach:'decline',stake:'low'},{id:prefix+'c:leave',label:'向陈叔告辞',intent:'interact',targetId:npc.id,approach:'leave',stake:'low'},{id:prefix+'c:travel',label:'沿路前往山道',intent:'travel',targetId:place.id,approach:'road',stake:'low'}];scene.memoryDeltas=[{entityId:npc.id,kind:'promise',text:'你曾答应明日查看林边的足迹。',status:'open'}];
      await a.commit({expectedRevision:0,nextState:engine.commitTurn(state,pending,scene),scene,memoryDelta:memory.buildMemoryDelta(pending.receipt,scene),requestId:pending.identity.requestId});return {a,npc};
    }
    const results=[];
    for(const [index,approach] of ['decline','leave'].entries()){
      const {a}=await setup('online-'+approach),before=await a.load();
      let available=false,posts=0;
      const client={
        async capabilities(){return {available,storyActions:true};},
        async createSession(){return {sessionRef:'new-session'};},
        async requestTurn(p,c,at){
          posts++;
          const scene=fixture(before.state,2);
          scene.blocks[0].text='水声压过话音，桥头有人放下缆绳。';
          return {status:'ready',requestId:p.identity.requestId,attemptId:at.id,sessionRef:at.sessionRef,scene};
        },
      };
      const session=createLiveSession({archive:a,client});await session.load();
      await session.choose({choiceId:before.state.currentScene.choices[index].id,baseRevision:before.state.revision,stateHash:identity.stateHash(before.state)});
      const paused=await a.load();available=true;
      await session.retry();const after=await a.load();
      const restored=await open('roundtrip-'+approach);await importLiveArchive(exportLiveArchive(a),restored);
      results.push({approach,posts,before:before.state.revision,paused:paused.state.revision,pending:paused.pending.receipt.action.approach,revision:after.state.revision,blocks:after.state.currentScene.blocks,sameReceipt:JSON.stringify(paused.pending.receipt)===JSON.stringify(after.state.lastReceipt),sameImport:identity.stateHash((await restored.load()).state)===identity.stateHash(after.state)});
    }
    return results;
  });
  for(const row of r){
    assert.equal(row.before,row.paused);
    assert.equal(row.pending,row.approach);
    assert.equal(row.posts,1);
    assert.equal(row.revision,row.before+1);
    assert.match(row.blocks[0].text,/桥头有人放下缆绳/);
    assert.ok(row.sameReceipt&&row.sameImport);
  }
});
