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

export async function analyzeImpact(manifestFile, receiptFile, {dossierFile = null} = {}) {
  const manifestPath = path.resolve(manifestFile);
  const manifest = await readJson(manifestPath);
  const baseReport = await verify(manifestPath, receiptFile);

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
        // Producer (from) changed -> downstream SQL consumer (to) is impacted
        addImpactEdge(from, to);
      } else {
        // Imported module/notebook/script (to) changed -> caller/bundle/workflow (from) is impacted
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

  return {
    ...baseReport,
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
  const lines = [
    '# Plano de Atualização Incremental (Drift & Impacto)',
    '',
    `- **Documento:** ${impact.document}`,
    `- **Revisão documentada:** \`${impact.revision.documented || 'n/d'}\` → **Atual:** \`${impact.revision.current || 'n/d'}\``,
    `- **Status geral:** ${impact.ok && !impact.untrackedCoreFiles.length ? 'Sincronizado (nenhuma atualização necessária)' : 'Desatualizado (revisão cirúrgica recomendada)'}`,
    '',
    '## 1. Arquivos Alterados & Propagação no Grafo',
    '',
  ];

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
    lines.push('');
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

function getFlagValue(argv, flag) {
  const idx = argv.indexOf(flag);
  return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1] : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const impactMode = argv.includes('--impact');
  const dossierFile = getFlagValue(argv, '--dossier');
  const planOut = getFlagValue(argv, '--plan');

  const skipVals = new Set([dossierFile, planOut].filter(Boolean));
  const positional = argv.filter(a => !a.startsWith('--') && !skipVals.has(a));

  if (positional.length < 2) {
    console.error('Usage: node scripts/verify.mjs <document.json> <receipt.json> [--strict] [--impact] [--dossier <inventory.json>] [--plan <update-plan.md>]');
    process.exitCode = 2;
  } else {
    try {
      const result = impactMode || dossierFile || planOut
        ? await analyzeImpact(positional[0], positional[1], {dossierFile})
        : await verify(positional[0], positional[1]);

      if (planOut) {
        const resolvedPlan = path.resolve(planOut);
        await fs.mkdir(path.dirname(resolvedPlan), {recursive: true});
        await fs.writeFile(resolvedPlan, renderUpdatePlan(result), 'utf8');
      }

      console.log(JSON.stringify(result, null, 2));
      if (strict && !result.ok) process.exitCode = 1;
    } catch (e) {
      console.error(e.stack || e.message);
      process.exitCode = 2;
    }
  }
}
