import { CANDIDATE_PROFILE } from './story-config.js';
import { buildStoryInput, generateProviderScene } from './story-provider-core.js';

// Operator-only, unpromoted acceptance. Authentication, current free-boundary
// proof and durable experiment reservation belong to the calling operator.
// This module never changes the candidate or grants production readiness.
export function buildCandidateStoryInput(context) {
  try { return buildStoryInput(CANDIDATE_PROFILE,context); }
  catch(error) {
    if(typeof error?.code==='string')throw error;
    throw Object.assign(new Error('STORY_CONTEXT_INVALID'),{code:'STORY_CONTEXT_INVALID'});
  }
}

export function generateAcceptanceScene(ai,context,options={}) {
  return generateProviderScene(ai,CANDIDATE_PROFILE,context,options);
}
