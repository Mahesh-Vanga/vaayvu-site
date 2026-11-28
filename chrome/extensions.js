'use strict';

const VaayvuExtensions = (() => {
  const core = typeof VaayvuCore === 'undefined' ? require('./core.js') : VaayvuCore;
  const maxStyle = 12000;
  const maxPackages = 10;
  const properties = new Set(
    'color background-color font-family font-size font-weight font-style line-height letter-spacing word-spacing text-align text-decoration text-transform text-indent max-width margin margin-inline margin-top margin-bottom padding padding-inline padding-top padding-bottom border-radius'.split(
      ' ',
    ),
  );
  const sampleManifest = {
    manifest_version: 3,
    name: 'Wikipedia Reading Type',
    version: '1.0',
    description: 'Slightly larger article text and wider line spacing on English Wikipedia.',
    content_scripts: [{ matches: ['https://en.wikipedia.org/*'], css: ['reading.css'] }],
  };
  const sampleCSS =
    '.mw-parser-output p, .mw-parser-output li { font-size: 1.1em !important; line-height: 1.8 !important; }';
  const sampleFiles = {
    'manifest.json': JSON.stringify(sampleManifest, null, 2),
    'reading.css': sampleCSS,
  };
  function check(condition, message) {
    if (!condition) throw Error(message);
  }
  function checkKeys(object, allowed) {
    check(
      object && typeof object === 'object' && !Array.isArray(object),
      'Expected an extension manifest object.',
    );
    for (const key of Object.keys(object))
      check(allowed.includes(key), 'Unsupported manifest feature: ' + key);
  }
  function validateCSS(source) {
    check(typeof source === 'string' && source.length <= maxStyle, 'The stylesheet is too large.');
    const css = source.replace(/\/\*[\s\S]*?\*\//g, ' ').trim();
    const blocks = Array.from(css.matchAll(/([^{}]+)\{([^{}]+)\}/g));
    check(
      blocks.length &&
        blocks
          .map((m) => m[0])
          .join('')
          .trim() === css,
      'Use flat CSS rules without at-rules or nested blocks.',
    );
    const result = [];
    for (const [, selectors, body] of blocks) {
      check(
        selectors.split(',').every((s) => /^[a-zA-Z0-9_.*#>\s-]+$/.test(s.trim()) && !!s.trim()),
        'Use element, class or ID selectors.',
      );
      const declarations = [];
      for (const raw of body
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)) {
        const match = /^([a-z-]+)\s*:\s*(.+)$/i.exec(raw);
        check(
          match && properties.has(match[1].toLowerCase()),
          'The package uses an unsupported CSS property.',
        );
        const value = match[2].replace(/\s*!important$/i, '').trim();
        check(
          /^[a-zA-Z0-9#.%,' "0-9-]+$/.test(value),
          'Style values may contain only colors, names and dimensions.',
        );
        declarations.push(match[1].toLowerCase() + ':' + match[2]);
      }
      check(declarations.length, 'A style rule is empty.');
      result.push(selectors.trim() + '{' + declarations.join(';') + '}');
    }
    return result.join('\n');
  }
  function validFile(path) {
    return (
      typeof path === 'string' &&
      path.length <= 160 &&
      path.split('/').every((part) => /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(part))
    );
  }
  function parsePackage(files) {
    let manifest;
    try {
      manifest = JSON.parse(files['manifest.json']);
    } catch {
      throw Error('Include manifest.json at the root of the ZIP.');
    }
    checkKeys(manifest, [
      'manifest_version',
      'name',
      'description',
      'version',
      'content_scripts',
      'icons',
      'author',
      'short_name',
    ]);
    check(manifest.manifest_version === 3, 'Choose a Manifest V3 style extension.');
    check(
      typeof manifest.name === 'string' && manifest.name.trim() && manifest.name.length <= 80,
      'Invalid extension name.',
    );
    check(
      typeof manifest.version === 'string' &&
        /^\d+(?:\.\d+){0,3}$/.test(manifest.version) &&
        manifest.version.length <= 32,
      'Invalid extension version.',
    );
    check(
      Array.isArray(manifest.content_scripts) &&
        manifest.content_scripts.length > 0 &&
        manifest.content_scripts.length <= 16,
      'Include up to 16 CSS content script entries.',
    );
    let total = 0;
    const rules = manifest.content_scripts.map((record) => {
      checkKeys(record, ['matches', 'css']);
      check(
        Array.isArray(record.matches) && record.matches.length > 0 && record.matches.length <= 30,
        'Declare the exact HTTPS sites for this style.',
      );
      const hosts = [
        ...new Set(
          record.matches.map((pattern) => {
            const match = typeof pattern === 'string' && /^https:\/\/([a-z0-9.-]+)\/\*$/i.exec(pattern);
            check(
              match &&
                match[1].includes('.') &&
                match[1].length <= 253 &&
                match[1].split('.').every((s) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(s)) &&
                new URL('https://' + match[1]).hostname === match[1].toLowerCase(),
              'Use exact HTTPS site patterns such as https://en.wikipedia.org/*.',
            );
            return match[1].toLowerCase();
          }),
        ),
      ];
      check(
        Array.isArray(record.css) && record.css.length > 0 && record.css.length <= 12,
        'List the local stylesheets in content_scripts.css.',
      );
      const css = record.css
        .map((name) => {
          check(
            validFile(name) && /\.css$/i.test(name) && Object.hasOwn(files, name),
            'Missing or unsupported stylesheet.',
          );
          return validateCSS(files[name]);
        })
        .join('\n');
      total += css.length;
      check(total <= maxStyle, 'A style package must fit within 12 KB.');
      return { hosts, css };
    });
    return {
      name: manifest.name.trim(),
      version: manifest.version,
      description: String(manifest.description || '').slice(0, 240),
      rules,
    };
  }
  async function unpack(file, lib = zip) {
    check(file && file.size > 0 && file.size <= 256 * 1024, 'Choose a ZIP smaller than 256 KB.');
    const reader = new lib.ZipReader(new lib.BlobReader(file), { useWebWorkers: false });
    const files = Object.create(null),
      paths = new Set();
    let used = 0;
    try {
      for await (const entry of reader.getEntriesGenerator()) {
        if (entry.directory) continue;
        const path = entry.filename;
        check(
          validFile(path) && !paths.has(path) && paths.size < 40 && !entry.encrypted,
          'Invalid, encrypted or duplicate ZIP entry.',
        );
        paths.add(path);
        if (path !== 'manifest.json' && !/\.css$/i.test(path)) continue;
        check(
          entry.uncompressedSize <= 32000 && used + entry.uncompressedSize <= 96000,
          'The uncompressed package is too large.',
        );
        let size = 0;
        const decoder = new TextDecoder('utf-8', { fatal: true });
        let content = '';
        await entry.getData(
          new WritableStream({
            write(chunk) {
              size += chunk.byteLength;
              check(size <= 32000 && used + size <= 96000, 'The expanded ZIP exceeds the style limit.');
              content += decoder.decode(chunk, { stream: true });
            },
          }),
          { checkSignature: true, useWebWorkers: false },
        );
        files[path] = content + decoder.decode();
        used += size;
      }
    } finally {
      await reader.close();
    }
    return parsePackage(files);
  }
  function cssFor(addons, tab) {
    if (tab.private || !tab.url || !tab.url.startsWith('https://')) return '';
    const host = new URL(tab.url).hostname;
    return addons
      .filter((a) => a.enabled)
      .flatMap((a) => a.rules.filter((r) => r.hosts.includes(host)).map((r) => r.css))
      .join('\n');
  }
  let installed = [],
    pending = null,
    revision = 0;
  const prefix = 'vaayvu.styleExtension.';
  function refresh() {
    const valid = [];
    try {

      for (const key of Object.keys(localStorage)
        .filter((k) => k.startsWith(prefix))
        .sort()) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (
            !item ||
            typeof item.name !== 'string' ||
            prefix + item.name !== key ||
            !Array.isArray(item.rules)
          )
            continue;
          let length = 0;
          const supported = item.rules.every((rule) => {
            length += rule.css.length;
            return (
              length <= maxStyle &&
              Array.isArray(rule.hosts) &&
              rule.hosts.every((host) => typeof host === 'string') &&
              !!validateCSS(rule.css)
            );
          });
          if (supported) valid.push(item);
        } catch {
          /* Ignore an unreadable package without disabling the other extensions. */
        }
      }
    } catch {
      /* This browsing context has no persistent storage. */
    }
    installed = valid;
  }
  function apply(tab) {
    if (
      !capabilities.canUserStyles ||
      tab.private ||
      windowInfo.private ||
      !mounted.has(tab.id) ||
      !core.webURL(tab.url) ||
      tab.loading ||
      tab.error
    )
      return;
    const css = cssFor(installed, tab);
    if (css || tab.styled) send({ type: 'userStyles', id: tab.id, url: tab.url, css });
    tab.styled = !!css;
  }
  function store(name, item) {
    try {
      if (item) localStorage.setItem(prefix + name, JSON.stringify(item));
      else localStorage.removeItem(prefix + name);
    } catch {
      toast('Extension storage is full or unavailable.');
      return false;
    }
    refresh();
    tabs.forEach(apply);
    return true;
  }
  // s-019 safe mode disables every installed style extension in one step and
  // reports how many actually changed. The packages stay installed so the
  // extension manager can turn them back on.
  function disableAll() {
    let changed = 0;
    try {
      const keys = [];
      if (typeof localStorage.length === 'number' && typeof localStorage.key === 'function') {
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index);
          if (key) keys.push(key);
        }
      } else {
        keys.push(...Object.keys(localStorage));
      }
      for (const key of keys.filter(
        (name) => name.startsWith(prefix),
      )) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (!item || item.enabled !== true) continue;
          item.enabled = false;
          localStorage.setItem(key, JSON.stringify(item));
          changed += 1;
        } catch (error) {}
      }
    } catch (error) {}
    if (changed) {
      try {
        refresh();
        tabs.forEach(apply);
      } catch (error) {}
    }
    return changed;
  }

  const hostsFor = (p) => [...new Set(p.rules.flatMap((r) => r.hosts))].join(', ');
  function manager() {
    if (windowInfo.private || !capabilities.canUserStyles) return;
    pending = null;
    revision++;
    refresh();
    const rows = installed
      .map(
        (p) =>
          '<div class="ext-entry"><div><strong>' +
          e(p.name) +
          '</strong><small>' +
          e(hostsFor(p)) +
          '</small></div><label><input type="checkbox" data-enable-ext="' +
          e(p.name) +
          '" ' +
          (p.enabled ? 'checked' : '') +
          '> Enabled</label><button class="icon" data-remove-ext="' +
          e(p.name) +
          '" aria-label="Remove ' +
          e(p.name) +
          '">' +
          icon('trash') +
          '</button></div>',
      )
      .join('');
    dialog(
      'Extensions',
      '<div class="stack"><p>Install a Manifest V3 style extension to change the appearance of its listed websites. Scripted extensions and store packages require a different extension runtime.</p>' +
        '<label>Install from ZIP<input id="extension-file" type="file" accept=".zip,application/zip"></label>' +
        '<button class="subtle" data-sample-ext>Try Wikipedia Reading Type</button>' +
        (rows || '<p class="muted">No extensions installed.</p>') +
        '<p role="status" id="extension-result"></p></div>',
      'extensions',
    );
  }
  function review(pkg) {
    const existing = installed.some((a) => a.name === pkg.name);
    pending = pkg;
    dialog(
      existing ? 'Replace style extension?' : 'Install style extension?',
      '<div class="stack"><div><strong>' +
        e(pkg.name) +
        '</strong> · ' +
        e(pkg.version) +
        '<p>' +
        e(pkg.description) +
        '</p></div><div><strong>Can change the appearance of</strong><p>' +
        e(hostsFor(pkg)) +
        '</p></div><p class="muted">Applies to regular tabs in this profile.</p><div class="dialogbuttons"><button class="primary" data-install-ext>' +
        (existing ? 'Replace extension' : 'Install extension') +
        '</button>' +
        actButton('extensions', 'Cancel') +
        '</div></div>',
      'reviewExtension',
    );
  }
  function bind() {
    refresh();
    window.addEventListener('storage', (event) => {
      if (windowInfo.private || (event.key && !event.key.startsWith(prefix))) return;
      refresh();
      tabs.forEach(apply);
      if (modal === 'extensions') manager();
    });
    document.addEventListener('change', async (event) => {
      if (modal !== 'extensions' || windowInfo.private) return;
      const el = event.target;
      if (el.id === 'extension-file' && el.files[0]) {
        const start = ++revision;
        try {
          const pkg = await unpack(el.files[0]);
          if (modal === 'extensions' && revision === start) review(pkg);
        } catch (err) {
          if (el.isConnected)
            $('#extension-result').textContent = err.message || 'Could not open this ZIP.';
        }
        el.value = '';
      } else if (el.hasAttribute('data-enable-ext')) {
        refresh();
        const entry = installed.find((item) => item.name === el.dataset.enableExt);
        if (entry && !store(entry.name, { ...entry, enabled: el.checked })) el.checked = !el.checked;
      }
    });
    document.addEventListener('click', (event) => {
      const el = event.target.closest('button');
      if (!el || windowInfo.private || !capabilities.canUserStyles) return;
      if (modal === 'extensions' && el.hasAttribute('data-sample-ext')) review(parsePackage(sampleFiles));
      if (modal === 'extensions' && el.hasAttribute('data-remove-ext')) {
        if (store(el.dataset.removeExt, null)) manager();
      }
      if (modal === 'reviewExtension' && el.hasAttribute('data-install-ext') && pending) {
        refresh();
        const next = installed.filter((a) => a.name !== pending.name);
        if (next.length >= maxPackages) {
          toast('Remove an extension before installing another.');
          return;
        }
        if (store(pending.name, { ...pending, enabled: true })) {
          manager();
          toast('Extension installed.');
        }
      }
    });
  }
  return { parsePackage, unpack, cssFor, bind, apply, manager, sampleFiles, disableAll };
})();
if (typeof module !== 'undefined') module.exports = VaayvuExtensions;
