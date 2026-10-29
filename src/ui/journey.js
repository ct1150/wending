import {ORIGINS,TALENTS,DAYS_PER_YEAR} from '../game/cultivation/live/model.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const endings = { retired: '归隐', lifespan: '寿尽', battle: '陨落', victory: '问鼎', burned: '燃命而终' };
const quotePairs = { '“': '”', '「': '」', '『': '』', '‘': '’', '"': '"' };
const sentenceEnd = /[。.!?！？…][”’」』"']*$/u;

function renderSpeech(speaker, value) {
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
  if (closing && quoted.length >= 2 && quoted.endsWith(closing)) {
    text = quoted.slice(1, -1).trim();
    if (outside && !sentenceEnd.test(text)) text += outside;
  }
  if (text && !sentenceEnd.test(text)) text += '。';
  return `${name ? `<span class="journey-voice">${esc(name)}：</span>` : ''}“${esc(text)}”`;
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
export function renderLiveJourney(view, choices) {
  const state=view.state,scene=state.currentScene;
  const names=new Map((scene?.entities??[]).map(entity=>[entity.id,entity.name]));names.set('self',state.life.name);
  const blocks=(scene?.blocks??[]).map((block,index)=>({...block,id:`live-${state.revision}-${index}`,speaker:block.speaker?names.get(block.speaker)??'故人':undefined}));
  const displayed=renderJourney({revision:state.revision,sceneId:scene?.id??'',location:scene?.location??'此生初定',title:state.phase==='dead'?'此生已尽':scene?.title??'此生初定',blocks,choices:[],summary:{ending:state.phase==='dead'?{title:state.lastReceipt?.death?.cause==='lifespan'?'寿尽':'伤重而终'}:null}});
  const pending=view.pending||view.busy;
  const intro=state.phase==='awaitingOpening'?`<section class="live-intro" aria-label="本地开场"><p>${esc(state.life.name)}，${Math.floor(state.life.ageDays/DAYS_PER_YEAR)}岁，出身${esc(ORIGINS[state.life.birth.originId])}。此生的行路，正要从这里开始。</p><p>天赋：${state.life.birth.talentIds.map(id=>esc(TALENTS[id])).join('、')}。</p></section>`:'';
  const preview=`<section class="live-preview" data-live-preview${view.preview?.text?'':' hidden'}><p class="live-preview-label" data-live-preview-label>${view.busy?'生成中 · 正文尚未保存':'未完成 · 请重试续接'}</p><div class="journey-prose" data-live-preview-text>${esc(view.preview?.text??'')}</div></section>`;
  const receipt=view.pending?.receipt.action?`<p class="live-action-receipt">你选择了：${esc(view.pending.receipt.action.label)}</p>`:'';
  return `${displayed}${intro}${receipt}${preview}<section class="live-status" aria-live="polite" aria-atomic="true"><p data-live-progress-status>${view.busy?(view.generationStatus==='switching'?'正在切换备用服务，故事会重新开始生成。':'正在续写，可以边生成边阅读。'):view.status==='paused'?esc(liveMessages[view.errorCode]??'此刻暂不能续写，进度已保留。'):state.phase==='dead'?'此生按规则结算，已入历史。':'落下一念，故事才会继续。'}</p>${pending?'<p>正文完成并保存后开放下一步。可读历史或导出备份。</p>':''}${view.pending&&!view.busy?'<button class="button primary" data-live-retry>重试续接</button><button class="button" data-live-resume>检查已有回应</button>':''}</section><div class="journey-choices" role="group" aria-label="眼前的选择">${choices.map((choice,index)=>`<button class="journey-choice" data-live-choice="${esc(choice.id)}" data-revision="${state.revision}" data-state-hash="${esc(view.stateHash)}"${pending||!choice.enabled?' disabled':''} aria-describedby="live-cost-${index}"><span class="journey-choice-label">${esc(choice.label)}</span><span class="journey-choice-reason" id="live-cost-${index}">${choice.reason?`${esc(choice.reason)} · `:''}${esc(choice.costs.days)}日${Object.entries(choice.costs.items).map(([id,count])=>` · ${esc(view.itemNames?.[id]??id)} ${esc(count)}`).join('')}${choice.warnings.length?` · ${esc(choice.warnings.join('；'))}`:''}</span></button>`).join('')}</div>${state.phase==='dead'?'<button class="button" data-live-new>再入轮回</button>':''}`;
}
export function updateLivePreview(root,view){
  const section=root.querySelector('[data-live-preview]'),text=root.querySelector('[data-live-preview-text]');
  if(!section||!text)return;
  section.hidden=!view.preview?.text;
  text.textContent=view.preview?.text??'';
  root.querySelector('[data-live-preview-label]').textContent=view.busy?'生成中 · 正文尚未保存':'未完成 · 请重试续接';
  const status=root.querySelector('[data-live-progress-status]');
  if(view.busy&&status)status.textContent=view.generationStatus==='switching'?'正在切换备用服务，故事会重新开始生成。':'正在续写，可以边生成边阅读。';
}
export function renderLiveHistory(entries,playerName) {
  return `<div class="journey-records">${entries.length?entries.map(entry=>{const names=new Map((entry.scene?.entities??[]).map(e=>[e.id,e.name]));names.set('self',playerName);return `<section><h3>第 ${esc(entry.identity.turnId)} 回 · ${esc(entry.scene?.title??'此生归宿')}</h3>${entry.receipt.action?`<p>你选择了：${esc(entry.receipt.action.label)} · 岁月经过 ${esc(entry.receipt.elapsedDays)} 日</p>`:'<p>此生初定</p>'}${entry.receipt.death?`<p>${entry.receipt.death.cause==='lifespan'?'寿尽':'伤重而终'}</p>`:''}${passage((entry.scene?.blocks??[]).map(b=>({...b,speaker:b.speaker?names.get(b.speaker)??'故人':undefined})),`live-${entry.identity.turnId}`)}</section>`;}).join(''):'<p>此生尚无已提交的故事。</p>'}</div>`;
}
