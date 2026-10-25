import { icon } from './icons.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = value => Math.round(value || 0).toLocaleString('zh-CN');

// The narrative result is intentionally retained by the engine across ordinary actions.
// Compare it to the latest real log instead of presenting an older consequence as current.
export function getPrimaryResult(story, entries = null) {
  const result = story?.lastResult ?? null;
  if (entries === null) return result;
  const latest = entries.at(-1);
  if (!latest || latest.kind === 'birth') return null;
  if (result && latest.title === result.title && latest.text === result.text) return result;
  return { title: latest.title, text: latest.text, changes: [] };
}

export function renderStoryResult(story, entries = null) {
  const result = getPrimaryResult(story, entries);
  if (!result) return '';
  return `<section class="story-result" aria-labelledby="story-result-title" role="status" aria-live="polite"><span class="story-kicker">${icon('spark', 14)}这一念的回响</span><h3 id="story-result-title" tabindex="-1">${esc(result.title)}</h3><p>${esc(result.text)}</p>${result.changes.length ? `<ul>${result.changes.map(change => `<li>${esc(change)}</li>`).join('')}</ul>` : ''}</section>`;
}

export function renderStoryOutcome(story) {
  const outcome = story?.outcome;
  if (!outcome) return '';
  return `<section class="story-outcome" aria-label="此世剧情结果"><span class="story-kicker">留在世间的事</span><h3>${esc(outcome.title)}</h3>${outcome.paragraphs.map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}<p class="story-world-change">${icon('history', 15)}${esc(outcome.worldChange)}</p><p class="story-inheritance">转世后，谷地的结果与未尽的承诺仍在。新的人生将接续它们留下的事务。</p></section>`;
}

export function renderStoryScene(story, balances = {}, entries = null) {
  const investigating = story.id === 'old-fire' && story.choices.some(choice => choice.id.startsWith('route_'));
  const currentBalances = choice => [
    ['气血', 'hp', /气血/], ['灵石', 'spirit', /灵石/], ['药材', 'herbs', /药材|灵药/], ['自身余寿', 'remainingLife', /命损|燃寿/],
  ].filter(([, key, pattern]) => balances[key] !== undefined && pattern.test(choice.costText))
    .map(([label, key]) => `${label}当前 ${number(balances[key])}`).join(' · ');
  return `<section class="story-panel" aria-labelledby="story-scene-title" data-story-scene="${esc(story.sceneId)}"><header class="story-header"><div class="story-kicker">${icon('book', 16)}${esc(story.title)}</div><div class="story-location">${esc(story.location)}</div><h2 id="story-scene-title" tabindex="-1">${esc(story.sceneTitle)}</h2><p class="story-objective"><span>眼前之事</span>${esc(story.objective)}</p>${investigating ? `<p class="story-clock-note" data-investigation-limit>三条调查线，最多深入 ${number(story.maxInvestigations)} 条；已调查 ${number(story.investigations)} 条。修炼、外出与旅行也推进封谷年份。</p>` : ''}</header>${renderStoryResult(story, entries)}<div class="story-prose">${story.paragraphs.map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}</div>${story.paused ? `<div class="story-paused">${icon('compass', 16)}<p>当前剧情暂歇。${story.choices.find(choice => !choice.enabled)?.reason ? esc(story.choices.find(choice => !choice.enabled).reason) : '请先完成眼前的际遇或战斗，再续此事。'}</p></div>` : ''}<div class="choices story-choices" aria-label="剧情抉择">${story.choices.map((choice, index) => `<button class="choice story-choice" data-story-choice="${esc(choice.id)}" ${choice.enabled ? '' : 'disabled'}${!choice.enabled ? ` aria-describedby="story-reason-${index}"` : ''}><span class="choice-index">${String(index + 1).padStart(2, '0')}</span><span class="choice-copy"><span class="choice-label">${esc(choice.label)}</span><span class="choice-description">${esc(choice.description)}</span><span class="choice-cost">${esc(choice.costText)}${currentBalances(choice) ? `<span class="choice-balance">${esc(currentBalances(choice))}</span>` : ''}</span>${choice.enabled ? '' : `<span class="choice-reason" id="story-reason-${index}">${esc(choice.reason)}</span>`}</span>${icon('chevron', 14)}</button>`).join('')}</div>${!story.choices.length && story.status !== 'active' ? '<p class="story-complete-note">这段故事已收束。你可以在下方继续修行、问道三界，或归隐结算，让下一世接续因果。</p>' : ''}</section>`;
}

export function renderStoryRecords(story) {
  if (!story) return '';
  return `<section class="story-records" aria-label="剧情回看"><h2>沿途所记</h2><div class="story-record-grid"><details class="story-record" data-panel-key="journal"><summary>${icon('scroll', 16)}剧情手记<span>${story.journal.length} 则</span>${icon('down', 14)}</summary><div class="story-record-body">${story.journal.length ? `<ol>${story.journal.map(entry => `<li><span class="story-record-date">道历 ${number(entry.year)} 年</span><h3>${esc(entry.title)}</h3><p>${esc(entry.text)}</p></li>`).join('')}</ol>` : '<p>此行刚刚开始，你亲历的选择将在这里留下记录。</p>'}</div></details><details class="story-record" data-panel-key="people"><summary>${icon('people', 16)}药谷人物<span>${story.people.length} 位</span>${icon('down', 14)}</summary><div class="story-record-body">${story.people.length ? story.people.map(person => `<article><h3>${esc(person.name)}</h3><p>${esc(person.role)}</p><p class="story-person-status">${esc(person.status)}</p><p>此世关系：${typeof person.relationship === 'number' ? person.relationship > 0 ? `信任 +${number(person.relationship)}` : person.relationship < 0 ? `疏离 ${person.relationship}` : '无本世相处记录' : esc(person.relationship)}</p></article>`).join('') : '<p>你尚未与谷中人相识。此后的相逢与承诺会被记住。</p>'}</div></details><details class="story-record" data-panel-key="clues"><summary>${icon('eye', 16)}已知线索<span>${story.clues.length} 条</span>${icon('down', 14)}</summary><div class="story-record-body">${story.clues.length ? story.clues.map(clue => `<article><h3>${esc(clue.title)}</h3><p>${esc(clue.text)}</p></article>`).join('') : '<p>尚未掌握确切线索。调查得来的证言、账目与地脉记录会留在这里。</p>'}</div></details></div></section>`;
}

export function renderStoryInterruption(story, phase, entries = []) {
  if (!story) return '';
  const result = getPrimaryResult(story, entries);
  const currentStoryResult = result && result === story.lastResult;
  return `<section class="story-interruption"><span class="story-kicker">${esc(story.title)} · ${esc(story.sceneTitle)}</span><p>先${phase === 'combat' ? '应对眼前的战斗' : '处理这场际遇'}，再续谷中之事。手记、故人与线索仍可在下方「回看」中查看。</p></section>${currentStoryResult ? renderStoryResult(story, entries) : ''}`;
}
