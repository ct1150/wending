import { openLiveArchive } from './game/live-archive.js';
import { exportLiveArchive, importLiveArchive } from './game/live-save-format.js';
import { createLiveSession } from './ui/live-session.js';
import { createStoryClient } from './ui/story-client.js';
import { compileChoices } from './game/cultivation/live/engine.js';
import { stateHash } from './game/cultivation/live/identity.js';
import { getReincarnationSettlement, REINCARNATION_REWARDS, buildRebirthOptions } from './game/cultivation/live/reincarnation.js';
import { REALMS as LIVE_REALMS, ORIGINS as LIVE_ORIGINS, TALENTS as LIVE_TALENTS, ITEMS as LIVE_ITEMS } from './game/cultivation/live/model.js';
import { liveCharacterSummary } from './ui/character.js';
import { renderLiveJourney, renderLiveHistory, updateLiveJourney } from './ui/journey.js';
import { readLegacyBackup, SAVE_KEY, LEGACY_BACKUP_KEY } from './game/persistence.js';
import { REALMS, PATHS, ORIGINS, WORLDS, ITEMS, LEGACIES, EVENTS, ENEMIES, CHALLENGES, WORLD_FLAGS } from './game/content.js';
import { getStats, getActionInfo, act, getEventChoices, chooseEvent, combatAction, equipItem, selectLegacy, getStoryView, chooseStory } from './game/engine.js';
import { getJourneyView, chooseJourney } from './game/journey/engine.js';
import { createCultivation, getCultivationView, chooseCultivation } from './game/cultivation/engine.js';
import { serializeGame, deserializeGame } from './game/save-format.js';
import { MAX_SAVE_FILE_BYTES } from './game/save-size.js';
import { getLegacyBridgeChoices } from './game/journey/migration.js';
import { renderJourney, renderJourneyHistory } from './ui/journey.js';
import { renderIdentityBar, renderCharacterDetails, renderBirth, renderLiveBirth } from './ui/character.js';
import { bootstrapSession, persistSession, migrateSession, recoverLegacySession } from './ui/session.js';
import { createJourneySaves } from './game/journey-saves.js';
import { loadNavigation, saveNavigation, loadPreferences, savePreferences } from './ui/navigation.js';
import { renderTitleScreen, renderGameNavigation, renderReadingSettings, renderJourneyList } from './ui/title-screen.js';
import { icon } from './ui/icons.js';
import { renderCombatActions } from './ui/combat.js';
import { getPrimaryResult, renderStoryScene, renderStoryRecords, renderStoryOutcome, renderStoryInterruption } from './ui/story.js';

const $ = selector => document.querySelector(selector);
const appVersion = $('meta[name="application-version"]')?.content || 'dev';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const row = (rows, id) => rows.find(item => item.id === id);
const num = value => Math.round(value || 0).toLocaleString('zh-CN');
const pct = (value, total) => Math.max(0, Math.min(100, total ? value / total * 100 : 0));
const WORLD_ICONS = { mortal: 'mountain', nether: 'moon', celestial: 'sun' };
const PATH_ICONS = { sword: 'sword', body: 'shield', alchemy: 'cauldron' };
const CAUSES = { retired: '归隐', lifespan: '寿尽', battle: '陨落', victory: '问鼎' };
const storage = {
  getItem(key) { return window.localStorage.getItem(key); },
  setItem(key, value) { window.localStorage.setItem(key, value); },
  removeItem(key) { window.localStorage.removeItem(key); },
};
function newSeed() {
  return window.crypto?.getRandomValues ? String(window.crypto.getRandomValues(new Uint32Array(1))[0]) : String(Date.now());
}
const createRecommendedLife = options => createCultivation({ ...options, characterCreation: true, contentVersion: 3 });
const ACTIVE_MODE_KEY = 'wending-active-mode-v1';
const canReadLiveArchive=window.location.protocol!=='file:'||typeof globalThis.indexedDB!=='undefined';
let activeMode = 'offline';
try { if (storage.getItem(ACTIVE_MODE_KEY) === 'live') activeMode = 'live'; } catch {}
let navigationStorage=null;
try { navigationStorage=window.sessionStorage; } catch {}
const navigation=loadNavigation(navigationStorage,window.performance?.getEntriesByType?.('navigation')?.[0]?.type);
let liveBirthDraft=navigation.draft??{name:'云归',originId:'village',expectedArchiveId:null};
let liveArchive=null, liveSession=null, liveSnapshot=null, liveError='', liveHistoryCursor=null, liveHistoryRun=null;
let liveActionDraft={key:null,open:false,text:'',error:''};
const unsupportedAction='【该行动超出当前场景能力范围，请重新选择。】';
let liveInitialization=null,homeReady=false,uiBusy=false,creatingRunId=null,returnScreen=navigation.returnScreen;
let savedJourneys=[],savedCursor=null,savedError='',savedLoading=false;
const offlineJourneys=createJourneySaves(storage);
let readingPreferences=loadPreferences(storage);
const liveCatalogs={REALMS:LIVE_REALMS,ORIGINS:LIVE_ORIGINS,TALENTS:LIVE_TALENTS,ITEMS:LIVE_ITEMS};
const liveClient=createStoryClient();
let session = bootstrapSession(storage, { createFresh: false });
let state = session.state;
let view = navigation.screen;
if(navigation.mode)activeMode=navigation.mode;
let preparingLife = false;
let saveError = session.error;
let lastSaved = session.saved;
let toastTimer;
let dialogConfirm = null;
let dialogReturnTarget = null;
const openPanels = new Map();
const isJourney = game => game?.version === 3 || game?.version === 4;
const isCreating = game => game?.version === 4 && game.phase === 'creating';
const getNarrativeView = game => game.version === 4 ? getCultivationView(game) : getJourneyView(game);
const chooseNarrative = (game, command) => game.version === 4 ? chooseCultivation(game, command) : chooseJourney(game, command);
let setup = { name: '云归', originId: 'village', pathId: 'sword', legacyIds: [] };
let offlineBirthDraft=null;
try {
  if(window.location.protocol==='file:'&&navigation.offlineDraft) {
    const candidate=deserializeGame(navigation.offlineDraft.raw);
    if(isCreating(candidate)&&candidate.contentVersion===3)offlineBirthDraft={...navigation.offlineDraft,state:candidate};
  }
} catch {}
let birthNameDraft = view==='new'&&offlineBirthDraft ? offlineBirthDraft.name : isCreating(state) ? state.life.name : '';
let birthComposing = false;

function rememberScreen() {
  return saveNavigation(navigationStorage,{screen:view,mode:activeMode,draft:liveBirthDraft,offlineDraft:offlineBirthDraft?{raw:serializeGame(offlineBirthDraft.state),name:offlineBirthDraft.name,expectedRaw:offlineBirthDraft.expectedRaw,expectedBackupRaw:offlineBirthDraft.expectedBackupRaw}:null,returnScreen});
}

const currentBirth = () => view==='new'&&offlineBirthDraft?offlineBirthDraft.state:state;

function saveCreationDraft() {
  if(!rememberScreen())notify('创建草稿暂时无法保存到此标签页，刷新会丢失草稿。原有旅程保持不变。',true);
}

function applyReadingPreferences() {
  if(document.documentElement) {
    document.documentElement.dataset.theme=readingPreferences.theme;
    document.documentElement.dataset.textSize=readingPreferences.textSize;
  }
}

function summarizeJourney(game,mode) {
  if(!game)return null;
  const summary=mode==='live'?liveCharacterSummary(game,liveCatalogs):isJourney(game)?getNarrativeView(game).summary:{name:game.run.name,realmName:REALMS[game.run.realmIndex].name,age:game.run.age,generation:game.meta.generation};
  const age=summary.ageText??`${summary.age}岁`;
  const progress=mode==='live'?`第 ${game.turnId} 回`:`第 ${summary.generation} 世`;
  return {name:summary.name,detail:`${summary.realmName??summary.realm??'凡人'} · ${age} · ${progress}${game.phase==='dead'?' · 此生已尽':isCreating(game)?' · 待入世':''}`,location:game.currentScene?.title??(isJourney(game)?getNarrativeView(game).title:null)};
}

function currentJourneySummary() {
  return summarizeJourney(activeMode==='live'?liveSnapshot?.state:state,activeMode);
}

function preserveOfflineProgress() {
  // Old formats can carry an unrelated handoff which their normal bootstrap
  // does not inspect. Explicit recovery retains those bytes too.
  try {
    const backup=readLegacyBackup(storage);
    if(backup&&!state)session={...session,backupError:'存在尚未关联到当前人生的旧备份。'};
  } catch(error) {session={...session,backupError:error.message};}
  if(session.status==='blocked'||session.backupError)return offlineJourneys.preserveUnreadable({...session,state});
  if(state)return offlineJourneys.preserve({...session,state});
}

function retainUnsavedOfflineLife() {
  if(activeMode!=='offline'||!state||lastSaved)return true;
  let changed=true;
  try {changed=serializeGame(state)!==serializeGame(deserializeGame(session.storageRaw));}catch{}
  const pendingBackup=session.legacyBackup&&JSON.stringify(session.legacyBackup)!==session.storageBackupRaw;
  if(!changed&&!pendingBackup)return true;
  try {offlineJourneys.preserve({...session,state});return true;}
  catch(error) {notify(`本页还有未保存的进度，暂不能切换旅程。请先导出当前进度。${saveProblem(error)}`,true);return false;}
}

function saveProblem(error) {
  if(error.code==='JOURNEY_STORAGE_CONFLICT')return '另一页面已更新这段旅程，请刷新后再操作。';
  if(error.code==='JOURNEY_INVALID_LIBRARY')return '离线旅程目录暂时无法读取，请到游戏设置导出原始目录并恢复。当前人生保持不变。';
  if(error.code==='JOURNEY_INVALID_RECOVERY_LIBRARY')return '原始恢复备份暂时无法读取，请先在游戏设置中导出备份。现有数据保持不变。';
  if(error.code==='JOURNEY_BLOCKED_SAVE')return '旧存档暂时无法读取，请先在游戏设置中备份原始存档。';
  if(error.code?.startsWith('JOURNEY_'))return '原有旅程尚未妥善保存，操作已停止。请检查浏览器存储空间并导出备份。';
  return error.message||'本地存储暂时不可用，原有旅程保持不变。';
}

function renderScreenShell(content,{title='百世问鼎',back='返回首页'}={}) {
  $('#app').innerHTML=`<div class="paper-page menu-page"><header class="menu-page-header"><p>${esc(title)}</p><button class="small-button" data-menu-back>← ${esc(back)}</button></header><main id="main-content" class="paper-main" tabindex="-1">${content}</main></div>`;
}

function renderSettingsPage() {
  const summary=currentJourneySummary();
  let recoveryCount=0;try{recoveryCount=offlineJourneys.listUnreadable().length;}catch{}
  let catalogRecovery='';
  try {
    const corrupt=offlineJourneys.corruptLibrary(),backup=offlineJourneys.libraryRecoveryRaw();
    if(corrupt!==null)catalogRecovery='<section class="settings-section"><h3>恢复离线旅程目录</h3><p role="alert">旅程目录暂时无法读取，当前人生仍保留。可先导出原始目录；确认恢复时会另存完整原文，并保留其中可读取的旅程。</p><div class="settings-actions"><button class="button" data-export-catalog>导出原始旅程目录</button><button class="button" data-recover-catalog>备份并恢复旅程目录</button></div></section>';
    if(backup!==null)catalogRecovery+='<section class="settings-section"><h3>旅程目录恢复备份</h3><p>此前恢复时保留的完整原始目录仍可下载。</p><button class="button" data-export-catalog-recovery>导出目录恢复备份</button></section>';
  } catch(error) {catalogRecovery=`<section class="settings-section"><p role="alert">${esc(saveProblem(error))}</p></section>`;}
  const body=`<p class="birth-kicker">收好行囊，再赴山河</p><h2 id="settings-title" tabindex="-1">游戏设置</h2>${renderReadingSettings(readingPreferences)}<section class="settings-section"><h3>旅程与存档</h3><p>${summary?`当前：${esc(summary.name)} · ${esc(summary.detail)}`:'尚未开启旅程。已有备份可以在这里导入。'}</p><div class="settings-actions"><button class="button" data-saves>切换存档</button><button class="button" data-export ${summary?'':'disabled'}>导出${activeMode==='live'?'完整':''}存档</button><button class="button" data-import>导入存档</button></div>${session.status==='blocked'?`<div class="notice error" role="alert"><p>${esc(session.error)} 原始存档已保留。</p>${session.rawCorruptSave!==null?'<button class="button" data-export-corrupt>备份原存档</button>':''}</div>`:''}${session.pendingLegacyRaw||session.backupError?'<div class="notice error"><p>发现待恢复的旧人生备份。</p><button class="button" data-recover-legacy>恢复较新旧人生／重试读取备份</button><button class="button" data-export-legacy>导出旧原档与交接备份</button></div>':''}<p class="save-info">进度保存在此浏览器。更换设备前，请导出备份。</p></section><section class="settings-section"><h3>入世须知</h3><p>岁月只在落下一项选择时前行。</p><div class="settings-actions"><button class="button" data-help>查看游戏说明</button>${window.location.protocol!=='file:'?'<a class="button" href="./baishi-wending-offline.html" download="百世问鼎-离线版.html">下载离线版</a>':''}</div><p class="save-info">新旅程默认联网续写。已保存的实时故事可离线阅读，原有离线旅程仍可继续。</p></section>`;
  const backups=`${recoveryCount?`<section class="settings-section"><h3>原始恢复备份</h3><p>恢复存档前保留了 ${recoveryCount} 份原始数据，可下载后妥善收藏。</p><button class="button" data-export-recovery>导出原始恢复备份</button></section>`:''}${session.legacyBackup||session.originalLegacyRaw?'<section class="settings-section"><h3>旧人生交接备份</h3><button class="button" data-export-legacy>导出旧原档与交接备份</button></section>':''}`;
  renderScreenShell(body+catalogRecovery+backups,{title:'游戏设置',back:returnScreen==='new'?'返回角色创建':returnScreen==='adventure'?'返回当前剧情':returnScreen==='home'?'返回首页':'返回当前页面'});
}

function renderNewJourney() {
  if(window.location.protocol==='file:'&&!liveBirthDraft.reincarnationRunId) {
    if(!offlineBirthDraft){view='home';return render();}
    birthNameDraft=offlineBirthDraft.name;
    const journey=getNarrativeView(offlineBirthDraft.state);
    return renderScreenShell(`${renderBirth({...journey.creation,name:birthNameDraft,revision:journey.revision,sceneId:journey.sceneId})}<p class="birth-preservation">确认入世后才切换旅程；原有旅程会保留，随时可以切回。</p><nav class="game-navigation" aria-label="创建期间的设置"><button class="small-button" data-view="settings">游戏设置</button></nav>`,{title:'踏入仙途'});
  }
  const invalid=liveSnapshot?.errorCode==='BIRTH_CONTEXT_INVALID';
  renderScreenShell(renderLiveBirth({...liveBirthDraft,origins:LIVE_ORIGINS,available:Boolean(liveSession),busy:uiBusy,invalid,error:liveError}),{title:liveBirthDraft.reincarnationRunId?'步入轮回':'踏入仙途',back:liveBirthDraft.reincarnationRunId?'返回此生结算':'返回首页'});
}

async function initializeScreens() {
  applyReadingPreferences();
  if(canReadLiveArchive) {
    try { await ensureLive(); const loaded=await liveSession.load();if(!loaded.state&&loaded.errorCode)throw Error('archive read failed'); }
    catch { liveError='无法读取实时旅程，请检查浏览器存储设置。已有离线存档仍可恢复。'; }
  }
  if(activeMode==='live'&&!liveSnapshot?.state&&state)activeMode='offline';
  else if(activeMode==='offline'&&!state&&liveSnapshot?.state)activeMode='live';
  homeReady=true;
  if(['inventory','worlds','legacies','chronicle'].includes(view)&&(!state||isJourney(state)))view='adventure';
  if(view==='adventure'&&!currentJourneySummary()&&session.status!=='blocked')view='home';
  render();
  if(view==='saves')await openSavedJourneys();
  else if(view==='adventure'&&activeMode==='live'&&liveSession)await liveSession.resume();
}

function goHome() {
  closeDialog(false);view='home';returnScreen='home';render();
  $('#main-content')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
}

async function continueJourney() {
  if(uiBusy)return;
  if(activeMode==='live'&&liveSnapshot?.state) {
    view='adventure';render();await liveSession.resume();
  } else if(state||session.status==='blocked') { setActiveMode('offline');birthNameDraft=isCreating(state)?state.life.name:'';view='adventure';render(); }
  else return openSavedJourneys();
  focusAdventure($('#birth-title')||$('#journey-current-title')||$('#main-content'));
}

async function prepareNewJourney() {
  if(uiBusy||liveSnapshot?.busy)return notify('故事正在保存，请稍候再开启新旅程。',true);
  if(!retainUnsavedOfflineLife())return;
  if(window.location.protocol==='file:')return beginRecommendedLife();
  uiBusy=true;render();
  try {
    await ensureLive();await liveSession.load();
    liveBirthDraft={name:'云归',originId:'village',expectedArchiveId:liveSnapshot?.archiveId??null};
    liveError='';view='new';returnScreen='home';
    saveCreationDraft();
  } catch {notify('暂时无法读取存档，原有旅程保持不变。',true);}
  finally {uiBusy=false;render();$('#live-name')?.focus({preventScroll:true});}
}

function askNewJourney() {
  if(!homeReady||uiBusy||liveSnapshot?.busy)return notify('故事正在保存，请稍候再开启新旅程。',true);
  if(state||liveSnapshot?.state||session.status==='blocked')return confirmAction('开启新的旅程', '<p>你将为另一个人物开启独立的修仙人生。原有旅程会保留，可从「续写此生 → 切换存档」找回。无法读取的旧档会保留原始恢复备份。</p><p>这次新开不会结算旧人物，也不会领取轮回奖励。</p>',prepareNewJourney,'保留旧旅程，开始创建');
  return prepareNewJourney();
}

async function openSavedJourneys(next=false) {
  if(uiBusy||liveSnapshot?.busy)return notify('故事正在保存，请稍候再切换旅程。',true);
  closeDialog(false);if(view!=='saves')returnScreen=view==='adventure'?'adventure':'home';
  view='saves';savedLoading=true;if(!next){savedJourneys=[];savedCursor=null;savedError='';}render();
  try {
    if(!next) {
      if(state)savedJourneys.push({id:'current',mode:'offline',active:activeMode==='offline',...summarizeJourney(state,'offline')});
      try {for(const entry of offlineJourneys.list())savedJourneys.push({id:entry.id,mode:'offline',active:false,...summarizeJourney(entry.state,'offline')});}
      catch {savedError='离线旅程目录暂时无法读取，原始数据仍保留；可继续选择下方可读取的旅程。';}
    }
    if(canReadLiveArchive) {
      await ensureLive();const page=await liveArchive.listJourneys({cursor:next?savedCursor:null,limit:20});
      savedJourneys.push(...page.entries.map(entry=>({id:entry.archiveId,mode:'live',active:activeMode==='live'&&entry.active,...summarizeJourney(entry.state,'live')})));
      savedCursor=page.cursor;
    }
  } catch(error) {savedError=[savedError,error.message?.includes('存档')?error.message:'实时旅程暂时无法读取，请保留当前进度并重试。'].filter(Boolean).join(' ');}
  finally {savedLoading=false;render();}
}

async function selectSavedJourney(id,mode) {
  if(uiBusy||liveSnapshot?.busy)return notify('故事正在保存，请稍候再切换旅程。',true);
  uiBusy=true;savedLoading=true;render();
  try {
    if(mode==='live') {
      if(!retainUnsavedOfflineLife())return;
      await ensureLive();const expected=liveSnapshot?.archiveId??null;
      const selected=await liveSession.selectJourney(id,expected);
      if(selected.archiveId!==id)throw Error('另一页面已更新旅程，请刷新列表后再选。');
      setActiveMode('live');view='adventure';await liveSession.resume();
    } else {
      if(id!=='current')session=offlineJourneys.restore(id,{...session,state});
      state=session.state;lastSaved=session.saved;saveError=session.error;birthNameDraft=isCreating(state)?state.life.name:'';
      setActiveMode('offline');view='adventure';
    }
  } catch(error) {notify(saveProblem(error),true);}
  finally {uiBusy=false;savedLoading=false;render();}
}

function notify(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, error ? 6000 : 4200);
}

function persist() {
  session = persistSession({ ...session, state }, storage);
  lastSaved = session.saved;
  saveError = session.error;
}

function replaceSession(next, originalRaw = null) {
  if(!retainUnsavedOfflineLife())return false;
  let previousRaw=null,previousBackup=null;
  try {
    previousRaw=storage.getItem(SAVE_KEY);previousBackup=storage.getItem(LEGACY_BACKUP_KEY);
    preserveOfflineProgress();
    if(storage.getItem(SAVE_KEY)!==previousRaw||storage.getItem(LEGACY_BACKUP_KEY)!==previousBackup)throw Object.assign(Error('JOURNEY_STORAGE_CONFLICT'),{code:'JOURNEY_STORAGE_CONFLICT'});
    if(previousBackup!==null)storage.removeItem(LEGACY_BACKUP_KEY);
  } catch(error){notify(saveProblem(error),true);return false;}
  setActiveMode('offline');
  session = { status: 'fresh', state: next, rawCorruptSave: null, error: '', saved: false, storageRaw: previousRaw, storageBackupRaw: null, ...([1, 2].includes(next.version) && originalRaw !== null ? { originalLegacyRaw: originalRaw } : {}) };
  offlineBirthDraft=null;
  openPanels.clear();
  preparingLife = false;
  view = 'adventure';
  birthNameDraft = isCreating(next) ? next.life.name : '';
  birthComposing = false;
  update(next, { message: false, focusStory: true, resetSupport: true, currentContext: true });
  if(!lastSaved){
    try {
      if(storage.getItem(SAVE_KEY)===previousRaw){
        if(previousBackup===null)storage.removeItem(LEGACY_BACKUP_KEY);else storage.setItem(LEGACY_BACKUP_KEY,previousBackup);
        if(storage.getItem(LEGACY_BACKUP_KEY)===previousBackup)session={...session,storageBackupRaw:previousBackup};
      }
    } catch {}
  }
  return true;
}

function beginRecommendedLife() {
  try {
    const expectedRaw=storage.getItem(SAVE_KEY),expectedBackupRaw=storage.getItem(LEGACY_BACKUP_KEY);
    const draft=createRecommendedLife({seed:newSeed()});
    offlineBirthDraft={state:draft,name:draft.life.name,expectedRaw,expectedBackupRaw};
    birthNameDraft=draft.life.name;birthComposing=false;view='new';returnScreen='home';
    render();saveCreationDraft();
  }
  catch(error) {notify(saveProblem(error),true);return;}
  $('#birth-title')?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function commitOfflineBirth(next) {
  const draft=offlineBirthDraft;
  try {
    const assertSource=()=>{
      if(storage.getItem(SAVE_KEY)!==draft.expectedRaw||storage.getItem(LEGACY_BACKUP_KEY)!==draft.expectedBackupRaw)throw Object.assign(Error('JOURNEY_STORAGE_CONFLICT'),{code:'JOURNEY_STORAGE_CONFLICT'});
    };
    assertSource();
    const raw=serializeGame(next);
    preserveOfflineProgress();
    assertSource();
    try {
      if(draft.expectedBackupRaw!==null)storage.removeItem(LEGACY_BACKUP_KEY);
      storage.setItem(SAVE_KEY,raw);
      if(storage.getItem(SAVE_KEY)!==raw)throw Error('新人生尚未保存，请检查浏览器存储空间。');
    } catch(error) {
      try {if(draft.expectedBackupRaw===null)storage.removeItem(LEGACY_BACKUP_KEY);else storage.setItem(LEGACY_BACKUP_KEY,draft.expectedBackupRaw);}catch{}
      try {if(draft.expectedRaw===null)storage.removeItem(SAVE_KEY);else storage.setItem(SAVE_KEY,draft.expectedRaw);}catch{}
      throw error;
    }
    session={status:'loaded',state:next,rawCorruptSave:null,error:'',saved:true,storageRaw:raw};
    lastSaved=true;saveError='';offlineBirthDraft=null;setActiveMode('offline');
    update(next,{alreadyPersisted:true,goAdventure:true,message:false,currentContext:true,resetSupport:true});
  } catch(error) {notify(saveProblem(error),true);}
}

function update(next, options = {}) {
  // Reject an unimportable candidate before adopting it, including old-life
  // actions. Ordinary storage failures still retain exportable in-memory play.
  try { serializeGame(next); }
  catch (error) {
    if (error.code !== 'SAVE_SIZE_LIMIT') throw error;
    notify(`${error.message} 本次行动未提交，原有进度与完整历史保持不变；可导出当前存档备份。`, true);
    return;
  }
  const previous = state;
  if (isJourney(next)) {
    const beforeIds = new Set(isJourney(previous) ? getNarrativeView(previous).blocks.map(block => block.id) : []);
    const journey = getNarrativeView(next);
    const consequence = journey.blocks.find(block => block.kind === 'result' && !beforeIds.has(block.id));
    if (isCreating(next) && (!isCreating(previous) || previous.world.generation !== next.world.generation)) birthNameDraft = next.life.name;
    state = next;
    if (!options.alreadyPersisted) persist();
    if (options.goAdventure) view = 'adventure';
    render({ resetSupport: options.resetSupport });
    if (view === 'adventure') {
      if (isCreating(next)) focusAdventure($(options.focusSelector || '#birth-title'), Boolean(options.focusSelector));
      else focusAdventure(!options.currentContext && consequence ? document.getElementById(`journey-block-${consequence.id}`) : $('#journey-current-title'));
    }
    if (options.message === false) { clearTimeout(toastTimer); $('#toast').classList.remove('show'); }
    return;
  }
  const beforeStory = previous && !isJourney(previous) && getStoryView(previous);
  const beforeResult = getPrimaryResult(beforeStory, previous?.run?.log || []);
  const afterStory = getStoryView(next);
  const active = document.activeElement;
  const controlAttribute = ['data-action', 'data-combat', 'data-reward', 'data-equip'].find(name => active?.hasAttribute(name));
  const controlValue = controlAttribute && active.getAttribute(controlAttribute);
  const controlSlot = active?.getAttribute('data-slot') ?? null;
  state = next;
  persist();
  if (options.goAdventure) view = 'adventure';
  render({ resetSupport: options.resetSupport || previous?.meta?.generation !== next.meta.generation });
  if (view === 'adventure') {
    const resultChanged = JSON.stringify(beforeResult) !== JSON.stringify(getPrimaryResult(afterStory, next.run.log));
    const sceneChanged = beforeStory?.sceneId !== afterStory?.sceneId;
    const phaseChanged = previous?.phase !== next.phase;
    const locationChanged = previous?.run?.worldId !== next.run.worldId;
    const control = controlAttribute && $(`[${controlAttribute}="${controlValue}"]${controlSlot !== null ? `[data-slot="${controlSlot}"]` : ''}:not(:disabled)`);
    let target;
    if (['ended', 'victory'].includes(next.phase)) target = phaseChanged ? $('#ending-title') : control || $('#selected-reward') || $('[data-rebirth]:not(:disabled)') || $('#ending-title');
    else if (['combat', 'event'].includes(next.phase)) target = !phaseChanged && control ? control : $(`#${next.phase}-title`);
    else if (resultChanged) target = $('#story-result-title') || $('#latest-log-title') || $('#story-scene-title');
    else if (sceneChanged || phaseChanged || locationChanged) target = $('#story-scene-title') || $('#latest-log-title');
    else target = control || (options.focusStory ? $('#story-scene-title') : null) || $('#latest-log-title');
    focusAdventure(target, Boolean(control && target === control));
  } else if (view === 'inventory' && controlAttribute === 'data-equip') {
    focusAdventure($(`#equipped-${controlValue}`) || $('#main-content'), true);
  }
  if (options.message === false) { clearTimeout(toastTimer); $('#toast').classList.remove('show'); }
  else if (state.lastMessage) notify(state.lastMessage);
}

function focusAdventure(target, keepPosition = false) {
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: keepPosition ? 'nearest' : 'start', behavior: 'instant' });
}

function captureFocusTarget(element = document.activeElement) {
  if (!element || element === document.body) return null;
  // Action identity survives a redraw; revision/state metadata does not.
  const attributes = [...element.attributes].filter(({ name }) => name.startsWith('data-') && !['data-revision', 'data-state-hash', 'data-scene-id'].includes(name));
  const selector = element.id ? `#${CSS.escape(element.id)}` : attributes.length ? element.localName + attributes.map(({ name, value }) => `[${name}="${CSS.escape(value)}"]`).join('') : null;
  return { element, selector, sceneFallback: element.matches('[data-live-choice], [data-live-start], [data-live-new], [data-live-retry], [data-live-resume], [data-live-custom-toggle], [data-live-custom-submit], [data-live-custom-field], [data-live-reincarnate]') };
}

function resolveFocusTarget(target) {
  const element = target?.element.isConnected ? target.element : target?.selector ? $(target.selector) : null;
  return element && !element.matches(':disabled') ? element : target?.sceneFallback ? $('#journey-current-title') : null;
}

function attempt(callback, options) {
  try { update(callback(), options); }
  catch (error) { notify(error.message || '这一步暂时无法进行。', true); }
}

function openDialog(title, body, actions = '', { drawer = false } = {}) {
  const dialog = $('#dialog');
  if (!dialog.open) dialogReturnTarget = captureFocusTarget();
  dialog.className = drawer ? 'paper-drawer' : '';
  dialog.innerHTML = `<header class="dialog-header"><h2 id="dialog-title" tabindex="-1">${esc(title)}</h2><button class="icon-button" data-close-dialog aria-label="关闭">${icon('close')}</button></header><div class="dialog-body">${body}</div>${actions ? `<footer class="dialog-actions">${actions}</footer>` : ''}`;
  if (!dialog.open) dialog.showModal();
  $('#dialog-title')?.focus({ preventScroll: true });
}

function closeDialog(restoreFocus = true) {
  const target = dialogReturnTarget;
  dialogReturnTarget = null;
  dialogConfirm = null;
  $('#dialog').close();
  if (restoreFocus) resolveFocusTarget(target)?.focus({ preventScroll: true });
}

function showCharacter() {
  if(activeMode==='live') { if(liveSnapshot?.state) openDialog('此身修行',renderCharacterDetails(liveCharacterSummary(liveSnapshot.state,liveCatalogs)),'',{drawer:true}); return; }
  if (isJourney(state) && !isCreating(state)) openDialog('此身修行', renderCharacterDetails(getNarrativeView(state).summary), '', { drawer: true });
}

function showHistory() {
  if(activeMode==='live') return showLiveHistory(true);
  if (isJourney(state)) openDialog('历史对话', renderJourneyHistory(getNarrativeView(state)), '', { drawer: true });
}

function confirmAction(title, body, callback, label = '确认继续') {
  dialogConfirm = callback;
  openDialog(title, body, `<button class="button ghost" data-close-dialog>再想一想</button><button class="button primary" data-confirm>${esc(label)}</button>`);
}

function showHelp() {
  if(activeMode==='live'||!state) return openDialog('入世须知','<p>每次选择先由规则确定岁月、物品、伤势与修行结果；完整剧情通过校验并保存后才显示。登仙与问鼎仍可继续人生，只有规则确认的死亡才会结算。</p><p>新增故事需要联网。最小必要的人物、当前行动与相关记忆会传至 Cloudflare；完整历史保留在本机。已缓存故事可以离线阅读，失败时保留待续状态，明确重试才会开始新请求。</p><p>出生与待续行动先保存，刷新不会重掷。历史按页读取，迁移设备请导出 .wending.jsonl 完整备份。</p>','<button class="button" data-view="settings">存档与设置</button>');
  if (state?.version === 4 && state.contentVersion === 3) return openDialog('入世须知', '<p>先为此生取名，选择出身，再看两道命格。根骨、悟性与气运总计十二点；可以锁定一道命格后重新掷骰。入世之前的结果会保存，刷新不会重掷。</p><p>出身会带来不同的牵挂与行动，命格会在旅程中开启特殊机会。机缘也有代价；从凡人到登仙，都须取得真实功法、材料，经过修行与历险。已知的伤势、折寿或必死危险会在选择前提醒。</p><p>一年三百六十天。岁月只在落下一项选择时流逝，查看人物、历史和存档不会推进时间。余寿不足以完成修行时，无法预借下一境界的寿限。</p><p>一世终结后，可以带走一项亲自学会的法门。你留下的承诺与三界成就会继续影响世界，也可能解锁新的命格和出身。死亡次数本身不发奖励。</p><p>顶部简栏可展开人物详情；历史对话保留当世与前世的完整往事。更换设备或离线游玩前，请先导出存档备份。</p>', '<button class="button" data-view="settings">存档与设置</button><button class="button primary" data-close-dialog>继续阅读</button>');
  if (isJourney(state)) return openDialog('入世须知', `${state.version === 4 ? '<p>你从十六岁的凡人开始求仙。先为这一世取名，掷骰查看根骨、悟性、气运与天赋，准备好后再入世。掷出的结果会保存，刷新页面不会重掷。</p><p>入世后，先读眼前处境与目标，再选择自己的做法。功法、修为、材料与安身之处，都要靠亲身经历取得；伤势也会影响能走的路。</p><p>药谷的危机按天推进，离谷后的修炼才会耗去数年，一年为三百六十天。普通变化随行动后果呈现；人物能够预知的重伤、燃寿和无法活着完成的危险，会在选择前提醒。</p><p>此生归宿会留下收获与教训。下一世重新求仙，可携一项真正学会的方法，也可只携记忆。留在世间的事不会因转世而消失。</p>' : '<p>先读眼前的处境，再选择自己的做法。不能行动时，会说明缺少的条件。</p><p>当前人生会继续原有的故事。若想另开独立旅程，可返回首页选择「踏入仙途」，原有旅程会保留。</p>'}<p>顶部简栏显示此身与余寿，点击可展开人物详情；「历史对话」保留已经发生的选择、后果与前世往事。阅读、打开抽屉和刷新页面都不会消耗岁月。</p><p>进度自动保存在当前浏览器。更换设备或离线游玩前，请从「游戏设置」导出备份；导入存档会先检查内容，再请你确认导入；当前旅程会保留。</p>`, '<button class="button" data-view="settings">存档与设置</button><button class="button primary" data-close-dialog>继续阅读</button>');
  openDialog('入世须知', `<p>你的这一世，从药谷旧火开始。相逢、调查与取舍，会改变谷地，也改变后来人要面对的事。</p><div class="help-tip"><strong>先看眼前之事，再落下一念。</strong><br>场景与目标指明眼前方向；选项会列出所需岁月、灵石、药材、气血或命损。无法选择的缘由也会写明。选择的后果会留在正文中，手记、人物、线索与生平都在页面下方「回看」中。资源、修为和自身余寿在「状态」中。</div><div class="help-tip"><strong>调查有取舍，岁月只有一条河。</strong><br>药谷旧火的三条调查线最多追查两条。修炼、外出和旅行也推进世界年份，可能令最后一夜提前到来；阅读、看手记与换装不耗时。倒计时按游戏中的年计算。</div><div class="help-tip"><strong>修行是此生的另一条路。</strong><br>在页面下方「修行」中闭关、休息、炼丹或自由历练。修为满足条件后可尝试破境，突破提高寿限。主线结果确定后，仍可继续修行、问道三界，或归隐转世。</div><div class="help-tip"><strong>功法与法器要亲自装配。</strong><br>从「修行 → 功法与法器」中选择一门本命功法、两个神通与一件法器，再返回当前剧情。身在幽冥或天界时，可回看药谷故事；回到人间才能继续作出谷中的选择。</div><div class="help-tip"><strong>留意余寿和气血。</strong><br>燃寿强攻损耗寿元，延寿丹每世最多服用两次。战斗需先分胜负或遁走，才能继续剧情。</div><div class="help-tip"><strong>转世，走进自己改变的世界。</strong><br>医谷共守、宗门接管与焚种迁民，会通向不同的后世事务。人物随世界年份老去，新的你也有新的身份。寿尽、陨落或归隐后，先从真实经历产生的候选中明确选择一项旧途奖励，再按提示交接进入对话新人生；下一世只沿用一项情境方法，已得传承历史、世界因果与三界道证保留。</div><div class="help-tip"><strong>问鼎三界。</strong><br>取得人间、幽冥、天界的三枚道证，修至登仙，在天界挑战三界共主。可随时从「修行 → 三界山河」查看长远目标。</div><p>旧存档的当世沿旧途继续，结束此生并转世后进入新篇，不会补写未曾经历的药谷往事。进度自动保存在当前浏览器；更换设备前，请在剧情下方的「游戏设置」中导出备份。</p>`, '<button class="button primary" data-close-dialog>我已明了</button>');
}

function render({ resetSupport = false, focusSelector = null } = {}) {
  rememberScreen();
  if(view==='home') {
    $('#app').innerHTML=renderTitleScreen({summary:currentJourneySummary(),loading:!homeReady,error:liveError||saveError,hasOtherSaves:Boolean(state||liveSnapshot?.state),version:appVersion});
    return;
  }
  if(view==='settings')return renderSettingsPage();
  if(view==='new')return renderNewJourney();
  if(view==='saves')return renderScreenShell(renderJourneyList({entries:savedJourneys,cursor:savedCursor,loading:savedLoading,error:savedError}),{title:'续写此生',back:returnScreen==='adventure'?'返回当前剧情':'返回首页'});
  if(activeMode==='live') return renderLiveApp();
  if (resetSupport) openPanels.clear();
  else document.querySelectorAll('details[data-panel-key]').forEach(panel => openPanels.set(panel.dataset.panelKey, panel.open));
  const journey = isJourney(state) ? getNarrativeView(state) : null;
  const story = state && !journey && getStoryView(state);
  const timed = story?.id === 'old-fire' && story.status === 'active' && story.deadlineYear !== null;
  const clock = journey ? `${state.version === 4 ? `第 ${num(journey.summary.generation)} 世 · ` : ''}道历 ${num(journey.summary.year)} 年` : timed ? `距封谷 ${num(Math.max(0, story.yearsRemaining))} 年` : state ? `第 ${num(state.meta.generation)} 世 · ${num(state.run.age)} 岁` : '旧存档待恢复';
  const standalone = view !== 'adventure';
  const returnLabel = state?.phase === 'combat' ? '返回未完成战斗' : state?.phase === 'event' ? '返回未完成际遇' : isCreating(state) ? '返回取名掷骰' : preparingLife ? '返回转世选择' : '返回当前剧情';
  const identity = journey && !isCreating(state) ? renderIdentityBar(journey.summary) : `<div><h1>百世问鼎</h1><p class="paper-clock">${esc(clock)}</p></div>`;
  $('#app').innerHTML = `<div class="paper-page${journey ? ' paper-page-immersive' : ''}"><header class="paper-top${journey ? ' paper-top-immersive' : ''}">${identity}</header>
    <main id="main-content" class="paper-main" tabindex="-1">${saveError ? `<div class="notice error" role="alert"><p>${esc(saveError)}${session.status === 'blocked' ? ' 原存档未被覆盖，自动保存已暂停。' : ''}</p>${session.rawCorruptSave !== null ? '<button data-export-corrupt class="button">备份原存档</button>' : ''}${state ? '<button data-export class="button">导出当前进度</button>' : ''}${session.pendingLegacyRaw || session.backupError ? '<button data-recover-legacy class="button">恢复较新旧人生／重试读取备份</button><button data-export-legacy class="button">导出较新旧人生备份</button>' : ''}</div>` : ''}
    ${standalone ? `<div class="paper-return"><button class="small-button" data-view="adventure">${icon('arrow', 14)}${esc(returnLabel)}</button></div>` : ''}
    ${session.status === 'blocked' ? renderRecovery() : journey ? isCreating(state) ? renderBirth({ ...journey.creation, name: birthNameDraft, revision: journey.revision, sceneId: journey.sceneId }) : renderJourney(journey) : preparingLife ? renderSetup() : renderView()}
    </main>${renderGameNavigation({history:Boolean(journey&&(!isCreating(state)||journey.summary.generation>1))})}<footer id="save-status" class="paper-footer">${lastSaved && !saveError ? '进度已自动保存' : state ? '请及时导出备份' : '岁月只在落子时前行'}</footer></div>`;
  document.querySelectorAll('details[data-panel-key]').forEach(panel => {
    if (openPanels.has(panel.dataset.panelKey)) panel.open = openPanels.get(panel.dataset.panelKey);
  });
  if (focusSelector) focusAdventure($(focusSelector), true);
}

function renderRecovery() {
  return `<section class="paper-recovery"><h2>先妥善收好旧日的故事</h2><p>本地存档未能读取。你可以先备份原始数据，再导入有效存档，或明确选择重新开始。</p>${session.rawCorruptSave === null ? '<p>浏览器未提供可读取的原始数据；未创建新人生，也未写入存档。</p>' : session.rawCorruptSave === '' ? '<p>原存档为空字符串，仍可下载一份原样备份。</p>' : ''}<div class="paper-recovery-actions">${session.rawCorruptSave !== null ? '<button class="button" data-export-corrupt>备份原存档</button>' : ''}<button class="button" data-import>导入已有存档</button><button class="button" data-new-game>明确重新开始</button></div></section>`;
}

function renderUtilities(story) {
  return `<section class="paper-utilities" aria-label="按需查看"><details data-panel-key="status" class="paper-utility"><summary>状态</summary><div class="paper-utility-body">${renderStatus()}</div></details><details data-panel-key="review" class="paper-utility"><summary>回看</summary><div class="paper-utility-body">${renderStoryRecords(story)}${renderChronicle()}</div></details><details data-panel-key="practice" class="paper-utility"><summary>修行</summary><div class="paper-utility-body">${renderSupportingActions(story)}<div class="story-support-links"><button class="button" data-view="inventory">功法与法器</button><button class="button" data-view="worlds">三界山河</button><button class="button" data-view="legacies">轮回传承</button></div></div></details></section>`;
}

function renderStatus() {
  const stats = getStats(state);
  return `<h2>此刻的${esc(state.run.name)}</h2><p>${esc(row(ORIGINS, state.run.originId).name)} · ${esc(row(PATHS, state.run.pathId).name)} · ${esc(REALMS[state.run.realmIndex].name)}境</p>${resourceStrip()}<div class="compact-progress">${cultivationProgress(stats)}</div><dl class="paper-status"><div><dt>年龄 · 自身余寿</dt><dd>${num(state.run.age)} 岁 · ${num(Math.max(0, stats.remainingLife))} 年</dd></div><div><dt>寿限 · 命损</dt><dd>${num(stats.lifeLimit)} 年 · ${num(state.run.lifeDamage)} 年</dd></div><div><dt>攻势 · 防御</dt><dd>${num(stats.attack)} · ${num(stats.defense)}</dd></div><div><dt>世界概况</dt><dd>${esc(row(WORLDS, state.run.worldId).name)} · 道历 ${num(state.meta.worldYear)} 年 · 道证 ${state.meta.proofs.length} / 3</dd></div></dl><p class="micro-label">封谷期限与自身余寿分别计算。阅读、查看与换装不耗时。</p>`;
}

function renderSetup() {
  const inherited = state?.meta.legacyIds || [];
  const nextGeneration = state ? state.meta.generation + 1 : 1;
  return `<section class="setup-box"><header class="setup-heading"><h2>${state ? '再续一世仙缘' : '一念，入仙途'}</h2><span>第 ${num(nextGeneration)} 世 · 灵台初醒</span></header>${state ? '<p class="setup-intro">肉身归于尘土，所行之事留在世间。选择新的出身，带着前世的回响重新启程。</p>' : ''}${state && getStoryView(state)?.outcome ? renderStoryOutcome(getStoryView(state)) : ''}<p class="setup-story-intro">${state ? '转世会让世界再过十六年。谷地的往事仍在，新的人生将面对不同的后续。' : '你将遇见沈芷、陆槐与温渡，在证言、账册与地脉之间追查药谷旧案。三种修行之路各有解法，谷地的命运由你取舍。'}</p><div class="setup-name"><label for="dao-name">你的道号</label><input id="dao-name" autocomplete="off" maxlength="24" placeholder="为此生取一个名字" value="${esc(setup.name)}" /><span class="micro-label">十六岁，故事从此刻开始。</span></div><div class="selection-title">${icon('sword', 14)}选择修行之路</div><div class="selection-grid">${PATHS.map(path => `<button class="select-card ${setup.pathId === path.id ? 'selected' : ''}" data-path="${path.id}" aria-pressed="${setup.pathId === path.id}"><div class="select-icon">${icon(PATH_ICONS[path.id], 25)}</div>${setup.pathId === path.id ? `<span class="selection-tick">${icon('check', 14)}</span>` : ''}<h3>${esc(path.name)}</h3><p>${esc(path.description)}</p></button>`).join('')}</div><div class="selection-title">${icon('people', 14)}选择此世出身</div><div class="selection-grid origin-grid">${ORIGINS.map(origin => `<button class="select-card ${setup.originId === origin.id ? 'selected' : ''}" data-origin="${origin.id}" aria-pressed="${setup.originId === origin.id}">${setup.originId === origin.id ? `<span class="selection-tick">${icon('check', 13)}</span>` : ''}<h3>${esc(origin.name)}</h3><p>${esc(origin.description)}</p></button>`).join('')}</div>${inherited.length ? `<div class="selection-title">${icon('lotus', 14)}带入前世传承 <span class="spacer"></span><span class="micro-label">${setup.legacyIds.length} / 2</span></div><div class="legacy-select-grid">${inherited.map(id => { const legacy = row(LEGACIES, id); return `<button class="select-card ${setup.legacyIds.includes(id) ? 'selected' : ''}" data-carry="${id}" aria-pressed="${setup.legacyIds.includes(id)}"><h3>${esc(legacy.name)}</h3><p>${esc(legacy.description)}</p>${setup.legacyIds.includes(id) ? `<span class="selection-tick">${icon('check', 14)}</span>` : ''}</button>`; }).join('')}</div>` : ''}<div class="setup-actions"><p>无需注册，随时停下。修行进度自动保存在此设备，支持导出备份。</p><button class="button primary large" data-start>${state ? '转世，再入仙途' : '执此一念，踏入仙途'} ${icon('arrow', 17)}</button></div>${state ? '<button class="small-button" data-cancel-setup>返回此生结算</button>' : ''}</section>`;
}

function renderView() {
  if (view === 'worlds') return renderWorlds();
  if (view === 'inventory') return renderInventory();
  if (view === 'legacies') return renderLegacies();
  if (view === 'chronicle') return renderChronicle();
  return renderAdventure();
}

function heading(title, description, right = '') {
  return `<header class="view-heading"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${right}</header>`;
}

function resourceStrip() {
  const stats = getStats(state);
  return `<div class="resource-strip" aria-label="角色资源"><div class="resource life">${icon('hourglass')}<div><div class="resource-label">剩余寿元</div><div class="resource-value ${stats.remainingLife <= 12 ? 'text-red' : ''}">${num(Math.max(0, stats.remainingLife))}<small>年</small></div></div></div><div class="resource">${icon('heart')}<div><div class="resource-label">气血</div><div class="resource-value">${num(state.run.hp)}<small>/ ${num(stats.maxHp)}</small></div></div></div><div class="resource">${icon('gem')}<div><div class="resource-label">灵石</div><div class="resource-value">${num(state.run.spirit)}<small>枚</small></div></div></div><div class="resource">${icon('leaf')}<div><div class="resource-label">灵药</div><div class="resource-value">${num(state.run.herbs)}<small>株</small></div></div></div></div>`;
}

function renderSupportingActions(story = null) {
  const stats = getStats(state);
  const actionDetails = { explore: { icon: 'compass', description: '寻访山河，遇见此世的机缘。' }, train: { icon: 'lotus', description: `增长 ${num(stats.training)} 修为，凝练自身道心。` }, breakthrough: { icon: 'spark', description: stats.nextRealm ? `冲击${stats.nextRealm.name}，成功率 ${Math.round(stats.breakthroughChance * 100)}%。` : '已臻登仙，前往三界完成最后的试炼。' }, rest: { icon: 'leaf', description: '疗愈气血，暂歇于山风与月色。' }, alchemy: { icon: 'cauldron', description: `寿限 +${stats.realm.trainYears * 2} 年；3 灵药 / 15 灵石（${state.run.elixirsUsed}/2）。` }, retire: { icon: 'feather', description: '收束此生经历，为来世留下回响。' } };
  const actions = `<div class="action-grid">${['explore', 'train', 'breakthrough', 'rest', 'alchemy', 'retire'].map(type => {
    const info = getActionInfo(state, type);
    const detail = actionDetails[type];
    return `<button class="action-card ${!story && type === 'explore' ? 'primary' : ''}" data-action="${type}" ${info.enabled ? '' : 'disabled'}><div class="action-top">${icon(detail.icon, 23)}<span class="action-years">${info.years ? `历时 ${info.years} 年` : type === 'retire' ? '一生结算' : '不耗年份'}</span></div><h3>${esc(info.label)}</h3><p>${esc(info.enabled ? detail.description : info.reason)}</p><span class="support-cost">${esc(info.costText)}${type === 'alchemy' ? ` · 药材当前 ${num(state.run.herbs)} · 灵石当前 ${num(state.run.spirit)}` : ''}</span><span class="arrow-corner">${icon('arrow', 14)}</span></button>`;
  }).join('')}</div><p class="adventure-note">${icon('hourglass', 13)}${story?.status === 'active' ? '修炼与外出使用同一段岁月，也可能让谷中事态推进。' : '岁月随行动流逝。'}查看与换装不会耗时；自由历练可能遇到际遇或战斗，处理完后即可再续剧情。</p>`;
  return actions;
}

function cultivationProgress(stats) {
  return stats.nextRealm ? `<span>迈向${esc(stats.nextRealm.name)}</span><strong>${num(state.run.cultivation)} / ${num(stats.need)} 修为</strong><div class="meter" role="progressbar" aria-label="突破修为" aria-valuemin="0" aria-valuemax="${stats.need}" aria-valuenow="${Math.min(state.run.cultivation, stats.need)}"><span style="width:${pct(state.run.cultivation, stats.need)}%"></span></div>` : '<span>登仙已成</span><strong>三界道证 ' + state.meta.proofs.length + ' / 3</strong>';
}

function renderAdventure() {
  const story = getStoryView(state);
  let content;
  if (state.phase === 'event') content = `${renderStoryInterruption(story, 'event', state.run.log)}${renderEvent()}`;
  else if (state.phase === 'combat') content = `${renderStoryInterruption(story, 'combat', state.run.log)}${renderCombat()}`;
  else if (['ended', 'victory'].includes(state.phase)) content = renderEnding();
  else if (story) content = `${renderStoryScene(story, { ...state.run, remainingLife: Math.max(0, getStats(state).remainingLife) }, state.run.log)}${story.paused && state.run.worldId !== 'mortal' ? '<div class="story-home"><p>谷中事务须回到人间才能继续。返回人间耗时两年，也推进剧情中的岁月。</p><button class="button" data-travel="mortal">返回人间 · 2 年</button></div>' : ''}${story.status !== 'active' && !story.choices.length ? renderStoryOutcome(story) : ''}`;
  else {
    const latest = state.run.log.at(-1);
    content = `<section class="paper-free"><p class="story-location">${esc(row(WORLDS, state.run.worldId).location)}</p><h2>此生沿旧途继续</h2><p>你的经历、资源与因果完整保留。可在下方「修行」继续历练；结束此生并转世后进入新篇。</p>${latest ? `<section class="paper-feedback" role="status"><h3 id="latest-log-title" tabindex="-1">${esc(latest.title)}</h3><p>${esc(latest.text)}</p></section>` : ''}</section>`;
  }
  return `<p class="legacy-rule-note">此生沿旧规继续；结束后直接交接到对话新人生。可在「游戏设置」备份存档，返回首页可开启独立的新旅程。</p>${content}${renderUtilities(story)}`;
}

function renderLog(limit = 5) {
  const entries = [...state.run.log].reverse().slice(0, limit);
  return `<section class="life-log" aria-label="修行手记"><div class="log-title"><h2>修行手记</h2>${view !== 'chronicle' ? '<button class="small-button" data-view="chronicle">展开生平 ' + icon('arrow', 13) + '</button>' : `<span class="micro-label">最近 ${entries.length} 条经历</span>`}</div><div class="log-list">${entries.map(entry => `<article class="log-entry"><div class="log-age">${num(entry.age)} 岁</div><div><h4>${esc(entry.title)}</h4><p>${esc(entry.text)}</p></div></article>`).join('')}</div></section>`;
}

function choiceCosts(choice) {
  const cost = choice.cost || {};
  const bits = [];
  if (cost.years) bits.push(`额外 ${cost.years} 年`);
  if (cost.spirit) bits.push(`${cost.spirit} 灵石（当前 ${num(state.run.spirit)}）`);
  if (cost.herbs) bits.push(`${cost.herbs} 药材（当前 ${num(state.run.herbs)}）`);
  if (cost.hp) bits.push(`${cost.hp} 气血（当前 ${num(state.run.hp)}）`);
  if (cost.lifeDamage) bits.push(`燃寿 ${cost.lifeDamage} 年（自身余寿 ${num(Math.max(0, getStats(state).remainingLife))} 年）`);
  if (typeof choice.chance === 'number') bits.push(`成功率 ${Math.round(choice.chance * 100)}%`);
  return bits.length ? bits.map(bit => `<span>${esc(bit)}</span>`).join('') : '<span>无额外消耗</span>';
}

function renderEvent() {
  const event = row(EVENTS, state.eventId);
  if (!event) return '<div class="notice error">当前际遇内容无法读取，请导出存档并重新加载。</div>';
  return `<section class="event-panel"><div class="event-top"><span class="event-decoration" aria-hidden="true">缘</span><div class="event-category">${icon('feather', 15)}${esc(event.tag || '山河际遇')}<span class="spacer"></span><span class="micro-label">${esc(row(WORLDS, state.run.worldId).name)}</span></div><h2 id="event-title" tabindex="-1">${esc(event.title)}</h2><p class="event-body">${esc(event.body)}</p></div><div class="choices">${getEventChoices(state).map((choice, index) => `<button class="choice" data-choice="${esc(choice.id)}" ${choice.enabled ? '' : 'disabled'}><span class="choice-index">${String(index + 1).padStart(2, '0')}</span><div><h3>${esc(choice.label)}</h3><p>${esc(choice.description)}</p><div class="choice-cost">${choiceCosts(choice)}</div>${choice.enabled ? '' : `<p class="choice-reason">${esc(choice.reason)}</p>`}</div>${icon('chevron', 14)}</button>`).join('')}</div><p class="event-footer">${icon('lotus', 12)} 一念抉择，也许会在下一世与你重逢。</p></section>`;
}

function renderCombat() {
  const combat = state.combat;
  const enemy = row(ENEMIES, combat.enemyId);
  const stats = getStats(state);
  const heavy = combat.round % 3 === 0;
  return `<section class="battle-card"><div class="battle-head"><div class="section-label">${combat.challengeId ? '问道试炼' : '狭路相逢'} · 第 ${num(combat.round)} 回合</div><div class="battle-enemy">${icon(combat.challengeId ? 'gate' : 'sword', 39)}</div><h2 id="combat-title" tabindex="-1">${esc(enemy.name)}</h2><p>${esc(enemy.description)}</p><div class="battle-health"><div class="meter-label"><span>对手气血</span><strong>${num(combat.enemyHp)} / ${num(combat.enemyMaxHp)}</strong></div><div class="meter red"><span style="width:${pct(combat.enemyHp, combat.enemyMaxHp)}%"></span></div></div><div class="intent ${heavy ? 'heavy' : ''}">${icon(heavy ? 'flame' : 'eye', 15)}${heavy ? '危险预兆：对手即将发动重击' : `敌方意图：${esc(enemy.intent || '蓄力试探，寻隙进攻')}`}</div></div><div class="battle-player"><span>你的气血 <b>${num(state.run.hp)} / ${num(stats.maxHp)}</b></span><span>防御 ${num(stats.defense)}</span>${combat.focus ? `<span class="text-gold">已蓄势 × ${num(combat.focus)}</span>` : ''}</div>${renderCombatActions(state)}<div class="battle-log" aria-label="战斗记录">${combat.log.slice(-5).map(line => `<p>${esc(line)}</p>`).join('')}</div></section>`;
}

function renderEnding() {
  const summary = state.summary;
  const victory = state.phase === 'victory';
  const options = summary.legacyOptions.filter(id => row(LEGACIES, id));
  return `<section class="ending"><span class="eyebrow">${victory ? '三界归一 · 万世有终' : '一世因果，皆有回响'}</span><div class="ending-symbol" aria-hidden="true">${victory ? '鼎' : '归'}</div><h2 id="ending-title" tabindex="-1">${victory ? '你已问鼎三界' : esc(summary.title)}</h2><p>${esc(summary.text)}</p>${renderStoryOutcome(getStoryView(state))}<p>此生先按旧规择定一项真实传承。下一世只沿用一项情境方法，收藏、道证、因果与生平全部保留；交接前会先保存可恢复的旧档备份。</p><div class="ending-stats"><div><b>${num(summary.age)}</b><span>此生岁月</span></div><div><b>${esc(REALMS[summary.realmIndex].name)}</b><span>最终境界</span></div><div><b>${state.meta.proofs.length} / 3</b><span>三界道证</span></div></div>${summary.deeds.length ? `<div class="deeds">${summary.deeds.slice(-8).map(deed => `<span class="deed">${esc(deed)}</span>`).join('')}</div>` : ''}${summary.worldChanges.length ? `<p class="tiny muted">${esc(summary.worldChanges.slice(-2).join(' '))}</p>` : ''}${summary.selectedLegacyId ? `<div id="selected-reward" class="selected-reward" tabindex="-1">${icon('check', 16)} 已将「${esc(row(LEGACIES, summary.selectedLegacyId).name)}」记入神魂传承。</div>` : options.length ? `<div class="selection-title">${icon('lotus', 15)}选择一项此生传承</div><div class="legacy-select-grid">${options.map(id => { const legacy = row(LEGACIES, id); return `<button class="select-card" data-reward="${id}"><h3>${esc(legacy.name)}</h3><p>${esc(legacy.description)}</p><p class="text-gold">${esc(legacy.source)}</p></button>`; }).join('')}</div>` : '<p class="tiny muted">此生暂无新的神魂传承。已获得的道证与世界因果会继续保留。</p>'}${victory ? '<p>每一世未竟的心愿，都汇入了此刻。旧日天规由你重写，轮回的故事仍可继续。</p>' : ''}<div class="ending-button-row">${getLegacyBridgeChoices(state).map(choice => `<button class="button primary large" data-legacy-bridge="${esc(choice.id)}">${esc(choice.label)}<span class="tiny">${esc(choice.detail)}</span></button>`).join('')}<button class="button ghost" data-export-legacy>导出旧原档与交接备份</button><button class="button ghost" data-export>${icon('download', 16)}备份此刻</button></div></section>`;
}

function renderWorlds() {
  const free = state.phase === 'adventure';
  return `${heading('三界山河', '人间立道，幽冥掌命，天界问鼎。每一枚道证，都是轮回无法抹去的经历。')}<div class="world-grid">${WORLDS.map(world => {
    const challenge = CHALLENGES.find(item => item.worldId === world.id && !item.final);
    const current = state.run.worldId === world.id;
    const eligible = state.run.realmIndex >= world.minRealm;
    const proven = state.meta.proofs.includes(world.id);
    return `<article class="world-card ${current ? 'current' : ''}" data-world="${world.id}"><div class="world-head"><div class="world-glyph">${icon(WORLD_ICONS[world.id], 25)}</div><div><h2>${esc(world.name)}</h2><p>${esc(world.location)} · ${esc(world.subtitle)}</p></div><span class="badge ${proven ? 'gold' : current ? '' : 'dim'}">${proven ? '道证已得' : current ? '身在此界' : `${REALMS[world.minRealm].name}可入`}</span></div><p class="world-copy">${esc(world.description)}</p><div class="world-actions">${!current ? `<button class="button" data-travel="${world.id}" ${free && eligible ? '' : 'disabled'}>${icon(eligible ? 'compass' : 'lock', 15)}前往${esc(world.name)}</button>` : '<span class="badge">当前所在</span>'}${challenge && !proven ? `<button class="button ${current ? 'primary' : 'ghost'}" data-challenge="${challenge.id}" ${free && current && state.run.realmIndex >= challenge.minRealm ? '' : 'disabled'}>${icon('flag', 15)}${esc(challenge.name)}</button>` : `<span class="small-button text-gold">${icon('check', 15)}${esc(world.name)}道证跨世保留</span>`}<span class="micro-label">${!current ? '游历耗时 2 年' : challenge && !proven ? `${REALMS[challenge.minRealm].name}境可挑战` : '此界仍有未尽的机缘'}</span></div></article>`;
  }).join('')}</div><section class="finale-card"><h2>三界问鼎</h2><p>集齐三界道证，踏入登仙境，在天界向旧日共主发起最后的挑战。通关不限制重生次数，你可以用这一世完成未竟之愿。</p><div class="proof-row">${WORLDS.map(world => `<span class="proof-token ${state.meta.proofs.includes(world.id) ? 'earned' : ''}">${icon(state.meta.proofs.includes(world.id) ? 'check' : 'lock', 13)}${esc(world.name)}道证</span>`).join('')}</div><button class="button primary" data-finale ${free && state.meta.proofs.length === 3 && state.run.realmIndex >= 5 && state.run.worldId === 'celestial' ? '' : 'disabled'}>${icon('trophy', 16)}挑战三界共主</button><p class="micro-label" style="margin-top:12px">要求：三枚道证 · 登仙境 · 身在天界</p></section>`;
}

function statText(item) {
  const names = { attack: '攻势', defense: '防御', hp: '气血上限', training: '修行收益', burn: '燃寿威力', healing: '疗愈' };
  return Object.entries(item.stats || {}).filter(([, value]) => value).map(([key, value]) => `<span>${esc(names[key] || key)} +${num(value)}</span>`).join('');
}

function renderInventory() {
  const loadout = state.run.loadout;
  const equipped = [loadout.art, ...loadout.skills, loadout.artifact];
  const owned = state.run.items.map(id => row(ITEMS, id)).filter(Boolean);
  const slots = [{ title: '本命功法', id: loadout.art }, { title: '神通 · 一', id: loadout.skills[0] }, { title: '神通 · 二', id: loadout.skills[1] }, { title: '随身法器', id: loadout.artifact }];
  const stats = getStats(state);
  return `${heading('功法与法器', '道途万千，取舍在心。有限的装配，构成这一世独有的修行之路。')}<div class="equipment-strip">${slots.map(slot => `<div class="slot"><small>${slot.title}</small><b>${esc(row(ITEMS, slot.id)?.name || '尚未装配')}</b><p>${slot.id ? '当前生效' : '历练可获新机缘'}</p></div>`).join('')}</div><div class="inventory-summary">${icon('sword', 16)}<span>攻势 ${num(stats.attack)}</span><span>防御 ${num(stats.defense)}</span><span>气血上限 ${num(stats.maxHp)}</span><span class="spacer"></span><span>已得 ${owned.length} 件</span></div><div class="item-grid">${owned.map(item => `<article class="item-card"><div class="item-top"><h3 class="rarity-${item.rarity}">${esc(item.name)}</h3><span class="badge ${item.rarity === 'epic' ? 'gold' : 'dim'}">${{ art: '功法', skill: '神通', artifact: '法器' }[item.kind]}</span></div><p>${esc(item.description)}</p><div class="item-stats">${statText(item)}</div><div class="item-actions">${equipped.includes(item.id) ? `<span id="equipped-${item.id}" class="small-button" tabindex="-1">${icon('check', 14)}已装配</span>` : item.kind === 'skill' ? [0, 1].map(slot => `<button class="button" data-equip="${item.id}" data-slot="${slot}" ${state.phase === 'adventure' ? '' : 'disabled'}>装入神通${slot ? '二' : '一'}</button>`).join('') : `<button class="button" data-equip="${item.id}" ${state.phase === 'adventure' ? '' : 'disabled'}>装配${item.kind === 'art' ? '功法' : '法器'} ${icon('arrow', 12)}</button>`}</div></article>`).join('')}</div>`;
}

function renderLegacies() {
  return `${heading('轮回传承', '肉身终有大限，神魂记得来路。每次转世，最多携带两项已得传承。', `<span class="badge gold">${state.meta.legacyIds.length} / ${LEGACIES.length}</span>`)}<p class="legacy-intro">传承来自修行中的真实经历。寿尽后选择一项新传承，重生时再决定带上哪两项；已取得的三界道证与世界因果会自动延续。药谷的结果与承诺也将留下，成为后世要面对的事。</p><div class="item-grid">${LEGACIES.map(legacy => {
    const owned = state.meta.legacyIds.includes(legacy.id);
    const active = state.run.selectedLegacies.includes(legacy.id);
    return `<article class="item-card legacy-card ${owned ? '' : 'locked'}"><div class="item-top"><h3>${esc(legacy.name)}</h3>${icon(owned ? 'lotus' : 'lock', 19)}</div><p>${esc(legacy.description)}</p><div class="legacy-source">${esc(legacy.source)}</div><div class="item-actions"><span class="badge ${active ? 'gold' : owned ? '' : 'dim'}">${active ? '此世携带' : owned ? '已入传承库' : '尚待此世机缘'}</span></div></article>`;
  }).join('')}<header class="section-header"><h2>世间仍有回响</h2></header>${state.meta.worldFlags.length ? state.meta.worldFlags.map(id => `<article class="chronicle-card"><h3>${esc(WORLD_FLAGS[id].name)}</h3><p>${esc(WORLD_FLAGS[id].description)}</p></article>`).join('') : '<div class="empty-state">' + icon('feather', 28) + '<p>你留下的宗门、药谷、旧墓与因果，将在这里被记住。</p></div>'}`;
}

function renderChronicle() {
  const history = [...state.meta.history].reverse();
  return `${heading('百世生平', '岁月会带走肉身，选择会留在山河。')}<div class="inventory-summary">${icon('scroll', 16)}<span>第 ${num(state.meta.generation)} 世</span><span>道历 ${num(state.meta.worldYear)} 年</span><span>问鼎 ${num(state.meta.victories)} 次</span></div>${history.length ? `<header class="section-header"><h2>旧日人生</h2></header>${history.map(renderPastLife).join('')}` : '<p class="legacy-intro">你的第一世仍在继续。每一次修行与相逢，都在写下这本生平。</p>'}${renderLog(200)}`;
}

function renderPastLife(life) {
  const legacy = row(LEGACIES, life.selectedLegacyId);
  const entries = life.log || [];
  return `<article class="chronicle-card"><header><h3>第 ${num(life.generation)} 世 · ${esc(life.name)}</h3><span class="badge ${life.cause === 'victory' ? 'gold' : 'dim'}">${esc(CAUSES[life.cause] || life.cause)}</span></header><p>${num(life.age)} 岁 · ${esc(REALMS[life.realmIndex].name)}境</p>${life.deeds.length ? `<div class="deeds">${life.deeds.slice(-7).map(deed => `<span class="deed">${esc(deed)}</span>`).join('')}</div>` : '<p>有人踏遍三界，有人归隐山林。这一生，也曾来过。</p>'}${legacy ? `<p class="history-legacy">${icon('lotus', 13)} 此生传承：${esc(legacy.name)}</p>` : ''}${entries.length ? `<details class="history-details" data-panel-key="history-${life.generation}"><summary>回看此世关键经历 <span>${entries.length} 则</span></summary><ol>${entries.map(entry => `<li><div class="history-date">${num(entry.age)} 岁 · 道历 ${num(entry.year)} 年</div><h4>${esc(entry.title)}</h4><p>${esc(entry.text)}</p></li>`).join('')}</ol></details>` : ''}</article>`;
}

function downloadText(filename, text, mime = 'application/json;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportGame() {
  if(activeMode==='live') return exportLiveGame();
  if (!state) return notify('尚无修行进度可导出。', true);
  try {
    const generation = isJourney(state) ? state.world.generation : state.meta.generation;
    const age = isJourney(state) ? getNarrativeView(state).summary.age : state.run.age;
    downloadText(`百世问鼎-第${generation}世-${age}岁.json`, serializeGame(state));
    notify('存档已导出，请妥善保存。');
  }
  catch (error) { notify(`导出失败：${error.message}`, true); }
}

function showBirthNameError(message = '') {
  const status = $('#birth-name-error');
  if (status) status.textContent = message;
}

function saveBirthName() {
  const birth=currentBirth();
  if (!isCreating(birth) || birthComposing) return;
  if (birthNameDraft === birth.life.name) { showBirthNameError(); return; }
  try {
    const result = chooseCultivation(birth, { revision: birth.revision, sceneId: birth.scene.nodeId, choiceId: 'birth-name', name: birthNameDraft });
    if (result.kind !== 'applied') { showBirthNameError(result.message); return; }
    serializeGame(result.state);
    const previousError = saveError;
    if(view==='new'&&offlineBirthDraft){offlineBirthDraft.state=result.state;offlineBirthDraft.name=birthNameDraft;saveCreationDraft();}
    else {state=result.state;persist();}
    showBirthNameError();
    document.querySelectorAll('[data-birth-reroll], [data-birth-start], [data-birth-origin], [data-birth-lock]').forEach(button => { button.dataset.revision = String(result.state.revision); });
    const saveStatus = $('#save-status');
    if (saveStatus) saveStatus.textContent = lastSaved && !saveError ? '进度已自动保存' : '请及时导出备份';
    if (saveError && saveError !== previousError) notify(saveError, true);
  } catch (error) { showBirthNameError(error.message); }
}

function chooseBirth(choiceId, data) {
  const birth=currentBirth();
  if (!isCreating(birth) || birthComposing) return;
  try {
    const result = chooseCultivation(birth, { revision: Number(data.revision), sceneId: data.sceneId, choiceId, ...(choiceId === 'birth-start' ? { name: birthNameDraft } : {}), ...(choiceId === 'birth-origin' ? { originId: data.birthOrigin } : {}), ...(choiceId === 'birth-lock' ? { talentId: data.birthLock } : {}) });
    if (result.kind !== 'applied') {
      if (choiceId === 'birth-start') { showBirthNameError(result.message); $('#birth-name')?.focus({ preventScroll: true }); }
      return notify(result.message, true);
    }
    const focusSelector = choiceId === 'birth-reroll' ? '[data-birth-reroll]' : choiceId === 'birth-origin' ? `[data-birth-origin="${data.birthOrigin}"]` : choiceId === 'birth-lock' ? `[data-birth-lock="${data.birthLock}"]` : null;
    if(view==='new'&&offlineBirthDraft) {
      if(choiceId==='birth-start')return commitOfflineBirth(result.state);
      offlineBirthDraft.state=result.state;render();saveCreationDraft();
      if(focusSelector)focusAdventure($(focusSelector),true);
      return;
    }
    update(result.state, { goAdventure: true, message: false, ...(focusSelector ? { focusSelector } : {}) });
  } catch (error) { notify(error.message || '暂时无法准备这一世。', true); }
}

document.addEventListener('input', event => {
  if(event.target.id==='live-name'){liveBirthDraft.name=event.target.value;saveCreationDraft();}
  if(event.target.id==='live-custom-action'){const draft=currentLiveActionDraft();draft.text=event.target.value;draft.error='';const error=$('#live-custom-error');if(error){error.textContent='';error.hidden=true;}}
  if (event.target.id === 'dao-name') setup.name = event.target.value;
  if (event.target.id === 'birth-name' && isCreating(currentBirth())) {
    birthNameDraft = event.target.value;
    if(view==='new'&&offlineBirthDraft){offlineBirthDraft.name=birthNameDraft;saveCreationDraft();}
    if (!event.isComposing) saveBirthName();
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='live-origin'){liveBirthDraft.originId=event.target.value;saveCreationDraft();}
  if(event.target.id==='reading-theme'||event.target.id==='reading-size') {
    readingPreferences={...readingPreferences,[event.target.id==='reading-theme'?'theme':'textSize']:event.target.value};
    applyReadingPreferences();
    if(!savePreferences(storage,readingPreferences))notify('阅读设置已应用，本机暂时无法保存。',true);
  }
});
document.addEventListener('compositionstart', event => { if (event.target.id === 'birth-name') birthComposing = true; });
document.addEventListener('compositionend', event => {
  if (event.target.id === 'birth-name') { birthComposing = false; birthNameDraft = event.target.value; saveBirthName(); }
});
document.addEventListener('submit', event => {
  if(event.target?.id==='live-birth-form'){event.preventDefault();return beginLiveLife();}
  if(event.target?.id==='live-custom-form'){event.preventDefault();return submitLiveCustomAction();}
  if (event.target?.id !== 'birth-form') return;
  event.preventDefault();
  const button = $('[data-birth-start]');
  if (button) chooseBirth('birth-start', button.dataset);
});

document.addEventListener('keydown', event => {
  if(event.defaultPrevented||event.repeat||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||activeMode!=='live'||view!=='adventure'||$('#dialog').open||liveSnapshot?.busy||liveSnapshot?.pending||liveSnapshot?.state?.life.cultivationProfile?.version!==7)return;
  if(event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(!/^[1-4]$/.test(event.key))return;
  const button=event.key==='4'?$('[data-live-custom-toggle]'):$(`[data-live-choice-index="${Number(event.key)-1}"][data-live-choice]`);
  if(!button||button.disabled)return;
  event.preventDefault();button.click();
});

document.addEventListener('click', event => {
  const button = event.target.closest('button,a');
  if (!button || button.disabled) return;
  const data = button.dataset;
  if ('closeDialog' in data) { closeDialog(); return; }
  if ('confirm' in data) { const callback = dialogConfirm; closeDialog(false); callback?.(); return; }
  if ('home' in data)return goHome();
  if ('titleNew' in data)return askNewJourney();
  if ('titleContinue' in data)return continueJourney();
  if ('saves' in data)return openSavedJourneys();
  if ('savesNext' in data)return openSavedJourneys(true);
  if ('selectLive' in data)return selectSavedJourney(data.selectLive,'live');
  if ('selectOffline' in data)return selectSavedJourney(data.selectOffline,'offline');
  if ('menuBack' in data) {if(view==='new'){if(liveBirthDraft.reincarnationRunId){view='adventure';setActiveMode('live');render();return;}return goHome();}if(returnScreen==='adventure')return continueJourney();if(returnScreen==='new'){view='new';returnScreen='home';render();return;}if(['inventory','worlds','legacies','chronicle'].includes(returnScreen)){view=returnScreen;render();return;}return goHome();}
  if ('liveStart' in data) {event.preventDefault();return beginLiveLife();}
  if ('liveNew' in data) return prepareNewJourney();
  if ('liveReward' in data) return selectReincarnationReward(data.liveReward);
  if ('liveReincarnate' in data) return prepareReincarnation();
  if ('liveRetry' in data) return liveSession?.retry();
  if ('liveResume' in data) return liveSession?.resume();
  if ('liveChoice' in data) {currentLiveActionDraft().error='';return liveSession?.choose({choiceId:data.liveChoice,baseRevision:Number(data.revision),stateHash:data.stateHash});}
  if ('liveCustomToggle' in data) {const draft=currentLiveActionDraft();draft.open=!draft.open;render();if(draft.open)$('#live-custom-action')?.focus({preventScroll:true});return;}
  if ('liveHistoryNext' in data) return showLiveHistory(false);
  if ('liveHistoryFirst' in data) return showLiveHistory(true);
  if ('character' in data) return showCharacter();
  if ('history' in data) return showHistory();
  if ('birthReroll' in data || 'birthStart' in data || 'birthOrigin' in data || 'birthLock' in data) { event.preventDefault(); return chooseBirth('birthStart' in data ? 'birth-start' : 'birthOrigin' in data ? 'birth-origin' : 'birthLock' in data ? 'birth-lock' : 'birth-reroll', data); }
  if ('help' in data) return showHelp();
  if ('view' in data) {
    closeDialog(false);
    if(data.view==='settings') {if(view!=='settings')returnScreen=['adventure','new','inventory','worlds','legacies','chronicle'].includes(view)?view:'home';view='settings';render();$('#settings-title')?.focus({preventScroll:true});return;}
    view = isJourney(state) && data.view !== 'settings' ? 'adventure' : data.view; render();
    if (view === 'adventure' && state && !preparingLife) focusAdventure($('#birth-title') || $('#journey-current-title') || $('#ending-title') || $('#combat-title') || $('#event-title') || $('#story-scene-title') || $('#main-content'));
    else { $('#main-content')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
    return;
  }
  if ('recoverLegacy' in data) {
    session=recoverLegacySession({...session,state},storage);state=session.state;
    lastSaved=session.saved;saveError=session.error;render();focusAdventure($('#ending-title') || $('#story-scene-title') || $('#main-content'));
    if(session.error)notify(session.error,true);
    return;
  }
  if(session.pendingLegacyRaw && ['action','storyChoice','choice','combat','reward','equip','travel','challenge','finale','legacyBridge'].some(key=>key in data))return notify('请先恢复或导出较新的旧人生；它尚未替换当前档。',true);
  if ('journeyChoice' in data && isJourney(state)) {
    try {
      const result = chooseNarrative(state, { revision: Number(data.revision), sceneId: data.sceneId, choiceId: data.journeyChoice });
      if (result.kind !== 'applied') return notify(result.message);
      update(result.state, { goAdventure: true, message: false });
    } catch (error) { notify(error.message || '这一步暂时无法进行。', true); }
    return;
  }
  if (!isJourney(state)) {
    if ('path' in data && preparingLife) { setup.pathId = data.path; render({ focusSelector: `[data-path="${data.path}"]` }); return; }
    if ('origin' in data && preparingLife) { setup.originId = data.origin; render({ focusSelector: `[data-origin="${data.origin}"]` }); return; }
    if ('carry' in data && preparingLife) {
      if (setup.legacyIds.includes(data.carry)) setup.legacyIds = setup.legacyIds.filter(id => id !== data.carry);
      else if (setup.legacyIds.length >= 2) return notify('每一世最多携带两项传承，请先取消一项。', true);
      else setup.legacyIds.push(data.carry);
      render({ focusSelector: `[data-carry="${data.carry}"]` }); return;
    }
    if ('cancelSetup' in data) { preparingLife = false; render({ focusSelector: '#ending-title' }); return; }
    if ('action' in data && state) {
      const info = getActionInfo(state, data.action);
      const runAction = () => attempt(() => act(state, { type: data.action }), { goAdventure: true, focusStory: true });
      if (data.action === 'retire') return confirmAction('此生归隐', getStoryView(state) ? '结束这一世并结算已经完成的经历。尚未完成的谷中事务会留下未竟结果；已经确定的谷地结果不会被抹去。归隐本身不会发放奖励，已有的传承候选、世界因果和道证会保留。' : '结束这一世并结算已经完成的经历。旧途的真实经历、传承候选、世界因果和道证会保留，转世后进入新篇。归隐本身不会发放奖励。', runAction, '归隐并结算');
      if (info.years >= getStats(state).remainingLife) return confirmAction('岁月将尽', `这次行动需要 ${info.years} 年，但你只剩 ${Math.max(0, getStats(state).remainingLife)} 年余寿。你会在完成前寿尽，无法获得本次收益。`, runAction, '走完此生');
      runAction(); return;
    }
    if ('storyChoice' in data && state) return attempt(() => chooseStory(state, data.storyChoice), { goAdventure: true, focusStory: true, message: false });
    if ('choice' in data && state) return attempt(() => chooseEvent(state, data.choice), { goAdventure: true, focusStory: true });
    if ('combat' in data && state) return attempt(() => combatAction(state, data.combat), { goAdventure: true, focusStory: true });
    if ('equip' in data && state) return attempt(() => equipItem(state, data.equip, Number(data.slot || 0)));
    if ('reward' in data && state) return attempt(() => selectLegacy(state, data.reward), { goAdventure: true });
    if ('legacyBridge' in data && state) {
      session=migrateSession({...session,state},{choiceId:data.legacyBridge,seed:newSeed()},storage);
      lastSaved=session.saved;saveError=session.error;
      if(session.state.version===3){openPanels.clear();preparingLife=false;view='adventure';update(session.state,{message:false,currentContext:true,resetSupport:true,alreadyPersisted:true});}
      else {state=session.state;render();notify(session.error,true);}
      return;
    }
    if ('travel' in data && state) {
      const go = () => attempt(() => act(state, { type: 'travel', worldId: data.travel }), { goAdventure: true });
      if (getStats(state).remainingLife <= 2) return confirmAction('余寿不足', '游历两年将耗尽余寿，无法抵达目的地。仍要踏上这最后一程吗？', go, '踏上最后一程');
      go(); return;
    }
    if ('challenge' in data && state) return attempt(() => act(state, { type: 'challenge', challengeId: data.challenge }), { goAdventure: true });
    if ('finale' in data && state) return confirmAction('最后的问鼎', '你将向三界共主发起决战。请确认气血充足、功法与法器已装配妥当。', () => attempt(() => act(state, { type: 'finale' }), { goAdventure: true }), '执此一念，问鼎三界');
  }
  if ('exportLegacy' in data) {
    let backup=session.legacyBackup;
    if(!backup) { try { backup=readLegacyBackup(storage); } catch(error) { notify(error.message,true); } }
    if(session.originalLegacyRaw ?? backup?.originalRaw) downloadText('百世问鼎-旧原档.json',session.originalLegacyRaw ?? backup.originalRaw);
    if(!backup?.checkpointRaw && backup?.currentRaw && backup.currentRaw!==session.storageRaw)downloadText('百世问鼎-较新旧人生.json',backup.currentRaw);
    if(backup?.checkpointRaw)downloadText('百世问鼎-交接旧人生.json',backup.checkpointRaw);
    if(backup?.preparedRaw)downloadText('百世问鼎-准备的新人生.json',backup.preparedRaw);
    if(!backup?.checkpointRaw && state && !isJourney(state))downloadText('百世问鼎-当前旧人生.json',serializeGame(state));
    return;
  }
  if ('export' in data) return exportGame();
  if ('exportCatalog' in data || 'exportCatalogRecovery' in data) {
    try {
      const raw='exportCatalog' in data?offlineJourneys.corruptLibrary():offlineJourneys.libraryRecoveryRaw();
      if(raw!==null)downloadText('百世问鼎-旅程目录原始备份.txt',raw,'text/plain;charset=utf-8');
    } catch(error) {notify(saveProblem(error),true);}return;
  }
  if ('recoverCatalog' in data) {
    try {
      const raw=offlineJourneys.corruptLibrary();
      if(raw===null)return renderSettingsPage();
      return confirmAction('恢复旅程目录','将先在本机保存完整原始目录，再恢复其中可读取的旅程。无法读取的记录仍在原文备份中，当前人物与进度保持不变。',()=>{
        try {offlineJourneys.recoverLibrary(raw);renderSettingsPage();notify('旅程目录已恢复，原始备份可在设置中导出。');}
        catch(error){notify(saveProblem(error),true);}
      },'保存备份并恢复');
    } catch(error) {notify(saveProblem(error),true);}return;
  }
  if ('exportRecovery' in data) {
    try {downloadText('百世问鼎-原始恢复备份.json',JSON.stringify({format:'wending-recovery-backups',entries:offlineJourneys.listUnreadable()},null,2));}
    catch(error){notify(saveProblem(error),true);}return;
  }
  if ('exportCorrupt' in data && session.rawCorruptSave !== null) { downloadText('百世问鼎-原存档备份.txt', session.rawCorruptSave, 'text/plain;charset=utf-8'); return; }
  if ('import' in data) { $('#import-file').click(); return; }
  if ('newGame' in data || 'reset' in data) return askNewJourney();
});

$('#import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  if(uiBusy||liveSnapshot?.busy)return notify('故事正在保存，请稍候再导入存档。',true);
  if (file.name?.endsWith('.wending.jsonl')) {
    confirmAction('导入一段旅程','<p>将校验这份完整存档，成功后切换到导入的旅程。原有旅程仍会保留，可从「切换存档」找回。</p>',async()=>{
      if(uiBusy||liveSnapshot?.busy)return notify('故事正在保存，请稍后导入。',true);
      if(!retainUnsavedOfflineLife())return;
      uiBusy=true;
      try { await ensureLive(); await importLiveArchive(file.stream(),liveArchive); setActiveMode('live'); view='adventure'; await liveSession.load(); render(); await liveSession.resume(); notify('完整存档已校验并恢复。'); } catch(error) { notify('实时存档未能恢复，原进度保留。',true); }
      finally {uiBusy=false;render();}
    },'确认导入并续写');
    return;
  }
  if (file.size > MAX_SAVE_FILE_BYTES) return notify('存档文件超过字符上限可容纳的 UTF-8 大小，请选择有效的游戏存档。', true);
  try {
    const originalRaw = await file.text();
    const imported = deserializeGame(originalRaw);
    const narrative = isJourney(imported) ? getNarrativeView(imported).summary : null;
    const identity = narrative ? { name: narrative.name, generation: narrative.generation, age: narrative.ageText ?? `${narrative.age} 岁`, realm: narrative.realmName ? `，${narrative.realmName}` : '' } : { name: imported.run.name, generation: imported.meta.generation, age: `${imported.run.age} 岁`, realm: `，${REALMS[imported.run.realmIndex].name}境` };
    confirmAction('导入修行存档', `将恢复「${esc(identity.name)}」的第 ${identity.generation} 世（${esc(identity.age)}${esc(identity.realm)}）。${isCreating(imported) ? '这一世尚未入世，姓名、属性与天赋将按存档恢复。' : ''}${state ? '当前旅程会先保留，可从切换存档找回。' : ''}`, () => {
      if(!replaceSession(imported, originalRaw))return;notify(lastSaved ? '存档已恢复，仙途继续。' : saveError, !lastSaved);
    }, '确认恢复');
  } catch (error) { notify(error.message || '无法读取这个存档文件。', true); }
});

$('#dialog').addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
$('#dialog').addEventListener('close', () => { if (!$('#dialog').open) { dialogConfirm = null; $('#dialog').className = ''; } });
$('#dialog').addEventListener('click', event => { if (event.target === $('#dialog')) { const rect = $('#dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
render();

initializeScreens();

function setActiveMode(mode) {
  activeMode=mode;
  try { storage.setItem(ACTIVE_MODE_KEY,mode); }
  catch { notify('模式选择未能保存，下次打开可从设置重新进入。',true); }
}
async function ensureLive() {
  if(liveSession)return;
  if(!liveInitialization)liveInitialization=(async()=>{
    liveArchive=await openLiveArchive();
    liveSession=createLiveSession({archive:liveArchive,client:liveClient,onProgress:snapshot=>{
      liveSnapshot=snapshot;
      if(activeMode==='live'&&view==='adventure')updateLiveJourney($('#app'),liveStoryView(snapshot));
    },onChange:snapshot=>{
      liveSnapshot=snapshot;
      if(creatingRunId&&snapshot.state?.runId===creatingRunId){setActiveMode('live');if(view==='new')view='adventure';}
      render();
    }});
  })();
  try {await liveInitialization;}catch(error){liveInitialization=null;throw error;}
}
async function beginLiveLife() {
  if(uiBusy||view!=='new')return;
  if(!retainUnsavedOfflineLife())return;
  const name=$('#live-name')?.value?.trim()??liveBirthDraft.name,originId=$('#live-origin')?.value??liveBirthDraft.originId;
  liveBirthDraft={...liveBirthDraft,name,originId};uiBusy=true;liveError='';render();
  try {
    await ensureLive();
    creatingRunId=window.crypto.randomUUID();
    const options={runId:creatingRunId,name,originId,seed:newSeed(),engineVersion:7};
    if(liveBirthDraft.reincarnationRunId&&liveSnapshot?.state?.runId!==liveBirthDraft.reincarnationRunId)throw Error('reincarnation parent changed');
    const result=liveBirthDraft.reincarnationRunId
      ?await liveSession.reincarnate(options,liveBirthDraft.reincarnationRewardIds??[],liveBirthDraft.expectedArchiveId)
      :await liveSession.startNew(options,liveBirthDraft.expectedArchiveId);
    if(result.state?.runId===creatingRunId){setActiveMode('live');if(view==='new')view='adventure';liveBirthDraft={name,originId,expectedArchiveId:result.archiveId};}
    else if(result.errorCode==='REINCARNATION_ALREADY_CLAIMED')liveError='此生已经步入轮回，请从存档中续写下一世。';
    else if(result.errorCode==='REINCARNATION_INSUFFICIENT_POINTS')liveError='因果点不足，请返回此生结算重新选择传承。';
    else if(result.errorCode!=='BIRTH_CONTEXT_INVALID')liveError='另一页面可能已切换旅程，或本地存档无法保存。请返回首页后重新创建，原进度保持不变。';
  } catch { liveError='无法开始，请检查本地存储与网络。原有旅程保持不变。'; }
  finally {uiBusy=false;creatingRunId=null;render();}
}

function currentLiveActionDraft(snapshot=liveSnapshot) {
  const key=JSON.stringify([snapshot?.archiveId,snapshot?.state?.runId,snapshot?.state?.revision]);
  if(liveActionDraft.key!==key)liveActionDraft={key,open:false,text:'',error:''};
  return liveActionDraft;
}

function liveStoryView(snapshot) {
  if(!snapshot?.state)return null;
  return {...snapshot,stateHash:stateHash(snapshot.state),itemNames:LIVE_ITEMS,characterSummary:liveCharacterSummary(snapshot.state,liveCatalogs),customAction:currentLiveActionDraft(snapshot),selectedReincarnationRewards:liveBirthDraft.reincarnationRunId===snapshot.state.runId?liveBirthDraft.reincarnationRewardIds??[]:[]};
}

function selectReincarnationReward(rewardId) {
  const snapshot=liveSnapshot;
  if(!snapshot?.state||snapshot.busy||snapshot.pending||snapshot.reincarnatedTo||!getReincarnationSettlement(snapshot.state))return;
  if(!REINCARNATION_REWARDS.some(reward=>reward.id===rewardId))return;
  const current=liveBirthDraft.reincarnationRunId===snapshot.state.runId?liveBirthDraft.reincarnationRewardIds??[]:[];
  const selected=current.includes(rewardId)?current.filter(id=>id!==rewardId):[...current,rewardId];
  try {buildRebirthOptions(snapshot.state,selected);}catch{return notify('因果点不足，无法携入这项传承。',true);}
  liveBirthDraft={name:liveBirthDraft.reincarnationRunId===snapshot.state.runId?liveBirthDraft.name:snapshot.state.life.name,originId:liveBirthDraft.reincarnationRunId===snapshot.state.runId?liveBirthDraft.originId:'village',expectedArchiveId:snapshot.archiveId,reincarnationRunId:snapshot.state.runId,reincarnationRewardIds:selected};
  saveCreationDraft();render();
}

function prepareReincarnation() {
  const snapshot=liveSnapshot;
  if(uiBusy||!snapshot?.state||snapshot.busy||snapshot.pending||snapshot.reincarnatedTo||!getReincarnationSettlement(snapshot.state))return;
  const sameParent=liveBirthDraft.reincarnationRunId===snapshot.state.runId;
  const selected=sameParent?liveBirthDraft.reincarnationRewardIds??[]:[];
  try {buildRebirthOptions(snapshot.state,selected);}catch{return notify('因果点不足，请重新选择来世传承。',true);}
  liveBirthDraft={name:sameParent?liveBirthDraft.name:snapshot.state.life.name,originId:sameParent?liveBirthDraft.originId:'village',expectedArchiveId:snapshot.archiveId,reincarnationRunId:snapshot.state.runId,reincarnationRewardIds:selected};
  liveError='';view='new';returnScreen='adventure';saveCreationDraft();render();$('#live-name')?.focus({preventScroll:true});
}

async function submitLiveCustomAction() {
  const snapshot=liveSnapshot;
  if(!liveSession||snapshot?.busy||snapshot?.pending||snapshot?.state?.phase!=='active'||snapshot.state.life.cultivationProfile?.version!==7)return;
  const draft=currentLiveActionDraft(),text=$('#live-custom-action')?.value??draft.text;
  draft.text=text;draft.error='';draft.open=true;
  if(!text.trim()||text.length>120){draft.error=unsupportedAction;render();$('#live-custom-action')?.focus({preventScroll:true});return;}
  const numeric=text.trim().match(/^[1-3]$/),choice=numeric?snapshot.state.currentScene.choices[Number(numeric[0])-1]:null;
  const result=await liveSession.choose({...(choice?{choiceId:choice.id}:{customAction:text}),baseRevision:snapshot.state.revision,stateHash:stateHash(snapshot.state)});
  if(result.errorCode==='CUSTOM_ACTION_UNSUPPORTED'){
    draft.error=unsupportedAction;render();$('#live-custom-action')?.focus({preventScroll:true});
  }
}

function renderLiveApp() {
  const focus = !$('#dialog').open && $('#app').contains(document.activeElement) ? captureFocusTarget() : null;
  const snapshot=liveSnapshot,liveState=snapshot?.state;
  const header=liveState?renderIdentityBar(liveCharacterSummary(liveState,liveCatalogs)):'<h1>百世问鼎 · 实时人生</h1>';
  const storyView=liveStoryView(snapshot);
  const choices=liveState?.phase==='active'?compileChoices(liveState,liveState.currentScene.choices):[];
  const previousStory=$('#app').querySelector('[data-live-story]');
  const content=storyView?renderLiveJourney(storyView,choices):'<p role="status">正在读取旅程…</p>';
  $('#app').innerHTML=`<div class="paper-page paper-page-immersive"><header class="paper-top paper-top-immersive">${header}</header><main id="main-content" class="paper-main" tabindex="-1">${liveError?`<p class="notice" role="status">${esc(liveError)}</p>`:''}${content}</main>${renderGameNavigation({history:Boolean(liveState)})}</div>`;
  if(previousStory&&storyView&&updateLiveJourney(previousStory,storyView,choices))$('#app').querySelector('[data-live-story]').replaceWith(previousStory);
  resolveFocusTarget(focus)?.focus({ preventScroll: true });
}
async function showLiveHistory(first) {
  if(!liveArchive||!liveSnapshot?.state)return;
  try { const run=liveSnapshot.state.runId;if(first||run!==liveHistoryRun){liveHistoryRun=run;liveHistoryCursor=null;}const page=await liveArchive.readHistory(run,liveHistoryCursor,16);liveHistoryCursor=page.cursor;openDialog('历史对话',renderLiveHistory(page.entries,liveSnapshot.state.life.name),`<button class="button" data-live-history-first>从头阅读</button>${page.cursor?'<button class="button" data-live-history-next>下一页</button>':''}`,{drawer:true}); }
  catch { notify('历史读取暂未完成，请重试。',true); }
}
async function exportLiveGame() {
  if(!liveArchive||!liveSnapshot?.state)return notify('尚无实时存档可导出。',true);
  try {
    const filename=`百世问鼎-${liveSnapshot.state.life.name}.wending.jsonl`;
    // File System Access streams directly where available; Blob fallback only
    // affects download memory, never the stored archive or the history DOM.
    if(typeof window.showSaveFilePicker==='function') {
      const handle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:'实时人生完整备份',accept:{'application/octet-stream':['.jsonl']}}]});
      const writable=await handle.createWritable();await exportLiveArchive(liveArchive,liveSnapshot.state.runId).pipeTo(writable);
    } else {
      const blob=await new Response(exportLiveArchive(liveArchive,liveSnapshot.state.runId)).blob();downloadText(filename,blob,'application/octet-stream');
    }
    notify('实时存档已导出。');
  } catch(error) { if(error.name!=='AbortError')notify('导出未完成，请重试并保留本机存档。',true); }
}
window.addEventListener?.('pageshow',event=>{if(event.persisted&&activeMode==='live')liveSession?.resume();});
