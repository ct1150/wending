import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';

const run=promisify(execFile);
const git=async(root,...args)=>(await run('git',['-C',root,...args],{maxBuffer:4*1024*1024})).stdout.trim();
const projectRoot=fileURLToPath(new URL('../',import.meta.url));

export async function publishRelease({root=projectRoot,sourceCommit=process.env.GITHUB_SHA}={}){
  if(typeof sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(sourceCommit))throw new Error('A full source commit is required');
  const currentMain=async()=>((await git(root,'ls-remote','origin','refs/heads/main')).split(/\s/)[0]||'');
  if(await currentMain()!==sourceCommit)return{published:false,reason:'superseded'};
  if(await git(root,'rev-parse','HEAD')!==sourceCommit)throw new Error('Source checkout does not match the release');
  const html=await readFile(path.join(root,'release/baishi-wending-offline.html'));
  const meta=JSON.parse(await readFile(path.join(root,'release/release.json'),'utf8'));
  const htmlSha256=createHash('sha256').update(html).digest('hex');
  if(!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(meta.version)||html.byteLength<1||html.byteLength>3000000||meta.offline?.bytes!==html.byteLength||meta.offline?.sha256!==htmlSha256)throw new Error('Release bytes or digest do not match the verified build');
  const holder=await mkdtemp(path.join(tmpdir(),'wending-publish-')),work=path.join(holder,'channel');
  let added=false;
  try{
    const channelHead=(await git(root,'ls-remote','origin','refs/heads/release-channel')).split(/\s/)[0];
    if(channelHead)await git(root,'fetch','origin','refs/heads/release-channel');
    await git(root,'worktree','add','--detach',work,channelHead||sourceCommit);added=true;
    if(!channelHead)await git(work,'read-tree','--empty');
    await mkdir(path.join(work,'releases'),{recursive:true});
    const artifactPath=`releases/${htmlSha256}.html`;
    await writeFile(path.join(work,artifactPath),html);
    await git(work,'add','--',artifactPath);
    if(await git(work,'diff','--cached','--name-only'))await git(work,'-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit','-m',`release: verified artifact ${sourceCommit.slice(0,12)}`);
    const artifactCommit=await git(work,'rev-parse','HEAD');
    const manifest={schemaVersion:1,version:meta.version,sourceCommit,artifactCommit,htmlSha256,htmlBytes:html.byteLength,artifactPath};
    await writeFile(path.join(work,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    await git(work,'add','--','manifest.json');
    if(await git(work,'diff','--cached','--name-only'))await git(work,'-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit','-m',`release: publish ${meta.version} from ${sourceCommit.slice(0,12)}`);
    // Recheck immediately before a normal fast-forward push. Newer main runs own publication.
    if(await currentMain()!==sourceCommit)return{published:false,reason:'superseded'};
    const releaseCommit=await git(work,'rev-parse','HEAD');
    // Checkout's credentials are scoped to the original Git directory. The
    // objects are shared, so push its explicit commit from the source checkout.
    await git(root,'push','origin',`${releaseCommit}:refs/heads/release-channel`);
    return{published:true,sourceCommit,releaseCommit,htmlSha256};
  }finally{
    if(added)await git(root,'worktree','remove','--force',work).catch(()=>{});
    await rm(holder,{recursive:true,force:true});
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))publishRelease().then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error('Release publication failed; no forced update was attempted. Check source, build integrity and repository write permission.');process.exitCode=1;});
