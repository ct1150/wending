import {ITEMS,REALMS} from './model.js';
import {formatStoryChoiceLabel} from './story-choice-label.js';

// Parse only bounded JSON prefixes. Completeness belongs to each value, so an
// unfinished string can be displayed without treating the document as a scene.
function partialJson(source){
  if(typeof source!=='string'||source.length>65536)return null;
  let index=0,nodes=0,invalid=false;
  const space=()=>{while(index<source.length&&/\s/u.test(source[index]))index++;};
  function string(){
    index++;let value='';
    while(index<source.length){
      let char=source[index++];
      if(char==='"')return {type:'string',value,complete:true};
      if(char==='\\'){
        if(index>=source.length)break;
        char=source[index++];
        if(char==='u'){
          const digits=source.slice(index,index+4);
          if(!/^[a-f0-9]{4}$/iu.test(digits)){if(!/^[a-f0-9]{0,3}$/iu.test(digits))invalid=true;break;}
          value+=String.fromCharCode(parseInt(digits,16));index+=4;
        }else{
          const escapes={'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'};
          if(!Object.hasOwn(escapes,char)){invalid=true;break;}value+=escapes[char];
        }
      }else{if(char.charCodeAt(0)<32){invalid=true;break;}value+=char;}
    }
    if(/[\ud800-\udbff]$/u.test(value))value=value.slice(0,-1);
    return {type:'string',value,complete:false};
  }
  function value(depth=0){
    if(++nodes>12000||depth>32){invalid=true;return null;}space();
    if(index>=source.length)return null;
    if(source[index]==='"')return string();
    if(source[index]==='{'){
      index++;const node={type:'object',value:new Map(),complete:false};space();
      if(source[index]==='}'){index++;node.complete=true;return node;}
      while(index<source.length){
        space();if(index>=source.length)return node;
        if(source[index]!=='"'){invalid=true;return node;}
        const key=string();if(!key.complete)return node;
        if(node.value.has(key.value)){invalid=true;return node;}
        space();if(index>=source.length)return node;
        if(source[index++]!==':'){invalid=true;return node;}
        const child=value(depth+1);node.value.set(key.value,child);
        if(!child?.complete)return node;
        space();if(index>=source.length)return node;
        if(source[index]==='}'){index++;node.complete=true;return node;}
        if(source[index++]!==','){invalid=true;return node;}
      }
      return node;
    }
    if(source[index]==='['){
      index++;const node={type:'array',value:[],complete:false};space();
      if(source[index]===']'){index++;node.complete=true;return node;}
      while(index<source.length){
        const child=value(depth+1);if(!child)return node;node.value.push(child);
        if(!child.complete)return node;
        space();if(index>=source.length)return node;
        if(source[index]===']'){index++;node.complete=true;return node;}
        if(source[index++]!==','){invalid=true;return node;}
      }
      return node;
    }
    const start=index;while(index<source.length&&!/[\s,}\]]/u.test(source[index]))index++;
    const token=source.slice(start,index),complete=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?)$/iu.test(token);
    if(!complete&&!(index===source.length&&(/^(?:t(?:r(?:u)?)?|f(?:a(?:l(?:s)?)?)?|n(?:u(?:l)?)?)$/u.test(token)||/^-?(?:\d+(?:\.\d*)?(?:e[+-]?\d*)?)?$/iu.test(token))))invalid=true;
    return {type:'literal',value:token,complete};
  }
  const root=value();space();if(root?.complete&&index<source.length)invalid=true;
  return invalid?null:root;
}
const field=(node,key)=>node?.type==='object'?node.value.get(key):undefined;
const rows=node=>node?.type==='array'?node.value:[];
const text=(node,{complete=false,max=2000}={})=>node?.type==='string'&&(!complete||node.complete)&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(node.value)?node.value.slice(0,max):null;

// V1 remains text-only for old clients and in-flight attempts.
export function readStoryPreview(source){
  const root=partialJson(source);
  return rows(field(root,'blocks')).slice(0,12).map(block=>text(field(block,'text'))??'').filter(Boolean).join('\n\n');
}

// Display-only drafts expose no action, target, identity, memory or effects.
// Array order is stable: an incomplete row never lets a later row take its slot.
export function readStoryPresentation(source,context={},{authoredChoices=false}={}){
  const root=partialJson(source),blocks=[],choices=[];
  function target(node){
    const literal=text(node,{complete:true,max:80});
    if(literal!==null){
      if(literal==='self')return {id:literal,name:context.life?.name??'你'};
      if(Object.hasOwn(ITEMS,literal)||Object.hasOwn(REALMS,literal))return {id:literal,name:ITEMS[literal]??REALMS[literal].name};
      const known=(context.entities??[]).find((entity,index)=>entity.id===literal||'k'+(index+1)===literal||'k'+(index+1)+'_'+entity.kind+'_'+Array.from(entity.name).slice(0,4).join('')===literal);
      if(known)return {id:literal,name:known.name};
      for(const name of ['otherPeople','places','factions'])for(const entity of rows(field(root,name)))if(text(field(entity,'id'),{complete:true,max:80})===literal){const label=text(field(entity,'name'),{complete:true,max:60});if(label)return {id:literal,name:label};}
      return null;
    }
    const kind=text(field(node,'kind'),{complete:true,max:10}),name=text(field(node,'name'),{complete:true,max:60});
    return ['person','place','faction'].includes(kind)&&name?.trim()?{id:'',name}:null;
  }
  for(const block of rows(field(root,'blocks')).slice(0,12)){
    const kind=text(field(block,'kind'),{complete:true,max:10}),content=text(field(block,'text'));
    if(!['narration','dialogue'].includes(kind)||content===null)break;
    const speaker=kind==='dialogue'?target(field(block,'speaker')):null;
    if(kind==='dialogue'&&!speaker?.name)break;
    blocks.push({kind,...(speaker?{speaker:speaker.name.slice(0,60)}:{}),text:content,complete:block.complete});
  }
  for(const choice of rows(field(root,'choices')).slice(0,3)){
    const action=text(field(choice,'action'),{complete:true,max:40}),resolved=target(field(choice,'target')??field(choice,'targetId')),purpose=text(field(choice,'purpose'),{max:50});
    if(!action||!resolved||purpose===null)break;
    const label=formatStoryChoiceLabel({action,targetId:resolved.id,targetName:resolved.name,purpose,authoredChoices});
    if(!label)break;
    choices.push({label:label.slice(0,120),complete:choice.complete});
  }
  return {blocks,choices};
}
