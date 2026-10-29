import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Miniflare} from 'miniflare';
import {buildGateway} from '../scripts/build-gateway.js';
const repository=fileURLToPath(new URL('../',import.meta.url));

test('packaged backend executes in local workerd: blocked outbound, static fallback, disabled API and persistent SQLite replay',{timeout:30000},async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'wending-workerd-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await cp(path.join(repository,'src'),path.join(root,'src'),{recursive:true});
  await cp(path.join(repository,'config'),path.join(root,'config'),{recursive:true});
  for(const dir of ['release','assets'])await mkdir(path.join(root,dir),{recursive:true});
  const html='<!doctype html>\r\n<title>workerd 本地回退</title>';
  await writeFile(path.join(root,'release/baishi-wending-offline.html'),html);
  await writeFile(path.join(root,'assets/seal.svg'),'<svg/>');await writeFile(path.join(root,'package.json'),'{"version":"4.0.0"}');
  await buildGateway({root,sourceCommit:'d'.repeat(40)});
  const output=path.join(root,'release/backend'),manifest=JSON.parse(await readFile(path.join(output,'deployment.json'),'utf8'));
  const outgoing=[];
  const options={name:'wending-local-verification',compatibilityDate:manifest.compatibility_date,modulesRoot:output,modules:manifest.modules.map(module=>({type:'ESModule',path:path.join(output,module.name)})),durableObjects:{STORY_BUDGET:{className:'StoryBudget',useSQLite:true}},durableObjectsPersist:path.join(root,'sqlite'),outboundService:request=>{outgoing.push({url:request.url});return new Response(null,{status:302,headers:{location:'https://forbidden-egress.invalid/redirect'}});}};
  let mf=new Miniflare(options);t.after(()=>mf.dispose());
  const home=await mf.dispatchFetch('https://game.test/');assert.equal(home.status,200);assert.equal(await home.text(),html);
  assert.equal(outgoing.length,1);assert.match(outgoing[0].url,/^https:\/\/raw\.githubusercontent\.com\/ct1150\/wending\/release-channel\//);
  const download=await mf.dispatchFetch('https://game.test/baishi-wending-offline.html');assert.equal(await download.text(),html);
  const health=await (await mf.dispatchFetch('https://game.test/healthz')).json();assert.equal(health.htmlSha256,manifest.frontend.htmlSha256);assert.equal(health.releaseSource,'embedded');
  const capabilities=await (await mf.dispatchFetch('https://game.test/api/story/capabilities')).json();assert.equal(capabilities.available,false);assert.equal(capabilities.errorCode,'INFERENCE_DISABLED');
  const session=await (await mf.dispatchFetch('https://game.test/api/story/session',{method:'POST',headers:{origin:'https://game.test','content-type':'application/json'},body:'{"protocolVersion":1}'})).json();assert.equal(session.errorCode,'INFERENCE_DISABLED');
  assert.equal((await mf.dispatchFetch('https://game.test/api/story/unknown')).status,404);
  // Direct namespace access belongs to this local test harness only. The public
  // shipping API cannot allocate sessions/inference while disabled.
  const stubFor=async instance=>{const ns=await instance.getDurableObjectNamespace('STORY_BUDGET');return ns.get(ns.idFromName(manifest.coordinatorName));};
  const call=async(stub,method,body)=>{const response=await stub.fetch('https://story-budget.internal/'+method,{method:'POST',body:JSON.stringify(body)});assert.equal(response.status,200);return response.json();};
  let stub=await stubFor(mf);
  const identity={sessionRef:'local_session',tokenHash:'local_token_hash',ipHash:'local_ip'};
  assert.equal((await call(stub,'createSession',identity)).kind,'session');
  const reservation={...identity,attemptId:'local_attempt',requestId:'local_request',payloadHash:'payload',contextHash:'context',reservedNeurons:111,retryOf:null};
  assert.equal((await call(stub,'reserve',reservation)).kind,'reserved');
  const result={status:'paused',errorCode:'PROVIDER_TIMEOUT'};
  assert.equal((await call(stub,'settle',{...identity,attemptId:reservation.attemptId,status:'unknown',result})).kind,'settled');
  assert.equal((await call(stub,'acquireProvider',{owner:'first-player'})).kind,'acquired');
  assert.equal((await call(stub,'acquireProvider',{owner:'second-player'})).kind,'waiting');
  await mf.dispose();mf=new Miniflare(options);stub=await stubFor(mf);
  assert.equal((await call(stub,'acquireProvider',{owner:'second-player'})).kind,'waiting','native SQLite provider lease survives restart');
  assert.equal((await call(stub,'releaseProvider',{owner:'wrong-owner',outcome:'complete'})).kind,'denied');
  assert.equal((await call(stub,'releaseProvider',{owner:'first-player',outcome:'complete'})).kind,'released');
  assert.equal((await call(stub,'acquireProvider',{owner:'second-player'})).kind,'waiting','completion retains the spacing window');
  assert.equal((await call(stub,'getSession',identity)).kind,'session');
  assert.deepEqual(await call(stub,'reserve',reservation),{kind:'replay',result});
  const next={...reservation,attemptId:'next_attempt',requestId:'next_request',reservedNeurons:10000};
  assert.equal((await call(stub,'reserve',next)).kind,'reserved','historical reservations do not impose an artificial lifetime or daily ceiling');
  assert.equal((await call(stub,'settle',{...identity,attemptId:next.attemptId,status:'complete',quotaExhausted:true,result:{status:'paused',errorCode:'FREE_QUOTA_EXHAUSTED'}})).kind,'settled');
  const quota=await call(stub,'reserve',{...reservation,attemptId:'quota_attempt',requestId:'quota_request'});assert.equal(quota.code,'FREE_QUOTA_EXHAUSTED');
  assert.deepEqual(await call(stub,'reserve',reservation),{kind:'replay',result},'the original unknown reservation and response survive the observed quota error');
  assert.equal(outgoing.length,1,'only captured static release fetch; no AI or other egress');
});

test('controlled deployment declares native SQLite migration and local pinned runtime without automatic cloud deployment',async()=>{
  const config=JSON.parse(await readFile(path.join(repository,'wrangler.story.json'),'utf8'));
  assert.equal(config.main,'release/backend/entry.mjs');assert.equal(config.compatibility_date,'2026-07-30');
  assert.deepEqual(config.ai,{binding:'AI'});assert.deepEqual(config.durable_objects.bindings,[{name:'STORY_BUDGET',class_name:'StoryBudget'}]);
  assert.deepEqual(config.migrations,[{tag:'story-budget-v1',new_sqlite_classes:['StoryBudget']}]);
  const pkg=JSON.parse(await readFile(path.join(repository,'package.json'),'utf8'));assert.equal(pkg.devDependencies.miniflare,'4.20260730.0');assert.equal(pkg.dependencies?.miniflare,undefined);
});
