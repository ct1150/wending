import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const hash = text => createHash('sha256').update(text).digest('hex');
const oldHtml = '<!doctype html><title>old playable game</title>';
const newHtml = '<!doctype html><title>new playable game 新篇</title>';
const fallback = { html:oldHtml, sourceCommit:'a'.repeat(40), version:'3.1.0', htmlSha256:hash(oldHtml) };
const manifest = { schemaVersion:1, version:'4.0.0', sourceCommit:'b'.repeat(40), artifactCommit:'c'.repeat(40), htmlSha256:hash(newHtml), htmlBytes:Buffer.byteLength(newHtml), artifactPath:`releases/${hash(newHtml)}.html` };
const moduleReady = () => import('../src/worker/release-gateway.js');
const request = (worker,path='/') => worker.fetch(new Request('https://example.workers.dev'+path));

test('Workers-compatible manual redirect mode fetches releases and rejects redirects without following them', async () => {
  const {createReleaseGateway}=await moduleReady();let time=100000,redirectAt=null;const calls=[];
  const worker=createReleaseGateway({fallback,now:()=>time,fetchImpl:async (url,options)=>{
    calls.push({url,redirect:options.redirect});
    if(options.redirect==='error')throw new TypeError('Workers does not implement redirect:error');
    assert.equal(options.redirect,'manual');
    if(redirectAt && url.endsWith(redirectAt))return new Response(null,{status:302,headers:{Location:'https://untrusted.invalid/redirect'}});
    return new Response(url.endsWith('manifest.json')?JSON.stringify(manifest):newHtml);
  }});
  assert.equal(await(await request(worker)).text(),newHtml,'supported runtime options must activate a valid release');
  redirectAt='manifest.json';time+=60001;
  assert.equal(await(await request(worker)).text(),newHtml);
  assert.equal((await(await request(worker,'/healthz')).json()).lastError,'Release source returned an HTTP error');
  assert.equal(calls.length,3);assert.ok(calls.every(call=>call.url.startsWith('https://raw.githubusercontent.com/ct1150/wending/')));
  const coldCalls=[];
  const cold=createReleaseGateway({fallback,fetchImpl:async(url,options)=>{
    coldCalls.push(url);assert.equal(options.redirect,'manual');
    return url.endsWith('manifest.json')?new Response(JSON.stringify(manifest)):new Response(null,{status:307,headers:{Location:'https://untrusted.invalid/artifact'}});
  }});
  assert.equal(await(await request(cold)).text(),oldHtml,'redirected artifacts preserve the embedded playable baseline');
  assert.equal(coldCalls.length,2);assert.equal((await(await request(cold,'/healthz')).json()).sourceCommit,fallback.sourceCommit);
});

test('verified release activation changes HTML and health together and polls only after the interval', async () => {
  const {createReleaseGateway}=await moduleReady(); let time=100000, calls=0;
  const worker=createReleaseGateway({fallback,now:()=>time,fetchImpl:async url=>{calls++;return new Response(url.endsWith('manifest.json')?JSON.stringify(manifest):newHtml);}});
  assert.equal(await(await request(worker)).text(),newHtml);
  const health=await(await request(worker,'/healthz')).json();
  assert.equal(health.sourceCommit,manifest.sourceCommit);assert.equal(health.htmlSha256,hash(newHtml));assert.equal(health.version,'4.0.0');assert.equal(calls,2);
  time+=60001;await request(worker);assert.equal(calls,3,'unchanged verified hash needs only manifest check');
});

test('embedded-only gateway keeps reviewed HTML and health despite a valid stale cache and remote release', async () => {
  const {createReleaseGateway}=await moduleReady();let time=100000;
  const calls={match:0,put:0,fetch:0};
  const reviewedHtml='<!doctype html><title>reviewed live candidate 实时人生</title>';
  const reviewed={html:reviewedHtml,sourceCommit:'d'.repeat(40),version:'4.0.0',htmlSha256:hash(reviewedHtml)};
  const cache={
    async match(){calls.match++;return new Response(newHtml,{headers:{'X-Wending-Release':JSON.stringify(manifest)}});},
    async put(){calls.put++;},
  };
  const worker=createReleaseGateway({fallback:reviewed,embeddedOnly:true,cache,now:()=>time,fetchImpl:async url=>{calls.fetch++;return new Response(url.endsWith('manifest.json')?JSON.stringify(manifest):newHtml);}});
  for(const path of ['/','/index.html'])assert.equal(await(await request(worker,path)).text(),reviewedHtml);
  time+=60001;
  const health=await(await request(worker,'/healthz')).json();
  assert.equal(health.sourceCommit,reviewed.sourceCommit);assert.equal(health.htmlSha256,reviewed.htmlSha256);assert.equal(health.htmlBytes,Buffer.byteLength(reviewedHtml));assert.equal(health.version,reviewed.version);
  assert.equal(health.releaseSource,'embedded');assert.equal(health.lastAttemptAt,null);assert.equal(health.lastSuccessAt,null);assert.equal(health.lastError,'');
  assert.equal((await worker.fetch(new Request('https://example.workers.dev/',{method:'HEAD'}))).body,null);
  assert.deepEqual(calls,{match:0,put:0,fetch:0},'pinned acceptance must not consult or rewrite the public release channel');
});

test('bad new content or network failure preserves the verified playable snapshot and truthful health', async () => {
  const {createReleaseGateway}=await moduleReady();let time=100000, mode='good';
  const worker=createReleaseGateway({fallback,now:()=>time,fetchImpl:async url=>{
    if(mode==='offline')throw new Error('upstream unavailable');
    if(url.endsWith('manifest.json'))return new Response(JSON.stringify(mode==='good'?manifest:{...manifest,htmlSha256:'d'.repeat(64),artifactPath:`releases/${'d'.repeat(64)}.html`}));
    return new Response(newHtml);
  }});
  assert.equal(await(await request(worker)).text(),newHtml);
  mode='corrupt';time+=60001;assert.equal(await(await request(worker)).text(),newHtml);
  let health=await(await request(worker,'/healthz')).json();assert.equal(health.sourceCommit,manifest.sourceCommit);assert.match(health.lastError,/digest|SHA|hash/i);
  mode='offline';time+=60001;assert.equal(await(await request(worker)).text(),newHtml);
  health=await(await request(worker,'/healthz')).json();assert.equal(health.htmlSha256,hash(newHtml));assert.ok(health.lastError);
});

test('untrusted paths and oversized releases are rejected without following arbitrary URLs', async () => {
  const {createReleaseGateway}=await moduleReady();let calls=0;
  for(const bad of [{...manifest,artifactPath:'https://attacker.invalid/steal'}, {...manifest,htmlBytes:4000000},{...manifest,sourceCommit:'main'}]){
    const worker=createReleaseGateway({fallback,fetchImpl:async ()=>{calls++;return new Response(JSON.stringify(bad));}});
    assert.equal(await(await request(worker)).text(),oldHtml);
  }
  assert.equal(calls,3,'invalid metadata never triggers an artifact request');
});

test('unavailable release source preserves the embedded web bundle and bounded routes', async () => {
  const {createReleaseGateway}=await moduleReady();let calls=0;
  const worker=createReleaseGateway({fallback,icon:'<svg/>',fetchImpl:async()=>{calls++;throw new Error('offline');}});
  assert.equal(await(await request(worker)).text(),oldHtml);
  assert.equal((await(await request(worker,'/healthz')).json()).sourceCommit,fallback.sourceCommit);
  assert.equal((await worker.fetch(new Request('https://example.workers.dev/',{method:'HEAD'}))).body,null);
  assert.equal((await worker.fetch(new Request('https://example.workers.dev/',{method:'POST'}))).status,405);
  assert.equal((await request(worker,'/unknown')).status,404);assert.equal(calls,1);
});

test('retired offline download returns 410 without serving HTML or refreshing the release', async () => {
  const {createReleaseGateway}=await moduleReady();
  for(const embeddedOnly of [false,true]){
    const calls={fetch:0,match:0,put:0};
    const worker=createReleaseGateway({fallback,embeddedOnly,cache:{async match(){calls.match++;},async put(){calls.put++;}},fetchImpl:async()=>{calls.fetch++;throw new Error('must not fetch');}});
    for(const suffix of ['', '?download=1']){
      const url='https://example.workers.dev/baishi-wending-offline.html'+suffix;
      const response=await worker.fetch(new Request(url));
      assert.equal(response.status,410);assert.match(response.headers.get('Content-Type'),/^text\/plain/);
      assert.equal(response.headers.get('Content-Disposition'),null);assert.doesNotMatch(await response.text(),/<!doctype|<script/i);
      const head=await worker.fetch(new Request(url,{method:'HEAD'}));assert.equal(head.status,410);assert.equal(head.body,null);
    }
    assert.equal((await worker.fetch(new Request('https://example.workers.dev/baishi-wending-offline.html',{method:'POST'}))).status,405);
    assert.deepEqual(calls,{fetch:0,match:0,put:0});
  }
});

test('concurrent requests share one refresh and cached data is adopted only after verification', async () => {
  const {createReleaseGateway}=await moduleReady();let calls=0;const storage=new Map();
  const cache={async match(key){return storage.get(key)?.clone();},async put(key,value){storage.set(key,value.clone());}};
  const worker=createReleaseGateway({fallback,cache,fetchImpl:async url=>{calls++;await new Promise(r=>setTimeout(r,5));return new Response(url.endsWith('manifest.json')?JSON.stringify(manifest):newHtml);}});
  const responses=await Promise.all([request(worker),request(worker),request(worker)]);assert.equal(calls,2);for(const response of responses)assert.equal(await response.text(),newHtml);
  const cold=createReleaseGateway({fallback,cache,fetchImpl:async()=>{throw new Error('offline');}});
  assert.equal(await(await request(cold)).text(),newHtml);
  assert.equal((await(await request(cold,'/healthz')).json()).htmlSha256,hash(newHtml));
});

test('verified UTF-8 BOM bytes survive remote activation and cold cache recovery unchanged', async () => {
  const {createReleaseGateway}=await moduleReady();
  const html='\uFEFF'+newHtml,bytes=Buffer.from(html),digest=hash(html);
  const metadata={...manifest,htmlSha256:digest,htmlBytes:bytes.byteLength,artifactPath:`releases/${digest}.html`};
  let saved;
  const cache={async match(){return saved?.clone();},async put(key,response){saved=response.clone();}};
  const online=createReleaseGateway({fallback,cache,fetchImpl:async url=>new Response(url.endsWith('manifest.json')?JSON.stringify(metadata):bytes)});
  const served=Buffer.from(await(await request(online)).arrayBuffer());assert.deepEqual(served,bytes);
  const cold=createReleaseGateway({fallback,cache,fetchImpl:async()=>{throw new Error('offline');}});
  const restored=Buffer.from(await(await request(cold)).arrayBuffer());assert.deepEqual(restored,bytes);
  const health=await(await request(cold,'/healthz')).json();assert.equal(health.htmlBytes,restored.byteLength);assert.equal(health.htmlSha256,hash(restored));
});

test('stalled best-effort cache reads and writes cannot block a verified playable response', async () => {
  const {createReleaseGateway}=await moduleReady();
  for(const operation of ['match','put']){
    const cache={async match(){return undefined;},async put(){}};
    cache[operation]=()=>new Promise(()=>{});
    const worker=createReleaseGateway({fallback,cache,timeoutMs:5,fetchImpl:async url=>new Response(url.endsWith('manifest.json')?JSON.stringify(manifest):newHtml)});
    const result=await Promise.race([request(worker),new Promise(resolve=>setTimeout(()=>resolve(null),100))]);
    assert.ok(result,`${operation} must not block serving`);assert.equal(await result.text(),newHtml);
    assert.equal((await(await request(worker,'/healthz')).json()).sourceCommit,manifest.sourceCommit);
  }
});
