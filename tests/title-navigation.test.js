import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../src/ui/navigation.js').catch(() => null);
const memory = () => { const data = new Map(); return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}; };

test('a new visit stays on home even when this tab previously played; reload restores its draft', () => {
  assert.ok(module, 'navigation module available');
  const storage=memory();
  module.saveNavigation(storage,{screen:'new',mode:'live',draft:{name:'林照',originId:'village',expectedArchiveId:'journey-a'}});
  assert.equal(module.loadNavigation(storage,'navigate').screen,'home');
  const reload=module.loadNavigation(storage,'reload');
  assert.equal(reload.screen,'new');
  assert.equal(reload.draft.name,'林照');
  assert.equal(reload.draft.expectedArchiveId,'journey-a');
});

test('unrecognized screens, modes, preferences and broken storage have usable defaults', () => {
  assert.ok(module);
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('quota');}};
  assert.equal(module.loadNavigation(denied,'reload').screen,'home');
  assert.equal(module.saveNavigation(denied,{screen:'adventure',mode:'live'}),false);
  assert.deepEqual(module.loadPreferences(denied),{theme:'cinematic',textSize:'standard'});
  const store=memory();
  assert.equal(module.savePreferences(store,{theme:'dark',textSize:'large'}),true);
  assert.deepEqual(module.loadPreferences(store),{theme:'dark',textSize:'large'});
  module.savePreferences(store,{theme:'evil',textSize:'huge'});
  assert.deepEqual(module.loadPreferences(store),{theme:'cinematic',textSize:'standard'});
});

test('cinematic is the default while saved reading preferences keep their meaning', () => {
  const store=memory();
  assert.deepEqual(module.loadPreferences(store),{theme:'cinematic',textSize:'standard'});
  for(const theme of ['cinematic','system','light','dark']) {
    assert.equal(module.savePreferences(store,{theme,textSize:'large'}),true);
    assert.deepEqual(module.loadPreferences(store),{theme,textSize:'large'});
  }
});

test('removed save menus and offline pages normalize to home on reload', () => {
  const storage=memory();
  for(const screen of ['saves','inventory','worlds','legacies','chronicle']) {
    storage.setItem('wending-navigation-v1',JSON.stringify({screen,mode:'live',returnScreen:screen}));
    assert.equal(module.loadNavigation(storage,'reload').screen,'home',screen);
    assert.equal(module.loadNavigation(storage,'reload').returnScreen,'home',screen);
    assert.equal(module.loadNavigation(storage,'navigate').screen,'home');
  }
  for(const screen of ['new','adventure','settings']) {
    storage.setItem('wending-navigation-v1',JSON.stringify({screen,mode:'offline',returnScreen:'adventure',offlineDraft:{raw:'original offline bytes',name:'旧旅人',expectedRaw:null,expectedBackupRaw:null}}));
    const restored=module.loadNavigation(storage,'reload');
    assert.equal(restored.screen,'home',screen);
    assert.notEqual(restored.mode,'offline');
    assert.equal(restored.offlineDraft??null,null);
  }
});

test('a reincarnation name draft retains its parent and selected rewards across reload without starting a life', () => {
  const storage=memory();
  module.saveNavigation(storage,{screen:'new',mode:'live',draft:{name:'沈渡',originId:'ferry',expectedArchiveId:'dead-archive',reincarnationRunId:'old-life',reincarnationRewardIds:['past-memory','causal-compass']}});
  const reload=module.loadNavigation(storage,'reload');
  assert.equal(reload.draft.reincarnationRunId,'old-life');
  assert.deepEqual(reload.draft.reincarnationRewardIds,['past-memory','causal-compass']);
  assert.equal(reload.draft.expectedArchiveId,'dead-archive');
  assert.equal(module.loadNavigation(storage,'navigate').draft,null);
});
