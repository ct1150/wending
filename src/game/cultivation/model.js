export const DAYS_PER_YEAR = 360;
export const MORTAL_LIFE_LIMIT = 72;
export const FOUNDATION_LIFE_LIMIT = 180;

export const BIRTH_ATTRIBUTES = {
  constitution: '根骨',
  insight: '悟性',
  fortune: '气运',
};

export const BIRTH_TALENTS = {
  prepared: { id: 'prepared', name: '备药', description: '入世时多带一包疗伤药。' },
  'herb-affinity': { id: 'herb-affinity', name: '草木缘', description: '入世时多带一把灵草；辨药本领仍须亲自学习。' },
  focused: { id: 'focused', name: '心静', description: '首次成功引气入体时额外积累一点修为，修为最高为六；功法与修炼年月照常需要。' },
  restful: { id: 'restful', name: '善调息', description: '本来就能疗伤的行动额外恢复一级伤势，最多恢复至无碍。' },
};

export function normalizeCultivationName(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= 24 ? name : null;
}

export function validCultivationName(name) {
  return typeof name === 'string' && normalizeCultivationName(name) === name;
}

export function remainingDays(state) {
  return state.life.lifeLimit * DAYS_PER_YEAR - state.life.ageDays - state.life.lifeDamageDays;
}

export function durationText(days) {
  const years = Math.floor(days / DAYS_PER_YEAR);
  const rest = days % DAYS_PER_YEAR;
  return (years ? years + '年' : '') + (rest ? rest + '日' : '') || '不足一日';
}

export function matchesCultivationConditions(state, conditions = []) {
  return conditions.every(condition => {
    switch (condition.kind) {
      case 'item': return (state.life.items[condition.id] || 0) >= (condition.min ?? 1);
      case 'skill': return state.life.skills.includes(condition.id);
      case 'realm': return state.life.realm === condition.value;
      case 'cultivation': return state.life.cultivation >= (condition.min ?? 1);
      case 'injury-max': return state.life.injury <= (condition.value ?? condition.min ?? 0);
      case 'life-fact': return state.life.facts[condition.id] === condition.value;
      case 'world-fact': return state.world.facts[condition.id] === condition.value;
      case 'days-left': return state.world.day - state.life.startDay <= condition.value;
      default: throw new Error('未知的修行条件：' + condition.kind);
    }
  });
}
