// Shared private acceptance state accounting; not part of the public graph.
import { buildMemoryDelta } from '../game/cultivation/live/memory.js';
import { sha256 } from '../game/cultivation/live/identity.js';
const copy=value=>JSON.parse(JSON.stringify(value));
const fail=code=>{throw Object.assign(new Error(code),{code});};
export const MAX_ACCEPTANCE_SNAPSHOT_BYTES=120*1024;
export function boundAcceptanceRecord(record){if(new TextEncoder().encode(JSON.stringify(record)).length>MAX_ACCEPTANCE_SNAPSHOT_BYTES)fail('ACCEPTANCE_STORAGE_LIMIT');return record;}
export function rememberAcceptanceTurn(previous,pending,scene) {
  const delta = buildMemoryDelta(pending.receipt,scene), common = {runId:pending.identity.runId,turnId:pending.identity.turnId};
  const rows = new Map(previous.map(row => [row.id,copy(row)]));
  const add = row => rows.set(row.id,row);
  add({id:'receipt:'+common.turnId,...common,source:'rules',kind:'receipt',receipt:copy(delta.receipt)});
  for (const row of delta.records) add({...row,...common});
  for (const entity of scene.entities) {
    const id = 'e:'+sha256(entity.id).slice(0,40), prior = rows.get(id);
    add({id,...common,source:'narrative',kind:'entity',entity:{id:entity.id,name:entity.name,kind:entity.kind},status:prior?.status === 'dead' ? 'dead' : entity.status ?? prior?.status ?? 'unknown'});
  }
  for (const entityId of Object.keys(pending.receipt.relationChanges)) add({id:'q:'+sha256(entityId).slice(0,40),...common,source:'rules',kind:'ruleRelation',entityId,value:pending.nextLife.relations[entityId]});
  if (rows.size > 256) fail('ACCEPTANCE_STORAGE_LIMIT');
  return [...rows.values()];
}

