# Packaging, distribution and release operations (P16)

P16 covers signing, notarization, store review, updates and incident response.
The signed release and rollback drill are executable; notarization, store review
and live updates remain external gaps.

## Reproducible release process

```sh
npm --prefix windows run package:mac
npm --prefix windows run verify:mac
npm --prefix windows run package
npm --prefix windows run verify
node scripts/release-checksums.cjs 0.0.23
node scripts/release-manifest.cjs 0.0.23
```

Results on 2026-11-28:

| Step | Result |
|---|---|
| macOS package | DMG + PKG produced |
| macOS verify | Signatures, hardened runtime, Dock plug-in, receipt, ASAR integrity, source bytes passed |
| Windows package | x64 ZIP produced |
| Windows verify | PE, ASAR digest, fuses, 43 shared assets passed |
| Checksums | `tests/test/0.0.23/SHA256SUMS.txt` |
| Manifest | `docs/releases/0.0.23.json` |

The manifest records every artifact's size and SHA-256. Re-running the commands
reproduces the process; byte-identical builds are not claimed across machines.

## Rollback drill

```sh
node scripts/rollback-drill.cjs 0.0.23 0.0.22
```

Output:

```text
Rollback drill passed: 0.0.23 -> 0.0.22 (6/6 artifacts verified).
```

The drill verifies both release manifests, confirms version ordering and runs
`hdiutil verify` on the previous macOS DMG. Report:
`docs/releases/ROLLBACK-DRILL.md`.

It is a **dry run**: it does not install the old build or re-point a live update
manifest. A production rollback still needs a managed device run.

## Signing and notarization

| Item | State |
|---|---|
| macOS Developer ID Application | **Signed and verified** |
| macOS Developer ID Installer | **Signed and verified** |
| Hardened runtime / ASAR integrity / fuses | **Verified** |
| Windows PE + ASAR + fuses | **Verified** |
| Android release signing | Signed with the Vaayvu keystore |
| Apple notarization | **Not performed** — no App Store Connect/notary credentials |
| App Store / Play Store review | **Not submitted** |

`package-mac.mjs` signs but does not notarize. `verify-mac.mjs` checks
signatures and source integrity, not Apple's notary ticket. A notarization
claim would require `notarytool` credentials and a stapled ticket.

## Updates

- Update channel, install, recovery and rollback screens exist (`s-239`,
  `s-426`–`s-430`).
- There is no live auto-update service in the repository; the host reports
  update states honestly when no updater answers.
- VFD rule updates ship with releases; automatic signed rule updates are
  architected but not built (`docs/VFD-MAINTENANCE.md`).

## Incident response

Runbook:

1. Freeze the release channel and stop promoting the build.
2. Preserve artifacts, hashes and logs; do not delete evidence.
3. Select the last verified signed release (drill above).
4. Re-point download/update metadata and verify `SHA256SUMS.txt` after transfer.
5. Publish an incident notice with scope and affected versions.
6. Open a post-incident review with a rollback/forward-fix decision.

## Exit gate

| Gate item | State |
|---|---|
| Reproducible signed release | **Green locally** (macOS + Windows verified) |
| Checksums and release manifest | **Generated** |
| Rollback drill | **Passed** (dry run, 6/6 artifacts) |
| Notarization | **Gap** — no credentials |
| Store review | **Gap** — not submitted |
| Live update service | **Gap** — screens only |
| Gate met | **Yes, locally** for signed release + rollback drill |

P16's named gate is green. Notarization, store review and a live updater are
recorded external gaps.
