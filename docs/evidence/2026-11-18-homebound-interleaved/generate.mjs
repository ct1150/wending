import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
let source=(await readFile('tests/river-chronicle.test.js','utf8')).replace(/\r\n/g,'\n');
const originalHash=createHash('sha256').update(source).digest('hex');
if(originalHash!=='45be0bd5468af8c7269df597037561b45b27abc7e422ba910a47710b6858288d')throw Error('training helper source changed; re-evaluate the route before regeneration');
const prefix='homebound-growth-repro-'+Date.now();
const first=source.indexOf('function trainTo('),last=source.indexOf('function lowerWorldCareer(',first);
let trainer=source.slice(first,last);if(!trainer.includes("s=pick(s,'breakthrough');"))throw Error('trainer changed');
trainer=trainer.replace("s=pick(s,'breakthrough');","s=realm.rank>=7?interleavedWard(s):pick(s,'breakthrough');");
source=source.slice(0,first)+trainer+source.slice(last);
source+=`
function interleavedReach(s,node){const path=noteRoutes(s,[{node}]).get(node);assert.ok(path,'no route '+node+' from '+s.events.node);return follow(s,...path);}
function interleavedStock(s,item,count){
 for(let n=0;(s.life.items[item]??0)<count;n++){
  assert.ok(n<40,'stock '+item);
  if(s.life.injury>1||s.life.cultivationProfile.spirit<30)s=pick(interleavedReach(s,'rest'),'recover');
  if(s.currentScene.choices.some(c=>c.id.endsWith(':c:gather-again')&&c.targetId===item))s=pick(s,'gather-again');
  else{s=interleavedReach(s,'resources');while(s.currentScene.choices.find(c=>c.id.endsWith(':c:gather')).targetId!==item)s=pick(s,'next-resource');s=pick(s,'gather');}
 }
 return s;
}
function interleavedWard(s){
 for(const item of ['artifact','array'])for(let n=0;!(s.life.items[item]>0);n++){
  assert.ok(n<20,'craft '+item);s=interleavedStock(s,'stones',6);s=interleavedStock(s,'iron',item==='artifact'?4:2);
  s=pick(interleavedReach(s,'rest'),'recover');s=interleavedReach(s,'training');
  s=follow(s,'ward-book','ward-preparation','ward-workshop');if(item==='array')s=follow(s,'next-recipe','next-recipe');s=pick(s,'craft');
 }
 s=pick(interleavedReach(s,'rest'),'recover');return follow(interleavedReach(s,'training'),'ward-book','guarded-breakthrough');
}
test('generate a native four-realm homebound life',async()=>{
 const fixture=JSON.parse(readFileSync(new URL('../tests/fixtures/rift-beacon-combined-route.json',import.meta.url))),route=[],checkpoints=[],actions=[];
 let s=start((key,next)=>{route.push(key);actions.push({key,turn:next.turnId,realm:next.life.realm,ageDays:next.life.ageDays,days:next.lastReceipt.elapsedDays,intent:next.lastReceipt.action.intent});});
 for(const key of fixture.route){s=pick(s,key);if(s.life.realm==='spirit'&&s.life.cultivationProfile.worldTier===2&&s.events.node==='crossing'&&s.life.items.supplies)break;}
 assert.equal(s.life.realm,'spirit');checkpoints.push({name:'before-voyages',turn:s.turnId,realm:s.life.realm,ageDays:s.life.ageDays});
 for(let i=0;i<4;i++){
  assert.equal(s.life.realm,['spirit','void','unity','mahayana'][i]);
  s=interleavedStock(s,'supplies',1);s=interleavedStock(s,'iron',1);s=pick(interleavedReach(s,'rest'),'recover');
  s=interleavedReach(s,'home-book');if(!s.events.homebound)s=pick(s,'home-restore');
  s=follow(s,'home-depart','home-see-0','home-see-1','home-decide',['home-skiff','home-open','home-channel','home-sail'][i],'home-return');
  checkpoints.push({name:'voyage-'+i,turn:s.turnId,realm:s.life.realm,ageDays:s.life.ageDays,homebound:structuredClone(s.events.homebound)});
  if(i<3){assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:home-depart')));s=trainTo(interleavedReach(s,'training'),i+6);}
 }
 s=trainTo(interleavedReach(s,'training'),9);s=interleavedReach(s,'watch-ding-book');
 s=follow(s,'choose-feet','foot-0','foot-0','more-feet','foot-2','dedicate','return-pieces');
 assert.equal(s.events.homebound.ending,'sail');assert.equal(s.events.watch.ding.form,'village');assert.equal(s.life.realm,'tribulation');
 checkpoints.push({name:'ending',turn:s.turnId,realm:s.life.realm,ageDays:s.life.ageDays});
 const {writeFile}=await import('node:fs/promises');
 await writeFile('.scratch/${prefix}-route.json',JSON.stringify({revision:'0131e87 plus native interleaved actions',config:fixture.config,route,checkpoints},null,2),{flag:'wx'});
 await writeFile('.scratch/${prefix}-actions.json',JSON.stringify(actions,null,2),{flag:'wx'});
 console.log(JSON.stringify({sourceHash:'${originalHash}',turn:s.turnId,checkpoints:checkpoints.map(({homebound,...x})=>x)}));
});
`;
await writeFile('.scratch/'+prefix+'.test.mjs',source,{flag:'wx'});
console.log(JSON.stringify({sourceHash:originalHash,script:'.scratch/'+prefix+'.test.mjs',route:'.scratch/'+prefix+'-route.json',actions:'.scratch/'+prefix+'-actions.json'}));
