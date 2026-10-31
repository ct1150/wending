import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBrowser} from './helpers/live-browser.js';

test('actual frozen session, named choices and JSONL replay keep the original creditor after separation and payment',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),{buildStoryInput}=await import('/src/worker/story-provider-core.js'),{GLM_PROFILE}=await import('/src/worker/story-config.js'),{decodeGlmScene}=await import('/src/worker/story-glm-wire.js'),{TECHNIQUES}=await import('/src/game/cultivation/live/cultivation-rules.js'),format=await import('/src/game/live-save-format.js');
  const a=await open('paid-pledge'),snapshots=[],named={kind:'person',name:'陈砚',ref:'',status:null};
  const bytes=v=>new TextEncoder().encode(JSON.stringify(v)).length;
  const choose=(action,target,purpose)=>({action,target,stake:'low',purpose,anchor:0});
  const look=()=>choose('interact:observe','self','辨认桥边的石纹'),rest=()=>choose('rest:recover','self','歇息片刻');
  const client={async capabilities(){return {available:true,storyActions:true,experienceVersion:1};},async createSession(){return {sessionRef:'session'};},async requestTurn(p,c,attempt){
    const stored=(await a.load()).generation.context;
    if(JSON.stringify(stored)!==JSON.stringify(c))throw Error('Request differs from durable context');
    const req=buildStoryInput({...GLM_PROFILE,storyActions:true},c),packed=JSON.parse(req.messages[1].content);
    const ix=c.entities.findIndex(x=>x.name==='陈砚'),actor=ix<0?named:'k'+(ix+1);
    const at=c.identity.turnId,sc={blocks:[],title:'桥畔的口诀',location:'落苇渡',choices:[],memoryDeltas:[],story:{pattern:'cultivation',beat:'progress',anchors:[0]}};
    let text;
    if(at===1){text='陈砚在桥边晾纸。手抄本上的运气次序前后抵牾，还得自己辨一辨。';sc.choices=[choose('craft:diagnose','self','辨明运气次序'),choose('interact:ask',actor,'问纸页为何倒排'),look()];sc.memoryDeltas=[{kind:'clue',target:actor,status:'open',anchor:0}];}
    else if(at===2){text='陈砚已入筑基。陈砚提议把缺行逐处校清，只请你日后带一份行粮；你也可以自己推演。';sc.story.opponent={target:actor,anchor:0,realmId:'foundation'};sc.choices=[choose('craft:pledge',actor,'承诺再见时带一份行粮'),choose('craft:restore','self','推演缺行'),choose('interact:decline',actor,'留待日后再作决定')];}
    else if(at===3){text='经过校对，你明白行气缺口，指点之人已沿桥离去。桥下水声渐近。';sc.choices=[rest(),look(),choose('practice:steady','self','试着梳理气息')];}
    else if(at===4){text='陈砚又经过桥头，提起此前校法约定的那份行粮。';sc.choices=[choose('craft:repay',actor,'交还校法所约行粮'),rest(),look()];}
    else{text='陈砚收下约定的行粮，点头道谢。校法的人情就此还清。';sc.choices=[choose('interact:ask',actor,'问下一处渡口'),rest(),look()];}
    sc.blocks=[{kind:'narration',text}];
    if(at===4&&c.memory.clues.length){const m=c.memory.clues[0],mi=[...c.memory.promises,...c.memory.clues].findIndex(x=>x.id===m.id);sc.memoryDeltas=[{referenceId:'m'+(mi+1),status:'resolved'}];}
    const schema=req.response_format.json_schema.schema,available=schema.properties.choices.items.oneOf.flatMap(g=>g.properties.action.enum);
    for(const ch of sc.choices)if(!available.includes(ch.action))throw Error('Not offered: '+ch.action+' at '+at);
    const canonical=decodeGlmScene(sc,c,{storyActions:true});
    snapshots.push({at,rank:c.entities.find(e=>e.name==='陈砚')?.experience?.realmId??null,sceneRank:canonical.entities.find(e=>e.name==='陈砚')?.experience?.realmId??null,packedRank:packed.entities.find(e=>e.name==='陈砚')?.experience?.realmId??null,bytes:bytes(c),quoted:bytes(JSON.stringify(c)),requestBytes:bytes(req),stored:JSON.stringify(stored)===JSON.stringify(c),alias:actor,debt:packed.life.cultivationProfile.experience.commitment?.entityId,canonical:canonical.choices[0].targetId,closure:canonical.memoryDeltas[0]?.referenceId??null,original:c.memory.clues[0]?.id??null});
    return {status:'ready',requestId:p.identity.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,scene:canonical};
  }};
  const session=createLiveSession({archive:a,client});
  let seed=0;while(!TECHNIQUES[engine.createLiveGame({seed,engineVersion:7}).life.birth.cultivationProfile.techniqueId].defective)seed++;
  let v=await session.startNew({runId:'native-pledge',engineVersion:7,seed},null);const diagnostics=[];
  async function act(how){const row=v.state?.currentScene?.choices.find(ch=>ch.approach===how);if(!row)throw Error('Missing '+how+': '+v.errorCode+' '+JSON.stringify(diagnostics));v=await session.choose({choiceId:row.id,baseRevision:v.state.revision,stateHash:identity.stateHash(v.state)});diagnostics.push([how,v.errorCode,v.status]);}
  await act('diagnose');await act('pledge');const due=v.state.life.cultivationProfile.experience.commitment;const separated=!v.state.relatedEntities.some(e=>e.id===due.entityId);await act('observe');await act('repay');
  const b=await open('replay-paid-pledge'),imported=await format.importLiveArchive(format.exportLiveArchive(a),b);
  return {due,separated,diagnostics,snapshots,result:v.state.life.cultivationProfile.experience.commitment,identical:identity.stateHash(imported.state)===identity.stateHash(v.state),repaid:v.state.lastReceipt.itemChanges.supplies};
 });
 assert.equal(result.result.status,'fulfilled');assert.equal(result.repaid,-1);assert.ok(result.separated&&result.identical);assert.equal(result.snapshots.length,5);
 assert.equal(result.snapshots[1].rank,null);assert.equal(result.snapshots[1].sceneRank,'foundation');
 const meet=result.snapshots.find(s=>s.at===4);assert.deepEqual([meet.rank,meet.sceneRank,meet.packedRank],['foundation','foundation','foundation']);assert.equal(meet.canonical,result.due.entityId);assert.equal(meet.debt,meet.alias);assert.ok(meet.closure);assert.equal(meet.closure,meet.original);
 for(const s of result.snapshots){assert.ok(s.stored);assert.ok(s.bytes<=7000&&s.quoted<=7000&&s.requestBytes<=24576);}
 t.diagnostic('Actual frozen paid/returning actor: '+JSON.stringify(result.snapshots.map(({at,bytes,quoted,requestBytes})=>({at,bytes,quoted,requestBytes}))));
});
