import { test, describe, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Card, makeCard, makeHass, api, alert, items, content, settle, cleanup, window, document } from './helpers/env.mjs';

afterEach(() => { mock.restoreAll(); mock.timers.reset(); cleanup(); });
const quiet = () => { for (const m of ['log', 'warn', 'error']) mock.method(console, m, () => {}); };

describe('registration and config', () => {
  test('defines the card and a card picker entry', () => {
    assert.ok(Card);
    assert.equal(window.customCards.find((c) => c.type === 'nws-alert-card').preview, true);
  });

  test('setConfig needs a zone or both coordinates', () => {
    assert.throws(() => document.createElement('nws-alert-card').setConfig({ latitude: 1 }), /nws_zone/);
  });

  test('documented defaults', async () => {
    quiet();
    api.alerts('WAZ558', []);
    const card = await makeCard({ nws_zone: 'WAZ558' });
    const c = card._config;
    assert.deepEqual([c.title, c.update_interval, c.email, c.show_severity_markers, c.show_expanded, c.alert_trigger_cooldown],
      ['NWS Weather Alert', 300, 'homeassistant@example.com', true, false, 60]);
    assert.match(content(card).textContent, /No active alerts at this time/);
  });
});

describe('rendering', () => {
  test('renders an alert with severity class, marker and times', async () => {
    quiet();
    api.alerts('WAZ558', [alert({ event: 'High Wind Warning', severity: 'Severe' })]);
    const card = await makeCard({ nws_zone: 'WAZ558' });
    const [item] = items(card);
    assert.equal(item.classList.contains('severity-Severe'), true);
    assert.match(item.querySelector('h3').textContent, /High Wind Warning/);
    assert.equal(item.querySelectorAll('.danger-marker').length, 1);
  });

  // D6 (B11): escapeHtml does not encode quotes; alert id and severity are raw
  test('API values cannot add attributes', async () => {
    quiet();
    const evil = 'x" onmouseover="alert(1)';
    api.alerts('WAZ558', [alert({ severity: evil, event: 'E', description: 'd'.repeat(300), uri: `https://a/${evil}` }, `id${evil}`)]);
    const card = await makeCard({ nws_zone: 'WAZ558' });
    assert.equal(card.shadowRoot.querySelectorAll('[onmouseover]').length, 0, 'injected attribute was rendered');
    assert.equal(items(card)[0].classList.contains('severity-Unknown'), true);
  });

  test('focus stays on the toggle after it re-renders the card', async () => {
    quiet();
    api.alerts('WAZ558', [alert({ description: 'd'.repeat(300) }, 'https://api.weather.gov/alerts/a"b')]);
    const card = await makeCard({ nws_zone: 'WAZ558' });
    const toggle = card.shadowRoot.querySelector('.toggle');
    toggle.focus();
    toggle.click();
    const after = card.shadowRoot.activeElement;
    assert.equal(after?.dataset.focusKey, 'toggle-https://api.weather.gov/alerts/a"b');
    assert.equal(after?.getAttribute('aria-expanded'), 'true');
  });
});

describe('location', () => {
  // N3 (B6/B7): the editor's text field stores coordinates as strings
  test('numeric coordinates given as strings are used as numbers', { todo: 'a string is always treated as an entity ID' }, async () => {
    quiet();
    api.point(47.6062, -122.3321, 'WAZ558').alerts('WAZ558', []);
    const card = await makeCard({ latitude: '47.6062', longitude: '-122.3321' }, makeHass());
    assert.equal(card._zoneResolver.currentZone, 'WAZ558');
  });

  // N2 (B8): README says nws_zone is the fallback when coordinates fail to resolve
  test('a failed Points lookup falls back to nws_zone', { todo: 'only an unresolvable coordinate falls back; a failed Points API call returns null' }, async () => {
    quiet();
    api.on('/points/47.6062,-122.3321', () => ({ status: 500 })).alerts('COZ097', []);
    const card = await makeCard({ latitude: 47.6062, longitude: -122.3321, nws_zone: 'COZ097' });
    assert.equal(card._zoneResolver.currentZone, 'COZ097');
  });

  // N8 (B8): nws_zone is used in the API path as typed
  test('nws_zone is trimmed and upper-cased', { todo: 'nws_zone is not normalized or validated' }, async () => {
    quiet();
    api.alerts('WAZ558', []);
    const card = await makeCard({ nws_zone: ' waz558 ' });
    assert.equal(card._zoneResolver.currentZone, 'WAZ558');
  });
});

describe('polling', () => {
  // N4 (B5): update_interval 0 / negative / non-number polls without delay
  test('an invalid update_interval does not poll continuously', { todo: 'setInterval(fn, 0) for 0, negative or NaN' }, async () => {
    quiet();
    mock.timers.enable({ apis: ['setInterval'] });
    api.alerts('WAZ558', []);
    for (const update_interval of [0, -5, '5m']) {
      const card = document.createElement('nws-alert-card');
      card.setConfig({ nws_zone: 'WAZ558', update_interval });
      assert.ok(card._config.update_interval >= 60, `update_interval ${update_interval} -> ${card._config.update_interval}`);
      card.disconnectedCallback();
    }
  });
});

describe('setConfig on an existing card', () => {
  // N10 (B8): HA calls setConfig on the dashboard card when an edit is saved
  test('a new zone and title take effect without a reload', { todo: 'zone is resolved only in connectedCallback; unchanged alerts skip the re-render' }, async () => {
    quiet();
    api.alerts('WAZ558', [alert()]).alerts('COZ097', []);
    const card = await makeCard({ nws_zone: 'WAZ558', title: 'Old' });
    card.setConfig({ nws_zone: 'COZ097', title: 'New' });
    await settle();
    assert.equal(card._zoneResolver.currentZone, 'COZ097');
    assert.match(content(card).querySelector('.card-title').textContent, /New/);
  });
});

describe('action triggers', () => {
  // N1 (B8): README: "No action when alerts are removed or severity decreases"
  test('removing one of several alerts does not trigger an action', { todo: 'any change in the alert ID set triggers' }, async () => {
    quiet();
    const a = alert({ severity: 'Moderate' });
    const b = alert({ severity: 'Moderate' });
    let features = [a, b];
    api.on('/alerts/active/zone/WAZ558', () => ({ status: 200, body: { features } }));
    const hass = makeHass();
    const card = await makeCard({ nws_zone: 'WAZ558', moderate_action: 'script.x', alert_trigger_cooldown: 0 }, hass);
    assert.equal(hass.calls.length, 1);
    features = [a];
    await card._fetchAlerts();
    await settle();
    assert.equal(hass.calls.length, 1);
  });
});
