import { ORIGINS, TALENTS } from '../game/cultivation/live/model.js';

const NAVIGATION_KEY = 'wending-navigation-v1';
const PREFERENCES_KEY = 'wending-reading-v1';
const screens = ['home', 'new', 'adventure', 'settings'];
const defaults = () => ({screen:'home',draft:null,returnScreen:'home'});

function navigation(value) {
  if (!value || typeof value !== 'object') return defaults();
  const draft=value.draft && typeof value.draft==='object' ? {
    name:typeof value.draft.name==='string'?value.draft.name.slice(0,24):'云归',
    ...(typeof value.draft.originId==='string' && Object.hasOwn(ORIGINS,value.draft.originId) ? {originId:value.draft.originId} : {}),
    ...(typeof value.draft.seed==='string' && /^\d{1,16}$/.test(value.draft.seed) ? {seed:value.draft.seed} : {}),
    ...(typeof value.draft.lockedTalentId==='string' && Object.hasOwn(TALENTS,value.draft.lockedTalentId) ? {lockedTalentId:value.draft.lockedTalentId} : {}),
    ...(typeof value.draft.rolledTalentId==='string' && Object.hasOwn(TALENTS,value.draft.rolledTalentId) ? {rolledTalentId:value.draft.rolledTalentId} : {}),
    expectedArchiveId:typeof value.draft.expectedArchiveId==='string'?value.draft.expectedArchiveId:null,
    ...(typeof value.draft.reincarnationRunId==='string'&&value.draft.reincarnationRunId.length<=80&&Array.isArray(value.draft.reincarnationRewardIds)&&value.draft.reincarnationRewardIds.length<=4&&value.draft.reincarnationRewardIds.every(id=>typeof id==='string'&&id.length<=80)?{reincarnationRunId:value.draft.reincarnationRunId,reincarnationRewardIds:[...new Set(value.draft.reincarnationRewardIds)]}:{}),
  } : null;
  // Old mode/catalog navigation must never reopen the retired offline game.
  if(value.mode==='offline')return defaults();
  return {screen:screens.includes(value.screen)?value.screen:'home',draft,returnScreen:['home','adventure','new'].includes(value.returnScreen)?value.returnScreen:'home'};
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
  return {theme:['cinematic','system','light','dark'].includes(value?.theme)?value.theme:'cinematic',textSize:value?.textSize==='large'?'large':'standard'};
}

export function loadPreferences(storage) {
  try { return preferences(JSON.parse(storage?.getItem(PREFERENCES_KEY)??'null')); }
  catch { return preferences(null); }
}

export function savePreferences(storage,value) {
  try { if(!storage)return false;storage.setItem(PREFERENCES_KEY,JSON.stringify(preferences(value)));return true; }
  catch { return false; }
}
