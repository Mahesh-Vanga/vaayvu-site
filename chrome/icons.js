// All interface icons use a single stroke width and a 24-point grid.
const paths = {
  target: '<path d="M10 3H3v7m11-7h3m4 4v3M3 14v3m4 4h3M9 9l4 12 2.5-5.5L21 13z"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3"/>',
  audio: '<path d="M3 9h4l5-5v16l-5-5H3zM16 8c3 2 3 6 0 8m3-11c5 3 5 11 0 14"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2"/>',
  folder: '<path d="M3 7V5h6l3 3h9v11H3z"/>',
  pin: '<path d="m9 3 10 10-2 2-3-1-4 4-1-4-5-1 5-4-1-4zM9 15l-5 6"/>',
  shield: '<path d="M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  'shield-off': '<path d="M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/><path d="M20 4L4 20"/><circle cx="12" cy="12" r="1"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  camera:
    '<rect x="2" y="6" width="20" height="14" rx="3"/><path d="m7 6 2-3h6l2 3"/><circle cx="12" cy="13" r="3"/>',
  print: '<path d="M7 9V3h10v6M7 16H3V9h18v7h-4"/><path d="M7 14h10v7H7z"/>',
  expand: '<path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6"/>',
  minus: '<path d="M4 12h16"/>',
  link: '<path d="m8 16-2 2a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0m2 6a3 3 0 0 0 4 0l5-5a3 3 0 0 0-4-4l-2 2m-8 8 8-8"/>',
  qr: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h4v4h-7z"/>',
  home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
  bookmark: '<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4z"/>',
  history: '<path d="M3.3 10a9 9 0 1 1 .8 6M3 4v6h6m3-3v5l3 2"/>',
  devices:
    '<rect x="2" y="4" width="14" height="12" rx="2"/><path d="M6 20h7m-4-4v4"/><rect x="15" y="9" width="7" height="12" rx="1.5"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  forward: '<path d="m10 5 7 7-7 7"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  reload: '<path d="M20.5 10a8.5 8.5 0 1 0-.5 6M21 4v6h-6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  spark: '<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2zM19 2v4m-2-2h4"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  settings:
    '<path d="m9.4 3-.7 2.5-2 .9-2.4-.8-2 3.4 1.7 1.7v2.6L2.3 15l2 3.4 2.4-.8 2 .9.7 2.5h5.2l.7-2.5 2-.9 2.4.8 2-3.4-1.7-1.7v-2.6L21.7 9l-2-3.4-2.4.8-2-.9-.7-2.5z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  private: '<path d="m3 10 2 7c2 3 6 2 7-2 1 4 5 5 7 2l2-7c-3 0-5 2-9 2s-6-2-9-2z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  edit: '<path d="m4 16 10-10 4 4L8 20l-5 1zM14 6l2-2a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3l-2 2"/>',
  sliders:
    '<path d="M3 7h4m4 0h10M3 17h10m4 0h4"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zm-9 10 9 4.5 9-4.5M3 17l9 4.5 9-4.5"/>',
  mountain: '<path d="m2 19 7-12 4 6 3-5 6 11H2z"/>',
  tabs: '<rect x="3" y="7" width="14" height="14" rx="3"/><path d="M7 3h10a4 4 0 0 1 4 4v10"/>',
  split: '<rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="16" rx="2"/><path d="M12 4v16"/>',
  share: '<path d="M12 15V3m-4 4 4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  book: '<path d="M3 5c4-1.5 6-1 9 1 3-2 5-2.5 9-1v14c-3-1.5-6-1-9 1-3-2-6-2.5-9-1zM12 6v14"/>',
  sync: '<path d="M20 8a8 8 0 0 0-14-2L3 9m0-5v5h5m-4 7a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
};
function icon(name) {
  if (name === 'vaayvu') return '<img class="tab-brand" src="assets/vaayvu.svg" alt="">';
  return (
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
    (paths[name] || paths.globe) +
    '</svg>'
  );
}
