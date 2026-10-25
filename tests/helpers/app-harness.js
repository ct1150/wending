import vm from 'node:vm';
import { bundleModules } from '../../scripts/build.js';

// A deliberately small DOM adapter for functional controller tests. It does not
// calculate layout, paint, start a server, or provide browser/visual evidence.
export async function startApp({ raw = null, denyWrite = false, denyRead = false, legacyBackupRaw = null } = {}) {
  const listeners = new Map(), elements = new Map(), downloads = [], focus = [], scroll = [];
  const extras=new Map(legacyBackupRaw === null ? [] : [['baishi-wending-save-v1-legacy-handoff',legacyBackupRaw]]);
  const storage = { raw, writes: 0, getItem(key) { if (denyRead) throw new Error('read denied'); return key === 'baishi-wending-save-v1' ? this.raw : extras.get(key) ?? null; }, setItem(key, value) { if (denyWrite) throw new Error('quota'); if(key === 'baishi-wending-save-v1') this.raw = value; else extras.set(key,value); this.writes++; } };
  const make = selector => ({ innerHTML: '', textContent: '', className: '', dataset: {}, open: false, value: '',
    classList: { remove() {} }, addEventListener(type, callback) { listeners.set(`${selector}:${type}`, callback); },
    focus() { focus.push(selector); }, scrollIntoView() { scroll.push(selector); }, showModal() { this.open = true; }, close() { this.open = false; },
    click() {}, remove() {}, getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100 }; },
  });
  for (const selector of ['#app', '#toast', '#dialog', '#import-file']) elements.set(selector, make(selector));
  const document = { activeElement: null, body: { appendChild() {} },
    querySelector(selector) {
      if (elements.has(selector)) return elements.get(selector);
      const id = selector.startsWith('#') ? selector.slice(1) : null;
      if (id && [elements.get('#app'), elements.get('#dialog')].some(element => element.innerHTML.includes(`id="${id}"`))) return make(selector);
      return null;
    },
    getElementById(id) { return this.querySelector(`#${id}`); }, querySelectorAll() { return []; },
    addEventListener(type, callback) { listeners.set(type, callback); }, createElement() { const link = make('a'); link.click = () => downloads.push(link); return link; },
  };
  const code = await bundleModules(process.cwd(), './src/app.js');
  const context = { document, window: { localStorage: storage, crypto: { getRandomValues(array) { array[0] = 20261025; return array; } }, location: { protocol: 'file:' }, scrollTo(value) { scroll.push(value); } },
    Uint32Array, Blob, URL: { createObjectURL(blob) { downloads.push(blob); return 'blob:test'; }, revokeObjectURL() {} }, setTimeout() {}, clearTimeout() {} };
  // Saved game data is JSON; clone within the VM realm so strict plain-record
  // validation sees the same Object prototype as the bundled engine.
  vm.runInNewContext('globalThis.structuredClone = value => JSON.parse(JSON.stringify(value));\n' + code, context);
  return { storage, focus, scroll, downloads, get html() { return elements.get('#app').innerHTML; }, get dialog() { return elements.get('#dialog'); },
    click(dataset) { const target = { dataset, disabled: false }; target.closest = () => target; listeners.get('click')({ target }); },
    async import(raw) { await listeners.get('#import-file:change')({ target: { files: [{ size: new Blob([raw]).size, async text() { return raw; } }], value: '' } }); },
    get toast() { return elements.get('#toast').textContent; },
  };
}
