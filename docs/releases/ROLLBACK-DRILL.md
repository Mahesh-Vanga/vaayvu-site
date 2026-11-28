# Release rollback drill

Generated: 2026-11-28T04:37:18.328Z

| Field | Value |
|---|---|
| Current release | 0.0.23 (6 artifacts verified) |
| Rollback target | 0.0.22 (6 artifacts verified) |
| Previous macOS DMG | `hdiutil verify` passed |
| Result | **Pass (dry run)** |

## Drill steps

1. Verified every artifact hash in `docs/releases/0.0.23.json`.
2. Verified every artifact hash in `docs/releases/0.0.22.json`.
3. Confirmed `0.0.23` is newer than `0.0.22`.
4. Verified the previous macOS DMG container.
5. Selected `0.0.22` as the rollback target.

## Real rollback runbook

1. Freeze the current release channel.
2. Publish the previous signed artifacts from `tests/test/0.0.22/`.
3. Verify `SHA256SUMS.txt` after transfer.
4. Re-point the download/update manifest to `0.0.22`.
5. Keep the failed release artifacts for incident review; do not delete evidence.
6. Announce the rollback and open an incident report.

This drill verifies artifacts and target selection. It does **not** replace an
actual install/update rollback on a managed device.
