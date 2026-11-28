'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { BrowserStore, migrate } = require('../windows/domain/store.cjs');

function tempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'vaayvu-domain-'));
  return { dir, file: join(dir, 'browser.sqlite') };
}

test('migrations run in order and preserve existing data', () => {
  const { dir, file } = tempDb();
  try {
    const db = new DatabaseSync(file);
    assert.deepEqual(migrate(db, { to: 1 }), [1]);
    db.prepare('INSERT INTO profiles (id, name, created_at) VALUES (?, ?, ?)').run('p-1', 'Meera', '2026-11-28T00:00:00.000Z');
    assert.deepEqual(migrate(db), [1, 2]);
    const columns = db.prepare("PRAGMA table_info('tabs')").all().map((row) => row.name);
    assert.ok(columns.includes('pinned'));
    assert.equal(db.prepare('SELECT name FROM profiles WHERE id = ?').get('p-1').name, 'Meera');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tab and window state machines reject illegal transitions', () => {
  const { dir, file } = tempDb();
  try {
    const store = new BrowserStore(file);
    assert.deepEqual(store.migrationVersions(), [1, 2]);
    store.beginSession();
    const profile = store.createProfile('Meera');
    const windowId = store.createWindow(profile);
    const tab = store.openTab(windowId, 'https://example.com', { title: 'Example' });
    assert.throws(() => store.transitionTab(tab, 'suspended'), /Illegal tab transition: opening -> suspended/);
    store.transitionTab(tab, 'live');
    store.transitionTab(tab, 'suspended');
    store.transitionTab(tab, 'live');
    store.transitionTab(tab, 'closed');
    assert.throws(() => store.transitionTab(tab, 'live'), /Illegal tab transition: closed -> live/);
    store.transitionWindow(windowId, 'minimized');
    assert.throws(() => store.transitionWindow(windowId, 'minimized'), /Illegal window transition: minimized -> minimized/);
    store.transitionWindow(windowId, 'open');
    store.closeWindow(windowId);
    assert.throws(() => store.openTab(windowId, 'https://example.com/2'), /closed window/);
    store.endSession();
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an unclean session recovers tabs as suspended without data loss', () => {
  const { dir, file } = tempDb();
  try {
    const first = new BrowserStore(file);
    const crashed = first.beginSession();
    const profile = first.createProfile('Work');
    const windowId = first.createWindow(profile);
    const tab = first.openTab(windowId, 'https://example.com/article', { title: 'Article', pinned: true });
    first.transitionTab(tab, 'live');
    first.close(); // no endSession: simulated crash

    const second = new BrowserStore(file);
    second.beginSession();
    const recovered = second.recoverPreviousSessions();
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0].id, tab);
    assert.equal(recovered[0].url, 'https://example.com/article');
    assert.equal(second.db.prepare('SELECT state FROM tabs WHERE id = ?').get(tab).state, 'suspended');
    assert.ok(second.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE id = ? AND clean = 0').get(crashed).n === 1);
    second.endSession();
    second.close();

    const third = new BrowserStore(file);
    third.beginSession();
    assert.deepEqual(third.recoverPreviousSessions(), []);
    third.endSession();
    third.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('containers cannot cross profiles and durable data survives reopen', () => {
  const { dir, file } = tempDb();
  try {
    const store = new BrowserStore(file);
    store.beginSession();
    const work = store.createProfile('Work');
    const personal = store.createProfile('Personal');
    const container = store.createContainer(work, 'Client A', 'blue');
    assert.throws(() => store.createWindow(personal, container), /another profile/);
    const windowId = store.createWindow(work, container);
    const tab = store.openTab(windowId, 'https://example.com', { title: 'Saved', pinned: true });
    store.transitionTab(tab, 'live');
    store.endSession();
    store.close();

    const reopened = new BrowserStore(file);
    const row = reopened.db.prepare('SELECT title, pinned, state FROM tabs WHERE id = ?').get(tab);
    assert.deepEqual({ ...row }, { title: 'Saved', pinned: 1, state: 'live' });
    assert.equal(reopened.db.prepare('SELECT color FROM containers WHERE id = ?').get(container).color, 'blue');
    reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
