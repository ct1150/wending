import { currentStoryGoal } from '../game/cultivation/live/story-director.js';
import {ORIGINS,TALENTS,ITEMS,DAYS_PER_YEAR} from '../game/cultivation/live/model.js';
import {describeEcho,getReincarnationSettlement,REINCARNATION_REWARDS} from '../game/cultivation/live/reincarnation.js';
import {buildOpeningBrief} from '../game/cultivation/live/experience-story.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const endings = { retired: '归隐', lifespan: '寿尽', battle: '陨落', victory: '问鼎', burned: '燃命而终' };
const quotePairs = { '“': '”', '「': '」', '『': '』', '‘': '’', '"': '"' };
const sentenceEnd = /[。.!?！？…][”’」』"']*$/u;

function renderSpeech(speaker, value, complete = true) {
  const name = String(speaker ?? '').trim().replace(/[：:]\s*$/u, '');
  let text = String(value ?? '').trim();
  for (const colon of ['：', ':']) {
    if (name && text.startsWith(name + colon)) {
      text = text.slice(name.length + colon.length).trimStart();
      break;
    }
  }
  // Authored and imported speech may already include its outer quotes, with
  // sentence punctuation either inside or just outside the closing quote.
  const outside = text.match(/[。.!?！？…]+$/u)?.[0] ?? '';
  const quoted = outside ? text.slice(0, -outside.length).trimEnd() : text;
  const closing = quotePairs[quoted[0]];
  const closed = closing && quoted.length >= 2 && quoted.endsWith(closing);
  if (closed) {
    text = quoted.slice(1, -1).trim();
    if (outside && !sentenceEnd.test(text)) text += outside;
  } else if (!complete && closing) text = text.slice(1);
  if (complete && text && !sentenceEnd.test(text)) text += '。';
  return `${name ? `<span class="journey-voice">${esc(name)}：</span>` : ''}“${esc(text)}${complete || closed ? '”' : ''}`;
}

function renderBlock(block, historyId = null) {
  const kind = ['narration', 'dialogue', 'action', 'result'].includes(block.kind) ? block.kind : block.speaker ? 'dialogue' : 'narration';
  const id = historyId ?? `journey-block-${block.id}`;
  const content = kind === 'dialogue' || block.speaker
    ? renderSpeech(block.speaker, block.text)
    : `${kind === 'action' ? '<span class="journey-action-label">你选择了：</span>' : ''}${block.title ? `<strong>${esc(block.title)}</strong>：` : ''}${esc(block.text)}`;
  return `<p id="${esc(id)}" class="journey-block journey-${kind}"${!historyId && kind === 'result' ? ' tabindex="-1"' : ''}>${content}</p>`;
}

const passage = (rows, scope) => rows.map((block, index) => renderBlock(block, `journey-history-${scope}-${index + 1}`)).join('');

function choiceCopy(choice) {
  let label = String(choice.label ?? '');
  const warning = String(choice.warning ?? '').trim();
  if (!warning) return { label, warning: '' };
  const words = value => value.replace(/[\s。.!?！？；;，,：:（）()“”"'「」]/gu, '');
  if (words(label).includes(words(warning))) return { label, warning: '' };
  // Keep an existing warning when no separate warning is supplied. When the
  // engine supplies fuller risk prose, say the same danger only once.
  label = label.replace(/（([^（）]+)）|\(([^()]+)\)/gu, (parenthesis, chinese, ascii) => {
    const note = chinese ?? ascii;
    const explained = note.split(/[、，,；;]/u).every(part => words(warning).includes(words(part))
      || (part === '必死' && /必死|丧命|送命|身亡|死亡|死于|寿尽|回不来/u.test(warning))
      || (part === '会受伤' && /受伤|重伤/u.test(warning))
      || (part === '必定失败' && /冲关失败/u.test(warning))
      || (part === '伤身折寿' && /受伤|重伤/u.test(warning) && /折损寿元/u.test(warning)));
    return explained ? '' : parenthesis;
  });
  return { label, warning };
}

function renderChoice(choice, view, index) {
  const { label, warning } = choiceCopy(choice);
  const reason = !choice.enabled ? choice.reason : '';
  const descriptions = [reason ? `journey-reason-${index}` : '', warning ? `journey-warning-${index}` : ''].filter(Boolean).join(' ');
  return `<button type="button" class="journey-choice" data-journey-choice="${esc(choice.id)}" data-revision="${esc(view.revision)}" data-scene-id="${esc(view.sceneId)}"${choice.enabled ? '' : ' disabled'}${descriptions ? ` aria-describedby="${descriptions}"` : ''}><span class="journey-choice-label">${esc(label)}</span>${reason ? `<span class="journey-choice-reason" id="journey-reason-${index}">${esc(reason)}</span>` : ''}${warning ? `<span class="journey-choice-warning" id="journey-warning-${index}">${esc(warning)}</span>` : ''}</button>`;
}

// Public display views only: rendering never changes time, fate or a choice.
export function renderJourney(view) {
  const lastResult = view.blocks.findLastIndex(block => block.kind === 'result');
  const consequence = lastResult >= 0 ? view.blocks[lastResult] : null;
  const current = view.blocks.slice(lastResult + 1);
  const ending = view.summary.ending;
  return `<article class="journey" aria-label="此生故事">${consequence ? `<section class="journey-consequence" aria-label="方才的回响">${renderBlock(consequence)}</section>` : ''}<section class="journey-current" aria-labelledby="journey-current-title"><header><p class="journey-location">${esc(view.location)}</p><h2 id="journey-current-title" tabindex="-1">${esc(view.title)}</h2>${view.goal ? `<p class="journey-goal">${esc(view.goal)}</p>` : ''}</header><div class="journey-prose">${current.map(block => renderBlock(block)).join('')}</div>${ending ? `<section class="journey-ending" aria-label="此生归宿"><h3>${esc(ending.title)}</h3>${ending.achievement ? `<p>${esc(ending.achievement)}</p>` : ''}${ending.lesson ? `<p>${esc(ending.lesson)}</p>` : ''}</section>` : ''}<div class="journey-choices" role="group" aria-label="眼前的选择">${view.choices.map((choice, index) => renderChoice(choice, view, index)).join('')}</div></section></article>`;
}

export function renderJourneyHistory(view) {
  const summary = view.summary;
  const records = summary.biography ?? [];
  const old = summary.legacyArchive;
  const previous = summary.priorTranscript ?? [];
  const collection = summary.legacyCollection ?? [];
  return `<div class="journey-records"><section aria-labelledby="journey-history-current-title"><h3 id="journey-history-current-title">第 ${esc(summary.generation)} 世 · ${esc(summary.name)}</h3>${view.blocks.length ? passage(view.blocks, 'current') : '<p class="journey-record-empty">此生尚未落笔。入世后，相逢与选择都会留在这里。</p>'}</section>${records.length ? `<section class="journey-past-lives" aria-label="历世生平"><h3>历世生平</h3>${records.map((record, index) => `<details><summary>第 ${esc(record.generation)} 世 · ${esc(record.name)} · ${esc(record.age)} 岁 · ${esc(record.title ?? endings[record.cause] ?? record.cause)}</summary><div class="journey-record-body">${record.achievement ? `<p>${esc(record.achievement)}</p>` : ''}${(record.deeds ?? []).map(deed => `<p>${esc(deed)}</p>`).join('')}${record.lesson ? `<p>${esc(record.lesson)}</p>` : ''}${passage(record.transcript ?? record.log ?? [], `life-${index}`)}</div></details>`).join('')}</section>` : ''}${previous.length ? `<details><summary>前世完整对话与轮回交接</summary><div class="journey-record-body">${passage(previous, 'prior')}</div></details>` : ''}${old ? `<details><summary>旧途原始记录</summary><div class="journey-record-body">${passage(old.run?.log ?? [], 'legacy')}<details><summary>旧途收藏、世界与生平原档</summary><pre>${esc(JSON.stringify(old, null, 2))}</pre></details></div></details>` : ''}${collection.length ? `<details><summary>历世传承</summary><div class="journey-record-body">${collection.map(record => `<p><strong>${esc(record.name)}</strong>${record.source ? ` · ${esc(record.source)}` : ''}${record.description ? `<br>${esc(record.description)}` : ''}</p>`).join('')}</div></details>` : ''}</div>`;
}

const liveMessages={EXPERIENCE_UNSUPPORTED:'故事服务暂不支持此生的修行规则，进度已保留，请稍后续接。',KNOWLEDGE_UNAVAILABLE:'故事资料暂时无法读取，进度已保留，请稍后重试。',AI_DISABLED:'实时生成尚未开放。',FREE_QUOTA_EXHAUSTED:'可用的续写额度暂时不足。进度已保留，请稍后再试。',PROVIDER_BUSY:'此刻繁忙，请稍后重试。',PROVIDER_TIMEOUT:'等待超时，进度已保留。',NETWORK_UNAVAILABLE:'网络未连接，已保存的故事仍可阅读。',SESSION_UNAVAILABLE:'原会话已失效，这一步的选择已保留。',NEXT_CONTEXT_TOO_LARGE:'这一段尚未写完，原来的选择已保留。',ATTEMPT_NOT_FOUND:'暂时查不到原回应，这一步的选择已保留。',ATTEMPT_IN_PROGRESS:'故事仍在续写。',AWAITING_EXPLICIT_RETRY:'这一步的选择已经保存。',SERVICE_UNAVAILABLE:'暂时连不上故事服务。进度已保留，稍后可续接。',PROTOCOL_MISMATCH:'服务版本不兼容，请保留备份并稍后重试。',STORAGE_OR_STATE_CONFLICT:'保存未完成或另一标签页已有更新。请检查存储空间后重新读取。',STALE_CHOICE:'故事已更新，请按眼前的选项继续。',TURN_ALREADY_PENDING:'这一步已经在等待回应。',CHOICE_NOT_COMPILABLE:'剧情选项生成失败，进度已保留。',STORY_LENGTH_INVALID:'这一段剧情暂未接上，进度已保留。',GENERATED_SCENE_INVALID:'这一段剧情暂未接上，进度已保留。',PROVIDER_RESPONSE_INVALID:'本回合还没有保存，之前的进度已保留。',OUTPUT_TRUNCATED:'这一段没有写完，进度已保留。'};

function livePresentation(view, choices) {
  const state = view.state, scene = state.currentScene;
  const names = new Map((scene?.entities ?? []).map(entity => [entity.id, entity.name]));
  names.set('self', state.life.name);
  const previewBlocks = Array.isArray(view.preview?.blocks)
    ? view.preview.blocks.filter(block => typeof block?.text === 'string' && block.text)
    : typeof view.preview?.text === 'string'
      ? view.preview.text.split(/\n\n/u).filter(Boolean).map(text => ({ kind: 'narration', text, complete: false }))
      : [];
  const previewChoices = (view.preview?.choices ?? []).filter(choice => typeof choice?.label === 'string' && choice.label);
  const preview = previewBlocks.length > 0 || previewChoices.length > 0;
  return {
    preview,
    pending: Boolean(view.pending || view.busy),
    blocks: preview ? previewBlocks : (scene?.blocks ?? []).map(block => ({ ...block, speaker: block.speaker ? names.get(block.speaker) ?? '故人' : undefined, complete: true })),
    choices: preview ? previewChoices : choices,
  };
}

function renderLiveBlock(block, index) {
  const kind = block.kind === 'dialogue' || block.speaker ? 'dialogue' : 'narration';
  const content = kind === 'dialogue' ? renderSpeech(block.speaker, block.text, block.complete !== false) : esc(block.text);
  return `<p id="journey-live-block-${index}" class="journey-block journey-${kind}" data-live-block="${index}">${content}</p>`;
}

function renderLiveChoice(choice, view, index, presentation) {
  const draft = presentation.preview;
  const numbered = view.state.life.cultivationProfile?.version === 7;
  const outlook=choice.outlook, bands={favorable:'胜算较高',even:'胜负未定',dangerous:'胜算偏低',unknown:'胜算未明'};
  const details = draft ? [] : [
    !choice.enabled && choice.reason ? choice.reason : '',
    choice.costs?.days > 0 ? `${choice.costs.days}日` : '',
    choice.costs?.spirit > 0 ? `灵力 ${choice.costs.spirit}` : '',
    choice.costs?.lifeYears > 0 ? `寿元上限 −${choice.costs.lifeYears}年` : '',
    ...Object.entries(choice.costs?.items ?? {}).filter(([, count]) => count > 0).map(([id, count]) => `${view.itemNames?.[id] ?? id} ${count}`),
    outlook ? [bands[outlook.band],outlook.reason].filter(Boolean).join('：') : '',
    outlook?.purpose ? '对方意图：'+outlook.purpose : '',
    outlook?.condition ? '可利用：'+outlook.condition : '',
    ...(choice.warnings ?? []),
  ].filter(Boolean);
  return `<button type="button" class="journey-choice${draft ? ' live-choice-draft' : ''}" data-live-choice-index="${index}"${draft ? ' data-live-choice-preview' : ` data-live-choice="${esc(choice.id)}" data-revision="${view.state.revision}" data-state-hash="${esc(view.stateHash)}"`}${draft || presentation.pending || !choice.enabled ? ' disabled' : ''}${details.length ? ` aria-describedby="live-cost-${index}"` : ''}><span class="journey-choice-label">${numbered ? `<span class="live-choice-number">${index + 1}. </span>` : ''}${esc(choice.label)}</span><span class="journey-choice-reason" id="live-cost-${index}"${details.length ? '' : ' hidden'}>${esc(details.join(' · '))}</span></button>`;
}

function renderLiveOutcome(receipt, view = {}) {
  const active = receipt?.kind === 'choice' && receipt.action;
  const changes = [], before = receipt?.before ?? {}, after = receipt?.after ?? {};
  const delta = (label, difference, suffix = '') => { if (Number.isFinite(difference) && difference !== 0) changes.push(`${label} ${difference > 0 ? '+' : ''}${difference}${suffix}`); };
  if (active) {
    if (receipt.elapsedDays > 0) delta('岁月', receipt.elapsedDays % DAYS_PER_YEAR === 0 ? receipt.elapsedDays / DAYS_PER_YEAR : receipt.elapsedDays, receipt.elapsedDays % DAYS_PER_YEAR === 0 ? '年' : '日');
    delta('修为', after.cultivation - before.cultivation);
    delta('气血', (before.injury - after.injury) * 10, '%');
    delta('寿命上限', after.lifeLimit - before.lifeLimit, '年');
    delta('灵力', after.cultivationProfile?.spirit - before.cultivationProfile?.spirit);
    delta('灵力上限', after.cultivationProfile?.maxSpirit - before.cultivationProfile?.maxSpirit);
    delta('身份暴露', after.cultivationProfile?.exposure - before.cultivationProfile?.exposure);
    for (const [id, name] of Object.entries({ alchemy: '炼丹', forging: '炼器', formations: '阵法', talismans: '符箓' })) delta(name, (after.cultivationProfile?.arts?.[id] ?? 0) - (before.cultivationProfile?.arts?.[id] ?? 0));
    for (const [id, count] of Object.entries(receipt.itemChanges ?? {})) delta(view.itemNames?.[id] ?? ITEMS[id] ?? id, count);
    for (const [id, count] of Object.entries(receipt.relationChanges ?? {})) {
      const name = view.state?.relatedEntities?.find(entity => entity.id === id)?.name;
      if (name) delta(`${name}好感`, count);
    }
  }
  const check = active ? receipt.cultivationResult?.check : null;
  const checkName = check?.label ?? ({ practice: '修行判定', breakthrough: '破境判定', exploration: '探索判定', combat: '交锋判定', forbidden: '禁术判定', 'black-market': '黑市交易判定', 'world-crossing': '跨界判定', craft: '炼制判定' })[check?.kind] ?? '行动判定';
  return `<p class="live-turn-feedback" data-live-feedback${active ? '' : ' hidden'}>${active ? `你选择了：${esc(receipt.action.label)}` : ''}</p><p class="live-turn-changes" data-live-changes aria-label="本次变化"${changes.length ? '' : ' hidden'}>${changes.map(esc).join(' · ')}</p><p class="live-turn-check" data-live-check aria-label="判定结果"${check ? '' : ' hidden'}>${check ? `${esc(checkName)}：${check.success ? '成功' : '失败'}` : ''}</p>`;
}

function renderLiveBirthFacts(view) {
  const life=view.state.life;
  const brief=view.state.director && (view.state.phase==='awaitingOpening'||view.state.turnId===1&&view.state.phase==='active'&&view.pending?.kind!=='choice')
    ? buildOpeningBrief({phase:'opening',life,director:view.state.director}):null;
  return `<aside class="live-birth-facts" data-live-birth-facts${brief?'':' hidden'}>${brief?`<p><strong>所长</strong>${esc(brief.strength)}</p><p><strong>代价</strong>${esc(brief.tradeoff)}</p>`: ''}</aside>`;
}

function renderLiveState(view) {
  const life = view.state.life, summary = view.characterSummary;
  const goal = summary?.currentGoal ?? currentStoryGoal(view.state.director);
  const scene = view.state.currentScene;
  const situation = [scene?.location, scene?.title !== scene?.location && scene?.title !== '眼前所见' && scene?.title].filter(Boolean).join(' · ');

  const facts = [
    ['气血', `${Math.max(0, 10 - life.injury) * 10}%`],
    ...(Number.isFinite(life.cultivationProfile?.spirit) ? [['灵力', `${life.cultivationProfile.spirit} / ${life.cultivationProfile.maxSpirit}`]] : []),
    ['灵石', life.items.stones ?? 0],
    ['所在地', view.state.currentScene?.location ?? (view.state.phase === 'dead' ? '此生已尽' : '尚未入世')],

    ...(view.state.reincarnation?.version===2?[['前世回响',view.state.reincarnation.echoes.map(describeEcho).join('')]]:[]),
  ];
  return `<details class="live-turn-state" data-live-state data-live-preserve-open${view.state.phase === 'dead' ? ' hidden' : ''}><summary><span class="live-state-hint">${goal?'当前目标':'当前处境'}</span><span data-live-goal>${esc(goal || situation || '查看随身资源')}</span></summary><dl>${facts.map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></details>`;
}

function renderLiveEnding(view) {
  const state = view.state;
  if (state.phase !== 'dead') return '';
  if (state.life.cultivationProfile?.version !== 7) return `<h3>${state.lastReceipt?.death?.cause === 'lifespan' ? '寿尽' : '伤重而终'}</h3><button type="button" class="button" data-live-new>再入轮回</button>`;
  const settlement = getReincarnationSettlement(state);
  if (!settlement) return '<h3>此生已尽</h3>';
  const selected = new Set(view.selectedReincarnationRewards ?? []);
  const spent = REINCARNATION_REWARDS.reduce((sum, reward) => sum + (selected.has(reward.id) ? reward.cost : 0), 0);
  const balance = settlement.availablePoints - spent, blocked = view.busy || Boolean(view.reincarnatedTo);
  const rewards = REINCARNATION_REWARDS.map(reward => `<button type="button" class="journey-choice" data-live-reward="${esc(reward.id)}" aria-pressed="${selected.has(reward.id)}"${blocked || !selected.has(reward.id) && (reward.cost > balance || selected.size>=settlement.selectionLimit) ? ' disabled' : ''}><span class="live-reward-name"><strong>${esc(reward.name)}</strong><span>${reward.cost} 因果点</span></span><span class="live-reward-description">${esc(reward.description)}</span></button>`).join('');
  const history=settlement.echoes?'<h4>生平抉择</h4><ul>'+settlement.decisions.map(text=>'<li>'+esc(text)+'</li>').join('')+'</ul><p>遗留事项：'+esc(settlement.unfinished.join('')||'没有未履行的校法之约。')+'</p>':'';
  return `<div class="live-reincarnation"><h3>此生结算</h3><p>${esc(settlement.summary)}</p>${settlement.echoes?history:'<blockquote class="live-epitaph">'+esc(settlement.epitaph)+'</blockquote>'}<p class="live-causal-points">因果点 ${settlement.availablePoints} · 本世所得 ${settlement.earnedPoints} · 前世结余 ${settlement.carriedPoints}</p><h4>六道轮回商店</h4>${settlement.selectionLimit?'<p>最多两项，也可不选；未用因果点留给来世。</p>':''}<div class="live-reward-list" role="group" aria-label="选择来世传承">${rewards}</div><p class="live-causal-points">已选 ${spent} · 来世结余 ${balance}</p>${view.reincarnatedTo ? '<p class="live-causal-points">此生传承已领取。请恢复下一世备份，或返回首页重新开始。</p>' : ''}<button type="button" class="button primary" data-live-reincarnate${blocked || balance < 0 || selected.size>settlement.selectionLimit ? ' disabled' : ''}>步入轮回</button></div>`;
}

export function renderLiveJourney(view, choices) {
  const state = view.state, scene = state.currentScene, presentation = livePresentation(view, choices);
  const v7 = state.life.cultivationProfile?.version === 7;
  const opening = state.phase === 'awaitingOpening' && !presentation.preview;
  const intro = opening ? `<p>${esc(state.life.name)}，${Math.floor(state.life.ageDays / DAYS_PER_YEAR)}岁，出身${esc(ORIGINS[state.life.birth.originId])}。</p><p>天赋：${state.life.birth.talentIds.map(id => esc(TALENTS[id])).join('、')}。</p>` : '';
  const message = view.status === 'paused' && !view.busy ? liveMessages[view.errorCode] ?? '故事未完成，请重试。'
    : view.busy && view.generationStatus === 'queued' ? '等候回应…'
      : view.busy && view.generationStatus === 'switching' ? '重新续写…' : '';
  const waiting = view.errorCode === 'ATTEMPT_IN_PROGRESS' || (view.attempt && !view.errorCode);
  const recovery = !view.pending || view.busy ? '' : waiting
    ? '<button type="button" class="button primary" data-live-resume>查看续写进度</button>'
    : '<button type="button" class="button primary" data-live-retry>继续故事</button>';
  const status = message ? esc(message) : view.busy ? '<span aria-hidden="true">…</span><span class="live-sr-only">正在续写</span>' : '';
  return `<article class="journey live-journey${v7 ? ' live-cultivation-v7' : ''}" data-live-story data-live-run="${esc(state.runId)}" aria-label="此生故事"><section class="journey-current" aria-labelledby="journey-current-title"><h2 id="journey-current-title" class="live-sr-only" tabindex="-1">${esc(state.phase === 'dead' ? '此生已尽' : scene?.title ?? '此生故事')}</h2><section class="live-intro" aria-label="本地开场"${opening ? '' : ' hidden'}>${intro}</section>${v7 ? renderLiveBirthFacts(view) : ''}${v7 ? renderLiveOutcome(view.pending?.receipt ?? state.lastReceipt, view) : ''}<div class="journey-prose" data-live-prose data-live-preview-text${presentation.preview ? ' data-live-preview' : ''} aria-busy="${Boolean(view.busy)}">${presentation.blocks.map(renderLiveBlock).join('')}</div>${v7 ? renderLiveState(view) : ''}<div class="journey-choices" data-live-choices role="group" aria-label="眼前的选择"${presentation.choices.length ? '' : ' hidden'}>${presentation.choices.map((choice, index) => renderLiveChoice(choice, view, index, presentation)).join('')}</div><section class="live-status" aria-live="polite" aria-atomic="true"${status || recovery ? '' : ' hidden'}><p data-live-progress-status>${status}</p>${recovery}</section><section class="journey-ending"${state.phase === 'dead' ? '' : ' hidden'}>${renderLiveEnding(view)}</section></section></article>`;
}

// The live reading surface keeps its paragraph and choice nodes as text arrives
// and when the durable scene takes over. No partial scene becomes a command.
function syncLiveNode(current, next) {
  if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) {
    current.replaceWith(next.cloneNode(true));
    return;
  }
  if (current.nodeType === 3) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  for (const attribute of [...current.attributes]) if (!next.hasAttribute(attribute.name) && !(attribute.name === 'open' && current.hasAttribute('data-live-preserve-open'))) current.removeAttribute(attribute.name);
  for (const attribute of [...next.attributes]) if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  const children = [...current.childNodes], nextChildren = [...next.childNodes];
  nextChildren.forEach((child, index) => children[index] ? syncLiveNode(children[index], child) : current.append(child.cloneNode(true)));
  for (const child of children.slice(nextChildren.length)) child.remove();
  if (current.nodeName === 'TEXTAREA' && current.value !== next.value) current.value = next.value;
}

export function updateLiveJourney(root, view, choices = []) {
  const current = root.matches?.('[data-live-story]') ? root : root.querySelector('[data-live-story]');
  if (!current || !view.state || current.dataset.liveRun !== view.state.runId) return false;
  const template = current.ownerDocument.createElement('template');
  template.innerHTML = renderLiveJourney(view, choices);
  syncLiveNode(current, template.content.firstElementChild);
  return true;
}

export function updateLivePreview(root, view) {
  updateLiveJourney(root, view);
}
export function renderLiveHistory(entries,playerName) {
  return `<div class="journey-records">${entries.length?entries.map(entry=>{const names=new Map((entry.scene?.entities??[]).map(e=>[e.id,e.name]));names.set('self',playerName);return `<section><h3>第 ${esc(entry.identity.turnId)} 回 · ${esc(entry.scene?.title??'此生归宿')}</h3>${entry.receipt.action?`<p>你选择了：${esc(entry.receipt.action.label)} · 岁月经过 ${esc(entry.receipt.elapsedDays)} 日</p>`:'<p>此生初定</p>'}${entry.receipt.death?`<p>${entry.receipt.death.cause==='lifespan'?'寿尽':'伤重而终'}</p>`:''}${passage((entry.scene?.blocks??[]).map(b=>({...b,speaker:b.speaker?names.get(b.speaker)??'故人':undefined})),`live-${entry.identity.turnId}`)}</section>`;}).join(''):'<p>此生尚无已提交的故事。</p>'}</div>`;
}
