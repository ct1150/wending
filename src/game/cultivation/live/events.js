import {assertPlainData,canonicalStringify,sha256} from './identity.js';
import {exactKeys} from './schema.js';
import {ITEMS,DAYS_PER_YEAR} from './model.js';
import {initialV7ActionRule} from './cultivation-rules.js';
import {eventNode,eventEntities,eventLocation} from './event-content.js';
import {riverCases,validateRiver} from './river-chronicle.js';
import {validateExpedition} from './expedition.js';
import {councilHearings,validateCouncil} from './mountain-council.js';
import {validateConvoy} from './sea-convoy.js';
import {validateValley} from './mist-valley.js';

const eventNodeIds=new Set([
 'arrival','terms','work','entry-result','companion','companion-result','reunion','reunion-result',
 'hub','training','rest','journey','resources','workshop','crossing','affairs','mentor','mentor-result','old-record','action-result',
 'river-book','river-site','river-reading','river-decision','river-result',
 'voyage-book','voyage-road','voyage-camp','voyage-log','voyage-reset','voyage-result','voyage-detour',
 'council-book','council-result',
 'convoy-book','convoy-plan','convoy-crew','convoy-stores','convoy-check','convoy-result','convoy-arrival',
 'convoy-cross','convoy-board','convoy-board-notes','convoy-test-result','convoy-remote',
 'convoy-ear-book','convoy-ear-open','convoy-ear-read','convoy-ear-table','convoy-ear-good','convoy-ear-miss','convoy-ear-receipt',
 'convoy-concert-plan','convoy-concert-visits','convoy-concert-last','convoy-concert-check','convoy-concert-result',
 'field-guide','field-camp','field-bank','field-grove','field-kiln','field-shrine','field-spar','field-proof','field-source','field-banks','field-ending',
]);
const copy=value=>JSON.parse(JSON.stringify(value));
export function createEventState(atlas){return {version:1,node:'arrival',entry:'unresolved',companion:'unmet',mentor:'unmet',page:0,location:'gate',...(atlas?copy(atlas):{})};}
export function validateEventState(events){
 assertPlainData(events);exactKeys(events,['version','node','entry','companion','mentor','page','location'],['river','expedition','council','convoy','valley']);
 if(!eventNodeIds.has(events.node))throw new Error('规则事件节点无效。');
 if(Object.hasOwn(events,'council'))validateCouncil(events.council);
 if(Object.hasOwn(events,'convoy'))validateConvoy(events.convoy);
 if(Object.hasOwn(events,'valley'))validateValley(events.valley);
 if((events.valley||events.node.startsWith('field-'))&&!events.river?.record.length)throw new Error('雾药谷游记尚未开卷。');
 if(['field-source','field-banks','field-ending'].includes(events.node)&&!events.valley?.pass||events.node==='field-ending'&&!events.valley?.settled||events.node==='field-proof'&&!(events.valley?.remedy||events.valley?.sleeve))throw new Error('雾药谷游记页次无效。');
 if((events.convoy||events.node.startsWith('convoy-'))&&events.council?.length!==councilHearings)throw new Error('海路尚未开卷。');
 if(events.node==='convoy-result'&&!events.convoy?.chapters.at(-1)?.loads.length)throw new Error('海路缺少到港记录。');
 if(events.node.startsWith('convoy-ear-')){
  const score=events.convoy?.resonance;
  if(events.convoy?.chapters[0]?.loads.length!==2||events.node==='convoy-ear-good'&&score?.trial!=='proved'||events.node==='convoy-ear-miss'&&score?.trial!=='miss'||events.node==='convoy-ear-receipt'&&!score?.decisions.length)throw new Error('听息谱页次无效。');
 }
 if(events.node.startsWith('convoy-concert-')){
  const score=events.convoy?.resonance;
  if(score?.decisions.length!==6||events.node!=='convoy-concert-plan'&&!score.concert||events.node==='convoy-concert-result'&&!score.concert?.performed)throw new Error('归航合奏页次无效。');
 }
 if((events.council!==undefined||events.node.startsWith('council-'))&&events.expedition?.place!=='end'||events.node==='council-result'&&!events.council)throw new Error('北山公簿页次无效。');
 if(Object.hasOwn(events,'river'))validateRiver(events.river);
 if(Object.hasOwn(events,'expedition'))validateExpedition(events.expedition);
 if((events.expedition||events.node.startsWith('voyage-'))&&events.river?.record.length!==riverCases||events.node==='voyage-result'&&!events.expedition?.volume)throw new Error('行旅录页次无效。');
 if(events.node==='river-result'&&!events.river?.record.length||events.node==='river-reading'&&!events.river?.seen||['river-site','river-reading','river-decision'].includes(events.node)&&events.river?.record.length===riverCases)throw new Error('问川图页次无效。');
 if(events.version!==1||!['unresolved','accepted','joined','declined'].includes(events.entry)||!['unmet','helped','declined','completed','parted'].includes(events.companion)||!['unmet','guided','self','repaid'].includes(events.mentor)||!Number.isInteger(events.page)||events.page<0||events.page>4||!['gate','retreat','middle','upper'].includes(events.location))throw new Error('规则事件状态无效。');
 return events;
}
function selected(state,action){
 const prefix='r:'+sha256(state.runId).slice(0,16)+':t'+state.turnId+':c:';
 const option=eventNode(state).choices.find(row=>prefix+row.key===action.id);
 if(!option||['label','intent','targetId','approach','stake'].some(key=>option[key]!==action[key]))throw new Error('规则事件行动不符。');
 return option;
}
export function eventActionRule(state,proposal,baseRule){
 const option=selected(state,proposal);
 if(option.navigation)return {...initialV7ActionRule(0),eventNavigation:true};
 if(!option.rule)return baseRule;
 const rule={...initialV7ActionRule(0),...copy(option.rule)};
 for(const [id,count] of Object.entries(rule.items))if((state.life.items[id]??0)<count)rule.reason='缺少'+ITEMS[id]+'。';
 for(const [id,count] of Object.entries(rule.gain)){
  const room=9999-(state.life.items[id]??0)+(rule.items[id]??0);
  if(count<=room)continue;
  if(!option.optionalGift){rule.reason='行囊已经装不下。';continue;}
  if(room>0)rule.gain[id]=room;else delete rule.gain[id];
  rule.warnings.push(ITEMS[id]+'剩余容量为'+room+'，多出的赠礼留给当地。');
 }
 if(state.life.cultivationProfile.spirit<rule.spiritCost)rule.reason='灵力不足，须先调息。';
 if(state.life.ageDays+rule.days>=state.life.lifeLimit*DAYS_PER_YEAR)rule.warnings.push('此行动无法在当前寿元上限前完成，途中寿尽将无法得到成果。');
 return rule;
}
export function advanceEvents(state,receipt){
 const events=copy(state.events);
 if(receipt.kind==='opening'||receipt.death)return events;
 const option=selected(state,receipt.action),success=receipt.cultivationResult?.check?.success!==false;
 events.node=option.next??'hub';
 if(success&&option.patch)Object.assign(events,copy(option.patch));
 if(success&&option.arrival)events.location=option.arrival;
 return validateEventState(events);
}
export function resolveEventScene(state,pending){
 const events=advanceEvents(state,pending.receipt),prospective={...state,life:pending.nextLife,events,lastReceipt:pending.receipt,turnId:pending.identity.turnId};
 const definition=eventNode(prospective),prefix='r:'+sha256(state.runId).slice(0,16)+':t'+pending.identity.turnId+':';
 return {id:prefix+'s:event_'+events.node,title:definition.title,location:eventLocation(prospective),blocks:copy(definition.blocks),entities:eventEntities(prospective),choices:definition.choices.map(({key,label,intent,targetId,stake,approach})=>({id:prefix+'c:'+key,label,intent,targetId,stake,approach})),memoryDeltas:[]};
}
export function assertRuleScene(state,pending,scene){
 if(canonicalStringify(scene)!==canonicalStringify(resolveEventScene(state,pending)))throw new Error('规则事件场景不可由生成内容改写。');
}
export function eventGoal(state){return state.events?eventNode(state).goal:null;}
