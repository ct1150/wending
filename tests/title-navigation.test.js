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
  assert.deepEqual(module.loadPreferences(denied),{theme:'system',textSize:'standard'});
  const store=memory();
  assert.equal(module.savePreferences(store,{theme:'dark',textSize:'large'}),true);
  assert.deepEqual(module.loadPreferences(store),{theme:'dark',textSize:'large'});
  module.savePreferences(store,{theme:'evil',textSize:'huge'});
  assert.deepEqual(module.loadPreferences(store),{theme:'system',textSize:'standard'});
});

test('retained legacy pages and their settings return target survive a same-tab reload', () => {
  const storage=memory();
  for(const screen of ['inventory','worlds','legacies','chronicle']) {
    module.saveNavigation(storage,{screen,mode:'offline'});
    assert.equal(module.loadNavigation(storage,'reload').screen,screen);
    assert.equal(module.loadNavigation(storage,'navigate').screen,'home');
    module.saveNavigation(storage,{screen:'settings',mode:'offline',returnScreen:screen});
    assert.equal(module.loadNavigation(storage,'reload').returnScreen,screen);
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
