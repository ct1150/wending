import vm from 'node:vm';
import { bundleModules } from '../../scripts/build.js';

// CSSOM identifier escaping for the browser global used by controller code.
function escapeCssIdentifier(value) {
  const text = String(value);
  let escaped = '';
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index), character = text[index];
    if (code === 0) escaped += '\ufffd';
    else if (code < 32 || code === 127 || code >= 48 && code <= 57 && (index === 0 || index === 1 && text[0] === '-')) escaped += '\\' + code.toString(16) + ' ';
    else if (code >= 128 || /[A-Za-z0-9_-]/.test(character) && !(text.length === 1 && character === '-')) escaped += character;
    else escaped += '\\' + character;
  }
  return escaped;
}

// A deliberately small DOM adapter for functional controller tests. It does not
// calculate layout, paint, start a server, or provide browser/visual evidence.
export async function startApp({ raw = null, denyWrite = false, denyRead = false, legacyBackupRaw = null, navigation = null, navigationType = 'navigate', sessionValues = null, autoEnter = true } = {}) {
  const listeners = new Map(), elements = new Map(), dynamic = new Map(), downloads = [], focus = [], scroll = [];
  const extras=new Map(legacyBackupRaw === null ? [] : [['baishi-wending-save-v1-legacy-handoff',legacyBackupRaw]]);
  const writeDenied = (key, operation) => typeof denyWrite === 'function' ? denyWrite(key, operation) : denyWrite;
  // Navigation/preferences use independent keys; gameplay assertions count main-save writes.
  const storage = { raw, writes: 0, totalWrites: 0, writeCounts: new Map(), getItem(key) { if (denyRead) throw new Error('read denied'); return key === 'baishi-wending-save-v1' ? this.raw : extras.get(key) ?? null; }, setItem(key, value) { if (writeDenied(key, 'setItem')) throw new Error('quota'); if(key === 'baishi-wending-save-v1') { this.raw = value; this.writes++; } else extras.set(key,value); this.totalWrites++; this.writeCounts.set(key, (this.writeCounts.get(key) ?? 0) + 1); }, removeItem(key) { if (writeDenied(key, 'removeItem')) throw new Error('quota'); if (key === 'baishi-wending-save-v1') this.raw = null; else extras.delete(key); } };
  const make = selector => ({ innerHTML: '', textContent: '', className: '', dataset: {}, open: false, value: '', isConnected: true,
    localName: selector.match(/^[a-z][a-z0-9-]*/i)?.[0].toLowerCase() ?? 'button',
    get attributes() {
      return [...(this.id ? [{ name: 'id', value: this.id }] : []), ...Object.entries(this.dataset).map(([key, value]) => ({ name: 'data-' + key.replace(/[A-Z]/g, character => '-' + character.toLowerCase()), value: String(value) }))];
    },
    classList: { remove() {} }, addEventListener(type, callback) { listeners.set(`${selector}:${type}`, callback); },
    getAttribute(name) { if (name.startsWith('data-')) return this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] ?? null; return name === 'id' ? this.id ?? null : null; },
    hasAttribute(name) { return this.getAttribute(name) !== null; },
    matches(selectorList) {
      return selectorList.split(',').some(part => {
        const selector = part.trim();
        if (selector === ':disabled') return this.disabled === true;
        const attribute = selector.match(/^\[([\w-]+)\]$/);
        if (attribute) return this.hasAttribute(attribute[1]);
        throw new Error('Unsupported DOM adapter selector: ' + selector);
      });
    },
    focus() { document.activeElement = this; focus.push(selector); }, scrollIntoView() { scroll.push(selector); }, showModal() { this.open = true; }, close() { this.open = false; listeners.get(`${selector}:close`)?.({ target: this }); },
    click() {}, remove() {}, getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100 }; },
  });
  for (const selector of ['#app', '#toast', '#dialog', '#import-file']) elements.set(selector, make(selector));
  const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  let lastMarkup = '';
  const document = { activeElement: null, documentElement: { dataset: {} }, body: { appendChild() {} },
    querySelector(selector) {
      if (elements.has(selector)) return elements.get(selector);
      const markup = elements.get('#app').innerHTML + elements.get('#dialog').innerHTML;
      if (lastMarkup !== markup) { dynamic.clear(); lastMarkup = markup; }
      if (dynamic.has(selector)) return dynamic.get(selector);
      const id = selector.startsWith('#') ? selector.slice(1) : null;
      const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
      const tag = [...markup.matchAll(/<[a-z][^>]*>/gi)].map(match => match[0]).find(value => id ? value.includes(`id="${id}"`) : attribute && (attribute[2] === undefined ? new RegExp(`\\s${attribute[1]}(?:[\\s=>])`).test(value) : value.includes(`${attribute[1]}="${attribute[2]}"`)));
      if (!tag) return null;
      const element = make(selector);
      element.localName = tag.match(/^<([a-z][a-z0-9-]*)/i)[1].toLowerCase();
      element.id = id ?? tag.match(/\bid="([^"]*)"/)?.[1] ?? '';
      element.value = decode(tag.match(/\bvalue="([^"]*)"/)?.[1] ?? '');
      element.disabled = /\sdisabled(?:[\s=>])/.test(tag);
      for (const match of tag.matchAll(/\bdata-([\w-]+)(?:="([^"]*)")?/g)) element.dataset[match[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = decode(match[2] ?? '');
      element.closest = () => element;
      dynamic.set(selector, element);
      return element;
    },
    getElementById(id) { return this.querySelector(`#${id}`); },
    querySelectorAll(selector) {
      const result = [];
      const markup = elements.get('#app').innerHTML + elements.get('#dialog').innerHTML;
      for (const part of selector.split(',').map(value => value.trim())) {
        const attribute = part.match(/^\[([^=\]]+)\]$/);
        if (attribute) {
          for (const match of markup.matchAll(/<[a-z][^>]*>/gi)) {
            const value = match[0].match(new RegExp('\\s' + attribute[1] + '(?:="([^"]*)")?(?=[\\s>])'));
            if (value) result.push(this.querySelector(value[1] ? `[${attribute[1]}="${value[1]}"]` : part));
          }
        } else result.push(this.querySelector(part));
      }
      return [...new Set(result.filter(Boolean))];
    },
    addEventListener(type, callback) { listeners.set(type, callback); }, createElement() { const link = make('a'); link.click = () => downloads.push(link); return link; },
  };
  const code = await bundleModules(process.cwd(), './src/app.js');
  const tabValues = new Map(sessionValues instanceof Map ? sessionValues : Object.entries(sessionValues ?? {}));
  if (navigation !== null) tabValues.set('wending-navigation-v1', typeof navigation === 'string' ? navigation : JSON.stringify(navigation));
  const sessionStorage = { getItem(key) { return tabValues.get(key) ?? null; }, setItem(key, value) { tabValues.set(key, value); }, removeItem(key) { tabValues.delete(key); } };
  let uuidCounter = 0;
  const crypto = { randomUUID() { return `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`; }, getRandomValues(array) { array[0] = 20261025; return array; } };
  const context = { crypto, document, window: { localStorage: storage, sessionStorage, performance: { getEntriesByType() { return [{ type: navigationType }]; } }, crypto, location: { protocol: 'file:' }, scrollTo(value) { scroll.push(value); } },
    Uint32Array, TextEncoder, TextDecoder, Blob, CSS: { escape: escapeCssIdentifier }, URL: { createObjectURL(blob) { downloads.push(blob); return 'blob:test'; }, revokeObjectURL() {} }, setTimeout() {}, clearTimeout() {} };
  // Saved game data is JSON; clone within the VM realm so strict plain-record
  // validation sees the same Object prototype as the bundled engine.
  vm.runInNewContext('globalThis.structuredClone = value => JSON.parse(JSON.stringify(value));\n' + code, context);
  // These controller regressions explicitly exercise the retained offline game.
  // Boot still starts at home, and gameplay is entered through its real controls.
  await Promise.resolve();
  if (autoEnter && document.querySelector('[data-title-new]')) {
    const entry = document.querySelector(raw !== null || denyRead ? '[data-title-continue]' : '[data-title-new]');
    if (entry && !entry.disabled) await listeners.get('click')({ target: entry, preventDefault() {} });
    else if (raw !== null || denyRead) {
      const settings = document.querySelector('[data-view="settings"]');
      await listeners.get('click')({ target: settings, preventDefault() {} });
    }
  }
  await Promise.resolve();
  focus.length = 0; scroll.length = 0;
  return { storage, sessionStorage, sessionValues: tabValues, focus, scroll, downloads,
    get navigation() { return JSON.parse(tabValues.get('wending-navigation-v1') ?? 'null'); },
    get html() { return elements.get('#app').innerHTML; }, get dialog() { return elements.get('#dialog'); },
    click(dataset) { const key = Object.keys(dataset)[0].replace(/[A-Z]/g, char => `-${char.toLowerCase()}`); const target = Object.assign(make(`[data-${key}]`), { dataset, disabled: false }); target.closest = () => target; document.activeElement = target; return listeners.get('click')({ target, preventDefault() {} }); },
    clickRendered(selector) { const target = document.querySelector(selector); if (!target) throw new Error(`Missing control: ${selector}`); document.activeElement = target; return listeners.get('click')({ target, preventDefault() {} }); },
    input(id, value, { isComposing = false } = {}) { const target = document.getElementById(id); if (!target) throw new Error(`Missing input: ${id}`); target.value = value; document.activeElement = target; listeners.get('input')({ target, isComposing }); },
    composition(id, type) { const target = document.getElementById(id); listeners.get(type)?.({ target }); },
    submit(id) { listeners.get('submit')?.({ target: document.getElementById(id), preventDefault() {} }); },
    cancelDialog() { let prevented = false; listeners.get('#dialog:cancel')?.({ preventDefault() { prevented = true; } }); if (!prevented) elements.get('#dialog').close(); },
    async import(raw) { await listeners.get('#import-file:change')({ target: { files: [{ size: new Blob([raw]).size, async text() { return raw; } }], value: '' } }); },
    get toast() { return elements.get('#toast').textContent; },
  };
}
