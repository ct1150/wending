import {assertPlainData} from '../game/cultivation/live/identity.js';
import {exactKeys} from '../game/cultivation/live/schema.js';
import {assertSafeStoryStrings} from '../game/cultivation/live/memory.js';
import {isV7Life} from '../game/cultivation/live/cultivation-rules.js';
import {createNamedTargetLookup} from './story-named-targets.js';
import {normalizeWireAnnotation} from './story-wire-annotation.js';
import {normalizeV7Presentation} from './story-v7-presentation.js';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const consequential=row=>object(row)&&(Object.hasOwn(row,'referenceId')||row.kind==='death'||row.kind==='promise'||['resolved','broken'].includes(row.status));
const formalId=/^r:[\w-]+:t\d+:/u,knownAlias=/^k\d/u,localAlias=/^(?:p|person|npc|l|place|f|faction)(?:[1-9]|1\d|2[0-4])$/u;
const stateFields=['life','receipt','retrieval','rng','cultivationResult','itemChanges','relationChanges','death'];
const forbidden=()=>{throw Error('Invalid model authority');};

// For freshly generated, named v7 output only. Never use as an archive
// migration. The prose and choices still go through the ordinary strict
// decoder, rules and receipt checks. Nothing here rewrites an action or prose.
export function adaptV7ModelOutput(wire,context,{authoredChoices=false}={}){
  if(!isV7Life(context.life)||context.director?.version!==7)return wire;
  assertPlainData(wire);
  if(authoredChoices&&Object.hasOwn(wire,'afterword')){
    // A brief Chinese editorial signoff is presentation only. References,
    // machine fields, nested records and every other unknown key remain invalid.
    const {afterword,...body}=wire;
    if(typeof afterword!=='string'||afterword.length>120||!/^【?[\p{Script=Han} \n，。！、；《》“”（）…]+】?$/u.test(afterword))forbidden();
    assertSafeStoryStrings(afterword);
    wire=body;
  }
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
