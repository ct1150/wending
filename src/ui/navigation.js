const NAVIGATION_KEY = 'wending-navigation-v1';
const PREFERENCES_KEY = 'wending-reading-v1';
const screens = ['home', 'new', 'adventure', 'settings', 'saves', 'inventory', 'worlds', 'legacies', 'chronicle'];
const defaults = () => ({screen:'home',mode:null,draft:null,offlineDraft:null,returnScreen:'home'});

function navigation(value) {
  if (!value || typeof value !== 'object') return defaults();
  const draft=value.draft && typeof value.draft==='object' ? {
    name:typeof value.draft.name==='string'?value.draft.name.slice(0,24):'云归',
    originId:typeof value.draft.originId==='string'?value.draft.originId:'village',
    expectedArchiveId:typeof value.draft.expectedArchiveId==='string'?value.draft.expectedArchiveId:null,
    ...(typeof value.draft.reincarnationRunId==='string'&&value.draft.reincarnationRunId.length<=80&&Array.isArray(value.draft.reincarnationRewardIds)&&value.draft.reincarnationRewardIds.length<=4&&value.draft.reincarnationRewardIds.every(id=>typeof id==='string'&&id.length<=80)?{reincarnationRunId:value.draft.reincarnationRunId,reincarnationRewardIds:[...new Set(value.draft.reincarnationRewardIds)]}:{}),
  } : null;
  const pending=value.offlineDraft;
  const offlineDraft=pending&&typeof pending.raw==='string'&&typeof pending.name==='string'&&(pending.expectedRaw===null||typeof pending.expectedRaw==='string')&&(pending.expectedBackupRaw===null||typeof pending.expectedBackupRaw==='string')?{raw:pending.raw,name:pending.name.slice(0,24),expectedRaw:pending.expectedRaw,expectedBackupRaw:pending.expectedBackupRaw}:null;
  return {screen:screens.includes(value.screen)?value.screen:'home',mode:['live','offline'].includes(value.mode)?value.mode:null,draft,offlineDraft,returnScreen:['home','adventure','new','inventory','worlds','legacies','chronicle'].includes(value.returnScreen)?value.returnScreen:'home'};
}

export function loadNavigation(storage, navigationType='navigate') {
  if (navigationType!=='reload') return defaults();
  try { return navigation(JSON.parse(storage?.getItem(NAVIGATION_KEY)??'null')); }
  catch { return defaults(); }
}

export function saveNavigation(storage,value) {
  try { if(!storage)return false;storage.setItem(NAVIGATION_KEY,JSON.stringify(navigation(value)));return true; }
  catch { return false; }
}

function preferences(value) {
  return {theme:['system','light','dark'].includes(value?.theme)?value.theme:'system',textSize:value?.textSize==='large'?'large':'standard'};
}

export function loadPreferences(storage) {
  try { return preferences(JSON.parse(storage?.getItem(PREFERENCES_KEY)??'null')); }
  catch { return preferences(null); }
}

export function savePreferences(storage,value) {
  try { if(!storage)return false;storage.setItem(PREFERENCES_KEY,JSON.stringify(preferences(value)));return true; }
  catch { return false; }
}
