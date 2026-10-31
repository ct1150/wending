import {STORY_LIMITS} from './story-config.js';

const encoder=new TextEncoder(),fields=new Set(['blocks','choices','title','location','memoryDeltas','story']);
const reserved=new Set(['__proto__','constructor','prototype','life','receipt','retrieval','identity','items','rng','stateHash','baseRevision','namespace','entities','relatedEntities','cultivationProfile','itemChanges','relationChanges']);
const space=ch=>ch===' '||ch==='\n'||ch==='\r'||ch==='\t';
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const bad=()=>{throw Error('Unreadable scene fragment');};

// The caller checks the finish reason, usage, thinking and response limit first.
// This recovers only slices from one damaged v7 envelope. No display preview,
// guessed string terminator, invented target, title or decision enters it.
export function readCompleteV7Wire(source){
  if(typeof source!=='string'||source.length>STORY_LIMITS.maxResponseBytes||encoder.encode(source).length>STORY_LIMITS.maxResponseBytes)return null;
  try{JSON.parse(source);return null;}catch{/* Valid completions use the ordinary path. */}
  try{
    const skip=i=>{while(i<source.length&&space(source[i]))i++;return i;};
    const start=skip(0);if(source[start]!=='{')return null;
    const ends=new Map(),stack=[];let closed=false;
    // Index complete containers and strings in one bounded pass. Also inspect
    // the unused tail: a second document or an explicit authority field must
    // never be hidden by dropping an unfinished third choice or optional note.
    for(let i=start;i<source.length;i++){
      const ch=source[i];if(closed){if(!space(ch))bad();continue;}
      if(ch==='"'){
        const begin=i;let done=false;
        while(++i<source.length){if(source[i]==='\\'){i++;continue;}if(source.charCodeAt(i)<32)bad();if(source[i]==='"'){done=true;break;}}
        if(done){ends.set(begin,i+1);if(source[skip(i+1)]===':'&&reserved.has(JSON.parse(source.slice(begin,i+1))))bad();}
      }else if(ch==='{'||ch==='['){stack.push([ch,i]);if(stack.length>32)bad();}
      else if(ch==='}'||ch===']'){
        const open=stack.pop();if(!open||open[0]!==({'}':'{',']':'['})[ch])bad();
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
          if(!record(row)||Object.keys(row).length!==5||!nonempty(row.action)||!nonempty(row.purpose)||!['low','normal','high'].includes(row.stake)||!Number.isInteger(row.anchor)||row.anchor<0||!(nonempty(row.target)||record(row.target)&&['person','place','faction'].includes(row.target.kind)&&nonempty(row.target.name)))bad();
          rows.push(row);
        }
        i=skip(end);if(i===source.length||source[i]===']')break;
        if(source[i]!==',')bad();i=skip(i+1);
      }
      if(rows.length<2)bad();if(source[i]===']')i++;output.choices=rows;
    }
    while(i<source.length&&source[i]!=='}'){
      if(source[i]!=='"'||!ends.has(i))bad();const end=ends.get(i),key=read(i,end);
      if(!fields.has(key)||seen.has(key))bad();seen.add(key);i=skip(end);if(source[i]!==':')bad();i=skip(i+1);
      if(key==='choices')takeChoices();
      else{
        const valueEnd=span(i);
        if(valueEnd===undefined){if(i<source.length&&!['[','{','"'].includes(source[i]))bad();break;}
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
