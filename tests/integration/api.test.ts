import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import type { Express } from 'express';
import { Pool } from 'pg';
import request from 'supertest';

const exec = promisify(execFile);
const schema = `chrono_test_${randomUUID().replaceAll('-', '')}`;
let pool: Pool;
let prisma: typeof import('../../src/prisma/index.js').default;
let app: Express;
let token: string;
const password = 'chrono-test-password-only';
const auth = () => ({ Authorization: `Bearer ${token}` });

before(
    async () => {
        assert.ok(
            process.env.TEST_DATABASE_URL,
            'Defina TEST_DATABASE_URL para um PostgreSQL de desenvolvimento.',
        );
        const url = new URL(process.env.TEST_DATABASE_URL);
        url.searchParams.delete('schema');
        pool = new Pool({ connectionString: url.toString() });
        await pool.query(`CREATE SCHEMA "${schema}"`);
        url.searchParams.set('schema', schema);
        process.env.DATABASE_URL = url.toString();
        process.env.JWT_SECRET = 'chrono-integration-test-secret-not-for-production';
        process.env.ADMIN_PASSWORD = password;
        process.env.NODE_ENV = 'test';
        await exec(
            process.execPath,
            [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
            { env: process.env },
        );
        await exec(
            process.execPath,
            [resolve('node_modules/tsx/dist/cli.mjs'), 'src/seeds/admin.ts'],
            { env: process.env },
        );
        prisma = (await import('../../src/prisma/index.js')).default;
        app = (await import('../../src/server.js')).createApp();
        const response = await request(app).post('/auth/login').send({ password }).expect(200);
        token = response.body.token;
    },
    { timeout: 60_000 },
);

after(async () => {
    await prisma?.$disconnect();
    if (pool) {
        assert.match(schema, /^chrono_test_[a-f0-9]{32}$/);
        await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await pool.end();
    }
});

test('password-only authentication, validation, and missing credentials', async () => {
    await request(app).get('/calendar?from=2030-01-01&to=2030-01-07').expect(401);
    await request(app).post('/auth/login').send({ password: 'wrong' }).expect(401);
    await request(app)
        .post('/auth/login')
        .send({ password, email: 'unexpected@example.com' })
        .expect(400);
    const me = await request(app).get('/auth/me').set(auth()).expect(200);
    assert.equal(me.body.timezone, 'America/Sao_Paulo');
    assert.equal(me.body.passwordHash, undefined);
});

test('multiple events share date/time; types and completion are independent', async () => {
    const payload = {
        title: 'Overlapping activity',
        date: '2030-01-07',
        startTime: '14:00',
        endTime: '15:00',
    };
    const event = await request(app)
        .post('/events')
        .set(auth())
        .send({ ...payload, type: 'EVENT' })
        .expect(201);
    const task = await request(app)
        .post('/events')
        .set(auth())
        .send({ ...payload, type: 'TASK' })
        .expect(201);
    assert.notEqual(event.body.id, task.body.id);
    const completed = await request(app)
        .patch(`/events/${event.body.id}`)
        .set(auth())
        .send({ status: 'COMPLETED' })
        .expect(200);
    const repeated = await request(app)
        .patch(`/events/${event.body.id}`)
        .set(auth())
        .send({ status: 'COMPLETED' })
        .expect(200);
    assert.equal(repeated.body.completedAt, completed.body.completedAt);
    const opened = await request(app)
        .patch(`/events/${event.body.id}`)
        .set(auth())
        .send({ status: 'PENDING' })
        .expect(200);
    assert.equal(opened.body.completedAt, null);
    await request(app)
        .patch(`/events/${task.body.id}`)
        .set(auth())
        .send({ startTime: '16:00' })
        .expect(400);
    const preserved = await request(app).get(`/events/${task.body.id}`).set(auth()).expect(200);
    assert.equal(preserved.body.startTime, '14:00');
});

test('invalid dates, times, intervals and arbitrary occurrence dates are rejected', async () => {
    await request(app)
        .post('/events')
        .set(auth())
        .send({ title: 'Invalid', date: '2030-02-30' })
        .expect(400);
    await request(app)
        .post('/events')
        .set(auth())
        .send({ title: 'Invalid', date: '2030-02-01', endTime: '10:00' })
        .expect(400);
    await request(app).get('/calendar?from=2030-01-01&to=2032-01-01').set(auth()).expect(400);
    await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({ title: 'Invalid', startDate: '2030-01-01', frequency: 'DAILY', interval: 0 })
        .expect(400);
    await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({
            title: 'Invalid',
            startDate: '2030-01-01',
            frequency: 'DAILY',
            count: 3,
            until: '2030-02-01',
        })
        .expect(400);
});

test('calendar expands recurrence without writes and reflects only a saved occurrence change', async () => {
    const created = await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({
            title: 'Study',
            description: 'Weekly plan',
            type: 'TASK',
            startDate: '2030-02-04',
            frequency: 'WEEKLY',
            startTime: '19:00',
            endTime: '20:00',
        })
        .expect(201);
    const id = created.body.id;
    const beforeCount = await prisma.recurringOccurrence.count();
    const calendar = await request(app)
        .get('/calendar?from=2030-02-01&to=2030-02-28')
        .set(auth())
        .expect(200);
    assert.equal(
        calendar.body.items.filter(
            (item: { recurringEventId: string }) => item.recurringEventId === id,
        ).length,
        4,
    );
    assert.equal(await prisma.recurringOccurrence.count(), beforeCount);
    await request(app)
        .patch(`/recurring-events/${id}/occurrences/2030-02-05`)
        .set(auth())
        .send({ status: 'COMPLETED' })
        .expect(404);
    const changed = await request(app)
        .patch(`/recurring-events/${id}/occurrences/2030-02-04`)
        .set(auth())
        .send({
            typeOverride: 'EVENT',
            titleOverride: 'Conversation',
            descriptionOverride: '',
            status: 'COMPLETED',
            timeOverride: { startTime: null, endTime: null },
        })
        .expect(200);
    assert.equal(changed.body.type, 'EVENT');
    assert.equal(changed.body.description, '');
    assert.equal(changed.body.startTime, null);
    const next = await request(app)
        .get(`/recurring-events/${id}/occurrences/2030-02-11`)
        .set(auth())
        .expect(200);
    assert.equal(next.body.type, 'TASK');
    assert.equal(next.body.status, 'PENDING');
    const inherited = await request(app)
        .patch(`/recurring-events/${id}/occurrences/2030-02-04`)
        .set(auth())
        .send({
            typeOverride: null,
            titleOverride: null,
            descriptionOverride: null,
            timeOverride: null,
        })
        .expect(200);
    assert.equal(inherited.body.title, 'Study');
    assert.equal(inherited.body.startTime, '19:00');
    assert.equal(inherited.body.status, 'COMPLETED');
});

test('rescheduling includes moved-in occurrences and suppresses original and moved-out dates', async () => {
    const created = await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({ title: 'Moved', startDate: '2030-03-01', frequency: 'MONTHLY' })
        .expect(201);
    const id = created.body.id;
    await request(app)
        .patch(`/recurring-events/${id}/occurrences/2030-03-01`)
        .set(auth())
        .send({ scheduledDate: '2030-04-15' })
        .expect(200);
    const march = await request(app)
        .get('/calendar?from=2030-03-01&to=2030-03-31')
        .set(auth())
        .expect(200);
    assert.equal(
        march.body.items.filter(
            (item: { recurringEventId: string }) => item.recurringEventId === id,
        ).length,
        0,
    );
    const april = await request(app)
        .get('/calendar?from=2030-04-01&to=2030-04-30')
        .set(auth())
        .expect(200);
    const items = april.body.items.filter(
        (item: { recurringEventId: string }) => item.recurringEventId === id,
    );
    assert.deepEqual(
        items.map((item: { date: string }) => item.date),
        ['2030-04-01', '2030-04-15'],
    );
    assert.equal(items[1].occurrenceDate, '2030-03-01');
});

test('template application is additive, concurrent-safe, idempotent and independent', async () => {
    const template = await request(app)
        .post('/week-templates')
        .set(auth())
        .send({
            name: 'Normal week',
            items: [
                { weekday: 1, title: 'Template task', type: 'TASK', startTime: '14:00' },
                { weekday: 2, title: 'Template event', type: 'EVENT' },
            ],
        })
        .expect(201);
    const id = template.body.id;
    const responses = await Promise.all(
        Array.from({ length: 3 }, () =>
            request(app)
                .post(`/week-templates/${id}/apply`)
                .set(auth())
                .send({ weekStart: '2030-01-07' }),
        ),
    );
    assert.deepEqual(responses.map((value) => value.status).sort(), [200, 200, 201]);
    assert.equal(new Set(responses.map((value) => value.body.id)).size, 1);
    const applicationId = responses[0]!.body.id;
    assert.equal(await prisma.event.count({ where: { templateApplicationId: applicationId } }), 2);
    const week = await request(app)
        .get('/calendar?from=2030-01-07&to=2030-01-13')
        .set(auth())
        .expect(200);
    assert.equal(week.body.items.length, 4);
    await request(app).patch(`/week-templates/${id}`).set(auth()).send({ items: [] }).expect(200);
    assert.equal(await prisma.event.count({ where: { templateApplicationId: applicationId } }), 2);
    await request(app)
        .post(`/week-templates/${id}/apply`)
        .set(auth())
        .send({ weekStart: '2030-01-08' })
        .expect(400);
    await request(app).delete(`/week-templates/${id}`).set(auth()).expect(204);
    assert.equal(await prisma.event.count({ where: { templateApplicationId: applicationId } }), 2);
});

test('simultaneous updates of one occurrence keep one record and independent field changes', async () => {
    const response = await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({ title: 'Concurrent', startDate: '2030-06-01', frequency: 'DAILY' })
        .expect(201);
    const id = response.body.id;
    const responses = await Promise.all([
        request(app)
            .patch(`/recurring-events/${id}/occurrences/2030-06-01`)
            .set(auth())
            .send({ status: 'COMPLETED' }),
        request(app)
            .patch(`/recurring-events/${id}/occurrences/2030-06-01`)
            .set(auth())
            .send({ descriptionOverride: 'Kept' }),
    ]);
    assert.deepEqual(
        responses.map((value) => value.status),
        [200, 200],
    );
    const saved = await request(app)
        .get(`/recurring-events/${id}/occurrences/2030-06-01`)
        .set(auth())
        .expect(200);
    assert.equal(saved.body.status, 'COMPLETED');
    assert.equal(saved.body.description, 'Kept');
    assert.equal(await prisma.recurringOccurrence.count({ where: { recurringEventId: id } }), 1);
});

test('series split preserves historical content, monthly anchor and completed future work', async () => {
    const response = await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({ title: 'Original', startDate: '2031-01-31', frequency: 'MONTHLY' })
        .expect(201);
    const id = response.body.id;
    await request(app)
        .patch(`/recurring-events/${id}/occurrences/2031-01-31`)
        .set(auth())
        .send({ status: 'COMPLETED' })
        .expect(200);
    await request(app)
        .patch(`/recurring-events/${id}/occurrences/2031-03-31`)
        .set(auth())
        .send({ status: 'COMPLETED' })
        .expect(200);
    const split = await request(app)
        .post(`/recurring-events/${id}/split`)
        .set(auth())
        .send({ fromDate: '2031-02-28', changes: { title: 'Updated' } })
        .expect(201);
    assert.equal(split.body.startDate, '2031-01-31');
    const calendar = await request(app)
        .get('/calendar?from=2031-01-01&to=2031-04-30')
        .set(auth())
        .expect(200);
    const items = calendar.body.items.filter(
        (item: { seriesId: string }) => item.seriesId === split.body.seriesId,
    );
    assert.deepEqual(
        items.map((item: { date: string; title: string }) => [item.date, item.title]),
        [
            ['2031-01-31', 'Original'],
            ['2031-02-28', 'Updated'],
            ['2031-03-31', 'Original'],
            ['2031-04-30', 'Updated'],
        ],
    );
});

test('incompatible future edits return conflicts and roll back without losing saved states', async () => {
    const response = await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({ title: 'Conflict', startDate: '2033-01-01', frequency: 'DAILY' })
        .expect(201);
    const id = response.body.id;
    await request(app)
        .patch(`/recurring-events/${id}/occurrences/2033-01-02`)
        .set(auth())
        .send({ titleOverride: 'Keep me' })
        .expect(200);
    const conflict = await request(app)
        .post(`/recurring-events/${id}/split`)
        .set(auth())
        .send({ fromDate: '2033-01-01', changes: { interval: 2 } })
        .expect(409);
    assert.equal(conflict.body.error.code, 'OCCURRENCE_CONFLICT');
    assert.equal(await prisma.recurringEvent.count({ where: { previousId: id } }), 0);
    const saved = await request(app)
        .get(`/recurring-events/${id}/occurrences/2033-01-02`)
        .set(auth())
        .expect(200);
    assert.equal(saved.body.title, 'Keep me');
    await request(app)
        .post(`/recurring-events/${id}/end`)
        .set(auth())
        .send({ fromDate: '2033-01-02' })
        .expect(409);
    await request(app)
        .delete(`/recurring-events/${id}/occurrences/2033-01-02/state`)
        .set(auth())
        .expect(200);
    await request(app)
        .post(`/recurring-events/${id}/end`)
        .set(auth())
        .send({ fromDate: '2033-01-02' })
        .expect(200);
    await request(app)
        .get(`/recurring-events/${id}/occurrences/2033-01-02`)
        .set(auth())
        .expect(404);
    await request(app)
        .get(`/recurring-events/${id}/occurrences/2033-01-01`)
        .set(auth())
        .expect(200);
});

test('seed preserves existing password; reset invalidates old JWTs', async () => {
    const originalHash = (await prisma.user.findUniqueOrThrow({ where: { singletonKey: 1 } }))
        .passwordHash;
    const newPassword = 'chrono-new-test-password';
    await exec(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'src/seeds/admin.ts'], {
        env: { ...process.env, ADMIN_PASSWORD: newPassword },
    });
    assert.equal(
        (await prisma.user.findUniqueOrThrow({ where: { singletonKey: 1 } })).passwordHash,
        originalHash,
    );
    await exec(
        process.execPath,
        [resolve('node_modules/tsx/dist/cli.mjs'), 'src/seeds/reset-password.ts'],
        { env: { ...process.env, ADMIN_PASSWORD: newPassword } },
    );
    await request(app).get('/auth/me').set(auth()).expect(401);
    await request(app).post('/auth/login').send({ password }).expect(401);
    const login = await request(app)
        .post('/auth/login')
        .send({ password: newPassword })
        .expect(200);
    token = login.body.token;
    await request(app).get('/auth/me').set(auth()).expect(200);
});

test('recurring list filters active and historical segments before pagination', async () => {
    const { today, addDays, dateString } = await import('../../src/domain/dates.js');
    const boundary = today('America/Sao_Paulo');
    const tomorrow = dateString(addDays(boundary, 1));
    const yesterday = dateString(addDays(boundary, -1));
    const active = await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({ title: 'Filter active series', startDate: tomorrow, frequency: 'DAILY' })
        .expect(201);
    const exhausted = await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({
            title: 'Filter exhausted series',
            startDate: yesterday,
            frequency: 'DAILY',
            count: 1,
        })
        .expect(201);
    const ended = await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({ title: 'Filter ended series', startDate: tomorrow, frequency: 'DAILY' })
        .expect(201);
    await request(app)
        .post(`/recurring-events/${ended.body.id}/end`)
        .set(auth())
        .send({ fromDate: tomorrow })
        .expect(200);
    const split = await request(app)
        .post(`/recurring-events/${active.body.id}/split`)
        .set(auth())
        .send({ fromDate: tomorrow, changes: { title: 'Filter current segment' } })
        .expect(201);
    const current = await request(app)
        .get('/recurring-events?status=active&limit=100')
        .set(auth())
        .expect(200);
    const history = await request(app)
        .get('/recurring-events?status=history&limit=100')
        .set(auth())
        .expect(200);
    const all = await request(app)
        .get('/recurring-events?status=all&limit=100')
        .set(auth())
        .expect(200);
    const currentIds = current.body.items.map((item: { id: string }) => item.id);
    const historyIds = history.body.items.map((item: { id: string }) => item.id);
    assert.ok(currentIds.includes(split.body.id));
    for (const id of [active.body.id, exhausted.body.id, ended.body.id]) {
        assert.ok(historyIds.includes(id));
        assert.ok(!currentIds.includes(id));
    }
    assert.equal(current.body.total + history.body.total, all.body.total);
    const defaultList = await request(app)
        .get('/recurring-events?limit=100')
        .set(auth())
        .expect(200);
    assert.deepEqual(defaultList.body, current.body);
    for (const status of ['active', 'history']) {
        const full = status === 'active' ? current : history;
        const page = await request(app)
            .get(`/recurring-events?status=${status}&page=2&limit=1`)
            .set(auth())
            .expect(200);
        assert.equal(page.body.total, full.body.total);
        assert.equal(page.body.items[0].id, full.body.items[1].id);
    }
    await request(app).get('/recurring-events?status=invalid').set(auth()).expect(400);
    await request(app)
        .get('/recurring-events?status=active&status=history')
        .set(auth())
        .expect(400);
});

test('ending future repetitions preserves today and remains historical on fresh requests', async () => {
    const { today, addDays, dateString } = await import('../../src/domain/dates.js');
    const boundary = today('America/Sao_Paulo');
    const currentDate = dateString(boundary);
    const tomorrow = dateString(addDays(boundary, 1));
    const rule = await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({
            title: 'End future repetitions regression',
            startDate: currentDate,
            frequency: 'DAILY',
        })
        .expect(201);
    const saved = await request(app)
        .patch(`/recurring-events/${rule.body.id}/occurrences/${currentDate}`)
        .set(auth())
        .send({ status: 'PENDING', scheduledDate: tomorrow })
        .expect(200);
    // Selecting today conflicts with saved work; cutting future days preserves it.
    await request(app)
        .post(`/recurring-events/${rule.body.id}/end`)
        .set(auth())
        .send({ fromDate: currentDate })
        .expect(409);
    const ended = await request(app)
        .post(`/recurring-events/${rule.body.id}/end`)
        .set(auth())
        .send({ fromDate: tomorrow })
        .expect(200);
    assert.equal(ended.body.effectiveUntil, currentDate);
    const detail = await request(app)
        .get(`/recurring-events/${rule.body.id}`)
        .set(auth())
        .expect(200);
    assert.equal(detail.body.isActive, false);
    const calendar = await request(app)
        .get(`/calendar?from=${tomorrow}&to=${tomorrow}`)
        .set(auth())
        .expect(200);
    const moved = calendar.body.items.find((item: { id: string }) => item.id === saved.body.id);
    assert.equal(moved.occurrenceDate, currentDate);
    assert.equal(moved.date, tomorrow);
    assert.equal(moved.status, 'PENDING');

    const repeated = await request(app)
        .post(`/recurring-events/${rule.body.id}/end`)
        .set(auth())
        .send({ fromDate: tomorrow })
        .expect(200);
    assert.deepEqual(repeated.body, ended.body);
    for (let refresh = 0; refresh < 2; refresh++) {
        const current = await request(app)
            .get('/recurring-events?status=active&limit=100')
            .set(auth())
            .expect(200);
        const history = await request(app)
            .get('/recurring-events?status=history&limit=100')
            .set(auth())
            .expect(200);
        assert.ok(!current.body.items.some((item: { id: string }) => item.id === rule.body.id));
        assert.ok(history.body.items.some((item: { id: string }) => item.id === rule.body.id));
    }
    const preserved = await request(app)
        .get(`/recurring-events/${rule.body.id}/occurrences/${currentDate}`)
        .set(auth())
        .expect(200);
    assert.equal(preserved.body.id, saved.body.id);
    assert.equal(preserved.body.status, 'PENDING');
    await request(app)
        .get(`/recurring-events/${rule.body.id}/occurrences/${tomorrow}`)
        .set(auth())
        .expect(404);
});

test('editing future dates preserves today instead of including it in the split', async () => {
    const { today, addDays, dateString } = await import('../../src/domain/dates.js');
    const boundary = today('America/Sao_Paulo');
    const currentDate = dateString(boundary);
    const tomorrow = dateString(addDays(boundary, 1));
    const newDate = dateString(addDays(boundary, 2));
    const rule = await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({
            title: 'Edit future repetitions regression',
            startDate: currentDate,
            frequency: 'DAILY',
            count: 3,
        })
        .expect(201);
    const saved = await request(app)
        .patch(`/recurring-events/${rule.body.id}/occurrences/${currentDate}`)
        .set(auth())
        .send({ status: 'COMPLETED', titleOverride: 'Preserved completed work' })
        .expect(200);
    await request(app)
        .post(`/recurring-events/${rule.body.id}/split`)
        .set(auth())
        .send({ fromDate: currentDate, changes: { startDate: newDate } })
        .expect(409);
    const changed = await request(app)
        .post(`/recurring-events/${rule.body.id}/split`)
        .set(auth())
        .send({ fromDate: tomorrow, changes: { startDate: newDate } })
        .expect(201);
    const oldDetail = await request(app)
        .get(`/recurring-events/${rule.body.id}`)
        .set(auth())
        .expect(200);
    const newDetail = await request(app)
        .get(`/recurring-events/${changed.body.id}`)
        .set(auth())
        .expect(200);
    assert.equal(oldDetail.body.isActive, false);
    assert.equal(newDetail.body.isActive, true);
    assert.equal(changed.body.startDate, newDate);
    assert.equal(changed.body.count, 2);
    const preserved = await request(app)
        .get(`/recurring-events/${rule.body.id}/occurrences/${currentDate}`)
        .set(auth())
        .expect(200);
    assert.equal(preserved.body.id, saved.body.id);
    assert.equal(preserved.body.title, 'Preserved completed work');
    assert.equal(preserved.body.completedAt, saved.body.completedAt);
    await request(app)
        .get(`/recurring-events/${changed.body.id}/occurrences/${newDate}`)
        .set(auth())
        .expect(200);
});


test('deleting one recurring day removes moved details without recreating the original day', async () => {
    const rule = await request(app).post('/recurring-events').set(auth()).send({
        title: 'Delete only one day', type: 'TASK', startDate: '2035-01-01', frequency: 'DAILY', interval: 1,
    }).expect(201);
    const path = `/recurring-events/${rule.body.id}/occurrences/2035-01-02`;
    await request(app).patch(path).set(auth()).send({ scheduledDate: '2035-01-04', titleOverride: 'Moved', status: 'CANCELED' }).expect(200);
    await request(app).delete(path).expect(401);
    await request(app).delete(path).set(auth()).expect(204);
    await request(app).delete(path).set(auth()).expect(204);
    await request(app).get(path).set(auth()).expect(404);
    await request(app).patch(path).set(auth()).send({ status: 'PENDING' }).expect(404);
    await request(app).delete(`${path}/state`).set(auth()).expect(404);
    const calendar = await request(app).get('/calendar?from=2035-01-01&to=2035-01-04').set(auth()).expect(200);
    const items = calendar.body.items.filter((item: { recurringEventId?: string }) => item.recurringEventId === rule.body.id);
    assert.deepEqual(items.map((item: { occurrenceDate: string }) => item.occurrenceDate), ['2035-01-01', '2035-01-03', '2035-01-04']);
    const saved = await prisma.recurringOccurrence.findFirstOrThrow({ where: { recurringEventId: rule.body.id } });
    assert.equal(saved.deleted, true);
    assert.equal(saved.titleOverride, null);
    assert.equal(saved.descriptionOverride, null);
    assert.equal(saved.completedAt, null);
});

test('delete historical recurrence removes saved and virtual occurrences with access checks', async () => {
    const rule = await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({
            title: 'Delete exhausted history',
            startDate: '2020-01-01',
            frequency: 'DAILY',
            count: 3,
        })
        .expect(201);
    const path = `/recurring-events/${rule.body.id}`;
    await request(app)
        .patch(`${path}/occurrences/2020-01-01`)
        .set(auth())
        .send({
            status: 'COMPLETED',
            scheduledDate: '2020-01-05',
        })
        .expect(200);
    await request(app).delete(`${path}/occurrences/2020-01-02`).set(auth()).expect(204);
    await request(app).delete(path).expect(401);
    await request(app).delete('/recurring-events/not-a-uuid').set(auth()).expect(400);
    await request(app).delete(`/recurring-events/${randomUUID()}`).set(auth()).expect(404);
    const { DeleteRecurringEventService } =
        await import('../../src/services/recurring-event/delete-recurring-event.service.js');
    await assert.rejects(new DeleteRecurringEventService().execute(randomUUID(), rule.body.id), {
        code: 'NOT_FOUND',
    });
    await request(app).delete(path).set(auth()).expect(204);
    assert.equal(
        await prisma.recurringOccurrence.count({ where: { recurringEventId: rule.body.id } }),
        0,
    );
    await request(app).get(path).set(auth()).expect(404);
    await request(app).delete(path).set(auth()).expect(404);
    const calendar = await request(app)
        .get('/calendar?from=2020-01-01&to=2020-01-07')
        .set(auth())
        .expect(200);
    assert.ok(
        !calendar.body.items.some(
            (item: { recurringEventId?: string }) => item.recurringEventId === rule.body.id,
        ),
    );
    const history = await request(app)
        .get('/recurring-events?status=history&limit=100')
        .set(auth())
        .expect(200);
    assert.ok(!history.body.items.some((item: { id: string }) => item.id === rule.body.id));
});

test('delete rejects active recurrence and reconnects surviving segments', async () => {
    const { today, addDays, dateString } = await import('../../src/domain/dates.js');
    const boundary = today('America/Sao_Paulo');
    const first = await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({
            title: 'Keep neighboring segments',
            startDate: dateString(boundary),
            frequency: 'DAILY',
        })
        .expect(201);
    const second = await request(app)
        .post(`/recurring-events/${first.body.id}/split`)
        .set(auth())
        .send({
            fromDate: dateString(addDays(boundary, 2)),
            changes: { title: 'Remove middle segment' },
        })
        .expect(201);
    const third = await request(app)
        .post(`/recurring-events/${second.body.id}/split`)
        .set(auth())
        .send({
            fromDate: dateString(addDays(boundary, 4)),
            changes: { title: 'Keep current segment' },
        })
        .expect(201);
    const active = await request(app)
        .delete(`/recurring-events/${third.body.id}`)
        .set(auth())
        .expect(409);
    assert.equal(active.body.error.code, 'RECURRENCE_ACTIVE');
    const previousBefore = await prisma.recurringEvent.findUniqueOrThrow({
        where: { id: first.body.id },
    });
    await request(app).delete(`/recurring-events/${second.body.id}`).set(auth()).expect(204);
    const surviving = await request(app)
        .get(`/recurring-events/${third.body.id}`)
        .set(auth())
        .expect(200);
    assert.equal(surviving.body.previousId, first.body.id);
    assert.equal(surviving.body.seriesId, first.body.seriesId);
    assert.equal(surviving.body.effectiveFrom, third.body.effectiveFrom);
    assert.equal(surviving.body.isActive, true);
    assert.deepEqual(
        await prisma.recurringEvent.findUniqueOrThrow({ where: { id: first.body.id } }),
        previousBefore,
    );
    await request(app).delete(`/recurring-events/${first.body.id}`).set(auth()).expect(204);
    const root = await request(app)
        .get(`/recurring-events/${third.body.id}`)
        .set(auth())
        .expect(200);
    assert.equal(root.body.previousId, null);
    assert.equal(root.body.seriesId, first.body.seriesId);
});

test('concurrent historical segment deletions preserve the active continuation', async () => {
    const { today, addDays, dateString } = await import('../../src/domain/dates.js');
    const boundary = today('America/Sao_Paulo');
    const first = await request(app)
        .post('/recurring-events')
        .set(auth())
        .send({
            title: 'Concurrent history removal',
            startDate: dateString(boundary),
            frequency: 'DAILY',
        })
        .expect(201);
    const second = await request(app)
        .post(`/recurring-events/${first.body.id}/split`)
        .set(auth())
        .send({
            fromDate: dateString(addDays(boundary, 1)),
            changes: { title: 'Concurrent continuation' },
        })
        .expect(201);
    const third = await request(app)
        .post(`/recurring-events/${second.body.id}/split`)
        .set(auth())
        .send({
            fromDate: dateString(addDays(boundary, 2)),
            changes: { title: 'Concurrent continuation' },
        })
        .expect(201);
    await Promise.all(
        [first, second].map((rule) =>
            request(app).delete(`/recurring-events/${rule.body.id}`).set(auth()).expect(204),
        ),
    );
    const remaining = await request(app)
        .get(`/recurring-events/${third.body.id}`)
        .set(auth())
        .expect(200);
    assert.equal(remaining.body.previousId, null);
    assert.equal(remaining.body.isActive, true);
});
