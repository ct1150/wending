import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,resolveRuleScene} from '../../../src/game/cultivation/live/engine.js';
import {eventNode} from '../../../src/game/cultivation/live/event-content.js';
import {realmFor} from '../../../src/game/cultivation/live/cultivation-rules.js';

const input=(await readFile('tests/fixtures/a7ded3d-combined-route.json','utf8')).replace(/\r\n/g,'\n');
const fixture=JSON.parse(input),rows=[];
let s=createLiveGame(fixture.config),p=prepareOpening(s,{requestId:'opening'});
s=commitTurn(s,p,resolveRuleScene(s,p));
for(const key of fixture.route){
 const definition=eventNode(s),option=definition.choices.find(c=>c.key===key),choice=s.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));
 if(!choice||!option)throw Error('missing '+key+' at turn '+s.turnId);
 const before=s;
 p=prepareChoice(s,{choiceId:choice.id,requestId:'river-'+(s.turnId+1)});
 s=commitTurn(s,p,resolveRuleScene(s,p));
 const changed=Object.keys(s.events).filter(k=>!['node','page'].includes(k)&&JSON.stringify(s.events[k])!==JSON.stringify(before.events[k]));
 const texts=definition.blocks.map(b=>b.text),normalized=texts.map(t=>t.replace(/\d+(?:\.\d+)?/g,'#'));
 rows.push({turn:before.turnId,realm:realmFor(before.life).id,node:before.events.node,key,navigation:!!option.navigation,changed,days:s.lastReceipt.elapsedDays,texts,normalized});
}
const byRealm={};
for(const r of rows){
 const b=byRealm[r.realm]??={actions:0,navigationWithoutEventChange:0,navigationWithEventChange:0,ordinaryPractice:0,days:0,exact:new Set(),normalized:new Set()};
 b.actions++;b.navigationWithoutEventChange+=r.navigation&&!r.changed.length;b.navigationWithEventChange+=r.navigation&&r.changed.length>0;
 b.ordinaryPractice+=['practice','practice-again','practice-intensive','intensive-again'].includes(r.key);b.days+=r.days;
 for(const t of r.texts)b.exact.add(t);for(const t of r.normalized)b.normalized.add(t);
}
const totals={exact:new Set(rows.flatMap(r=>r.texts)),normalized:new Set(rows.flatMap(r=>r.normalized))};
for(const b of [...Object.values(byRealm),totals])for(const key of ['exact','normalized']){
 b[key+'Characters']=[...b[key]].reduce((n,t)=>n+[...t].length,0);b[key+'Blocks']=b[key].size;delete b[key];
}
const summary={runtimeRevision:'a0ac265322a127eda26700fc5b2e5c1aa06bb15c',fixtureHash:createHash('sha256').update(input).digest('hex'),turn:s.turnId,actions:rows.length,totals,byRealm};
await writeFile('.scratch/combined-pacing-rows.json',JSON.stringify(rows));
await writeFile('.scratch/combined-pacing-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({turn:s.turnId,actions:rows.length,...totals}));
