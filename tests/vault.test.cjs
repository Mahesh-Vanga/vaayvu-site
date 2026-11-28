'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Vault } = require('../windows/vault.cjs');

const passphrase = 'a long unique vault phrase';

test('the vault encrypts credentials, stores no plaintext and restores them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vaayvu-vault-'));
  const file = join(dir, 'vault.json');
  try {
    const vault = Vault.create(file, passphrase);
    const first = vault.add({ origin: 'https://example.com', username: 'meera', password: 'correct horse battery', notes: 'work' });
    vault.add({ origin: 'https://mail.example.com', username: 'meera@example.com', password: 'second secret' });
    const raw = readFileSync(file, 'utf8');
    assert.doesNotMatch(raw, /correct horse battery|second secret|meera/);
    assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.deepEqual(vault.list().map((item) => item.username).sort(), ['meera', 'meera@example.com']);
    assert.equal(vault.list()[0].password, undefined);
    assert.equal(vault.get(first.id).password, 'correct horse battery');

    const reopened = Vault.open(file, passphrase);
    assert.equal(reopened.get(first.id).password, 'correct horse battery');
    assert.equal(reopened.remove(first.id), true);
    assert.equal(Vault.open(file, passphrase).get(first.id), null);
    assert.throws(() => Vault.open(file, 'wrong passphrase'), /Invalid passphrase or corrupt vault/);
    vault.lock();
    assert.throws(() => vault.list(), /locked/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tampering and non-HTTPS origins are rejected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vaayvu-vault-'));
  const file = join(dir, 'vault.json');
  try {
    const vault = Vault.create(file, passphrase);
    assert.throws(() => vault.add({ origin: 'http://example.com', username: 'a', password: 'b' }), /HTTPS/);
    assert.throws(() => vault.add({ origin: 'https://example.com', username: '', password: 'b' }), /Username/);
    assert.throws(() => vault.add({ origin: 'https://example.com', username: 'a', password: '' }), /Password/);
    vault.add({ origin: 'https://example.com', username: 'a', password: 'b' });
    const payload = JSON.parse(readFileSync(file, 'utf8'));
    const bytes = Buffer.from(payload.ciphertext, 'base64');
    bytes[0] ^= 0xff;
    payload.ciphertext = bytes.toString('base64');
    writeFileSync(file, JSON.stringify(payload));
    assert.throws(() => Vault.open(file, passphrase), /Invalid passphrase or corrupt vault/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
