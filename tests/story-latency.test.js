import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../scripts/story-latency.js').catch(()=>null);
function measure(record,options={readingCharsPerSecond:10}){assert.ok(module,'latency measurement module exists');return module.summarizeStoryLatency(record,options);}
const ready=(timeline,doneMs)=>({timeline,doneMs,result:{status:'ready'}});

test('latency measures readable text separately from completion and estimates reading overlap',()=>{
  const input=ready([{atMs:300,chars:30},{atMs:500,chars:60},{atMs:900,chars:90}],1800),before=structuredClone(input),m=measure(input);
  assert.equal(m.firstReadableMs,300);assert.equal(m.completionMs,1800);assert.equal(m.readingFinishEstimateMs,9300);assert.equal(m.optionsWaitEstimateMs,0);assert.equal(m.readingStallEstimateMs,0);assert.equal(m.maxPreviewGapMs,400);assert.deepEqual(input,before);
});

test('a slow stream counts time when the reader catches up instead of assuming steady output',()=>{
  const m=measure(ready([{atMs:100,chars:20},{atMs:5100,chars:30},{atMs:6100,chars:60}],6300));
  assert.equal(m.readingStallEstimateMs,3000);assert.equal(m.readingFinishEstimateMs,9100);assert.equal(m.maxPreviewGapMs,5000);assert.equal(m.prefetchWorthEvaluating,true);
});

test('late choices count only the time remaining after the reader finishes',()=>{
  const m=measure(ready([{atMs:100,chars:20}],10100));assert.equal(m.readingFinishEstimateMs,2100);assert.equal(m.optionsWaitEstimateMs,8000);assert.equal(m.prefetchWorthEvaluating,true);
});

test('discarded primary previews do not make a late backup appear responsive',()=>{
  const m=measure(ready([{atMs:10,chars:80},{atMs:100,reset:true},{atMs:2000,chars:20},{atMs:2500,chars:40}],2600));
  assert.equal(m.firstAnyPreviewMs,10);assert.equal(m.firstReadableMs,2000);assert.equal(m.narrativeChars,40);assert.equal(m.readingFinishEstimateMs,6000);
});

test('failed or absent scenes never get a successful-playability or prefetch verdict',()=>{
  for(const result of [{status:'rejected',errorCode:'GENERATED_SCENE_INVALID'},{status:'paused',errorCode:'PROVIDER_BUSY'},null]){
    const m=measure({timeline:[{atMs:300,chars:20}],doneMs:800,result});assert.equal(m.usable,false);assert.equal(m.optionsWaitEstimateMs,null);assert.equal(m.prefetchWorthEvaluating,null);
  }
  assert.equal(measure({timeline:[],doneMs:500,result:{status:'paused'}}).firstReadableMs,null);
});

test('invalid timing, decreasing text without reset and invalid reading rates are rejected',()=>{
  for(const record of [ready([{atMs:500,chars:20},{atMs:100,chars:30}],800),ready([{atMs:100,chars:20},{atMs:200,chars:10}],800),ready([{atMs:900,chars:20}],800)])assert.throws(()=>measure(record),/LATENCY_RECORD_INVALID/);
  assert.throws(()=>measure(ready([],100),{readingCharsPerSecond:0}),/LATENCY_OPTIONS_INVALID/);
});
