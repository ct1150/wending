import { openLiveArchive } from './game/live-archive.js';
import { exportLiveArchive, importLiveArchive } from './game/live-save-format.js';
import { createLiveSession } from './ui/live-session.js';
import { createStoryClient } from './ui/story-client.js';
import { compileChoices } from './game/cultivation/live/engine.js';
import { stateHash } from './game/cultivation/live/identity.js';
import { getReincarnationSettlement, REINCARNATION_REWARDS, buildRebirthOptions } from './game/cultivation/live/reincarnation.js';
import { REALMS as LIVE_REALMS, ORIGINS as LIVE_ORIGINS, TALENTS as LIVE_TALENTS, ITEMS as LIVE_ITEMS } from './game/cultivation/live/model.js';
import { liveCharacterSummary, renderIdentityBar, renderCharacterDetails, renderLiveBirth } from './ui/character.js';
import { renderLiveJourney, renderLiveHistory, updateLiveJourney } from './ui/journey.js';
import { loadNavigation, saveNavigation, loadPreferences, savePreferences } from './ui/navigation.js';
import { renderTitleScreen, renderGameScene, renderGameNavigation, renderReadingSettings } from './ui/title-screen.js';
import { mountTitleScene } from './ui/title-scene.js';
import { icon } from './ui/icons.js';

const $ = selector => document.querySelector(selector);
const appVersion = $('meta[name="application-version"]')?.content || 'dev';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const storage = {
  getItem(key) { return window.localStorage.getItem(key); },
  setItem(key, value) { window.localStorage.setItem(key, value); },
};
const webContext = ['http:', 'https:'].includes(window.location.protocol);
const legacyKeys = ['baishi-wending-save-v1', 'baishi-wending-save-v1-legacy-handoff', 'baishi-wending-save-v1-journeys', 'baishi-wending-save-v1-unreadable', 'baishi-wending-save-v1-journeys-recovery'];
let hasLegacyData = false;
try { hasLegacyData = legacyKeys.some(key => storage.getItem(key) !== null); } catch {}
let navigationStorage = null;
try { navigationStorage = window.sessionStorage; } catch {}
const navigation = loadNavigation(navigationStorage, window.performance?.getEntriesByType?.('navigation')?.[0]?.type);
let liveBirthDraft = navigation.draft ?? { name: '云归', originId: 'village', expectedArchiveId: null };
let liveArchive = null, liveSession = null, liveSnapshot = null, liveError = '', liveHistoryCursor = null, liveHistoryRun = null;
let liveInitialization = null, homeReady = false, uiBusy = false, creatingRunId = null, returnScreen = navigation.returnScreen;
let readingPreferences = loadPreferences(storage);
const liveCatalogs = { REALMS: LIVE_REALMS, ORIGINS: LIVE_ORIGINS, TALENTS: LIVE_TALENTS, ITEMS: LIVE_ITEMS };
const liveClient = createStoryClient();
let view = navigation.screen;
let toastTimer, dialogConfirm = null, dialogReturnTarget = null, retainedHistory = null;
let disposeTitleScene = () => {}, disposeGameScene = null;

function rememberScreen() {
  return saveNavigation(navigationStorage, { screen: view, draft: liveBirthDraft, returnScreen });
}

function currentJourneySummary() {
  const game = liveSnapshot?.state;
  if (!game) return null;
  const summary = liveCharacterSummary(game, liveCatalogs);
  return { name: summary.name, detail: `${summary.realmName ?? summary.realm ?? '凡人'} · ${summary.ageText ?? `${summary.age}岁`} · 第 ${game.turnId} 回${game.phase === 'dead' ? ' · 此生已尽' : ''}`, location: game.currentScene?.title };
}

function renderSettingsPage() {
  const summary = currentJourneySummary();
  const body = `<p class="birth-kicker">收好行囊，再赴山河</p><h2 id="settings-title" tabindex="-1">游戏设置</h2>${renderReadingSettings(readingPreferences)}<section class="settings-section"><h3>当前进度</h3><p>${summary ? `${esc(summary.name)} · ${esc(summary.detail)}` : '尚未开启修仙人生。'}</p><p class="save-info">只有一个当前存档，进度自动保存在此浏览器。重新开始后，原人生保留为只读历史。</p>${summary ? `<button class="button" data-restart ${uiBusy || liveSnapshot?.busy ? 'disabled' : ''}>重新开始人生</button>` : ''}<details class="save-backup"><summary>备份与恢复</summary><div class="settings-actions"><button class="button" data-export ${summary ? '' : 'disabled'}>导出存档</button><button class="button" data-import>恢复备份</button></div><p class="save-info">更换设备前可导出备份。恢复备份会替换当前存档。</p><button class="button" data-retained>查看历世与旧备份</button>${hasLegacyData ? '<p class="save-info">旧版原始数据仍保留在本机，可下载留存。</p><button class="button" data-export-legacy>下载旧版原始数据</button>' : ''}</details></section><section class="settings-section"><h3>入世须知</h3><p>岁月只在落下一项选择时前行。</p><button class="button" data-help>查看游戏说明</button></section>`;
  renderScreenShell(body, { title: '游戏设置', back: returnScreen === 'new' ? '返回角色创建' : returnScreen === 'adventure' ? '返回当前剧情' : '返回首页' });
}

function renderNewJourney() {
  const invalid = liveSnapshot?.errorCode === 'BIRTH_CONTEXT_INVALID';
  renderScreenShell(renderLiveBirth({ ...liveBirthDraft, origins: LIVE_ORIGINS, available: Boolean(liveSession), busy: uiBusy, invalid, error: liveError }), { title: liveBirthDraft.reincarnationRunId ? '步入轮回' : '踏入仙途', back: liveBirthDraft.reincarnationRunId ? '返回此生结算' : '返回首页' });
}

async function initializeScreens() {
  applyReadingPreferences();
  if (webContext) {
    try {
      await ensureLive();
      const loaded = await liveSession.load();
      if (!loaded.state && loaded.errorCode) throw Error('archive read failed');
    } catch { liveError = '无法读取当前存档，请检查浏览器存储设置后重试。原进度保持不变。'; }
  }
  homeReady = true;
  if (view === 'adventure' && !liveSnapshot?.state) view = 'home';
  render();
  if (view === 'adventure' && liveSession) await liveSession.resume();
}

async function continueJourney() {
  if (uiBusy || !homeReady) return;
  uiBusy = true;
  try {
    await ensureLive();
    const loaded = await liveSession.load();
    if (!loaded.state) return notify('暂时无法读取当前存档，请刷新后重试。', true);
    liveError = ''; view = 'adventure'; render();
    await liveSession.resume();
    focusAdventure($('#journey-current-title') || $('#main-content'));
  } catch { notify('暂时无法读取当前存档，请刷新后重试。', true); }
  finally { uiBusy = false; render(); }
}

async function prepareNewJourney(expectedArchiveId = null) {
  if (uiBusy || liveSnapshot?.busy) return notify('故事正在保存，请稍候再重新开始。', true);
  uiBusy = true; render();
  try {
    await ensureLive();
    const loaded = await liveSession.load();
    if (!loaded.state && loaded.errorCode) throw Error('archive read failed');
    // A new life may only replace the save the player saw and confirmed.
    if ((loaded.archiveId ?? null) !== expectedArchiveId) {
      notify('当前人物已在另一页面更新，请重新确认后再开始。', true);
      return;
    }
    liveBirthDraft = { name: '云归', originId: 'village', expectedArchiveId };
    liveError = ''; view = 'new'; returnScreen = 'home';
    saveCreationDraft();
  } catch { notify('暂时无法读取存档，原有进度保持不变。', true); }
  finally { uiBusy = false; render(); $('#live-name')?.focus({ preventScroll: true }); }
}

function askNewJourney() {
  if (!homeReady || uiBusy || liveSnapshot?.busy) return notify('故事正在保存，请稍候再重新开始。', true);
  const expectedArchiveId = liveSnapshot?.archiveId ?? null;
  if (liveSnapshot?.state) return confirmAction('重新开始', '<p>游戏只有一个存档。新人物确认入世并保存后，会覆盖当前进度。</p><p>取消创建会保留当前人生。重新开始不会结算旧人物，也不会领取轮回奖励。</p>', () => prepareNewJourney(expectedArchiveId), '继续创建');
  return prepareNewJourney();
}

function showCharacter() {
  if (liveSnapshot?.state) openDialog('此身修行', renderCharacterDetails(liveCharacterSummary(liveSnapshot.state, liveCatalogs)), '', { drawer: true });
}

function showHelp() {
  openDialog('入世须知', '<p>阅读眼前的剧情，选择你的做法，或写下自己的行动。岁月随选择前行；查看人物与历史不会推进时间。</p><p>故事需要联网续写。进度自动保存，刷新后可继续；请求未完成时会保留待续进度。</p><p>游戏只有一个存档。重新开始会覆盖当前进度；人物死亡后，可以在此生结算中选择传承、步入轮回。</p>', '<button class="button primary" data-close-dialog>继续阅读</button>');
}

function render() {
  disposeTitleScene(); disposeTitleScene = () => {};
  syncGameScene(); rememberScreen();
  if (!webContext) return renderScreenShell('<h2>前往山海，续写此生</h2><p>请通过在线地址游玩。</p><a class="button primary" href="https://wending.868656.xyz/">进入百世问鼎</a>');
  if (view === 'home') {
    $('#app').innerHTML = renderTitleScreen({ summary: currentJourneySummary(), loading: !homeReady || uiBusy, error: liveError, version: appVersion });
    disposeTitleScene = mountTitleScene($('.title-shell'));
    return;
  }
  if (view === 'settings') return renderSettingsPage();
  if (view === 'new') return renderNewJourney();
  return renderLiveApp();
}

function newSeed() {
  return window.crypto?.getRandomValues ? String(window.crypto.getRandomValues(new Uint32Array(1))[0]) : String(Date.now());
}

function saveCreationDraft() {
  if(!rememberScreen())notify('创建草稿暂时无法保存到此标签页，刷新会丢失草稿。原有旅程保持不变。',true);
}

function applyReadingPreferences() {
  if(document.documentElement) {
    document.documentElement.dataset.theme=readingPreferences.theme;
    document.documentElement.dataset.textSize=readingPreferences.textSize;
  }
}

function renderScreenShell(content,{title='百世问鼎',back='返回首页'}={}) {
  $('#app').innerHTML=`<div class="paper-page menu-page"><header class="menu-page-header"><p>${esc(title)}</p><button class="small-button" data-menu-back>← ${esc(back)}</button></header><main id="main-content" class="paper-main" tabindex="-1">${content}</main></div>`;
}

function goHome() {
  closeDialog(false);view='home';returnScreen='home';render();
  $('#main-content')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
}

function notify(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, error ? 6000 : 4200);
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
  return { element, selector, sceneFallback: element.matches('[data-live-choice], [data-live-start], [data-live-new], [data-live-retry], [data-live-resume], [data-live-reincarnate]') };
}

function resolveFocusTarget(target) {
  const element = target?.element.isConnected ? target.element : target?.selector ? $(target.selector) : null;
  return element && !element.matches(':disabled') ? element : target?.sceneFallback ? $('#journey-current-title') : null;
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

function confirmAction(title, body, callback, label = '确认继续') {
  dialogConfirm = callback;
  openDialog(title, body, `<button class="button ghost" data-close-dialog>再想一想</button><button class="button primary" data-confirm>${esc(label)}</button>`);
}

function syncGameScene() {
  if (document.documentElement) document.documentElement.dataset.screen = view === 'home' ? 'home' : 'game';
  const scene = $('#game-scene');
  if (!scene) return;
  if (view === 'home') {
    disposeGameScene?.();
    disposeGameScene = null;
    scene.hidden = true;
    scene.innerHTML = '';
    return;
  }
  scene.hidden = false;
  // Keep this sibling of #app alive across every story, choice and settings render.
  if (!disposeGameScene) {
    scene.innerHTML = renderGameScene({version:appVersion});
    disposeGameScene = mountTitleScene(scene);
  }
}

function downloadText(filename, text, mime = 'application/json;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function ensureLive() {
  if(liveSession)return;
  if(!liveInitialization)liveInitialization=(async()=>{
    liveArchive=await openLiveArchive();
    liveSession=createLiveSession({archive:liveArchive,client:liveClient,onProgress:snapshot=>{
      liveSnapshot=snapshot;
      if(view==='adventure')updateLiveJourney($('#app'),liveStoryView(snapshot));
    },onChange:snapshot=>{
      liveSnapshot=snapshot;
      if(creatingRunId&&snapshot.state?.runId===creatingRunId){if(view==='new')view='adventure';}
      render();
    }});
  })();
  try {await liveInitialization;}catch(error){liveInitialization=null;throw error;}
}

async function beginLiveLife() {
  if(uiBusy||view!=='new')return;
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
    if(result.state?.runId===creatingRunId){if(view==='new')view='adventure';liveBirthDraft={name,originId,expectedArchiveId:result.archiveId};}
    else if(result.errorCode==='REINCARNATION_ALREADY_CLAIMED')liveError='此生传承已领取。请恢复下一世备份，或返回首页重新开始。';
    else if(result.errorCode==='REINCARNATION_INSUFFICIENT_POINTS')liveError='因果点不足，请返回此生结算重新选择传承。';
    else if(result.errorCode==='EXPERIENCE_UNSUPPORTED')liveError='故事服务暂不支持这次轮回的修行规则。原存档已保留，请稍后再试。';
    else if(['NETWORK_UNAVAILABLE','AI_DISABLED','SERVICE_UNAVAILABLE','PROTOCOL_MISMATCH'].includes(result.errorCode))liveError='暂时无法确认故事服务可用。原存档已保留，请稍后再试。';
    else if(result.errorCode!=='BIRTH_CONTEXT_INVALID')liveError='另一页面可能已更新存档，或本地存档无法保存。请返回首页后重新创建，原进度保持不变。';
  } catch { liveError='无法开始，请检查本地存储与网络。原有旅程保持不变。'; }
  finally {uiBusy=false;creatingRunId=null;render();}
}

function liveStoryView(snapshot) {
  if(!snapshot?.state)return null;
  return {...snapshot,stateHash:stateHash(snapshot.state),itemNames:LIVE_ITEMS,characterSummary:liveCharacterSummary(snapshot.state,liveCatalogs),selectedReincarnationRewards:liveBirthDraft.reincarnationRunId===snapshot.state.runId?liveBirthDraft.reincarnationRewardIds??[]:[]};
}

function selectReincarnationReward(rewardId) {
  const snapshot=liveSnapshot;
  if(!snapshot?.state||snapshot.busy||snapshot.pending||snapshot.reincarnatedTo||!getReincarnationSettlement(snapshot.state))return;
  if(!REINCARNATION_REWARDS.some(reward=>reward.id===rewardId))return;
  const current=liveBirthDraft.reincarnationRunId===snapshot.state.runId?liveBirthDraft.reincarnationRewardIds??[]:[];
  const selected=current.includes(rewardId)?current.filter(id=>id!==rewardId):[...current,rewardId];
  try {buildRebirthOptions(snapshot.state,selected);}catch(error){return notify(error.code==='REINCARNATION_SELECTION_LIMIT'?'每世最多携入两项传承。':'因果点不足，无法携入这项传承。',true);}
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

function renderLiveApp() {
  const focus = !$('#dialog').open && $('#app').contains(document.activeElement) ? captureFocusTarget() : null;
  const snapshot=liveSnapshot,liveState=snapshot?.state;
  const header=liveState?renderIdentityBar(liveCharacterSummary(liveState,liveCatalogs)):'<h1>百世问鼎</h1>';
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

async function showRetainedArchives(cursor = null) {
  try {
    await ensureLive();
    const page = await liveArchive.listRetainedArchives(cursor);
    const rows = page.entries.map(row => `<section class="settings-section" data-retained-row="${esc(row.archiveId)}"><h3>${esc(row.name)}</h3><p>${row.phase === 'dead' ? '此生已尽' : '旧日进度'} · 第 ${row.turnId} 回</p><div class="settings-actions"><button class="button" data-retained-read="${esc(row.archiveId)}">只读查看</button><button class="button" data-retained-export="${esc(row.archiveId)}">导出备份</button></div></section>`).join('');
    openDialog('历世与旧备份', `<p>这里保留先前人生与恢复前的备份。只读查看不会推进故事；需要恢复时，请先导出备份，再通过恢复备份确认替换当前进度。</p>${rows || '<p>本页暂无旧记录。</p>'}`, `${cursor ? '<button class="button" data-retained>回到第一页</button>' : ''}${page.cursor ? `<button class="button" data-retained-next="${esc(page.cursor)}">下一页</button>` : ''}`, { drawer: true });
  } catch { notify('旧记录暂时无法读取，原始存档保持不变。', true); }
}

async function showRetainedHistory(archiveId, next = false) {
  try {
    const row = await liveArchive.readRetainedArchive(archiveId);
    const cursor = next && retainedHistory?.archiveId === archiveId ? retainedHistory.cursor : null;
    const page = await liveArchive.readRetainedHistory(archiveId, cursor, 16);
    retainedHistory = { archiveId, cursor: page.cursor };
    openDialog(`${row.state.life.name} · 只读历史`, `${renderCharacterDetails(liveCharacterSummary(row.state, liveCatalogs))}${renderLiveHistory(page.entries, row.state.life.name)}`, `<button class="button" data-retained>返回历世</button><button class="button" data-retained-read="${esc(archiveId)}">从头阅读</button>${page.cursor ? `<button class="button" data-retained-history-next="${esc(archiveId)}">下一页</button>` : ''}<button class="button" data-retained-export="${esc(archiveId)}">导出备份</button>`, { drawer: true });
  } catch { notify('历史读取暂未完成，请重试。原始存档保持不变。', true); }
}

async function exportLiveGame(physical = null) {
  if(!liveArchive||!physical&&!liveSnapshot?.state)return notify('尚无存档可导出。',true);
  try {
    const snapshot=physical?await liveArchive.readRetainedArchive(physical):liveSnapshot;
    const filename=`百世问鼎-${snapshot.state.life.name}.wending.jsonl`;
    // File System Access streams directly where available; Blob fallback only
    // affects download memory, never the stored archive or the history DOM.
    if(typeof window.showSaveFilePicker==='function') {
      const handle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:'完整存档备份',accept:{'application/octet-stream':['.jsonl']}}]});
      const writable=await handle.createWritable();await exportLiveArchive(liveArchive,snapshot.state.runId,physical).pipeTo(writable);
    } else {
      const blob=await new Response(exportLiveArchive(liveArchive,snapshot.state.runId,physical)).blob();downloadText(filename,blob,'application/octet-stream');
    }
    notify('存档已导出。');
  } catch(error) { if(error.name!=='AbortError')notify('导出未完成，请重试并保留本机存档。',true); }
}

document.addEventListener('input', event => {
  if (event.target.id === 'live-name') { liveBirthDraft.name = event.target.value; saveCreationDraft(); }
});
document.addEventListener('change', event => {
  if (event.target.id === 'live-origin') { liveBirthDraft.originId = event.target.value; saveCreationDraft(); }
  if (event.target.id === 'reading-theme' || event.target.id === 'reading-size') {
    readingPreferences = { ...readingPreferences, [event.target.id === 'reading-theme' ? 'theme' : 'textSize']: event.target.value };
    applyReadingPreferences();
    if (!savePreferences(storage, readingPreferences)) notify('阅读设置已应用，本机暂时无法保存。', true);
  }
});
document.addEventListener('submit', event => {
  if (event.target?.id === 'live-birth-form') { event.preventDefault(); return beginLiveLife(); }
});
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || view !== 'adventure' || $('#dialog').open || liveSnapshot?.busy || liveSnapshot?.pending || liveSnapshot?.state?.life.cultivationProfile?.version !== 7) return;
  if (event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
  if (!/^[1-3]$/.test(event.key)) return;
  const button = $(`[data-live-choice-index="${Number(event.key) - 1}"][data-live-choice]`);
  if (!button || button.disabled) return;
  event.preventDefault(); button.click();
});
document.addEventListener('click', event => {
  const button = event.target.closest('button,a');
  if (!button || button.disabled) return;
  const data = button.dataset;
  if ('closeDialog' in data) { closeDialog(); return; }
  if ('confirm' in data) { const callback = dialogConfirm; closeDialog(false); callback?.(); return; }
  if ('home' in data) return goHome();
  if ('titleNew' in data || 'restart' in data || 'liveNew' in data) return askNewJourney();
  if ('titleContinue' in data) return continueJourney();
  if ('menuBack' in data) {
    if (view === 'new') { if (liveBirthDraft.reincarnationRunId) { view = 'adventure'; render(); return; } return goHome(); }
    if (returnScreen === 'adventure') return continueJourney();
    if (returnScreen === 'new') { view = 'new'; returnScreen = 'home'; render(); return; }
    return goHome();
  }
  if ('liveStart' in data) { event.preventDefault(); return beginLiveLife(); }
  if ('liveReward' in data) return selectReincarnationReward(data.liveReward);
  if ('liveReincarnate' in data) return prepareReincarnation();
  if ('liveRetry' in data) return liveSession?.retry();
  if ('liveResume' in data) return liveSession?.resume();
  if ('liveChoice' in data) return liveSession?.choose({ choiceId: data.liveChoice, baseRevision: Number(data.revision), stateHash: data.stateHash });
  if ('liveHistoryNext' in data) return showLiveHistory(false);
  if ('liveHistoryFirst' in data || 'history' in data) return showLiveHistory(true);
  if ('character' in data) return showCharacter();
  if ('help' in data) return showHelp();
  if (data.view === 'settings') {
    closeDialog(false);
    if (view !== 'settings') returnScreen = ['adventure', 'new'].includes(view) ? view : 'home';
    view = 'settings'; render(); $('#settings-title')?.focus({ preventScroll: true }); return;
  }
  if ('retained' in data) return showRetainedArchives();
  if ('retainedNext' in data) return showRetainedArchives(data.retainedNext);
  if ('retainedRead' in data) return showRetainedHistory(data.retainedRead);
  if ('retainedHistoryNext' in data) return showRetainedHistory(data.retainedHistoryNext, true);
  if ('retainedExport' in data) return exportLiveGame(data.retainedExport);
  if ('export' in data) return exportLiveGame();
  if ('import' in data) { $('#import-file').click(); return; }
  if ('exportLegacy' in data) {
    try { downloadText('百世问鼎-旧版原始数据.json', JSON.stringify(Object.fromEntries(legacyKeys.map(key => [key, storage.getItem(key)])), null, 2)); }
    catch { notify('原始数据暂时无法读取，请检查浏览器存储设置。', true); }
  }
});

$('#import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  if (uiBusy || liveSnapshot?.busy) return notify('故事正在保存，请稍候再恢复备份。', true);
  if (!file.name?.endsWith('.wending.jsonl')) return notify('请选择 .wending.jsonl 格式的完整存档备份。', true);
  confirmAction('恢复存档备份', '<p>游戏只有一个存档。备份通过完整校验后，会覆盖当前进度；校验或保存失败时，原进度保持不变。</p>', async () => {
    if (uiBusy || liveSnapshot?.busy) return notify('故事正在保存，请稍后恢复。', true);
    uiBusy = true; render();
    try {
      await ensureLive(); await importLiveArchive(file.stream(), liveArchive);
      liveError = ''; view = 'adventure'; await liveSession.load(); render();
      await liveSession.resume(); notify('存档已校验并恢复。');
    } catch { notify('备份未能恢复，原进度保持不变。', true); }
    finally { uiBusy = false; render(); }
  }, '确认覆盖并恢复');
});

$('#dialog').addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
$('#dialog').addEventListener('close', () => { const target = dialogReturnTarget; dialogReturnTarget = null; dialogConfirm = null; resolveFocusTarget(target)?.focus({ preventScroll: true }); });
$('#dialog').addEventListener('click', event => { if (event.target === $('#dialog')) { const rect = $('#dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
window.addEventListener?.('pageshow', event => { if (event.persisted && webContext) liveSession?.resume(); });

render();
initializeScreens();
