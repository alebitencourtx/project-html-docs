import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Marked } from 'marked';
import Ajv from 'ajv';
import { load } from 'cheerio';
import { renderMermaidSVG } from 'beautiful-mermaid';
import { validateHtml } from './validate.mjs';
import { renderSolutionDiagram, renderSchemaDiagram, enhanceMermaidSvg, validateChartSpec } from './diagrams.mjs';
import { computeRendererHash } from './renderer-hash.mjs';
import { assertSafeHref } from './lib/urls.mjs';
import { HASH_ALGORITHM, hashRaw, hashCanonicalText } from './lib/hash.mjs';
import { RESERVED_IDS, normalizeTheme, getUiWords } from './lib/i18n.mjs';
import { receiptPathFor } from './lib/paths.mjs';
import { esc, softBreak, cleanMarkdownHtml, enhanceSectionHtml, renderHtmlDocument } from './lib/html-shell.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
const SCHEMA = JSON.parse(await fs.readFile(path.join(ROOT, 'schemas/document.schema.json'), 'utf8'));
const validateManifest = new Ajv({ allErrors: true }).compile(SCHEMA);

const VARIANTS = {
  accent: '#087f8c',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  neutral: '#64748b',
};

export function barChart(spec, locale = 'pt-BR') {
  if (!spec || spec.type !== 'bar' || !spec.title || !spec.unit || !spec.source || !Array.isArray(spec.data) || !spec.data.length || spec.data.length > 40) {
    throw Error('chart requires type=bar, title, unit, source, and 1–40 data items');
  }
  const seen = new Set();
  for (const d of spec.data) {
    if (!d || typeof d.label !== 'string' || !d.label.trim() || d.label.length > 45 || !Number.isFinite(d.value) || d.value < 0 || seen.has(d.label)) {
      throw Error('chart labels must be unique (max 45 chars); values must be finite and nonnegative');
    }
    if (d.variant !== undefined && !VARIANTS[d.variant]) {
      throw Error('chart variant must be warning, danger, success, neutral, or accent');
    }
    seen.add(d.label);
  }
  validateChartSpec(spec);

  const max = Math.max(1, ...spec.data.map(d => d.value));
  const row = 42;
  const widthOf = c => c === ' ' ? 4.2 : 'MW@%'.includes(c) ? 14 : /[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(c) ? 10.5 : /[0-9]/.test(c) ? 8.4 : /[il.,:;!|'`]/.test(c) ? 3.5 : 7.6;
  const labelWidth = Math.max(...spec.data.map(d => [...d.label].reduce((sum, c) => sum + widthOf(c), 0)));
  const left = Math.max(220, Math.round(labelWidth + 24));
  const plot = 540;
  const w = left + plot + 80;
  const plotTop = 10;
  const plotBottom = spec.data.length * row + 10;
  const h = plotBottom + 52;
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  const gridlines = [0.25, 0.5, 0.75, 1].map(pct => {
    const gx = left + Math.round(pct * plot);
    return `<line class="chart-gridline" x1="${gx}" y1="${plotTop}" x2="${gx}" y2="${plotBottom}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3"/>`;
  }).join('');

  const rows = spec.data.map((d, i) => {
    const y = i * row + 16;
    const color = (d.variant && VARIANTS[d.variant]) ? VARIANTS[d.variant] : VARIANTS.accent;
    const bw = d.value === 0 ? 0 : Math.max(2, Math.round((d.value / max) * plot));
    const title = `${d.label}: ${fmt.format(d.value)} ${spec.unit}`;
    let valEl;
    if (d.value === 0) {
      valEl = `<g data-zero="true" class="chart-zero-badge"><rect x="${left + 4}" y="${y + 3}" width="54" height="17" rx="3" fill="#edf2f7"/><text x="${left + 31}" y="${y + 15}" text-anchor="middle" fill="#526778" font-size="11" font-weight="600">0 (zero)</text></g>`;
    } else if (bw >= 64) {
      valEl = `<text class="chart-value chart-value-inside" x="${left + bw - 10}" y="${y + 16}" text-anchor="end" fill="#ffffff" font-weight="600" font-size="12">${esc(fmt.format(d.value))}</text>`;
    } else {
      valEl = `<line class="chart-guide" x1="${left + bw + 3}" y1="${y + 11.5}" x2="${left + bw + 11}" y2="${y + 11.5}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/><text class="chart-value chart-value-outside" x="${left + bw + 15}" y="${y + 16}" text-anchor="start" fill="#172b3c" font-weight="600" font-size="12">${esc(fmt.format(d.value))}</text>`;
    }
    const barEl = bw > 0 ? `<rect class="chart-bar" x="${left}" y="${y}" width="${bw}" height="23" rx="4" fill="${color}"/>` : '';
    return `<g class="chart-row" tabindex="0"><title>${esc(title)}</title><text class="chart-label" x="${left - 14}" y="${y + 16}" text-anchor="end" fill="#314c5e">${esc(d.label)}</text><rect class="chart-track" x="${left}" y="${y}" width="${plot}" height="23" rx="4" fill="#e8eff3"/>${barEl}${valEl}</g>`;
  }).join('');

  const axisTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const gx = left + Math.round(pct * plot);
    const tickVal = pct * max;
    const anchor = pct === 0 ? 'start' : pct === 1 ? 'end' : 'middle';
    return `<line class="chart-axis-tick" x1="${gx}" y1="${plotBottom}" x2="${gx}" y2="${plotBottom + 4}" stroke="#94a3b8" stroke-width="1"/><text class="chart-axis-val" x="${gx}" y="${plotBottom + 16}" text-anchor="${anchor}" fill="#526778" font-size="11" font-variant-numeric="tabular-nums">${esc(fmt.format(tickVal))}</text>`;
  }).join('');

  const axis = `<g class="chart-axis" aria-hidden="true"><line class="chart-axis-line" x1="${left}" y1="${plotBottom}" x2="${left + plot}" y2="${plotBottom}" stroke="#cbd5e1" stroke-width="1"/>${axisTicks}</g>`;
  const table = `<table><thead><tr><th>${locale === 'pt-BR' ? 'Categoria' : 'Category'}</th><th>${esc(spec.unit)}</th></tr></thead><tbody>${spec.data.map(d => `<tr><td>${esc(d.label)}</td><td>${esc(fmt.format(d.value))}</td></tr>`).join('')}</tbody></table>`;
  return `<figure class="chart"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(spec.title)}" style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;min-width:${w}px"><g class="chart-gridlines" aria-hidden="true">${gridlines}</g>${rows}${axis}<text x="${left}" y="${h - 6}" fill="#526778" font-size="12">0 · ${esc(spec.unit)} · ${locale === 'pt-BR' ? 'escala linear' : 'linear scale'}</text></svg><figcaption><strong>${esc(spec.title)}</strong> · ${esc(spec.source)}${spec.asOf ? ' · ' + esc(spec.asOf) : ''}</figcaption><details><summary>${locale === 'pt-BR' ? 'Dados do gráfico' : 'Chart data'}</summary><div class="table-wrap">${table}</div></details></figure>`;
}

export const CARD_TOKEN_MAX = 18;
export const HEADING_TOKEN_MAX = 40;
export function longTokenWarnings(spec, subHeadingTitles = []) {
  const warnings = [];
  for (const card of spec.cards || []) {
    if (String(card.value).split(/\s+/).some(t => t.length > CARD_TOKEN_MAX)) warnings.push(`Card "${card.label}" has a value token longer than ${CARD_TOKEN_MAX} characters; prefer a short value and move identifiers to the description.`);
  }
  for (const title of [spec.title, ...(spec.sections || []).map(s => s.title), ...subHeadingTitles]) {
    if (String(title || '').split(/\s+/).some(t => t.length > HEADING_TOKEN_MAX)) warnings.push(`Heading has a token longer than ${HEADING_TOKEN_MAX} characters: ${title}`);
  }
  return warnings;
}

async function ensureWritableTarget(targetPath, protectedPaths, { force, label }) {
  for (const [protPath, protName] of protectedPaths) {
    if (targetPath === protPath) {
      throw Error(`${label} cannot overwrite input ${protName}: ${targetPath}`);
    }
  }
  try {
    await fs.access(targetPath);
    if (!force) {
      throw Error(`${label} already exists: ${targetPath}; choose a new name or --force`);
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

async function writeAtomicFile(targetPath, data) {
  const uniqueSuffix = `.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2, 8)}.tmp`;
  const tmpPath = `${targetPath}${uniqueSuffix}`;
  try {
    await fs.writeFile(tmpPath, data);
    await fs.rename(tmpPath, targetPath);
  } finally {
    await fs.rm(tmpPath, { force: true }).catch(() => {});
  }
}

export async function build(manifestFile, output, { force = false, mode: cliMode } = {}) {
  const manifestPath = path.resolve(manifestFile);
  const base = path.dirname(manifestPath);
  const manifestRaw = await fs.readFile(manifestPath, 'utf8');
  const spec = JSON.parse(manifestRaw);

  if (!validateManifest(spec)) {
    throw Error(JSON.stringify(validateManifest.errors));
  }

  const mode = cliMode ?? spec.mode ?? 'full';
  if (mode !== 'full' && mode !== 'summary') {
    throw Error(`Invalid mode "${mode}": expected "full" or "summary"`);
  }
  if (!output) {
    throw Error('Choose an output with --out; no file is overwritten unless --force is explicit');
  }

  output = path.resolve(output);
  const receiptPath = receiptPathFor(output);
  const input = path.resolve(base, spec.content);

  const protectedInputs = [
    [manifestPath, 'manifest'],
    [input, 'content'],
  ];

  // Resolve and hash sources before writing any output
  const sourceMap = new Map();
  const evidence = [];
  for (const source of spec.sources || []) {
    if (sourceMap.has(source.id)) throw Error(`Duplicate source: ${source.id}`);
    if (!spec.repoRoot) throw Error('repoRoot is required for local sources');
    const repo = path.resolve(base, spec.repoRoot);
    const p = path.resolve(repo, source.path);
    const rel = path.relative(repo, p);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw Error('Source outside repository');
    protectedInputs.push([p, `source "${source.id}"`]);
    const raw = await fs.readFile(p);
    const item = { ...source, sha256: hashCanonicalText(raw, p) };
    sourceMap.set(source.id, item);
    evidence.push(item);
  }

  await ensureWritableTarget(output, protectedInputs, { force, label: 'Output' });
  await ensureWritableTarget(receiptPath, protectedInputs, { force, label: 'Validation receipt' });
  if (output === receiptPath) {
    throw Error('Output and validation receipt paths must be distinct');
  }

  const md = await fs.readFile(input, 'utf8');
  const en = spec.language === 'en';
  const locale = en ? 'en' : 'pt-BR';
  const words = getUiWords(en, mode);

  const ids = new Set();
  const usedIds = new Set([...RESERVED_IDS, ...evidence.map(s => `ref-${s.id}`)]);
  for (const section of spec.sections) {
    if (RESERVED_IDS.has(section.id)) throw Error(`Reserved section id "${section.id}" cannot be used`);
    if (ids.has(section.id)) throw Error(`Duplicate section: ${section.id}`);
    ids.add(section.id);
    usedIds.add(section.id);
    for (const s of section.sources || []) {
      if (!sourceMap.has(s)) throw Error(`Unknown source: ${s}`);
    }
  }

  const mdParser = new Marked({ gfm: true });
  const tokens = mdParser.lexer(md);
  const groups = [];
  let current;
  for (const token of tokens) {
    if (token.type === 'heading' && token.depth === 1) {
      throw Error(`H1 heading is reserved for document title; found "${token.text}" in ${current ? `section "${current.title}"` : 'document top'}`);
    }
    if (token.type === 'heading' && token.depth === 2) {
      current = { title: token.text, tokens: [] };
      groups.push(current);
    } else if (current) {
      if (token.type === 'html' && /<h1(?:\s|>)/i.test(token.text || '')) {
        throw Error(`H1 heading is reserved for document title; found HTML <h1> in section "${current.title}"`);
      }
      current.tokens.push(token);
    } else if (token.type !== 'space') {
      throw Error('Start content with a level-two heading listed in document.json');
    }
  }

  if (groups.length !== spec.sections.length) {
    throw Error(`Markdown H2 headings must match sections[].title in order (found ${groups.length}, expected ${spec.sections.length})`);
  }
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].title !== spec.sections[i].title) {
      throw Error(`Markdown H2 headings must match sections[].title in order (index ${i}: expected "${spec.sections[i].title}", found "${groups[i].title}")`);
    }
  }

  let diagramIndex = 0;
  const generated = new Map();
  mdParser.use({
    renderer: {
      html({ text }) {
        return text;
      },
      code({ text, lang }) {
        const type = (lang || '').trim().split(/\s+/)[0];
        let html;
        if (type === 'mermaid') {
          const title = (lang || '').trim().slice(type.length).trim();
          if (!title) throw Error('Give each mermaid fence a descriptive title after mermaid');
          const raw = renderMermaidSVG(text, {
            bg: '#f8fbfc', fg: '#172b3c', accent: '#087f8c', line: '#7992a2',
            surface: '#ffffff', border: '#b8cbd5', font: 'Segoe UI', padding: 22, nodeSpacing: 28, layerSpacing: 38,
          });
          const $ = load(raw, { xml: true });
          $('style').each((_, e) => $(e).text($(e).text().replace(/@import\s+url\([^)]*\)\s*;/g, '')));
          enhanceMermaidSvg($, text);
          const svg = $('svg');
          const prefix = `diagram-${++diagramIndex}-`;
          const replaces = new Map();
          $('[id]').each((_, e) => {
            const old = $(e).attr('id');
            replaces.set(old, prefix + old);
            $(e).attr('id', prefix + old);
          });
          $('*').each((_, e) => {
            for (const [a, v] of Object.entries(e.attribs || {})) {
              let next = v;
              for (const [old, id] of replaces) {
                next = next.replaceAll(`url(#${old})`, `url(#${id})`);
                if (next === `#${old}`) next = `#${id}`;
              }
              if (next !== v) $(e).attr(a, next);
            }
          });
          const width = parseFloat(svg.attr('width')) || Number(svg.attr('viewBox')?.split(/\s+/)[2]) || 800;
          svg.attr({
            role: 'img',
            'aria-label': title,
            'data-natural-width': String(width),
            style: `${svg.attr('style') || ''};width:${width}px;max-width:100%;height:auto`,
          });
          html = `<figure class="diagram"><div class="figure-tools"><span class="figure-tag">${esc(title)}</span><button type="button" data-expand-diagram aria-label="${words.diagram}: ${esc(title)}">${words.diagram}</button></div><div class="diagram-scroll">${$.xml()}</div><figcaption>${esc(title)}</figcaption></figure>`;
        } else if (type === 'solution' || type === 'flow') {
          const prefix = `diagram-${++diagramIndex}-`;
          try {
            html = renderSolutionDiagram(JSON.parse(text), { locale, diagramLabel: words.diagram, mode: type }).replaceAll('__PREFIX__', prefix);
          } catch (e) {
            throw Error(`Invalid ${type} diagram block: ${e.message}`);
          }
        } else if (type === 'schema' || type === 'erd') {
          const prefix = `diagram-${++diagramIndex}-`;
          try {
            html = renderSchemaDiagram(JSON.parse(text), { locale, diagramLabel: words.diagram }).replaceAll('__PREFIX__', prefix);
          } catch (e) {
            throw Error(`Invalid ${type} diagram block: ${e.message}`);
          }
        } else if (type === 'chart') {
          try {
            html = barChart(JSON.parse(text), locale);
          } catch (e) {
            throw Error(`Invalid chart block: ${e.message}`);
          }
        } else {
          return `<pre><code${type ? ` class="language-${esc(type)}"` : ''}>${esc(text)}</code></pre>`;
        }
        const key = `GENERATEDVISUAL${generated.size}END`;
        generated.set(key, html);
        return `<div>${key}</div>`;
      },
    },
  });

  const subNavBySection = new Map();
  const body = groups.map((g, i) => {
    const section = spec.sections[i];
    const enhanced = enhanceSectionHtml(cleanMarkdownHtml(mdParser.parser(g.tokens)), section.id, usedIds);
    let content = enhanced.html;
    subNavBySection.set(section.id, enhanced.subHeadings);
    for (const [key, value] of generated) {
      content = content.replace(`<div>${key}</div>`, () => value);
    }
    const refs = (section.sources || []).map(id => `<a href="#ref-${id}">${esc(sourceMap.get(id).path)}</a>`).join(' ');
    return `<details class="doc-section" id="${section.id}" data-audience="${section.audience}" open><summary class="section-heading"><span class="number">${String(i + 1).padStart(2, '0')}</span><h2>${esc(section.title)}</h2><span class="audience ${section.audience}">${words[section.audience]}</span></summary><div class="section-body">${content}${refs ? `<div class="section-sources">${words.sources}: ${refs}</div>` : ''}</div></details>`;
  }).join('\n');

  const nav = spec.sections.map((s, i) => {
    const subs = subNavBySection.get(s.id) || [];
    const subHtml = subs.length
      ? `<div class="nav-sub" data-parent="${s.id}">${subs.map(sub => `<a href="#${sub.id}">${esc(sub.title)}</a>`).join('')}</div>`
      : '';
    return `<a href="#${s.id}" data-audience="${s.audience}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(s.title)}</a>${subHtml}`;
  }).join('');

  const refs = evidence.length
    ? `<details class="doc-section" id="document-references" data-audience="technical"><summary class="section-heading"><h2>${words.reference}</h2></summary><div class="section-body"><p>${en ? 'Local files used to describe this revision.' : 'Arquivos locais usados para descrever esta revisão. As referências são para aprofundamento; o conteúdo necessário à leitura está incorporado.'}</p><div class="table-wrap"><table><thead><tr><th>${en ? 'File' : 'Arquivo'}</th><th>${en ? 'Purpose' : 'Conteúdo'}</th></tr></thead><tbody>${evidence.map(s => `<tr id="ref-${s.id}"><td class="source-path">${esc(s.path)}</td><td>${esc(s.description)}</td></tr>`).join('')}</tbody></table></div><p class="revision">${words.code}: ${esc(spec.revision || '—')}</p></div></details>`
    : '';

  const cards = (spec.cards || []).map(c =>
    `<article class="metric"><span class="label">${esc(c.label)}</span><strong>${softBreak(c.value)}</strong><p>${softBreak(c.description)}</p></article>`,
  ).join('');

  const initialTheme = normalizeTheme(spec.theme);
  let companionHtml = '';
  if (spec.companionDoc) {
    const safeHref = assertSafeHref(spec.companionDoc.href, 'companionDoc href');
    companionHtml = `<a class="hero-companion" href="${esc(safeHref)}">${esc(spec.companionDoc.label)} ↗</a>`;
  }

  const approxWordCount = (() => {
    const $m = load(body, null, false);
    $m('svg,script,style').remove();
    return $m.text().trim().split(/\s+/).filter(Boolean).length;
  })();
  const approxReadingMin = Math.max(1, Math.round(approxWordCount / 190));
  const modeBadgesHtml = mode === 'summary'
    ? `<span class="badge-mode">${esc(words.summaryBadge)}</span><span>${esc(words.readingBadge(approxReadingMin))}</span>`
    : '';

  const [css, js, rendererSha256] = await Promise.all([
    fs.readFile(path.join(ROOT, 'assets/document.css'), 'utf8'),
    fs.readFile(path.join(ROOT, 'assets/document.js'), 'utf8'),
    computeRendererHash(ROOT),
  ]);

  const html = renderHtmlDocument({
    spec, pkgVersion: PKG.version, en, locale, mode, initialTheme, words, css, js,
    nav, refs, cards, companionHtml, modeBadgesHtml, body,
  });

  const validated = validateHtml(html);
  const warnings = longTokenWarnings(spec, [...subNavBySection.values()].flat().map(s => s.title));
  if (spec.sections.length >= 4) {
    const allCount = spec.sections.filter(s => s.audience === 'all').length;
    if (allCount / spec.sections.length > 0.7) {
      warnings.push(`High proportion of sections tagged "audience": "all" (${allCount}/${spec.sections.length}); distribute business/technical/operations for effective filtering.`);
    }
  }
  if ((spec.sources || []).length > 0 && spec.sections.length >= 3) {
    const unlinked = spec.sections.filter(s => !(s.sources && s.sources.length)).length;
    if (unlinked / spec.sections.length > 0.5) {
      warnings.push(`${unlinked}/${spec.sections.length} sections omit "sources"; populate sections[].sources for incremental --impact tracking.`);
    }
  }
  if (mode === 'summary') {
    if (validated.contentSections > 8) {
      warnings.push(`Summary mode has ${validated.contentSections} sections; aim for 4-7 focused chapters to keep quick-guide scannability.`);
    }
    if (validated.wordCount > 3500) {
      warnings.push(`Summary mode has ${validated.wordCount} words (~${validated.readingMinutes} min); trim encyclopedic details to keep under ~3,500 words.`);
    }
  }
  if (spec.companionDoc) {
    const rawHref = String(spec.companionDoc.href || '').trim();
    if (rawHref && !/^(?:https?:|mailto:|#)/i.test(rawHref)) {
      const cleanRel = rawHref.split(/[?#]/)[0];
      if (cleanRel) {
        const sibling = path.resolve(path.dirname(output), cleanRel);
        try {
          await fs.access(sibling);
        } catch (e) {
          if (e.code === 'ENOENT') {
            warnings.push(`Companion document "${cleanRel}" was not found at ${sibling}; remember to compile it alongside this file.`);
          }
        }
      }
    }
  }

  const relHtmlPath = path.relative(path.dirname(receiptPath), output).replace(/\\/g, '/') || path.basename(output);
  const receipt = {
    ...validated,
    warnings,
    version: PKG.version,
    skillVersion: PKG.version,
    hashAlgorithm: HASH_ALGORITHM,
    htmlPath: relHtmlPath,
    rendererSha256,
    builtAt: new Date().toISOString(),
    manifestSha256: hashCanonicalText(manifestRaw, manifestPath),
    document: spec.title,
    revision: spec.revision || null,
    inputSha256: hashCanonicalText(md, input),
    htmlSha256: hashRaw(html),
    sources: evidence,
  };
  if (!receipt.passed) throw Error(JSON.stringify(receipt.errors));

  await fs.mkdir(path.dirname(output), { recursive: true });
  await writeAtomicFile(output, html);
  await writeAtomicFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

export function parseBuildCliArgs(args) {
  let manifestFile = null;
  let outFile = null;
  let mode;
  let force = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--force') {
      force = true;
    } else if (arg === '--out') {
      const val = args[i + 1];
      if (!val || val.startsWith('--')) throw Error('Flag --out requires a file path');
      outFile = val;
      i++;
    } else if (arg === '--mode') {
      const val = args[i + 1];
      if (!val || val.startsWith('--')) throw Error('Flag --mode requires "full" or "summary"');
      mode = val;
      i++;
    } else if (arg.startsWith('--')) {
      throw Error(`Unknown flag: ${arg}`);
    } else if (!manifestFile) {
      manifestFile = arg;
    } else {
      throw Error(`Unexpected positional argument: ${arg}`);
    }
  }
  if (!manifestFile) {
    throw Error('Usage: node scripts/build.mjs <document.json> --out <output.html> [--mode full|summary] [--force]');
  }
  return { manifestFile, outFile, mode, force };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { manifestFile, outFile, mode, force } = parseBuildCliArgs(process.argv.slice(2));
    const receipt = await build(manifestFile, outFile, { force, mode });
    console.log(JSON.stringify({
      passed: receipt.passed,
      mode: receipt.mode,
      wordCount: receipt.wordCount,
      readingMinutes: receipt.readingMinutes,
      warnings: receipt.warnings,
      sections: receipt.sections,
      contentSections: receipt.contentSections,
      referenceBlocks: receipt.referenceBlocks,
      diagrams: receipt.diagrams,
      charts: receipt.charts,
      bytes: receipt.bytes,
      browserReviewed: false,
    }, null, 2));
  } catch (e) {
    console.error(e.stack || e.message);
    process.exitCode = 1;
  }
}
