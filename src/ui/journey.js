import {ORIGINS,TALENTS,DAYS_PER_YEAR} from '../game/cultivation/live/model.js';
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

const liveMessages={AI_DISABLED:'实时生成尚未开放。',FREE_QUOTA_EXHAUSTED:'生成服务拒绝了免费额度请求，进度已保留，请稍后重试。',PROVIDER_BUSY:'此刻繁忙，请稍后重试。',PROVIDER_TIMEOUT:'等待超时，进度已保留。',NETWORK_UNAVAILABLE:'网络未连接，已保存的故事仍可阅读。',SESSION_UNAVAILABLE:'原会话不可用，请明确重试以续接这一步。',ATTEMPT_NOT_FOUND:'原回应已不可读取，请重试续接。',ATTEMPT_IN_PROGRESS:'原请求仍在处理中，请稍后检查。',AWAITING_EXPLICIT_RETRY:'开场已保存，点重试继续。',SERVICE_UNAVAILABLE:'此页面暂不支持联网生成。',PROTOCOL_MISMATCH:'服务版本不兼容，请保留备份并稍后重试。',STORAGE_OR_STATE_CONFLICT:'保存未完成或另一标签页已有更新。请检查存储空间后重新读取。',STALE_CHOICE:'故事已更新，请按眼前的选项继续。',TURN_ALREADY_PENDING:'这一步已经在等待回应。'};

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
  const details = draft ? [] : [
    !choice.enabled && choice.reason ? choice.reason : '',
    choice.costs?.days > 0 ? `${choice.costs.days}日` : '',
    ...Object.entries(choice.costs?.items ?? {}).filter(([, count]) => count > 0).map(([id, count]) => `${view.itemNames?.[id] ?? id} ${count}`),
    ...(choice.warnings ?? []),
  ].filter(Boolean);
  return `<button type="button" class="journey-choice${draft ? ' live-choice-draft' : ''}" data-live-choice-index="${index}"${draft ? ' data-live-choice-preview' : ` data-live-choice="${esc(choice.id)}" data-revision="${view.state.revision}" data-state-hash="${esc(view.stateHash)}"`}${draft || presentation.pending || !choice.enabled ? ' disabled' : ''}${details.length ? ` aria-describedby="live-cost-${index}"` : ''}><span class="journey-choice-label">${esc(choice.label)}</span><span class="journey-choice-reason" id="live-cost-${index}"${details.length ? '' : ' hidden'}>${esc(details.join(' · '))}</span></button>`;
}

export function renderLiveJourney(view, choices) {
  const state = view.state, scene = state.currentScene, presentation = livePresentation(view, choices);
  const opening = state.phase === 'awaitingOpening' && !presentation.preview;
  const intro = opening ? `<p>${esc(state.life.name)}，${Math.floor(state.life.ageDays / DAYS_PER_YEAR)}岁，出身${esc(ORIGINS[state.life.birth.originId])}。</p><p>天赋：${state.life.birth.talentIds.map(id => esc(TALENTS[id])).join('、')}。</p>` : '';
  const message = view.status === 'paused' && !view.busy ? liveMessages[view.errorCode] ?? '故事未完成，请重试。'
    : view.busy && view.generationStatus === 'queued' ? '等候回应…'
      : view.busy && view.generationStatus === 'switching' ? '重新续写…' : '';
  const retry = Boolean(view.pending && !view.busy);
  const status = message ? esc(message) : view.busy ? '<span aria-hidden="true">…</span><span class="live-sr-only">正在续写</span>' : '';
  return `<article class="journey live-journey" data-live-story data-live-run="${esc(state.runId)}" aria-label="此生故事"><section class="journey-current" aria-labelledby="journey-current-title"><h2 id="journey-current-title" class="live-sr-only" tabindex="-1">${esc(state.phase === 'dead' ? '此生已尽' : scene?.title ?? '此生故事')}</h2><section class="live-intro" aria-label="本地开场"${opening ? '' : ' hidden'}>${intro}</section><div class="journey-prose" data-live-prose data-live-preview-text${presentation.preview ? ' data-live-preview' : ''} aria-busy="${Boolean(view.busy)}">${presentation.blocks.map(renderLiveBlock).join('')}</div><div class="journey-choices" data-live-choices role="group" aria-label="眼前的选择"${presentation.choices.length ? '' : ' hidden'}>${presentation.choices.map((choice, index) => renderLiveChoice(choice, view, index, presentation)).join('')}</div><section class="live-status" aria-live="polite" aria-atomic="true"${status || retry ? '' : ' hidden'}><p data-live-progress-status>${status}</p><div data-live-recovery${retry ? '' : ' hidden'}><button type="button" class="button primary" data-live-retry>重试续接</button><button type="button" class="button" data-live-resume>检查已有回应</button></div></section><section class="journey-ending"${state.phase === 'dead' ? '' : ' hidden'}>${state.phase === 'dead' ? `<h3>${state.lastReceipt?.death?.cause === 'lifespan' ? '寿尽' : '伤重而终'}</h3><button type="button" class="button" data-live-new>再入轮回</button>` : ''}</section></section></article>`;
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
  for (const attribute of [...current.attributes]) if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  for (const attribute of [...next.attributes]) if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  const children = [...current.childNodes], nextChildren = [...next.childNodes];
  nextChildren.forEach((child, index) => children[index] ? syncLiveNode(children[index], child) : current.append(child.cloneNode(true)));
  for (const child of children.slice(nextChildren.length)) child.remove();
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
