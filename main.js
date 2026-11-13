'use strict';

/*
 * WifiWhirl adapter: talks to the WifiWhirl module's API (/api/v1, firmware
 * 2.1.0 or newer) directly over HTTP, no MQTT broker needed. Every request
 * carries an API key (made on the module's expert mode page, card API, with
 * "read and control"); the API has to be switched on there too.
 */

const http = require('node:http');
const utils = require('@iobroker/adapter-core');
const {
    STATES,
    INFO_STATES,
    SCHEDULE_STATES,
    valuesFrom,
    requestFor,
    scheduleBody,
    scheduleValues,
} = require('./lib/mapping');

const TIMEOUT_MS = 8000;

class WifiWhirl extends utils.Adapter {
    /** @param {Partial<utils.AdapterOptions>} [options] - Adapter options */
    constructor(options) {
        super({ ...options, name: 'wifiwhirl' });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.pollTimer = undefined;
        this.interval = 10000;
        this.base = '';
        this.auth = '';
        this.lastValues = {};
        this.lastProblem = '';
    }

    async onReady() {
        await this.setState('info.connection', false, true);
        const host = String(this.config.host || '')
            .trim()
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '');
        if (!/^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host)) {
            this.log.error(
                'Please enter the IP address or host name of your WifiWhirl module in the adapter settings.',
            );
            return;
        }
        const key = String(this.config.apiKey || '').trim();
        if (!key) {
            this.log.error(
                'Please enter an API key in the adapter settings (module: expert mode page, card API, "read and control").',
            );
            return;
        }
        this.base = `http://${host}`;
        this.auth = `Bearer ${key}`;
        this.interval = Math.min(Math.max(Number(this.config.interval) || 10, 5), 3600) * 1000;

        for (const s of [...STATES, ...INFO_STATES, ...SCHEDULE_STATES]) {
            await this.ensureState(s);
        }
        this.subscribeStates('control.*');
        this.subscribeStates('maintenance.done.*');
        this.subscribeStates('waterQuality.*');
        this.subscribeStates('smartSchedule.*');
        this.poll();
    }

    /** @param {import('./lib/mapping').StateDef} s - entry of the state lists */
    async ensureState(s) {
        const parts = s.id.split('.');
        for (let i = 1; i < parts.length; i++) {
            const channel = parts.slice(0, i).join('.');
            await this.setObjectNotExistsAsync(channel, {
                type: 'channel',
                common: { name: parts[i - 1] },
                native: {},
            });
        }
        const common = {
            name: s.name,
            type: s.type,
            role: s.role,
            read: s.read !== false,
            write: !!(s.control || s.water || s.done || s.write),
        };
        for (const k of ['unit', 'min', 'max', 'step', 'states', 'def']) {
            if (s[k] !== undefined) {
                common[k] = s[k];
            }
        }
        // extendObject keeps user additions (e.g. history settings) and updates names/roles
        await this.extendObjectAsync(s.id, { type: 'state', common, native: {} });
        // inputs start with their default (e.g. 38 °C) instead of empty
        if (s.write && s.def !== undefined && (await this.getStateAsync(s.id)) == null) {
            await this.setState(s.id, s.def, true);
        }
    }

    /**
     * Calls the module's API. Throws with a readable message on errors.
     *
     * @param {string} method - HTTP method
     * @param {string} path - API path
     * @param {object} [body] - JSON body
     * @returns {Promise<any>} parsed JSON answer
     */
    async api(method, path, body) {
        const data = body === undefined ? undefined : JSON.stringify(body);
        // No keep-alive: the module's web server serves one connection at a time
        // and would hold an idle one open, stalling every other client (seen as
        // 5 s stalls and timeouts). fetch() can't turn that off, http can.
        const { status, text } = await new Promise((resolve, reject) => {
            const req = http.request(
                this.base + path,
                {
                    method,
                    agent: false,
                    timeout: TIMEOUT_MS,
                    headers: {
                        Authorization: this.auth,
                        Connection: 'close',
                        ...(data
                            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
                            : {}),
                    },
                },
                res => {
                    let t = '';
                    res.setEncoding('utf8');
                    res.on('data', c => (t += c));
                    res.on('end', () => resolve({ status: res.statusCode || 0, text: t }));
                },
            );
            req.on('timeout', () => req.destroy(new Error('no answer within 8 seconds')));
            req.on('error', reject);
            req.end(data);
        });
        let json;
        try {
            json = text ? JSON.parse(text) : {};
        } catch {
            json = {};
        }
        if (status < 200 || status >= 300) {
            throw new Error(this.explain(status, json.error || text));
        }
        return json;
    }

    /**
     * Turns an HTTP error into a hint the user can act on.
     *
     * @param {number} status - HTTP status
     * @param {string} detail - error text of the module
     */
    explain(status, detail) {
        switch (status) {
            case 401:
                return 'API key wrong or deleted (module: expert mode page, card API)';
            case 403:
                return `${detail || 'forbidden'} (module: expert mode page, card API; the key needs "read and control")`;
            case 404:
                return 'no API found: the module needs software 2.1.0 or newer';
            case 429:
                return 'too many wrong API keys, the module waits 30 seconds';
            default:
                return `HTTP ${status} ${detail}`.trim();
        }
    }

    async poll() {
        this.clearTimeout(this.pollTimer);
        try {
            const [status, info, ss] = [
                await this.api('GET', '/api/v1/status'),
                await this.api('GET', '/api/v1/info'),
                await this.api('GET', '/api/v1/schedule'),
            ];
            const values = {
                ...valuesFrom(STATES, status),
                ...valuesFrom(INFO_STATES, info),
                ...scheduleValues(ss),
            };
            for (const [id, val] of Object.entries(values)) {
                if (this.lastValues[id] !== val) {
                    await this.setState(id, val, true);
                    this.lastValues[id] = val;
                }
            }
            await this.setState('info.connection', true, true);
            this.lastProblem = '';
        } catch (e) {
            await this.setState('info.connection', false, true);
            // say it once, not every 10 seconds
            if (e.message !== this.lastProblem) {
                this.log.warn(`WifiWhirl module: ${e.message}`);
                this.lastProblem = e.message;
            }
        }
        this.pollTimer = this.setTimeout(() => this.poll(), this.interval);
    }

    /** Fetch fresh values shortly after a command, the module needs a moment. */
    pollSoon() {
        this.clearTimeout(this.pollTimer);
        this.pollTimer = this.setTimeout(() => this.poll(), 1500);
    }

    /**
     * @param {string} id - full state id
     * @param {ioBroker.State | null | undefined} state - new state
     */
    async onStateChange(id, state) {
        if (!state || state.ack) {
            return;
        }
        const local = id.slice(this.namespace.length + 1);
        try {
            if (local === 'smartSchedule.start') {
                const get = async k => (await this.getStateAsync(`smartSchedule.${k}`))?.val;
                const r = scheduleBody(
                    await get('targetTime'),
                    await get('targetTemperature'),
                    await get('afterTarget'),
                );
                if (r.error) {
                    this.log.warn(`Smart Schedule not started: ${r.error}`);
                    return;
                }
                await this.api('POST', '/api/v1/schedule', r.body);
                this.log.info('Smart Schedule started');
                this.pollSoon();
            } else if (local === 'smartSchedule.cancel') {
                await this.api('DELETE', '/api/v1/schedule');
                this.pollSoon();
            } else if (local.startsWith('smartSchedule.')) {
                await this.setState(local, state.val, true); // inputs are kept until "start"
            } else {
                const req = requestFor(local, state.val);
                if (!req) {
                    this.log.warn(`Invalid value for ${local}: ${state.val}`);
                    return;
                }
                await this.api('POST', req.path, req.body);
                this.pollSoon();
            }
        } catch (e) {
            this.log.warn(`Command ${local} failed: ${e.message}`);
        }
    }

    /** @param {() => void} callback - Callback function */
    onUnload(callback) {
        try {
            this.clearTimeout(this.pollTimer);
            callback();
        } catch {
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = options => new WifiWhirl(options);
} else {
    new WifiWhirl();
}
