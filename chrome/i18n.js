'use strict';
/**
 * Vaayvu i18n primitives: locale direction, script-aware fonts and formatting.
 * This is layout/formatting infrastructure, not a translated string catalog.
 */
const VaayvuI18n = (() => {
  const RTL = new Set(['ar', 'arc', 'ckb', 'fa', 'he', 'ks', 'ku', 'ps', 'sd', 'ug', 'ur', 'yi']);
  const CJK = new Set(['ja', 'ko', 'zh']);
  const SUPPORTED = new Set(['en', 'hi', 'ar', 'he', 'fa', 'ur', 'ja', 'zh', 'ko', 'fr', 'de', 'es', 'pt', 'ru']);

  const normalize = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace('_', '-');
    if (!raw || raw === 'system') return '';
    const base = raw.split('-')[0];
    return SUPPORTED.has(raw) ? raw : SUPPORTED.has(base) ? base : base;
  };

  const tag = (locale) => {
    const value = normalize(locale) || 'en';
    try {
      return Intl.getCanonicalLocales(value)[0] || value;
    } catch {
      return 'en';
    }
  };
  const base = (locale) => tag(locale).split('-')[0];
  const direction = (locale) => (RTL.has(base(locale)) ? 'rtl' : 'ltr');
  const script = (locale) => (CJK.has(base(locale)) ? 'cjk' : RTL.has(base(locale)) ? 'rtl' : 'latin');

  const fontStack = (locale) => {
    if (CJK.has(base(locale))) {
      return '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Noto Sans CJK JP", "PingFang SC", "Microsoft YaHei", "Malgun Gothic", system-ui, sans-serif';
    }
    if (RTL.has(base(locale))) {
      return '-apple-system, BlinkMacSystemFont, "SF Arabic", "Noto Naskh Arabic", "Geeza Pro", "Segoe UI", Tahoma, system-ui, sans-serif';
    }
    return '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';
  };

  function formatNumber(value, locale, options = {}) {
    try {
      return new Intl.NumberFormat(tag(locale), options).format(value);
    } catch {
      return String(value);
    }
  }

  function formatDate(value, locale, options = { dateStyle: 'medium' }) {
    try {
      return new Intl.DateTimeFormat(tag(locale), options).format(value instanceof Date ? value : new Date(value));
    } catch {
      return String(value);
    }
  }

  function apply(root, locale) {
    if (!root || !root.documentElement) return null;
    const normalized = normalize(locale) || (typeof navigator !== 'undefined' ? normalize(navigator.language) : '') || 'en';
    const element = root.documentElement;
    element.lang = tag(normalized);
    element.dir = direction(normalized);
    element.dataset.script = script(normalized);
    element.style.setProperty('--ui-font', fontStack(normalized));
    return { locale: tag(normalized), dir: element.dir, script: element.dataset.script };
  }

  return { RTL, CJK, SUPPORTED, normalize, tag, base, direction, script, fontStack, formatNumber, formatDate, apply };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = VaayvuI18n;
