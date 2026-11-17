import {readFile,writeFile} from 'node:fs/promises';
let source=await readFile('tests/river-chronicle.test.js','utf8');
source=source.replaceAll("'./fixtures/","'../tests/fixtures/");
source+=`
test('audit a connected personal cultivation route',async()=>{
 const records=[];const observe=(key,s)=>records.push({key,realm:s.life.realm,age:s.life.ageDays,node:s.events.node,days:s.lastReceipt.elapsedDays,blocks:s.currentScene.blocks.map(b=>b.text)});
 let s=follow(postOffer('aid',observe),'launch-relay','practice-post','investigate','read-box','post-book','deliver','deliver-0','keep-register','two-runners','keep-register','station-mark','keep-register','split-box','back');
 const lead=(state,node)=>{const note=[...journeyNotes(state),...adventureLeads(state)].find(n=>n.node===node);assert.ok(note,'missing invitation '+node);const path=noteRoutes(state,[note]).get(node);assert.ok(path,'no safe route '+node);return follow(state,...path);};
 s=ferryFromTraining(growToRealm(s,1,'train-menu'));s=follow(s,'sail-bank','trace-shell','take-moult','train-menu');
 s=pick(lead(s,'mount-book'),'seek-source');
 s=follow(s,'hear-stone','mount-steady','path-1','hear-stone','mount-steady','path-0','keep-token');
 s=growToRealm(s,2);s=follow(s,'train-menu','rest-menu','back','affairs-menu','mentor-menu');
 if(!canStudyForm(s.life))s=follow(s,'diagnose','restore','mentor-menu');
 s=follow(s,'form-book','form-listen','form-steady','train-menu');
 s=follow(ferryFromTraining(s),'sail-bank','follow-lamp','warm-coal','take-cold','train-menu');
 s=lead(s,'mount-book');
 s=follow(s,'hear-stone','mount-steady','path-1','hear-stone','mount-steady','path-0','mount-wind','wind-practice','wind-own','mount-book','keep-token');
 s=growToRealm(s,5);s=follow(s,'hear-stone','mount-steady','mount-echo','echo-enter','echo-send');
 s=follow(s,'hear-stone','mount-steady','path-0','send-xiaoman','mount-history','train-menu');
 s=follow(ferryFromTraining(s),'sail-deck','pilot-gap','take-borrow','train-menu');
 s=follow(s,'rest-menu','back','journey-menu','workshop-menu','crossing-menu');
 const crossing=compileChoices(s,s.currentScene.choices);
 const result={revision:'5b8631061ea6371db5c5522ed41ea861dad79dde',turn:s.turnId,realm:s.life.realm,age:s.life.ageDays,post:s.events.post,mountain:s.events.mountain,forms:s.events.forms,ferry:s.events.ferry,crossing,records};
 const {writeFile}=await import('node:fs/promises');await writeFile('.scratch/personal-route.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({turn:s.turnId,realm:s.life.realm,age:s.life.ageDays,post:s.events.post.ending,mountain:s.events.mountain.ending,form:s.events.forms.known,ferry:s.events.ferry,crossing:crossing.map(c=>({label:c.label,enabled:c.enabled,reason:c.reason,approach:c.approach}))}));
});
`;
await writeFile('.scratch/personal-route.test.mjs',source);
