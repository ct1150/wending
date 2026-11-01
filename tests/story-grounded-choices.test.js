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
const menu={choices:[{purpose:'问灰衣管事药圃采办要注意什么',action:'interact:ask',target:actor},{purpose:'动身前往北坡药圃接杂役',action:'travel:road',target:destination,stake:'normal'}]};
function setup(){const state=createLiveGame({runId:'grounded',seed:4,engineVersion:7,experienceVersion:1,originStories:true});const pending=prepareOpening(state,{requestId:'opening'});return {state,pending,context:buildStoryContext(state,pending)};}
function aiFor(replies,completionTokens=[],stopReasons=[]){const calls=[];return {calls,async run(model,input){calls.push(structuredClone(input));let reply=replies[Math.min(calls.length-1,replies.length-1)];if(typeof reply==='function')reply=reply(input);if(reply instanceof Error)throw reply;const tokens=completionTokens[calls.length-1]??100;return new Response('data: '+JSON.stringify({model,choices:[{delta:{content:typeof reply==='string'?reply:JSON.stringify(reply)},finish_reason:stopReasons[calls.length-1]??'stop'}],usage:{prompt_tokens:100,completion_tokens:tokens,total_tokens:100+tokens}})+'\n\ndata: [DONE]\n\n').body;}};}

test('grounded generation writes the menu from the immutable completed scene and real rule costs',async()=>{
 const {state,pending,context}=setup(),ai=aiFor([body,menu]),events=[];
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true,onProgress:e=>events.push(e)});
 assert.equal(result.status,'ready',result.errorCode);
 assert.equal(ai.calls.length,2);
 assert.equal(ai.calls[0].response_format.json_schema.schema.properties.choices,undefined);
 const paragraph=ai.calls[0].response_format.json_schema.schema.properties.blocks.items;
 assert.ok((paragraph.oneOf??[paragraph]).every(row=>row.properties.text.maxLength===undefined),'do not force a JSON string to close in the middle of a sentence');
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
 assert.ok(schema.includes('actionRef'));
 assert.ok(!schema.includes('失踪师兄'));assert.ok(!schema.includes('远方仙城'));
 const task=JSON.parse(ai.calls[1].messages.at(-1).content);
 assert.ok(JSON.stringify(task.participants).includes('灰衣管事'));assert.ok(JSON.stringify(task.participants).includes('北坡药圃'));
 assert.ok(!JSON.stringify(task.actions).includes('失踪师兄'));
});

test('a second phase cannot rewrite prose or silently lose first phase accounting',async()=>{
 const {state,context}=setup();
 for(const reply of [{...menu,blocks:[{kind:'narration',text:'另一段。'}]},new Error('upstream unavailable')]){
  const ai=aiFor([body,reply]);
  const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
  assert.notEqual(result.status,'ready');assert.equal(result.scene,undefined);assert.equal(state.revision,0);assert.equal(ai.calls.length,reply instanceof Error?2:3);
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
 const start=await generateScene(aiFor([body,{choices:[menu.choices[1],{purpose:'谢绝灰衣管事的采办差事',action:'interact:decline',target:actor}]}]),profile,context,{}, {storyActions:true,groundedChoices:true});
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

test('a stocked mortal life and six peaceful or threatened targets fit the production request limit',async()=>{
 const {context}=setup(),rich=structuredClone(context);
 for(const key of ['stones','supplies','manual','relic','herbs','iron','medicine','elixir','array','artifact','talisman'])rich.life.items[key]=10;
 const people=['陈掌柜','周药师','王师兄'].map(name=>({kind:'person',name}));
 const prose={blocks:[{kind:'narration',text:'灰衣管事与陈掌柜、周药师、王师兄在外院偏房前议事。北坡药圃正缺帮手。'}],cast:[actor,destination,...people,{kind:'place',name:'外院偏房'}]};
 const input=buildGroundedMenuInput({max_tokens:1536},prose,rich);
 assert.ok(new TextEncoder().encode(JSON.stringify(input)).length<=24576);
 const battle={...prose,blocks:[{kind:'narration',text:prose.blocks[0].text+'有人拔剑围攻，饥饿的弟子求分行粮，许诺用灵石换取帮工报酬。'+'山雨不停，外院石阶已经积满落叶，屋檐的水珠一滴滴落在刀鞘上。'.repeat(8)}]};
 assert.ok(new TextEncoder().encode(JSON.stringify(buildGroundedMenuInput({max_tokens:1536},battle,rich))).length<=24576);
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
 const item=ai.calls[1].response_format.json_schema.schema.properties.choices.properties.alternative;
 for(const branch of item.oneOf??[item]){assert.ok(branch.properties.label);assert.equal(branch.properties.purpose,undefined);}
 assert.ok(events.some(e=>e.type==='presentation'&&e.choices.length===2));
 assert.deepEqual(result.scene.choices.map(c=>c.label),choices.map(c=>c.label));
});

test('narration establishes an explicitly present official without requiring a stock pose verb',async()=>{
 const {context}=setup();
 const prose={blocks:[{kind:'narration',text:'灰衣管事手中的名册翻得哗哗作响，目光扫过你时带了几分迟疑。后山灵田要人帮工。'}],people:[actor],destinations:[destination]};
 const ai=aiFor([prose,menu]);await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.ok(JSON.parse(ai.calls[1].messages.at(-1).content).actions.some(a=>a.action==='interact:ask'));
});

test('travel menu uses the settled destination rather than the previous director location',async()=>{
 const {state,pending,context}=setup(),start=await generateScene(aiFor([body,menu]),profile,context,{}, {storyActions:true,groundedChoices:true});
 const current=commitTurn(state,pending,start.scene),p=prepareChoice(current,{requestId:'arrive',choiceId:current.currentScene.choices[1].id}),next=buildStoryContext(current,p);
 const prose={blocks:[{kind:'narration',text:'北坡药圃的药畦连到石墙脚下，药圃里传来锄地声。'}],people:[],destinations:[destination,{kind:'place',name:'药圃'}]};
 const input=buildGroundedMenuInput({max_tokens:1536},prose,next),task=JSON.parse(input.messages.at(-1).content);
 assert.equal(task.scene.location,'北坡药圃');assert.ok(!task.actions.some(a=>a.action.startsWith('travel:')));
});

test('closed scene-local references resolve to the model-authored people and destinations',async()=>{
 const {context}=setup(),choices=[{label:'问管事采办时要留意什么',action:'interact:ask',target:'p1'},{label:'前往北坡药圃接下杂役',action:'travel:road',target:'l1',stake:'normal'}],events=[];
 const result=await generateScene(aiFor([body,{choices}]),profile,context,{}, {storyActions:true,groundedChoices:true,onProgress:e=>events.push(e)});
 assert.equal(result.status,'ready',result.errorCode);
 assert.deepEqual(result.scene.entities.map(e=>e.name),['灰衣管事','北坡药圃']);
 assert.ok(events.some(e=>e.type==='presentation'&&e.choices.length===2));
});

test('a mislabeled question is corrected once against the same scene without changing its prose',async()=>{
 const {context}=setup(),bad={choices:[{label:'上前询问管事采办要留意什么',action:'interact:observe',target:'self'},{label:'前往北坡药圃接下杂役',action:'travel:road',target:'l1',stake:'normal'}]},good={choices:[{label:'上前询问管事采办要留意什么',action:'interact:ask',target:'p1'},bad.choices[1]]};
 const ai=aiFor([body,bad,good]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true,recoverChoices:true});
 assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);
 assert.equal(result.scene.choices[0].approach,'ask');assert.deepEqual(result.scene.blocks.map(b=>b.text),body.blocks.map(b=>b.text));
 assert.equal(result.usage.completionTokens,300);
});

test('a model-selected rule reference compiles the complete offered action and streams its label',async()=>{
 const {context}=setup(),events=[];
 const ai=aiFor([body,input=>{const task=JSON.parse(input.messages.at(-1).content);return {choices:[{label:'问管事采办要留意什么',actionRef:task.actions.find(a=>a.action==='interact:ask').ref},{label:'动身前往北坡药圃',actionRef:task.actions.find(a=>a.action==='travel:road').ref}]};}]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true,onProgress:e=>events.push(e)});
 assert.equal(result.status,'ready',result.errorCode);assert.equal(result.scene.choices[0].approach,'ask');assert.equal(result.scene.choices[1].intent,'travel');
 assert.ok(events.some(e=>e.type==='presentation'&&e.choices.length===2));
});

test('grounded production also accepts an unmarked legacy v7 life',async()=>{
 const state=createLiveGame({runId:'legacy-grounded',seed:4,engineVersion:7}),context=buildStoryContext(state,prepareOpening(state,{requestId:'opening'}));
 const result=await generateScene(aiFor([body,menu]),profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);
});

test('after an actual repair the writer receives its settled goal, state and ninety days',async()=>{
 const state=createLiveGame({runId:'repair-goal',seed:3,engineVersion:7,experienceVersion:1,originStories:true}),pending=prepareOpening(state,{requestId:'opening'}),context=buildStoryContext(state,pending);
 const diagnose={purpose:'检视自身功法缺陷',action:'craft:diagnose',target:'self',stake:'low'},restore={purpose:'自行推演修补功法',action:'craft:restore',target:'self',stake:'low'};
 const first=await generateScene(aiFor([body,{choices:[diagnose,menu.choices[0]]}]),profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(first.status,'ready',first.errorCode);
 let current=commitTurn(state,pending,first.scene),p=prepareChoice(current,{requestId:'diagnose',choiceId:current.currentScene.choices[0].id});
 const second=await generateScene(aiFor([body,{choices:[restore,menu.choices[0]]}]),profile,buildStoryContext(current,p),{}, {storyActions:true,groundedChoices:true});
 current=commitTurn(current,p,second.scene);p=prepareChoice(current,{requestId:'repair',choiceId:current.currentScene.choices[0].id});
 const ai=aiFor([{blocks:[{kind:'narration',text:'三个月后，功法缺处终于补全，山门的槐叶已经落尽。'}],people:[],destinations:[]},input=>{const task=JSON.parse(input.messages.at(-1).content);return {choices:[{label:'亲试补全后的功法',actionRef:task.actions.find(a=>a.action==='practice:steady').ref},{label:'在山门槐树下调息恢复灵力',actionRef:task.actions.find(a=>a.action==='rest:recover').ref}]};}]);
 const result=await generateScene(ai,profile,buildStoryContext(current,p),{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);
 const facts=JSON.parse(ai.calls[0].messages.at(-1).content),world=JSON.parse(ai.calls[0].messages[1].content);
 assert.equal(facts.elapsedDays,90);assert.equal(facts.technique,undefined);assert.match(facts.currentGoal,/功法已修补/u);
 assert.equal(world['眼前与旧闻'].当前打算,facts.currentGoal);
 assert.equal(world.life,undefined,'do not repeat the birth-time defective technique as current state');
 assert.match(world.本次结算.当前功法,/已经修补/u);
 assert.ok(!JSON.stringify(world.memory.recent).includes(body.blocks[0].text));
});

test('a menu of only questions is corrected into a real opportunity while questions remain optional',async()=>{
 const {context}=setup(),ai=aiFor([body,input=>{const t=JSON.parse(input.messages.at(-1).content),ref=t.actions.find(a=>a.action==='interact:ask').ref;return {choices:[{label:'问管事采办要留意什么',actionRef:ref},{label:'问管事杂役如何分工',actionRef:ref}]};},input=>{const t=JSON.parse(input.messages[1].content);return {choices:[{label:'回偏房按现有功法修行',actionRef:t.actions.find(a=>a.action==='practice:steady').ref},{label:'问管事采办要留意什么',actionRef:t.actions.find(a=>a.action==='interact:ask').ref}]};}]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);
 assert.equal(result.scene.choices[0].intent,'practice');assert.equal(result.scene.choices[1].approach,'ask');
});

test('resource references constrain labels to name the actual resource rather than an unrelated paper',()=>{
 const {context}=setup(),input=buildGroundedMenuInput({max_tokens:1536},body,context),task=JSON.parse(input.messages[1].content);
 const manual=task.actions.find(a=>a.action==='explore:cautious'&&a.target==='manual'),item=input.response_format.json_schema.schema.properties.choices.properties.alternative;
 const branch=(item.oneOf??[item]).find(row=>row.properties.actionRef.enum.includes(manual.ref));
 assert.ok(branch.properties.actionRef.enum.includes(manual.ref));
 assert.deepEqual(Object.keys(branch.properties),['actionRef','label']);
 assert.match(manual.description,/寻找.*完整功法/u);
});

test('a truncated optional body tail gets one compact model retry and one final commit candidate',async()=>{
 const {context}=setup(),ai=aiFor([JSON.stringify(body).slice(0,-1)+',"story":{',body,menu],[],['length','stop','stop']);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);
 assert.deepEqual(Object.keys(ai.calls[1].response_format.json_schema.schema.properties),['blocks','people','destinations']);
 assert.deepEqual(result.scene.blocks.map(b=>b.text),body.blocks.map(b=>b.text));
 assert.equal(result.usage.completionTokens,300);
});

test('an official walking into the current scene remains an actual interlocutor',async()=>{
 const {context}=setup(),official={kind:'person',name:'青衣执事'};
 const prose={blocks:[{kind:'narration',text:'你收起功法，青衣执事正路过此地，折扇一敲，示意你上前验看修习结果。'}],people:[official],destinations:[]};
 const ai=aiFor([prose,input=>{const t=JSON.parse(input.messages[1].content);return {choices:[{actionRef:t.actions.find(a=>a.action==='interact:ask').ref,label:'上前询问考核条件'},{actionRef:t.actions.find(a=>a.action==='practice:steady').ref,label:'按现有功法继续修行'}]};}]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);assert.equal(result.scene.choices[0].approach,'ask');
});

test('an omitted-subject departure makes the named actor unavailable for another question',()=>{
 const {context}=setup(),prose={blocks:[{kind:'narration',text:'灰衣管事收起名册，转身离去。你独自留在外院，准备研习功法。'}],people:[actor],destinations:[]};
 const input=buildGroundedMenuInput({max_tokens:1536},prose,context),task=JSON.parse(input.messages[1].content);
 assert.ok(!task.actions.some(a=>a.action==='interact:ask'));
});

test('an observation label cannot secretly spend a long cultivation period',async()=>{
 const {context}=setup(),prose={...body,blocks:[{...body.blocks[0],text:body.blocks[0].text+'管事手里拿着名册。'}]},ai=aiFor([prose,input=>{const t=JSON.parse(input.messages[1].content);return {choices:[{actionRef:t.actions.find(a=>a.action==='practice:steady').ref,label:'观察管事手里名册上的名字'},{actionRef:t.actions.find(a=>a.action==='rest:recover').ref,label:'回偏房调息恢复灵力'}]};},input=>{const t=JSON.parse(input.messages[1].content);return {choices:[{actionRef:t.actions.find(a=>a.action==='interact:observe').ref,label:'观察管事手里名册上的名字'},{actionRef:t.actions.find(a=>a.action==='rest:recover').ref,label:'回偏房调息恢复灵力'}]};}]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);assert.equal(result.scene.choices[0].approach,'observe');
});

test('a rejected scene can be regenerated from the immutable receipt after a menu correction, within four calls',async()=>{
 const {state,context}=setup(),badBody={...body,story:{life:{items:{stones:999}}}},fresh=[{kind:'narration',text:'灰衣管事把竹简放回案上，指着北坡药圃说明那边正缺帮工。'}];
 const ai=aiFor([badBody,{choices:[{label:'前往北坡药圃',actionRef:'missing'},{label:'问管事差事',actionRef:'missing'}]},menu,{blocks:fresh,labels:{a:'询问灰衣管事采办的要求',b:'动身前往北坡药圃'}}]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true,recoverChoices:true});
 assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,4);assert.equal(state.revision,0);
 assert.deepEqual(result.scene.blocks.map(b=>b.text),fresh.map(b=>b.text));assert.equal(result.usage.completionTokens,400);
 assert.equal(result.scene.story.life,undefined);assert.equal(result.scene.choices[0].approach,'ask');
});

test('a menu correction after a regenerated scene uses that new prose rather than the rejected draft',async()=>{
 const {context}=setup(),fresh=[{kind:'narration',text:'雨水敲着偏房的瓦，漏下来的水滴正落在功法旁。你可以在檐下修行，也可以进屋闭关。'}];
 const primary={choices:[{label:'按现有功法修行',action:'practice:steady',target:'self',stake:'normal'},{label:'闭关打磨当前功法',action:'practice:intensive',target:'self',stake:'normal'}]};
 const ai=aiFor([{...body,story:{life:{items:{stones:999}}}},primary,{blocks:fresh,labels:{a:'闭关修行',b:'闭关修行'}},input=>{const t=JSON.parse(input.messages[1].content);assert.deepEqual(t.scene.blocks,fresh);const ref=t.actions.find(a=>a.action==='practice:steady').ref;return {choices:[{actionRef:ref,label:'在檐下按功法修行'},{actionRef:t.actions.find(a=>a.action==='practice:intensive').ref,label:'进屋以行粮强化修炼'}]};}]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true,recoverChoices:true});
 assert.equal(result.status,'ready',JSON.stringify({result,calls:ai.calls.length,last:ai.calls.at(-1)?.messages.at(-1)}));assert.equal(ai.calls.length,4);assert.deepEqual(result.scene.blocks.map(b=>b.text),fresh.map(b=>b.text));
});

test('different captions cannot disguise a duplicate rule action in one menu',async()=>{
 const {context}=setup(),ai=aiFor([body,input=>{const t=JSON.parse(input.messages[1].content),ref=t.actions.find(a=>a.action==='practice:steady').ref;return {choices:[{actionRef:ref,label:'按功法闭关修行'},{actionRef:ref,label:'继续按旧法吐纳'}]};},input=>{const t=JSON.parse(input.messages[1].content);return {choices:[{actionRef:t.actions.find(a=>a.action==='practice:steady').ref,label:'按功法闭关修行'},{actionRef:t.actions.find(a=>a.action==='rest:recover').ref,label:'回偏房调息恢复灵力'}]};}]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);assert.equal(result.scene.choices[1].intent,'rest');
});

test('an interrupted first provider stream retries the body without losing the original receipt',async()=>{
 const {state,context}=setup(),failure=Object.assign(Error('interrupted upstream stream'),{code:'PROVIDER_RESPONSE_INVALID'}),ai=aiFor([failure,body,menu]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);assert.equal(state.revision,0);
 assert.equal(result.accountingStatus,'unknown');assert.equal(result.usage.completionTokens,200);
});

test('generic rule captions are regenerated with an explicit anchor in the completed prose',async()=>{
 const state=createLiveGame({runId:'basis',seed:3,engineVersion:7,experienceVersion:1,originStories:true}),context=buildStoryContext(state,prepareOpening(state,{requestId:'opening'})),prose={blocks:[{kind:'narration',text:'锁息旧章在经脉中隐隐作痛，缺角石镜映着窗外的雨。'}],people:[],destinations:[]};
 const refs=input=>JSON.parse(input.messages[1].content).actions;
 const ai=aiFor([prose,input=>({choices:[{actionRef:refs(input).find(a=>a.action==='practice:steady').ref,label:'按现有功法长期修炼'},{actionRef:refs(input).find(a=>a.action==='craft:diagnose').ref,label:'辨明自身功法缺陷'}]}),input=>({choices:[{actionRef:refs(input).find(a=>a.action==='practice:steady').ref,label:'按锁息旧章长期修炼',basis:'锁息旧章'},{actionRef:refs(input).find(a=>a.action==='craft:diagnose').ref,label:'检视锁息旧章痛处',basis:'锁息旧章'}]})]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);
 assert.deepEqual(result.scene.blocks,prose.blocks);
 assert.ok(result.scene.choices.every(c=>c.label.includes('锁息旧章')));
 assert.ok(ai.calls[1].response_format.json_schema.schema.properties.choices.properties.advance.oneOf.every(row=>row.required.includes('label')&&!row.required.includes('basis')));
});

test('the native menu schema reserves one slot for a positive-time action and accepts the two named slots',async()=>{
 const {context}=setup(),ai=aiFor([body,input=>{const t=JSON.parse(input.messages[1].content),schema=input.response_format.json_schema.schema.properties.choices;
  assert.equal(schema.type,'object');assert.deepEqual(schema.required,['advance','alternative']);
  const refs=schema.properties.advance.oneOf.flatMap(row=>row.properties.actionRef.enum);
  assert.ok(refs.length>0&&refs.every(ref=>t.actions.find(a=>a.ref===ref).days>0));
  return {choices:{advance:{actionRef:t.actions.find(a=>a.action==='practice:steady').ref,label:'回偏房按功法修行',basis:'偏房'},alternative:{actionRef:t.actions.find(a=>a.action==='interact:ask').ref,label:'询问管事采办的要求',basis:'采办'}}};
 }]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});assert.equal(result.status,'ready',result.errorCode);assert.equal(result.scene.choices.length,2);assert.equal(ai.calls.length,2);
});

test('an ordinary field request cannot become feeding the official or an unsupported fight or trade',()=>{
 const {context}=setup(),scene={blocks:[{kind:'narration',text:'灰衣管事指着田边一株枯黄灵稻，示意你先查看根部。'}],people:[actor],destinations:[]};
 const task=JSON.parse(buildGroundedMenuInput({},scene,context).messages[1].content);
 assert.ok(!task.actions.some(a=>a.action==='interact:help'||a.action==='negotiate:cooperate'||a.action.startsWith('fight:')||a.action.startsWith('evade:')));
 assert.ok(task.actions.some(a=>a.action==='practice:steady'));
});

test('typed compatibility choices also require a concrete basis in the finished scene',async()=>{
 const {context}=setup(),scene={blocks:[{kind:'narration',text:'锁息旧章在经脉中隐隐作痛，缺角石镜映着窗外的雨。'}],people:[],destinations:[]};
 const pair=(label,action)=>({label,action,target:'self',stake:'normal'});
 const ai=aiFor([scene,{choices:[pair('按现有功法长期修炼','practice:steady'),pair('调息恢复灵力','rest:recover')]},{choices:[pair('按锁息旧章长期修炼','practice:steady'),pair('握着缺角石镜调息休养','rest:recover')]}]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});
 assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);assert.equal(result.scene.choices[0].label,'按锁息旧章长期修炼');
});

test('inspecting a physical rice jar is a valid observation rather than a diagnosis or practice',async()=>{
 const {context}=setup(),scene={blocks:[{kind:'narration',text:'柴房米缸里还有一袋陈年糙米，可用作行粮。'}],people:[],destinations:[]};
 const ai=aiFor([scene,input=>{const t=JSON.parse(input.messages[1].content);return {choices:{advance:{actionRef:t.actions.find(a=>a.action==='explore:cautious'&&a.target==='supplies').ref,label:'从柴房附近寻找行粮'},alternative:{actionRef:t.actions.find(a=>a.action==='interact:observe').ref,label:'检视柴房米缸里的陈年糙米'}}};}]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,2);assert.equal(result.scene.choices[1].approach,'observe');
});

test('unexpected menu fields are rejected and corrected against the same body inside the attempt',async()=>{
 const {context}=setup(),ai=aiFor([body,{...menu,stake:'untrusted extra field'},menu]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);assert.deepEqual(result.scene.blocks.map(b=>b.text),body.blocks.map(b=>b.text));
});

test('once cultivation is sufficient the writer gets the missing gate material and the unchanged actual realm',async()=>{
 let state=createLiveGame({runId:'gate-goal',seed:7,engineVersion:7});
 for(let i=0;i<4;i++){
  const p=i?prepareChoice(state,{requestId:'train-'+i,choiceId:state.currentScene.choices[0].id}):prepareOpening(state,{requestId:'opening'}),prefix='gate-'+i;
  state=commitTurn(state,p,{id:prefix,title:'偏房',location:state.director.world.location,entities:[],blocks:[{kind:'narration',text:'偏房中，旧功法已经摊在案上，门外传来雨声。'}],choices:[{id:prefix+'-practice',label:'按旧功法修炼',intent:'practice',targetId:'self',stake:'normal',approach:'steady'},{id:prefix+'-rest',label:'在偏房调息休养',intent:'rest',targetId:'self',stake:'normal',approach:'recover'}],memoryDeltas:[]});
 }
 assert.ok(state.life.cultivation>=2);assert.equal(state.life.items.manual??0,0);
 const p=prepareChoice(state,{requestId:'gate-next',choiceId:state.currentScene.choices[0].id}),ai=aiFor([body,menu]);
 const result=await generateScene(ai,profile,buildStoryContext(state,p),{}, {storyActions:true,groundedChoices:true});assert.equal(result.status,'ready',result.errorCode);
 const facts=JSON.parse(ai.calls[0].messages[1].content);
 assert.match(facts.currentGoal,/完整功法/u);assert.match(facts.currentGoal,/尚缺/u);
 assert.equal(JSON.parse(ai.calls[1].messages[1].content).goal,facts.currentGoal);
 assert.deepEqual(JSON.parse(ai.calls[1].messages[1].content).actions.slice(0,1).map(a=>[a.action,a.target]),[['explore:cautious','manual']]);
 assert.match(facts.本次结算.境界变化,/仍为凡人.*没有破境/u);
 assert.equal(facts.本次结算.修为变化,p.nextLife.cultivation-p.receipt.before.cultivation);
 assert.equal(facts.cultivation,undefined,'an internal progress counter is not a fictional number of realm layers');
 let serial=0;
 while(state.life.cultivationProfile.spirit>20){const pending=prepareChoice(state,{requestId:'drain-'+serial,choiceId:state.currentScene.choices[0].id}),scene=structuredClone(state.currentScene);scene.id='drain-scene-'+serial;scene.choices=scene.choices.map((c,i)=>({...c,id:'drain-'+serial+'-'+i}));state=commitTurn(state,pending,scene);serial++;}
 const low=prepareChoice(state,{requestId:'low-spirit',choiceId:state.currentScene.choices[0].id}),lowAi=aiFor([body,menu]);
 await generateScene(lowAi,profile,buildStoryContext(state,low),{}, {storyActions:true,groundedChoices:true});
 assert.match(JSON.parse(lowAi.calls[0].messages[1].content).currentGoal,/休养/u);
 assert.equal(JSON.parse(lowAi.calls[1].messages[1].content).actions[0].action,'rest:recover');
});

test('a steady practice label cannot claim the food cost of an intensive practice',async()=>{
 const {context}=setup(),reply=label=>input=>{const t=JSON.parse(input.messages[1].content);return {choices:{advance:{actionRef:t.actions.find(a=>a.action==='practice:steady').ref,label},alternative:{actionRef:t.actions.find(a=>a.action==='interact:ask').ref,label:'询问灰衣管事采办的要求'}}};};
 const ai=aiFor([body,reply('按功法消耗行粮强化修炼'),reply('回偏房按功法稳步修行')]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);assert.equal(result.scene.choices[0].label,'回偏房按功法稳步修行');
});

test('a breakthrough caption cannot execute ordinary practice and rule references name their actual approach',async()=>{
 const {context}=setup(),reply=label=>input=>{const t=JSON.parse(input.messages[1].content),rule=t.actions.find(a=>a.action==='practice:steady');return {choices:{advance:{actionRef:rule.ref,label},alternative:{actionRef:t.actions.find(a=>a.action==='interact:ask').ref,label:'询问灰衣管事采办的要求'}}};};
 const ai=aiFor([body,reply('按功法闭关冲击炼气'),reply('回偏房按功法稳步修行')]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);
 assert.equal(JSON.parse(ai.calls[1].messages[1].content).actions.find(a=>a.action==='practice:steady').ref,'steady:self');
});

test('asking an official for food cannot masquerade as physically searching for supplies',async()=>{
 const {context}=setup(),reply=label=>input=>{const t=JSON.parse(input.messages[1].content);return {choices:{advance:{actionRef:t.actions.find(a=>a.action==='explore:cautious'&&a.target==='supplies').ref,label},alternative:{actionRef:t.actions.find(a=>a.action==='interact:ask').ref,label:'询问灰衣管事采办的要求'}}};};
 const ai=aiFor([body,reply('向灰衣管事讨要行粮补给'),reply('到北坡药圃寻找行粮')]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);
});

test('the final resource caption must search for its actual resource rather than an unrelated paper',async()=>{
 const {context}=setup(),reply=label=>input=>{const t=JSON.parse(input.messages[1].content);return {choices:{advance:{actionRef:t.actions.find(a=>a.action==='explore:cautious'&&a.target==='manual').ref,label},alternative:{actionRef:t.actions.find(a=>a.action==='interact:ask').ref,label:'询问灰衣管事采办的要求'}}};};
 const ai=aiFor([body,reply('去偏房寻找一页名册'),reply('去偏房寻找完整功法')]);const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);
});

test('one correction explains both generic captions instead of fixing them in separate attempts',async()=>{
 const {context}=setup(),scene={blocks:[{kind:'narration',text:'后山岩缝下，半块干硬行粮落在苔藓间，缺角石镜映出远处山影，风从湿冷的石壁旁吹过。'}],people:[],destinations:[]};
 const ai=aiFor([scene,input=>{const t=JSON.parse(input.messages[1].content);return {choices:{advance:{actionRef:t.actions.find(a=>a.action==='rest:recover').ref,label:'调息休养恢复灵力伤势'},alternative:{actionRef:t.actions.find(a=>a.action==='interact:observe').ref,label:'查看眼前已有物件或痕迹'}}};},input=>{assert.ok(input.messages.at(-1).content.includes('调息休养恢复灵力伤势'));assert.ok(input.messages.at(-1).content.includes('查看眼前已有物件或痕迹'));const t=JSON.parse(input.messages[1].content);return {choices:{advance:{actionRef:t.actions.find(a=>a.action==='rest:recover').ref,label:'在后山岩缝边调息休养'},alternative:{actionRef:t.actions.find(a=>a.action==='interact:observe').ref,label:'查看岩缝苔藓下的行粮'}}};}]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,groundedChoices:true});assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,3);
});

test('the menu highlights current concrete terms and offers a contextual alternative before another training action',()=>{
 const {context}=setup(),scene={blocks:[{kind:'narration',text:'林朔在后山枯松下静养，缺角石镜映出一枚青色玉简，锁息旧章已经摊在身旁。'}],people:[],destinations:[]};
 const input=buildGroundedMenuInput({},scene,context),task=JSON.parse(input.messages[1].content);
 assert.ok(task.groundingTerms.includes('缺角石镜'));assert.ok(task.groundingTerms.includes('锁息旧章'));assert.ok(task.groundingTerms.includes('后山枯松'));
 assert.equal(input.response_format.json_schema.schema.properties.choices.properties.alternative.oneOf[0].properties.actionRef.enum[0],'observe:self');
 assert.ok(task.actions.some(a=>a.action==='practice:steady'),'other legal alternatives remain available');
});
