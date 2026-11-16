import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { renderRubric, parseRubric, evaluateReviewGate } from '../scripts/review/rubric.mjs';
import { build, longTokenWarnings } from '../scripts/build.mjs';
import { verify, markReviewed, parseVerifyCliArgs } from '../scripts/verify.mjs';
import { softBreak, enhanceSectionHtml } from '../scripts/lib/html-shell.mjs';
import { receiptPathFor } from '../scripts/lib/paths.mjs';
import { parseReviewCliArgs, planTiles } from '../scripts/review.mjs';
import { load } from 'cheerio';

const hash = 'a'.repeat(64);
const vr = () => ({ runId: 'run-1', htmlSha256: hash, summary: { errors: 0 }, interactionFailures: [], tiles: [{ id: '1440-hero', file: '1440-hero.png' }] });
const approved = review => renderRubric(review).replace('- [ ]', '- [x]');

test('review gate requires current hash, complete rubric, no defects and no interaction failures', () => {
  const receipt = { htmlSha256: hash, visualReview: vr() };
  const rubricText = approved(receipt.visualReview);
  assert.equal(evaluateReviewGate(receipt, { rubricText }).ok, true);
  assert.equal(parseRubric(rubricText).checked.length, 1);
  for (const text of [null, renderRubric(vr()), rubricText.replace('- [x]', '- [!]'), rubricText.replace('1440-hero', '1440-other'), rubricText.replace(hash, 'b'.repeat(64)), rubricText.replace('run-1', 'run-2'), rubricText + '\n- [x] 1440-hero']) {
    assert.equal(evaluateReviewGate(receipt, { rubricText: text }).ok, false);
  }
  for (const visualReview of [null, { ...vr(), htmlSha256: 'stale' }, { ...vr(), summary: { errors: 1 } }, { ...vr(), interactionFailures: [{ name: 'search' }] }, { ...vr(), tiles: [] }]) {
    assert.equal(evaluateReviewGate({ ...receipt, visualReview }, { rubricText }).ok, false);
  }
  assert.equal(evaluateReviewGate(receipt, { acceptIssues: 'short' }).ok, false);
  assert.equal(evaluateReviewGate(receipt, { acceptIssues: 'Browser unavailable in this environment' }).accepted, true);
});

test('sign-off persists explicit exceptions, refuses drift, and removes old overrides on normal approval', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'phd-gate-'));
  try {
    const manifest = path.resolve('examples/minimal/document.json'), html = path.join(dir, 'doc.html'), receiptFile = receiptPathFor(html);
    await build(manifest, html);
    let result = await verify(manifest, receiptFile, { strict: true });
    assert.equal((await markReviewed(receiptFile, result)).ok, false);
    assert.equal((await markReviewed(receiptFile, result, { acceptIssues: 'Offline environment has no browser' })).ok, true);
    let receipt = JSON.parse(await fs.readFile(receiptFile));
    assert.equal(receipt.reviewOverride.hadVisualReview, false);
    receipt.visualReview = { ...vr(), htmlSha256: receipt.htmlSha256 };
    await fs.writeFile(receiptFile, JSON.stringify(receipt));
    const rubricFile = path.join(dir, 'rubric.md');
    await fs.writeFile(rubricFile, approved(receipt.visualReview));
    assert.equal((await markReviewed(receiptFile, result, { rubricFile })).ok, true);
    receipt = JSON.parse(await fs.readFile(receiptFile));
    assert.equal(receipt.browserReviewed, true); assert.equal(receipt.reviewOverride, undefined);
    await fs.appendFile(html, '<!-- drift -->');
    assert.equal((await markReviewed(receiptFile, result, { acceptIssues: 'Cannot override hash integrity' })).ok, false);
    result = await verify(manifest, receiptFile, { strict: true });
    assert.equal((await markReviewed(receiptFile, result, { rubricFile })).ok, false);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('review/verify argument contracts and economical tile selection', () => {
  assert.deepEqual(parseReviewCliArgs(['doc.html']).viewports, [1440]);
  assert.equal(parseReviewCliArgs(['doc.html']).mode, 'smart');
  for (const args of [['doc.html', '--tiles', 'bad'], ['doc.html', '--viewports', '1440,0'], ['doc.html', '--browser'], ['doc.html', '--unknown']]) assert.throws(() => parseReviewCliArgs(args));
  assert.throws(() => parseVerifyCliArgs(['doc.json', 'receipt.json', '--rubric', 'rubric.md']));
  assert.throws(() => parseVerifyCliArgs(['doc.json', 'receipt.json', '--accept-issues', 'reason']));
  const geometry = { height: 6000, hero: { top: 0, height: 500 }, figures: [{ index: 1, section: 'a', top: 800, height: 300 }], sections: [{ id: 'a', top: 500, height: 4000 }, { id: 'b', top: 4500, height: 500 }] };
  const smart = planTiles(geometry, 1440, [{ section: 'b' }]);
  assert.deepEqual(smart.map(t => t.id), ['1440-hero', '1440-fig01-a', '1440-section-b']);
  assert.equal(planTiles(geometry, 390, [], { primary: false }).length, 1);
  assert.equal(planTiles(geometry, 390, [], { mode: 'all' }).length, 6);
});

test('soft breaks preserve escaped text, protect code blocks/tables and warn about long values', () => {
  const token = 'b_stbr_obk.long_identifier/path:<script>';
  const html = softBreak(token), $ = load(html);
  assert.equal($.root().text(), token); assert.ok($('wbr').length); assert.equal($('script').length, 0);
  const enhanced = enhanceSectionHtml(`<p><code>${token.replace('<script>', '&lt;script&gt;')}</code></p><pre><code>${'x_'.repeat(20)}</code></pre><table><tr><td><code>${'x_'.repeat(20)}</code></td></tr></table>`).html;
  const doc = load(enhanced);
  assert.ok(doc('p code wbr').length); assert.equal(doc('pre wbr, table wbr').length, 0);
  assert.equal(longTokenWarnings({ title: 'Overview', cards: [{ label: 'Delivery', value: token }] }).length, 1);
});
