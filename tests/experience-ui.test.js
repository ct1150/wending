import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBrowser} from './helpers/live-browser.js';
import {liveStoryFixture} from './helpers/live-story-fixture.js';
import {renderLiveJourney} from '../src/ui/journey.js';
import {createLiveGame} from '../src/game/cultivation/live/engine.js';

test('a decision shows authoritative costs and graded or unknown outlook without turning observations into promises',()=>{
  const state=createLiveGame({seed:2,engineVersion:7,experienceVersion:1,runId:'ui-outlook'}),c={id:'decision',label:'设法脱身',enabled:true,costs:{days:1,spirit:10,lifeYears:1,items:{supplies:1}},warnings:['会留下行迹。']};
  const view={state,stateHash:'hash',itemNames:{supplies:'行粮'}};
  const known=renderLiveJourney(view,[{...c,outlook:{band:'dangerous',reason:'对方境界更高。',purpose:'守桥',condition:'旧伤未愈'}}]);
  for(const expected of ['灵力 10','行粮 1','寿元上限 −1年','胜算偏低','对方境界更高','守桥','旧伤未愈','会留下行迹'])assert.ok(known.includes(expected),expected);
  const unknown=renderLiveJourney(view,[{...c,outlook:{band:'unknown',reason:'未辨明对手境界，按谨慎估计行动。'}}]);
  assert.match(unknown,/胜算未明/);assert.doesNotMatch(unknown,/胜算偏低|胜算较高/);
});

test('large-type mobile story shows one identity, birth stakes and actual costs without a custom action field',async t=>{
 const {page,origin}=await liveBrowser(t);let posts=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://experience.test/**',async route=>{
   const url=new URL(route.request().url()),json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   if(url.pathname.endsWith('/capabilities'))return json({protocolVersion:1,available:true,status:'ready',storyActions:true,experienceVersion:1,errorCode:null,limits:{maxRequestBytes:32768,maxResponseBytes:65536,maxContextBytes:7000,timeoutMs:30000}});
   if(url.pathname.endsWith('/session'))return json({protocolVersion:1,status:'ready',sessionRef:'ui-session',expiresAt:Date.now()+86400000});
   if(url.pathname.endsWith('/turn')){posts++;const {context,attempt}=route.request().postDataJSON(),p=context.namespace+':t'+context.identity.turnId+':',person={id:context.entities.find(e=>e.name==='渡者')?.id??p+'e:actor',name:'渡者',kind:'person'};
     const scene=liveStoryFixture({id:p+'s:bridge',title:'渡口',location:'松溪',entities:[person],blocks:[{kind:'narration',text:'渡者说：“今夜水涨，明晨再渡。”'}],choices:[{id:p+'c:train',label:'就地修行',intent:'practice',targetId:'self',stake:'low',approach:'steady'},{id:p+'c:ask',label:'询问渡者渡河的时辰',intent:'interact',targetId:person.id,stake:'low',approach:'ask'}],memoryDeltas:[]},context);
     return json({protocolVersion:1,status:'ready',errorCode:null,retry:null,requestId:context.identity.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,scene});}
   return route.fulfill({response:await page.request.get(origin+(url.pathname==='/'?'/index.html':url.pathname))});
 });
 await page.setViewportSize({width:320,height:844});await page.goto('https://experience.test/');
 await page.locator('[data-view="settings"]').first().click();await page.locator('#reading-size').selectOption('large'); await page.locator('[data-menu-back]').first().click();
 await page.locator('[data-title-new]:enabled').click();assert.equal(await page.locator('[data-live-birth-facts]').count(),0);
 await page.locator('#live-name').fill('云归');await page.locator('[data-live-start]').click();await page.locator('[data-live-choice]:enabled').first().waitFor();
 const expected=await page.evaluate(async()=>{const {openLiveArchive}=await import('/src/game/live-archive.js'),a=await openLiveArchive(),{state}=await a.load(),{compileChoices}=await import('/src/game/cultivation/live/engine.js');a.close();const cost=compileChoices(state,state.currentScene.choices)[0].costs;return {cost,goal:state.director.currentGoal,advantage:state.life.birth.cultivationProfile.advantages[0]};});
 assert.equal(posts,1);assert.equal(await page.locator('[data-character]').count(),1);assert.doesNotMatch(await page.locator('[data-live-state]').innerText(),/寿元\s*16/);
 if(expected.goal==='辨明眼前变化，自定下一步'){
   assert.equal(await page.locator('.live-state-hint').innerText(),'当前处境');
   assert.equal(await page.locator('[data-live-goal]').innerText(),'松溪 · 渡口');
 }else assert.equal(await page.locator('[data-live-goal]').innerText(),expected.goal);
 assert.ok((await page.locator('[data-live-birth-facts]').innerText()).includes(expected.advantage));
 assert.match(await page.locator('[data-live-birth-facts]').innerText(),/代价/);
 assert.ok((await page.locator('#live-cost-0').innerText()).includes('灵力 '+expected.cost.spirit));
 for(const w of [320,390]){await page.setViewportSize({width:w,height:844});const result=await page.evaluate(()=>({pageWidth:document.documentElement.scrollWidth,
   font:parseFloat(getComputedStyle(document.querySelector('.journey-prose p')).fontSize),controls:[...document.querySelectorAll('[data-character],[data-live-choice]')].every(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.height>=40;})}));assert.equal(result.pageWidth,w);assert.ok(result.font>=20);assert.ok(result.controls);}
 assert.equal(posts,1);assert.deepEqual(errors,[]);
});

test('current method is distinguished from original traits; a repaired life offers neither diagnosis nor self-repair again',async()=>{
 const {storyLife}=await import('./helpers/experience-death.js'),{commitTurn}=await import('../src/game/cultivation/live/engine.js');
 const {liveCharacterSummary,renderCharacterDetails}=await import('../src/ui/character.js'),catalogs=await import('../src/game/cultivation/live/model.js');
 const {birth,steps}=storyLife('ui-repair',false,null,{selfStudy:true});let s=birth;
 const offered=()=>s.currentScene.choices.map(choice=>choice.approach);
 for(const [i,row] of steps.slice(0,3).entries()){
   s=commitTurn(s,row.p,row.scene);
   if(i===0)assert.ok(offered().includes('diagnose'));
   if(i===1)assert.ok(offered().includes('restore'));
 }
 const html=renderCharacterDetails(liveCharacterSummary(s,catalogs));
 assert.match(html,/当前功法[\s\S]+已修补/);assert.match(html,/入世时的根基/);
 assert.ok(!offered().includes('restore'));assert.ok(!offered().includes('diagnose'));
});

test('a still-running response offers to check the saved choice and keeps replacement inference unavailable',()=>{
 const state=createLiveGame({seed:1,engineVersion:7,experienceVersion:1,runId:'ui-wait'});
 const html=renderLiveJourney({state,pending:{},busy:false,status:'paused',errorCode:'ATTEMPT_IN_PROGRESS'},[]);
 assert.match(html,/仍在续写/);assert.match(html,/data-live-retry hidden/);assert.match(html,/data-live-resume>检查已有回应/);assert.doesNotMatch(html,/ATTEMPT_IN_PROGRESS|requestId/);
});
