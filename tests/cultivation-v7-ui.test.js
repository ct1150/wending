import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveGame } from '../src/game/cultivation/live/engine.js';
import { REALMS, ORIGINS, TALENTS, ITEMS } from '../src/game/cultivation/live/model.js';
import * as character from '../src/ui/character.js';
import { renderLiveJourney } from '../src/ui/journey.js';

function fixture() {
  const state = createLiveGame({ runId: 'v7-ui', seed: 42 });
  state.life.cultivationProfile = { version: 7 };
  state.life.ageDays = 16 * 360 + 180;
  state.phase = 'active';
  state.director = { currentGoal: '查明渡口为何封闭' };
  state.currentScene = {
    id: 'scene', title: '渡口', location: '柳溪渡口', entities: [],
    blocks: [{ kind: 'narration', text: '你站在渡口，等候船夫答复。' }],
    choices: [
      { id: 'ask', label: '询问船夫封渡的缘由' },
      { id: 'look', label: '沿河岸查看新近的脚印' },
      { id: 'leave', label: '暂且退回茶棚，静观渡口动静' },
    ],
  };
  const choices = state.currentScene.choices.map(choice => ({ ...choice, enabled: true, costs: { days: 0, items: {} }, warnings: [] }));
  return { state, choices, view: { state, stateHash: 'hash', pending: null, busy: false, status: 'ready', itemNames: ITEMS } };
}

test('v7 identity shows elapsed age over the maximum instead of remaining life in all accessible copy', () => {
  const { state } = fixture();
  const summary = character.liveCharacterSummary(state, { REALMS, ORIGINS, TALENTS, ITEMS });
  const html = character.renderIdentityBar(summary) + character.renderCharacterDetails(summary);
  assert.match(html, /16\.5\s*\/\s*80/);
  assert.doesNotMatch(html, /余寿|剩余寿|63\.5/);
  assert.match(html, /柳溪渡口/);
  assert.match(html, /查明渡口为何封闭/);
});

test('v7 presents exactly three numbered story choices followed by a separate custom action form', () => {
  const { view, choices } = fixture();
  const html = renderLiveJourney({ ...view, customAction: { open: true, text: '在茶棚听听来客的议论', error: '' } }, choices);
  assert.equal((html.match(/data-live-choice="/g) ?? []).length, 3);
  assert.match(html, />1[.．、]\s*<\/span>/);
  assert.match(html, />2[.．、]\s*<\/span>/);
  assert.match(html, />3[.．、]\s*<\/span>/);
  assert.match(html, /data-live-custom-toggle/);
  assert.match(html, /4[.．、]\s*<\/span>.*自定义行动/);
  assert.match(html, /id="live-custom-action"/);
  assert.match(html, /在茶棚听听来客的议论/);
  assert.ok(html.indexOf('data-live-custom-toggle') > html.indexOf('data-live-choice="leave"'));
  assert.doesNotMatch(html, />0日|无变化|无效果|落下一念，故事才会继续/);
});

test('v7 streamed choices and the custom path remain disabled until durable completion', () => {
  const { view } = fixture();
  const html = renderLiveJourney({ ...view, busy: true, pending: {}, preview: {
    blocks: [{ kind: 'narration', text: '船夫抬起头，', complete: false }],
    choices: [{ label: '询问船夫封渡的缘由', complete: false }],
  } }, []);
  assert.doesNotMatch(html, /data-live-choice="/);
  assert.match(html, /data-live-choice-preview[^>]*disabled/);
  assert.match(html, /data-live-custom-toggle[^>]*disabled/);
});

test('unmapped custom input remains visible with the exact failure response and no fake turn feedback', () => {
  const { view, choices } = fixture();
  const html = renderLiveJourney({ ...view, customAction: { open: true, text: '立刻飞升天界', error: '【该行动超出当前场景能力范围，请重新选择。】' } }, choices);
  assert.match(html, /立刻飞升天界/);
  assert.match(html, /【该行动超出当前场景能力范围，请重新选择。】/);
  assert.doesNotMatch(html, /骰|掷骰|行动成功/);
});

test('live birth asks for the exact requested name prompt before opening a life', () => {
  assert.equal(typeof character.renderLiveBirth, 'function');
  const html = character.renderLiveBirth({ name: '林照', originId: 'village', origins: ORIGINS, available: true });
  assert.match(html, /大道无情，仙路崎岖。 凡人，留下你的名讳，准备踏入这残酷而浩瀚的修仙界：/);
  assert.match(html, /id="live-name"[^>]*value="林照"/);
  assert.match(html, /data-live-start/);
  assert.doesNotMatch(html, /十六岁，山外的路|此生，你是谁|已有旅程会保留/);
});

test('v7 renders authoritative action changes and only the actual check result before the story', () => {
  const { view, choices } = fixture();
  view.state.lastReceipt = {
    kind: 'choice', action: { label: '沿河岸查看新近的脚印' }, elapsedDays: 1,
    before: { ageDays: 5760, cultivation: 0, injury: 0, lifeLimit: 80, cultivationProfile: { version: 7, spirit: 100, exposure: 0, arts: {} } },
    after: { ageDays: 5761, cultivation: 1, injury: 1, lifeLimit: 80, cultivationProfile: { version: 7, spirit: 90, exposure: 0, arts: {} } },
    itemChanges: { supplies: -1, stones: 2 }, relationChanges: {},
    random: { before: 1234567, after: 9876543, roll: 16 },
    cultivationResult: { version: 7, check: { kind: 'exploration', roll: 16, chance: 70, success: true }, lifespanChange: { years: 0, cause: null } },
  };
  const html = renderLiveJourney(view, choices);
  assert.match(html, /你选择了：沿河岸查看新近的脚印/);
  for (const expected of ['岁月 +1日', '修为 +1', '气血 -10%', '灵力 -10', '行粮 -1', '灵石 +2', '探索判定：成功']) assert.ok(html.includes(expected), expected);
  assert.doesNotMatch(html, /1234567|9876543|70%|16[ \s]*\/|无变化|无需判定|寿命上限 [+-]0/);
  assert.ok(html.indexOf('data-live-feedback') < html.indexOf('data-live-changes'));
  assert.ok(html.indexOf('data-live-changes') < html.indexOf('data-live-check'));
  assert.ok(html.indexOf('data-live-check') < html.indexOf('data-live-prose'));
  assert.ok(html.indexOf('data-live-prose') < html.indexOf('data-live-state'));
  assert.ok(html.indexOf('data-live-state') < html.indexOf('data-live-choices'));
});

test('v7 has no empty change or dice notices for a zero-time observation', () => {
  const { view, choices } = fixture();
  const snapshot = { ageDays: 5760, cultivation: 0, injury: 0, lifeLimit: 80, cultivationProfile: { version: 7, spirit: 100, exposure: 0, arts: {} } };
  view.state.lastReceipt = { kind: 'choice', action: { label: '望向远处的渡船' }, elapsedDays: 0, before: snapshot, after: snapshot, itemChanges: {}, relationChanges: {}, cultivationResult: { version: 7, check: null, lifespanChange: { years: 0, cause: null } } };
  const html = renderLiveJourney(view, choices);
  assert.match(html, /data-live-changes[^>]*hidden/);
  assert.match(html, /data-live-check[^>]*hidden/);
  assert.doesNotMatch(html, /无变化|无需判定|未发生变化|骰子|判定成功|岁月 \+0日/);
});

test('v7 death exposes the earned settlement and an affordable deliberate reincarnation shop', () => {
  const { view } = fixture();
  view.state.phase='dead';view.state.life.injury=10;view.state.currentScene=null;
  view.state.lastReceipt={kind:'choice',action:{label:'守住渡口'},death:{cause:'injury'},before:{},after:{}};
  const html=renderLiveJourney({...view,selectedReincarnationRewards:['past-memory']},[]);
  assert.match(html,/此生结算/);
  assert.match(html,/六道轮回商店/);
  assert.match(html,/仙路未尽，此心曾向长生。/);
  assert.match(html,/本世所得 2/);
  assert.match(html,/前世结余 0/);
  assert.match(html,/data-live-reward="past-memory"[^>]*aria-pressed="true"/);
  assert.match(html,/data-live-reward="former-relic"[^>]*disabled/);
  assert.match(html,/data-live-reincarnate[^>]*>步入轮回/);
  assert.doesNotMatch(html,/data-live-new/);
});

test('a claimed death settlement cannot offer a second reincarnation purchase', () => {
  const { view } = fixture();
  view.state.phase='dead';view.state.life.injury=10;view.state.currentScene=null;
  view.state.lastReceipt={kind:'choice',action:{label:'守住渡口'},death:{cause:'injury'},before:{},after:{}};
  const html=renderLiveJourney({...view,reincarnatedTo:'new-life'},[]);
  assert.match(html,/data-live-reincarnate[^>]*disabled/);
  assert.equal((html.match(/data-live-reward="[^"]+"[^>]*disabled/g)??[]).length,4);
  assert.match(html,/此生已经步入轮回/);
});
