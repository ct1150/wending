import {assertPlainData} from '../game/cultivation/live/identity.js';
import {exactKeys,textField} from '../game/cultivation/live/schema.js';
import {assertSafeStoryStrings} from '../game/cultivation/live/memory.js';
import {isV7Life} from '../game/cultivation/live/cultivation-rules.js';
import {createNamedTargetLookup} from './story-named-targets.js';
import {normalizeWireAnnotation} from './story-wire-annotation.js';
import {STORY_PATTERNS,STORY_BEATS,STORY_NPC_TRAITS} from '../game/cultivation/live/story-annotation.js';
import {normalizeV7Presentation} from './story-v7-presentation.js';
import {buildStoryChoicePlan,materializeStoryChoices} from './story-choice-plan.js';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const consequential=row=>object(row)&&(Object.hasOwn(row,'referenceId')||row.kind==='death'||row.kind==='promise'||['resolved','broken'].includes(row.status));
const formalId=/^r:[\w-]+:t\d+:/u,knownAlias=/^k\d/u,localAlias=/^(?:p|person|npc|l|place|f|faction)(?:[1-9]|1\d|2[0-4])$/u;
const stateFields=['life','receipt','retrieval','rng','cultivationResult','itemChanges','relationChanges','death'];
const forbidden=()=>{throw Error('Invalid model authority');};

// Read only the protocol fields we consume, never an arbitrary model property
// or accessor. This projection applies only to fresh engine-owned menus.
function own(value,key,strict=false){
  if(!value||typeof value!=='object')return undefined;
  const d=Object.getOwnPropertyDescriptor(value,key);
  if(!d)return undefined;
  if(!d.enumerable||!Object.hasOwn(d,'value')){if(strict)forbidden();return undefined;}
  return d.value;
}
function identityTarget(value){
  if(!object(value))return value;
  const result={};
  for(const key of ['kind','name','ref','status']){
    const v=own(value,key,true);
    if(v!==undefined){if(v!==null&&typeof v!=='string')forbidden();result[key]=v;}
  }
  return result;
}
function optionalText(value,max){
  if(typeof value!=='string'||formalId.test(value))return undefined;
  try{textField(value,max);assertSafeStoryStrings(value);return value;}catch{return undefined;}
}
function authoredBlock(row,context,identify){
  const kind=own(row,'kind',true),text=own(row,'text',true);
  textField(text,2000);assertSafeStoryStrings(text);
  if(kind==='narration')return {kind,text};
  if(kind!=='dialogue')throw Error('Invalid block kind');
  let speaker=identityTarget(own(row,'speaker',true));
  if(speaker!=='self'){
    if(typeof speaker==='string'&&!knownAlias.test(speaker)){
      textField(speaker,60);
      if(/[:/\\]|^(?:p|l|f|npc|person|place|faction|m)\d/u.test(speaker))forbidden();
      const matches=context.entities.filter(e=>e.name===speaker);if(matches.length>1)forbidden();
      speaker=matches.length?'k'+(context.entities.indexOf(matches[0])+1):{kind:'person',name:speaker};
    }
    const actor=identify(speaker);
    if(actor.kind!=='person'||actor.status!==null||actor.known?.status==='dead'||[context.life.name,'你','主角','玩家','self'].includes(actor.name)||formalId.test(actor.name))forbidden();
    assertSafeStoryStrings(speaker);
  }
  return {kind,text,speaker};
}
function authoredBlocks(rows,context){
  if(!Array.isArray(rows))throw Error('Missing authored blocks');
  const identify=createNamedTargetLookup(context),blocks=[],positions=new Map();
  // The response size already bounds native JSON. Also bound direct JS inputs
  // and the accepted scene to the existing archive limit of twelve paragraphs.
  for(let i=0;i<Math.min(65536,rows.length)&&blocks.length<12;i++){
    let block;try{block=authoredBlock(own(rows,i,true),context,identify);}catch{continue;}
    positions.set(i,blocks.length);blocks.push(block);
  }
  if(!blocks.length)throw Error('No verified authored blocks');
  return {blocks,positions,sourceCount:rows.length};
}
function editorialStory(raw,{blocks,positions}){
  const result={};
  const p=own(raw,'pattern'),b=own(raw,'beat'),anchors=own(raw,'anchors');
  if(STORY_PATTERNS.includes(p)&&STORY_BEATS.includes(b)&&Array.isArray(anchors)){
    result.pattern=p;result.beat=b;result.anchors=[];
    for(let i=0;i<Math.min(anchors.length,2);i++){const n=positions.get(own(anchors,i));if(n!==undefined)result.anchors.push(n);}
  }
  const notes=own(raw,'npcs');
  if(Array.isArray(notes))for(let i=0;i<Math.min(2,notes.length);i++){
    const input=own(notes,i),anchor=positions.get(own(input,'anchor'));
    if(anchor===undefined)continue;
    const traits={};
    for(const key of STORY_NPC_TRAITS){const value=optionalText(own(input,key),28);if(value&&blocks[anchor].text.includes(value))traits[key]=value;}
    if(!Object.keys(traits).length)continue;
    const target=own(input,'target');if(typeof target!=='string'&&!object(target))continue;
    (result.npcs??=[]).push({target:identityTarget(target),anchor,...traits});
  }
  return result;
}
function authoredMemory(raw,{positions,sourceCount}){
  if(!Array.isArray(raw))return [];
  // The ordinary response byte limit already bounds parsed JSON; do not walk
  // a fabricated enormous sparse JS array supplied directly to this boundary.
  if(raw.length>65536)throw Error('Memory array exceeds response limit');
  const rows=[];
  for(let i=0;i<raw.length;i++){
    const input=own(raw,i);if(!object(input))continue;
    const kind=own(input,'kind'),referenceId=own(input,'referenceId',true),status=own(input,'status'),anchor=own(input,'anchor');
    const mandatory=referenceId!==undefined||kind==='death'||kind==='promise'||['resolved','broken'].includes(status);
    const mapped=positions.get(anchor);
    // An indexed event cannot use a different paragraph as evidence. Closures
    // instead refer to an existing obligation and keep their original fields.
    if(referenceId===undefined&&mapped===undefined&&Number.isInteger(anchor)&&anchor>=0&&anchor<sourceCount)continue;
    if(!mandatory&&(!['fact','relationship','clue'].includes(kind)||mapped===undefined))continue;
    const row={},target=own(input,'target',mandatory);
    // Fresh local symbols are numbered again from the retained participants.
    // After dropping a block, a bare p1 could mean someone else.
    if(positions.size!==sourceCount&&typeof target==='string'&&localAlias.test(target))continue;
    if(target!==undefined)row.target=identityTarget(target);
    // Consumed scalar fields keep their original types or fail. A closure's
    // reference/status is always validated against server-owned obligations.
    if(referenceId!==undefined){if(typeof referenceId!=='string')forbidden();row.referenceId=referenceId;}
    if(kind!==undefined){if(typeof kind!=='string')forbidden();row.kind=kind;}
    if(anchor!==undefined){if(!Number.isInteger(anchor))forbidden();row.anchor=referenceId===undefined?mapped??anchor:anchor;}
    if(status!==undefined){if(typeof status!=='string'){if(mandatory)forbidden();continue;}row.status=status;}
    rows.push(row);
  }
  return rows;
}
export function adaptV7EngineMenuOutput(wire,context){
  if(!isV7Life(context.life)||context.director?.version!==7||!object(wire))throw Error('Engine menu requires a v7 scene');
  const source=authoredBlocks(own(wire,'blocks',true),context),{blocks}=source;
  const choices=materializeStoryChoices(buildStoryChoicePlan(context),context,blocks);
  const authored={blocks,choices,story:editorialStory(own(wire,'story'),source),memoryDeltas:authoredMemory(own(wire,'memoryDeltas'),source)};
  const title=optionalText(own(wire,'title'),120);if(title)authored.title=title;
  // Later turns already have a location fixed by the prior scene/settled
  // travel receipt. An optional model caption must never move the player.
  if(context.phase==='opening'){const place=optionalText(own(wire,'location'),120);if(place)authored.location=place;}
  return adaptV7ModelOutput(authored,context);
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
