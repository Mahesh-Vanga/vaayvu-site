# Reproducible developer setup

P01 pins the workstation toolchain and the repository layout. The goal is one
documented path from a clean machine to the same test result CI produces.

## Pinned toolchains

| Tool | Pin | Where |
|---|---|---|
| Node.js | `22.13.0` minimum (`.nvmrc`) | `.nvmrc`, `windows/package.json` `engines.node` |
| Electron | `45.4.1` | `windows/package.json` devDependencies |
| Playwright | `1.62.1` | `.github/workflows/build.yml` |
| Java | `21` (Temurin) | `.github/workflows/build.yml` |
| Android SDK | `36` / build-tools `36.0.0` | `.github/workflows/build.yml` |

Use the pinned Node version before anything else:

```sh
nvm install
nvm use
node scripts/doctor.cjs
```

`scripts/doctor.cjs` fails when Node is older than the pin, a component
directory is missing, the desktop lockfile is absent, or `engines.node`
disagrees with `.nvmrc`.

## Repository layout (monorepo)

| Path | Component |
|---|---|
| `chrome/` | Shared browser UI, onboarding/atlas screens, blocking rules |
| `windows/` | Electron desktop runtime, packaging and verification |
| `apple/` | Xcode project and iPhone/macOS packaging scripts |
| `android/` | Gradle project and Android WebView browser |
| `sync/` | Optional self-hosted account sync service |
| `tests/` | Shared tests, UI probes and release evidence |
| `docs/` | Canonical inventory, charter, phases, decisions and sources |
| `scripts/` | Reproducible setup and guard scripts |

There is no root `package.json`; desktop dependencies install with
`--prefix windows`.

## Developer setup

```sh
# Desktop dependencies
npm ci --prefix windows
npm --prefix windows exec -- install-electron

# Shared contract tests
node --test tests/*.test.cjs sync/*.test.mjs

# Desktop app and real-window tests
npm --prefix windows start
npm --prefix windows test
```

Platform builds:

| Platform | Command |
|---|---|
| macOS app | `npm --prefix windows run package:mac` then `npm --prefix windows run verify:mac` |
| Windows app | `npm --prefix windows run package` then `npm --prefix windows run verify` |
| Android | `android/gradlew -p android :app:testDebugUnitTest :app:assembleDebug` |
| iPhone | `APPLE_DEVELOPMENT_TEAM=<team-id> bash apple/scripts/package.sh device` |

## CI gates

`.github/workflows/build.yml` runs on every push and pull request:

1. `scripts/doctor.cjs` — pinned toolchain and layout.
2. Syntax-check every `chrome/*.js`, then `node --test tests/*.test.cjs sync/*.test.mjs`.
3. Playwright UI probes at desktop and phone sizes.
4. Docker Compose configuration validation for `sync/deploy/compose.yaml`.
5. Platform jobs for the Electron Mac browser, iPhone simulator tests, and
   Android unit tests plus debug APK assembly.

The checks job is the minimal CI gate. Platform jobs depend on it.

## Secrets boundaries

- Workflows declare `permissions: contents: read` and use no repository
  secrets.
- `.gitignore` excludes `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`,
  `*.keystore`, `*.jks`, provisioning profiles, SQLite databases and the Android
  keystore directory. `.env.example` is the only tracked environment template.
- Never commit signing identities, provider tokens or account-sync
  credentials. CI runners receive none.
- Local `.env` files may exist; `scripts/doctor.cjs` warns if one is present and
  keeps it out of evidence.

## P01 status

| Exit gate | Evidence | State |
|---|---|---|
| Toolchains pinned | `.nvmrc`, `windows/package.json`, CI workflow | Implemented |
| Monorepo initialized | `chrome/ windows/ apple/ android/ sync/ tests/` | Already present; recorded |
| CI defined and minimal gate wired | `.github/workflows/build.yml` | Implemented |
| Reproducible developer setup | this document, `scripts/doctor.cjs`, `README.md` | Implemented |
| Green CI observed | Build Vaayvu run 46119790946 | **Green remotely** (checks, Windows, Apple, Android) |
