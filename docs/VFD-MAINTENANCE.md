# VAAYVU Ad Block — Maintenance & Updates

## Refreshing the VFD database

`chrome/vfd-rules.js` is hand-authored original data (see `docs/VFD-FORMAT.md`).
To extend it:

1. Reproduce the ad behavior in a test fixture or live page.
2. Identify the responsible host, URL token, or DOM selector.
3. Verify it is advertising (not content, not a shared CDN).
4. Add a rule with `evidence` (fixture name, test name, or live-request log
   date), `added` and `verified` dates.
5. Run `node --test tests/vfd.test.cjs windows/test/policy.test.cjs` and the
   Electron `vfd` suite (`npm test` in `windows/`).
6. Ship with the next versioned build; the UI shows the new `rulesVersion`.

## Validation and rollback

- `VaayvuVFD.load()` rejects malformed, expired, or protected-apex rules with
  reasons; rejected rules never reach the blocking sets.
- If a release misbehaves, revert `chrome/vfd-rules.js` to the previous
  version and rebuild: the compiled sets are built at startup, so there is
  no on-disk cache to clear. iOS recompiles its content blockers from the
  bundled file on next launch.

## User reports

The protection dialog stores missed-ad and broken-site reports locally on
the device (`adBlockReports`, capped at 50). They are the input queue for
step 1 above. No report ever leaves the device.

## Update service (status: bundled-only)

Automatic signed updates are architected (versioned manifest +
`rulesVersion` display + atomic replacement + rollback above) but the
server side is not built. Until then, rule updates ship with Vaayvu releases.
