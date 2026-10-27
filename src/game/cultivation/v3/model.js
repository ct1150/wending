export const DAYS_PER_YEAR = 360;
export const ORIGINS = {
 village: { id:'village', name:'山村猎户', description:'山路谋生，守住家乡与失踪亲人的线索。', hook:'乡邻把山外的求仙消息交到了你手上。' },
 artisan: { id:'artisan', name:'城坊匠徒', description:'炉火与工债之间，寻找能由自己掌握的出路。', hook:'师傅留下未完的器图，你要决定如何偿还旧债。' },
 ferry: { id:'ferry', name:'渡口短工', description:'替人渡河，也在寻找自己的彼岸。', hook:'一封迟迟无人接走的口信，把你卷进渡口风波。' },
 exile: { id:'exile', name:'流亡孤儿', description:'乱世中求生，决定是否为后来的人留一条路。', hook:'同行的流民将最后一点信任交给了你。' },
 wanderer: { id:'wanderer', name:'前尘行者', description:'记得幽冥旧约，今生要亲自偿还。', hook:'前世幽冥的约定仍在等待回应。' },
};
export const TALENTS = {
 'keen-memory': {id:'keen-memory',name:'过目成诵',description:'能记下残卷的次序，但须面对旧誓与证词的责任。'},
 'sensitive-breath': {id:'sensitive-breath',name:'听息敏锐',description:'能听出地脉与异兽的动静，敏锐也带来额外负担。'},
 'iron-bones': {id:'iron-bones',name:'坚韧筋骨',description:'可以承担艰苦的护送，冒险仍会受伤并消耗年月。'},
 'sword-bone': {id:'sword-bone',name:'天生剑骨',description:'有机会更早学剑，也要承担剑修纷争。'},
 'flash-wisdom': {id:'flash-wisdom',name:'刹那慧心',description:'可在难关中抓住一线明悟，取巧须支付真实代价。'},
 'fortune-debt': {id:'fortune-debt',name:'福祸相依',description:'意外机缘伴随债务与追索。'},
 rootless: {id:'rootless',name:'无灵根异相',description:'救援流民的前缘打开异途，修炼仍须材料与年月。'},
 'void-echo': {id:'void-echo',name:'前尘回响',description:'能回应幽冥旧约，也须承担跨世的因果。'},
};
export const ITEMS = Object.fromEntries([['stones','灵石'],['supplies','行粮'],['talisman','护符'],['manual','完整功法'],['crystal','地脉灵晶'],['core','金丹灵髓'],['soulseal','归魂印'],['skykey','天门玉钥'],['iron','玄铁'],['relic','古修遗物'],['favor','人情信物']].map(([id,name])=>[id,{id,name}]));
export const SKILLS = Object.fromEntries([['sword','御剑'],['conceal','藏息'],['formation','阵法'],['beast','御兽'],['bargaining','交涉'],['forging','炼器']].map(([id,name])=>[id,{id,name,description:'亲身学成的'+name+'法门，可选作下一世唯一传承。'}]));
export const REALMS = Object.fromEntries([['mortal','凡人',80,0,null,0],['qi','炼气',120,2,'manual',2],['foundation','筑基',240,3,'crystal',3],['golden','金丹',480,4,'core',5],['nascent','元婴',800,4,'soulseal',8],['spirit','化神',1500,5,'skykey',12],['immortal','登仙',3000,5,'relic',20]].map(([id,name,lifeLimit,threshold,material,minYears],rank)=>[id,{id,name,rank,lifeLimit,threshold,material,minYears}]));
export function unlockedOrigins(state) { return Object.values(ORIGINS).filter(row=>row.id!=='wanderer'||state.world.facts['nether-pact']===true); }
export function unlockedTalents(state) { return Object.values(TALENTS).filter(row=>row.id==='rootless'?state.world.facts['rescued-refugees']===true:row.id==='void-echo'?state.world.facts['nether-pact']===true:true); }
export function matchesConditions(state, conditions=[]) { return conditions.every(c=>{switch(c.kind){
 case 'item':return (state.life.items[c.id]??0)>=(c.min??1);
 case 'skill':return state.life.skills.includes(c.id);
 case 'talent':return state.life.birth.talentIds.includes(c.id);
 case 'origin':return state.life.birth.originId===c.id;
 case 'realm':return state.life.realm===c.value;
 case 'cultivation':return state.life.cultivation>=(c.min??1);
 case 'injury-max':return state.life.injury<=c.value;
 case 'life-fact':return state.life.facts[c.id]===c.value;
 case 'world-fact':return state.world.facts[c.id]===c.value;
 case 'proof':return state.world.proofs.includes(c.id);
 default:throw new Error('未知的修行条件：'+c.kind);
 }}); }
