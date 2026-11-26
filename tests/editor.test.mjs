import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEditor, fireValue, lastConfig, control, cleanup } from './helpers/env.mjs';

afterEach(cleanup);

describe('basic fields', () => {
  test('title change fires config-changed; clearing it removes the key', async () => {
    const editor = await makeEditor({ nws_zone: 'WAZ558' });
    fireValue(control(editor, 'Card Title'), 'Alerts');
    assert.equal(lastConfig(editor).title, 'Alerts');
    fireValue(control(editor, 'Card Title'), '');
    assert.equal('title' in lastConfig(editor), false);
  });
});

describe('limits', () => {
  // N19 (B5): the card ignores font sizes outside 8-48
  test('font size fields are limited to 8-48', async () => {
    const editor = await makeEditor({ nws_zone: 'WAZ558' });
    const { min, max } = control(editor, 'Card Title Font Size').selector.number;
    assert.deepEqual([min, max], [8, 48]);
  });

  test('update interval and cooldown have a minimum', async () => {
    const editor = await makeEditor({ nws_zone: 'WAZ558' });
    assert.equal(control(editor, 'Update Interval').selector.number.min, 60);
    assert.equal(control(editor, 'Cooldown Period').selector.number.min, 0);
  });
});

describe('setConfig after the first render', () => {
  // A11 (B10): render-once editor
  test('a YAML edit shows in the visual editor', async () => {
    const editor = await makeEditor({ nws_zone: 'WAZ558', title: 'Old' });
    editor.setConfig({ nws_zone: 'WAZ558', title: 'New' });
    assert.equal(control(editor, 'Card Title').value, 'New');
  });

  test('HA handing back the editor\'s own change does not rebuild it (focus is kept)', async () => {
    const editor = await makeEditor({ nws_zone: 'WAZ558' });
    const field = control(editor, 'Card Title');
    fireValue(field, 'Typing');
    editor.setConfig(lastConfig(editor));
    assert.ok(control(editor, 'Card Title') === field, 'title field was rebuilt');
  });
});
