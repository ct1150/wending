import { REALMS, PATHS, ORIGINS, WORLDS, ITEMS, LEGACIES, EVENTS, ENEMIES, CHALLENGES, WORLD_FLAGS } from './game/content.js';
import { createGame, getStats, getActionInfo, act, getEventChoices, chooseEvent, combatAction, equipItem, selectLegacy, reincarnate, serialize, deserialize, getStoryView, chooseStory } from './game/engine.js';
import { bootstrapSession, persistSession } from './ui/session.js';
import { icon } from './ui/icons.js';
import { renderCombatActions } from './ui/combat.js';
import { getPrimaryResult, renderStoryScene, renderStoryRecords, renderStoryOutcome, renderStoryInterruption } from './ui/story.js';

const $ = selector => document.querySelector(selector);
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
};
function newSeed() {
  return window.crypto?.getRandomValues ? String(window.crypto.getRandomValues(new Uint32Array(1))[0]) : String(Date.now());
}
let session = bootstrapSession(storage, { seed: newSeed() });
let state = session.state;
let view = 'adventure';
let preparingLife = false;
let saveError = session.error;
let lastSaved = session.saved;
let toastTimer;
let dialogConfirm = null;
const openPanels = new Map();
let setup = { name: '云归', originId: 'village', pathId: 'sword', legacyIds: [] };

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

function replaceSession(next) {
  session = { status: 'fresh', state: next, rawCorruptSave: null, error: '', saved: false };
  openPanels.clear();
  preparingLife = false;
  view = 'adventure';
  update(next, { message: false, focusStory: true, resetSupport: true });
}

function beginRecommendedLife() {
  replaceSession(createGame({ name: '云归', originId: 'village', pathId: 'sword', legacyIds: [], seed: newSeed() }));
  $('#story-scene-title')?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function update(next, options = {}) {
  const previous = state;
  const beforeStory = previous && getStoryView(previous);
  const beforeResult = getPrimaryResult(beforeStory, previous?.run.log || []);
  const afterStory = getStoryView(next);
  const active = document.activeElement;
  const controlAttribute = ['data-action', 'data-combat', 'data-reward', 'data-equip'].find(name => active?.hasAttribute(name));
  const controlValue = controlAttribute && active.getAttribute(controlAttribute);
  const controlSlot = active?.getAttribute('data-slot') ?? null;
  state = next;
  persist();
  if (options.goAdventure) view = 'adventure';
  render({ resetSupport: options.resetSupport || previous?.meta.generation !== next.meta.generation });
  if (view === 'adventure') {
    const resultChanged = JSON.stringify(beforeResult) !== JSON.stringify(getPrimaryResult(afterStory, next.run.log));
    const sceneChanged = beforeStory?.sceneId !== afterStory?.sceneId;
    const phaseChanged = previous?.phase !== next.phase;
    const locationChanged = previous?.run.worldId !== next.run.worldId;
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

function attempt(callback, options) {
  try { update(callback(), options); }
  catch (error) { notify(error.message || '这一步暂时无法进行。', true); }
}

function openDialog(title, body, actions = '') {
  const dialog = $('#dialog');
  dialog.innerHTML = `<header class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-button" data-close-dialog aria-label="关闭">${icon('close')}</button></header><div class="dialog-body">${body}</div>${actions ? `<footer class="dialog-actions">${actions}</footer>` : ''}`;
  if (!dialog.open) dialog.showModal();
}

function confirmAction(title, body, callback, label = '确认继续') {
  dialogConfirm = callback;
  openDialog(title, body, `<button class="button ghost" data-close-dialog>再想一想</button><button class="button primary" data-confirm>${esc(label)}</button>`);
}

function showHelp() {
  openDialog('入世须知', `<p>你的这一世，从药谷旧火开始。相逢、调查与取舍，会改变谷地，也改变后来人要面对的事。</p><div class="help-tip"><strong>先看眼前之事，再落下一念。</strong><br>场景与目标指明眼前方向；选项会列出所需岁月、灵石、药材、气血或命损。无法选择的缘由也会写明。选择的后果会留在正文中，手记、人物、线索与生平都在页面下方「回看」中。资源、修为和自身余寿在「状态」中。</div><div class="help-tip"><strong>调查有取舍，岁月只有一条河。</strong><br>药谷旧火的三条调查线最多追查两条。修炼、外出和旅行也推进世界年份，可能令最后一夜提前到来；阅读、看手记与换装不耗时。倒计时按游戏中的年计算。</div><div class="help-tip"><strong>修行是此生的另一条路。</strong><br>在页面下方「修行」中闭关、休息、炼丹或自由历练。修为满足条件后可尝试破境，突破提高寿限。主线结果确定后，仍可继续修行、问道三界，或归隐转世。</div><div class="help-tip"><strong>功法与法器要亲自装配。</strong><br>从「修行 → 功法与法器」中选择一门本命功法、两个神通与一件法器，再返回当前剧情。身在幽冥或天界时，可回看药谷故事；回到人间才能继续作出谷中的选择。</div><div class="help-tip"><strong>留意余寿和气血。</strong><br>燃寿强攻损耗寿元，延寿丹每世最多服用两次。战斗需先分胜负或遁走，才能继续剧情。</div><div class="help-tip"><strong>转世，走进自己改变的世界。</strong><br>医谷共守、宗门接管与焚种迁民，会通向不同的后世事务。人物随世界年份老去，新的你也有新的身份。寿尽、陨落或归隐后，从真实经历产生的候选中选一项传承；下世最多携带两项已得传承。世界因果与三界道证自动延续。</div><div class="help-tip"><strong>问鼎三界。</strong><br>取得人间、幽冥、天界的三枚道证，修至登仙，在天界挑战三界共主。可随时从「修行 → 三界山河」查看长远目标。</div><p>旧存档的当世沿旧途继续，结束此生并转世后进入新篇，不会补写未曾经历的药谷往事。进度自动保存在当前浏览器；更换设备前，请在页首「存档与设置」中导出备份。</p>`, '<button class="button primary" data-close-dialog>我已明了</button>');
}

function render({ resetSupport = false, focusSelector = null } = {}) {
  if (resetSupport) openPanels.clear();
  else document.querySelectorAll('details[data-panel-key]').forEach(panel => openPanels.set(panel.dataset.panelKey, panel.open));
  const story = state && getStoryView(state);
  const timed = story?.id === 'old-fire' && story.status === 'active' && story.deadlineYear !== null;
  const clock = timed ? `距封谷 ${num(Math.max(0, story.yearsRemaining))} 年` : state ? `第 ${num(state.meta.generation)} 世 · ${num(state.run.age)} 岁` : '旧存档待恢复';
  const standalone = view !== 'adventure';
  const returnLabel = state?.phase === 'combat' ? '返回未完成战斗' : state?.phase === 'event' ? '返回未完成际遇' : preparingLife ? '返回转世选择' : '返回当前剧情';
  $('#app').innerHTML = `<div class="paper-page"><header class="paper-top"><div><h1>百世问鼎</h1><p class="paper-clock">${esc(clock)}</p></div><nav class="paper-tools" aria-label="帮助与设置"><button data-help>帮助</button><button data-view="settings" ${view === 'settings' ? 'aria-current="page"' : ''}>存档与设置</button></nav></header>
    <main id="main-content" class="paper-main" tabindex="-1">${saveError ? `<div class="notice error" role="alert"><p>${esc(saveError)}${session.status === 'blocked' ? ' 原存档未被覆盖，自动保存已暂停。' : ''}</p>${session.rawCorruptSave !== null ? '<button data-export-corrupt class="button">备份原存档</button>' : ''}${state ? '<button data-export class="button">导出当前进度</button>' : ''}</div>` : ''}
    ${standalone ? `<div class="paper-return"><button class="small-button" data-view="adventure">${icon('arrow', 14)}${esc(returnLabel)}</button></div>` : ''}
    ${view === 'settings' ? renderSettings() : session.status === 'blocked' ? renderRecovery() : preparingLife ? renderSetup() : renderView()}
    </main><footer class="paper-footer">${lastSaved && !saveError ? '进度已自动保存' : state ? '请及时导出备份' : '岁月只在落子时前行'}</footer></div>`;
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
  return `${content}${renderUtilities(story)}`;
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
  return `<section class="ending"><span class="eyebrow">${victory ? '三界归一 · 万世有终' : '一世因果，皆有回响'}</span><div class="ending-symbol" aria-hidden="true">${victory ? '鼎' : '归'}</div><h2 id="ending-title" tabindex="-1">${victory ? '你已问鼎三界' : esc(summary.title)}</h2><p>${esc(summary.text)}</p>${renderStoryOutcome(getStoryView(state))}<div class="ending-stats"><div><b>${num(summary.age)}</b><span>此生岁月</span></div><div><b>${esc(REALMS[summary.realmIndex].name)}</b><span>最终境界</span></div><div><b>${state.meta.proofs.length} / 3</b><span>三界道证</span></div></div>${summary.deeds.length ? `<div class="deeds">${summary.deeds.slice(-8).map(deed => `<span class="deed">${esc(deed)}</span>`).join('')}</div>` : ''}${summary.worldChanges.length ? `<p class="tiny muted">${esc(summary.worldChanges.slice(-2).join(' '))}</p>` : ''}${summary.selectedLegacyId ? `<div id="selected-reward" class="selected-reward" tabindex="-1">${icon('check', 16)} 已将「${esc(row(LEGACIES, summary.selectedLegacyId).name)}」记入神魂传承。</div>` : options.length ? `<div class="selection-title">${icon('lotus', 15)}选择一项此生传承</div><div class="legacy-select-grid">${options.map(id => { const legacy = row(LEGACIES, id); return `<button class="select-card" data-reward="${id}"><h3>${esc(legacy.name)}</h3><p>${esc(legacy.description)}</p><p class="text-gold">${esc(legacy.source)}</p></button>`; }).join('')}</div>` : '<p class="tiny muted">此生暂无新的神魂传承。已获得的道证与世界因果会继续保留。</p>'}${victory ? '<p>每一世未竟的心愿，都汇入了此刻。旧日天规由你重写，轮回的故事仍可继续。</p>' : ''}<div class="ending-button-row"><button class="button primary large" data-rebirth ${options.length && !summary.selectedLegacyId ? 'disabled' : ''}>${icon('refresh', 17)} ${victory ? '再启一世，续写传说' : '携此因果，再入轮回'}</button><button class="button ghost" data-export>${icon('download', 16)}备份此刻</button></div></section>`;
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

function renderSettings() {
  return `${heading('存档与设置', '将这一刻的修行妥善收藏，待下一次回来继续。')}<div class="settings-grid"><section class="settings-row"><div><h3>导出修行存档</h3><p>下载包含当前人生、传承、世界因果和随机状态的备份，可导入到另一台设备。</p></div><button class="button primary" data-export ${state ? '' : 'disabled'}>${icon('download', 16)}导出存档</button></section><section class="settings-row"><div><h3>导入已有存档</h3><p>选择之前导出的 JSON 文件。通过完整校验后，再确认替换当前修行进度。</p></div><button class="button" data-import>${icon('upload', 16)}选择存档</button></section>${window.location.protocol !== 'file:' ? '<section class="settings-row"><div><h3>下载离线版</h3><p>保存为一个 HTML 文件，断网也能继续修行。将当前存档一并导出，再在离线版中导入。</p></div><a class="button" href="./baishi-wending-offline.html" download="百世问鼎-离线版.html">' + icon('download', 16) + '下载游戏</a></section>' : ''}<section class="settings-row"><div><h3>入世指南</h3><p>了解药谷主线、调查取舍、共同岁月与转世后的故事，也可查看修行、装备与三界规则。</p></div><button class="button" data-help>${icon('help', 16)}查看指南</button></section><section class="settings-row"><div><h3>重启所有轮回</h3><p>替换这台设备上的当前存档，重新开始第一世。建议先导出备份。</p></div><button class="button danger" data-reset>${icon('refresh', 16)}重新开始第一世</button></section></div><p class="save-info">药谷旧火 · 单机本地存档<br>存档不会上传至服务器。不同浏览器、域名或离线文件的存储彼此独立，请用导出与导入迁移。隐私模式或禁用本地存储时，请在离开前手动备份。</p>`;
}

function downloadText(filename, text, mime = 'application/json;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportGame() {
  if (!state) return notify('尚无修行进度可导出。', true);
  try { downloadText(`百世问鼎-第${state.meta.generation}世-${state.run.age}岁.json`, serialize(state)); notify('存档已导出，请妥善保存。'); }
  catch (error) { notify(`导出失败：${error.message}`, true); }
}

function startGame() {
  if (!preparingLife || !state || !['ended', 'victory'].includes(state.phase)) return;
  try {
    const options = { ...setup, name: setup.name.trim() || '云归', seed: newSeed() };
    replaceSession(reincarnate(state, options));
    $('#main-content')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (error) { notify(error.message, true); }
}

document.addEventListener('input', event => { if (event.target.id === 'dao-name') setup.name = event.target.value; });

document.addEventListener('click', event => {
  const button = event.target.closest('button,a');
  if (!button || button.disabled) return;
  const data = button.dataset;
  if ('closeDialog' in data) { $('#dialog').close(); dialogConfirm = null; return; }
  if ('confirm' in data) { const callback = dialogConfirm; dialogConfirm = null; $('#dialog').close(); callback?.(); return; }
  if ('help' in data) return showHelp();
  if ('view' in data) {
    view = data.view; render();
    if (view === 'adventure' && state && !preparingLife) focusAdventure($('#ending-title') || $('#combat-title') || $('#event-title') || $('#story-scene-title') || $('#main-content'));
    else { $('#main-content')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
    return;
  }
  if ('path' in data && preparingLife) { setup.pathId = data.path; render({ focusSelector: `[data-path="${data.path}"]` }); return; }
  if ('origin' in data && preparingLife) { setup.originId = data.origin; render({ focusSelector: `[data-origin="${data.origin}"]` }); return; }
  if ('carry' in data && preparingLife) {
    if (setup.legacyIds.includes(data.carry)) setup.legacyIds = setup.legacyIds.filter(id => id !== data.carry);
    else if (setup.legacyIds.length >= 2) return notify('每一世最多携带两项传承，请先取消一项。', true);
    else setup.legacyIds.push(data.carry);
    render({ focusSelector: `[data-carry="${data.carry}"]` }); return;
  }
  if ('start' in data) return startGame();
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
  if ('rebirth' in data && state) { setup = { name: state.run.name, originId: state.run.originId, pathId: state.run.pathId, legacyIds: state.meta.legacyIds.slice(-2) }; preparingLife = true; view = 'adventure'; render({ focusSelector: '#dao-name' }); window.scrollTo({ top: 0, behavior: 'instant' }); return; }
  if ('travel' in data && state) {
    const go = () => attempt(() => act(state, { type: 'travel', worldId: data.travel }), { goAdventure: true });
    if (getStats(state).remainingLife <= 2) return confirmAction('余寿不足', '游历两年将耗尽余寿，无法抵达目的地。仍要踏上这最后一程吗？', go, '踏上最后一程');
    go(); return;
  }
  if ('challenge' in data && state) return attempt(() => act(state, { type: 'challenge', challengeId: data.challenge }), { goAdventure: true });
  if ('finale' in data && state) return confirmAction('最后的问鼎', '你将向三界共主发起决战。请确认气血充足、功法与法器已装配妥当。', () => attempt(() => act(state, { type: 'finale' }), { goAdventure: true }), '执此一念，问鼎三界');
  if ('export' in data) return exportGame();
  if ('exportCorrupt' in data && session.rawCorruptSave !== null) { downloadText('百世问鼎-原存档备份.txt', session.rawCorruptSave, 'text/plain;charset=utf-8'); return; }
  if ('import' in data) { $('#import-file').click(); return; }
  if ('newGame' in data || 'reset' in data) return confirmAction('重新开始第一世', '这将替换当前浏览器中的修行、传承与历史。请先备份原存档或导出当前进度；已经导出的文件不受影响。', beginRecommendedLife, '确认替换并开始');
});

$('#import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return notify('存档文件超过 2 MB，请选择有效的游戏存档。', true);
  try {
    const imported = deserialize(await file.text());
    confirmAction('导入修行存档', `将恢复「${esc(imported.run.name)}」的第 ${imported.meta.generation} 世（${imported.run.age} 岁，${esc(REALMS[imported.run.realmIndex].name)}境）。${state ? '当前进度将被替换；如需保留，请先取消并导出备份。' : ''}`, () => {
      replaceSession(imported); notify('存档已恢复，仙途继续。');
    }, '确认恢复');
  } catch (error) { notify(error.message || '无法读取这个存档文件。', true); }
});

if (session.status === 'fresh') persist();

$('#dialog').addEventListener('cancel', () => { dialogConfirm = null; });
$('#dialog').addEventListener('click', event => { if (event.target === $('#dialog')) { const rect = $('#dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { $('#dialog').close(); dialogConfirm = null; } } });
render();
