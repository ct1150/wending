import { assertSaveSize } from './save-size.js';
import { serialize, deserialize } from './engine.js';
import { validateJourney } from './journey/validation.js';
import { validateCultivation } from './cultivation/validation.js';

function unsupportedVersion() {
  throw new Error('存档版本不受支持，请导入有效的百世问鼎备份。');
}

export function serializeGame(state) {
  switch (state?.version) {
    case 1:
      // The old importer owns strict v1 validation and its established v2 upgrade.
      return assertSaveSize(serialize(deserialize(assertSaveSize(JSON.stringify(state)))));
    case 2:
      return assertSaveSize(serialize(state));
    case 3:
      validateJourney(state);
      return assertSaveSize(JSON.stringify(state));
    case 4:
      validateCultivation(state);
      return assertSaveSize(JSON.stringify(state));
    default:
      return unsupportedVersion();
  }
}

export function deserializeGame(raw) {
  assertSaveSize(raw);
  let state;
  try { state = JSON.parse(raw); }
  catch { throw new Error('无法读取存档 JSON 文字。'); }
  switch (state?.version) {
    case 1:
    case 2: {
      const restored = deserialize(raw);
      // v1 normalization adds required v2 fields; the adopted state must also
      // fit the export/import boundary, even when its original text did fit.
      assertSaveSize(JSON.stringify(restored));
      return restored;
    }
    case 3:
      validateJourney(state);
      assertSaveSize(JSON.stringify(state));
      return state;
    case 4:
      validateCultivation(state);
      assertSaveSize(JSON.stringify(state));
      return state;
    default:
      return unsupportedVersion();
  }
}
