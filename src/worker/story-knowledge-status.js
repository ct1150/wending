import {KNOWLEDGE_MANIFEST as manifest} from './knowledge/catalog.js';
import {exactKeys} from '../game/cultivation/live/schema.js';

const verifiedBindings=new WeakMap();
const unavailable=()=>Object.assign(new Error('KNOWLEDGE_UNAVAILABLE'),{code:'KNOWLEDGE_UNAVAILABLE'});

export function validateKnowledgePolicy(value){
  exactKeys(value,['enabled','corpusVersion','namespaceId']);
  if(value.enabled!==true||value.corpusVersion!==manifest.contentVersion||typeof value.namespaceId!=='string'||!/^[a-f0-9]{32}$/.test(value.namespaceId))throw Error('Invalid knowledge policy');
  return value;
}

// The importer writes this immutable marker only after every pinned shard has
// been verified. Each selected shard is independently checked before inference.
export async function assertStoryKnowledgeReady(store,{timeoutMs=5000}={}){
  if(!store||typeof store.get!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000)throw unavailable();
  let check=verifiedBindings.get(store);
  if(!check){
    const verify=async()=>{
      const value=await store.get(manifest.manifestKey,'text');
      if(typeof value!=='string'||value.length>4096)throw unavailable();
      const bytes=new TextEncoder().encode(value),digest=await crypto.subtle.digest('SHA-256',bytes);
      const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
      if(hash!==manifest.manifestSha256)throw unavailable();
    };
    check=(async()=>{
      let timer;
      try{await Promise.race([verify(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(unavailable()),timeoutMs);})]);}
      finally{clearTimeout(timer);}
    })();
    verifiedBindings.set(store,check);
  }
  try{await check;}catch{if(verifiedBindings.get(store)===check)verifiedBindings.delete(store);throw unavailable();}
}

export function storyKnowledgeMetadata({enabled=false,available=false,errorCode=null}={}){
  return {protocolVersion:1,enabled,available,status:available?'ready':enabled?'paused':'disabled',errorCode,corpusVersion:manifest.contentVersion,sourceSha256:manifest.sourceSha256,chapterCount:manifest.chapterCount,sectionsCovered:manifest.sectionsCovered,evidenceCount:manifest.evidenceCount,curatedCount:manifest.curatedCount,shardCount:manifest.shardCount,method:manifest.method,retrievalMode:'lexical-concept',sourceTextPublic:false};
}
