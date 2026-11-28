'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('media permissions are deny-by-default and audible tabs are protected', () => {
  const host = read('windows/host.cjs');
  assert.match(host, /setPermissionRequestHandler/);
  assert.match(host, /answer\) => answer\(false\)/);
  assert.match(host, /isCurrentlyAudible\(\)/);
  assert.match(host, /backgroundThrottling: true/);
  assert.match(host, /youtubeOptimize/);
});

test('playback quality and calls are not claimed without real devices', () => {
  const doc = read('docs/MEDIA-REALTIME.md');
  assert.match(doc, /Playback quality metrics \| \*\*not measured\*\*/);
  assert.match(doc, /Real-device playback .* \*\*not run\*\*/);
  assert.match(doc, /No product flow/);
  assert.match(doc, /Gate met \| \*\*No\*\*/);
  assert.match(read('docs/PHASES.csv'), /P27,Media and real-time work/);
});
