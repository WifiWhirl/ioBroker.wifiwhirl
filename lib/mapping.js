'use strict';

/*
 * Maps the WifiWhirl API (/api/v1/status, firmware 2.1.0+) to ioBroker states,
 * and ioBroker writes back to API requests. Pure functions only, so they can be
 * tested without ioBroker.
 */

/**
 * @typedef {object} StateDef
 * @property {string} id - state id below the instance
 * @property {ioBroker.StringOrTranslated} name - name per language
 * @property {ioBroker.CommonType} type - value type
 * @property {string} role - ioBroker role
 * @property {string} [unit] - unit
 * @property {number} [min] - lowest allowed value
 * @property {number} [max] - highest allowed value
 * @property {number} [step] - step for numbers
 * @property {Record<number, string>} [states] - value labels
 * @property {ioBroker.StateValue} [def] - default value
 * @property {boolean} [read] - readable (default true)
 * @property {boolean} [write] - writable without a module request
 * @property {(s: Record<string, any>) => ioBroker.StateValue | undefined} [get] - value from /api/v1/status
 * @property {string} [control] - field for POST /api/v1/controls
 * @property {string} [water] - field for POST /api/v1/waterquality
 * @property {string} [done] - task for POST /api/v1/maintenance
 */

/**
 * Unix seconds -> ms timestamp for role "date", null stays null (never).
 *
 * @param s - Unix seconds or null
 */
const tsToMs = s => (s > 0 ? s * 1000 : null);
const round = (v, digits) => (typeof v === 'number' ? Math.round(v * 10 ** digits) / 10 ** digits : null);

/** @type {StateDef[]} */
const STATES = [
    // control: writable, written values go to /api/v1/controls
    {
        id: 'control.pump',
        name: { en: 'Filter pump', de: 'Filterpumpe' },
        type: 'boolean',
        role: 'switch',
        get: s => s.pump,
        control: 'pump',
    },
    {
        id: 'control.heater',
        name: { en: 'Heater', de: 'Heizung' },
        type: 'boolean',
        role: 'switch',
        get: s => s.heater,
        control: 'heater',
    },
    {
        id: 'control.airjet',
        name: { en: 'AirJet', de: 'AirJet' },
        type: 'boolean',
        role: 'switch',
        get: s => s.bubbles,
        control: 'bubbles',
    },
    {
        id: 'control.hydrojet',
        name: { en: 'HydroJet', de: 'HydroJet' },
        type: 'boolean',
        role: 'switch',
        get: s => s.jets,
        control: 'jets',
    },
    {
        id: 'control.power',
        name: { en: 'Spa on', de: 'Whirlpool ein' },
        type: 'boolean',
        role: 'switch.power',
        get: s => s.power,
        control: 'power',
    },
    {
        id: 'control.lock',
        name: { en: 'Button lock', de: 'Tastensperre' },
        type: 'boolean',
        role: 'switch.lock',
        get: s => s.lock,
        control: 'lock',
    },
    {
        id: 'control.targetTemperature',
        name: { en: 'Target temperature', de: 'Zieltemperatur' },
        type: 'number',
        role: 'level.temperature',
        unit: '°C',
        min: 20,
        max: 40,
        get: s => s.temperature?.target,
        control: 'targetTemperature',
    },
    {
        id: 'control.brightness',
        name: { en: 'Display brightness', de: 'Displayhelligkeit' },
        type: 'number',
        role: 'level.dimmer',
        min: 0,
        max: 8,
        get: s => s.brightness,
        control: 'brightness',
    },

    // status: read only
    {
        id: 'status.waterTemperature',
        name: { en: 'Water temperature', de: 'Wassertemperatur' },
        type: 'number',
        role: 'value.temperature',
        unit: '°C',
        get: s => s.temperature?.water,
    },
    {
        id: 'status.ambientTemperature',
        name: { en: 'Outside temperature', de: 'Außentemperatur' },
        type: 'number',
        role: 'value.temperature',
        unit: '°C',
        get: s => s.temperature?.ambient,
    },
    {
        id: 'status.heating',
        name: { en: 'Heating right now', de: 'Heizt gerade' },
        type: 'boolean',
        role: 'indicator.working',
        get: s => s.heating,
    },
    {
        id: 'status.targetReached',
        name: { en: 'Target temperature reached', de: 'Zieltemperatur erreicht' },
        type: 'boolean',
        role: 'indicator',
        get: s => s.targetReached,
    },
    {
        id: 'status.error',
        name: { en: 'Pump error code (0 = none)', de: 'Fehlercode der Pumpe (0 = keiner)' },
        type: 'number',
        role: 'value',
        get: s => s.error,
    },
    {
        id: 'status.display',
        name: { en: 'Pump display', de: 'Anzeige der Pumpe' },
        type: 'string',
        role: 'text',
        get: s => (typeof s.display === 'string' ? s.display.trim() : undefined),
    },
    {
        id: 'status.readyInHours',
        name: { en: 'Ready in', de: 'Bereit in' },
        type: 'number',
        role: 'value.interval',
        unit: 'h',
        get: s => (s.readyInHours === undefined ? undefined : s.readyInHours),
    },
    {
        id: 'status.power',
        name: { en: 'Power', de: 'Leistung' },
        type: 'number',
        role: 'value.power',
        unit: 'W',
        get: s => s.energy?.powerW,
    },
    {
        id: 'status.energyToday',
        name: { en: 'Energy today', de: 'Energie heute' },
        type: 'number',
        role: 'value.energy.consumed',
        unit: 'kWh',
        get: s => round(s.energy?.todayKwh, 2),
    },
    {
        id: 'status.energyTotal',
        name: { en: 'Energy total', de: 'Energie gesamt' },
        type: 'number',
        role: 'value.energy.consumed',
        unit: 'kWh',
        get: s => round(s.energy?.totalKwh, 2),
    },
    {
        id: 'status.costToday',
        name: { en: 'Cost today', de: 'Kosten heute' },
        type: 'number',
        role: 'value',
        get: s => round(s.energy?.todayCost, 2),
    },
    {
        id: 'status.costTotal',
        name: { en: 'Cost total', de: 'Kosten gesamt' },
        type: 'number',
        role: 'value',
        get: s => round(s.energy?.totalCost, 2),
    },

    // maintenance: last time it was done (null = never), buttons mark it done now
    ...[
        {
            key: 'chlorine',
            last: { en: 'Last chlorine', de: 'Letzte Chlorzugabe' },
            done: { en: 'Chlorine added', de: 'Chlor zugegeben' },
        },
        {
            key: 'filterCleaned',
            last: { en: 'Filter last cleaned', de: 'Filter zuletzt gereinigt' },
            done: { en: 'Filter cleaned', de: 'Filter gereinigt' },
        },
        {
            key: 'filterChanged',
            last: { en: 'Filter last changed', de: 'Filter zuletzt gewechselt' },
            done: { en: 'Filter changed', de: 'Filter gewechselt' },
        },
        {
            key: 'waterChanged',
            last: { en: 'Water last changed', de: 'Wasser zuletzt gewechselt' },
            done: { en: 'Water changed', de: 'Wasser gewechselt' },
        },
    ].flatMap(m => [
        /** @type {StateDef} */ ({
            id: `maintenance.${m.key}`,
            name: m.last,
            type: 'number',
            role: 'date',
            get: s => tsToMs(s.maintenance?.[m.key]?.last),
        }),
        /** @type {StateDef} */ ({
            id: `maintenance.done.${m.key}`,
            name: m.done,
            type: 'boolean',
            role: 'button',
            read: false,
            done: m.key,
        }),
    ]),

    // water quality: last measured values, writing one enters a new measurement
    {
        id: 'waterQuality.ph',
        name: { en: 'pH', de: 'pH-Wert' },
        type: 'number',
        role: 'value.ph',
        min: 0,
        max: 14,
        step: 0.1,
        get: s => s.waterQuality?.ph?.value,
        water: 'ph',
    },
    {
        id: 'waterQuality.chlorine',
        name: { en: 'Chlorine', de: 'Chlor' },
        type: 'number',
        role: 'value',
        unit: 'mg/l',
        min: 0,
        step: 0.1,
        get: s => s.waterQuality?.chlorine?.value,
        water: 'chlorine',
    },
    {
        id: 'waterQuality.cyanuricAcid',
        name: { en: 'Cyanuric acid', de: 'Cyanursäure' },
        type: 'number',
        role: 'value',
        unit: 'mg/l',
        min: 0,
        get: s => s.waterQuality?.cyanuricAcid?.value,
        water: 'cyanuricAcid',
    },
    {
        id: 'waterQuality.alkalinity',
        name: { en: 'Alkalinity', de: 'Alkalinität' },
        type: 'number',
        role: 'value',
        unit: 'mg/l',
        min: 0,
        get: s => s.waterQuality?.alkalinity?.value,
        water: 'alkalinity',
    },
];

/** Values of /api/v1/info, read on every poll. */
/** @type {StateDef[]} */
const INFO_STATES = [
    {
        id: 'info.firmware',
        name: { en: 'Firmware version', de: 'Softwareversion' },
        type: 'string',
        role: 'info.firmware',
        get: i => i.firmware,
    },
    {
        id: 'info.model',
        name: { en: 'Pump model', de: 'Pumpenmodell' },
        type: 'string',
        role: 'info.name',
        get: i => i.model,
    },
    {
        id: 'info.rssi',
        name: { en: 'WiFi signal', de: 'WLAN-Signal' },
        type: 'number',
        role: 'value',
        unit: 'dBm',
        get: i => i.rssi,
    },
];

const AFTER = {
    0: 'Alles aus / everything off',
    1: 'Nur Filterpumpe / filter pump only',
    2: 'Heizung hält Temperatur / heater keeps temperature',
};
const AFTER_API = ['off', 'pump', 'heater'];

/** Smart Schedule: inputs are kept in the adapter until "start" is pressed. */
/** @type {StateDef[]} */
const SCHEDULE_STATES = [
    {
        id: 'smartSchedule.targetTime',
        name: { en: 'Target time (YYYY-MM-DD HH:MM)', de: 'Zielzeit (JJJJ-MM-TT HH:MM)' },
        type: 'string',
        role: 'text',
        write: true,
        def: '',
    },
    {
        id: 'smartSchedule.targetTemperature',
        name: { en: 'Target temperature', de: 'Zieltemperatur' },
        type: 'number',
        role: 'level.temperature',
        unit: '°C',
        min: 20,
        max: 40,
        write: true,
        def: 38,
    },
    {
        id: 'smartSchedule.afterTarget',
        name: { en: 'After the target time', de: 'Nach der Zielzeit' },
        type: 'number',
        role: 'level',
        states: AFTER,
        write: true,
        def: 1,
    },
    {
        id: 'smartSchedule.start',
        name: { en: 'Start', de: 'Starten' },
        type: 'boolean',
        role: 'button',
        write: true,
        read: false,
    },
    {
        id: 'smartSchedule.cancel',
        name: { en: 'Cancel', de: 'Abbrechen' },
        type: 'boolean',
        role: 'button',
        write: true,
        read: false,
    },
    {
        id: 'smartSchedule.active',
        name: { en: 'Schedule active', de: 'Zeitplan aktiv' },
        type: 'boolean',
        role: 'indicator',
        def: false,
    },
    {
        id: 'smartSchedule.heatingStart',
        name: { en: 'Heating starts at', de: 'Heizt los um' },
        type: 'number',
        role: 'date',
        def: null,
    },
];

/**
 * {id: value} for every state defined for this answer. undefined values are skipped.
 *
 * @param defs - STATES or INFO_STATES
 * @param answer - /api/v1/status or /api/v1/info
 */
function valuesFrom(defs, answer) {
    const out = {};
    if (!answer || typeof answer !== 'object') {
        return out;
    }
    for (const s of defs) {
        const v = s.get?.(answer);
        if (v !== undefined && !(typeof v === 'number' && Number.isNaN(v))) {
            out[s.id] = v;
        }
    }
    return out;
}

/**
 * Request for a write to a state: {path, body}, null if the state isn't
 * writable or the value is invalid.
 *
 * @param id - state id below the instance
 * @param value - written value
 */
function requestFor(id, value) {
    const s = STATES.find(x => x.id === id);
    if (!s) {
        return null;
    }
    if (s.done) {
        return { path: '/api/v1/maintenance', body: { done: [s.done] } };
    }
    if (s.type === 'boolean' && s.control) {
        return { path: '/api/v1/controls', body: { [s.control]: !!value } };
    }
    const n = Number(value);
    if (value === null || value === '' || !Number.isFinite(n) || n < (s.min ?? -Infinity) || n > (s.max ?? Infinity)) {
        return null;
    }
    if (s.control) {
        return { path: '/api/v1/controls', body: { [s.control]: Math.round(n) } };
    }
    if (s.water) {
        return { path: '/api/v1/waterquality', body: { [s.water]: s.water === 'alkalinity' ? Math.round(n) : n } };
    }
    return null;
}

/**
 * Body for POST /api/v1/schedule from the adapter's inputs, or an error text.
 * targetTime is local time "YYYY-MM-DD HH:MM" (the ioBroker host's time zone).
 *
 * @param targetTime - "YYYY-MM-DD HH:MM", local time
 * @param targetTemperature - target in °C
 * @param afterTarget - 0 off, 1 filter pump, 2 heater keeps
 * @param now - current time in ms
 */
function scheduleBody(targetTime, targetTemperature, afterTarget, now = Date.now()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(String(targetTime || '').trim());
    if (!m) {
        return { error: 'targetTime must look like 2026-12-24 19:00' };
    }
    const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
    if (!(t > now)) {
        return { error: 'targetTime must be in the future' };
    }
    const temp = Math.round(Number(targetTemperature));
    if (!(temp >= 20 && temp <= 40)) {
        return { error: 'targetTemperature must be 20-40 °C' };
    }
    return {
        body: {
            targetTime: Math.floor(t / 1000),
            targetTemperature: temp,
            afterTarget: AFTER_API[Number(afterTarget)] ?? 'off',
        },
    };
}

/**
 * Smart Schedule states from GET /api/v1/schedule.
 *
 * @param ss - answer of /api/v1/schedule
 */
function scheduleValues(ss) {
    return {
        'smartSchedule.active': !!ss?.active,
        'smartSchedule.heatingStart': ss?.active ? tsToMs(ss.heatingStart) : null,
    };
}

module.exports = { STATES, INFO_STATES, SCHEDULE_STATES, valuesFrom, requestFor, scheduleBody, scheduleValues };
