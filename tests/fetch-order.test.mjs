// Fetch ordering (B13, 2026-11 card review sweep): an answer that arrives after the
// card has moved to another zone, or after it was removed, must not touch the card
// or Home Assistant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, alert, makeCard, makeHass, settle, items } from './helpers/env.mjs';

// Swap in a fetch whose answers the test releases, in any order.
function deferredFetch() {
  const pending = [];
  const real = globalThis.fetch;
  globalThis.fetch = (url) => new Promise((resolve) => {
    pending.push({ url: String(url), answer: (features) => resolve({ ok: true, status: 200, json: async () => ({ features }) }) });
  });
  return { pending, restore: () => { globalThis.fetch = real; } };
}

const events = (card) => items(card).map((el) => el.querySelector('.alert-title, .event, h3')?.textContent ?? el.textContent);

test('N-B13: an answer for the zone the card has left is dropped', async () => {
  api.reset();
  api.alerts('WAZ001', []).zoneName('WAZ001', 'One').zoneName('WAZ002', 'Two');
  const hass = makeHass({ 'input_text.nws': { state: '' } });
  const card = await makeCard({ nws_zone: 'WAZ001', alert_entity: 'input_text.nws' }, hass);
  const before = hass.calls.length;
  const { pending, restore } = deferredFetch();
  try {
    card._fetchAlerts();                           // still for WAZ001
    card._zoneResolver.currentZone = 'WAZ002';     // e.g. the phone moved
    card._fetchAlerts();
    pending[1].answer([alert({ event: 'Zone Two Warning' })]);
    await settle();
    pending[0].answer([alert({ event: 'Zone One Warning' })]);
    await settle();
  } finally {
    restore();
  }
  const text = events(card).join(' | ');
  assert.match(text, /Zone Two Warning/);
  assert.doesNotMatch(text, /Zone One Warning/);
  assert.ok(hass.calls.slice(before).every((c) => !JSON.stringify(c.data).includes('Zone One')), 'no alert entity update for the old zone');
});

test('N-B13: an answer that arrives after the card was removed changes nothing', async () => {
  api.reset();
  api.alerts('WAZ003', []).zoneName('WAZ003', 'Three');
  const hass = makeHass({ 'input_text.nws': { state: '' } });
  const card = await makeCard({ nws_zone: 'WAZ003', alert_entity: 'input_text.nws' }, hass);
  const before = hass.calls.length;
  const { pending, restore } = deferredFetch();
  try {
    card._fetchAlerts();
    card.remove();
    pending[0].answer([alert({ event: 'Late Warning' })]);
    await settle();
  } finally {
    restore();
  }
  assert.equal(hass.calls.length, before, 'no service calls from a removed card');
  assert.equal(items(card).length, 0);
});

test('N-B13: a stale failure neither retries nor shows an error', async () => {
  api.reset();
  api.alerts('WAZ004', [alert({ event: 'Shown Warning' })]).zoneName('WAZ004', 'Four');
  const card = await makeCard({ nws_zone: 'WAZ004' });
  const real = globalThis.fetch;
  let reject;
  globalThis.fetch = () => new Promise((_, r) => { reject = r; });
  const error = console.error;
  console.error = () => {};
  try {
    card._fetchAlerts();
    globalThis.fetch = real;
    await card._fetchAlerts();                    // newer, succeeds
    reject(new Error('late failure'));
    await settle();
  } finally {
    globalThis.fetch = real;
    console.error = error;
  }
  assert.equal(card._retryTimeout ?? null, null);
  assert.match(events(card).join(' '), /Shown Warning/);
});
