import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { hashRaw } from './lib/hash.mjs';
import { receiptPathFor, resolveCandidateHtmlPath } from './lib/paths.mjs';
import { findBrowser, launchBrowser, ReviewEnvError } from './review/browser.mjs';
import { pageChecks, tileGeometry } from './review/page-checks.mjs';
import { checkInteractions } from './review/interactions.mjs';
import { renderRubric } from './review/rubric.mjs';

export const DEFAULT_VIEWPORTS = [1440];
export const MAX_TILE = 1600;
export { ReviewEnvError };

export function parseReviewCliArgs(argv) {
  const opts = { viewports: [...DEFAULT_VIEWPORTS], mode: 'smart' };
  const flags = { '--out': 'outDir', '--browser': 'browser', '--receipt': 'receiptFile', '--html': 'htmlFile', '--viewports': 'viewports', '--tiles': 'mode' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (flags[arg]) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw Error(`Flag ${arg} requires a value`);
      opts[flags[arg]] = value;
    } else if (arg.startsWith('-')) throw Error(`Unknown flag: ${arg}`);
    else if (!opts.inputFile) opts.inputFile = arg;
    else throw Error(`Unexpected positional argument: ${arg}`);
  }
  if (!opts.inputFile) throw Error('Usage: review <output.html|receipt.validation.json> [--out <dir>] [--viewports 1440,1024,390] [--tiles smart|all] [--browser <exe>]');
  if (typeof opts.viewports === 'string') opts.viewports = opts.viewports.split(',').map(Number);
  if (!opts.viewports.length || opts.viewports.some(n => !Number.isInteger(n) || n < 320 || n > 7680)) throw Error('--viewports must contain widths from 320 to 7680');
  opts.viewports = [...new Set(opts.viewports)];
  if (!['smart', 'all'].includes(opts.mode)) throw Error('--tiles must be smart or all');
  return opts;
}

export function planTiles(geometry, viewport, issues = [], { mode = 'smart', primary = true } = {}) {
  const tiles = [];
  const add = (id, top, height) => tiles.push({ id: id.replace(/[^\w-]/g, '-'), top: Math.max(0, Math.floor(top)), height: Math.max(1, Math.min(MAX_TILE, Math.ceil(height), geometry.height - Math.floor(top))), width: viewport });
  add(`${viewport}-hero`, 0, Math.min(MAX_TILE, geometry.hero.top + geometry.hero.height));
  if (primary || mode === 'all') for (const f of geometry.figures || []) {
    add(`${viewport}-fig${String(f.index).padStart(2, '0')}-${f.section}`, f.top, f.height);
  }
  const issueSections = new Set(issues.map(i => i.section));
  for (const s of geometry.sections) {
    if (mode === 'all') {
      for (let offset = 0, part = 1; offset < s.height; offset += MAX_TILE, part++) add(`${viewport}-section-${s.id}-${part}`, s.top + offset, Math.min(MAX_TILE, s.height - offset));
    } else if (issueSections.has(s.id)) add(`${viewport}-section-${s.id}`, s.top, s.height);
  }
  return tiles;
}

async function writeJson(file, value) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(tmp, JSON.stringify(value, null, 2) + '\n'); await fs.rename(tmp, file); }
  finally { await fs.rm(tmp, { force: true }); }
}

export async function review(inputFile, options = {}) {
  const { viewports, mode } = parseReviewCliArgs([inputFile, '--viewports', (options.viewports || DEFAULT_VIEWPORTS).join(','), '--tiles', options.mode || 'smart']);
  const input = path.resolve(inputFile);
  const receiptPath = path.resolve(options.receiptFile || (/\.json$/i.test(input) ? input : receiptPathFor(input)));
  const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
  const htmlPath = resolveCandidateHtmlPath(receiptPath, receipt, options.htmlFile || (/\.html?$/i.test(input) ? input : null));
  if (!htmlPath) throw Error('Cannot resolve HTML path; pass --html <file>');
  const htmlSha256 = hashRaw(await fs.readFile(htmlPath));
  if (!receipt.passed || receipt.htmlSha256 !== htmlSha256) throw Error('HTML does not match a passing build receipt; rebuild before review');
  const browser = findBrowser({ explicit: options.browser });
  if (!browser.ok) throw new ReviewEnvError('Chrome/Edge/Chromium not found. Set PHD_BROWSER or --browser. If review is unavailable, verify --mark-reviewed --accept-issues "<reason>" records an explicit exception.');
  const outDir = path.resolve(options.outDir || htmlPath.replace(/\.html?$/i, '') + '.review');
  // Each run owns a fresh directory: old rubrics/screenshots cannot accidentally approve a rerun.
  const runId = randomUUID();
  const captureDir = path.join(outDir, runId);
  await fs.mkdir(captureDir, { recursive: true });
  const rubricPath = path.join(captureDir, 'rubric.md');
  const reportPath = path.join(captureDir, 'review.json');
  const report = { runId, htmlPath, htmlSha256, reviewedAt: new Date().toISOString(), browser: path.basename(browser.path), viewports, mode, outDir: captureDir, rubricPath, reportPath, tiles: [], errors: [], interactions: [], interactionFailures: [] };
  // Invalidate prior sign-off before launching: even a failed rerun cannot leave it approved.
  receipt.browserReviewed = false;
  delete receipt.browserReviewedAt; delete receipt.reviewOverride; delete receipt.visualReview;
  await writeJson(receiptPath, receipt);
  const session = await launchBrowser(browser.path);
  try {
    for (const [index, viewport] of viewports.entries()) {
      await session.viewport(viewport);
      await session.navigate(htmlPath);
      await session.evaluate(() => { document.querySelector('#expand')?.click(); scrollTo(0, 0); });
      const issues = await session.evaluate(pageChecks);
      report.errors.push(...issues.map(e => ({ ...e, viewport })));
      const geometry = await session.evaluate(tileGeometry);
      for (const tile of planTiles(geometry, viewport, issues, { mode, primary: index === 0 })) {
        tile.file = `${tile.id}.png`;
        await session.screenshot(path.join(captureDir, tile.file), tile);
        report.tiles.push(tile);
      }
      if (mode === 'all') {
        await session.evaluate(() => document.querySelector('[data-theme-select="azul"]')?.click());
        const tile = { id: `${viewport}-azul`, top: 0, height: Math.min(MAX_TILE, geometry.hero.top + geometry.hero.height), width: viewport, file: `${viewport}-azul.png` };
        await session.screenshot(path.join(captureDir, tile.file), tile);
        report.tiles.push(tile);
      }
      const interactions = (await session.evaluate(checkInteractions)).map(r => ({ ...r, viewport }));
      report.interactions.push(...interactions);
      report.interactionFailures.push(...interactions.filter(r => !r.ok));
      report.errors.push(...session.errors.map(message => ({ type: 'console-error', severity: 'error', viewport, section: null, message })));
    }
  } finally { await session.close(); }
  const current = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
  if (hashRaw(await fs.readFile(htmlPath)) !== htmlSha256 || current.htmlSha256 !== htmlSha256) throw Error('HTML changed during review; run review again');
  report.summary = { errors: report.errors.length, interactionFailures: report.interactionFailures.length, tiles: report.tiles.length };
  report.ok = !report.summary.errors && !report.summary.interactionFailures;
  await writeJson(reportPath, report);
  await fs.writeFile(rubricPath, renderRubric(report));
  current.visualReview = report;
  current.browserReviewed = false;
  delete current.browserReviewedAt; delete current.reviewOverride;
  await writeJson(receiptPath, current);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const opts = parseReviewCliArgs(process.argv.slice(2));
    const result = await review(opts.inputFile, opts);
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ok ? 0 : 1;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
