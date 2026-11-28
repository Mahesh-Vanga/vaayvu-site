import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSyncService } from './server.mjs';

async function start(server) {
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port;
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function client(base) {
  return async (path, body, token, extraHeaders = {}) => {
    const response = await fetch(base + '/v1/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }), ...extraHeaders
      },
      body: JSON.stringify(body)
    });
    return { status: response.status, value: await response.json(), headers: response.headers };
  };
}

const credentials = { username: 'Vaayvu.User', password: 'unique test password!' };
const page = { title: 'Example', url: 'https://example.org/' };
const bookmark = { id: 'bookmark-1', ...page, updatedAt: 100 };
const laptop = { id: 'laptop', name: 'My Mac', tabs: [page] };
const phone = { id: 'phone', name: 'My phone', tabs: [] };

test('two devices merge, private pages stay out, accounts stay separate and sessions persist and revoke', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'vaayvu-sync-test-'));
  const database = join(dir, 'data.sqlite');
  let server = createSyncService({ database });
  t.after(async () => { if (server.listening) await close(server); await rm(dir, { recursive: true, force: true }); });
  let request = client(await start(server));
  assert.equal((await request('sync')).status, 401);
  const account = await request('register', credentials);
  assert.equal(account.status, 200);
  assert.equal(account.value.username, 'vaayvu.user');
  const first = account.value.token;
  assert.equal((await request('register', credentials)).status, 409);
  assert.equal((await request('login', { ...credentials, password: 'wrong password' })).status, 401);
  const second = (await request('login', credentials)).value.token;
  assert.ok(second && second !== first);
  const saved = await request('sync', { bookmarks: [bookmark], device: laptop }, first, { Origin: 'null' });
  assert.equal(saved.status, 200);
  assert.equal(saved.headers.get('access-control-allow-origin'), 'null');
  assert.equal(saved.headers.get('access-control-allow-credentials'), null);
  assert.equal((await request('sync', undefined, first, { Origin: 'vaayvu://browser' })).headers.get('access-control-allow-origin'), 'vaayvu://browser');
  assert.equal((await request('sync', undefined, first, { Origin: 'https://elsewhere.example' })).status, 403);
  const deleted = { id: bookmark.id, deleted: true, updatedAt: bookmark.updatedAt };
  const both = await request('sync', { bookmarks: [deleted], device: phone }, second);
  assert.deepEqual(both.value.bookmarks, [{ ...deleted, title: '', url: '' }]);
  assert.deepEqual(both.value.devices.find((d) => d.id === laptop.id).tabs, [page]);
  assert.equal((await request('send', { from:laptop.id, to:phone.id, page }, first)).status,200);
  assert.equal((await request('send', { from:laptop.id, to:phone.id, page:{...page,private:true} }, first)).status,400);
  const inbox=(await request('sync',{bookmarks:[],device:phone},second)).value.incoming;
  assert.equal(inbox.length,1);
  assert.equal(inbox[0].url,page.url);
  await request('dismiss',{id:inbox[0].id,device:laptop.id},first);
  assert.equal((await request('sync',{bookmarks:[],device:phone},second)).value.incoming.length,1);
  await request('dismiss',{id:inbox[0].id,device:phone.id},second);
  assert.equal((await request('sync',{bookmarks:[],device:phone},second)).value.incoming.length,0);
  const replay = await request('sync', { bookmarks: [bookmark], device: laptop }, first);
  assert.deepEqual(replay.value.bookmarks, both.value.bookmarks);
  const invalid = await request('sync', { bookmarks: [{ ...bookmark, updatedAt: 101 }], device: { ...phone, tabs: [{ ...page, private: true }] } }, second);
  assert.equal(invalid.status, 400);
  assert.deepEqual((await request('sync', undefined, first)).value.bookmarks, both.value.bookmarks);
  for (const url of ['file:///secret.txt', 'https://user:password@example.org/']) {
    assert.equal((await request('sync', { bookmarks: [], device: { ...phone, tabs: [{ ...page, url }] } }, second)).status, 400);
  }
  const other = (await request('register', { ...credentials, username: 'unrelated' })).value.token;
  assert.deepEqual((await request('sync', undefined, other)).value, { bookmarks: [], devices: [] });
  assert.equal((await request('ask', { question: 'What is here?', text: 'Example' }, first)).status, 503);
  await close(server);
  server = createSyncService({ database, registration: 'closed' });
  request = client(await start(server));
  assert.equal((await request('register', { ...credentials, username: 'newaccount' })).status, 403);
  assert.equal((await request('login', credentials)).status, 200);
  assert.equal((await request('sync', undefined, second)).value.devices.length, 2);
  assert.equal((await request('logout', {}, first)).status, 200);
  assert.equal((await request('sync', undefined, first)).status, 401);
  assert.equal((await request('sync', undefined, second)).status, 200);
});

test('Ask uses only the configured model and forwards the page as reference after authentication', async (t) => {
  const payloads = [];
  const upstream = createServer(async (req, res) => {
    assert.equal(req.url, '/api/chat');
    let body = '';
    for await (const chunk of req) body += chunk;
    payloads.push(JSON.parse(body));
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: { content: 'A test answer.' } }));
  });
  const ollamaUrl = await start(upstream);
  t.after(() => close(upstream));
  const server = createSyncService({ ollamaUrl, ollamaModel: 'test-model' });
  t.after(() => close(server));
  const request = client(await start(server));
  const body = { question: 'Which color?', text: 'The sky is blue.', model: 'wrong', url: 'https://irrelevant.example' };
  assert.equal((await request('ask', body)).status, 401);
  const { token } = (await request('register', credentials)).value;
  assert.equal((await request('ask', { ...body, private: true }, token)).status, 400);
  assert.deepEqual((await request('ask', body, token)).value, { answer: 'A test answer.' });
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].model, 'test-model');
  assert.equal(payloads[0].tools, undefined);
  assert.equal(payloads[0].stream, false);
  assert.deepEqual(JSON.parse(payloads[0].messages[1].content), { question: body.question, untrustedPageText: body.text });
  assert.deepEqual((await request('sync', undefined, token)).value, { bookmarks: [], devices: [] });
});
