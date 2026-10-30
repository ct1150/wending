import { assertPlainData } from './identity.js';
import { INTENTS } from './model.js';
export function exactKeys(value, keys, optional=[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key=>!keys.includes(key)&&!optional.includes(key)) || keys.some(key=>!Object.hasOwn(value,key))) throw new Error('数据字段无效。');
}
export function textField(value,max=200) { if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw new Error('文字字段无效。'); }
export function idField(value) { if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/.test(value))throw new Error('标识无效。'); }
export function validateProposal(p) { assertPlainData(p);exactKeys(p,['id','label','intent','targetId','stake','approach']);idField(p.id);textField(p.label,120);idField(p.targetId);if(!Object.hasOwn(INTENTS,p.intent)||!INTENTS[p.intent].includes(p.approach)||!['low','normal','high'].includes(p.stake))throw new Error('未知行动意图。');return p; }
export function validateEntities(entities) { if(!Array.isArray(entities)||entities.length>24)throw new Error('关联人物过多。');const seen=new Set();for(const e of entities){exactKeys(e,['id','name','kind'],['status']);if(Object.hasOwn(e,'status')&&(e.kind!=='person'||!['alive','dead'].includes(e.status)))throw new Error('人物生死状态无效。');idField(e.id);textField(e.name,60);if(seen.has(e.id)||!['person','place','faction'].includes(e.kind))throw new Error('实体无效。');seen.add(e.id);} }
export function validateGeneratedScene(scene) {
 assertPlainData(scene);exactKeys(scene,['id','title','location','blocks','entities','choices','memoryDeltas']);idField(scene.id);textField(scene.title,120);textField(scene.location,120);validateEntities(scene.entities);
 if(!Array.isArray(scene.blocks)||scene.blocks.length<1||scene.blocks.length>12)throw new Error('正文段落数量无效。');for(const block of scene.blocks){exactKeys(block,block.kind==='dialogue'?['kind','text','speaker']:['kind','text']);if(!['narration','dialogue'].includes(block.kind))throw new Error('正文类型无效。');textField(block.text,2000);if(block.kind==='dialogue')textField(block.speaker,80);}
 if(!Array.isArray(scene.choices)||scene.choices.length<2||scene.choices.length>3)throw new Error('须有二至三个行动。');const ids=new Set(),actions=new Set();for(const p of scene.choices){validateProposal(p);if(ids.has(p.id))throw new Error('行动标识重复。');ids.add(p.id);const action=JSON.stringify([p.intent,p.targetId,p.stake,p.approach,...(p.intent==='interact'?[p.label.trim()]:[])]);if(actions.has(action))throw new Error('行动内容重复。');actions.add(action);}
 if(!Array.isArray(scene.memoryDeltas)||scene.memoryDeltas.length>16)throw new Error('记忆增量过多。');for(const m of scene.memoryDeltas){
  const obligation=['promise','clue'].includes(m.kind);
  exactKeys(m,['entityId','kind','text'],obligation?['referenceId','status']:[]);idField(m.entityId);
  if(!['fact','relationship','promise','clue','death'].includes(m.kind))throw new Error('记忆类型无效。');textField(m.text,500);
  if(obligation){
   if(Object.hasOwn(m,'referenceId')){idField(m.referenceId);if(!(m.kind==='promise'?['resolved','broken']:['resolved']).includes(m.status))throw new Error('记忆关闭状态无效。');}
   else if(Object.hasOwn(m,'status')&&m.status!=='open')throw new Error('新记忆必须尚未完成。');
  }
 }
 if(new TextEncoder().encode(JSON.stringify(scene)).length>48000)throw new Error('场景过大。');return scene;
}
const string = {type:'string',minLength:1};
const identifier = {...string,maxLength:80,pattern:'^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$'};
export const SCENE_SCHEMA = {type:'object',additionalProperties:false,required:['id','title','location','blocks','entities','choices','memoryDeltas'],properties:{id:identifier,title:{...string,maxLength:120},location:{...string,maxLength:120},blocks:{type:'array',minItems:1,maxItems:12,items:{type:'object',additionalProperties:false,required:['kind','text'],properties:{kind:{enum:['narration','dialogue']},text:{...string,maxLength:2000},speaker:identifier}}},entities:{type:'array',maxItems:24,items:{type:'object',additionalProperties:false,required:['id','name','kind'],properties:{id:identifier,name:{...string,maxLength:60},kind:{enum:['person','place','faction']},status:{enum:['alive','dead']}}}},choices:{type:'array',minItems:2,maxItems:3,items:{type:'object',additionalProperties:false,required:['id','label','intent','targetId','stake','approach'],properties:{id:identifier,label:{...string,maxLength:120},intent:{enum:Object.keys(INTENTS)},targetId:identifier,stake:{enum:['low','normal','high']},approach:{enum:[...new Set(Object.values(INTENTS).flat())]}}}},memoryDeltas:{type:'array',maxItems:16,items:{type:'object',additionalProperties:false,required:['entityId','kind','text'],properties:{entityId:identifier,kind:{enum:['fact','relationship','promise','clue','death']},text:{...string,maxLength:500},referenceId:identifier,status:{enum:['open','resolved','broken']}}}}}};
