import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { liveBrowser } from './helpers/live-browser.js';
import { liveStoryFixture } from './helpers/live-story-fixture.js';

function story(context) {
  const p=context.namespace+':t'+context.identity.turnId+':';
  return liveStoryFixture({id:p+'s:path',title:'古道松声',location:'青山古道',blocks:[{kind:'narration',text:'你沿着古道前行，松风从山间掠过。'}],entities:[],choices:[{id:p+'c:rest',label:'在松下歇息',intent:'rest',targetId:'self',stake:'low',approach:'recover'},{id:p+'c:practice',label:'静心吐纳',intent:'practice',targetId:'self',stake:'low',approach:'steady'}],memoryDeltas:[]},context);
}
async function fixture(t) {
  const {page,context}=await liveBrowser(t),responses=new Map();let posts=0,paused=false;
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});
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
  assert.equal(await page.locator('[data-saves], [data-select-live], [data-select-offline]').count(),0,'the title exposes one current save without a save picker');
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
  assert.equal(await page.locator('[data-saves], [data-select-live], [data-select-offline], a[download], a[href*="offline"]').count(),0,'settings contain neither save slots nor an offline game download');
  await page.locator('#reading-theme').selectOption('dark');await page.locator('#reading-size').selectOption('large');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.reload();assert.equal(await page.locator('#reading-size').inputValue(),'large');
  assert.equal(await f.read(),null);assert.equal(f.posts,0);
});

test('the one current journey and its pending turn survive refresh and a new visit without another POST',async t=>{
  const f=await fixture(t),{page}=f;
  await page.locator('[data-title-new]:enabled').click();await page.locator('#live-name').fill('林照');await page.locator('[data-live-start]:enabled').click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();const a=await f.read();assert.equal(f.posts,1);
  await page.locator('[data-view="settings"]').click();await page.locator('#reading-size').selectOption('large');
  await page.locator('[data-menu-back]').click();await page.locator('[data-history]').click();
  assert.equal(await page.locator('#dialog .journey-block').first().evaluate(element=>getComputedStyle(element).fontSize),'21px');
  await page.locator('[data-close-dialog]').first().click();assert.equal(f.posts,1);
  await page.locator('[data-character]').click();await page.locator('#dialog[open]').waitFor();
  assert.match(await page.locator('#dialog').innerText(),/林照/);
  await page.keyboard.press('Escape');assert.equal(await page.locator('[data-character]').evaluate(element=>element===document.activeElement),true);
  assert.deepEqual((await f.read()).state,a.state);assert.equal(f.posts,1,'reading settings, character and history do not advance the save');
  await page.locator('[data-live-choice]').first().click();await page.locator('[data-live-choice][data-revision="2"]:enabled').first().waitFor();
  const progressed=await f.read();assert.equal(progressed.archiveId,a.archiveId);assert.equal(f.posts,2);
  await page.reload();await page.locator('[data-live-choice][data-revision="2"]:enabled').first().waitFor();
  assert.deepEqual((await f.read()).state,progressed.state);assert.equal(f.posts,2);
  f.pause();await page.locator('[data-live-choice]').first().click();await page.locator('[data-live-retry]').waitFor();const pending=await f.read();assert.equal(f.posts,3);
  assert.equal(pending.archiveId,a.archiveId);assert.deepEqual(pending.state,progressed.state);
  await page.reload();await page.locator('[data-live-retry]').waitFor();
  assert.deepEqual((await f.read()).pending,pending.pending);assert.deepEqual((await f.read()).attempt,pending.attempt);assert.equal(f.posts,3);
  await page.goto('https://wending-title.test/');await page.locator('[data-title-continue]:enabled').waitFor();assert.equal(await page.locator('[data-live-retry]').count(),0);
  assert.equal(await page.locator('[data-saves], [data-select-live], [data-select-offline]').count(),0);
  await page.locator('[data-title-continue]').click();await page.locator('[data-live-retry]').waitFor();assert.equal(f.posts,3);
  assert.equal((await f.read()).archiveId,a.archiveId);assert.deepEqual((await f.read()).pending,pending.pending);
});

test('new-game warning and cancelled creation preserve the current save until a confirmed birth replaces it',async t=>{
  const f=await fixture(t),{page}=f;
  await page.locator('[data-title-new]:enabled').click();await page.locator('#live-name').fill('林照');await page.locator('[data-live-start]:enabled').click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();
  await page.locator('[data-live-choice]').first().click();await page.locator('[data-live-choice][data-revision="2"]:enabled').first().waitFor();
  const original=await f.read();assert.equal(f.posts,2);
  await page.locator('[data-home]').click();await page.locator('[data-title-new]').click();
  const warning=page.locator('#dialog[open]');
  assert.match(await warning.innerText(),/只有一个存档/);assert.match(await warning.innerText(),/覆盖当前进度/);
  assert.doesNotMatch(await warning.innerText(),/随时.*切回|各自保存/);
  assert.deepEqual((await f.read()).state,original.state);
  await warning.locator('[data-close-dialog]').first().click();
  assert.deepEqual((await f.read()).state,original.state);assert.equal(f.posts,2);
  await page.locator('[data-title-new]').click();await page.locator('[data-confirm]').click();
  await page.locator('#live-name').fill('未入世的人');
  assert.deepEqual((await f.read()).state,original.state);assert.equal(f.posts,2);
  await page.reload();assert.equal(await page.locator('#live-name').inputValue(),'未入世的人');
  assert.equal((await f.read()).archiveId,original.archiveId);assert.deepEqual((await f.read()).state,original.state);
  await page.locator('[data-menu-back]').click();await page.locator('[data-title-continue]:enabled').click();
  await page.locator('[data-live-choice][data-revision="2"]:enabled').first().waitFor();assert.equal(f.posts,2);
  await page.locator('[data-home]').click();await page.locator('[data-title-new]').click();await page.locator('[data-confirm]').click();
  await page.locator('#live-name').fill('沈渡');await page.locator('[data-live-start]:enabled').click();
  await page.locator('[data-live-choice][data-revision="1"]:enabled').first().waitFor();
  const replacement=await f.read();assert.notEqual(replacement.archiveId,original.archiveId);assert.equal(replacement.state.life.name,'沈渡');assert.equal(f.posts,3);
  await page.reload();await page.locator('[data-live-choice][data-revision="1"]:enabled').first().waitFor();
  assert.equal((await f.read()).archiveId,replacement.archiveId);assert.deepEqual((await f.read()).state,replacement.state);assert.equal(f.posts,3);
  await page.locator('[data-home]').click();await page.locator('[data-title-continue]:enabled').click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();assert.match(await page.locator('#app').innerText(),/沈渡/);
  assert.equal(await page.locator('[data-saves], [data-select-live], [data-select-offline]').count(),0);
});

test('a rejected replacement transaction leaves the current journey playable and makes no opening request',async t=>{
  const f=await fixture(t),{page}=f;
  await page.locator('[data-title-new]:enabled').click();await page.locator('#live-name').fill('林照');await page.locator('[data-live-start]:enabled').click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();const original=await f.read();
  await page.locator('[data-home]').click();await page.locator('[data-title-new]').click();await page.locator('[data-confirm]').click();
  await page.locator('#live-name').fill('沈渡');
  await page.evaluate(()=>{
    const transaction=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(stores,mode,...rest){
      if(this.name==='wending-live-v1'&&mode==='readwrite')throw new DOMException('replacement unavailable','QuotaExceededError');
      return transaction.call(this,stores,mode,...rest);
    };
  });
  await page.locator('[data-live-start]:enabled').click();
  await page.locator('#live-birth-form .notice.error').waitFor();
  assert.match(await page.locator('#live-birth-form .notice.error').innerText(),/原进度保持不变|原有旅程保持不变/);
  assert.equal(f.posts,1);assert.equal((await f.read()).archiveId,original.archiveId);assert.deepEqual((await f.read()).state,original.state);
  await page.goto('https://wending-title.test/');await page.locator('[data-title-continue]:enabled').click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();assert.deepEqual((await f.read()).state,original.state);assert.equal(f.posts,1);
});

test('stale save-list and offline navigation return home without changing the current save or legacy bytes',async t=>{
  const f=await fixture(t),{page}=f;
  await page.locator('[data-title-new]:enabled').click();await page.locator('#live-name').fill('林照');await page.locator('[data-live-start]:enabled').click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();const current=await f.read();
  const legacy={'baishi-wending-save-v1':'{legacy current bytes\n原文','baishi-wending-save-v1-legacy-handoff':'{legacy handoff\n原文','baishi-wending-save-v1-journeys':'{legacy catalog bytes\n原文'};
  for(const navigation of [{screen:'saves',mode:'live'},{screen:'adventure',mode:'offline'},{screen:'new',mode:'offline'},{screen:'settings',mode:'offline'},{screen:'inventory',mode:'offline'}]) {
    await page.evaluate(({navigation,legacy})=>{
      for(const [key,value] of Object.entries(legacy))localStorage.setItem(key,value);
      localStorage.setItem('wending-active-mode-v1','offline');
      sessionStorage.setItem('wending-navigation-v1',JSON.stringify({...navigation,returnScreen:'saves',offlineDraft:{raw:'old creation bytes',name:'旧旅人',expectedRaw:null,expectedBackupRaw:null}}));
    },{navigation,legacy});
    await page.reload();await page.locator('[data-title-continue]:enabled').waitFor();
    assert.equal(await page.locator('[data-live-choice], [data-journey-choice], [data-saves], [data-select-live], [data-select-offline], #birth-name, #live-name').count(),0,JSON.stringify(navigation));
    assert.equal((await f.read()).archiveId,current.archiveId);assert.deepEqual((await f.read()).state,current.state);
    assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),Object.keys(legacy)),legacy);
    assert.equal(f.posts,1);
  }
  await page.locator('[data-title-continue]').click();await page.locator('[data-live-choice]:enabled').first().waitFor();
  assert.match(await page.locator('#app').innerText(),/林照/);assert.equal(f.posts,1);
});

test('the current online backup restores only after confirmation; cancelled and invalid imports preserve current progress',async t=>{
  const f=await fixture(t),{page}=f;
  await page.locator('[data-title-new]:enabled').click();await page.locator('#live-name').fill('林照');await page.locator('[data-live-start]:enabled').click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();await page.locator('[data-live-choice]').first().click();
  await page.locator('[data-live-choice][data-revision="2"]:enabled').first().waitFor();const original=await f.read();
  await page.locator('[data-view="settings"]').click();
  await page.locator('.save-backup > summary').click();
  const downloading=page.waitForEvent('download');await page.locator('[data-export]').click();
  const download=await downloading,backup=await readFile(await download.path());
  assert.match(download.suggestedFilename(),/\.wending\.jsonl$/);assert.match(backup.toString(),/wending-live-jsonl/);
  assert.deepEqual((await f.read()).state,original.state);assert.equal(f.posts,2);
  await page.goto('https://wending-title.test/');await page.locator('[data-title-new]:enabled').click();await page.locator('[data-confirm]').click();
  await page.locator('#live-name').fill('沈渡');await page.locator('[data-live-start]:enabled').click();
  await page.locator('[data-live-choice][data-revision="1"]:enabled').first().waitFor();const replacement=await f.read();
  await page.locator('[data-view="settings"]').click();
  await page.locator('.save-backup > summary').click();
  const chooseBackup=()=>page.locator('#import-file').setInputFiles({name:'current.wending.jsonl',mimeType:'application/octet-stream',buffer:backup});
  await chooseBackup();await page.locator('#dialog[open]').waitFor();
  assert.match(await page.locator('#dialog').innerText(),/覆盖当前进度|替换当前存档/);
  assert.deepEqual((await f.read()).state,replacement.state);
  await page.locator('#dialog [data-close-dialog]').first().click();
  assert.equal((await f.read()).archiveId,replacement.archiveId);assert.deepEqual((await f.read()).state,replacement.state);assert.equal(f.posts,3);
  const {createCultivation}=await import('../src/game/cultivation/engine.js'),{serializeGame}=await import('../src/game/save-format.js');
  const legacyRaw=serializeGame(createCultivation({seed:'legacy-import-preserved'}));
  await page.locator('#import-file').setInputFiles({name:'old-offline-life.json',mimeType:'application/json',buffer:Buffer.from(legacyRaw)});
  await page.waitForFunction(()=>document.querySelector('#toast.error')?.textContent);
  assert.equal(await page.locator('#dialog[open]').count(),0,'an offline-format file cannot enter a restore flow');
  assert.equal((await f.read()).archiveId,replacement.archiveId);assert.deepEqual((await f.read()).state,replacement.state);
  await page.locator('#import-file').setInputFiles({name:'broken.wending.jsonl',mimeType:'application/octet-stream',buffer:Buffer.from('truncated backup')});
  await page.locator('#dialog[open] [data-confirm]').click();
  await page.getByText('备份未能恢复，原进度保持不变。',{exact:true}).waitFor();
  assert.equal((await f.read()).archiveId,replacement.archiveId);assert.deepEqual((await f.read()).state,replacement.state);assert.equal(f.posts,3);
  await chooseBackup();await page.locator('#dialog[open] [data-confirm]').click();
  await page.locator('[data-live-choice][data-revision="2"]:enabled').first().waitFor();
  assert.deepEqual((await f.read()).state,original.state);assert.equal(f.posts,3,'restoring completed history does not regenerate a story');
  await page.reload();await page.locator('[data-live-choice][data-revision="2"]:enabled').first().waitFor();
  assert.deepEqual((await f.read()).state,original.state);assert.equal(f.posts,3);
});

test('continuing a completed life preserves its settlement until an explicit reincarnation replaces the current save',async t=>{
  const f=await fixture(t),{page}=f;
  const parent=await page.evaluate(async()=>{
    const engine=await import('/src/game/cultivation/live/engine.js'),{sha256}=await import('/src/game/cultivation/live/identity.js');
    const {buildMemoryDelta}=await import('/src/game/cultivation/live/memory.js'),{openLiveArchive}=await import('/src/game/live-archive.js');
    const archive=await openLiveArchive(),birth=engine.createLiveGame({runId:'settled-current-life',name:'林照',seed:42,engineVersion:7});
    const prefix=`r:${sha256(birth.runId).slice(0,16)}:`,actor={id:prefix+'t1:e:rival',name:'陈砚',kind:'person'};
    try {
      await archive.create({state:birth,pending:engine.prepareOpening(birth,{requestId:'settlement-opening'})});
      for(let index=0;index<10;index++) {
        const loaded=await archive.load();if(loaded.state.phase==='dead')return loaded;
        const pending=loaded.pending??engine.prepareChoice(loaded.state,{requestId:`settlement-turn-${index}`,choiceId:loaded.state.currentScene.choices[0].id});
        if(!loaded.pending)await archive.prepare(pending);
        const turn=`${prefix}t${pending.identity.turnId}:`,scene=pending.receipt.death?null:{id:turn+'s:fight',title:'渡口一战',location:'落苇渡',blocks:[{kind:'narration',text:`第${pending.identity.turnId}次交锋前，渡口山风掠过，陈砚在旧桥前静候。`+'桥栏的刻痕仍在，已经发生的交锋清楚留在此生的行迹中。'.repeat(9)}],entities:[actor],choices:[{id:turn+'c:fight',label:'与陈砚拼死一搏',intent:'fight',targetId:actor.id,approach:'desperate',stake:'high'},{id:turn+'c:ask',label:'询问陈砚缘由',intent:'interact',targetId:actor.id,approach:'ask',stake:'low'},{id:turn+'c:observe',label:'观察旧桥',intent:'interact',targetId:'self',approach:'observe',stake:'low'}],memoryDeltas:[],story:{pattern:'investigation',beat:'progress',anchors:[0]}};
        const nextState=scene?engine.commitTurn(loaded.state,pending,scene):engine.settleDeath(loaded.state,pending);
        await archive.commit({expectedRevision:loaded.state.revision,nextState,scene,memoryDelta:scene?buildMemoryDelta(pending.receipt,scene):null,requestId:pending.identity.requestId});
      }
      throw Error('the deterministic battle fixture did not settle');
    } finally {archive.close();}
  });
  await page.reload();await page.locator('[data-title-continue]:enabled').click();await page.locator('[data-live-reincarnate]:enabled').waitFor();
  assert.match(await page.locator('.live-reincarnation').innerText(),/此生结算/);assert.deepEqual((await f.read()).state,parent.state);assert.equal(f.posts,0);
  await page.reload();await page.locator('[data-live-reincarnate]:enabled').waitFor();
  assert.equal((await f.read()).archiveId,parent.archiveId);assert.deepEqual((await f.read()).state,parent.state);assert.equal(f.posts,0);
  await page.locator('[data-live-reward="past-memory"]').click();await page.locator('[data-live-reincarnate]').click();
  await page.locator('#live-name').fill('沈渡');await page.reload();assert.equal(await page.locator('#live-name').inputValue(),'沈渡');
  assert.deepEqual((await f.read()).state,parent.state);assert.equal(f.posts,0);
  await page.locator('[data-menu-back]').click();await page.locator('[data-live-reincarnate]:enabled').waitFor();
  assert.equal(await page.locator('[data-live-reward="past-memory"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual((await f.read()).state,parent.state);
  await page.locator('[data-live-reincarnate]').click();await page.locator('#live-name').fill('沈渡');await page.locator('[data-live-start]:enabled').click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();const child=await f.read();
  assert.notEqual(child.archiveId,parent.archiveId);assert.equal(child.state.life.name,'沈渡');assert.equal(child.state.reincarnation.parentRunId,parent.state.runId);
  assert.equal(child.state.reincarnation.generation,2);assert.deepEqual(child.state.reincarnation.purchases,['past-memory']);assert.equal(f.posts,1);
  await page.reload();await page.locator('[data-live-choice]:enabled').first().waitFor();
  assert.equal((await f.read()).archiveId,child.archiveId);assert.deepEqual((await f.read()).state,child.state);assert.equal(f.posts,1);
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
  await page.getByText('无法读取当前存档，请检查浏览器存储设置后重试。原进度保持不变。',{exact:true}).waitFor();
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
