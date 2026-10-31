import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBrowser} from './helpers/live-browser.js';
import {storyLife} from './helpers/experience-death.js';
test('a portable child cannot bypass a known marked parent by changing its digest or lineage version',async t=>{
 const {page}=await liveBrowser(t),g=storyLife('review-parent',false);
 const result=await page.evaluate(async({birth,steps})=>{
  const {buildRebirthOptions}=await import('/src/game/cultivation/live/reincarnation.js'),format=await import('/src/game/live-save-format.js');
  const results=[];
  for(const scenario of ['different-digest','v1-downgrade','earlier-parent','marker-only']){
    const parentArchive=await open('review-'+scenario);let row=await parentArchive.create({state:birth,pending:steps[0].p});
    const earlier=await new Response(format.exportLiveArchive(parentArchive)).text();
    for(const {p,scene} of steps){if(!row.pending)await parentArchive.prepare(p);row=await parentArchive.commit({expectedRevision:row.state.revision,nextState:scene?engine.commitTurn(row.state,p,scene):engine.settleDeath(row.state,p),scene,memoryDelta:scene?memory.buildMemoryDelta(p.receipt,scene):null,requestId:p.identity.requestId});}
    const options=buildRebirthOptions(row.state,[]),actual=options.reincarnation.parentStateHash;
    let json;
    if(scenario==='marker-only'){
      // An attacker can recompute the checksums in their own portable file;
      // changing only its header must not spend an already installed life.
      const records=(await new Response(format.exportLiveArchive(parentArchive)).text()).trim().split('\n').map(line=>JSON.parse(line));
      records[0].reincarnationClaim={version:1,parentRunId:row.state.runId,parentStateHash:actual,childRunId:'invented-child',lineageId:options.reincarnation.lineageId,generation:options.reincarnation.generation};
      let digest=identity.sha256(JSON.stringify(records[0]));for(const r of records.slice(1,-1))digest=identity.sha256(digest+r.chunk.hash);
      records.at(-1).manifest=digest;json=records.map(r=>JSON.stringify(r)).join('\n')+'\n';
    }else{
      if(scenario!=='v1-downgrade'){options.reincarnation.parentStateHash='7'.repeat(64);options.reincarnation.echoes.find(e=>e.kind==='pledge').status='fulfilled';}
      else {delete options.reincarnation.echoes;delete options.reincarnation.carriedPoints;options.reincarnation.version=1;options.reincarnation.balance=9000;options.inheritedBenefits=options.reincarnation.purchases=['causal-compass','former-relic','past-memory','resilient-body'];}
      const portable=await open('donor-'+scenario),state=engine.createLiveGame({...options,runId:'child-'+scenario,seed:4}),p=engine.prepareOpening(state,{requestId:'open'});
      const staged=await portable._stage(state);await portable._validateStage(staged,state,p,null);await portable.activate(staged,null);
      json=await new Response(format.exportLiveArchive(portable)).text();
    }
    if(scenario==='earlier-parent')row=await format.importLiveArchive(new Response(earlier).body,parentArchive);
    const before=row.archiveId;let rejected=null;try{await format.importLiveArchive(new Response(json).body,parentArchive);}catch(e){rejected=e.code??e.message;}
    const active=await parentArchive.load(),localParent=await parentArchive.load(row.state.runId);
    results.push({scenario,actual,rejected,active:active.state.runId,unchanged:active.archiveId===before,spent:localParent.reincarnatedTo,balance:active.state.reincarnation?.balance,echo:active.state.reincarnation?.echoes?.find(e=>e.kind==='pledge')?.status,purchases:active.state.reincarnation?.purchases});
  } return results;
 },{birth:g.birth,steps:g.steps});
 t.diagnostic(JSON.stringify(result));assert.ok(result.every(r=>r.rejected==='REINCARNATION_INVALID_STATE'&&r.unchanged&&!r.spent));
});
