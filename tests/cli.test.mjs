import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  checkDependencies,
  checkNodeVersion,
  resolvePythonCommand,
  runCli,
} from '../scripts/cli.mjs';
import { computeRendererHash } from '../scripts/renderer-hash.mjs';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(ROOT, 'scripts', 'cli.mjs');

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'phd-cli-test-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function execCli(args, { cwd = os.tmpdir() } = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI_PATH, ...args], {
      cwd,
      encoding: 'utf8',
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return {
      code: typeof err.code === 'number' ? err.code : 1,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
    };
  }
}

test('cli.mjs exposes --help, --version, doctor and rejects unknown commands with exit code 2', async () => {
  const helpRes = await execCli(['--help']);
  assert.equal(helpRes.code, 0);
  assert.match(helpRes.stdout, /inspect <repo>/);
  assert.match(helpRes.stdout, /build <document\.json>/);
  assert.match(helpRes.stdout, /verify <document\.json>/);

  const verRes = await execCli(['--version']);
  assert.equal(verRes.code, 0);
  const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(verRes.stdout.trim(), pkg.version);

  const docRes = await execCli(['doctor']);
  assert.equal(docRes.code, 0);
  const docJson = JSON.parse(docRes.stdout);
  assert.equal(docJson.ok, true);
  assert.equal(docJson.version, pkg.version);
  assert.equal(docJson.node.ok, true);
  assert.equal(docJson.python.ok, true);
  assert.equal(docJson.dependencies.ok, true);

  const unknownRes = await execCli(['nonexistent-cmd']);
  assert.equal(unknownRes.code, 2);
  assert.match(unknownRes.stderr, /Unknown command/);
  assert.equal(checkNodeVersion('20.11.0').ok, false);
  assert.equal(checkNodeVersion('22.0.0').ok, true);
});

test('cli.mjs checkDependencies reports clear install guidance when node_modules is missing', () => withTempDir(async dir => {
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({
    name: 'fixture-skill',
    version: '1.0.0',
    dependencies: { ajv: '8.20.0', marked: '18.2.0' },
  }));
  const depStatus = await checkDependencies(dir);
  assert.equal(depStatus.ok, false);
  assert.deepEqual(depStatus.missing, ['ajv', 'marked']);
  assert.match(depStatus.installCommand, /npm ci --ignore-scripts --prefix/);

  const logs = [];
  const errs = [];
  const exitCode = await runCli(['build', path.join(dir, 'doc.json'), '--out', path.join(dir, 'out.html')], {
    skillRoot: dir,
    io: { log: m => logs.push(m), error: m => errs.push(m) },
  });
  assert.equal(exitCode, 2);
  assert.match(errs.join('\n'), /Missing skill dependencies/);
  assert.match(errs.join('\n'), /npm ci --ignore-scripts/);
}));

test('cli.mjs end-to-end inspect, build, and verify work from any external working directory', () => withTempDir(async dir => {
  const repoDir = path.join(dir, 'sample-repo');
  const workDir = path.join(dir, 'work-docs');
  await fs.mkdir(path.join(repoDir, 'src'), { recursive: true });
  await fs.mkdir(workDir, { recursive: true });

  await fs.writeFile(path.join(repoDir, 'src', 'app.py'), 'def run_job(limit: int = 10):\n    return limit * 2\n');
  await fs.writeFile(path.join(workDir, 'content.md'), '## Overview\n\nRuns `run_job` cleanly.\n');
  await fs.writeFile(path.join(workDir, 'document.json'), JSON.stringify({
    title: 'Sample Repo Manual',
    subtitle: 'CLI end-to-end test',
    version: '1.0.0',
    updated: '2026-11-15',
    language: 'en',
    repoRoot: '../sample-repo',
    content: 'content.md',
    sections: [{ id: 'overview', title: 'Overview', audience: 'all', sources: ['app'] }],
    sources: [{ id: 'app', path: 'src/app.py', description: 'Main job module' }],
  }, null, 2));

  const invPath = path.join(workDir, 'inventory.json');
  const planPath = path.join(workDir, 'reading-plan.md');
  const htmlPath = path.join(workDir, 'manual.html');
  const receiptPath = path.join(workDir, 'manual.validation.json');
  const updatePlanPath = path.join(workDir, 'update-plan.md');

  // 1. Inspect from external cwd (os.tmpdir)
  const inspectRes = await execCli([
    'inspect', repoDir, '--out', invPath, '--plan', planPath,
  ], { cwd: os.tmpdir() });
  assert.equal(inspectRes.code, 0, inspectRes.stderr);
  const inspectJson = JSON.parse(inspectRes.stdout);
  assert.equal(inspectJson.ok, true);
  assert.equal(inspectJson.outPath, invPath);
  assert.equal(inspectJson.planPath, planPath);
  assert.equal(inspectJson.files, 1);

  // 2. Build from external cwd
  const buildRes = await execCli([
    'build', path.join(workDir, 'document.json'), '--out', htmlPath,
  ], { cwd: os.tmpdir() });
  assert.equal(buildRes.code, 0, buildRes.stderr);
  const buildJson = JSON.parse(buildRes.stdout);
  assert.equal(buildJson.passed, true);
  assert.equal(buildJson.htmlPath, htmlPath);
  assert.equal(buildJson.receiptPath, receiptPath);

  // Refusing overwrite without --force returns exit code 1
  const noForceRes = await execCli([
    'build', path.join(workDir, 'document.json'), '--out', htmlPath,
  ], { cwd: os.tmpdir() });
  assert.equal(noForceRes.code, 1);

  // 3. Strict verify passes (exit 0)
  const verifyRes = await execCli([
    'verify', path.join(workDir, 'document.json'), receiptPath, '--strict', '--mark-reviewed', '--accept-issues', 'Test exercises source verification without browser review',
  ], { cwd: os.tmpdir() });
  assert.equal(verifyRes.code, 0, verifyRes.stderr);
  const verifyJson = JSON.parse(verifyRes.stdout);
  assert.equal(verifyJson.ok, true);
  assert.equal(verifyJson.browserReviewed, true);
  assert.equal(verifyJson.htmlPath, htmlPath);

  // 4. Mutate source and verify --strict detects drift (exit 1) and writes update-plan.md
  await fs.writeFile(path.join(repoDir, 'src', 'app.py'), 'def run_job(limit: int = 20):\n    return limit * 3\n');
  const driftRes = await execCli([
    'verify', path.join(workDir, 'document.json'), receiptPath,
    '--strict', '--impact', '--dossier', invPath, '--plan', updatePlanPath,
  ], { cwd: os.tmpdir() });
  assert.equal(driftRes.code, 1);
  const driftJson = JSON.parse(driftRes.stdout);
  assert.equal(driftJson.ok, false);
  assert.equal(driftJson.planPath, updatePlanPath);
  const planText = await fs.readFile(updatePlanPath, 'utf8');
  assert.match(planText, /Overview/);

  // 5. Missing input returns exit code 2
  const missingRes = await execCli(['build', path.join(workDir, 'missing.json'), '--out', htmlPath]);
  assert.equal(missingRes.code, 2);
}));

test('slim release ZIP packager produces deterministic skill bundle with identical rendererSha256', () => withTempDir(async dir => {
  const py = resolvePythonCommand();
  assert.equal(py.ok, true, py.error);

  const zipPath = path.join(dir, 'project-html-docs-slim.zip');
  const packager = path.join(ROOT, '.github', 'scripts', 'package_skill.py');
  const { stdout } = await execFileAsync(py.cmd, [...py.baseArgs, packager, '--out', zipPath], { encoding: 'utf8' });
  const packResult = JSON.parse(stdout);
  assert.equal(packResult.ok, true);
  const normActual = await fs.realpath(packResult.archivePath);
  const normExpected = await fs.realpath(zipPath);
  assert.equal(normActual.toLowerCase(), normExpected.toLowerCase());
  const firstArchive = await fs.readFile(zipPath);
  await execFileAsync(py.cmd, [...py.baseArgs, packager, '--out', zipPath], { encoding: 'utf8' });
  assert.deepEqual(await fs.readFile(zipPath), firstArchive, 'Packaging unchanged inputs must be byte-reproducible');

  const extractDir = path.join(dir, 'extracted-skill');
  await execFileAsync(py.cmd, [
    ...py.baseArgs,
    '-c',
    'import sys, zipfile; zf = zipfile.ZipFile(sys.argv[1]); zf.extractall(sys.argv[2]); print("\\n".join(zf.namelist()))',
    zipPath,
    extractDir,
  ], { encoding: 'utf8' }).then(({ stdout: listOut }) => {
    const entries = listOut.trim().split(/\r?\n/);
    assert.ok(entries.includes('SKILL.md'));
    assert.ok(entries.includes('agents/openai.yaml'));
    assert.ok(entries.includes('scripts/cli.mjs'));
    assert.ok(entries.includes('assets/document.css'));
    assert.ok(entries.includes('schemas/document.schema.json'));
    assert.ok(entries.includes('schemas/diagram.schema.json'));
    assert.ok(entries.includes('references/authoring.md'));
    assert.ok(entries.includes('references/diagrams.md'));
    assert.ok(entries.includes('examples/minimal/document.json'));
    assert.ok(entries.includes('package.json'));
    assert.ok(entries.includes('package-lock.json'));
    assert.ok(entries.includes('LICENSE'));

    assert.ok(!entries.some(e => e.startsWith('docs/')));
    assert.ok(!entries.some(e => e.startsWith('tests/')));
    assert.ok(!entries.some(e => e.startsWith('node_modules/')));
    assert.ok(!entries.some(e => e.startsWith('examples/showcase/')));
    assert.ok(!entries.some(e => e.includes('__pycache__') || e.endsWith('.pyc')));
    assert.ok(!entries.includes('examples/minimal/documentacao.html'));
  });

  // Renderer SHA-256 inside the extracted ZIP must be 100% identical to repo root
  const [repoHash, zipHash] = await Promise.all([
    computeRendererHash(ROOT),
    computeRendererHash(extractDir),
  ]);
  assert.equal(zipHash, repoHash);

  // Extracted ZIP works via cli.mjs when node_modules is linked cleanly
  await fs.symlink(path.join(ROOT, 'node_modules'), path.join(extractDir, 'node_modules'), 'junction');
  const { stdout: doctorOut } = await execFileAsync(process.execPath, [path.join(extractDir, 'scripts', 'cli.mjs'), 'doctor'], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(JSON.parse(doctorOut).ok, true);
  const installedCli = path.join(extractDir, 'scripts', 'cli.mjs');
  const installedManifest = path.join(extractDir, 'examples', 'minimal', 'document.json');
  const htmlOut = path.join(dir, 'installed-manual.html');
  const { stdout: built } = await execFileAsync(process.execPath, [installedCli, 'build', installedManifest, '--out', htmlOut], {
    cwd: os.tmpdir(), encoding: 'utf8',
  });
  assert.equal(JSON.parse(built).passed, true);
  const { stdout: verified } = await execFileAsync(process.execPath, [installedCli, 'verify', installedManifest, htmlOut.replace(/\.html$/, '.validation.json'), '--strict'], {
    cwd: os.tmpdir(), encoding: 'utf8',
  });
  assert.equal(JSON.parse(verified).ok, true, 'The extracted runtime must build and verify without development files');
}));
