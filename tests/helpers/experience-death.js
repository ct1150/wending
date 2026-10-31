import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as engine from '../../src/game/cultivation/live/engine.js';
import * as memory from '../../src/game/cultivation/live/memory.js';
import * as identity from '../../src/game/cultivation/live/identity.js';
import * as rules from '../../src/game/cultivation/live/cultivation-rules.js';
import * as rebirth from '../../src/game/cultivation/live/reincarnation.js';
import * as validation from '../../src/game/cultivation/live/validation.js';
const fixture=JSON.parse(readFileSync(new URL('../fixtures/v540-unmarked-v7.json',import.meta.url)));
export function storyLife(runId,alreadyPaid,prior=null,{marked=true,selfStudy=false}={}) {
  const inheritance=prior?rebirth.buildRebirthOptions(prior,[]):{engineVersion:7,...(marked?{experienceVersion:1}:{})};
  let options,state;
  // These are different possible fresh births. Choose the first one that actually
  // received a flawed technique; do not alter the birth, state or PRNG.
  for(let seed=1;seed<=100;seed++){options={runId,seed,...inheritance};state=engine.createLiveGame(options);if(rules.TECHNIQUES[state.life.birth.cultivationProfile.techniqueId].defective)break;}
  assert.ok(rules.TECHNIQUES[state.life.birth.cultivationProfile.techniqueId].defective);
  const birth=structuredClone(state), steps=[];
  const prefix='r:'+identity.sha256(state.runId).slice(0,16),identityOfCreditor=prefix+':t1:e:chen';
  function select(label=null,offer=false){
   const n=state.turnId+1, command={requestId:'qa-request-'+n};
   if(label)command.choiceId=state.currentScene.choices.find(choice=>choice.label===label).id;
   const prepare=s=>label?engine.prepareChoice(s,command):engine.prepareOpening(s,command);
   const p=prepare(state);
   assert.deepEqual(prepare(state),p);
   validation.validateReceipt(p.receipt,{turnId:n});
   let scene=null;
   if(!p.receipt.death){
    scene=structuredClone(fixture.scene);scene.id=prefix+':t'+n+':s:bridge';scene.entities[0].id=identityOfCreditor;
    const t=label===null?'陈砚守在渡口，借着灯光等你翻开本命功法。':offer?'陈砚指着功法缺页，提出替你校法三日，待你下次带一份行粮相还；你也可不应。':label.includes('接受')?'陈砚依约校正功法。你还欠他一份行粮。':label.includes('归还')?'陈砚收下你交还的行粮，这一笔欠账就此结清。':'陈砚仍在渡口，争执过后双方各退一步。';
    scene.blocks=[{kind:'narration',text:t}];
    for(const [i,c] of scene.choices.entries()){c.id=prefix+':t'+n+':c:x'+i;if(c.targetId!=='self')c.targetId=identityOfCreditor;}
    Object.assign(scene.choices[1],{label:'拼命陈砚',intent:'fight',approach:'desperate',targetId:identityOfCreditor,stake:'high'});
    if(marked&&n===1)Object.assign(scene.choices[0],{label:'验看本命功法',intent:'craft',approach:'diagnose'});
    if(offer)Object.assign(scene.choices[0],selfStudy?{label:'自行推演残法',intent:'craft',approach:'restore'}:{label:'接受陈砚的校法之约',intent:'craft',approach:'pledge',targetId:identityOfCreditor});
    if(alreadyPaid&&p.nextLife.cultivationProfile?.experience?.commitment?.status==='owed')Object.assign(scene.choices[0],{label:'向陈砚归还行粮',intent:'craft',approach:'repay',targetId:identityOfCreditor});
    const context=memory.buildStoryContext(state,p,[],{selection:'relevance-v1',openTotal:0});
    memory.validateGeneratedScene(scene,context);
   }
   state=p.receipt.death?engine.settleDeath(state,p):engine.commitTurn(state,p,scene);
   assert.deepEqual(validation.deserializeLiveState(validation.serializeLiveState(state)),state);
   steps.push({command,p,scene,afterHash:identity.stateHash(state)});
  }
  select();if(marked){select('验看本命功法',true);select(selfStudy?'自行推演残法':'接受陈砚的校法之约');}
  if(alreadyPaid)select('向陈砚归还行粮');
  while(state.phase!=='dead'&&state.turnId<25)select('拼命陈砚');
  assert.equal(state.phase,'dead');assert.equal(state.lastReceipt.death.cause,'injury');
  if(marked&&!selfStudy)assert.equal(state.life.cultivationProfile.experience.commitment.status,alreadyPaid?'fulfilled':'owed');
  // Replay every originating command and the accepted scene and verify every hash.
  let replay=engine.createLiveGame(options);for(const row of steps){const p=row.p.kind==='opening'?engine.prepareOpening(replay,row.command):engine.prepareChoice(replay,row.command);assert.deepEqual(p,row.p);replay=p.receipt.death?engine.settleDeath(replay,p):engine.commitTurn(replay,p,row.scene);assert.equal(identity.stateHash(replay),row.afterHash);}
  return {birth,options,state,steps,settlement:rebirth.getReincarnationSettlement(state),hash:identity.stateHash(state)};
 }
