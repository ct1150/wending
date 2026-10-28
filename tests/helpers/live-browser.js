import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
export async function liveBrowser(t) {
 const root=resolve('.');
 const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+'/'))throw Error();const body=await readFile(path);res.writeHead(200,{'content-type':extname(path)==='.js'?'text/javascript':'text/html'});res.end(body);}catch{res.writeHead(404);res.end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const profile=await mkdtemp(resolve(tmpdir(),'wending-idb-'));let context;
 try{context=await chromium.launchPersistentContext(profile,{headless:true,...(process.env.WENDING_BROWSER_EXECUTABLE?{executablePath:process.env.WENDING_BROWSER_EXECUTABLE}:{})});}catch(e){server.close();throw e;}
 t.after(async()=>{await context.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});});
 const browser=context.browser(),page=await context.newPage();const origin=`http://127.0.0.1:${server.address().port}`;await page.goto(origin+'/index.html');
 await page.evaluate(async()=>{
  const engine=await import('/src/game/cultivation/live/engine.js'),identity=await import('/src/game/cultivation/live/identity.js'),memory=await import('/src/game/cultivation/live/memory.js');
  Object.assign(globalThis,{engine,identity,memory});
  globalThis.fixture=(state,n=0,size=0)=>{const prefix='r:'+identity.sha256(state.runId).slice(0,16)+':t'+(state.turnId+1)+':';return {id:prefix+'s:local',title:'山路',location:'山间',blocks:[{kind:'narration',text:'你循路前行，望见松影。'+n+'。'+'山'.repeat(size)}],entities:[],choices:[{id:prefix+'c:rest',label:'歇息',intent:'rest',targetId:'self',stake:'low',approach:'recover'},{id:prefix+'c:train',label:'修行',intent:'practice',targetId:'self',stake:'low',approach:'steady'}],memoryDeltas:[]};};
  globalThis.open=async(name)=>{const m=await import('/src/game/live-archive.js');return m.openLiveArchive({name});};
  globalThis.born=async(a,id='archive-run')=>{const state=engine.createLiveGame({runId:id,seed:42}),pending=engine.prepareOpening(state,{requestId:'opening'});await a.create({state,pending});return {state,pending};};
  globalThis.advance=async(a,size=0)=>{const l=await a.load();const p=l.pending??engine.prepareChoice(l.state,{requestId:'request-'+(l.state.turnId+1),choiceId:l.state.currentScene.choices[0].id});if(!l.pending)await a.prepare(p);const scene=p.receipt.death?null:fixture(l.state,l.state.turnId,size);const nextState=scene?engine.commitTurn(l.state,p,scene):engine.settleDeath(l.state,p);return a.commit({expectedRevision:l.state.revision,nextState,scene,memoryDelta:scene?memory.buildMemoryDelta(p.receipt,scene):null,requestId:p.identity.requestId,expectedAttemptId:l.attempt?.id??null});};
 });
 return {page,browser,context,origin};
}
