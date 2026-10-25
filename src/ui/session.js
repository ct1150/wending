import { createGame } from '../game/engine.js';
import { loadFromStorage, saveToStorage } from '../game/persistence.js';

// Capture the one authoritative read while letting persistence own validation/migration.
export function bootstrapSession(storage, options = {}) {
  let rawCorruptSave = null;
  try {
    const source = storage === undefined ? globalThis.localStorage : storage;
    const captured = source && typeof source.getItem === 'function' ? {
      getItem(key) { rawCorruptSave = source.getItem(key); return rawCorruptSave; },
    } : source;
    const loaded = loadFromStorage(captured);
    if (loaded) return { status: 'loaded', state: loaded, rawCorruptSave: null, error: '', saved: true };
    const state = createGame({ name: '云归', originId: 'village', pathId: 'sword', legacyIds: [], seed: options.seed });
    return { status: 'fresh', state, rawCorruptSave: null, error: '', saved: false };
  } catch (error) {
    return { status: 'blocked', state: null, rawCorruptSave, error: error.message || '无法读取本地存档。请备份后恢复。', saved: false };
  }
}

// A blocked read must never become an automatic write, even when its raw data is empty.
export function persistSession(session, storage) {
  if (session.status === 'blocked' || !session.state) return session;
  try {
    saveToStorage(session.state, storage);
    return { ...session, error: '', saved: true };
  } catch (error) {
    return { ...session, error: `自动保存暂不可用：${error.message}。请导出存档备份。`, saved: false };
  }
}
