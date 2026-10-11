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
