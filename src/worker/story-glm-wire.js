import {SCENE_SCHEMA,exactKeys} from '../game/cultivation/live/schema.js';
import {assertPlainData} from '../game/cultivation/live/identity.js';
import {ITEMS,REALMS,INTENTS} from '../game/cultivation/live/model.js';

// GLM writes local references. The server owns persistent scene/choice IDs;
// only declared, typed aliases may become new entity IDs for this exact turn.
export function buildGlmWire(context,system){
  if(context.entities.some(entity=>['self',...Object.keys(ITEMS),...Object.keys(REALMS)].includes(entity.id)))throw Object.assign(Error('STORY_CONTEXT_INVALID'),{code:'STORY_CONTEXT_INVALID'});
  const aliases=new Map(context.entities.map((entity,index)=>[entity.id,'k'+(index+1)]));
  const obligations=[...context.memory.promises,...context.memory.clues];
  const references=new Map(obligations.map((record,index)=>[record.id,'m'+(index+1)]));
  function pack(value,field=''){
    if(Array.isArray(value))return value.map(row=>field==='entityIds'?aliases.get(row)??row:field==='references'?references.get(row)??row:pack(row));
    if(value&&typeof value==='object'){
      if(['relations','relationships','relationChanges'].includes(field))return Object.fromEntries(Object.entries(value).map(([key,row])=>[aliases.get(key)??key,row]));
      return Object.fromEntries(Object.entries(value).map(([key,row])=>{
        if(key==='id')return [key,['person','place','faction'].includes(value.kind)?aliases.get(row)??row:['promise','clue'].includes(value.kind)?references.get(row)??row:row];
        if(['entityId','targetId','speaker'].includes(key))return [key,aliases.get(row)??row];
        if(key==='referenceId')return [key,references.get(row)??row];
        return [key,pack(row,key)];
      }));
    }
    return value;
  }
  const packed=pack(context);delete packed.identity;delete packed.namespace;packed.turn=context.identity.turnId;
  const entityAliases=[...context.entities.map((_,index)=>'k'+(index+1)),...['p','l','f'].flatMap(kind=>Array.from({length:24},(_,index)=>kind+(index+1)))];
  const schema=structuredClone(SCENE_SCHEMA);
  delete schema.properties.id;schema.required=schema.required.filter(key=>key!=='id');
  const entityProperties=schema.properties.entities.items.properties;
  delete schema.properties.entities;
  for(const [field,kind,letter]of [['otherPeople','person','p'],['places','place','l'],['factions','faction','f']])schema.properties[field]={type:'array',maxItems:24,items:{type:'object',additionalProperties:false,required:['id','name'],properties:{id:{enum:[...context.entities.flatMap((entity,index)=>entity.kind===kind?['k'+(index+1)]:[]),...Array.from({length:24},(_,index)=>letter+(index+1))]},name:{...entityProperties.name,...(kind==='person'?{not:{enum:[context.life.name]}}:{})},...(kind==='person'?{status:entityProperties.status}:{})}}};
  const choiceProperties=schema.properties.choices.items.properties;
  schema.properties.choices.items.required=['action','targetId','stake'];
  schema.properties.choices.items.properties={action:{enum:Object.entries(INTENTS).flatMap(([intent,approaches])=>approaches.map(approach=>intent+':'+approach))},targetId:choiceProperties.targetId,stake:choiceProperties.stake};
  schema.properties.blocks.items.properties.speaker={enum:['self',...context.entities.flatMap((entity,index)=>entity.kind==='person'?['k'+(index+1)]:[]),...Array.from({length:24},(_,index)=>'p'+(index+1))]};
  schema.properties.choices.items.properties.targetId={enum:['self',...Object.keys(ITEMS),...Object.keys(REALMS),...entityAliases]};
  schema.properties.memoryDeltas.items.properties.entityId={enum:entityAliases};
  if(obligations.length)schema.properties.memoryDeltas.items.properties.referenceId={enum:obligations.map((_,index)=>'m'+(index+1))};
  else delete schema.properties.memoryDeltas.items.properties.referenceId;
  schema.properties=Object.fromEntries(['blocks','title','location','otherPeople','places','factions','choices','memoryDeltas'].map(key=>[key,schema.properties[key]]));
  schema.required=Object.keys(schema.properties);
  const identityGuide='Known entities keep input aliases k1,k2...; new person IDs=p1,p2...; new place IDs=l1,l2...; new faction IDs=f1,f2... (1-24). Scene and choices have NO id field: the server assigns their IDs. NPC death requires status dead and a death memory.';
  const instructions=system.replace(/^Keep known IDs\/names\/kinds\..*$/m,identityGuide)
    .replace('先写entities，只列本场speaker/targetId/memoryDeltas引用的NPC、地点及势力。','先写blocks正文，再写entities，只列本场speaker/targetId/memoryDeltas引用的NPC、地点及势力。')
    .replace('再写blocks和choices，','再写choices，')
    .replace('label必须完整包含该目的地的name，且','')
    .replace(/^choices\.label.*$/m,'choices仅写action、targetId、stake。action=意图:方式，如rest:recover、practice:steady、travel:road。选项文字由服务端按实际目标生成，不输出label、intent、approach或id。')
    .replaceAll('entities','名单(otherPeople/places/factions)')
    +'\n正文采用第二人称“你”，主角对白speaker只用self。otherPeople只列主角以外的NPC，只有主角出场时otherPeople=[]。places只列地点，factions只列势力。名单中不写kind；仅NPC可写status。禁止把life.name、你、玩家或主角列为NPC。新人物只用p1等，地点只用l1等，势力只用f1等；不得使用中文ID或自行编造其他别名。所有speaker和人物/地点targetId必须在相应名单中声明。travel必须另选一个尚未抵达的目的地，其name不能等于location。格式片段示例：主角对白={"kind":"dialogue","speaker":"self","text":"我该动身了。"}；location="村口"时可前往places=[{"id":"l1","name":"山道"}]，动作={"action":"travel:road","targetId":"l1","stake":"low"}。关闭已有约定/线索只用输入m1等referenceId，原文保持不变。先写blocks，再写其余字段。\nJSON Schema: '+JSON.stringify(schema);
  return {context:packed,instructions};
}

export function decodeGlmScene(wire,context){
  try{
    assertPlainData(wire);exactKeys(wire,['blocks','title','location','otherPeople','places','factions','choices','memoryDeltas']);
    if(context.entities.some(entity=>['self',...Object.keys(ITEMS),...Object.keys(REALMS)].includes(entity.id)))throw Error();
    if(['otherPeople','places','factions'].some(field=>!Array.isArray(wire[field])||wire[field].length>24)||!Array.isArray(wire.blocks)||wire.blocks.length<1||wire.blocks.length>12||!Array.isArray(wire.choices)||wire.choices.length<2||wire.choices.length>3||!Array.isArray(wire.memoryDeltas)||wire.memoryDeltas.length>16)throw Error();
    const declarations=[['otherPeople','person'],['places','place'],['factions','faction']].flatMap(([field,kind])=>wire[field].map(entity=>{exactKeys(entity,['id','name'],kind==='person'?['status']:[]);return {...entity,kind};}));if(declarations.length>24)throw Error();
    const prefix=context.namespace+':t'+context.identity.turnId+':',aliases=new Map(),used=new Set();
    const entities=declarations.map(entity=>{
      exactKeys(entity,['id','name','kind'],['status']);if(typeof entity.id!=='string'||used.has(entity.id))throw Error();used.add(entity.id);
      const old=/^k([1-9]\d*)$/.exec(entity.id),fresh=/^([plf])([1-9]|1\d|2[0-4])$/.exec(entity.id);
      let id;
      if(old){const known=context.entities[Number(old[1])-1];if(!known||known.kind!==entity.kind)throw Error();id=known.id;}
      else if(fresh&&({p:'person',l:'place',f:'faction'})[fresh[1]]===entity.kind){id=prefix+'e:'+entity.kind+'_'+fresh[2];if(context.entities.some(known=>known.id===id))throw Error();}
      else throw Error();
      aliases.set(entity.id,id);return {...entity,id};
    });
    const blocks=wire.blocks.map(block=>{
      exactKeys(block,block.kind==='dialogue'?['kind','text','speaker']:['kind','text']);
      if(block.kind!=='dialogue')return {...block};
      const speaker=block.speaker==='self'?'self':aliases.get(block.speaker);if(!speaker)throw Error();return {...block,speaker};
    });
    const literalTargets=new Set(['self',...Object.keys(ITEMS),...Object.keys(REALMS)]);
    const choices=wire.choices.map((choice,index)=>{
      exactKeys(choice,['action','targetId','stake']);
      if(typeof choice.action!=='string'||!['low','normal','high'].includes(choice.stake))throw Error();
      const parts=choice.action.split(':'),[intent,approach]=parts;if(parts.length!==2||!Object.hasOwn(INTENTS,intent)||!INTENTS[intent].includes(approach))throw Error();
      const targetId=aliases.get(choice.targetId)??(literalTargets.has(choice.targetId)?choice.targetId:null);if(!targetId)throw Error();
      const target=entities.find(entity=>entity.id===targetId)?.name??ITEMS[targetId]??REALMS[targetId]?.name??'';
      const label={
        'practice:steady':'凝神修行','practice:intensive':'闭关苦修','practice:breakthrough':'尝试突破'+target,
        'rest:recover':'歇息调养','rest:retire':'静心休养',
        'explore:cautious':'寻找'+target,'explore:bold':'深入探索寻找'+target,
        'negotiate:cooperate':'与'+target+'商谈','negotiate:bargain':'向'+target+'讨价还价','negotiate:pressure':'向'+target+'施压',
        'fight:guard':'谨慎迎战'+target,'fight:assault':'向'+target+'发起攻势','fight:desperate':'与'+target+'拼死一搏',
        'evade:withdraw':'避开'+target,'evade:conceal':'隐匿行踪躲开'+target,
        'travel:road':'沿路前往'+target,'travel:wilderness':'穿行荒野前往'+target,
        'craft:study':'研读完整功法','craft:forge':'锻制护符',
      }[choice.action]+(choice.stake==='high'?'（冒险）':choice.stake==='low'?'（谨慎）':'');
      return {id:prefix+'c:'+['a','b','c'][index],label,intent,targetId,stake:choice.stake,approach};
    });
    const obligations=[...context.memory.promises,...context.memory.clues];
    const memoryDeltas=wire.memoryDeltas.map(delta=>{
      exactKeys(delta,['entityId','kind','text'],['referenceId','status']);const entityId=aliases.get(delta.entityId);if(!entityId)throw Error();
      if(!Object.hasOwn(delta,'referenceId'))return {...delta,entityId};
      if(typeof delta.referenceId!=='string')throw Error();
      const match=/^m([1-9]\d*)$/.exec(delta.referenceId),record=match?obligations[Number(match[1])-1]:null;if(!record)throw Error();
      return {...delta,entityId,referenceId:record.id};
    });
    return {id:prefix+'s:scene',title:wire.title,location:wire.location,entities,blocks,choices,memoryDeltas};
  }catch{throw Object.assign(Error('GENERATED_SCENE_INVALID'),{code:'GENERATED_SCENE_INVALID'});}
}
