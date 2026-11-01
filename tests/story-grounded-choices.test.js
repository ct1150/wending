import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,compileChoices} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {generateScene} from '../src/worker/story-provider.js';
import {buildGroundedMenuInput} from '../src/worker/story-grounded-choices.js';
import {GLM_PROFILE} from '../src/worker/story-config.js';
import {createStoryApi} from '../src/worker/story-api.js';

const profile={...GLM_PROFILE,validated:true,supportsStructuredOutput:true};
const actor={kind:'person',name:'灰衣管事'},destination={kind:'place',name:'北坡药圃'};
const body={blocks:[{kind:'dialogue',speaker:actor,text:'想留在外院，先去北坡药圃采办行粮。药圃的工钱能抵伙食，夜里还可回偏房研习功法。'}],cast:[actor,destination]};
const menu={choices:[{purpose:'问灰衣管事药圃采办要注意什么',action:'interact:ask',target:actor},{purpose:'动身前往北坡药圃接杂役',action:'travel:road',target:destination,stake:'low'}]};
function setup(){const state=createLiveGame({runId:'grounded',seed:4,engineVersion:7,experienceVersion:1,originStories:true});const pending=prepareOpening(state,{requestId:'opening'});return {state,pending,context:buildStoryContext(state,pending)};}
function aiFor(replies,completionTokens=[]){const calls=[];return {calls,async run(model,input){calls.push(structuredClone(input));const reply=replies[Math.min(calls.length-1,replies.length-1)];if(reply instanceof Error)throw reply;const tokens=completionTokens[calls.length-1]??100;return new Response('data: '+JSON.stringify({model,choices:[{delta:{content:JSON.stringify(reply)},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:tokens,total_tokens:100+tokens}})+'\n\ndata: [DONE]\n\n').body;}};}

test('grounded generation writes the menu from the immutable completed scene and real rule costs',async()=>{
 const {state,pending,context}=setup(),ai=aiFor([body,menu]),events=[];
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true,onProgress:e=>events.push(e)});
 assert.equal(result.status,'ready',result.errorCode);
 assert.equal(ai.calls.length,2);
 assert.equal(ai.calls[0].response_format.json_schema.schema.properties.choices,undefined);
 assert.ok(ai.calls[0].response_format.json_schema.schema.required.includes('people'),'narration-only scenes must declare present people');
 assert.ok(ai.calls[0].response_format.json_schema.schema.required.includes('destinations'),'possible destinations must be explicit');
 assert.deepEqual(Object.keys(ai.calls[1].response_format.json_schema.schema.properties),['choices']);
 const task=JSON.parse(ai.calls[1].messages.at(-1).content);
 assert.deepEqual(task.scene.blocks,body.blocks);
 assert.equal(task.selectedPurpose,null);
 assert.ok(task.actions.some(a=>a.action==='interact:ask'&&a.days===0));
 assert.ok(task.actions.some(a=>a.action==='travel:road'&&a.days===30));
 assert.ok(task.actions.some(a=>a.action==='rest:recover'&&a.days===30));
 assert.deepEqual(result.scene.blocks.map(b=>b.text),body.blocks.map(b=>b.text));
 assert.deepEqual(result.scene.choices.map(c=>[c.label,c.intent]),[[menu.choices[0].purpose,'interact'],[menu.choices[1].purpose,'travel']]);
 assert.deepEqual(result.usage,{promptTokens:200,completionTokens:200,totalTokens:400});
 const active=commitTurn(state,pending,result.scene);
 assert.ok(compileChoices(active,active.currentScene.choices).every(c=>c.enabled));
 assert.ok(events.filter(e=>e.type==='presentation').every(e=>e.blocks.every(b=>body.blocks.some(row=>b.text===row.text))));
 assert.ok(!events.some(e=>e.type==='reset'));
 assert.ok(events.some(e=>e.type==='presentation'&&e.choices.length===2),'menu streaming retains the completed body');
});

test('the menu grammar excludes an absent invented actor and a destination absent from the prose',async()=>{
 const {context}=setup(),absent={kind:'person',name:'失踪师兄'},elsewhere={kind:'place',name:'远方仙城'};
 const prose={...body,cast:[actor,destination,absent,elsewhere]};
 const ai=aiFor([prose,menu]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);
 const schema=JSON.stringify(ai.calls[1].response_format.json_schema.schema);
 assert.ok(schema.includes('灰衣管事'));assert.ok(schema.includes('北坡药圃'));
 assert.ok(!schema.includes('失踪师兄'));assert.ok(!schema.includes('远方仙城'));
 const task=JSON.parse(ai.calls[1].messages.at(-1).content);
 assert.ok(!JSON.stringify(task.actions).includes('失踪师兄'));
});

test('a second phase cannot rewrite prose or silently lose first phase accounting',async()=>{
 const {state,context}=setup();
 for(const reply of [{...menu,blocks:[{kind:'narration',text:'另一段。'}]},new Error('upstream unavailable')]){
  const ai=aiFor([body,reply]);
  const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
  assert.notEqual(result.status,'ready');assert.equal(result.scene,undefined);assert.equal(state.revision,0);assert.equal(ai.calls.length,2);
  assert.equal(result.accountingStatus,'unknown');
 }
});

test('the production API settles one turn after both grounded model phases',async()=>{
 const {context}=setup(),settlements=[],attempt={id:'api-attempt',sessionRef:'api-session',retryOf:null};
 const budget={async admit(){return {kind:'allowed'};},async getSession(){return {kind:'session',sessionRef:attempt.sessionRef};},async lookup(){return {code:'ATTEMPT_NOT_FOUND'};},async reserve(){return {kind:'reserved'};},async settle(value){settlements.push(value);return {kind:'settled'};}};
 const ai=aiFor([body,menu]),api=createStoryApi({budget,config:{readiness:()=>profile,groundedChoices:true}});
 const response=await api.fetch(new Request('https://game.test/api/story/turn',{method:'POST',headers:{origin:'https://game.test','content-type':'application/json','X-Story-Actions':'1',accept:'text/event-stream','X-Story-Preview':'2',cookie:'__Host-story_session='+'a'.repeat(64)},body:JSON.stringify({context,attempt,storyActions:true})}),{AI:ai});
 const frames=(await response.text()).trim().split('\n\n').map(row=>JSON.parse(row.slice(6))),result=frames.at(-1).result;
 assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,2);assert.equal(settlements.length,1);
 assert.deepEqual(result.scene.blocks.map(b=>b.text),body.blocks.map(b=>b.text));
 assert.equal(settlements[0].status,'complete');
 assert.ok(frames.filter(row=>row.type==='choice').length>=2,'both generated choices stream through the actual HTTP writer');
});

test('declining a request removes that interaction from the next menu grammar',async()=>{
 const {state,pending,context}=setup();
 const start=await generateScene(aiFor([body,{choices:[menu.choices[0],{purpose:'谢绝灰衣管事的采办差事',action:'interact:decline',target:actor}]}]),profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(start.status,'ready',start.errorCode);
 const current=commitTurn(state,pending,start.scene),p=prepareChoice(current,{requestId:'decline',choiceId:current.currentScene.choices[1].id}),next=buildStoryContext(current,p);
 const prose={blocks:[{kind:'narration',text:'灰衣管事点点头，收起了你的采办木牌。外院通往北坡药圃的山道仍开着。'}],cast:[actor,destination]};
 const ai=aiFor([prose,{choices:[menu.choices[1],{purpose:'查看外院山道沿途的脚印',action:'interact:observe',target:'self'}]}]);
 const result=await generateScene(ai,profile,next,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);
 const task=JSON.parse(ai.calls[1].messages.at(-1).content);
 assert.ok(!task.actions.some(a=>a.action==='interact:ask'));
});

test('a populated scene keeps both phase requests bounded without dropping the people',async()=>{
 const {context}=setup(),others=['陈掌柜','周药师','王师兄'].map(name=>({kind:'person',name})),place={kind:'place',name:'外院偏房'};
 const prose={blocks:[{kind:'narration',text:'灰衣管事与陈掌柜、周药师、王师兄在外院偏房前议事。北坡药圃正缺帮手。'}],cast:[actor,destination,...others,place]};
 const ai=aiFor([prose,menu]);const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);
 for(const input of ai.calls)assert.ok(new TextEncoder().encode(JSON.stringify(input)).length<=24576);
 const task=JSON.parse(ai.calls[1].messages.at(-1).content);
 for(const person of others)assert.ok(JSON.stringify(task).includes(person.name));
});

test('each completion has enough output room and both actual usages are accounted together',async()=>{
 const {context}=setup(),ai=aiFor([body,menu],[1100,700]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);
 assert.equal(result.usage.completionTokens,1800);
 assert.ok(ai.calls.every(input=>input.max_tokens<=1536));
});

test('reported absence and portraits cannot establish an interlocutor',async()=>{
 const {context}=setup();
 for(const text of ['灰衣管事尚未到场。墙边立着旧木牌。','你没见到灰衣管事，墙边立着旧木牌。','墙上挂着灰衣管事的画像，木牌垂在画框下。']){
  const ai=aiFor([{blocks:[{kind:'narration',text}],cast:[actor]},menu]);
  await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
  const task=JSON.parse(ai.calls[1].messages.at(-1).content);
  assert.ok(!task.actions.some(a=>a.action==='interact:ask'),text);
 }
});

test('a stocked mortal life and six current targets fit the production request limit',async()=>{
 const {context}=setup(),rich=structuredClone(context);
 for(const key of ['stones','supplies','manual','relic','herbs','iron','medicine','elixir','array','artifact','talisman'])rich.life.items[key]=10;
 const people=['陈掌柜','周药师','王师兄'].map(name=>({kind:'person',name}));
 const prose={blocks:[{kind:'narration',text:'灰衣管事与陈掌柜、周药师、王师兄在外院偏房前议事。北坡药圃正缺帮手。'}],cast:[actor,destination,...people,{kind:'place',name:'外院偏房'}]};
 const input=buildGroundedMenuInput({max_tokens:1536},prose,rich);
 assert.ok(new TextEncoder().encode(JSON.stringify(input)).length<=24576);
});

test('a continuing named actor can be referred to by a unique visible role',async()=>{
 const {state,pending,context}=setup();
 const start=await generateScene(aiFor([body,menu]),profile,context,{}, {storyActions:true,groundedChoices:true});
 const current=commitTurn(state,pending,start.scene),p=prepareChoice(current,{requestId:'ask',choiceId:current.currentScene.choices[0].id}),next=buildStoryContext(current,p);
 const prose={blocks:[{kind:'dialogue',speaker:'k1',text:'管事指着山道答道：等雾散后再去北坡药圃。'}],people:[actor],destinations:[destination]};
 const ai=aiFor([prose,menu]);const result=await generateScene(ai,profile,next,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);
 assert.ok(JSON.parse(ai.calls[1].messages.at(-1).content).actions.some(a=>a.action==='interact:ask'));
});

test('the menu asks for short button labels and streams their actual authored words',async()=>{
 const {context}=setup(),choices=menu.choices.map(({purpose,...row})=>({...row,label:purpose})),ai=aiFor([body,{choices}]),events=[];
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true,onProgress:e=>events.push(e)});
 assert.equal(result.status,'ready',result.errorCode);
 for(const branch of ai.calls[1].response_format.json_schema.schema.properties.choices.items.oneOf){assert.ok(branch.properties.label);assert.equal(branch.properties.purpose,undefined);}
 assert.ok(events.some(e=>e.type==='presentation'&&e.choices.length===2));
 assert.deepEqual(result.scene.choices.map(c=>c.label),choices.map(c=>c.label));
});
