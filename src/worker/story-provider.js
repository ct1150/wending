import { generateProviderScene, validateProviderOptions } from './story-provider-core.js';
import { GLM_MODEL_ID } from './story-config.js';
import { createGlmTransport } from './story-glm-provider.js';
import { assertPlainData } from '../game/cultivation/live/identity.js';
import { idField } from '../game/cultivation/live/schema.js';
import { validateStoryContext } from '../game/cultivation/live/memory.js';
import { selectStoryReferences, loadStoryReferences } from './story-knowledge.js';
import {adaptV7ModelOutput} from './story-model-output.js';
import {readStoryPresentation} from '../game/cultivation/live/story-preview.js';
import {readCompleteV7Wire} from './story-readable-wire.js';
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
    catch(error){
      // Retrieval is optional enrichment. A cancelled request or exhausted
      // request deadline still stops before inference; neither is a corpus fault.
      if(runtime.signal?.aborted||Date.now()>=runtime.deadlineAt)return {status:'paused',errorCode:'PROVIDER_TIMEOUT',accountingStatus:'complete',modelId:profile.modelId,attemptId:options.attemptId??context.identity.requestId,inferencePerformed:false,usage:null,actualNeurons:null,stopReason:null,inputHash:null,inputBytes:null,nonThinkingValidated:null};
      if(error?.code!=='KNOWLEDGE_UNAVAILABLE')throw error;
      // Keep the original context, budget, request and single model call. No
      // bundle means no retrieval receipt or invented exposure identifiers.
    }
  }
  if(profile?.modelId===GLM_MODEL_ID){
    let retainedBlocks=null;
    const progress=event=>runtime.onProgress?.(retainedBlocks&&event.type==='presentation'?{...event,blocks:retainedBlocks}:event);
    const transport=createGlmTransport({ai,context,authoredChoices:true,onProgress:progress,deadlineAt:runtime.deadlineAt,signal:runtime.signal,timeoutMs:options.timeoutMs});
    const activeProfile={...profile,storyActions:runtime.storyActions===true,authoredChoices:true};
    let result=await generateProviderScene(transport,activeProfile,context,options,assertValidatedProfile,knowledgeBundle);
    if(runtime.recoverChoices===true&&runtime.storyActions===true&&context.director?.version===7&&result.errorCode==='CHOICE_NOT_COMPILABLE'&&!runtime.signal?.aborted&&Date.now()<(runtime.deadlineAt??Infinity)){
      let prior;
      try{
        const text=transport.lastCompletion.choices[0].message.content;
        let wire;try{wire=JSON.parse(text);}catch{wire=readCompleteV7Wire(text,{authoredChoices:true});}
        prior=adaptV7ModelOutput(wire,context,{authoredChoices:true});
        // Consequential evidence must stay attached to the original complete
        // scene; a menu-only correction cannot discard or reinterpret it.
        if(prior.memoryDeltas.some(row=>['death','promise'].includes(row.kind)||row.referenceId))prior=null;
      }catch{}
      if(prior){
        retainedBlocks=readStoryPresentation(JSON.stringify(prior),context,{authoredChoices:true}).blocks;
        progress({type:'reset'});
        progress({type:'preview',text:retainedBlocks.map(block=>block.text).join('\n\n')});
        progress({type:'presentation',blocks:retainedBlocks,choices:[]});
        const first=result;
        result=await generateProviderScene(transport,activeProfile,context,options,assertValidatedProfile,knowledgeBundle,prior);
        if(first.usage&&result.usage)result.usage=Object.fromEntries(Object.keys(first.usage).map(key=>[key,first.usage[key]+result.usage[key]]));
        else result.accountingStatus='unknown';
      }
    }
    if(transport.accountingUnknown)result.accountingStatus='unknown';
    if(result.inferencePerformed)result.providerSource=transport.source;
    return result;
  }
  return generateProviderScene(ai,profile,context,options,assertValidatedProfile,knowledgeBundle);
}
