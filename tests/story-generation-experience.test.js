import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createLiveGame, prepareOpening, prepareChoice, commitTurn } from '../src/game/cultivation/live/engine.js';
import { buildStoryContext } from '../src/game/cultivation/live/memory.js';
import { buildStoryInput, generateProviderScene } from '../src/worker/story-provider-core.js';
import { generateScene } from '../src/worker/story-provider.js';
import { createStoryApi, TURN_RESERVATION_NEURONS } from '../src/worker/story-api.js';
import { createBudgetCoordinator } from '../src/worker/story-budget.js';
import { GLM_PROFILE, GLM_MODEL_ID } from '../src/worker/story-config.js';
import { capturedStoryWire } from './helpers/story-choice-captured.js';

const profile = { ...GLM_PROFILE, validated: true, supportsStructuredOutput: true };
function fixture() {
  const state = createLiveGame({ runId: 'story-experience', seed: 42, engineVersion: 7 });
  const pending = prepareOpening(state, { requestId: 'opening' });
  return { state, pending, context: buildStoryContext(state, pending) };
}
const completion = wire => ({ model: GLM_MODEL_ID, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(wire) } }], usage: { prompt_tokens: 400, completion_tokens: 450, total_tokens: 850 } });
function stream(wire) {
  const frame = { model: GLM_MODEL_ID, choices: [{ index: 0, delta: { content: JSON.stringify(wire) }, finish_reason: 'stop' }], usage: completion(wire).usage };
  return new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: ' + JSON.stringify(frame) + '\n\ndata: [DONE]\n\n')); controller.close(); } });
}
const run = (wire, context = fixture().context) => generateProviderScene({ run: async () => completion(wire) }, { ...profile, storyActions: true }, context);

test('the original short opening and indirect observation are accepted without rewriting the prose or choices', async () => {
  const wire = capturedStoryWire(), { state, pending, context } = fixture();
  assert.equal(Array.from(wire.blocks[0].text).length, 126);
  assert.ok(!wire.blocks[0].text.includes('灰衣汉子'));
  const result = await run(wire, context);
  assert.equal(result.status, 'ready', result.errorCode);
  assert.deepEqual(result.scene.blocks, wire.blocks);
  const active = commitTurn(state, pending, result.scene);
  assert.equal(active.revision, 1);
  for (const [index, choice] of result.scene.choices.entries()) {
    assert.equal(choice.approach, wire.choices[index].action.split(':')[1]);
    assert.ok(choice.label.endsWith(wire.choices[index].purpose));
    const next = prepareChoice(active, { requestId: 'next-' + index, choiceId: choice.id });
    assert.equal(next.receipt.action.targetId, choice.targetId);
    assert.equal(next.receipt.elapsedDays, 0);
    assert.deepEqual(next.receipt.itemChanges, {});
  }
  assert.notEqual(result.scene.choices[1].targetId, 'self', 'the original person association is preserved');
});

test('shorter prose, natural references, and time words in a question do not pause v7 play', async () => {
  const wire = capturedStoryWire();
  wire.blocks[0].text = '路边的汉子托着一只陶罐，似乎在等你开口。';
  wire.choices[0].purpose = '询问三年前这里发生过什么';
  const result = await run(wire);
  assert.equal(result.status, 'ready', result.errorCode);
  assert.deepEqual(result.scene.blocks, wire.blocks);
  assert.ok(result.scene.choices[0].label.endsWith(wire.choices[0].purpose));
});

test('quoted prose is not treated as a command to change authoritative character numbers', async () => {
  const wire = capturedStoryWire(), { state, pending, context } = fixture();
  wire.blocks[0].text = '路边的汉子开玩笑道：“你已经九十九岁，怎么还认不出这罐子？”';
  const result = await run(wire, context);
  assert.equal(result.status, 'ready', result.errorCode);
  const active = commitTurn(state, pending, result.scene);
  assert.equal(active.life.ageDays, pending.receipt.after.ageDays);
  assert.deepEqual(active.life.items, context.life.items);
});

test('ordinary advice and food synonyms remain playable without changing assistance costs', async () => {
  const wire = capturedStoryWire(), { state, pending, context } = fixture();
  wire.blocks[0].text = '路边的汉子饥肠辘辘，提醒你：“不要忽略师父的提示，遇事先想一想。”';
  wire.choices[1] = { ...wire.choices[1], action: 'interact:help', purpose: '递给他一块饼，缓解饥饿' };
  const result = await run(wire, context);
  assert.equal(result.status, 'ready', result.errorCode);
  const active = commitTurn(state, pending, result.scene);
  const helped = prepareChoice(active, { requestId: 'help', choiceId: result.scene.choices[1].id });
  assert.equal(helped.receipt.itemChanges.supplies, -1);
  assert.equal(helped.receipt.elapsedDays, 1);
});

test('observation guidance preserves the selected pot as the focus without changing the action or receipt', async () => {
  const { state, pending, context } = fixture(), result = await run(capturedStoryWire(), context);
  assert.equal(result.status, 'ready', result.errorCode);
  const active = commitTurn(state, pending, result.scene);
  const choice = result.scene.choices[1], next = prepareChoice(active, { requestId: 'observe', choiceId: choice.id });
  const nextContext = buildStoryContext(active, next), before = structuredClone(nextContext);
  const input = buildStoryInput({ ...profile, storyActions: true }, nextContext);
  const request = input.messages.at(-1).content;
  assert.ok(request.includes(choice.label));
  assert.match(request, /人物、物件或环境/u);
  assert.ok(!request.includes('本次只观察当前地点'));
  assert.deepEqual(nextContext, before);
});

test('relaxed editorial requirements still reject broken metadata and conflicting named identities', async () => {
  const broken = capturedStoryWire(); broken.story.receipt = { elapsedDays: 0 };
  assert.equal((await run(broken)).errorCode, 'GENERATED_SCENE_INVALID');
  const missing = capturedStoryWire(); missing.choices[0].target.ref = 'unknown-person';
  assert.equal((await run(missing)).errorCode, 'GENERATED_SCENE_INVALID');
});

test('an accepted opening uses one durable inference and replays without spending another attempt', async t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const storage = { sql: { exec(query, ...params) { return { toArray: () => db.prepare(query).all(...params) }; } }, transactionSync(fn) { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } } };
  const budget = createBudgetCoordinator({ storage, now: () => Date.parse('2026-10-31T10:00:00Z') });
  const origin = 'https://experience.example', inputs = [], env = { AI: { async run(_model, input) { inputs.push(input); return stream(capturedStoryWire()); } } };
  const api = createStoryApi({ budget, config: { readiness: () => profile }, provider: generateScene });
  const request = (path, body, cookie) => new Request(origin + path, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'X-Story-Actions': '1', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  const response = await api.fetch(request('/api/story/session', { protocolVersion: 1 }), env);
  const session = await response.json(), cookie = response.headers.get('set-cookie').split(';')[0];
  const body = { context: fixture().context, attempt: { id: 'opening-attempt', sessionRef: session.sessionRef, retryOf: null }, storyActions: true };
  const first = await (await api.fetch(request('/api/story/turn', body, cookie), env)).json();
  assert.equal(first.status, 'ready', first.errorCode);
  const replay = await (await api.fetch(request('/api/story/turn', body, cookie), env)).json();
  assert.deepEqual(replay, first);
  assert.equal(inputs.length, 1);
  const ledger = db.prepare('SELECT * FROM ledger').all();
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].status, 'complete');
  assert.equal(ledger[0].charge, TURN_RESERVATION_NEURONS);
});

test('an exact repeated menu item leaves both distinct original choices playable', async () => {
  const {state,pending,context}=fixture(),wire=capturedStoryWire();
  wire.choices[1]=structuredClone(wire.choices[0]);
  const result=await run(wire,context);
  assert.equal(result.status,'ready',result.errorCode);
  assert.deepEqual(result.scene.choices.map(p=>p.approach),['ask','decline']);
  assert.deepEqual(result.scene.choices.map(p=>p.id.split(':').at(-1)),['a','c']);
  const committed=commitTurn(state,pending,result.scene);
  for(const choice of result.scene.choices)assert.deepEqual(prepareChoice(committed,{choiceId:choice.id,requestId:'dedup-'+choice.approach}).receipt.action,choice);
});

test('the native structural sample keeps its menu with advisory tags and a compact actor reference', async () => {
  const {state,pending,context}=fixture(),wire=capturedStoryWire();
  wire.blocks[0].text='你看见渡口船夫手边的旧陶罐，他抬手指了指盖上的泥痕。'.repeat(8).slice(0,167);
  assert.equal(wire.blocks[0].text.length,167);
  for(const c of wire.choices)c.target={kind:'person',name:'渡口船夫',ref:''};
  wire.story={pattern:{style:'discovery'},beat:'progress',anchors:[0]};
  wire.memoryDeltas=[{kind:'fact',target:'渡口船夫',anchor:0}];
  const result=await run(wire,context);
  assert.equal(result.status,'ready',result.errorCode);
  const next=commitTurn(state,pending,result.scene);
  assert.deepEqual(result.scene.blocks,wire.blocks);assert.equal(next.revision,1);
  assert.equal(result.scene.story.pattern,context.director.pacing.pattern);
  assert.equal(result.scene.story.beat,'progress');
  assert.equal(result.scene.memoryDeltas[0].entityId,result.scene.choices[0].targetId);
  for(const p of result.scene.choices)assert.deepEqual(prepareChoice(next,{choiceId:p.id,requestId:'native-'+p.approach}).receipt.action,p);
});

test('two independent original actions commit when a third suggestion uses an unknown action', async () => {
  const {state,pending,context}=fixture(),wire=capturedStoryWire();
  wire.choices[1].action='interact:levitate';
  const result=await run(wire,context);assert.equal(result.status,'ready',result.errorCode);
  assert.deepEqual(result.scene.choices.map(c=>[c.id.split(':').at(-1),c.approach]),[['a','ask'],['c','decline']]);
  const next=commitTurn(state,pending,result.scene);assert.deepEqual(next.currentScene.blocks,wire.blocks);
  for(const p of result.scene.choices)assert.deepEqual(prepareChoice(next,{choiceId:p.id,requestId:'original-'+p.approach}).receipt.action,p);
  const bad=capturedStoryWire();bad.choices[1].target.ref='k99';assert.equal((await run(bad)).status,'rejected');
});

test('a normal stop with a damaged optional tail commits the complete original playable core in one call',async()=>{
  const {state,pending,context}=fixture(),wire=capturedStoryWire();let calls=0;
  const content=JSON.stringify({blocks:wire.blocks,choices:wire.choices}).slice(0,-1)+',"story":{"pattern":';
  const raw=completion(wire);raw.choices[0].message.content=content;
  const result=await generateProviderScene({run:async()=>{calls++;return raw;}},{...profile,storyActions:true},context);
  assert.equal(result.status,'ready',result.errorCode);assert.equal(calls,1);
  const next=commitTurn(state,pending,result.scene);assert.deepEqual(next.currentScene.blocks,wire.blocks);assert.equal(next.revision,1);
});
