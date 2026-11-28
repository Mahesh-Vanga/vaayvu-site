// Locathara — Shared Site JS
// Navigation, scroll-reveal, mobile menu, toast

(() => {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Masthead scroll state ----
  const masthead = document.querySelector('.masthead');
  function updateMasthead() { masthead?.classList.toggle('is-scrolled', window.scrollY > 16); }
  window.addEventListener('scroll', updateMasthead, { passive: true });
  updateMasthead();

  // ---- Mobile navigation ----
  const menuToggle = document.querySelector('.menu-toggle');
  const primaryNav = document.querySelector('#primary-nav');
  if (menuToggle && primaryNav) {
    menuToggle.addEventListener('click', () => {
      const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!expanded));
      primaryNav.classList.toggle('is-open');
      document.body.style.overflow = expanded ? '' : 'hidden';
    });
    primaryNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      primaryNav.classList.remove('is-open');
      document.body.style.overflow = '';
    }));
  }

  // ---- IntersectionObserver for reveals ----
  if (!prefersReduced) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-in'); observer.unobserve(entry.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    document.querySelectorAll('.reveal, [data-reveal]').forEach(el => observer.observe(el));
  } else {
    document.querySelectorAll('.reveal, [data-reveal]').forEach(el => el.classList.add('is-in'));
  }

  // ---- Toast utility ----
  const toastEl = document.querySelector('[data-toast]');
  window.showToast = (message, duration = 3000) => {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('is-on'), duration);
  };

  // ---- Smooth scroll for anchor links ----
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const offset = (masthead?.offsetHeight || 72) + 16;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ---- Active nav highlighting ----
  const navLinks = document.querySelectorAll('.nav a[href^="#"]');
  if (navLinks.length) {
    const sections = Array.from(navLinks).map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(link => link.setAttribute('aria-current', link.getAttribute('href') === `#${id}` ? 'page' : 'false'));
        }
      });
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
    sections.forEach(s => sectionObserver.observe(s));
  }

  // ---- Hero canvas animation (optional) ----
  const heroCanvas = document.querySelector('[data-hero-canvas]');
  if (heroCanvas && !prefersReduced) {
    const ctx = heroCanvas.getContext('2d');
    let width = 0, height = 0, raf = 0;
    const orbs = [];
    function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2); width = heroCanvas.clientWidth; height = heroCanvas.clientHeight; heroCanvas.width = width * dpr; heroCanvas.height = height * dpr; ctx.scale(dpr, dpr); }
    function initOrbs() { orbs.length = 0; for (let i = 0; i < 5; i++) { orbs.push({ x: Math.random() * width, y: Math.random() * height, r: 120 + Math.random() * 200, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, color: ['rgba(14,165,233,0.15)','rgba(99,102,241,0.12)','rgba(168,85,247,0.1)'][i % 3] }); } }
    function animate() { ctx.clearRect(0, 0, width, height); for (const o of orbs) { o.x += o.vx; o.y += o.vy; if (o.x < -o.r) o.x = width + o.r; if (o.x > width + o.r) o.x = -o.r; if (o.y < -o.r) o.y = height + o.r; if (o.y > height + o.r) o.y = -o.r; const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r); grad.addColorStop(0, o.color); grad.addColorStop(1, 'transparent'); ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill(); } raf = requestAnimationFrame(animate); }
    const ro = new ResizeObserver(() => { resize(); initOrbs(); }); ro.observe(heroCanvas); animate();
  }

  // ---- Form handling (newsletter/contact) ----
  const forms = document.querySelectorAll('form[data-form]');
  forms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn?.textContent;
      const email = form.querySelector('input[type="email"]')?.value?.trim();
      if (!email && form.id !== 'contact-form') return;
      btn?.setAttribute('disabled', ''); if (btn) btn.textContent = 'Sending...';
      try {
        const endpoint = form.action || 'https://api.buttondown.email/v1/subscribers';
        const body = new FormData(form);
        const resp = await fetch(endpoint, { method: 'POST', body });
        if (resp.ok || resp.status === 400) { showToast(form.id === 'contact-form' ? 'Message sent!' : 'Thanks for subscribing!'); form.reset(); }
        else { showToast('Something went wrong. Try again or email us directly.'); }
      } catch { showToast('Network error. Please try again later.'); } finally { btn?.removeAttribute('disabled'); if (btn) btn.textContent = originalText; }
    });
  });

  // ---- Copy code blocks ----
  document.querySelectorAll('pre code').forEach(block => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.style.cssText = 'position:absolute;top:8px;right:8px;padding:4px 10px;font-size:11px;border:1px solid var(--space-border);border-radius:6px;background:var(--space-elevated);color:var(--text-muted);cursor:pointer;opacity:0;transition:opacity .2s';
    block.style.position = 'relative';
    block.appendChild(btn);
    block.addEventListener('mouseenter', () => btn.style.opacity = '1');
    block.addEventListener('mouseleave', () => btn.style.opacity = '0');
    btn.addEventListener('click', async () => { try { await navigator.clipboard.writeText(block.innerText); btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 1500); } catch {} });
  });
})();