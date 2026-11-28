'use strict';

// Browser domain store for P04.
//
// SQLite schema, state machines, migrations and crash recovery live here. The
// shipping Electron renderer reaches this store through a synchronous
// key-value bridge (windows/preload.cjs + chrome/native-store.js), so durable
// renderer state no longer lives in localStorage. Tab/window tables remain the
// contract-tested domain model and are not yet populated by the renderer.

const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');

const now = () => new Date().toISOString();

const TAB_TRANSITIONS = {
  opening: ['live', 'closed'],
  live: ['suspended', 'closed'],
  suspended: ['live', 'closed'],
  closed: [],
};

const WINDOW_TRANSITIONS = {
  open: ['minimized', 'closed'],
  minimized: ['open', 'closed'],
  closed: [],
};

const MIGRATIONS = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        );
        CREATE TABLE containers (
          id TEXT PRIMARY KEY,
          profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          color TEXT,
          created_at TEXT NOT NULL,
          UNIQUE (profile_id, name)
        );
        CREATE TABLE windows (
          id TEXT PRIMARY KEY,
          profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          container_id TEXT REFERENCES containers(id),
          state TEXT NOT NULL CHECK (state IN ('open', 'minimized', 'closed')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE tabs (
          id TEXT PRIMARY KEY,
          window_id TEXT NOT NULL REFERENCES windows(id) ON DELETE CASCADE,
          session_id TEXT,
          url TEXT NOT NULL,
          title TEXT,
          state TEXT NOT NULL CHECK (state IN ('opening', 'live', 'suspended', 'closed')),
          position INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          clean INTEGER NOT NULL DEFAULT 0 CHECK (clean IN (0, 1))
        );
        CREATE TABLE crash_journal (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT,
          event TEXT NOT NULL,
          tab_id TEXT,
          detail TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX tabs_window_position ON tabs (window_id, position);
        CREATE INDEX journal_session ON crash_journal (session_id, id);
      `);
    },
  },
  {
    version: 2,
    up(db) {
      db.exec('ALTER TABLE tabs ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
      db.exec('ALTER TABLE sessions ADD COLUMN recovered INTEGER NOT NULL DEFAULT 0');
    },
  },
  {
    version: 3,
    up(db) {
      db.exec(`
        CREATE TABLE key_values (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
    },
  },
];

function migrate(db, { to = MIGRATIONS[MIGRATIONS.length - 1].version } = {}) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version));
  for (const migration of MIGRATIONS) {
    if (migration.version > to || applied.has(migration.version)) continue;
    db.exec('BEGIN');
    try {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(migration.version, now());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => row.version);
}

function assertTransition(map, from, to, label) {
  const allowed = map[from];
  if (!allowed) throw new Error(`Unknown ${label} state: ${from}`);
  if (!allowed.includes(to)) throw new Error(`Illegal ${label} transition: ${from} -> ${to}`);
}

class BrowserStore {
  constructor(file) {
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA foreign_keys = ON');
    try {
      this.db.exec('PRAGMA busy_timeout = 2000');
      if (file && file !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL');
    } catch (error) {}
    this.migrations = migrate(this.db);
    this.sessionId = null;
  }

  // Durable renderer key-value state. Values are stored exactly as the Web
  // Storage API would hold them (JSON strings), so the renderer keeps its
  // existing read/write paths while SQLite owns the bytes.
  getValue(key) {
    const row = this.db.prepare('SELECT value FROM key_values WHERE key = ?').get(String(key));
    return row ? row.value : null;
  }

  setValue(key, value) {
    this.db
      .prepare(
        'INSERT INTO key_values (key, value, updated_at) VALUES (?, ?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
      )
      .run(String(key), String(value), now());
    return true;
  }

  removeValue(key) {
    return this.db.prepare('DELETE FROM key_values WHERE key = ?').run(String(key)).changes > 0;
  }

  listValues() {
    return this.db.prepare('SELECT key FROM key_values ORDER BY key').all().map((row) => row.key);
  }

  // One-time import from the pre-SQLite renderer. Existing keys win, so a
  // second launch can never overwrite newer SQLite state with old localStorage.
  importValues(entries) {
    if (!Array.isArray(entries) || !entries.length) return 0;
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO key_values (key, value, updated_at) VALUES (?, ?, ?)'
    );
    let imported = 0;
    this.db.exec('BEGIN');
    try {
      for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length !== 2) continue;
        const key = entry[0];
        const value = entry[1];
        if (typeof key !== 'string' || !key || key.length > 512 || typeof value !== 'string') continue;
        if (value.length > 4 * 1024 * 1024) continue;
        imported += insert.run(key, value, now()).changes;
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return imported;
  }

  _journal(event, tabId = null, detail = null) {
    this.db
      .prepare('INSERT INTO crash_journal (session_id, event, tab_id, detail, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(this.sessionId, event, tabId, detail == null ? null : JSON.stringify(detail), now());
  }

  createProfile(name) {
    const id = randomUUID();
    this.db.prepare('INSERT INTO profiles (id, name, created_at) VALUES (?, ?, ?)').run(id, name, now());
    return id;
  }

  createContainer(profileId, name, color = null) {
    const id = randomUUID();
    this.db
      .prepare('INSERT INTO containers (id, profile_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, profileId, name, color, now());
    return id;
  }

  createWindow(profileId, containerId = null) {
    if (containerId) {
      const container = this.db.prepare('SELECT profile_id FROM containers WHERE id = ?').get(containerId);
      if (!container) throw new Error('Unknown container');
      if (container.profile_id !== profileId) throw new Error('Container belongs to another profile');
    }
    const id = randomUUID();
    const at = now();
    this.db
      .prepare('INSERT INTO windows (id, profile_id, container_id, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, profileId, containerId, 'open', at, at);
    this._journal('window-open', null, { windowId: id, profileId });
    return id;
  }

  beginSession() {
    if (this.sessionId) throw new Error('Session already open');
    const id = randomUUID();
    this.db.prepare('INSERT INTO sessions (id, started_at, clean) VALUES (?, ?, 0)').run(id, now());
    this.sessionId = id;
    this._journal('session-begin');
    return id;
  }

  endSession() {
    if (!this.sessionId) throw new Error('No open session');
    this.db.prepare('UPDATE sessions SET ended_at = ?, clean = 1 WHERE id = ?').run(now(), this.sessionId);
    this._journal('session-end');
    this.sessionId = null;
  }

  openTab(windowId, url, { position = 0, title = null, pinned = false } = {}) {
    if (!this.sessionId) throw new Error('No open session');
    const win = this.db.prepare('SELECT state FROM windows WHERE id = ?').get(windowId);
    if (!win) throw new Error('Unknown window');
    if (win.state === 'closed') throw new Error('Cannot open a tab in a closed window');
    const id = randomUUID();
    const at = now();
    this.db
      .prepare(
        'INSERT INTO tabs (id, window_id, session_id, url, title, state, position, created_at, updated_at, pinned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(id, windowId, this.sessionId, url, title, 'opening', position, at, at, pinned ? 1 : 0);
    this._journal('tab-opening', id, { windowId, url });
    return id;
  }

  transitionTab(tabId, to) {
    const tab = this.db.prepare('SELECT state FROM tabs WHERE id = ?').get(tabId);
    if (!tab) throw new Error('Unknown tab');
    assertTransition(TAB_TRANSITIONS, tab.state, to, 'tab');
    this.db.prepare('UPDATE tabs SET state = ?, updated_at = ? WHERE id = ?').run(to, now(), tabId);
    this._journal(`tab-${to}`, tabId);
    return true;
  }

  transitionWindow(windowId, to) {
    const win = this.db.prepare('SELECT state FROM windows WHERE id = ?').get(windowId);
    if (!win) throw new Error('Unknown window');
    assertTransition(WINDOW_TRANSITIONS, win.state, to, 'window');
    this.db.prepare('UPDATE windows SET state = ?, updated_at = ? WHERE id = ?').run(to, now(), windowId);
    this._journal(`window-${to}`, null, { windowId });
    return true;
  }

  closeWindow(windowId) {
    this.transitionWindow(windowId, 'closed');
    const open = this.db.prepare("SELECT id FROM tabs WHERE window_id = ? AND state != 'closed'").all(windowId);
    for (const tab of open) {
      this.db.prepare('UPDATE tabs SET state = ?, updated_at = ? WHERE id = ?').run('closed', now(), tab.id);
      this._journal('tab-closed', tab.id, { reason: 'window-close' });
    }
    return open.length;
  }

  // A previous session that was never ended is unclean. Its non-closed tabs are
  // moved to suspended and returned so the next launch can restore them.
  recoverPreviousSessions() {
    if (!this.sessionId) throw new Error('No open session');
    const sessions = this.db
      .prepare('SELECT id FROM sessions WHERE clean = 0 AND recovered = 0 AND id != ?')
      .all(this.sessionId)
      .map((row) => row.id);
    if (!sessions.length) return [];
    const placeholders = sessions.map(() => '?').join(',');
    const tabs = this.db
      .prepare(`SELECT * FROM tabs WHERE session_id IN (${placeholders}) AND state != 'closed'`)
      .all(...sessions);
    for (const tab of tabs) {
      this.db.prepare('UPDATE tabs SET state = ?, updated_at = ? WHERE id = ?').run('suspended', now(), tab.id);
      this._journal('tab-recover-suspended', tab.id, { from: tab.state, sessionId: tab.session_id });
    }
    this.db.prepare(`UPDATE sessions SET recovered = 1 WHERE id IN (${placeholders})`).run(...sessions);
    return tabs;
  }

  journalEntries(sessionId = this.sessionId) {
    return this.db.prepare('SELECT * FROM crash_journal WHERE session_id = ? ORDER BY id').all(sessionId);
  }

  migrationVersions() {
    return this.migrations.slice();
  }

  close() {
    this.db.close();
  }
}

module.exports = {
  BrowserStore,
  TAB_TRANSITIONS,
  WINDOW_TRANSITIONS,
  MIGRATIONS,
  migrate,
};
