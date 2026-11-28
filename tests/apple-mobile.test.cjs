'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the Apple target is native Swift with WebKit on iPhone and iPad', () => {
  const project = read('apple/project.yml');
  assert.match(project, /platform: iOS/);
  assert.match(project, /TARGETED_DEVICE_FAMILY: "1,2"/);
  assert.match(project, /deploymentTarget: "16\.0"/);
  assert.match(project, /path: \.\.\/chrome/);
  const sources = read('apple/Sources/BrowserHost.swift') + read('apple/Sources/App.swift');
  assert.match(sources, /WKWebView|WebKit/);
  for (const file of [
    'apple/Sources/App.swift',
    'apple/Sources/BrowserHost.swift',
    'apple/Sources/ChromeStorage.swift',
    'apple/Sources/Downloads.swift',
    'apple/Tests/BrowserTests.swift',
    'apple/Tests/NavigationTests.swift',
    'apple/Tests/PhoneInteractionTests.swift',
  ]) {
    assert.equal(existsSync(resolve(root, file)), true, file + ' exists');
  }
});

test('iOS does not advertise a default-browser capability it cannot honor', () => {
  const capabilities = read('apple/Sources/PageActions.swift');
  assert.doesNotMatch(capabilities, /canDefaultBrowser/);
  const test = read('apple/Tests/NavigationTests.swift');
  assert.match(test, /XCTAssertNil\(host\.capabilities\["canDefaultBrowser"\]\)/);
});

test('storage migration and simulator packaging are present without a TestFlight claim', () => {
  const storage = read('apple/Sources/ChromeStorage.swift');
  assert.match(storage, /Vaayvu\.separateChromeStore\.v1/);
  assert.match(storage, /Vaayvu\.separateChromeStore\.v1/);
  const packager = read('apple/scripts/package.sh');
  assert.match(packager, /method -string debugging/);
  assert.doesNotMatch(packager, /testflight|app-store-connect|altool|notarytool/i);
  const doc = read('docs/APPLE-MOBILE.md');
  assert.match(doc, /not\*\* a\nTestFlight build|not a TestFlight build/);
  assert.match(doc, /Gate met \| \*\*Partially\*\*/);
});
