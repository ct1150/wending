import test from 'node:test';
import assert from 'node:assert/strict';
import * as journey from '../src/ui/journey.js';
import { renderIdentityBar, renderCharacterDetails, renderBirth } from '../src/ui/character.js';

function displayView() {
  return {
    revision: 8, sceneId: 'medicine-hut', phase: 'playing',
    title: '灯下有人', location: '山脚药棚', goal: '听听来人的打算。',
    blocks: [
      { id: '1', sceneId: 'old-bridge', kind: 'narration', text: '旧桥上的雨，已经停了。' },
      { id: '2', sceneId: 'old-bridge', kind: 'dialogue', speaker: '沈芷', text: '“先过桥。再谈求仙。”' },
      { id: '3', sceneId: 'old-bridge', kind: 'action', text: '先去搬药。' },
      { id: '4', sceneId: 'old-bridge', kind: 'result', text: '你把药箱搬上了堤岸。' },
      { id: '5', sceneId: 'medicine-hut', kind: 'narration', text: '药棚里的灯，还没有熄。' },
      { id: '6', sceneId: 'medicine-hut', kind: 'action', text: '替老人煎药。' },
      { id: '7', sceneId: 'medicine-hut', kind: 'result', text: '药汤熬好，老人的呼吸平稳了。' },
      { id: '8', sceneId: 'medicine-hut', kind: 'narration', text: '门外传来了新的脚步。' },
      { id: '9', sceneId: 'medicine-hut', kind: 'dialogue', speaker: '老人', text: '你还愿意去山里吗？' },
    ],
    choices: [
      { id: 'follow', label: '跟上山路。', detail: '耗时3年。灵石需1，现有2。余寿56年。', enabled: true },
      { id: 'heal', label: '先替他治伤。', detail: '疗伤药需1，现有0。', enabled: false, reason: '<还缺疗伤药>' },
      { id: 'burn-life', label: '燃起命火，照亮山路。', detail: '命损3年。', enabled: true, warning: '此去会折损三年寿元。' },
    ],
    summary: {
      name: '云归', age: 16, ageText: '16岁', year: 1000, generation: 2,
      remainingLife: 56, remainingLifeText: '56年', lifeLimit: 72, lifeDamage: 0,
      realm: 'mortal', realmName: '凡人', injury: 1, injuryName: '轻伤',
      attributes: [{ id: 'constitution', name: '根骨', value: 4, description: '疗伤时更容易养好身体。' }],
      talents: [{ id: 'prepared', name: '备药', description: '随身多备一包疗伤药。' }],
      abilities: [{ id: 'herbalism', name: '辨药', description: '认得草木的药性。' }],
      items: [{ id: 'stones', name: '灵石', count: 2 }],
      legacy: { id: 'herbalism', name: '辨药旧忆', description: '亲手学过的法门。' },
      ending: null,
      biography: [{ generation: 1, name: '云归', age: 72, title: '雨后归山', cause: 'retired', achievement: '留下了一座药棚。', deeds: ['为山中人留下药方。'], lesson: '临行记得备药。' }],
      priorTranscript: [{ id: 'prior-1', kind: 'dialogue', speaker: '旧友', text: '明年还回来吗' }],
      legacyArchive: { run: { log: [{ title: '旧途手记', text: '旧日亲手抄下的字。' }] } },
      legacyCollection: [{ name: '辨药旧忆', source: '亲历药棚', description: '一门可传下去的方法。' }],
    },
  };
}

const readable = html => html.replace(/<[^>]*>/g, '');

test('the current reader keeps only the latest consequence and current scene, without discarding the view', () => {
  const view = displayView(), before = structuredClone(view);
  const html = journey.renderJourney(view);
  assert.doesNotMatch(html, /旧桥上的雨|先过桥|先去搬药|你把药箱搬上了堤岸|药棚里的灯|替老人煎药|为山中人留下药方|旧日亲手抄下的字/);
  assert.match(html, /药汤熬好，老人的呼吸平稳了。/);
  assert.match(html, /门外传来了新的脚步。/);
  assert.match(html, /id="journey-block-7"[^>]*tabindex="-1"/);
  assert.match(html, /id="journey-current-title"[^>]*tabindex="-1"/);
  assert.equal((html.match(/data-journey-choice=/g) ?? []).length, 3);
  assert.deepEqual(view, before);
});

test('natural choices omit routine accounting but retain unavailable reasons and serious risk', () => {
  const html = journey.renderJourney(displayView());
  assert.match(html, /跟上山路。/);
  assert.doesNotMatch(html, /耗时3年|灵石需1|现有2|余寿56年|疗伤药需1/);
  assert.match(html, /data-journey-choice="heal"[^>]*disabled/);
  assert.match(html, /&lt;还缺疗伤药&gt;/);
  assert.match(html, /此去会折损三年寿元。/);
  assert.match(html, /data-revision="8"/);
  assert.match(html, /data-scene-id="medicine-hut"/);
});

test('a serious warning already stated in the label is not repeated beneath it', () => {
  const view = displayView();
  view.choices = [{ id: 'torrent', label: '涉过急流（必死）', detail: '伤势已重。', warning: '必死。', enabled: true }];
  const html = journey.renderJourney(view);
  assert.equal((readable(html).match(/必死/g) ?? []).length, 1);
});

test('expanded danger prose replaces only the warning parentheticals it fully explains', () => {
  const cases = [
    ['涉过急流（会受伤）', '会留下重伤。'],
    ['强催凝气（必定失败、伤身折寿）', '会折损寿元4年。强行催动会使冲关失败。会留下重伤。'],
  ];
  for (const [label, warning] of cases) {
    const view = displayView();
    view.choices = [{ id: 'danger', label, warning, enabled: true }];
    const html = journey.renderJourney(view);
    assert.doesNotMatch(readable(html), /（会受伤）|（必定失败、伤身折寿）/);
    assert.ok(readable(html).includes(warning));
    delete view.choices[0].warning;
    assert.ok(readable(journey.renderJourney(view)).includes(label));
  }
});

test('dialogue uses one Chinese colon and quotation pair while preserving complete sentences', () => {
  const cases = [
    ['先坐下', '沈芷：“先坐下。”'],
    ['先坐下。慢慢说。', '沈芷：“先坐下。慢慢说。”'],
    ['“先坐下。慢慢说。”', '沈芷：“先坐下。慢慢说。”'],
    ['“先坐下。慢慢说”。', '沈芷：“先坐下。慢慢说。”'],
    ['「还去吗？」', '沈芷：“还去吗？”'],
    ['"别动！"', '沈芷：“别动！”'],
    ['你当真要去?!', '沈芷：“你当真要去?!”'],
    ['我只是……', '沈芷：“我只是……”'],
    ['“她说，‘明日再来。’”', '沈芷：“她说，‘明日再来。’”'],
    ['沈芷：“你回来了。”', '沈芷：“你回来了。”'],
  ];
  for (const [text, expected] of cases) {
    const view = displayView();
    view.blocks = [{ id: 'speech', kind: 'dialogue', speaker: '沈芷', text }];
    const plain = readable(journey.renderJourney(view));
    assert.ok(plain.includes(expected), `${text} should read as ${expected}, got ${plain}`);
    assert.doesNotMatch(plain, /““|””|：：|。。”/);
  }
});

test('dialogue, option and history text stay escaped instead of becoming markup', () => {
  const view = displayView();
  view.blocks = [{ id: '"unsafe', kind: 'dialogue', speaker: '<img src=x>', text: '“<script>unsafe()</script>”' }];
  view.choices[0].label = '<svg onload=bad()>';
  view.choices[0].warning = '<b>危险</b>';
  const html = journey.renderJourney(view);
  assert.doesNotMatch(html, /<img|<script|<svg|<b>/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.match(html, /&lt;script&gt;unsafe\(\)&lt;\/script&gt;/);
  assert.match(html, /&lt;b&gt;危险&lt;\/b&gt;/);
});

test('history exposes every current and prior conversation with closed earlier-life records', () => {
  assert.equal(typeof journey.renderJourneyHistory, 'function');
  const view = displayView(), before = structuredClone(view);
  const html = journey.renderJourneyHistory(view), plain = readable(html);
  for (const text of ['旧桥上的雨，已经停了。', '你把药箱搬上了堤岸。', '药汤熬好，老人的呼吸平稳了。', '门外传来了新的脚步。', '为山中人留下药方。', '旧日亲手抄下的字。']) assert.ok(plain.includes(text));
  assert.match(plain, /旧友：“明年还回来吗。”/);
  assert.match(html, /<details/);
  assert.doesNotMatch(html, /<details[^>]*\sopen(?:\s|>)/);
  assert.doesNotMatch(html, /id="journey-block-|data-journey-choice=/);
  assert.deepEqual(view, before);
});

test('prior conversation remains readable even when no biography or legacy collection exists', () => {
  assert.equal(typeof journey.renderJourneyHistory, 'function');
  const view = displayView();
  view.summary.biography = [];
  view.summary.legacyCollection = [];
  view.summary.legacyArchive = null;
  assert.match(readable(journey.renderJourneyHistory(view)), /旧友：“明年还回来吗。”/);
});

test('an ending stays on the current page while the previous life record stays in history', () => {
  const view = displayView();
  view.phase = 'ended';
  view.summary.ending = { title: '灯火长明', achievement: '留下一间可以避雨的药棚。', lesson: '山路总要一步步走。' };
  const html = journey.renderJourney(view);
  assert.match(html, /灯火长明/);
  assert.match(html, /留下一间可以避雨的药棚。/);
  assert.match(html, /山路总要一步步走。/);
  assert.doesNotMatch(html, /雨后归山|为山中人留下药方/);
});

test('the compact character entry carries basic identity and an accessible drawer control', () => {
  const summary = displayView().summary, before = structuredClone(summary);
  const html = renderIdentityBar(summary), plain = readable(html);
  assert.match(html, /<button[^>]*data-character[^>]*aria-haspopup="dialog"/);
  for (const text of ['第2世', '云归', '凡人', '16岁', '余寿56年']) assert.ok(plain.includes(text));
  assert.doesNotMatch(html, /灵石|辨药|备药|疗伤时/);
  assert.deepEqual(summary, before);
});

test('character details show carried objects, injuries, abilities and rolled traits without action controls', () => {
  const summary = displayView().summary, before = structuredClone(summary);
  const html = renderCharacterDetails(summary), plain = readable(html);
  for (const text of ['轻伤', '灵石', '2', '辨药', '认得草木的药性。', '根骨', '4', '备药', '随身多备一包疗伤药。', '辨药旧忆', '亲手学过的法门。']) assert.ok(plain.includes(text));
  assert.doesNotMatch(html, /<button|data-journey-choice|data-birth-/);
  assert.deepEqual(summary, before);
});

test('older public summaries have readable identity and details without invented birth traits', () => {
  const summary = { name: '旧途人', generation: 4, age: 82, realm: 'foundation', remainingLife: 78, lifeLimit: 160, lifeDamage: 0, injury: 'hurt', abilities: [], items: [], legacy: null };
  const identity = readable(renderIdentityBar(summary));
  assert.match(identity, /旧途人/);
  assert.match(identity, /筑基/);
  assert.match(identity, /82岁/);
  assert.match(identity, /余寿78年/);
  const details = renderCharacterDetails(summary);
  assert.doesNotMatch(details, /undefined|NaN|根骨|悟性|气运/);
  assert.match(details, /受伤/);
  assert.match(renderCharacterDetails({ ...summary, injury: 'well' }), /无碍/);
});

test('birth presents editable escaped name, visible dice results and guarded submit controls', () => {
  const creation = {
    name: '青"<云>', revision: 3, sceneId: 'arrival', rollCount: 2,
    attributes: [
      { id: 'constitution', name: '根骨', value: 6, description: '养伤时额外恢复。' },
      { id: 'insight', name: '悟性', value: 4, description: '初入炼气时多一分领悟。' },
      { id: 'fortune', name: '气运', value: 2, description: '入世时多一点盘缠。' },
    ],
    talents: [{ id: 'prepared', name: '备药', description: '行囊里多一包伤药。' }],
  };
  const before = structuredClone(creation), html = renderBirth(creation);
  assert.match(html, /<form[^>]*id="birth-form"/);
  assert.match(html, /id="birth-title"[^>]*tabindex="-1"/);
  assert.match(html, /<label[^>]*for="birth-name"/);
  const input = html.match(/<input[^>]*id="birth-name"[^>]*>/)?.[0];
  assert.ok(input);
  assert.match(input, /maxlength="24"/);
  assert.match(input, /value="青&quot;&lt;云&gt;"/);
  assert.match(input, /aria-describedby="[^"]*birth-name-error/);
  assert.match(html, /id="birth-name-error"[^>]*role="status"[^>]*aria-live="polite"[^>]*><\/p>/);
  const dice = html.match(/<button[^>]*data-birth-reroll[^>]*>/)?.[0];
  const start = html.match(/<button[^>]*data-birth-start[^>]*>/)?.[0];
  assert.match(dice, /type="button"/);
  assert.match(start, /type="submit"/);
  for (const button of [dice, start]) {
    assert.match(button, /data-revision="3"/);
    assert.match(button, /data-scene-id="arrival"/);
  }
  for (const text of ['根骨', '悟性', '气运', '备药', '行囊里多一包伤药。']) assert.ok(readable(html).includes(text));
  assert.doesNotMatch(html, /<云>|data-journey-choice/);
  assert.deepEqual(creation, before);
});

test('names and detailed trait descriptions remain escaped in both character surfaces', () => {
  const summary = displayView().summary;
  summary.name = '<img src=x onerror=bad()>';
  summary.talents[0].description = '<script>bad()</script>';
  summary.items[0].name = '<svg onload=bad()>';
  const html = renderIdentityBar(summary) + renderCharacterDetails(summary);
  assert.doesNotMatch(html, /<img|<script|<svg/);
  assert.match(html, /&lt;img src=x onerror=bad\(\)&gt;/);
  assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(html, /&lt;svg onload=bad\(\)&gt;/);
});
