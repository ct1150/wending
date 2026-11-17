import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile('.scratch/campaign-pacing.json','utf8'));
const byRealm={},allBlocks=new Set();
let streak=[],longest=[];
for(const r of data.audit){
 const group=byRealm[r.realm]??={actions:0,paidActions:0,eventChanges:0,ordinaryPractice:0,blocks:new Set()};
 group.actions++;group.paidActions+=r.days>0;group.eventChanges+=r.changed.length>0;
 const ordinary=['practice','practice-again','practice-intensive'].includes(r.key);
 group.ordinaryPractice+=ordinary;
 streak=ordinary?[...streak,{turn:r.turn,realm:r.realm,key:r.key}]:[];
 if(streak.length>longest.length)longest=streak;
 for(const block of r.blocks){group.blocks.add(block);allBlocks.add(block);}
}
for(const group of Object.values(byRealm)){
 group.characters=[...group.blocks].reduce((n,b)=>n+[...b].length,0);
 group.distinctBlocks=group.blocks.size;delete group.blocks;
}
const summary={revision:data.revision,sourceHash:data.sourceHash,turn:data.turn,actions:data.audit.length,
 distinctBlocks:allBlocks.size,characters:[...allBlocks].reduce((n,b)=>n+[...b].length,0),byRealm,
 longestOrdinaryPractice:longest,eventFields:Object.keys(data.events)};
await writeFile('.scratch/pacing-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
