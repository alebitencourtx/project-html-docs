(() => {
  const lang = document.documentElement.lang.startsWith('pt');
  const words = lang
    ? {copy:'Copiar',copied:'Copiado',failed:'Selecione e copie o código',found:'seção encontrada',foundPlural:'seções encontradas'}
    : {copy:'Copy',copied:'Copied',failed:'Select and copy the code',found:'section found',foundPlural:'sections found'};

  const sections = [...document.querySelectorAll('.doc-section')];
  const search = document.querySelector('#search');
  const normalize = x => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const index = new Map(sections.map(s => [s, normalize(s.textContent)]));
  const openAncestors = el => { for (let n = el; n; n = n.parentElement) if (n.tagName === 'DETAILS') n.open = true; };

  // A busca abre seções para revelar o resultado. Guardamos o estado anterior
  // e restauramos quando o campo é limpo, para não alterar a leitura do usuário.
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

  function filter() {
    const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
    if (terms.length && !searchActive) { saveOpenState(); searchActive = true; }

    let found = 0;
    for (const s of sections) {
      s.hidden = !terms.every(t => index.get(s).includes(t));
      if (!s.hidden) {
        found++;
        if (terms.length) { s.open = true; s.querySelectorAll('details').forEach(d => d.open = true); }
      }
      const a = document.querySelector(`nav a[href="#${s.id}"]`);
      if (a) a.hidden = s.hidden;
    }

    if (!terms.length && searchActive) { restoreOpenState(); searchActive = false; }

    document.querySelector('#search-count').textContent = terms.length
      ? `${found} ${found === 1 ? words.found : words.foundPlural}`
      : '';
    document.querySelector('#no-results').hidden = found > 0;
  }

  search.addEventListener('input', filter);
  document.querySelector('#expand').addEventListener('click', () => document.querySelectorAll('main details').forEach(d => d.open = true));
  document.querySelector('#collapse').addEventListener('click', () => document.querySelectorAll('main details').forEach(d => d.open = false));

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
    const el = document.getElementById(a.hash.slice(1));
    if (el) { search.value = ''; filter(); openAncestors(el); }
  }));

  // Copia com clipboard; se o navegador negar, tenta execCommand e por fim
  // seleciona o código para cópia manual.
  document.querySelectorAll('pre').forEach(pre => {
    const button = document.createElement('button');
    button.className = 'copy';
    button.textContent = words.copy;
    button.type = 'button';
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
      setTimeout(() => button.textContent = words.copy, 2500);
    });
    pre.append(button);
  });

  // O SVG ampliado precisa de IDs próprios para não colidir com o original.
  // Remover os IDs quebraria markers, gradientes e filtros referenciados por url(#...).
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
  let trigger;

  function setDialogMode(mode) {
    if (mode === 'fit') {
      dialogCanvas.classList.add('is-fit');
      dialogCanvas.classList.remove('is-actual');
      btnFit?.classList.add('is-active');
      btnActual?.classList.remove('is-active');
    } else {
      dialogCanvas.classList.remove('is-fit');
      dialogCanvas.classList.add('is-actual');
      btnActual?.classList.add('is-active');
      btnFit?.classList.remove('is-active');
    }
  }

  btnFit?.addEventListener('click', () => setDialogMode('fit'));
  btnActual?.addEventListener('click', () => setDialogMode('actual'));

  document.querySelectorAll('[data-expand-diagram]').forEach(button => {
    button.addEventListener('click', () => {
      trigger = button;
      const figure = button.closest('figure');
      const svg = figure.querySelector('svg').cloneNode(true);
      reprefixSvg(svg, 'dialog-svg-');
      const naturalWidth = parseFloat(svg.getAttribute('data-natural-width')) || 800;
      svg.style.width = naturalWidth + 'px';
      dialogCanvas.replaceChildren(svg);
      document.querySelector('#dialog-title').textContent = figure.querySelector('figcaption')?.textContent || '';
      dialog.showModal();
      // Se a largura natural for significativamente maior que o canvas útil, abre inicialmente ajustado
      if (naturalWidth > (dialogCanvas.clientWidth || 900)) {
        setDialogMode('fit');
      } else {
        setDialogMode('actual');
      }
    });
  });
  document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && dialog.open) { e.preventDefault(); dialog.close(); } });
  dialog.addEventListener('close', () => setTimeout(() => trigger?.focus(), 60));

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) {
        document.querySelectorAll('nav a[aria-current]').forEach(a => a.removeAttribute('aria-current'));
        const activeLink = document.querySelector(`nav a[href="#${e.target.id}"]`);
        if (activeLink) {
          activeLink.setAttribute('aria-current', 'location');
          activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }, {rootMargin: '-5% 0px -65% 0px'});
    sections.forEach(s => observer.observe(s));
  }
})();
