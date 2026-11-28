# Install a style extension

Choose **⋯ → Extensions → Try Wikipedia Reading Type**, review the website it lists, and select **Install extension**. Open an article on English Wikipedia to see its larger text and increased line spacing. Return to **Extensions** to turn it off or remove it.

To install the same example from a file, download [Wikipedia Reading Type](Wikipedia-Reading-Type.zip). Choose that file under **Install from ZIP**. Bookmarks and sync accounts are independent of installed extensions. Each regular profile manages its own packages.

## Make a compatible package

Put `manifest.json` and the referenced CSS files at the root of a ZIP, or put the CSS in a named subdirectory. The example ZIP in this folder contains both files. Vaayvu understands the following subset of [Manifest V3 content scripts](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts).

```json
{
  "manifest_version": 3,
  "name": "Wikipedia Reading Type",
  "version": "1.0",
  "content_scripts": [
    {
      "matches": ["https://en.wikipedia.org/*"],
      "css": ["reading.css"]
    }
  ]
}
```

```css
.mw-parser-output p, .mw-parser-output li {
  font-size: 1.1em !important;
  line-height: 1.8 !important;
}
```

Each match specifies one exact HTTPS hostname and all paths on that host. Styles apply to the top-level document of regular tabs. Vaayvu shows the sites during installation. Native profiles support up to ten packages, each with up to 12 KB of style rules. ZIP files can be up to 256 KB.

Use flat CSS rules with element, class, ID, descendant or child selectors. Supported declarations cover text color, background color, font family, size, weight and style, line height, spacing, text alignment, decoration, transformation and indentation, maximum width, margin, padding and corner radius. Use literal values such as named colors, hex colors and dimensions. The installer rejects scripts, background workers, extra permissions, wildcard hosts, at-rules and CSS functions.

General Chrome Web Store, Firefox and Safari extensions need their respective browser APIs. The [project README](../README.md) describes Vaayvu’s desktop and mobile builds.
