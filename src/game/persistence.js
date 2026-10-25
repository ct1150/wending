import { serializeGame, deserializeGame } from './save-format.js';

export const SAVE_KEY = 'baishi-wending-save-v1';

function resolveStorage(storage) {
  try { return storage === undefined ? globalThis.localStorage : storage; }
  catch { throw new Error('浏览器限制访问本地存储，请使用导出备份。'); }
}

export function saveToStorage(state, storage) {
  storage = resolveStorage(storage);
  if (!storage || typeof storage.setItem !== 'function') throw new Error('无法使用本地存储，请导出备份以免进度丢失。');
  const raw = serializeGame(state);
  try { storage.setItem(SAVE_KEY, raw); }
  catch { throw new Error('本地保存失败，可能是存储空间不足或浏览器限制。请导出备份。'); }
}

export function loadFromStorage(storage) {
  storage = resolveStorage(storage);
  if (!storage || typeof storage.getItem !== 'function') throw new Error('无法读取本地存储。');
  let raw;
  try { raw = storage.getItem(SAVE_KEY); }
  catch { throw new Error('浏览器拒绝读取本地存档。'); }
  if (raw === null) return null;
  return deserializeGame(raw);
}

// One recoverable handoff record, not a journal. Original source bytes remain
// immutable within a legacy life chain; checkpoint and prepared target are exact.
export const LEGACY_BACKUP_KEY = `${SAVE_KEY}-legacy-handoff`;
export function readLegacyBackup(storage) {
 storage=resolveStorage(storage);
 const raw=storage.getItem(LEGACY_BACKUP_KEY);
 if(raw===null)return null;
 let record;
 try { record=JSON.parse(raw); } catch { throw new Error('旧存档备份无法解析，请先导出备份。'); }
 if(!record || typeof record.originalRaw!=='string' || typeof record.currentRaw!=='string' || typeof record.previousRaw!=='string' || (record.checkpointRaw!==null && typeof record.checkpointRaw!=='string') || (record.preparedRaw!==null && typeof record.preparedRaw!=='string'))throw new Error('旧存档备份结构无效，请先导出。');
 if(![1,2].includes(deserializeGame(record.currentRaw).version) || ![1,2].includes(deserializeGame(record.previousRaw).version))throw new Error('较新旧人生备份无效。');
 if(![1,2].includes(deserializeGame(record.originalRaw).version))throw new Error('旧存档备份来源无效。');
 if(record.checkpointRaw && ![1,2].includes(deserializeGame(record.checkpointRaw).version))throw new Error('旧人生交接检查点无效。');
 if(Boolean(record.checkpointRaw)!==Boolean(record.preparedRaw))throw new Error('交接备份缺少旧人生或新人生。');
 if(record.preparedRaw){
  const target=deserializeGame(record.preparedRaw),checkpoint=deserializeGame(record.checkpointRaw);
  if(target.version!==3 || target.world.generation!==checkpoint.meta.generation+1 || target.world.year!==checkpoint.meta.worldYear+16 || JSON.stringify(target.world.legacyArchive)!==JSON.stringify(checkpoint))throw new Error('准备的新人生与交接旧人生不一致。');
 }
 return record;
}
export function writeLegacyBackup(record,storage) {
 storage=resolveStorage(storage);
 const raw=JSON.stringify(record);
 storage.setItem(LEGACY_BACKUP_KEY,raw);
 if(storage.getItem(LEGACY_BACKUP_KEY)!==raw)throw new Error('无法核实旧存档备份已保存。');
}
