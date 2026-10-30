// These are release-record checks, not new live inference or browser evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CANDIDATE_MODEL_ID,GLM_MODEL_ID,PRODUCTION_PROFILES,confirmFreeBoundaryEvidence,assertProviderReady} from '../src/worker/story-config.js';

const repository=fileURLToPath(new URL('../',import.meta.url));

test('the real promoted registry provides the immutable structured-output profile used by production admission',()=>{
  assert.ok(Object.isFrozen(PRODUCTION_PROFILES));
  assert.ok(PRODUCTION_PROFILES.length>0,'production promotion requires a checked-in validated profile');
  assert.deepEqual(new Set(PRODUCTION_PROFILES.map(profile=>profile.modelId)),new Set([CANDIDATE_MODEL_ID,GLM_MODEL_ID]));
  assert.equal(new Set(PRODUCTION_PROFILES.map(profile=>profile.modelId)).size,PRODUCTION_PROFILES.length);
  const now=Date.parse('2026-10-28T10:00:00Z');
  const evidence=confirmFreeBoundaryEvidence({source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:0,checkedAt:new Date(now).toISOString()},{now});
  let calls=0;
  for(const profile of PRODUCTION_PROFILES){
    assert.ok(Object.isFrozen(profile));
    assert.ok([CANDIDATE_MODEL_ID,GLM_MODEL_ID].includes(profile.modelId));
    assert.equal(profile.validated,true);assert.equal(profile.supportsStructuredOutput,true);
    assert.equal(profile.requestFormat,'workers-ai-messages');assert.equal(profile.responseFormat,'json_schema');
    assert.deepEqual(profile.usageFields,['usage.prompt_tokens','usage.completion_tokens','usage.total_tokens']);
    assert.deepEqual(profile.stopFields,['choices[0].finish_reason']);
    for(const field of ['maxInput','maxOutput','contextTokens'])assert.ok(Number.isSafeInteger(profile[field])&&profile[field]>0,field);
    const admitted=assertProviderReady({enabled:true,modelId:profile.modelId,env:{AI:{run(){calls++;throw Error('registry checks must not infer');}}},evidence,now,purpose:'production'});
    assert.equal(admitted,profile,'production admission selects the checked-in registry entry');
  }
  assert.equal(calls,0);
});

test('each promoted profile points to actual passing opening, branch and browser save-refresh records',async()=>{
  assert.ok(PRODUCTION_PROFILES.length>0,'an empty registry is not a completed production release');
  const root=await realpath(repository);
  const deployment=JSON.parse(await readFile(path.join(root,'config/story-deployment.json'),'utf8'));
  assert.equal(deployment.enabled,true,'the checked-in switch permits an explicit verified production package');
  async function checkedFile(reference){
    assert.equal(typeof reference,'string');
    assert.ok(!path.isAbsolute(reference)&&!reference.includes('://'),'evidence references are repository-relative files');
    const file=await realpath(path.resolve(root,reference));
    assert.ok(file.startsWith(root+path.sep),'evidence references remain inside the repository');
    assert.equal((await stat(file)).isFile(),true);
    return file;
  }
  function referencedEvidence(value){
    if(typeof value==='string')return value.startsWith('docs/evidence/')?[value]:[];
    if(!value||typeof value!=='object')return [];
    return Object.values(value).flatMap(referencedEvidence);
  }
  for(const profile of PRODUCTION_PROFILES){
    assert.match(profile.validationEvidence,/^docs\/evidence\/.+\.json$/);
    const evidence=JSON.parse(await readFile(await checkedFile(profile.validationEvidence),'utf8'));
    assert.equal(evidence.schemaVersion,1);assert.equal(evidence.modelId,profile.modelId);
    assert.match(evidence.sourceCommit,/^[a-f0-9]{40}$/);
    assert.equal(typeof evidence.verifiedAt,'string');
    assert.ok(Number.isFinite(Date.parse(evidence.verifiedAt))&&Date.parse(evidence.verifiedAt)<=Date.now());
    for(const name of ['opening','branches','browserSaveRefresh']){
      const result=evidence.acceptance?.[name];
      assert.equal(result?.passed,true,name+' must have passed before promotion');
      const references=[...new Set(referencedEvidence(result))];
      assert.ok(references.length>0,name+' must reference its actual evidence file');
      for(const reference of references)await checkedFile(reference);
    }
  }
});
