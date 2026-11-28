'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the revenue policy is safe-by-default but not approved', () => {
  const policy = JSON.parse(read('docs/revenue-policy.json'));
  assert.equal(policy.status, 'draft');
  assert.equal(policy.inventory.ownedOnly, true);
  assert.equal(policy.inventory.thirdPartyPublisherInventory, false);
  assert.equal(policy.inventory.resale, false);
  assert.equal(policy.privacy.adsConsentSeparateFromRewards, true);
  assert.equal(policy.privacy.rewardsConsentSeparateFromAds, true);
  assert.equal(policy.privacy.sensitiveTraits, false);
  assert.equal(policy.privacy.historyOrProfileTargeting, false);
  assert.equal(policy.privacy.privatePagesExcluded, true);
  assert.equal(policy.rewards.identityRequiredToBrowse, false);
  assert.equal(policy.rewards.identityRequiredForRasha, false);
  assert.equal(policy.jurisdiction.decision, null);
  assert.equal(policy.jurisdiction.status, 'pending');
});

test('the policy check refuses an approved state without approvals or jurisdiction', () => {
  const output = execFileSync(process.execPath, [resolve(root, 'scripts/revenue-policy-check.cjs')], { encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.equal(result.ok, true);
  assert.equal(result.approved, false);
  assert.deepEqual(result.missingApprovals.sort(), ['legal', 'privacy', 'productOwner', 'security']);
  assert.equal(result.jurisdiction, 'pending');
  const source = read('scripts/revenue-policy-check.cjs');
  assert.match(source, /Approved policy is missing approvals/);
  assert.match(source, /Approved policy needs a jurisdiction decision/);
});

test('the P36 gate stays blocked and the ads contracts are referenced', () => {
  const doc = read('docs/REVENUE-POLICY.md');
  assert.match(doc, /Gate met \| \*\*No\*\*/);
  assert.match(doc, /No third-party publisher inventory is claimed/);
  assert.match(doc, /Enrollment\/payout must treat unapproved regions as ineligible|treat this as \*\*ineligible\*\*/);
  assert.match(read('docs/PHASES.csv'), /P36,Own inventory and rewards policy contracts/);
  assert.match(read('docs/PHASES.csv'), /Blocked \/ contracts drafted/);
});
