import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { liveBrowser } from './helpers/live-browser.js';

function story(context) {
  const p=context.namespace+':t'+context.identity.turnId+':';
  return {id:p+'s:path',title:'古道松声',location:'青山古道',blocks:[{kind:'narration',text:'你沿着古道前行，松风从山间掠过。'}],entities:[],choices:[{id:p+'c:rest',label:'在松下歇息',intent:'rest',targetId:'self',stake:'low',approach:'recover'},{id:p+'c:practice',label:'静心吐纳',intent:'practice',targetId:'self',stake:'low',approach:'steady'}],memoryDeltas:[]};
}
async function fixture(t) {
  const {page,context}=await liveBrowser(t),responses=new Map();let posts=0,paused=false;
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://wending-title.test/**',async route=>{
    const url=new URL(route.request().url()),json=value=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
    if(url.pathname==='/api/story/capabilities')return json({protocolVersion:1,available:true,status:'ready',errorCode:null,limits:{maxRequestBytes:32768,maxResponseBytes:65536,maxContextBytes:7000,timeoutMs:30000}});
    if(url.pathname==='/api/story/session')return json({protocolVersion:1,status:'ready',sessionRef:'title-session',expiresAt:Date.now()+86400000});
    if(url.pathname==='/api/story/turn') {
      posts++;const {context:c,attempt}=route.request().postDataJSON();
      const value={protocolVersion:1,status:paused?'paused':'ready',requestId:c.identity.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,errorCode:paused?'PROVIDER_BUSY':null,retry:paused?{explicit:true,afterMs:0,previousAttemptId:attempt.id,previousSessionRef:attempt.sessionRef}:null,...(paused?{}:{scene:story(c)})};responses.set(attempt.id,value);return json(value);
    }
    if(url.pathname.startsWith('/api/story/turn/'))return json(responses.get(url.searchParams.get('attemptId')));
    try { const path=resolve('.','.'+(url.pathname==='/'?'/index.html':url.pathname));return route.fulfill({status:200,contentType:({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(path)]??'text/html',body:await readFile(path)}); }
    catch { return route.fulfill({status:404,body:''}); }
  });
  await page.goto('https://wending-title.test/');
  t.after(()=>assert.deepEqual(errors,[]));
  return {page,context,get posts(){return posts;},pause(){paused=true;},read:()=>page.evaluate(async()=>{const {openLiveArchive}=await import('/src/game/live-archive.js');const a=await openLiveArchive();try{return await a.load();}finally{a.close();}})};
}

test('title is read-only, menus fit narrow screens, new defaults live, and draft survives reload',async t=>{
  const f=await fixture(t),{page}=f;
  await page.getByRole('heading',{name:'百世问鼎',exact:true}).waitFor();
  await page.locator('[data-title-new]').waitFor();
  await page.waitForFunction(()=>!document.querySelector('[data-title-new]').disabled);
  assert.equal(await page.locator('[data-title-continue]').isDisabled(),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('baishi-wending-save-v1')),null);
  assert.equal(await f.read(),null);assert.equal(f.posts,0);
  for(const width of [320,390,1280]) {
    await page.setViewportSize({width,height:740});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    for(const selector of ['[data-title-new]','[data-title-continue]','[data-view="settings"]']) {
      const rect=await page.locator(selector).boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=740,`${selector} visible in first screen at ${width}`);
    }
  }
  await page.locator('[data-title-new]').click();
  await page.locator('#live-name').fill('林照');
  await page.reload();assert.equal(await page.locator('#live-name').inputValue(),'林照');
  assert.equal(await f.read(),null);assert.equal(f.posts,0);
  await page.locator('[data-menu-back]').click();await page.locator('[data-title-new]').waitFor();
  await page.locator('[data-view="settings"]').click();
  await page.locator('#reading-theme').selectOption('dark');await page.locator('#reading-size').selectOption('large');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.reload();assert.equal(await page.locator('#reading-size').inputValue(),'large');
  assert.equal(await f.read(),null);assert.equal(f.posts,0);
});

test('two alive journeys and a pending turn survive switching, refresh, and a new visit without POST',async t=>{
  const f=await fixture(t),{page}=f;
  await page.locator('[data-title-new]:enabled').click();await page.locator('#live-name').fill('林照');await page.locator('[data-live-start]:enabled').click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();const a=await f.read();assert.equal(f.posts,1);
  await page.locator('[data-view="settings"]').click();await page.locator('#reading-size').selectOption('large');
  await page.locator('[data-menu-back]').click();await page.locator('[data-history]').click();
  assert.equal(await page.locator('#dialog .journey-block').first().evaluate(element=>getComputedStyle(element).fontSize),'21px');
  await page.locator('[data-close-dialog]').first().click();assert.equal(f.posts,1);
  await page.locator('[data-home]').click();await page.locator('[data-title-new]:enabled').click();
  await page.locator('[data-confirm]').click();await page.locator('#live-name').fill('沈渡');await page.locator('[data-live-start]:enabled').click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();const b=await f.read();assert.notEqual(a.archiveId,b.archiveId);assert.equal(f.posts,2);
  f.pause();await page.locator('[data-live-choice]').first().click();await page.locator('[data-live-retry]').waitFor();const pending=await f.read();assert.equal(f.posts,3);
  await page.locator('[data-home]').click();await page.locator('[data-saves]').click();
  await page.locator(`[data-select-live="${a.archiveId}"]`).click();await page.locator('[data-live-choice]:enabled').first().waitFor();
  assert.deepEqual((await f.read()).state,a.state);assert.equal(f.posts,3);
  await page.locator('[data-home]').click();await page.locator('[data-saves]').click();await page.locator(`[data-select-live="${b.archiveId}"]`).click();await page.locator('[data-live-retry]').waitFor();
  assert.deepEqual((await f.read()).pending,pending.pending);assert.deepEqual((await f.read()).attempt,pending.attempt);assert.equal(f.posts,3);
  await page.reload();await page.locator('[data-live-retry]').waitFor();assert.equal(f.posts,3);
  await page.goto('https://wending-title.test/');await page.locator('[data-title-continue]:enabled').waitFor();assert.equal(await page.locator('[data-live-retry]').count(),0);
  await page.locator('[data-title-continue]').click();await page.locator('[data-live-retry]').waitFor();assert.equal(f.posts,3);
});

test('an unreadable live archive is reported as a read error while its durable journey stays intact',async t=>{
  const f=await fixture(t),{page}=f;
  await page.locator('[data-title-new]:enabled').click();await page.locator('[data-live-start]:enabled').click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();const before=await f.read();
  await page.locator('[data-home]').click();
  await page.addInitScript(()=>{
    globalThis.denyLiveReads=true;
    const transaction=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(stores,mode,...rest){
      if(globalThis.denyLiveReads&&this.name==='wending-live-v1'&&mode==='readonly')throw new DOMException('read unavailable','UnknownError');
      return transaction.call(this,stores,mode,...rest);
    };
  });
  await page.reload();
  await page.getByText('无法读取实时旅程，请检查浏览器存储设置。已有离线存档仍可恢复。',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-title-continue]').isDisabled(),true);
  await page.evaluate(()=>{globalThis.denyLiveReads=false;});
  assert.deepEqual((await f.read()).state,before.state);assert.equal(f.posts,1);
});

test('failure to retain a live creation draft gives a visible warning without creating a journey',async t=>{
  const f=await fixture(t),{page}=f;
  await page.waitForFunction(()=>!document.querySelector('[data-title-new]').disabled);
  await page.evaluate(()=>{
    const setItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(this===window.sessionStorage)throw new DOMException('quota','QuotaExceededError');
      return setItem.call(this,key,value);
    };
  });
  await page.locator('[data-title-new]').click();await page.locator('#live-name').fill('林照');
  assert.match(await page.locator('#toast').textContent(),/创建草稿暂时无法保存/);
  await page.evaluate(()=>{document.querySelector('#toast').textContent='';});
  await page.locator('#live-origin').selectOption('ferry');
  assert.match(await page.locator('#toast').textContent(),/创建草稿暂时无法保存/);
  assert.equal(await f.read(),null);assert.equal(f.posts,0);
});
