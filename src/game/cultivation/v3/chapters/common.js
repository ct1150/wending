export function action(label, to, result, effects = {}, costs = { days: 3 }, id = 'continue', requires = []) {
  return { id, label, detail: `选择后：${result}`, to, result, effects, costs, requires };
}
export function scene(id, title, location, goal, text, speaker, dialogue, choices) {
  return { id, title, location, goal, blocks: [{ kind: 'narration', text }, { kind: 'dialogue', speaker, text: dialogue }], choices };
}
export function retirement(to) {
  return { id: 'retire', label: '放下争逐，守住余生', detail: '结束这次远行，在此安度剩余寿年。', to, ending: 'retired', endingTitle: '守灯人', result: '你没有把余生押给下一道门。屋檐下的灯一年年亮着，来客仍能听见你的故事。', effects: { deed: '自择归隐，守护一方灯火' } };
}
export function fork(label, to, result, effects = {}, costs = { days: 6 }) { return action(label, to, result, effects, costs, 'alternative'); }
