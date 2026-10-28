import { generateProviderScene } from './story-provider-core.js';
export { PROVIDER_ERROR_CODES } from './story-provider-core.js';

function assertValidatedProfile(profile) {
  if(profile.validated!==true||profile.supportsStructuredOutput!==true)throw Object.assign(new Error('MODEL_UNVALIDATED'),{code:'MODEL_UNVALIDATED'});
}

// Production always requires validated structured output. The HTTP controller
// verifies the free boundary and reserves durably before reaching this wrapper.
export function generateScene(ai,profile,context,options={}) {
  return generateProviderScene(ai,profile,context,options,assertValidatedProfile);
}
