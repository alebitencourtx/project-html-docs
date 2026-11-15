import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import Ajv from 'ajv';
import { TRANSLATIONS, VIDEO_CHAPTERS, RECIPES, resolveLang, getCopy } from '../docs/landing-i18n.mjs';
import { build } from '../scripts/build.mjs';

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

test('docs/index.html references valid i18n keys, ARIA labels/tabs, local assets, and chapter buttons', () => {
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

  const ariaKeys = $('[data-i18n-aria]')
    .map((_, el) => $(el).attr('data-i18n-aria'))
    .get();
  assert.ok(ariaKeys.length >= 6, 'Expected data-i18n-aria bindings on landmarks and tablists');
  for (const key of ariaKeys) {
    assert.ok(key in TRANSLATIONS.pt, `Missing PT aria translation for ${key}`);
    assert.ok(key in TRANSLATIONS.en, `Missing EN aria translation for ${key}`);
  }

  // M05 WAI-ARIA tablist / tabpanel contract
  const tabs = $('.recipe-tab[role="tab"]');
  assert.equal(tabs.length, 3);
  tabs.each((_, el) => {
    assert.equal($(el).attr('aria-controls'), 'panel-recipe');
  });
  const panel = $('#panel-recipe');
  assert.equal(panel.attr('role'), 'tabpanel');
  assert.equal(panel.attr('aria-labelledby'), 'tab-cli');

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

test('F13 landing RECIPES.manifest strictly validates against document.schema.json and builds successfully', async () => {
  const schema = JSON.parse(fs.readFileSync(path.join(rootDir, 'schemas/document.schema.json'), 'utf8'));
  const validate = new Ajv({ allErrors: true }).compile(schema);
  const manifestObj = JSON.parse(RECIPES.manifest);
  const valid = validate(manifestObj);
  assert.equal(valid, true, `Schema errors: ${JSON.stringify(validate.errors)}`);

  assert.match(RECIPES.cli, /npm ci --ignore-scripts/);
  assert.match(RECIPES.cli, /--impact\s+--dossier\s+docs\/inventory\.json\s+--plan\s+docs\/update-plan\.md/);

  // Compile RECIPES.manifest inside a sandbox repo layout matching the recipe's paths (docs/document.json + repoRoot: "..")
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'recipe-build-'));
  try {
    await fsp.mkdir(path.join(tmp, 'scripts'), { recursive: true });
    await fsp.mkdir(path.join(tmp, 'docs'), { recursive: true });
    for (const s of manifestObj.sources) {
      await fsp.writeFile(path.join(tmp, s.path), `// fixture for ${s.id}\n`);
    }
    const md = manifestObj.sections.map((sec) => `## ${sec.title}\n\nConteúdo da seção ${sec.title}.\n`).join('\n');
    await fsp.writeFile(path.join(tmp, 'docs/document.json'), RECIPES.manifest);
    await fsp.writeFile(path.join(tmp, 'docs', manifestObj.content), md);
    const outHtml = path.join(tmp, 'docs/documentacao.html');
    const receipt = await build(path.join(tmp, 'docs/document.json'), outHtml, { force: true });
    assert.equal(receipt.passed, true);
    assert.equal(receipt.contentSections, manifestObj.sections.length);
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true });
  }
});

test('M06 metadata consistency: LICENSE exists, README local links resolve, and versions match across package, lockfile, landing and README', () => {
  const licensePath = path.join(rootDir, 'LICENSE');
  assert.ok(fs.existsSync(licensePath), 'LICENSE file must exist at repository root');
  assert.match(fs.readFileSync(licensePath, 'utf8'), /MIT License/);

  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8'));
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages?.['']?.version, pkg.version);

  const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
  assert.ok(readme.includes(`version-${pkg.version}-`), 'README version badge must match package.json version');
  for (const [, target] of readme.matchAll(/\[[^\]]+\]\(([^)#]+)\)/g)) {
    if (/^(https?:|mailto:)/i.test(target)) continue;
    assert.ok(fs.existsSync(path.join(rootDir, target)), `Broken README local link target: ${target}`);
  }

  assert.ok(TRANSLATIONS.pt.heroMeta.includes(`v${pkg.version}`));
  assert.ok(TRANSLATIONS.en.heroMeta.includes(`v${pkg.version}`));
  assert.ok(TRANSLATIONS.pt.footerLicense.includes(`v${pkg.version}`));
  assert.ok(TRANSLATIONS.en.footerLicense.includes(`v${pkg.version}`));
});


