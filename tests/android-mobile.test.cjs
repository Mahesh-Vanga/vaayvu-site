'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the Android product is a Java WebView app, not a claimed GeckoView/Kotlin app', () => {
  const appBuild = read('android/app/build.gradle');
  assert.doesNotMatch(appBuild, /geckoview/i);
  assert.doesNotMatch(appBuild, /compose/i);
  assert.match(appBuild, /androidx\.webkit:webkit/);
  const activity = read('android/app/src/main/java/dev/vaayvu/app/BrowserActivity.java');
  assert.match(activity, /import android\.webkit\.WebView;/);
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /configChanges="[^"]*orientation[^"]*screenSize[^"]*smallestScreenSize/);
  assert.equal(existsSync(resolve(root, 'android/geckoview-spike/build.gradle')), true, 'GeckoView is a separate spike');
});

test('adaptive launch checks cover phone and tablet sizes', () => {
  const script = read('scripts/android-adaptive-check.sh');
  assert.match(script, /check "phone" 1080x2280 440/);
  assert.match(script, /check "tablet" 1600x2560 320/);
  assert.match(script, /FATAL EXCEPTION/);
  assert.match(script, /activity not resumed/);
  const doc = read('docs/ANDROID-MOBILE.md');
  assert.match(doc, /phone: launched at 1080x2280/);
  assert.match(doc, /tablet: launched at 1600x2560/);
  assert.match(doc, /Android adaptive launch check passed/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  assert.match(doc, /Not migrated/);
});

test('permissions and internal release evidence are present', () => {
  const permissions = read('android/app/src/main/java/dev/vaayvu/app/SitePermissions.java');
  assert.match(permissions, /requestPermissions/);
  assert.match(permissions, /checkSelfPermission/);
  const activity = read('android/app/src/main/java/dev/vaayvu/app/BrowserActivity.java');
  assert.match(activity, /POST_NOTIFICATIONS/);
  assert.match(read('docs/ANDROID-MOBILE.md'), /CN=Vaayvu/);
  assert.match(read('docs/PHASES.csv'), /P07,Android phone\/tablet browser/);
  assert.match(read('docs/PHASES.csv'), /Kotlin\/Compose\/GeckoView product migration not performed/);
});
