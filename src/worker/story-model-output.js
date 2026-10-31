import {assertPlainData} from '../game/cultivation/live/identity.js';
import {exactKeys,textField} from '../game/cultivation/live/schema.js';
import {assertSafeStoryStrings} from '../game/cultivation/live/memory.js';
import {isV7Life} from '../game/cultivation/live/cultivation-rules.js';
import {createNamedTargetLookup} from './story-named-targets.js';
import {normalizeWireAnnotation} from './story-wire-annotation.js';
import {normalizeV7Presentation} from './story-v7-presentation.js';
import {buildStoryChoicePlan,materializeStoryChoices} from './story-choice-plan.js';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const consequential=row=>object(row)&&(Object.hasOwn(row,'referenceId')||row.kind==='death'||row.kind==='promise'||['resolved','broken'].includes(row.status));
const formalId=/^r:[\w-]+:t\d+:/u,knownAlias=/^k\d/u,localAlias=/^(?:p|person|npc|l|place|f|faction)(?:[1-9]|1\d|2[0-4])$/u;
const stateFields=['life','receipt','retrieval','rng','cultivationResult','itemChanges','relationChanges','death'];
const forbidden=()=>{throw Error('Invalid model authority');};

// Only a complete dialogue speaker field can introduce a person here. A
// narration never supplies an inferred participant; never repair missing text.
function authoredBlocks(rows,context){
  if(!Array.isArray(rows)||!rows.length||rows.length>4)throw Error('Invalid authored blocks');
  const identify=createNamedTargetLookup(context);
  return rows.map(row=>{
    exactKeys(row,row?.kind==='dialogue'?['kind','speaker','text']:['kind','text']);textField(row.text,2000);
    if(row.kind==='narration')return row;
    if(row.kind!=='dialogue')throw Error('Invalid block kind');
    let speaker=row.speaker;if(speaker==='self')return row;
    if(typeof speaker==='string'&&!knownAlias.test(speaker)){
      textField(speaker,60);
      if(/[:/\\]|^(?:p|l|f|npc|person|place|faction|m)\d/u.test(speaker))forbidden();
      const matches=context.entities.filter(e=>e.name===speaker);if(matches.length>1)forbidden();
      speaker=matches.length?'k'+(context.entities.indexOf(matches[0])+1):{kind:'person',name:speaker};
    }
    const actor=identify(speaker);
    if(actor.kind!=='person'||actor.status!==null||actor.known?.status==='dead'||[context.life.name,'你','主角','玩家'].includes(actor.name))forbidden();
    return speaker===row.speaker?row:{...row,speaker};
  });
}

export function adaptV7EngineMenuOutput(wire,context){
  if(!isV7Life(context.life)||context.director?.version!==7)throw Error('Engine menu requires a v7 context');
  exactKeys(wire,['blocks'],['choices','title','location','story','memoryDeltas']);
  // Copy only fields used by the game. Stray model choices, including their
  // targets and any purported effects, are never read, rendered or persisted.
  const authored={};
  for(const key of ['blocks','title','location','story','memoryDeltas']){
    const descriptor=Object.getOwnPropertyDescriptor(wire,key);if(!descriptor)continue;
    if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))forbidden();
    authored[key]=descriptor.value;
  }
  assertPlainData(authored);assertSafeStoryStrings(authored);
  const blocks=authoredBlocks(authored.blocks,context);
  const choices=materializeStoryChoices(buildStoryChoicePlan(context),context,blocks);
  return adaptV7ModelOutput({...authored,blocks,choices},context);
}

// For freshly generated, named v7 output only. Never use as an archive
// migration. The prose and choices still go through the ordinary strict
// decoder, rules and receipt checks. Nothing here rewrites an action or prose.
export function adaptV7ModelOutput(wire,context){
  if(!isV7Life(context.life)||context.director?.version!==7)return wire;
  assertPlainData(wire);
  exactKeys(wire,['blocks','choices'],['title','location','story','memoryDeltas']);
  wire=normalizeV7Presentation(wire,context);
  const {blocks,choices}=wire;
  if(!Array.isArray(blocks)||!blocks.length||!Array.isArray(choices)||choices.length<2||choices.length>3)throw Error('Invalid playable core');
  const identify=createNamedTargetLookup(context);
  const neutral={pattern:context.director.pacing.pattern,beat:'progress',anchors:[0]};
  const targetKey=t=>t.known?.id??JSON.stringify([t.kind,t.name]);
  function checkIdentity(target){
    const t=identify(target);
    if(t.status!==null||t.kind==='person'&&t.name===context.life.name)forbidden();
    return t;
  }
  // Check explicit authority and identity claims even in a malformed envelope,
  // before any fallback. Tag *values* are opaque data: the only values ever
  // copied out of them are the two exact enum strings in normalizeWireAnnotation.
  function guard(value,{record=false,opaque=false,storyRoot=false}={}){
    if(typeof value==='string'){if(formalId.test(value))forbidden();return;}
    if(!value||typeof value!=='object')return;
    if(!opaque&&object(value)){
      if(stateFields.some(key=>Object.hasOwn(value,key))||['alive','dead'].includes(value.status)||!record&&consequential(value))forbidden();
      if(value.kind==='person'&&value.name===context.life.name)forbidden();
      if(Object.hasOwn(value,'ref')&&![null,'','null'].includes(value.ref))checkIdentity(value);
      for(const key of ['target','entityId','targetId','speaker']){
        const id=value[key];if(typeof id!=='string')continue;
        if(knownAlias.test(id))checkIdentity(id);
        else if(/[:/\\]/u.test(id)||context.entities.some(entity=>entity.id===id))forbidden();
      }
    }
    for(const [key,child] of Object.entries(value))guard(child,{opaque:opaque||storyRoot&&['pattern','beat'].includes(key)});
  }
  for(const data of [wire.title,wire.location,wire.story,wire.memoryDeltas])assertSafeStoryStrings(data);
  guard(wire.title);guard(wire.location);
  guard(wire.story,{storyRoot:true});
  const rows=Array.isArray(wire.memoryDeltas)?wire.memoryDeltas:[];
  if(!Array.isArray(wire.memoryDeltas))guard(wire.memoryDeltas);
  for(const row of rows)guard(row,{record:true});

  // The normal decoder owns names, local aliases, and collisions. An explicit
  // ref uses that same identity boundary; an unidentifiable optional note
  // simply cannot attach a trait to anybody.
  let identityFailure;
  function noteActor(value){
    if(!object(value)&&!(typeof value==='string'&&knownAlias.test(value)))return null;
    if(object(value)&&(!['person','place','faction'].includes(value.kind)||typeof value.name!=='string'||!value.name.trim()))return null;
    if(object(value)&&Object.keys(value).some(key=>!['kind','name','ref','status'].includes(key)))return null;
    let t;try{t=checkIdentity(value);}catch(error){
      if(typeof value==='string'||![null,'','null',undefined].includes(value.ref)){identityFailure=error;throw error;}
      return null; // Unidentifiable new name; no trusted actor, no optional fact.
    }
    return {kind:t.kind,name:t.name,key:targetKey(t),ambiguous:context.entities.filter(e=>e.kind===t.kind&&e.name===t.name).length>1};
  }
  let story=neutral;
  try{story=normalizeWireAnnotation(wire.story,blocks,context,'target',noteActor);}
  catch(error){if(error===identityFailure)throw error;}

  // A bare name or explicitly declared local symbol can only refer back
  // to a core participant. Ambiguity is not evidence for either person.
  const mentions=new Map();
  function remember(key,actor){
    if(key)mentions.set(key,mentions.has(key)&&mentions.get(key)?.key!==actor.key?null:actor);
  }
  for(const value of [...blocks.filter(b=>b?.kind==='dialogue').map(b=>b.speaker),...choices.map(c=>c?.target)]){
    if(!object(value)&&!(typeof value==='string'&&knownAlias.test(value)))continue;
    const t=checkIdentity(value),actor={key:targetKey(t),name:t.name,ambiguous:context.entities.filter(e=>e.kind===t.kind&&e.name===t.name).length>1};
    remember(t.name,actor);if(localAlias.test(t.ref))remember(t.ref,actor);
  }
  function supported(row){
    if(!object(row)||!['fact','relationship','clue'].includes(row.kind)||!Number.isInteger(row.anchor)||row.anchor<0||row.anchor>=blocks.length)return false;
    const fields=row.kind==='clue'?['kind','target','anchor','status']:['kind','target','anchor'];
    if(Object.keys(row).some(k=>!fields.includes(k))||row.kind==='clue'&&Object.hasOwn(row,'status')&&row.status!=='open')return false;
    const target=row.target,block=blocks[row.anchor];
    const actor=typeof target==='string'&&!knownAlias.test(target)?mentions.get(target):noteActor(target);
    if(!actor||typeof block?.text!=='string')return false;
    const speaker=block.kind==='dialogue'&&block.speaker!=='self'?noteActor(block.speaker):null;
    return speaker?.key===actor.key||!actor.ambiguous&&block.text.includes(actor.name);
  }
  // Keep every consequential row, in order and by reference. Its existing
  // validator alone decides whether it can change a death, promise or clue.
  // Only evidence with no state-changing claim may be discarded here.
  const mandatory=rows.filter(consequential).length;
  if(mandatory>16)throw Error('Too many consequential memories');
  let room=16-mandatory;
  const memoryDeltas=[];
  for(const row of rows){
    if(consequential(row))memoryDeltas.push(row);
    else if(room>0&&supported(row)){memoryDeltas.push(row);room--;}
  }
  const title=typeof wire.title==='string'&&wire.title.trim()?wire.title:'眼前所见';
  let location=wire.location;
  if(typeof location!=='string'||!location.trim()){
    const {action,cultivationResult}=context.receipt,check=cultivationResult?.check;
    const arrived=action?.intent==='travel'&&!(check?.kind==='world-crossing'&&check.success===false);
    location=arrived?context.entities.find(e=>e.kind==='place'&&e.id===action.targetId)?.name:context.director.world.location;
    if(!location)throw Error('No settled location');
  }
  return {...wire,title,location,story,memoryDeltas};
}
