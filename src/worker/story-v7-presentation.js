import {ITEMS,INTENTS,GROWTH_APPROACHES} from '../game/cultivation/live/model.js';
import {isV7Life,validV7Target,v7ActionRule,V7_REALMS} from '../game/cultivation/live/cultivation-rules.js';
import {formatStoryChoiceLabel} from '../game/cultivation/live/story-choice-label.js';
import {createNamedTargetLookup} from './story-named-targets.js';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const actions=new Set(Object.entries(INTENTS).flatMap(([intent,approaches])=>approaches.map(approach=>intent+':'+approach)));
const birthActions=new Set([...actions,...GROWTH_APPROACHES.map(approach=>'craft:'+approach)]);
export const isFixedV7Interaction=action=>typeof action==='string'&&actions.has(action)&&action.startsWith('interact:');
const decoration=new Set(['id','label','description','title','role','alias']);
function changed(rows,fn){let next;for(const [i,row]of rows.entries()){const item=fn(row);if(item!==row){next??=rows.slice();next[i]=item;}}return next??rows;}
const replace=(row,key,value)=>row[key]===value?row:{...row,[key]:value};
function clean(target){
  if(!object(target)||!['person','place','faction'].includes(target.kind)||typeof target.name!=='string')return target;
  const entries=Object.entries(target),kept=entries.filter(([key,value])=>!(decoration.has(key)&&(value===null||value==='')||key==='status'&&value===''));
  return kept.length===entries.length?target:Object.fromEntries(kept);
}
const cleanRow=row=>object(row)&&Object.hasOwn(row,'target')?replace(row,'target',clean(row.target)):row;

// At the model boundary only. This fills wire fields owned by the rules and
// resolves an exact visible name; it never derives an action from prose.
export function normalizeV7Presentation(wire,context){
  if(!isV7Life(context.life)||context.director?.version!==7||!Array.isArray(wire.blocks)||!Array.isArray(wire.choices))return wire;
  const lookup=createNamedTargetLookup(context),names=new Map(),dead=new Set();
  const key=t=>t.known?'known:'+t.known.id:JSON.stringify([t.kind,t.name]);
  const alias=t=>'k'+(context.entities.indexOf(t.known)+1);
  const remember=t=>{const matches=names.get(t.name)??new Map();matches.set(key(t),t);names.set(t.name,matches);};
  const identify=value=>{try{return lookup(value);}catch{return null;}};
  for(const [index]of context.entities.entries())remember(lookup('k'+(index+1)));
  const blocks=changed(wire.blocks,b=>b?.kind==='dialogue'?replace(b,'speaker',clean(b.speaker)):b),choices=changed(wire.choices,cleanRow);
  for(const target of [...blocks.filter(b=>b?.kind==='dialogue').map(b=>b.speaker),...choices.map(c=>object(c)&&!Object.hasOwn(c,'target')?clean(c.targetId):c?.target)]){
    if(!object(target))continue;const t=identify(target);if(t)remember(t);
  }
  for(const row of Array.isArray(wire.memoryDeltas)?wire.memoryDeltas:[])if(row?.kind==='death'){
    const t=identify(row.target);if(t)dead.add(key(t));else if(typeof row.target==='string')dead.add(row.target);
  }
  const entityFor=t=>({id:t.known?.id??'current:participant',kind:t.kind,name:t.name,status:dead.has(key(t))||dead.has(t.name)||dead.has(t.ref)?'dead':t.known?.status??'unknown'});
  function named(value,action,stake){
    if(typeof value!=='string'||value==='self'||Object.hasOwn(ITEMS,value)||Object.hasOwn(V7_REALMS,value)||/[:/\\]|^(?:k|p|l|f|npc|person|place|faction|m)\d/u.test(value)||context.entities.some(entity=>entity.id===value))return value;
    const matches=names.get(value);if(matches?.size!==1)return value;
    const t=matches.values().next().value;if(t.kind==='person'&&t.name===context.life.name)return value;
    const entity=entityFor(t);
    if(action===null){if(entity.kind!=='person'||entity.status==='dead')return value;}
    else{const [intent,approach]=action.split(':');if(!validV7Target({life:context.life,relatedEntities:[entity]},{intent,approach,targetId:entity.id,stake}))return value;}
    return t.known?alias(t):{kind:t.kind,name:t.name};
  }
  function legal(value,row){
    if(!['low','normal','high'].includes(row.stake))return null;
    const literal=typeof value==='string'&&(value==='self'||Object.hasOwn(ITEMS,value)||Object.hasOwn(V7_REALMS,value));
    const t=literal?null:identify(value);if(!literal&&(!t||t.kind==='person'&&t.name===context.life.name))return null;
    const entity=t?entityFor(t):null,targetId=entity?.id??value,targetName=entity?.name??ITEMS[value]??V7_REALMS[value]?.name??'', [intent,approach]=row.action.split(':');
    try{if(v7ActionRule({life:context.life,turnId:context.identity.turnId,relatedEntities:entity?[entity]:[]},{intent,approach,targetId,stake:row.stake}).reason)return null;}catch{return null;}
    return {targetId,targetName};
  }
  const finalBlocks=changed(blocks,b=>b?.kind==='dialogue'?replace(b,'speaker',named(b.speaker,null)):b),finalChoices=changed(choices,row=>{
    if(!object(row)||!(context.life.birth.backgroundId?birthActions:actions).has(row.action))return row;
    // A nested object in a supposed scalar is not a fixed rule field: never
    // overwrite it and thereby conceal an explicit authority or identity claim.
    if(row.anchor!==null&&typeof row.anchor==='object'||isFixedV7Interaction(row.action)&&row.stake!==null&&typeof row.stake==='object')throw Error('Invalid mechanical field');
    const fixed={...row,anchor:0};if(isFixedV7Interaction(row.action))fixed.stake='low';
    if(Object.hasOwn(row,'target'))fixed.target=named(row.target,row.action,fixed.stake);
    else if(Object.hasOwn(row,'targetId')){const value=clean(row.targetId);if(legal(value,fixed)){fixed.target=value;delete fixed.targetId;}}
    if(typeof row.label==='string'&&typeof row.purpose==='string'&&Object.hasOwn(fixed,'target')){
      const facts=legal(fixed.target,fixed);
      if(facts&&row.label===formatStoryChoiceLabel({action:row.action,stake:fixed.stake,purpose:row.purpose,...facts}))delete fixed.label;
    }
    return Object.keys(fixed).length===Object.keys(row).length&&Object.keys(fixed).every(k=>Object.hasOwn(row,k)&&fixed[k]===row[k])?row:fixed;
  });
  return finalBlocks===wire.blocks&&finalChoices===wire.choices?wire:{...wire,blocks:finalBlocks,choices:finalChoices};
}
