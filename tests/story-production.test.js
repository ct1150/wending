import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,cp,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Miniflare} from 'miniflare';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {CANDIDATE_MODEL_ID,PRODUCTION_PROFILES} from '../src/worker/story-config.js';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const productionModule=await import('../src/worker/story-production.js').catch(()=>null);
const repository=fileURLToPath(new URL('../',import.meta.url));
const versions={protocolVersion:1,rulesVersion:1,promptVersion:1,saveVersion:5,contentVersion:4};
const modelId=CANDIDATE_MODEL_ID;
function policy(){
  const accountId='isolated-production-fixture';
  return {enabled:true,mode:'production',modelId,...versions,bindingAccountId:accountId,currentPlan:{accountId,source:'operator-account-verification',plan:'workers-free'},freeBoundaryProof:{accountId,source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:0,checkedAt:new Date(Date.now()-86400000).toISOString()}};
}
async function fixture(t){
  assert.ok(productionModule,'the explicit production policy module is required');
  const root=await mkdtemp(path.join(tmpdir(),'wending-production-fixture-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await cp(path.join(repository,'src'),path.join(root,'src'),{recursive:true});
  for(const dir of ['scripts','release','assets','config'])await mkdir(path.join(root,dir),{recursive:true});
  await writeFile(path.join(root,'package.json'),'{"type":"module","version":"4.0.0"}');
  await writeFile(path.join(root,'assets/seal.svg'),'<svg/>');
  await writeFile(path.join(root,'release/baishi-wending-offline.html'),'<!doctype html><title>isolated production fixture</title>');
  await writeFile(path.join(root,'config/story-deployment.json'),JSON.stringify({enabled:true,...versions}));
  // Only this disposable source tree has a synthetic validated profile. Neither
  // a build argument nor the real registry grants candidate validation.
  const profileFile=path.join(root,'src/worker/story-config.js'),source=await readFile(profileFile,'utf8');
  assert.ok(source.includes('export const PRODUCTION_PROFILES = Object.freeze([]);'));
  await writeFile(profileFile,source.replace('export const PRODUCTION_PROFILES = Object.freeze([]);','export const PRODUCTION_PROFILES = Object.freeze([Object.freeze({...CANDIDATE_PROFILE,validated:true,supportsStructuredOutput:true})]);'));
  await cp(path.join(repository,'scripts/build-gateway.js'),path.join(root,'scripts/build-gateway.js'));
  await symlink(path.join(repository,'node_modules'),path.join(root,'node_modules'),'dir');
  return {root,module:await import(pathToFileURL(path.join(root,'src/worker/story-production.js')).href),build: (await import(pathToFileURL(path.join(root,'scripts/build-gateway.js')).href)).buildGateway};
}

test('real production registry remains closed and a supplied candidate cannot grant validation',()=>{
  assert.ok(productionModule,'the explicit production policy module is required');
  assert.deepEqual(PRODUCTION_PROFILES,[]);
  assert.throws(()=>productionModule.validateStoryProductionPolicy(policy()),{code:'MODEL_UNVALIDATED'});
  assert.throws(()=>productionModule.validateStoryProductionPolicy({...policy(),profile:{modelId,validated:true,supportsStructuredOutput:true}}),{code:'STORY_PRODUCTION_CONFIGURATION_INVALID'});
});

test('production policy binds exact versions, current Free plan and original account proof without renewing probe balance',async t=>{
  const f=await fixture(t),baseline=policy(),validated=f.module.validateStoryProductionPolicy(baseline);
  assert.deepEqual(validated,baseline);assert.notEqual(validated,baseline);
  assert.equal(validated.freeBoundaryProof.checkedAt,baseline.freeBoundaryProof.checkedAt);
  assert.equal(validated.freeBoundaryProof.remainingNeurons,0,'production does not treat an old balance snapshot as a new probe allocation');
  const invalidConfig=[{enabled:false},{mode:'tester-only'},{mode:'disabled'},{testerPermitSha256:'a'.repeat(64)},{experiment:{}},{provider:'fixture'},...Object.keys(versions).map(key=>({[key]:versions[key]+1})),{currentPlan:{...baseline.currentPlan,extra:true}},{freeBoundaryProof:{...baseline.freeBoundaryProof,extra:true}}];
  for(const change of invalidConfig)assert.throws(()=>f.module.validateStoryProductionPolicy({...baseline,...change}),{code:'STORY_PRODUCTION_CONFIGURATION_INVALID'});
  for(const change of [{bindingAccountId:'another-account'},{currentPlan:{...baseline.currentPlan,accountId:'another-account'}},{currentPlan:{...baseline.currentPlan,plan:'workers-paid'}},{freeBoundaryProof:{...baseline.freeBoundaryProof,accountId:'another-account'}},{freeBoundaryProof:{...baseline.freeBoundaryProof,directBinding:false}},{freeBoundaryProof:{...baseline.freeBoundaryProof,checkedAt:new Date(Date.now()+3600000).toISOString()}}])assert.throws(()=>f.module.validateStoryProductionPolicy({...baseline,...change}),{code:'FREE_BOUNDARY_UNVERIFIED'});
  assert.throws(()=>f.module.validateStoryProductionPolicy({...baseline,modelId:'unreviewed/model'}),{code:'MODEL_NOT_ALLOWED'});
});

test('production factory defers proof validation past simulated zero module clock to the API request',async t=>{
  const f=await fixture(t),config=policy(),originalNow=Date.now;let worker,calls=0;
  try{Date.now=()=>0;worker=f.module.createStoryProductionWorker({config});}finally{Date.now=originalNow;}
  const response=await worker.fetch(new Request('https://game.test/api/story/capabilities'),{AI:{run(){calls++;throw Error('no inference expected');}}});
  const capabilities=await response.json();assert.equal(capabilities.available,true);assert.equal(capabilities.errorCode,null);assert.equal(calls,0);
});

test('production packaging cannot borrow a validated registry from another source root',async t=>{
  const trusted=await fixture(t),unvalidated=await fixture(t);
  await cp(path.join(repository,'src/worker/story-config.js'),path.join(unvalidated.root,'src/worker/story-config.js'));
  await assert.rejects(trusted.build({root:unvalidated.root,sourceCommit:'8'.repeat(40),production:policy()}),/production source root/i);
});

for(const promoted of [false,true])test(`default CLI builds a disabled backend with enabled policy and ${promoted?'promoted':'unvalidated'} registry`,async t=>{
  const f=await fixture(t),sourceCommit='a'.repeat(40);
  if(!promoted)await cp(path.join(repository,'src/worker/story-config.js'),path.join(f.root,'src/worker/story-config.js'));
  // Match CI's no-argument script invocation and SOURCE_COMMIT environment.
  // No account proof or activation policy is supplied to this child process.
  await promisify(execFile)(process.execPath,[path.join(f.root,'scripts/build-gateway.js')],{cwd:f.root,env:{...process.env,SOURCE_COMMIT:sourceCommit},timeout:15000});
  const output=path.join(f.root,'release/backend'),manifest=JSON.parse(await readFile(path.join(output,'deployment.json'),'utf8'));
  assert.equal(manifest.enabled,false);assert.equal(manifest.publicEnabled,false);assert.equal(manifest.modelValidated,false);assert.equal(manifest.accessMode,'disabled');
  assert.equal(manifest.requiredSecrets,undefined);assert.equal(manifest.experimentCoordinatorName,undefined);
  assert.equal(manifest.modules.some(row=>/story-(production|stage|acceptance|experiment)\.js$|\/operator-/.test(row.name)),false);
  const worker=await import(pathToFileURL(path.join(output,'entry.mjs')).href);let calls=0;
  const capabilities=await(await worker.default.fetch(new Request('https://game.test/api/story/capabilities'),{AI:{run(){calls++;throw Error('disabled artifact must not infer');}}})).json();
  assert.equal(capabilities.available,false);assert.equal(capabilities.errorCode,'INFERENCE_DISABLED');assert.equal(calls,0);
  assert.deepEqual(worker.backendIdentity,{sourceCommit,...versions,enabled:false,publicEnabled:false,accessMode:'disabled',candidateModelId:modelId,modelValidated:false});
});

test('isolated production package has no tester bridge or secrets and executes public API with durable budget and cached recovery', {timeout:30000},async t=>{
  const f=await fixture(t),config=policy(),sourceCommit='7'.repeat(40);
  await f.build({root:f.root,sourceCommit,production:config});
  const output=path.join(f.root,'release/backend'),manifest=JSON.parse(await readFile(path.join(output,'deployment.json'),'utf8'));
  assert.equal(manifest.enabled,true);assert.equal(manifest.publicEnabled,true);assert.equal(manifest.accessMode,'production');assert.equal(manifest.modelValidated,true);
  assert.deepEqual(manifest.versions,versions);assert.deepEqual(manifest.migrations,[]);
  assert.deepEqual(manifest.bindings,[{name:'AI',type:'ai'},{name:'STORY_BUDGET',type:'durable_object_namespace',class_name:'StoryBudget',namespace_id:'1de1df3929534a8d8d495d6db6604e99'}]);
  assert.equal(manifest.coordinatorName,'story-budget-v1-global');assert.equal(manifest.requiredSecrets,undefined);assert.equal(manifest.experimentCoordinatorName,undefined);
  assert.ok(manifest.modules.some(row=>row.name==='src/worker/story-production.js'));
  assert.equal(manifest.modules.some(row=>/story-(stage|acceptance|experiment)\.js$|\/operator-/.test(row.name)),false);
  const variants={disabled:{...config,enabled:false},wrongAccount:{...config,bindingAccountId:'another-account'},paid:{...config,currentPlan:{...config.currentPlan,plan:'workers-paid'}},future:{...config,freeBoundaryProof:{...config.freeBoundaryProof,checkedAt:new Date(Date.now()+3600000).toISOString()}},version:{...config,promptVersion:2}};
  const harness=`import packaged,{backendIdentity} from './entry.mjs';
import {createStoryProductionWorker} from './src/worker/story-production.js';
export {StoryBudget} from './entry.mjs';
const variants=Object.fromEntries(Object.entries(${JSON.stringify(variants)}).map(([name,config])=>[name,createStoryProductionWorker({config})]));
let aiCalls=0;const coordinatorNames=[];
export default {async fetch(request,env,ctx){
  if(new URL(request.url).pathname==='/__fixture/status')return Response.json({aiCalls,coordinatorNames,backendIdentity});
  const localEnv={...env,STORY_BUDGET:{idFromName(name){coordinatorNames.push(name);return env.STORY_BUDGET.idFromName(name);},get(id){return env.STORY_BUDGET.get(id);}},AI:{async run(model,input){
    aiCalls++;const context=JSON.parse(input.messages.at(-1).content),prefix=context.namespace+':t'+context.identity.turnId+':';
    const scene={id:prefix+'s:scene',title:'山路',location:'山间',blocks:[{kind:'narration',text:'你循着松影向前。'}],entities:[],choices:[{id:prefix+'c:rest',label:'歇息',intent:'rest',targetId:'self',stake:'low',approach:'recover'},{id:prefix+'c:train',label:'修行',intent:'practice',targetId:'self',stake:'low',approach:'steady'}],memoryDeltas:[]};
    return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(scene)}}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};
  }}};
  return (variants[request.headers.get('x-fixture-policy')]??packaged).fetch(request,localEnv,ctx);
}};`;
  let outbound=0;
  const options={name:'wending-production-fixture',compatibilityDate:manifest.compatibility_date,modulesRoot:output,modules:[{type:'ESModule',path:path.join(output,'harness.mjs'),contents:harness},...manifest.modules.map(row=>({type:'ESModule',path:path.join(output,row.name)}))],durableObjects:{STORY_BUDGET:{className:'StoryBudget',useSQLite:true}},durableObjectsPersist:path.join(f.root,'sqlite'),outboundService:()=>{outbound++;return new Response(null,{status:503});}};
  let mf=new Miniflare(options);t.after(()=>mf.dispose());
  const getStatus=async()=> (await mf.dispatchFetch('https://game.test/__fixture/status')).json();
  for(const [variant,errorCode] of [[null,null],['disabled','INFERENCE_DISABLED'],['wrongAccount','FREE_BOUNDARY_UNVERIFIED'],['paid','FREE_BOUNDARY_UNVERIFIED'],['future','FREE_BOUNDARY_UNVERIFIED'],['version','STORY_PRODUCTION_CONFIGURATION_INVALID']]){
    const capabilities=await(await mf.dispatchFetch('https://game.test/api/story/capabilities',{headers:variant?{'x-fixture-policy':variant}:{}})).json();
    assert.equal(capabilities.available,errorCode===null,variant??'public production');assert.equal(capabilities.errorCode,errorCode);
  }
  const initialStatus=await getStatus();assert.equal(initialStatus.aiCalls,0);
  assert.deepEqual(initialStatus.backendIdentity,{sourceCommit,...versions,enabled:true,publicEnabled:true,accessMode:'production',candidateModelId:modelId,modelValidated:true});
  assert.equal(await(await mf.dispatchFetch('https://game.test/')).text(),await readFile(path.join(f.root,'release/baishi-wending-offline.html'),'utf8'));
  const health=await(await mf.dispatchFetch('https://game.test/healthz')).json();assert.equal(health.sourceCommit,sourceCommit);assert.equal(health.htmlSha256,manifest.frontend.htmlSha256);
  const origin='https://game.test',sessionResponse=await mf.dispatchFetch(origin+'/api/story/session',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{"protocolVersion":1}'}),session=await sessionResponse.json();
  assert.equal(session.status,'ready');const cookie=sessionResponse.headers.get('set-cookie').split(';')[0];
  const state=createLiveGame({runId:'production-native',seed:42}),pending=prepareOpening(state,{requestId:'production-opening'}),body={context:buildStoryContext(state,pending),attempt:{id:'production-attempt',sessionRef:session.sessionRef,retryOf:null}};
  const post=body=>mf.dispatchFetch(origin+'/api/story/turn',{method:'POST',headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify(body)});
  const ready=await(await post(body)).json();assert.equal(ready.status,'ready',ready.errorCode);assert.equal(ready.requestId,'production-opening');
  assert.deepEqual(await(await post(body)).json(),ready);assert.equal((await getStatus()).aiCalls,1);
  // Persist observed provider exhaustion with an independent unknown commitment.
  // Its original charge and the first turn survive restart; never real inference.
  const ns=await mf.getDurableObjectNamespace('STORY_BUDGET'),stub=ns.get(ns.idFromName(manifest.coordinatorName));
  const call=async(method,body)=>(await stub.fetch('https://story-budget.internal/'+method,{method:'POST',body:JSON.stringify(body)})).json();
  const owner={sessionRef:'fixture-budget-session',tokenHash:'fixture-budget-token',ipHash:'fixture-budget-ip'};
  assert.equal((await call('createSession',owner)).kind,'session');
  assert.equal((await call('reserve',{...owner,attemptId:'fixture-unknown',requestId:'fixture-unknown-request',payloadHash:'fixture-payload',contextHash:'fixture-context',reservedNeurons:9889,retryOf:null})).kind,'reserved');
  assert.equal((await call('settle',{sessionRef:owner.sessionRef,attemptId:'fixture-unknown',status:'unknown',quotaExhausted:true,result:{status:'paused',errorCode:'FREE_QUOTA_EXHAUSTED'}})).kind,'settled');
  await mf.dispose();mf=new Miniflare(options);
  for(const variant of ['disabled','wrongAccount'])assert.deepEqual(await(await mf.dispatchFetch(origin+'/api/story/turn/production-opening?attemptId=production-attempt',{headers:{cookie,'x-fixture-policy':variant}})).json(),ready);
  const nextState=createLiveGame({runId:'production-blocked',seed:43}),nextPending=prepareOpening(nextState,{requestId:'production-blocked-opening'});
  const blocked=await(await post({context:buildStoryContext(nextState,nextPending),attempt:{id:'production-blocked-attempt',sessionRef:session.sessionRef,retryOf:null}})).json();
  assert.equal(blocked.errorCode,'FREE_QUOTA_EXHAUSTED');
  const status=await getStatus();assert.equal(status.aiCalls,0);assert.ok(status.coordinatorNames.length>0);assert.deepEqual([...new Set(status.coordinatorNames)],['story-budget-v1-global']);assert.equal(outbound,1,'only the blocked static release check, with no inference egress');
  assert.equal(JSON.parse(await readFile(path.join(repository,'config/story-deployment.json'),'utf8')).enabled,false);assert.deepEqual(PRODUCTION_PROFILES,[]);
});
