import {exactKeys,textField} from '../game/cultivation/live/schema.js';
import {assertPlainData} from '../game/cultivation/live/identity.js';
import {ITEMS,REALMS} from '../game/cultivation/live/model.js';

// The model names an object next to its intended action. The server resolves
// existing identity or allocates a local wire reference; it never trusts a
// model-provided ID that disagrees with the complete name and kind.
export function normalizeNamedScene(wire,context){
  assertPlainData(wire);exactKeys(wire,['blocks','choices','title','location','memoryDeltas']);
  if(!Array.isArray(wire.blocks)||wire.blocks.length<1||wire.blocks.length>12||!Array.isArray(wire.choices)||wire.choices.length<2||wire.choices.length>3||!Array.isArray(wire.memoryDeltas)||wire.memoryDeltas.length>16)throw Error('Invalid named scene');
  // ref belongs only to the aliases visible in the model input. Formal IDs
  // are a different namespace and can coincidentally equal another alias.
  const knownRefs=new Map(context.entities.map((entity,index)=>['k'+(index+1)+'_'+entity.kind+'_'+Array.from(entity.name).slice(0,4).join(''),entity]));
  const declarations=new Map(),counts={person:0,place:0,faction:0},literals=new Set(['self',...Object.keys(ITEMS),...Object.keys(REALMS)]);
  function resolve(target){
    exactKeys(target,['kind','name','ref','status']);
    if(!['person','place','faction'].includes(target.kind)||target.ref!==null&&typeof target.ref!=='string'||target.status!==null&&(!['alive','dead'].includes(target.status)||target.kind!=='person'))throw Error('Invalid named target');
    textField(target.name,60);
    let known;
    if(![null,'','null'].includes(target.ref)){known=knownRefs.get(target.ref);if(!known||known.kind!==target.kind||known.name!==target.name)throw Error('Named reference mismatch');}
    else{const matches=context.entities.filter(entity=>entity.kind===target.kind&&entity.name===target.name);if(matches.length>1)throw Error('Ambiguous named reference');known=matches[0];}
    const key=known?known.id:JSON.stringify([target.kind,target.name]);let declaration=declarations.get(key);
    if(!declaration){
      const id=known?'k'+(context.entities.indexOf(known)+1):({person:'p',place:'l',faction:'f'})[target.kind]+(++counts[target.kind]);
      declaration={id,...(!known?{name:target.name}:{}),kind:target.kind};declarations.set(key,declaration);
      if(declarations.size>24)throw Error('Too many named targets');
    }
    if(target.status!==null){if(Object.hasOwn(declaration,'status')&&declaration.status!==target.status)throw Error('Contradictory named status');declaration.status=target.status;}
    return declaration.id;
  }
  const blocks=wire.blocks.map(block=>{
    exactKeys(block,block.kind==='dialogue'?['kind','text','speaker']:['kind','text']);
    if(block.kind!=='dialogue')return {...block};
    if(block.speaker==='self')return {...block};
    if(block.speaker?.kind!=='person')throw Error('Invalid named speaker');
    return {...block,speaker:resolve(block.speaker)};
  });
  const choices=wire.choices.map(choice=>{
    exactKeys(choice,['action','target','stake','purpose','anchor']);
    const targetId=typeof choice.target==='string'&&literals.has(choice.target)?choice.target:resolve(choice.target);
    return {action:choice.action,targetId,stake:choice.stake,purpose:choice.purpose,anchor:choice.anchor};
  });
  const memoryDeltas=wire.memoryDeltas.map(delta=>{
    if(Object.hasOwn(delta,'referenceId')){exactKeys(delta,['referenceId','status']);return {...delta};}
    exactKeys(delta,['target','kind','anchor'],['status']);
    const entityId=resolve(delta.target);
    if(delta.kind==='death'){
      const declaration=[...declarations.values()].find(entity=>entity.id===entityId);
      if(declaration.kind!=='person'||Object.hasOwn(declaration,'status')&&declaration.status!=='dead')throw Error('Conflicting death record');
      declaration.status='dead';
    }
    return {entityId,kind:delta.kind,anchor:delta.anchor,...(Object.hasOwn(delta,'status')?{status:delta.status}:{})};
  });
  const result={blocks,choices,title:wire.title,location:wire.location,otherPeople:[],places:[],factions:[],memoryDeltas};
  for(const declaration of declarations.values()){const {kind,...entity}=declaration;result[({person:'otherPeople',place:'places',faction:'factions'})[kind]].push(entity);}
  return result;
}

export function buildNamedSceneSchema(source,context,{blocks,location}={}){
  const named={};for(const kind of ['person','place','faction']){
    const ambiguous=context.entities.some((entity,index)=>entity.kind===kind&&context.entities.slice(0,index).some(previous=>previous.kind===kind&&previous.name===entity.name));
    named[kind]={type:'object',additionalProperties:false,required:['kind','name','ref','status'],properties:{kind:{const:kind},name:{type:'string',minLength:1,maxLength:60},ref:ambiguous?{type:'string',maxLength:80}:{const:''},status:{const:null}}};
  }
  const definitions=Object.fromEntries(Object.entries(named).map(([kind,schema])=>[kind+'Target',schema]));definitions.entityTarget={oneOf:Object.keys(named).map(kind=>({$ref:'#/$defs/'+kind+'Target'}))};
  const body=structuredClone(blocks??source.properties.blocks);
  const variants=body.items.oneOf??[body.items];
  for(const variant of variants){
    delete variant.properties.text.maxLength;
    if(variant.properties.kind.const!=='dialogue')continue;
    const speaker=variant.properties.speaker,known=typeof speaker.const==='string'?context.entities.find(entity=>entity.id===speaker.const):null;
    if(known)variant.properties.speaker={type:'object',additionalProperties:false,required:['kind','name','ref','status'],properties:{kind:{const:'person'},name:{const:known.name},ref:{const:known.id},status:{const:null}}};
    else variant.properties.speaker=speaker.const==='self'?{const:'self'}:speaker.enum?.includes('self')?{oneOf:[{const:'self'},{$ref:'#/$defs/personTarget'}]}:{$ref:'#/$defs/personTarget'};
  }
  const choices={type:'array',minItems:2,maxItems:3,items:{oneOf:source.properties.choices.items.oneOf.map(group=>{
    const values=group.properties.targetId.enum,kinds=new Set(),strings=[];
    for(const id of values){const known=context.entities.find(entity=>entity.id===id),fresh=/^([plf])\d+$/u.exec(id);if(known)kinds.add(known.kind);else if(fresh)kinds.add(({p:'person',l:'place',f:'faction'})[fresh[1]]);else strings.push(id);}
    const alternatives=[...(strings.length?[{enum:strings}]:[]),...[...kinds].map(kind=>({$ref:'#/$defs/'+kind+'Target'}))],target=alternatives.length===1?alternatives[0]:{oneOf:alternatives};
    return {type:'object',additionalProperties:false,required:['action','target','stake','purpose','anchor'],properties:{action:group.properties.action,target,stake:group.properties.stake,purpose:{type:'string',minLength:1,maxLength:50},anchor:{type:'integer',minimum:0,maximum:(body.maxItems??4)-1}}};
  })}};
  const anchor={type:'integer',minimum:0,maximum:(body.maxItems??4)-1};
  const memoryDeltas={type:'array',maxItems:16,items:{oneOf:[{type:'object',additionalProperties:false,required:['target','kind','anchor'],properties:{target:{$ref:'#/$defs/entityTarget'},kind:{enum:['fact','relationship','death']},anchor}},{type:'object',additionalProperties:false,required:['target','kind','anchor','status'],properties:{target:{$ref:'#/$defs/entityTarget'},kind:{enum:['promise','clue']},anchor,status:{const:'open'}}},{type:'object',additionalProperties:false,required:['referenceId','status'],properties:{referenceId:{type:'string'},status:{enum:['resolved','broken']}}}]}};
  const properties={blocks:body,choices,title:source.properties.title,location:location??source.properties.location,memoryDeltas};
  return {type:'object',additionalProperties:false,required:Object.keys(properties),properties,$defs:definitions};
}
