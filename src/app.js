import { REALMS, PATHS, ORIGINS, WORLDS, ITEMS, LEGACIES, EVENTS, ENEMIES, CHALLENGES, WORLD_FLAGS } from './game/content.js';
import { createGame, getStats, getActionInfo, act, getEventChoices, chooseEvent, combatAction, equipItem, selectLegacy, reincarnate, serialize, deserialize } from './game/engine.js';
import { SAVE_KEY, saveToStorage, loadFromStorage } from './game/persistence.js';
import { icon } from './ui/icons.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const row = (rows, id) => rows.find(item => item.id === id);
const num = value => Math.round(value || 0).toLocaleString('zh-CN');
const pct = (value, total) => Math.max(0, Math.min(100, total ? value / total * 100 : 0));
const NAV = [{ id: 'adventure', name: '此生历练', short: '历练', icon: 'compass' }, { id: 'worlds', name: '三界山河', short: '三界', icon: 'map' }, { id: 'inventory', name: '功法法器', short: '功法', icon: 'sword' }, { id: 'legacies', name: '轮回传承', short: '传承', icon: 'lotus' }, { id: 'chronicle', name: '百世生平', short: '生平', icon: 'scroll' }];
const WORLD_ICONS = { mortal: 'mountain', nether: 'moon', celestial: 'sun' };
const PATH_ICONS = { sword: 'sword', body: 'shield', alchemy: 'cauldron' };
const CAUSES = { retired: '归隐', lifespan: '寿尽', battle: '陨落', victory: '问鼎' };
let state = null;
let view = 'adventure';
let preparingLife = false;
let saveError = '';
let corruptSave = '';
let lastSaved = false;
let toastTimer;
let dialogConfirm = null;
let setup = { name: '云归', originId: 'village', pathId: 'sword', legacyIds: [] };

try { state = loadFromStorage(window.localStorage); lastSaved = Boolean(state); }
catch (error) { saveError = error.message; try { corruptSave = window.localStorage.getItem(SAVE_KEY) || ''; } catch { /* storage denied */ } }

function notify(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, error ? 6000 : 4200);
}

function persist() {
  if (!state || corruptSave) return;
  try { saveToStorage(state, window.localStorage); lastSaved = true; saveError = ''; }
  catch (error) { lastSaved = false; saveError = `自动保存暂不可用：${error.message}。请导出存档备份。`; }
}

function update(next, options = {}) {
  state = next;
  persist();
  if (options.goAdventure) view = 'adventure';
  render();
  if (options.message !== false && state.lastMessage) notify(state.lastMessage);
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
  openDialog('入世须知', `<p>在《百世问鼎》中，你用有限的寿元，走出属于自己的一条修行路。</p><div class="help-tip"><strong>先修行，再破境。</strong><br>闭关积累修为，满足条件后突破。突破会提高寿限；失败保留修为，下次成功率提高。</div><div class="help-tip"><strong>际遇决定这一世的方向。</strong><br>外出历练获得资源、功法与因果，也可能遭遇敌人。选项会展示额外成本和已知风险。</div><div class="help-tip"><strong>装备需要亲自装配。</strong><br>在「功法」中选择一门本命功法、两个神通与一件法器。获得新物品后，比较效果再取舍。</div><div class="help-tip"><strong>留意余寿和气血。</strong><br>闭关、旅行会推进世界时间；燃寿强攻只损耗你的寿元。延寿丹每世最多服用两次。</div><div class="help-tip"><strong>这一世的终点，是下一世的起点。</strong><br>寿尽或陨落后，从真实经历产生的奖励中选择一项传承。下世最多带入两项，世界因果与道证保留。</div><div class="help-tip"><strong>问鼎三界。</strong><br>取得人间、幽冥、天界的三枚道证，修至登仙，在天界挑战三界共主。</div><p>进度自动保存在当前浏览器。更换设备前，请在「存档」中导出备份。</p>`, '<button class="button primary" data-close-dialog>我已明了</button>');
}

function renderNav(mobile = false) {
  return NAV.map(nav => `<button class="${mobile ? '' : 'nav-item '}${view === nav.id ? 'active' : ''}" data-view="${nav.id}" ${!state && nav.id !== 'adventure' ? 'disabled' : ''} ${view === nav.id ? 'aria-current="page"' : ''}>${icon(nav.icon)}<span class="${mobile ? '' : 'nav-label'}">${nav[mobile ? 'short' : 'name']}</span></button>`).join('');
}

function render() {
  const starting = !state || preparingLife;
  const navTitle = view === 'settings' ? '存档与设置' : row(NAV, view)?.name || '此生历练';
  const phaseNote = state && !starting && ['event', 'combat'].includes(state.phase) && view !== 'adventure';
  $('#app').innerHTML = `<div class="app-shell">
    <aside class="sidebar" aria-label="主导航"><div class="brand"><span class="seal" aria-hidden="true">问</span><div class="brand-text"><div class="brand-title">百世问鼎</div><div class="brand-en">A HUNDRED LIVES</div></div></div><div class="sidebar-rule">道途</div><nav class="nav-list">${renderNav()}</nav><div class="sidebar-bottom"><div class="sidebar-verse">此生未尽之愿<br>来世再续前缘</div><button class="nav-item ${view === 'settings' ? 'active' : ''}" data-view="settings">${icon('settings')}<span class="nav-label">存档与设置</span></button><div class="sidebar-foot"><i class="status-dot"></i><span>单机修行 · 随时续缘</span></div></div></aside>
    <div class="main-shell"><header class="topbar"><div class="mobile-brand"><span class="seal" aria-hidden="true">问</span><h1>百世问鼎</h1></div><div class="breadcrumb">${icon('mountain', 16)}<span>轮回之境</span>${icon('chevron', 12)}<b>${esc(navTitle)}</b></div><div class="top-tools"><span class="saved-label">${lastSaved && !saveError ? '进度已自动保存' : '以寿为筹，以因果为路'}</span><button class="icon-button" data-help aria-label="玩法指南" title="玩法指南">${icon('help', 18)}</button><button class="icon-button" data-view="settings" aria-label="存档与设置" title="存档与设置">${icon('save', 18)}</button></div></header>
      <div class="body-grid"><main id="main-content" class="main-column" tabindex="-1">${saveError ? `<div class="notice error">${icon('help', 16)}<span>${esc(saveError)} ${corruptSave ? '<button data-export-corrupt class="small-button">备份原存档</button>' : ''}</span></div>` : ''}${phaseNote ? `<div class="pending-banner">${icon('compass', 17)}你还有一场${state.phase === 'combat' ? '战斗' : '际遇'}待继续。<button data-view="adventure">返回历练 ${icon('arrow', 14)}</button></div>` : ''}${view === 'settings' ? renderSettings() : starting ? renderSetup() : renderView()}<div class="footer-line">一念入仙途 · 万世留回响</div></main><aside class="side-column" aria-label="修行概况">${starting ? renderOnboarding() : renderSidebar()}</aside></div>
    </div><nav class="mobile-nav" aria-label="游戏导航">${renderNav(true)}</nav></div>`;
}

function hero(worldId = 'mortal', opening = false) {
  const world = row(WORLDS, worldId);
  return `<section class="hero ${opening ? 'hero-setup' : ''}" data-world="${worldId}" aria-label="${opening ? '开启修仙人生' : esc(world.location)}"><img class="hero-art" src="./assets/landscape.svg" alt="" /><span class="coordinate">${opening ? '万象初开 · 一念之间' : `道历 ${num(state.meta.worldYear)} 年`}</span><div class="hero-content"><div class="hero-label">${icon(opening ? 'feather' : WORLD_ICONS[worldId], 15)}${opening ? '文字修仙 · 因果肉鸽' : `${esc(world.name)} / ${esc(world.subtitle)}`}</div><h2>${opening ? '此生问道，<br>来世问鼎。' : esc(world.location)}</h2><p>${opening ? '在有限的岁月里选择、相逢、突破。<br>让这一世的故事，成为下一世的机缘。' : esc(world.description)}</p><div class="hero-pill">${icon(opening ? 'lotus' : 'compass', 12)}${opening ? '每一世，都是未曾走过的仙途' : `${esc(row(PATHS, state.run.pathId).name)}之路 · ${esc(REALMS[state.run.realmIndex].name)}境`}</div></div><span class="hero-caption">山河无恙 · 故人有期</span></section>`;
}

function renderSetup() {
  const inherited = state?.meta.legacyIds || [];
  const nextGeneration = state ? state.meta.generation + 1 : 1;
  return `${hero('mortal', true)}<section class="setup-box"><header class="setup-heading"><h2>${state ? '再续一世仙缘' : '一念，入仙途'}</h2><span>第 ${num(nextGeneration)} 世 · 灵台初醒</span></header>${state ? '<p class="setup-intro">肉身归于尘土，所行之事留在世间。选择新的出身，带着前世的回响重新启程。</p>' : ''}<div class="setup-name"><label for="dao-name">你的道号</label><input id="dao-name" autocomplete="off" maxlength="24" placeholder="为此生取一个名字" value="${esc(setup.name)}" /><span class="micro-label">十六岁，故事从此刻开始。</span></div><div class="selection-title">${icon('sword', 14)}选择修行之路</div><div class="selection-grid">${PATHS.map(path => `<button class="select-card ${setup.pathId === path.id ? 'selected' : ''}" data-path="${path.id}" aria-pressed="${setup.pathId === path.id}"><div class="select-icon">${icon(PATH_ICONS[path.id], 25)}</div>${setup.pathId === path.id ? `<span class="selection-tick">${icon('check', 14)}</span>` : ''}<h3>${esc(path.name)}</h3><p>${esc(path.description)}</p></button>`).join('')}</div><div class="selection-title">${icon('people', 14)}选择此世出身</div><div class="selection-grid origin-grid">${ORIGINS.map(origin => `<button class="select-card ${setup.originId === origin.id ? 'selected' : ''}" data-origin="${origin.id}" aria-pressed="${setup.originId === origin.id}">${setup.originId === origin.id ? `<span class="selection-tick">${icon('check', 13)}</span>` : ''}<h3>${esc(origin.name)}</h3><p>${esc(origin.description)}</p></button>`).join('')}</div>${inherited.length ? `<div class="selection-title">${icon('lotus', 14)}带入前世传承 <span class="spacer"></span><span class="micro-label">${setup.legacyIds.length} / 2</span></div><div class="legacy-select-grid">${inherited.map(id => { const legacy = row(LEGACIES, id); return `<button class="select-card ${setup.legacyIds.includes(id) ? 'selected' : ''}" data-carry="${id}" aria-pressed="${setup.legacyIds.includes(id)}"><h3>${esc(legacy.name)}</h3><p>${esc(legacy.description)}</p>${setup.legacyIds.includes(id) ? `<span class="selection-tick">${icon('check', 14)}</span>` : ''}</button>`; }).join('')}</div>` : ''}<div class="setup-actions"><p>无需注册，随时停下。修行进度自动保存在此设备，支持导出备份。</p><button class="button primary large" data-start>${state ? '转世，再入仙途' : '执此一念，踏入仙途'} ${icon('arrow', 17)}</button></div>${state ? '<button class="small-button" data-cancel-setup>返回此生结算</button>' : ''}</section>`;
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

function renderAdventure() {
  const stats = getStats(state);
  let content;
  if (state.phase === 'event') content = renderEvent();
  else if (state.phase === 'combat') content = renderCombat();
  else if (['ended', 'victory'].includes(state.phase)) content = renderEnding();
  else {
    const actionDetails = { explore: { icon: 'compass', description: '寻访山河，遇见此世的机缘。' }, train: { icon: 'lotus', description: `增长 ${num(stats.training)} 修为，凝练自身道心。` }, breakthrough: { icon: 'spark', description: stats.nextRealm ? `冲击${stats.nextRealm.name}，成功率 ${Math.round(stats.breakthroughChance * 100)}%。` : '已臻登仙，前往三界完成最后的试炼。' }, rest: { icon: 'leaf', description: '疗愈气血，暂歇于山风与月色。' }, alchemy: { icon: 'cauldron', description: `寿限 +${stats.realm.trainYears * 2} 年；3 灵药 / 15 灵石（${state.run.elixirsUsed}/2）。` }, retire: { icon: 'feather', description: '收束此生经历，为来世留下回响。' } };
    content = `${hero(state.run.worldId)}${resourceStrip()}<header class="section-header"><span class="section-number">一</span><h2>岁月由你落子</h2><span class="section-label">此刻，如何抉择</span></header><div class="action-grid">${['explore', 'train', 'breakthrough', 'rest', 'alchemy', 'retire'].map(type => { const info = getActionInfo(state, type); const detail = actionDetails[type]; return `<button class="action-card ${type === 'explore' ? 'primary' : ''}" data-action="${type}" ${info.enabled ? '' : 'disabled'} title="${esc(info.reason || info.costText)}"><div class="action-top">${icon(detail.icon, 23)}<span class="action-years">${info.years ? `历时 ${info.years} 年` : '一生结算'}</span></div><h3>${esc(info.label)}</h3><p>${esc(info.enabled ? detail.description : info.reason)}</p><span class="arrow-corner">${icon('arrow', 14)}</span></button>`; }).join('')}</div><p class="adventure-note">${icon('hourglass', 13)}岁月随行动流逝，查看与换装不会耗时。历练也可能遭遇战斗；寿元耗尽前，请为未竟之愿留下传承。</p>`;
  }
  const progress = stats.nextRealm ? `<span>迈向${esc(stats.nextRealm.name)}</span><strong>${num(state.run.cultivation)} / ${num(stats.need)} 修为</strong><div class="meter" role="progressbar" aria-label="突破修为" aria-valuemin="0" aria-valuemax="${stats.need}" aria-valuenow="${Math.min(state.run.cultivation, stats.need)}"><span style="width:${pct(state.run.cultivation, stats.need)}%"></span></div>` : '<span>登仙已成</span><strong>三界道证 ' + state.meta.proofs.length + ' / 3</strong>';
  return `${heading(`第 ${num(state.meta.generation)} 世 · ${['ended', 'victory'].includes(state.phase) ? '一生回望' : '此生问道'}`, `${state.run.name} · ${row(PATHS, state.run.pathId).name} · ${num(state.run.age)} 岁`, `<span class="chapter-tag">${esc(REALMS[state.run.realmIndex].name)}境</span>`)}${!['ended', 'victory'].includes(state.phase) ? `<div class="compact-progress">${progress}</div>` : ''}${content}${renderLog(5)}`;
}

function renderLog(limit = 5) {
  const entries = [...state.run.log].reverse().slice(0, limit);
  return `<section class="life-log" aria-label="修行手记"><div class="log-title"><h2>修行手记</h2>${view !== 'chronicle' ? '<button class="small-button" data-view="chronicle">展开生平 ' + icon('arrow', 13) + '</button>' : `<span class="micro-label">最近 ${entries.length} 条经历</span>`}</div><div class="log-list">${entries.map(entry => `<article class="log-entry"><div class="log-age">${num(entry.age)} 岁</div><div><h4>${esc(entry.title)}</h4><p>${esc(entry.text)}</p></div></article>`).join('')}</div></section>`;
}

function choiceCosts(choice) {
  const cost = choice.cost || {};
  const bits = [];
  if (cost.years) bits.push(`额外 ${cost.years} 年`);
  if (cost.spirit) bits.push(`${cost.spirit} 灵石`);
  if (cost.herbs) bits.push(`${cost.herbs} 灵药`);
  if (cost.hp) bits.push(`${cost.hp} 气血`);
  if (cost.lifeDamage) bits.push(`燃寿 ${cost.lifeDamage} 年`);
  if (typeof choice.chance === 'number') bits.push(`成功率 ${Math.round(choice.chance * 100)}%`);
  return bits.length ? bits.map(bit => `<span>${esc(bit)}</span>`).join('') : '<span>无额外消耗</span>';
}

function renderEvent() {
  const event = row(EVENTS, state.eventId);
  if (!event) return '<div class="notice error">当前际遇内容无法读取，请导出存档并重新加载。</div>';
  return `${resourceStrip()}<section class="event-panel"><div class="event-top"><span class="event-decoration" aria-hidden="true">缘</span><div class="event-category">${icon('feather', 15)}${esc(event.tag || '山河际遇')}<span class="spacer"></span><span class="micro-label">${esc(row(WORLDS, state.run.worldId).name)}</span></div><h2>${esc(event.title)}</h2><p class="event-body">${esc(event.body)}</p></div><div class="choices">${getEventChoices(state).map((choice, index) => `<button class="choice" data-choice="${esc(choice.id)}" ${choice.enabled ? '' : 'disabled'}><span class="choice-index">${String(index + 1).padStart(2, '0')}</span><div><h3>${esc(choice.label)}</h3><p>${esc(choice.description)}</p><div class="choice-cost">${choiceCosts(choice)}</div>${choice.enabled ? '' : `<p class="choice-reason">${esc(choice.reason)}</p>`}</div>${icon('chevron', 14)}</button>`).join('')}</div><p class="event-footer">${icon('lotus', 12)} 一念抉择，也许会在下一世与你重逢。</p></section>`;
}

function renderCombat() {
  const combat = state.combat;
  const enemy = row(ENEMIES, combat.enemyId);
  const stats = getStats(state);
  const heavy = combat.round % 3 === 0;
  const actions = [{ id: 'strike', name: '出手破敌', icon: 'sword', sub: `攻势 ${num(stats.attack)}` }, { id: 'guard', name: '守势蓄力', icon: 'shield', sub: '减伤，蓄势下一击' }, { id: 'burn', name: '燃寿强攻', icon: 'flame', sub: '损耗 5 年寿元' }, { id: 'flee', name: '遁走避锋', icon: 'feather', sub: '损失灵石，耗时 2 年' }];
  return `${resourceStrip()}<section class="battle-card"><div class="battle-head"><div class="section-label">${combat.challengeId ? '问道试炼' : '狭路相逢'} · 第 ${num(combat.round)} 回合</div><div class="battle-enemy">${icon(combat.challengeId ? 'gate' : 'sword', 39)}</div><h2>${esc(enemy.name)}</h2><p>${esc(enemy.description)}</p><div class="battle-health"><div class="meter-label"><span>对手气血</span><strong>${num(combat.enemyHp)} / ${num(combat.enemyMaxHp)}</strong></div><div class="meter red"><span style="width:${pct(combat.enemyHp, combat.enemyMaxHp)}%"></span></div></div><div class="intent ${heavy ? 'heavy' : ''}">${icon(heavy ? 'flame' : 'eye', 15)}${heavy ? '危险预兆：对手即将发动重击' : `敌方意图：${esc(enemy.intent || '蓄力试探，寻隙进攻')}`}</div></div><div class="battle-player"><span>你的气血 <b>${num(state.run.hp)}</b></span><span>防御 ${num(stats.defense)}</span>${combat.focus ? `<span class="text-gold">已蓄势 × ${num(combat.focus)}</span>` : ''}</div><div class="battle-actions">${actions.map(action => `<button data-combat="${action.id}" ${action.id === 'burn' && stats.remainingLife <= 5 ? 'disabled title="余寿不足以承受禁术"' : ''}>${icon(action.icon, 21)}<span>${action.name}</span><small>${action.sub}</small></button>`).join('')}</div><div class="battle-log" aria-label="战斗记录">${combat.log.slice(-5).map(line => `<p>${esc(line)}</p>`).join('')}</div></section>`;
}

function renderEnding() {
  const summary = state.summary;
  const victory = state.phase === 'victory';
  const options = summary.legacyOptions.filter(id => row(LEGACIES, id));
  return `<section class="ending"><span class="eyebrow">${victory ? '三界归一 · 万世有终' : '一世因果，皆有回响'}</span><div class="ending-symbol" aria-hidden="true">${victory ? '鼎' : '归'}</div><h2>${victory ? '你已问鼎三界' : esc(summary.title)}</h2><p>${esc(summary.text)}</p><div class="ending-stats"><div><b>${num(summary.age)}</b><span>此生岁月</span></div><div><b>${esc(REALMS[summary.realmIndex].name)}</b><span>最终境界</span></div><div><b>${state.meta.proofs.length} / 3</b><span>三界道证</span></div></div>${summary.deeds.length ? `<div class="deeds">${summary.deeds.slice(-8).map(deed => `<span class="deed">${esc(deed)}</span>`).join('')}</div>` : ''}${summary.worldChanges.length ? `<p class="tiny muted">${esc(summary.worldChanges.slice(-2).join(' '))}</p>` : ''}${summary.selectedLegacyId ? `<div class="selected-reward">${icon('check', 16)} 已将「${esc(row(LEGACIES, summary.selectedLegacyId).name)}」记入神魂传承。</div>` : options.length ? `<div class="selection-title">${icon('lotus', 15)}选择一项此生传承</div><div class="legacy-select-grid">${options.map(id => { const legacy = row(LEGACIES, id); return `<button class="select-card" data-reward="${id}"><h3>${esc(legacy.name)}</h3><p>${esc(legacy.description)}</p><p class="text-gold">${esc(legacy.source)}</p></button>`; }).join('')}</div>` : '<p class="tiny muted">此生暂无新的神魂传承。已获得的道证与世界因果会继续保留。</p>'}${victory ? '<p>每一世未竟的心愿，都汇入了此刻。旧日天规由你重写，轮回的故事仍可继续。</p>' : ''}<div class="ending-button-row"><button class="button primary large" data-rebirth ${options.length && !summary.selectedLegacyId ? 'disabled' : ''}>${icon('refresh', 17)} ${victory ? '再启一世，续写传说' : '携此因果，再入轮回'}</button><button class="button ghost" data-export>${icon('download', 16)}备份此刻</button></div></section>`;
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
  return `${heading('功法与法器', '道途万千，取舍在心。有限的装配，构成这一世独有的修行之路。')}<div class="equipment-strip">${slots.map(slot => `<div class="slot"><small>${slot.title}</small><b>${esc(row(ITEMS, slot.id)?.name || '尚未装配')}</b><p>${slot.id ? '当前生效' : '历练可获新机缘'}</p></div>`).join('')}</div><div class="inventory-summary">${icon('sword', 16)}<span>攻势 ${num(stats.attack)}</span><span>防御 ${num(stats.defense)}</span><span>气血上限 ${num(stats.maxHp)}</span><span class="spacer"></span><span>已得 ${owned.length} 件</span></div><div class="item-grid">${owned.map(item => `<article class="item-card"><div class="item-top"><h3 class="rarity-${item.rarity}">${esc(item.name)}</h3><span class="badge ${item.rarity === 'epic' ? 'gold' : 'dim'}">${{ art: '功法', skill: '神通', artifact: '法器' }[item.kind]}</span></div><p>${esc(item.description)}</p><div class="item-stats">${statText(item)}</div><div class="item-actions">${equipped.includes(item.id) ? `<span class="small-button">${icon('check', 14)}已装配</span>` : item.kind === 'skill' ? [0, 1].map(slot => `<button class="button" data-equip="${item.id}" data-slot="${slot}" ${state.phase === 'adventure' ? '' : 'disabled'}>装入神通${slot ? '二' : '一'}</button>`).join('') : `<button class="button" data-equip="${item.id}" ${state.phase === 'adventure' ? '' : 'disabled'}>装配${item.kind === 'art' ? '功法' : '法器'} ${icon('arrow', 12)}</button>`}</div></article>`).join('')}</div>`;
}

function renderLegacies() {
  return `${heading('轮回传承', '肉身终有大限，神魂记得来路。每次转世，最多携带两项已得传承。', `<span class="badge gold">${state.meta.legacyIds.length} / ${LEGACIES.length}</span>`)}<p class="legacy-intro">传承来自修行中的真实经历。寿尽后选择一项新传承，重生时再决定带上哪两项；已取得的三界道证与世界因果会自动延续。</p><div class="item-grid">${LEGACIES.map(legacy => {
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
  return `<article class="chronicle-card"><header><h3>第 ${num(life.generation)} 世 · ${esc(life.name)}</h3><span class="badge ${life.cause === 'victory' ? 'gold' : 'dim'}">${esc(CAUSES[life.cause] || life.cause)}</span></header><p>${num(life.age)} 岁 · ${esc(REALMS[life.realmIndex].name)}境</p>${life.deeds.length ? `<div class="deeds">${life.deeds.slice(-7).map(deed => `<span class="deed">${esc(deed)}</span>`).join('')}</div>` : '<p>有人踏遍三界，有人归隐山林。这一生，也曾来过。</p>'}${legacy ? `<p class="history-legacy">${icon('lotus', 13)} 此生传承：${esc(legacy.name)}</p>` : ''}${entries.length ? `<details class="history-details"><summary>回看此世关键经历 <span>${entries.length} 则</span></summary><ol>${entries.map(entry => `<li><div class="history-date">${num(entry.age)} 岁 · 道历 ${num(entry.year)} 年</div><h4>${esc(entry.title)}</h4><p>${esc(entry.text)}</p></li>`).join('')}</ol></details>` : ''}</article>`;
}

function renderSettings() {
  return `${heading('存档与设置', '将这一刻的修行妥善收藏，待下一次回来继续。')}<div class="settings-grid"><section class="settings-row"><div><h3>导出修行存档</h3><p>下载包含当前人生、传承、世界因果和随机状态的备份，可导入到另一台设备。</p></div><button class="button primary" data-export ${state ? '' : 'disabled'}>${icon('download', 16)}导出存档</button></section><section class="settings-row"><div><h3>导入已有存档</h3><p>选择之前导出的 JSON 文件。通过完整校验后，再确认替换当前修行进度。</p></div><button class="button" data-import>${icon('upload', 16)}选择存档</button></section>${window.location.protocol !== 'file:' ? '<section class="settings-row"><div><h3>下载离线版</h3><p>保存为一个 HTML 文件，断网也能继续修行。将当前存档一并导出，再在离线版中导入。</p></div><a class="button" href="./baishi-wending-offline.html" download="百世问鼎-离线版.html">' + icon('download', 16) + '下载游戏</a></section>' : ''}<section class="settings-row"><div><h3>入世指南</h3><p>了解寿元、修行、功法、三界道证与跨世传承的基本规则。</p></div><button class="button" data-help>${icon('help', 16)}查看指南</button></section><section class="settings-row"><div><h3>重启所有轮回</h3><p>清除这台设备上的当前存档，重新开始第一世。建议先导出备份。</p></div><button class="button danger" data-reset>${icon('refresh', 16)}清除本地存档</button></section></div><p class="save-info">版本 1.0 · 单机本地存档<br>存档不会上传至服务器。不同浏览器、域名或离线文件的存储彼此独立，请用导出与导入迁移。隐私模式或禁用本地存储时，请在离开前手动备份。</p>`;
}

function renderOnboarding() {
  return `<section class="panel side-panel onboarding-panel"><div class="side-panel-title">${icon('lotus', 16)}一世修行，万世因果</div><p>你有一段有限的寿元，<br>也有一颗不灭的道心。</p><div class="onboarding-item"><span class="step-number">一</span><div><b>执此一念，修行入道</b><small>选择功法，踏访山河。每一次际遇，都有新的可能。</small></div></div><div class="onboarding-item"><span class="step-number">二</span><div><b>留下一缕前世回响</b><small>寿尽后带走传承，遇见自己亲手改变的世界。</small></div></div><div class="onboarding-item"><span class="step-number">三</span><div><b>问鼎三界，重写天规</b><small>集齐道证，以此世之力，完成前世未竟之愿。</small></div></div><button class="small-button" data-help>初来此境？读一读指南 ${icon('arrow', 14)}</button></section><div class="side-tips"><div class="ornament">✦</div>不需挂机，不必赶路。<br>岁月只在你落子时前行。</div>`;
}

function renderSidebar() {
  const stats = getStats(state);
  const path = row(PATHS, state.run.pathId);
  const next = stats.nextRealm;
  const goal = state.meta.proofs.length === 3 ? { title: '向三界共主问鼎', text: '修至登仙，身在天界，便可开启最终挑战。' } : { title: `${WORLDS.find(world => !state.meta.proofs.includes(world.id))?.name || '三界'}道证`, text: '修行破境，取得此界的道证。道证属于神魂，跨世保留。' };
  return `<section class="panel side-panel"><div class="side-panel-title">${icon('people', 16)}当世修行</div><div class="character-avatar">${icon(PATH_ICONS[path.id], 28)}</div><div class="character-name">${esc(state.run.name)}</div><div class="character-sub">${esc(path.name)} · ${esc(row(ORIGINS, state.run.originId).name)}</div><div class="meter-block"><div class="meter-label"><span>${next ? `迈向${next.name}` : '登仙已成'}</span><strong>${next ? `${num(state.run.cultivation)} / ${num(stats.need)}` : '道心不息'}</strong></div><div class="meter"><span style="width:${next ? pct(state.run.cultivation, stats.need) : 100}%"></span></div></div><div class="meter-block"><div class="meter-label"><span>余寿 · ${num(state.run.age)} 岁</span><strong>${num(Math.max(0, stats.remainingLife))} 年</strong></div><div class="meter gold"><span style="width:${pct(stats.remainingLife, stats.lifeLimit)}%"></span></div></div><div class="meter-block"><div class="meter-label"><span>气血</span><strong>${num(state.run.hp)} / ${num(stats.maxHp)}</strong></div><div class="meter"><span style="width:${pct(state.run.hp, stats.maxHp)}%"></span></div></div><div class="character-stats"><div><b>${num(stats.attack)}</b><small>攻势</small></div><div><b>${num(stats.defense)}</b><small>防御</small></div><div><b>${num(state.run.lifeDamage)}</b><small>命损</small></div></div></section><section class="panel side-panel"><div class="side-panel-title">${icon('flag', 16)}眼前的道途</div><h3 class="goal-title">${esc(goal.title)}</h3><p class="goal-copy">${esc(goal.text)}</p><div class="goal-progress">${WORLDS.map(world => `<span class="goal-step ${state.meta.proofs.includes(world.id) ? 'done' : ''}"></span>`).join('')}</div><div class="meter-label"><span>三界道证</span><strong>${state.meta.proofs.length} / 3</strong></div><button class="small-button" data-view="worlds">望一望三界山河 ${icon('arrow', 13)}</button></section><section class="panel side-panel"><div class="side-panel-title">${icon('feather', 16)}因果回响</div>${state.meta.worldFlags.length ? state.meta.worldFlags.slice(-3).map(id => `<div class="world-echo">${icon('spark', 13)}<div><b>${esc(WORLD_FLAGS[id].name)}</b>${esc(WORLD_FLAGS[id].description)}</div></div>`).join('') : '<p class="empty-echo">山河静候你的故事。<br>今天的一念，会在未来回响。</p>'}</section><div class="side-tips"><div class="ornament">✦</div>寿限 ${num(stats.lifeLimit)} 年 · 命损 ${num(state.run.lifeDamage)} 年<br>神魂记得你走过的路。</div>`;
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
  const begin = () => {
    try {
      const randomSeed = window.crypto?.getRandomValues ? String(window.crypto.getRandomValues(new Uint32Array(1))[0]) : String(Date.now());
      const options = { ...setup, name: setup.name.trim() || '云归', seed: randomSeed };
      const next = preparingLife ? reincarnate(state, options) : createGame(options);
      corruptSave = ''; preparingLife = false; view = 'adventure';
      update(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { notify(error.message, true); }
  };
  if (corruptSave) return confirmAction('重新开始修行', '当前检测到无法读取的旧存档。重新开始将覆盖它，建议先点击提示中的「备份原存档」保存副本。', begin, '覆盖并开始');
  begin();
}

document.addEventListener('input', event => { if (event.target.id === 'dao-name') setup.name = event.target.value; });

document.addEventListener('click', event => {
  const button = event.target.closest('button,a');
  if (!button || button.disabled) return;
  const data = button.dataset;
  if ('closeDialog' in data) { $('#dialog').close(); dialogConfirm = null; return; }
  if ('confirm' in data) { const callback = dialogConfirm; dialogConfirm = null; $('#dialog').close(); callback?.(); return; }
  if ('help' in data) return showHelp();
  if ('view' in data) { view = data.view; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if ('path' in data) { setup.pathId = data.path; render(); return; }
  if ('origin' in data) { setup.originId = data.origin; render(); return; }
  if ('carry' in data) {
    if (setup.legacyIds.includes(data.carry)) setup.legacyIds = setup.legacyIds.filter(id => id !== data.carry);
    else if (setup.legacyIds.length >= 2) return notify('每一世最多携带两项传承，请先取消一项。', true);
    else setup.legacyIds.push(data.carry);
    render(); return;
  }
  if ('start' in data) return startGame();
  if ('cancelSetup' in data) { preparingLife = false; render(); return; }
  if ('action' in data && state) {
    const info = getActionInfo(state, data.action);
    const runAction = () => attempt(() => act(state, { type: data.action }), { goAdventure: true });
    if (data.action === 'retire') return confirmAction('此生归隐', '结束这一世并结算已经完成的经历。归隐本身不会发放奖励，获得的传承候选、世界因果和道证会保留。', runAction, '归隐并结算');
    if (info.years >= getStats(state).remainingLife) return confirmAction('岁月将尽', `这次行动需要 ${info.years} 年，但你只剩 ${Math.max(0, getStats(state).remainingLife)} 年余寿。你会在完成前寿尽，无法获得本次收益。`, runAction, '走完此生');
    runAction(); return;
  }
  if ('choice' in data && state) return attempt(() => chooseEvent(state, data.choice), { goAdventure: true });
  if ('combat' in data && state) return attempt(() => combatAction(state, data.combat), { goAdventure: true });
  if ('equip' in data && state) return attempt(() => equipItem(state, data.equip, Number(data.slot || 0)));
  if ('reward' in data && state) return attempt(() => selectLegacy(state, data.reward), { goAdventure: true });
  if ('rebirth' in data && state) { setup = { name: state.run.name, originId: state.run.originId, pathId: state.run.pathId, legacyIds: state.meta.legacyIds.slice(-2) }; preparingLife = true; view = 'adventure'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if ('travel' in data && state) {
    const go = () => attempt(() => act(state, { type: 'travel', worldId: data.travel }), { goAdventure: true });
    if (getStats(state).remainingLife <= 2) return confirmAction('余寿不足', '游历两年将耗尽余寿，无法抵达目的地。仍要踏上这最后一程吗？', go, '踏上最后一程');
    go(); return;
  }
  if ('challenge' in data && state) return attempt(() => act(state, { type: 'challenge', challengeId: data.challenge }), { goAdventure: true });
  if ('finale' in data && state) return confirmAction('最后的问鼎', '你将向三界共主发起决战。请确认气血充足、功法与法器已装配妥当。', () => attempt(() => act(state, { type: 'finale' }), { goAdventure: true }), '执此一念，问鼎三界');
  if ('export' in data) return exportGame();
  if ('exportCorrupt' in data) { downloadText('百世问鼎-原存档备份.txt', corruptSave, 'text/plain;charset=utf-8'); return; }
  if ('import' in data) { $('#import-file').click(); return; }
  if ('reset' in data) return confirmAction('清除所有本地轮回', '这将清除当前浏览器中的修行、传承与历史，重新开始第一世。已经导出的备份不受影响。', () => {
    try { window.localStorage.removeItem(SAVE_KEY); } catch { /* explicit reset still clears session */ }
    state = null; preparingLife = false; corruptSave = ''; saveError = ''; lastSaved = false; setup = { name: '云归', originId: 'village', pathId: 'sword', legacyIds: [] }; view = 'adventure'; render(); notify('本地存档已清除，新的故事等待落笔。');
  }, '确认清除');
});

$('#import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return notify('存档文件超过 2 MB，请选择有效的游戏存档。', true);
  try {
    const imported = deserialize(await file.text());
    confirmAction('导入修行存档', `将恢复「${esc(imported.run.name)}」的第 ${imported.meta.generation} 世（${imported.run.age} 岁，${esc(REALMS[imported.run.realmIndex].name)}境）。${state ? '当前进度将被替换；如需保留，请先取消并导出备份。' : ''}`, () => {
      corruptSave = ''; saveError = ''; preparingLife = false; view = 'adventure'; update(imported, { message: false }); notify('存档已恢复，仙途继续。');
    }, '确认恢复');
  } catch (error) { notify(error.message || '无法读取这个存档文件。', true); }
});

$('#dialog').addEventListener('cancel', () => { dialogConfirm = null; });
$('#dialog').addEventListener('click', event => { if (event.target === $('#dialog')) { const rect = $('#dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { $('#dialog').close(); dialogConfirm = null; } } });
render();
