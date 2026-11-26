// Test environment for nws-alert-card.js.
//
// The tests load the card file itself (the exact file Home Assistant loads) into a
// happy-dom window. happy-dom is a dev-only dependency: it gives the card a real DOM
// (shadow roots, innerHTML, querySelector, composed events) without a browser.
//
// NO NETWORK: globalThis.fetch is replaced by `api`, a fake that answers only the
// routes a test registers and throws on anything else, so no test can reach
// api.weather.gov.
//
// IMPORTANT: never pass a DOM node to assert. A failing assertion inspects the node,
// which walks the whole happy-dom window without end (see tests/README.md).

import { createRequire } from 'node:module';

// Fixed timezone so formatted alert times are deterministic
process.env.TZ = 'UTC';
import { Window } from 'happy-dom';

export const window = new Window({
  url: 'http://localhost:8123/lovelace/0',
  settings: {
    disableJavaScriptEvaluation: true,
    disableJavaScriptFileLoading: true,
    disableCSSFileLoading: true,
    disableIframePageLoading: true,
    handleDisabledFileLoadingAsSuccess: true,
  },
});

for (const key of ['document', 'HTMLElement', 'customElements', 'CustomEvent', 'Event', 'CSS', 'localStorage']) {
  globalThis[key] = window[key];
}
globalThis.window = window;

// The card reads navigator.userAgent for mobile detection; tests set it per case
export const device = { userAgent: 'Mozilla/5.0 (Macintosh) desktop', innerWidth: 1280 };
Object.defineProperty(globalThis, 'navigator', { configurable: true, get: () => ({ userAgent: device.userAgent }) });
Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => device.innerWidth });

// The card starts a polling interval in setConfig. Unref'd timers cannot keep the test
// process alive; tests that need timing use node:test mock.timers on top of these.
const realSetInterval = globalThis.setInterval;
const realSetTimeout = globalThis.setTimeout;
globalThis.setInterval = (...a) => { const t = realSetInterval(...a); t.unref?.(); return t; };
globalThis.setTimeout = (...a) => { const t = realSetTimeout(...a); t.unref?.(); return t; };

// happy-dom's CSS.supports returns true for any value. Stand-in for ('color', value).
// window.CSS returns a new object on each access, so patch the global the card reads.
const NAMED_COLORS = new Set(['red', 'green', 'blue', 'black', 'white', 'gray', 'orange', 'transparent']);
globalThis.CSS.supports = (property, value) => {
  if (property !== 'color') throw new Error(`CSS.supports stand-in only handles 'color', got '${property}'`);
  const v = String(value).trim().toLowerCase();
  return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v) || /^(rgb|rgba|hsl|hsla|var)\(.+\)$/.test(v) || NAMED_COLORS.has(v);
};

// --- fake NWS API ---

const API = 'https://api.weather.gov';
export const api = {
  routes: new Map(),   // path -> () => { status, body } or Error to throw
  requests: [],        // { url, headers }
  reset() { this.routes.clear(); this.requests.length = 0; },
  on(path, handler) { this.routes.set(path, handler); return this; },
  alerts(zone, features) { return this.on(`/alerts/active/zone/${zone}`, () => ({ status: 200, body: { features } })); },
  point(lat, lon, zone) { return this.on(`/points/${lat},${lon}`, () => ({ status: 200, body: { properties: { forecastZone: `${API}/zones/forecast/${zone}` } } })); },
  zoneName(zone, name) { return this.on(`/zones/forecast/${zone}`, () => ({ status: 200, body: { properties: { name } } })); },
  count(pathPart) { return this.requests.filter((r) => r.url.includes(pathPart)).length; },
};
globalThis.fetch = async (url, options = {}) => {
  api.requests.push({ url, headers: options.headers });
  if (!String(url).startsWith(API)) throw new Error(`test fetch: refusing non-NWS URL ${url}`);
  const route = api.routes.get(String(url).slice(API.length));
  if (!route) throw new Error(`test fetch: no route for ${url}`);
  const result = route();
  if (result instanceof Error) throw result;
  return { ok: result.status >= 200 && result.status < 300, status: result.status, statusText: result.statusText ?? '', json: async () => result.body };
};

const require = createRequire(import.meta.url);
require('../../nws-alert-card.js');

export const document = window.document;
export const Card = window.customElements.get('nws-alert-card');
export const Editor = window.customElements.get('nws-alert-card-editor');

// --- fixtures ---

let alertSeq = 0;
export function alert(props = {}, id = `${API}/alerts/urn:oid:test.${++alertSeq}`) {
  return {
    id,
    properties: {
      event: 'Wind Advisory', severity: 'Minor', urgency: 'Expected', certainty: 'Likely',
      onset: '2026-01-15T12:00:00Z', expires: '2026-01-15T18:00:00Z',
      description: 'Gusty winds.', uri: `${id}`, ...props,
    },
  };
}

export function makeHass(states = {}) {
  const calls = [];
  return {
    states, calls,
    callService: async (domain, service, data) => { calls.push({ domain, service, data }); },
  };
}

// Let pending promises and zero-delay work settle
export const settle = async (rounds = 5) => { for (let i = 0; i < rounds; i++) await new Promise((r) => setImmediate(r)); };

const cards = [];
// A card with config (and hass) attached to the document, after its first fetch settles
export async function makeCard(config, hass) {
  const card = document.createElement('nws-alert-card');
  cards.push(card);
  if (hass) card.hass = hass;
  card.setConfig(config);
  document.body.appendChild(card);
  await settle();
  return card;
}

export const content = (card) => card.shadowRoot.querySelector('ha-card');
export const items = (card) => [...card.shadowRoot.querySelectorAll('.alert-item')];

export async function makeEditor(config = {}, hass = makeHass()) {
  const editor = document.createElement('nws-alert-card-editor');
  const changes = [];
  editor.addEventListener('config-changed', (e) => changes.push(structuredClone(e.detail.config)));
  editor.changes = changes;
  editor.hass = hass;
  editor.setConfig(config);
  document.body.appendChild(editor);
  return editor;
}
export const lastConfig = (editor) => editor.changes.at(-1);

export function fireValue(el, value) {
  el.dispatchEvent(new window.CustomEvent('value-changed', { detail: { value }, bubbles: true, composed: true }));
}

export function control(editor, label) {
  const root = editor.shadowRoot;
  const sel = [...root.querySelectorAll('ha-selector')].find((s) => s.label === label);
  if (sel) return sel;
  const sw = root.querySelector(`ha-switch[aria-label="${label}"]`);
  if (sw) return sw;
  throw new Error(`no editor control labelled "${label}"`);
}

export function cleanup() {
  for (const card of cards.splice(0)) card.disconnectedCallback();
  document.body.innerHTML = '';
  api.reset();
  localStorage.clear();
  device.userAgent = 'Mozilla/5.0 (Macintosh) desktop';
  device.innerWidth = 1280;
}
