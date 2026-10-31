import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
async function repository(t){
  const dir=await mkdtemp(path.join(tmpdir(),'wending-publisher-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const remote=path.join(dir,'remote.git'),root=path.join(dir,'source');await mkdir(root);
  execFileSync('git',['init','--bare',remote],{stdio:'ignore'});git(root,'init','-b','main');git(root,'config','user.name','Publisher Test');git(root,'config','user.email','publisher@example.invalid');
  await writeFile(path.join(root,'README.md'),'source');git(root,'add','README.md');git(root,'commit','-m','initial');git(root,'remote','add','origin',remote);git(root,'push','origin','main');
  await mkdir(path.join(root,'release'));const html='<!doctype html><title>测试通过的问鼎</title>';const digest=createHash('sha256').update(html).digest('hex');
  await writeFile(path.join(root,'release','baishi-wending-web.html'),html);await writeFile(path.join(root,'release','release.json'),JSON.stringify({version:'4.0.0',frontend:{file:'baishi-wending-web.html',bytes:Buffer.byteLength(html),sha256:digest}}));
  return{root,remote,html,digest,sourceCommit:git(root,'rev-parse','HEAD')};
}

test('publisher pushes an immutable artifact commit and matching manifest without modifying source checkout',async t=>{
  const{publishRelease}=await import('../scripts/publish-release.js');const r=await repository(t);const before=git(r.root,'status','--porcelain');
  const result=await publishRelease({root:r.root,sourceCommit:r.sourceCommit});assert.equal(result.published,true);
  const manifest=JSON.parse(git(r.remote,'show','release-channel:manifest.json'));
  assert.deepEqual(Object.keys(manifest).sort(),['schemaVersion','version','sourceCommit','artifactCommit','htmlSha256','htmlBytes','artifactPath'].sort());
  assert.equal(manifest.schemaVersion,1);assert.equal(manifest.artifactPath,`releases/${r.digest}.html`);
  assert.equal(manifest.sourceCommit,r.sourceCommit);assert.equal(manifest.htmlSha256,r.digest);assert.equal(manifest.htmlBytes,Buffer.byteLength(r.html));
  assert.equal(git(r.remote,'show',`${manifest.artifactCommit}:${manifest.artifactPath}`),r.html);
  assert.equal(git(r.root,'rev-parse','HEAD'),r.sourceCommit);assert.equal(git(r.root,'status','--porcelain'),before);
  const again=await publishRelease({root:r.root,sourceCommit:r.sourceCommit});assert.equal(again.published,true);assert.equal(JSON.parse(git(r.remote,'show','release-channel:manifest.json')).sourceCommit,r.sourceCommit);
});

test('invalid build bytes and superseded main commits cannot publish',async t=>{
  const{publishRelease}=await import('../scripts/publish-release.js');const r=await repository(t);
  await writeFile(path.join(r.root,'release','baishi-wending-web.html'),'corrupt');await assert.rejects(publishRelease({root:r.root,sourceCommit:r.sourceCommit}),/digest|bytes/i);
  assert.equal(git(r.remote,'for-each-ref','--format=%(refname)','refs/heads/release-channel'),'');
  await writeFile(path.join(r.root,'release','baishi-wending-web.html'),r.html);
  await writeFile(path.join(r.root,'README.md'),'new source');git(r.root,'add','README.md');git(r.root,'commit','-m','newer');git(r.root,'push','origin','main');
  const result=await publishRelease({root:r.root,sourceCommit:r.sourceCommit});assert.equal(result.published,false);assert.equal(result.reason,'superseded');
  assert.equal(git(r.remote,'for-each-ref','--format=%(refname)','refs/heads/release-channel'),'');
});
