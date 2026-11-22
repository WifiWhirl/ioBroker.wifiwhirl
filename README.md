![Logo](admin/wifiwhirl.png)

# ioBroker.wifiwhirl

Control your Bestway® Lay-Z-Spa™ whirlpool with the [WifiWhirl](https://wifiwhirl.de) module (software 2.x).
The adapter talks to the module directly over your WiFi. No MQTT broker, no cloud, no scripts.

German guide with screenshots: [wifiwhirl.de/Integrationen/iobroker](https://wifiwhirl.de/Integrationen/iobroker)

Ready-made VIS-2 view to import: [vis-2/whirlpool-view.json](vis-2/whirlpool-view.json) (English), [vis-2/whirlpool-view.de.json](vis-2/whirlpool-view.de.json) (German).

## Requirements

* WifiWhirl module with software **2.1.0 or newer**.
* In the module's web interface, Expert mode page, card **API**: switch the API on and create an API key with "read and control".

## Setup

1. Install **WifiWhirl** and create an instance.
2. Enter the module's **address**, e.g. `192.168.178.42`, and the **API key**.

## States

| Channel | Content |
| --- | --- |
| `control` | writable: filter pump, heater, AirJet, HydroJet, power, button lock, target temperature, display brightness |
| `status` | water temperature, outside temperature, heating, target reached, ready in (h), error code, pump display, power, energy and costs |
| `maintenance` | last chlorine, filter cleaned/changed, water changed (empty = never); buttons under `maintenance.done` mark a task as done now |
| `waterQuality` | last measured pH, chlorine, cyanuric acid, alkalinity; writing a value enters a new measurement |
| `smartSchedule` | target time (`YYYY-MM-DD HH:MM`, time zone of the ioBroker host), target temperature, after target (0 all off, 1 filter pump only, 2 keep heating), start, cancel, active, heating start |
| `info` | connection, software version, pump model, WiFi signal |

Switching the heater on also switches the filter pump on. A Smart Schedule only starts when `smartSchedule.start` is pressed.

## How it works

* Uses the module's API `/api/v1` with an API key (`Authorization: Bearer ...`), see the [API description](https://wifiwhirl.de/Integrationen/api).
* Polls `GET /api/v1/status`, `/info` and `/schedule` every 10 s (configurable, 5-3600 s).
* Writes go to `POST /api/v1/controls`, `/maintenance`, `/waterquality` and `/schedule` (`DELETE` cancels).
* Temperatures are always °C; the module converts if the pump shows °F.

## Development

```bash
npm install
npm test          # unit tests (lib/mapping.js, real module answer in test/fixtures) + package checks
npm run lint
npm run check     # TypeScript check of the JavaScript
```

Tested against a real module (software 2.1.0).

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### 0.1.3 (2026-11-22)

* "After the target time" labels are English only
* VIS-2 view in English, German view kept as `whirlpool-view.de.json`
* WiFi signal uses the role `value.rssi`
* Switches only accept true/false/1/0, the text "false" no longer switches on
* A failing poll can no longer leave an unhandled promise rejection

### 0.1.2 (2026-11-19)

* State names in all ioBroker languages
* Water quality values are writable, so they now use the role `level`
* "Never" and "no schedule" leave a state empty instead of writing null

### 0.1.1 (2026-11-19)

* package.json: repository URL in the form npm expects
* Dependabot no longer proposes TypeScript major updates (typescript-eslint only supports TypeScript < 6.1)

### 0.1.0

* first version: values, control, water quality, maintenance and Smart Schedule via the module API (software 2.1.0+), no MQTT broker needed

## Disclaimer

Bestway® and Lay-Z-Spa™ are trademarks of Bestway Inflatables & Material Corp. This adapter and the WifiWhirl module are not affiliated with or endorsed by Bestway.

## License

Copyright (c) 2026 WifiWhirl <info@wifiwhirl.de>

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License version 3 as published by the Free
Software Foundation, the same license as the WifiWhirl module software.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.
