import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import * as author from '../scripts/story-author/index.js';

const briefs = [{ id: 'arrival.atmosphere', sceneId: 'arrival', title: '山口', facts: ['晨雾笼罩山口。'], prompt: '只写环境。' }];
const prose = { passages: [{ id: briefs[0].id, text: '山风拂过松梢，晨光落在石阶上。' }] };
const response = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
async function scratch(t) { const dir = await mkdtemp(join(tmpdir(), 'story-author-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir; }
function configuration(extra = {}) { return author.readConfig({}, { model: 'test-local', ...extra }); }
async function candidate(extra = {}) { return author.generateCandidate(briefs, configuration(extra), { fetchImpl: async () => response({ done: true, response: JSON.stringify(prose) }) }); }

test('canonical brief hash changes with facts and ignores object insertion order', () => {
  assert.equal(typeof author.hashBriefs, 'function');
  assert.equal(author.hashBriefs(briefs), author.hashBriefs(briefs.map(b => ({ prompt:b.prompt, facts:b.facts, title:b.title, sceneId:b.sceneId,id:b.id }))));
  assert.notEqual(author.hashBriefs(briefs), author.hashBriefs([{ ...briefs[0], facts:['天已黑。'] }]));
});

test('candidate rejects rules fields, unknown IDs, duplicate IDs, empty/long/control/code text', () => {
  assert.equal(typeof author.validatePassages, 'function');
  for (const invalid of [
    { ...prose, choices:[] }, { passages:[{...prose.passages[0], effects:{}}] },
    { passages:[{ id:'unknown', text:'山风吹来。' }] }, { passages:[...prose.passages,...prose.passages] },
    { passages:[{id:briefs[0].id,text:''}] }, { passages:[{id:briefs[0].id,text:'山'.repeat(1601)}] },
    { passages:[{id:briefs[0].id,text:'hello\u0000'}] }, { passages:[{id:briefs[0].id,text:'<script>alert(1)</script>'}] },
  ]) assert.throws(() => author.validatePassages(invalid, briefs));
  assert.deepEqual(author.validatePassages(prose, briefs), prose.passages);
});

test('strict JSON rejects duplicate keys, prototype keys, trailing text, truncation and non JSON', () => {
  assert.equal(typeof author.parseStrictJson, 'function');
  for (const text of ['{"a":1,"a":2}', '{"__proto__":{}}', '{"x":{"constructor":3}}', '{"prototype":3}', '{} extra', '{"passages":[', '```json\n{}\n```', 'null']) assert.throws(() => author.parseStrictJson(text));
  assert.deepEqual(author.parseStrictJson('{"a":["one",2,true,null]}'), {a:['one',2,true,null]});
});

test('Ollama transport requests strict schema and records real provider response', async () => {
  let request;
  const c = await author.generateCandidate(briefs, configuration(), { fetchImpl: async (url, options) => { request={url,options}; return response({done:true, response:JSON.stringify(prose)}); } });
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, 'http://127.0.0.1:11434/api/generate');
  assert.equal(body.stream,false); assert.equal(body.think,false); assert.equal(body.model,'test-local');
  assert.equal(body.format.additionalProperties,false); assert.match(body.prompt,/arrival.atmosphere/);
  assert.equal(c.generation.provider,'ollama'); assert.equal(c.generation.status,'provider-response'); assert.equal(c.generation.model,'test-local');
  assert.equal(c.briefHash,author.hashBriefs(briefs)); assert.deepEqual(c.passages,prose.passages);
});

test('OpenAI compatible transport takes env-only secret and requires complete finish', async () => {
  const config=author.readConfig({STORY_AUTHOR_API_KEY:'never-print-this'}, {provider:'openai-compatible',endpoint:'http://localhost:1234/v1/chat/completions',model:'local'});
  let auth;
  const c=await author.generateCandidate(briefs,config,{fetchImpl:async(_url,opts)=>{auth=opts.headers.Authorization;return response({choices:[{finish_reason:'stop',message:{content:JSON.stringify(prose)}}]});}});
  assert.equal(auth,'Bearer never-print-this'); assert.equal(c.generation.provider,'openai-compatible'); assert.ok(!JSON.stringify(c).includes('never-print-this'));
  await assert.rejects(author.generateCandidate(briefs,config,{fetchImpl:async()=>response({choices:[{finish_reason:'length',message:{content:JSON.stringify(prose)}}]})}));
});

test('config rejects unsupported providers, unsafe URLs, credentials and unbounded timeouts', () => {
  assert.equal(author.readConfig({}).model,'qwen3:4b');
  for (const options of [{provider:'paid-default'},{endpoint:'file:///tmp/model'},{endpoint:'http://secret@localhost/'},{timeoutMs:0},{timeoutMs:300001},{provider:'openai-compatible'}]) assert.throws(()=>author.readConfig({},options));
});

test('transport rejects unfinished, malformed, oversized, HTTP and secret-bearing failures safely', async () => {
  for(const fetchImpl of [
    async()=>response({done:false,response:JSON.stringify(prose)}), async()=>response({done:true,response:'not JSON'}),
    async()=>response({done:true,response:JSON.stringify({...prose,realm:'immortal'})}),
    async()=>new Response('x'.repeat(300000)), async()=>new Response('private server message',{status:500}),
    async()=>{throw new Error('never-print-this');},
  ]) await assert.rejects(author.generateCandidate(briefs,configuration(),{fetchImpl}), error=>!error.message.includes('never-print-this')&&!error.message.includes('private server message'));
});

test('Ollama length-limited output is rejected even when its final JSON is parseable', async () => {
  await assert.rejects(author.generateCandidate(briefs,configuration(),{fetchImpl:async()=>response({done:true,done_reason:'length',response:JSON.stringify(prose)})}),/Incomplete/);
});

test('candidate files reject invalid UTF-8 rather than replacing corrupted bytes in accepted prose',async t=>{
  const dir=await scratch(t),file=join(dir,'candidate.json');
  const bytes=Buffer.concat([Buffer.from('{"text":"'),Buffer.from([0xc3,0x28]),Buffer.from('"}')]);
  await writeFile(file,bytes);
  await assert.rejects(author.readJsonFile(file),/UTF-8/);
});

test('timeout covers fetch and a stalled response body', async () => {
  const stall = () => new Promise(()=>{});
  await assert.rejects(author.generateCandidate(briefs, configuration({timeoutMs:20}), {fetchImpl:stall}), /timeout/i);
  await assert.rejects(author.generateCandidate(briefs, configuration({timeoutMs:20}), {fetchImpl:async()=>new Response(new ReadableStream({start(){}}))}), /timeout/i);
});

test('preview exposes provenance and text while rejecting stale or modified candidates',async()=>{
  const c=await candidate(); const preview=author.previewCandidate(c,briefs);
  assert.match(preview,/test-local/); assert.match(preview,/provider-response/); assert.match(preview,/山风/);
  assert.throws(()=>author.previewCandidate(c,[{...briefs[0],prompt:'新事实'}]),/stale/i);
  assert.throws(()=>author.previewCandidate({...c,choices:[]},briefs));
  assert.throws(()=>author.previewCandidate({...c,generation:{...c.generation,status:'installed'}},briefs));
});

test('accept atomically merges validated text and never mutates rules or candidate',async t=>{
  const dir=await scratch(t), path=join(dir,'prose.js'), c=await candidate();
  await writeFile(path,'// Accepted optional prose.\nexport const ACCEPTED_PROSE = {"other.atmosphere":"旧文"};\n');
  const before=JSON.stringify(c); await author.acceptCandidate(c,briefs,path);
  assert.equal(JSON.stringify(c),before);
  const text=await readFile(path,'utf8'); assert.match(text,/export const ACCEPTED_PROSE/); assert.match(text,/旧文/); assert.match(text,/山风/);
  assert.deepEqual((await readdir(dir)),['prose.js']);
});

test('stale/invalid acceptance preserves accepted file and refuses executable existing modules',async t=>{
  const dir=await scratch(t), path=join(dir,'prose.js'), c=await candidate(), original='export const ACCEPTED_PROSE = {};\n';
  await writeFile(path,original);
  await assert.rejects(author.acceptCandidate({...c,briefHash:'0'.repeat(64)},briefs,path));
  await assert.rejects(author.acceptCandidate({...c,passages:[{...c.passages[0],effects:{}}]},briefs,path));
  assert.equal(await readFile(path,'utf8'),original);
  const hostile='globalThis.pwned = true; export const ACCEPTED_PROSE = {};'; await writeFile(path,hostile);
  await assert.rejects(author.acceptCandidate(c,briefs,path)); assert.equal(globalThis.pwned,undefined); assert.equal(await readFile(path,'utf8'),hostile);
});

test('failed generation leaves existing candidate and accepted prose untouched',async t=>{
  const dir=await scratch(t), out=join(dir,'candidate.json'), accepted=join(dir,'prose.js');
  await writeFile(out,'previous candidate'); await writeFile(accepted,'accepted');
  await assert.rejects(author.generateToFile(briefs,configuration(),out,{fetchImpl:async()=>response({done:false})}));
  assert.equal(await readFile(out,'utf8'),'previous candidate'); assert.equal(await readFile(accepted,'utf8'),'accepted');
});

test('atomic write failure preserves previous destination and removes temporary file',async t=>{
  const dir=await scratch(t), out=join(dir,'candidate.json'); await writeFile(out,'previous');
  await assert.rejects(author.atomicWrite(out,'new',{renameImpl:async()=>{throw new Error('disk unavailable');}}));
  assert.equal(await readFile(out,'utf8'),'previous'); assert.deepEqual(await readdir(dir),['candidate.json']);
});

test('real HTTP transport parses a local Ollama-compatible server',async t=>{
  const server=createServer((req,res)=>{let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{assert.equal(JSON.parse(body).stream,false);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({done:true,response:JSON.stringify(prose)}));});});
  try { await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);}); } catch(error) { if(error.code==='EPERM'||error.code==='EACCES'){t.skip('sandbox blocks localhost listen; injected fetch exercises parser separately');return;} throw error; }
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const c=await author.generateCandidate(briefs,configuration({endpoint:`http://127.0.0.1:${server.address().port}/api/generate`}));
  assert.deepEqual(c.passages,prose.passages);
});

test('single-slot generation keeps the hash of the full brief catalog',async()=>{
  const all=[...briefs,{...briefs[0],id:'river.atmosphere',sceneId:'river'}]; let sent;
  const c=await author.generateCandidate(all,configuration(),{ids:[briefs[0].id],fetchImpl:async(_url,opts)=>{sent=JSON.parse(opts.body);return response({done:true,response:JSON.stringify(prose)});}});
  assert.equal(c.briefHash,author.hashBriefs(all)); assert.ok(!sent.prompt.includes('river.atmosphere')); assert.doesNotThrow(()=>author.validateCandidate(c,all));
  await assert.rejects(author.generateCandidate(all,configuration(),{ids:['unknown'],fetchImpl:async()=>{throw new Error('must not fetch');}}),/Unknown/);
});

test('CLI brief/preview/explicit accept isolate static prose writes',async t=>{
  const {runCli}=await import('../scripts/story-author.js');
  assert.equal(typeof runCli,'function');
  const dir=await scratch(t), output=[], path=join(dir,'candidate.json'), prosePath=join(dir,'prose.js');
  const options={briefs,prosePath,stdout:text=>output.push(text)};
  await runCli(['brief'],options); assert.equal(JSON.parse(output.pop()).briefHash,author.hashBriefs(briefs));
  const c=await candidate(); await writeFile(path,JSON.stringify(c));
  await runCli(['preview',path],options); assert.match(output.pop(),/山风/);
  await assert.rejects(readFile(prosePath),{code:'ENOENT'});
  await runCli(['accept',path],options); assert.match(await readFile(prosePath,'utf8'),/山风/);
  await assert.rejects(runCli(['accept',path,'--api-key','secret'],options));
  await assert.rejects(runCli(['brief','--out',prosePath],options));
});
