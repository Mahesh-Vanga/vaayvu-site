'use strict';

// Reference secure vault for P21. AES-256-GCM with a scrypt-derived key.
// The vault file contains only ciphertext; callers must keep the passphrase out
// of the file and out of logs. This module is not yet wired into a shipping UI.

const crypto = require('node:crypto');
const { chmodSync, readFileSync, writeFileSync } = require('node:fs');

const VERSION = 1;
const KDF = { N: 16384, r: 8, p: 1, keylen: 32 };

function derive(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 12) throw new Error('Use a vault passphrase of at least 12 characters.');
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(passphrase, salt, KDF.keylen, { N: KDF.N, r: KDF.r, p: KDF.p });
  return { salt, key };
}

function deriveExisting(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, KDF.keylen, { N: KDF.N, r: KDF.r, p: KDF.p });
}

class Vault {
  constructor(file, key, salt, entries = []) {
    this.file = file;
    this.key = key;
    this.salt = salt;
    this.entries = entries;
  }

  static create(file, passphrase) {
    const { salt, key } = derive(passphrase);
    const vault = new Vault(file, key, salt, []);
    vault.save();
    return vault;
  }

  static open(file, passphrase) {
    let payload;
    try {
      payload = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      throw new Error('Vault file is unreadable.');
    }
    if (payload.version !== VERSION) throw new Error('Unsupported vault version.');
    let key;
    try {
      key = deriveExisting(passphrase, Buffer.from(payload.salt, 'base64'));
    } catch {
      throw new Error('Invalid passphrase or corrupt vault.');
    }
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
      const plain = Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()]);
      const entries = JSON.parse(plain.toString('utf8'));
      if (!Array.isArray(entries)) throw new Error('bad');
      return new Vault(file, key, Buffer.from(payload.salt, 'base64'), entries);
    } catch {
      throw new Error('Invalid passphrase or corrupt vault.');
    }
  }

  save() {
    if (!this.key) throw new Error('Vault is locked.');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(this.entries), 'utf8'), cipher.final()]);
    const payload = {
      version: VERSION,
      kdf: 'scrypt',
      params: KDF,
      salt: this.salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
    writeFileSync(this.file, JSON.stringify(payload) + '\n', { mode: 0o600 });
    try { chmodSync(this.file, 0o600); } catch {}
    return true;
  }

  add({ origin, username, password, notes = '' }) {
    if (!this.key) throw new Error('Vault is locked.');
    if (typeof origin !== 'string' || !/^https:\/\//.test(origin)) throw new Error('Only HTTPS origins can be stored.');
    if (typeof username !== 'string' || !username.trim()) throw new Error('Username is required.');
    if (typeof password !== 'string' || !password) throw new Error('Password is required.');
    const entry = {
      id: crypto.randomUUID(),
      origin,
      username: username.trim().slice(0, 320),
      password,
      notes: String(notes).slice(0, 2000),
      updatedAt: Date.now(),
    };
    this.entries.push(entry);
    this.save();
    return entry;
  }

  list() {
    if (!this.key) throw new Error('Vault is locked.');
    return this.entries.map(({ password, ...rest }) => ({ ...rest, hasPassword: !!password }));
  }

  get(id) {
    if (!this.key) throw new Error('Vault is locked.');
    const entry = this.entries.find((item) => item.id === id);
    return entry ? { ...entry } : null;
  }

  remove(id) {
    if (!this.key) throw new Error('Vault is locked.');
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => entry.id !== id);
    if (this.entries.length !== before) this.save();
    return this.entries.length !== before;
  }

  lock() {
    if (this.key) this.key.fill(0);
    this.key = null;
    this.entries = [];
  }
}

module.exports = { Vault, VERSION, KDF };
