import { ORIGIN_IDS, originScene } from './chapters/origins.js';
import { THRESHOLD_IDS, thresholdScene } from './chapters/thresholds.js';
import { ROUTE_IDS, routeScene } from './chapters/routes.js';
import { EXPEDITION_IDS, expeditionScene } from './chapters/expeditions.js';
import { WORLD_IDS, worldScene } from './chapters/worlds.js';
import { CELESTIAL_IDS, celestialScene } from './chapters/celestial.js';
import { ACCEPTED_PROSE } from './prose.js';

export const NODES = ['arrival', 'ended', ...ORIGIN_IDS, ...THRESHOLD_IDS, ...ROUTE_IDS, ...EXPEDITION_IDS, ...WORLD_IDS, ...CELESTIAL_IDS];
export const AUTHORING_BRIEFS = [
 {id:'arrival.atmosphere',sceneId:'arrival',title:'鹿脊村雪线下的日光（仅山村猎户开场）',facts:['此位置只插入山村猎户出身的第一场，不用于城坊、渡口、流亡或前尘行者。','地点在鹿脊村的雪线之下；地上积雪，天已亮，远处是山。','此生尚未开始任何新行动；不得描述玩家获得物品、人物关系或修行境界。'],prompt:'写六十到一百二十字的中文环境描写，只用雪地、远山、寒风、日光为意象。不要写青草、暖季景色、夜色、在场人物或任何事件成果。'},
 ...['route-crossroad','expedition-crossroad','qi-gate','foundation-gate','golden-gate','nascent-gate','spirit-gate','immortal-gate','golden-harbor','nether-ferry','sky-shadow','immortal-silent','crown-return'].map(sceneId=>({id:`${sceneId}.atmosphere`,sceneId,title:`${sceneId}的环境插入段`,facts:['仅补充当前场景的中性环境气氛。','不得说明姓名、出身、物品、境界、年份、胜负、人物去向或已经发生的行动。','保留作者原文中所有人物、事实、行动与后果。'],prompt:'写六十至一百二十字的中文环境段落，使用风、明暗、远处的声音等中性意象；不要新增人物、物品或事件，不要概括剧情。'})),
];
export function resolveCultivationScene(state) {
 const id=state.scene.nodeId;
 let result;
 if(id==='ended') result={id,title:state.summary?.title || '此生落笔',location:'归途',goal:'回顾此生真实走过的路，选择是否留下一项法门',blocks:[{kind:'narration',text:'这一生已经走到自己的结尾。那些真正同行过的人、亲手取得的材料、闭关耗去的年月与没有兑现的心愿，都留在了已经写下的经历中。后来者不会凭空继承你的境界，却可能从留存的法门里少走一段弯路；故地也不会因一个人的离去回到原样，旧日立下的约定仍由记得它的人继续守着。你可以翻看完整来路，再决定将哪一项亲自学成的本领交给新的生命。'},{kind:'dialogue',speaker:'执灯人',text:'前路已经由这一生回答过一回。若还想再走，就带一份真正学会的本领；没有想带的，也可以空手入世，重新认识天地。'}],choices:[]};
 else if(id==='arrival'||ORIGIN_IDS.includes(id)) result=originScene(state);
 else if(THRESHOLD_IDS.includes(id)) result=thresholdScene(state);
 else if(ROUTE_IDS.includes(id)) result=routeScene(state);
 else if(EXPEDITION_IDS.includes(id)) result=expeditionScene(state);
 else if(WORLD_IDS.includes(id)) result=worldScene(state);
 else if(CELESTIAL_IDS.includes(id)) result=celestialScene(state);
 else throw new Error(`未知的修行场景：${id}`);
 const accepted=ACCEPTED_PROSE[`${id}.atmosphere`];
 if(typeof accepted==='string'&&accepted.length&&(id!=='arrival'||state.life.birth.originId==='village')) result.blocks.unshift({kind:'narration',text:accepted});
 return result;
}
