import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

let source=(await readFile('tests/river-chronicle.test.js','utf8')).replace(/\r\n/g,'\n');
const sourceHash=createHash('sha256').update(source).digest('hex');
function insert(before,after){
 if(source.split(before).length!==2)throw Error('Audit insertion point changed: '+before);
 source=source.replace(before,after);
}
source=source.replaceAll("'./fixtures/","'../tests/fixtures/");
insert('observe(key,next);','observe(key,next,state);');
insert('const route=[],blocks=new Set(),hunted=new Set(),resumed=new Set(),directions=new Set();','const audit=[];const route=[],blocks=new Set(),hunted=new Set(),resumed=new Set(),directions=new Set();');
insert('const observe=(key,state)=>{',`const observe=(key,state,prior)=>{
 audit.push({turn:state.turnId,key,realm:prior.life.realm,node:prior.events.node,next:state.events.node,days:state.lastReceipt.elapsedDays,intent:state.lastReceipt.action.intent,changed:Object.keys(state.events).filter(k=>!['node','page'].includes(k)&&JSON.stringify(state.events[k])!==JSON.stringify(prior.events[k])),title:prior.currentScene.title,blocks:prior.currentScene.blocks.map(b=>b.text)});`);
const browser=" const {liveBrowser}=await import('./helpers/live-browser.js'),{page}=await liveBrowser(t);";
insert(browser,` const {writeFile}=await import('node:fs/promises');await writeFile('.scratch/campaign-pacing.json',JSON.stringify({revision:'edf6a40b8f5a66252d10ded5f58cb86ed88e4294',sourceHash:'${sourceHash}',turn:s.turnId,realm:s.life.realm,events:s.events,audit},null,2));return;\n`+browser);
await writeFile('.scratch/pacing-audit.test.mjs',source);
