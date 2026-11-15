import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const RENDERER_FILES = [
  'assets/document.css',
  'assets/document.js',
  'scripts/build.mjs',
  'scripts/diagrams.mjs',
  'scripts/validate.mjs',
  'scripts/renderer-hash.mjs',
];

export async function computeRendererHash(skillRoot = ROOT) {
  const h = createHash('sha256');
  for (const rel of RENDERER_FILES) {
    const raw = await fs.readFile(path.join(skillRoot, rel));
    h.update(`${rel}\n${raw.length}\n`);
    h.update(raw);
  }
  return h.digest('hex');
}

export async function getSkillVersion(skillRoot = ROOT) {
  const pkg = JSON.parse(await fs.readFile(path.join(skillRoot, 'package.json'), 'utf8'));
  return pkg.version || null;
}
