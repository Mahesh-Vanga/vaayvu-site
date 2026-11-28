'use strict';

// Export the canonical screen inventory as one Markdown file per screen.
// Usage: node scripts/export-screens.cjs <output-folder>

const { mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const out = resolve(process.argv[2] || join(root, 'audit', 'screens'));
const rows = parseCsv(readFileSync(join(root, 'docs', 'SCREENS.csv'), 'utf8'));
const onboarding = readFileSync(join(root, 'docs', 'ONBOARDING.md'), 'utf8');
const sections = onboarding
  .split(/^## /m)
  .slice(1)
  .map((part) => {
    const [title, ...rest] = part.split('\n');
    return { title: title.trim(), body: rest.join('\n').replace(/\n---+\s*$/, '').trim(), ids: new Set((title.match(/\b[sa]-\d{3}\b/g) || [])) };
  });

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some(Boolean));
  return body.map((cells) => Object.fromEntries(head.map((key, index) => [key, cells[index] ?? ''])));
}

function noteFor(row) {
  if (row.screen_no.startsWith('a-')) {
    return row.category === 'ads-and-rewards'
      ? 'This is an **Ads and rewards** user screen. It is optional and separate from rewards enrollment; browsing and Rasha never require it. Consent, signing, owned placements, frequency caps and Rasha independence are documented in `docs/CAMPAIGN-CONSENT.md`; policy approvals and jurisdiction in `docs/REVENUE-POLICY.md`.'
      : 'This is a **Revenue operations** screen. It covers advertiser/campaign operations, reconciliation and release evidence. The technical contracts live in `docs/CAMPAIGN-CONSENT.md`, `docs/REWARD-LEDGER.md` and `docs/MONETIZATION-PILOT.md`.';
  }
  const exact = sections
    .filter((section) => section.ids.has(row.screen_no))
    .sort((a, b) => (new RegExp('(Step|Screen)\\s+`?' + row.screen_no).test(a.title) ? 0 : 1) - (new RegExp('(Step|Screen)\\s+`?' + row.screen_no).test(b.title) ? 0 : 1))[0];
  if (exact) {
    const body = exact.body.length > 2200 ? exact.body.slice(0, 2200).replace(/\n[^\n]*$/, '') + '\n\n_(Truncated — see docs/ONBOARDING.md.)_' : exact.body;
    return body;
  }
  return `This screen belongs to the **${row.category}** category. No dedicated prose section exists in \`docs/ONBOARDING.md\`; the canonical inventory row is the source of truth.`;
}

rmSync(join(out, 's'), { recursive: true, force: true });
rmSync(join(out, 'a'), { recursive: true, force: true });
rmSync(join(out, 'ai'), { recursive: true, force: true });
mkdirSync(join(out, 's'), { recursive: true });
mkdirSync(join(out, 'a'), { recursive: true });
mkdirSync(join(out, 'ai'), { recursive: true });

const index = [];
const ai = [];
for (const row of rows) {
  const id = row.screen_no;
  const folder = id.startsWith('s-') ? 's' : 'a';
  const file = id.slice(2) + '.md';
  const extra = id === 's-172' ? '\n> **Excluded:** this is a legacy VPN record. No VPN/tunnel/connectivity UI is implemented.\n\n' : '';
  const content = `# ${id} — ${row.name}\n\n${extra}Canonical screen record from the VAAYVU atlas.\n\n| Field | Value |\n|---|---|\n| Screen ID | \`${id}\` |\n| Name | ${row.name} |\n| Category | ${row.category} |\n| Phase | \`${row.phase}\` |\n| Priority | ${row.priority} |\n| Route | \`${row.route}\` |\n| Platform / owner | ${row.platform} |\n| Entry from | ${row.origin || '—'} |\n| Audit | Submitted and audited 2026-11-28 |\n\n## Screen note\n\n${noteFor(row)}\n\n## Where to look\n\n- Inventory: \`docs/SCREENS.csv\` / \`docs/SCREENS.md\`\n- Route: \`${row.route}\`\n- Category: \`${row.category}\`\n\n## Raw record\n\n\`\`\`csv\n${id},${row.name},${row.category},${row.phase},${row.priority},${row.route},${row.platform},${row.origin || '—'}\n\`\`\`\n`;
  writeFileSync(join(out, folder, file), content);
  index.push({ id, name: row.name, category: row.category, route: row.route, file: folder + '/' + file });
  if (id.startsWith('s-') && (row.category === 'ai' || row.category === 'ai-trust' || /\b(AI|assistant)\b/i.test(row.name))) {
    ai.push({ id, name: row.name, file: folder + '/' + file });
  }
}

writeFileSync(join(out, 'INDEX.md'), [
  '# Screen files — one per screen\n',
  '- `s/001.md` = `s-001` … `s/623.md` = `s-623`\n',
  '- `a/001.md` = `a-001` … `a/032.md` = `a-032`\n',
  '- `ai/INDEX.md` = AI and intelligent-assistance screens\n',
  '| ID | Name | Category | Route | File |',
  '|---|---|---|---|---|',
  ...index.map((row) => `| ${row.id} | ${row.name} | ${row.category} | \`${row.route}\` | [${row.file}](./${row.file}) |`),
].join('\n') + '\n');

writeFileSync(join(out, 'ai', 'INDEX.md'), [
  '# AI and intelligent-assistance screens\n',
  '| ID | Name | File |',
  '|---|---|---|',
  ...ai.map((row) => `| ${row.id} | ${row.name} | [../${row.file}](../${row.file}) |`),
].join('\n') + '\n');

console.log(`Wrote ${index.length} screen files and ${ai.length} AI links to ${out}`);
