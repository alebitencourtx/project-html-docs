(() => {
  const lang = document.documentElement.lang.startsWith('pt');
  const words = lang ? {copy:'Copiar',copied:'Copiado',failed:'Selecione e copie o código',found:'seções encontradas',zoom:'Ampliar diagrama',close:'Fechar'} : {copy:'Copy',copied:'Copied',failed:'Select and copy the code',found:'sections found',zoom:'Expand diagram',close:'Close'};
  const sections = [...document.querySelectorAll('.doc-section')];
  const search = document.querySelector('#search');
  const normalize = x => x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const index = new Map(sections.map(s=>[s,normalize(s.textContent)]));
  const openAncestors = el => {for(let n=el;n;n=n.parentElement) if(n.tagName==='DETAILS') n.open=true;};
  function filter(){const terms=normalize(search.value).trim().split(/\s+/).filter(Boolean); let found=0; for(const s of sections){s.hidden=!terms.every(t=>index.get(s).includes(t)); if(!s.hidden){found++;if(terms.length){s.open=true;s.querySelectorAll('details').forEach(d=>d.open=true);}} const a=document.querySelector(`nav a[href="#${s.id}"]`);if(a)a.hidden=s.hidden;}document.querySelector('#search-count').textContent=terms.length?`${found} ${words.found}`:'';document.querySelector('#no-results').hidden=found>0;}
  search.addEventListener('input',filter);
  document.querySelector('#expand').addEventListener('click',()=>document.querySelectorAll('main details').forEach(d=>d.open=true));
  document.querySelector('#collapse').addEventListener('click',()=>document.querySelectorAll('main details').forEach(d=>d.open=false));
  const printState=new Map();function beforePrint(){document.querySelectorAll('main details').forEach(d=>{printState.set(d,d.open);d.open=true;});}function afterPrint(){for(const [d,v] of printState)d.open=v;printState.clear();}
  window.addEventListener('beforeprint',beforePrint);window.addEventListener('afterprint',afterPrint);document.querySelector('#print').addEventListener('click',()=>window.print());
  function revealHash(){const id=decodeURIComponent(location.hash.slice(1));if(!id)return;const el=document.getElementById(id);if(el){search.value='';filter();openAncestors(el);el.scrollIntoView();}}
  window.addEventListener('hashchange',revealHash);if(location.hash)requestAnimationFrame(revealHash);
  document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{const el=document.getElementById(a.hash.slice(1));if(el){search.value='';filter();openAncestors(el);}}));
  document.querySelectorAll('pre').forEach(pre=>{const button=document.createElement('button');button.className='copy';button.textContent=words.copy;button.type='button';button.addEventListener('click',async()=>{const text=pre.querySelector('code').textContent;try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else throw Error();button.textContent=words.copied;}catch{const range=document.createRange();range.selectNodeContents(pre.querySelector('code'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);button.textContent=words.failed;}setTimeout(()=>button.textContent=words.copy,2500);});pre.append(button);});
  const dialog=document.querySelector('#diagram-dialog');let trigger;
  document.querySelectorAll('[data-expand-diagram]').forEach(b=>b.addEventListener('click',()=>{trigger=b;const figure=b.closest('figure');const svg=figure.querySelector('svg').cloneNode(true);svg.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));svg.style.width=svg.getAttribute('data-natural-width')+'px';document.querySelector('#dialog-canvas').replaceChildren(svg);document.querySelector('#dialog-title').textContent=figure.querySelector('figcaption').textContent;dialog.showModal();}));
  document.querySelector('#dialog-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>trigger?.focus());
  if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){document.querySelectorAll('nav a[aria-current]').forEach(a=>a.removeAttribute('aria-current'));document.querySelector(`nav a[href="#${e.target.id}"]`)?.setAttribute('aria-current','location');}},{rootMargin:'-5% 0px -65% 0px'});sections.forEach(s=>observer.observe(s));}
})();
