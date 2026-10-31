import test from 'node:test';
import assert from 'node:assert/strict';
import { liveBrowser } from './helpers/live-browser.js';
import { liveStoryFixture } from './helpers/live-story-fixture.js';

test('new v7 UI keeps invalid custom input, accepts numeric and natural actions, and generates a fresh decline decision', async t => {
  const { page, origin }=await liveBrowser(t), replies=new Map();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let posts=0;
  await page.setViewportSize({width:390,height:844});
  await page.route('https://wending-v7.test/**',async route=>{
    const url=new URL(route.request().url()),json=value=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
    if(url.pathname==='/api/story/capabilities')return json({protocolVersion:1,available:true,status:'ready',errorCode:null,storyActions:true,experienceVersion:1,originStories:true,limits:{maxRequestBytes:32768,maxResponseBytes:65536,maxContextBytes:7000,timeoutMs:30000}});
    if(url.pathname==='/api/story/session')return json({protocolVersion:1,status:'ready',sessionRef:'v7-browser-session',expiresAt:Date.now()+86400000});
    if(url.pathname==='/api/story/turn') {
      posts++;const {context,attempt}=route.request().postDataJSON(),prefix=context.namespace+':t'+context.identity.turnId+':';
      const known=context.entities.find(entity=>entity.name==='渡者');
      const person={id:known?.id??prefix+'e:ferry',name:'渡者',kind:'person'};
      const scene=liveStoryFixture({id:prefix+'s:ferry',title:'渡口旧桩',location:'柳溪渡口',entities:[person],blocks:[{kind:'narration',text:'渡者站在岸边的旧木桩旁，河面的水纹正绕过木桩向下游流去。'+(context.receipt.action?.approach==='decline'?'你暂且放下渡者的邀请，留在岸边。':'渡者还在等候你的打算。')}],choices:[
        {id:prefix+'c:ask',label:'询问渡者为何封渡',intent:'interact',targetId:person.id,stake:'low',approach:'ask'},
        {id:prefix+'c:observe',label:'查看岸边的旧木桩',intent:'interact',targetId:'self',stake:'low',approach:'observe'},
        {id:prefix+'c:decline',label:'婉拒渡者的邀约，暂且留在岸边',intent:'interact',targetId:person.id,stake:'low',approach:'decline'},
      ],memoryDeltas:[]},context);
      const result={protocolVersion:1,status:'ready',errorCode:null,retry:null,requestId:context.identity.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,scene};
      replies.set(attempt.id,result);return json(result);
    }
    if(url.pathname.startsWith('/api/story/turn/'))return json(replies.get(url.searchParams.get('attemptId')));
    await route.fulfill({response:await page.request.get(origin+(url.pathname==='/'?'/index.html':url.pathname))});
  });
  const read=()=>page.evaluate(async()=>{const {openLiveArchive}=await import('/src/game/live-archive.js');const archive=await openLiveArchive();try{return await archive.load();}finally{archive.close();}});
  const revision=value=>page.locator(`[data-live-choice][data-revision="${value}"]:enabled`).first().waitFor();
  await page.goto('https://wending-v7.test/');
  await page.locator('[data-title-new]:enabled').click();
  await page.getByText('大道无情，仙路崎岖。 凡人，留下你的名讳，准备踏入这残酷而浩瀚的修仙界：',{exact:true}).waitFor();
  await page.locator('#live-name').fill('问溪');await page.locator('[data-live-start]').click();await revision(1);
  const opening=await read();assert.equal(opening.state.life.cultivationProfile.version,7);assert.equal(posts,1);
  assert.equal(await page.locator('[data-live-choice]').count(),3);
  assert.match(await page.locator('[data-character]').getAttribute('aria-label'),/16\.0 \/ 80/);
  assert.doesNotMatch(await page.locator('[data-character]').getAttribute('aria-label'),/余寿/);
  await page.locator('[data-live-state] > summary').click();
  await page.locator('[data-live-custom-toggle]').click();await page.locator('#live-custom-action').fill('瞬移到上界');
  await page.evaluate(()=>{window.originalCustom=document.querySelector('#live-custom-action');window.originalStory=document.querySelector('[data-live-story]');});
  await page.locator('[data-live-custom-submit]').click();
  await page.getByText('【该行动超出当前场景能力范围，请重新选择。】',{exact:true}).waitFor();
  assert.equal(await page.locator('#live-custom-action').inputValue(),'瞬移到上界');
  assert.equal(posts,1);assert.deepEqual((await read()).state,opening.state);assert.equal((await read()).pending,null);
  assert.equal(await page.evaluate(()=>document.querySelector('#live-custom-action')===window.originalCustom&&document.querySelector('[data-live-story]')===window.originalStory&&document.querySelector('[data-live-state]').open),true);
  await page.locator('#live-custom-action').fill('2');await page.locator('[data-live-custom-submit]').click();await revision(2);
  assert.equal((await read()).state.lastReceipt.action.approach,'observe');assert.equal(posts,2);
  await page.locator('[data-live-custom-toggle]').click();assert.equal(await page.locator('#live-custom-action').inputValue(),'');
  await page.locator('#live-custom-action').fill('观察岸边的旧木桩');await page.locator('[data-live-custom-submit]').click();await revision(3);
  assert.equal((await read()).state.lastReceipt.action.label,'观察岸边的旧木桩');assert.equal(posts,3);
  await page.locator('[data-history]').focus();await page.keyboard.press('3');await revision(4);
  const declined=await read();assert.equal(declined.state.lastReceipt.action.approach,'decline');assert.equal(posts,4);
  assert.equal(declined.state.life.ageDays,opening.state.life.ageDays);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
});
