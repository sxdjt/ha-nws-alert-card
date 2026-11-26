import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEditor, makeHass, fireValue, lastConfig, control, cleanup, window } from './helpers/env.mjs';

afterEach(cleanup);
const change = (el, checked) => { el.checked = checked; el.dispatchEvent(new window.Event('change')); };

describe('editor fields', () => {
  test('text, number, switch and entity fields write their keys; clearing removes them', async () => {
    const editor = await makeEditor({ nws_zone: 'WAZ558' });
    fireValue(control(editor, 'Latitude'), '47.6');
    fireValue(control(editor, 'Update Interval'), '120');
    fireValue(control(editor, 'Alert Entity'), 'input_text.nws');
    fireValue(control(editor, 'Extreme Severity Action'), 'script.alarm');
    change(control(editor, 'Expand Alerts by Default'), true);
    change(control(editor, 'Show Severity Markers'), false);
    const c = lastConfig(editor);
    assert.deepEqual([c.latitude, c.update_interval, c.alert_entity, c.extreme_action, c.show_expanded, c.show_severity_markers],
      ['47.6', 120, 'input_text.nws', 'script.alarm', true, false]);
    fireValue(control(editor, 'Update Interval'), '');
    fireValue(control(editor, 'Alert Entity'), null);
    assert.equal('update_interval' in lastConfig(editor), false);
    assert.equal('alert_entity' in lastConfig(editor), false);
  });

  test('fields start from the config; markers default on', async () => {
    const editor = await makeEditor({ nws_zone: 'WAZ558', title_font_size: 18, show_expanded: true, minor_action: 'script.m' });
    assert.deepEqual([control(editor, 'NWS Zone Code').value, control(editor, 'Card Title Font Size').value, control(editor, 'Minor Severity Action').value],
      ['WAZ558', 18, 'script.m']);
    assert.equal(control(editor, 'Show Severity Markers').checked, true);
    assert.equal(control(editor, 'Expand Alerts by Default').checked, true);
    assert.deepEqual(control(editor, 'Alert Entity').selector, { entity: { domain: 'input_text' } });
    assert.deepEqual(control(editor, 'Minor Severity Action').selector, { entity: { domain: ['script', 'automation'] } });
    const blank = await makeEditor({});
    assert.equal(control(blank, 'Expand Alerts by Default').checked, false);
    assert.equal(control(blank, 'Alert Entity').value, '');
  });

  test('color fields: invalid shows an error, valid clears it', async () => {
    const editor = await makeEditor({ nws_zone: 'WAZ558', meta_color: 'nope' });
    const field = control(editor, 'Metadata Color');
    const error = field.parentElement.querySelector('.error-text');
    assert.match(error.textContent, /Error: Metadata Color is not a valid color/);
    fireValue(field, 'still-bad');
    fireValue(field, 'gray');
    assert.equal(error.textContent, '');
    assert.equal(lastConfig(editor).meta_color, 'gray');
  });

  test('hass reaches every selector', async () => {
    const editor = await makeEditor({ nws_zone: 'WAZ558' });
    const hass = makeHass();
    editor.hass = hass;
    for (const s of editor.shadowRoot.querySelectorAll('ha-selector')) assert.ok(s.hass === hass, s.label);
  });
});
