// Locathara — locathara.com
// Scroll-reveal, hero canvas, stat counters, mobile nav, toast notifications.

(() => {
  'use strict';

  // ============================================================
  // Utility: reduced motion
  // ============================================================
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================================
  // Hero canvas animation (subtle gradient orbs)
  // ============================================================
  const heroCanvas = document.querySelector('[data-hero-canvas]');
  if (heroCanvas && !prefersReduced) {
    const ctx = heroCanvas.getContext('2d');
    let width = 0, height = 0, raf = 0;
    const orbs = [];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = heroCanvas.clientWidth;
      height = heroCanvas.clientHeight;
      heroCanvas.width = width * dpr;
      heroCanvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }

    function initOrbs() {
      orbs.length = 0;
      for (let i = 0; i < 5; i++) {
        orbs.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 120 + Math.random() * 200,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          color: ['rgba(14, 165, 233, 0.15)', 'rgba(99, 102, 241, 0.12)', 'rgba(168, 85, 247, 0.1)'][i % 3]
        });
      }
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);
      for (const o of orbs) {
        o.x += o.vx;
        o.y += o.vy;
        if (o.x < -o.r) o.x = width + o.r;
        if (o.x > width + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = height + o.r;
        if (o.y > height + o.r) o.y = -o.r;
        const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        grad.addColorStop(0, o.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(animate);
    }

    const ro = new ResizeObserver(() => { resize(); initOrbs(); });
    ro.observe(heroCanvas);
    animate();
  }

  // ============================================================
  // Scroll progress bar
  // ============================================================
  const progressBar = document.querySelector('[data-progress]');
  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? scrollTop / docHeight : 0;
    progressBar.style.transform = `scaleX(${progress})`;
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  // ============================================================
  // Masthead scroll state
  // ============================================================
  const masthead = document.querySelector('.masthead');
  function updateMasthead() {
    masthead.classList.toggle('is-scrolled', window.scrollY > 16);
  }
  window.addEventListener('scroll', updateMasthead, { passive: true });
  updateMasthead();

  // ============================================================
  // Mobile navigation toggle
  // ============================================================
  const menuToggle = document.querySelector('.menu-toggle');
  const primaryNav = document.querySelector('#primary-nav');
  if (menuToggle && primaryNav) {
    menuToggle.addEventListener('click', () => {
      const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!expanded));
      primaryNav.classList.toggle('is-open');
      document.body.style.overflow = expanded ? '' : 'hidden';
    });

    // Close on link click
    primaryNav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        menuToggle.setAttribute('aria-expanded', 'false');
        primaryNav.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  // ============================================================
  // IntersectionObserver for reveal animations
  // ============================================================
  if (!prefersReduced) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

    document.querySelectorAll('.reveal, [data-reveal]').forEach(el => observer.observe(el));
  } else {
    document.querySelectorAll('.reveal, [data-reveal]').forEach(el => el.classList.add('is-in'));
  }

  // ============================================================
  // Stat counter animation
  // ============================================================
  const statValues = document.querySelectorAll('[data-count]');
  if (statValues.length && !prefersReduced) {
    const statObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.target, 10);
          const duration = 2000;
          const start = performance.now();

          function tick(now) {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.floor(eased * target).toLocaleString();
            if (p < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          statObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    statValues.forEach(el => statObserver.observe(el));
  } else {
    statValues.forEach(el => el.textContent = parseInt(el.dataset.target, 10).toLocaleString());
  }

  // ============================================================
  // Toast notification utility
  // ============================================================
  const toastEl = document.querySelector('[data-toast]');
  window.showToast = (message, duration = 3000) => {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('is-on'), duration);
  };

  // ============================================================
  // Newsletter form handling
  // ============================================================
  const form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const email = form.querySelector('input[type="email"]').value.trim();
      if (!email) return;

      btn.disabled = true;
      btn.textContent = 'Subscribing...';

      try {
        // Replace with your actual endpoint (Buttondown, ConvertKit, etc.)
        const resp = await fetch('https://api.buttondown.email/v1/subscribers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, tags: ['locathara-website'] })
        });

        if (resp.ok || resp.status === 400) { // 400 often means already subscribed
          showToast('Thanks for subscribing!');
          form.reset();
        } else {
          showToast('Something went wrong. Try again or email us directly.');
        }
      } catch {
        showToast('Network error. Please try again later.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Subscribe';
      }
    });
  }

  // ============================================================
  // Smooth scroll for anchor links
  // ============================================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const offset = masthead.offsetHeight + 16;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ============================================================
  // Section rail active state (desktop)
  // ============================================================
  const railLinks = document.querySelectorAll('.section-rail a');
  if (railLinks.length) {
    const sections = Array.from(railLinks).map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          railLinks.forEach(link => {
            link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
          });
        }
      });
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    sections.forEach(s => sectionObserver.observe(s));
  }
})();