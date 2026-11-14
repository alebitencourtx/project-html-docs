import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const hash = v => createHash('sha256').update(v).digest('hex');

function git(cwd, ...args) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
  } catch {
    return null;
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

export async function verify(manifestFile, receiptFile) {
  const manifestPath = path.resolve(manifestFile);
  const receiptPath = path.resolve(receiptFile);
  const manifest = await readJson(manifestPath);
  const receipt = await readJson(receiptPath);
  const base = path.dirname(manifestPath);
  const repo = path.resolve(base, manifest.repoRoot || '.');
  const declared = new Map((manifest.sources || []).map(s => [s.id, s]));
  const recorded = new Map((receipt.sources || []).map(s => [s.id, s]));
  const results = [];

  for (const [id, source] of declared) {
    const file = path.resolve(repo, source.path);
    const rel = path.relative(repo, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      results.push({id, path: source.path, status: 'outside-repository'});
      continue;
    }
    let raw;
    try {
      raw = await fs.readFile(file);
    } catch {
      results.push({id, path: source.path, status: 'missing'});
      continue;
    }
    const expected = recorded.get(id);
    if (!expected) results.push({id, path: source.path, status: 'not-in-receipt'});
    else if (expected.path !== source.path) results.push({id, path: source.path, status: 'path-changed', recordedPath: expected.path});
    else if (expected.sha256 !== hash(raw)) results.push({id, path: source.path, status: 'changed'});
    else results.push({id, path: source.path, status: 'ok'});
  }

  for (const [id, source] of recorded) {
    if (!declared.has(id)) results.push({id, path: source.path, status: 'unexpected'});
  }

  const currentRevision = git(repo, 'rev-parse', 'HEAD');
  const dirty = git(repo, 'status', '--short');
  const revisionMatches = !receipt.revision || !currentRevision ? null : receipt.revision === currentRevision;
  const bad = results.filter(r => r.status !== 'ok');
  const ok = bad.length === 0 && revisionMatches !== false;

  return {
    ok,
    document: manifest.title,
    revision: {
      documented: receipt.revision || null,
      current: currentRevision,
      matches: revisionMatches,
    },
    workingTreeDirty: Boolean(dirty),
    sources: results,
    summary: {
      total: results.length,
      ok: results.filter(r => r.status === 'ok').length,
      changed: results.filter(r => r.status === 'changed').length,
      missing: results.filter(r => r.status === 'missing' || r.status === 'not-in-receipt').length,
      unexpected: results.filter(r => r.status === 'unexpected' || r.status === 'path-changed' || r.status === 'outside-repository').length,
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const strict = process.argv.includes('--strict');
  if (args.length < 2) {
    console.error('Usage: node scripts/verify.mjs <document.json> <receipt.json> [--strict]');
    process.exitCode = 2;
  } else {
    try {
      const result = await verify(args[0], args[1]);
      console.log(JSON.stringify(result, null, 2));
      if (strict && !result.ok) process.exitCode = 1;
    } catch (e) {
      console.error(e.stack || e.message);
      process.exitCode = 2;
    }
  }
}

