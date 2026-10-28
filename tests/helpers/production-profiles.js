// Test-owned registries isolate admission behavior from the release's real
// promotion state. No fixture writer may edit the checked-out source tree.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,cp,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parse} from 'acorn';
import {CANDIDATE_PROFILE} from '../../src/worker/story-config.js';

const repository=fileURLToPath(new URL('../../',import.meta.url));
export const UNVALIDATED_PROFILE=Object.freeze({...CANDIDATE_PROFILE,validated:false,supportsStructuredOutput:null});
export const VALIDATED_FIXTURE_PROFILE=Object.freeze({...CANDIDATE_PROFILE,validated:true,supportsStructuredOutput:true,validationEvidence:'test-fixture-only'});

export async function setFixtureProductionProfiles(root,profiles){
  const resolvedRoot=await realpath(root),file=path.join(root,'src/worker/story-config.js');
  assert.notEqual(resolvedRoot,await realpath(repository),'fixtures must not rewrite the real production registry');
  assert.ok((await realpath(file)).startsWith(resolvedRoot+path.sep),'fixture registry must be an ordinary file inside its disposable root');
  const source=await readFile(file,'utf8');
  const declarations=parse(source,{ecmaVersion:'latest',sourceType:'module'}).body
    .filter(node=>node.type==='ExportNamedDeclaration'&&node.declaration?.type==='VariableDeclaration')
    .flatMap(node=>node.declaration.declarations)
    .filter(node=>node.id.type==='Identifier'&&node.id.name==='PRODUCTION_PROFILES');
  assert.equal(declarations.length,1,'the fixture must replace exactly the registry initializer');
  const {start,end}=declarations[0].init;
  const expression=`Object.freeze(${JSON.stringify(profiles)}.map(profile=>Object.freeze(profile)))`;
  await writeFile(file,source.slice(0,start)+expression+source.slice(end));
}

export async function loadConfigWithProfiles(t,profiles=[UNVALIDATED_PROFILE]){
  const root=await mkdtemp(path.join(tmpdir(),'wending-profile-fixture-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'src/worker'),{recursive:true});
  await writeFile(path.join(root,'package.json'),'{"type":"module"}');
  await cp(path.join(repository,'src/worker/story-config.js'),path.join(root,'src/worker/story-config.js'));
  await setFixtureProductionProfiles(root,profiles);
  return import(pathToFileURL(path.join(root,'src/worker/story-config.js')).href);
}
