import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolveCandidateHtmlPath } from './lib/paths.mjs';
import { evaluateReviewGate } from './review/rubric.mjs';
import { randomUUID } from 'node:crypto';
import { computeRendererHash, getSkillVersion } from './renderer-hash.mjs';
import { HASH_ALGORITHM, hashRaw, hashCanonicalText } from './lib/hash.mjs';

function git(cwd, ...args) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function hashByAlgorithm(buf, filePath, useCanonicalText) {
  return useCanonicalText ? hashCanonicalText(buf, filePath) : hashRaw(buf);
}

async function checkFileHash(filePath, expectedSha256, { useCanonicalText = false } = {}) {
  if (!expectedSha256) return null;
  try {
    const raw = await fs.readFile(filePath);
    return hashByAlgorithm(raw, filePath, useCanonicalText) === expectedSha256;
  } catch {
    return false;
  }
}

export async function verify(manifestFile, receiptFile, { strict = false, htmlFile = null } = {}) {
  const manifestPath = path.resolve(manifestFile);
  const receiptPath = path.resolve(receiptFile);
  const manifestRaw = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const receipt = await readJson(receiptPath);
  const base = path.dirname(manifestPath);
  const repo = path.resolve(base, manifest.repoRoot || '.');
  const useCanonicalText = receipt?.hashAlgorithm === HASH_ALGORITHM;

  const isPlainReceiptObj = Boolean(receipt) && typeof receipt === 'object' && !Array.isArray(receipt);
  const declaredList = Array.isArray(manifest.sources) ? manifest.sources : [];
  const recordedList = isPlainReceiptObj && Array.isArray(receipt.sources) ? receipt.sources : [];

  const declared = new Map(declaredList.map(s => [s.id, s]));
  const recorded = new Map(recordedList.map(s => [s.id, s]));
  const results = [];

  for (const [id, source] of declared) {
    const file = path.resolve(repo, source.path);
    const rel = path.relative(repo, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      results.push({ id, path: source.path, status: 'outside-repository' });
      continue;
    }
    let raw;
    try {
      raw = await fs.readFile(file);
    } catch {
      results.push({ id, path: source.path, status: 'missing' });
      continue;
    }
    const expected = recorded.get(id);
    if (!expected) {
      results.push({ id, path: source.path, status: 'not-in-receipt' });
    } else if (expected.path !== source.path) {
      results.push({ id, path: source.path, status: 'path-changed', recordedPath: expected.path });
    } else if (expected.sha256 !== hashByAlgorithm(raw, file, useCanonicalText)) {
      results.push({ id, path: source.path, status: 'changed' });
    } else {
      results.push({ id, path: source.path, status: 'ok' });
    }
  }

  for (const [id, source] of recorded) {
    if (!declared.has(id)) results.push({ id, path: source.path, status: 'unexpected' });
  }

  const bad = results.filter(r => r.status !== 'ok');
  const currentRevision = git(repo, 'rev-parse', 'HEAD');
  const dirty = git(repo, 'status', '--short');
  const revisionMatches = !receipt?.revision || !currentRevision ? null : receipt.revision === currentRevision;
  let sourceDriftBetweenRevisions = null;
  if (revisionMatches === false) {
    const diffNames = git(repo, 'diff', '--name-only', `${receipt.revision}..${currentRevision}`);
    if (diffNames !== null) {
      const changedSet = new Set(
        diffNames.split(/\r?\n/).map(s => s.trim().replace(/\\/g, '/')).filter(Boolean),
      );
      const declaredPaths = [...declared.values()].map(s => s.path.replace(/\\/g, '/'));
      sourceDriftBetweenRevisions = declaredPaths.some(p => changedSet.has(p));
    } else if (bad.length === 0) {
      // In shallow clones (e.g. CI default fetch-depth: 1), git diff across distant revisions
      // cannot resolve the commit object. Since all declared sources match their content hash,
      // no source drift occurred for the documented files.
      sourceDriftBetweenRevisions = false;
    }
  } else if (revisionMatches === true) {
    sourceDriftBetweenRevisions = false;
  }

  const contentPath = manifest.content ? path.resolve(base, manifest.content) : null;
  const htmlPath = resolveCandidateHtmlPath(receiptPath, receipt, htmlFile);

  const manifestMatches = isPlainReceiptObj && receipt.manifestSha256
    ? hashByAlgorithm(Buffer.from(manifestRaw, 'utf8'), manifestPath, useCanonicalText) === receipt.manifestSha256
    : null;
  const contentMatches = contentPath
    ? await checkFileHash(contentPath, isPlainReceiptObj ? receipt.inputSha256 : null, { useCanonicalText })
    : null;

  let htmlMatches = null;
  if (isPlainReceiptObj && receipt.htmlSha256) {
    if (!htmlPath) {
      htmlMatches = false;
    } else {
      htmlMatches = await checkFileHash(htmlPath, receipt.htmlSha256, { useCanonicalText: false });
    }
  } else if (strict) {
    htmlMatches = false;
  }

  const hasValidSourcesEvidence = Array.isArray(receipt?.sources) &&
    receipt.sources.every(s => s && typeof s.id === 'string' && typeof s.path === 'string' && typeof s.sha256 === 'string');
  const hasCompleteArtifactEvidence = Boolean(
    isPlainReceiptObj &&
    receipt.passed === true &&
    receipt.manifestSha256 &&
    receipt.inputSha256 &&
    receipt.htmlSha256,
  );
  let receiptStatus = 'invalid';
  if (isPlainReceiptObj) {
    if (hasCompleteArtifactEvidence && (declaredList.length === 0 || hasValidSourcesEvidence)) {
      receiptStatus = 'complete';
    } else if (declaredList.length > 0 && hasValidSourcesEvidence && recordedList.length > 0) {
      receiptStatus = 'legacy-partial';
    }
  }
  const receiptValid = receiptStatus !== 'invalid';

  const revisionOk = revisionMatches !== false || sourceDriftBetweenRevisions === false;
  const artifactsOk = strict
    ? (receiptStatus === 'complete' && manifestMatches === true && contentMatches === true && htmlMatches === true)
    : (manifestMatches !== false && contentMatches !== false && htmlMatches !== false);
  const ok = receiptValid && bad.length === 0 && revisionOk && artifactsOk;

  const [currentRendererSha256, currentSkillVersion] = await Promise.all([
    computeRendererHash(),
    getSkillVersion(),
  ]);
  const documentedRendererSha256 = (isPlainReceiptObj && receipt.rendererSha256) || null;
  const documentedSkillVersion = (isPlainReceiptObj && (receipt.skillVersion || receipt.version)) || null;
  const rendererMatches = documentedRendererSha256 ? documentedRendererSha256 === currentRendererSha256 : null;
  const rendererNeedsRebuild = documentedRendererSha256
    ? documentedRendererSha256 !== currentRendererSha256
    : Boolean(documentedSkillVersion || receipt?.builtAt || receipt?.htmlSha256);

  return {
    ok,
    receiptValid,
    receiptStatus,
    document: manifest.title,
    browserReviewed: Boolean(isPlainReceiptObj && receipt.browserReviewed),
    revision: {
      documented: (isPlainReceiptObj && receipt.revision) || null,
      current: currentRevision,
      matches: revisionMatches,
      sourceDrift: sourceDriftBetweenRevisions,
    },
    artifacts: {
      manifestMatches,
      contentMatches,
      htmlMatches,
      htmlPath: htmlPath ? path.relative(path.dirname(receiptPath), htmlPath).replace(/\\/g, '/') : null,
    },
    renderer: {
      documentedVersion: documentedSkillVersion,
      currentVersion: currentSkillVersion,
      documentedSha256: documentedRendererSha256,
      currentSha256: currentRendererSha256,
      matches: rendererMatches,
      needsRebuild: rendererNeedsRebuild,
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

export async function analyzeImpact(manifestFile, receiptFile, { dossierFile = null, strict = false, htmlFile = null } = {}) {
  const manifestPath = path.resolve(manifestFile);
  const manifest = await readJson(manifestPath);
  const baseReport = await verify(manifestPath, receiptFile, { strict, htmlFile });

  const declaredSources = manifest.sources || [];
  const pathToIds = new Map();
  for (const s of declaredSources) {
    const norm = s.path.replace(/\\/g, '/');
    if (!pathToIds.has(norm)) pathToIds.set(norm, []);
    pathToIds.get(norm).push(s.id);
  }

  const directChangedSources = baseReport.sources.filter(r => r.status !== 'ok');
  const directChangedPaths = new Set(directChangedSources.map(s => s.path.replace(/\\/g, '/')));
  const directChangedIds = new Set(directChangedSources.map(s => s.id));

  const transitivelyImpactedPaths = new Set();
  const untrackedCoreFiles = [];

  if (dossierFile) {
    const dossier = await readJson(path.resolve(dossierFile));
    const impactAdj = new Map();
    const addImpactEdge = (upstream, downstream) => {
      if (!impactAdj.has(upstream)) impactAdj.set(upstream, new Set());
      impactAdj.get(upstream).add(downstream);
    };

    for (const edge of dossier.dependencyGraph?.edges || []) {
      const from = String(edge.from || '').replace(/\\/g, '/');
      const to = String(edge.to || '').replace(/\\/g, '/');
      if (!from || !to) continue;
      if (edge.kind === 'sql_lineage') {
        addImpactEdge(from, to);
      } else {
        addImpactEdge(to, from);
      }
    }

    const queue = [...directChangedPaths];
    const visited = new Set(directChangedPaths);
    while (queue.length > 0) {
      const cur = queue.shift();
      for (const next of impactAdj.get(cur) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          transitivelyImpactedPaths.add(next);
          queue.push(next);
        }
      }
    }

    const declaredPathSet = new Set(pathToIds.keys());
    const repo = path.resolve(path.dirname(manifestPath), manifest.repoRoot || '.');
    const relDocsDir = path.relative(repo, path.dirname(manifestPath)).replace(/\\/g, '/').replace(/\/$/, '');
    for (const f of dossier.files || []) {
      const norm = String(f.path || '').replace(/\\/g, '/');
      if (relDocsDir && !relDocsDir.startsWith('..') && (norm === relDocsDir || norm.startsWith(relDocsDir + '/'))) {
        continue;
      }
      if (norm.endsWith('/__init__.py') && (f.bytes || 0) <= 5) {
        continue;
      }
      if (!declaredPathSet.has(norm) && (f.wave || 4) <= 3 && (f.kind !== 'docs' || norm.toLowerCase() === 'readme.md')) {
        untrackedCoreFiles.push({
          path: norm,
          kind: f.kind,
          wave: f.wave,
          centrality: f.centrality || 0,
        });
      }
    }
  }

  const transitiveIds = new Set();
  for (const p of transitivelyImpactedPaths) {
    for (const id of pathToIds.get(p) || []) {
      if (!directChangedIds.has(id)) transitiveIds.add(id);
    }
  }

  const impactedSections = [];
  const freshSections = [];
  const mappedImpactedIds = new Set();

  for (const section of manifest.sections || []) {
    const secSources = section.sources || [];
    const directHits = secSources.filter(id => directChangedIds.has(id));
    const transitiveHits = secSources.filter(id => transitiveIds.has(id));
    for (const id of [...directHits, ...transitiveHits]) mappedImpactedIds.add(id);

    if (directHits.length || transitiveHits.length) {
      impactedSections.push({
        id: section.id,
        title: section.title,
        audience: section.audience,
        status: 'stale',
        directSources: directHits,
        transitiveSources: transitiveHits,
      });
    } else {
      freshSections.push({
        id: section.id,
        title: section.title,
        audience: section.audience,
        status: 'fresh',
        declaredSourcesCount: secSources.length,
      });
    }
  }

  const unmappedImpactedSources = [...directChangedIds, ...transitiveIds].filter(id => !mappedImpactedIds.has(id));
  const repoForDiff = path.resolve(path.dirname(manifestPath), manifest.repoRoot || '.');
  let gitDiffStat = null;
  if (baseReport.revision?.documented && baseReport.revision?.current && baseReport.revision.documented !== baseReport.revision.current) {
    gitDiffStat = git(repoForDiff, 'diff', '--stat', `${baseReport.revision.documented}..${baseReport.revision.current}`);
  }

  return {
    ...baseReport,
    gitDiffStat,
    impactedPaths: {
      direct: [...directChangedPaths].sort(),
      transitive: [...transitivelyImpactedPaths].sort(),
    },
    impactedSections,
    freshSections,
    unmappedImpactedSources,
    untrackedCoreFiles,
  };
}

export function renderUpdatePlan(impact) {
  const artifactsSynced = !impact.artifacts || (
    impact.artifacts.manifestMatches !== false &&
    impact.artifacts.contentMatches !== false &&
    impact.artifacts.htmlMatches !== false
  );
  const receiptOk = impact.receiptValid !== false;
  const sourcesSynced = Boolean(impact.ok && !impact.untrackedCoreFiles.length);
  const rendererNeedsRebuild = Boolean(impact.renderer?.needsRebuild);
  const overallStatus = !receiptOk
    ? 'Recibo de validação incompleto ou inválido (execute build.mjs --force)'
    : !artifactsSynced
      ? 'Artefatos editados após o último build (execute build.mjs --force para recompilar o HTML)'
      : !sourcesSynced
        ? 'Desatualizado (revisão cirúrgica recomendada)'
        : rendererNeedsRebuild
          ? 'Código-fonte sincronizado · Template da skill atualizado (regere o HTML com build.mjs --force)'
          : 'Sincronizado (nenhuma atualização necessária)';

  const lines = [
    '# Plano de Atualização Incremental (Drift & Impacto)',
    '',
    `- **Documento:** ${impact.document}`,
    `- **Revisão documentada:** \`${impact.revision.documented || 'n/d'}\` → **Atual:** \`${impact.revision.current || 'n/d'}\``,
    `- **Status geral:** ${overallStatus}`,
    '',
  ];

  if (!artifactsSynced || !receiptOk) {
    const drifted = [];
    if (!receiptOk) drifted.push('`validation.json` inválido/incompleto');
    if (impact.artifacts?.manifestMatches === false) drifted.push('`document.json`');
    if (impact.artifacts?.contentMatches === false) drifted.push('`content.md`');
    if (impact.artifacts?.htmlMatches === false) drifted.push('`.html` compilado');
    lines.push(
      '## 0. Artefatos de Autoria Divergentes do Recibo',
      '',
      `- Os seguintes artefatos divergem do hash registrado em \`validation.json\`: ${drifted.join(', ')}. Execute \`build.mjs --force\` para recompilar.`,
      '',
    );
  }

  if (rendererNeedsRebuild) {
    const docVer = impact.renderer?.documentedVersion || 'n/d';
    const curVer = impact.renderer?.currentVersion || 'n/d';
    const docHash = impact.renderer?.documentedSha256 ? `\`${impact.renderer.documentedSha256.slice(0, 12)}\`` : '`ausente (recibo legado)`';
    const curHash = impact.renderer?.currentSha256 ? `\`${impact.renderer.currentSha256.slice(0, 12)}\`` : '`n/d`';
    lines.push(
      '## 0. Template & Renderer da Skill Atualizados',
      '',
      `- **Versão da skill:** \`${docVer}\` → \`${curVer}\` · **Hash do renderer:** ${docHash} → ${curHash}`,
      sourcesSynced
        ? '- **Ação recomendada:** Código-fonte e `content.md` continuam sincronizados — **não é necessário reler o repositório nem reescrever seções**. Basta executar `node <skill>/scripts/build.mjs <manifest> --out <output.html> --force` para regenerar o HTML com as melhorias mais recentes de CSS/JS/layout/diagramas.'
        : '- **Nota:** Além das seções alteradas abaixo, a recompilação com `build.mjs --force` aplicará automaticamente as melhorias mais recentes de CSS/JS/layout/diagramas da skill.',
      '',
    );
  }

  lines.push('## 1. Arquivos Alterados & Propagação no Grafo', '');

  const badSources = impact.sources.filter(s => s.status !== 'ok');
  if (badSources.length) {
    lines.push('| Source ID | Arquivo | Status |');
    lines.push('|---|---|---|');
    for (const s of badSources) {
      lines.push(`| \`${s.id}\` | \`${s.path}\` | \`${s.status}\` |`);
    }
    lines.push('');
  } else {
    lines.push('- Nenhuma fonte já rastreada sofreu alteração.');
    lines.push('');
  }

  if (impact.impactedPaths.transitive.length) {
    lines.push('### Dependentes Transitivos Impactados (não precisa reler o resto do repo)');
    for (const p of impact.impactedPaths.transitive) {
      lines.push(`- \`${p}\``);
    }
    lines.push('');
  }

  if (impact.untrackedCoreFiles.length) {
    lines.push('### Novos Arquivos Core Não Rastreados no Manifesto');
    for (const f of impact.untrackedCoreFiles.slice(0, 25)) {
      lines.push(`- \`${f.path}\` (Onda ${f.wave} · \`${f.kind}\` · centralidade ${f.centrality})`);
    }
    if (impact.untrackedCoreFiles.length > 25) {
      lines.push(`- ... e mais ${impact.untrackedCoreFiles.length - 25} arquivo(s) não listado(s).`);
    }
    lines.push('');
  }

  if (impact.gitDiffStat) {
    lines.push('### Resumo Git (`git diff --stat`)', '', '```text', impact.gitDiffStat, '```', '');
  }

  lines.push('## 2. Seções Impactadas vs Preservadas (`content.md`)', '');
  if (impact.impactedSections.length) {
    lines.push('### Reabrir e revisar apenas estas seções:');
    for (const s of impact.impactedSections) {
      const reasons = [
        ...(s.directSources.length ? [`diretas: ${s.directSources.map(x => `\`${x}\``).join(', ')}`] : []),
        ...(s.transitiveSources.length ? [`transitivas: ${s.transitiveSources.map(x => `\`${x}\``).join(', ')}`] : []),
      ].join(' · ');
      lines.push(`- **${s.title}** (\`#${s.id}\` · ${reasons})`);
    }
    lines.push('');
  }

  if (impact.unmappedImpactedSources.length) {
    lines.push(`> **Atenção:** As fontes alteradas ${impact.unmappedImpactedSources.map(x => `\`${x}\``).join(', ')} não estão vinculadas a nenhuma propriedade \`sections[].sources\` em \`document.json\`; verifique manualmente quais capítulos dependem delas e adicione o vínculo.`);
    lines.push('');
  }

  if (impact.freshSections.length) {
    lines.push('### Seções preservadas (não reler fontes sem necessidade):');
    for (const s of impact.freshSections) {
      lines.push(`- \`#${s.id}\` — ${s.title} (${s.declaredSourcesCount} fonte(s) íntegra(s))`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export async function markReviewed(receiptPath, result, { rubricFile = null, acceptIssues = null } = {}) {
  if (!result.ok || result.receiptStatus !== 'complete' || Object.values(result.artifacts || {}).some(v => v === false)) {
    return { ok: false, reasons: ['Verification failed or receipt incomplete; resolve source/artifact drift before sign-off'] };
  }
  const receipt = await readJson(receiptPath);
  const htmlPath = result.artifacts?.htmlPath
    ? path.resolve(path.dirname(receiptPath), result.artifacts.htmlPath)
    : resolveCandidateHtmlPath(receiptPath, receipt);
  if (!htmlPath || !await checkFileHash(htmlPath, receipt.htmlSha256)) return { ok: false, reasons: ['HTML changed before sign-off; rebuild and review again'] };
  const rubricText = rubricFile ? await fs.readFile(path.resolve(rubricFile), 'utf8') : null;
  const gate = evaluateReviewGate(receipt, { rubricText, acceptIssues });
  result.reviewGate = gate;
  if (!gate.ok) return gate;
  const now = new Date().toISOString();
  receipt.browserReviewed = true;
  receipt.browserReviewedAt = now;
  if (gate.accepted) receipt.reviewOverride = { reason: String(acceptIssues).trim(), at: now, hadVisualReview: Boolean(receipt.visualReview), reasons: gate.reasons };
  else delete receipt.reviewOverride;
  const tmp = `${receiptPath}.${randomUUID()}.tmp`;
  try { await fs.writeFile(tmp, JSON.stringify(receipt, null, 2) + '\n'); await fs.rename(tmp, receiptPath); }
  finally { await fs.rm(tmp, { force: true }); }
  result.browserReviewed = true;
  result.browserReviewedAt = now;
  return gate;
}

export function parseVerifyCliArgs(argv) {
  let strict = false;
  let impactMode = false;
  let markReviewed = false;
  let rubricFile = null;
  let acceptIssues = null;
  let dossierFile = null;
  let planOut = null;
  let htmlFile = null;
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--strict') {
      strict = true;
    } else if (arg === '--impact') {
      impactMode = true;
    } else if (arg === '--mark-reviewed') {
      markReviewed = true;
    } else if (arg === '--dossier' || arg === '--plan' || arg === '--html' || arg === '--rubric' || arg === '--accept-issues') {
      const val = argv[i + 1];
      if (!val || val.startsWith('--')) throw Error(`Flag ${arg} requires a value`);
      if (arg === '--dossier') dossierFile = val;
      else if (arg === '--plan') planOut = val;
      else if (arg === '--rubric') rubricFile = val;
      else if (arg === '--accept-issues') acceptIssues = val;
      else htmlFile = val;
      i++;
    } else if (arg.startsWith('--')) {
      throw Error(`Unknown flag: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if ((rubricFile || acceptIssues !== null) && !markReviewed) throw Error('--rubric/--accept-issues only apply together with --mark-reviewed');
  if (positional.length < 2 || positional.length > 2) {
    throw Error('Usage: node scripts/verify.mjs <document.json> <receipt.json> [--strict] [--impact] [--dossier <inventory.json>] [--plan <update-plan.md>] [--html <output.html>] [--mark-reviewed]');
  }
  return {
    manifestFile: positional[0],
    receiptFile: positional[1],
    strict,
    impactMode,
    markReviewed,
    rubricFile,
    acceptIssues,
    dossierFile,
    planOut,
    htmlFile,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const opts = parseVerifyCliArgs(process.argv.slice(2));
    const result = opts.impactMode || opts.dossierFile || opts.planOut
      ? await analyzeImpact(opts.manifestFile, opts.receiptFile, {
          dossierFile: opts.dossierFile,
          strict: opts.strict,
          htmlFile: opts.htmlFile,
        })
      : await verify(opts.manifestFile, opts.receiptFile, {
          strict: opts.strict,
          htmlFile: opts.htmlFile,
        });

    if (opts.markReviewed) {
      const gate = await markReviewed(path.resolve(opts.receiptFile), result, opts);
      if (!gate.ok) { console.error(gate.reasons.join('; ')); process.exitCode = 1; }
    }

    if (opts.planOut) {
      const resolvedPlan = path.resolve(opts.planOut);
      await fs.mkdir(path.dirname(resolvedPlan), { recursive: true });
      await fs.writeFile(resolvedPlan, renderUpdatePlan(result), 'utf8');
    }

    console.log(JSON.stringify(result, null, 2));
    if (opts.strict && !result.ok) process.exitCode = 1;
  } catch (e) {
    console.error(e.message || e.stack);
    process.exitCode = 2;
  }
}
