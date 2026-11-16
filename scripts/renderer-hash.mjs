import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonicalizeTextBuffer } from './lib/hash.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const RENDERER_FILES = [
  'assets/document.css',
  'assets/document.js',
  'scripts/build.mjs',
  'scripts/diagrams.mjs',
  'scripts/validate.mjs',
  'scripts/renderer-hash.mjs',
  'scripts/lib/urls.mjs',
  'scripts/lib/hash.mjs',
  'scripts/lib/i18n.mjs',
  'scripts/lib/html-shell.mjs',
  'scripts/lib/paths.mjs',
  'schemas/document.schema.json',
  'schemas/diagram.schema.json',
  'package.json',
  'package-lock.json',
];

export async function computeRendererHash(skillRoot = ROOT) {
  const h = createHash('sha256');
  for (const rel of RENDERER_FILES) {
    const raw = await fs.readFile(path.join(skillRoot, rel));
    const canonical = canonicalizeTextBuffer(raw, rel);
    h.update(`${rel}\n${canonical.length}\n`);
    h.update(canonical);
  }
  return h.digest('hex');
}

export async function getSkillVersion(skillRoot = ROOT) {
  const pkg = JSON.parse(await fs.readFile(path.join(skillRoot, 'package.json'), 'utf8'));
  return pkg.version || null;
}
