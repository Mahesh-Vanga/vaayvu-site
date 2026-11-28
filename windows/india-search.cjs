'use strict';

const https = require('node:https');
const tls = require('node:tls');
const { createHash, X509Certificate } = require('node:crypto');
const { website, domains } = require('./policy.cjs');

const LIMIT = 60 * 1024;
const identifier = (value) => typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(value);

function deployment(info, now = Date.now()) {
  if (!info || info.country !== 'IN' || typeof info.region !== 'string' || !info.region.trim() ||
      [...info.region].length > 80 || /\p{Cc}/u.test(info.region)) return null;
  const url = website(info.origin);
  if (!url || info.origin !== 'https://' + url.hostname || !domains([url.hostname], 1).size ||
      /\.(?:local|localhost)$/.test(url.hostname)) return null;
  if (typeof info.expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(info.expiresAt)) return null;
  const expires = Date.parse(info.expiresAt);
  if (!(expires > now) || new Date(expires).toISOString() !== info.expiresAt.replace('Z', '.000Z')) return null;
  const pins = info.spkiPins;
  if (!Array.isArray(pins) || !pins.length || pins.length > 4 || new Set(pins).size !== pins.length) return null;
  for (const pin of pins) {
    if (typeof pin !== 'string' || !/^sha256\/[A-Za-z0-9+/]{43}=$/.test(pin)) return null;
    const digest = Buffer.from(pin.slice(7), 'base64');
    if (digest.length !== 32 || digest.toString('base64') !== pin.slice(7)) return null;
  }
  return { country: 'IN', region: info.region, origin: info.origin, spkiPins: [...pins], expiresAt: info.expiresAt };
}

function results(bytes) {
  const rows = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).results;
  if (!Array.isArray(rows) || rows.length > 20) throw Error('failed');
  return rows.map(({ title, url, snippet }) => {
    if (typeof title !== 'string' || !title.trim() || title.length > 512 || typeof snippet !== 'string' ||
        snippet.length > 320 || website(url)?.protocol !== 'https:') throw Error('failed');
    return { title, url, snippet };
  });
}

function checkPeer(info, hostname, cert) {
  const invalid = Error('Unverified regional search host');
  if (Date.parse(info.expiresAt) <= Date.now() || info.origin !== 'https://' + hostname) return invalid;
  const mismatch = tls.checkServerIdentity(hostname, cert);
  if (mismatch) return mismatch;
  try {
    const key = new X509Certificate(cert.raw).publicKey.export({ type: 'spki', format: 'der' });
    const pin = 'sha256/' + createHash('sha256').update(key).digest('base64');
    if (info.spkiPins.includes(pin)) return undefined;
  } catch {}
  return invalid;
}

async function queryIndex(info, q, signal) {
  if (!deployment(info)) throw Error('unavailable');
  if (typeof q !== 'string' || !/[\p{L}\p{N}]/u.test(q) || /\p{Cc}/u.test(q) || [...q.trim()].length > 256)
    throw Error('invalid');
  const data = Buffer.from(JSON.stringify({ q: q.trim() }));
  // A fresh direct connection runs ordinary TLS validation and the operator's leaf-key check before the POST.
  const response = await new Promise((resolve, reject) => {
    const request = https.request(info.origin + '/v1/search', {
      method: 'POST', agent: false, rejectUnauthorized: true, minVersion: 'TLSv1.2',
      signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
      checkServerIdentity: (host, cert) => checkPeer(info, host, cert),
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, Accept: 'application/json',
        'Accept-Encoding': 'identity', 'Cache-Control': 'no-store', 'User-Agent': 'Vaayvu Search' },
    }, resolve);
    request.once('error', reject);
    request.end(data);
  });
  try {
    if (response.statusCode !== 200) throw Error(response.statusCode === 400 ? 'invalid' : response.statusCode === 503 ? 'unavailable' : 'failed');
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers['content-type'] || '') ||
        Number(response.headers['content-length']) > LIMIT) throw Error('failed');
    let length = 0;
    const chunks = [];
    for await (const chunk of response) {
      length += chunk.length;
      if (length > LIMIT) throw Error('failed');
      chunks.push(chunk);
    }
    if (Date.parse(info.expiresAt) <= Date.now()) throw Error('unavailable');
    return results(Buffer.concat(chunks, length));
  } finally {
    response.destroy();
  }
}

class IndiaSearch {
  constructor(info, report) {
    this.info = deployment(info);
    this.report = report;
    this.active = null;
  }
  get available() { return !!this.info && Date.parse(this.info.expiresAt) > Date.now(); }
  cancel(id, requestId) {
    const task = this.active;
    if (!task || (id != null && id !== task.id) || (requestId != null && requestId !== task.requestId)) return;
    this.active = null;
    task.controller.abort();
  }
  async start(id, requestId, q) {
    if (!identifier(id) || !identifier(requestId)) return;
    this.cancel();
    const task = { id, requestId, controller: new AbortController() };
    this.active = task;
    let payload;
    try {
      payload = { results: await queryIndex(this.info, q, task.controller.signal) };
    } catch (error) {
      payload = { error: ['unavailable', 'invalid'].includes(error?.message) ? error.message : 'failed' };
    }
    if (this.active === task) {
      this.active = null;
      this.report({ id, requestId, ...payload });
    }
  }
}

module.exports = { deployment, checkPeer, IndiaSearch, results };
