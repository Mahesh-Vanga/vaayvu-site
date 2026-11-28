'use strict';

let addressChoices = [];
let highlightedChoice = -1;

function localAddressChoices(input, openTabs, bookmarks, history, active) {
  const query = input.trim().toLowerCase();
  if (!query) return [];
  const matches = [],
    seen = new Set();
  for (const [source, entries] of [
    ['Switch to tab', openTabs],
    ['Bookmark', bookmarks],
    ['History', history],
  ]) {
    for (const item of entries) {
      if (item.private || item.deleted || (source === 'Switch to tab' && item.id === active)) continue;
      const url = webURL(item.url);
      if (!url || seen.has(url) || !(String(item.title || '') + ' ' + url).toLowerCase().includes(query))
        continue;
      seen.add(url);
      matches.push({
        url,
        title: item.title || hostOf(url),
        source,
        tab: source === 'Switch to tab' ? item.id : '',
      });
      if (matches.length === 6) return matches;
    }
  }
  return matches;
}
function hideAddressMatches() {
  addressChoices = [];
  highlightedChoice = -1;
  const list = $('#address-matches');
  if (!list.hidden) {
    list.hidden = true;
    rectUpdate();
  }
  $('#address').setAttribute('aria-expanded', 'false');
  $('#address').removeAttribute('aria-activedescendant');
}
function updateAddressMatches() {
  const input = $('#address');
  if (!settings.localSuggestions || current().private || windowInfo.private) {
    hideAddressMatches();
    return;
  }
  addressChoices = localAddressChoices(input.value, tabs, saved(), historyItems, activeId);
  highlightedChoice = -1;
  input.removeAttribute('aria-activedescendant');
  const list = $('#address-matches');
  list.innerHTML = addressChoices
    .map(
      (entry, i) =>
        '<button type="button" role="option" aria-selected="false" tabindex="-1" id="match-' +
        i +
        '" data-match="' +
        i +
        '">' +
        icon(entry.tab ? 'tabs' : entry.source === 'History' ? 'history' : 'bookmark') +
        '<span><strong>' +
        e(entry.title) +
        '</strong><small>' +
        e(entry.url) +
        '</small></span><small>' +
        e(entry.source) +
        '</small></button>',
    )
    .join('');
  list.hidden = !addressChoices.length;
  input.setAttribute('aria-expanded', String(!list.hidden));
  rectUpdate();
}
function chooseAddressMatch(i) {
  const choice = addressChoices[i];
  if (!choice) return;
  hideAddressMatches();
  $('#address').blur();
  if (choice.tab) selectTab(choice.tab);
  else navigate(choice.url);
}
function bindOmnibox() {
  const input = $('#address'),
    list = $('#address-matches');
  input.addEventListener('input', updateAddressMatches);
  input.addEventListener('blur', hideAddressMatches);
  list.addEventListener('pointerdown', (event) => event.preventDefault());
  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-match]');
    if (button) chooseAddressMatch(Number(button.dataset.match));
  });
  input.addEventListener('keydown', (event) => {
    if (list.hidden || event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      hideAddressMatches();
      return;
    }
    if (event.key === 'Enter' && highlightedChoice >= 0) {
      event.preventDefault();
      chooseAddressMatch(highlightedChoice);
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    if (highlightedChoice < 0)
      highlightedChoice = event.key === 'ArrowDown' ? 0 : addressChoices.length - 1;
    else
      highlightedChoice =
        (highlightedChoice + (event.key === 'ArrowDown' ? 1 : -1) + addressChoices.length) %
        addressChoices.length;
    [...list.children].forEach((row, index) =>
      row.setAttribute('aria-selected', String(index === highlightedChoice)),
    );
    input.setAttribute('aria-activedescendant', 'match-' + highlightedChoice);
    list.children[highlightedChoice]?.scrollIntoView({ block: 'nearest' });
  });
}
