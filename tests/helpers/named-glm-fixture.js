// Keep the existing domain fixtures readable while exercising the current
// provider format. This is only a fake-AI output adapter, never production code.
export function namedGlmFixture(wire,input){
  if(input?.response_format?.json_schema?.schema?.required?.join(',')!=='blocks,choices,title,location,memoryDeltas'||!Object.hasOwn(wire,'otherPeople'))return wire;
  const context=JSON.parse(input.messages[1].content),known=new Map(context.entities.flatMap((entity,index)=>[[entity.id,entity],['k'+(index+1),entity]])),declared=new Map([['otherPeople','person'],['places','place'],['factions','faction']].flatMap(([field,kind])=>(wire[field]??[]).map(entity=>[entity.id,{...entity,kind}])));
  function target(id){
    const saved=known.get(id),declaration=declared.get(id);
    if(!saved&&!declaration)return typeof id==='string'&&!/^[kplf]\d/u.test(id)?id:{kind:'person',name:'未知对象',ref:id??'',status:null};
    const reference=saved??known.get(declaration.id),entity=declaration??saved;
    const extras=Object.fromEntries(Object.entries(entity).filter(([key])=>!['id','name','kind','status'].includes(key)));
    return {kind:entity.kind,name:entity.name??reference?.name??'未知对象',ref:reference?.id??null,status:entity.status??null,...extras};
  }
  const {otherPeople,places,factions,...rest}=wire;
  return {...rest,blocks:wire.blocks.map(block=>block.kind==='dialogue'?{...block,speaker:block.speaker==='self'?'self':target(block.speaker)}:{...block}),choices:wire.choices.map(choice=>{const {targetId,...fields}=choice;return {...fields,target:target(targetId)};}),memoryDeltas:wire.memoryDeltas.map(delta=>{if(Object.hasOwn(delta,'referenceId'))return {...delta};const {entityId,...fields}=delta;return {...fields,target:target(entityId)};})};
}
