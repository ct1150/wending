import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {buildGateway} from '../scripts/build-gateway.js';

test('packaged gateway imports without network and serves exact verified fallback when release source fails',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'wending-gateway-build-'));t.after(()=>rm(root,{recursive:true,force:true}));
  for(const dir of ['release','assets','src/worker'])await mkdir(path.join(root,dir),{recursive:true});
  const html='<!doctype html>\r\n<title>双命格·三界</title><script>const prose = `雪落 ${16}`;</script>\n';
  const sourceCommit='a'.repeat(40),icon='<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  await writeFile(path.join(root,'release/baishi-wending-web.html'),html);
  await writeFile(path.join(root,'assets/seal.svg'),icon);
  await writeFile(path.join(root,'package.json'),JSON.stringify({version:'4.0.0'}));
  await writeFile(path.join(root,'src/worker/release-gateway.js'),await readFile(new URL('../src/worker/release-gateway.js',import.meta.url),'utf8'));
  const result=await buildGateway({root,sourceCommit});
  const originalFetch=globalThis.fetch;let calls=0,worker;
  globalThis.fetch=async()=>{calls++;throw new Error('offline');};
  try{worker=(await import(pathToFileURL(path.join(root,'release/gateway.mjs')).href)).default;}
  finally{globalThis.fetch=originalFetch;}
  assert.equal(calls,0);
  const home=await worker.fetch(new Request('https://example.test/'));assert.equal(home.status,200);assert.equal(await home.text(),html);assert.equal(calls,1);
  const health=await(await worker.fetch(new Request('https://example.test/healthz'))).json();
  assert.equal(health.sourceCommit,sourceCommit);assert.equal(health.version,'4.0.0');assert.equal(health.releaseSource,'embedded');
  assert.equal(health.htmlSha256,createHash('sha256').update(html).digest('hex'));assert.equal(health.htmlBytes,Buffer.byteLength(html));assert.equal(result.htmlSha256,health.htmlSha256);
  const download=await worker.fetch(new Request('https://example.test/baishi-wending-offline.html'));assert.equal(download.status,410);assert.equal(download.headers.get('Content-Disposition'),null);assert.doesNotMatch(await download.text(),/<!doctype|<script/i);
  assert.equal(await(await worker.fetch(new Request('https://example.test/favicon.svg'))).text(),icon);
});
