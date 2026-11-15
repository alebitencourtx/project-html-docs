import sanitizeHtml from 'sanitize-html';
import { load } from 'cheerio';
import { isSafeHref } from './urls.mjs';

export const esc = v => String(v).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const textTags = [...sanitizeHtml.defaults.allowedTags, 'details', 'summary', 'div', 'span', 'figure', 'figcaption'];

export function cleanMarkdownHtml(rawHtml) {
  return sanitizeHtml(rawHtml, {
    allowedTags: textTags,
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class'],
      a: ['href', 'title'],
      details: ['open'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a(tagName, attribs) {
        if (attribs.href && !isSafeHref(attribs.href)) {
          const safeAttribs = { ...attribs };
          delete safeAttribs.href;
          return { tagName, attribs: safeAttribs };
        }
        return { tagName, attribs };
      },
    },
  });
}

export const slugify = v => String(v || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'sub';

export function enhanceSectionHtml(rawHtml, sectionId = null, usedIds = new Set()) {
  const $ = load(rawHtml, null, false);
  const subHeadings = [];
  $('table').each((_, tbl) => {
    const $tbl = $(tbl);
    if (!$tbl.parent().hasClass('table-wrap')) $tbl.wrap('<div class="table-wrap"></div>');
  });
  $('blockquote').each((_, bq) => {
    const $bq = $(bq);
    const txt = $bq.text().trim();
    if (/^(?:\[!IMPORTANT\]|Regra(?:\s+de\s+neg[oó]cio|\s+de\s+ouro)?\s*:|Business\s+rule\s*:)/i.test(txt)) $bq.addClass('callout-rule');
    else if (/^(?:\[!TIP\]|Exemplo(?:\s+pr[aá]tico|\s+num[eé]rico)?\s*:|Worked\s+example\s*:|Example\s*:)/i.test(txt)) $bq.addClass('callout-example');
    else if (/^(?:\[!WARNING\]|Aten[çc][aã]o\s*:|Aviso\s*:|Cuidado\s*:|Warning\s*:)/i.test(txt)) $bq.addClass('callout-warning');
    else if (/^(?:\[!NOTE\]|Limita[çc][aã]o\s*:|Limite\s*:|Limitation\s*:|Note\s*:)/i.test(txt)) $bq.addClass('callout-limit');
  });
  $('td code').each((_, el) => {
    const $el = $(el);
    const t = $el.text().trim().toUpperCase();
    if (t === 'PK') $el.addClass('col-badge col-badge-pk');
    else if (t === 'FK') $el.addClass('col-badge col-badge-fk');
    else if (t === 'UK') $el.addClass('col-badge col-badge-uk');
    else if (t === 'PARTIÇÃO' || t === 'PARTICAO' || t === 'PARTITION' || t === 'CLUSTER') $el.addClass('col-badge col-badge-partition');
    else if (t === 'PII' || t === 'SENSÍVEL' || t === 'SENSIVEL') $el.addClass('col-badge col-badge-pii');
    else if (t === 'NOT NULL' || t === 'OBRIGATÓRIO' || t === 'OBRIGATORIO') $el.addClass('col-badge col-badge-notnull');
  });
  if (sectionId) {
    $('h3').each((_, el) => {
      const $el = $(el);
      if ($el.closest('.card').length) return;
      const title = $el.text().trim();
      if (!title) return;
      const base = `${sectionId}-${slugify(title)}`;
      let id = base;
      let n = 2;
      while (usedIds.has(id)) id = `${base}-${n++}`;
      usedIds.add(id);
      $el.attr('id', id);
      subHeadings.push({ id, title });
    });
  }
  return { html: $.html(), subHeadings };
}

export function renderHtmlDocument({
  spec, pkgVersion, en, locale, mode, initialTheme, words, css, js,
  nav, refs, cards, companionHtml, modeBadgesHtml, body,
}) {
  const mobileBarHtml = `<div class="mobile-topbar"><button id="nav-toggle" type="button" aria-expanded="false" aria-controls="sidebar" aria-label="${words.openMenu}"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="5" x2="17" y2="5"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="15" x2="17" y2="15"/></svg><span>${words.menu}</span></button><span class="mobile-topbar-title">${esc(spec.title)}</span><button id="mobile-search-btn" type="button" aria-label="${words.search}"><svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="13" y1="13" x2="17" y2="17"/></svg></button></div>`;
  return `<!DOCTYPE html>\n<html lang="${locale}" data-mode="${mode}" data-theme="${initialTheme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(spec.subtitle)}"><meta name="generator" content="project-html-docs ${pkgVersion}"><title>${esc(spec.title)} · ${esc(spec.version)}</title><style>${css}</style></head><body><a class="skip" href="#main">${en ? 'Skip to content' : 'Ir para o conteúdo'}</a><div id="sidebar-backdrop" class="sidebar-backdrop" hidden></div><aside id="sidebar" class="sidebar"><div class="sidebar-head"><p class="brand">${esc(mode === 'summary' ? (en ? 'Quick guide' : 'Guia rápido') : (en ? 'Project documentation' : 'Documentação de projeto'))}</p><button id="nav-close" class="sidebar-close" type="button" aria-label="${words.closeMenu}">×</button></div><strong>${esc(spec.title)}</strong><label for="search">${words.search}</label><div class="search-box"><input id="search" type="search" autocomplete="off" placeholder="${en ? 'Search docs… (/)' : 'Buscar tópicos… (/)'}"><button id="search-clear" type="button" hidden aria-label="${words.clearSearch}">×</button></div><div id="search-count" class="search-count" role="status" aria-live="polite"></div><nav aria-label="${en ? 'Contents' : 'Conteúdo'}">${nav}${refs ? `<a href="#document-references" data-audience="technical">${words.sources}</a>` : ''}</nav><small>${words.offline}<br>${esc(spec.version)} · ${esc(spec.updated)}</small></aside><main id="main">${mobileBarHtml}<header class="hero"><p class="eyebrow">${esc(spec.eyebrow || words.defaultEyebrow)}</p><h1>${esc(spec.title)}</h1><p class="subtitle">${esc(spec.subtitle)}</p><div class="badges">${modeBadgesHtml}<span>${esc(spec.version)}</span><span>${words.updated}: ${esc(spec.updated)}</span><span>${words.offline}</span>${spec.dataAsOf ? `<span>${words.data}: ${esc(spec.dataAsOf)}</span>` : ''}${companionHtml}</div></header><div class="content">${cards ? `<div class="hero-cards">${cards}</div>` : ''}<div class="toolbar"><span class="hint">${words.hint}</span><div class="audience-filter" role="group" aria-label="${en ? 'Reading profile' : 'Perfil de leitura'}"><button type="button" data-audience-filter="all" class="is-active" aria-pressed="true">${words.filterAll}</button><button type="button" data-audience-filter="business" aria-pressed="false">${words.filterBusiness}</button><button type="button" data-audience-filter="technical" aria-pressed="false">${words.filterTechnical}</button><button type="button" data-audience-filter="operations" aria-pressed="false">${words.filterOps}</button></div><div class="theme-filter" role="group" aria-label="${en ? 'Color theme' : 'Tema de cores'}"><button type="button" data-theme-select="vermelho" class="${initialTheme === 'vermelho' ? 'is-active' : ''}" aria-pressed="${initialTheme === 'vermelho'}"><span class="theme-swatch theme-swatch-vermelho" aria-hidden="true"></span>${words.themeRed}</button><button type="button" data-theme-select="azul" class="${initialTheme === 'azul' ? 'is-active' : ''}" aria-pressed="${initialTheme === 'azul'}"><span class="theme-swatch theme-swatch-azul" aria-hidden="true"></span>${words.themeBlue}</button></div><div class="toolbar-actions"><button id="expand" type="button">${words.expand}</button><button id="collapse" type="button">${words.collapse}</button><button id="print" type="button">${words.print}</button></div></div><p id="no-results" hidden>${words.none}</p>${body}${refs}<footer>${esc(spec.title)} · ${esc(spec.version)} · ${words.offline}</footer></div><button id="back-to-top" type="button" hidden aria-label="${words.backToTop}">↑ ${words.backToTop}</button></main><dialog id="diagram-dialog" aria-labelledby="dialog-title"><div class="dialog-head"><strong id="dialog-title"></strong><div class="dialog-controls"><button id="dialog-zoom-out" type="button" aria-label="${en ? 'Zoom out' : 'Reduzir zoom'}">−</button><span id="dialog-zoom-label" class="dialog-zoom-label" aria-live="polite">100%</span><button id="dialog-zoom-in" type="button" aria-label="${en ? 'Zoom in' : 'Aumentar zoom'}">+</button><button id="dialog-fit" type="button">${words.fit}</button><button id="dialog-actual" type="button" class="is-active">${words.actual}</button><button id="dialog-close" type="button">${words.close}</button></div></div><div id="dialog-canvas" class="dialog-canvas"></div></dialog><script>${js}</script></body></html>`;
}
