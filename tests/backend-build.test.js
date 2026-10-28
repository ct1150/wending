import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,cp,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildGateway} from '../scripts/build-gateway.js';
import {createStoryClient} from '../src/ui/story-client.js';
const repository=fileURLToPath(new URL('../',import.meta.url));
const hash=text=>createHash('sha256').update(text).digest('hex');
async function fixture(t){
  const root=await mkdtemp(path.join(tmpdir(),'wending-backend-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await cp(path.join(repository,'src'),path.join(root,'src'),{recursive:true});
  for(const dir of ['release','assets','config'])await mkdir(path.join(root,dir),{recursive:true});
  await writeFile(path.join(root,'release/baishi-wending-offline.html'),'<!doctype html><title>旧版回退·问鼎</title>');
  await writeFile(path.join(root,'assets/seal.svg'),'<svg/>');
  await writeFile(path.join(root,'package.json'),'{"version":"4.0.0","type":"module"}');
  await writeFile(path.join(root,'config/story-deployment.json'),JSON.stringify({enabled:false,protocolVersion:1,rulesVersion:1,promptVersion:1,saveVersion:5,contentVersion:4}));
  return root;
}
test('backend package includes deterministic complete ESM graph, named DO export, disabled identity and exact static fallback',async t=>{
  const root=await fixture(t),sourceCommit='a'.repeat(40);
  const result=await buildGateway({root,sourceCommit});
  assert.ok(result.backend,'backend package is missing');
  const manifest=JSON.parse(await readFile(path.join(root,'release/backend/deployment.json'),'utf8'));
  assert.equal(manifest.main_module,'entry.mjs');assert.equal(manifest.sourceCommit,sourceCommit);
  assert.deepEqual(manifest.versions,{protocolVersion:1,rulesVersion:1,promptVersion:1,saveVersion:5,contentVersion:4});
  assert.equal(manifest.enabled,false);
  assert.ok(manifest.modules.some(m=>m.name==='src/worker/story-budget.js'));
  assert.ok(manifest.modules.some(m=>m.name==='src/game/cultivation/live/identity.js'));
  assert.equal(manifest.modules.some(m=>m.name.startsWith('src/ui/')),false);
  for(const module of manifest.modules)assert.equal(hash(await readFile(path.join(root,'release/backend',module.name))),module.sha256);
  const previous=await readFile(path.join(root,'release/backend/deployment.json'),'utf8');
  await writeFile(path.join(root,'release/backend/stale.js'),'throw new Error("must be removed")');
  await buildGateway({root,sourceCommit});assert.equal(await readFile(path.join(root,'release/backend/deployment.json'),'utf8'),previous);
  assert.equal((await readdir(path.join(root,'release/backend'))).includes('stale.js'),false);
  const original=globalThis.fetch;let outbound=0;
  globalThis.fetch=async()=>{outbound++;return new Response(null,{status:503});};
  let worker;try{worker=await import(pathToFileURL(path.join(root,'release/backend/entry.mjs')).href);}finally{globalThis.fetch=original;}
  assert.equal(outbound,0);assert.equal(typeof worker.StoryBudget,'function');
  const response=await worker.default.fetch(new Request('https://game.test/'));
  assert.equal(await response.text(),await readFile(path.join(root,'release/baishi-wending-offline.html'),'utf8'));
  assert.equal(outbound,1);
  const capabilities=await (await worker.default.fetch(new Request('https://game.test/api/story/capabilities'),{})).json();
  assert.equal(capabilities.available,false);assert.equal(capabilities.errorCode,'INFERENCE_DISABLED');
  const missingBudget=await (await worker.default.fetch(new Request('https://game.test/api/story/session',{method:'POST',headers:{origin:'https://game.test','content-type':'application/json'},body:'{\"protocolVersion\":1}'}),{})).json();
  assert.equal(missingBudget.errorCode,'BUDGET_UNAVAILABLE');
});
test('backend build fails closed for unsupported versions, enabled policy, missing modules and escaping imports',async t=>{
  const root=await fixture(t),sourceCommit='b'.repeat(40),config=path.join(root,'config/story-deployment.json');
  const baseline=JSON.parse(await readFile(config,'utf8'));
  for(const change of [{protocolVersion:2},{rulesVersion:2},{promptVersion:2},{enabled:true},{freeBoundaryProof:{plan:'workers-free'}}]){
    await writeFile(config,JSON.stringify({...baseline,...change}));
    await assert.rejects(buildGateway({root,sourceCommit}),/deployment policy/i);
  }
  await writeFile(config,JSON.stringify(baseline));
  await writeFile(path.join(root,'src/worker/index.js'),"import {missing} from './absent.js';\n");
  await assert.rejects(buildGateway({root,sourceCommit}),/ENOENT|missing/i);
  await writeFile(path.join(root,'src/worker/index.js'),"import {bad} from '../../../secret.js';\n");
  await assert.rejects(buildGateway({root,sourceCommit}),/outside|escape/i);
  await rm(path.join(root,'src/worker/index.js'));
  await assert.rejects(buildGateway({root,sourceCommit}),/entry|ENOENT/i);
});
test('browser negotiates static rollback, incompatible protocol and disabled backend as unavailable',async t=>{
  const root=await fixture(t);await buildGateway({root,sourceCommit:'c'.repeat(40)});
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response(null,{status:503});
  let staticWorker,backend;try{
    staticWorker=(await import(pathToFileURL(path.join(root,'release/gateway.mjs')).href)).default;
    backend=(await import(pathToFileURL(path.join(root,'release/backend/entry.mjs')).href)).default;
  }finally{globalThis.fetch=original;}
  for(const worker of [backend,staticWorker,{fetch:async()=>new Response('<html>rollback</html>',{headers:{'content-type':'text/html'}})},{fetch:async()=>Response.json({protocolVersion:2,available:true,status:'ready'})}]){
    const client=createStoryClient({location:{protocol:'https:'},fetch:(url,init)=>worker.fetch(new Request('https://game.test'+url,init))});
    const status=await client.capabilities();assert.equal(status.available,false);assert.equal(status.status,'paused');
  }
});

test('ESM declarations traverse complete dependencies across newlines, comments and inline placement',async t=>{
  const declarations=[
    "export { extra }\nfrom './extra.js';",
    "export /* export comment */ { extra } /* source comment */ from /* path comment */ './extra.js';",
    "const prefix=1; export { extra } from './extra.js';",
    "export *\n/* star comment */ from './extra.js';",
    "import { extra }\nfrom './extra.js'; export {extra};",
    "const prefix=1; import /* import comment */ {extra} /* source comment */ from './extra.js'; export {extra};",
    "import extra from './extra.js'; export {extra};",
    "import * as namespace from './extra.js'; export const extra=namespace.extra;",
    "import './extra.js'; export const extra=42;",
    "export { extra } from '.\\/extra.js';",
  ];
  for(const declaration of declarations)await t.test(declaration,async t=>{
    const root=await fixture(t),entry=path.join(root,'src/worker/index.js');
    await writeFile(entry,declaration+'\n'+await readFile(entry,'utf8'));
    await writeFile(path.join(root,'src/worker/extra.js'),'export const extra=42; export default extra;');
    await buildGateway({root,sourceCommit:'e'.repeat(40)});
    const manifest=JSON.parse(await readFile(path.join(root,'release/backend/deployment.json'),'utf8'));
    assert.ok(manifest.modules.some(module=>module.name==='src/worker/extra.js'),'every static dependency must be uploaded');
    const packaged=await import(pathToFileURL(path.join(root,'release/backend/src/worker/index.js')).href);
    assert.equal(packaged.extra,42);
    const worker=await import(pathToFileURL(path.join(root,'release/backend/entry.mjs')).href);
    assert.equal(typeof worker.default.fetch,'function');assert.equal(typeof worker.StoryBudget,'function');
  });
});

test('dependency parser rejects dynamic imports in any expression and ignores literal/comment prose',async t=>{
  const root=await fixture(t),entry=path.join(root,'src/worker/index.js'),original=await readFile(entry,'utf8');
  for(const declaration of [
    "const later=()=>import /* comment */ ('./extra.js');",
    "const later=()=>import\n('./extra.js');",
    "const later=()=>`${import /* comment */ ('./extra.js')}`;",
    "const ownUrl=import /* comment */ .meta.url;",
    "export {extra} from './extra.js' with {type:'json'};",
    "export {extra from './extra.js';",
  ]){
    await writeFile(entry,declaration+'\n'+original);
    await assert.rejects(buildGateway({root,sourceCommit:'f'.repeat(40)}),/unsupported|dynamic|import.meta/i);
  }
  await writeFile(entry,"const prose=\"import('./not-a-module.js')\"; const pattern=/export.*from/;\n/* export {fake} from './not-a-module.js'; */\n"+original);
  await buildGateway({root,sourceCommit:'f'.repeat(40)});
  const worker=await import(pathToFileURL(path.join(root,'release/backend/entry.mjs')).href);
  assert.equal(typeof worker.default.fetch,'function');
});

function testerPolicy(){
  const accountId='fixture-account';
  return {enabled:true,mode:'tester-only',modelId:'@cf/qwen/qwen3-30b-a3b-fp8',testerPermitSha256:hash('aa'.repeat(32)),bindingAccountId:accountId,currentPlan:{accountId,source:'operator-account-verification',plan:'workers-free'},freeBoundaryProof:{accountId,source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:10000,checkedAt:new Date().toISOString()}};
}

test('explicit tester-only package preserves disabled public policy and declares existing shared namespaces',async t=>{
  const root=await fixture(t),acceptance=testerPolicy();
  await buildGateway({root,sourceCommit:'1'.repeat(40),acceptance});
  const manifest=JSON.parse(await readFile(path.join(root,'release/backend/deployment.json'),'utf8'));
  assert.equal(manifest.accessMode,'tester-only');assert.equal(manifest.enabled,true);assert.equal(manifest.publicEnabled,false);assert.equal(manifest.modelValidated,false);
  const worker=await import(pathToFileURL(path.join(root,'release/backend/entry.mjs')).href);
  assert.equal(worker.backendIdentity.accessMode,'tester-only');assert.equal(worker.backendIdentity.enabled,true);assert.equal(worker.backendIdentity.publicEnabled,false);assert.equal(worker.backendIdentity.modelValidated,false);
  const response=await worker.default.fetch(new Request('https://game.test/api/story/capabilities'));
  assert.equal((await response.json()).errorCode,'TESTER_PERMIT_REQUIRED');
  assert.equal(manifest.bindings.find(row=>row.name==='STORY_BUDGET').namespace_id,'1de1df3929534a8d8d495d6db6604e99');
  assert.equal(manifest.bindings.find(row=>row.name==='STORY_EXPERIMENT').namespace_id,'dfb218f2f29d4ecab2395f8a00b48350');
  assert.equal(manifest.experimentCoordinatorName,'wending-realtime-acceptance-v1');assert.deepEqual(manifest.migrations,[]);assert.deepEqual(manifest.requiredSecrets,['STORY_OPERATOR_TOKEN']);
  assert.ok(manifest.modules.some(row=>row.name==='src/worker/story-stage.js'));assert.equal(manifest.modules.some(row=>row.name.startsWith('src/worker/operator-')),false);
  assert.equal(JSON.parse(await readFile(path.join(root,'config/story-deployment.json'),'utf8')).enabled,false);
  assert.equal((await readFile(path.join(root,'release/gateway.mjs'),'utf8')).includes(acceptance.testerPermitSha256),false);
  for(const module of manifest.modules)assert.equal(hash(await readFile(path.join(root,'release/backend',module.name))),module.sha256);
});

test('tester-only package serves its reviewed HTML while the separate ordinary gateway still updates',async t=>{
  const root=await fixture(t),sourceCommit='3'.repeat(40),candidate='<!doctype html><title>reviewed live candidate 实时人生</title>';
  await writeFile(path.join(root,'release/baishi-wending-offline.html'),candidate);
  await buildGateway({root,sourceCommit,acceptance:testerPolicy()});
  const packageManifest=JSON.parse(await readFile(path.join(root,'release/backend/deployment.json'),'utf8'));
  const staleHtml='<!doctype html><title>previous public 4.0 game</title>',staleHash=hash(staleHtml);
  const staleManifest={schemaVersion:1,version:'4.0.0',sourceCommit:'4'.repeat(40),artifactCommit:'5'.repeat(40),htmlSha256:staleHash,htmlBytes:Buffer.byteLength(staleHtml),artifactPath:`releases/${staleHash}.html`};
  const originalFetch=globalThis.fetch,originalCaches=Object.getOwnPropertyDescriptor(globalThis,'caches'),calls={match:0,put:0,fetch:0};
  globalThis.fetch=async url=>{calls.fetch++;return new Response(url.endsWith('manifest.json')?JSON.stringify(staleManifest):staleHtml);};
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{
    async match(){calls.match++;return new Response(staleHtml,{headers:{'X-Wending-Release':JSON.stringify(staleManifest)}});},
    async put(){calls.put++;},
  }}});
  try {
    const stage=await import(pathToFileURL(path.join(root,'release/backend/entry.mjs')).href);
    const response=await stage.default.fetch(new Request('https://game.test/'));
    assert.equal(await response.text(),candidate);
    const health=await(await stage.default.fetch(new Request('https://game.test/healthz'))).json();
    assert.equal(health.sourceCommit,stage.backendIdentity.sourceCommit);assert.equal(health.sourceCommit,sourceCommit);
    assert.equal(health.htmlSha256,packageManifest.frontend.htmlSha256);assert.equal(health.htmlSha256,hash(candidate));assert.equal(health.releaseSource,'embedded');
    assert.equal(await(await stage.default.fetch(new Request('https://game.test/baishi-wending-offline.html'))).text(),candidate);
    assert.deepEqual(calls,{match:0,put:0,fetch:0});
    const ordinary=await import(pathToFileURL(path.join(root,'release/gateway.mjs')).href);
    assert.equal(await(await ordinary.default.fetch(new Request('https://game.test/'))).text(),staleHtml);
    const ordinaryHealth=await(await ordinary.default.fetch(new Request('https://game.test/healthz'))).json();
    assert.equal(ordinaryHealth.sourceCommit,staleManifest.sourceCommit);assert.equal(ordinaryHealth.htmlSha256,staleHash);assert.equal(ordinaryHealth.releaseSource,'remote-fetch');
    assert.deepEqual(calls,{match:1,put:1,fetch:1});
  } finally {
    globalThis.fetch=originalFetch;
    if(originalCaches)Object.defineProperty(globalThis,'caches',originalCaches);else delete globalThis.caches;
  }
});

test('tester package rejects unsupported modes, unbounded credentials, mismatched accounts and public policy activation',async t=>{
  const root=await fixture(t),sourceCommit='2'.repeat(40),baseline=testerPolicy();
  for(const change of [{enabled:false},{mode:'public'},{modelId:'another/model'},{testerPermitSha256:'bad'},{operatorToken:'must-not-be-packaged'},{bindingAccountId:'other-account'}]){
    await assert.rejects(buildGateway({root,sourceCommit,acceptance:{...baseline,...change}}),/STORY_STAGE_CONFIGURATION_INVALID/);
  }
  const file=path.join(root,'config/story-deployment.json'),policy=JSON.parse(await readFile(file,'utf8'));await writeFile(file,JSON.stringify({...policy,enabled:true}));
  await assert.rejects(buildGateway({root,sourceCommit,acceptance:baseline}),/deployment policy/i);
});
