import { SCENE_SCHEMA } from '../game/cultivation/live/schema.js';
import { INTENTS } from '../game/cultivation/live/model.js';

// Generation guidance for an already validated run/turn. Runtime validation
// remains authoritative for references, mechanics, cross-item uniqueness and
// UTF-16 text lengths (JSON Schema maxLength counts Unicode code points).
export function buildGenerationSchema(namespace,turnId,{nextRealm='disabled',knownEntities=[]}={}) {
  const schema=structuredClone(SCENE_SCHEMA),prefix=`${namespace}:t${turnId}:`;
  const block=schema.properties.blocks.items,entity=schema.properties.entities.items;
  const choice=schema.properties.choices.items,memory=schema.properties.memoryDeltas.items;
  schema.properties.id={type:'string',enum:[prefix+'s:scene']};
  choice.properties.id={...choice.properties.id,pattern:`^${prefix}c:[A-Za-z0-9:_-]+$`};
  // The live grammar rejected lookaround and ignored parent constraints beside
  // oneOf. Each alternative is therefore a complete closed object. Text trim,
  // controls and cross-item facts remain checked by the runtime validator.
  const object=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,required,properties});
  const enumeration=values=>({enum:[...values]});
  const alternatives=variants=>({anyOf:variants});
  // New identities are local to this turn and carry their kind. Existing IDs
  // remain exact supplied values, including older IDs without typed suffixes.
  // Separate alternatives let shared definitions store each known-ID set once;
  // repeating those IDs inside several regexes would consume context capacity.
  const reference=(kinds,{self=false,living=false}={})=>{
    const variants=self?[enumeration(['self'])]:[];
    for(const kind of kinds){
      variants.push({...entity.properties.id,pattern:`^${prefix}e:${kind}_[A-Za-z0-9:_-]+$`});
      const known=knownEntities.filter(value=>value.kind===kind);
      const groups=kind==='person'?[known.filter(value=>value.status!=='dead'),...(living?[]:[known.filter(value=>value.status==='dead')])]:[known];
      for(const group of groups)if(group.length)variants.push(enumeration(group.map(value=>value.id)));
    }
    return variants.length===1?variants[0]:alternatives(variants);
  };
  const actor=reference(['person','faction'],{living:true}),place=reference(['place']);
  const speaker=reference(['person'],{self:true,living:true});
  const targets={rest:['self'],explore:['supplies','stones','manual','crystal','core','soulseal','skykey','relic','iron']};
  const action=(intent,approaches,target)=>object({...choice.properties,intent:enumeration([intent]),approach:enumeration(approaches),targetId:target?enumeration(target):intent==='travel'?place:actor});
  schema.properties.choices.items=alternatives(Object.entries(INTENTS).filter(([intent])=>intent!=='interact').flatMap(([intent,approaches])=>{
    if(intent==='practice')return [action(intent,['steady','intensive'],['self']),...(nextRealm==='disabled'?[]:[action(intent,['breakthrough'],[nextRealm])])];
    if(intent==='craft')return [action(intent,['study'],['manual']),action(intent,['forge'],['talisman'])];
    return [action(intent,approaches,targets[intent])];
  }));
  schema.properties.blocks.items=alternatives([
    object({kind:enumeration(['narration']),text:block.properties.text}),
    object({kind:enumeration(['dialogue']),text:block.properties.text,speaker}),
  ]);
  schema.properties.entities.items=alternatives(['person','place','faction'].map(kind=>{
    const properties={id:reference([kind]),name:entity.properties.name,kind:enumeration([kind])};
    if(kind==='person')properties.status=entity.properties.status;
    return object(properties,['id','name','kind']);
  }));
  const memoryBase={entityId:reference(['person','place','faction']),text:memory.properties.text};
  schema.properties.memoryDeltas.items=alternatives([
    object({...memoryBase,kind:enumeration(['fact','relationship','death'])}),
    object({...memoryBase,kind:enumeration(['promise','clue']),status:enumeration(['open'])},['entityId','kind','text']),
    object({...memoryBase,kind:enumeration(['promise']),referenceId:memory.properties.referenceId,status:enumeration(['resolved','broken'])}),
    object({...memoryBase,kind:enumeration(['clue']),referenceId:memory.properties.referenceId,status:enumeration(['resolved'])}),
  ]);
  // Put declarations before their references in the provider's object grammar.
  const order=['id','title','location','entities','blocks','choices','memoryDeltas'];
  schema.properties=Object.fromEntries(order.map(key=>[key,schema.properties[key]]));
  schema.required=order;
  // Share primitives and string unions, processing children first so union
  // definitions reuse the same known-ID sets instead of copying them again.
  const occurrences=new Map();
  function visit(node){
    for(const [key,value] of Object.entries(node)){
      if(!value||typeof value!=='object')continue;
      visit(value);
      const stringUnion=Array.isArray(value.anyOf)&&value.anyOf.every(branch=>branch.type==='string'||Array.isArray(branch.enum));
      if(value.type==='string'||Array.isArray(value.enum)||stringUnion){
        const serialized=JSON.stringify(value),entry=occurrences.get(serialized)??{value,places:[]};
        entry.places.push({parent:node,key});occurrences.set(serialized,entry);
      }
    }
  }
  visit(schema);schema.$defs={};
  for(const entry of occurrences.values())if(entry.places.length>1){
    const name='s'+Object.keys(schema.$defs).length;schema.$defs[name]=structuredClone(entry.value);
    for(const {parent,key} of entry.places)parent[key]={$ref:'#/$defs/'+name};
  }
  return schema;
}
