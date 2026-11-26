import { test, describe, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Card, Editor, makeCard, makeHass, api, alert, items, content, settle, cleanup, document, window } from './helpers/env.mjs';

afterEach(() => { mock.restoreAll(); mock.timers.reset(); cleanup(); setHidden(false); });
const quiet = () => { for (const m of ['log', 'warn', 'error']) mock.method(console, m, () => {}); };
let hidden = false;
Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
function setHidden(v) { hidden = v; }
const raw = (card, name) => content(card).style.getPropertyValue(name);

describe('card picker and sizing', () => {
  test('getConfigElement, getStubConfig, getGridOptions, getCardSize', async () => {
    quiet();
    assert.ok(Card.getConfigElement() instanceof Editor);
    assert.deepEqual(Card.getStubConfig(), { nws_zone: 'KSZ007', email: 'homeassistant@example.com', title: 'NWS Weather Alert' });
    api.alerts('WAZ558', Array.from({ length: 9 }, () => alert()));
    const card = await makeCard({ nws_zone: 'WAZ558' });
    assert.deepEqual(card.getGridOptions(), { rows: 3, columns: 12, min_rows: 2, min_columns: 6 });
    assert.equal(card.getCardSize(), 8);
    assert.equal(document.createElement('nws-alert-card').getCardSize(), 2);
  });
});

describe('setConfig validation', () => {
  test('email: lowercased, invalid replaced; bad actions, cooldown, alert_entity, fonts and colors dropped', () => {
    quiet();
    mock.timers.enable({ apis: ['setInterval'] });
    const card = document.createElement('nws-alert-card');
    card.setConfig({
      nws_zone: 'WAZ558', email: ' Me@Example.COM ', minor_action: 'light.x', severe_action: ' script.ok',
      alert_trigger_cooldown: -1, alert_entity: 'sensor.x', title_font_size: 4, meta_font_size: 12,
      zone_color: '', times_color: 7, meta_color: 'gray', mobile_latitude: 1,
    });
    const c = card._config;
    assert.equal(c.email, 'me@example.com');
    assert.deepEqual(['minor_action' in c, c.severe_action, c.alert_trigger_cooldown, 'alert_entity' in c, 'title_font_size' in c, c.meta_font_size, 'zone_color' in c, 'times_color' in c],
      [false, ' script.ok', 60, false, false, 12, false, false]);
    assert.equal(raw(card, '--nws-meta-font-size'), '12px');
    assert.equal(raw(card, '--nws-meta-color'), 'gray');
    assert.equal(raw(card, '--nws-title-font-size'), '');
    card.setConfig({ nws_zone: 'WAZ558', email: 'not-an-email', alert_entity: 'input_text.ok' });
    assert.equal(card._config.email, 'homeassistant@example.com');
    assert.equal(card._config.alert_entity, 'input_text.ok');
    assert.equal(raw(card, '--nws-meta-color'), '');
    card.disconnectedCallback();
  });
});

describe('connect and disconnect', () => {
  test('no resolvable zone shows the configuration error', async () => {
    quiet();
    const card = await makeCard({ latitude: 'sensor.gone', longitude: 'sensor.gone' }, makeHass());
    assert.match(content(card).textContent, /Unable to determine NWS zone/);
  });

  test('a null title renders empty', async () => {
    quiet();
    api.alerts('WAZ558', []);
    const card = await makeCard({ nws_zone: 'WAZ558', title: null });
    assert.equal(content(card).querySelector('.card-title').textContent, '');
  });

  test('disconnect clears the interval, a pending retry and the visibility listener', async () => {
    quiet();
    api.on('/alerts/active/zone/WAZ558', () => ({ status: 500 }));
    const card = await makeCard({ nws_zone: 'WAZ558' });
    assert.ok(card._retryTimeout && card._visibilityHandler && card._interval);
    card.disconnectedCallback();
    assert.deepEqual([card._retryTimeout, card._visibilityHandler, card._interval], [null, null, null]);
  });

  test('the same hass object does not re-run location handling', async () => {
    quiet();
    api.alerts('WAZ558', []);
    const hass = makeHass();
    const card = await makeCard({ nws_zone: 'WAZ558' }, hass);
    const spy = mock.method(card._zoneResolver, 'handleHassUpdate');
    card.hass = hass;
    card.hass = makeHass();
    assert.equal(spy.mock.callCount(), 1);
  });

  test('an entity location change refetches and renames the zone', async () => {
    quiet();
    api.point(1, 1, 'WAZ558').point(2, 2, 'COZ097').alerts('WAZ558', []).alerts('COZ097', [alert()]).zoneName('WAZ558', 'A').zoneName('COZ097', 'B');
    const where = (lat) => makeHass({ 'device_tracker.p': { state: 'home', attributes: { latitude: lat, longitude: lat } } });
    const card = await makeCard({ latitude: 'device_tracker.p', longitude: 'device_tracker.p' }, where(1));
    mock.timers.enable({ apis: ['setTimeout'] });
    card.hass = where(2);
    mock.timers.tick(5000);
    mock.timers.reset();
    await settle(10);
    assert.equal(card._zoneResolver.currentZone, 'COZ097');
    assert.equal(content(card).querySelector('.zone-subtitle').textContent, 'B');
    assert.equal(items(card).length, 1);
  });
});

describe('visibility', () => {
  test('a hidden tab skips the initial fetch and polls; becoming visible fetches', async () => {
    quiet();
    mock.timers.enable({ apis: ['setInterval'] });
    api.alerts('WAZ558', []);
    const card = await makeCard({ nws_zone: 'WAZ558', update_interval: 60 });
    const n = api.count('/alerts/');
    setHidden(true);
    card._clearAndSetInterval();
    mock.timers.tick(60000);
    document.dispatchEvent(new window.Event('visibilitychange'));
    assert.equal(api.count('/alerts/'), n);
    setHidden(false);
    document.dispatchEvent(new window.Event('visibilitychange'));
    assert.equal(api.count('/alerts/'), n + 1);
  });
});

describe('fetching', () => {
  test('retries 3 times with backoff, then shows the error; success resets the count', async () => {
    quiet();
    mock.timers.enable({ apis: ['setTimeout'] });
    let fail = true;
    api.on('/alerts/active/zone/WAZ558', () => (fail ? new Error('down') : { status: 200, body: {} }));
    const card = await makeCard({ nws_zone: 'WAZ558' });
    const startCount = api.count('/alerts/');
    for (const delay of [5000, 10000, 20000]) {
      mock.timers.tick(delay);
      await settle();
    }
    assert.equal(api.count('/alerts/') - startCount, 3);
    assert.match(content(card).textContent, /Unable to fetch weather alerts/);
    fail = false;
    await card._fetchAlerts();
    assert.equal(card._retryCount, 0);
  });

  test('a response without features means no alerts', async () => {
    quiet();
    api.on('/alerts/active/zone/WAZ558', () => ({ status: 200, body: {} }));
    const card = await makeCard({ nws_zone: 'WAZ558' });
    assert.match(content(card).textContent, /No active alerts/);
  });

  test('a rejected action call does not break the fetch', async () => {
    quiet();
    api.alerts('WAZ558', [alert({ severity: 'Minor' })]);
    const card = document.createElement('nws-alert-card');
    mock.method(card._actionManager, 'triggerSeverityAction', async () => { throw new Error('boom'); });
    card.setConfig({ nws_zone: 'WAZ558', minor_action: 'script.m' });
    document.body.appendChild(card);
    await settle();
    assert.equal(items(card).length, 1);
    card.disconnectedCallback();
  });

  test('the zone name re-render waits for alerts that are still loading', async () => {
    quiet();
    api.alerts('WAZ558', [alert()]).zoneName('WAZ558', 'Seattle');
    const card = await makeCard({ nws_zone: 'WAZ558' });
    card._alertsCache.clear();
    card._zoneResolver.zoneName = null;
    const render = mock.method(card, '_renderAlerts');
    await card._fetchZoneNameAndRerender();
    assert.equal(render.mock.callCount(), 0);
  });
});

describe('alert entity', () => {
  test('writes EventType:Severity pairs in NWS priority order, and empty when clear', async () => {
    quiet();
    let features = [alert({ event: 'Wind Advisory', severity: 'Minor' }), alert({ event: 'Tornado Warning', severity: 'Extreme' }), alert({ event: 'Made Up', severity: undefined }), { id: 'bare', properties: {} }];
    api.on('/alerts/active/zone/WAZ558', () => ({ status: 200, body: { features } }));
    const hass = makeHass({ 'input_text.nws': { state: '', attributes: {} } });
    const card = await makeCard({ nws_zone: 'WAZ558', alert_entity: 'input_text.nws' }, hass);
    assert.equal(hass.calls[0].data.value, 'Tornado Warning:Extreme,Wind Advisory:Minor,Made Up:Unknown,Unknown:Unknown');
    features = [];
    await card._fetchAlerts();
    assert.equal(hass.calls[1].data.value, '');
  });

  test('truncates past 255 characters at the last whole entry', async () => {
    quiet();
    const features = Array.from({ length: 12 }, (_, i) => alert({ event: `Long Named Alert Number ${i}`, severity: 'Minor' }));
    features.push(alert({ event: 'x'.repeat(300), severity: 'Minor' }));
    api.on('/alerts/active/zone/WAZ558', () => ({ status: 200, body: { features } }));
    const hass = makeHass({ 'input_text.nws': { state: '', attributes: {} } });
    await makeCard({ nws_zone: 'WAZ558', alert_entity: 'input_text.nws' }, hass);
    const value = hass.calls[0].data.value;
    assert.ok(value.length <= 255);
    assert.match(value, /Minor$/);
  });

  test('a single entry over 255 characters is cut at 255', async () => {
    quiet();
    api.alerts('WAZ558', [alert({ event: 'y'.repeat(300) })]);
    const hass = makeHass({ 'input_text.nws': { state: '', attributes: {} } });
    await makeCard({ nws_zone: 'WAZ558', alert_entity: 'input_text.nws' }, hass);
    assert.equal(hass.calls[0].data.value.length, 255);
  });

  test('a missing entity warns; a failed call is logged; no hass does nothing', async () => {
    quiet();
    api.alerts('WAZ558', [alert()]);
    const missing = makeHass();
    await makeCard({ nws_zone: 'WAZ558', alert_entity: 'input_text.gone' }, missing);
    assert.equal(missing.calls.length, 0);
    const failing = makeHass({ 'input_text.nws': { state: '', attributes: {} } });
    failing.callService = async () => { throw new Error('denied'); };
    await makeCard({ nws_zone: 'WAZ558', alert_entity: 'input_text.nws' }, failing);
    await makeCard({ nws_zone: 'WAZ558', alert_entity: 'input_text.nws' });
    assert.ok(console.error.mock.calls.some((c) => /Failed to update alert entity/.test(c.arguments[0])));
  });
});

describe('alert rendering', () => {
  const one = async (props, config = {}) => {
    api.alerts('WAZ558', [alert(props)]);
    const card = await makeCard({ nws_zone: 'WAZ558', ...config });
    return items(card)[0];
  };

  test('markers: Extreme three dots, Moderate none, disabled none', async () => {
    quiet();
    assert.match((await one({ severity: 'Extreme' })).querySelector('.danger-marker').textContent, /🔴🔴🔴/);
    assert.equal((await one({ severity: 'Moderate' })).querySelectorAll('.danger-marker').length, 0);
    assert.equal((await one({ severity: 'Extreme' }, { show_severity_markers: false })).querySelectorAll('.danger-marker').length, 0);
  });

  test('missing fields render as N/A, Unknown Event and no description', async () => {
    quiet();
    const item = await one({ event: undefined, severity: undefined, urgency: undefined, certainty: undefined, description: undefined, onset: undefined, expires: 'bad', uri: 'javascript:alert(1)' });
    const text = item.textContent.replace(/\s+/g, ' ');
    assert.match(text, /Unknown Event/);
    assert.match(text, /N\/A → Invalid Date/);
    assert.match(text, /Severity: N\/A Urgency: N\/A/);
    assert.doesNotMatch(text, /Certainty/);
    assert.match(text, /No description available/);
    assert.equal(item.querySelectorAll('a').length, 0);
    assert.ok(item.classList.contains('severity-Unknown'));
  });

  test('ends is preferred over expires; the link is offered for https URIs', async () => {
    quiet();
    const item = await one({ ends: '2026-01-16T00:00:00Z' });
    assert.match(item.querySelector('.times').textContent, /Jan 16, 2026/);
    assert.equal(item.querySelector('a').getAttribute('rel'), 'noopener noreferrer');
  });

  test('long descriptions: collapsed with a toggle; Show more and Show less', async () => {
    quiet();
    const long = 'Line one\nwraps here.\r\n\r\n' + 'z'.repeat(250);
    api.alerts('WAZ558', [alert({ description: long })]);
    const card = await makeCard({ nws_zone: 'WAZ558' });
    const toggle = () => card.shadowRoot.querySelector('.toggle');
    assert.equal(card.shadowRoot.querySelectorAll('.description').length, 0);
    toggle().click();
    assert.match(card.shadowRoot.querySelector('.description').textContent, /Line one wraps here\.\n\nzzz/);
    assert.match(toggle().textContent, /Show less/);
    toggle().click();
    assert.equal(card.shadowRoot.querySelectorAll('.description').length, 0);
    content(card).querySelector('.card-title').click();
    assert.equal(card.shadowRoot.querySelectorAll('.description').length, 0);
  });

  test('show_expanded: open by default, collapsible, and reopenable', async () => {
    quiet();
    api.alerts('WAZ558', [alert({ description: 'q'.repeat(300) })]);
    const card = await makeCard({ nws_zone: 'WAZ558', show_expanded: true });
    assert.equal(card.shadowRoot.querySelectorAll('.description').length, 1);
    card.shadowRoot.querySelector('.toggle').click();
    assert.equal(card.shadowRoot.querySelectorAll('.description').length, 0);
    card.shadowRoot.querySelector('.toggle').click();
    assert.equal(card.shadowRoot.querySelectorAll('.description').length, 1);
  });

  test('an alert without an event name still names its link and toggle', async () => {
    quiet();
    api.alerts('WAZ558', [alert({ event: undefined, description: 'w'.repeat(300) })]);
    const card = await makeCard({ nws_zone: 'WAZ558', show_expanded: true });
    assert.match(card.shadowRoot.querySelector('.toggle').textContent, /Show less: Unknown Event/);
    assert.match(card.shadowRoot.querySelector('a').textContent, /Read full alert: Unknown Event \(opens in new tab\)/);
  });

  test('an alert without properties renders as Unknown Event', async () => {
    quiet();
    api.alerts('WAZ558', [{ id: 'bare' }, alert({ event: 'Tornado Warning' })]);
    const card = await makeCard({ nws_zone: 'WAZ558' });
    assert.deepEqual(items(card).map((i) => i.querySelector('h3').textContent.trim()), ['Tornado Warning', 'Unknown Event']);
  });

  test('alerts are listed in NWS priority order; unknown types last', async () => {
    quiet();
    api.alerts('WAZ558', [alert({ event: 'Made Up' }), alert({ event: 'Wind Advisory' }), { id: 'p', properties: { event: undefined } }, alert({ event: 'Tornado Warning' })]);
    const card = await makeCard({ nws_zone: 'WAZ558' });
    assert.deepEqual(items(card).map((i) => i.querySelector('h3').textContent.trim()), ['Tornado Warning', 'Wind Advisory', 'Made Up', 'Unknown Event']);
  });
});
