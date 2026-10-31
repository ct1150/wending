import { DAYS_PER_YEAR, ORIGINS, TALENTS, ITEMS, REALMS, LEGACY_INTENTS } from './model.js';
import { isV7Life, summarizeLife, createCultivationBirthProfile, initialLifeForBirth, v7ActionRule, resolveV7Action } from './cultivation-rules.js';
import { assertPlainData, canonicalStringify, sha256, stateHash } from './identity.js';
import { exactKeys, idField, textField, validateProposal, validateGeneratedScene } from './schema.js';
import { validateLiveState } from './validation.js';
import { resolveCustomAction, replayCustomAction, customActionCommand, CUSTOM_ACTION_MESSAGE } from './custom-actions.js';
import { createStoryDirector, advanceStoryDirector } from './story-director.js';
import { validateReincarnation } from './reincarnation.js';
import { advanceRetrievalMemory } from './retrieval-memory.js';
const copy = value => JSON.parse(JSON.stringify(value));
const nextRandom = value => (Math.imul(value,1664525)+1013904223)>>>0;
const summary = summarizeLife;
const same = (a,b) => canonicalStringify(a)===canonicalStringify(b);
function requireActive(state) { validateLiveState(state);if(state.phase!=='active')throw new Error('此生尚未开场或已经死亡。'); }
export function createLiveGame(options={}) {
 assertPlainData(options);exactKeys(options,[],['runId','seed','name','originId','engineVersion','inheritedBenefits','reincarnation','experienceVersion']);
 if(options.engineVersion!==undefined&&options.engineVersion!==7||options.inheritedBenefits!==undefined&&options.engineVersion!==7)throw new Error('修行引擎版本无效。');
 if(Object.hasOwn(options,'experienceVersion')&&(options.experienceVersion!==1||options.engineVersion!==7))throw new Error('新体验版本无效。');
 if(options.reincarnation!==undefined){if(options.engineVersion!==7)throw new Error('轮回须进入新的修行人生。');validateReincarnation(options.reincarnation);}
 const name=(options.name??'云归').trim();textField(name,24);if(/[\r\n]/.test(name))throw new Error('姓名不能换行。');
 const originId=options.originId??'village';if(!Object.hasOwn(ORIGINS,originId))throw new Error('出身无效。');
 const runId=options.runId??globalThis.crypto.randomUUID();idField(runId);
 const seed=options.seed??runId;if(!['string','number'].includes(typeof seed)||typeof seed==='number'&&!Number.isFinite(seed)||String(seed).length>200)throw new Error('种子无效。');
 let rng=parseInt(sha256(String(seed)).slice(0,8),16);const draw=limit=>{rng=nextRandom(rng);return rng%limit;};
 const attributes={constitution:1,insight:1,fortune:1},names=Object.keys(attributes);for(let n=0;n<9;n++){const eligible=names.filter(id=>attributes[id]<6);attributes[eligible[draw(eligible.length)]]++;}
 const talents=Object.keys(TALENTS),first=talents.splice(draw(talents.length),1)[0],birth={originId,talentIds:[first,talents[draw(talents.length)]],attributes};
 if(options.engineVersion===7)birth.cultivationProfile=createCultivationBirthProfile(draw,options.inheritedBenefits??[],options.experienceVersion);
 const life=initialLifeForBirth(name,birth);
 const birthReceipt={kind:'opening',choiceId:null,action:null,elapsedDays:0,itemChanges:{},relationChanges:{},random:{before:rng,after:rng,roll:null},before:summary(life),after:summary(life),death:null,birth:copy(birth)};
 if(isV7Life(life))birthReceipt.cultivationResult={version:7,check:null,lifespanChange:{years:0,cause:null}};
 return validateLiveState({relationshipVersion:1,version:5,mode:'cultivation',contentVersion:4,rulesVersion:1,promptVersion:1,runId,revision:0,turnId:0,phase:'awaitingOpening',rng,life,birthReceipt,currentScene:null,lastReceipt:null,relatedEntities:[],archiveCursor:0,...(isV7Life(life)?{director:createStoryDirector(life,rng)}:{}),...(options.reincarnation?{reincarnation:copy(options.reincarnation)}:{})});
}
function actionRule(state,p) {
 validateProposal(p);
 if(isV7Life(state.life))return v7ActionRule(state,p);
 if(!LEGACY_INTENTS[p.intent]?.includes(p.approach))throw new Error('此生尚无此种行动。');
 const life=state.life,rule={days:30,items:{},gain:{},cultivation:0,injury:0,relationship:0,risk:0,realm:null},entity=state.relatedEntities.find(e=>e.id===p.targetId);
 const target=(ok)=>{if(!ok)throw new Error('行动目标不属于可执行规则。');};
 const factor=p.stake==='high'?2:p.stake==='low'?0:1;
 switch(p.intent){
 case 'rest':target(p.targetId==='self');rule.days=p.approach==='retire'?360:30;rule.injury=p.approach==='retire'?-1:-2;break;
 case 'practice':
  if(p.approach==='breakthrough'){target(Object.hasOwn(REALMS,p.targetId)&&REALMS[p.targetId].rank===REALMS[life.realm].rank+1);const realm=REALMS[p.targetId];rule.days=realm.minYears*DAYS_PER_YEAR;rule.items[realm.material]=1;rule.cultivation=-realm.threshold;rule.realm=p.targetId;if(life.cultivation<realm.threshold)rule.reason='修为积累不足。';if(life.injury>1)rule.reason='伤势过重，须先疗伤。';}
  else{target(p.targetId==='self');rule.days=p.approach==='intensive'?180:360;rule.cultivation=p.approach==='intensive'?2:1;if(p.approach==='intensive'){rule.items.supplies=1;rule.risk=25;}}
  break;
 case 'explore':{
  target(['supplies','stones','manual','crystal','core','soulseal','skykey','relic','iron'].includes(p.targetId));rule.days=p.approach==='cautious'?90:30;rule.gain[p.targetId]=p.approach==='bold'?2:1;rule.risk=p.approach==='bold'?30+factor*10:5;const needed=Object.values(REALMS).find(r=>r.material===p.targetId);if(needed&&REALMS[life.realm].rank<needed.rank-1)rule.reason='境界尚不足以寻找此种材料。';break;}
 case 'negotiate':
  target(entity&&entity.status!=='dead'&&['person','faction'].includes(entity.kind));rule.days=7;
  if(p.approach==='cooperate'){rule.items.supplies=1;rule.relationship=3;rule.gain.stones=1;}
  else if(p.approach==='bargain'){rule.items.stones=1;rule.gain.supplies=2;rule.relationship=1;}
  else{rule.relationship=-3;rule.gain.stones=2;rule.injury=1;rule.risk=20;}
  break;
 case 'fight':target(entity&&entity.status!=='dead'&&['person','faction'].includes(entity.kind));rule.days=7;rule.injury=p.approach==='guard'?1:p.approach==='assault'?2:3;rule.injury+=factor;rule.risk=30;rule.gain.stones=p.approach==='guard'?1:3;rule.relationship=-5;break;
 case 'evade':target(entity&&entity.status!=='dead'&&['person','faction'].includes(entity.kind));rule.days=p.approach==='withdraw'?14:30;rule.risk=p.approach==='withdraw'?15:0;rule.relationship=-1;break;
 case 'travel':target(entity&&entity.kind==='place');rule.days=p.approach==='road'?30:60;rule.items.supplies=1;rule.risk=p.approach==='wilderness'?25:0;break;
 case 'craft':target((p.targetId==='manual'&&p.approach==='study')||(p.targetId==='talisman'&&p.approach==='forge'));rule.days=p.approach==='study'?180:30;rule.items.stones=p.approach==='study'?2:1;if(p.approach==='forge')rule.items.iron=2;rule.gain[p.targetId]=1;break;
 case 'interact':
  target(p.stake==='low');rule.days=p.approach==='help'?1:0;
  if(p.approach==='ask'||p.approach==='decline')target(entity&&entity.status!=='dead'&&['person','faction'].includes(entity.kind));
  else if(p.approach==='help'){target(entity&&entity.kind==='person'&&entity.status!=='dead');rule.items.supplies=1;rule.relationship=2;}
  else target(p.targetId==='self'||entity&&(p.approach==='observe'||entity.status!=='dead'));
  break;
 }
 for(const [id,n] of Object.entries(rule.items))if((life.items[id]??0)<n)rule.reason='缺少'+ITEMS[id]+'。';
 for(const [id,n] of Object.entries(rule.gain))if((life.items[id]??0)-(rule.items[id]??0)+n>9999)rule.reason='行囊已经装不下。';
 if(rule.cultivation>0&&life.cultivation+rule.cultivation>9999)rule.reason='当前修为已积累至上限。';
 return rule;
}
export function compileChoices(state,proposals) {
 validateLiveState(state);assertPlainData(proposals);if(!Array.isArray(proposals)||proposals.length>3)throw new Error('行动数量无效。');const seen=new Set();
 return proposals.map(p=>{if(seen.has(p.id))throw new Error('行动标识重复。');seen.add(p.id);const rule=actionRule(state,p),warnings=[];
  if(isV7Life(state.life))return {...copy(p),enabled:!rule.reason,reason:rule.reason??null,costs:{days:rule.days,items:copy(rule.items),spirit:rule.spiritCost,lifeYears:rule.lifeLoss},warnings:[...rule.warnings]};
  if(rule.risk)warnings.push('历练受伤基础风险'+rule.risk+'%，根骨与坚韧筋骨可降低风险。');if(rule.injury>0)warnings.push('将增加'+rule.injury+'点伤势；伤势达到10即死亡。');if(state.life.ageDays+rule.days>=state.life.lifeLimit*DAYS_PER_YEAR)warnings.push('余寿不足，将在途中寿尽，得不到行动成果。');return {...copy(p),enabled:!rule.reason,reason:rule.reason??null,costs:{days:rule.days,items:copy(rule.items)},warnings};});
}
function identity(state,requestId,choiceId) {idField(requestId);return {runId:state.runId,turnId:state.turnId+1,baseRevision:state.revision,stateHash:stateHash(state),choiceId,rulesVersion:state.rulesVersion,promptVersion:state.promptVersion,requestId};}
export function prepareOpening(state,command) {validateLiveState(state);assertPlainData(command);exactKeys(command,['requestId']);if(state.phase!=='awaitingOpening')throw new Error('出生已经开场。');return {kind:'opening',identity:identity(state,command.requestId,null),receipt:copy(state.birthReceipt),nextLife:copy(state.life),nextRng:state.rng};}
export function prepareChoice(state,command) {
 return prepareChoiceWithResolver(state,command,resolveCustomAction);
}
// Internal replay seam for recorded pending turns and JSONL history. Callers
// still compare the complete identity/receipt (and next state when available).
export function prepareRecordedChoice(state,recorded) {
 assertPlainData(recorded);
 return prepareChoiceWithResolver(state,customActionCommand(recorded),replayCustomAction);
}
function prepareChoiceWithResolver(state,command,resolveCustom) {
 requireActive(state);assertPlainData(command);exactKeys(command,['requestId'],['choiceId','customAction','baseRevision','stateHash']);
 const custom=Object.hasOwn(command,'customAction');
 if(command.choiceId!==undefined)idField(command.choiceId);
 if(custom&&!isV7Life(state.life))throw Object.assign(new Error(CUSTOM_ACTION_MESSAGE),{code:'CUSTOM_ACTION_UNSUPPORTED'});
 if(command.baseRevision!==undefined&&command.baseRevision!==state.revision||command.stateHash!==undefined&&command.stateHash!==stateHash(state))throw new Error('行动基准已经过期。');
 const action=custom?resolveCustom(state,command.customAction):state.currentScene.choices.find(p=>p.id===command.choiceId);if(!action)throw new Error('当前场景没有此行动。');
 if(custom&&command.choiceId!==undefined&&command.choiceId!==action.id)throw Object.assign(new Error(CUSTOM_ACTION_MESSAGE),{code:'CUSTOM_ACTION_UNSUPPORTED'});
 let rule;try{rule=actionRule(state,action);}catch(error){if(custom)throw Object.assign(new Error(CUSTOM_ACTION_MESSAGE),{code:'CUSTOM_ACTION_UNSUPPORTED'});throw error;}
 if(rule.reason){if(custom)throw Object.assign(new Error(CUSTOM_ACTION_MESSAGE),{code:'CUSTOM_ACTION_UNSUPPORTED'});throw new Error(rule.reason);}
 const nextRng=nextRandom(state.rng),roll=nextRng%100;
 let nextLife,elapsedDays,death,cultivationResult;
 if(isV7Life(state.life))({nextLife,elapsedDays,death,result:cultivationResult}=resolveV7Action(state.life,action,rule,roll,state.turnId+1));
 else {
 nextLife=copy(state.life);const remaining=nextLife.lifeLimit*DAYS_PER_YEAR-nextLife.ageDays;elapsedDays=Math.min(remaining,rule.days);
 for(const [id,n] of Object.entries(rule.items))nextLife.items[id]-=n;
 nextLife.ageDays+=elapsedDays;death=elapsedDays>=remaining?{cause:'lifespan'}:null;
 if(!death){
  const protection=nextLife.birth.attributes.constitution+(nextLife.birth.talentIds.includes('iron-bones')?10:0);
  nextLife.injury=Math.max(0,Math.min(10,nextLife.injury+rule.injury+(roll<Math.max(0,rule.risk-protection)?1:0)));
  if(nextLife.injury>=10)death={cause:'injury'};
  else{
   for(const [id,n] of Object.entries(rule.gain))nextLife.items[id]=(nextLife.items[id]??0)+n;
   nextLife.cultivation+=rule.cultivation;
   if(rule.realm){nextLife.realm=rule.realm;nextLife.lifeLimit=REALMS[rule.realm].lifeLimit;}
   if(rule.relationship)nextLife.relations[action.targetId]=Math.max(-100,Math.min(100,(nextLife.relations[action.targetId]??0)+rule.relationship));
  }
 }
 }
 const itemChanges={};for(const id of Object.keys(ITEMS)){const delta=(nextLife.items[id]??0)-(state.life.items[id]??0);if(delta)itemChanges[id]=delta;}
 const relationChanges={};for(const [id,n] of Object.entries(nextLife.relations)){const delta=n-(state.life.relations[id]??0);if(delta)relationChanges[id]=delta;}
 const receipt={kind:'choice',choiceId:action.id,action:copy(action),elapsedDays,itemChanges,relationChanges,random:{before:state.rng,after:nextRng,roll},before:summary(state.life),after:summary(nextLife),death,birth:null};
 if(cultivationResult)receipt.cultivationResult=cultivationResult;
 return {kind:'choice',identity:identity(state,command.requestId,action.id),receipt,nextLife,nextRng};
}
function verifiedPending(state,pending) {
 validateLiveState(state);assertPlainData(pending);exactKeys(pending,['kind','identity','receipt','nextLife','nextRng']);exactKeys(pending.identity,['runId','turnId','baseRevision','stateHash','choiceId','rulesVersion','promptVersion','requestId']);
 const expected=pending.kind==='opening'?prepareOpening(state,{requestId:pending.identity.requestId}):pending.kind==='choice'?prepareRecordedChoice(state,pending):null;
 if(!expected||!same(pending,expected))throw new Error('待提交行动已过期或收据遭到修改。');return expected;
}
export function resolveImmediateInteraction(state,pending) {
 const fixed=verifiedPending(state,pending),action=fixed.receipt.action;
 if(action?.intent!=='interact'||!['decline','leave'].includes(action.approach)||fixed.receipt.death)throw new Error('此行动须继续生成剧情。');
 const prefix='r:'+sha256(state.runId).slice(0,16)+':t'+fixed.identity.turnId+':',location=state.currentScene.location,actor=state.relatedEntities.find(entity=>entity.id===action.targetId),routes=state.currentScene.choices.filter(choice=>choice.intent==='travel'&&state.relatedEntities.some(entity=>entity.id===choice.targetId&&entity.kind==='place'&&entity.name!==location)&&compileChoices(state,[choice])[0].enabled).slice(0,2);
 const choices=[{id:prefix+'c:observe',label:'观察周围：寻找新的线索',intent:'interact',targetId:'self',stake:'low',approach:'observe'},...routes.map((choice,index)=>({...copy(choice),id:prefix+'c:travel'+index}))];
 if(choices.length===1)choices.push({id:prefix+'c:rest',label:'留在原地休整',intent:'rest',targetId:'self',stake:'low',approach:'recover'});
 const entities=state.relatedEntities.filter(entity=>entity.id===action.targetId||routes.some(choice=>choice.targetId===entity.id));
 const decision=actor&&['person','faction'].includes(actor.kind)?(action.approach==='decline'?'你婉拒了'+actor.name+'的请求，结束了这次交谈。':'你向'+actor.name+'告辞，结束了这次交谈。'):'你结束了眼前的互动。';
 let text=decision+'你仍在原处，接下来可以自行观察或行动。';
 if(same(state.currentScene.blocks,[{kind:'narration',text}]))text+='此事暂且搁下，你可以按自己的打算行动。';
 return validateGeneratedScene({id:prefix+'s:closed',title:'暂别此事',location,blocks:[{kind:'narration',text}],entities:copy(entities),choices,memoryDeltas:[]});
}
// Only the scene's bounded working set enters snapshots and their hashes.
// Restored values come from indexed rule records, never narrative descriptions.
export function projectRelations(life,entities,restored={}) {
 assertPlainData(restored);
 if(!restored||typeof restored!=='object'||Array.isArray(restored)||Object.keys(restored).length>48)throw new Error('人物关系无效。');
 for(const [id,value] of Object.entries(restored)){idField(id);if(!Number.isInteger(value)||value < -100||value > 100)throw new Error('人物关系无效。');}
 return Object.fromEntries(Object.entries({...restored,...life.relations}).filter(([id])=>entities.some(e=>e.id===id)));
}
export function commitTurn(state,pending,scene,restoredRelations={}) {
 const fixed=verifiedPending(state,pending);if(fixed.receipt.death)throw new Error('真实死亡须本地结算。');validateGeneratedScene(scene);
 const relatedEntities=copy(scene.entities);
 // Every current target and memory reference must have an explicit stable entity.
 for(const m of scene.memoryDeltas)if(!relatedEntities.some(e=>e.id===m.entityId))throw new Error('记忆引用未知实体。');
 const life=copy(fixed.nextLife);life.relations=projectRelations(life,relatedEntities,state.relationshipVersion===1?restoredRelations:{});
 const next={...copy(state),...(scene.choices.some(choice=>choice.intent==='interact')?{relationshipVersion:1}:{}),revision:state.revision+1,turnId:state.turnId+1,phase:'active',life,rng:fixed.nextRng,lastReceipt:copy(fixed.receipt),currentScene:copy(scene),relatedEntities};
 const retrieval=advanceRetrievalMemory(state.retrieval,scene.retrieval);if(retrieval)next.retrieval=retrieval;
 if(state.director)next.director=advanceStoryDirector(state.director,life,fixed.receipt,scene,next.turnId);
 const choices=compileChoices(next,scene.choices);if(!choices.some(p=>p.enabled))throw new Error('场景必须保留可执行行动。');return validateLiveState(next);
}
export function settleDeath(state,pending) {const fixed=verifiedPending(state,pending);if(!fixed.receipt.death)throw new Error('尚未真实死亡。');return validateLiveState({...copy(state),revision:state.revision+1,turnId:state.turnId+1,phase:'dead',life:copy(fixed.nextLife),rng:fixed.nextRng,lastReceipt:copy(fixed.receipt),currentScene:null,...(state.director?{director:advanceStoryDirector(state.director,fixed.nextLife,fixed.receipt,null,state.turnId+1)}:{})});}
