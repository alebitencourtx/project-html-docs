// Smoke checks run in the page after capture; each viewport reloads from disk.
export async function checkInteractions() {
  const results = [];
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const click = selector => { const el = $(selector); assert(el, `Missing ${selector}`); el.click(); return el; };
  const input = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const run = async (name, fn) => {
    try { const skipped = await fn(); results.push({ name, ok: true, skipped: skipped === 'skip' }); }
    catch (e) { results.push({ name, ok: false, message: e.message }); }
  };
  const sections = all('.doc-section');
  await run('search', async () => {
    const search = $('#search'); assert(search, 'Search missing');
    const states = all('main details').map(el => [el, el.open]);
    try {
      const term = sections[0]?.querySelector('h2')?.textContent.trim().split(/\s+/)[0];
      assert(term, 'No searchable section');
      input(search, term);
      assert(!sections[0].hidden && sections[0].open, 'Hit did not open section');
      input(search, 'phd_no_result_9fca723e');
      assert(sections.every(s => s.hidden) && !$('#no-results').hidden, 'No-result state failed');
      input(search, '');
      assert(sections.every(s => !s.hidden) && states.every(([el, open]) => el.open === open), 'Search did not restore state');
    } finally { input(search, ''); }
  });
  await run('expand-collapse', async () => {
    click('#collapse'); assert(all('main details').every(d => !d.open), 'Collapse failed');
    click('#expand'); assert(all('main details').every(d => d.open), 'Expand failed');
  });
  await run('audience', async () => {
    try {
      click('[data-audience-filter="technical"]');
      assert(sections.every(s => s.classList.contains('is-audience-secondary') === !['all', 'technical'].includes(s.dataset.audience || 'all')), 'Audience filter state mismatch');
    } finally { click('[data-audience-filter="all"]'); }
  });
  await run('theme', async () => {
    const original = document.documentElement.dataset.theme;
    try {
      for (const theme of ['azul', 'vermelho']) { click(`[data-theme-select="${theme}"]`); assert(document.documentElement.dataset.theme === theme, 'Theme did not change'); }
    } finally { click(`[data-theme-select="${original}"]`); }
  });
  await run('diagram-modal', async () => {
    if (!$('[data-expand-diagram]')) return 'skip';
    const dialog = $('#diagram-dialog');
    try {
      click('[data-expand-diagram]'); assert(dialog.open, 'Modal did not open');
      click('#dialog-fit'); assert($('#dialog-fit').classList.contains('is-active'), 'Fit failed');
      const before = $('#dialog-zoom-label').textContent;
      click('#dialog-zoom-in'); assert($('#dialog-zoom-label').textContent !== before, 'Zoom failed');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      assert(!dialog.open, 'Escape did not close modal');
    } finally {
      if (dialog.open) dialog.close();
      // The app restores focus to the diagram trigger after 60 ms; let that finish
      // before subsequent scroll checks so it cannot move the page mid-check.
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });
  await run('table-filter', async () => {
    const filter = $('.table-filter input');
    if (!filter) return 'skip';
    const table = filter.closest('.table-filter')?.nextElementSibling?.querySelector('table');
    assert(table, 'Filter table missing');
    const rows = [...table.querySelectorAll('tbody tr')];
    try {
      input(filter, 'phd_no_result_9fca723e'); assert(rows.every(r => r.hidden), 'Table no-result failed');
      input(filter, ''); assert(rows.every(r => !r.hidden), 'Table restore failed');
    } finally { input(filter, ''); }
  });
  await run('back-to-top', async () => {
    click('#expand');
    if (document.documentElement.scrollHeight - innerHeight < 450) return 'skip';
    scrollTo({ top: 600, behavior: 'instant' }); await frame();
    assert(!$('#back-to-top').hidden, 'Back-to-top did not appear');
    click('#back-to-top');
    const deadline = performance.now() + 2000;
    while (scrollY >= 2 && performance.now() < deadline) await frame();
    assert(scrollY < 2, 'Back-to-top failed');
  });
  await run('mobile-drawer', async () => {
    if (innerWidth > 960) return 'skip';
    click('#nav-toggle'); await frame();
    assert($('#sidebar').classList.contains('is-open') && $('#nav-toggle').getAttribute('aria-expanded') === 'true', 'Drawer did not open');
    click('#nav-close'); assert(!$('#sidebar').classList.contains('is-open'), 'Drawer did not close');
    click('#mobile-search-btn'); await frame(); assert(document.activeElement === $('#search'), 'Mobile search focus failed');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(!$('#sidebar').classList.contains('is-open'), 'Drawer Escape failed');
  });
  return results;
}
