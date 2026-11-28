# Vaayvu artwork

The original editable window artwork is [Vaayvu_16K_Vector_Transparent.svg](Vaayvu_16K_Vector_Transparent.svg). It supplies the browser window, coral tab, blue V, cyan ribbons and blue folded corner used across Vaayvu.

The browser UI uses [a fitted SVG](../chrome/assets/vaayvu.svg) with the same paths and gradients. The Dock uses the transparent [desktop PNG](vaayvu-desktop.png). The Windows icon contains seven sizes of that silhouette. Android’s one-color artwork uses the original V and ribbon paths in [the themed mark](vaayvu-mark.svg).

## App icon

[Vaayvu_V_Wind_16K.svg](Vaayvu_V_Wind_16K.svg) is the V/wind app icon. It is intentionally **not** used in the browser chrome, window, Dock tile, Windows icon or launch screens: those keep the artwork above. It supplies the platform application icons only:

- [vaayvu-appicon.png](vaayvu-appicon.png) is the transparent rounded tile used for the macOS `.icns` and the app icon shown in the DMG and PKG.
- [vaayvu-appicon-full.png](vaayvu-appicon-full.png) is the edge-to-edge square used for the macOS 26 layered icon and the iPhone `AppIcon`.
- `android/app/src/main/res/mipmap-nodpi/vaayvu_appicon_back.png` and `vaayvu_appicon_glyph.png` are the adaptive-icon background and foreground for the APK.

The exports are checked in. To regenerate everything, run `node branding/export-icons.cjs` for the shared and desktop artwork with Sharp 0.35.5 available to Node, then run `node branding/export-app-icons.cjs` with Playwright Chromium installed. The platform projects include their native renditions for offline builds.
