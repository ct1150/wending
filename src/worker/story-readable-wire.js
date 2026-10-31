import {STORY_LIMITS} from './story-config.js';
import {isFixedV7Interaction} from './story-v7-presentation.js';

const encoder=new TextEncoder(),fields=new Set(['blocks','choices','title','location','memoryDeltas','story']);
const reserved=new Set(['__proto__','constructor','prototype','life','receipt','retrieval','identity','items','rng','stateHash','baseRevision','namespace','entities','relatedEntities','cultivationProfile','itemChanges','relationChanges']);
const space=ch=>ch===' '||ch==='\n'||ch==='\r'||ch==='\t';
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const bad=()=>{throw Error('Unreadable scene fragment');};

// The caller checks the finish reason, usage, thinking and response limit first.
// This recovers only slices from one damaged v7 envelope. No display preview,
// guessed string terminator, invented target, title or decision enters it.
export function readCompleteV7Wire(source){return readWire(source,null);}
export function readCompleteV7Body(source,context){
  if(context?.director?.version!==7||context.life?.cultivationProfile?.version!==7)return null;
  return readWire(source,context);
}

function readWire(source,bodyContext){
  if(typeof source!=='string'||source.length>STORY_LIMITS.maxResponseBytes||encoder.encode(source).length>STORY_LIMITS.maxResponseBytes)return null;
  try{JSON.parse(source);return null;}catch{/* Valid completions use the ordinary path. */}
  try{
    const skip=i=>{while(i<source.length&&space(source[i]))i++;return i;};
    let start=skip(0);
    if(bodyContext&&source.startsWith('```',start)){
      const fence=/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t\r\n]*$/iu.exec(source.slice(start));
      if(!fence)return null;JSON.parse(fence[1]);source=fence[1];start=skip(0);
    }
    if(source[start]!=='{')return null;
    const ends=new Map(),unfinished=new Map(),keyOwners=new Map(),stack=[];let closed=false;
    // Index complete containers and strings in one bounded pass. Also inspect
    // the unused tail: a second document or an explicit authority field must
    // never be hidden by dropping an unfinished third choice or optional note.
    for(let i=start;i<source.length;i++){
      const ch=source[i];if(closed){if(!space(ch))bad();continue;}
      if(ch==='"'){
        const begin=i;let done=false;
        while(++i<source.length){if(source[i]==='\\'){i++;continue;}if(!bodyContext&&source.charCodeAt(i)<32)bad();if(source[i]==='"'){done=true;break;}}
        if(done){ends.set(begin,i+1);if(source[skip(i+1)]===':'){
          if(bodyContext)keyOwners.set(begin,stack.at(-1)?.[1]);else if(reserved.has(JSON.parse(source.slice(begin,i+1))))bad();
        }}
      }else if(ch==='{'||ch==='['){stack.push([ch,i]);if(stack.length>32)bad();}
      else if(ch==='}'||ch===']'){
        const type=({'}':'{',']':'['})[ch];let open=stack.pop();
        if(!open||open[0]!==type){
          // One omitted inner terminator: discard that unfinished value, but
          // keep the real outer boundary so later memory records are still read.
          if(!bodyContext||!open||stack.at(-1)?.[0]!==type)bad();
          unfinished.set(open[1],i);open=stack.pop();
        }
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
    function partialConsequence(at,until){
      for(const [begin,end]of ends){
        if(begin<at||begin>=until||source[begin]!=='"'||source[skip(end)]!==':')continue;
        const key=read(begin,end);if(key==='referenceId')return true;
        if(key!=='kind'&&key!=='status')continue;
        const value=skip(skip(end)+1),stop=ends.get(value);
        if(source[value]==='"'&&stop&&['death','promise','resolved','broken'].includes(read(value,stop)))return true;
      }
      return false;
    }
    function takeRecords(key,limit){
      // Only immediate, individually closed records count. Never synthesize
      // a quote, finish a block or search nested objects for substitute prose.
      if(source[i]!=='[')bad();const cutoff=unfinished.get(i)??source.length;i=skip(i+1);const rows=[];
      while(i<cutoff&&source[i]!==']'){
        if(source[i]!=='{')bad();const end=ends.get(i);
        if(end===undefined){
          const stop=unfinished.get(i)??cutoff;
          if(key==='memoryDeltas'&&partialConsequence(i,stop))bad();
          i=stop;break;
        }
        if(rows.length>=limit)bad();let row=read(i,end);
        if(key==='blocks'){
          if(!record(row)||!nonempty(row.text)||!['narration','dialogue'].includes(row.kind)||row.kind==='dialogue'&&!Object.hasOwn(row,'speaker'))bad();
          row=row.kind==='dialogue'?{kind:row.kind,speaker:row.speaker,text:row.text}:{kind:row.kind,text:row.text};
        }
        rows.push(row);i=skip(end);
        if(i===cutoff||source[i]===']')break;
        if(source[i]!==',')bad();i=skip(i+1);
      }
      if(source[i]===']')i++;output[key]=rows;
    }
    function ignoreField(){
      // Neither suggestions nor unsolicited annotations are game inputs. Skip
      // their entire value; never search inside it for blocks or consequences.
      i=span(i)??unfinished.get(i)??source.length;
    }
    function takeChoices(){
      if(source[i]!=='[')bad();i=skip(i+1);const rows=[];let count=0;
      while(i<source.length&&source[i]!==']'){
        if(source[i]!=='{'||++count>3)bad();const end=ends.get(i);
        if(end===undefined){if(count!==3||rows.length!==2)bad();i=source.length;break;}
        let row;try{row=read(i,end);}catch{if(count!==3||rows.length!==2)bad();}
        if(row!==undefined){
          if(!record(row)||Object.keys(row).some(key=>!['action','target','stake','purpose','anchor'].includes(key))||!nonempty(row.action)||!nonempty(row.purpose)||!['low','normal','high'].includes(row.stake)&&!(isFixedV7Interaction(row.action)&&row.stake===undefined)||row.anchor!==undefined&&(!Number.isInteger(row.anchor)||row.anchor<0)||!(nonempty(row.target)||record(row.target)&&['person','place','faction'].includes(row.target.kind)&&nonempty(row.target.name)))bad();
          rows.push(row);
        }
        i=skip(end);if(i===source.length||source[i]===']')break;
        if(source[i]!==',')bad();i=skip(i+1);
      }
      if(rows.length<2)bad();if(source[i]===']')i++;output.choices=rows;
    }
    while(i<source.length&&source[i]!=='}'){
      if(source[i]!=='"'||!ends.has(i)||bodyContext&&keyOwners.get(i)!==start)bad();const end=ends.get(i),key=read(i,end);
      const retained=fields.has(key)&&!(bodyContext&&key==='choices');
      if(!bodyContext&&!retained||retained&&seen.has(key))bad();seen.add(key);i=skip(end);if(source[i]!==':')bad();i=skip(i+1);
      if(bodyContext&&(!fields.has(key)||key==='choices'))ignoreField();
      else if(bodyContext&&key==='blocks')takeRecords(key,4);
      else if(bodyContext&&key==='memoryDeltas'&&source[i]==='[')takeRecords(key,16);
      else if(key==='choices')takeChoices();
      else{
        const valueEnd=span(i);
        if(valueEnd===undefined){if(bodyContext&&key==='memoryDeltas'||i<source.length&&!['[','{','"'].includes(source[i]))bad();break;}
        let value;try{value=read(i,valueEnd);}catch{if(key==='blocks'||bodyContext&&key==='memoryDeltas')bad();}
        if(value!==undefined)output[key]=value;i=valueEnd;
      }
      i=skip(i);if(i===source.length||source[i]==='}')break;
      if(source[i]!==',')bad();i=skip(i+1);
    }
    const blocks=output.blocks;
    if(!Array.isArray(blocks)||!blocks.length||blocks.length>4||!blocks.every(row=>record(row)&&nonempty(row.text)&&(row.kind==='narration'&&Object.keys(row).length===2||row.kind==='dialogue'&&Object.keys(row).length===3&&Object.hasOwn(row,'speaker')))||!bodyContext&&!output.choices)return null;
    return output;
  }catch{return null;}
}
