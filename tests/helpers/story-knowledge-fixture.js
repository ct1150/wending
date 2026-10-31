import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const repository=fileURLToPath(new URL('../../',import.meta.url));
const hash=text=>createHash('sha256').update(text).digest('hex');
export const referenceContext=()=>({
  identity:{runId:'run-synthetic',turnId:4,requestId:'request-synthetic'},
  phase:'choice',life:{realm:'qi',injury:0,cultivationProfile:{version:7,worldTier:0}},
  receipt:{action:{intent:'interact',targetId:'person:trader',approach:'ask',label:'询问坊市铁器的价格和交易条件'}},
  director:{currentGoal:'在坊市辨清交易条件',mainQuest:null,sideQuests:[],pacing:{scope:'郡县与坊市',pattern:'discovery'},world:{location:'集市',tier:0}},
  memory:{recent:[]},entities:[],
  retrieval:{version:1,recentCardIds:[],recentEvidenceIds:[],recentFamilies:[]},
});

const makeCard=(id,category,tags,situation,dedupe)=>({
  id,content_version:'synthetic-curated-v1',retrieval_text:[category,...tags,situation].join(' '),
  metadata:{category,tags,dedupe_key:dedupe,source_card_id:id,source_chapter_ids:[]},
  card:{id,title:situation,category,tags,situation,conflict:'双方掌握的信息不同，须由玩家决定是否进一步询问。',npc_motives:['希望达成有代价的交换'],preconditions:['只在本场已知范围内改写'],exclusions:['不得替玩家接受'],choices:[{custom_action:'unsafe-inspiration-only'}],followups:[],variation_slots:[],dedupe_key:dedupe,adaptation_notes:'改变专名和表达，只借鉴交易中的信息差。'},
});

export const syntheticCards=()=>[
  makeCard('CARD_TRADE','交易与利益',['交易议价'],'货主与访客商议物品价格','price_information'),
  makeCard('CARD_PRACTICE','修行与突破',['修行突破'],'修士安排闭关修行的准备','practice_preparation'),
  makeCard('CARD_MEDICINE','丹药与疗伤',['炼丹药理'],'采集药材后斟酌炼丹方法','medicine_preparation'),
];
export const syntheticRecords=()=>[
  {id:'EV_TRADE_A',chapterId:'FR-0001',tags:['交易议价'],category:'交易与利益',text:'货主先问来客想用何物交换，来客只询问价格，并未答应交付任何东西。'.repeat(12)},
  {id:'EV_TRADE_B',chapterId:'FR-0002',tags:['交易议价'],category:'交易与利益',text:'两名访客听见不同报价，想先弄清条件，再决定是否继续商谈。'.repeat(12)},
  {id:'EV_PRACTICE',chapterId:'FR-0003',tags:['修行突破'],category:'修行与突破',text:'修士决定先分辨功法缺漏，暂未突破，也没有获得新的境界。'.repeat(12)},
  {id:'EV_MEDICINE_A',chapterId:'FR-0004',tags:['炼丹药理'],category:'丹药与疗伤',text:'采药人观察药材生长之处，考虑是否付出时间继续寻找。'.repeat(12)},
  {id:'EV_MEDICINE_B',chapterId:'FR-0005',tags:['炼丹药理'],category:'丹药与疗伤',text:'药师说明炼丹所需的条件，听者尚未答应，也没有取得任何药物。'.repeat(12)},
];

export async function knowledgeFixture(t,{records=syntheticRecords(),cards=syntheticCards(),shardSize=2,alterShard,version='synthetic-v1'}={}){
  const root=await mkdtemp(path.join(tmpdir(),'wending-knowledge-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const worker=path.join(root,'src/worker'),knowledge=path.join(worker,'knowledge');
  await mkdir(knowledge,{recursive:true});
  await mkdir(path.join(root,'src/game/cultivation/live'),{recursive:true});
  await writeFile(path.join(root,'package.json'),'{"type":"module"}');
  for(const file of ['src/worker/story-knowledge.js','src/game/cultivation/live/identity.js'])
    await writeFile(path.join(root,file),await readFile(path.join(repository,file),'utf8'));
  const sourceSha256=hash('complete synthetic narrative source'),chapterHashes={};
  const catalog=[],values=new Map(),shards={};let offset=0;
  const concepts={'交易议价':['交易','价格','议价','商谈','坊市'],'修行突破':['修行','突破','闭关','功法'],'炼丹药理':['炼丹','药材','采药','疗伤','药师']};
  for(let start=0;start<records.length;start+=shardSize){
    const shardId='s'+String(start/shardSize).padStart(4,'0'),rows=[];
    for(const item of records.slice(start,start+shardSize)){
      const ordinal=catalog.length,characters=[...item.text].length;
      chapterHashes[item.chapterId]??=hash('synthetic chapter '+item.chapterId);
      catalog.push({id:item.id,chapterId:item.chapterId,shardId,tags:item.tags,category:item.category,family:'source:'+item.chapterId,kind:'source_evidence',reviewStatus:'deterministic_extract',sectionOrdinal:ordinal+1,segmentOrdinal:1,sourceKind:'main',characters});
      rows.push({id:item.id,chapterId:item.chapterId,title:'私有合成来源标题',text:item.text,startOffset:offset,endOffset:offset+characters,startLine:ordinal+1,endLine:ordinal+1+item.text.split('\n').length-1,offsetUnit:'unicode_code_point',sha256:hash(item.text),chapterSha256:chapterHashes[item.chapterId]});
      offset+=characters+1;
    }
    const shard={schemaVersion:1,contentVersion:version,sourceSha256,shardId,records:rows};
    alterShard?.(shard);
    const raw=JSON.stringify(shard),key=`fanren/${version}/${shardId}`;
    values.set(key,raw);shards[shardId]={key,sha256:hash(raw),bytes:Buffer.byteLength(raw),count:rows.length};
  }
  const manifest={schemaVersion:1,contentVersion:version,sourceSha256,chapterCount:Object.keys(chapterHashes).length,evidenceCount:catalog.length,curatedCount:cards.length,storagePrefix:`fanren/${version}/`,shards,chapterHashes};
  const postings={};
  for(const [concept,terms]of Object.entries(concepts))for(const term of [concept,...terms])postings[term]=catalog.flatMap((row,index)=>row.tags.includes(concept)?[index]:[]);
  await writeFile(path.join(knowledge,'catalog.js'),`export const KNOWLEDGE_MANIFEST=${JSON.stringify(manifest)};\nexport const EVIDENCE_CATALOG=${JSON.stringify(catalog)};\nexport const TERM_POSTINGS=${JSON.stringify(postings)};\nexport const CONCEPT_TERMS=${JSON.stringify(concepts)};\n`);
  await writeFile(path.join(knowledge,'curated.js'),`export const CURATED_CARDS=${JSON.stringify(cards)};\n`);
  const api=await import(pathToFileURL(path.join(worker,'story-knowledge.js')).href);
  const reads=[];
  const store={async get(key,options){reads.push({key,options});const text=values.get(key);if(text===null||text===undefined)return null;const bytes=new TextEncoder().encode(text);return bytes.buffer;}};
  return {api,store,values,manifest,catalog,cards,reads,root};
}
