import {exactKeys,textField} from '../game/cultivation/live/schema.js';
import {assertPlainData} from '../game/cultivation/live/identity.js';
import {ITEMS,REALMS} from '../game/cultivation/live/model.js';
import {isV7Life,realmCatalogFor,WORLD_TIERS,WORLD_TRAVEL_APPROACHES} from '../game/cultivation/live/cultivation-rules.js';

// Bound, typed symbols from older model responses exist only within one scene.
const localSymbol=value=>{
  const match=typeof value==='string'&&/^(p|npc|person|l|place|f|faction)([1-9]|1\d|2[0-4])$/u.exec(value);
  return match?({p:'p',npc:'p',person:'p',l:'l',place:'l',f:'f',faction:'f'})[match[1]]+match[2]:null;
};
const kindLetter={person:'p',place:'l',faction:'f'};

// The model names an object next to its intended action. The server resolves
// existing identity or allocates a local wire reference; it never trusts a
// model-provided ID that disagrees with the complete name and kind.
export function createNamedTargetLookup(context){
  const directed=isV7Life(context.life)&&context.director?.version===7;
  // ref belongs only to the aliases visible in the model input. Formal IDs
  // are a different namespace and can coincidentally equal another alias.
  const knownRefs=new Map(context.entities.flatMap((entity,index)=>[['k'+(index+1)+'_'+entity.kind+'_'+Array.from(entity.name).slice(0,4).join(''),entity],...(directed?[['k'+(index+1),entity]]:[])]));
  return target=>{
    if(directed&&typeof target==='string'){
      const known=knownRefs.get(target);if(!known)throw Error('Unknown named reference');
      target={kind:known.kind,name:known.name,ref:target,status:null};
    }
    if(directed){exactKeys(target,['kind','name'],['ref','status']);target={ref:'',status:null,...target};}
    else exactKeys(target,['kind','name','ref','status']);
    if(!['person','place','faction'].includes(target.kind)||target.ref!==null&&typeof target.ref!=='string'||target.status!==null&&(directed||!['alive','dead'].includes(target.status)||target.kind!=='person'))throw Error('Invalid named target');
    textField(target.name,60);
    let known;
    if(![null,'','null'].includes(target.ref)){
      known=knownRefs.get(target.ref);
      const local=directed&&localSymbol(target.ref);
      if(!known&&local&&local[0]===kindLetter[target.kind]&&!context.entities.some(entity=>entity.kind===target.kind&&entity.name===target.name))return {...target,known:null};
      if(!known||known.kind!==target.kind||known.name!==target.name)throw Error('Named reference mismatch');
    }
    else{const matches=context.entities.filter(entity=>entity.kind===target.kind&&entity.name===target.name);if(matches.length>1)throw Error('Ambiguous named reference');known=matches[0];}
    return {...target,known:known??null};
  };
}

export function normalizeNamedScene(wire,context){
  const directed=isV7Life(context.life)&&context.director?.version===7;
  assertPlainData(wire);exactKeys(wire,['blocks','choices','title','location','memoryDeltas',...(directed?['story']:[])]);
  if(!Array.isArray(wire.blocks)||wire.blocks.length<1||wire.blocks.length>12||!Array.isArray(wire.choices)||wire.choices.length<2||wire.choices.length>3||!Array.isArray(wire.memoryDeltas)||wire.memoryDeltas.length>16)throw Error('Invalid named scene');
  const lookup=createNamedTargetLookup(context),declarations=new Map(),counts={person:0,place:0,faction:0},literals=new Set(['self',...Object.keys(ITEMS),...Object.keys(realmCatalogFor(context.life))]);
  const targets=new Map(),symbols=new Map();
  function declare(target){
    const known=target.known,key=known?known.id:JSON.stringify([target.kind,target.name]);let declaration=declarations.get(key);
    if(!declaration){
      const id=known?'k'+(context.entities.indexOf(known)+1):({person:'p',place:'l',faction:'f'})[target.kind]+(++counts[target.kind]);
      declaration={id,...(!known?{name:target.name}:{}),kind:target.kind};declarations.set(key,declaration);
      if(declarations.size>24)throw Error('Too many named targets');
    }
    if(directed){
      targets.set(declaration.id,target);
      for(const symbol of [localSymbol(declaration.id),localSymbol(target.ref)].filter(Boolean)){
        if(symbols.has(symbol)&&symbols.get(symbol)!==declaration.id)throw Error('Conflicting local reference');
        symbols.set(symbol,declaration.id);
      }
    }
    if(target.status!==null){if(Object.hasOwn(declaration,'status')&&declaration.status!==target.status)throw Error('Contradictory named status');declaration.status=target.status;}
    return declaration.id;
  }
  const resolve=target=>declare(lookup(target));
  const blocks=wire.blocks.map(block=>{
    exactKeys(block,block.kind==='dialogue'?['kind','text','speaker']:['kind','text']);
    if(block.kind!=='dialogue')return {...block};
    if(block.speaker==='self')return {...block};
    const speaker=lookup(block.speaker);if(speaker.kind!=='person')throw Error('Invalid named speaker');
    return {...block,speaker:declare(speaker)};
  });
  const choices=wire.choices.map(choice=>{
    exactKeys(choice,['action','target','stake','purpose','anchor']);
    const targetId=typeof choice.target==='string'&&literals.has(choice.target)?choice.target:resolve(choice.target);
    return {action:choice.action,targetId,stake:choice.stake,purpose:choice.purpose,anchor:choice.anchor};
  });
  // Only a dialogue speaker or action target can establish a new bare-name
  // reference. Optional notes cannot bootstrap further participants or IDs.
  const participants=new Map(targets),localParticipants=new Map(symbols);
  function evidenceTarget(value){
    if(!directed||typeof value!=='string'||/^k\d/u.test(value))return lookup(value);
    textField(value,60);
    if(/[:/\\]/u.test(value)||context.entities.some(entity=>entity.id===value))throw Error('Invalid memory identity');
    const symbol=localSymbol(value);
    if(symbol)return participants.get(localParticipants.get(symbol))??null;
    if(/^(?:p|npc|person|l|place|f|faction|m)\d/u.test(value))throw Error('Invalid local memory reference');
    const matches=[...participants.values()].filter(target=>target.name===value),target=matches[0];
    return matches.length===1&&!context.entities.some(entity=>entity.name===value&&entity.id!==target.known?.id)?target:null;
  }
  const memoryDeltas=wire.memoryDeltas.flatMap(delta=>{
    if(Object.hasOwn(delta,'referenceId')){exactKeys(delta,['referenceId','status']);return {...delta};}
    exactKeys(delta,['target','kind','anchor'],['status']);
    if(directed){
      const obligation=['promise','clue'].includes(delta.kind);
      if(!['fact','relationship','death','promise','clue'].includes(delta.kind)||!Number.isInteger(delta.anchor)||delta.anchor<0||delta.anchor>=Math.max(4,blocks.length)||Object.hasOwn(delta,'status')&&(!obligation||delta.status!=='open'))throw Error('Invalid named evidence');
    }
    const target=evidenceTarget(delta.target);
    if(!target){if(['fact','relationship','clue'].includes(delta.kind))return [];throw Error('Unbound memory identity');}
    // A variable-length scene may end before this optional evidence slot.
    // Validate its shape and identity first; never move a death or a promise
    // to another paragraph, create its entity, or apply an unsupported status.
    if(directed&&Number.isInteger(delta.anchor)&&delta.anchor>=blocks.length&&delta.anchor<=3){
      if(delta.kind==='death'&&target.kind!=='person'||target.kind==='person'&&target.name===context.life.name)throw Error('Invalid named evidence');
      return [];
    }
    const entityId=declare(target);
    if(delta.kind==='death'){
      const declaration=[...declarations.values()].find(entity=>entity.id===entityId);
      if(declaration.kind!=='person'||Object.hasOwn(declaration,'status')&&declaration.status!=='dead')throw Error('Conflicting death record');
      declaration.status='dead';
    }
    return {entityId,kind:delta.kind,anchor:delta.anchor,...(Object.hasOwn(delta,'status')?{status:delta.status}:{})};
  });
  const story=directed?{...wire.story,...(wire.story?.npcs!==undefined?{npcs:wire.story.npcs.map(npc=>{exactKeys(npc,['target','anchor','title','signatureSpell','habit','obsession']);const {target,...traits}=npc;return {...traits,entityId:resolve(target)};})}:{})}:undefined;
  const result={blocks,choices,title:wire.title,location:wire.location,otherPeople:[],places:[],factions:[],memoryDeltas,...(directed?{story}:{})};
  for(const declaration of declarations.values()){const {kind,...entity}=declaration;result[({person:'otherPeople',place:'places',faction:'factions'})[kind]].push(entity);}
  return result;
}

// A positive trie grammar excludes known names without unsupported lookaround.
// Long names reserve only their short prefix to bound grammar size as history
// grows; known identities use their compact, unambiguous input aliases instead.
function newNamePattern(names,{prefix='',noWorld=false}={}){
  const root={children:new Map(),exact:false,branch:false};
  for(const name of new Set(names)){
    if(!name.startsWith(prefix))continue;
    const suffix=Array.from(name.slice(prefix.length));
    if(noWorld&&suffix.includes('界'))continue;
    let node=root;for(const ch of suffix.slice(0,4)){if(!node.children.has(ch))node.children.set(ch,{children:new Map(),exact:false,branch:false});node=node.children.get(ch);}
    if(suffix.length>4)node.branch=true;else node.exact=true;
  }
  const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');
  const classChar=value=>value.replace(/[\\\]\[\-^]/gu,'\\$&');
  const any=noWorld?'[^界]':'.';
  function branch(node){
    if(node.branch)return null;
    if(!node.children.size)return any+(node.exact?'+':'*');
    const forbidden=[...node.children.keys(),...(noWorld?['界']:[])];
    const alternatives=[(forbidden.length?'[^'+[...new Set(forbidden)].map(classChar).join('')+']':any)+any+'*'];
    const tails=new Map();for(const [ch,child]of node.children){const tail=branch(child);if(tail!==null){const letters=tails.get(tail)??[];letters.push(ch);tails.set(tail,letters);}}
    for(const [tail,letters]of tails)alternatives.push((letters.length===1?escaped(letters[0]):'['+letters.map(classChar).join('')+']')+tail);
    const content=alternatives.length===1?alternatives[0]:'(?:'+alternatives.join('|')+')';
    return node.exact?content:'(?:'+content+')?';
  }
  return escaped(prefix)+(branch(root)??'');
}

function directedTargets(context,includeMemoryTypes=true){
  const definitions={},fresh=new Map(),scopes=new Map(),parts=new Map();
  const entities=new Map(context.entities.map(entity=>[entity.id,entity]));
  const selected=context.receipt.action,failedCrossing=context.receipt.cultivationResult?.check?.kind==='world-crossing'&&context.receipt.cultivationResult.check.success===false;
  const location=selected?.intent==='travel'&&!failedCrossing?entities.get(selected.targetId)?.name:context.phase==='choice'?context.director.world.location:null;
  function newTarget(kind,travel=null){
    const key=kind+(travel??''),existing=fresh.get(key);if(existing)return {$ref:'#/$defs/'+existing};
    const names=context.entities.filter(entity=>entity.kind===kind).map(entity=>entity.name);
    if(kind==='person')names.push(context.life.name,'你','玩家','主角');
    if(travel&&location)names.push(location);
    let pattern;
    if(travel){
      const tier=context.life.cultivationProfile.worldTier+(travel==='crossing'?1:0),prefix=WORLD_TIERS[tier];
      const alternatives=travel==='local'?[newNamePattern(names,{noWorld:true})]:[];
      if(prefix)alternatives.push(newNamePattern(names,{prefix,noWorld:true}));
      pattern='^(?:'+alternatives.join('|')+')$';
    }else pattern='^'+newNamePattern(names)+'$';
    const name=kind+(travel??'New')+'Target';fresh.set(key,name);
    definitions[name]={type:'object',additionalProperties:false,required:['kind','name'],properties:{kind:{const:kind},name:{type:'string',minLength:1,maxLength:60,pattern}}};
    return {$ref:'#/$defs/'+name};
  }
  function fromIds(ids,{travel=null}={}){
    const literals=[],kinds=new Set(),known=new Map();
    for(const id of ids){
      const match=/^([plf])\d+$/u.exec(id),entity=entities.get(id);
      if(match)kinds.add(({p:'person',l:'place',f:'faction'})[match[1]]);
      else if(entity){const values=known.get(entity.kind)??[];values.push(id);known.set(entity.kind,values);}
      else literals.push(id);
    }
    const alternatives=literals.length?[{enum:literals}]:[];
    for(const kind of ['person','place','faction']){
      const values=known.get(kind)??[],hasNew=kinds.has(kind);if(!values.length&&!hasNew)continue;
      const placement=kind==='place'&&hasNew?travel:null,key=JSON.stringify({kind,values,hasNew,placement});
      if(!parts.has(key)){
        const choices=[...(values.length?[{enum:values}]:[]),...(hasNew?[newTarget(kind,placement)]:[])],name='kindTargets'+parts.size;
        parts.set(key,name);definitions[name]=choices.length===1?choices[0]:{oneOf:choices};
      }
      alternatives.push({$ref:'#/$defs/'+parts.get(key)});
    }
    if(alternatives.length===1)return alternatives[0];
    const key=JSON.stringify(alternatives);if(scopes.has(key))return {$ref:'#/$defs/'+scopes.get(key)};
    const name='targets'+scopes.size;scopes.set(key,name);definitions[name]=alternatives.length===1?alternatives[0]:{oneOf:alternatives};
    return {$ref:'#/$defs/'+name};
  }
  if(includeMemoryTypes){
    for(const kind of ['person','place','faction'])definitions[kind+'Target']=fromIds([...context.entities.filter(entity=>entity.kind===kind).map(entity=>entity.id),({person:'p',place:'l',faction:'f'})[kind]+'1']);
    definitions.entityTarget={oneOf:['person','place','faction'].map(kind=>({$ref:'#/$defs/'+kind+'Target'}))};
  }
  return {definitions,fromIds};
}

export function buildNamedSceneSchema(source,context,{blocks,location,engineMenu=false}={}){
  const directed=isV7Life(context.life)&&context.director?.version===7;
  const narrativeOnly=directed&&engineMenu;
  const scoped=directed?directedTargets(context,!narrativeOnly):null;
  const named={};for(const kind of ['person','place','faction']){
    const ambiguous=context.entities.some((entity,index)=>entity.kind===kind&&context.entities.slice(0,index).some(previous=>previous.kind===kind&&previous.name===entity.name));
    named[kind]={type:'object',additionalProperties:false,required:['kind','name','ref','status'],properties:{kind:{const:kind},name:{type:'string',minLength:1,maxLength:60},ref:ambiguous?{type:'string',maxLength:80}:{const:''},status:{const:null}}};
  }
  const definitions=scoped?.definitions??Object.fromEntries(Object.entries(named).map(([kind,schema])=>[kind+'Target',schema]));if(!scoped)definitions.entityTarget={oneOf:Object.keys(named).map(kind=>({$ref:'#/$defs/'+kind+'Target'}))};
  const body=structuredClone(blocks??source.properties.blocks);
  const variants=body.items.oneOf??[body.items];
  for(const variant of variants){
    delete variant.properties.text.maxLength;
    if(variant.properties.kind.const!=='dialogue')continue;
    const speaker=variant.properties.speaker,known=typeof speaker.const==='string'?context.entities.find(entity=>entity.id===speaker.const):null;
    if(scoped)variant.properties.speaker=speaker.const?{const:speaker.const}:scoped.fromIds(speaker.enum??[]);
    else if(known)variant.properties.speaker={type:'object',additionalProperties:false,required:['kind','name','ref','status'],properties:{kind:{const:'person'},name:{const:known.name},ref:{const:known.id},status:{const:null}}};
    else variant.properties.speaker=speaker.const==='self'?{const:'self'}:speaker.enum?.includes('self')?{oneOf:[{const:'self'},{$ref:'#/$defs/personTarget'}]}:{$ref:'#/$defs/personTarget'};
    // Native JSON generation follows property order. Resolve the name before
    // prose so a dialogue starts in its final presentation shape.
    variant.properties={kind:variant.properties.kind,speaker:variant.properties.speaker,text:variant.properties.text};
    variant.required=['kind','speaker','text'];
  }
  const closures=directed?source.properties.memoryDeltas.items.oneOf.filter(row=>row.properties.referenceId).map(row=>structuredClone(row)):[{type:'object',additionalProperties:false,required:['referenceId','status'],properties:{referenceId:{type:'string'},status:{enum:['resolved','broken']}}}];
  if(narrativeOnly){
    const properties={blocks:body};
    // A normal turn needs prose only. When the frozen context provides an
    // actual open record, allow an optional decision about exactly that record.
    if(closures.length)properties.memoryDeltas={type:'array',maxItems:16,items:closures.length===1?closures[0]:{oneOf:closures}};
    return {type:'object',additionalProperties:false,required:['blocks'],properties,...(Object.keys(definitions).length?{$defs:definitions}:{})};
  }
  const anchor={type:'integer',minimum:0,maximum:(body.maxItems??4)-1};
  if(scoped){definitions.choicePurpose={type:'string',minLength:1,maxLength:50};definitions.blockAnchor=anchor;definitions.stakes={enum:['low','normal','high']};}
  const choices={type:'array',minItems:2,maxItems:3,items:{oneOf:source.properties.choices.items.oneOf.map(group=>{
    if(scoped){
      const actions=group.properties.action.enum,travel=actions.some(action=>action.startsWith('travel:'))?(actions.some(action=>WORLD_TRAVEL_APPROACHES.includes(action.split(':')[1]))?'crossing':'local'):null;
      // Only actual decisions go on the model wire. The adapter supplies the
      // unused choice anchor and the rule-fixed low stake of an interaction.
      const variableStake=!actions.every(action=>action.startsWith('interact:'));
      return {type:'object',additionalProperties:false,required:['action','target',...(variableStake?['stake']:[]),'purpose'],properties:{action:group.properties.action,target:scoped.fromIds(group.properties.targetId.enum,{travel}),...(variableStake?{stake:group.properties.stake.enum?.join(',')==='low,normal,high'?{$ref:'#/$defs/stakes'}:group.properties.stake}:{}),purpose:Object.hasOwn(group.properties.purpose??{},'const')?group.properties.purpose:{$ref:'#/$defs/choicePurpose'}}};
    }
    const values=group.properties.targetId.enum,kinds=new Set(),strings=[];
    for(const id of values){const known=context.entities.find(entity=>entity.id===id),fresh=/^([plf])\d+$/u.exec(id);if(known)kinds.add(known.kind);else if(fresh)kinds.add(({p:'person',l:'place',f:'faction'})[fresh[1]]);else strings.push(id);}
    const alternatives=[...(strings.length?[{enum:strings}]:[]),...[...kinds].map(kind=>({$ref:'#/$defs/'+kind+'Target'}))],target=alternatives.length===1?alternatives[0]:{oneOf:alternatives};
    return {type:'object',additionalProperties:false,required:['action','target','stake','purpose','anchor'],properties:{action:group.properties.action,target,stake:group.properties.stake,purpose:{type:'string',minLength:1,maxLength:50},anchor:{type:'integer',minimum:0,maximum:(body.maxItems??4)-1}}};
  })}};
  const evidence=(kind,entity='entityTarget',open=false)=>({type:'object',additionalProperties:false,required:['target','kind','anchor',...(open?['status']:[])],properties:{target:{$ref:'#/$defs/'+entity},kind,anchor:directed?{$ref:'#/$defs/blockAnchor'}:anchor,...(open?{status:{const:'open'}}:{})}});
  const memoryDeltas={type:'array',maxItems:16,items:{oneOf:[evidence({enum:directed?['fact','relationship']:['fact','relationship','death']}),...(directed?[evidence({const:'death'},'personTarget')]:[]),evidence({enum:['promise','clue']},'entityTarget',true),...closures]}};
  const properties={blocks:body,choices,title:source.properties.title,location:location??source.properties.location,memoryDeltas,...(directed?{story:structuredClone(source.properties.story)}:{})};
  if(directed){
    properties.story.properties.anchors.items.maximum=(body.maxItems??4)-1;
    const traits=properties.story.properties.npcs.items;delete traits.properties.entityId;traits.properties={target:{$ref:'#/$defs/personTarget'},...traits.properties};traits.required=['target','anchor'];traits.properties.anchor.maximum=(body.maxItems??4)-1;
    for(const field of ['title','signatureSpell','habit','obsession'])traits.properties[field].minLength=1;
  }
  return {type:'object',additionalProperties:false,required:directed?['blocks','choices']:Object.keys(properties),properties,$defs:definitions};
}
