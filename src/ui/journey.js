const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function renderRecords(summary) {
  const records=summary.biography ?? [], old=summary.legacyArchive;
  if (!records.length && !old && !summary.legacyCollection?.length) return '';
  const passage=rows => rows.map(row=>`<p>${row.speaker ? `<strong>${esc(row.speaker)}</strong> `:''}${row.title ? `${esc(row.title)}：`:''}${esc(row.text)}</p>`).join('');
  return `<details class="journey-records" data-panel-key="journey-records"><summary>回看生平与传承 · ${records.length} 段人生</summary>${records.map(row=>`<details><summary>第 ${esc(row.generation)} 世 · ${esc(row.name)} · ${esc(row.age)} 岁 · ${esc(row.title ?? ({retired:'归隐',lifespan:'寿尽',battle:'陨落',victory:'问鼎',burned:'燃命而终'}[row.cause] ?? row.cause))}</summary>${row.achievement ? `<p>${esc(row.achievement)}</p>` : ''}${(row.deeds ?? []).map(deed=>`<p>${esc(deed)}</p>`).join('')}${row.lesson ? `<p>${esc(row.lesson)}</p>` : ''}${passage(row.transcript ?? row.log ?? [])}</details>`).join('')}${summary.priorTranscript?.length ? `<details><summary>前世完整行文与轮回交接</summary>${passage(summary.priorTranscript)}</details>` : ''}${old ? `<details><summary>旧人生原始记录（未记录处不补写）</summary>${passage(old.run?.log ?? [])}<details><summary>逐项核对原始收藏、世界记录与生平</summary><pre>${esc(JSON.stringify(old,null,2))}</pre></details></details>` : ''}${summary.legacyCollection?.map(row=>`<p>${esc(row.name)}：${esc(row.source)}。${esc(row.description)}</p>`).join('') ?? ''}</details>`;
}
function renderBlock(block) {
  const kind = ['narration', 'dialogue', 'action', 'result'].includes(block.kind) ? block.kind : 'narration';
  return `<p id="journey-block-${esc(block.id)}" class="journey-block journey-${kind}"${kind === 'result' ? ' tabindex="-1"' : ''}>${kind === 'action' ? '<span class="journey-voice">你选择了</span>' : block.speaker ? `<span class="journey-voice">${esc(block.speaker)}</span>` : ''}${esc(block.text)}</p>`;
}

// Render only the public display view: reading is pure and cannot advance time,
// choose opportunities, or discover actions from private engine state.
export function renderJourney(view) {
  const lastResult = view.blocks.findLastIndex(block => block.kind === 'result');
  const previous = view.blocks.slice(0, lastResult + 1);
  const current = view.blocks.slice(lastResult + 1);
  const cultivation = typeof view.summary.realmName === 'string';
  const identity = `<p class="journey-identity">${esc(view.summary.name)} · ${cultivation ? `${esc(view.summary.ageText)} · ${esc(view.summary.realmName)} · 余寿 ${esc(view.summary.remainingLifeText)}` : `第 ${esc(view.summary.generation)} 世`}</p>`;
  const ending = view.summary.ending;
  return `<article class="journey" aria-label="此生故事">${cultivation ? '' : identity}${previous.length ? `<section class="journey-history" aria-label="已经发生的事">${previous.map(renderBlock).join('')}</section>` : ''}<section class="journey-current" aria-labelledby="journey-current-title"><header>${cultivation ? identity : ''}<p class="journey-location">${esc(view.location)}</p><h2 id="journey-current-title" tabindex="-1">${esc(view.title)}</h2>${view.goal ? `<p class="journey-goal">${esc(view.goal)}</p>` : ''}</header><div class="journey-prose">${current.map(renderBlock).join('')}</div>${ending ? `<section class="journey-ending" aria-label="此生归宿"><h3>${esc(ending.title)}</h3>${ending.achievement ? `<p>${esc(ending.achievement)}</p>` : ''}${ending.lesson ? `<p>${esc(ending.lesson)}</p>` : ''}</section>` : ''}<div class="journey-choices" role="group" aria-label="眼前的选择">${view.choices.map(choice => `<button class="journey-choice" data-journey-choice="${esc(choice.id)}" data-revision="${esc(view.revision)}" data-scene-id="${esc(view.sceneId)}"${choice.enabled ? '' : ' disabled'}><span class="journey-choice-label">${esc(choice.label)}</span><span class="journey-choice-detail">${esc(choice.detail)}</span>${choice.reason ? `<span class="journey-choice-reason">${esc(choice.reason)}</span>` : ''}</button>`).join('')}</div></section>${renderRecords(view.summary)}</article>`;
}
