# Extensions and web applications (P28)

P28 covers trusted extension permissions, PWA capability and independence from
Rasha/ad blocking.

## Trusted extension permissions

The shipping extension runtime is CSS-only (P12):

- manifest V3 shape, bounded fields and 1–16 CSS records;
- exact HTTPS host matches only; no wildcards or `<all_urls>`;
- no JavaScript, background service worker, native messaging or store install;
- fixed CSS property allowlist; no `url()`, `@import`, `var()`, escapes or
  attribute selectors;
- ZIP/file/expanded-size caps and no encryption;
- private tabs never receive extension CSS;
- safe mode disables all style packages without deleting them.

Permission review is therefore a **negative** capability: there is no script
permission to grant, and unsupported permissions are rejected at install.

## Rasha independence

Style extensions are applied by `cssFor` from the extension package alone. They
do not read the VFD policy, ad-block switch or Rasha state. Tests assert the CSS
still applies when ad blocking is off; disabling protection cannot disable an
extension, and enabling an extension cannot bypass protection.

## PWA capability

| Item | State |
|---|---|
| Install prompt / manifest handling | **Not implemented** |
| Standalone app window | **Not implemented** |
| Offline app shell | **Not implemented** |
| App permissions UI | Screens only (`s-534`–`s-539`) |
| Removal/uninstall | Screens only |

Web-app install, window, offline, permission, and removal screens are contracts.
There is no PWA install runtime in the desktop, Android or Apple hosts.

## Exit gate

| Gate item | State |
|---|---|
| Trusted extension permissions | **Green** |
| No forbidden Rasha dependency | **Green** (style extensions independent) |
| PWA capability | **Gap** — no runtime |
| Gate met | **Partially** — extension trust green, PWA missing |

P28 cannot be fully green until a PWA install/window/offline runtime exists.
