'use strict';

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Toast ------------------------------------------------------------------ */

  const toast = $('[data-toast]');
  let toastTimer = null;
  function say(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2200);
  }

  /* Header ----------------------------------------------------------------- */

  const masthead = $('.masthead');
  const progress = $('[data-progress]');
  const rootElement = document.documentElement;
  const themeToggle = $('[data-theme-toggle]');
  const themeColor = $('meta[name="theme-color"]');
  const railLinks = $$('[data-section]');
  const railSections = railLinks
    .map((link) => ({ link, section: document.getElementById(link.dataset.section) }))
    .filter((entry) => entry.section);

  const applyTheme = (dusk, persist) => {
    if (dusk) rootElement.dataset.theme = 'dusk';
    else delete rootElement.dataset.theme;
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(dusk));
      themeToggle.setAttribute('aria-label', dusk ? 'Switch to paper theme' : 'Switch to dusk theme');
    }
    if (themeColor) themeColor.setAttribute('content', dusk ? '#15120f' : '#f3f0e8');
    if (persist) {
      try {
        localStorage.setItem('vaayvu.site.theme', dusk ? 'dusk' : 'paper');
      } catch {}
    }
    window.dispatchEvent(new Event('themechange'));
  };
  if (themeToggle) {
    applyTheme(rootElement.dataset.theme === 'dusk', false);
    themeToggle.addEventListener('click', () => applyTheme(rootElement.dataset.theme !== 'dusk', true));
  }

  const markSection = () => {
    if (!railSections.length) return;
    const marker = window.innerHeight * 0.34;
    let active = null;
    for (const entry of railSections) {
      const rect = entry.section.getBoundingClientRect();
      if (rect.top <= marker && rect.bottom > marker) active = entry;
    }
    railLinks.forEach((link) => {
      const on = !!active && link === active.link;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  const onScroll = () => {
    masthead?.classList.toggle('is-scrolled', window.scrollY > 8);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      progress.style.transform = 'scaleX(' + ratio + ')';
    }
    markSection();
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  const nav = $('#primary-nav');
  const menu = $('.menu-toggle');
  if (nav && menu) {
    const close = () => {
      nav.classList.remove('is-open');
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', 'Open menu');
    };
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    $$('a', nav).forEach((link) => link.addEventListener('click', close));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 820) close();
    });
  }

  /* Wind field behind the hero --------------------------------------------- */

  const windCanvas = $('[data-wind]');
  if (windCanvas && typeof windCanvas.getContext === 'function') {
    const ctx = windCanvas.getContext('2d');
    if (ctx) {
      const hero = windCanvas.closest('.hero') || windCanvas.parentElement;
      const particles = [];
      let width = 0;
      let height = 0;
      let raf = 0;
      let running = false;
      let visible = true;
      let last = 0;

      const isDusk = () => document.documentElement.dataset.theme === 'dusk';
      const bandColor = (alpha) =>
        isDusk() ? 'rgba(143, 192, 164, ' + alpha + ')' : 'rgba(31, 91, 115, ' + alpha + ')';
      const emberColor = (alpha) =>
        isDusk() ? 'rgba(224, 138, 85, ' + alpha + ')' : 'rgba(201, 98, 42, ' + alpha + ')';

      const seed = () => {
        particles.length = 0;
        const count = width < 720 ? 46 : 96;
        for (let i = 0; i < count; i += 1) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            life: Math.random() * 500,
            span: 420 + Math.random() * 760,
            accent: Math.random() < 0.08,
          });
        }
      };

      const drawBands = (phase, alpha) => {
        const bands = 6;
        ctx.lineWidth = 0.8;
        for (let band = 0; band < bands; band += 1) {
          const base = (height * (band + 1)) / (bands + 1);
          ctx.beginPath();
          for (let x = 0; x <= width; x += 22) {
            const y =
              base +
              Math.sin(x * 0.002 + phase + band * 0.8) * 16 +
              Math.cos(x * 0.0013 - phase * 0.6 + band * 0.5) * 9;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = bandColor(alpha);
          ctx.stroke();
        }
      };

      const drawStatic = () => {
        ctx.clearRect(0, 0, width, height);
        drawBands(0, 0.08);
        ctx.lineWidth = 0.7;
        for (let i = 0; i < 140; i += 1) {
          const x = Math.random() * width;
          const y = Math.random() * height;
          const angle = Math.sin(x * 0.0035 + y * 0.0028) * Math.PI;
          ctx.strokeStyle = i % 11 === 0 ? emberColor(0.10) : bandColor(0.13);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(angle) * 14, y + Math.sin(angle) * 14);
          ctx.stroke();
        }
      };

      const resize = () => {
        const rect = windCanvas.getBoundingClientRect();
        width = Math.max(1, Math.round(rect.width));
        height = Math.max(1, Math.round(rect.height));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        windCanvas.width = Math.round(width * dpr);
        windCanvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        seed();
        if (reduceMotion) drawStatic();
      };

      const step = (time) => {
        if (!running) return;
        raf = requestAnimationFrame(step);
        if (document.hidden || !visible) return;
        if (time - last < 33) return;
        last = time;
        ctx.clearRect(0, 0, width, height);
        const t = time * 0.00012;
        drawBands(time * 0.00035, 0.09);
        for (const particle of particles) {
          const angle =
            (Math.sin(particle.x * 0.0032 + t) +
              Math.cos(particle.y * 0.0026 - t * 0.8) +
              Math.sin((particle.x + particle.y) * 0.0014 + t * 0.4)) *
            Math.PI;
          const speed = 0.55 + (particle.span % 5) * 0.05;
          particle.x += Math.cos(angle) * speed;
          particle.y += Math.sin(angle) * speed;
          particle.life += 1;
          if (
            particle.life > particle.span ||
            particle.x < -24 ||
            particle.x > width + 24 ||
            particle.y < -24 ||
            particle.y > height + 24
          ) {
            particle.x = Math.random() * width;
            particle.y = Math.random() * height;
            particle.life = 0;
            continue;
          }
          const fade = Math.sin((Math.PI * particle.life) / particle.span);
          ctx.strokeStyle = particle.accent
            ? emberColor(0.10 * fade)
            : bandColor(0.18 * fade);
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(particle.x - Math.cos(angle) * 18, particle.y - Math.sin(angle) * 18);
          ctx.stroke();
        }
      };

      const start = () => {
        if (reduceMotion || running) return;
        running = true;
        last = 0;
        raf = requestAnimationFrame(step);
      };
      const stop = () => {
        running = false;
        cancelAnimationFrame(raf);
      };

      resize();
      window.addEventListener('themechange', () => {
        if (reduceMotion) drawStatic();
      });
      if (reduceMotion) {
        drawStatic();
      } else {
        start();
        new IntersectionObserver(
          (entries) => {
            visible = entries[0].isIntersecting;
          },
          { threshold: 0 },
        ).observe(hero);
        window.addEventListener('resize', resize);
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) stop();
          else start();
        });
      }
    }
  }

  /* Observatory clock ------------------------------------------------------ */

  const clock = $('#demo-time');
  const date = $('#demo-date');
  if (clock && date) {
    const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    const tick = () => {
      const now = new Date();
      clock.textContent = timeFormat.format(now);
      clock.setAttribute('datetime', now.toISOString());
      date.textContent = dateFormat.format(now);
    };
    tick();
    setInterval(tick, 30000);
  }

  /* Preview tabs ----------------------------------------------------------- */

  const demoTabs = $$('[data-demo-tab]');
  if (demoTabs.length) {
    const selectDemoTab = (tab) => {
      const key = tab.dataset.demoTab;
      demoTabs.forEach((other) => {
        const active = other === tab;
        other.setAttribute('aria-selected', String(active));
        other.tabIndex = active ? 0 : -1;
      });
      $$('[data-demo-pane]').forEach((pane) => {
        pane.hidden = pane.dataset.demoPane !== key;
      });
    };
    demoTabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectDemoTab(tab));
      tab.addEventListener('keydown', (event) => {
        const last = demoTabs.length - 1;
        let next = -1;
        if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
        else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = last;
        if (next < 0) return;
        event.preventDefault();
        selectDemoTab(demoTabs[next]);
        demoTabs[next].focus();
      });
    });
  }

  /* Browser screenshot tour ------------------------------------------------ */

  const shotButtons = $$('[data-shot-view]');
  const shotImage = $('[data-shot-image]');
  const shotCaption = $('[data-shot-caption]');
  const shotPanel = $('#shot-panel');
  if (shotButtons.length && shotImage) {
    const selectShot = (button, index) => {
      shotButtons.forEach((other, otherIndex) => {
        const active = other === button;
        other.setAttribute('aria-selected', String(active));
        other.tabIndex = active ? 0 : -1;
      });
      const next = new Image();
      next.onload = () => {
        shotImage.src = next.src;
        shotImage.alt = button.dataset.alt || '';
        if (shotCaption) shotCaption.textContent = button.dataset.caption || '';
        if (shotPanel && button.id) shotPanel.setAttribute('aria-labelledby', button.id);
        requestAnimationFrame(() => shotImage.classList.remove('is-swapping'));
      };
      shotImage.classList.add('is-swapping');
      next.src = button.dataset.src;
    };
    shotButtons.forEach((button, index) => {
      button.addEventListener('click', () => selectShot(button, index));
      button.addEventListener('keydown', (event) => {
        const last = shotButtons.length - 1;
        let next = -1;
        if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
        else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = last;
        if (next < 0) return;
        event.preventDefault();
        selectShot(shotButtons[next], next);
        shotButtons[next].focus();
      });
    });
    window.addEventListener(
      'load',
      () => {
        for (const button of shotButtons.slice(1)) {
          const image = new Image();
          image.src = button.dataset.src;
        }
      },
      { once: true },
    );
  }

  /* Tilt the real screenshot under the pointer ------------------------------ */

  const browserFrame = $('.real-browser');
  if (browserFrame && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    const resetTilt = () => {
      browserFrame.style.transform = 'perspective(1400px) rotateX(0) rotateY(0)';
    };
    browserFrame.addEventListener('pointermove', (event) => {
      const rect = browserFrame.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      browserFrame.style.transform =
        'perspective(1400px) rotateX(' + (-y * 1.4).toFixed(2) + 'deg) rotateY(' + (x * 1.8).toFixed(2) + 'deg)';
    });
    browserFrame.addEventListener('pointerleave', resetTilt);
    browserFrame.addEventListener('blur', resetTilt);
  }

  /* Command palette -------------------------------------------------------- */

  const palette = $('[data-palette]');
  const paletteInput = $('[data-palette-input]');
  const paletteList = $('[data-palette-list]');
  const paletteEmpty = $('[data-palette-empty]');
  const paletteTriggers = $$('[data-palette-open]');
  if (palette && paletteInput && paletteList) {
    let paletteOpen = false;
    let selected = 0;
    let matches = [];
    let lastFocus = null;

    const goTo = (id) => {
      const target = document.getElementById(id);
      if (!target) return;
      closePalette();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    };

    const openLink = (url) => {
      closePalette();
      window.open(url, '_blank', 'noopener');
    };

    const commands = [
      { label: 'Rasha Shield', hint: 'Section', terms: 'ads trackers blocking ads', run: () => goTo('shield') },
      { label: 'Spaces', hint: 'Section', terms: 'work study personal workspaces', run: () => goTo('spaces') },
      { label: 'Privacy route', hint: 'Section', terms: 'sync server cloud device', run: () => goTo('privacy') },
      { label: 'Everyday tools', hint: 'Section', terms: 'features split view tab groups passwords reader', run: () => goTo('features') },
      { label: 'Download Vaayvu', hint: 'Section', terms: 'mac windows android dmg pkg zip apk', run: () => goTo('download') },
      { label: 'Questions', hint: 'Section', terms: 'faq help answers', run: () => goTo('faq') },
      {
        label: () => (rootElement.dataset.theme === 'dusk' ? 'Switch to paper theme' : 'Switch to dusk theme'),
        hint: 'Appearance',
        terms: 'dark light mode theme colour color',
        run: () => {
          applyTheme(rootElement.dataset.theme !== 'dusk', true);
          closePalette();
        },
      },
      { label: 'Source on GitHub', hint: 'GitHub', terms: 'code repository public', run: () => openLink('https://github.com/Mahesh-Vanga/vaayvu-site') },
      { label: 'Release notes', hint: 'v0.0.23', terms: 'changelog versions downloads', run: () => openLink('https://github.com/Mahesh-Vanga/vaayvu-site/releases') },
    ];

    const labelOf = (command) => (typeof command.label === 'function' ? command.label() : command.label);

    const paintSelection = () => {
      [...paletteList.children].forEach((item, index) => {
        const on = index === selected;
        item.classList.toggle('is-active', on);
        item.setAttribute('aria-selected', String(on));
        if (on) item.scrollIntoView({ block: 'nearest' });
      });
      const active = paletteList.children[selected];
      if (active) paletteInput.setAttribute('aria-activedescendant', active.id);
      else paletteInput.removeAttribute('aria-activedescendant');
    };

    const render = () => {
      const query = paletteInput.value.trim().toLowerCase();
      const rank = (command) => {
        if (!query) return 0;
        const label = labelOf(command).toLowerCase();
        if (label.startsWith(query)) return 0;
        if (label.includes(query)) return 1;
        if ((command.hint + ' ' + command.terms).toLowerCase().includes(query)) return 2;
        return -1;
      };
      matches = commands
        .map((command, index) => ({ command, index, score: rank(command) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => a.score - b.score || a.index - b.index)
        .map((entry) => entry.command);
      selected = Math.min(selected, Math.max(0, matches.length - 1));
      paletteList.replaceChildren();
      matches.forEach((command, index) => {
        const item = document.createElement('li');
        item.id = 'palette-opt-' + index;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');
        const label = document.createElement('span');
        label.textContent = labelOf(command);
        const hint = document.createElement('span');
        hint.className = 'cmd-hint';
        hint.textContent = command.hint;
        item.append(label, hint);
        item.addEventListener('pointerenter', () => {
          selected = index;
          paintSelection();
        });
        item.addEventListener('click', () => command.run());
        paletteList.append(item);
      });
      if (paletteEmpty) paletteEmpty.hidden = matches.length > 0;
      paintSelection();
    };

    const openPalette = (opener) => {
      if (paletteOpen) return;
      paletteOpen = true;
      lastFocus = opener || document.activeElement;
      palette.hidden = false;
      document.body.classList.add('palette-open');
      paletteTriggers.forEach((trigger) => trigger.setAttribute('aria-expanded', 'true'));
      paletteInput.value = '';
      selected = 0;
      render();
      requestAnimationFrame(() => paletteInput.focus());
    };

    const closePalette = () => {
      if (!paletteOpen) return;
      paletteOpen = false;
      palette.hidden = true;
      document.body.classList.remove('palette-open');
      paletteTriggers.forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    };

    paletteTriggers.forEach((trigger) => {
      trigger.addEventListener('click', () => openPalette(trigger));
    });

    $$('[data-palette-close]', palette).forEach((close) => close.addEventListener('click', closePalette));

    paletteInput.addEventListener('input', () => {
      selected = 0;
      render();
    });

    paletteInput.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (matches.length) {
          selected = selected === matches.length - 1 ? 0 : selected + 1;
          paintSelection();
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (matches.length) {
          selected = selected === 0 ? matches.length - 1 : selected - 1;
          paintSelection();
        }
      } else if (event.key === 'Home') {
        event.preventDefault();
        selected = 0;
        paintSelection();
      } else if (event.key === 'End') {
        event.preventDefault();
        selected = Math.max(0, matches.length - 1);
        paintSelection();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        matches[selected]?.run();
      } else if (event.key === 'Tab') {
        event.preventDefault();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closePalette();
      }
    });

    palette.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePalette();
      }
    });

    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        if (paletteOpen) closePalette();
        else openPalette(document.activeElement);
      } else if (event.key === 'Escape' && paletteOpen) {
        closePalette();
      }
    });

    window.addEventListener('themechange', () => {
      if (paletteOpen) render();
    });
  }

  /* Rasha Shield demo ------------------------------------------------------ */

  const shield = $('[data-shield-demo]');
  if (shield) {
    const toggle = $('[data-shield-toggle]', shield);
    const label = $('[data-shield-label]', shield);
    const status = $('[data-shield-status]', shield);
    const apply = (on) => {
      toggle.setAttribute('aria-checked', String(on));
      shield.dataset.shields = on ? 'up' : 'down';
      if (label) label.textContent = on ? 'On' : 'Off';
      if (status) {
        status.textContent = on
          ? 'Rules applied. Reload to see the page without ads.'
          : 'Rules removed for this site. Reload to see the page with its ads.';
      }
    };
    toggle.addEventListener('click', () => apply(toggle.getAttribute('aria-checked') !== 'true'));
  }

  /* Spaces demo ------------------------------------------------------------ */

  const spacesDemo = $('[data-spaces-demo]');
  if (spacesDemo) {
    const choices = $$('[data-space-choice]', spacesDemo);
    const panels = $$('[data-space-panel]', spacesDemo);
    choices.forEach((choice) => {
      choice.addEventListener('click', () => {
        const key = choice.dataset.spaceChoice;
        choices.forEach((other) => other.setAttribute('aria-pressed', String(other === choice)));
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.spacePanel !== key;
        });
      });
    });
  }

  /* Reveal ----------------------------------------------------------------- */

  const revealTargets = $$(
    '.hero-copy, .hero-visual, .section-head, .section-copy, .shield-panel, .shield-flow, .spaces-demo, .privacy-card, .route, .feature, .download-card, .faq-list',
  );
  if (!reduceMotion && 'IntersectionObserver' in window && revealTargets.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    revealTargets.forEach((target) => {
      target.classList.add('reveal');
      observer.observe(target);
    });
  }

  /* Checksums -------------------------------------------------------------- */

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    const value = button.dataset.copy;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      say('SHA-256 copied');
    } catch {
      say('Clipboard is not available in this browser.');
    }
  });

  /* Platform detection ----------------------------------------------------- */

  const ua = navigator.userAgent;
  const platform = /Android/i.test(ua)
    ? 'android'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'ios'
      : /Macintosh|Mac OS X/i.test(ua)
        ? 'mac'
        : /Windows/i.test(ua)
          ? 'windows'
          : '';
  const currentCard = platform ? $(`.download-card[data-platform="${platform}"]`) : null;
  if (currentCard) {
    currentCard.classList.add('is-current');
    const chip = $('[data-platform-chip]', currentCard);
    if (chip) chip.hidden = false;
  }

  /* Download availability -------------------------------------------------- */

  const localPreview =
    location.protocol === 'file:' || ['localhost', '127.0.0.1', ''].includes(location.hostname);
  if (!localPreview) {
    $$('[data-download]').forEach(async (link) => {
      if (new URL(link.href).origin !== location.origin) return; // release assets live on GitHub
      const card = link.closest('.download-card');
      try {
        const response = await fetch(link.href, { method: 'HEAD', cache: 'no-store' });
        if (!response.ok) markMissing(link, card);
      } catch {
        markMissing(link, card);
      }
    });
  }
  function markMissing(link, card) {
    link.dataset.missing = 'true';
    link.setAttribute('aria-disabled', 'true');
    link.addEventListener('click', (event) => {
      event.preventDefault();
      say('This build has not been uploaded to the site yet.');
    });
    if (card && !$('.download-state', card)) {
      const note = document.createElement('span');
      note.className = 'download-state';
      note.textContent = 'Not uploaded yet';
      const actions = $('.download-actions', card);
      actions?.append(note);
    }
  }
})();
