import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { browserCandidates, findBrowser, launchBrowser } from '../scripts/review/browser.mjs';
import { pageChecks } from '../scripts/review/page-checks.mjs';
import { build } from '../scripts/build.mjs';
import { review } from '../scripts/review.mjs';
import { receiptPathFor } from '../scripts/lib/paths.mjs';

test('browser discovery respects explicit/env paths and OS installation candidates', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'phd-browser-path-'));
  try {
    const exe = path.join(dir, 'browser'); await fs.writeFile(exe, 'fake executable for discovery');
    assert.equal(findBrowser({ explicit: exe, env: {} }).path, exe);
    assert.equal(findBrowser({ env: { PHD_BROWSER: exe } }).source, 'PHD_BROWSER');
    assert.equal(findBrowser({ explicit: path.join(dir, 'missing'), env: { PHD_BROWSER: exe } }).ok, false);
    assert.equal(findBrowser({ explicit: dir }).ok, false);
    assert.ok(browserCandidates('darwin', {}).some(p => p.includes('Google Chrome.app')));
    assert.ok(browserCandidates('win32', { PROGRAMFILES: dir }).includes(path.join(dir, 'Google/Chrome/Application/chrome.exe')));
    assert.ok(browserCandidates('linux', { PATH: '/usr/bin:/snap/bin' }).includes(path.join('/snap/bin', 'chromium')));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

const browser = findBrowser();
test('CDP review captures real PNGs, validates responsive long tokens, and resets previous approval', { skip: !browser.ok && 'Chrome/Edge/Chromium unavailable', timeout: 90000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'phd-review-test-'));
  try {
    const html = path.join(dir, 'manual.html');
    const receiptPath = receiptPathFor(html);
    const receipt = await build(path.resolve('tests/fixtures/long-token/document.json'), html);
    assert.ok(receipt.warnings.some(w => w.includes('18 characters')));
    receipt.browserReviewed = true; receipt.browserReviewedAt = 'old'; receipt.reviewOverride = { reason: 'old override' };
    await fs.writeFile(receiptPath, JSON.stringify(receipt));
    const report = await review(html, { viewports: [1440, 1024, 390], browser: browser.path });
    assert.equal(report.ok, true, JSON.stringify({ errors: report.errors, failures: report.interactionFailures }));
    assert.equal(report.interactions.find(i => i.name === 'table-filter').skipped, false);
    assert.equal(report.interactions.find(i => i.name === 'mobile-drawer' && i.viewport === 390).skipped, false);
    for (const tile of report.tiles) {
      const png = await fs.readFile(path.join(report.outDir, tile.file));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), tile.width);
    }
    const updated = JSON.parse(await fs.readFile(receiptPath));
    assert.equal(updated.browserReviewed, false);
    assert.equal(updated.browserReviewedAt, undefined);
    assert.equal(updated.reviewOverride, undefined);
    assert.equal(updated.visualReview.htmlSha256, receipt.htmlSha256);
    assert.ok((await fs.readFile(report.rubricPath, 'utf8')).includes('- [ ]'));
    const rerun = await review(receiptPath, { browser: browser.path, mode: 'all' });
    assert.notEqual(rerun.runId, report.runId);
    assert.deepEqual(rerun.viewports, [1440]);
    assert.ok(rerun.tiles.some(t => t.id === '1440-azul'));
    assert.ok(rerun.tiles.some(t => t.id.startsWith('1440-section-')));
    await fs.appendFile(html, '<!-- changed -->');
    await assert.rejects(review(html, { browser: browser.path }), /does not match/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('CDP detects injected clipping, orphan grids, SVG overlap, literal backticks and runtime errors', { skip: !browser.ok && 'Chrome/Edge/Chromium unavailable', timeout: 45000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'phd-review-defects-'));
  let session;
  try {
    const file = path.join(dir, 'defects.html');
    await fs.writeFile(file, '<!DOCTYPE html><main style="width:1600px"><section class="doc-section" id="bad"><div class="cards" style="display:grid;grid-template-columns:100px 100px 100px;width:300px"><div class="card" style="width:80px;overflow:hidden">AnIdentifierThatDefinitelyOverflowsItsSmallContainer</div><div class="card">B</div><div class="card">C</div><div class="card">D</div></div><figure><svg width="200" height="100" viewBox="0 0 200 100"><text x="10" y="30">Text `literal`</text><text x="12" y="30">Overlap</text><text x="190" y="70">Escape</text></svg></figure></section></main><script>console.error("injected error"); setTimeout(() => {throw Error("injected exception")}, 0)</script>');
    session = await launchBrowser(browser.path); await session.viewport(1024); await session.navigate(file);
    const issues = await session.evaluate(pageChecks);
    for (const type of ['text-escape', 'page-overflow', 'grid-orphan', 'svg-text-overlap', 'svg-text-escape', 'literal-backtick']) assert.ok(issues.some(i => i.type === type), `${type}: ${JSON.stringify(issues)}`);
    assert.ok(session.errors.some(e => e.includes('injected error')));
    assert.ok(session.errors.some(e => e.includes('injected exception')));
  } finally { await session?.close(); await fs.rm(dir, { recursive: true, force: true }); }
});

test('CLI runs through a directory symlink/junction from an external cwd', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'phd-cli-link-'));
  try {
    const link = path.join(dir, 'skill');
    await fs.symlink(path.resolve('.'), link, process.platform === 'win32' ? 'junction' : 'dir');
    const { stdout } = await promisify(execFile)(process.execPath, [path.join(link, 'scripts/cli.mjs'), '--version'], { cwd: os.tmpdir(), windowsHide: true });
    assert.equal(stdout.trim(), JSON.parse(await fs.readFile('package.json')).version);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
