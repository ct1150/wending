import { sha256, assertPlainData } from './cultivation/live/identity.js';
import { verifyChunk, validateAttempt, verifyPending, validateGeneration } from './live-archive.js';
import { validateLiveState } from './cultivation/live/validation.js';
import { validateReincarnationClaim } from './cultivation/live/reincarnation.js';
export const MAX_LIVE_RECORD_BYTES = 512 * 1024;
const FORMAT='wending-live-jsonl';
function requireValue(ok){if(!ok)throw new Error('ARCHIVE_INVALID_STREAM');}
function keys(value,list){requireValue(value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).sort().join('|')===[...list].sort().join('|'));}
const digest=value=>sha256(JSON.stringify(value));
export function exportLiveArchive(archive,runId) {
 let capture,header,index=0,manifest,done=false;
 const encode=value=>{const text=JSON.stringify(value);requireValue(new TextEncoder().encode(text).length<=MAX_LIVE_RECORD_BYTES);return new TextEncoder().encode(text+'\n');};
 return new ReadableStream({async pull(controller){try{
  if(!capture){capture=await archive._capture(runId);requireValue(capture);validateGeneration(capture.pending?.generation,capture.pending?.pending);const v7=capture.run.state.life.cultivationProfile?.version===7||Boolean(capture.reincarnationClaim);header={type:'header',format:FORMAT,version:v7?3:capture.pending?.generation?2:1,memoryVersion:1,birth:capture.run.birth,state:capture.run.state,pending:capture.pending?.pending??null,attempt:capture.pending?.attempt??null,...(v7?{generation:capture.pending?.generation??null,reincarnationClaim:capture.reincarnationClaim??null}:capture.pending?.generation?{generation:capture.pending.generation}:{})};manifest=digest(header);controller.enqueue(encode(header));return;}
  if(index<=capture.run.tailIndex){const chunk=index===capture.run.tailIndex?capture.tail:await archive._readChunk(capture.run.archiveId,index);verifyChunk(chunk);const row={type:'chunk',chunk};manifest=sha256(manifest+chunk.hash);index++;controller.enqueue(encode(row));return;}
  if(!done){done=true;controller.enqueue(encode({type:'footer',chunks:index,turns:capture.run.state.turnId,headHash:capture.run.headHash,manifest}));controller.close();}
 }catch(e){controller.error(e);}}});
}
async function* lines(stream) {
 requireValue(stream&&typeof stream.getReader==='function');const reader=stream.getReader();let parts=[],length=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;requireValue(value instanceof Uint8Array);let start=0;
  for(let i=0;i<value.length;i++){if(value[i]!==10)continue;const part=value.subarray(start,i);length+=part.length;requireValue(length<=MAX_LIVE_RECORD_BYTES);parts.push(part);const bytes=new Uint8Array(length);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}requireValue(length>0);yield new TextDecoder('utf-8',{fatal:true}).decode(bytes);parts=[];length=0;start=i+1;}
  const tail=value.subarray(start);length+=tail.length;requireValue(length<=MAX_LIVE_RECORD_BYTES);if(tail.length)parts.push(tail.slice());
 }requireValue(length===0);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function importLiveArchive(stream,archive) {
 const original=await archive._capture();const expectedActive=original?.active??null;let header,archiveId,manifest,count=0,turns=0,previousHash='0'.repeat(64),footer=false;
 try {
 for await(const line of lines(stream)){
  requireValue(!footer);const row=JSON.parse(line);
  if(!header){keys(row,['type','format','version','memoryVersion','birth','state','pending','attempt',...(row.version===3?['generation','reincarnationClaim']:row.version===2?['generation']:[])]);requireValue(row.type==='header'&&row.format===FORMAT&&[1,2,3].includes(row.version)&&row.memoryVersion===1);assertPlainData(row);validateLiveState(row.birth);validateLiveState(row.state);requireValue(row.birth.runId===row.state.runId);validateAttempt(row.attempt);if(row.pending)verifyPending(row.state,row.pending);else requireValue(row.attempt===null);validateGeneration(row.version===3?row.generation??undefined:row.generation,row.pending);if(row.reincarnationClaim!==undefined&&row.reincarnationClaim!==null)validateReincarnationClaim(row.reincarnationClaim,row.state,{matchDeathSnapshot:false});header=row;manifest=digest(row);archiveId=await archive._stage(row.birth);continue;}
  if(row.type==='chunk'){keys(row,['type','chunk']);verifyChunk(row.chunk);requireValue(row.chunk.index===count&&row.chunk.previousHash===previousHash);for(const entry of row.chunk.entries){requireValue(entry.identity.turnId===++turns);await archive._stageEntry(archiveId,entry);}await archive._stageChunk(archiveId,row.chunk);previousHash=row.chunk.hash;manifest=sha256(manifest+previousHash);count++;continue;}
  keys(row,['type','chunks','turns','headHash','manifest']);requireValue(row.type==='footer'&&row.chunks===count&&row.turns===turns&&row.turns===header.state.turnId&&row.headHash===previousHash&&row.manifest===manifest);footer=true;
 }
 requireValue(header&&footer);await archive._validateStage(archiveId,header.state,header.pending,header.attempt,header.generation??undefined,header.reincarnationClaim??null);return await archive.activate(archiveId,expectedActive,original);
 }catch(error){if(archiveId)await archive._discardStage(archiveId).catch(()=>{});throw error;}
}
