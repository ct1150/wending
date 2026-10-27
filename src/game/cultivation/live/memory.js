import { assertPlainData, canonicalStringify, sha256 } from './identity.js';
import { exactKeys, idField, textField, validateEntities, validateGeneratedScene as validateStructure } from './schema.js';
import { validateLife, validateReceipt } from './validation.js';
import { prepareOpening, prepareChoice, compileChoices } from './engine.js';
import { DAYS_PER_YEAR, ITEMS, REALMS } from './model.js';

const encoder = new TextEncoder();
const bytes = value => encoder.encode(JSON.stringify(value)).length;
const copy = value => JSON.parse(JSON.stringify(value));
const equal = (a,b) => canonicalStringify(a) === canonicalStringify(b);
const fail = code => { throw Object.assign(new Error(code), {code}); };
const namespace = runId => 'r:' + sha256(runId).slice(0,16);
const turnPrefix = c => `${c.namespace}:t${c.identity.turnId}:`;
function freeze(value) { if(value && typeof value === 'object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; }

// This is defense in depth, never an execution or permission boundary. All text
// stays JSON data under a fixed system message; arbitrary prose is not a rule.
function safeStrings(value) {
  if(typeof value === 'string') {
    if(/<\s*[a-z!/?][^>]*>|&(?:lt|#0*60|#x0*3c);|\[\/?(?:INST|SYSTEM)\]|<\|(?:im_start|system|assistant)/i.test(value) || /(?:ignore|disregard)\s+(?:all\s+|the\s+|any\s+)?(?:previous|prior|system)\s+(?:instructions?|prompts?)|(?:^|\n)\s*(?:system|developer)\s*:|忽略[^。\n]{0,24}(?:指令|规则|提示)|(?:覆盖|改写|绕过)[^。\n]{0,12}(?:系统|规则|收据)/i.test(value)) fail('UNSAFE_STORY_TEXT');
  } else if(value && typeof value === 'object') Object.values(value).forEach(safeStrings);
}
function inspect(value,maxBytes=65536) {
  try { assertPlainData(value); } catch { fail('STORY_DATA_INVALID'); }
  if(bytes(value)>maxBytes)fail('STORY_DATA_TOO_LARGE');
  safeStrings(value);
}
function whole(value,min=0) { if(!Number.isSafeInteger(value)||value<min)fail('STORY_DATA_INVALID'); }

function validateRecord(record,state) {
  const common=['id','runId','turnId','source','kind'];
  const extras={receipt:['receipt'],entity:['entity','status'],fact:['entityId','text'],relationship:['entityId','text'],promise:['entityId','text','status'],clue:['entityId','text','status'],death:['entityId','text'],turn:['text','entityIds'],summary:['text','references']};
  if(!Object.hasOwn(extras,record.kind))fail('MEMORY_RECORD_INVALID');
  exactKeys(record,[...common,...extras[record.kind]]);idField(record.id);whole(record.turnId);
  if(record.runId!==state.runId||record.turnId>state.turnId)fail('MEMORY_RECORD_INVALID');
  if(record.kind==='receipt'){if(record.source!=='rules')fail('MEMORY_RECORD_INVALID');validateReceipt(record.receipt);}
  else if(record.kind==='entity'){
    exactKeys(record.entity,['id','name','kind']);validateEntities([record.entity]);if(!['rules','narrative'].includes(record.source)||!['unknown','alive','dead'].includes(record.status)||record.entity.kind!=='person'&&record.status!=='unknown')fail('MEMORY_RECORD_INVALID');
  } else {
    textField(record.text,500);
    if(record.kind==='summary'){
      if(record.source!=='derived'||!Array.isArray(record.references)||record.references.length>24)fail('MEMORY_RECORD_INVALID');record.references.forEach(idField);
    } else {
      if(!['narrative','rules'].includes(record.source)||record.kind!=='fact'&&record.source!=='narrative')fail('MEMORY_RECORD_INVALID');
      if(record.kind==='turn'){if(!Array.isArray(record.entityIds)||record.entityIds.length>24)fail('MEMORY_RECORD_INVALID');record.entityIds.forEach(idField);}
      else idField(record.entityId);
      if(record.kind==='promise'&&!['open','resolved','broken'].includes(record.status)||record.kind==='clue'&&!['open','resolved'].includes(record.status))fail('MEMORY_RECORD_INVALID');
    }
  }
}
function latestRecords(records,state) {
  const rows=new Map();
  for(const row of records){validateRecord(row,state);const old=rows.get(row.id);
    if(old){
      if(old.kind!==row.kind||old.source!==row.source)fail('MEMORY_RECORD_CONFLICT');
      if(['clue','promise'].includes(row.kind)&&(old.entityId!==row.entityId||old.text!==row.text))fail('MEMORY_RECORD_CONFLICT');
      if(row.kind==='entity'&&!equal(old.entity,row.entity))fail('MEMORY_RECORD_CONFLICT');
      if(old.turnId===row.turnId&&!equal(old,row))fail('MEMORY_RECORD_CONFLICT');
      const earlier=old.turnId<row.turnId?old:row,later=old.turnId<row.turnId?row:old;
      if(['clue','promise'].includes(row.kind)&&earlier.status!=='open'&&later.status==='open')fail('MEMORY_RECORD_CONFLICT');
      if(row.kind==='entity'&&earlier.status==='dead'&&later.status!=='dead')fail('MEMORY_RECORD_CONFLICT');
    }
    if(!old||old.turnId<row.turnId)rows.set(row.id,copy(row));
  }
  for(const row of rows.values())if(row.kind==='summary'&&row.references.some(id=>!rows.has(id)))fail('MEMORY_REFERENCE_MISSING');
  return [...rows.values()].sort((a,b)=>b.turnId-a.turnId||a.id.localeCompare(b.id));
}

export function buildStoryContext(state,pending,relatedRecords=[]) {
  inspect(state);inspect(pending);inspect(relatedRecords,256*1024);
  if(!Array.isArray(relatedRecords)||relatedRecords.length>256)fail('MEMORY_RETRIEVAL_TOO_LARGE');
  let fixed;
  try {
    fixed=pending.kind==='opening'?prepareOpening(state,{requestId:pending.identity.requestId}):pending.kind==='choice'?prepareChoice(state,{requestId:pending.identity.requestId,choiceId:pending.identity.choiceId}):null;
    if(!fixed||!equal(fixed,pending))fail('ACTION_RECEIPT_MISMATCH');
  } catch { fail('ACTION_RECEIPT_MISMATCH'); }
  if(fixed.receipt.death)fail('DEATH_REQUIRES_LOCAL_SETTLEMENT');
  const records=latestRecords(relatedRecords,state),entities=new Map();
  const addEntity=(entity,status)=>{
    const old=entities.get(entity.id),next={id:entity.id,name:entity.name,kind:entity.kind,status};
    if(old){if(old.name!==next.name||old.kind!==next.kind)fail('ENTITY_IDENTITY_CONFLICT');if(old.status==='dead'||next.status==='dead')next.status='dead';else if(next.status==='unknown')next.status=old.status;}
    entities.set(entity.id,next);
  };
  for(const e of state.relatedEntities)addEntity(e,e.status??'unknown');
  for(const row of records)if(row.kind==='entity')addEntity(row.entity,row.status);
  for(const row of records)if(row.kind==='death'){
    const entity=entities.get(row.entityId);if(!entity||entity.kind!=='person')fail('MEMORY_REFERENCE_MISSING');entity.status='dead';
  }
  if(entities.size>24)fail('MEMORY_CONTEXT_TOO_LARGE');
  for(const row of records)if(Object.hasOwn(row,'entityId')&&!entities.has(row.entityId))fail('MEMORY_REFERENCE_MISSING');
  const facts=records.filter(r=>['receipt','fact','relationship','death'].includes(r.kind));
  const promises=records.filter(r=>r.kind==='promise'),clues=records.filter(r=>r.kind==='clue');
  // Caller has already retrieved relevant permanent records. Refuse rather than
  // silently dropping obligations/facts when that relevant set cannot fit.
  if(facts.length>16||promises.length>12||clues.length>12)fail('MEMORY_CONTEXT_TOO_LARGE');
  const result={schemaVersion:1,phase:fixed.kind,identity:copy(fixed.identity),namespace:namespace(state.runId),receipt:copy(fixed.receipt),life:copy(fixed.nextLife),entities:[...entities.values()],memory:{facts,promises,clues,recent:records.filter(r=>r.kind==='turn').slice(0,4),summaries:records.filter(r=>r.kind==='summary').slice(0,2)},references:[],previousScene:state.currentScene?{id:state.currentScene.id,blocksHash:sha256(canonicalStringify(state.currentScene.blocks))}:null};
  const updateReferences=()=>{result.references=[...new Set(Object.values(result.memory).flat().map(r=>r.id))];};
  updateReferences();
  while(bytes(result)>7000&&(result.memory.summaries.length||result.memory.recent.length)){
    if(result.memory.summaries.length)result.memory.summaries.pop();else result.memory.recent.pop();updateReferences();
  }
  if(bytes(result)>7000)fail('MEMORY_CONTEXT_TOO_LARGE');
  validateStoryContext(result);
  return freeze(result);
}

// Public context is portable JSON. Rebuild it from verified state/pending at the
// HTTP boundary. This validator checks consistency, not account authentication.
export function validateStoryContext(c) {
  inspect(c,7000);
  exactKeys(c,['schemaVersion','phase','identity','namespace','receipt','life','entities','memory','references','previousScene']);
  if(c.schemaVersion!==1||!['opening','choice'].includes(c.phase))fail('STORY_CONTEXT_INVALID');
  exactKeys(c.identity,['runId','turnId','baseRevision','stateHash','choiceId','rulesVersion','promptVersion','requestId']);
  idField(c.identity.runId);idField(c.identity.requestId);whole(c.identity.turnId,1);whole(c.identity.baseRevision);
  if(c.namespace!==namespace(c.identity.runId)||!/^[a-f0-9]{64}$/.test(c.identity.stateHash)||c.identity.rulesVersion!==1||c.identity.promptVersion!==1||c.identity.turnId!==c.identity.baseRevision+1)fail('STORY_CONTEXT_INVALID');
  if(c.phase==='opening'&&c.identity.baseRevision!==0||c.phase==='choice'&&c.identity.baseRevision<1)fail('STORY_CONTEXT_INVALID');
  validateLife(c.life);validateReceipt(c.receipt);
  if(c.receipt.kind!==c.phase||c.identity.choiceId!==c.receipt.choiceId||c.receipt.death||!equal(c.receipt.after,{ageDays:c.life.ageDays,realm:c.life.realm,cultivation:c.life.cultivation,injury:c.life.injury})||c.phase==='opening'&&!equal(c.receipt.birth,c.life.birth))fail('ACTION_RECEIPT_MISMATCH');
  if(c.phase==='opening'&&(!equal(c.life.items,{supplies:3,stones:0})||Object.keys(c.life.relations).length))fail('ACTION_RECEIPT_MISMATCH');
  if(!Array.isArray(c.entities)||c.entities.length>24)fail('STORY_CONTEXT_INVALID');
  const seen=new Set();for(const e of c.entities){exactKeys(e,['id','name','kind','status']);validateEntities([{id:e.id,name:e.name,kind:e.kind}]);if(seen.has(e.id)||!['unknown','alive','dead'].includes(e.status)||e.kind!=='person'&&e.status!=='unknown')fail('STORY_CONTEXT_INVALID');seen.add(e.id);}
  exactKeys(c.memory,['facts','promises','clues','recent','summaries']);
  const groupKinds={facts:['receipt','fact','relationship','death'],promises:['promise'],clues:['clue'],recent:['turn'],summaries:['summary']},records=[];
  for(const [key,rows] of Object.entries(c.memory)){
    if(!Array.isArray(rows)||rows.length>({facts:16,promises:12,clues:12,recent:4,summaries:2})[key])fail('STORY_CONTEXT_INVALID');
    for(const row of rows){validateRecord(row,{runId:c.identity.runId,turnId:c.identity.baseRevision});if(!groupKinds[key].includes(row.kind))fail('STORY_CONTEXT_INVALID');records.push(row);}
  }
  const ids=records.map(r=>r.id);
  if(!Array.isArray(c.references)||c.references.length>48||new Set(ids).size!==ids.length||new Set(c.references).size!==c.references.length||!equal([...c.references].sort(),[...ids].sort()))fail('STORY_CONTEXT_INVALID');c.references.forEach(idField);
  for(const row of records){
    if(Object.hasOwn(row,'entityId')&&!seen.has(row.entityId))fail('MEMORY_REFERENCE_MISSING');
    if(row.kind==='summary'&&row.references.some(id=>!c.references.includes(id)))fail('MEMORY_REFERENCE_MISSING');
  }
  if(c.previousScene!==null){exactKeys(c.previousScene,['id','blocksHash']);idField(c.previousScene.id);if(!/^[a-f0-9]{64}$/.test(c.previousScene.blocksHash))fail('STORY_CONTEXT_INVALID');}
  return c;
}

const digits={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
function numberWord(text) {
  if(/^\d+$/.test(text))return Number(text);
  let total=0,n=0;for(const ch of text){if(Object.hasOwn(digits,ch))n=digits[ch];else{const unit={'十':10,'百':100,'千':1000,'万':10000}[ch];if(!unit)return NaN;if(unit===10000){total=(total+n)*unit;n=0;}else{total+=(n||1)*unit;n=0;}}}return total+n;
}
function checkMechanicalClaims(text,c) {
  const numerals='([0-9零〇一二两三四五六七八九十百千万]+)';
  for(const m of text.matchAll(new RegExp('你(?:如今|现在|今年)?(?:已经|已|年满)?'+numerals+'岁','g')))if(numberWord(m[1])!==Math.floor(c.life.ageDays/DAYS_PER_YEAR))fail('MECHANICAL_FACT_CONFLICT');
  for(const [id,realm] of Object.entries(REALMS)){
    const escaped=realm.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if(new RegExp('你(?:如今|现在)?(?:已经|已)?(?:是|成为|突破至|踏入|晋入|达到)'+escaped).test(text)&&c.life.realm!==id)fail('MECHANICAL_FACT_CONFLICT');
  }
  for(const [id,name] of Object.entries(ITEMS)){
    const re=new RegExp('你(?:已经|已)?(拥有|现有|获得|得到|消耗|失去)(?:了)?'+numerals+'(?:枚|块|份|本|个|张)?'+name,'g');
    for(const m of text.matchAll(re)){
      const value=numberWord(m[2]),change=c.receipt.itemChanges[id]??0;
      const expected=['拥有','现有'].includes(m[1])?(c.life.items[id]??0):['消耗','失去'].includes(m[1])?Math.max(0,-change):Math.max(0,change);
      if(value!==expected)fail('MECHANICAL_FACT_CONFLICT');
    }
  }
}
function compilationState(c,scene) {
  const birthSummary={ageDays:5760,realm:'mortal',cultivation:0,injury:0};
  const birthReceipt=c.phase==='opening'?c.receipt:{kind:'opening',choiceId:null,action:null,elapsedDays:0,itemChanges:{},relationChanges:{},random:{before:0,after:0,roll:null},before:birthSummary,after:birthSummary,death:null,birth:c.life.birth};
  // Mirror commitTurn's bounded active relation set while keeping the complete
  // immutable relationChanges receipt available for permanent archive storage.
  const life=copy(c.life);life.relations=Object.fromEntries(Object.entries(life.relations).filter(([id])=>scene.entities.some(e=>e.id===id)));
  return {version:5,mode:'cultivation',contentVersion:4,rulesVersion:1,promptVersion:1,runId:c.identity.runId,revision:c.identity.turnId,turnId:c.identity.turnId,phase:'active',rng:c.receipt.random.after,life,birthReceipt,currentScene:scene,lastReceipt:c.receipt,relatedEntities:scene.entities,archiveCursor:0};
}

export function validateGeneratedScene(raw,context) {
  inspect(raw);validateStoryContext(context);
  try { validateStructure(raw); } catch { fail('GENERATED_SCENE_INVALID'); }
  const prefix=turnPrefix(context);
  if(!raw.id.startsWith(prefix+'s:')||raw.choices.some(p=>!p.id.startsWith(prefix+'c:')))fail('SCENE_ID_SCOPE_INVALID');
  const known=new Map(context.entities.map(e=>[e.id,e])),current=new Map(raw.entities.map(e=>[e.id,e]));
  for(const e of raw.entities){
    const old=known.get(e.id);
    if(old){
      if(old.name!==e.name||old.kind!==e.kind)fail('ENTITY_IDENTITY_CONFLICT');
      if(old.status==='dead'&&e.status!=='dead')fail('ENTITY_DEATH_CONFLICT');
    }else{
      if(!e.id.startsWith(prefix+'e:'))fail('ENTITY_ID_SCOPE_INVALID');
      // No fresh ID can silently replace an identity already supplied in memory.
      if(context.entities.some(old=>old.name===e.name&&old.kind===e.kind))fail('ENTITY_IDENTITY_CONFLICT');
    }
    if(e.status==='dead'&&old?.status!=='dead'&&!raw.memoryDeltas.some(m=>m.kind==='death'&&m.entityId===e.id))fail('ENTITY_DEATH_FACT_REQUIRED');
  }
  const isDead=id=>known.get(id)?.status==='dead'||current.get(id)?.status==='dead';
  const updates=new Set();
  for(const m of raw.memoryDeltas){
    if(!current.has(m.entityId))fail('MEMORY_REFERENCE_MISSING');
    if(m.kind==='death'&&(current.get(m.entityId).kind!=='person'||current.get(m.entityId).status!=='dead'))fail('ENTITY_DEATH_CONFLICT');
    if(Object.hasOwn(m,'referenceId')){
      if(updates.has(m.referenceId))fail('MEMORY_REFERENCE_CONFLICT');updates.add(m.referenceId);
      const old=context.memory[m.kind==='promise'?'promises':'clues'].find(r=>r.id===m.referenceId);
      if(!old||old.kind!==m.kind||old.entityId!==m.entityId||old.text!==m.text||old.status!=='open')fail('MEMORY_REFERENCE_CONFLICT');
    }
  }
  for(const block of raw.blocks)if(block.kind==='dialogue'){
    if(block.speaker!=='self'&&!current.has(block.speaker))fail('SPEAKER_REFERENCE_INVALID');
    if(isDead(block.speaker))fail('ENTITY_DEATH_CONFLICT');
  }
  for(const p of raw.choices)if(['negotiate','fight','evade'].includes(p.intent)&&isDead(p.targetId))fail('ENTITY_DEATH_CONFLICT');
  if(context.previousScene){const oldHash=context.previousScene.blocksHash??sha256(canonicalStringify(context.previousScene.blocks));if(sha256(canonicalStringify(raw.blocks))===oldHash)fail('REPEATED_SCENE');}
  const texts=[raw.title,raw.location,...raw.blocks.map(b=>b.text),...raw.memoryDeltas.map(m=>m.text)];texts.forEach(t=>checkMechanicalClaims(t,context));
  try { if(!compileChoices(compilationState(context,raw),raw.choices).some(p=>p.enabled))fail('NO_EXECUTABLE_CHOICE'); }
  catch(error){if(error.code==='NO_EXECUTABLE_CHOICE')throw error;fail('CHOICE_NOT_COMPILABLE');}
  return copy(raw);
}

export function buildMemoryDelta(receipt,scene) {
  inspect(receipt);inspect(scene);validateReceipt(receipt);validateStructure(scene);
  const records=scene.memoryDeltas.map((row,index)=>({id:row.referenceId??'m:'+sha256(scene.id+':'+index).slice(0,32),source:'narrative',kind:row.kind,entityId:row.entityId,text:row.text,...(['promise','clue'].includes(row.kind)?{status:row.status??'open'}:{})}));
  return {schemaVersion:1,receipt:copy(receipt),entities:copy(scene.entities),records,summary:null};
}
