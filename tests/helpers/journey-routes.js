import assert from 'node:assert/strict';
import { createJourney, getJourneyView, chooseJourney } from '../../src/game/journey/engine.js';
export function pick(state, choiceId) {
  const view = getJourneyView(state);
  const result = chooseJourney(state, { revision: view.revision, sceneId: view.sceneId, choiceId });
  assert.equal(result.kind, 'applied', `${view.sceneId}/${choiceId}: ${result.message}`);
  return result.state;
}
export const clinic = ['catch-child', 'take-medicine', 'continue-road', 'pledge-truth', 'route-ledger', 'keep-original', 'route-channel', 'measure-channel', 'go-confront', 'public-hearing', 'organize-rescue', 'choose-clinic', 'handoff-record', 'travel-nether'];
export const ash = ['catch-child', 'leave-medicine', 'continue-road', 'pledge-truth', 'route-witness', 'anonymous-record', 'go-confront', 'record-limits', 'evacuate-wounded', 'choose-ash', 'handoff-record', 'travel-nether'];
export const netherEvidence = ['shelve-records', 'correct-record', 'continue-inquest', 'verify-sources', 'protect-sources', 'judge-accountable'];
export const netherLimited = ['shelve-records', 'freeze-debt', 'continue-inquest', 'record-gaps', 'protect-sources', 'share-duty'];
export const celestial = ['authorize-local', 'continue-celestial', 'limit-terms', 'minimum-share', 'deliver-copies'];
export const personal = ['authorize-self', 'continue-celestial', 'limit-terms', 'trial-appeal', 'deliver-copies'];
export const evidenceVictory = [...clinic, ...netherEvidence, ...celestial, 'evidence-method', 'separate-fire', 'share-stop-right', 'return-duty'];
export const limitedVictory = [...ash, ...netherLimited, ...personal, 'shared-method', 'separate-fire', 'share-stop-right', 'return-duty'];
export function route(ids, seed = 0) { return ids.reduce(pick, createJourney({ seed })); }
