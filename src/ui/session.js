import { createGame } from '../game/engine.js';
import { loadFromStorage, saveToStorage, readLegacyBackup, writeLegacyBackup } from '../game/persistence.js';
import { serializeGame, deserializeGame } from '../game/save-format.js';
import { migrateLegacyLife } from '../game/journey/migration.js';

const isLegacyLife = state => state?.version === 1 || state?.version === 2;

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
  const createFresh=options.createFresh??createGame;
  return {status:'fresh',state:createFresh({name:'云归',originId:'village',pathId:'sword',legacyIds:[],seed:options.seed}),rawCorruptSave:null,error:'',saved:false,storageRaw:null};
 }catch(error){return {status:'blocked',state:null,rawCorruptSave,error:error.message||'无法读取本地存档。请备份后恢复。',saved:false};}
}
function inspectLegacyBackup(session,storage){
 const next={...session,backupError:null};
 try {
  const backup=readLegacyBackup(storage);
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
  saveToStorage(target,storage);
  return {...next,state:target,storageRaw:next.pendingLegacyRaw,pendingLegacyRaw:null,error:'',saved:true};
 }catch(error){return {...next,error:`较新旧人生尚未恢复到当前档：${error.message}。可导出较新备份并重试恢复。`,saved:false};}
}
function backupFor(session,currentRaw){
 return {originalRaw:session.originalLegacyRaw??session.legacyBackup?.originalRaw??serializeGame(session.state),previousRaw:session.storageRaw??currentRaw,currentRaw,checkpointRaw:null,preparedRaw:null};
}
export function persistSession(session,storage){
 if(session.status==='blocked'||!session.state||session.pendingLegacyRaw)return session;
 // A prepared handoff must use its explicit retry, never an ordinary autosave.
 if(session.legacyBackup?.preparedRaw && isLegacyLife(session.state))return session;
 let next={...session};
 try{
  const raw=serializeGame(session.state);
  if(isLegacyLife(session.state) && session.originalLegacyRaw){
   if(session.backupError)throw new Error(session.backupError);
   next.legacyBackup=backupFor(session,raw);
   writeLegacyBackup(next.legacyBackup,storage);
  }
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
  if(!next.legacyBackup?.preparedRaw){
   const target=migrateLegacyLife(next.state,command);
   const checkpointRaw=serializeGame(next.state),preparedRaw=serializeGame(target);
   // Validate the complete target before any storage replacement.
   deserializeGame(preparedRaw);
   next.legacyBackup={...backupFor(next,checkpointRaw),checkpointRaw,preparedRaw};
  }
  writeLegacyBackup(next.legacyBackup,storage);
  const target=deserializeGame(next.legacyBackup.preparedRaw);
  saveToStorage(target,storage);
  return {...next,state:target,storageRaw:next.legacyBackup.preparedRaw,error:'',saved:true};
 }catch(error){return {...next,error:error.code==='SAVE_SIZE_LIMIT'?`新人生未提交：${error.message} 旧人生保持不变，仍可导出当前有效旧档与已有原始备份。`:`新人生尚未保存：${error.message}。旧人生与准备的新人生仍可导出，修复存储后重试交接。`,saved:false};}
}
