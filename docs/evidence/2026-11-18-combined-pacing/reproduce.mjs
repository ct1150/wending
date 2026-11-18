import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,copyFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const base=await mkdtemp(join(root,'.scratch/combined-pacing-'));
execFileSync('git',['archive','--output='+join(base,'source.tar'),'a0ac265322a127eda26700fc5b2e5c1aa06bb15c'],{cwd:root});
execFileSync(process.platform==='win32'?'tar.exe':'tar',['-xf',join(base,'source.tar'),'-C',base]);
await mkdir(join(base,'.scratch'));
const script='docs/evidence/2026-11-18-combined-pacing/run.mjs';
await mkdir(join(base,'docs/evidence/2026-11-18-combined-pacing'),{recursive:true});
await copyFile(new URL('./run.mjs',import.meta.url),join(base,script));
const output=execFileSync(process.execPath,[script],{cwd:base,encoding:'utf8'});
assert.deepEqual(JSON.parse(await readFile(join(base,'.scratch/combined-pacing-summary.json'),'utf8')),JSON.parse(await readFile(new URL('./summary.json',import.meta.url),'utf8')));
console.log(output.trim());console.log('Verified fixed-revision evidence: '+join(base,'.scratch'));
