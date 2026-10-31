import {isExperienceLife} from './experience.js';
import { sha256 } from './identity.js';
import { ITEMS, REALMS } from './model.js';
import { nextRealmFor, V7_REALMS } from './cultivation-rules.js';

export const CUSTOM_ACTION_MESSAGE = '【该行动超出当前场景能力范围，请重新选择。】';
const unsupported = () => { throw Object.assign(new Error(CUSTOM_ACTION_MESSAGE), {code:'CUSTOM_ACTION_UNSUPPORTED'}); };
const customId = (state,text) => 'r:'+sha256(state.runId).slice(0,16)+':t'+(state.turnId+1)+':c:custom_'+sha256(text).slice(0,12);
const living = entity => entity.status !== 'dead';

// Replay archived actions using the grammar that produced their recorded receipts.
export function replayCustomAction(state,input) {
  if(typeof input!=='string'||!state.currentScene||state.phase!=='active')unsupported();
  const label=input.trim();
  if(!label||label.length>120||/[<>\x00-\x1f]/u.test(label))unsupported();
  if(/^[1-3]$/u.test(label))return structuredClone(state.currentScene.choices[Number(label)-1]??unsupported());
  const exact=state.currentScene.choices.find(choice=>choice.label===label);
  if(exact)return structuredClone(exact);
  if(/然后|接着|顺便|同时|并(?:且|攻击|出手|夺取|前往|杀|偷)|再(?:去|把|杀|打|拿|前往|修炼)|[，,；;。](?:前往|攻击|杀|取走|领取|突破|修炼)|瞬移|无敌|直接成仙|忽略.{0,12}(?:规则|指令)|系统提示|复活|时间倒流/u.test(label))unsupported();
  const text=label.replace(/^(?:我(?:要|想|打算)?|先|试着|尝试)\s*/u,'');
  if(/(?:不|别|不要)(?:攻击|杀|打|抢|偷|突破|修炼|休息|离开|前往|观察)/u.test(text))unsupported();
  const entities=state.relatedEntities??[];
  const implicitActor=/^(?:询问|请教|打听|问|帮助|帮忙|协助|援助|攻击|出手|袭击|偷袭|迎战|反击|拼命|防守|合作|协商|讨价还价|议价|砍价|威胁|胁迫|逼迫|欺骗)(?:一下|此人|对方|他|她|他们|她们)?(?:[：:？?！!。]|$)/u.test(text)
    ||/^(?:拒绝|婉拒|不接受|不参与|不介入|不帮忙)(?:邀请|提议|此事|对方)?[。！!]?$/u.test(text)
    ||/^(?:血遁|施展血遁|燃烧精血逃|撤退|逃跑|逃离|撤离|避战|躲藏|隐匿|藏身|避开|隐蔽|黑市销赃|在黑市销赃|通过黑市出售)[。！!]?$/u.test(text);
  function target(kind,{optional=false,allowDead=false}={}) {
    const all=entities.filter(entity=>kind==='actor'?['person','faction'].includes(entity.kind):entity.kind===kind);
    const named=all.filter(entity=>text.includes(entity.name));
    if(named.length>1)unsupported();
    if(named.length===1){
      const entity=named[0],at=text.indexOf(entity.name),before=text.slice(0,at),after=text.slice(at+entity.name.length);
      // A mentioned person is not necessarily the target: their enemy, their
      // disciple or someone excluding them must never be substituted with them.
      if(!/^(?:向|对|与|询问|请教|打听|问|拒绝|婉拒|不接受|不参与|不介入|不帮忙|告辞|观察|查看|检查|打量|留意|帮助|帮忙|协助|援助|血遁|施展血遁|燃烧精血逃|撤退|逃跑|逃离|撤离|避战|躲藏|隐匿|藏身|避开|隐蔽|攻击|出手|袭击|偷袭|迎战|反击|拼命|防守|合作|协商|讨价还价|议价|砍价|威胁|胁迫|逼迫|欺骗|黑市销赃|在黑市销赃|通过黑市出售|撤退[，,]避开|血遁逃离)(?:一下|向|对|与)?$/u.test(before))unsupported();
      const objectEnds=/^[。！!？?]?$/u.test(after);
      const addressedQuestion=/^(?:询问|请教|打听|问)(?:一下|向)?$/u.test(before)&&/^[：:，,]/u.test(after);
      const addressedSpeech=before==='向'&&/^(?:询问|请教|打听|谎称)(?:[：:，,]|$)/u.test(after);
      const trailingVerb=before==='向'&&/^告辞[。！!]?$/u.test(after)||before==='与'&&/^(?:合作|协商)[。！!]?$/u.test(after);
      const declinedOffer=/^(?:拒绝|婉拒|不接受)$/u.test(before)&&/^的(?:邀请|提议)[。！!]?$/u.test(after);
      if(!objectEnds&&!addressedQuestion&&!addressedSpeech&&!trailingVerb&&!declinedOffer)unsupported();
      if(!allowDead&&!living(entity))unsupported();return entity.id;
    }
    if(optional)return 'self';
    if(!implicitActor)unsupported();
    const candidates=all.filter(living);
    if(candidates.length!==1)unsupported();
    return candidates[0].id;
  }
  const proposal=(intent,approach,targetId='self',stake='low')=>({id:customId(state,label),label,intent,targetId,approach,stake});
  if(isExperienceLife(state.life)){
    if(/^验看本命功法[。！!]?$/u.test(text))return proposal('craft','diagnose');
    if(/^自行推演残法[。！!]?$/u.test(text))return proposal('craft','restore');
    const accept=/^接受(.{1,60})的校法之约[。！!]?$/u.exec(text),pay=/^向(.{1,60})归还行粮[。！!]?$/u.exec(text);
    if(accept||pay){
      const matches=entities.filter(e=>e.kind==='person'&&living(e)&&e.name===(accept??pay)[1]);if(matches.length!==1)unsupported();
      const targetId=matches[0].id;
      if(accept&&!state.currentScene.choices.some(c=>c.intent==='craft'&&c.approach==='pledge'&&c.targetId===targetId))unsupported();
      return proposal('craft',accept?'pledge':'repay',targetId);
    }
  }
  if(/^(?:询问|请教|打听|问|向.{1,60}(?:询问|请教|打听))/u.test(text)) {
    const targetId=target('actor');
    const actor=entities.find(entity=>entity.id===targetId);
    if(/野兽|黄鼠狼|野狼|猛虎|野猪|毒蛇|蟒蛇/u.test(actor.name))unsupported();
    return proposal('interact','ask',targetId);
  }
  if(/^(?:拒绝|婉拒|不接受|不参与|不介入|不帮忙)/u.test(text))return proposal('interact','decline',target('actor'));
  if(/^(?:告辞|结束交谈|结束谈话|离开此人|向.{1,60}告辞)/u.test(text))return proposal('interact','leave',target('actor',{optional:true}));
  if(/^(?:观察|查看|检查|打量|留意)/u.test(text))return proposal('interact','observe',target('actor',{optional:true,allowDead:true}));
  if(/^(?:帮助|帮忙|协助|援助)/u.test(text))return proposal('interact','help',target('person'));
  if(/^(?:血遁|施展血遁|燃烧精血逃)/u.test(text))return proposal('evade','blood',target('actor'));
  if(/^(?:撤退|逃跑|逃离|撤离|避战)/u.test(text))return proposal('evade','withdraw',target('actor'));
  if(/^(?:躲藏|隐匿|藏身|避开|隐蔽)/u.test(text))return proposal('evade','conceal',target('actor'));
  if(/^(?:闭关|修炼|打坐|休整|休息|疗伤|隐居|归隐)/u.test(text)&&/[零一二两三四五六七八九十百千万\d]+(?:天|日|月|年)/u.test(text))unsupported();
  if(/^(?:突破|尝试突破|冲击境界)/u.test(text)) {
    const next=nextRealmFor(state.life);if(!next)unsupported();
    const named=[...Object.values(REALMS),...Object.values(V7_REALMS)].filter(realm=>text.includes(realm.name));
    if(named.some(realm=>realm.id!==next.id))unsupported();
    const desired=text.replace(/^(?:突破|尝试突破|冲击境界)(?:到|至)?/u,'').replace(/[。！!]?$/u,'').replace(/期$/u,'');
    if(desired&&!['境界','下一境界','瓶颈',next.name,...named.filter(realm=>realm.id===next.id).map(realm=>realm.name)].includes(desired))unsupported();
    return proposal('practice','breakthrough',next.id,'normal');
  }
  if(/^(?:修炼禁术|强行催动禁术|施展禁术|燃血修炼)/u.test(text))return proposal('practice','forbidden','self','high');
  if(/^(?:闭关|修炼|打坐)/u.test(text))return proposal('practice',/苦修|加紧|全力/u.test(text)?'intensive':'steady','self','normal');
  if(/^(?:休整|休息|疗伤|养伤)/u.test(text))return proposal('rest','recover');
  if(/^(?:服用|使用).*(?:延寿|寿元)/u.test(text))return proposal('rest','extend');
  if(/^(?:服用|使用).*(?:疗伤丹|疗伤药|丹药)/u.test(text))return proposal('rest','medicine');
  if(/^(?:隐居|归隐)/u.test(text))return proposal('rest','retire');
  if(/^(?:飞升|偷渡|穿过裂缝|穿越空间裂缝|使用古传送阵|启用上古传送阵)/u.test(text)) {
    const places=entities.filter(entity=>entity.kind==='place'&&text.includes(entity.name));
    if(places.length!==1||places[0].name===state.currentScene.location)unsupported();
    const approach=text.startsWith('飞升')?'ascend':text.startsWith('偷渡')?'smuggle':/裂缝/u.test(text)?'rift':'ancient-array';
    return proposal('travel',approach,places[0].id,approach==='rift'?'high':'normal');
  }
  if(/^(?:前往|去|赶往|返回|走向|沿路前往)/u.test(text)) {
    const places=entities.filter(entity=>entity.kind==='place'&&text.includes(entity.name));
    if(places.length!==1||places[0].name===state.currentScene.location)unsupported();
    return proposal('travel',/荒野|山野|小路/u.test(text)?'wilderness':'road',places[0].id,/荒野|山野|小路/u.test(text)?'normal':'low');
  }
  if(/^(?:谨慎|小心|冒险|大胆)?(?:寻找|搜寻|采集|收集|寻找)/u.test(text)) {
    const names={...ITEMS,manual:'功法',elixir:'延寿',medicine:'丹药'};
    const matches=Object.entries(names).filter(([,name])=>text.includes(name));
    if(matches.length!==1)unsupported();
    return proposal('explore',/冒险|大胆/u.test(text)?'bold':'cautious',matches[0][0],/冒险|大胆/u.test(text)?'high':'low');
  }
  if(/^(?:攻击|出手|袭击|偷袭|迎战|反击|拼命|防守)/u.test(text))return proposal('fight',/拼命/u.test(text)?'desperate':/防守/u.test(text)?'guard':'assault',target('actor'),/拼命/u.test(text)?'high':'normal');
  if(/^(?:合作|协商|与.{1,60}合作)/u.test(text))return proposal('negotiate','cooperate',target('actor'),'normal');
  if(/^(?:讨价还价|议价|砍价)/u.test(text))return proposal('negotiate','bargain',target('actor'),'normal');
  if(/^(?:威胁|胁迫|逼迫|欺骗|向.{1,60}谎称)/u.test(text))return proposal('negotiate','pressure',target('actor'),'high');
  if(/^(?:黑市销赃|在黑市销赃|通过黑市出售)/u.test(text))return proposal('negotiate','black-market',target('actor'),'normal');
  if(/^(?:炼丹|炼制丹药)/u.test(text))return proposal('craft','alchemy','medicine','normal');
  if(/^(?:炼制延寿丹|炼制延寿灵药)/u.test(text))return proposal('craft','alchemy','elixir','normal');
  if(/^(?:炼器|锻造法器)/u.test(text))return proposal('craft','forge','artifact','normal');
  if(/^(?:制符|绘制符箓)/u.test(text))return proposal('craft','talisman','talisman','normal');
  if(/^(?:布阵|制作阵盘)/u.test(text))return proposal('craft','formation','array','normal');
  if(/^(?:研习功法|钻研功法)/u.test(text))return proposal('craft','study','manual','normal');
  unsupported();
}

// The exact input is already in the immutable receipt. Rebuild it on resume and
// JSONL replay instead of storing a second mutable action outside the receipt.
export function customActionCommand(pending) {
  const {requestId,choiceId}=pending.identity;
  return {requestId,choiceId,...(pending.receipt?.cultivationResult?.version===7&&/:c:custom_[a-f0-9]{12}$/u.test(choiceId??'')?{customAction:pending.receipt.action.label}:{})};
}
