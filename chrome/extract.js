(() => {
  if (!document.body || document.body.isContentEditable || document.designMode === 'on') return '';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
      if (node.matches('script, style, noscript, template, input, textarea, select, [contenteditable], [role="textbox"], [hidden], [inert], [aria-hidden="true"]')) {
        return NodeFilter.FILTER_REJECT;
      }
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_SKIP;
    }
  });
  let text = '';
  for (let node = walker.nextNode(); node && text.length < 18000; node = walker.nextNode()) {
    const words = node.textContent.trim();
    if (words) text += words.slice(0, 18000 - text.length) + ' ';
  }
  return text.trim().slice(0, 18000);
})()
