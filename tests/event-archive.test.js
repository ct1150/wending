import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {liveBrowser} from './helpers/live-browser.js';

test('a genuine old cloud exit and a paid rift launch resume once with exact mixed-history replay',async t=>{
 const text=gunzipSync(await readFile(new URL('./fixtures/21e6acc-rift-pending.jsonl.gz',import.meta.url))).toString('utf8');
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async text=>{
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js'),{createLiveSession}=await import('/src/ui/live-session.js');
  const a=await open('rift-old'),copy=await open('rift-paid');await importLiveArchive(new Response(text).body,a);
  const old=await a.load(),session=createLiveSession({archive:a,client:{}});await session.load();await session.resume();await session.resume();let row=await a.load();
  const resumed=row.state;
  async function go(active,...keys){for(const key of keys){
   const c=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));if(!c)throw Error('missing '+key);
   row=await active.choose({choiceId:c.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});if(row.errorCode)throw Error(row.errorCode);
  }}
  await go(session,'rest-menu','back','journey-menu','workshop-menu','crossing-menu','sky-book','rift-book');
  await a.prepare(engine.prepareChoice(row.state,{choiceId:row.state.currentScene.choices.find(c=>c.id.endsWith(':c:rift-launch')).id,requestId:'paid-rift-launch'}));
  await importLiveArchive(exportLiveArchive(a),copy);const loaded=await copy.load(),next=createLiveSession({archive:copy,client:{}});
  await next.load();await next.resume();await next.resume();row=await copy.load();const paid=row.state;
  await go(next,'rift-rope','rift-prepare','rift-survey','train-menu','rest-menu','back','journey-menu','workshop-menu','crossing-menu','sky-book','rift-book','rift-channel','rift-moor');
  const final=await open('rift-final');await importLiveArchive(exportLiveArchive(copy),final);
  return {old:old.state,resumed,loaded:loaded.state,paid,final:row.state,exact:identity.stateHash((await final.load()).state)===identity.stateHash(row.state)};
 },text);
 assert.equal(result.resumed.events.node,'training');assert.equal(result.resumed.revision,result.old.revision+1);assert.deepEqual(result.resumed.life,result.old.life);
 assert.equal(result.paid.revision,result.loaded.revision+1);assert.equal(result.paid.life.ageDays,result.loaded.life.ageDays+2);
 assert.equal(result.paid.life.items.supplies,result.loaded.life.items.supplies-1);
 assert.equal(result.paid.life.cultivationProfile.spirit,result.loaded.life.cultivationProfile.spirit-2);
 assert.equal(result.final.events.cloudRift.start,result.paid.life.ageDays);
 assert.equal(result.final.events.cloudRift.anchor,'moor');assert.ok(result.exact);
});

test('an old snow path resumes and a paid reflection survives pending settlement and the final farewell',async t=>{
 const text=gunzipSync(await readFile(new URL('./fixtures/ce167ab-reflection-pending.jsonl.gz',import.meta.url))).toString('utf8');
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async text=>{
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js'),{createLiveSession}=await import('/src/ui/live-session.js');
  const a=await open('reflection-before'),copy=await open('reflection-after');await importLiveArchive(new Response(text).body,a);
  const old=await a.load(),session=createLiveSession({archive:a,client:{}});await session.load();await session.resume();await session.resume();let row=await a.load();
  const resumed={exit:row.state.events.mountain.walk[4].exit,revision:row.state.revision,life:row.state.life};
  async function go(active,...keys){for(const key of keys){
   const c=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));if(!c)throw Error('missing '+key);
   row=await active.choose({choiceId:c.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});if(row.errorCode)throw Error(row.errorCode);
  }}
  await go(session,'mount-echo');
  await a.prepare(engine.prepareChoice(row.state,{choiceId:row.state.currentScene.choices.find(c=>c.id.endsWith(':c:echo-enter')).id,requestId:'paid-reflection'}));
  await importLiveArchive(exportLiveArchive(a),copy);const loaded=await copy.load(),next=createLiveSession({archive:copy,client:{}});
  await next.load();await next.resume();await next.resume();row=await copy.load();const paid=row.state;
  await go(next,'train-menu','mount-book','echo-send','hear-stone','mount-steady','path-0','send-xiaoman');
  const final=await open('reflection-final');await importLiveArchive(exportLiveArchive(copy),final);
  return {old:old.state,resumed,loaded:loaded.state,paid,final:row.state,exact:identity.stateHash((await final.load()).state)===identity.stateHash(row.state)};
 },text);
 assert.equal(result.resumed.exit,'lost');assert.equal(result.resumed.revision,result.old.revision+1);assert.deepEqual(result.resumed.life,result.old.life);
 assert.equal(result.paid.revision,result.loaded.revision+1);assert.equal(result.paid.life.ageDays,result.loaded.life.ageDays+1);
 assert.equal(result.paid.life.cultivationProfile.spirit,result.loaded.life.cultivationProfile.spirit-6);assert.deepEqual(result.paid.life.items,result.loaded.life.items);
 assert.equal(result.final.events.mountain.walk[4].echo.day,result.paid.life.ageDays);
 assert.match(result.final.currentScene.blocks.map(b=>b.text).join('\n'),/旧影走过的雪路/);assert.ok(result.exact);
});

test('an old harbor pending exit can accept a passenger once and replay the actual arrival',async t=>{
 const text=gunzipSync(await readFile(new URL('./fixtures/36c035c-passenger-pending.jsonl.gz',import.meta.url))).toString('utf8');
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async text=>{
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js'),{createLiveSession}=await import('/src/ui/live-session.js');
  const a=await open('passenger-before'),copy=await open('passenger-after');await importLiveArchive(new Response(text).body,a);
  const old=await a.load(),session=createLiveSession({archive:a,client:{}});await session.load();await session.resume();await session.resume();let row=await a.load();
  const resumed={node:row.state.events.node,revision:row.state.revision,life:row.state.life};
  async function go(active,...keys){for(const key of keys){
   const c=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));if(!c)throw Error('missing '+key);
   row=await active.choose({choiceId:c.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});if(row.errorCode)throw Error(row.errorCode);
  }}
  await go(session,'packet-moor','packet-people');
  await a.prepare(engine.prepareChoice(row.state,{choiceId:row.state.currentScene.choices.find(c=>c.id.endsWith(':c:packet-board')).id,requestId:'new-passenger'}));
  await importLiveArchive(exportLiveArchive(a),copy);const loaded=await copy.load(),next=createLiveSession({archive:copy,client:{}});
  await next.load();await next.resume();await next.resume();row=await copy.load();const boarded=row.state;
  await go(next,'packet-cargo','packet-load-2','packet-chart','packet-to-2','packet-tide','packet-moor','packet-close');
  const final=await open('passenger-final');await importLiveArchive(exportLiveArchive(copy),final);
  return {old:old.state,resumed,loaded:loaded.state,boarded,final:row.state,exact:identity.stateHash((await final.load()).state)===identity.stateHash(row.state)};
 },text);
 assert.equal(result.resumed.node,'packet-book');assert.equal(result.resumed.revision,result.old.revision+1);assert.deepEqual(result.resumed.life,result.old.life);
 assert.equal(result.boarded.revision,result.loaded.revision+1);assert.equal(result.boarded.life.ageDays,result.loaded.life.ageDays+1);assert.deepEqual(result.boarded.life.items,result.loaded.life.items);
 assert.equal(result.final.events.charters[0].steps.filter(s=>s.kind==='board').length,1);
 assert.match(result.final.currentScene.blocks.map(b=>b.text).join('\n'),/阿禾.*踏上试种圃/);assert.ok(result.exact);
});

test('a historical council exit resumes once and new testimony survives mixed archive replay',async t=>{
 const text=gunzipSync(await readFile(new URL('./fixtures/56018ff-council-pending.jsonl.gz',import.meta.url))).toString('utf8');
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async text=>{
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js'),{createLiveSession}=await import('/src/ui/live-session.js');
  const a=await open('council-before'),copy=await open('council-after');await importLiveArchive(new Response(text).body,a);
  const old=await a.load(),session=createLiveSession({archive:a,client:{}});await session.load();await session.resume();await session.resume();let row=await a.load();
  const resumed={node:row.state.events.node,revision:row.state.revision,life:row.state.life};
  async function go(...keys){for(const key of keys){
   const c=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));if(!c)throw Error('missing '+key);
   row=await session.choose({choiceId:c.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});if(row.errorCode)throw Error(row.errorCode);
  }}
  await go('journey-menu','river-book','hear-council','council-inquiry','witness-0');
  await a.prepare(engine.prepareChoice(row.state,{choiceId:row.state.currentScene.choices.find(c=>c.id.endsWith(':c:ask-witness')).id,requestId:'new-question'}));
  await importLiveArchive(exportLiveArchive(a),copy);
  const loaded=await copy.load(),next=createLiveSession({archive:copy,client:{}});await next.load();await next.resume();await next.resume();
  const answer=await copy.load();const final=await open('council-final');await importLiveArchive(exportLiveArchive(copy),final);
  return {old:old.state,resumed,loaded:loaded.state,answer:answer.state,exact:identity.stateHash((await final.load()).state)===identity.stateHash(answer.state)};
 },text);
 assert.ok(result.old.currentScene.choices.some(c=>c.id.endsWith(':c:river-back')));
 assert.equal(result.resumed.node,'hub');assert.equal(result.resumed.revision,result.old.revision+1);assert.deepEqual(result.resumed.life,result.old.life);
 assert.equal(result.answer.events.node,'council-question');assert.equal(result.answer.revision,result.loaded.revision+1);
 assert.deepEqual(result.answer.life,result.old.life);assert.equal(result.answer.rng,result.old.rng);assert.equal(result.answer.events.council,result.old.events.council);
 assert.ok(result.exact);
});

test('an old solo retreat preserves its pending exit and reaches paid intensive practice without planting',async t=>{
 const text=gunzipSync(await readFile(new URL('./fixtures/c79c3ff-solo-pending.jsonl.gz',import.meta.url))).toString('utf8');
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async text=>{
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js'),{createLiveSession}=await import('/src/ui/live-session.js');
  const {v7ActionRule}=await import('/src/game/cultivation/live/cultivation-rules.js');
  const a=await open('solo-before'),copy=await open('solo-after');await importLiveArchive(new Response(text).body,a);
  const old=(await a.load()).state,session=createLiveSession({archive:a,client:{}});await session.load();await session.resume();await session.resume();let row=await a.load();
  const initial={node:row.state.events.node,revision:row.state.revision,unchanged:JSON.stringify(row.state.life)===JSON.stringify(old.life)};
  async function go(...keys){for(const key of keys){
   const c=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));if(!c)throw Error('missing '+key+' in '+row.state.events.node);
   row=await session.choose({choiceId:c.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});if(row.errorCode)throw Error(row.errorCode);
  }}
  await go('train-menu','practice');
  for(let n=0;row.state.life.realm==='mortal';n++){
   if(n>12)throw Error('stalled first breakthrough');await go('train-menu');
   if(row.state.life.injury>1||row.state.life.cultivationProfile.spirit<30)await go('rest-menu','recover','train-menu');
   if(!row.state.life.items.manual){await go('find-material');for(let tries=0;!row.state.life.items.manual;tries++){if(tries>12)throw Error('no manual');await go('hunt-careful');}}
   await go('breakthrough');
  }
  await go('train-menu','practice');
  const before=row.state,action=before.currentScene.choices.find(c=>c.id.endsWith(':c:intensive-again')),rule=v7ActionRule(before,action);
  await go('intensive-again');await importLiveArchive(exportLiveArchive(a),copy);const saved=(await copy.load()).state;
  return {oldKeys:old.currentScene.choices.map(c=>c.id.split(':c:')[1]),oldRevision:old.revision,initial,garden:saved.events.garden??null,days:saved.life.ageDays-before.life.ageDays,spirit:before.life.cultivationProfile.spirit-saved.life.cultivationProfile.spirit,food:saved.life.items.supplies-before.life.items.supplies,rule,exact:identity.stateHash(saved)===identity.stateHash(row.state)};
 },text);
 assert.ok(result.oldKeys.includes('continue'));assert.equal(result.initial.node,'hub');assert.equal(result.initial.revision,result.oldRevision+1);assert.ok(result.initial.unchanged);
 assert.equal(result.garden,null);assert.equal(result.days,result.rule.days);assert.equal(result.spirit,result.rule.spiritCost);assert.equal(result.food,-1);assert.ok(result.exact);
});

test('mobile long-route directions open the actual story entrances without accepting either commission',async t=>{
 const {page}=await liveBrowser(t);await page.setViewportSize({width:360,height:760});
 const opt=key=>page.locator('[data-live-choice$=":c:'+key+'"]:enabled');
 await page.locator('[data-title-new]').click();await page.locator('[data-live-start]').click();await opt('decline').click();
 const state=()=>page.evaluate(async()=>{const {openLiveArchive}=await import('/src/game/live-archive.js');const a=await openLiveArchive();try{return (await a.load()).state;}finally{a.close();}});
 const before=await state();await page.locator('[data-adventure-leads] > summary').click();
 assert.match(await page.locator('[data-adventure-leads]').innerText(),/九关问鼎/);
 await page.locator('[data-adventure-lead][data-live-note="watch-book"]').click();await opt('watch-open').waitFor();
 const watch=await state();assert.equal(watch.events.watch,undefined);assert.deepEqual(watch.life,before.life);assert.equal(watch.rng,before.rng);
 await page.locator('[data-adventure-lead][data-live-note="river-book"]').click();await opt('river-open').waitFor();
 const river=await state();assert.equal(river.events.river,undefined);assert.equal(river.events.watch,undefined);assert.deepEqual(river.life,before.life);assert.equal(river.rng,before.rng);
 await page.locator('[data-adventure-lead][data-live-note="companion"]').click();await opt('leave-companion').waitFor();
 const person=await state();assert.equal(person.events.companion,'unmet');assert.deepEqual(person.life,before.life);
 await page.locator('[data-adventure-lead][data-live-note="mount-book"]').click();await opt('seek-home').waitFor();
 const stone=await state();assert.equal(stone.events.mountain,undefined);assert.equal(stone.events.post,undefined);assert.deepEqual(stone.life,before.life);assert.equal(stone.rng,before.rng);
 await page.reload();await opt('seek-home').waitFor();assert.deepEqual(await state(),stone);
 await opt('seek-home').click();await opt('hear-stone').waitFor();
 assert.equal(await page.locator('[data-adventure-lead][data-live-note="mount-book"]').count(),0);
 assert.equal((await state()).events.mountain.wish,'home');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});

test('the original fourth mountain gift restores its pending exit and the new paid wind conversation replays exactly once',async t=>{
 const bytes=gunzipSync(await readFile(new URL('./fixtures/320d9a6-wind-pending.jsonl.gz',import.meta.url))).toString('utf8');
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async text=>{
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js');
  const {createLiveSession}=await import('/src/ui/live-session.js');
  const a=await open('wind-before'),copy=await open('wind-during'),final=await open('wind-after');
  await importLiveArchive(new Blob([text]).stream(),a);
  const old=(await a.load()).state;let session=createLiveSession({archive:a,client:{}});
  await session.load();await session.resume();await session.resume();let row=await a.load();
  const restored=row.state.events.node,revision=row.state.revision;
  async function go(...keys){for(const key of keys){
   const c=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));if(!c)throw Error('missing '+key+' at '+row.state.events.node);
   row=await session.choose({choiceId:c.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});if(row.errorCode)throw Error(row.errorCode);
  }}
  await go('rest-menu','recover','mount-book','mount-wind');
  const from=row.state.life;
  await go('wind-practice','train-menu');
  const paid=row.state.life,partial=identity.stateHash(row.state);
  await importLiveArchive(exportLiveArchive(a),copy);
  session=createLiveSession({archive:copy,client:{}});await session.load();await session.resume();row=await copy.load();
  const exactPartial=partial===identity.stateHash(row.state);
  await go('mount-book','wind-pair','mount-book','keep-token','mount-history');
  await importLiveArchive(exportLiveArchive(copy),final);
  const saved=(await final.load()).state;
  return {oldKeys:old.currentScene.choices.map(c=>c.id.split(':c:')[1]),originalRevision:old.revision,restored,revision,days:paid.ageDays-from.ageDays,spirit:from.cultivationProfile.spirit-paid.cultivationProfile.spirit,
   exactPartial,exact:identity.stateHash(saved)===identity.stateHash(row.state),wind:saved.events.mountain.wind,gifts:saved.events.mountain.gifts,history:saved.currentScene.blocks.map(b=>b.text).join(''),afterAge:saved.life.ageDays,paidAge:paid.ageDays};
 },bytes);
 assert.deepEqual(result.oldKeys,['keep-token','give-token','train-menu']);assert.equal(result.restored,'training');assert.equal(result.revision,result.originalRevision+1);
 assert.equal(result.days,1);assert.equal(result.spirit,6);assert.equal(result.afterAge,result.paidAge);
 assert.ok(result.exactPartial&&result.exact);assert.equal(result.wind.ending,'pair');assert.deepEqual(result.gifts,['keep','keep']);assert.match(result.history,/两下走，一下停/);
});

test('an original foundation mentor exit restores once, then paid form study and its risky search replay together',async t=>{
 const bytes=gunzipSync(await readFile(new URL('./fixtures/06df05c-forms-pending.jsonl.gz',import.meta.url))).toString('utf8');
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async text=>{
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js');
  const {createLiveSession}=await import('/src/ui/live-session.js');
  const {nextRealmFor}=await import('/src/game/cultivation/live/cultivation-rules.js');
  const a=await open('forms-before'),copy=await open('forms-after');
  await importLiveArchive(new Blob([text]).stream(),a);
  const original=(await a.load()).state,session=createLiveSession({archive:a,client:{}});
  await session.load();await session.resume();await session.resume();
  let row=await a.load();const restored=row.state.events.node,revision=row.state.revision;
  async function go(...keys){for(const key of keys){
   const c=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));
   if(!c)throw Error('missing '+key+' at '+row.state.events.node);
   row=await session.choose({choiceId:c.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});
   if(row.errorCode)throw Error(row.errorCode);
  }}
  await go('affairs-menu','mentor-menu','form-book','form-ward');
  const from=row.state.life;
  await go('form-steady');
  const study={days:row.state.lastReceipt.elapsedDays,spirit:from.cultivationProfile.spirit-row.state.life.cultivationProfile.spirit,known:row.state.events.forms.known};
  await go('train-menu');
  for(let guard=0;row.state.life.cultivation<nextRealmFor(row.state.life).threshold;guard++){
   if(guard>40)throw Error('stalled practice');
   if(row.state.life.cultivationProfile.spirit<30)await go('rest-menu','recover','train-menu');
   await go('practice','train-menu');
  }
  await go('find-material');if(row.state.events.node==='hunt-sources')await go('hunt-grounds');
  for(let guard=0;!row.state.life.items.supplies;guard++){if(guard>20)throw Error('stalled supplies');await go('hunt-food');}
  if(row.state.life.cultivationProfile.spirit<20)await go('hunt-rest');
  await go('hunt-forms','hunt-skilled');
  await importLiveArchive(exportLiveArchive(a),copy);
  const saved=(await copy.load()).state;
  return {restored,revision,originalRevision:original.revision,old:original.currentScene.choices.map(c=>c.id.split(':c:')[1]),study,known:saved.events.forms.known,receipt:saved.lastReceipt,exact:identity.stateHash(saved)===identity.stateHash(row.state)};
 },bytes);
 assert.ok(result.old.includes('back'));assert.equal(result.restored,'hub');assert.equal(result.revision,result.originalRevision+1);
 assert.ok(result.study.days>0);assert.ok(result.study.spirit>0);assert.equal(result.study.known,'ward');
 assert.equal(result.known,'ward');assert.ok(result.exact);assert.equal(result.receipt.itemChanges.supplies,-1);
 assert.ok(result.receipt.action.id.endsWith(':c:hunt-skilled'));
});

test('an original failed crossing replays its old exit, then allows one paid port shift',async t=>{
 const bytes=gunzipSync(await readFile(new URL('./fixtures/eac27c6-crossing-exit.jsonl.gz',import.meta.url))).toString('utf8');
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async text=>{
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js');
  const {createLiveSession}=await import('/src/ui/live-session.js');
  const a=await open('pier-before'),copy=await open('pier-after');
  await importLiveArchive(new Blob([text]).stream(),a);
  const original=(await a.load()).state,session=createLiveSession({archive:a,client:{}});
  await session.load();await session.resume();
  let row=await a.load();const restored=row.state.events.node;
  async function go(key){
   const c=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));
   if(!c)throw Error('missing '+key+' at '+row.state.events.node);
   row=await session.choose({choiceId:c.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});
   if(row.errorCode)throw Error(row.errorCode);
  }
  for(const key of ['rest-menu','back','journey-menu','river-book','hear-council','convoy-book','cross-menu','yard-book','yard-duty','yard-shore','yard-pay-iron'])await go(key);
  const earned=row.state.lastReceipt.itemChanges,days=row.state.lastReceipt.elapsedDays;
  await go('cross-menu');await go('yard-book');await importLiveArchive(exportLiveArchive(a),copy);
  const saved=(await copy.load()).state;
  return {old:original.currentScene.choices.map(c=>c.id.split(':c:')[1]),loss:original.lastReceipt.itemChanges,restored,earned,days,
   paid:saved.events.convoy.shifts,again:saved.currentScene.choices.some(c=>c.id.endsWith(':c:yard-duty')),exact:identity.stateHash(saved)===identity.stateHash(row.state)};
 },bytes);
 assert.deepEqual(result.old,['convoy-book','train-menu','river-back']);assert.equal(result.restored,'training');
 assert.equal(result.loss.stones,-45);assert.equal(result.loss.array,-1);
 assert.equal(result.earned.stones,45);assert.equal(result.earned.iron,2);assert.ok(result.days>0);
 assert.deepEqual(result.paid,[{crew:'shore',pay:'iron'},null]);assert.equal(result.again,false);assert.ok(result.exact);
});

test('a pending three-day job exported by 1b5487e keeps the old work scene and settles only once',async t=>{
 const bytes=gunzipSync(await readFile(new URL('./fixtures/1b5487e-nursery-pending.jsonl.gz',import.meta.url))).toString('utf8');
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async text=>{
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js');
  const {createLiveSession}=await import('/src/ui/live-session.js');
  const archive=await open('old-nursery'),copy=await open('old-nursery-replayed');
  await importLiveArchive(new Blob([text]).stream(),archive);
  const before=await archive.load(),session=createLiveSession({archive,client:{}});
  await session.load();await session.resume();await session.resume();
  await importLiveArchive(exportLiveArchive(archive),copy);
  const after=await copy.load();
  return {oldMenu:before.state.currentScene.choices.map(c=>c.id.split(':').at(-1)),request:before.pending.identity.requestId,
   days:after.state.life.ageDays-before.state.life.ageDays,manual:(after.state.life.items.manual??0)-(before.state.life.items.manual??0),
   entry:after.state.events.entry,turns:after.state.turnId-before.state.turnId,partial:after.state.events.nursery??null,pending:after.pending};
 },bytes);
 assert.deepEqual(result,{oldMenu:['finish-work','companion','abandon-work'],request:'old-three-day-shift',days:3,manual:1,entry:'joined',turns:1,partial:null,pending:null});
});

test('steady retreat plans commit the manual turns exactly once and fence interruption, stale tabs and partial writes',async t=>{
 const {page}=await liveBrowser(t);
 const results=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),{practicePlan}=await import('/src/game/cultivation/live/practice-plan.js');
  const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');
  const archive=await open('repeat-source'),session=createLiveSession({archive,client:{}});
  let row=await session.startNew({runId:'repeat',seed:42,name:'沈渡',engineVersion:7,eventVersion:1,originStories:true,experienceVersion:1},null);
  const args=row=>({archiveId:row.archiveId,count:practicePlan(row.state).count,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});
  const choose=(ss,r,key)=>ss.choose({choiceId:r.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key)).id,baseRevision:r.state.revision,stateHash:identity.stateHash(r.state)});
  for(const key of ['decline','train-menu'])row=await choose(session,row,key);
  const command=args(row),bytes=await new Response(exportLiveArchive(archive)).text();
  const full=await session.practiceUntil(command),old=await session.practiceUntil(command);
  const modes={};
  for(const mode of ['manual','stop','abort','replace']){
   const a=await open('repeat-'+mode);await importLiveArchive(new Response(bytes).body,a);
   const ss=createLiveSession({archive:a,client:{},onChange:current=>{if(mode==='stop'&&current.practice?.done===1)ss.stopPractice();}});
   const initial=await ss.load(),commit=a.commitEvent.bind(a);let calls=0;
   a.commitEvent=async input=>{
    calls++;
    if(calls===2&&mode==='abort')throw Error('simulated interrupted write');
    if(calls===2&&mode==='replace'){
     const other=await open('repeat-'+mode);
     try{await importLiveArchive(new Response(bytes).body,other);}finally{other.close();}
    }
    return commit(input);
   };
   let final=initial;
   if(mode==='manual')for(let i=0;i<command.count;i++)final=await choose(ss,final,i?'practice-again':'practice');
   else final=await ss.practiceUntil(args(initial));
   const after=await a.load();modes[mode]={turns:after.state.turnId-initial.state.turnId,hash:identity.stateHash(after.state),error:final.errorCode,report:final.practice?.done};
   a.close();
  }
  const copied=await open('repeat-export');await importLiveArchive(exportLiveArchive(archive),copied);
  return {count:command.count,full:identity.stateHash(full.state),roundtrip:identity.stateHash((await copied.load()).state),old:old.errorCode,start:command.stateHash,modes};
 });
 assert.ok(results.count>=2);assert.equal(results.full,results.roundtrip);assert.equal(results.full,results.modes.manual.hash);
 assert.equal(results.old,'STALE_CHOICE');
 assert.equal(results.modes.stop.turns,1);assert.equal(results.modes.stop.report,1);
 assert.equal(results.modes.abort.hash,results.modes.stop.hash);assert.ok(results.modes.abort.error);
 assert.equal(results.modes.replace.turns,0);assert.equal(results.modes.replace.hash,results.start);assert.ok(results.modes.replace.error);
});

test('the retreat limit opens the waiting harvest without spending time or harvesting it',async t=>{
 const {page}=await liveBrowser(t);await page.setViewportSize({width:360,height:760});
 const bytes=gunzipSync(await readFile(new URL('./fixtures/873a7ce-first-garden.jsonl.gz',import.meta.url))).toString('utf8');
 await page.evaluate(async text=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js'),{importLiveArchive}=await import('/src/game/live-save-format.js');
  const a=await openLiveArchive();try{await importLiveArchive(new Response(text).body,a);}finally{a.close();}
 },bytes);
 const option=key=>page.locator('[data-live-choice$=":c:'+key+'"]:enabled');
 const saved=()=>page.evaluate(async()=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js');const a=await openLiveArchive();
  try{return (await a.load()).state;}finally{a.close();}
 });
 await page.reload();
 const enter=page.locator('[data-title-continue]:enabled');await option('sow').or(enter).first().waitFor();
 if(!await option('sow').isVisible())await enter.click();
 await option('sow').click();await option('train-menu').click();
 const resume=page.locator('[data-practice-resume][data-live-note="garden-book"]:enabled');
 await resume.waitFor();assert.match(await page.locator('[data-practice-limit]').innerText(),/0 关.*嫩候/);
 assert.ok(await resume.evaluate(n=>Boolean(n.compareDocumentPosition(document.querySelector('[data-live-choice]'))&Node.DOCUMENT_POSITION_FOLLOWING)));
 const before=await saved();await resume.click();await option('inspect-bed').waitFor();const after=await saved();
 assert.equal(after.events.node,'garden-book');assert.deepEqual(after.life,before.life);assert.equal(after.rng,before.rng);
 assert.deepEqual(after.events.garden,before.events.garden);
 await page.reload();assert.deepEqual(await saved(),after);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});

test('opening a note stops on interruption or archive replacement and rejects old tabs and undiscovered entries',async t=>{
 const {page}=await liveBrowser(t);
 const bytes=gunzipSync(await readFile(new URL('./fixtures/f9b784d-echo-well.jsonl.gz',import.meta.url))).toString('utf8');
 const result=await page.evaluate(async text=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),{importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js');
  const base=await open('notes-original');await importLiveArchive(new Response(text).body,base);
  const session=createLiveSession({archive:base,client:{}});let row=await session.load();
  const args=r=>({node:'well-book',archiveId:r.archiveId,baseRevision:r.state.revision,stateHash:identity.stateHash(r.state)});
  for(const key of ['train-menu','find-material','well-cautious','train-menu','rest-menu','back']){
   const state=row.state;row=await session.choose({choiceId:state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key)).id,baseRevision:state.revision,stateHash:identity.stateHash(state)});
  }
  const saved=await new Response(exportLiveArchive(base)).text(),out={};
  for(const mode of ['success','stop','replace','invalid']){
   const a=await open('notes-'+mode);await importLiveArchive(new Response(saved).body,a);
   const ss=createLiveSession({archive:a,client:{}}),start=await ss.load(),cmd=args(start);
   const commit=a.commitEvent.bind(a);let count=0;
   a.commitEvent=async input=>{
    if(mode==='replace'&&count===1){
     const other=await open('notes-'+mode);try{await importLiveArchive(new Response(saved).body,other);}finally{other.close();}
    }
    const updated=await commit(input);count++;return updated;
   };
   const final=await ss.openJourneyNote(mode==='invalid'?{...cmd,node:'well-share'}:cmd,()=>mode!=='stop'||count===0);
   const current=await a.load();
   out[mode]={count,error:final.errorCode,node:current.state.events.node,steps:current.state.revision-start.state.revision,unchanged:JSON.stringify(current.state.life)===JSON.stringify(start.state.life)&&current.state.rng===start.state.rng&&current.state.events.well.claim===null};
   if(mode==='success')out.stale=(await ss.openJourneyNote(cmd)).errorCode;
   a.close();
  }
  base.close();return out;
 },bytes);
 assert.equal(result.success.node,'well-book');assert.ok(result.success.steps>=2);assert.equal(result.stale,'STALE_CHOICE');
 assert.equal(result.stop.count,1);assert.equal(result.stop.steps,1);assert.notEqual(result.stop.node,'well-book');
 assert.equal(result.replace.count,1);assert.equal(result.replace.steps,0);assert.ok(result.replace.error);
 assert.equal(result.invalid.steps,0);assert.equal(result.invalid.error,'STALE_CHOICE');
 for(const mode of ['success','stop','replace','invalid'])assert.ok(result[mode].unchanged);
});

test('the mobile journey notes resume an interrupted well while a real ferry tide runs, without choosing either outcome',async t=>{
 const {page}=await liveBrowser(t);await page.setViewportSize({width:360,height:760});
 let calls=0;await page.route('**/api/story/**',r=>{calls++;return r.abort();});
 const bytes=gunzipSync(await readFile(new URL('./fixtures/f9b784d-echo-well.jsonl.gz',import.meta.url))).toString('utf8');
 await page.evaluate(async text=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js'),{importLiveArchive}=await import('/src/game/live-save-format.js');
  const a=await openLiveArchive();try{await importLiveArchive(new Response(text).body,a);}finally{a.close();}
 },bytes);
 const option=key=>page.locator('[data-live-choice$=":c:'+key+'"]:enabled');
 async function resume(key){
  await page.reload();const enter=page.locator('[data-title-continue]:enabled');
  await option(key).or(enter).first().waitFor();if(!await option(key).isVisible())await enter.click();await option(key).waitFor();
 }
 async function pick(...keys){for(const key of keys)await option(key).click();}
 const state=()=>page.evaluate(async()=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js');const a=await openLiveArchive();
  try{return (await a.load()).state;}finally{a.close();}
 });
 await resume('hunt-bold');
 await pick('train-menu','find-material','well-cautious','well-chalk','train-menu','rest-menu','back','journey-menu','resources-menu','shell-book','sail-bank','train-menu');
 await option('rest-menu').waitFor();await resume('rest-menu');
 const journal=page.locator('[data-journey-notes]');
 assert.match(await journal.locator('summary').innerText(),/满舱小灯.*24日/);
 await journal.locator('summary').click();
 assert.match(await journal.innerText(),/已找出石壁的假回声/);
 const before=await state();await journal.locator('[data-live-note="well-book"]').click();await option('well-sluice').waitFor();
 const after=await state();assert.deepEqual(after.life,before.life);assert.equal(after.rng,before.rng);
 assert.deepEqual(after.events.well,before.events.well);assert.deepEqual(after.events.ferry,before.events.ferry);
 assert.match(await option('well-sluice').innerText(),/此行结束时已过浮蚌渡/);
 await pick('well-sluice');await option('well-share').waitFor();
 assert.match(await journal.innerText(),/潮已退/);
 await journal.locator('[data-live-note="shell-book"]').click();await option('close-tide').waitFor();
 const expired=await state();assert.equal(expired.events.ferry.pages.at(-1).end,null);assert.equal(expired.events.well.claim,null);
 await pick('close-tide');await option('shell-journal').waitFor();assert.doesNotMatch(await journal.innerText(),/潮已退/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(calls,0);
});

test('a historic well search stays playable on mobile, then the new well ledger survives reload and import',async t=>{
 const {page}=await liveBrowser(t);await page.setViewportSize({width:360,height:760});
 let calls=0;await page.route('**/api/story/**',r=>{calls++;return r.abort();});
 const bytes=gunzipSync(await readFile(new URL('./fixtures/f9b784d-echo-well.jsonl.gz',import.meta.url))).toString('utf8');
 assert.ok(await page.evaluate(async text=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js'),{importLiveArchive}=await import('/src/game/live-save-format.js');
  const archive=await openLiveArchive();try{
   await importLiveArchive(new Response(text).body,archive);
   return identity.stateHash((await archive.load()).state)===identity.stateHash(JSON.parse(text.split('\n')[0]).state);
  }finally{archive.close();}
 },bytes));
 const option=key=>page.locator('[data-live-choice$=":c:'+key+'"]:enabled');
 async function resume(key){
  await page.reload();const enter=page.locator('[data-title-continue]:enabled');
  await option(key).or(enter).first().waitFor();if(!await option(key).isVisible())await enter.click();await option(key).waitFor();
 }
 async function pick(key){
  const button=option(key);await button.waitFor();
  const rev=await button.getAttribute('data-revision');await button.click();
  await page.locator('[data-live-choice]:not([data-revision="'+rev+'"])').first().waitFor();
 }
 await resume('hunt-bold');
 for(const key of ['hunt-bold','train-menu','rest-menu','back','journey-menu','resources-menu','next-resource','well-road'])await pick(key);
 for(let i=0;await option('well-food').isVisible();i++){assert.ok(i<16);await pick('well-food');}
 for(const key of ['well-bold','well-knot','train-menu','rest-menu','back','journey-menu','resources-menu','next-resource','well-book','well-basket'])await pick(key);
 await resume('well-share');await pick('well-share');
 const result=await page.evaluate(async()=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js'),{stateHash}=await import('/src/game/cultivation/live/identity.js');
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js');
  const a=await openLiveArchive(),b=await openLiveArchive({name:'well-copy'});
  try{await importLiveArchive(exportLiveArchive(a),b);const s=(await a.load()).state;
   return {well:s.events.well,same:stateHash(s)===stateHash((await b.load()).state),overflow:document.documentElement.scrollWidth>innerWidth};
  }finally{a.close();b.close();}
 });
 assert.equal(result.same,true);assert.equal(result.overflow,false);assert.equal(result.well.rig,'basket');assert.equal(result.well.claim,'share');
 assert.equal(result.well.finish-result.well.start,7*result.well.total/8+12);assert.equal(calls,0);
});

test('the previous training gate survives mobile import and the new material route resumes halfway through',async t=>{
 const {page}=await liveBrowser(t);await page.setViewportSize({width:360,height:760});
 let calls=0;await page.route('**/api/story/**',r=>{calls++;return r.abort();});
 const bytes=gunzipSync(await readFile(new URL('./fixtures/1bb3191-missing-crystal.jsonl.gz',import.meta.url))).toString('utf8');
 assert.ok(await page.evaluate(async text=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js'),{importLiveArchive}=await import('/src/game/live-save-format.js');
  const archive=await openLiveArchive();
  try{
   await importLiveArchive(new Response(text).body,archive);
   return identity.stateHash((await archive.load()).state)===identity.stateHash(JSON.parse(text.split('\n')[0]).state);
  }finally{archive.close();}
 },bytes));
 const option=key=>page.locator('[data-live-choice$=":c:'+key+'"]');
 async function resume(key){
  await page.reload();const button=option(key),enter=page.locator('[data-title-continue]:enabled');
  await button.or(enter).first().waitFor();if(!await button.isVisible())await enter.click();await button.waitFor();
 }
 await resume('breakthrough');assert.ok(await option('breakthrough').isDisabled());
 for(const key of ['rest-menu','back','train-menu','find-material','hunt-grounds'])await option(key).click();
 await option('hunt-careful').waitFor();
 await resume('hunt-careful');await option('hunt-careful').click();
 await page.getByText(/这一趟收得|没有灵脉的碎屑/).first().waitFor();
 assert.ok(await page.evaluate(async()=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js'),{stateHash}=await import('/src/game/cultivation/live/identity.js');
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js');
  const a=await openLiveArchive(),b=await openLiveArchive({name:'gate-roundtrip'});
  try{await importLiveArchive(exportLiveArchive(a),b);return stateHash((await a.load()).state)===stateHash((await b.load()).state);}
  finally{a.close();b.close();}
 }));
 assert.equal(calls,0);
});

test('a pre-ferry resource menu resumes on mobile and preserves both its original history and the harvested crystal',async t=>{
 const {page}=await liveBrowser(t);
 await page.setViewportSize({width:360,height:760});
 let calls=0;await page.route('**/api/story/**',route=>{calls++;return route.abort();});
 const old=gunzipSync(await readFile(new URL('./fixtures/4d9bd9c-qi-resources.jsonl.gz',import.meta.url))).toString('utf8');
 const same=await page.evaluate(async text=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js'),{importLiveArchive}=await import('/src/game/live-save-format.js');
  const archive=await openLiveArchive();
  try{
   await importLiveArchive(new Response(text).body,archive);
   return identity.stateHash((await archive.load()).state)===identity.stateHash(JSON.parse(text.split('\n')[0]).state);
  }finally{archive.close();}
 },old);
 assert.ok(same);
 const option=key=>page.locator('[data-live-choice$=":c:'+key+'"]:enabled');
 async function resume(key){
  await page.reload();const saved=option(key),enter=page.locator('[data-title-continue]:enabled');
  await saved.or(enter).first().waitFor();
  if(!await saved.isVisible())await enter.click();
  await saved.waitFor();
 }
 await resume('back');
 for(const key of ['back','journey-menu','resources-menu','shell-book','sail-bank','trace-shell'])await option(key).click();
 await option('take-moult').waitFor();await resume('take-moult');await option('take-moult').click();
 await option('shell-journal').waitFor();
 const kept=await page.evaluate(async()=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js'),{importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js');
  const source=await openLiveArchive(),copy=await openLiveArchive({name:'ferry-copy'});
  const {stateHash}=await import('/src/game/cultivation/live/identity.js');
  try{
   await importLiveArchive(exportLiveArchive(source),copy);
   const a=(await source.load()).state,b=(await copy.load()).state;
   return [a.events.ferry.pages[0].end,a.lastReceipt.itemChanges.crystal,Object.values(a.lastReceipt.relationChanges),stateHash(a)===stateHash(b)];
  }finally{source.close();copy.close();}
 });
 assert.deepEqual(kept,['moult',1,[1],true]);assert.equal(calls,0);
});

test('an old two-option courier journal resumes into the playable station route and round-trips its mixed history',async t=>{
 const {page}=await liveBrowser(t);
 await page.setViewportSize({width:360,height:760});
 let calls=0;await page.route('**/api/story/**',route=>{calls++;return route.abort();});
 const old=gunzipSync(await readFile(new URL('./fixtures/ecb15f3-post-history.jsonl.gz',import.meta.url))).toString('utf8');
 const restored=await page.evaluate(async text=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js');
  const {importLiveArchive}=await import('/src/game/live-save-format.js');
  const archive=await openLiveArchive();
  try{
   await importLiveArchive(new Response(text).body,archive);
   const {state}=await archive.load();
   return state.currentScene.choices.length===2&&identity.stateHash(state)===identity.stateHash(JSON.parse(text.split('\n')[0]).state);
  }finally{archive.close();}
 },old);
 assert.equal(restored,true);
 const pick=key=>page.locator('[data-live-choice$=":c:'+key+'"]:enabled').click();
 async function resume(key){
  await page.reload();
  const saved=page.locator('[data-live-choice$=":c:'+key+'"]:enabled'),enter=page.locator('[data-title-continue]:enabled');
  await saved.or(enter).first().waitFor();
  if(!await saved.isVisible())await enter.click();
  await saved.waitFor();
 }
 await resume('post-book');
 for(const key of ['post-book','post-history','station-book','trust-1','station-retreat','visit-1'])await pick(key);
 await page.locator('[data-live-choice$=":c:visit-0"]').waitFor();
 await resume('visit-0');
 for(const key of ['visit-0','station-settle','settle-1','trust-0','station-work','visit-0','station-settle','settle-0','trust-1','station-work','visit-0','visit-1','walk-fog','feel-left','walk-fog','ask-guide','station-settle','settle-0'])await pick(key);
 await page.getByRole('heading',{name:'两站合簿 · 拆下临时牌'}).waitFor();
 assert.match(await page.locator('[data-live-prose]').innerText(),/捎给对岸/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const verified=await page.evaluate(async()=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js'),{stateHash}=await import('/src/game/cultivation/live/identity.js');
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js');
  const from=await openLiveArchive(),to=await openLiveArchive({name:'station-copy'});
  try{
   await importLiveArchive(exportLiveArchive(from),to);
   const a=(await from.load()).state,b=(await to.load()).state;
   return [a.events.post.stations.map(r=>r.settled),a.events.post.stations[2].fog,stateHash(a)===stateHash(b)];
  }finally{from.close();to.close();}
 });
 assert.deepEqual(verified,[[1,0,0],'guided',true]);assert.equal(calls,0);
});

test('a genuine pre-courier reunion backup retains its exact state and rejects a changed historic companion choice',async t=>{
 const {page}=await liveBrowser(t);
 const old=gunzipSync(await readFile(new URL('./fixtures/f924d32-lin-reunion.jsonl.gz',import.meta.url))).toString('utf8');
 const result=await page.evaluate(async text=>{
  const format=await import('/src/game/live-save-format.js'),{createLiveSession}=await import('/src/ui/live-session.js');
  const archive=await open('old-reunion'),rows=text.trim().split('\n').map(line=>JSON.parse(line));
  await format.importLiveArchive(new Response(text).body,archive);
  let row=await archive.load();const exact=identity.stateHash(row.state)===identity.stateHash(rows[0].state);
  const session=createLiveSession({archive,client:{}});
  for(const key of ['back','affairs-menu','companion-menu','post-book','launch-relay']){
   const s=row.state,action=s.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));
   row=await session.choose({choiceId:action.id,baseRevision:s.revision,stateHash:identity.stateHash(s)});
   if(row.errorCode)throw Error(row.errorCode);
  }
  const copy=await open('mixed-reunion');
  await format.importLiveArchive(format.exportLiveArchive(archive),copy);
  const mixed=await copy.load(),stage=await copy._stage(rows[0].birth);
  let rejected=false;
  try{
   for(const entry of rows.filter(r=>r.type==='chunk').flatMap(r=>r.chunk.entries)){
    if(entry.scene?.id.endsWith(':s:event_companion')&&entry.scene.choices.length===2){
     entry.scene.choices[0].label='冒写的旧决定';
     try{await copy._stageEntry(stage,entry);}catch(error){rejected=error.message==='ARCHIVE_INVALID_RULE_SCENE';}
     break;
    }
    await copy._stageEntry(stage,entry);
   }
  }finally{await copy._discardStage(stage);}
  return {exact,rejected,mixed:identity.stateHash(row.state)===identity.stateHash(mixed.state),origin:mixed.state.events.post.origin};
 },old);
 assert.deepEqual(result,{exact:true,rejected:true,mixed:true,origin:'unknown'});
});

test('native event session opens and makes choices without any story service, then refreshes and replays a full backup',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),format=await import('/src/game/live-save-format.js');
  const archive=await open('events-offline');let calls=0;
  const client={capabilities(){calls++;throw Error('offline');},createSession(){calls++;throw Error('offline');},requestTurn(){calls++;throw Error('offline');},getTurn(){calls++;throw Error('offline');}};
  const session=createLiveSession({archive,client});
  let row=await session.startNew({runId:'event-offline',name:'沈渡',seed:42,engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1},null);
  const opening={phase:row.state?.phase,error:row.errorCode,pending:!!row.pending};
  if(row.state?.phase!=='active')return {opening,calls};
  for(const key of ['ask','companion','aid','continue','accept','finish-work','continue','train-menu']){
   const choice=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));
   if(!choice)throw Error('missing '+key);
   row=await session.choose({choiceId:choice.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});
   if(row.errorCode)throw Error(row.errorCode);
  }
  const saved=await archive.load(),restoredSession=createLiveSession({archive:await open('events-offline'),client});await restoredSession.load();const refreshed=await restoredSession.resume();
  const text=await new Response(format.exportLiveArchive(archive)).text(),target=await open('events-import');
  await format.importLiveArchive(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(text));c.close();}}),target);
  const imported=await target.load(),history=await target.readHistory(imported.state.runId);
  return {opening,calls,saved,refreshed,imported,historyLength:history.entries.length};
 });
 assert.equal(result.opening.phase,'active',JSON.stringify(result.opening));assert.equal(result.calls,0);
 assert.equal(result.saved.pending,null);assert.equal(result.saved.state.events.entry,'joined');assert.equal(result.saved.state.events.companion,'helped');
 assert.deepEqual(result.saved.state,result.refreshed.state);assert.deepEqual(result.saved.state,result.imported.state);assert.equal(result.historyLength,9);
});

test('native event CAS commits once across tabs and protects an imported physical copy from the old view',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),format=await import('/src/game/live-save-format.js');
  const archive=await open('events-race'),session=createLiveSession({archive,client:{}});
  const row=await session.startNew({runId:'events-race',seed:42,engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1},null);
  if(!row.state)return {error:row.errorCode};
  if(typeof archive.commitEvent!=='function')return {error:'commitEvent missing'};
  const other=await open('events-race');await other.load();
  const p=engine.prepareChoice(row.state,{requestId:'one-decision',choiceId:row.state.currentScene.choices.find(c=>c.id.endsWith(':c:accept')).id});
  const outcomes=await Promise.allSettled([archive.commitEvent({expectedArchiveId:row.archiveId,expectedRevision:row.state.revision,pending:p}),other.commitEvent({expectedArchiveId:row.archiveId,expectedRevision:row.state.revision,pending:p})]);
  const after=await archive.load(),oldSession=createLiveSession({archive:await open('events-race'),client:{}});await oldSession.load();
  await format.importLiveArchive(format.exportLiveArchive(archive),archive);const imported=await archive.load();
  const oldChoice=after.state.currentScene.choices[0],stale=await oldSession.choose({choiceId:oldChoice.id,baseRevision:after.state.revision,stateHash:identity.stateHash(after.state)});
  return {fulfilled:outcomes.filter(o=>o.status==='fulfilled').length,after,imported,stale,final:await archive.load()};
 });
 assert.equal(result.error,undefined,result.error);assert.equal(result.fulfilled,1);assert.equal(result.after.state.revision,2);assert.equal(result.after.pending,null);
 assert.notEqual(result.after.archiveId,result.imported.archiveId);assert.equal(result.stale.errorCode,'ARCHIVE_CONFLICT');assert.deepEqual(result.final.state,result.imported.state);
});

test('native event persistence abort keeps state, pending, history and resources intact',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js');
  const archive=await open('events-abort'),session=createLiveSession({archive,client:{}});
  const row=await session.startNew({runId:'events-abort',seed:42,engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1},null);
  if(!row.state||typeof archive.commitEvent!=='function')return {error:row.errorCode??'commitEvent missing'};
  const p=engine.prepareChoice(row.state,{requestId:'accept',choiceId:row.state.currentScene.choices.find(c=>c.id.endsWith(':c:accept')).id});
  const original=archive._writeMemory;archive._writeMemory=()=>{throw Error('injected abort');};
  let failed=false;try{await archive.commitEvent({expectedArchiveId:row.archiveId,expectedRevision:1,pending:p});}catch{failed=true;}finally{archive._writeMemory=original;}
  const after=await archive.load(),history=await archive.readHistory(after.state.runId);
  return {before:row,after,historyLength:history.entries.length,failed};
 });
 assert.equal(result.error,undefined,result.error);assert.equal(result.failed,true);assert.deepEqual(result.after.state,result.before.state);assert.equal(result.after.pending,null);assert.equal(result.historyLength,1);
});

test('optional prose never blocks rule choices and a delayed response cannot attach to another revision',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js');
  const archive=await open('events-prose');let complete,calls=0;
  const client={async capabilities(){return {available:true,proseVersion:1};},async createSession(){return {sessionRef:'prose-session'};},requestProse(brief,attempt){calls++;return new Promise(resolve=>{complete=()=>resolve({status:'ready',requestId:brief.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,prose:{text:'晚风拂过外院。',sourceHash:brief.sourceHash}});});}};
  const session=createLiveSession({archive,client}),row=await session.startNew({runId:'events-prose',seed:42,engineVersion:7,originStories:true,eventVersion:1},null);
  if(typeof session.expandProse!=='function')return {error:'expandProse missing'};
  const waiting=session.expandProse();
  while(!complete)await new Promise(resolve=>setTimeout(resolve,0));
  const during=session.view(),choice=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:accept'));
  const advanced=await session.choose({choiceId:choice.id,baseRevision:1,stateHash:identity.stateHash(row.state)});
  complete();await waiting;const after=session.view();
  return {calls,during,advanced,after,saved:await archive.load()};
 });
 assert.equal(result.error,undefined,result.error);assert.equal(result.calls,1);assert.equal(result.during.busy,false);assert.equal(result.during.pending,null);assert.equal(result.during.prose.status,'loading');
 assert.equal(result.advanced.state.revision,2);assert.equal(result.after.prose,null);assert.deepEqual(result.saved.state,result.advanced.state);
});

test('event death and rebirth stay offline, preserve the event birth contract and spend a claim once',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),{buildRebirthOptions}=await import('/src/game/cultivation/live/reincarnation.js');
  const archive=await open('events-rebirth'),session=createLiveSession({archive,client:{}});
  let row=await session.startNew({runId:'events-parent',seed:42,engineVersion:7,originStories:true,eventVersion:1},null);
  const pick=async key=>{const c=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));if(!c)throw Error('missing '+key);row=await session.choose({choiceId:c.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});if(row.errorCode)throw Error(row.errorCode);};
  for(const key of ['decline','journey-menu','river-book','river-open','deliberate','policy-0','next-case','river-open','clue-1','river-back','train-menu'])await pick(key);
  let count=0;
  while(row.state.phase!=='dead'&&count++<100){await pick('practice');if(row.state.phase==='dead')break;await pick('train-menu');if(row.state.life.cultivationProfile.spirit<40||row.state.life.injury>1){await pick('rest-menu');await pick('recover');if(row.state.phase!=='dead')await pick('train-menu');}}
  const parent=await archive.load(),options=buildRebirthOptions(parent.state,[]);
  const child=await session.reincarnate({runId:'events-child',seed:7,name:'来者'},[],parent.archiveId);
  const parentAfter=await archive.load('events-parent');
  const again=await session.reincarnate({runId:'events-child-again',seed:8},[],parent.archiveId);
  return {parent,options,child,parentAfter,again};
 });
 assert.equal(result.parent.state.phase,'dead');assert.equal(result.options.eventVersion,1);assert.equal(result.child.errorCode,null,JSON.stringify(result.child));
 assert.equal(result.child.state.phase,'active');assert.equal(result.child.state.events.node,'arrival');assert.equal(result.child.state.life.birth.cultivationProfile.eventVersion,1);assert.equal(result.parentAfter.reincarnatedTo,'events-child');
 assert.ok(result.again.errorCode);assert.equal(result.again.state.runId,'events-child');
 assert.deepEqual(result.child.state.events.river,{record:'0',seen:2});
 assert.equal(result.child.state.events.entry,'unresolved');
 assert.equal(result.child.state.life.items.herbs??0,0);
});
