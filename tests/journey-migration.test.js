import test from 'node:test';
import assert from 'node:assert/strict';
import * as migration from '../src/game/journey/migration.js';
import { createGame, act, serialize, deserialize, selectLegacy } from '../src/game/engine.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';

const ended=()=>act(createGame({seed:6} ),{type:'retire'});
test('legacy bridge exists only after settled life and unresolved rewards stay explicit',()=>{
 assert.equal(typeof migration.getLegacyBridgeChoices,'function');
 assert.deepEqual(migration.getLegacyBridgeChoices(createGame()),[]);
 assert.throws(()=>migration.migrateLegacyLife(createGame(),{choiceId:'new-life',seed:1}));
 const old=ended(); const next=migration.migrateLegacyLife(old,{choiceId:'new-life',seed:1});
 assert.equal(next.world.generation,old.meta.generation+1); assert.equal(next.world.year,old.meta.worldYear+16);
 assert.deepEqual(next.world.legacyArchive.meta,old.meta);
 assert.deepEqual(next.world.biography,old.meta.history);
 assert.deepEqual(deserializeGame(serializeGame(next)),next);
});
test('both genuinely carried legacy identities remain available even with the same mapped method',()=>{
 let base=createGame({seed:1}); base.meta.legacyIds=['valley-seed','plain-medicine'];
 base.run.selectedLegacies=['valley-seed','plain-medicine'];
 const old=act(base,{type:'retire'}); serialize(old);
 assert.deepEqual(migration.getLegacyBridgeChoices(old).map(x=>x.id),['carry:valley-seed','carry:plain-medicine']);
 const next=migration.migrateLegacyLife(old,{choiceId:'carry:plain-medicine',seed:2});
 assert.equal(next.life.legacyId,'plain-medicine'); assert.deepEqual(next.world.legacies,old.meta.legacyIds);
 assert.deepEqual(next.life.abilities,[]); assert.deepEqual(next.life.items,{});
});

import * as sessions from '../src/ui/session.js';
import { SAVE_KEY } from '../src/game/persistence.js';
function store(raw) { const values=new Map([[SAVE_KEY,raw]]); return {values,failKey:null,getItem(k){return values.get(k)??null;},setItem(k,v){if(this.failKey===k)throw new Error('quota');values.set(k,v);}}; }
test('exact v1 original survives first normalized write and refresh before terminal conversion',()=>{
 const old=createGame({seed:5}); old.version=1; delete old.story;delete old.meta.storyWorld;
 const raw=JSON.stringify(old,null,3), storage=store(raw);
 let session=sessions.bootstrapSession(storage);
 session={...session,state:act(session.state,{type:'retire'})};
 session=sessions.persistSession(session,storage);
 assert.equal(session.saved,true);
 session=sessions.bootstrapSession(storage);
 assert.equal(session.originalLegacyRaw,raw);
 assert.equal(typeof sessions.migrateSession,'function');
 const converted=sessions.migrateSession(session,{choiceId:'new-life',seed:3},storage);
 assert.equal(converted.state.version,3);assert.equal(converted.saved,true);
 assert.equal(converted.legacyBackup.originalRaw,raw);
 assert.equal(deserializeGame(converted.legacyBackup.checkpointRaw).phase,'ended');
});
test('failed current replacement keeps recoverable settled checkpoint and one prepared seed across refresh/retry',()=>{
 const old=ended(),raw=serialize(old),storage=store(raw);
 let session=sessions.bootstrapSession(storage);storage.failKey=SAVE_KEY;
 assert.equal(typeof sessions.migrateSession,'function');
 session=sessions.migrateSession(session,{choiceId:'new-life',seed:'only-once'},storage);
 assert.equal(session.state.version,2);assert.equal(storage.values.get(SAVE_KEY),raw);assert.equal(session.saved,false);
 const prepared=session.legacyBackup.preparedRaw;
 session=sessions.bootstrapSession(storage);assert.equal(session.legacyBackup.preparedRaw,prepared);
 storage.failKey=null;
 session=sessions.migrateSession(session,{choiceId:'new-life',seed:'must-not-redraw'},storage);
 assert.equal(serializeGame(session.state),prepared);assert.equal(session.saved,true);
});

import { combatAction, getStats, equipItem } from '../src/game/engine.js';
import { JOURNEY_LEGACIES } from '../src/game/journey/content.js';
import { LEGACIES } from '../src/game/content.js';
import { LEGACY_BACKUP_KEY } from '../src/game/persistence.js';
import { startApp } from './helpers/app-harness.js';
test('ten old identities retain original names/sources and one finite method without reborn bonuses',()=>{
 const mapping={'plain-medicine':'herbalism','valley-seed':'herbalism','golden-furnace':'herbalism','sword-echo':'shelter','city-oath':'shelter','iron-bone':'shelter','tomb-lantern':'soul-lamp','debt-released':'bind-oath','sword-heart':'discern','realm-memory':'burn-life'};
 for(const old of LEGACIES){
  const legacy=JOURNEY_LEGACIES[old.id];assert.equal(legacy.name,old.name);assert.equal(legacy.source,old.source);assert.equal(legacy.abilityId,mapping[old.id]);assert.ok(legacy.description.length>15);
  let source=createGame();source.meta.legacyIds=[old.id];source.run.selectedLegacies=[old.id];source.meta.worldFlags=['soul-debt'];source=act(source,{type:'retire'});
  const next=migration.migrateLegacyLife(source,{choiceId:`carry:${old.id}`,seed:1});
  assert.equal(next.life.legacyId,old.id);assert.deepEqual(next.life.items,{});assert.equal(next.world.facts['legacy-flag-soul-debt'],true);
 }
});
function oldWinner(){
 let ready=createGame({seed:5});ready.run.realmIndex=5;ready.run.hp=getStats(ready).maxHp;ready.meta.proofs=['mortal','nether','celestial'];ready.run.worldId='celestial';ready.run.items.push('star-sword-art','burning-star','ashen-sheath');
 ready=equipItem(equipItem(equipItem(ready,'star-sword-art'),'burning-star',1),'ashen-sheath');
 return act(ready,{type:'finale'});
}
test('real old combat settles under old rules, requires reward selection and migrates victory once',()=>{
 let state=oldWinner();assert.equal(state.phase,'combat');
 const restored=sessions.bootstrapSession(store(serialize(state)));assert.deepEqual(restored.state,state);assert.deepEqual(migration.getLegacyBridgeChoices(state),[]);
 while(state.phase==='combat')state=combatAction(state,'burn');
 assert.equal(state.phase,'victory');assert.ok(state.summary.legacyOptions.length>0);
 assert.deepEqual(migration.getLegacyBridgeChoices(state),[]);assert.throws(()=>migration.migrateLegacyLife(state,{choiceId:'new-life',seed:1}));
 const reward=state.summary.legacyOptions.at(-1);state=selectLegacy(state,reward);
 const choices=migration.getLegacyBridgeChoices(state);assert.equal(choices.length,1);
 const next=migration.migrateLegacyLife(state,{choiceId:choices[0].id,seed:1});
 assert.deepEqual(next.world.biography,state.meta.history);assert.equal(next.world.facts['legacy-victories'],1);
 assert.deepEqual(next.world.proofs,state.meta.proofs);assert.equal(next.world.year,state.meta.worldYear+16);
 assert.equal(next.world.legacyArchive.summary.selectedLegacyId,reward);
});
test('backup quota failure never replaces old current and remains retryable without restarting',()=>{
 const old=ended(),raw=serialize(old),storage=store(raw);storage.failKey=LEGACY_BACKUP_KEY;
 let s=sessions.migrateSession(sessions.bootstrapSession(storage),{choiceId:'new-life',seed:9},storage);
 assert.equal(s.saved,false);assert.equal(s.state.version,2);assert.equal(storage.values.get(SAVE_KEY),raw);
 const prepared=s.legacyBackup.preparedRaw;storage.failKey=null;
 s=sessions.migrateSession(s,{choiceId:'new-life',seed:100},storage);assert.equal(s.saved,true);assert.equal(serializeGame(s.state),prepared);
});
test('the actual app bridge enters the dialogue without setup or a second autosave and keeps old backup export',async()=>{
 const old=ended(),raw=serialize(old),app=await startApp({raw});
 assert.match(app.html,/此生沿旧规继续/);assert.match(app.html,/data-legacy-bridge="new-life"/);
 app.click({legacyBridge:'new-life'});
 const next=deserializeGame(app.storage.raw);assert.equal(next.version,3);assert.equal(app.focus.at(-1),'#journey-current-title');
 assert.equal(app.storage.writes,1);assert.equal(app.storage.writeCounts.get(LEGACY_BACKUP_KEY),1);assert.doesNotMatch(app.html,/dao-name|data-start/);
 app.clickRendered('[data-view="settings"]');app.clickRendered('[data-export-legacy]');
 const blobs=app.downloads.filter(x=>x instanceof Blob);assert.equal(await blobs[0].text(),raw);assert.equal(blobs.length,3);
});

import { chooseStory, getStoryView, reincarnate } from '../src/game/engine.js';
function oldSequel(outcome, sequelChoices){
 let s=createGame({seed:42});
 for(const id of ['enter_help','pledge_truth','ask_permission','route_channel'])s=chooseStory(s,id);
 if(getStoryView(s).sceneId.startsWith('SIDE'))s=chooseStory(s,'leave_side');
 for(const id of ['measure_above','route_ledger'])s=chooseStory(s,id);
 if(getStoryView(s).sceneId.startsWith('SIDE'))s=chooseStory(s,'leave_side');
 for(const id of ['official_archive','copy_accountable','go_confront','public_hearing','carry_rescue','sword_break'])s=chooseStory(s,id);
 if(outcome==='ash_refuge')s=chooseStory(s,'release_now');else {s=chooseStory(s,'stabilize_life');s=chooseStory(s,outcome==='open_clinic'?'choose_clinic':'choose_estate');}
 s=act(s,{type:'retire'});if(s.summary.legacyOptions.length)s=selectLegacy(s,s.summary.legacyOptions[0]);s=reincarnate(s);
 for(const id of sequelChoices)s=chooseStory(s,id);
 s=act(s,{type:'retire'});if(s.summary.legacyOptions.length)s=selectLegacy(s,s.summary.legacyOptions[0]);return s;
}
test('actual settled old sequel records become outcome-specific once-only echoes with original sources intact',()=>{
 for(const [valley,choices,episode,outcome] of [
 ['open_clinic',['accept_patients','triage_urgent','ration_medicine','publish_accounts','settle_clinic'],'mortal-clinic','clinic_rationed'],
 ['sect_estate',['accept_contract','request_workers','public_archive','fixed_minimum','settle_estate'],'mortal-estate','estate_shared_supply'],
 ['ash_refuge',['accept_garden','carry_kept_promise','hire_garden','shared_garden','settle_refuge'],'mortal-refuge','refuge_common_medicine'],
 ]){
  const old=oldSequel(valley,choices),next=migration.migrateLegacyLife(old,{choiceId:migration.getLegacyBridgeChoices(old)[0].id,seed:5});
  assert.equal(next.scene.nodeId,'later-echo');assert.equal(next.world.completedTasks.find(r=>r.episodeId===episode).outcomeId,outcome);
  assert.deepEqual(next.world.legacyArchive.meta.storyWorld.records,old.meta.storyWorld.records);assert.equal(next.world.facts['valley-outcome'],valley);
  assert.equal(next.life.items.testimony??0,0);assert.equal(next.life.items['ledger-page']??0,0);
  for(const [original,id] of Object.entries({shen_zhi:'shen-zhi',lu_huai:'lu-huai',wen_du:'wen-du'}))assert.equal(next.world.people[id].birthYear,old.meta.storyWorld.npcBirthYears[original]);
 }
});

import { pick } from './helpers/journey-routes.js';
import { getJourneyView } from '../src/game/journey/engine.js';
test('legacy combat victory reaches its own truthful recap without claiming native bounded agreements',()=>{
 let old=oldWinner();while(old.phase==='combat')old=combatAction(old,'burn');
 old=selectLegacy(old,old.summary.legacyOptions[0]);
 let next=migration.migrateLegacyLife(old,{choiceId:migration.getLegacyBridgeChoices(old)[0].id,seed:1});
 assert.equal(next.world.facts['ding-complete'],undefined);
 const close={ 'later-refuge':'refuge-unchanged','later-estate':'estate-unchanged','later-clinic':'clinic-rationed' }[next.scene.nodeId];if(close)next=pick(next,close);
 next=pick(next,'continue-journey');
 assert.equal(next.scene.nodeId,'later-legacy-victory');
 assert.match(getJourneyView(next).blocks.at(-1).text,/旧途|旧日.*胜/);
 assert.doesNotMatch(getJourneyView(next).title,/已有其约/);
 assert.equal(next.world.facts['celestial-terms'],undefined);
 assert.equal(next.world.completedTasks.some(r=>r.episodeId==='three-world-ding'),false);
 assert.deepEqual(next.world.biography,old.meta.history);
 assert.deepEqual(getJourneyView(next).choices.map(c=>c.id),['finish-life']);
});
function anotherOldEstate(old,choices){
 let s=reincarnate(old);for(const id of choices)s=chooseStory(s,id);
 s=act(s,{type:'retire'});if(s.summary.legacyOptions.length)s=selectLegacy(s,s.summary.legacyOptions[0]);return s;
}
test('ordered repeated old estate settlements retain achieved supply across earlier and later limited commissions',()=>{
 const graves=['accept_contract','request_graves','only_graves','accept_graves','settle_estate'];
 let old=oldSequel('sect_estate',graves);
 assert.equal(old.story.outcomeId,'estate_grave_access');
 old=anotherOldEstate(old,['accept_contract','request_workers','public_archive','fixed_minimum','settle_estate']);
 assert.equal(old.story.outcomeId,'estate_shared_supply');
 const inspect=source=>{
  const next=migration.migrateLegacyLife(source,{choiceId:migration.getLegacyBridgeChoices(source)[0].id,seed:2});
  const echo=getJourneyView(next).blocks.at(-1).text;
  assert.match(echo,/最低药额/);assert.match(echo,/第二把|双钥匙/);
  assert.doesNotMatch(echo,/药价与供药控制未变/);
  assert.equal(next.world.completedTasks.filter(r=>r.episodeId==='mortal-estate').length,1);
  assert.deepEqual(next.world.legacyArchive.meta.storyWorld.records,source.meta.storyWorld.records);
 };
 inspect(old);old=anotherOldEstate(old,graves);inspect(old);old=anotherOldEstate(old,['leave_estate']);assert.equal(old.story.outcomeId,'estate_unchanged');inspect(old);
 old=anotherOldEstate(old,[]);assert.equal(old.story.outcomeId,'unfinished');inspect(old);
});
test('ordinary old progress and explicit reward survive backup-success/current-failure refresh for explicit recovery',()=>{
 const cases=[
  [createGame({seed:6}),s=>chooseStory(s,'enter_help')],
  [(()=>{let s=oldWinner();while(s.phase==='combat')s=combatAction(s,'burn');return s;})(),s=>selectLegacy(s,s.summary.legacyOptions[0])],
 ];
 for(const [old,advance] of cases){
  const raw=serialize(old),storage=store(raw);let s=sessions.bootstrapSession(storage);
  const newer=advance(s.state);storage.failKey=SAVE_KEY;s=sessions.persistSession({...s,state:newer},storage);
  assert.equal(s.saved,false);const savedBackup=storage.values.get(LEGACY_BACKUP_KEY);
  s=sessions.bootstrapSession(storage);assert.equal(s.saved,false);assert.equal(s.pendingLegacyRaw,serialize(newer));assert.deepEqual(s.state,old);
  const noOverwrite=sessions.persistSession(s,storage);assert.equal(noOverwrite.saved,false);assert.equal(storage.values.get(LEGACY_BACKUP_KEY),savedBackup);
  assert.equal(typeof sessions.recoverLegacySession,'function');
  storage.failKey=null;s=sessions.recoverLegacySession(s,storage);
  assert.equal(s.saved,true);assert.equal(s.pendingLegacyRaw,null);assert.deepEqual(s.state,newer);assert.equal(storage.values.get(SAVE_KEY),serialize(newer));
  assert.equal(s.originalLegacyRaw,raw);
 }
});

test('actual app exposes pending old checkpoint for export and explicit recovery while blocking old actions',async()=>{
 const old=createGame({seed:7}),newer=chooseStory(old,'enter_help'),raw=serialize(old),storage=store(raw);
 storage.failKey=SAVE_KEY;sessions.persistSession({...sessions.bootstrapSession(storage),state:newer},storage);
 const app=await startApp({raw,legacyBackupRaw:storage.values.get(LEGACY_BACKUP_KEY)});
 assert.match(app.html,/data-recover-legacy/);assert.match(app.html,/较新旧人生/);
 assert.equal(app.storage.writes,0);app.click({storyChoice:'enter_help'});assert.equal(app.storage.writes,0);
 app.clickRendered('[data-export-legacy]');const blobs=app.downloads.filter(x=>x instanceof Blob);
 assert.ok((await Promise.all(blobs.map(b=>b.text()))).includes(serialize(newer)));
 app.click({recoverLegacy:''});assert.deepEqual(deserializeGame(app.storage.raw),newer);assert.equal(app.storage.writes,1);assert.doesNotMatch(app.html,/data-recover-legacy/);
});
test('explicit recovery rereads a temporary backup denial and preserves malformed backups without overwrite',()=>{
 const old=createGame({seed:7}),newer=chooseStory(old,'enter_help'),raw=serialize(old),storage=store(raw);
 storage.failKey=SAVE_KEY;sessions.persistSession({...sessions.bootstrapSession(storage),state:newer},storage);storage.failKey=null;
 const read=storage.getItem;let deny=true;storage.getItem=function(key){if(deny&&key===LEGACY_BACKUP_KEY)throw new Error('temporary denied');return read.call(this,key);};
 let s=sessions.bootstrapSession(storage);assert.ok(s.backupError);deny=false;s=sessions.recoverLegacySession(s,storage);assert.equal(s.saved,true);assert.deepEqual(s.state,newer);
 const malformed=JSON.parse(storage.values.get(LEGACY_BACKUP_KEY));malformed.currentRaw='{bad';storage.values.set(LEGACY_BACKUP_KEY,JSON.stringify(malformed));
 const before=storage.values.get(LEGACY_BACKUP_KEY);s=sessions.bootstrapSession(storage);assert.ok(s.backupError);s=sessions.recoverLegacySession(s,storage);
 assert.ok(s.backupError);assert.equal(storage.values.get(LEGACY_BACKUP_KEY),before);assert.deepEqual(deserializeGame(storage.values.get(SAVE_KEY)),newer);
});

test('explicit bridge retry after temporary backup read denial retains the exact earlier v1 original',()=>{
 const old=createGame({seed:8});old.version=1;delete old.story;delete old.meta.storyWorld;
 const original=JSON.stringify(old,null,2),storage=store(original);
 let s=sessions.bootstrapSession(storage);s=sessions.persistSession({...s,state:act(s.state,{type:'retire'})},storage);
 const read=storage.getItem;let deny=true;storage.getItem=function(key){if(deny&&key===LEGACY_BACKUP_KEY)throw new Error('temporary denied');return read.call(this,key);};
 s=sessions.bootstrapSession(storage);assert.ok(s.backupError);deny=false;
 s=sessions.migrateSession(s,{choiceId:'new-life',seed:1},storage);
 assert.equal(s.saved,true);assert.equal(s.legacyBackup.originalRaw,original);
});

test('unknown v1 valley reaches its public native finale without inventing ash, migrants or an old handoff',()=>{
 const source=createGame({seed:6});source.version=1;delete source.story;delete source.meta.storyWorld;
 const old=act(deserialize(JSON.stringify(source)),{type:'retire'});
 assert.equal(old.meta.storyWorld.valleyOutcome,null);
 let state=migration.migrateLegacyLife(old,{choiceId:'new-life',seed:1});
 for(const id of ['continue-journey','shelve-records','freeze-debt','continue-inquest','record-gaps','protect-sources','share-duty','authorize-self','continue-celestial','limit-terms','trial-appeal','deliver-copies','withdraw-ding'])state=pick(state,id);
 assert.equal(state.world.completedTasks.some(row=>row.episodeId==='mortal-handoff'),false);
 assert.doesNotMatch(state.transcript.at(-1).text,/曾留下未认证|旧未认证记录/);
 for(const id of ['repair-mortal','reconsider-ding','shared-method','separate-fire','share-stop-right'])state=pick(state,id);
 assert.equal(state.scene.nodeId,'ding-home');
 const saved=deserializeGame(serializeGame(state));
 assert.equal(saved.world.facts['valley-outcome'],undefined);assert.equal(saved.world.facts['seed-state'],undefined);
 assert.equal(saved.life.facts['unknown-valley'],true);assert.equal(saved.world.legacyArchive.meta.storyWorld.valleyOutcome,null);
 assert.match(saved.transcript.at(-1).text,/未知|缺失/);
 assert.doesNotMatch(saved.transcript.at(-1).text,/故谷仍是灰|迁民|新地种/);
 assert.doesNotMatch(saved.transcript.filter(row=>row.sceneId==='campaign-return').map(row=>row.text).join(''),/曾留下未认证|旧未认证记录/);
 const victory=pick(saved,'return-duty');assert.equal(victory.phase,'victory');
 assert.doesNotMatch(victory.transcript.slice(saved.transcript.length).map(row=>row.text).join(''),/故谷.*灰|迁民|毁种/);
 assert.equal(victory.world.facts['valley-outcome'],undefined);assert.equal(victory.world.facts['seed-state'],undefined);
 assert.deepEqual(deserializeGame(serializeGame(victory)).world.legacyArchive,old);
});

import { legacyAtSize } from './helpers/save-boundaries.js';
test('oversized legacy handoff keeps the exportable old checkpoint without claiming a prepared target exists',()=>{
 const old=act(legacyAtSize(700000),{type:'retire'}),raw=serializeGame(old),storage=store(raw);
 const session=sessions.migrateSession(sessions.bootstrapSession(storage),{choiceId:'new-life',seed:1},storage);
 assert.equal(session.saved,false);assert.equal(session.state.version,2);assert.deepEqual(session.state,old);
 assert.match(session.error,/存档.*(长度|字符|上限)/);assert.doesNotMatch(session.error,/准备的新人生仍可导出/);
 assert.equal(session.legacyBackup?.preparedRaw,undefined);assert.equal(storage.values.get(SAVE_KEY),raw);
 assert.equal(storage.values.has(LEGACY_BACKUP_KEY),false);assert.deepEqual(deserializeGame(serializeGame(session.state)),old);
});
