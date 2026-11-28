import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

test('a client sends credentials only to its configured origin and ignores late data after logout', async () => {
  const storage = new Map();
  const calls = [];
  let finishSync;
  const token = 'X'.repeat(43);
  const context = vm.createContext({
    URL, AbortController, setTimeout, clearTimeout,
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k)
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/sync')) await new Promise((resolve) => { finishSync = resolve; });
      return { ok: true, json: async () => ({ username: 'example', token, bookmarks: [], devices: [] }) };
    }
  });
  context.window = context;
  for (const file of ['core.js', 'sync.js']) {
    vm.runInContext(readFileSync(new URL('../chrome/' + file, import.meta.url), 'utf8'), context);
  }
  const client = context.VaayvuSync;
  assert.equal(client.profileKey, 'local');
  await assert.rejects(client.authenticate('http://sync.example', 'example', 'password'), /HTTPS/);
  assert.equal(calls.length, 0);
  await assert.rejects(client.authenticate('https://sync.example', 'example', 'password'), /India-only/);
  assert.equal(calls.length, 0);
  client.allowNetwork(true);
  await client.authenticate('https://sync.example', 'example', 'a test password', true);
  assert.equal(client.profileKey, 'https://sync.example/example');
  assert.equal(calls[0].url, 'https://sync.example/v1/register');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.ok(![...storage.values()][0].includes('a test password'));
  const pending = client.exchange([], { id: 'a', name: 'Mac', tabs: [] });
  await client.logout();
  finishSync();
  await assert.rejects(pending, /account changed/);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer ' + token);
  assert.equal(calls[2].url, 'https://sync.example/v1/logout');
  assert.equal(client.profileKey, 'local');
  assert.equal(storage.size, 0);
});
