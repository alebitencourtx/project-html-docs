import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import Ajv from 'ajv';
import { TRANSLATIONS, VIDEO_CHAPTERS, RECIPES, resolveLang, getCopy } from '../docs/landing-i18n.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const docsDir = path.resolve(rootDir, 'docs');

test('PT and EN translation dictionaries share identical non-empty keys', () => {
  const ptKeys = Object.keys(TRANSLATIONS.pt).sort();
  const enKeys = Object.keys(TRANSLATIONS.en).sort();
  assert.deepEqual(ptKeys, enKeys);
  for (const key of ptKeys) {
    assert.ok(TRANSLATIONS.pt[key].trim().length > 0, `Empty PT key: ${key}`);
    assert.ok(TRANSLATIONS.en[key].trim().length > 0, `Empty EN key: ${key}`);
  }
});

test('resolveLang and getCopy normalize language tags safely', () => {
  assert.equal(resolveLang('en-US'), 'en');
  assert.equal(resolveLang('pt-BR'), 'pt');
  assert.equal(resolveLang('fr'), 'pt');
  assert.equal(resolveLang(''), 'pt');
  assert.equal(getCopy('en').navCta, TRANSLATIONS.en.navCta);
  assert.equal(getCopy('pt').navCta, TRANSLATIONS.pt.navCta);
});

test('docs/index.html references valid i18n keys, local assets, and chapter buttons', () => {
  const html = fs.readFileSync(path.join(docsDir, 'index.html'), 'utf8');
  const $ = cheerio.load(html);

  const i18nKeys = $('[data-i18n]')
    .map((_, el) => $(el).attr('data-i18n'))
    .get();
  assert.ok(i18nKeys.length > 30, 'Expected full coverage of data-i18n bindings');

  for (const key of i18nKeys) {
    assert.ok(key in TRANSLATIONS.pt, `Missing PT translation for ${key}`);
    assert.ok(key in TRANSLATIONS.en, `Missing EN translation for ${key}`);
  }

  const expectedFiles = [
    'landing.css',
    'landing.js',
    'landing-i18n.mjs',
    'demo.mp4',
    'demo-poster.png',
    'documentacao.html',
    'documentacao-resumida.html',
  ];
  for (const file of expectedFiles) {
    const filePath = path.join(docsDir, file);
    assert.ok(fs.existsSync(filePath), `Missing expected GitHub Pages asset: ${file}`);
  }

  const chapterIds = $('[data-chapter]')
    .map((_, el) => $(el).attr('data-chapter'))
    .get();
  assert.deepEqual(
    chapterIds,
    VIDEO_CHAPTERS.map((c) => c.id),
  );
  for (const chap of VIDEO_CHAPTERS) {
    assert.ok(chap.time >= 0 && chap.time < 29, `Invalid video chapter timestamp for ${chap.id}`);
  }
});

test('landing RECIPES.manifest strictly validates against document.schema.json and RECIPES.cli uses valid verify flags', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(rootDir, 'schemas/document.schema.json'), 'utf8'));
  const validate = new Ajv({ allErrors: true }).compile(schema);
  const manifestObj = JSON.parse(RECIPES.manifest);
  const valid = validate(manifestObj);
  assert.equal(valid, true, `Schema errors: ${JSON.stringify(validate.errors)}`);

  assert.match(RECIPES.cli, /npm ci --ignore-scripts/);
  assert.match(RECIPES.cli, /--impact\s+--dossier\s+docs\/inventory\.json\s+--plan\s+docs\/update-plan\.md/);
});

