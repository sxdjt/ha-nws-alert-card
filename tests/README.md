# Tests

Run with `npm test`. It runs every `*.test.mjs` file here with Node's built-in test runner. Node 20.11 or newer is required. The card itself has no build step and no runtime dependencies; `package.json` exists only for this test suite.

## How it works

The tests load `nws-alert-card.js`, the same file Home Assistant loads, into a [happy-dom](https://github.com/capricorn86/happy-dom) window (`devDependencies` only, never shipped). happy-dom provides a real DOM: shadow roots, `innerHTML`, `querySelector` and composed events.

`helpers/env.mjs` sets up the window, loads the card, and builds fixtures:

- **No network.** `globalThis.fetch` is replaced by `api`, a fake NWS API that answers only routes a test registers (`api.alerts(zone, features)`, `api.point(lat, lon, zone)`, `api.zoneName(zone, name)`, `api.on(path, handler)`) and throws on anything else. `api.requests` records every URL and header.
- `alert(props, id)`: a GeoJSON alert feature. `makeHass(states)`: a `hass` stand-in whose `callService` records calls in `hass.calls`.
- `await makeCard(config, hass)`: a card attached to the document after its first fetch settles. `content(card)` and `items(card)` read what it shows. `settle()` lets pending promises run.
- `await makeEditor(config, hass)`, `lastConfig(editor)`, `control(editor, label)`, `fireValue(el, value)`: editor fixtures, as in the other cards.
- `device`: the `navigator.userAgent` and `window.innerWidth` the mobile detection reads.
- The timezone is fixed to UTC. `setInterval`/`setTimeout` are unref'd so the card's polling cannot keep the run alive; tests that need timing use `mock.timers`. `cleanup()` disconnects every card, clears `localStorage` and the fake API.

Home Assistant's own elements (`ha-selector`, `ha-switch`, `ha-icon`, ...) are not defined, so they behave as plain elements: tests check the properties the card sets on them and fire their events by hand. `CSS.supports('color', v)` has a deterministic stand-in (happy-dom accepts any value).

IMPORTANT: never pass a DOM node to `assert` (`assert.equal(el, null)`, `assert.equal(a, b)` on elements, `deepEqual` on nodes). When such an assertion fails, Node builds the error message by inspecting the node, which walks the whole happy-dom window and grows memory without bound (2026-11-25: over 70 GB). Assert on strings, numbers or booleans instead: `querySelectorAll(sel).length`, `textContent`, `getAttribute()`, or `assert.ok(a === b, 'message')`.

`npm test` runs under `tests/run-capped.sh`, which kills the run if it passes 1 GB of memory or 60 seconds (`MAX_RSS_MB`, `MAX_SECONDS` to override). Node's `--max-old-space-size` does not bound happy-dom and macOS ignores `ulimit -v`, so the cap is enforced from outside. Run single files the same way: `tests/run-capped.sh node --test tests/card.test.mjs`.

## Coverage

```bash
npm run coverage
```

Every function and every branch in `nws-alert-card.js` is covered (95/95 functions, 391/391 branches). Keep both at 100%: a change that adds a function or branch should add the test that covers it. For a per-line list of gaps, add `--test-reporter=lcov --test-reporter-destination=<file>` and look for `FNDA:0` and `BRDA:...,0` lines.

## Files

| File | Covers |
|------|--------|
| `card.test.mjs` | Registration, defaults, rendering, escaping of API values, focus after toggling, coordinates (numeric strings, entities, Points failure fallback, zone normalization), polling interval, `setConfig` on a running card, action triggers on new vs removed alerts |
| `card-lifecycle.test.mjs` | Card picker and sizing, every `setConfig` validation, connect/disconnect, entity location changes, tab visibility, fetch retries and backoff, the alert entity (priority order, 255-character limit), alert rendering variants |
| `subsystems.test.mjs` | `ZoneResolver` (mobile detection, coordinate resolution, Points lookup and cache, active zone, zone name, debounced entity updates) and `ActionManager` (ranking, trigger decisions, script vs automation, cooldown, `localStorage` errors, queue) |
| `editor.test.mjs` | Title, number limits, `setConfig` after the first render |
| `editor-fields.test.mjs` | Every field type, initial values, entity picker domains, color validation, `hass` propagation |

## Known issues

Record a known bug as a test with the `todo` option, describing the intended behavior. It runs and reports as `todo` without failing the suite. When a fix lands, remove the `todo` option so the test guards against regressions. A `todo` test reports the same whether it passes or fails; check with `--test-reporter=tap` that each one is `not ok`.

There are no open `todo` tests.
