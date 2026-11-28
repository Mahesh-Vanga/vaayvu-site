import assert from 'node:assert/strict';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSyncService } from './server.mjs';

async function start(server) {
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port;
}
const close = (server) => new Promise((resolve) => server.close(resolve));
function client(base) {
  return async (path, body, token) => {
    const response = await fetch(base + '/v1/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
      body: JSON.stringify(body),
    });
    return { status: response.status, value: await response.json() };
  };
}
const credentials = { username: 'chaos-user', password: 'a unique chaos password' };
const page = { title: 'Article', url: 'https://example.org/article' };
const book = (id, updatedAt, extra = {}) => ({ id, ...page, updatedAt, ...extra });
const device = (id) => ({ id, name: id, tabs: [] });

test('an offline device catches up across a restart and sees tombstones', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'vaayvu-chaos-'));
  const database = join(dir, 'sync.sqlite');
  let server = createSyncService({ database });
  t.after(async () => { if (server.listening) await close(server); await rm(dir, { recursive: true, force: true }); });
  let request = client(await start(server));
  const token = (await request('register', credentials)).value.token;
  const other = (await request('login', credentials)).value.token;
  await request('sync', { bookmarks: [book('a', 100), book('b', 101)], device: device('laptop') }, token);
  await request('sync', { bookmarks: [], device: device('phone') }, other);

  // Laptop makes changes while the phone is offline.
  await request('sync', { bookmarks: [book('a', 100, { deleted: true }), book('c', 102)], device: device('laptop') }, token);
  await close(server);
  server = createSyncService({ database });
  request = client(await start(server));
  const phone = (await request('login', credentials)).value.token;
  const snapshot = (await request('sync', undefined, phone)).value;
  assert.deepEqual(snapshot.bookmarks.find((b) => b.id === 'a'), { id: 'a', title: '', url: '', updatedAt: 100, deleted: true });
  assert.ok(snapshot.bookmarks.some((b) => b.id === 'b'));
  assert.ok(snapshot.bookmarks.some((b) => b.id === 'c'));
});

test('a stopped-service backup restores the whole multi-device state', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'vaayvu-backup-'));
  const database = join(dir, 'sync.sqlite');
  const backup = join(dir, 'backup.sqlite');
  let server = createSyncService({ database });
  t.after(async () => { if (server.listening) await close(server); await rm(dir, { recursive: true, force: true }); });
  let request = client(await start(server));
  const token = (await request('register', credentials)).value.token;
  await request('sync', { bookmarks: [book('a', 200), book('b', 201)], device: device('laptop') }, token);
  await request('sync', { bookmarks: [book('c', 202)], device: device('phone') }, token);
  await close(server);
  await copyFile(database, backup);

  server = createSyncService({ database: backup });
  request = client(await start(server));
  const restored = (await request('login', credentials)).value.token;
  const snapshot = (await request('sync', undefined, restored)).value;
  assert.deepEqual(snapshot.bookmarks.map((b) => b.id).sort(), ['a', 'b', 'c']);
  assert.deepEqual(snapshot.devices.map((d) => d.id).sort(), ['laptop', 'phone']);
});

test('a rejected batch leaves the previous snapshot intact and a corrupt database fails closed', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'vaayvu-partial-'));
  const database = join(dir, 'sync.sqlite');
  const corrupt = join(dir, 'corrupt.sqlite');
  let server = createSyncService({ database });
  t.after(async () => { if (server.listening) await close(server); await rm(dir, { recursive: true, force: true }); });
  const request = client(await start(server));
  const token = (await request('register', credentials)).value.token;
  await request('sync', { bookmarks: [book('safe', 300)], device: device('laptop') }, token);
  const rejected = await request(
    'sync',
    { bookmarks: [book('valid', 301), { id: 'bad', title: 'Bad', url: 'javascript:alert(1)', updatedAt: 302 }], device: device('phone') },
    token,
  );
  assert.equal(rejected.status, 400);
  assert.deepEqual((await request('sync', undefined, token)).value.bookmarks.map((b) => b.id), ['safe']);
  await close(server);

  await writeFile(corrupt, 'not a sqlite database');
  assert.throws(() => createSyncService({ database: corrupt }));
});

test('out-of-order writes and deletion ties keep one winning record', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'vaayvu-order-'));
  const database = join(dir, 'sync.sqlite');
  const server = createSyncService({ database });
  t.after(async () => { if (server.listening) await close(server); await rm(dir, { recursive: true, force: true }); });
  const request = client(await start(server));
  const token = (await request('register', credentials)).value.token;
  await request('sync', { bookmarks: [book('x', 400)], device: device('a') }, token);
  await request('sync', { bookmarks: [book('x', 399, { title: 'Older' })], device: device('b') }, token);
  assert.equal((await request('sync', undefined, token)).value.bookmarks[0].title, 'Article');
  await request('sync', { bookmarks: [book('x', 400, { deleted: true })], device: device('c') }, token);
  assert.deepEqual((await request('sync', undefined, token)).value.bookmarks[0], {
    id: 'x', title: '', url: '', updatedAt: 400, deleted: true,
  });
});
