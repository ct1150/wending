#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { hashBriefs, validateBriefs, readConfig, generateToFile, previewCandidate, readJsonFile, acceptCandidate, atomicWrite } from './story-author/index.js';

const proseDefault=fileURLToPath(new URL('../src/game/cultivation/v3/prose.js',import.meta.url));
const help=`Offline story authoring (no requests are made by the game):
  node scripts/story-author.js brief [--out briefs.json]
  node scripts/story-author.js generate --out candidate.json [--id arrival.atmosphere]
      [--provider ollama|openai-compatible] [--model qwen3:4b]
      [--endpoint http://127.0.0.1:11434/api/generate] [--timeout-ms 120000]
  node scripts/story-author.js preview candidate.json
  node scripts/story-author.js accept candidate.json

Only accept changes the static prose package. Review preview and facts first.
API keys: STORY_AUTHOR_API_KEY environment variable only. No default paid provider.
`;
function parse(argv) {
  const [command,...args]=argv, flags={}, positional=[];
  const allowed=command==='generate'?['out','id','provider','model','endpoint','timeout-ms']:command==='brief'?['out']:[];
  for(let i=0;i<args.length;i++) {
    const token=args[i];
    if(!token.startsWith('--')) {positional.push(token);continue;}
    const name=token.slice(2);
    if(!allowed.includes(name)||Object.hasOwn(flags,name)||!args[i+1]||args[i+1].startsWith('--')) throw new Error('Invalid command arguments.');
    flags[name]=args[++i];
  }
  return {command,flags,positional};
}
export async function runCli(argv,{briefs,prosePath=proseDefault,stdout=text=>process.stdout.write(text),env=process.env,fetchImpl}={}) {
  if(!argv.length || ['help','--help','-h'].includes(argv[0])) {stdout(help);return;}
  const {command,flags,positional}=parse(argv);
  if(!['brief','generate','preview','accept'].includes(command)) throw new Error('Unknown command.');
  if((['brief','generate'].includes(command)&&positional.length)||(['preview','accept'].includes(command)&&positional.length!==1)) throw new Error('Invalid command arguments.');
  const catalog=validateBriefs(briefs??(await import('../src/game/cultivation/v3/content.js')).AUTHORING_BRIEFS);
  if(command==='brief') {
    const text=`${JSON.stringify({version:1,briefHash:hashBriefs(catalog),briefs:catalog},null,2)}\n`;
    if(flags.out) {if(!flags.out.endsWith('.json'))throw new Error('Brief output must be JSON.');await atomicWrite(flags.out,text);stdout('Brief catalog written.\n');}else stdout(text);
  }else if(command==='generate') {
    if(!flags.out) throw new Error('Generate requires --out candidate.json.');
    const config=readConfig(env,{provider:flags.provider,model:flags.model,endpoint:flags.endpoint,timeoutMs:flags['timeout-ms']});
    const candidate=await generateToFile(catalog,config,flags.out,{fetchImpl,...(flags.id?{ids:[flags.id]}:{})});
    stdout(`Candidate written. Provider: ${candidate.generation.provider}; model: ${candidate.generation.model}; status: ${candidate.generation.status}. Run preview, then accept explicitly.\n`);
  }else {
    const candidate=await readJsonFile(positional[0]);
    if(command==='preview')stdout(previewCandidate(candidate,catalog));
    else {const count=await acceptCandidate(candidate,catalog,prosePath);stdout(`Accepted ${count} prose passage(s). Rebuild the offline game to include them.\n`);}
  }
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  runCli(process.argv.slice(2)).catch(()=>{process.stderr.write('Story authoring failed. Check command arguments, current briefs, candidate schema, and local provider configuration. Existing accepted prose was not changed unless accept completed successfully.\n');process.exitCode=1;});
}
