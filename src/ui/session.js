import { createGame } from '../game/engine.js';
import { SAVE_KEY, LEGACY_BACKUP_KEY, loadFromStorage, saveToStorage, readLegacyBackup, writeLegacyBackup } from '../game/persistence.js';
import { serializeGame, deserializeGame } from '../game/save-format.js';
import { migrateLegacyLife } from '../game/journey/migration.js';

const isLegacyLife = state => state?.version === 1 || state?.version === 2;

function assertCurrentSource(session,storage){
 const source=storage===undefined?globalThis.localStorage:storage;
 if(!source||typeof source.getItem!=='function')throw new Error('无法读取本地存储，请先导出本页进度。');
 const expected=Object.hasOwn(session,'storageRaw')?session.storageRaw:null;
 if(source.getItem(SAVE_KEY)!==expected || Object.hasOwn(session,'storageBackupRaw')&&source.getItem(LEGACY_BACKUP_KEY)!==session.storageBackupRaw){
  throw Object.assign(new Error('当前存档已被其他页面更新，请先导出本页进度，再重新载入或切换存档。'),{code:'SESSION_STORAGE_CONFLICT'});
 }
}

export function bootstrapSession(storage, options = {}) {
 let rawCorruptSave=null;
 try {
  const source=storage===undefined?globalThis.localStorage:storage;
  const captured=source&&typeof source.getItem==='function'?{getItem(key){rawCorruptSave=source.getItem(key);return rawCorruptSave;}}:source;
  const loaded=loadFromStorage(captured);
  if(loaded){
   const session={status:'loaded',state:loaded,rawCorruptSave:null,error:'',saved:true,storageRaw:rawCorruptSave};
   if(isLegacyLife(loaded)){
    session.originalLegacyRaw=rawCorruptSave;
    return inspectLegacyBackup(session,source);
   }
   return session;
  }
  if(options.createFresh===false)return {status:'empty',state:null,rawCorruptSave:null,error:'',saved:false,storageRaw:null};
  const createFresh=options.createFresh??createGame;
  return {status:'fresh',state:createFresh({name:'云归',originId:'village',pathId:'sword',legacyIds:[],seed:options.seed}),rawCorruptSave:null,error:'',saved:false,storageRaw:null};
 }catch(error){return {status:'blocked',state:null,rawCorruptSave,error:error.message||'无法读取本地存档。请备份后恢复。',saved:false};}
}
function inspectLegacyBackup(session,storage){
 const next={...session,backupError:null};
 try {
  const source=storage===undefined?globalThis.localStorage:storage;
  const backup=readLegacyBackup({getItem(key){const raw=source.getItem(key);next.storageBackupRaw=raw;return raw;}});
  if(backup && [backup.originalRaw,backup.previousRaw,backup.currentRaw,backup.checkpointRaw].includes(session.storageRaw)){
   next.legacyBackup=backup;next.originalLegacyRaw=backup.originalRaw;
   if(backup.preparedRaw){next.state=deserializeGame(backup.checkpointRaw);next.saved=false;next.error='旧人生交接尚未保存完成；可重试同一新人生，或导出原档与交接备份。';}
   else if(session.storageRaw===backup.previousRaw && backup.currentRaw!==session.storageRaw){
    next.pendingLegacyRaw=backup.currentRaw;next.saved=false;
    next.error='发现上次已写入备份、但尚未替换当前档的较新旧人生。请先恢复这份进度或导出较新备份；恢复前不继续落子。';
   }
  }
  return next;
 }catch(error){return {...next,backupError:error.message,error:error.message,saved:false};}
}
// An explicit recovery restores already-committed choices; it never replays an
// action, chooses a reward, advances RNG or migrates the life automatically.
export function recoverLegacySession(session,storage){
 if(session.status==='blocked'||!isLegacyLife(session.state))return session;
 let next=session.backupError?inspectLegacyBackup(session,storage):{...session};
 if(next.backupError)return next;
 if(!next.pendingLegacyRaw)return {...next,error:next.legacyBackup?.preparedRaw?next.error:'',saved:next.legacyBackup?.preparedRaw?false:serializeGame(next.state)===serializeGame(deserializeGame(next.storageRaw))};
 try{
  const target=deserializeGame(next.pendingLegacyRaw);
  assertCurrentSource(next,storage);
  saveToStorage(target,storage);
  return {...next,state:target,storageRaw:next.pendingLegacyRaw,pendingLegacyRaw:null,error:'',saved:true};
 }catch(error){return {...next,error:`较新旧人生尚未恢复到当前档：${error.message}。可导出较新备份并重试恢复。`,saved:false};}
}
function backupFor(session,currentRaw){
 const originalRaw=session.originalLegacyRaw??session.legacyBackup?.originalRaw??serializeGame(session.state);
 const lineage=[originalRaw,session.legacyBackup?.previousRaw,session.legacyBackup?.currentRaw,session.legacyBackup?.checkpointRaw];
 // An intentional import compares against the replaced primary, but its
 // handoff lineage must begin with the imported life rather than that primary.
 const previousRaw=typeof session.storageRaw==='string'&&lineage.includes(session.storageRaw)?session.storageRaw:session.legacyBackup?.currentRaw??originalRaw;
 return {originalRaw,previousRaw,currentRaw,checkpointRaw:null,preparedRaw:null};
}
export function persistSession(session,storage){
 if(session.status==='blocked'||!session.state||session.pendingLegacyRaw)return session;
 // A prepared handoff must use its explicit retry, never an ordinary autosave.
 if(session.legacyBackup?.preparedRaw && isLegacyLife(session.state))return session;
 let next={...session};
 try{
  const raw=serializeGame(session.state);
  assertCurrentSource(next,storage);
  if(isLegacyLife(session.state) && session.originalLegacyRaw){
   if(session.backupError)throw new Error(session.backupError);
   next.legacyBackup=backupFor(session,raw);
   writeLegacyBackup(next.legacyBackup,storage);
   next.storageBackupRaw=JSON.stringify(next.legacyBackup);
  }
  assertCurrentSource(next,storage);
  saveToStorage(session.state,storage);
  return {...next,storageRaw:raw,error:'',saved:true};
 }catch(error){return {...next,error:error.code==='SAVE_SIZE_LIMIT'?`${error.message} 当前存档与备份均未替换，请恢复已有的有效存档。`:`自动保存暂不可用：${error.message}。请导出存档备份。`,saved:false};}
}
export function migrateSession(session,command,storage){
 if(session.status==='blocked'||!isLegacyLife(session.state))return session;
 let next=session.backupError?inspectLegacyBackup(session,storage):{...session};
 if(next.pendingLegacyRaw)return next;
 try{
  if(next.backupError)throw new Error(next.backupError);
  assertCurrentSource(next,storage);
  if(!next.legacyBackup?.preparedRaw){
   const target=migrateLegacyLife(next.state,command);
   const checkpointRaw=serializeGame(next.state),preparedRaw=serializeGame(target);
   // Validate the complete target before any storage replacement.
   deserializeGame(preparedRaw);
   next.legacyBackup={...backupFor(next,checkpointRaw),checkpointRaw,preparedRaw};
  }
  writeLegacyBackup(next.legacyBackup,storage);
  next.storageBackupRaw=JSON.stringify(next.legacyBackup);
  const target=deserializeGame(next.legacyBackup.preparedRaw);
  assertCurrentSource(next,storage);
  saveToStorage(target,storage);
  return {...next,state:target,storageRaw:next.legacyBackup.preparedRaw,error:'',saved:true};
 }catch(error){return {...next,error:error.code==='SAVE_SIZE_LIMIT'?`新人生未提交：${error.message} 旧人生保持不变，仍可导出当前有效旧档与已有原始备份。`:`新人生尚未保存：${error.message}。旧人生与准备的新人生仍可导出，修复存储后重试交接。`,saved:false};}
}
