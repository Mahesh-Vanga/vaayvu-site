'use strict';

// P39 pilot gate: no rollout without approvals, a release go, reconciliation,
// a tested kill switch, support ownership and measured economics.

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const plan = JSON.parse(readFileSync(resolve(__dirname, '..', 'docs', 'pilot-plan.json'), 'utf8'));
const failures = [];

const approvals = plan.rollout?.approvals || {};
const missing = ['productOwner', 'legal', 'security', 'privacy'].filter((role) => !approvals[role]);
const wantsRollout = Number(plan.rollout?.approvedPercent) > 0 || plan.status === 'active';
if (wantsRollout) {
  if (missing.length) failures.push('Pilot rollout requires approvals: ' + missing.join(', '));
  if (plan.dependencies?.P35 !== 'go') failures.push('Pilot requires a release go from P35.');
  if (['P36', 'P37', 'P38'].some((id) => plan.dependencies?.[id] !== 'green')) failures.push('Pilot requires P36/P37/P38 green.');
  if (plan.reconciliation?.status !== 'passed') failures.push('Pilot requires passed reconciliation.');
  if (plan.killSwitch?.tested !== true || plan.killSwitch?.weakensRasha !== false) failures.push('Pilot requires a tested kill switch that leaves Rasha intact.');
  if (plan.support?.status !== 'ready') failures.push('Pilot requires ready support ownership.');
  if (plan.economics?.monitored !== true || !plan.economics?.values) failures.push('Pilot requires monitored economics.');
}
if (plan.reconciliation?.onlyCollectedNetRevenue !== true) failures.push('Reconciliation must use collected net revenue only.');
if (plan.killSwitch?.weakensRasha !== false) failures.push('Kill switch must not weaken Rasha.');
if (plan.economics?.monitored === false && plan.economics?.values != null) failures.push('Unmonitored economics cannot carry values.');

if (failures.length) {
  console.error('Pilot check failed:');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  status: plan.status,
  rolloutPercent: plan.rollout.approvedPercent,
  missingApprovals: missing,
  reconciliation: plan.reconciliation.status,
  economics: plan.economics.monitored ? 'monitored' : 'unmeasured',
}));
