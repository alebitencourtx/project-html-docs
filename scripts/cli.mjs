import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);

export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_NODE_MAJOR = 22;
const MIN_PYTHON = [3, 10];

export function checkNodeVersion(versionString = process.versions.node) {
  const major = Number(String(versionString || '0').split('.')[0]);
  return {
    ok: Number.isFinite(major) && major >= MIN_NODE_MAJOR,
    version: versionString,
    required: `>=${MIN_NODE_MAJOR}`,
  };
}

export async function readSkillPackage(skillRoot = SKILL_ROOT) {
  const raw = await fs.readFile(path.join(skillRoot, 'package.json'), 'utf8');
  return JSON.parse(raw);
}

export async function checkDependencies(skillRoot = SKILL_ROOT, pkg = null) {
  const manifest = pkg || await readSkillPackage(skillRoot);
  const deps = Object.keys(manifest.dependencies || {});
  const missing = [];
  for (const dep of deps) {
    const depPkg = path.join(skillRoot, 'node_modules', ...dep.split('/'), 'package.json');
    try {
      await fs.access(depPkg);
    } catch {
      missing.push(dep);
    }
  }
  return {
    ok: missing.length === 0,
    dependencies: deps,
    missing,
    installCommand: `npm ci --ignore-scripts --prefix "${skillRoot}"`,
  };
}

export function resolvePythonCommand() {
  const candidates = process.platform === 'win32'
    ? [
        { cmd: 'python', baseArgs: [] },
        { cmd: 'py', baseArgs: ['-3'] },
        { cmd: 'python3', baseArgs: [] },
      ]
    : [
        { cmd: 'python3', baseArgs: [] },
        { cmd: 'python', baseArgs: [] },
      ];

  const probeErrors = [];
  for (const candidate of candidates) {
    const res = spawnSync(
      candidate.cmd,
      [...candidate.baseArgs, '-c', 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}.{sys.version_info[2]}")'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000, windowsHide: true },
    );
    if (res.status === 0 && res.stdout) {
      const verText = res.stdout.trim();
      const parts = verText.split('.').map(Number);
      if (parts.length >= 2 && (parts[0] > MIN_PYTHON[0] || (parts[0] === MIN_PYTHON[0] && parts[1] >= MIN_PYTHON[1]))) {
        return { ok: true, cmd: candidate.cmd, baseArgs: candidate.baseArgs, version: verText };
      }
      probeErrors.push(`${candidate.cmd} found (${verText}), requires >= ${MIN_PYTHON.join('.')}`);
    }
  }

  return {
    ok: false,
    cmd: null,
    baseArgs: [],
    version: null,
    error: probeErrors[0] || `Python >= ${MIN_PYTHON.join('.')} executable (python3/python) not found in PATH`,
  };
}

export function formatUsage(skillRoot = SKILL_ROOT) {
  return [
    'project-html-docs CLI (unified skill entrypoint)',
    '',
    'Usage:',
    `  node "${path.join(skillRoot, 'scripts', 'cli.mjs')}" <command> [options]`,
    '',
    'Commands:',
    '  inspect <repo> --out <inventory.json> [--plan <reading-plan.md>] [--include <csv>] [--exclude <csv>]',
    '      Run static repository inspection (zero code execution).',
    '  build <document.json> --out <output.html> [--mode full|summary] [--force]',
    '      Validate manifest/Markdown/diagrams and build offline HTML + validation receipt.',
    '  verify <document.json> <receipt.json> [--strict] [--impact] [--dossier <inventory.json>] [--plan <update-plan.md>] [--html <output.html>] [--mark-reviewed]',
    '      Verify source/artifact/renderer SHA-256 hashes and compute incremental impact.',
    '  doctor',
    '      Verify Node.js (>=22), Python (>=3.10), and skill dependencies.',
    '',
    'Options:',
    '  -h, --help      Show this help text',
    '  -v, --version   Show skill version',
  ].join('\n');
}

function parseInspectCliArgs(args) {
  let repository = null;
  let outFile = null;
  let planFile = null;
  let include = '';
  let exclude = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--out' || arg === '--plan' || arg === '--include' || arg === '--exclude') {
      const val = args[i + 1];
      if (!val || val.startsWith('--')) {
        throw new CliUsageError(`Flag ${arg} requires a value`);
      }
      if (arg === '--out') outFile = val;
      else if (arg === '--plan') planFile = val;
      else if (arg === '--include') include = val;
      else exclude = val;
      i++;
    } else if (arg.startsWith('--')) {
      throw new CliUsageError(`Unknown flag: ${arg}`);
    } else if (!repository) {
      repository = arg;
    } else {
      throw new CliUsageError(`Unexpected positional argument: ${arg}`);
    }
  }

  if (!repository || !outFile) {
    throw new CliUsageError(
      'Usage: cli.mjs inspect <repo> --out <inventory.json> [--plan <reading-plan.md>] [--include <csv>] [--exclude <csv>]',
    );
  }

  return { repository, outFile, planFile, include, exclude };
}

export class CliUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CliUsageError';
    this.exitCode = 2;
  }
}

async function assertPathExists(targetPath, label, { expectDir = false } = {}) {
  let stat;
  try {
    stat = await fs.stat(targetPath);
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new CliUsageError(`${label} not found: ${targetPath}`);
    }
    throw e;
  }
  if (expectDir && !stat.isDirectory()) {
    throw new CliUsageError(`${label} is not a directory: ${targetPath}`);
  }
  if (!expectDir && stat.isDirectory()) {
    throw new CliUsageError(`${label} must be a file, got directory: ${targetPath}`);
  }
}

async function runInspect(args, skillRoot, io) {
  const opts = parseInspectCliArgs(args);
  const py = resolvePythonCommand();
  if (!py.ok) {
    throw new CliUsageError(py.error);
  }

  const repoPath = path.resolve(opts.repository);
  await assertPathExists(repoPath, 'Repository', { expectDir: true });

  const outPath = path.resolve(opts.outFile);
  const planPath = opts.planFile ? path.resolve(opts.planFile) : null;
  const inspectorEntry = path.join(skillRoot, 'scripts', 'inspect_repo.py');

  const pyArgs = [...py.baseArgs, inspectorEntry, repoPath, '--out', outPath];
  if (planPath) pyArgs.push('--plan', planPath);
  if (opts.include) pyArgs.push('--include', opts.include);
  if (opts.exclude) pyArgs.push('--exclude', opts.exclude);

  try {
    await execFileAsync(py.cmd, pyArgs, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, windowsHide: true });
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || '').trim();
    throw new Error(`inspect failed: ${detail}`);
  }

  const inventory = JSON.parse(await fs.readFile(outPath, 'utf8'));
  const summary = {
    ok: true,
    command: 'inspect',
    repository: repoPath,
    outPath,
    planPath,
    files: Array.isArray(inventory.files) ? inventory.files.length : 0,
    tier: inventory.scaleProfile?.tier || null,
    totalCodeLines: inventory.scaleProfile?.totalCodeLines ?? null,
    revision: inventory.revision || null,
  };
  io.log(JSON.stringify(summary, null, 2));
  return 0;
}

async function runBuild(args, skillRoot, io) {
  const deps = await checkDependencies(skillRoot);
  if (!deps.ok) {
    throw new CliUsageError(
      `Missing skill dependencies (${deps.missing.join(', ')}). Run once: ${deps.installCommand}`,
    );
  }

  const { build, parseBuildCliArgs } = await import(pathToFileURL(path.join(skillRoot, 'scripts', 'build.mjs')).href);
  let parsed;
  try {
    parsed = parseBuildCliArgs(args);
  } catch (e) {
    throw new CliUsageError(e.message);
  }

  const manifestPath = path.resolve(parsed.manifestFile);
  await assertPathExists(manifestPath, 'Manifest');
  if (!parsed.outFile) {
    throw new CliUsageError('Flag --out <output.html> is required');
  }

  const htmlPath = path.resolve(parsed.outFile);
  const receiptPath = htmlPath.replace(/\.html$/i, '') + '.validation.json';
  const receipt = await build(manifestPath, htmlPath, { force: parsed.force, mode: parsed.mode });

  io.log(JSON.stringify({
    ok: Boolean(receipt.passed),
    command: 'build',
    manifestPath,
    htmlPath,
    receiptPath,
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
  return receipt.passed ? 0 : 1;
}

async function runVerify(args, skillRoot, io) {
  const {
    parseVerifyCliArgs,
    verify,
    analyzeImpact,
    renderUpdatePlan,
  } = await import(pathToFileURL(path.join(skillRoot, 'scripts', 'verify.mjs')).href);

  let opts;
  try {
    opts = parseVerifyCliArgs(args);
  } catch (e) {
    throw new CliUsageError(e.message);
  }

  const manifestPath = path.resolve(opts.manifestFile);
  const receiptPath = path.resolve(opts.receiptFile);
  await assertPathExists(manifestPath, 'Manifest');
  await assertPathExists(receiptPath, 'Validation receipt');
  if (opts.dossierFile) {
    await assertPathExists(path.resolve(opts.dossierFile), 'Dossier');
  }

  const result = opts.impactMode || opts.dossierFile || opts.planOut
    ? await analyzeImpact(manifestPath, receiptPath, {
        dossierFile: opts.dossierFile,
        strict: opts.strict,
        htmlFile: opts.htmlFile,
      })
    : await verify(manifestPath, receiptPath, {
        strict: opts.strict,
        htmlFile: opts.htmlFile,
      });

  let markFailed = false;
  if (opts.markReviewed) {
    if (!result.ok) {
      io.error('Cannot mark browserReviewed=true because verification failed (resolve source or artifact drift first).');
      markFailed = true;
    } else {
      const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
      receipt.browserReviewed = true;
      receipt.browserReviewedAt = new Date().toISOString();
      await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
      result.browserReviewed = true;
      result.browserReviewedAt = receipt.browserReviewedAt;
    }
  }

  let planPath = null;
  if (opts.planOut) {
    planPath = path.resolve(opts.planOut);
    await fs.mkdir(path.dirname(planPath), { recursive: true });
    await fs.writeFile(planPath, renderUpdatePlan(result), 'utf8');
  }

  const htmlResolved = result.artifacts?.htmlPath
    ? path.resolve(path.dirname(receiptPath), result.artifacts.htmlPath)
    : null;

  io.log(JSON.stringify({
    command: 'verify',
    manifestPath,
    receiptPath,
    htmlPath: htmlResolved,
    ...(planPath ? { planPath } : {}),
    ...result,
  }, null, 2));

  if (markFailed || (opts.strict && !result.ok)) {
    return 1;
  }
  return 0;
}

async function runDoctor(skillRoot, io) {
  const pkg = await readSkillPackage(skillRoot);
  const nodeCheck = checkNodeVersion();
  const depCheck = await checkDependencies(skillRoot, pkg);
  const pyCheck = resolvePythonCommand();
  const coreAssetsOk = [
    'SKILL.md',
    'scripts/build.mjs',
    'scripts/verify.mjs',
    'scripts/inspect_repo.py',
    'assets/document.css',
    'assets/document.js',
    'schemas/document.schema.json',
    'schemas/diagram.schema.json',
  ].every(rel => fsSync.existsSync(path.join(skillRoot, rel)));

  const ok = nodeCheck.ok && depCheck.ok && pyCheck.ok && coreAssetsOk;
  io.log(JSON.stringify({
    ok,
    command: 'doctor',
    skillRoot,
    version: pkg.version,
    coreAssetsOk,
    node: nodeCheck,
    python: pyCheck,
    dependencies: depCheck,
  }, null, 2));
  return ok ? 0 : 2;
}

export async function runCli(argv, { skillRoot = SKILL_ROOT, io = console } = {}) {
  try {
    const [subcommand, ...rest] = argv;
    if (!subcommand || subcommand === '-h' || subcommand === '--help' || subcommand === 'help') {
      io.log(formatUsage(skillRoot));
      return 0;
    }
    if (subcommand === '-v' || subcommand === '--version' || subcommand === 'version') {
      const pkg = await readSkillPackage(skillRoot);
      io.log(pkg.version);
      return 0;
    }

    const nodeCheck = checkNodeVersion();
    if (!nodeCheck.ok && subcommand !== 'doctor') {
      throw new CliUsageError(`Node.js ${nodeCheck.required} required, found ${nodeCheck.version}`);
    }

    if (subcommand === 'doctor') {
      return await runDoctor(skillRoot, io);
    }
    if (subcommand === 'inspect') {
      return await runInspect(rest, skillRoot, io);
    }
    if (subcommand === 'build') {
      return await runBuild(rest, skillRoot, io);
    }
    if (subcommand === 'verify') {
      return await runVerify(rest, skillRoot, io);
    }

    throw new CliUsageError(`Unknown command "${subcommand}". Run with --help to see supported commands.`);
  } catch (err) {
    if (err instanceof CliUsageError) {
      io.error(`Error [usage/env]: ${err.message}`);
      return err.exitCode;
    }
    io.error(`Error: ${err?.message || err}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const code = await runCli(process.argv.slice(2));
  process.exitCode = code;
}
