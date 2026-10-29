import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneySaves, JOURNEY_SAVES_KEY } from '../src/game/journey-saves.js';
import { SAVE_KEY } from '../src/game/persistence.js';
import { bootstrapSession } from '../src/ui/session.js';
import { createCultivation, chooseCultivation } from '../src/game/cultivation/engine.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
import { startApp } from './helpers/app-harness.js';

const backupKey = `${JOURNEY_SAVES_KEY}-recovery`;
function memory(primary) {
  const values = new Map([[SAVE_KEY, primary]]);
  return { values, getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key) };
}
function alive(name) {
  const birth = createCultivation({seed:name,name,characterCreation:true,contentVersion:3});
  return serializeGame(chooseCultivation(birth,{revision:birth.revision,sceneId:birth.scene.nodeId,choiceId:'birth-start'}).state);
}

test('explicit catalog recovery retains exact corrupt bytes, every valid journey and the active life', () => {
  for (const kind of ['invalid-json','invalid-entry']) {
    const original = alive('原旅人'), storage = memory(original), library = createJourneySaves(storage);
    const retained = library.preserve(bootstrapSession(storage));
    const data = JSON.parse(storage.getItem(JOURNEY_SAVES_KEY));
    data.entries.push({id:'damaged-entry',raw:'not a save'});
    const corrupt = kind==='invalid-json' ? '{broken catalog\n原始字节' : JSON.stringify(data,null,2);
    storage.setItem(JOURNEY_SAVES_KEY,corrupt);
    assert.equal(library.corruptLibrary(),corrupt);
    assert.equal(storage.getItem(JOURNEY_SAVES_KEY),corrupt,'inspection never rewrites corrupt data');
    library.recoverLibrary(corrupt);
    assert.equal(storage.getItem(SAVE_KEY),original);
    assert.equal(library.corruptLibrary(),null);
    assert.deepEqual(library.list().map(row=>row.id),kind==='invalid-entry'?[retained.id]:[]);
    assert.equal(JSON.parse(library.libraryRecoveryRaw()).entries[0].raw,corrupt);
    assert.throws(()=>library.recoverLibrary(storage.getItem(JOURNEY_SAVES_KEY)),/RECOVERY_NOT_REQUIRED/);
  }
});

test('catalog recovery refuses stale input and never resets before a verified durable backup', () => {
  for (const mode of ['backup-write','backup-verify','catalog-write','catalog-verify','stale']) {
    const original = alive('保留此生'), storage = memory(original), library = createJourneySaves(storage), corrupt = '{broken';
    storage.setItem(JOURNEY_SAVES_KEY,corrupt);
    const set = storage.setItem;
    storage.setItem = (key,value) => {
      if (key === (mode.startsWith('backup')?backupKey:JOURNEY_SAVES_KEY)) {
        if(mode.endsWith('write')) throw Error('quota');
        if(mode.endsWith('verify')) return;
      }
      return set(key,value);
    };
    if(mode==='stale')set(JOURNEY_SAVES_KEY,'{newer corrupt bytes');
    assert.throws(()=>library.recoverLibrary(corrupt),mode==='stale'?/CONFLICT/:mode.endsWith('verify')?/PRESERVE_FAILED/:/quota/);
    assert.equal(storage.getItem(SAVE_KEY),original,mode);
    assert.equal(storage.getItem(JOURNEY_SAVES_KEY),mode==='stale'?'{newer corrupt bytes':corrupt,mode);
    if(mode.startsWith('catalog'))assert.equal(JSON.parse(storage.getItem(backupKey)).entries[0].raw,corrupt);
  }
});

test('settings exports and explicitly recovers a broken catalog so a new life can preserve and restore its predecessor', async () => {
  const original = alive('旧日旅人'), corrupt = '{broken offline catalog\n原文';
  const app = await startApp({raw:original,autoEnter:false});
  app.storage.setItem(JOURNEY_SAVES_KEY,corrupt);
  await app.clickRendered('[data-title-new]');
  await app.clickRendered('[data-confirm]');
  app.input('birth-name','新的旅人');
  await app.clickRendered('[data-birth-start]');
  assert.equal(app.storage.raw,original);
  assert.equal(app.navigation.screen,'new');
  await app.clickRendered('[data-view="settings"]');
  await app.clickRendered('[data-export-catalog]');
  assert.equal(await app.downloads.find(item=>item instanceof Blob).text(),corrupt);
  await app.clickRendered('[data-recover-catalog]');
  assert.equal(app.storage.getItem(JOURNEY_SAVES_KEY),corrupt,'opening confirmation is read-only');
  app.cancelDialog();
  assert.equal(app.storage.getItem(JOURNEY_SAVES_KEY),corrupt,'cancelling retains exact original bytes');
  await app.clickRendered('[data-recover-catalog]');
  await app.clickRendered('[data-confirm]');
  assert.equal(app.storage.raw,original);
  assert.equal(JSON.parse(app.storage.getItem(backupKey)).entries[0].raw,corrupt);
  await app.clickRendered('[data-export-catalog-recovery]');
  const backups = app.downloads.filter(item=>item instanceof Blob);
  assert.equal(JSON.parse(await backups.at(-1).text()).entries[0].raw,corrupt);
  await app.clickRendered('[data-menu-back]');
  await app.clickRendered('[data-birth-start]');
  assert.equal(deserializeGame(app.storage.raw).life.name,'新的旅人');
  const retained = JSON.parse(app.storage.getItem(JOURNEY_SAVES_KEY)).entries.find(row=>row.raw===original);
  assert.ok(retained,'the old living character remains reachable after the confirmed recovery');
  await app.clickRendered('[data-home]');
  await app.clickRendered('[data-saves]');
  await app.clickRendered(`[data-select-offline="${retained.id}"]`);
  assert.equal(app.storage.raw,original);
});
