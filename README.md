![Logo](admin/wifiwhirl.png)

# ioBroker.wifiwhirl

[![NPM version](https://img.shields.io/npm/v/iobroker.wifiwhirl.svg)](https://www.npmjs.com/package/iobroker.wifiwhirl)
[![Downloads](https://img.shields.io/npm/dm/iobroker.wifiwhirl.svg)](https://www.npmjs.com/package/iobroker.wifiwhirl)
[![Test and Release](https://github.com/WifiWhirl/ioBroker.wifiwhirl/actions/workflows/test-and-release.yml/badge.svg)](https://github.com/WifiWhirl/ioBroker.wifiwhirl/actions/workflows/test-and-release.yml)

## wifiwhirl adapter for ioBroker

Connects ioBroker to a Bestway® Lay-Z-Spa™ whirlpool that is equipped with the
[WifiWhirl](https://wifiwhirl.de) module (software 2.x). The adapter talks to the module directly over
your local network: no MQTT broker, no cloud, no scripts.

It shows water and outside temperature, heating state, power, energy and costs, and lets you switch
the filter pump, heater, AirJet and HydroJet, set the target temperature, log water measurements and
maintenance, and plan heating with the module's Smart Schedule.

## Requirements

* WifiWhirl module with software **2.1.0 or newer**.
* The module's API is switched on and has an API key with the right "read and control": module web
  interface, page *Expert mode*, card **API**.
* The module must be reachable from the ioBroker host over HTTP (port 80, or the port added to the address, e.g. `192.168.178.42:8080`).

## Configuration

| Setting | Description | Default |
| --- | --- | --- |
| Address of the module | IP address or host name of the module, e.g. `192.168.178.42` | - |
| Update every | Polling interval in seconds (5-3600) | 10 |
| API key | Key created on the module (*Expert mode* → *API*, "read and control"); stored encrypted | - |

## States

| Channel | Writable | Content |
| --- | :---: | --- |
| `control` | ✓ | filter pump, heater, AirJet, HydroJet, power, button lock, target temperature (°C), display brightness (0-8) |
| `status` | - | water and outside temperature, heating, target reached, ready in (h), pump error code, pump display, power, energy and costs |
| `maintenance` | - | last chlorine, filter cleaned, filter changed, water changed (date, empty = never) |
| `maintenance.done` | ✓ | buttons that mark a maintenance task as done now |
| `waterQuality` | ✓ | last measured pH, chlorine, cyanuric acid, alkalinity; writing a value enters a new measurement |
| `smartSchedule` | ✓ | target time (`YYYY-MM-DD HH:MM`), target temperature, after target, start, cancel; read only: active, heating start |
| `info` | - | connection, software version, pump model, WiFi signal |

Switching the heater on also switches the filter pump on. A Smart Schedule only starts when
`smartSchedule.start` is pressed. Every state is explained in the user guide.

## Known limitations

* One module per instance; create one instance per whirlpool.
* Temperatures are always °C (the module converts if the pump shows °F).
* The Smart Schedule target time is read in the time zone of the ioBroker host.
* Costs have no unit, the module does not report a currency.

## Documentation

* [User guide (English)](docs/en/README.md)
* [Benutzerhandbuch (Deutsch)](docs/de/README.md)
* [API of the module](https://wifiwhirl.de/Integrationen/api)
* Ready-made VIS-2 view to import: [vis-2/whirlpool-view.json](vis-2/whirlpool-view.json) (English),
  [vis-2/whirlpool-view.de.json](vis-2/whirlpool-view.de.json) (German)

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md).

## Disclaimer
Bestway® and Lay-Z-Spa™ are trademarks of Bestway Inflatables & Material Corp. This adapter and the WifiWhirl module are not affiliated with or endorsed by Bestway.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**

* (WifiWhirl) User guide in English and German (`docs/en`, `docs/de`) with screenshots, linked via `common.docs`
* (WifiWhirl) README restructured, development notes moved to `DEVELOPMENT.md`

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

## License

Copyright (c) 2026 WifiWhirl <info@wifiwhirl.de>

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License version 3 as published by the Free
Software Foundation, the same license as the WifiWhirl module software.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.
