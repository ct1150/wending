import {readFile,writeFile,mkdir,rm,realpath,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'acorn';
import {CANDIDATE_MODEL_ID} from '../src/worker/story-config.js';
import {validateStoryStagePolicy} from '../src/worker/story-stage.js';
import {STORY_EXPERIMENT_COORDINATOR_NAME,STORY_EXPERIMENT_NAMESPACE_ID} from '../src/worker/story-experiment.js';
import {validateStoryProductionPolicy,STORY_PRODUCTION_VERSIONS,STORY_BUDGET_NAMESPACE_ID} from '../src/worker/story-production.js';

export async function buildGateway(options={}){
  if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(key=>!['root','sourceCommit','acceptance','production'].includes(key)))throw new Error('Unsupported gateway build option');
  const {root=fileURLToPath(new URL('../',import.meta.url)),sourceCommit=process.env.SOURCE_COMMIT,acceptance,production}=options;
  if(acceptance!==undefined&&production!==undefined)throw new Error('Tester and production modes are mutually exclusive');
  if(typeof sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(sourceCommit))throw new Error('A full source commit is required');
  const [html,icon,implementation,pkg]=await Promise.all([readFile(path.join(root,'release/baishi-wending-offline.html'),'utf8'),readFile(path.join(root,'assets/seal.svg'),'utf8'),readFile(path.join(root,'src/worker/release-gateway.js'),'utf8'),readFile(path.join(root,'package.json'),'utf8')]);
  const fallback={html,version:JSON.parse(pkg).version,sourceCommit,htmlSha256:createHash('sha256').update(html).digest('hex')};
  if(!implementation.includes('export function createReleaseGateway('))throw new Error('Gateway implementation export is missing');
  const code=implementation.replace('export function createReleaseGateway(','function createReleaseGateway(')+`\nconst gateway = createReleaseGateway(${JSON.stringify({fallback,icon})});\nexport default gateway;\n`;
  await mkdir(path.join(root,'release'),{recursive:true});await writeFile(path.join(root,'release/gateway.mjs'),code);
  const backend=await buildBackend({root,sourceCommit,fallback,icon,acceptance,production});
  return{sourceCommit,htmlSha256:fallback.htmlSha256,workerBytes:Buffer.byteLength(code),...(backend?{backend}:{})};
}

const VERSIONS=STORY_PRODUCTION_VERSIONS;
const digest=code=>createHash('sha256').update(code).digest('hex');
function moduleDependencies(source,file){
  let ast;
  try {ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});}
  catch(error){throw new Error(`${file}: Unsupported backend module syntax: ${error.message}`);}
  const dependencies=[];
  // Walk the parsed syntax, including nested/template expressions. Keyword-like
  // strings, comments and regular expressions cannot become declarations.
  function inspect(node){
    if(!node||typeof node!=='object')return;
    if(node.type==='ImportExpression'||node.type==='MetaProperty'&&node.meta.name==='import')throw new Error(`${file}: Dynamic imports/import.meta are unsupported in backend packages`);
    if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source){
      if(node.attributes?.length)throw new Error(`${file}: Backend import attributes are unsupported`);
      dependencies.push(node.source.value);
    }
    for(const value of Object.values(node)){
      if(Array.isArray(value))for(const child of value)inspect(child);
      else if(value&&typeof value==='object')inspect(value);
    }
  }
  inspect(ast);return dependencies;
}
async function buildBackend({root,sourceCommit,fallback,icon,acceptance,production}){
  const entry=path.join(root,'src/worker/index.js');
  const output=path.join(root,'release/backend');
  await rm(output,{recursive:true,force:true});
  try {await stat(entry);}catch(error){
    if(error.code!=='ENOENT')throw error;
    if(acceptance!==undefined||production!==undefined)throw new Error('Configured backend entry is missing');
    try {await stat(path.join(root,'config/story-deployment.json'));}catch(policyError){if(policyError.code==='ENOENT')return null;throw policyError;}
    throw new Error('Configured backend entry is missing');
  }
  const policy=JSON.parse(await readFile(path.join(root,'config/story-deployment.json'),'utf8'));
  // The checked-in switch permits explicit production, never automatic activation.
  // CI's default build stays disabled even after a reviewed profile is promoted.
  const modeAllowed=production!==undefined?policy.enabled===true:acceptance!==undefined?policy.enabled===false:typeof policy.enabled==='boolean';
  if(Object.keys(policy).length!==6||!modeAllowed||Object.entries(VERSIONS).some(([key,value])=>policy[key]!==value))throw new Error('Unsupported story deployment policy');
  // This separately explicit server-side package can only expose candidate
  // acceptance to a tester permit. The checked-in public policy remains closed.
  const stage=acceptance===undefined?null:validateStoryStagePolicy(acceptance);
  const live=production===undefined?null:validateStoryProductionPolicy(production);
  // The imported registry and the uploaded modules must belong to the same
  // reviewed checkout. Tests use a complete, explicitly isolated fixture tree.
  if(live&&await realpath(root)!==await realpath(fileURLToPath(new URL('../',import.meta.url))))throw new Error('Production source root must match its build script');
  const sourceRoot=await realpath(path.join(root,'src')),modules=new Map();
  async function visit(file){
    const lexical=path.resolve(file);
    if(!lexical.startsWith(sourceRoot+path.sep))throw new Error('Backend import escapes outside src');
    const resolved=await realpath(lexical);
    if(resolved!==lexical||!resolved.startsWith(sourceRoot+path.sep)||!resolved.endsWith('.js'))throw new Error('Backend imports must be ordinary .js files inside src');
    const name=path.relative(root,resolved).split(path.sep).join('/');
    if(modules.has(name))return;
    const code=await readFile(resolved,'utf8');modules.set(name,code);
    // Parse the complete ESM program; preserve original module bytes.
    for(const specifier of moduleDependencies(code,name)){
      if(specifier==='cloudflare:workers')continue;
      if(!specifier.startsWith('./')&&!specifier.startsWith('../'))throw new Error('External backend dependency is not allowed');
      await visit(path.resolve(path.dirname(resolved),specifier));
    }
  }
  await visit(entry);await visit(path.join(root,'src/worker/release-gateway.js'));
  if(stage)await visit(path.join(root,'src/worker/story-stage.js'));
  if(live)await visit(path.join(root,'src/worker/story-production.js'));
  const activation={enabled:stage!==null||live!==null,publicEnabled:live!==null,accessMode:stage?'tester-only':live?'production':'disabled',candidateModelId:CANDIDATE_MODEL_ID,modelValidated:live!==null};
  const identity={sourceCommit,...VERSIONS,...activation};
  const factory=stage?'createStoryStageWorker':live?'createStoryProductionWorker':'createStoryWorker',factoryModule=stage?'story-stage.js':live?'story-production.js':'index.js';
  const code=`import {createReleaseGateway} from './src/worker/release-gateway.js';\nimport {${factory}} from './src/worker/${factoryModule}';\nexport {StoryBudget} from './src/worker/index.js';\nexport const backendIdentity=Object.freeze(${JSON.stringify(identity)});\nconst gateway=createReleaseGateway(${JSON.stringify({fallback,icon,...(stage?{embeddedOnly:true}:{})})});\nexport default ${factory}({staticFetch:(request,env,ctx)=>gateway.fetch(request,env,ctx),config:${JSON.stringify(stage??live??{enabled:false})}});\n`;
  modules.set('entry.mjs',code);
  await mkdir(output,{recursive:true});
  const description=[];
  for(const [name,content] of [...modules].sort(([a],[b])=>a.localeCompare(b,'en'))){
    await mkdir(path.dirname(path.join(output,name)),{recursive:true});await writeFile(path.join(output,name),content);
    description.push({name,type:'esm',bytes:Buffer.byteLength(content),sha256:digest(content)});
  }
  const bindings=[{name:'AI',type:'ai'},{name:'STORY_BUDGET',type:'durable_object_namespace',class_name:'StoryBudget',...(stage||live?{namespace_id:STORY_BUDGET_NAMESPACE_ID}:{})}];
  if(stage)bindings.push({name:'STORY_EXPERIMENT',type:'durable_object_namespace',namespace_id:STORY_EXPERIMENT_NAMESPACE_ID});
  const manifest={schemaVersion:1,main_module:'entry.mjs',compatibility_date:'2026-07-30',sourceCommit,frontend:{version:fallback.version,htmlSha256:fallback.htmlSha256},versions:VERSIONS,...activation,coordinatorName:'story-budget-v1-global',bindings,migrations:stage||live?[]:[{tag:'story-budget-v1',new_sqlite_classes:['StoryBudget']}],...(stage?{experimentCoordinatorName:STORY_EXPERIMENT_COORDINATOR_NAME,requiredSecrets:['STORY_OPERATOR_TOKEN']}:{ }),modules:description};
  await writeFile(path.join(output,'deployment.json'),JSON.stringify(manifest,null,2)+'\n');
  return {mainModule:manifest.main_module,moduleCount:description.length,manifestSha256:digest(JSON.stringify(manifest,null,2)+'\n')};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))buildGateway().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
