import { assertPlainData } from './identity.js';

// Scene annotations describe prose that already exists. Keeping their schema
// independent of rules and the director also keeps the offline graph acyclic.
export const STORY_PATTERNS=Object.freeze(['investigation','journey','bargain','conflict','cultivation','relationship','discovery','recovery']);
export const STORY_BEATS=Object.freeze(['progress','reversal','revelation','climax','resolution']);
export const STORY_NPC_TRAITS=Object.freeze(['title','signatureSpell','habit','obsession']);
export const STORY_ANNOTATION_SCHEMA=Object.freeze({type:'object',additionalProperties:false,required:['pattern','beat','anchors'],properties:{pattern:{enum:[...STORY_PATTERNS]},beat:{enum:[...STORY_BEATS]},anchors:{type:'array',minItems:1,maxItems:2,uniqueItems:true,items:{type:'integer',minimum:0,maximum:3}},npcs:{type:'array',maxItems:2,items:{type:'object',additionalProperties:false,required:['entityId','anchor',...STORY_NPC_TRAITS],properties:{entityId:{type:'string',minLength:1,maxLength:80},anchor:{type:'integer',minimum:0,maximum:3},...Object.fromEntries(STORY_NPC_TRAITS.map(key=>[key,{type:'string',maxLength:28}]))}}}}});
const fail=()=>{throw Object.assign(new Error('STORY_ANNOTATION_INVALID'),{code:'STORY_ANNOTATION_INVALID'});};
function keys(value,required,optional=[]){if(!value||typeof value!=='object'||Array.isArray(value)||required.some(key=>!Object.hasOwn(value,key))||Object.keys(value).some(key=>!required.includes(key)&&!optional.includes(key)))fail();}

export function validateStoryAnnotation(story,blockCount) {
  assertPlainData(story);keys(story,['pattern','beat','anchors'],['npcs']);
  const anchor=value=>Number.isInteger(value)&&value>=0&&value<blockCount;
  if(!STORY_PATTERNS.includes(story.pattern)||!STORY_BEATS.includes(story.beat)||!Array.isArray(story.anchors)||story.anchors.length<1||story.anchors.length>2||new Set(story.anchors).size!==story.anchors.length||story.anchors.some(value=>!anchor(value)))fail();
  if(story.npcs!==undefined){
    if(!Array.isArray(story.npcs)||story.npcs.length>2||new Set(story.npcs.map(row=>row?.entityId)).size!==story.npcs.length)fail();
    for(const npc of story.npcs){
      keys(npc,['entityId','anchor',...STORY_NPC_TRAITS]);
      if(typeof npc.entityId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/u.test(npc.entityId)||!anchor(npc.anchor))fail();
      if(STORY_NPC_TRAITS.some(key=>typeof npc[key]!=='string'||Array.from(npc[key]).length>28||/[\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(npc[key]))||!STORY_NPC_TRAITS.some(key=>npc[key]))fail();
    }
  }
  return story;
}
