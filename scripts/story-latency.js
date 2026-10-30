import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// These are explicit product-test assumptions, not a claim about every reader.
// Preserve failed samples: a quick invalid scene is never a playable turn.
export function summarizeStoryLatency(record,{readingCharsPerSecond=6,readableChars=20,targetWaitMs=2000}={}){
  if(!Number.isFinite(readingCharsPerSecond)||readingCharsPerSecond<=0||!Number.isSafeInteger(readableChars)||readableChars<1||!Number.isFinite(targetWaitMs)||targetWaitMs<0)throw Error('LATENCY_OPTIONS_INVALID');
  if(!Array.isArray(record?.timeline)||!Number.isFinite(record.doneMs)||record.doneMs<0)throw Error('LATENCY_RECORD_INVALID');
  let previousTime=0,previousChars=0,firstAnyPreviewMs=null,segment=[];
  for(const event of record.timeline){
    if(!Number.isFinite(event.atMs)||event.atMs<previousTime||event.atMs>record.doneMs)throw Error('LATENCY_RECORD_INVALID');
    previousTime=event.atMs;
    if(event.reset===true){segment=[];previousChars=0;continue;}
    if(!Number.isSafeInteger(event.chars)||event.chars<previousChars)throw Error('LATENCY_RECORD_INVALID');
    if(event.chars>0)firstAnyPreviewMs??=event.atMs;
    if(event.chars>previousChars)segment.push({atMs:event.atMs,chars:event.chars});
    previousChars=event.chars;
  }
  const firstReadable=segment.find(event=>event.chars>=readableChars),usable=record.result?.status==='ready';
  let maxGap=0;for(let i=1;i<segment.length;i++)maxGap=Math.max(maxGap,segment[i].atMs-segment[i-1].atMs);
  let readingFinish=null,stall=null,optionsWait=null;
  if(usable&&firstReadable){
    let cursor=firstReadable.atMs,read=0,available=firstReadable.chars;stall=0;
    for(const event of segment){
      if(event.atMs<firstReadable.atMs)continue;
      const elapsed=event.atMs-cursor,needed=(available-read)/readingCharsPerSecond*1000;
      stall+=Math.max(0,elapsed-needed);read+=Math.min(available-read,elapsed/1000*readingCharsPerSecond);
      available=event.chars;cursor=event.atMs;
    }
    readingFinish=Math.round(cursor+(available-read)/readingCharsPerSecond*1000);
    optionsWait=Math.max(0,record.doneMs-readingFinish);stall=Math.round(stall);
  }
  return {usable,errorCode:record.result?.errorCode??record.failure??null,firstAnyPreviewMs,firstReadableMs:firstReadable?.atMs??null,completionMs:record.doneMs,narrativeChars:segment.at(-1)?.chars??0,maxPreviewGapMs:maxGap,readingFinishEstimateMs:readingFinish,readingStallEstimateMs:stall,optionsWaitEstimateMs:optionsWait,prefetchWorthEvaluating:usable&&firstReadable?firstReadable.atMs>targetWaitMs||stall>targetWaitMs||optionsWait>targetWaitMs:null,assumptions:{readingCharsPerSecond,readableChars,targetWaitMs}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(!process.argv[2])throw Error('Usage: node scripts/story-latency.js <benchmark.json> [...]');
    for(const file of process.argv.slice(2)){
      const value=JSON.parse(await readFile(file,'utf8'));
      for(const record of Array.isArray(value.records)?value.records:[value])console.log(JSON.stringify({file,caseId:record.caseId??null,...summarizeStoryLatency(record)}));
    }
  }catch(error){console.error(error.message);process.exitCode=1;}
}
