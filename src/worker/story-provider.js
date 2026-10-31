import { generateProviderScene, validateProviderOptions } from './story-provider-core.js';
import { GLM_MODEL_ID } from './story-config.js';
import { createGlmTransport } from './story-glm-provider.js';
import { assertPlainData } from '../game/cultivation/live/identity.js';
import { idField } from '../game/cultivation/live/schema.js';
import { validateStoryContext } from '../game/cultivation/live/memory.js';
import { selectStoryReferences, loadStoryReferences } from './story-knowledge.js';
export { PROVIDER_ERROR_CODES } from './story-provider-core.js';

function assertValidatedProfile(profile) {
  if(profile.validated!==true||profile.supportsStructuredOutput!==true)throw Object.assign(new Error('MODEL_UNVALIDATED'),{code:'MODEL_UNVALIDATED'});
}

// Production always requires validated structured output. The HTTP controller
// verifies the free boundary and reserves durably before reaching this wrapper.
export async function generateScene(ai,profile,context,options={},runtime={}) {
  try{assertPlainData(profile);assertPlainData(options);}catch{return generateProviderScene(ai,profile,context,options,assertValidatedProfile);}
  if(!options||typeof options!=='object')return generateProviderScene(ai,profile,context,options,assertValidatedProfile);
  let knowledgeBundle;
  if(runtime.knowledgeStore!==undefined){
    // Check the existing request/profile boundary before touching private
    // storage. Loading references is one trusted pre-inference step, never a
    // second model call or a side effect of prospective context validation.
    try{validateProviderOptions(profile,options,assertValidatedProfile);validateStoryContext(context);idField(options.attemptId??context.identity.requestId);}
    catch{return generateProviderScene(ai,profile,context,options,assertValidatedProfile);}
    try{knowledgeBundle=await loadStoryReferences(runtime.knowledgeStore,selectStoryReferences(context),{signal:runtime.signal});}
    catch{return {status:'paused',errorCode:'KNOWLEDGE_UNAVAILABLE',accountingStatus:'complete',modelId:profile.modelId,attemptId:options.attemptId??context.identity.requestId,inferencePerformed:false,usage:null,actualNeurons:null,stopReason:null,inputHash:null,inputBytes:null,nonThinkingValidated:null};}
  }
  if(profile?.modelId===GLM_MODEL_ID){
    const transport=createGlmTransport({ai,context,onProgress:runtime.onProgress,deadlineAt:runtime.deadlineAt,signal:runtime.signal,timeoutMs:options.timeoutMs});
    const result=await generateProviderScene(transport,{...profile,storyActions:runtime.storyActions===true},context,options,assertValidatedProfile,knowledgeBundle);
    if(transport.accountingUnknown)result.accountingStatus='unknown';
    if(result.inferencePerformed)result.providerSource=transport.source;
    return result;
  }
  return generateProviderScene(ai,profile,context,options,assertValidatedProfile,knowledgeBundle);
}
