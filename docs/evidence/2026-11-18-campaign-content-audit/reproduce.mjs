// Run from repository root. Audits the pinned native route, not browser clicks or human time.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile,symlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const revision='5cbcaba92956d2d05f878d3b5ff0ca9ae78c367c';
await mkdir('.scratch',{recursive:true});
const base=await mkdtemp(resolve('.scratch/campaign-content-audit-'));
execFileSync('git',['archive','--output='+join(base,'base.tar'),revision]);
execFileSync(process.platform==='win32'?'tar.exe':'tar',['-xf',join(base,'base.tar'),'-C',base]);
await symlink(resolve('node_modules'),join(base,'node_modules'),process.platform==='win32'?'junction':'dir');
const source=await readFile(join(base,'tests/river-chronicle.test.js'),'utf8');
const marker="test('one continuous birth finishes the three-world campaign and replays its entire archive'";
const start=source.indexOf(marker);
const end=source.indexOf(" const {liveBrowser}=await import('./helpers/live-browser.js')",start);
assert(start>=0&&end>start,'Pinned native test boundaries changed');
assert(source.slice(0,start).includes('observe(key,next);'),'Observer boundary changed');
let test=source.slice(start,end);
assert(test.includes('const route=[],blocks=')&&test.includes('const observe=(key,state)=>{'),'Native route observer changed');
const head=source.slice(0,start).replace('observe(key,next);','observe(key,next,state);');
test=test.replace('one continuous birth finishes the three-world campaign and replays its entire archive','canonical native content audit (no browser replay)')
 .replace('const route=[],blocks=','const trace=[]; const route=[],blocks=')
 .replace('const observe=(key,state)=>{','const observe=(key,state,before)=>{trace.push(auditTurn(key,before,state));');
const helper=`
function auditTurn(key,before,after){
 const action=eventNode(before).choices.find(c=>c.key===key),r=after.lastReceipt;
 const regular=new Set(['practice','practice-again','intensive-again']);
 const materials=new Set(['gather','hunt-careful','hunt-bold','hunt-food','forage-again','well-food','ridge-food']);
 const kind=regular.has(key)?'ordinary-practice':r.action.approach==='breakthrough'?'breakthrough':r.action.intent==='rest'?'recovery':materials.has(key)?'material-search':r.action.intent==='travel'?(['sea-array','sea-ascend'].includes(key)?'world-travel':'authored-travel'):action.navigation?(Object.keys(action.patch??{}).some(k=>k!=='page')?'story-state':'reading-menu'):'authored-action';
 return {turn:after.turnId,key,from:before.events.node,to:after.events.node,kind,realm:after.life.realm,days:r.elapsedDays,plan:practicePlan(before),text:after.currentScene.blocks.map(b=>b.text)};
}
`;
test+=`const {writeFile}=await import('node:fs/promises');await writeFile(${JSON.stringify(join(base,'route.json'))},JSON.stringify({revision:${JSON.stringify(revision)},trace,final:s.events},null,2));});`;
await writeFile(join(base,'tests/campaign-audit.test.js'),head+helper+test);
const log=execFileSync(process.execPath,['--test','--test-name-pattern=canonical native content audit','tests/campaign-audit.test.js'],{cwd:base,encoding:'utf8'});
await writeFile(join(base,'native-test.txt'),log);
const audit=JSON.parse(await readFile(join(base,'route.json'),'utf8'));
const categories={},realms={},texts=new Set(),normalized=new Set();
let streak=0,maxStreak=0,lastText='',maxAt=0;
for(const t of audit.trace){
 categories[t.kind]=(categories[t.kind]??0)+1;
 realms[t.realm]??={turns:0,kinds:{}};
 realms[t.realm].turns++;realms[t.realm].kinds[t.kind]=(realms[t.realm].kinds[t.kind]??0)+1;
 const joined=t.text.join('\n').replace(/\d+(?:\.\d+)?/g,'#');
 streak=joined===lastText?streak+1:1;lastText=joined;
 if(streak>maxStreak){maxStreak=streak;maxAt=t.turn;}
 for(const text of t.text){texts.add(text);normalized.add(text.replace(/\d+(?:\.\d+)?/g,'#'));}
}
const summary={revision,committedChoices:audit.trace.length,finalTurn:audit.trace.at(-1).turn,categories,realms,
 displayedUnique:{blocks:texts.size,characters:[...texts].reduce((n,s)=>n+[...s].length,0)},
 numberNormalized:{blocks:normalized.size,characters:[...normalized].reduce((n,s)=>n+[...s].length,0),longestConsecutiveSameScene:maxStreak,endingAt:maxAt},
 practiceSnapshotsWithBatchAvailable:audit.trace.filter(t=>t.kind==='ordinary-practice'&&t.plan?.count>1).length};
await writeFile(join(base,'summary.json'),JSON.stringify(summary,null,2)+'\n');
await writeFile(join(base,'final-events.json'),JSON.stringify(audit.final,null,2)+'\n');
console.log(log);
console.log('Evidence directory:',base);
console.log(JSON.stringify(summary,null,2));
