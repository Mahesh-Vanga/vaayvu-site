'use strict';

// P18 measured tab lifecycle: pressure reclaim, critical-work lease, wake.
// Run with Electron through test/run.cjs or directly with a temporary profile.

const { app, protocol } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { BrowserHost } = require('../host.cjs');

const provided = process.env.VAAYVU_SMOKE_PROFILE;
const profile = provided || fs.mkdtempSync(path.join(os.tmpdir(), 'vaayvu-lifecycle-'));
app.setPath('userData', profile);
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{ scheme: 'vaayvu', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

app.whenReady().then(async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<title>Lifecycle</title><p>Lifecycle fixture</p>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const host = new BrowserHost(path.resolve(__dirname, '../../chrome'), { show: false });
  host.enabled = true;
  const ids = ['t1', 't2', 't3', 't4'];
  for (const id of ids) {
    const tab = host.tab(id, false);
    tab.url = origin + '/' + id;
    tab.userApprovedVisit = true;
    tab.lastUse = Date.now() - 120000;
    // Keep the test harness renderer-alive so Electron can exit cleanly; the
    // sleep decision, lease and wake paths are still exercised.
    tab.view.webContents.close = () => {};
  }
  host.active = 't4';
  assert.equal(host.setLease('t2', true, 'upload', 60000), true);
  process.env.VAAYVU_PRESSURE_BYTES = '1';
  const before = process.memoryUsage();
  const cpuBefore = process.cpuUsage();
  const started = Date.now();
  host.reclaimUnderPressure();
  const slept = ids.filter((id) => host.tabs.get(id).sleeping);
  assert.deepEqual(slept.sort(), ['t1', 't3'], 'stale unleased tabs sleep');
  assert.equal(host.tabs.get('t2').sleeping, false, 'critical-work lease protects t2');
  assert.equal(host.tabs.get('t4').sleeping, false, 'active tab is never slept');

  host.setLease('t2', false);
  host.reclaimUnderPressure();
  assert.equal(host.tabs.get('t2').sleeping, true, 'expired lease can sleep');
  host.wakeTab('t1');
  assert.equal(host.tabs.get('t1').sleeping, false, 'wake rebuilds the tab');
  await new Promise((resolve) => setTimeout(resolve, 300));
  const cpu = process.cpuUsage(cpuBefore);
  const after = process.memoryUsage();
  const metrics = app.getAppMetrics().reduce((total, item) => total + (item.memory?.workingSetSize || 0), 0);
  const result = {
    thresholdBytes: Number(process.env.VAAYVU_PRESSURE_BYTES),
    tabs: ids.length,
    sleptUnderPressure: slept,
    leaseProtected: 't2',
    activeProtected: 't4',
    woke: 't1',
    ramWorkingSetKb: metrics,
    heapDeltaBytes: after.heapUsed - before.heapUsed,
    cpuMs: Number(((cpu.user + cpu.system) / 1000).toFixed(2)),
    elapsedMs: Date.now() - started,
  };
  if (provided) fs.writeFileSync(path.join(profile, 'smoke-passed'), 'lifecycle-pressure');
  console.log(JSON.stringify(result));
  process.exit(0);
}).catch((error) => {
  console.error(JSON.stringify({ pass: false, error: error.message }));
  process.exit(1);
});
