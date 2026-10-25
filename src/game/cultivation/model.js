export const DAYS_PER_YEAR = 360;
export const MORTAL_LIFE_LIMIT = 72;
export const FOUNDATION_LIFE_LIMIT = 180;

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
