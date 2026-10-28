import { SAVE_KEY, LEGACY_BACKUP_KEY, readLegacyBackup } from './persistence.js';
import { serializeGame, deserializeGame } from './save-format.js';
import { bootstrapSession } from '../ui/session.js';

export const JOURNEY_SAVES_KEY = `${SAVE_KEY}-journeys`;
export const UNREADABLE_SAVES_KEY = `${SAVE_KEY}-unreadable`;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const sameState=(a,b)=>serializeGame(a)===serializeGame(b);

// Each record contains exact storage bytes as well as any newer in-memory
// snapshot. Keeping the two separate also preserves v1 normalization sources.
export function createJourneySaves(storage=globalThis.localStorage) {
 function validate(entry) {
  if(!entry||typeof entry.id!=='string'||typeof entry.raw!=='string'||!(entry.originalRaw===null||typeof entry.originalRaw==='string')||!(entry.backupRaw===null||typeof entry.backupRaw==='string')||!(entry.originalBackupRaw===null||typeof entry.originalBackupRaw==='string'))fail('JOURNEY_INVALID_SAVE');
  const state=deserializeGame(entry.raw);
  if(entry.originalRaw!==null)deserializeGame(entry.originalRaw);
  if(entry.backupRaw!==null)readLegacyBackup({getItem:()=>entry.backupRaw});
  if(entry.originalBackupRaw!==null)readLegacyBackup({getItem:()=>entry.originalBackupRaw});
  const candidate=bootstrapSession({getItem:key=>key===SAVE_KEY?entry.raw:key===LEGACY_BACKUP_KEY?entry.backupRaw:null},{createFresh:false});
  if(candidate.status==='blocked'||candidate.backupError)fail('JOURNEY_INVALID_SAVE');
  return {id:entry.id,state:candidate.state??state};
 }
 function read() {
  const raw=storage.getItem(JOURNEY_SAVES_KEY);
  if(raw===null)return [];
  const data=JSON.parse(raw);
  if(data?.version!==1||!Array.isArray(data.entries))fail('JOURNEY_INVALID_LIBRARY');
  const ids=new Set();
  for(const entry of data.entries){validate(entry);if(ids.has(entry.id))fail('JOURNEY_INVALID_LIBRARY');ids.add(entry.id);}
  return data.entries;
 }
 function capture(session) {
  if(session?.status==='blocked'||session?.backupError)fail('JOURNEY_BLOCKED_SAVE');
  const originalRaw=storage.getItem(SAVE_KEY),originalBackupRaw=storage.getItem(LEGACY_BACKUP_KEY);
  if(session&&Object.hasOwn(session,'storageRaw')&&session.storageRaw!==originalRaw)fail('JOURNEY_STORAGE_CONFLICT');
  if(session&&Object.hasOwn(session,'storageBackupRaw')&&session.storageBackupRaw!==originalBackupRaw)fail('JOURNEY_STORAGE_CONFLICT');
  if(originalRaw!==null)deserializeGame(originalRaw);
  if(originalBackupRaw!==null)readLegacyBackup({getItem:()=>originalBackupRaw});
  if(!session?.state){
   if(originalRaw!==null)fail('JOURNEY_STORAGE_CONFLICT');
   if(originalBackupRaw!==null&&!listUnreadable().some(entry=>entry.raw===null&&entry.backupRaw===originalBackupRaw))fail('JOURNEY_ORPHANED_BACKUP');
   return null;
  }
  // A prepared legacy handoff has two explicit recovery states. Preserve that
  // protocol verbatim rather than flattening it into an ordinary autosave.
  const handoff=session.pendingLegacyRaw||session.legacyBackup?.preparedRaw;
  // A failed handoff-backup write may leave the fixed target only in memory.
  // Preserve that target too, retaining the old backup's exact bytes separately.
  const memoryBackup=session.legacyBackup?JSON.stringify(session.legacyBackup):null;
  if(memoryBackup!==null&&!Object.hasOwn(session,'storageBackupRaw')&&JSON.stringify(originalBackupRaw===null?null:JSON.parse(originalBackupRaw))!==memoryBackup)fail('JOURNEY_STORAGE_CONFLICT');
  const backupRaw=memoryBackup!==null&&JSON.stringify(originalBackupRaw===null?null:JSON.parse(originalBackupRaw))!==memoryBackup?memoryBackup:originalBackupRaw;
  const raw=originalRaw!==null&&(handoff||sameState(deserializeGame(originalRaw),session.state))?originalRaw:serializeGame(session.state);
  return {raw,originalRaw,backupRaw,originalBackupRaw};
 }
 function preserve(session) {
  const snapshot=capture(session);
  if(!snapshot)return null;
  const entries=read();
  const found=entries.find(entry=>entry.raw===snapshot.raw&&entry.originalRaw===snapshot.originalRaw&&entry.backupRaw===snapshot.backupRaw&&entry.originalBackupRaw===snapshot.originalBackupRaw);
  if(found)return validate(found);
  const entry={id:globalThis.crypto.randomUUID(),...snapshot};
  const result=validate(entry),raw=JSON.stringify({version:1,entries:[...entries,entry]});
  storage.setItem(JOURNEY_SAVES_KEY,raw);
  if(storage.getItem(JOURNEY_SAVES_KEY)!==raw)fail('JOURNEY_PRESERVE_FAILED');
  return result;
 }
 function listUnreadable() {
  const raw=storage.getItem(UNREADABLE_SAVES_KEY);
  if(raw===null)return [];
  const data=JSON.parse(raw);
  if(data?.version!==1||!Array.isArray(data.entries))fail('JOURNEY_INVALID_RECOVERY_LIBRARY');
  const ids=new Set();
  for(const entry of data.entries) {
   if(!entry||typeof entry.id!=='string'||!entry.id||!(entry.raw===null||typeof entry.raw==='string')||!(entry.backupRaw===null||typeof entry.backupRaw==='string')||(entry.raw===null&&entry.backupRaw===null)||ids.has(entry.id))fail('JOURNEY_INVALID_RECOVERY_LIBRARY');
   ids.add(entry.id);
  }
  return data.entries.map(({id,raw,backupRaw})=>({id,raw,backupRaw}));
 }
 function preserveUnreadable(session) {
  if(!session||!Object.hasOwn(session,'storageRaw')&&!Object.hasOwn(session,'rawCorruptSave'))fail('JOURNEY_STORAGE_CONFLICT');
  const expected=Object.hasOwn(session,'storageRaw')?session.storageRaw:session.rawCorruptSave;
  const raw=storage.getItem(SAVE_KEY),backupRaw=storage.getItem(LEGACY_BACKUP_KEY);
  if(raw!==expected||Object.hasOwn(session,'storageBackupRaw')&&session.storageBackupRaw!==backupRaw)fail('JOURNEY_STORAGE_CONFLICT');
  if(raw===null&&backupRaw===null)fail('JOURNEY_RECOVERY_NOT_REQUIRED');
  const entries=listUnreadable();
  const found=entries.find(entry=>entry.raw===raw&&entry.backupRaw===backupRaw);
  const entry=found??{id:globalThis.crypto.randomUUID(),raw,backupRaw};
  // Corrupt source bytes belong only in this recovery ledger. Parsing the
  // wrapper never deserializes them into a playable state or legacy handoff.
  if(!found) {
   const saved=JSON.stringify({version:1,entries:[...entries,entry]});
   storage.setItem(UNREADABLE_SAVES_KEY,saved);
   if(storage.getItem(UNREADABLE_SAVES_KEY)!==saved)fail('JOURNEY_PRESERVE_FAILED');
  }
  if(storage.getItem(SAVE_KEY)!==raw||storage.getItem(LEGACY_BACKUP_KEY)!==backupRaw)fail('JOURNEY_STORAGE_CONFLICT');
  return entry;
 }
 function replace(key,value) {
  if(value===null){if(typeof storage.removeItem!=='function')fail('JOURNEY_STORAGE_UNAVAILABLE');storage.removeItem(key);}
  else storage.setItem(key,value);
 }
 function restore(id,currentSession) {
  // All fallible reads/validation and the durable current-life preservation
  // precede replacing either active key. A failed write can always be recovered
  // from that preserved record, including the exact legacy handoff bytes.
  const destination=read().find(entry=>entry.id===id);
  if(!destination)fail('JOURNEY_NOT_FOUND');
  validate(destination);
  capture(currentSession);
  const originalRaw=storage.getItem(SAVE_KEY),backupRaw=storage.getItem(LEGACY_BACKUP_KEY);
  preserve(currentSession);
  const next=bootstrapSession({getItem:key=>key===SAVE_KEY?destination.raw:key===LEGACY_BACKUP_KEY?destination.backupRaw:null},{createFresh:false});
  if(next.status==='blocked'||next.backupError)fail('JOURNEY_INVALID_SAVE');
  if(storage.getItem(SAVE_KEY)!==originalRaw||storage.getItem(LEGACY_BACKUP_KEY)!==backupRaw)fail('JOURNEY_STORAGE_CONFLICT');
  // Remove the old handoff before activating a save with no associated backup.
  // Restore both original keys on failure; durable preservation remains even
  // when the browser rejects that rollback as well.
  try {
   replace(LEGACY_BACKUP_KEY,destination.backupRaw);
   storage.setItem(SAVE_KEY,destination.raw);
  } catch(error) {
   try{replace(LEGACY_BACKUP_KEY,backupRaw);}catch{}
   try{replace(SAVE_KEY,originalRaw);}catch{}
   throw error;
  }
  return next;
 }
 return {list:()=>read().map(validate),preserve,restore,preserveUnreadable,listUnreadable};
}
