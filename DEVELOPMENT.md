# Development

## Setup

```bash
npm install
npm test          # unit tests (lib/mapping.js, real module answer in test/fixtures) + package checks
npm run lint
npm run check     # TypeScript check of the JavaScript
```

Tested against a real module (software 2.1.0).

## Structure

* `main.js` - adapter: polling, HTTP calls to the module, state changes.
* `lib/mapping.js` - pure functions that map the module API to states and back (unit tested in `main.test.js`).
* `lib/names.json` - state names in the languages other than en/de.
* `docs/en`, `docs/de` - user guide, referenced by `common.docs` in `io-package.json`.

## Module API

* `GET /api/v1/status`, `/info`, `/schedule` are polled.
* Writes go to `POST /api/v1/controls`, `/maintenance`, `/waterquality` and `/schedule` (`DELETE` cancels).
* Every request carries `Authorization: Bearer <key>`.
* No keep-alive (`agent: false`, `Connection: close`): the module's web server serves one connection at a
  time and would stall other clients on an idle one.

Full description: [wifiwhirl.de/Integrationen/api](https://wifiwhirl.de/Integrationen/api)

## Release

Add the changes under `### **WORK IN PROGRESS**` in the README changelog (format `* (WifiWhirl) text`), then:

```bash
npm run release patch   # or minor / major
```

Pushing the tag `v*` starts the GitHub workflow, which tests and publishes to npm.
