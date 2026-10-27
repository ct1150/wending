import { cp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const identifier = /^[A-Za-z_$][\w$]*$/;

// A deliberately limited lexer, not a general JavaScript transpiler. Opaque
// strings/comments/templates/regexes keep module keywords in prose untouched.
function tokens(source) {
  const result = [];
  let i = 0;
  let previous = '';
  const regexAfter = new Set(['', '=', '(', '[', '{', ',', ':', ';', '!', '?', 'return', 'throw', '=>', '&&', '||', '??']);
  function quoted(start) {
    const quote = source[start]; let end = start + 1;
    while (end < source.length) {
      if (source[end] === '\\') { end += 2; continue; }
      if (source[end] === quote) return end + 1;
      if (quote === '`' && source.startsWith('${', end)) {
        const expressionStart = end + 2; end = expression(expressionStart);
        if (tokens(source.slice(expressionStart, end - 1)).some(token => !token.literal && token.value === 'import')) throw new Error('Dynamic imports/import.meta are unsupported, including template expressions');
        continue;
      }
      end++;
    }
    throw new Error('Unclosed string/template');
  }
  function expression(start) {
    let end = start; let braces = 1;
    while (end < source.length) {
      const char = source[end];
      if (char === '"' || char === "'" || char === '`') { end = quoted(end); continue; }
      if (source.startsWith('//', end)) { const next = source.indexOf('\n', end); end = next < 0 ? source.length : next; continue; }
      if (source.startsWith('/*', end)) { const next = source.indexOf('*/', end + 2); if (next < 0) throw new Error('Unclosed comment'); end = next + 2; continue; }
      if (char === '{') braces++;
      if (char === '}') { braces--; if (braces === 0) return end + 1; }
      end++;
    }
    throw new Error('Unclosed template expression');
  }
  while (i < source.length) {
    const start = i;
    const c = source[i];
    if (/\s/.test(c)) { i++; continue; }
    if (source.startsWith('//', i)) { i = source.indexOf('\n', i); if (i < 0) break; continue; }
    if (source.startsWith('/*', i)) { const end = source.indexOf('*/', i + 2); if (end < 0) throw new Error('Unclosed comment'); i = end + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      i = quoted(i);
      result.push({ value: source.slice(start, i), start, end: i, literal: true });
      previous = 'literal'; continue;
    }
    if (c === '/' && regexAfter.has(previous)) {
      i++; let bracket = false;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === '[') bracket = true;
        if (source[i] === ']') bracket = false;
        if (source[i] === '/' && !bracket) { i++; break; }
        i++;
      }
      while (/[a-z]/i.test(source[i] || '0')) i++;
      result.push({ value: source.slice(start, i), start, end: i, literal: true });
      previous = 'literal'; continue;
    }
    const word = source.slice(i).match(/^[A-Za-z_$][\w$]*/);
    const op = source.slice(i).match(/^(?:=>|&&|\|\||\?\?)/);
    const value = word?.[0] || op?.[0] || c;
    i += value.length;
    result.push({ value, start, end: i, literal: false }); previous = value;
  }
  return result;
}

function parseNames(text, file) {
  if (!text.trim()) return [];
  return text.split(',').filter(part => part.trim()).map(part => {
    const match = part.trim().match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
    if (!match) throw new Error(`${file}: unsupported named import/export: ${part.trim()}`);
    return { name: match[1], alias: match[2] || match[1] };
  });
}

export function parseModule(source, file = 'module.js') {
  const ts = tokens(source); const imports = []; const exports = []; const edits = [];
  const mutable = new Set();
  let depth = 0;
  const addExport = (name, local = name) => {
    if (exports.some(item => item.name === name)) throw new Error(`${file}: duplicate export ${name}`);
    exports.push({ name, local });
  };
  for (let i = 0; i < ts.length; i++) {
    const token = ts[i]; const value = token.value;
    if (token.literal) continue;
    if (!depth && (value === 'let' || value === 'var')) {
      let nested = 0; let expectName = true;
      for (let j = i + 1; j < ts.length; j++) {
        const item = ts[j]; if (item.literal) continue;
        if (expectName) {
          if (!identifier.test(item.value)) throw new Error(`${file}: top-level mutable destructuring is unsupported by the offline bundler`);
          mutable.add(item.value); expectName = false; continue;
        }
        if (['(', '[', '{'].includes(item.value)) nested++;
        if ([')', ']', '}'].includes(item.value)) nested--;
        if (!nested && item.value === ',') expectName = true;
        if (!nested && item.value === ';') break;
      }
    }
    if (value === 'import') {
      if (depth || ts[i + 1]?.value !== '{') throw new Error(`${file}: only static named imports are supported (no dynamic/default/namespace/import.meta)`);
      const endIndex = ts.findIndex((t, index) => index > i && t.value === ';' && !t.literal);
      if (endIndex < 0) throw new Error(`${file}: import must end with a semicolon`);
      const statement = source.slice(token.start, ts[endIndex].end);
      const match = statement.match(/^import\s*\{([\s\S]*?)\}\s*from\s*(['"])([^'"\n]+)\2\s*;$/);
      if (!match) throw new Error(`${file}: unsupported import form`);
      imports.push({ from: match[3], names: parseNames(match[1], file) });
      edits.push({ start: token.start, end: ts[endIndex].end, text: '' }); i = endIndex; continue;
    }
    if (value === 'export') {
      if (depth) throw new Error(`${file}: nested export is invalid`);
      const next = ts[i + 1]?.value;
      if (next === '{') {
        const endIndex = ts.findIndex((t, index) => index > i && t.value === ';' && !t.literal);
        if (endIndex < 0) throw new Error(`${file}: export list must end with a semicolon`);
        const match = source.slice(token.start, ts[endIndex].end).match(/^export\s*\{([\s\S]*?)\}\s*;$/);
        if (!match) throw new Error(`${file}: re-exports are unsupported; import then export by name`);
        for (const item of parseNames(match[1], file)) addExport(item.alias, item.name);
        edits.push({ start: token.start, end: ts[endIndex].end, text: '' }); i = endIndex; continue;
      }
      let declaration = i + 1;
      if (next === 'async') declaration++;
      if (['function', 'class'].includes(ts[declaration]?.value)) {
        if (ts[declaration + 1]?.value === '*') declaration++;
        const name = ts[declaration + 1]?.value;
        if (!identifier.test(name || '')) throw new Error(`${file}: exported declarations must be named`);
        addExport(name);
      } else if (next === 'const') {
        let nested = 0; let expectName = true;
        for (let j = i + 2; j < ts.length; j++) {
          const t = ts[j]; if (t.literal) continue;
          if (expectName) {
            if (!identifier.test(t.value)) throw new Error(`${file}: exported destructuring is unsupported`);
            addExport(t.value); expectName = false; continue;
          }
          if (['(', '[', '{'].includes(t.value)) nested++;
          if ([')', ']', '}'].includes(t.value)) nested--;
          if (!nested && t.value === ',') expectName = true;
          if (!nested && t.value === ';') break;
        }
      } else throw new Error(`${file}: only named const/function/class exports and export lists are supported; mutable/default/star exports are unsupported`);
      edits.push({ start: token.start, end: token.end, text: '' });
    }
    if (value === 'await' && depth === 0) throw new Error(`${file}: top-level await is unsupported`);
    if (value === '{') depth++;
    if (value === '}') depth--;
  }
  let code = source;
  for (const item of exports) if (mutable.has(item.local)) throw new Error(`${file}: mutable export ${item.local} is unsupported`);
  for (const edit of edits.sort((a, b) => b.start - a.start)) code = code.slice(0, edit.start) + edit.text + code.slice(edit.end);
  return { code, imports, exports };
}

export async function safeLocalFile(root, from, reference) {
  if (/^(?:[a-z]+:|\/\/|\/|#)/i.test(reference) || reference.includes('?') || reference.includes('#')) throw new Error(`Expected plain relative asset path: ${reference}`);
  const resolved = path.resolve(path.dirname(from), reference);
  const rootReal = await realpath(root); const fileReal = await realpath(resolved);
  if (fileReal !== rootReal && !fileReal.startsWith(rootReal + path.sep)) throw new Error(`Path escapes project: ${reference}`);
  return fileReal;
}

async function inlineSvgReferences(source, file, root) {
  const matches = [...source.matchAll(/(['"])((?:\.\.?\/)?(?:assets\/)?[\w./-]+\.svg)\1/g)];
  for (const match of matches.reverse()) {
    // URLs assigned to DOM attributes resolve against the document, whereas
    // module specifiers/CSS URLs resolve against their own source file.
    const relativeTo = /^(?:\.\/)?assets\//.test(match[2]) ? path.join(root, 'index.html') : file;
    const asset = await safeLocalFile(root, relativeTo, match[2]);
    const data = 'data:image/svg+xml;base64,' + (await readFile(asset)).toString('base64');
    source = source.slice(0, match.index) + match[1] + data + match[1] + source.slice(match.index + match[0].length);
  }
  return source;
}

export async function bundleModules(root, entry) {
  const modules = new Map(); const visiting = new Set(); const order = [];
  async function visit(file) {
    if (file === path.resolve(root, 'src/worker') || file.startsWith(path.resolve(root, 'src/worker') + path.sep)) throw new Error('Server worker modules cannot enter browser outputs');
    if (visiting.has(file)) throw new Error(`Circular imports are unsupported: ${path.relative(root, file)}`);
    if (modules.has(file)) return;
    visiting.add(file);
    const parsed = parseModule(await readFile(file, 'utf8'), path.relative(root, file));
    parsed.dependencies = [];
    for (const imported of parsed.imports) {
      if (!imported.from.startsWith('./') && !imported.from.startsWith('../')) throw new Error(`${file}: external/bare imports are unsupported`);
      const dependency = await safeLocalFile(root, file, imported.from);
      if (!dependency.endsWith('.js')) throw new Error(`${file}: only .js module imports are supported`);
      await visit(dependency);
      for (const { name } of imported.names) if (!modules.get(dependency).exports.some(item => item.name === name)) throw new Error(`${file}: missing export ${name} in ${imported.from}`);
      parsed.dependencies.push(dependency);
    }
    parsed.code = await inlineSvgReferences(parsed.code, file, root);
    visiting.delete(file); modules.set(file, parsed); order.push(file);
  }
  await visit(await safeLocalFile(root, path.join(root, 'index.html'), entry));
  const ids = new Map(order.map((file, index) => [file, index]));
  return `(() => {\n'use strict';\nconst __bwModules = [];\n` + order.map(file => {
    const module = modules.get(file);
    const imports = module.imports.map((item, index) => `const { ${item.names.map(({ name, alias }) => `${name}: ${alias}`).join(', ')} } = __bwModules[${ids.get(module.dependencies[index])}];`).join('\n');
    const getters = module.exports.map(({ name, local }) => `${JSON.stringify(name)}: { enumerable: true, get: () => ${local} }`).join(',\n');
    return `// ${path.relative(root, file).replaceAll('\\', '/')}\n__bwModules[${ids.get(file)}] = (() => {\n${imports}\n${module.code}\nreturn Object.defineProperties(Object.create(null), {${getters}});\n})();`;
  }).join('\n') + '\n})();\n';
}

async function inlineCss(css, file, root) {
  if (/@import\b/i.test(css)) throw new Error(`${file}: CSS @import is unsupported in the offline build`);
  const matches = [...css.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g)];
  for (const match of matches.reverse()) {
    if (match[2].startsWith('data:') || match[2].startsWith('#')) continue;
    const asset = await safeLocalFile(root, file, match[2]);
    const types = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
    const type = types[path.extname(asset)]; if (!type) throw new Error(`Unsupported CSS asset: ${asset}`);
    const replacement = `url("data:${type};base64,${(await readFile(asset)).toString('base64')}")`;
    css = css.slice(0, match.index) + replacement + css.slice(match.index + match[0].length);
  }
  return css;
}

export async function build(root = projectRoot) {
  const htmlFile = path.join(root, 'index.html'); let html = await readFile(htmlFile, 'utf8');
  const scriptMatches = [...html.matchAll(/<script\b([^>]*)\bsrc\s*=\s*(['"])([^'"]+)\2([^>]*)>\s*<\/script>/gi)];
  if (scriptMatches.length !== 1 || !/\btype\s*=\s*['"]module['"]/i.test(scriptMatches[0][1] + scriptMatches[0][4])) throw new Error('index.html must contain exactly one external module entry script');
  const bundle = await bundleModules(root, scriptMatches[0][3]);
  html = html.replace(scriptMatches[0][0], () => `<script>\n${bundle.replace(/<\/script/gi, '<\\/script')}<\/script>`);
  const links = [...html.matchAll(/<link\b[^>]*>/gi)];
  for (const [tag] of links) {
    if (!/\brel\s*=\s*['"]stylesheet['"]/i.test(tag)) continue;
    const href = tag.match(/\bhref\s*=\s*(['"])([^'"]+)\1/i)?.[2];
    if (!href) throw new Error('Stylesheet link has no href');
    const cssFile = await safeLocalFile(root, htmlFile, href);
    const css = await inlineCss(await readFile(cssFile, 'utf8'), cssFile, root);
    html = html.replace(tag, () => `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`);
  }
  html = await inlineSvgReferences(html, htmlFile, root);
  const dist = path.join(root, 'dist'); const release = path.join(root, 'release');
  await rm(dist, { recursive: true, force: true }); await rm(release, { recursive: true, force: true });
  await mkdir(dist, { recursive: true }); await mkdir(release, { recursive: true });
  await cp(htmlFile, path.join(dist, 'index.html'));
  for (const directory of ['src', 'assets']) await cp(path.join(root, directory), path.join(dist, directory), { recursive: true, filter: source => source !== path.join(root, 'src/worker') });
  await writeFile(path.join(dist, '.nojekyll'), '');
  const filename = 'baishi-wending-offline.html';
  await writeFile(path.join(release, filename), html); await writeFile(path.join(dist, filename), html);
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const metadata = { name: pkg.name, version: pkg.version, builtAt: new Date().toISOString(), offline: { file: filename, bytes: Buffer.byteLength(html), sha256: createHash('sha256').update(html).digest('hex') }, staticDirectory: 'dist', runtimeDependencies: 0 };
  await writeFile(path.join(release, 'release.json'), JSON.stringify(metadata, null, 2) + '\n');
  return metadata;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().then(meta => console.log(`Built dist/ and release/${meta.offline.file} (${meta.offline.bytes} bytes)`)).catch(error => { console.error(`Build failed: ${error.message}`); process.exitCode = 1; });
}
