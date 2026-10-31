import {STORY_LIMITS} from './story-config.js';
import {isFixedV7Interaction,normalizeAuthoredChoiceFields} from './story-v7-presentation.js';

const encoder=new TextEncoder(),fields=new Set(['blocks','choices','title','location','memoryDeltas','story']);
const reserved=new Set(['__proto__','constructor','prototype','life','receipt','retrieval','identity','items','rng','stateHash','baseRevision','namespace','entities','relatedEntities','cultivationProfile','itemChanges','relationChanges']);
const space=ch=>ch===' '||ch==='\n'||ch==='\r'||ch==='\t';
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const bad=()=>{throw Error('Unreadable scene fragment');};

// The caller checks the finish reason, usage, thinking and response limit first.
// This recovers only slices from one damaged v7 envelope. No display preview,
// guessed string terminator, invented target, title or decision enters it.
export function readCompleteV7Wire(source,{authoredChoices=false}={}){
  if(typeof source!=='string'||source.length>STORY_LIMITS.maxResponseBytes||encoder.encode(source).length>STORY_LIMITS.maxResponseBytes)return null;
  const fence=/^```(?:json)?[ \t]*\r?\n([\s\S]+?)\r?\n```$/iu.exec(source.trim());
  if(fence){
    source=fence[1];
    try{JSON.parse(source);}catch{return null;}
  }
  else try{JSON.parse(source);return null;}catch{/* Valid completions use the ordinary path. */}
  try{
    const skip=i=>{while(i<source.length&&space(source[i]))i++;return i;};
    const start=skip(0);
    if(source[start]!=='{')return null;
    const ends=new Map(),stack=[];let closed=false;
    // Index complete containers and strings in one bounded pass. Also inspect
    // the unused tail: a second document or an explicit authority field must
    // never be hidden by dropping an unfinished third choice or optional note.
    for(let i=start;i<source.length;i++){
      const ch=source[i];if(closed){
        if(space(ch))continue;
        // Only a brief Chinese signoff outside the finished root. Reject a
        // second document, a fence with a postscript, or machine fields.
        const tail=source.slice(i).trim();
        if(authoredChoices&&!fence&&tail.length<=120&&/^(?:【[\p{Script=Han} ，。！、…]+】|（[\p{Script=Han} ，。！、…]+）|(?:本回合|本幕|本章|请你选择|请选择)[\p{Script=Han} ，。！、…]*)$/u.test(tail))break;
        bad();
      }
      if(ch==='"'){
        const begin=i;let done=false;
        while(++i<source.length){if(source[i]==='\\'){i++;continue;}if(source.charCodeAt(i)<32)bad();if(source[i]==='"'){done=true;break;}}
        if(done){ends.set(begin,i+1);if(source[skip(i+1)]===':'){
          if(reserved.has(JSON.parse(source.slice(begin,i+1))))bad();
        }}
      }else if(ch==='{'||ch==='['){stack.push([ch,i]);if(stack.length>32)bad();}
      else if(ch==='}'||ch===']'){
        const type=({'}':'{',']':'['})[ch];const open=stack.pop();if(!open||open[0]!==type)bad();
        ends.set(open[1],i+1);if(!stack.length)closed=true;
      }
      if(ends.size>12000)bad();
    }
    const output={},seen=new Set();let i=skip(start+1);
    const span=at=>{
      if(['[','{','"'].includes(source[at]))return ends.get(at);
      let j=at;while(j<source.length&&!space(source[j])&&!(',}]'.includes(source[j])))j++;return j>at?j:undefined;
    };
    const read=(a,b)=>JSON.parse(source.slice(a,b));
    function takeChoices(){
      if(source[i]!=='[')bad();i=skip(i+1);const rows=[];let count=0;
      while(i<source.length&&source[i]!==']'){
        if(source[i]!=='{'||++count>3)bad();const end=ends.get(i);
        if(end===undefined){if(count!==3||rows.length!==2)bad();i=source.length;break;}
        let row;try{row=read(i,end);}catch{if(count!==3||rows.length!==2)bad();}
        if(row!==undefined){
          const candidate=authoredChoices?normalizeAuthoredChoiceFields(row):row;
          const target=authoredChoices&&!Object.hasOwn(candidate,'target')?candidate.targetId:candidate.target;
          if(!record(candidate)||Object.keys(candidate).some(key=>!['action','target','stake','purpose','anchor'].includes(key)&&!(authoredChoices&&key==='targetId'&&!Object.hasOwn(candidate,'target'))))bad();
          if(!nonempty(candidate.action)||!nonempty(candidate.purpose)||!['low','normal','high'].includes(candidate.stake)&&!(isFixedV7Interaction(candidate.action)&&candidate.stake===undefined))bad();
          if(candidate.anchor!==undefined&&(!Number.isInteger(candidate.anchor)||candidate.anchor<0)||!(nonempty(target)||record(target)&&['person','place','faction'].includes(target.kind)&&nonempty(target.name)))bad();
          rows.push(row);
        }
        i=skip(end);if(i===source.length||source[i]===']')break;
        if(source[i]!==',')bad();i=skip(i+1);
      }
      if(rows.length<2)bad();if(source[i]===']')i++;output.choices=rows;
    }
    while(i<source.length&&source[i]!=='}'){
      if(source[i]!=='"'||!ends.has(i))bad();const end=ends.get(i),key=read(i,end);
      if((!fields.has(key)&&!(authoredChoices&&key==='afterword'))||seen.has(key))bad();seen.add(key);i=skip(end);if(source[i]!==':')bad();i=skip(i+1);
      if(key==='choices')takeChoices();
      else{
        if(key==='afterword'&&(source[i]!=='"'||!ends.has(i)&&!/^"【?[\p{Script=Han} ，。！、；《》“”（）…]*$/u.test(source.slice(i))))bad();
        const valueEnd=span(i);
        if(valueEnd===undefined){
          if(i<source.length&&!['[','{','"'].includes(source[i]))bad();
          if(authoredChoices&&key==='memoryDeltas'&&source[i]==='['){
            // The final note can be incomplete after an earlier full promise
            // or closure. Decode each finished record from its own source span.
            const notes=[];
            let at=skip(i+1);
            while(source[at]==='{'&&ends.has(at)){
              const end=ends.get(at),note=read(at,end);
              if(!record(note)||!Object.hasOwn(note,'kind')&&!Object.hasOwn(note,'referenceId'))break;
              if(notes.length>=16)bad();
              notes.push(note);
              at=skip(end);
              if(source[at]!==',')break;
              at=skip(at+1);
            }
            if(notes.length)output.memoryDeltas=notes;
          }
          break;
        }
        let value;try{value=read(i,valueEnd);}catch{if(key==='blocks')bad();}
        if(value!==undefined)output[key]=value;i=valueEnd;
      }
      i=skip(i);if(i===source.length||source[i]==='}')break;
      if(source[i]!==',')bad();i=skip(i+1);
    }
    const blocks=output.blocks;
    if(!Array.isArray(blocks)||!blocks.length||blocks.length>4||!blocks.every(row=>record(row)&&nonempty(row.text)&&(row.kind==='narration'&&Object.keys(row).length===2||row.kind==='dialogue'&&Object.keys(row).length===3&&Object.hasOwn(row,'speaker')))||!output.choices)return null;
    return output;
  }catch{return null;}
}
