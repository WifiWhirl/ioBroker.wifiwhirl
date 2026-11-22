'use strict';

const { expect } = require('chai');
const { STATES, INFO_STATES, SCHEDULE_STATES, valuesFrom, requestFor, scheduleBody, scheduleValues } = require('./lib/mapping');
const status = require('./test/fixtures/status.json'); // answer of /api/v1/status, firmware 2.1.0 (emulator)

describe('valuesFrom /api/v1/status', () => {
    const v = valuesFrom(STATES, status);

    it('reads temperatures and switches', () => {
        expect(v['status.waterTemperature']).to.equal(25);
        expect(v['control.targetTemperature']).to.equal(37);
        expect(v['control.pump']).to.equal(false);
        expect(v['control.power']).to.equal(true);
    });

    it('never-done maintenance is null, not 1970', () => {
        expect(v['maintenance.filterChanged']).to.equal(null);
        expect(v['maintenance.chlorine']).to.equal(1794433083000);
    });

    it('"ready in" null stays null', () => {
        expect(valuesFrom(STATES, { readyInHours: null })['status.readyInHours']).to.equal(null);
        expect(v['status.readyInHours']).to.equal(5.6);
    });

    it('fills every readable state from a real answer', () => {
        const missing = STATES.filter(s => s.get).map(s => s.id).filter(id => !(id in v));
        expect(missing).to.deep.equal([]);
    });

    it('ignores missing answers', () => {
        expect(valuesFrom(STATES, null)).to.deep.equal({});
        expect(valuesFrom(INFO_STATES, { firmware: '2.1.0' })['info.firmware']).to.equal('2.1.0');
    });
});

describe('requestFor', () => {
    it('switches send true/false to /controls', () => {
        expect(requestFor('control.pump', 1)).to.deep.equal({ path: '/api/v1/controls', body: { pump: true } });
        expect(requestFor('control.airjet', false)).to.deep.equal({ path: '/api/v1/controls', body: { bubbles: false } });
        expect(requestFor('control.heater', 'false')?.body).to.deep.equal({ heater: false });
        expect(requestFor('control.heater', 'abc')).to.equal(null);
    });

    it('numbers are checked', () => {
        expect(requestFor('control.targetTemperature', 38.4)?.body).to.deep.equal({ targetTemperature: 38 });
        expect(requestFor('control.targetTemperature', 45)).to.equal(null);
        expect(requestFor('control.brightness', 'abc')).to.equal(null);
    });

    it('maintenance buttons and water values', () => {
        expect(requestFor('maintenance.done.filterCleaned', true)).to.deep.equal({
            path: '/api/v1/maintenance',
            body: { done: ['filterCleaned'] },
        });
        expect(requestFor('waterQuality.ph', 7.4)).to.deep.equal({ path: '/api/v1/waterquality', body: { ph: 7.4 } });
        expect(requestFor('waterQuality.ph', 20)).to.equal(null);
    });

    it('read-only states give no request', () => {
        expect(requestFor('status.waterTemperature', 30)).to.equal(null);
    });
});

describe('Smart Schedule', () => {
    const now = new Date(2026, 11, 20, 12, 0).getTime();

    it('builds the API body from local time', () => {
        const r = scheduleBody('2026-12-24 19:00', 38, 1, now);
        expect(r.body).to.deep.equal({
            targetTime: Math.floor(new Date(2026, 11, 24, 19, 0).getTime() / 1000),
            targetTemperature: 38,
            afterTarget: 'pump',
        });
        expect(scheduleBody('2026-12-24 19:00', 38, 2, now).body?.afterTarget).to.equal('heater');
    });

    it('rejects bad input', () => {
        expect(scheduleBody('24.12.2026', 38, 0, now).error).to.be.a('string');
        expect(scheduleBody('2026-12-01 19:00', 38, 0, now).error).to.be.a('string');
        expect(scheduleBody('2026-12-24 19:00', 50, 0, now).error).to.be.a('string');
    });

    it('heating start only while active', () => {
        expect(scheduleValues({ active: true, heatingStart: 1798117200 })['smartSchedule.heatingStart']).to.equal(1798117200000);
        expect(scheduleValues({ active: false, heatingStart: 1798117200 })['smartSchedule.heatingStart']).to.equal(null);
    });
});

describe('object definitions (repochecker)', () => {
    const all = [...STATES, ...INFO_STATES, ...SCHEDULE_STATES];

    it('every name has all 11 ioBroker languages', () => {
        const langs = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];
        for (const s of all) {
            expect(Object.keys(s.name), s.id).to.include.members(langs);
        }
    });

    it('writable numbers use a level role, not value', () => {
        for (const s of all) {
            if (s.water || s.control) {
                expect(s.role, s.id).to.not.match(/^value/);
            }
        }
    });
});
