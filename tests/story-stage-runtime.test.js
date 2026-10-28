import test from 'node:test';
import assert from 'node:assert/strict';
import {CANDIDATE_MODEL_ID} from '../src/worker/story-config.js';
import {mkdtemp,mkdir,readFile,writeFile,rm,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Miniflare} from 'miniflare';
import {buildGateway} from '../scripts/build-gateway.js';
import {sha256} from '../src/game/cultivation/live/identity.js';

const repository=fileURLToPath(new URL('../',import.meta.url));
const permit='a8'.repeat(32),operatorToken='fixture-server-only-operator-credential-with-32-characters';
const testerHeader='x-wending-story-tester';

test('native packaged stage validates proof and permit in API request context without inference',{timeout:30000},async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'wending-stage-runtime-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await cp(path.join(repository,'src'),path.join(root,'src'),{recursive:true});
  await cp(path.join(repository,'config'),path.join(root,'config'),{recursive:true});
  // This disposable tester fixture is independent of public production promotion.
  const policyFile=path.join(root,'config/story-deployment.json');
  const deploymentPolicy=JSON.parse(await readFile(policyFile,'utf8'));
  await writeFile(policyFile,JSON.stringify({...deploymentPolicy,enabled:false}));
  for(const dir of ['release','assets'])await mkdir(path.join(root,dir),{recursive:true});
  const html='<!doctype html><title>tester stage runtime fixture</title>';
  await writeFile(path.join(root,'release/baishi-wending-offline.html'),html);
  await writeFile(path.join(root,'assets/seal.svg'),'<svg/>');await writeFile(path.join(root,'package.json'),'{"version":"4.0.0"}');
  const observedAt=Date.now();
  const proof={accountId:'fixture-account',source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:10000,checkedAt:new Date(observedAt-1000).toISOString()};
  const config={enabled:true,mode:'tester-only',modelId:CANDIDATE_MODEL_ID,testerPermitSha256:sha256(permit),bindingAccountId:'fixture-account',currentPlan:{accountId:'fixture-account',source:'operator-account-verification',plan:'workers-free'},freeBoundaryProof:proof};
  await buildGateway({root,sourceCommit:'d'.repeat(40),acceptance:config});
  const output=path.join(root,'release/backend'),manifest=JSON.parse(await readFile(path.join(output,'deployment.json'),'utf8'));
  assert.equal(manifest.publicEnabled,false);assert.equal(manifest.modelValidated,false);assert.equal(manifest.accessMode,'tester-only');
  // Import the actual generated entry unchanged: its factory executes at native
  // module scope. Only local binding adapters and invalid policy fixtures live
  // in this harness. Neither native clocks nor product modules are patched.
  const policies={expired:{...config,freeBoundaryProof:{...proof,checkedAt:new Date(observedAt-600000).toISOString()}},future:{...config,freeBoundaryProof:{...proof,checkedAt:new Date(observedAt+3600000).toISOString()}},wrongAccount:{...config,freeBoundaryProof:{...proof,accountId:'different-account'}}};
  const harness=`import packaged from './entry.mjs';
import {createStoryStageWorker} from './src/worker/story-stage.js';
const moduleNow=Date.now();
const variants=Object.fromEntries(Object.entries(${JSON.stringify(policies)}).map(([name,config])=>[name,createStoryStageWorker({config})]));
let aiCalls=0,experimentCalls=0;
const localEnv={STORY_OPERATOR_TOKEN:${JSON.stringify(operatorToken)},AI:{run(){aiCalls++;throw Error('AI must not run');}},STORY_EXPERIMENT:{idFromName(name){return name;},get(){return {fetch(){experimentCalls++;throw Error('experiment must not run');}};}}};
export default {fetch(request,env,ctx){
  if(new URL(request.url).pathname==='/__fixture/status')return Response.json({moduleNow,requestNow:Date.now(),aiCalls,experimentCalls});
  return (variants[request.headers.get('x-fixture-policy')]??packaged).fetch(request,localEnv,ctx);
}};`;
  let outbound=0;
  const mf=new Miniflare({name:'wending-stage-runtime',compatibilityDate:manifest.compatibility_date,modulesRoot:output,modules:[{type:'ESModule',path:path.join(output,'harness.mjs'),contents:harness},...manifest.modules.map(module=>({type:'ESModule',path:path.join(output,module.name)}))],outboundService:()=>{outbound++;throw Error('offline fixture blocks egress');}});t.after(()=>mf.dispose());
  assert.equal(await(await mf.dispatchFetch('https://game.test/')).text(),html);
  const health=await(await mf.dispatchFetch('https://game.test/healthz')).json();assert.equal(health.releaseSource,'embedded');assert.equal(health.htmlSha256,manifest.frontend.htmlSha256);
  const cases=[
    {name:'packaged valid permit',policy:null,provided:permit,errorCode:null},
    {name:'packaged missing permit',policy:null,provided:null,errorCode:'TESTER_PERMIT_REQUIRED'},
    {name:'packaged wrong permit',policy:null,provided:'b9'.repeat(32),errorCode:'TESTER_PERMIT_REQUIRED'},
    {name:'expired proof without permit',policy:'expired',provided:null,errorCode:'TESTER_PERMIT_REQUIRED'},
    {name:'expired proof with permit',policy:'expired',provided:permit,errorCode:'FREE_BOUNDARY_UNVERIFIED'},
    {name:'future proof',policy:'future',provided:permit,errorCode:'STORY_STAGE_CONFIGURATION_INVALID'},
    {name:'wrong binding account',policy:'wrongAccount',provided:permit,errorCode:'STORY_STAGE_CONFIGURATION_INVALID'},
  ];
  for(const {name,policy,provided,errorCode} of cases)await t.test(name,async()=>{
    const response=await mf.dispatchFetch('https://game.test/api/story/capabilities',{headers:{...(policy?{'x-fixture-policy':policy}:{}),...(provided?{[testerHeader]:provided}:{})}});
    assert.equal(response.status,200);const value=await response.json();assert.equal(value.errorCode,errorCode);assert.equal(value.available,errorCode===null);
  });
  const status=await(await mf.dispatchFetch('https://game.test/__fixture/status')).json();
  assert.equal(typeof status.moduleNow,'number');assert.ok(status.requestNow>=status.moduleNow);
  assert.equal(status.aiCalls,0);assert.equal(status.experimentCalls,0);assert.equal(outbound,0);
});
