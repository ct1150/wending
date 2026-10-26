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
