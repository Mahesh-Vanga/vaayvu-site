((action) => {
  'use strict';
  if (!['pick', 'undo', 'dark', 'light'].includes(action) || !document.body) return 'unavailable';
  const stateKey = Symbol.for('dev.vaayvu.page-display');
  const state = window[stateKey] || (window[stateKey] = { hidden: [], stop: null, dark: null });
  const restore = ({ element, key, value, priority }) => {
    if (value) element.style.setProperty(key, value, priority);
    else element.style.removeProperty(key);
  };
  const change = (element, key, next) => {
    const previous = {
      element,
      key,
      value: element.style.getPropertyValue(key),
      priority: element.style.getPropertyPriority(key),
    };
    element.style.setProperty(key, next, 'important');
    return previous;
  };
  if (state.stop) state.stop();
  if (action === 'undo') {
    state.hidden.splice(0).forEach(restore);
    return 'restored';
  }
  if (action === 'light' || action === 'dark') {
    if (state.dark) {
      state.dark.forEach(restore);
      state.dark = null;
    }
    const root = document.documentElement;
    const dark = action === 'dark';
    root.style.removeProperty('filter');
    state.dark = [change(root, 'color-scheme', dark ? 'dark' : 'light')];
    return 'dark';
  }
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel hiding';
  for (const [key, value] of Object.entries({
    position: 'fixed',
    top: '12px',
    right: '12px',
    'z-index': '2147483647',
    padding: '12px 18px',
    background: '#26273b',
    color: 'white',
    border: '1px solid #999',
    'border-radius': '12px',
    font: '16px system-ui',
  }))
    cancel.style.setProperty(key, value, 'important');
  const stop = () => {
    clearTimeout(timeout);
    document.removeEventListener('click', pick, true);
    document.removeEventListener('keydown', escape, true);
    cancel.remove();
    state.stop = null;
  };
  const escape = (event) => {
    if (event.key === 'Escape') stop();
  };
  const pick = (event) => {
    if (!event.isTrusted) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const target = event.target;
    stop();
    if (
      !(target instanceof Element) ||
      target === cancel ||
      target === document.body ||
      target === document.documentElement ||
      target.closest('input,textarea,select,[contenteditable="true"]')
    )
      return;
    if (state.hidden.length >= 50) restore(state.hidden.shift());
    state.hidden.push(change(target, 'display', 'none'));
  };
  const timeout = setTimeout(stop, 30000);
  state.stop = stop;
  document.body.append(cancel);
  document.addEventListener('click', pick, true);
  document.addEventListener('keydown', escape, true);
  return 'picking';
})
