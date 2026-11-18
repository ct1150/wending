import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaytestDiary} from '../src/ui/playtest-diary.js';
import {liveBrowser} from './helpers/live-browser.js';

function fixture(){
 const map=new Map(),storage={get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let time=0,next=0;
 const make=()=>createPlaytestDiary({storage:()=>storage,clock:()=>time,wall:()=>100000+time,id:()=>String(++next)});
 const snapshot={archiveId:'first',state:{events:{},turnId:1,runId:'life',life:{name:'林照',realm:1},phase:'active',currentScene:{title:'山门'}}};
 return {snapshot,make,advance:ms=>{time+=ms;}};
}
test('interrupted checkpoints require review and exclude breaks, totals follow physical archives',()=>{
 const {snapshot,make,advance}=fixture(),a=make();a.start(snapshot,'dev');
 advance(10000);snapshot.state.turnId++;snapshot.state.currentScene.title='渡口';a.tick(snapshot,{activity:true});
 const b=make();assert.equal(b.active,false);assert.deepEqual(b.report().confirmedMsByArchive,{});
 assert.throws(()=>b.review('1',20,'渡口',''));assert.throws(()=>b.review('1',1,'山顶',''));
 b.review('1',2,'渡口','赶潮有趣');assert.throws(()=>b.review('1',0,'山门',''));
 snapshot.archiveId='copy';b.start(snapshot,'dev');advance(6000);snapshot.state.phase='dead';assert.equal(b.tick(snapshot),true);
 b.review('2',0,'渡口','');const report=b.report();
 assert.deepEqual(report.confirmedMsByArchive,{first:8000,copy:6000});
 assert.deepEqual(report.segments[1].sections,[{title:'山门',ms:10000},{title:'渡口',ms:0}]);
 assert.equal(report.segments[0].stop,'此生已尽');
});
test('idle stops at two minutes, suspended gaps are excluded and replacement lives are separate',()=>{
 const {snapshot,make,advance}=fixture(),d=make();d.start(snapshot,'dev');
 for(let i=0;i<12;i++){advance(10000);d.tick(snapshot);}
 assert.equal(d.active,false);assert.equal(d.records()[0].foregroundMs,120000);
 d.start(snapshot,'dev');advance(31000);d.tick(snapshot,{activity:true});
 assert.equal(d.records()[0].foregroundMs,0);assert.equal(d.records()[0].stop,'页面挂起');
 d.start(snapshot,'dev');advance(1000);snapshot.archiveId='other';d.tick(snapshot);
 assert.equal(d.records()[0].archiveId,'first');assert.equal(d.records()[0].stop,'已更换人生');
});
test('mobile diary starts by consent, prevents duplicate timing and exports confirmed feedback without changing a turn',async t=>{
 const {page}=await liveBrowser(t);await page.setViewportSize({width:360,height:760});
 let calls=0;page.on('request',req=>{if(req.url().includes('/api/story/'))calls++;});
 const click=sel=>page.locator(sel).first().click({timeout:6000});
 const choices=page.locator('[data-live-choice]:enabled');
 const identity=async()=>choices.first().getAttribute('data-state-hash');
 const settings=async()=>{await click('[data-view="settings"]');await click('[data-diary-open]');};
 const lockFree=()=>page.evaluate(()=>navigator.locks.request('wending-playtest-recorder',{ifAvailable:true},lock=>Boolean(lock)));
 await click('[data-title-new]');await click('[data-live-start]');await choices.first().waitFor();
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('wending-playtest-')).length),0);
 const before=await identity();await settings();await click('[data-diary-start]');await page.locator('[data-diary-stop]').waitFor();
 assert.equal(await lockFree(),false);assert.equal(await identity(),before);
 await choices.first().click();await page.waitForFunction(h=>document.querySelector('[data-live-choice]:enabled')?.dataset.stateHash!==h,before);
 const after=await identity();assert.ok(after);await click('[data-diary-stop]');await click('[data-diary-review]');
 await page.locator('#diary-note').fill('渡口的去向很清楚');await click('[data-diary-save]');
 await page.getByText(/已确认.*渡口的去向很清楚/).last().waitFor();assert.equal(await lockFree(),true);
 const [download]=await Promise.all([page.waitForEvent('download'),click('[data-diary-export]')]);
 const stream=await download.createReadStream();let json='';for await(const chunk of stream)json+=chunk;
 const report=JSON.parse(json),row=report.segments[0];assert.ok(row.foregroundMs>0);assert.equal(row.review.comment,'渡口的去向很清楚');
 assert.equal(report.confirmedMsByArchive[row.archiveId],row.foregroundMs);
 await click('[data-close-dialog]');assert.equal(await identity(),after);
 await settings();await click('[data-diary-start]');await click('[data-diary-stop]');
 await click('[data-diary-start]');await page.locator('[data-diary-stop]').waitFor();
 await page.reload();await choices.first().waitFor();assert.equal(await page.locator('[data-diary-stop]').count(),0);
 assert.equal(await identity(),after);await settings();await page.getByText(/待核对/).first().waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(calls,0);
});
