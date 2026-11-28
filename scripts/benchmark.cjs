'use strict';

// P14 telemetry-free local benchmark. No network, no analytics, no uploads.
// Usage: node scripts/benchmark.cjs [--json]

const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const vfd = require('../chrome/vfd.js');
const core = require('../chrome/core.js');
const spaces = require('../chrome/spaces.js');
const guard = require('../chrome/ai-guard.js');
const database = require('../chrome/vfd-rules.js');

const json = process.argv.includes('--json');
const root = path.resolve(__dirname, '..');
const meta = {
  product: 'Vaayvu',
  node: process.versions.node,
  platform: process.platform + ' ' + process.arch,
  cpu: (os.cpus()[0] && os.cpus()[0].model) || 'unknown',
  date: new Date().toISOString(),
  command: 'node scripts/benchmark.cjs --json',
  root,
};

function measure(label, iterations, fn) {
  const beforeCpu = process.cpuUsage();
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  const cpu = process.cpuUsage(beforeCpu);
  return {
    label,
    iterations,
    ms: Number(ms.toFixed(2)),
    perSecond: Math.round(iterations / (ms / 1000)),
    cpuMs: Number(((cpu.user + cpu.system) / 1000).toFixed(2)),
    ...(result && typeof result === 'object' ? result : {}),
  };
}

const compiled = vfd.load(database);
const config = { enabled: true, lists: { ads: true, trackers: true, social: false, cosmetic: true, aggressive: false } };
const env = { compiled, config, strict: new Set(), pausedSites: [] };
const adHost = [...compiled.ads][0] || 'ads.example.com';
const trackerHost = [...compiled.trackers][0] || 'analytics.example.com';
const urls = [
  'https://' + adHost + '/ad.js',
  'https://' + trackerHost + '/pixel',
  'https://news.example.com/article',
  'https://shop.example.com/cart',
];
const documentUrl = 'https://news.example.com/';
const heapBefore = process.memoryUsage().heapUsed;

const results = [];
results.push(
  measure('VFD decisions', 120000, () => {
    let blocked = 0;
    for (let i = 0; i < 120000; i += 1) {
      if (vfd.decide(urls[i % urls.length], documentUrl, env)) blocked += 1;
    }
    return { blocked };
  }),
);
results.push(
  measure('URL validation', 200000, () => {
    let accepted = 0;
    const samples = ['https://example.com/', 'javascript:alert(1)', 'https://user:pass@example.com/', 'http://127.0.0.1:8080/'];
    for (let i = 0; i < 200000; i += 1) if (core.webURL(samples[i % samples.length])) accepted += 1;
    return { accepted };
  }),
);
results.push(
  measure('Spaces normalize', 50000, () => {
    let count = 0;
    for (let i = 0; i < 50000; i += 1) count += spaces.normalize({ active: 'personal', list: [{ id: 'personal', name: 'Personal' }] }).list.length;
    return { count };
  }),
);
results.push(
  measure('AI guard redaction', 20000, () => {
    let redacted = 0;
    const text = 'password=secretvalue\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz123456\nNormal article text.';
    for (let i = 0; i < 20000; i += 1) if (guard.redact(text).includes('[redacted]')) redacted += 1;
    return { redacted };
  }),
);
const heapAfter = process.memoryUsage().heapUsed;

const payload = {
  meta,
  results,
  memory: { heapBefore, heapAfter, heapDelta: heapAfter - heapBefore },
  notes: [
    'Local only: no network requests, telemetry or upload.',
    'CPU time is a proxy for energy, not a joule measurement.',
    'Numbers vary by machine; compare runs on the same machine.',
  ],
};

if (json) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log('Vaayvu local benchmark — ' + meta.date);
  console.log(meta.cpu + ' · Node ' + meta.node + ' · ' + meta.platform);
  for (const row of results) {
    console.log(
      row.label.padEnd(24) + String(row.iterations).padStart(8) + ' iters  ' +
      String(row.ms).padStart(8) + ' ms  ' + String(row.perSecond).padStart(10) + '/s  cpu ' + row.cpuMs + ' ms',
    );
  }
  console.log('heap delta ' + payload.memory.heapDelta + ' bytes (not a peak measurement)');
  console.log('No telemetry, no network. Use --json for machine-readable output.');
}
