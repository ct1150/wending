import {assertPlainData,canonicalStringify,sha256} from './identity.js';
import {exactKeys} from './schema.js';
import {ITEMS,DAYS_PER_YEAR} from './model.js';
import {initialV7ActionRule,realmFor,nextRealmFor} from './cultivation-rules.js';
import {eventNode,eventEntities,eventLocation} from './event-content.js';
import {riverCases,validateRiver} from './river-chronicle.js';
import {validateExpedition} from './expedition.js';
import {councilHearings,validateCouncil} from './mountain-council.js';
import {validateConvoy} from './sea-convoy.js';
import {validateCharters} from './harbor-charters.js';
import {validateNursery} from './entry-nursery.js';
import {validateSaltField} from './salt-field.js';
import {validateRidgeRoad} from './ridge-road.js';
import {validateForms} from './technique-forms.js';
import {validateValley} from './mist-valley.js';
import {validateWatch} from './retreat-watch.js';
import {validateMine} from './lamp-mine.js';
import {validateGarden} from './phenology.js';
import {validatePost} from './lin-post.js';
import {recordMountainRetreat,validateMountain} from './folded-mountain.js';
import {validateFerry} from './shell-ferry.js';
import {validateWell} from './echo-well.js';
import {validateCloudPassage} from './cloud-passage.js';

const eventNodeIds=new Set([
 'arrival','terms','work','entry-result','companion','companion-result','reunion','reunion-result',
 'work-porch','nursery-book','nursery-pot','nursery-receipt',
 'ration-book','ration-road','ration-packed','seed-book',
 'ridge-unityjade','ridge-daofruit','ridge-thunderseal',
 'form-book','form-drill','form-result','hunt-forms',
 'hub','training','rest','journey','resources','workshop','crossing','affairs','mentor','mentor-result','old-record','action-result',
 'river-book','river-site','river-reading','river-decision','river-result',
 'voyage-book','voyage-road','voyage-camp','voyage-log','voyage-reset','voyage-result','voyage-detour',
 'council-book','council-result',
 'convoy-book','convoy-plan','convoy-crew','convoy-stores','convoy-check','convoy-result','convoy-arrival',
 'convoy-cross','convoy-board','convoy-board-notes','convoy-test-result','convoy-remote',
 'convoy-yard-book','convoy-yard-duty','convoy-yard-shore','convoy-yard-boat','convoy-yard-stores','convoy-yard-shed',
 'packet-book','packet-cargo','packet-chart','packet-to-0','packet-to-1','packet-to-2','packet-moor','packet-history',
 'convoy-ear-book','convoy-ear-open','convoy-ear-read','convoy-ear-table','convoy-ear-good','convoy-ear-miss','convoy-ear-receipt',
 'convoy-concert-plan','convoy-concert-visits','convoy-concert-last','convoy-concert-check','convoy-concert-result',
 'field-guide','field-camp','field-bank','field-grove','field-kiln','field-shrine','field-spar','field-proof','field-source','field-banks','field-ending',
 'watch-book','watch-people','watch-orders','watch-sit','watch-report','watch-receipt',
 'watch-visitors','watch-trail','watch-trail-map','watch-trail-fork',
 'watch-ding-book','watch-ding-pick','watch-ding-last','watch-ding-dedicate','watch-ding-result',
 'mine-book','mine-gallery','mine-inspect','mine-decide','mine-report','mine-journal',
 'apothecary','herb-basket',
 'garden-book','garden-history','garden-practice','garden-pick','garden-ripe',
 'post-index','post-book','post-offer-later','post-traces','post-address','post-return','post-history','post-shore',
 'post-stations','post-settle','post-fog',
 'mount-book','mount-history','mount-sight','mount-sound',
 'shell-book','shell-journal','shell-parley',
 'hunt-sources','hunt-grounds','well-book','well-road','sky-book','sky-boat','sky-shore',
]);
const copy=value=>JSON.parse(JSON.stringify(value));
export function createEventState(atlas){return {version:1,node:'arrival',entry:'unresolved',companion:'unmet',mentor:'unmet',page:0,location:'gate',...(atlas?copy(atlas):{})};}
export function validateEventState(events,life,gardenRoot,birthRoll){
 assertPlainData(events);exactKeys(events,['version','node','entry','companion','mentor','page','location'],['river','expedition','council','convoy','charters','valley','watch','mine','garden','firstMeeting','post','mountain','ferry','well','cloudPassage','nursery','saltField','ridgeRoad','forms']);
 if(!eventNodeIds.has(events.node))throw new Error('规则事件节点无效。');
 if(Object.hasOwn(events,'nursery')||events.node.startsWith('nursery-')||events.node==='work-porch')validateNursery(events,life,birthRoll);
 if(Object.hasOwn(events,'saltField')||events.node==='seed-book')validateSaltField(events,life);
 if(Object.hasOwn(events,'ridgeRoad')||events.node.startsWith('ridge-'))validateRidgeRoad(events,life);
 if(Object.hasOwn(events,'forms')||events.node.startsWith('form-')||events.node==='hunt-forms')validateForms(events,life);
 // A fatal breakthrough can reduce cultivation while leaving the final event at the grounds.
 if(life&&events.node.startsWith('hunt-')&&!nextRealmFor(life))throw new Error('当前没有需准备的破境材料。');
 if(Object.hasOwn(events,'council'))validateCouncil(events.council);
 if(Object.hasOwn(events,'convoy'))validateConvoy(events.convoy);
 if(events.node.startsWith('convoy-yard-')){
  const tier=life?.cultivationProfile.worldTier,v=events.convoy;
  if(!v||v.chapters[0]?.loads.length!==2||v.chapters[2]?.loads.length===2||life&&(tier>=2||v.chapters[tier]?.loads.length!==2))throw Error('本港尚无待办的界渡。');
  if(life&&['convoy-yard-duty','convoy-yard-shore','convoy-yard-boat'].includes(events.node)&&v.shifts?.[tier])throw Error('本港工签已交割。');
 }
 if(events.node.startsWith('packet-')||Object.hasOwn(events,'charters'))validateCharters(events,life);
 if(Object.hasOwn(events,'well'))validateWell(events.well,life);
 if(Object.hasOwn(events,'cloudPassage')||events.node.startsWith('sky-'))validateCloudPassage(events,life);
 if(events.node==='well-book'&&!events.well)throw new Error('回声井尚未起程。');
 if(events.node==='well-road'&&(events.well||life&&realmFor(life).rank!==3))throw new Error('回声井路引无效。');
 if(Object.hasOwn(events,'valley'))validateValley(events.valley);
 if(Object.hasOwn(events,'watch'))validateWatch(events.watch);
 if(Object.hasOwn(events,'mine'))validateMine(events.mine);
 if(Object.hasOwn(events,'garden'))validateGarden(events.garden,life,gardenRoot);
 if(Object.hasOwn(events,'ferry'))validateFerry(events.ferry,life);
 if(events.node.startsWith('shell-')&&(life&&realmFor(life).rank<1||events.node!=='shell-book'&&!events.ferry))throw new Error('浮蚌渡页次无效。');
 if(events.node==='shell-parley'){
  const p=events.ferry.pages.at(-1);
  if(p.end!==null||(p.id===2?!(p.marks&4):p.marks!==1))throw new Error('尚未走到与蓼商量的地方。');
 }
 if(Object.hasOwn(events,'mountain'))validateMountain(events.mountain,life,events.node);
 if(events.node.startsWith('mount-')&&events.node!=='mount-book'&&!events.mountain)throw new Error('折山页次无效。');
 if(Object.hasOwn(events,'firstMeeting')&&(!['helped','declined'].includes(events.firstMeeting)||!['completed','parted'].includes(events.companion)))throw new Error('林砚初遇记录无效。');
 if(Object.hasOwn(events,'post')){
  validatePost(events.post,life);
  const known=events.firstMeeting??(['helped','declined'].includes(events.companion)?events.companion:null);
  if(known&&events.post.origin!==known)throw new Error('药路不能改写初遇。');
 }
 if((events.post||events.node.startsWith('post-'))&&events.companion==='unmet'||events.node.startsWith('post-')&&!['post-book','post-offer-later'].includes(events.node)&&!events.post||
    ['post-history','post-stations','post-settle'].includes(events.node)&&!events.post?.steps.length||
    events.node==='post-settle'&&(!events.post?.stations?.at(-1)?.visits.length||events.post.stations.at(-1).settled!==null)||
    events.node==='post-fog'&&(events.post?.stations?.length!==3||events.post.stations[2].visits.length!==2||events.post.stations[2].settled!==null||!['turned',undefined].includes(events.post.stations[2].fog)||life&&life.cultivationProfile.worldTier!==0)||
    events.node==='post-shore'&&!events.post?.ending||
    ['post-traces','post-address','post-return'].includes(events.node)&&(events.post.route==='pass'||events.post.steps.length))throw new Error('药路页次无效。');
 if(['garden-practice','garden-pick','garden-ripe'].includes(events.node)&&!events.garden?.plot||
    events.node==='garden-history'&&!events.garden?.record.length)throw new Error('候物圃页次无效。');
 if((events.mine||events.node.startsWith('mine-'))&&!events.valley?.settled||
    ['mine-gallery','mine-inspect','mine-decide'].includes(events.node)&&(!events.mine||events.mine.record.length===3)||
    events.node==='mine-report'&&!events.mine?.record.length||
    events.node==='mine-journal'&&!events.mine?.record[events.page])throw new Error('井下灯簿页次无效。');
 if(events.node.startsWith('watch-ding-')){
  const ding=events.watch?.ding;
  if(events.watch?.record.length!==9||['watch-ding-pick','watch-ding-last'].includes(events.node)&&ding?.feet.length===3||events.node==='watch-ding-dedicate'&&ding?.feet.length!==3||events.node==='watch-ding-result'&&!ding?.form)throw new Error('山门问鼎页次无效。');
 }
 if((events.node.startsWith('watch-trail')||events.node==='watch-visitors')&&!events.watch?.record.length)throw new Error('守关驿棚尚未开门。');
 const draft=events.watch?.draft;
 if(events.node==='watch-orders'&&(!draft||draft.days!==null)||events.node==='watch-sit'&&(!draft?.marks||draft.days!==null)||events.node==='watch-report'&&!draft?.days||events.node==='watch-receipt'&&!events.watch?.record.length)throw new Error('守关回信页次无效。');
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
 // A missed cultivation check still leaves the ferry crew's weather observations.
 if(option.patch&&(success||option.key==='sky-intensive'||option.key==='sky-steady'))Object.assign(events,copy(option.patch));
 if(success&&option.arrival)events.location=option.arrival;
 if(option.key==='well-share'||option.key==='well-alone')Object.assign(events.well,{claim:option.key==='well-share'?'share':'alone',found:(receipt.itemChanges.soulseal??0)>0,finish:receipt.after.ageDays});
 if(option.key==='mount-steady'||option.key==='mount-intensive')events.mountain=recordMountainRetreat(state.events,receipt);
 if(state.events.node==='reunion'&&['reunion-work','part'].includes(option.key)&&success)events.firstMeeting=state.events.companion;
 if(option.key==='sit-watch'){
  events.watch.draft.days=receipt.elapsedDays;
  events.watch.draft.success=success;
 }
 return validateEventState(events,undefined,state.reincarnation?.gardenRoot);
}
export function resolveEventScene(state,pending,historicMenu=null){
 const events=advanceEvents(state,pending.receipt),prospective={...state,life:pending.nextLife,events,lastReceipt:pending.receipt,turnId:pending.identity.turnId};
 const definition=eventNode(prospective,historicMenu),prefix='r:'+sha256(state.runId).slice(0,16)+':t'+pending.identity.turnId+':';
 return {id:prefix+'s:event_'+events.node,title:definition.title,location:definition.location??eventLocation(prospective),blocks:copy(definition.blocks),entities:eventEntities(prospective),choices:definition.choices.map(({key,label,intent,targetId,stake,approach})=>({id:prefix+'c:'+key,label,intent,targetId,stake,approach})),memoryDeltas:[]};
}
export function assertRuleScene(state,pending,scene){
 if(canonicalStringify(scene)!==canonicalStringify(resolveEventScene(state,pending)))throw new Error('规则事件场景不可由生成内容改写。');
}
export function eventGoal(state){return state.events?eventNode(state).goal:null;}
