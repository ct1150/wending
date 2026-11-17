import {assertPlainData,canonicalStringify,sha256} from './identity.js';
import {exactKeys,idField,textField} from './schema.js';

const sourceFields=['runId','archiveId','revision','sceneId','sceneHash','kind','speaker','text'];
const sourceOf=brief=>Object.fromEntries(sourceFields.map(key=>[key,brief[key]]));
export function buildEventProseBrief(state,archiveId=state.runId){
 if(!state.events||state.phase!=='active'||!state.currentScene)throw new Error('当前没有可展开的事件。');
 const scene=state.currentScene,block=scene.blocks.find(row=>row.kind==='dialogue')??scene.blocks[0];
 const source={runId:state.runId,archiveId,revision:state.revision,sceneId:scene.id,sceneHash:sha256(canonicalStringify(scene)),kind:block.kind,speaker:block.speaker?scene.entities.find(entity=>entity.id===block.speaker)?.name??state.life.name:'',text:block.text};
 const sourceHash=sha256(canonicalStringify(source));
 return validateEventProseBrief({...source,sourceHash,requestId:'prose:'+sourceHash.slice(0,40)});
}
export function validateEventProseBrief(brief){
 assertPlainData(brief);exactKeys(brief,[...sourceFields,'sourceHash','requestId']);
 for(const key of ['runId','archiveId','sceneId','requestId'])idField(brief[key]);
 if(!Number.isSafeInteger(brief.revision)||brief.revision<1||!['narration','dialogue'].includes(brief.kind)||typeof brief.speaker!=='string'||brief.speaker.length>60||brief.kind==='dialogue'&&!brief.speaker.trim()||brief.kind==='narration'&&brief.speaker!=='')throw new Error('短文来源无效。');
 textField(brief.text,500);
 if(!/^[a-f0-9]{64}$/u.test(brief.sceneHash)||brief.sourceHash!==sha256(canonicalStringify(sourceOf(brief)))||brief.requestId!=='prose:'+brief.sourceHash.slice(0,40)||new TextEncoder().encode(JSON.stringify(brief)).length>3072)throw new Error('短文来源摘要不符。');
 return brief;
}
export function validateProseText(text){
 textField(text,180);
 if(/[<>\u0000-\u001f]/u.test(text)||/```|\[\/?(?:SYSTEM|INST)\]|<\|/u.test(text))throw new Error('短文内容无效。');
 return text;
}
