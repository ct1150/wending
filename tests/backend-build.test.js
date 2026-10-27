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
