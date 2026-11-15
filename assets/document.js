(() => {
  const lang = document.documentElement.lang.startsWith('pt');
  const words = lang
    ? {
        copy: 'Copiar', copied: 'Copiado', failed: 'Selecione e copie o código',
        found: 'seção encontrada', foundPlural: 'seções encontradas',
        filterPlaceholder: 'Filtrar linhas desta tabela…', rows: 'linhas', row: 'linha'
      }
    : {
        copy: 'Copy', copied: 'Copied', failed: 'Select and copy the code',
        found: 'section found', foundPlural: 'sections found',
        filterPlaceholder: 'Filter table rows…', rows: 'rows', row: 'row'
      };

  const sections = [...document.querySelectorAll('.doc-section')];
  const search = document.querySelector('#search');
  const searchClear = document.querySelector('#search-clear');
  const normalize = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const index = new Map(sections.map(s => [s, normalize(s.textContent)]));
  const openAncestors = el => { for (let n = el; n; n = n.parentElement) if (n.tagName === 'DETAILS') n.open = true; };

  // A busca abre seções para revelar o resultado e destaca os termos encontrados.
  // Guardamos o estado anterior e restauramos quando o campo é limpo.
  const savedOpen = new Map();
  let searchActive = false;
  const saveOpenState = () => {
    savedOpen.clear();
    document.querySelectorAll('main details').forEach(d => savedOpen.set(d, d.open));
  };
  const restoreOpenState = () => {
    for (const [d, open] of savedOpen) d.open = open;
    savedOpen.clear();
  };

  function clearMarks(root) {
    root.querySelectorAll('mark.search-hit').forEach(m => {
      const parent = m.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
  }

  function highlightTerms(root, terms) {
    clearMarks(root);
    if (!terms.length) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p || p.closest('svg, pre, code, script, style, .table-filter, .figure-tools, .audience, .number')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const toProcess = [];
    let cur;
    while ((cur = walker.nextNode())) toProcess.push(cur);

    for (const textNode of toProcess) {
      const orig = textNode.nodeValue;
      const norm = normalize(orig);
      // Skip nodes whose length changes under NFD folding to avoid index drift
      if (norm.length !== orig.length) continue;
      let matchIdx = -1;
      let matchLen = 0;
      for (const term of terms) {
        const i = norm.indexOf(term);
        if (i !== -1 && (matchIdx === -1 || i < matchIdx)) {
          matchIdx = i;
          matchLen = term.length;
        }
      }
      if (matchIdx === -1 || matchLen === 0) continue;
      const frag = document.createDocumentFragment();
      if (matchIdx > 0) frag.append(document.createTextNode(orig.slice(0, matchIdx)));
      const mark = document.createElement('mark');
      mark.className = 'search-hit';
      mark.textContent = orig.slice(matchIdx, matchIdx + matchLen);
      frag.append(mark);
      if (matchIdx + matchLen < orig.length) frag.append(document.createTextNode(orig.slice(matchIdx + matchLen)));
      textNode.parentNode.replaceChild(frag, textNode);
    }
  }

  function filter() {
    const raw = search.value;
    if (searchClear) searchClear.hidden = !raw.length;
    const terms = normalize(raw).trim().split(/\s+/).filter(Boolean);
    if (terms.length && !searchActive) { saveOpenState(); searchActive = true; }

    let found = 0;
    for (const s of sections) {
      s.hidden = !terms.every(t => index.get(s).includes(t));
      if (!s.hidden) {
        found++;
        if (terms.length) {
          s.open = true;
          s.querySelectorAll('details').forEach(d => d.open = true);
          highlightTerms(s.querySelector('.section-body') || s, terms);
        } else {
          clearMarks(s);
        }
      } else {
        clearMarks(s);
      }
      const a = document.querySelector(`nav a[href="#${s.id}"]`);
      if (a) a.hidden = s.hidden;
      const subNav = document.querySelector(`nav .nav-sub[data-parent="${s.id}"]`);
      if (subNav) subNav.hidden = s.hidden;
    }

    if (!terms.length && searchActive) { restoreOpenState(); searchActive = false; }

    document.querySelector('#search-count').textContent = terms.length
      ? `${found} ${found === 1 ? words.found : words.foundPlural}`
      : '';
    document.querySelector('#no-results').hidden = found > 0;
  }

  search.addEventListener('input', filter);
  searchClear?.addEventListener('click', () => {
    search.value = '';
    filter();
    search.focus();
  });

  // Atalho '/' ou Ctrl/Cmd+K para focar a pesquisa rapidamente
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    const editable = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
    if ((e.key === '/' && !editable) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      search.focus();
      search.select();
    } else if (e.key === 'Escape' && document.activeElement === search && search.value) {
      e.preventDefault();
      search.value = '';
      filter();
    }
  });

  document.querySelector('#expand').addEventListener('click', () => {
    searchActive = false;
    savedOpen.clear();
    document.querySelectorAll('main details').forEach(d => d.open = true);
  });
  document.querySelector('#collapse').addEventListener('click', () => {
    searchActive = false;
    savedOpen.clear();
    document.querySelectorAll('main details').forEach(d => d.open = false);
  });

  // Filtro de perfil de leitura (preserva todas as seções no DOM; foca e expande as relevantes)
  const filterBtns = [...document.querySelectorAll('[data-audience-filter]')];
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.audienceFilter;
      filterBtns.forEach(b => b.classList.toggle('is-active', b === btn));
      sections.forEach(s => {
        const aud = s.dataset.audience || 'all';
        const navLink = document.querySelector(`nav a[href="#${s.id}"]`);
        const subNav = document.querySelector(`nav .nav-sub[data-parent="${s.id}"]`);
        if (target === 'all') {
          s.classList.remove('is-audience-secondary');
          navLink?.classList.remove('is-audience-secondary');
          subNav?.classList.remove('is-audience-secondary');
          s.open = s.id !== 'document-references';
        } else {
          const primary = aud === 'all' || aud === target;
          s.classList.toggle('is-audience-secondary', !primary);
          navLink?.classList.toggle('is-audience-secondary', !primary);
          subNav?.classList.toggle('is-audience-secondary', !primary);
          if (!searchActive) s.open = primary;
        }
      });
    });
  });

  // Seletor de paleta de cores (Atual vs Santander) sem alterar layout
  const themeBtns = [...document.querySelectorAll('[data-theme-select]')];
  if (themeBtns.length) {
    const applyTheme = (theme, persist = false) => {
      const target = theme === 'santander' ? 'santander' : 'default';
      if (target === 'santander') document.documentElement.setAttribute('data-theme', 'santander');
      else document.documentElement.removeAttribute('data-theme');
      themeBtns.forEach(b => {
        const active = b.dataset.themeSelect === target;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      if (persist) {
        try { localStorage.setItem('project-docs-theme', target); } catch {}
      }
    };
    let initialTheme = document.documentElement.getAttribute('data-theme') === 'santander' ? 'santander' : 'default';
    try {
      const saved = localStorage.getItem('project-docs-theme');
      if (saved === 'santander' || saved === 'default') initialTheme = saved;
    } catch {}
    applyTheme(initialTheme, false);
    themeBtns.forEach(btn => btn.addEventListener('click', () => applyTheme(btn.dataset.themeSelect, true)));
  }

  // Filtro local automático para dicionários e tabelas extensas (>= 8 linhas), inclusive dentro de <details>
  document.querySelectorAll('.section-body .table-wrap').forEach(wrap => {
    if (wrap.closest('.chart')) return;
    const tbody = wrap.querySelector('tbody');
    if (!tbody) return;
    const rows = [...tbody.querySelectorAll('tr')];
    if (rows.length < 8) return;
    const bar = document.createElement('div');
    bar.className = 'table-filter';
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = words.filterPlaceholder;
    input.setAttribute('aria-label', words.filterPlaceholder);
    const count = document.createElement('span');
    count.className = 'table-filter-count';
    count.textContent = `${rows.length} ${words.rows}`;
    bar.append(input, count);
    wrap.before(bar);

    const rowIndex = new Map(rows.map(r => [r, normalize(r.textContent)]));
    input.addEventListener('input', () => {
      const terms = normalize(input.value).trim().split(/\s+/).filter(Boolean);
      let visible = 0;
      rows.forEach(r => {
        const ok = terms.every(t => rowIndex.get(r).includes(t));
        r.hidden = !ok;
        if (ok) visible++;
      });
      count.textContent = `${visible} ${visible === 1 ? words.row : words.rows}`;
    });
  });

  const printState = new Map();
  function beforePrint() {
    document.querySelectorAll('main details').forEach(d => { printState.set(d, d.open); d.open = true; });
  }
  function afterPrint() {
    for (const [d, v] of printState) d.open = v;
    printState.clear();
  }
  window.addEventListener('beforeprint', beforePrint);
  window.addEventListener('afterprint', afterPrint);
  document.querySelector('#print').addEventListener('click', () => window.print());

  function revealHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    if (el) { search.value = ''; filter(); openAncestors(el); el.scrollIntoView(); }
  }
  window.addEventListener('hashchange', revealHash);
  if (location.hash) requestAnimationFrame(revealHash);
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', () => {
    if (a.closest('svg')) return;
    const rawHref = a.getAttribute('href') || '';
    const targetId = decodeURIComponent(rawHref.slice(1));
    const el = targetId ? document.getElementById(targetId) : null;
    if (el) { search.value = ''; filter(); openAncestors(el); }
  }));

  // Copia com clipboard; se o navegador negar, tenta execCommand e por fim
  // seleciona o código para cópia manual.
  document.querySelectorAll('pre').forEach(pre => {
    const button = document.createElement('button');
    button.className = 'copy';
    button.textContent = words.copy;
    button.type = 'button';
    let copyTimer;
    button.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      const text = code ? code.textContent : '';
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); copied = true; }
      } catch {}
      if (!copied) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { copied = document.execCommand('copy'); } catch {}
        ta.remove();
      }
      if (copied) {
        button.textContent = words.copied;
      } else if (code) {
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        button.textContent = words.failed;
      }
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => button.textContent = words.copy, 2500);
    });
    pre.append(button);
  });

  // Realce sutil de conexões ao passar o mouse ou focar nós em diagramas determinísticos (inclusive no modal)
  function bindDiagramInteractivity(root) {
    root.querySelectorAll('.sol-svg').forEach(svg => {
      const nodes = [...svg.querySelectorAll('.sol-node')];
      const edges = [...svg.querySelectorAll('.sol-edge')];
      const labels = [...svg.querySelectorAll('.sol-edge-label-wrap')];
      const clearFocus = () => {
        svg.classList.remove('has-focus');
        [...nodes, ...edges, ...labels].forEach(el => {
          el.classList.remove('is-dimmed', 'is-highlighted');
        });
      };
      const focusNode = nodeId => {
        const connected = new Set([nodeId]);
        svg.classList.add('has-focus');
        edges.forEach(e => {
          const match = e.dataset.from === nodeId || e.dataset.to === nodeId;
          e.classList.toggle('is-highlighted', match);
          e.classList.toggle('is-dimmed', !match);
          if (match) { connected.add(e.dataset.from); connected.add(e.dataset.to); }
        });
        labels.forEach(l => {
          const match = l.dataset.from === nodeId || l.dataset.to === nodeId;
          l.classList.toggle('is-highlighted', match);
          l.classList.toggle('is-dimmed', !match);
        });
        nodes.forEach(n => {
          const hit = connected.has(n.dataset.nodeId);
          n.classList.toggle('is-highlighted', n.dataset.nodeId === nodeId);
          n.classList.toggle('is-dimmed', !hit);
        });
      };
      nodes.forEach(node => {
        node.addEventListener('mouseenter', () => focusNode(node.dataset.nodeId));
        node.addEventListener('focus', () => focusNode(node.dataset.nodeId));
        node.addEventListener('mouseleave', clearFocus);
        node.addEventListener('blur', clearFocus);
      });
    });
  }
  bindDiagramInteractivity(document);

  // O SVG ampliado precisa de IDs próprios para não colidir com o original.
  function reprefixSvg(svg, prefix) {
    const map = new Map();
    svg.querySelectorAll('[id]').forEach(el => {
      const oldId = el.id;
      const newId = prefix + oldId;
      map.set(oldId, newId);
      el.id = newId;
    });
    if (!map.size) return;
    svg.querySelectorAll('*').forEach(el => {
      for (const attr of [...el.attributes]) {
        let value = attr.value;
        for (const [oldId, newId] of map) {
          value = value.replaceAll(`url(#${oldId})`, `url(#${newId})`);
          if (value === `#${oldId}`) value = `#${newId}`;
        }
        if (value !== attr.value) el.setAttribute(attr.name, value);
      }
    });
  }

  const dialog = document.querySelector('#diagram-dialog');
  const dialogCanvas = document.querySelector('#dialog-canvas');
  const btnFit = document.querySelector('#dialog-fit');
  const btnActual = document.querySelector('#dialog-actual');
  const btnZoomIn = document.querySelector('#dialog-zoom-in');
  const btnZoomOut = document.querySelector('#dialog-zoom-out');
  const zoomLabel = document.querySelector('#dialog-zoom-label');
  let trigger;
  let zoomScale = 1;
  let currentNaturalWidth = 800;

  function applyZoom() {
    const svg = dialogCanvas.querySelector('svg');
    if (!svg) return;
    dialogCanvas.classList.remove('is-fit');
    dialogCanvas.classList.add('is-actual');
    btnFit?.classList.remove('is-active');
    btnActual?.classList.toggle('is-active', Math.abs(zoomScale - 1) < 0.01);
    svg.style.width = Math.round(currentNaturalWidth * zoomScale) + 'px';
    if (zoomLabel) zoomLabel.textContent = `${Math.round(zoomScale * 100)}%`;
  }

  function setDialogMode(mode) {
    const svg = dialogCanvas.querySelector('svg');
    if (mode === 'fit') {
      dialogCanvas.classList.add('is-fit');
      dialogCanvas.classList.remove('is-actual');
      btnFit?.classList.add('is-active');
      btnActual?.classList.remove('is-active');
      if (svg) svg.style.width = '100%';
      if (zoomLabel) zoomLabel.textContent = lang ? 'Ajustado' : 'Fit';
    } else {
      zoomScale = 1;
      applyZoom();
    }
  }

  btnFit?.addEventListener('click', () => setDialogMode('fit'));
  btnActual?.addEventListener('click', () => setDialogMode('actual'));
  btnZoomIn?.addEventListener('click', () => { zoomScale = Math.min(2.2, +(zoomScale + 0.2).toFixed(2)); applyZoom(); });
  btnZoomOut?.addEventListener('click', () => { zoomScale = Math.max(0.5, +(zoomScale - 0.2).toFixed(2)); applyZoom(); });

  document.querySelectorAll('[data-expand-diagram]').forEach(button => {
    button.addEventListener('click', () => {
      trigger = button;
      const figure = button.closest('figure');
      const svg = figure.querySelector('svg').cloneNode(true);
      reprefixSvg(svg, 'dialog-svg-');
      currentNaturalWidth = parseFloat(svg.getAttribute('data-natural-width')) || 800;
      zoomScale = 1;
      svg.style.width = currentNaturalWidth + 'px';
      dialogCanvas.replaceChildren(svg);
      bindDiagramInteractivity(dialogCanvas);
      document.querySelector('#dialog-title').textContent = figure.querySelector('figcaption')?.textContent || '';
      dialog.showModal();
      if (currentNaturalWidth > (dialogCanvas.clientWidth || 900)) {
        setDialogMode('fit');
      } else {
        setDialogMode('actual');
      }
    });
  });
  document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && dialog.open) { e.preventDefault(); dialog.close(); } });
  dialog.addEventListener('close', () => setTimeout(() => trigger?.focus(), 60));

  const backToTop = document.querySelector('#back-to-top');
  if (backToTop) {
    const syncTopBtn = () => { backToTop.hidden = window.scrollY < 420; };
    syncTopBtn();
    window.addEventListener('scroll', syncTopBtn, { passive: true });
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  function setActiveNav(id) {
    document.querySelectorAll('nav a[aria-current]').forEach(a => a.removeAttribute('aria-current'));
    const activeLink = document.querySelector(`nav a[href="#${id}"]`);
    if (activeLink) {
      activeLink.setAttribute('aria-current', 'location');
      activeLink.scrollIntoView({ block: 'nearest' });
    }
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActiveNav(e.target.id);
    }, {rootMargin: '-5% 0px -65% 0px'});
    sections.forEach(s => observer.observe(s));

    window.addEventListener('scroll', () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40) {
        const lastVisible = [...sections].reverse().find(s => !s.hidden);
        if (lastVisible) setActiveNav(lastVisible.id);
      }
    }, { passive: true });
  }
})();
