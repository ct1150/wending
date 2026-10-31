import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGeneratedScene as validateStructure } from '../src/game/cultivation/live/schema.js';
import { createCultivationBirthProfile, initialLifeForBirth } from '../src/game/cultivation/live/cultivation-rules.js';

const director = await import('../src/game/cultivation/live/story-director.js').catch(() => ({}));
const life = () => ({name:'衡生',ageDays:5760,lifeLimit:80,realm:'mortal',cultivation:0,injury:0,items:{supplies:3,stones:0},relations:{},birth:{originId:'ferry',talentIds:['keen-memory','iron-bones'],attributes:{constitution:4,insight:4,fortune:4}},cultivationProfile:{version:7}});
const receipt = (turn, action={intent:'interact',approach:'observe',targetId:'self',label:'查看渡口留下的痕迹'}) => ({action,elapsedDays:0,relationChanges:{},itemChanges:{},random:{roll:turn%100},before:{ageDays:5760},after:{ageDays:5760},death:null});
function scene(turn,{clue=false,enemy=false,beat='progress',pattern='investigation'}={}) {
  const id='r:test:t'+turn+':e:person_guide',name='渡者'+turn;
  const text=name+'讲明这次水道改线的缘由，并指出河岸上第'+turn+'处旧桩留下的凿痕。';
  return {id:'r:test:t'+turn+':s:scene',title:'渡口余痕',location:'渡口',blocks:[{kind:'narration',text}],entities:[{id,name,kind:'person',status:'alive'}],choices:[],memoryDeltas:[{kind:clue?'clue':'fact',entityId:id,text,...(clue?{status:'open'}:{})}],story:{pattern,beat,anchors:[0]},...(enemy?{enemy:id}:{})};
}
function start() {
  assert.equal(typeof director.createStoryDirector,'function','the persistent director must be implemented');
  return director.createStoryDirector(life(),42);
}

test('director replay retains one lifelong destiny and mystery without mutating prior turns',()=>{
  const first=start(),before=structuredClone(first),s=scene(1),r=receipt(1);
  const next=director.advanceStoryDirector(first,life(),r,s,1);
  assert.deepEqual(first,before);
  assert.deepEqual(director.advanceStoryDirector(first,life(),r,s,1),next);
  assert.deepEqual(next.destiny,first.destiny);
  assert.equal(next.mystery.id,first.mystery.id);
  assert.equal(next.mystery.question,first.mystery.question);
  assert.equal(next.turnId,1);
  assert.throws(()=>director.advanceStoryDirector(next,life(),r,s,1));
  assert.throws(()=>director.validateStoryDirector({...next,turnId:-1}));
});

test('overflow becomes compressed background while living NPCs and open clues are never declared dead or resolved',()=>{
  let state=start();
  for(let turn=1;turn<=24;turn++){
    const s=scene(turn,{clue:true}),r=receipt(turn,{intent:'evade',approach:'withdraw',targetId:s.entities[0].id,label:'避开'+s.entities[0].name+'的拦截'});
    state=director.advanceStoryDirector(state,life(),r,s,turn);
  }
  assert.equal(state.memory.causes.length,10);
  assert.equal(state.memory.npcs.length,5);
  assert.equal(state.memory.enemies.length,5);
  assert.equal(state.memory.clues.length,3);
  assert.ok(state.memory.npcs.every(row=>row.status==='alive'));
  assert.ok(state.memory.clues.every(row=>row.status==='open'));
  assert.ok(state.background.count>0);
  assert.ok(state.background.text.length>0);
  assert.ok(state.mainQuest);
  assert.ok(state.sideQuests.length<=2);
  assert.ok(JSON.stringify(state).length<16000);
  assert.equal(director.validateStoryDirector(state),state);
});

test('year and periodic archives are bounded, deterministic and preserve the chosen action rather than inventing scheduled events',()=>{
  let state=start(),current=life();
  const marks=[];
  for(let turn=1;turn<=60;turn++){
    current={...current,ageDays:5760+turn*30};
    const s=scene(turn),r={...receipt(turn),elapsedDays:30,after:{ageDays:current.ageDays}};
    state=director.advanceStoryDirector(state,current,r,s,turn);
    if([12,30,50,60].includes(turn))marks.push(structuredClone(state));
  }
  assert.equal(marks[0].world.year,17);
  assert.ok(Array.from(marks[0].world.summary).length<=200);
  assert.ok(marks[1].archive.reasons.includes('periodic'));
  assert.ok(marks[2].archive.reasons.includes('volume'));
  assert.equal(marks[3].archive.throughTurn,60);
  assert.ok(Array.from(state.archive.text).length<=300);
  assert.equal(state.mystery.progress,0,'ordinary waterway facts cannot solve the ultimate mystery');
  assert.equal(state.pacing.lastEra,0,'passing turn30 does not fabricate a changed world order');
  assert.match(state.memory.causes.at(-1).text,/查看渡口/);
  const context=director.buildDirectorContext(state,current,receipt(61),61);
  assert.ok(new TextEncoder().encode(JSON.stringify(context)).length<=3000);
  assert.equal(context.destiny.id,state.destiny.id);
  assert.equal(context.mystery.id,state.mystery.id);
  assert.equal(context.pacing.turnId,61);
  assert.equal(context.pacing.eraDue,true);
});

test('only grounded closures remove active quest references, and unseen antagonists remain backgrounded',()=>{
  const initial=start(),s=scene(1,{clue:true}),opened=director.advanceStoryDirector(initial,life(),receipt(1),s,1);
  const clue=opened.memory.clues[0],nextScene=scene(2);
  nextScene.entities=[s.entities[0]];
  nextScene.memoryDeltas=[{kind:'clue',entityId:clue.entityId,text:s.memoryDeltas[0].text,referenceId:clue.id,status:'resolved'}];
  const closed=director.advanceStoryDirector(opened,life(),receipt(2),nextScene,2);
  assert.ok(!closed.memory.clues.some(row=>row.id===clue.id));
  assert.ok(closed.mainQuest?.id!==clue.id);
  assert.ok(closed.sideQuests.every(row=>row.id!==clue.id));
  assert.equal(closed.memory.npcs[0].status,'alive');
});

test('story annotations reject foreign block anchors and canonical scene contracts enforce three options and a feasible cautious route',()=>{
  start();
  assert.throws(()=>director.validateStoryAnnotation({pattern:'investigation',beat:'progress',anchors:[2]},1));
  assert.throws(()=>director.validateStoryAnnotation({pattern:'investigation',beat:'progress',anchors:[0],destiny:'rewritten'},1));
  const s=scene(1);s.blocks[0].text+='你在河岸上耐心核对每一道刻痕。'.repeat(13);
  s.choices=[{id:'a',label:'询问渡者',intent:'interact',approach:'ask',stake:'low',enabled:true},{id:'b',label:'观察河岸',intent:'interact',approach:'observe',stake:'low',enabled:true},{id:'c',label:'婉拒求助',intent:'interact',approach:'decline',stake:'low',enabled:true}];
  const c={director:director.buildDirectorContext(start(),life(),receipt(1),1),life:life(),receipt:receipt(1),identity:{turnId:1}};
  assert.equal(director.validateDirectorScene(s,c,s.choices),s);
  assert.throws(()=>director.validateDirectorScene({...s,choices:s.choices.slice(0,2)},c,s.choices.slice(0,2)));
  assert.throws(()=>director.validateDirectorScene(s,c,s.choices.map(choice=>({...choice,enabled:false}))));
});

test('editorial length and pacing advice never rejects structurally valid playable scenes',()=>{
  const c={director:director.buildDirectorContext(start(),life(),receipt(1),1),life:life(),receipt:receipt(1),identity:{turnId:1}};
  const base=scene(1);
  base.choices=[{id:'a',label:'询问渡者',intent:'interact',approach:'ask',stake:'low',enabled:true},{id:'b',label:'观察河岸',intent:'interact',approach:'observe',stake:'low',enabled:true},{id:'c',label:'婉拒求助',intent:'interact',approach:'decline',stake:'low',enabled:true}];
  for(const [name,patch,pacing]of [
    ['short answer',{blocks:[{kind:'narration',text:'渡者说，水流是昨夜改道的。'}]},{}],
    ['long scene',{blocks:[{kind:'narration',text:'河岸的痕迹仍待辨认。'.repeat(65)}]},{}],
    ['early climax',{story:{...base.story,beat:'climax'},memoryDeltas:[]},{}],
    ['overdue progress',{}, {beatOverdue:true,opportunityRequired:true}],
    ['consecutive resolution',{story:{...base.story,beat:'resolution'},memoryDeltas:[]},{completedPatterns:['investigation']}],
  ]){
    const s={...base,...patch},context=structuredClone(c);Object.assign(context.director.pacing,pacing);
    assert.equal(director.validateDirectorScene(s,context,s.choices),s,name);
  }
  assert.throws(()=>director.validateDirectorScene({...base,story:{...base.story,anchors:[9]}},c,base.choices),{code:'STORY_ANNOTATION_INVALID'});
  assert.throws(()=>director.validateDirectorScene(base,{...c,director:{...c.director,turnId:1}},base.choices),{code:'STORY_DIRECTOR_INVALID'});
});

test('canonical scenes retain versioned story annotations without requiring them on legacy history',()=>{
  const s=scene(1);
  s.choices=[{id:'a',label:'观察河岸',intent:'interact',targetId:'self',approach:'observe',stake:'low'},{id:'b',label:'留在渡口休整',intent:'rest',targetId:'self',approach:'recover',stake:'low'}];
  assert.equal(validateStructure(s),s);
  const legacy=structuredClone(s);delete legacy.story;
  assert.equal(validateStructure(legacy),legacy);
  assert.throws(()=>validateStructure({...s,story:{...s.story,anchors:[3]}}));
});

test('annual and canonical summaries include the current goals, people and actual cultivation identity',()=>{
  let state=start(),current=life();
  for(let turn=1;turn<=30;turn++){
    current={...current,ageDays:5760+turn*30};
    const s=scene(turn,{clue:turn===1}),r=receipt(turn);
    state=director.advanceStoryDirector(state,current,r,s,turn);
  }
  assert.match(state.world.summary,/渡口/);
  assert.match(state.world.summary,/主线/);
  assert.match(state.world.summary,/目标/);
  assert.match(state.world.summary,/敌手/);
  assert.match(state.world.summary,/关系/);
  for(const field of ['衡生','凡人','灵根','功法','遗物','势力','渡口','主线','因果'])assert.ok(state.archive.text.includes(field),field);
  assert.ok(Array.from(state.world.summary).length<=200);
  assert.ok(Array.from(state.archive.text).length<=300);
});

test('three observed failures offer a reversal opportunity and five require it without awarding resources',()=>{
  let state=start();const current=life();
  for(let turn=1;turn<=5;turn++){
    state=director.advanceStoryDirector(state,current,{...receipt(turn),cultivationResult:{check:{kind:'exploration',success:false}}},scene(turn),turn);
    if(turn===3)assert.equal(state.pacing.opportunityDue,true);
  }
  assert.equal(state.pacing.setbackStreak,5);
  assert.equal(state.pacing.opportunityRequired,true);
  assert.deepEqual(current.items,{supplies:3,stones:0});
  for(let turn=6;turn<=18;turn++)state=director.advanceStoryDirector(state,current,{...receipt(turn),cultivationResult:{check:{kind:'exploration',success:false}}},scene(turn),turn);
  assert.equal(state.pacing.pressure,10);
  const next=director.advanceStoryDirector(state,current,{...receipt(19),cultivationResult:{check:{kind:'exploration',success:true}}},scene(19),19);
  assert.equal(next.pacing.setbackStreak,0);
  assert.equal(next.pacing.opportunityDue,false);
});

test('NPC traits must be present in anchored prose and recent characters persist before new arrivals replace them',()=>{
  let state=start();const first=scene(1),npc=first.entities[0];
  first.blocks[0].text+='这位摆渡人惯于盘绳，自称修过定流诀，只盼找回失踪弟弟。';
  first.story.npcs=[{entityId:npc.id,anchor:0,title:'摆渡人',signatureSpell:'定流诀',habit:'盘绳',obsession:'找回失踪弟弟'}];
  state=director.advanceStoryDirector(state,life(),receipt(1),first,1);
  assert.equal(state.memory.npcs[0].signatureSpell,'定流诀');
  assert.equal(state.memory.npcs[0].introducedAt,1);
  const bad=scene(2);bad.story.npcs=[{...first.story.npcs[0],entityId:bad.entities[0].id,signatureSpell:'凭空新增的术法'}];
  assert.throws(()=>director.advanceStoryDirector(state,life(),receipt(2),bad,2));
  const crowded=scene(2);
  crowded.entities=Array.from({length:5},(_,i)=>({id:'new:'+i,name:'来客'+i,kind:'person',status:'alive'}));
  crowded.blocks[0].text=crowded.entities.map(row=>row.name+'在渡口核对船期').join('；');crowded.memoryDeltas=[];
  state=director.advanceStoryDirector(state,life(),receipt(2),crowded,2);
  assert.ok(state.memory.npcs.some(row=>row.id===npc.id));
  assert.equal(state.memory.npcs.length,5);
  assert.equal(state.memory.npcs.find(row=>row.id===npc.id).obsession,'找回失踪弟弟');
});

test('hidden narrative fortune follows the same twenty-action cycle as the cultivation rules',()=>{
  const current=initialLifeForBirth('衡生',{...life().birth,cultivationProfile:createCultivationBirthProfile(()=>0)});
  let state=director.createStoryDirector(current,42);
  assert.equal(state.pacing.fortuneBand,'high');
  for(let turn=1;turn<=20;turn++)state=director.advanceStoryDirector(state,current,receipt(turn),scene(turn),turn);
  assert.equal(state.pacing.turnId,21);
  assert.equal(state.pacing.fortuneBand,'low');
});
