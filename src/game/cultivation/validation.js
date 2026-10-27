import { validateCultivation as validateLegacyCultivation } from './legacy-validation.js';
import { validateCampaign } from './v3/validation.js';
export function validateCultivation(state) {
  // Dispatch without evaluating an untrusted getter. Each validator checks the
  // complete record and rejects accessor descriptors before reading values.
  const descriptor = state && typeof state === 'object' ? Object.getOwnPropertyDescriptor(state, 'contentVersion') : null;
  return descriptor && Object.hasOwn(descriptor, 'value') && descriptor.value === 3 ? validateCampaign(state) : validateLegacyCultivation(state);
}
