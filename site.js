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
  const onScroll = () => masthead?.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

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
    '.hero-copy, .hero-visual, .section-head, .section-copy, .shield-panel, .spaces-demo, .privacy-card, .route, .feature, .download-card, .faq-list',
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
