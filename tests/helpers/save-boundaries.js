import { createJourney } from '../../src/game/journey/engine.js';
import { createGame, act } from '../../src/game/engine.js';

// Explicit size fixtures, not claims of public history reachability. Every field
// remains valid; padding represents retained prose and never invents progression.
export function journeyAtSize(size, state = createJourney({ seed: 'boundary' })) {
  state = structuredClone(state);
  const blocks = Array.from({ length: 500 }, (_, i) => ({ id: `boundary-${i}`, sceneId: 'mortal-entry', kind: 'narration', text: '记' }));
  state.transcript.push(...blocks);
  fillText(state, blocks, size, 2000);
  return state;
}
export function legacyAtSize(size) {
  const state = createGame({ seed: 'legacy-boundary' });
  const biography = act(state, { type: 'retire' }).meta.history[0];
  state.meta.generation = 9;
  state.meta.history = Array.from({ length: 8 }, (_, i) => ({ ...structuredClone(biography), generation: i + 1,
    log: Array.from({ length: 40 }, (_, j) => ({ id: j + 1, year: 1000, age: 16, title: '旧记', text: '记', kind: 'action' })),
  }));
  fillText(state, state.meta.history.flatMap(row => row.log), size, 4096);
  return state;
}
function fillText(state, blocks, size, maximum) {
  let remaining = size - JSON.stringify(state).length;
  for (const block of blocks) {
    const count = Math.min(maximum - block.text.length, remaining);
    block.text += '记'.repeat(count); remaining -= count;
    if (!remaining) return;
  }
  throw new Error(`Size fixture cannot fit ${remaining} characters`);
}
