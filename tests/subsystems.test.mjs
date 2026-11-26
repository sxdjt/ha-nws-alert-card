// ZoneResolver and ActionManager, through fresh instances taken from a card
import { test, describe, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { api, alert, makeHass, device, settle, cleanup, document, window } from './helpers/env.mjs';

afterEach(() => { mock.restoreAll(); mock.timers.reset(); cleanup(); });
const quiet = () => { for (const m of ['log', 'warn', 'error']) mock.method(console, m, () => {}); };
const probe = document.createElement('nws-alert-card');
const ZoneResolver = probe._zoneResolver.constructor;
const ActionManager = probe._actionManager.constructor;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('ZoneResolver.isMobileDevice', () => {
  test('HA app, mobile UA on a narrow screen, mobile UA on a wide screen, desktop', () => {
    const detect = (ua, width) => { device.userAgent = ua; device.innerWidth = width; return new ZoneResolver().isMobileDevice(); };
    assert.deepEqual(
      [detect('Home Assistant/2026.11 (iOS)', 1280), detect('Mozilla iPhone', 390), detect('Mozilla iPhone', 1024), detect('Mozilla Macintosh', 390)],
      [true, true, false, false],
    );
  });

  test('the result is cached', () => {
    const zr = new ZoneResolver();
    zr.isMobileDevice();
    device.userAgent = 'Home Assistant';
    assert.equal(zr.isMobileDevice(), false);
  });
});

describe('ZoneResolver.resolveCoordinate', () => {
  test('numbers, numeric strings, entity attributes and every rejection', () => {
    quiet();
    const zr = new ZoneResolver();
    const hass = makeHass({
      'device_tracker.ok': { state: 'home', attributes: { latitude: '47.5', longitude: -122 } },
      'device_tracker.none': { state: 'home', attributes: {} },
      'device_tracker.bad': { state: 'home', attributes: { latitude: 'abc' } },
      'device_tracker.far': { state: 'home', attributes: { latitude: 91, longitude: 181 } },
    });
    const r = (v, type = 'latitude', h = hass) => zr.resolveCoordinate(v, type, h);
    assert.deepEqual(
      [r(undefined), r(null), r(47.1), r(' -12.5 '), r('nodot'), r('device_tracker.ok', 'latitude', null), r('device_tracker.ok', 'latitude', {}),
        r('device_tracker.gone'), r('device_tracker.none'), r('device_tracker.bad'), r('device_tracker.far'), r('device_tracker.far', 'longitude'),
        r('device_tracker.ok'), r('device_tracker.ok', 'longitude'), r({ lat: 1 })],
      [null, null, 47.1, -12.5, null, null, null, null, null, null, null, null, 47.5, -122, null],
    );
  });
});

describe('ZoneResolver.fetchZoneFromCoordinates', () => {
  test('caches for 24 hours and sends the User-Agent', async () => {
    quiet();
    mock.timers.enable({ apis: ['Date'], now: 0 });
    api.point(1, 2, 'WAZ558');
    const zr = new ZoneResolver();
    assert.equal(await zr.fetchZoneFromCoordinates(1, 2, 'me@x.io'), 'WAZ558');
    assert.equal(await zr.fetchZoneFromCoordinates(1, 2, 'me@x.io'), 'WAZ558');
    assert.equal(api.count('/points/'), 1);
    assert.equal(api.requests[0].headers['User-Agent'], 'Home Assistant Custom Card / me@x.io');
    mock.timers.tick(86400001);
    await zr.fetchZoneFromCoordinates(1, 2, 'me@x.io');
    assert.equal(api.count('/points/'), 2);
  });

  test('HTTP error, missing forecastZone and a malformed zone all give null', async () => {
    quiet();
    api.on('/points/1,1', () => ({ status: 503, statusText: 'Busy' }))
      .on('/points/2,2', () => ({ status: 200, body: { properties: {} } }))
      .on('/points/3,3', () => ({ status: 200, body: { properties: { forecastZone: 'https://x/zones/forecast/bad' } } }));
    const zr = new ZoneResolver();
    assert.deepEqual([await zr.fetchZoneFromCoordinates(1, 1, 'e'), await zr.fetchZoneFromCoordinates(2, 2, 'e'), await zr.fetchZoneFromCoordinates(3, 3, 'e')], [null, null, null]);
  });

  test('keeps at most 10 cached zones, dropping the oldest', async () => {
    quiet();
    for (let i = 0; i < 11; i++) api.point(i, i, 'WAZ558');
    const zr = new ZoneResolver();
    for (let i = 0; i < 11; i++) await zr.fetchZoneFromCoordinates(i, i, 'e');
    assert.equal(zr._zoneCache.size, 10);
    assert.equal(zr._zoneCache.has('0.0000,0.0000'), false);
  });
});

describe('ZoneResolver.getActiveZone', () => {
  test('mobile coordinates on mobile; base coordinates otherwise; zone fallbacks', async () => {
    quiet();
    api.point(1, 1, 'AKZ844').point(2, 2, 'COZ097').on('/points/3,3', () => ({ status: 500 }));
    const zone = async (config, ua = 'Mozilla Macintosh') => { device.userAgent = ua; return new ZoneResolver().getActiveZone(config, makeHass()); };
    assert.equal(await zone({ latitude: 2, longitude: 2, mobile_latitude: 1, mobile_longitude: 1 }, 'Home Assistant'), 'AKZ844');
    assert.equal(await zone({ latitude: 2, longitude: 2, mobile_latitude: 1 }, 'Home Assistant'), 'COZ097');
    assert.equal(await zone({ latitude: 2, longitude: 2, mobile_latitude: 1, mobile_longitude: 1 }), 'COZ097');
    assert.equal(await zone({ nws_zone: 'WAZ558' }), 'WAZ558');
    assert.equal(await zone({}), null);
    assert.equal(await zone({ latitude: 'sensor.gone', longitude: 'sensor.gone', nws_zone: 'WAZ558' }), 'WAZ558');
    assert.equal(await zone({ latitude: 'sensor.gone', longitude: 'sensor.gone' }), null);
    assert.equal(await zone({ latitude: 3, longitude: 3 }), null);
  });
});

describe('ZoneResolver.fetchZoneName', () => {
  test('fetches once; skips without a zone; survives errors and a missing name', async () => {
    quiet();
    api.zoneName('WAZ558', 'Seattle').on('/zones/forecast/COZ097', () => ({ status: 404 }))
      .on('/zones/forecast/AKZ844', () => ({ status: 200, body: {} })).on('/zones/forecast/NVZ020', () => new Error('offline'));
    const zr = new ZoneResolver();
    await zr.fetchZoneName('e');
    assert.equal(api.requests.length, 0);
    zr.currentZone = 'WAZ558';
    await zr.fetchZoneName('e');
    await zr.fetchZoneName('e');
    assert.equal(zr.zoneName, 'Seattle');
    assert.equal(api.count('/zones/'), 1);
    for (const z of ['COZ097', 'AKZ844', 'NVZ020']) {
      const other = new ZoneResolver();
      other.currentZone = z;
      await other.fetchZoneName('e');
      assert.equal(other.zoneName, null, z);
    }
  });
});

describe('ZoneResolver.handleHassUpdate', () => {
  test('debounces entity coordinates and reports a changed zone', async () => {
    quiet();
    mock.timers.enable({ apis: ['setTimeout'] });
    api.point(1, 1, 'WAZ558');
    const zr = new ZoneResolver();
    zr.currentZone = 'COZ097';
    zr.zoneName = 'Old';
    const hass = makeHass({ 'device_tracker.p': { state: 'home', attributes: { latitude: 1, longitude: 1 } } });
    const config = { latitude: 'device_tracker.p', longitude: 'device_tracker.p' };
    let changes = 0;
    zr.handleHassUpdate(config, hass, () => changes++);
    zr.handleHassUpdate(config, hass, () => changes++);
    mock.timers.tick(5000);
    mock.timers.reset();
    await settle();
    assert.equal(changes, 1);
    assert.deepEqual([zr.currentZone, zr.zoneName, zr._zoneResolveTimeout], ['WAZ558', null, null]);
    mock.timers.enable({ apis: ['setTimeout'] });
    zr.handleHassUpdate(config, hass, () => changes++);
    mock.timers.tick(5000);
    mock.timers.reset();
    await settle();
    assert.equal(changes, 1, 'same zone must not report a change');
  });

  test('mobile uses the mobile entities; numeric coordinates never re-resolve', () => {
    device.userAgent = 'Home Assistant';
    const mobile = new ZoneResolver();
    mobile.handleHassUpdate({ mobile_latitude: 'device_tracker.p', mobile_longitude: 1, latitude: 1, longitude: 1 }, makeHass(), () => {});
    assert.ok(mobile._zoneResolveTimeout);
    mobile.cleanup();
    assert.equal(mobile._zoneResolveTimeout, null);
    device.userAgent = 'Mozilla Macintosh';
    const desktop = new ZoneResolver();
    desktop.handleHassUpdate({ mobile_latitude: 'device_tracker.p', latitude: 1, longitude: 1 }, makeHass(), () => {});
    assert.equal(desktop._zoneResolveTimeout, null);
    desktop.cleanup();
  });
});

describe('ActionManager', () => {
  test('ranks, max severity and trigger decisions', () => {
    quiet();
    const am = new ActionManager();
    assert.equal(am.getSeverityRank('Bogus'), 0);
    assert.equal(am.getMaxSeverity([]), null);
    assert.equal(am.getMaxSeverity([{ id: 'x' }]), 'Unknown');
    const minor = alert({ severity: 'Minor' });
    const severe = alert({ severity: 'Severe' });
    assert.deepEqual(am.shouldTriggerAction([], new Set()), { shouldTrigger: false, severity: null });
    assert.deepEqual(am.shouldTriggerAction([minor], new Set()), { shouldTrigger: true, severity: 'Minor' });
    am.updateMaxSeverity([minor]);
    assert.deepEqual(am.shouldTriggerAction([minor, severe], new Set([minor.id])), { shouldTrigger: true, severity: 'Severe' });
    am.updateMaxSeverity([minor, severe]);
    assert.deepEqual(am.shouldTriggerAction([minor, severe], new Set([minor.id, severe.id])), { shouldTrigger: false, severity: null });
    assert.deepEqual(am.shouldTriggerAction([severe, alert({ severity: 'Minor' })], new Set([minor.id, severe.id])), { shouldTrigger: true, severity: 'Severe' });
    am.cleanup();
    assert.equal(am._lastMaxSeverity, null);
  });

  test('scripts are turned on, automations triggered; nothing for unconfigured severities', async () => {
    quiet();
    const am = new ActionManager();
    const hass = makeHass();
    const config = { minor_action: 'script.m', severe_action: 'automation.s', alert_trigger_cooldown: 0 };
    await am.triggerSeverityAction('Minor', config, hass, 'WAZ558');
    await am.triggerSeverityAction('Severe', config, hass, 'WAZ558');
    await am.triggerSeverityAction('Extreme', config, hass, 'WAZ558');
    assert.deepEqual(hass.calls.map((c) => `${c.domain}.${c.service}`), ['script.turn_on', 'automation.trigger']);
  });

  test('cooldown per severity and zone: skip inside it, run after it', async () => {
    quiet();
    mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
    const am = new ActionManager();
    const hass = makeHass();
    const config = { moderate_action: 'script.m', alert_trigger_cooldown: 60 };
    await am.triggerSeverityAction('Moderate', config, hass, null);
    assert.ok(localStorage.getItem('nws-alert-card-cooldown-Moderate-unknown'));
    await am.triggerSeverityAction('Moderate', config, hass, null);
    assert.equal(hass.calls.length, 1);
    mock.timers.tick(60 * 60000);
    await am.triggerSeverityAction('Moderate', config, hass, null);
    assert.equal(hass.calls.length, 2);
  });

  test('a failed call is logged; localStorage errors do not block the action', async () => {
    quiet();
    const am = new ActionManager();
    const failing = { callService: async () => { throw new Error('nope'); } };
    await am.triggerSeverityAction('Minor', { minor_action: 'script.m', alert_trigger_cooldown: 5 }, failing, 'Z');
    assert.equal(am._actionInProgress, false);
    mock.method(localStorage.__proto__, 'getItem', () => { throw new Error('denied'); });
    mock.method(localStorage.__proto__, 'setItem', () => { throw new Error('denied'); });
    const hass = makeHass();
    await am.triggerSeverityAction('Minor', { minor_action: 'script.m', alert_trigger_cooldown: 5 }, hass, 'Z');
    assert.equal(hass.calls.length, 1);
  });

  test('a trigger while one is running is queued and runs after it', async () => {
    quiet();
    const am = new ActionManager();
    const hass = makeHass();
    const config = { minor_action: 'script.m', extreme_action: 'script.x', alert_trigger_cooldown: 0 };
    const first = am.triggerSeverityAction('Minor', config, hass, 'Z');
    await am.triggerSeverityAction('Extreme', config, hass, 'Z');
    await first;
    await sleep(150);
    await settle();
    assert.deepEqual(hass.calls.map((c) => c.data.entity_id), ['script.m', 'script.x']);
  });
});
