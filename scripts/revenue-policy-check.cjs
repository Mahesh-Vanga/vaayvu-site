'use strict';

// P36 revenue policy contract check. A draft can be valid but cannot be
// "approved" without jurisdiction, legal, privacy and owner approvals.

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const policy = JSON.parse(readFileSync(resolve(__dirname, '..', 'docs', 'revenue-policy.json'), 'utf8'));
const failures = [];

if (policy.inventory?.ownedOnly !== true) failures.push('Inventory must be owned-only.');
if (policy.inventory?.thirdPartyPublisherInventory !== false) failures.push('Third-party publisher inventory must stay off.');
if (policy.inventory?.resale !== false) failures.push('Resale must stay off.');
if (!Array.isArray(policy.inventory?.placements) || !policy.inventory.placements.length) failures.push('At least one owned placement is required.');
if (policy.privacy?.adsConsentSeparateFromRewards !== true) failures.push('Ads consent must be separate from rewards.');
if (policy.privacy?.rewardsConsentSeparateFromAds !== true) failures.push('Rewards consent must be separate from ads.');
if (policy.privacy?.personalizationWithoutConsent !== false) failures.push('No personalization without consent.');
if (policy.privacy?.sensitiveTraits !== false) failures.push('Sensitive traits must stay off.');
if (policy.privacy?.historyOrProfileTargeting !== false) failures.push('History/profile targeting must stay off.');
if (policy.privacy?.privatePagesExcluded !== true) failures.push('Private pages must be excluded.');
if (policy.rewards?.identityRequiredToBrowse !== false) failures.push('Identity must not be required to browse.');
if (policy.rewards?.identityRequiredForRasha !== false) failures.push('Identity must not be required for Rasha.');

const approved = policy.status === 'approved';
const approvals = policy.approvals || {};
const missingApprovals = ['productOwner', 'legal', 'security', 'privacy'].filter((role) => !approvals[role]);
const jurisdiction = policy.jurisdiction || {};
if (approved) {
  if (missingApprovals.length) failures.push('Approved policy is missing approvals: ' + missingApprovals.join(', '));
  if (!jurisdiction.decision || !Array.isArray(jurisdiction.approvedRegions) || !jurisdiction.approvedRegions.length) failures.push('Approved policy needs a jurisdiction decision and region.');
}

if (failures.length) {
  console.error('Revenue policy check failed:');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  status: policy.status,
  approved,
  missingApprovals,
  jurisdiction: jurisdiction.status,
  placements: policy.inventory.placements,
}));
