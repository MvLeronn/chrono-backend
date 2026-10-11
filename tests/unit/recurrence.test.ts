import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateString, parseDate, today, validDateString } from '../../src/domain/dates.js';
import {
    dateAt,
    expandRecurrence,
    occurrenceIndex,
    type RecurrenceRule,
} from '../../src/domain/recurrence.js';
import { completionTime } from '../../src/domain/activity.js';

function rule(
    start: string,
    frequency: RecurrenceRule['frequency'],
    extra: Partial<RecurrenceRule> = {},
): RecurrenceRule {
    return {
        startDate: parseDate(start),
        frequency,
        interval: 1,
        until: null,
        count: null,
        effectiveFrom: parseDate(start),
        effectiveUntil: null,
        ...extra,
    };
}
function dates(value: RecurrenceRule, from: string, to: string) {
    return expandRecurrence(value, parseDate(from), parseDate(to)).map(dateString);
}

test('monthly clamping preserves the original day instead of drifting', () => {
    assert.deepEqual(dates(rule('2026-01-31', 'MONTHLY'), '2026-01-01', '2026-05-31'), [
        '2026-01-31',
        '2026-02-28',
        '2026-03-31',
        '2026-04-30',
        '2026-05-31',
    ]);
});
test('yearly February 29 adapts and returns in leap years, including century rules', () => {
    assert.deepEqual(dates(rule('2024-02-29', 'YEARLY'), '2025-01-01', '2028-12-31'), [
        '2025-02-28',
        '2026-02-28',
        '2027-02-28',
        '2028-02-29',
    ]);
    assert.equal(dateString(dateAt(rule('2096-02-29', 'YEARLY'), 4)!), '2100-02-28');
});
test('every X days and every X weeks retain the date anchor', () => {
    assert.deepEqual(
        dates(rule('2026-10-12', 'DAILY', { interval: 3 }), '2026-10-13', '2026-10-21'),
        ['2026-10-15', '2026-10-18', '2026-10-21'],
    );
    assert.deepEqual(
        dates(rule('2026-10-12', 'WEEKLY', { interval: 2 }), '2026-10-01', '2026-11-09'),
        ['2026-10-12', '2026-10-26', '2026-11-09'],
    );
});
test('month intervals cross years without assuming a fixed number of days', () => {
    assert.deepEqual(
        dates(rule('2025-12-31', 'MONTHLY', { interval: 2 }), '2026-01-01', '2026-06-30'),
        ['2026-02-28', '2026-04-30', '2026-06-30'],
    );
});
test('until is inclusive and count uses original occurrences, not visible occurrences', () => {
    assert.deepEqual(
        dates(
            rule('2026-01-31', 'MONTHLY', { until: parseDate('2026-03-31') }),
            '2026-02-01',
            '2026-12-31',
        ),
        ['2026-02-28', '2026-03-31'],
    );
    assert.deepEqual(
        dates(rule('2026-01-31', 'MONTHLY', { count: 2 }), '2026-02-01', '2026-12-31'),
        ['2026-02-28'],
    );
});
test('segment boundaries do not change the original monthly anchor', () => {
    const value = rule('2026-01-31', 'MONTHLY', {
        effectiveFrom: parseDate('2026-02-28'),
        effectiveUntil: parseDate('2026-04-30'),
    });
    assert.deepEqual(dates(value, '2026-01-01', '2026-12-31'), [
        '2026-02-28',
        '2026-03-31',
        '2026-04-30',
    ]);
    assert.equal(occurrenceIndex(value, parseDate('2026-01-31')), null);
    assert.equal(occurrenceIndex(value, parseDate('2026-03-31')), 2);
    assert.equal(occurrenceIndex(value, parseDate('2026-03-28')), null);
});
test('distant queries seek directly, and the year 9999 boundary terminates', () => {
    assert.deepEqual(dates(rule('0001-01-01', 'DAILY'), '9999-12-29', '9999-12-31'), [
        '9999-12-29',
        '9999-12-30',
        '9999-12-31',
    ]);
    assert.deepEqual(dates(rule('9999-12-31', 'MONTHLY'), '9999-12-01', '9999-12-31'), [
        '9999-12-31',
    ]);
});
test('dates reject rollover and year zero; dates before year 100 are preserved', () => {
    for (const value of ['2026-02-29', '2026-04-31', '0000-01-01', '2026-1-01', 'invalid'])
        assert.equal(validDateString(value), false);
    assert.equal(dateString(parseDate('0001-01-01')), '0001-01-01');
});
test('today uses the planning timezone, not UTC or the server timezone', () => {
    assert.equal(
        dateString(today('America/Sao_Paulo', new Date('2026-10-12T01:00:00Z'))),
        '2026-10-11',
    );
});
test('completion is idempotent and reopening clears its timestamp', () => {
    const first = new Date('2026-10-12T12:00:00Z');
    const later = new Date('2026-10-12T13:00:00Z');
    assert.equal(completionTime('COMPLETED', first, later), first);
    assert.equal(completionTime('PENDING', first, later), null);
    assert.equal(completionTime('COMPLETED', null, later), later);
});
