import { generateProviderScene } from './story-provider-core.js';
import { GLM_MODEL_ID } from './story-config.js';
import { createGlmTransport } from './story-glm-provider.js';
import { assertPlainData } from '../game/cultivation/live/identity.js';
export { PROVIDER_ERROR_CODES } from './story-provider-core.js';

function assertValidatedProfile(profile) {
  if(profile.validated!==true||profile.supportsStructuredOutput!==true)throw Object.assign(new Error('MODEL_UNVALIDATED'),{code:'MODEL_UNVALIDATED'});
}

// Production always requires validated structured output. The HTTP controller
// verifies the free boundary and reserves durably before reaching this wrapper.
export async function generateScene(ai,profile,context,options={},runtime={}) {
  try{assertPlainData(profile);assertPlainData(options);}catch{return generateProviderScene(ai,profile,context,options,assertValidatedProfile);}
  if(!options||typeof options!=='object')return generateProviderScene(ai,profile,context,options,assertValidatedProfile);
  if(profile?.modelId===GLM_MODEL_ID){
    const transport=createGlmTransport({ai,onProgress:runtime.onProgress,deadlineAt:runtime.deadlineAt,signal:runtime.signal,timeoutMs:options.timeoutMs});
    const result=await generateProviderScene(transport,profile,context,options,assertValidatedProfile);
    if(transport.accountingUnknown)result.accountingStatus='unknown';
    if(result.inferencePerformed)result.providerSource=transport.source;
    return result;
  }
  return generateProviderScene(ai,profile,context,options,assertValidatedProfile);
}
