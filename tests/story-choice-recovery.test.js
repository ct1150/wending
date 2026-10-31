import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBrowser} from './helpers/live-browser.js';
import {capturedStoryWire} from './helpers/story-choice-captured.js';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {renderLiveJourney} from '../src/ui/journey.js';

const originalLabels=[
  '询问灰衣汉子：询问陶罐中装着什么，以及他为何在此处停留',
  '观察灰衣汉子：观察陶罐的质地与周围环境，判断是否有危险',
  '婉拒灰衣汉子：无视他，转身离开村口',
];

async function setup(t){
  const browser=await liveBrowser(t);
  await browser.page.evaluate(async()=>{
    const {capturedStoryWire}=await import('/tests/helpers/story-choice-captured.js');
    const {createLiveSession}=await import('/src/ui/live-session.js');
    const {createStoryClient}=await import('/src/ui/story-client.js');
    const {createStoryApi}=await import('/src/worker/story-api.js');
    const {generateScene}=await import('/src/worker/story-provider.js');
    const {GLM_PROFILE,GLM_MODEL_ID}=await import('/src/worker/story-config.js');
    const {renderLiveJourney}=await import('/src/ui/journey.js');
    const profile={...GLM_PROFILE,validated:true,supportsStructuredOutput:true},encoder=new TextEncoder();
    const frame=value=>encoder.encode('data: '+JSON.stringify(value)+'\n\n');
    function continuation(context){
      const actor={kind:'person',name:'灰衣汉子',ref:'',status:null},approach=context.receipt.action.approach;
      const text=approach==='ask'?'陶罐里是几只刚捉来的山蟋蟀，我在这里等人来取。罐上的缺口是搬运时磕的，你若想歇脚，村边茶棚就在石碾后头。':approach==='observe'?'陶罐的胎壁粗厚，缺口边缘已经磨圆，罐底的细响随汉子的手势时停时续。附近只有湿泥脚印，村边茶棚的门帘正随风摆动。':'你收回目光，没有追问陶罐的事。那汉子继续抹去罐口的泥痕，也没有挽留。你仍在村口，石碾后头的村边茶棚冒出淡淡热气。';
      return {blocks:[approach==='ask'?{kind:'dialogue',speaker:actor,text}:{kind:'narration',text}],choices:[
        {action:'interact:observe',target:'self',stake:'low',purpose:'辨认石碾旁的泥脚印',anchor:0},
        {action:'rest:recover',target:'self',stake:'low',purpose:'在石碾旁稍作歇息',anchor:0},
        {action:'travel:road',target:{kind:'place',name:'村边茶棚',ref:'',status:null},stake:'low',purpose:'前往村边茶棚歇脚',anchor:0},
      ],title:'陶罐之后',location:'村口',memoryDeltas:[],story:{pattern:'investigation',beat:'progress',anchors:[0]}};
    }
    globalThis.playableStory=async(name,engineMenu=false)=>{
      const archive=await open(name),mount=document.createElement('section');document.body.append(mount);
      const f={archive,mount,posts:[],gets:[],inferences:[],settlements:[],progress:[],holdNext:false,corrupt:false},sessionRef='session-'+name,cache=new Map();
      let previewReady;f.previewReady=new Promise(resolve=>previewReady=resolve);
      const budget={
        async admit(){return {kind:'allowed'};},
        async getSession(){return {kind:'session',sessionRef,expiresAt:Date.now()+86400000};},
        async lookup({attemptId}){return cache.has(attemptId)?{kind:'replay',result:cache.get(attemptId)}:{code:'ATTEMPT_NOT_FOUND'};},
        async reserve(){return {kind:'reserved'};},
        async settle(input){f.settlements.push(input);cache.set(input.attemptId,input.result);return {kind:'settled'};},
      };
      const ai={async run(model,input){
        f.inferences.push({model,input});
        const context=f.posts.at(-1).context,wire=context.phase==='opening'?capturedStoryWire():continuation(context);
        if(engineMenu&&context.phase==='opening'){
          wire.blocks.push({kind:'dialogue',speaker:{kind:'person',name:'灰衣汉子'},text:'听见了吗？缸底有东西在动。'});
          // A real v7 sample wrote complete prose but used three unknown actions.
          wire.choices=wire.choices.map(row=>({...row,action:'invented-command',extra:'untrusted suggestion'}));
        }else if(engineMenu)delete wire.choices;
        if(f.corrupt)wire.story.receipt={elapsedDays:0};
        return new ReadableStream({start(controller){
          controller.enqueue(frame({model:GLM_MODEL_ID,choices:[{index:0,delta:{content:JSON.stringify(wire)}}]}));
          const finish=()=>{controller.enqueue(frame({model:GLM_MODEL_ID,choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:400,completion_tokens:450,total_tokens:850}}));controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close();};
          if(f.holdNext){f.holdNext=false;f.finish=finish;}else finish();
        }});
      }};
      const api=createStoryApi({budget,config:{readiness:()=>profile},provider:engineMenu?generateScene:(ai,p,c,o,r)=>generateScene(ai,p,c,o,{...r,engineMenu:false})});
      const client=createStoryClient({location:{protocol:'https:'},fetch:async(path,options)=>{
        if(path==='/api/story/turn')f.posts.push({...JSON.parse(options.body),saved:await archive.load()});
        else if(path.startsWith('/api/story/turn/'))f.gets.push(path);
        const request=new Request('https://playable.test'+path,options);
        // Browser Request strips Origin/Cookie; this in-process server bridge
        // supplies the headers a real same-origin server receives from Chrome.
        Object.defineProperty(request,'headers',{value:new Headers({...options.headers,origin:'https://playable.test',cookie:'__Host-story_session='+'a'.repeat(64)})});
        return api.fetch(request,{AI:ai});
      }});
      const render=view=>{
        if(!view.state)return;
        const choices=view.state.currentScene?engine.compileChoices(view.state,view.state.currentScene.choices):[];
        mount.innerHTML=renderLiveJourney({...view,stateHash:identity.stateHash(view.state)},choices);
      };
      f.session=createLiveSession({archive,client,onChange:render,onProgress:view=>{
        render(view);f.progress.push({turn:f.posts.at(-1).context.identity.turnId,preview:view.preview});
        if(engineMenu?view.preview?.blocks?.some(block=>block.text):view.preview?.choices?.length===3)previewReady();
      }});
      mount.addEventListener('click',event=>{
        const button=event.target.closest('[data-live-choice]');if(!button||button.disabled)return;
        event.stopPropagation();f.command={choiceId:button.dataset.liveChoice,baseRevision:Number(button.dataset.revision),stateHash:button.dataset.stateHash};
        f.action=f.session.choose(f.command);
      });
      f.start=()=>f.session.start({runId:'captured-playable',seed:42,engineVersion:7});
      f.buttons=()=>[...mount.querySelectorAll('[data-live-choices] button')].map(button=>({disabled:button.disabled,choiceId:button.dataset.liveChoice??null,label:button.querySelector('.journey-choice-label').textContent.replace(/^\d+\.\s*/u,'')}));
      f.reload=async()=>{const reloaded=createLiveSession({archive:await open(name),client});await reloaded.load();await reloaded.resume();return reloaded.view();};
      return f;
    };
  });
  return browser;
}

test('legacy model-menu compatibility: the original 126-character opening becomes three usable choices after one real provider response',async t=>{
  const {page}=await setup(t),r=await page.evaluate(async()=>{
    const f=await playableStory('original-opening');f.holdNext=true;const starting=f.start();
    let timer;const visible=await Promise.race([f.previewReady.then(()=>true),new Promise(resolve=>timer=setTimeout(()=>resolve(false),2000))]);clearTimeout(timer);
    const draft={buttons:f.buttons(),saved:await f.archive.load(),history:await f.archive.readHistory('captured-playable')};
    f.finish?.();await starting;
    return {visible,draft,buttons:f.buttons(),view:f.session.view(),posts:f.posts,inferences:f.inferences.length,settlements:f.settlements,history:await f.archive.readHistory('captured-playable')};
  });
  assert.equal(r.visible,true);assert.deepEqual(r.draft.buttons.map(row=>row.disabled),[true,true,true]);assert.ok(r.draft.buttons.every(row=>row.choiceId===null));assert.equal(r.draft.saved.state.revision,0);assert.equal(r.draft.history.entries.length,0);
  assert.equal(r.view.status,'ready',r.view.errorCode);assert.equal(r.view.pending,null);assert.equal(r.view.preview,null);assert.equal(r.view.state.revision,1);
  assert.deepEqual(r.view.state.currentScene.blocks,capturedStoryWire().blocks);assert.equal(Array.from(r.view.state.currentScene.blocks[0].text).length,126);
  assert.deepEqual(r.buttons.map(row=>row.label),originalLabels);assert.deepEqual(r.draft.buttons.map(row=>row.label),originalLabels);assert.deepEqual(r.buttons.map(row=>row.disabled),[false,false,false]);assert.ok(r.buttons.every(row=>row.choiceId));
  assert.equal(r.posts.length,1);assert.equal(r.inferences,1);assert.equal(r.posts[0].attempt.retryOf,null);assert.deepEqual(r.posts[0].saved.generation.context,r.posts[0].context);assert.equal(r.settlements.length,1);assert.equal(r.settlements[0].result.status,'ready');assert.equal(r.history.entries.length,1);
});

test('legacy model-menu compatibility: each original choice independently continues the same opening and commits its exact selected action once',async t=>{
  const {page}=await setup(t),rows=await page.evaluate(async()=>{
    const rows=[];
    for(let index=0;index<3;index++){
      const f=await playableStory('original-choice-'+index);await f.start();const opening=f.session.view(),buttons=f.buttons();
      if(opening.status==='ready'){
        f.mount.querySelectorAll('[data-live-choice]')[index].click();await f.action;
      }
      const view=f.session.view(),history=await f.archive.readHistory('captured-playable'),reloaded=await f.reload();
      rows.push({index,opening,buttons,command:f.command,view,posts:f.posts,inferences:f.inferences,settlements:f.settlements,history,reloaded,gets:f.gets});
    }
    return rows;
  });
  for(const row of rows){
    assert.equal(row.opening.status,'ready','opening '+row.index+': '+row.opening.errorCode);assert.deepEqual(row.opening.state,rows[0].opening.state,'branches must start from the same committed opening');
    assert.deepEqual(row.buttons.map(button=>button.disabled),[false,false,false]);assert.deepEqual(row.buttons.map(button=>button.label),originalLabels);
    assert.equal(row.view.status,'ready','choice '+row.index+': '+row.view.errorCode);assert.equal(row.view.state.revision,2);assert.equal(row.view.pending,null);assert.equal(row.history.entries.length,2);
    assert.equal(row.posts.length,2);assert.equal(row.inferences.length,2);assert.equal(row.settlements.length,2);assert.ok(row.posts.every(post=>post.attempt.retryOf===null));assert.ok(row.settlements.every(row=>row.result.status==='ready'));
    const selected=row.opening.state.currentScene.choices[row.index],posted=row.posts[1],receipt=row.view.state.lastReceipt;
    assert.equal(row.command.choiceId,selected.id);assert.equal(posted.context.identity.choiceId,selected.id);assert.deepEqual(posted.context.receipt.action,selected);
    assert.deepEqual(posted.context,posted.saved.generation.context,'the request uses the exact durable frozen context');assert.deepEqual(posted.context.receipt,posted.saved.pending.receipt);assert.deepEqual(receipt,posted.saved.pending.receipt);assert.deepEqual(row.history.entries[1].receipt,receipt);
    assert.equal(receipt.action.label,originalLabels[row.index]);assert.equal(receipt.elapsedDays,0);assert.deepEqual(receipt.itemChanges,{});assert.equal(row.view.state.rng,posted.saved.pending.nextRng);assert.deepEqual(row.view.state.life,row.opening.state.life);
    assert.ok(row.inferences[1].input.messages.at(-1).content.includes(originalLabels[row.index]),'the model receives the actual selected purpose');
    assert.deepEqual(row.reloaded.state,row.view.state);assert.equal(row.reloaded.pending,null);assert.equal(row.gets.length,0,'a committed turn needs no lookup or retry on refresh');
  }
  assert.equal(rows[0].view.state.currentScene.blocks[0].kind,'dialogue');assert.match(rows[0].view.state.currentScene.blocks[0].text,/山蟋蟀/u);
  assert.equal(rows[1].view.state.currentScene.blocks[0].kind,'narration');assert.match(rows[1].view.state.currentScene.blocks[0].text,/陶罐的胎壁/u);
  assert.equal(rows[2].view.state.currentScene.blocks[0].kind,'narration');assert.match(rows[2].view.state.currentScene.blocks[0].text,/没有追问/u);
});

test('the actual v7 HTTP route streams prose without phantom buttons and commits a playable engine menu despite three invented model commands',async t=>{
  const {page}=await setup(t),r=await page.evaluate(async()=>{
    const f=await playableStory('engine-menu-real-route',true);f.holdNext=true;
    const starting=f.start();await Promise.race([f.previewReady,new Promise((_,reject)=>setTimeout(()=>reject(Error('no narrative draft')),3000))]);
    const draft={buttons:f.buttons(),history:await f.archive.readHistory('captured-playable')};
    f.finish();await starting;
    const opening=f.session.view();if(opening.status!=='ready')throw Error(opening.errorCode);
    const buttons=f.buttons(),choice=opening.state.currentScene.choices[0];
    f.mount.querySelector('[data-live-choice]').click();await f.action;
    const view=f.session.view(),history=await f.archive.readHistory('captured-playable'),reloaded=await f.reload();
    return {draft,buttons,choice,opening,view,history,reloaded,posts:f.posts,settlements:f.settlements.length,calls:f.inferences.length,
      requested:f.inferences[0].input.response_format.json_schema.schema.required,previews:f.progress.flatMap(p=>p.preview?.choices??[])};
  });
  assert.deepEqual(r.draft.buttons,[]);assert.deepEqual(r.previews,[]);assert.equal(r.draft.history.entries.length,0);
  assert.deepEqual(r.requested,['blocks']);assert.deepEqual(r.opening.state.currentScene.blocks[0],capturedStoryWire().blocks[0]);
  assert.equal(r.opening.state.currentScene.blocks[1].text,'听见了吗？缸底有东西在动。');
  assert.ok(r.buttons.length>=2&&r.buttons.length<=3);assert.ok(r.buttons.every(row=>row.label&&row.choiceId&&!row.disabled));
  assert.equal(r.view.status,'ready',r.view.errorCode);assert.equal(r.view.pending,null);assert.equal(r.view.state.revision,2);
  assert.deepEqual(r.posts[1].context.receipt.action,r.choice);assert.equal(r.calls,2);assert.equal(r.posts.length,2);assert.equal(r.settlements,2);
  assert.equal(r.history.entries.length,2);assert.deepEqual(r.history.entries[1].receipt.action,r.choice);
  assert.deepEqual(r.reloaded.state,r.view.state);assert.equal(r.reloaded.pending,null);
});

test('broken structural metadata cannot commit a preview or trigger an unrequested second inference',async t=>{
  const {page}=await setup(t),r=await page.evaluate(async()=>{
    const f=await playableStory('broken-metadata');f.corrupt=true;await f.start();
    return {view:f.session.view(),buttons:f.buttons(),posts:f.posts.length,inferences:f.inferences.length,history:await f.archive.readHistory('captured-playable')};
  });
  assert.equal(r.view.status,'paused');assert.equal(r.view.errorCode,'GENERATED_SCENE_INVALID');assert.equal(r.view.state.revision,0);assert.ok(r.view.pending);assert.equal(r.history.entries.length,0);assert.equal(r.posts,1);assert.equal(r.inferences,1);assert.deepEqual(r.buttons.map(row=>row.disabled),[true,true,true]);assert.ok(r.buttons.every(row=>row.choiceId===null));
});

test('generation failure feedback preserves progress and manual continuation without exposing quality rules',()=>{
  const state=createLiveGame({runId:'generation-message',seed:42,engineVersion:7}),pending=prepareOpening(state,{requestId:'opening'});
  for(const errorCode of ['CHOICE_NOT_COMPILABLE','STORY_LENGTH_INVALID','GENERATED_SCENE_INVALID','KNOWLEDGE_UNAVAILABLE','PROVIDER_RESPONSE_INVALID','OUTPUT_TRUNCATED']){
    const html=renderLiveJourney({state,pending,status:'paused',busy:false,errorCode,preview:{blocks:[],choices:originalLabels.map(label=>({label,complete:true}))}},[]);
    assert.match(html,/进度已保留/u);assert.match(html,/data-live-retry/u);assert.doesNotMatch(html,/字数|全名|称谓|校验/u);assert.doesNotMatch(html,/data-live-choice="/u);
  }
});
