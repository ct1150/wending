import { createCultivation as createLegacyCultivation, getCultivationView as getLegacyCultivationView, chooseCultivation as chooseLegacyCultivation } from './legacy-engine.js';
import { createCampaign, getCampaignView, chooseCampaign } from './v3/engine.js';
import { validateCultivation } from './validation.js';
export function createCultivation(options = {}) { return options?.contentVersion === 3 ? createCampaign(options) : createLegacyCultivation(options); }
export function getCultivationView(state) { validateCultivation(state); return state.contentVersion === 3 ? getCampaignView(state) : getLegacyCultivationView(state); }
export function chooseCultivation(state, command) { validateCultivation(state); return state.contentVersion === 3 ? chooseCampaign(state, command) : chooseLegacyCultivation(state, command); }
