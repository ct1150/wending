import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapSession, migrateSession, persistSession, recoverLegacySession } from '../src/ui/session.js';
import { createGame, act } from '../src/game/engine.js';
import { createJourney, chooseJourney } from '../src/game/journey/engine.js';
import { SAVE_KEY, LEGACY_BACKUP_KEY, readLegacyBackup } from '../src/game/persistence.js';
import { serializeGame } from '../src/game/save-format.js';

function storage(raw=null) {
 const entries=new Map(raw===null?[]:[[SAVE_KEY,raw]]);
 return {entries,writes:0,fail:null,getItem(key){if(this.fail?.('get',key))throw Error('read denied');return entries.get(key)??null;},setItem(key,value){if(this.fail?.('set',key))throw Error('quota');this.writes++;entries.set(key,value);},removeItem(key){if(this.fail?.('remove',key))throw Error('remove denied');this.writes++;entries.delete(key);}};
}
const saves=async s=>(await import('../src/game/journey-saves.js')).createJourneySaves(s);
const raw=seed=>JSON.stringify(createJourney({seed}),null,2);

test('title bootstrap with no save neither creates a life nor writes storage',()=>{
 const s=storage(),session=bootstrapSession(s,{createFresh:false});
 assert.equal(session.status,'empty');assert.equal(session.state,null);assert.equal(s.writes,0);
});
test('offline library preserves exact source bytes, deduplicates, and restores both alive journeys',async()=>{
 const a=raw('a'),b=raw('b'),s=storage(a),library=await saves(s);
 const first=library.preserve(bootstrapSession(s));assert.equal(library.preserve(bootstrapSession(s)).id,first.id);
 s.setItem(SAVE_KEY,b);const second=library.preserve(bootstrapSession(s));
 assert.equal(library.list().length,2);assert.notEqual(first.id,second.id);
 const restored=library.restore(first.id,bootstrapSession(s));
 assert.equal(s.getItem(SAVE_KEY),a);assert.deepEqual(restored.state,JSON.parse(a));
 library.restore(second.id,restored);assert.equal(s.getItem(SAVE_KEY),b);
 assert.equal(library.list().length,2);
});
test('legacy handoff bytes travel with their original life and disappear when switching to a life without them',async()=>{
 const legacy=JSON.stringify(createGame({seed:'legacy'}),null,1),s=storage(legacy);
 const backup=JSON.stringify({originalRaw:legacy,previousRaw:legacy,currentRaw:legacy,checkpointRaw:null,preparedRaw:null},null,2);
 s.setItem(LEGACY_BACKUP_KEY,backup);const library=await saves(s),first=library.preserve(bootstrapSession(s));
 s.setItem(SAVE_KEY,raw('modern'));s.removeItem(LEGACY_BACKUP_KEY);const second=library.preserve(bootstrapSession(s));
 library.restore(first.id,bootstrapSession(s));assert.equal(s.getItem(SAVE_KEY),legacy);assert.equal(s.getItem(LEGACY_BACKUP_KEY),backup);
 library.restore(second.id,bootstrapSession(s));assert.equal(s.getItem(LEGACY_BACKUP_KEY),null);
});
test('failed reads, preservation writes and active replacement retain original active bytes',async()=>{
 for(const failure of ['read-library','preserve','replace','backup']){
  const s=storage(raw('a')),library=await saves(s),destination=library.preserve(bootstrapSession(s));
  const current=raw('b');s.setItem(SAVE_KEY,current);const session=bootstrapSession(s);
  s.fail=(op,key)=>failure==='read-library'?op==='get'&&key.includes('journeys'):failure==='preserve'?op==='set'&&key.includes('journeys'):failure==='replace'?op==='set'&&key===SAVE_KEY:op==='remove'&&key===LEGACY_BACKUP_KEY;
  assert.throws(()=>library.restore(destination.id,session),undefined,failure);
  assert.equal(s.entries.get(SAVE_KEY),current,failure);
  s.fail=null;assert.deepEqual(bootstrapSession(s).state,JSON.parse(current));
 }
});
test('unknown destination, corrupt active life and stale session cannot replace the active life',async()=>{
 const s=storage(raw('a')),library=await saves(s),old=bootstrapSession(s),a=library.preserve(old);
 assert.throws(()=>library.restore('missing',old));assert.equal(s.getItem(SAVE_KEY),old.storageRaw);
 s.setItem(SAVE_KEY,raw('b'));assert.throws(()=>library.restore(a.id,old),/CONFLICT/);
 s.setItem(SAVE_KEY,'{broken');assert.throws(()=>library.restore(a.id,bootstrapSession(s)));assert.equal(s.getItem(SAVE_KEY),'{broken');
});
test('unsaved playable state and its previous exact storage bytes are both retained',async()=>{
 const original=raw('old'),s=storage(original),library=await saves(s);
 const session={...bootstrapSession(s),state:createJourney({seed:'unsaved'}),saved:false};
 const id=library.preserve(session).id;
 s.setItem(SAVE_KEY,raw('other'));
 const restored=library.restore(id,bootstrapSession(s));
 assert.equal(serializeGame(restored.state),serializeGame(session.state));
 assert.ok([...s.entries.values()].some(value=>value.includes(JSON.stringify(original))), 'exact prior bytes remain in the library record');
});
test('prepared legacy migration survives switching without redrawing its handoff',async()=>{
 const ended=act(createGame({seed:'handoff'}),{type:'retire'}),original=JSON.stringify(ended,null,2),s=storage(original);
 s.fail=(op,key)=>op==='set'&&key===SAVE_KEY;
 const pending=migrateSession(bootstrapSession(s),{choiceId:'new-life',seed:1},s);
 assert.ok(pending.legacyBackup?.preparedRaw);assert.equal(pending.saved,false);
 s.fail=null;const library=await saves(s),entry=library.preserve(bootstrapSession(s)),backup=s.getItem(LEGACY_BACKUP_KEY);
 s.setItem(SAVE_KEY,raw('other'));s.removeItem(LEGACY_BACKUP_KEY);
 const restored=library.restore(entry.id,bootstrapSession(s));
 assert.equal(s.getItem(SAVE_KEY),original);assert.equal(s.getItem(LEGACY_BACKUP_KEY),backup);assert.equal(restored.legacyBackup.preparedRaw,pending.legacyBackup.preparedRaw);
 const completed=migrateSession(restored,{choiceId:'new-life',seed:999},s);
 assert.equal(completed.saved,true);assert.equal(serializeGame(completed.state),pending.legacyBackup.preparedRaw);
});
test('failed active write rolls back exact legacy handoff; unverified preservation cannot replace current',async()=>{
 const s=storage(raw('destination')),library=await saves(s),destination=library.preserve(bootstrapSession(s));
 const old=JSON.stringify(createGame({seed:'rollback'}),null,2),backup=JSON.stringify({originalRaw:old,previousRaw:old,currentRaw:old,checkpointRaw:null,preparedRaw:null},null,1);
 s.setItem(SAVE_KEY,old);s.setItem(LEGACY_BACKUP_KEY,backup);const current=bootstrapSession(s);
 s.fail=(op,key)=>op==='set'&&key===SAVE_KEY;
 assert.throws(()=>library.restore(destination.id,current));assert.equal(s.entries.get(SAVE_KEY),old);assert.equal(s.entries.get(LEGACY_BACKUP_KEY),backup);
 s.fail=null;
 const active=raw('unverified');s.setItem(SAVE_KEY,active);s.removeItem(LEGACY_BACKUP_KEY);
 let written=false;const originalSet=s.setItem;s.setItem=function(key,value){originalSet.call(this,key,value);if(key.includes('journeys'))written=true;};
 s.fail=(op,key)=>written&&op==='get'&&key.includes('journeys');
 assert.throws(()=>library.restore(destination.id,bootstrapSession(s)));assert.equal(s.entries.get(SAVE_KEY),active);
});
test('an in-memory handoff whose backup write failed is preserved before leaving that life',async()=>{
 const old=JSON.stringify(act(createGame({seed:'memory-handoff'}),{type:'retire'})),s=storage(old);
 s.fail=(op,key)=>op==='set'&&key===LEGACY_BACKUP_KEY;
 const pending=migrateSession(bootstrapSession(s),{choiceId:'new-life',seed:41},s);
 assert.ok(pending.legacyBackup.preparedRaw);assert.equal(s.entries.get(LEGACY_BACKUP_KEY),undefined);
 s.fail=null;const library=await saves(s),entry=library.preserve(pending);
 s.setItem(SAVE_KEY,raw('other'));
 const restored=library.restore(entry.id,bootstrapSession(s));
 assert.equal(restored.legacyBackup.preparedRaw,pending.legacyBackup.preparedRaw);
 const completed=migrateSession(restored,{choiceId:'new-life',seed:99},s);
 assert.equal(serializeGame(completed.state),pending.legacyBackup.preparedRaw);
});
test('unreadable primary saves retain exact raw strings independently from playable journeys',async()=>{
 const corrupt=' \n{broken 主存档\t',backup='also broken\n',s=storage(corrupt),library=await saves(s);
 s.setItem(LEGACY_BACKUP_KEY,backup);const blocked=bootstrapSession(s);
 assert.equal(blocked.status,'blocked');assert.throws(()=>library.preserve(blocked));
 const preserved=library.preserveUnreadable(blocked);
 assert.deepEqual(preserved,{id:preserved.id,raw:corrupt,backupRaw:backup});assert.equal(library.preserveUnreadable(blocked).id,preserved.id);
 assert.equal(s.getItem(SAVE_KEY),corrupt);assert.equal(s.getItem(LEGACY_BACKUP_KEY),backup);assert.deepEqual(library.list(),[]);
 const second='second invalid save';s.setItem(SAVE_KEY,second);s.removeItem(LEGACY_BACKUP_KEY);
 const another=library.preserveUnreadable(bootstrapSession(s));assert.notEqual(another.id,preserved.id);
 assert.deepEqual(library.listUnreadable(),[preserved,{id:another.id,raw:second,backupRaw:null}]);
 s.setItem(SAVE_KEY,raw('confirmed-import'));assert.equal(bootstrapSession(s).status,'loaded');assert.deepEqual(library.listUnreadable(),[preserved,another]);
});
test('a corrupt legacy backup can be preserved exactly without admitting it to the playable library',async()=>{
 const primary=JSON.stringify(createGame({seed:'bad-backup'}),null,2),backup='\n{bad legacy handoff  ',s=storage(primary),library=await saves(s);
 s.setItem(LEGACY_BACKUP_KEY,backup);const session=bootstrapSession(s);assert.ok(session.backupError);assert.throws(()=>library.preserve(session));
 const entry=library.preserveUnreadable(session);assert.deepEqual(entry,{id:entry.id,raw:primary,backupRaw:backup});
 assert.equal(s.getItem(SAVE_KEY),primary);assert.equal(s.getItem(LEGACY_BACKUP_KEY),backup);assert.deepEqual(library.list(),[]);
});
test('raw recovery refuses read failures, quota failures, verification failures and stale sessions before replacement',async()=>{
 for(const failure of ['primary-read','backup-read','library-read','quota','verification','stale']){
  const primary='{corrupt source',backup='bad backup',s=storage(primary),library=await saves(s);s.setItem(LEGACY_BACKUP_KEY,backup);const session=bootstrapSession(s);
  let wrote=false;const set=s.setItem;s.setItem=function(key,value){set.call(this,key,value);if(key.includes('unreadable'))wrote=true;};
  if(failure==='stale')s.setItem(SAVE_KEY,'changed externally');
  s.fail=(op,key)=>failure==='primary-read'?op==='get'&&key===SAVE_KEY:failure==='backup-read'?op==='get'&&key===LEGACY_BACKUP_KEY:failure==='library-read'?op==='get'&&key.includes('unreadable'):failure==='quota'?op==='set'&&key.includes('unreadable'):failure==='verification'?wrote&&op==='get'&&key.includes('unreadable'):false;
  assert.throws(()=>library.preserveUnreadable(session),failure==='stale'?/CONFLICT/:failure==='quota'?/quota/:/read denied/,failure);
  assert.equal(s.entries.get(SAVE_KEY),failure==='stale'?'changed externally':primary,failure);assert.equal(s.entries.get(LEGACY_BACKUP_KEY),backup,failure);
 }
});
test('raw recovery is independent of corrupt playable metadata and verifies bytes rather than a successful write return',async()=>{
 const s=storage(''),library=await saves(s);s.setItem(`${SAVE_KEY}-journeys`,'broken metadata');
 const session=bootstrapSession(s);const entry=library.preserveUnreadable(session);assert.equal(entry.raw,'');assert.equal(s.getItem(SAVE_KEY),'');assert.throws(()=>library.preserve(session));
 s.setItem(SAVE_KEY,'different corrupt bytes');const next=bootstrapSession(s),set=s.setItem;
 s.setItem=function(key,value){if(key.includes('unreadable'))return;return set.call(this,key,value);};
 assert.throws(()=>library.preserveUnreadable(next),/PRESERVE_FAILED/);assert.deepEqual(library.listUnreadable(),[entry]);assert.equal(s.getItem(SAVE_KEY),'different corrupt bytes');
});
test('a stale tab cannot supersede another tab\'s durable prepared migration when primary bytes did not change',async()=>{
 const s=storage(raw('destination')),library=await saves(s),destination=library.preserve(bootstrapSession(s));
 const original=JSON.stringify(act(createGame({seed:'two-tab-handoff'}),{type:'retire'}),null,2);
 const oldBackup=JSON.stringify({originalRaw:original,previousRaw:original,currentRaw:original,checkpointRaw:null,preparedRaw:null},null,2);
 s.setItem(SAVE_KEY,original);s.setItem(LEGACY_BACKUP_KEY,oldBackup);const stale=bootstrapSession(s),other=bootstrapSession(s);
 s.fail=(op,key)=>op==='set'&&key===SAVE_KEY;const prepared=migrateSession(other,{choiceId:'new-life',seed:12},s);s.fail=null;
 const durable=s.getItem(LEGACY_BACKUP_KEY);assert.ok(JSON.parse(durable).preparedRaw);assert.equal(s.getItem(SAVE_KEY),original);
 assert.throws(()=>library.preserve(stale),/CONFLICT/);assert.throws(()=>library.restore(destination.id,stale),/CONFLICT/);assert.throws(()=>library.preserveUnreadable(stale),/CONFLICT/);
 assert.equal(s.getItem(SAVE_KEY),original);assert.equal(s.getItem(LEGACY_BACKUP_KEY),durable);
 const retained=library.preserve(bootstrapSession(s));s.setItem(SAVE_KEY,raw('other'));s.removeItem(LEGACY_BACKUP_KEY);
 const restored=library.restore(retained.id,bootstrapSession(s));assert.equal(restored.legacyBackup.preparedRaw,prepared.legacyBackup.preparedRaw);
});
test('an orphan legacy handoff refuses restore while keeping its sole exact copy',async()=>{
 const s=storage(raw('destination')),library=await saves(s),destination=library.preserve(bootstrapSession(s));
 const old=JSON.stringify(createGame({seed:'orphan'})),backup=JSON.stringify({originalRaw:old,previousRaw:old,currentRaw:old,checkpointRaw:null,preparedRaw:null},null,2);
 s.removeItem(SAVE_KEY);s.setItem(LEGACY_BACKUP_KEY,backup);const empty=bootstrapSession(s,{createFresh:false}),writes=s.writes;
 assert.equal(empty.status,'empty');assert.throws(()=>library.preserve(empty),/ORPHANED_BACKUP/);assert.throws(()=>library.restore(destination.id,empty),/ORPHANED_BACKUP/);
 assert.equal(s.getItem(SAVE_KEY),null);assert.equal(s.getItem(LEGACY_BACKUP_KEY),backup);assert.equal(s.writes,writes);
 const recovered=library.preserveUnreadable(empty);assert.deepEqual(recovered,{id:recovered.id,raw:null,backupRaw:backup});assert.deepEqual(library.listUnreadable(),[recovered]);
 const restored=library.restore(destination.id,empty);assert.equal(restored.status,'loaded');assert.equal(s.getItem(LEGACY_BACKUP_KEY),null);assert.deepEqual(library.listUnreadable(),[recovered]);
});
test('a modern primary with an unreadable retained handoff has an exact raw-only recovery path',async()=>{
 const primary=raw('modern-corrupt-handoff'),backup=' \n{bad modern handoff\t',s=storage(primary),library=await saves(s);s.setItem(LEGACY_BACKUP_KEY,backup);
 const session=bootstrapSession(s);assert.equal(session.status,'loaded');assert.equal(session.backupError,undefined);assert.throws(()=>library.preserve(session));
 const entry=library.preserveUnreadable(session);assert.deepEqual(entry,{id:entry.id,raw:primary,backupRaw:backup});assert.deepEqual(library.list(),[]);
 assert.equal(s.getItem(SAVE_KEY),primary);assert.equal(s.getItem(LEGACY_BACKUP_KEY),backup);
 s.setItem(SAVE_KEY,raw('changed-modern'));assert.throws(()=>library.preserveUnreadable(session),/CONFLICT/);
});
test('a failed own handoff write from an existing backup retains the prepared target and exact source identity',async()=>{
 const original=JSON.stringify(act(createGame({seed:'own-backup-source'}),{type:'retire'})),s=storage(original),library=await saves(s);
 const oldBackup=JSON.stringify({originalRaw:original,previousRaw:original,currentRaw:original,checkpointRaw:null,preparedRaw:null},null,2);s.setItem(LEGACY_BACKUP_KEY,oldBackup);
 s.fail=(op,key)=>op==='set'&&key===LEGACY_BACKUP_KEY;
 const pending=migrateSession(bootstrapSession(s),{choiceId:'new-life',seed:73},s);assert.ok(pending.legacyBackup.preparedRaw);assert.equal(pending.storageBackupRaw,oldBackup);s.fail=null;
 const preserved=library.preserve(pending);assert.equal(s.getItem(LEGACY_BACKUP_KEY),oldBackup);
 s.setItem(SAVE_KEY,raw('other'));s.removeItem(LEGACY_BACKUP_KEY);
 const restored=library.restore(preserved.id,bootstrapSession(s));assert.equal(restored.legacyBackup.preparedRaw,pending.legacyBackup.preparedRaw);
 assert.equal(serializeGame(migrateSession(restored,{choiceId:'new-life',seed:999},s).state),pending.legacyBackup.preparedRaw);
});
test('an ordinary choice from stale offline A cannot overwrite newly committed B shared by two sessions',async()=>{
 const original=raw('tab-a'),s=storage(original),library=await saves(s),tabA=bootstrapSession(s),tabB=bootstrapSession(s);
 library.preserve(tabB);
 const bornB=persistSession({...tabB,status:'fresh',state:createJourney({seed:'tab-b'}),saved:false},s);assert.equal(bornB.saved,true);
 const durableB=s.getItem(SAVE_KEY),chosenA=chooseJourney(tabA.state,{revision:0,sceneId:'mortal-entry',choiceId:'catch-child'}).state,writes=s.writes;
 const stale=persistSession({...tabA,state:chosenA},s);
 assert.equal(stale.saved,false);assert.match(stale.error,/其他页面/);assert.equal(s.getItem(SAVE_KEY),durableB);assert.equal(s.writes,writes);
 assert.equal(serializeGame(stale.state),serializeGame(chosenA));assert.equal(stale.storageRaw,original);assert.equal(library.list().length,1);
 assert.equal(persistSession(stale,s).saved,false);assert.equal(s.getItem(SAVE_KEY),durableB);
});
test('ordinary legacy saves and migration retries cannot overwrite a handoff prepared by another session',async()=>{
 const original=JSON.stringify(act(createGame({seed:'stale-write-handoff'}),{type:'retire'})),s=storage(original),old=bootstrapSession(s),other=bootstrapSession(s);
 s.fail=(op,key)=>op==='set'&&key===SAVE_KEY;const prepared=migrateSession(other,{choiceId:'new-life',seed:11},s);s.fail=null;
 const durable=s.getItem(LEGACY_BACKUP_KEY),writes=s.writes;
 const saved=persistSession(old,s),migrated=migrateSession(old,{choiceId:'new-life',seed:99},s);
 assert.equal(saved.saved,false);assert.equal(migrated.saved,false);assert.match(saved.error,/其他页面/);assert.match(migrated.error,/其他页面/);
 assert.equal(s.getItem(SAVE_KEY),original);assert.equal(s.getItem(LEGACY_BACKUP_KEY),durable);assert.equal(s.writes,writes);assert.equal(JSON.parse(durable).preparedRaw,prepared.legacyBackup.preparedRaw);
});
test('legacy recovery and prepared migration never replace a primary switched by another session',async()=>{
 for(const operation of ['recover','migrate']){
  const initial=operation==='recover'?createGame({seed:'recover-source'}):act(createGame({seed:'migrate-source'}),{type:'retire'}),s=storage(JSON.stringify(initial));
  s.fail=(op,key)=>op==='set'&&key===SAVE_KEY;
  if(operation==='recover')persistSession({...bootstrapSession(s),state:act(initial,{type:'explore'})},s);
  else migrateSession(bootstrapSession(s),{choiceId:'new-life',seed:3},s);
  s.fail=null;const pending=bootstrapSession(s);assert.ok(operation==='recover'?pending.pendingLegacyRaw:pending.legacyBackup.preparedRaw);
  const replacement=raw('replacement-'+operation);s.setItem(SAVE_KEY,replacement);const backup=s.getItem(LEGACY_BACKUP_KEY),writes=s.writes;
  const result=operation==='recover'?recoverLegacySession(pending,s):migrateSession(pending,{choiceId:'new-life',seed:9},s);
  assert.equal(result.saved,false);assert.match(result.error,/其他页面/);assert.equal(s.getItem(SAVE_KEY),replacement);assert.equal(s.getItem(LEGACY_BACKUP_KEY),backup);assert.equal(s.writes,writes);
 }
});
test('intentional legacy import uses current primary for stale checks and imported bytes for its handoff lineage across retry',async()=>{
 const modern=raw('current-modern'),imported=createGame({seed:'imported-legacy'}),original=JSON.stringify(imported,null,2),s=storage(modern);
 const importing={status:'fresh',state:imported,storageRaw:modern,storageBackupRaw:null,originalLegacyRaw:original,rawCorruptSave:null,error:'',saved:false};
 s.fail=(op,key)=>op==='set'&&key===SAVE_KEY;const failed=persistSession(importing,s);assert.equal(failed.saved,false);assert.equal(s.getItem(SAVE_KEY),modern);
 const handoff=readLegacyBackup(s);assert.equal(handoff.originalRaw,original);assert.equal(handoff.previousRaw,original);
 s.fail=null;const retried=persistSession(failed,s);assert.equal(retried.saved,true);assert.deepEqual(bootstrapSession(s).state,imported);assert.equal(readLegacyBackup(s).originalRaw,original);
});
