import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,commitTurn,prepareChoice} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {TECHNIQUES} from '../src/game/cultivation/live/cultivation-rules.js';
import {GROWTH_TERMS} from '../src/game/cultivation/live/experience.js';
import {generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE} from '../src/worker/story-config.js';

const row=(action,target,purpose)=>({action,target,purpose,...(action.startsWith('interact:')?{}:{stake:'low'})});
const observe=row('interact:observe','self','查看渡口木桩上的刻痕');
const offer={kind:'dialogue',speaker:{kind:'person',name:'渡口药师'},text:'我愿用三日替你校法，下次见面还我一份行粮。'};
async function generate(context,blocks,choices){
  const wire={blocks,choices};let calls=0;
  const result=await generateProviderScene({run:async model=>{
    calls++;return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(wire)}}],usage:{prompt_tokens:150,completion_tokens:150,total_tokens:300}};
  }},{...GLM_PROFILE,storyActions:true,authoredChoices:true},context);
  assert.equal(calls,1);return result;
}
async function takeScene(state,pending,blocks,choices){
  const result=await generate(buildStoryContext(state,pending),blocks,choices);
  assert.equal(result.status,'ready',result.errorCode);
  assert.deepEqual(result.scene.choices.map(x=>x.label),choices.map(x=>x.purpose));
  return commitTurn(state,pending,result.scene);
}
function select(state,approach){
  const choice=state.currentScene.choices.find(x=>x.approach===approach);
  assert.ok(choice,approach);return prepareChoice(state,{requestId:'take-'+approach,choiceId:choice.id});
}

for(const name of ['购买香烛的妇人','出售茶叶的商人','用山货换取盐的猎户']){
  test('a model-authored negotiation with '+name+' keeps its own meaning and exact target',async()=>{
    const born=createLiveGame({runId:'trade-speaker',seed:5,engineVersion:7,experienceVersion:1});
    const actor={kind:'person',name};
    const first=await takeScene(born,prepareOpening(born,{requestId:'open'}),
      [{kind:'dialogue',speaker:actor,text:'桥旁还有一艘船。'}],[row('interact:ask',actor,'打听桥旁那艘船的渡资'),observe]);
    const ask=select(first,'ask'),context=buildStoryContext(first,ask);
    const alias='k'+(context.entities.findIndex(e=>e.id===ask.receipt.action.targetId)+1);
    const cooperate=row('negotiate:cooperate',alias,'以一份行粮合力筹措渡资');
    const next=await takeScene(first,ask,[{kind:'dialogue',speaker:alias,text:'若有行粮，我们可以合力筹措渡资。'}],[cooperate,observe]);
    const deal=select(next,'cooperate');
    assert.equal(deal.receipt.action.targetId,ask.receipt.action.targetId);
    assert.equal(deal.receipt.itemChanges.supplies,-1);
  });
}

test('only a genuine authored repair offer binds a debt, and only the same present creditor can accept repayment',async()=>{
  let born;
  for(let seed=1;seed<=100;seed++){
    born=createLiveGame({runId:'growth-menu',seed,engineVersion:7,experienceVersion:1});
    if(TECHNIQUES[born.life.cultivationProfile.experience.activeTechniqueId].defective&&born.life.items.supplies)break;
  }
  const initial=await takeScene(born,prepareOpening(born,{requestId:'opening'}),
    [{kind:'narration',text:'渡口风凉，经文上的断句与木桩刻痕相似。'}],
    [row('craft:diagnose','self','对照木桩刻痕查验经文断句'),observe]);
  const diagnosis=select(initial,'diagnose'),ctx=buildStoryContext(initial,diagnosis);
  assert.equal(diagnosis.receipt.elapsedDays,GROWTH_TERMS.diagnose.days);
  const pledge=row('craft:pledge',offer.speaker,'接受药师三日校法之约，下次见面归还一份行粮');
  const restore=row('craft:restore','self','收起经文，依着刚查明的断句自己推演');
  for(const text of ['渡口到了，请自行解缆。','我不愿用三日替你校法，下次见面还我一份行粮。','我愿用十三日替你校法，下次见面还我一份行粮。']){
    const invalid=await generate(ctx,[{...offer,text}],[pledge,restore,observe]);
    assert.ok(!invalid.scene?.choices.some(c=>c.approach==='pledge'),text);
  }
  for(const purpose of ['谢绝药师的校法提议，留着行粮自己用','问问三日校法是否需要归还行粮']){
    const mismatch=await generate(ctx,[offer],[{...pledge,purpose},restore,observe]);
    assert.ok(!mismatch.scene?.choices.some(c=>c.approach==='pledge'),purpose);
  }
  const offered=await takeScene(initial,diagnosis,[offer],[pledge,restore,observe]);
  const accepted=select(offered,'pledge'),alone=select(offered,'restore'),creditor=accepted.receipt.action.targetId;
  assert.equal(alone.nextLife.cultivationProfile.experience.commitment,undefined);
  assert.equal(accepted.receipt.elapsedDays,GROWTH_TERMS.pledge.days);
  assert.equal(accepted.nextLife.cultivationProfile.experience.commitment.entityId,creditor);
  const due=buildStoryContext(offered,accepted),alias='k'+(due.entities.findIndex(e=>e.id===creditor)+1);
  const repay=row('craft:repay',alias,'给渡口药师一份行粮，还清校法之约');
  const absent=await generate(due,[{kind:'narration',text:'渡口不见药师，只有空船。'}],[repay,observe]);
  assert.ok(!absent.scene?.choices.some(c=>c.approach==='repay'));
  const reunion=[{kind:'dialogue',speaker:alias,text:'我在此地等了你一会儿了。'}];
  const merelyAsking=await generate(due,reunion,[{...repay,purpose:'问问药师当年约定的行粮数目'},observe]);
  assert.ok(!merelyAsking.scene?.choices.some(c=>c.approach==='repay'));
  const final=await takeScene(offered,accepted,reunion,[repay,observe]);
  const paid=select(final,'repay');assert.equal(paid.receipt.action.targetId,creditor);
  assert.equal(paid.receipt.itemChanges.supplies,-GROWTH_TERMS.repay.items.supplies);
  assert.equal(paid.nextLife.cultivationProfile.experience.commitment.status,'fulfilled');
});
