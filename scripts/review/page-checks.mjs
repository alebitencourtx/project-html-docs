// These functions are serialized into the page; keep them self-contained.
export function pageChecks() {
  const issues = [], seen = new Set();
  const visible = el => el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true });
  const add = (type, el, message) => {
    const section = el?.closest('.doc-section')?.id || 'hero';
    const key = `${type}|${section}|${message}`;
    if (!seen.has(key)) issues.push({ type, severity: 'error', section, message });
    seen.add(key);
  };
  const outside = (a, b, tolerance = 2) => a.left < b.left - tolerance || a.right > b.right + tolerance || a.top < b.top - tolerance || a.bottom > b.bottom + tolerance;
  const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  if (document.documentElement.scrollWidth > innerWidth + 1) add('page-overflow', null, `Page width ${document.documentElement.scrollWidth} exceeds viewport ${innerWidth}`);
  for (const grid of document.querySelectorAll('.hero-cards, .cards')) {
    const cards = [...grid.children].filter(visible);
    const rows = new Map();
    for (const card of cards) {
      const y = Math.round(card.getBoundingClientRect().top);
      rows.set(y, (rows.get(y) || 0) + 1);
    }
    const counts = [...rows.values()];
    if (counts.length > 1 && counts.at(-1) === 1 && counts[0] > 1) add('grid-orphan', grid, `Grid rows: ${counts.join('+')}`);
  }
  const walker = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, el = node.parentElement;
    if (!node.textContent.trim() || !el || el.closest('svg, script, style, pre, .table-wrap, .diagram-scroll') || !visible(el)) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter(r => r.width && r.height);
    let escaped = false;
    for (let ancestor = el; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      // Ellipsis is an intentional compact label, not accidental content clipping.
      if (style.textOverflow === 'ellipsis') break;
      const boundary = ancestor.matches('.metric, .card, .section-heading, .section-body') || /hidden|clip/.test(style.overflowX + style.overflowY);
      if (boundary && rects.some(r => outside(r, ancestor.getBoundingClientRect()))) { escaped = true; break; }
      if (/auto|scroll/.test(style.overflowX + style.overflowY)) break;
    }
    const card = el.closest('.metric, .card');
    if (card && [...card.parentElement.children].some(sibling => sibling !== card && rects.some(r => overlap(r, sibling.getBoundingClientRect())))) escaped = true;
    if (escaped) add('text-escape', el, node.textContent.trim().slice(0, 100));
  }
  for (const svg of document.querySelectorAll('main figure svg')) {
    if (!visible(svg)) continue;
    const texts = [...svg.querySelectorAll('text')].filter(visible);
    const boxes = texts.map(el => ({ el, rect: el.getBoundingClientRect() }));
    for (const { el, rect } of boxes) {
      const label = el.textContent.trim().slice(0, 100);
      if (!label) continue;
      if (label.includes('`')) add('literal-backtick', el, label);
      if (outside(rect, svg.getBoundingClientRect())) add('svg-text-escape', el, label);
      const group = el.closest('.sol-node');
      const frame = group?.querySelector('.sol-node-frame');
      if (frame && outside(rect, frame.getBoundingClientRect())) add('svg-text-escape', el, label);
      // A preceding chip rectangle belongs to this text only if its baseline is inside it.
      const chip = el.previousElementSibling;
      if (chip?.tagName.toLowerCase() === 'rect') {
        const b = chip.getBoundingClientRect();
        if (rect.left >= b.left - 1 && rect.left < b.right && rect.top >= b.top - 2 && rect.top < b.bottom && outside(rect, b)) add('svg-text-escape', el, label);
      }
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      if (overlap(boxes[i].rect, boxes[j].rect)) add('svg-text-overlap', boxes[i].el, `${boxes[i].el.textContent.trim()} / ${boxes[j].el.textContent.trim()}`.slice(0, 160));
    }
  }
  for (const el of document.querySelectorAll('.diagram figcaption, .diagram-note, .figure-tag')) {
    if (el.textContent.includes('`')) add('literal-backtick', el, el.textContent.trim().slice(0, 100));
  }
  return issues;
}

export function tileGeometry() {
  const geometry = el => {
    const r = el.getBoundingClientRect();
    return { top: Math.max(0, Math.floor(r.top + scrollY)), height: Math.ceil(r.height) };
  };
  const hero = geometry(document.querySelector('.hero') || document.querySelector('header') || document.body);
  const cards = document.querySelector('.hero-cards');
  if (cards) { const c = geometry(cards); hero.height = Math.max(hero.height, c.top + c.height - hero.top); }
  return {
    height: document.documentElement.scrollHeight,
    hero,
    sections: [...document.querySelectorAll('.doc-section')].filter(e => !e.hidden).map(el => ({ id: el.id, ...geometry(el) })),
    figures: [...document.querySelectorAll('main figure')].filter(e => e.checkVisibility()).map((el, index) => ({ index: index + 1, section: el.closest('.doc-section')?.id || 'hero', ...geometry(el) })),
  };
}
