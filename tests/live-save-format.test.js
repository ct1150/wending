import test from 'node:test';
import assert from 'node:assert/strict';
import { liveBrowser } from './helpers/live-browser.js';
test('streaming roundtrip preserves pending identity and rejects trailing or truncated data before activation',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');const a=await open('format-basic');await born(a);await a.setAttempt({runId:'archive-run',requestId:'opening',expectedAttemptId:null,attempt:{id:'first',sessionRef:'old-session',retryOf:null}});const before=await a.load(),bytes=new Uint8Array(await new Response(exportLiveArchive(a)).arrayBuffer());const imported=await importLiveArchive(new Blob([bytes]).stream(),a);let rejected=0;for(const bad of [bytes.slice(0,-10),new Uint8Array([...bytes,...new TextEncoder().encode('{}\n')])]){try{await importLiveArchive(new Blob([bad]).stream(),a);}catch{rejected++;}}return {before,imported,rejected,after:await a.load(),staged:await new Promise(resolve=>{const tx=a.db.transaction('runs'),req=tx.objectStore('runs').getAll();req.onsuccess=()=>resolve(req.result.filter(r=>r.status==='staging'||r.status==='validated').length);}),text:new TextDecoder().decode(bytes)};});
 assert.deepEqual(r.imported.state,r.before.state);assert.deepEqual(r.imported.pending,r.before.pending);assert.deepEqual(r.imported.attempt,r.before.attempt);assert.equal(r.imported.pause,'SESSION_UNAVAILABLE');assert.equal(r.rejected,2);assert.equal(r.staged,0);assert.equal(r.after.archiveId,r.imported.archiveId);assert.doesNotMatch(r.text,/cookie|Authorization|credential/);
});
test('captured export remains coherent while playing and restores pending retry lineage',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{
 const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');const a=await open('format-concurrent');await born(a);await advance(a);const old=await a.load(),p=engine.prepareChoice(old.state,{requestId:'choice-pending',choiceId:old.state.currentScene.choices[0].id});await a.prepare(p);await a.setAttempt({runId:old.state.runId,requestId:p.identity.requestId,expectedAttemptId:null,attempt:{id:'first-choice',sessionRef:'first-session',retryOf:null}});await a.setAttempt({runId:old.state.runId,requestId:p.identity.requestId,expectedAttemptId:'first-choice',attempt:{id:'retry-choice',sessionRef:'second-session',retryOf:{attemptId:'first-choice',sessionRef:'first-session'}}});
 const expected=await a.load(),reader=exportLiveArchive(a).getReader(),parts=[(await reader.read()).value];await advance(a);while(true){const x=await reader.read();if(x.done)break;parts.push(x.value);}const bytes=new Uint8Array(await new Blob(parts).arrayBuffer()),b=await open('format-destination');const restored=await importLiveArchive(new ReadableStream({start(c){for(let i=0;i<bytes.length;i++)c.enqueue(bytes.slice(i,i+1));c.close();}}),b);
 let rejected=0;const text=new TextDecoder().decode(bytes),lines=text.trimEnd().split('\n'),chunkIndex=lines.findIndex(l=>JSON.parse(l).type==='chunk');const badHash=lines.map((l,i)=>i===chunkIndex?JSON.stringify({...JSON.parse(l),chunk:{...JSON.parse(l).chunk,hash:'0'.repeat(64)}}):l).join('\n')+'\n';const missing=lines.filter((_,i)=>i!==chunkIndex).join('\n')+'\n';const duplicate=[...lines.slice(0,chunkIndex),lines[chunkIndex],...lines.slice(chunkIndex)].join('\n')+'\n';for(const malformed of [badHash,missing,duplicate,'x'.repeat(512*1024+1)]){try{await importLiveArchive(new Blob([malformed]).stream(),b);}catch{rejected++;}}
 return {expected,restored,after:await b.load(),rejected,history:await b.readHistory('archive-run')};});
 assert.deepEqual(r.restored.state,r.expected.state);assert.deepEqual(r.restored.pending,r.expected.pending);assert.deepEqual(r.restored.attempt,r.expected.attempt);assert.equal(r.history.entries.length,1);assert.equal(r.rejected,4);assert.equal(r.after.archiveId,r.restored.archiveId);
});
test('import must not replace a run that advances while the stream is being validated',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');const a=await open('format-race');await born(a);const bytes=new Uint8Array(await new Response(exportLiveArchive(a)).arrayBuffer());let sent=false;const stream=new ReadableStream({async pull(c){if(sent){await advance(a);c.close();return;}sent=true;c.enqueue(bytes);}});let rejected=false;try{await importLiveArchive(stream,a);}catch{rejected=true;}return {rejected,after:await a.load()};});assert.equal(r.rejected,true);assert.equal(r.after.state.revision,1);
});

test('unmarked pre-fix V5 histories and pending hashes roundtrip without implicit relationship migration',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{
  const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');
  const a=await open('legacy-v5'),state=engine.createLiveGame({runId:'legacy-v5',seed:42});delete state.relationshipVersion;
  await a.create({state,pending:engine.prepareOpening(state,{requestId:'legacy-open'})});await advance(a);await advance(a);
  const active=await a.load(),pending=engine.prepareChoice(active.state,{requestId:'legacy-pending',choiceId:active.state.currentScene.choices[0].id});await a.prepare(pending);
  const before=await a.load(),b=await open('legacy-v5-import');const restored=await importLiveArchive(exportLiveArchive(a),b);
  return {before,restored,historyA:await a.readHistory(state.runId),historyB:await b.readHistory(state.runId)};
 });
 assert.equal(Object.hasOwn(r.restored.state,'relationshipVersion'),false);assert.deepEqual(r.restored.state,r.before.state);assert.deepEqual(r.restored.pending,r.before.pending);assert.deepEqual(r.historyB.entries,r.historyA.entries);
});
