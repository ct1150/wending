import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStoryChoicePlan,materializeStoryChoices} from '../src/worker/story-choice-plan.js';
import {createLiveGame,prepareOpening,commitTurn,prepareChoice} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {decodeGlmScene} from '../src/worker/story-glm-wire.js';
import {v7ActionRule,TECHNIQUES} from '../src/game/cultivation/live/cultivation-rules.js';
import {ITEMS} from '../src/game/cultivation/live/model.js';
import {GROWTH_TERMS} from '../src/game/cultivation/live/experience.js';
import {generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE} from '../src/worker/story-config.js';

const state=createLiveGame({runId:'plan-at-birth',seed:42,engineVersion:7}),opening=prepareOpening(state,{requestId:'open'});
const context=()=>structuredClone(buildStoryContext(state,opening));
const blocks=[{kind:'dialogue',speaker:{kind:'person',name:'船夫'},text:'这只陶罐是从断桥底下捞来的。'}];
const sceneFor=(c,rows,body=blocks)=>decodeGlmScene({blocks:body,choices:rows,title:'河岸',location:'渡口',memoryDeltas:[],story:{pattern:'investigation',beat:'progress',anchors:[0]}},c,{storyActions:true});

async function commitAuthoredTurn(state,pending,blocks){
  let calls=0;
  const ai={run:async model=>{
    calls++;
    return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify({blocks})}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}};
  }};
  const generated=await generateProviderScene(ai,{...GLM_PROFILE,storyActions:true,engineMenu:true},buildStoryContext(state,pending));
  assert.equal(calls,1);assert.equal(generated.status,'ready',generated.errorCode);
  return commitTurn(state,pending,generated.scene);
}

for(const name of ['购买香烛的妇人','出售茶叶的商人','用山货换取盐的猎户']){
  test('trade words in a speaker name do not reject an engine-planned negotiation: '+name,async()=>{
    const born=createLiveGame({runId:'trade-speaker',seed:5,engineVersion:7,experienceVersion:1});
    const body=[{kind:'dialogue',speaker:{kind:'person',name},text:'桥旁还有一艘船。'}];
    const opening=await commitAuthoredTurn(born,prepareOpening(born,{requestId:'open'}),body);
    const ask=opening.currentScene.choices.find(choice=>choice.approach==='ask');
    const next=await commitAuthoredTurn(opening,prepareChoice(opening,{requestId:'ask',choiceId:ask.id}),body);
    const talk=next.currentScene.choices.find(choice=>choice.intent==='negotiate'&&choice.approach==='cooperate');
    assert.ok(talk);assert.equal(talk.targetId,ask.targetId);assert.ok(talk.label.includes(name));
    const {receipt}=prepareChoice(next,{requestId:'trade',choiceId:talk.id});
    assert.deepEqual(receipt.action,talk);assert.equal(receipt.itemChanges.supplies,-1);
  });
}

test('the frozen opening plan becomes actionable without reading any model choices',()=>{
  const c=context(),plan=buildStoryChoicePlan(c),same=buildStoryChoicePlan(structuredClone(c));assert.deepEqual(plan,same);assert.ok(plan.cues.length>=2);
  const rows=materializeStoryChoices(plan,c,blocks);assert.ok(rows.length>=2&&rows.length<=3);const scene=sceneFor(c,rows),first=scene.choices.find(row=>row.approach==='ask');
  assert.equal(first.targetId,scene.blocks[0].speaker);assert.match(first.label,/陶罐/);assert.deepEqual(scene.blocks[0].text,blocks[0].text);
  const active=commitTurn(state,opening,scene);for(const choice of scene.choices)assert.equal(prepareChoice(active,{requestId:'choose',choiceId:choice.id}).receipt.action.id,choice.id);
  assert.deepEqual(materializeStoryChoices(plan,c,blocks),rows);
});

test('a quoted NPC remark yields a readable question about one clause',()=>{
  const c=context(),body=[{kind:'dialogue',speaker:{kind:'person',name:'老张'},text:'“这东西邪门得很，我刚才摸过，指尖还麻着。”'}];
  const ask=materializeStoryChoices(buildStoryChoicePlan(c),c,body).find(x=>x.action==='interact:ask');
  assert.equal(ask.purpose,'问问“这东西邪门得很”是怎么回事');
});

test('an NPC-free opening lets you investigate or set aside this specific sign without spending a month',async()=>{
  for(const [seed,experience] of [[42,{}],[5,{experienceVersion:1}]]){
    const born=createLiveGame({runId:'plan-at-birth',seed,engineVersion:7,...experience});
    const pending=prepareOpening(born,{requestId:'open'}),c=buildStoryContext(born,pending);
    const body=[{kind:'narration',text:'渡口空无一人。'},{kind:'narration',text:'桥桩背面留着半枚湿鞋印。'}];
    const rows=materializeStoryChoices(buildStoryChoicePlan(c),c,body);
    assert.deepEqual(rows.map(r=>r.action),['interact:observe','interact:leave']);
    assert.ok(rows.every(r=>r.anchor===1&&r.target==='self'&&r.purpose.includes('湿鞋印')));
    const saved=await commitAuthoredTurn(born,pending,body);
    assert.ok(!saved.currentScene.entities.some(x=>x.kind==='person'));
    for(const choice of saved.currentScene.choices){
      assert.match(choice.label,/湿鞋印/u);
      assert.equal(prepareChoice(saved,{requestId:'act',choiceId:choice.id}).receipt.elapsedDays,0);
    }
  }
});

test('an authored detail narrows observation to the indicated block without changing the planned action',()=>{
  const c=context(),body=[{kind:'narration',text:'石门上留着两行刻痕。'},{kind:'narration',text:'阶前的铜铃响了一声。'},{kind:'narration',text:'你还没动手，摊主等你自己决定。'}];
  const plan=buildStoryChoicePlan(c),rows=materializeStoryChoices(plan,c,body,{anchor:0,quote:'两行刻痕'});
  const observe=rows.find(r=>r.action==='interact:observe');
  assert.equal(observe.anchor,0);assert.equal(observe.purpose,'查验两行刻痕');
  const ordinary=materializeStoryChoices(plan,c,body);
  assert.deepEqual(rows.map(r=>r.action),ordinary.map(r=>r.action));
  assert.match(ordinary[0].purpose,/铜铃/u);
});

test('a decision pause uses actual supplies and training needs instead of inventing a lead',async()=>{
  const born=createLiveGame({runId:'quiet-turn',seed:42,engineVersion:7}),pending=prepareOpening(born,{requestId:'open'});
  const body=[{kind:'narration',text:'他等着你答复。'}],saved=await commitAuthoredTurn(born,pending,body);
  assert.deepEqual(saved.currentScene.choices.map(r=>r.intent),['practice','explore']);
  for(const choice of saved.currentScene.choices)assert.ok(prepareChoice(saved,{requestId:'quiet',choiceId:choice.id}).receipt.elapsedDays>0);
  const c=context();c.life.cultivationProfile.spirit=0;c.life.items.supplies=0;
  const exhausted=materializeStoryChoices(buildStoryChoicePlan(c),c,body);
  assert.deepEqual(exhausted.map(r=>r.action),['rest:recover','explore:cautious']);assert.equal(exhausted[1].target,'supplies');
});

test('an authored pause or placeholder cannot displace an actual clue',()=>{
  const c=context(),plan=buildStoryChoicePlan(c),body=[{kind:'narration',text:'铜环上结着青霜。'},{kind:'narration',text:'你还没动手。眼前的细节。面前。'}];
  for(const quote of ['你还没动手','眼前的细节','面前']){
    const rows=materializeStoryChoices(plan,c,body,{anchor:1,quote});
    assert.ok(rows.every(r=>r.anchor===0&&r.purpose.includes('青霜')));
  }
});

test('a destination mentioned in the current prose offers a real road trip before a generic exit',()=>{
  const c=context();
  c.entities=[{kind:'place',name:'东桥集',id:'old:market',status:'unknown'},{kind:'place',name:'杉木渡',id:'old:ferry',status:'unknown'}];
  const plan=buildStoryChoicePlan(c),body=[{kind:'narration',text:'桥头一张路引歪挂在木桩上。'},{kind:'narration',text:'路引上盖着杉木渡的印。'}];
  const rows=materializeStoryChoices(plan,c,body);
  const trip=rows.find(r=>r.action==='travel:road');
  assert.ok(trip);assert.equal(trip.target,'k2');assert.equal(trip.anchor,1);
  assert.ok(!rows.some(r=>r.action==='interact:leave'||r.target==='k1'));
  c.life.items.supplies=0;
  const onFoot=materializeStoryChoices(buildStoryChoicePlan(c),c,body);
  assert.ok(onFoot.every(r=>r.action!=='travel:road'));
  assert.ok(onFoot.some(r=>r.action==='interact:leave'));
});

test('ordinary recovery only takes a menu slot when injury or spent spirit gives it a purpose',()=>{
  const c=context();c.phase='choice';c.receipt.action={intent:'interact',approach:'observe',targetId:'self'};
  c.life.items.medicine=1;
  const set=new Set();
  for(const injury of [0,2]){
    c.life.injury=injury;
    for(let turn=2;turn<=64;turn++){
      c.identity.turnId=turn;
      const rows=materializeStoryChoices(buildStoryChoicePlan(c),c,blocks);
      if(!injury)assert.ok(rows.every(r=>!['rest:recover','rest:retire','rest:medicine'].includes(r.action)));
      const rest=rows.find(r=>r.action==='rest:recover');
      if(rest){assert.equal(injury,2);assert.match(rest.purpose,/伤/u);set.add(injury);}
    }
  }
  assert.ok(set.has(2));
  c.life.injury=0;c.life.cultivationProfile.exposure=15;
  assert.ok(buildStoryChoicePlan(c).fallback.find(r=>r.action==='rest:recover')?.purpose.includes('行踪'));
});

test('affordable progression and world routes remain reachable over later turns; every materialized row uses the actual rules',()=>{
  const c=context();c.phase='choice';c.life.realm='foundation';c.life.cultivation=100;c.life.injury=0;for(const id of Object.keys(ITEMS))c.life.items[id]=200;c.life.cultivationProfile.spirit=100;
  const offered=new Set();
  for(let turn=2;turn<=112;turn++){
    c.identity.turnId=turn;c.receipt.action={intent:'interact',approach:'observe',targetId:'self',label:'观察渡口'};
    const rows=materializeStoryChoices(buildStoryChoicePlan(c),c,blocks),scene=sceneFor(c,rows);
    assert.ok(rows.length>=2&&rows.length<=3);for(const choice of scene.choices){const rule=v7ActionRule({life:c.life,turnId:turn,relatedEntities:scene.entities},choice);assert.equal(rule.reason,undefined,choice.approach);offered.add(choice.intent+':'+choice.approach);}
  }
  for(const action of ['practice:steady','practice:breakthrough','explore:cautious','travel:road','travel:smuggle','craft:alchemy','negotiate:bargain'])assert.ok(offered.has(action),action);
});

test('an ended contact and dead actors do not return as active opponents or addressees',()=>{
  const c=context();c.phase='choice';c.identity.turnId=6;c.entities=[{id:'old:host',name:'船夫',kind:'person',status:'alive'},{id:'old:dead',name:'故人',kind:'person',status:'dead'}];
  c.receipt.action={intent:'interact',approach:'leave',targetId:'old:host',label:'向船夫告辞'};
  const rows=materializeStoryChoices(buildStoryChoicePlan(c),c,[{kind:'dialogue',speaker:'k1',text:'船已离岸。'},{kind:'dialogue',speaker:'k2',text:'无效的对白。'}]);assert.ok(rows.length>=2);assert.ok(!rows.some(r=>['k1','k2'].includes(r.target)));
});

test('combat and retreat stay with the established opponent, and the safe alternative costs no time',()=>{
  const c=context();c.phase='choice';c.identity.turnId=8;c.entities=[{id:'old:rival',name:'执剑人',kind:'person',status:'alive'}];c.receipt.action={intent:'fight',approach:'guard',targetId:'old:rival',label:'守住剑势'};
  const foe=[{kind:'dialogue',speaker:'k1',text:'再接一剑。'}],plan=buildStoryChoicePlan(c),choices=materializeStoryChoices(plan,c,foe);
  assert.ok(choices.some(r=>r.action.startsWith('fight:')&&r.target==='k1'));assert.ok(choices.some(r=>r.action.startsWith('evade:')&&r.target==='k1'));assert.ok(choices.some(r=>r.action==='interact:observe'&&r.target==='self'));
  const bystander=[{kind:'dialogue',speaker:{kind:'person',name:'过路人'},text:'我只来问路。'}];assert.ok(!materializeStoryChoices(plan,c,bystander).some(r=>r.action.startsWith('fight:')||r.action.startsWith('evade:')));
});

test('an active clue grounds the next question, while exhausted resources never create unaffordable offers',()=>{
  const c=context();c.phase='choice';c.identity.turnId=4;c.director.mainQuest={kind:'clue',text:'断桥下的陶罐'};c.receipt.action={intent:'interact',approach:'observe',targetId:'self',label:'辨认河中的物件'};
  for(const id of Object.keys(c.life.items))c.life.items[id]=0;c.life.cultivationProfile.spirit=0;
  const rows=materializeStoryChoices(buildStoryChoicePlan(c),c,blocks);assert.ok(rows.some(r=>r.purpose.includes('断桥下的陶罐')));
  for(let turn=2;turn<24;turn++){c.identity.turnId=turn;const next=materializeStoryChoices(buildStoryChoicePlan(c),c,[]);assert.ok(next.length>=2);for(const r of next)assert.ok(!r.action.startsWith('craft:')&&!r.action.startsWith('travel:')&&r.action!=='practice:breakthrough');}
});

test('marked life can accept or decline a quoted repair offer, and only repay the original present creditor',async()=>{
  const born=n=>createLiveGame({runId:'growth-menu',seed:n,engineVersion:7,experienceVersion:1});
  let first;for(let i=1;i<=100;i++){const s=born(i);if(TECHNIQUES[s.life.cultivationProfile.experience.activeTechniqueId].defective&&s.life.items.supplies>=1){first=s;break;}}
  assert.ok(first);const rows=(c,b)=>materializeStoryChoices(buildStoryChoicePlan(c),c,b);
  const choose=(s,approach)=>{const choice=s.currentScene.choices.find(x=>x.approach===approach);assert.ok(choice,approach);return prepareChoice(s,{requestId:'take-'+approach,choiceId:choice.id});};
  const open=prepareOpening(first,{requestId:'open'}),s1=await commitAuthoredTurn(first,open,blocks),diagnosis=choose(s1,'diagnose'),ctx=buildStoryContext(s1,diagnosis);
  assert.equal(diagnosis.receipt.elapsedDays,GROWTH_TERMS.diagnose.days);
  const name='渡口药师',offer={kind:'dialogue',speaker:{kind:'person',name},text:'我愿用三日替你校法，下次见面还我一份行粮。'};
  const other={kind:'dialogue',speaker:{kind:'person',name:'卖油翁'},text:'你来买油么？'};
  assert.ok(!rows(ctx,blocks).some(r=>r.action==='craft:pledge'),'a speaker who made no offer is not a creditor');
  for(const text of ['我不愿用三日替你校法，下次见面还我一份行粮。','我愿用13天替你校法，下次见面还我一份行粮。','我愿用三日替你校法，下次见面拿十一份口粮还我。'])assert.ok(!rows(ctx,[{...offer,text}]).some(r=>r.action==='craft:pledge'));
  assert.ok(rows(ctx,[{...offer,text:'我可以替你校正这门功法，花三天便成；改日再见时，带一份口粮还我即可。'}]).some(r=>r.action==='craft:pledge'));
  const s2=await commitAuthoredTurn(s1,diagnosis,[other,offer]),restore=choose(s2,'restore'),pledge=choose(s2,'pledge');
  assert.equal(restore.receipt.elapsedDays,GROWTH_TERMS.restore.days);assert.equal(restore.nextLife.cultivationProfile.experience.repaired,true);assert.equal(restore.nextLife.cultivationProfile.experience.commitment,undefined);
  const creditor=s2.currentScene.entities.find(x=>x.name===name);
  assert.equal(pledge.receipt.action.targetId,creditor.id);assert.equal(pledge.receipt.elapsedDays,GROWTH_TERMS.pledge.days);assert.equal(s2.life.cultivationProfile.experience.commitment,undefined);
  assert.equal(pledge.nextLife.cultivationProfile.experience.commitment.entityId,creditor.id);
  const due=buildStoryContext(s2,pledge),idx=due.entities.findIndex(x=>x.id===creditor.id),repayable={...offer,speaker:'k'+(idx+1),text:'渡船已经靠岸。'};
  assert.ok(idx>=0);assert.ok(!rows(due,[other]).some(r=>r.action==='craft:repay'),'an absent creditor cannot receive supplies');
  const twin=structuredClone(due);twin.entities.push({id:'another-person',kind:'person',name});assert.ok(!rows(twin,[{...repayable,speaker:'k'+twin.entities.length}]).some(r=>r.action==='craft:repay'),'even a namesake cannot receive payment');
  const s3=await commitAuthoredTurn(s2,pledge,[other,repayable]),repay=choose(s3,'repay');
  assert.equal(repay.receipt.action.targetId,creditor.id);assert.deepEqual(repay.receipt.itemChanges,{supplies:-GROWTH_TERMS.repay.items.supplies});assert.equal(repay.nextLife.cultivationProfile.experience.commitment.status,'fulfilled');
  assert.ok(!rows(buildStoryContext(s3,repay),[repayable]).some(r=>r.action==='craft:repay'));
  assert.ok(!rows(context(),[offer]).some(r=>r.action.split(':')[1] in GROWTH_TERMS),'old lives do not acquire the new actions');
});
