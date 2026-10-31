export const DAYS_PER_YEAR = 360;
export const ORIGINS = Object.freeze({village:'山村猎户',artisan:'城坊匠徒',ferry:'渡口短工',exile:'流亡孤儿'});
export const TALENTS = Object.freeze({'keen-memory':'过目成诵','sensitive-breath':'听息敏锐','iron-bones':'坚韧筋骨','sword-bone':'天生剑骨','flash-wisdom':'刹那慧心','fortune-debt':'福祸相依'});
export const LEGACY_ITEMS = Object.freeze({stones:'灵石',supplies:'行粮',talisman:'护符',manual:'完整功法',crystal:'地脉灵晶',core:'金丹灵髓',soulseal:'归魂印',skykey:'天门玉钥',iron:'玄铁',relic:'古修遗物'});
export const ITEMS = Object.freeze({...LEGACY_ITEMS,herbs:'灵草',medicine:'回元丹',elixir:'延寿丹',array:'护身阵盘',artifact:'法器',voidstone:'虚空凝石',unityjade:'合道灵玉',daofruit:'归一灵果',thunderseal:'避劫雷印'});
export const REALMS = Object.freeze(Object.fromEntries([['mortal','凡人',80,0,null,0],['qi','炼气',120,2,'manual',2],['foundation','筑基',240,3,'crystal',3],['golden','金丹',480,4,'core',5],['nascent','元婴',800,4,'soulseal',8],['spirit','化神',1500,5,'skykey',12],['immortal','登仙',3000,5,'relic',20]].map(([id,name,lifeLimit,threshold,material,minYears],rank)=>[id,Object.freeze({id,name,rank,lifeLimit,threshold,material,minYears})])));
export const LEGACY_INTENTS = Object.freeze({practice:['steady','intensive','breakthrough'],explore:['cautious','bold'],negotiate:['cooperate','bargain','pressure'],fight:['guard','assault','desperate'],evade:['withdraw','conceal'],rest:['recover','retire'],travel:['road','wilderness'],craft:['study','forge'],interact:['ask','observe','help','decline','leave']});
export const INTENTS = Object.freeze({...LEGACY_INTENTS,practice:[...LEGACY_INTENTS.practice,'forbidden'],negotiate:[...LEGACY_INTENTS.negotiate,'black-market'],evade:[...LEGACY_INTENTS.evade,'blood'],rest:[...LEGACY_INTENTS.rest,'extend','medicine'],travel:[...LEGACY_INTENTS.travel,'ascend','smuggle','rift','ancient-array'],craft:[...LEGACY_INTENTS.craft,'alchemy','formation','talisman']});

// Only explicitly marked lives may propose these methods; older wire vocabularies stay exact.
export const GROWTH_APPROACHES=Object.freeze(['diagnose','restore','pledge','repay']);
export const EXPERIENCE_INTENTS=Object.freeze({...INTENTS,craft:[...INTENTS.craft,...GROWTH_APPROACHES]});
