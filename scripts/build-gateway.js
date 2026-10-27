import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export async function buildGateway({root=fileURLToPath(new URL('../',import.meta.url)),sourceCommit=process.env.SOURCE_COMMIT}={}){
  if(typeof sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(sourceCommit))throw new Error('A full source commit is required');
  const [html,icon,implementation,pkg]=await Promise.all([readFile(path.join(root,'release/baishi-wending-offline.html'),'utf8'),readFile(path.join(root,'assets/seal.svg'),'utf8'),readFile(path.join(root,'src/worker/release-gateway.js'),'utf8'),readFile(path.join(root,'package.json'),'utf8')]);
  const fallback={html,version:JSON.parse(pkg).version,sourceCommit,htmlSha256:createHash('sha256').update(html).digest('hex')};
  if(!implementation.includes('export function createReleaseGateway('))throw new Error('Gateway implementation export is missing');
  const code=implementation.replace('export function createReleaseGateway(','function createReleaseGateway(')+`\nconst gateway = createReleaseGateway(${JSON.stringify({fallback,icon})});\nexport default gateway;\n`;
  await mkdir(path.join(root,'release'),{recursive:true});await writeFile(path.join(root,'release/gateway.mjs'),code);
  return{sourceCommit,htmlSha256:fallback.htmlSha256,workerBytes:Buffer.byteLength(code)};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))buildGateway().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
