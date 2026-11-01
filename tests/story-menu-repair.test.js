import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,commitTurn,compileChoices} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {generateScene} from '../src/worker/story-provider.js';
import {GLM_PROFILE} from '../src/worker/story-config.js';
import {createStoryApi} from '../src/worker/story-api.js';

const profile={...GLM_PROFILE,validated:true,supportsStructuredOutput:true};
const actor={kind:'person',name:'船家'};
const blocks=[{kind:'dialogue',speaker:actor,text:'渡船还没开，我只知道那张符纸上画着一座断桥。'}];
const observe={action:'interact:observe',target:'self',purpose:'辨认符纸上断桥旁的水纹'};
const ask={action:'interact:ask',target:actor,purpose:'问船家断桥在河流的哪一段'};
const invalid={blocks,choices:[observe,{action:'negotiate:bargain',target:actor,stake:'low',purpose:'买下船家的符纸'}]};
const state=()=>createLiveGame({runId:'menu-repair',seed:4,originId:'ferry',engineVersion:7,experienceVersion:1,originStories:true});
function aiFor(replies){const calls=[];return {calls,async run(model,input){calls.push(structuredClone(input));const reply=replies[Math.min(calls.length-1,replies.length-1)];return new Response('data: '+JSON.stringify({model,choices:[{delta:{content:typeof reply==='string'?reply:JSON.stringify(reply)},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})+'\n\ndata: [DONE]\n\n').body;}};}

test('a rejected model menu is repaired within the turn without replacing its prose or inventing buttons',async()=>{
 const s=state(),pending=prepareOpening(s,{requestId:'opening'}),context=buildStoryContext(s,pending);
 const uncorrected=await generateScene(aiFor([invalid]),profile,context,{}, {storyActions:true});
 assert.equal(uncorrected.errorCode,'CHOICE_NOT_COMPILABLE');
 const ai=aiFor([invalid,{choices:[observe,ask]}]),events=[];
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,recoverChoices:true,onProgress:e=>events.push(e)});
 assert.equal(result.status,'ready',result.errorCode);
 assert.equal(ai.calls.length,2);
 assert.deepEqual(Object.keys(ai.calls[1].response_format.json_schema.schema.properties),['choices']);
 assert.deepEqual(ai.calls[1].response_format.json_schema.schema.required,['choices']);
 assert.ok(ai.calls[1].max_tokens<ai.calls[0].max_tokens);
 assert.deepEqual(result.scene.blocks.map(b=>b.text),blocks.map(b=>b.text));
 assert.deepEqual(result.scene.choices.map(c=>c.label),[observe.purpose,ask.purpose]);
 assert.deepEqual(result.usage,{promptTokens:200,completionTokens:200,totalTokens:400});
 const active=commitTurn(s,pending,result.scene);
 assert.equal(active.revision,1);assert.ok(compileChoices(active,active.currentScene.choices).every(c=>c.enabled));
 assert.ok(events.some(e=>e.type==='reset'));
 const correction=events.slice(events.findIndex(e=>e.type==='reset')+1).filter(e=>e.type==='presentation');
 assert.ok(correction.length);assert.ok(correction.every(e=>e.blocks[0].text===blocks[0].text));
});

test('the real API repairs once and settles the original turn only after the corrected menu is valid',async()=>{
 const s=state(),pending=prepareOpening(s,{requestId:'api-opening'}),context=buildStoryContext(s,pending),settlements=[];
 const attempt={id:'attempt-one',sessionRef:'session-one',retryOf:null};
 const budget={async admit(){return {kind:'allowed'};},async getSession(){return {kind:'session',sessionRef:attempt.sessionRef};},async lookup(){return {code:'ATTEMPT_NOT_FOUND'};},async reserve(){return {kind:'reserved'};},async settle(value){settlements.push(value);return {kind:'settled'};}};
 const api=createStoryApi({budget,config:{readiness:()=>profile}}),ai=aiFor([invalid,{choices:[observe,ask]}]);
 const response=await api.fetch(new Request('https://game.test/api/story/turn',{method:'POST',headers:{origin:'https://game.test','content-type':'application/json','X-Story-Actions':'1',accept:'text/event-stream','X-Story-Preview':'2',cookie:'__Host-story_session='+'a'.repeat(64)},body:JSON.stringify({context,attempt,storyActions:true})}),{AI:ai});
 const frames=(await response.text()).trim().split('\n\n').map(row=>JSON.parse(row.slice(6))),result=frames.at(-1).result;
 assert.equal(result.status,'ready',result.errorCode);assert.equal(result.requestId,'api-opening');assert.equal(result.attemptId,'attempt-one');
 assert.equal(settlements.length,1);assert.equal(settlements[0].result.status,'ready');assert.equal(ai.calls.length,2);
 assert.deepEqual(result.scene.blocks.map(b=>b.text),[blocks[0].text]);assert.deepEqual(result.scene.choices.map(c=>c.label),[observe.purpose,ask.purpose]);
});

test('a failed correction remains pending rather than looping or committing an invalid choice',async()=>{
 const s=state(),context=buildStoryContext(s,prepareOpening(s,{requestId:'bad-menu'}));
 const ai=aiFor([invalid,{choices:invalid.choices}]);
 const result=await generateScene(ai,profile,context,{}, {storyActions:true,recoverChoices:true});
 assert.equal(result.errorCode,'CHOICE_NOT_COMPILABLE');assert.equal(ai.calls.length,2);assert.equal(result.scene,undefined);assert.equal(s.revision,0);
});

test('correcting a menu preserves the original anchored clue and story pattern',async()=>{
 const s=state(),pending=prepareOpening(s,{requestId:'keep-clue'}),context=buildStoryContext(s,pending);
 const wire={...invalid,memoryDeltas:[{target:actor,kind:'clue',anchor:0,status:'open'}],story:{pattern:'investigation',beat:'progress',anchors:[0]}};
 const result=await generateScene(aiFor([wire,{choices:[observe,ask]}]),profile,context,{}, {storyActions:true,recoverChoices:true});
 assert.equal(result.status,'ready',result.errorCode);
 assert.equal(result.scene.memoryDeltas.length,1);assert.equal(result.scene.memoryDeltas[0].kind,'clue');assert.equal(result.scene.memoryDeltas[0].text,blocks[0].text);
 assert.equal(result.scene.story.pattern,'investigation');
 const active=commitTurn(s,pending,result.scene);
 assert.ok(active.currentScene.memoryDeltas.some(clue=>clue.text===blocks[0].text&&clue.status==='open'));
});

test('an accepted complete wire prefix can repair its menu despite an unfinished optional tail',async()=>{
 const s=state(),context=buildStoryContext(s,prepareOpening(s,{requestId:'optional-tail'}));
 for(const text of [JSON.stringify(invalid)+'\n【本回合结束】',JSON.stringify(invalid).slice(0,-1)+',"memoryDeltas":[']){
  const ai=aiFor([text,{choices:[observe,ask]}]);
  const result=await generateScene(ai,profile,context,{}, {storyActions:true,recoverChoices:true});
  assert.equal(result.status,'ready',result.errorCode);assert.equal(ai.calls.length,2);assert.deepEqual(result.scene.blocks.map(b=>b.text),[blocks[0].text]);
 }
});

test('menu repair cannot turn a changed story or state mutation into a committed scene',async()=>{
 const s=state(),pending=prepareOpening(s,{requestId:'opening'}),context=buildStoryContext(s,pending);
 for(const reply of [{blocks:[{kind:'narration',text:'另一段故事。'}],choices:[observe,ask]},{choices:[observe,ask],life:{items:{stones:999}}}]){
  const ai=aiFor([invalid,reply]);const result=await generateScene(ai,profile,context,{}, {storyActions:true,recoverChoices:true});
  assert.equal(result.status,'rejected');assert.equal(result.scene,undefined);assert.equal(ai.calls.length,2);assert.equal(s.revision,0);
 }
});
