import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
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

test('a private sentinel never reaches sync storage or the wire', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'vaayvu-sentinel-'));
  const database = join(dir, 'sync.sqlite');
  const server = createSyncService({ database, ollamaUrl: 'http://127.0.0.1:1', ollamaModel: 'sentinel-model' });
  t.after(async () => { if (server.listening) await close(server); await rm(dir, { recursive: true, force: true }); });
  const request = client(await start(server));
  const credentials = { username: 'sentinel-user', password: 'a unique sentinel password' };
  const token = (await request('register', credentials)).value.token;
  const sentinel = 'PRIVATE-SENTINEL-7f4c2a9e';
  const regular = { title: 'Regular article', url: 'https://example.org/regular' };
  const privateEntry = { title: 'Private article', url: 'https://example.org/' + sentinel, private: true };

  assert.equal((await request('sync', { bookmarks: [], device: { id: 'laptop', name: 'Laptop', tabs: [regular, privateEntry] } }, token)).status, 400);
  assert.equal((await request('send', { from: 'laptop', to: 'phone', page: privateEntry }, token)).status, 400);
  assert.equal((await request('ask', { question: 'What is this?', text: sentinel, private: true }, token)).status, 400);
  assert.equal((await request('sync', { bookmarks: [], device: { id: 'laptop', name: 'Laptop', tabs: [regular] } }, token)).status, 200);

  for (const name of await readdir(dir)) {
    const bytes = await readFile(join(dir, name));
    assert.equal(bytes.includes(Buffer.from(sentinel)), false, 'private sentinel absent from ' + name);
  }
  const snapshot = (await request('sync', undefined, token)).value;
  assert.equal(JSON.stringify(snapshot).includes(sentinel), false, 'private sentinel absent from snapshot');
  assert.equal(JSON.stringify(snapshot).includes('example.org/regular'), true, 'regular URL is stored');
});
