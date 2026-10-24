import { serialize, deserialize } from './engine.js';

export const SAVE_KEY = 'baishi-wending-save-v1';

function resolveStorage(storage) {
  try { return storage === undefined ? globalThis.localStorage : storage; }
  catch { throw new Error('浏览器限制访问本地存储，请使用导出备份。'); }
}

export function saveToStorage(state, storage) {
  storage = resolveStorage(storage);
  if (!storage || typeof storage.setItem !== 'function') throw new Error('无法使用本地存储，请导出备份以免进度丢失。');
  const raw = serialize(state);
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
  return deserialize(raw);
}
