import { assertPlainData } from './identity.js';

// Only reference identifiers cross the save/browser boundary. Source prose and
// the private corpus remain in the Worker; missing metadata never upgrades an
// old snapshot during deterministic archive replay.
const LIMITS=Object.freeze({recentCardIds:8,recentEvidenceIds:16,recentFamilies:8});
const FIELDS=Object.freeze({recentCardIds:'cardIds',recentEvidenceIds:'evidenceIds',recentFamilies:'families'});
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
const copy=value=>JSON.parse(JSON.stringify(value));
const fail=()=>{throw Object.assign(new Error('STORY_RETRIEVAL_INVALID'),{code:'STORY_RETRIEVAL_INVALID'});};
function keys(value,fields){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||fields.some(key=>!Object.hasOwn(value,key)))fail();}
function identifiers(value,limit,max=80){
  if(!Array.isArray(value)||value.length>limit||new Set(value).size!==value.length||value.some(id=>typeof id!=='string'||id.length>max||!/^[A-Za-z0-9][A-Za-z0-9:_-]*$/u.test(id)))fail();
}

export function validateRetrievalMemory(value){
  assertPlainData(value);keys(value,['version',...Object.keys(LIMITS)]);
  if(value.version!==1)fail();
  for(const [key,limit]of Object.entries(LIMITS))identifiers(value[key],limit,key==='recentFamilies'?64:80);
  if(bytes(value)>640)fail();
  return value;
}

export function projectRetrievalMemory(value){
  return value===undefined?{version:1,recentCardIds:[],recentEvidenceIds:[],recentFamilies:[]}:copy(validateRetrievalMemory(value));
}

export function validateRetrievalReceipt(value,{queryHash}={}){
  assertPlainData(value);keys(value,['version','corpusVersion','queryHash','cardIds','evidenceIds','families']);
  if(value.version!==1||typeof value.corpusVersion!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/u.test(value.corpusVersion)||typeof value.queryHash!=='string'||!/^[a-f0-9]{64}$/u.test(value.queryHash)||queryHash!==undefined&&value.queryHash!==queryHash)fail();
  identifiers(value.cardIds,1);identifiers(value.evidenceIds,2);identifiers(value.families,3,64);
  if(!value.cardIds.length&&!value.evidenceIds.length&&value.families.length)fail();
  return value;
}

export function advanceRetrievalMemory(previous,receipt){
  const next=projectRetrievalMemory(previous);
  if(receipt!==undefined&&receipt!==null){
    validateRetrievalReceipt(receipt);
    for(const [key,source]of Object.entries(FIELDS)){
      const fresh=receipt[source];
      next[key]=[...next[key].filter(id=>!fresh.includes(id)),...fresh].slice(-LIMITS[key]);
    }
    while(bytes(next)>640){
      // Preserve this accepted turn's identifiers; discard the oldest entries
      // from the largest remaining history group until the public budget fits.
      const candidates=Object.keys(LIMITS).filter(key=>next[key].length>receipt[FIELDS[key]].length).sort((a,b)=>bytes(next[b])-bytes(next[a])||a.localeCompare(b,'en'));
      if(!candidates.length)fail();
      next[candidates[0]].shift();
    }
  }
  return Object.keys(LIMITS).some(key=>next[key].length)?validateRetrievalMemory(next):undefined;
}
