import { realmFor, initialItemsForBirth, ROOTS, PHYSIQUES, RELICS, TECHNIQUES, WORLD_TIERS, INHERITED_BENEFITS, ART_NAMES } from '../game/cultivation/live/cultivation-rules.js';
import { ITEMS, ORIGINS, TALENTS } from '../game/cultivation/live/model.js';
import { ORIGIN_BACKGROUNDS, TALENT_STORIES } from '../game/cultivation/live/birth-stories.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const realmNames = { mortal: '凡人', qi: '炼气', foundation: '筑基', golden: '金丹', nascent: '元婴' };
const injuryNames = { 0: '无碍', 1: '轻伤', 2: '内伤', 3: '重伤', none: '无碍', well: '无碍', healthy: '无碍', hurt: '受伤', severe: '重伤' };

function identity(summary) {
  return {
    name: summary.name,
    generation: summary.generationLabel ?? `第${summary.generation}世`,
    realm: summary.realmName ?? realmNames[summary.realm] ?? summary.realm ?? '未入仙途',
    age: summary.ageText ?? `${summary.age}岁`,
    remaining: summary.remainingLifeText ?? `${Math.max(0, summary.remainingLife ?? 0)}年`,
    lifespan: summary.lifespanText,
  };
}

function yearsText(years) {
  const days = Math.round((years ?? 0) * 360);
  const whole = Math.floor(days / 360), rest = days % 360;
  return `${whole || !rest ? `${whole}年` : ''}${rest ? `${rest}日` : ''}`;
}

function renderAttributes(attributes) {
  return `<dl class="character-attributes">${attributes.map(attribute => `<div><dt>${esc(attribute.name)}</dt><dd class="character-attribute-value">${esc(attribute.value)}<span class="character-attribute-scale"> / 6</span></dd>${attribute.description ? `<dd class="character-attribute-description">${esc(attribute.description)}</dd>` : ''}</div>`).join('')}</dl>`;
}

function renderTalents(talents) {
  return talents.map(talent => `<div class="character-talent"><h4>${esc(talent.name)}</h4>${talent.description ? `<p>${esc(talent.description)}</p>` : ''}</div>`).join('');
}

function liveTalentDescription(birth, id) {
  if (!birth.backgroundId) return '';
  const { sense, effect } = TALENT_STORIES[id];
  return sense + effect;
}

export function renderIdentityBar(summary) {
  const person = identity(summary);
  const life = person.lifespan ? `寿元 ${person.lifespan}` : `${person.age}，余寿${person.remaining}`;
  const label = `查看人物详情：${person.generation}，${person.name}，${person.realm}，${life}`;
  return `<button type="button" class="journey-identity-bar" data-character aria-haspopup="dialog" aria-label="${esc(label)}"><span class="journey-identity-name"><span class="journey-generation">${esc(person.generation)}</span><strong class="journey-name">${esc(person.name)}</strong><span class="journey-identity-hint" aria-hidden="true">⌄</span></span><span class="journey-identity-facts"><span>${esc(person.realm)}</span>${person.lifespan ? `<span>寿元 ${esc(person.lifespan)}</span>` : `<span>${esc(person.age)}</span><span>余寿${esc(person.remaining)}</span>`}</span></button>`;
}

export function renderCharacterDetails(summary) {
  const person = identity(summary);
  const attributes = summary.attributes ?? [], talents = summary.talents ?? [];
  const abilities = summary.abilities ?? [], items = summary.items ?? [];
  const facts = [
    ['境界', person.realm],
    ...(person.lifespan ? [['寿元', person.lifespan]] : [['年龄', person.age], ['余寿', person.remaining], ['寿限', yearsText(summary.lifeLimit)], ['命损', yearsText(summary.lifeDamage)]]),
    ...(person.lifespan ? [] : [['伤势', summary.injuryName ?? injuryNames[summary.injury] ?? summary.injury ?? '无碍']]),
    ...(summary.statusFacts ?? []),
    ...(summary.origin ? [['出身', summary.origin.name, summary.origin.history]] : []),
    ...(summary.year === undefined ? [] : [['道历', `${summary.year}年`]]),
  ];
  const traits = summary.birthTraits ?? [], inherited = summary.inheritedBenefits ?? [];
  const method=summary.currentTechnique;
  const current=method?`<section class="character-section" data-current-technique><h3>当前功法</h3><p><strong>${esc(method.name)}</strong> · ${esc(method.status)}</p><p>${esc(method.advantage)}</p><p>${esc(method.cost)}</p></section>`:'';
  const inventory = items.length || !person.lifespan ? `<section class="character-section"><h3>随身物品</h3>${items.length ? `<dl class="character-inventory">${items.map(item => `<div><dt>${esc(item.name)}</dt><dd>× ${esc(item.count)}</dd></div>`).join('')}</dl>` : '<p class="character-empty">行囊里还没有留下什么。</p>'}</section>` : '';
  const skills = abilities.length || !person.lifespan ? `<section class="character-section"><h3>已学本领</h3>${abilities.length ? `<ul class="character-abilities">${abilities.map(ability => `<li><strong>${esc(ability.name)}</strong>${ability.description ? `<p>${esc(ability.description)}</p>` : ''}</li>`).join('')}</ul>` : '<p class="character-empty">尚未学成法门。</p>'}</section>` : '';
  const legacy = inherited.length ? `<section class="character-section"><h3>今生传承</h3>${renderTalents(inherited)}</section>` : summary.legacy || !person.lifespan ? `<section class="character-section"><h3>今生传承</h3>${summary.legacy ? `<p><strong>${esc(summary.legacy.name)}</strong></p>${summary.legacy.description ? `<p>${esc(summary.legacy.description)}</p>` : ''}` : '<p class="character-empty">只携记忆，重新问道。</p>'}</section>` : '';
  const factRows = facts.map(([label, value, note]) => `<div${note ? ' class="character-origin-fact"' : ''}><dt>${esc(label)}</dt><dd>${esc(value)}${note ? `<small>${esc(note)}</small>` : ''}</dd></div>`).join('');
  return `<div class="character-details"><p class="character-intro"><strong>${esc(person.name)}</strong><span>${esc(person.generation)}</span></p><dl class="character-facts">${factRows}</dl>${current}${traits.length ? `<section class="character-section"><h3>${method?'入世时的根基':'此生根基'}</h3>${renderTalents(traits)}</section>` : ''}${attributes.length || talents.length ? `<section class="character-section" aria-label="此生天资"><h3>此生天资</h3>${attributes.length ? renderAttributes(attributes) : ''}${talents.length ? `<div class="character-talents"><h3>天赋</h3>${renderTalents(talents)}</div>` : ''}</section>` : ''}${inventory}${skills}${legacy}</div>`;
}

function renderLiveBirthRoll(birth, lockedTalentId, busy) {
  const root = ROOTS[birth.cultivationProfile.rootId];
  const disabled = busy ? ' disabled' : '';
  const history = ORIGIN_BACKGROUNDS[birth.originId]?.[birth.backgroundId];
  const startingItems = history ? Object.entries(initialItemsForBirth(birth))
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `${ITEMS[id]} × ${count}`).join('、') : '';
  const locks = birth.talentIds.map(id => {
    const locked = id === lockedTalentId;
    const description = liveTalentDescription(birth, id);
    const noteId = `live-talent-${esc(id)}`;
    const button = `<button type="button" class="birth-lock" data-live-lock="${esc(id)}" aria-label="锁定${esc(TALENTS[id])}" aria-pressed="${locked}"${description ? ` aria-describedby="${noteId}"` : ''}${disabled}>${esc(TALENTS[id])}<small aria-hidden="true">${locked ? '已锁定' : '锁定'}</small></button>`;
    return description ? `<div class="live-roll-talent">${button}<p id="${noteId}">${esc(description)}</p></div>` : button;
  }).join('');
  return `<section class="live-birth-roll" aria-labelledby="live-roll-title">
    <div class="birth-fate-heading"><h3 id="live-roll-title">此生命签</h3><button type="button" class="button birth-reroll" data-live-reroll aria-describedby="live-roll-result"${disabled}><span class="birth-dice" aria-hidden="true">⚄</span>再掷一次</button></div>
    <div id="live-roll-result" aria-live="polite" aria-atomic="true">
      <dl class="live-roll-facts"><div><dt>出身</dt><dd${history ? ' aria-describedby="live-origin-history"' : ''}>${esc(ORIGINS[birth.originId])}</dd></div><div><dt>根骨</dt><dd>${esc(birth.attributes.constitution)}<small> / 6</small></dd></div><div><dt>悟性</dt><dd>${esc(birth.attributes.insight)}<small> / 6</small></dd></div></dl>
      ${history ? `<div class="live-roll-background"><p id="live-origin-history">${esc(history)}</p><p class="live-birth-kit">随身带着${esc(startingItems)}。</p></div>` : ''}
      <p class="live-roll-root"><strong>${esc(root.name)}</strong><span>${esc(root.advantage)}${esc(root.defect)}</span></p>
      <span class="live-sr-only">天赋：${birth.talentIds.map(id => esc(TALENTS[id])).join('、')}</span>
    </div>
    <p id="live-lock-help" class="birth-lock-help">可锁定一个天赋，重掷时保留。</p>
    <div class="live-roll-talents" role="group" aria-label="天赋" aria-describedby="live-lock-help">${locks}</div>
  </section>`;
}

export function renderLiveBirth({ name = '', birth, lockedTalentId, available = false, busy = false, invalid = false, error = '' } = {}) {
  return `<section class="birth live-birth"><h2 id="journey-current-title" class="live-sr-only" tabindex="-1">留下名讳</h2>
    <p class="live-birth-greeting">大道无情，仙路崎岖。 凡人，留下你的名讳，准备踏入这残酷而浩瀚的修仙界：</p>
    <form id="live-birth-form"><label for="live-name">名讳</label>
      <input id="live-name" name="name" autocomplete="off" spellcheck="false" maxlength="24" aria-required="true" value="${esc(name)}"${busy ? ' disabled' : ''}${invalid ? ' aria-invalid="true" aria-describedby="live-name-error"' : ''}>
      ${invalid ? '<p id="live-name-error" class="notice error" role="alert">姓名无法用于故事，请修改后重新开始。支持中文姓名与常用标点。</p>' : ''}
      ${birth ? renderLiveBirthRoll(birth, lockedTalentId, busy) : ''}
      ${error ? `<p class="notice error" role="status">${esc(error)}</p>` : ''}
      <button type="submit" class="button primary birth-start" data-live-start${!available || !birth || busy ? ' disabled' : ''}>${busy ? '正在安放此身…' : '就以此身，入世'}</button>
    </form></section>`;
}

export function renderBirth(creation) {
  if (creation.origins) return renderCampaignBirth(creation);
  const command = `data-revision="${esc(creation.revision)}" data-scene-id="${esc(creation.sceneId)}"`;
  return `<section class="birth" aria-labelledby="birth-title"><header class="birth-heading"><p class="birth-kicker">一纸姓名，一世山河</p><h2 id="birth-title" tabindex="-1">此生，你是谁？</h2><p>十六岁，山外的路还很长。先留下你的名字，再看看与生俱来的天资。</p></header><form id="birth-form" novalidate><div class="birth-name-field"><label for="birth-name">此生姓名</label><input type="text" id="birth-name" name="birth-name" autocomplete="off" spellcheck="false" maxlength="24" aria-required="true" aria-describedby="birth-name-help birth-name-error" value="${esc(creation.name)}" placeholder="为此生取一个名字"><p id="birth-name-help" class="birth-name-help">一至二十四字，江湖会记住这个名字。</p><p id="birth-name-error" class="birth-name-error" role="status" aria-live="polite"></p></div><section class="birth-fate" aria-labelledby="birth-fate-title"><div class="birth-fate-heading"><h3 id="birth-fate-title">与生俱来</h3><button type="button" class="button birth-reroll" data-birth-reroll ${command}><span class="birth-dice" aria-hidden="true">⚄</span>再掷一次</button></div><div class="birth-roll" aria-live="polite" aria-atomic="true">${renderAttributes(creation.attributes ?? [])}<div class="birth-talent"><span class="birth-talent-label">天赋</span>${renderTalents(creation.talents ?? [])}</div><p class="birth-roll-count">第 ${esc(creation.rollCount)} 次掷骰</p></div></section><div class="birth-actions"><p>天资随身，际遇还要亲自走过。</p><button type="submit" class="button primary birth-start" data-birth-start ${command}>就以此身，入世</button></div></form></section>`;
}

function renderCampaignBirth(creation) {
  const command = `data-revision="${esc(creation.revision)}" data-scene-id="${esc(creation.sceneId)}"`;
  const origins = creation.origins.map(origin => `<button type="button" class="birth-origin" data-birth-origin="${esc(origin.id)}" aria-pressed="${origin.id === creation.originId}" ${command}>${esc(origin.name)}</button>`).join('');
  const fates = (creation.talents ?? []).map(talent => `<article class="birth-fate-card"><div class="birth-fate-card-heading"><h4>${esc(talent.name)}</h4><button type="button" class="birth-lock" data-birth-lock="${esc(talent.id)}" aria-pressed="${talent.id === creation.lockedTalentId}" aria-label="${talent.id === creation.lockedTalentId ? '取消锁定' : '锁定'}${esc(talent.name)}" ${command}>${talent.id === creation.lockedTalentId ? '已锁定' : '锁定'}</button></div><p>${esc(talent.description)}</p></article>`).join('');
  return `<section class="birth birth-campaign" aria-labelledby="birth-title"><header class="birth-heading"><p class="birth-kicker">一纸命签，一世仙途</p><h2 id="birth-title" tabindex="-1">此生，你是谁？</h2><p>出身决定你从何处走来，命格会为你打开不同的门。</p></header><form id="birth-form" novalidate><div class="birth-name-field"><label for="birth-name">此生姓名</label><input type="text" id="birth-name" name="birth-name" autocomplete="off" spellcheck="false" maxlength="24" aria-required="true" aria-describedby="birth-name-help birth-name-error" value="${esc(creation.name)}" placeholder="为此生取一个名字"><p id="birth-name-help" class="birth-name-help">一至二十四字，江湖会记住这个名字。</p><p id="birth-name-error" class="birth-name-error" role="status" aria-live="polite"></p></div><section class="birth-origin-section" aria-labelledby="birth-origin-title"><h3 id="birth-origin-title">从何处来</h3><div class="birth-origins" role="group" aria-label="选择此生出身">${origins}</div><p class="birth-hook" aria-live="polite">${esc(creation.origin?.hook ?? creation.origin?.description ?? '')}</p></section><section class="birth-fate" aria-labelledby="birth-fate-title"><div class="birth-fate-heading"><h3 id="birth-fate-title">两道命格</h3><button type="button" class="button birth-reroll" data-birth-reroll ${command}><span class="birth-dice" aria-hidden="true">⚄</span>再掷一次</button></div><p class="birth-lock-help">可锁定其中一道，再掷另一道与资质。每种命格都有机缘，也有代价。</p><div class="birth-roll" aria-live="polite" aria-atomic="true"><div class="birth-fate-pair">${fates}</div><details class="birth-attributes"><summary>资质 · 总计 ${esc(creation.attributeBudget)} 点</summary>${renderAttributes(creation.attributes ?? [])}</details><p class="birth-roll-count">第 ${esc(creation.rollCount)} 次掷骰</p></div></section><div class="birth-actions"><p>此身落定，往后的路由你选择。</p><button type="submit" class="button primary birth-start" data-birth-start ${command}>就以此身，入世</button></div></form></section>`;
}

export function liveCharacterSummary(state, catalogs) {
  const life=state.life,days=life.ageDays,profile=life.cultivationProfile,birth=life.birth.cultivationProfile;
  const v7=profile?.version===7,generation=state.reincarnation?.generation??1;
  const currentGoal=state.director?.currentGoal??state.director?.mainQuest?.text??state.director?.mystery?.question??state.director?.destiny?.text;
  const experience=profile?.experience,method=experience&&TECHNIQUES[experience.activeTechniqueId];
  const details=v7?{
    lifespanText:`${(days/360).toFixed(1)} / ${life.lifeLimit}岁`,
    currentGoal,
    ...(method?{currentTechnique:{name:method.name,status:experience.repaired?'已修补':method.defective?'尚未修补':'完整',advantage:method.advantage,cost:experience.repaired?'原有功法缺陷已解除。':method.defect}}:{}),
    statusFacts:[['气血',`${Math.max(0,10-life.injury)*10}%`],...(Number.isFinite(profile.spirit)?[['灵力',`${profile.spirit} / ${profile.maxSpirit}`]]:[]),['修为',String(life.cultivation)],['灵石',String(life.items.stones??0)],...(WORLD_TIERS[profile.worldTier]?[['天地',WORLD_TIERS[profile.worldTier]]]:[]),...(profile.exposure?[['身份暴露',String(profile.exposure)]]:[]),...(state.currentScene?.location?[['所在地',state.currentScene.location]]:[]),...(currentGoal?[['当前目标',currentGoal]]:[])],
    birthTraits:[ROOTS[birth?.rootId],PHYSIQUES[birth?.physiqueId],RELICS[birth?.relicId],TECHNIQUES[birth?.techniqueId]].filter(Boolean),
    inheritedBenefits:(birth?.inheritedBenefits??[]).map(id=>INHERITED_BENEFITS[id]).filter(Boolean),
    abilities:Object.entries(profile.arts??{}).filter(([,level])=>level>0).map(([id,level])=>({name:ART_NAMES[id],description:`造诣 ${level}`})),
  }:{remainingLifeText:yearsText((life.lifeLimit*360-days)/360)};
  const origin = {name:catalogs.ORIGINS[life.birth.originId], history:ORIGIN_BACKGROUNDS[life.birth.originId]?.[life.birth.backgroundId]};
  const talents = life.birth.talentIds.map(id => ({name:catalogs.TALENTS[id], description:liveTalentDescription(life.birth, id)}));
  return {name:life.name,generationLabel:v7?`第${generation}世`:'实时人生',generation,realmName:realmFor(life)?.name??catalogs.REALMS[life.realm]?.name??life.realm,ageText:`${Math.floor(days/360)}岁${days%360?`${days%360}日`:''}`,...details,lifeLimit:life.lifeLimit,lifeDamage:0,injuryName:life.injury?`伤势 ${life.injury} / 10`:'无碍',origin,attributes:Object.entries(life.birth.attributes).filter(([id])=>!v7||id!=='fortune').map(([id,value])=>({name:({constitution:'根骨',insight:'悟性',fortune:'气运'})[id],value})),talents,items:Object.entries(life.items).filter(([,count])=>count>0).map(([id,count])=>({name:catalogs.ITEMS[id]??id,count}))};
}
