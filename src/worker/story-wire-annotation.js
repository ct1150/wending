import {validateInsightShape,groundedInsight} from '../game/cultivation/live/actor-insight.js';
import {isExperienceLife} from '../game/cultivation/live/experience.js';
import {exactKeys} from '../game/cultivation/live/schema.js';
import {STORY_PATTERNS,STORY_BEATS,STORY_NPC_TRAITS} from '../game/cultivation/live/story-annotation.js';
import {assertSafeStoryStrings} from '../game/cultivation/live/memory.js';

// Clean up editorial notes at the model boundary, before a named NPC can be
// registered. Saves and accepted scenes continue to use the strict validator.
export function normalizeWireAnnotation(story,blocks,context,field,lookup){
  assertSafeStoryStrings(story);
  exactKeys(story,[],['pattern','beat','anchors','npcs',...(isExperienceLife(context.life)?['opponent']:[])]);
  for(const key of ['pattern','beat'])if(Object.hasOwn(story,key)&&typeof story[key]!=='string')throw Error('Invalid story tag');
  if(!Array.isArray(blocks)||!blocks.length)throw Error('Missing scene blocks');
  const anchors=story.anchors??[];
  if(!Array.isArray(anchors)||anchors.length>2||anchors.some(index=>!Number.isInteger(index)))throw Error('Invalid story anchors');
  const actual=[...new Set(anchors.filter(index=>index>=0&&index<blocks.length))];
  // Attaching a resolution/climax to an arbitrary block could advance the
  // director. Its existing pattern and a neutral progress beat do not.
  const result={
    pattern:actual.length&&STORY_PATTERNS.includes(story.pattern)?story.pattern:context.director.pacing.pattern,
    beat:actual.length&&STORY_BEATS.includes(story.beat)?story.beat:'progress',
    anchors:actual.length?actual:[0],
  };
  if(story.opponent!==undefined){
    const n=story.opponent;validateInsightShape(n,field,4);
    const actor=lookup(n[field],true),block=blocks[n.anchor],speaker=block?.kind==='dialogue'&&block.speaker!=='self'&&lookup(block.speaker,false)?.key===actor?.key;
    const obs=groundedInsight(n,block,actor,{speaker,ambiguous:actor?.ambiguous});
    if(obs)result.opponent={[field]:n[field],...obs};
  }
  if(story.npcs===undefined)return result;
  if(!Array.isArray(story.npcs)||story.npcs.length>2)throw Error('Invalid NPC annotations');
  const byIdentity=new Map();
  for(const note of story.npcs){
    exactKeys(note,[field,'anchor'],STORY_NPC_TRAITS);
    if(!Number.isInteger(note.anchor))throw Error('Invalid NPC anchor');
    for(const key of STORY_NPC_TRAITS)if(Object.hasOwn(note,key)&&(typeof note[key]!=='string'||Array.from(note[key]).length>28||/[\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(note[key])))throw Error('Invalid NPC trait');
    // Even if nothing will be saved, an explicit cross-life ID, contradictory
    // name or attempted status change remains invalid.
    const actor=lookup(note[field],true),block=blocks[note.anchor];
    if(!actor||actor.kind!=='person'||!block)continue;
    const speaks=block.kind==='dialogue'&&block.speaker!=='self'&&lookup(block.speaker,false)?.key===actor.key;
    const named=!actor.ambiguous&&typeof block.text==='string'&&block.text.includes(actor.name);
    if(!speaks&&!named)continue;
    const grounded=STORY_NPC_TRAITS.filter(key=>note[key]?.trim()&&block.text.includes(note[key]));
    if(!grounded.length)continue;
    // Canonical notes have one anchor per person. Prefer the first grounded
    // row; complementary fields on that same block can be retained together.
    const row=byIdentity.get(actor.key)??{[field]:note[field],anchor:note.anchor,...Object.fromEntries(STORY_NPC_TRAITS.map(key=>[key,'']))};
    if(row.anchor===note.anchor)for(const key of grounded)if(!row[key])row[key]=note[key];
    byIdentity.set(actor.key,row);
  }
  return {...result,npcs:[...byIdentity.values()]};
}
