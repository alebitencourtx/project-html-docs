"""Repository walker, dependency graph builder, wave prioritizer, and reading plan renderer."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from typing import Any

from .extractors import (
    detect_stack_signals,
    extract_iac_resources,
    extract_ipynb_facts,
    extract_js_ts_facts,
    extract_python_facts,
    extract_scala_facts,
    extract_workflow_or_config,
)
from .redaction import redact_inline_secrets
from .sql_parser import extract_sql_facts

SKIP = {
    '.git', 'node_modules', '.venv', 'venv', '__pycache__', '.runtime',
    'dist', '.mypy_cache', '.pytest_cache',
    'target', 'coverage', '.tox', '.ruff_cache', '.playwright-cli', '.next',
}

EXTENSIONS = {
    '.md', '.mdx', '.rst', '.txt', '.py', '.sh', '.ps1', '.sql', '.hql', '.ddl', '.dml',
    '.j2', '.jinja', '.jinja2', '.avsc', '.graphql', '.json', '.yaml', '.yml',
    '.toml', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.mts', '.cts', '.html', '.ipynb',
    '.tf', '.hcl', '.bicep', '.java', '.scala', '.go', '.rs', '.cs', '.rb',
    '.php', '.kt', '.proto', '.csv', '.cfg', '.ini',
}

SPECIAL_NAMES = {'Dockerfile', 'Makefile', 'Procfile', 'Jenkinsfile'}

KIND = {
    '.md': 'docs', '.mdx': 'docs', '.rst': 'docs', '.txt': 'docs', '.html': 'docs',
    '.py': 'code', '.sh': 'code', '.ps1': 'code', '.js': 'code', '.mjs': 'code', '.cjs': 'code',
    '.ts': 'code', '.tsx': 'code', '.jsx': 'code', '.mts': 'code', '.cts': 'code',
    '.java': 'code', '.scala': 'code', '.go': 'code',
    '.rs': 'code', '.cs': 'code', '.rb': 'code', '.php': 'code', '.kt': 'code',
    '.sql': 'schema', '.hql': 'schema', '.ddl': 'schema', '.dml': 'schema',
    '.proto': 'schema', '.avsc': 'schema', '.graphql': 'schema',
    '.j2': 'template', '.jinja': 'template', '.jinja2': 'template',
    '.json': 'config', '.yaml': 'config', '.yml': 'config',
    '.toml': 'config', '.cfg': 'config', '.ini': 'config',
    '.tf': 'infra', '.hcl': 'infra', '.bicep': 'infra',
    '.ipynb': 'notebook', '.csv': 'data',
}

NOISE_DATA_EXTS = {'.csv', '.parquet'}
GENERATED_ARTIFACT_PATTERNS = ('*.validation.json', 'reading-plan.md', 'update-plan.md', 'documentacao*.html')
JS_TS_EXTS = ('.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.mts', '.cts')


def _resolve_python_import(imp: dict[str, Any], from_file: str, module_index: dict[str, str]) -> list[str]:
    mod = imp.get('module') or ''
    level = imp.get('level') or 0
    names = imp.get('names') or []
    hits: list[str] = []

    if level > 0:
        parts = Path(from_file).parent.parts
        base_parts = parts[:max(0, len(parts) - (level - 1))]
        prefix = '.'.join(base_parts)
        candidates = [f"{prefix}.{mod}".strip('.')] if mod else [prefix]
        for n in names:
            candidates.append(f"{candidates[0]}.{n}".strip('.'))
    else:
        candidates = [mod] + [f"{mod}.{n}".strip('.') for n in names]

    for cand in candidates:
        if not cand:
            continue
        if cand in module_index and module_index[cand] != from_file:
            hits.append(module_index[cand])
    return sorted(set(hits))


def _resolve_js_import(specifier: str, from_file: str, all_paths: set[str]) -> str | None:
    if not specifier.startswith('.'):
        return None
    base = (Path(from_file).parent / specifier).as_posix()
    norm = Path(os.path.normpath(base)).as_posix()
    for ext in ('', '.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '/index.ts', '/index.mts', '/index.js'):
        cand = norm + ext
        if cand in all_paths and cand != from_file:
            return cand
    return None


def _resolve_notebook_target(raw_ref: str, from_file: str, all_paths: set[str]) -> str | None:
    clean_ref = str(raw_ref or '').strip().lstrip('/')
    if not clean_ref:
        return None
    if not clean_ref.startswith(('.', '/')) and '/' in clean_ref:
        for cand in all_paths:
            if cand == clean_ref or cand.endswith('/' + clean_ref) or cand.rsplit('.', 1)[0].endswith(clean_ref.rsplit('.', 1)[0]):
                return cand
    rel_base = Path(os.path.normpath((Path(from_file).parent / clean_ref).as_posix())).as_posix()
    for ext in ('', '.py', '.ipynb', '.sql', '.scala'):
        cand = rel_base + ext
        if cand in all_paths and cand != from_file:
            return cand
    tail = clean_ref.lstrip('./')
    for cand in all_paths:
        if cand != from_file and (cand.endswith(tail) or cand.rsplit('.', 1)[0].endswith(tail)):
            return cand
    return None


def inspect(
    root: Path,
    includes: list[str] | None = None,
    excludes: list[str] | None = None,
    ignore_paths: set[str] | None = None,
) -> dict[str, Any]:
    root = root.resolve()
    includes = [x for x in (includes or []) if x]
    excludes = [x for x in (excludes or []) if x]
    ignore_paths = ignore_paths or set()

    docignore_rules: list[dict[str, Any]] = []
    docignore_file = root / '.docignore'
    if docignore_file.is_file():
        for raw_ln in docignore_file.read_text(encoding='utf-8', errors='ignore').splitlines():
            ln = raw_ln.strip()
            if not ln or ln.startswith('#'):
                continue
            ln = re.sub(r'\s+#.*$', '', ln).strip()
            if not ln:
                continue
            negate = ln.startswith('!')
            if negate:
                ln = ln[1:].strip()
            anchored = ln.startswith('/')
            pat = ln.strip('/')
            if pat:
                docignore_rules.append({'negate': negate, 'anchored': anchored, 'pattern': pat})

    def git(*args: str) -> str | None:
        r = subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True, encoding='utf-8', errors='replace')
        return r.stdout.strip() if r.returncode == 0 else None

    def rule_matches(rule: dict[str, Any], posix: str, name: str) -> bool:
        pat = rule['pattern']
        if rule['anchored']:
            return fnmatch.fnmatch(posix, pat) or posix == pat or posix.startswith(pat + '/')
        if '/' in pat:
            return fnmatch.fnmatch(posix, pat) or posix == pat or posix.startswith(pat + '/')
        return fnmatch.fnmatch(posix, pat) or fnmatch.fnmatch(name, pat) or pat in posix.split('/')

    def matches_docignore(posix: str, name: str) -> bool:
        ignored = False
        for rule in docignore_rules:
            if rule_matches(rule, posix, name):
                ignored = not rule['negate']
        return ignored

    def may_have_unignored_descendant(dir_posix: str) -> bool:
        prefix = dir_posix + '/'
        return any(
            rule['negate'] and (rule['pattern'].startswith(prefix) or fnmatch.fnmatch(prefix + 'x', rule['pattern']))
            for rule in docignore_rules
        )

    omitted_counts: Counter[str] = Counter()
    omitted_files: list[dict[str, str]] = []

    def record_omitted(path_str: str, reason: str) -> None:
        omitted_counts[reason] += 1
        if len(omitted_files) < 100:
            omitted_files.append({'path': path_str, 'reason': reason})

    def selection_reason(rel: Path, p_abs: Path) -> str | None:
        posix = rel.as_posix()
        name = rel.name
        if str(p_abs) in ignore_paths:
            return 'output_artifact'
        if any(fnmatch.fnmatch(name, pat) or fnmatch.fnmatch(posix, pat) for pat in GENERATED_ARTIFACT_PATTERNS):
            return 'generated_artifact'
        if matches_docignore(posix, name):
            return 'docignore'
        if includes and not any(token in posix for token in includes):
            return 'include_filter'
        if any(token in posix for token in excludes):
            return 'exclude_filter'
        return None

    files: list[dict[str, Any]] = []
    stack_counts: Counter[str] = Counter()
    kind_counts: Counter[str] = Counter()
    stacks_by_file: dict[str, list[str]] = {}
    parse_warnings: list[dict[str, str]] = []

    file_details: dict[str, dict[str, Any]] = {}
    sql_lineage: list[dict[str, Any]] = []
    endpoints: list[dict[str, Any]] = []
    notebooks: list[dict[str, Any]] = []
    data_contracts: list[dict[str, Any]] = []
    iac_resources: list[dict[str, Any]] = []
    workflows: list[dict[str, Any]] = []
    databricks_bundles: list[dict[str, Any]] = []
    adf_pipelines: list[dict[str, Any]] = []
    env_cli_params: list[dict[str, Any]] = []
    inline_configs: dict[str, Any] = {}
    tests_index: dict[str, list[dict[str, Any]]] = {}

    total_code_lines = 0

    for directory, dirs, names in os.walk(root, followlinks=False):
        rel_dir = Path(directory).relative_to(root).as_posix()
        kept_dirs = []
        for d in sorted(dirs):
            dir_posix = d if rel_dir == '.' else f"{rel_dir}/{d}"
            if d in SKIP:
                record_omitted(dir_posix + '/', 'skip_dir')
                continue
            if (Path(directory) / d).is_symlink():
                record_omitted(dir_posix + '/', 'symlink')
                continue
            if matches_docignore(dir_posix, d) and not may_have_unignored_descendant(dir_posix):
                record_omitted(dir_posix + '/', 'docignore')
                continue
            kept_dirs.append(d)
        dirs[:] = kept_dirs

        for name in sorted(names):
            p = Path(directory) / name
            rel = p.relative_to(root)
            posix = rel.as_posix()
            if p.is_symlink():
                record_omitted(posix, 'symlink')
                continue
            if name.startswith('.env') and name != '.env.example':
                record_omitted(posix, 'env_file')
                continue
            if p.suffix.lower() not in EXTENSIONS and name not in SPECIAL_NAMES:
                record_omitted(posix, 'unsupported_ext')
                continue
            omit_reason = selection_reason(rel, p.resolve())
            if omit_reason:
                record_omitted(posix, omit_reason)
                continue
            size = p.stat().st_size
            if size > 2_000_000:
                record_omitted(posix, 'max_size_exceeded')
                continue

            raw = p.read_bytes()
            kind = KIND.get(p.suffix.lower(), 'infra' if name in SPECIAL_NAMES else 'other')
            kind_counts[kind] += 1

            is_text = p.suffix.lower() not in NOISE_DATA_EXTS
            text = raw.decode('utf-8', errors='ignore') if is_text else ''
            line_count = text.count('\n') + (1 if text else 0)
            if kind in {'code', 'schema', 'template', 'notebook'}:
                total_code_lines += line_count

            sigs = detect_stack_signals(posix, text) if text else []
            for sig in sigs:
                stack_counts[sig] += 1
            if sigs:
                stacks_by_file[posix] = sigs

            f_entry: dict[str, Any] = {
                'path': posix,
                'bytes': size,
                'lines': line_count,
                'kind': kind,
                'sha256': hashlib.sha256(raw).hexdigest(),
            }
            if sigs:
                f_entry['stacks'] = sigs
            files.append(f_entry)

            ext = p.suffix.lower()
            try:
                if ext == '.py':
                    py_facts = extract_python_facts(posix, text)
                    file_details[posix] = py_facts
                    if py_facts.get('parseWarning'):
                        parse_warnings.append({'file': posix, 'warning': py_facts['parseWarning']})
                    if py_facts['isDatabricksNotebook']:
                        notebooks.append({
                            'path': posix,
                            'format': 'databricks_py',
                            'cells': len(py_facts['notebookCells']),
                            'languages': sorted({c['lang'] for c in py_facts['notebookCells']}),
                        })
                    for ep in py_facts['endpoints']:
                        endpoints.append({'file': posix, **ep})
                    for prm in py_facts['envAndCliParams']:
                        env_cli_params.append({'file': posix, **prm})
                    for sc in py_facts['schemas']:
                        data_contracts.append({'file': posix, **sc})
                    for sb in py_facts['sqlBlocks']:
                        sql_lineage.append({'file': posix, **sb})
                    if py_facts['testsIndex']:
                        tests_index[posix] = py_facts['testsIndex']

                elif ext == '.ipynb':
                    nb_facts = extract_ipynb_facts(posix, text)
                    file_details[posix] = nb_facts
                    if nb_facts.get('parseWarning'):
                        parse_warnings.append({'file': posix, 'warning': nb_facts['parseWarning']})
                    notebooks.append({
                        'path': posix,
                        'format': 'ipynb',
                        'cells': nb_facts.get('notebookCellCount', 0),
                    })
                    for prm in nb_facts.get('envAndCliParams', []):
                        env_cli_params.append({'file': posix, **prm})
                    for sc in nb_facts.get('schemas', []):
                        data_contracts.append({'file': posix, **sc})
                    for sb in nb_facts.get('sqlBlocks', []):
                        sql_lineage.append({'file': posix, **sb})

                elif ext in {'.sql', '.hql', '.ddl', '.dml', '.j2', '.jinja', '.jinja2'}:
                    sql_info = extract_sql_facts(text, origin='file')
                    file_details[posix] = {'sql': sql_info}
                    sql_lineage.append({'file': posix, **sql_info})
                    for ddl in sql_info['ddlSchemas']:
                        data_contracts.append({'file': posix, 'name': ddl['table'], 'kind': 'sql_ddl', 'fields': ddl['columns']})

                elif ext in JS_TS_EXTS:
                    js_facts = extract_js_ts_facts(posix, text)
                    file_details[posix] = js_facts
                    for ep in js_facts['endpoints']:
                        endpoints.append({'file': posix, **ep})
                    for prm in js_facts.get('envAndCliParams', []):
                        env_cli_params.append({'file': posix, **prm})
                    for sc in js_facts.get('schemas', []):
                        data_contracts.append({'file': posix, **sc})
                    if js_facts['testsIndex']:
                        tests_index[posix] = js_facts['testsIndex']

                elif ext == '.scala':
                    sc_facts = extract_scala_facts(posix, text)
                    file_details[posix] = sc_facts

                elif ext in {'.tf', '.hcl', '.bicep'}:
                    res = extract_iac_resources(posix, text)
                    if res:
                        iac_resources.append({'file': posix, 'resources': res})
                        file_details[posix] = {'iac': res}

                elif ext in {'.yml', '.yaml', '.json', '.toml'}:
                    cfg = extract_workflow_or_config(posix, text)
                    if cfg:
                        file_details[posix] = cfg
                        if cfg.get('parseWarning'):
                            parse_warnings.append({'file': posix, 'warning': cfg['parseWarning']})
                        if 'workflow' in cfg:
                            workflows.append({'file': posix, **cfg['workflow']})
                        if 'databricksBundle' in cfg:
                            databricks_bundles.append({'file': posix, **cfg['databricksBundle']})
                        if 'adfPipeline' in cfg:
                            adf_pipelines.append({'file': posix, **cfg['adfPipeline']})
                        if 'inlineSummary' in cfg:
                            inline_configs[posix] = cfg['inlineSummary']
            except Exception as exc:
                parse_warnings.append({'file': posix, 'warning': f'{type(exc).__name__}: {str(exc)[:160]}'})

    module_index: dict[str, str] = {}
    all_paths = {f['path'] for f in files}
    for f in files:
        if not f['path'].endswith('.py'):
            continue
        p_obj = Path(f['path'])
        parts = list(p_obj.parts)
        for start in (0, 1) if len(parts) > 1 and parts[0] == 'src' else (0,):
            sub = list(parts[start:])
            if sub[-1] == '__init__.py':
                mod_name = '.'.join(sub[:-1])
            else:
                mod_name = '.'.join([*sub[:-1], p_obj.stem])
            if mod_name:
                module_index[mod_name] = f['path']

    dep_edges: list[dict[str, str]] = []
    in_degree: Counter[str] = Counter()
    out_degree: Counter[str] = Counter()
    edge_seen: set[tuple[str, str, str]] = set()

    def add_edge(src: str, dst: str, edge_kind: str) -> None:
        if src == dst or (src, dst, edge_kind) in edge_seen:
            return
        edge_seen.add((src, dst, edge_kind))
        dep_edges.append({'from': src, 'to': dst, 'kind': edge_kind})
        out_degree[src] += 1
        in_degree[dst] += 1

    table_producers: dict[str, list[str]] = defaultdict(list)
    for item in sql_lineage:
        for t in item.get('targets', []):
            tname = (t.get('target') or '').lower()
            if tname:
                table_producers[tname].append(item['file'])

    for f in files:
        p = f['path']
        det = file_details.get(p, {})
        if p.endswith('.py'):
            for imp in det.get('imports', []):
                for target in _resolve_python_import(imp, p, module_index):
                    add_edge(p, target, 'import')
            for nb_call in det.get('notebookCalls', []):
                target = _resolve_notebook_target(nb_call, p, all_paths)
                if target:
                    add_edge(p, target, 'notebook_run')
        elif p.endswith('.ipynb'):
            for imp in det.get('imports', []):
                for target in _resolve_python_import(imp, p, module_index):
                    add_edge(p, target, 'import')
            for nb_call in det.get('notebookCalls', []):
                target = _resolve_notebook_target(nb_call, p, all_paths)
                if target:
                    add_edge(p, target, 'notebook_run')
        elif p.endswith(JS_TS_EXTS):
            for imp in det.get('imports', []):
                target = _resolve_js_import(imp['module'], p, all_paths)
                if target:
                    add_edge(p, target, 'import')
        elif 'databricksBundle' in det:
            for nb in det['databricksBundle'].get('notebookPaths', []) + det['databricksBundle'].get('pythonFiles', []):
                clean_nb = nb.lstrip('./')
                for cand in all_paths:
                    if cand.endswith(clean_nb):
                        add_edge(p, cand, 'bundle_task')
        elif 'adfPipeline' in det:
            for act in det['adfPipeline'].get('activities', []):
                if act.get('notebookPath'):
                    target = _resolve_notebook_target(act['notebookPath'], p, all_paths)
                    if target:
                        add_edge(p, target, 'adf_activity')
        elif 'workflow' in det:
            joined_cmd = ' '.join(det['workflow'].get('runCommands', []))
            for cand in all_paths:
                if cand.endswith(('.py', '.sh', '.mjs', '.js', '.ts')) and (cand in joined_cmd or Path(cand).name in joined_cmd):
                    add_edge(p, cand, 'workflow_run')

    for item in sql_lineage:
        consumer = item['file']
        for src_tbl in item.get('sources', []):
            for prod in table_producers.get(src_tbl.lower(), []):
                add_edge(prod, consumer, 'sql_lineage')

    waves: dict[str, list[dict[str, Any]]] = {'wave1': [], 'wave2': [], 'wave3': [], 'wave4': []}

    for f in files:
        p = f['path']
        lower = p.lower()
        kind = f['kind']
        det = file_details.get(p, {})
        is_test = bool(re.search(r'(?:^|/)tests?/|test_[^/]+\.py$|_test\.py$|\.(?:test|spec)\.', lower))

        score = (in_degree[p] * 2) + out_degree[p]
        if det.get('hasMainGuard') or det.get('endpoints') or det.get('adfPipeline'):
            score += 4
        if det.get('dataIO'):
            score += 3
        if det.get('schemas') or kind == 'schema':
            score += 3
        if lower in {'readme.md', 'pyproject.toml', 'package.json', 'databricks.yml'} or '.github/workflows/' in lower:
            score += 5
        if is_test:
            score = max(0, score - 5)

        if is_test or (kind == 'docs' and lower != 'readme.md') or kind == 'data':
            wave_num = 4
        elif (
            lower == 'readme.md'
            or kind in {'config', 'infra'}
            or '.github/workflows/' in lower
            or det.get('hasMainGuard')
            or det.get('endpoints')
            or det.get('adfPipeline')
            or Path(lower).name in {'cli.py', 'main.py', 'app.py', 'pipeline.py', 'server.ts', 'databricks.yml'}
        ):
            wave_num = 1
        elif kind in {'schema', 'template'} or p.endswith('.ipynb') or det.get('schemas') or det.get('sqlBlocks'):
            wave_num = 3 if not det.get('dataIO') else 2
        else:
            wave_num = 2

        f['wave'] = wave_num
        f['centrality'] = score
        waves[f'wave{wave_num}'].append({
            'path': p,
            'kind': kind,
            'lines': f['lines'],
            'centrality': score,
            'stacks': f.get('stacks', []),
            'symbolsCount': len(det.get('symbols', [])),
            'testsCount': len(det.get('testsIndex', [])),
        })

    for wk in waves:
        waves[wk].sort(key=lambda x: (-x['centrality'], x['path']))

    core_file_count = sum(1 for f in files if f['wave'] in {1, 2, 3} and f['kind'] != 'data')
    if core_file_count <= 30 and total_code_lines <= 6000:
        tier = 'small'
        strategy = 'Leitura sequencial guiada por Ondas 1 -> 2 -> 3 (projeto compacto).'
    elif core_file_count <= 120 and total_code_lines <= 25000:
        tier = 'medium'
        strategy = 'Leitura seletiva em Ondas 1 -> 2 -> 3; usar intervalos [Lstart-Lend] dos símbolos para arquivos > 200 linhas e consultar testsIndex em vez de ler testes integrais.'
    else:
        tier = 'large'
        strategy = 'Repositório extenso: acionar divisão paralela por domínios (Ingestão/Streaming, Transformação/SQL, Serving/API, Infra/Operação), produzindo fichas factuais com arquivo:linha antes da redação final.'

    symbol_index = {
        p: {
            'constants': det.get('constants', []),
            'symbols': det.get('symbols', []),
            'dataIO': det.get('dataIO', []),
        }
        for p, det in file_details.items()
        if det.get('constants') or det.get('symbols') or det.get('dataIO')
    }

    return {
        'dossierVersion': '1.5.0',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'repository': str(root),
        'revision': git('rev-parse', 'HEAD'),
        'workingTreeChanges': git('status', '--short'),
        'includes': includes,
        'excludes': excludes,
        'countsByKind': dict(sorted(kind_counts.items())),
        'stackSignals': dict(sorted(stack_counts.items())),
        'stacksByFile': stacks_by_file,
        'scaleProfile': {
            'tier': tier,
            'totalFiles': len(files),
            'coreFiles': core_file_count,
            'totalCodeLines': total_code_lines,
            'recommendedStrategy': strategy,
        },
        'entrypoints': {
            'workflows': workflows,
            'databricksBundles': databricks_bundles,
            'adfPipelines': adf_pipelines,
            'endpoints': endpoints,
            'cliOrMainFiles': [p for p, d in file_details.items() if d.get('hasMainGuard')],
        },
        'envAndCliParams': env_cli_params,
        'notebooks': notebooks,
        'dataContracts': data_contracts,
        'sqlLineage': sql_lineage,
        'iacResources': iac_resources,
        'inlineConfigs': inline_configs,
        'symbolIndex': symbol_index,
        'testsIndex': tests_index,
        'dependencyGraph': {
            'edges': dep_edges,
            'inDegree': dict(sorted(in_degree.items())),
            'outDegree': dict(sorted(out_degree.items())),
        },
        'readingWaves': waves,
        'files': files,
        'omittedCounts': dict(sorted(omitted_counts.items())),
        'omittedFiles': omitted_files,
        'parseWarnings': parse_warnings[:50],
        'note': 'Static deterministic dossier only; zero LLM calls and zero execution of project code. Secret-like values are redacted.',
    }


def render_reading_plan(dossier: dict[str, Any]) -> str:
    sp = dossier['scaleProfile']
    ep = dossier['entrypoints']
    stacks = ', '.join(f"`{k}` ({v})" for k, v in dossier['stackSignals'].items()) or 'nenhum sinal específico detectado'

    lines: list[str] = [
        '# Plano de Leitura Cirúrgica (Dossiê Estático)',
        '',
        f"- **Repositório:** `{dossier['repository']}`",
        f"- **Revisão Git:** `{dossier.get('revision') or 'sem git'}`",
        f"- **Escala:** `{sp['tier']}` · **{sp['coreFiles']}** arquivos core ({sp['totalFiles']} totais, {sp['totalCodeLines']:,} linhas de código/schema)",
        f"- **Estratégia recomendada:** {sp['recommendedStrategy']}",
        f"- **Stacks detectados:** {stacks}",
        '',
        '## 1. Pontos de Entrada, Orquestração & APIs',
        '',
    ]

    if ep['workflows']:
        lines.append('### Workflows / CI')
        for wf in ep['workflows']:
            crons = f" · crons: `{', '.join(wf['crons'])}`" if wf.get('crons') else ''
            lines.append(f"- `{wf['file']}` — **{wf['name']}** (triggers: `{', '.join(wf['triggers']) or 'manual'}`{crons})")
        lines.append('')

    if ep['databricksBundles']:
        lines.append('### Databricks Asset Bundles')
        for db in ep['databricksBundles']:
            lines.append(f"- `{db['file']}` — notebooks: {', '.join(f'`{x}`' for x in db.get('notebookPaths', [])[:8]) or 'n/d'} · crons: `{', '.join(db.get('crons', [])) or 'n/d'}`")
        lines.append('')

    if ep.get('adfPipelines'):
        lines.append('### Azure Data Factory / Synapse Pipelines')
        for adf in ep['adfPipelines'][:20]:
            acts = ', '.join(f"`{a['name']}` ({a['type']})" for a in adf.get('activities', [])[:6] if a.get('name'))
            lines.append(f"- `{adf['file']}` — **{adf['name']}**: {acts or 'sem atividades listadas'}")
        lines.append('')

    if ep['endpoints']:
        lines.append('### Rotas API Detectadas')
        lines.append('| Método | Rota | Handler | Arquivo |')
        lines.append('|---|---|---|---|')
        for route in ep['endpoints'][:30]:
            lines.append(f"| `{route['method']}` | `{route['path']}` | `{route.get('handler', '—')}` | `{route['file']}:L{route['line']}` |")
        lines.append('')

    if dossier.get('envAndCliParams'):
        lines.append('### Variáveis de Ambiente, Widgets & Parâmetros CLI')
        lines.append('| Tipo | Parâmetro | Default | Arquivo |')
        lines.append('|---|---|---|---|')
        for prm in dossier['envAndCliParams'][:40]:
            dval = prm.get('default')
            dstr = f"`{dval}`" if dval is not None else '—'
            lines.append(f"| `{prm['kind']}` | `{prm['name']}` | {dstr} | `{prm['file']}:L{prm['line']}` |")
        lines.append('')

    if dossier['iacResources']:
        lines.append('### Recursos Cloud / IaC Extraídos')
        for blk in dossier['iacResources']:
            summary = ', '.join(f"`{r['type']}.{r['name']}`" for r in blk['resources'][:10])
            lines.append(f"- `{blk['file']}`: {summary}")
        lines.append('')

    io_rows: list[tuple[str, str, str, int]] = []
    for path_str, info in sorted(dossier['symbolIndex'].items()):
        for io in info.get('dataIO', []):
            base_tgt = io.get('target') or io.get('format') or io.get('name') or io.get('value') or io.get('key') or io.get('decorator') or '—'
            extras: list[str] = []
            if io.get('format') and io.get('format') != base_tgt:
                extras.append(f"format={io['format']}")
            if io.get('mode'):
                extras.append(f"mode={io['mode']}")
            if io.get('outputMode'):
                extras.append(f"outputMode={io['outputMode']}")
            if io.get('partitionBy'):
                extras.append(f"partitionBy={','.join(io['partitionBy'])}")
            if io.get('trigger'):
                extras.append(f"trigger={json.dumps(io['trigger'], ensure_ascii=False)}")
            if io.get('checkpointLocation'):
                extras.append(f"checkpoint={io['checkpointLocation']}")
            tgt = f"{base_tgt}" + (f" ({'; '.join(extras)})" if extras else '')
            op_label = f"{io.get('op', '')} ({io['method']})" if io.get('method') else str(io.get('op', ''))
            io_rows.append((path_str, op_label, str(tgt), int(io.get('line', 0))))

    if io_rows:
        lines.extend([
            '## 2. Mapa de E/S de Dados (PySpark, Databricks, Cosmos, Event Hubs, Blob, SQL)',
            '',
            '| Arquivo | Operação | Alvo / Formato / Opção | Linha |',
            '|---|---|---|---|',
        ])
        for fp, op, tgt, ln in io_rows[:60]:
            lines.append(f"| `{fp}` | `{op}` | `{tgt.replace('|', '/')}` | `L{ln}` |")
        lines.append('')

    if dossier['sqlLineage'] or dossier['dataContracts']:
        lines.extend(['## 3. Contratos de Dados & Linhagem SQL Extraídos', ''])
        for c in dossier['dataContracts'][:20]:
            cols = ', '.join(f"`{f['name']}: {f['type']}`" for f in c.get('fields', [])[:10])
            more = f" (+{len(c.get('fields', [])) - 10})" if len(c.get('fields', [])) > 10 else ''
            lines.append(f"- **{c['name']}** (`{c['kind']}` em `{c['file']}`): {cols}{more}")
        for sq in dossier['sqlLineage'][:20]:
            tgts = ', '.join(f"`{t['op']} {t['target']}`" for t in sq.get('targets', [])[:5])
            srcs = ', '.join(f"`{s}`" for s in sq.get('sources', [])[:6])
            if tgts or srcs:
                lines.append(f"- `{sq['file']}` ({sq.get('origin', 'sql')}): grava {tgts or 'consulta'} ← lê {srcs or 'n/d'}")
        lines.append('')

    lines.extend(['## 4. Ondas de Leitura Priorizadas (Core → Contratos → Testes sob demanda)', ''])
    wave_titles = {
        'wave1': 'Onda 1 — Entrypoints, Orquestração & Configs (ler primeiro)',
        'wave2': 'Onda 2 — Core Pipeline, Streaming & Regras de Negócio',
        'wave3': 'Onda 3 — Schemas, Modelos, Notebooks Analíticos & SQL',
        'wave4': 'Onda 4 — UI / Referência & Índice de Testes (ler corpo só em dúvida)',
    }
    sym_idx = dossier['symbolIndex']
    for wk in ('wave1', 'wave2', 'wave3', 'wave4'):
        items = dossier['readingWaves'][wk]
        if not items:
            continue
        lines.append(f"### {wave_titles[wk]}")
        for item in items[:35]:
            p = item['path']
            stk = f" · [{', '.join(item['stacks'])}]" if item['stacks'] else ''
            lines.append(f"- **`{p}`** ({item['lines']} linhas · centralidade `{item['centrality']}`{stk})")
            if item['lines'] > 180 and p in sym_idx:
                consts = sym_idx[p].get('constants', [])
                if consts:
                    c_str = ', '.join(f"`{c['name']}={c['value']}`" for c in consts[:6])
                    lines.append(f"  - Constantes: {c_str}")
                syms = sym_idx[p].get('symbols', [])
                if syms:
                    s_str = '; '.join(f"`{s['name']}` (`L{s['startLine']}-L{s['endLine']}`)" for s in syms[:10])
                    lines.append(f"  - Símbolos-chave: {s_str}")
            if wk == 'wave4' and p in dossier['testsIndex']:
                t_names = ', '.join(f"`{t['name']}`" for t in dossier['testsIndex'][p][:8])
                more = f" (+{len(dossier['testsIndex'][p]) - 8})" if len(dossier['testsIndex'][p]) > 8 else ''
                lines.append(f"  - Cobertura verificada: {t_names}{more}")
        lines.append('')

    if dossier['inlineConfigs']:
        lines.extend(['## 5. Resumo Inline de Configurações Pequenas (sem necessidade de reabertura trivial)', ''])
        for cfg_path, summary in sorted(dossier['inlineConfigs'].items())[:15]:
            safe_json = redact_inline_secrets(json.dumps(summary, ensure_ascii=False))[:240]
            lines.append(f"- `{cfg_path}`: `{safe_json}`")
        lines.append('')

    omitted = dossier.get('omittedCounts') or {}
    warnings = dossier.get('parseWarnings') or []
    if omitted or warnings:
        lines.extend(['## 6. Omissões & Avisos de Parsing Estático', ''])
        if omitted:
            summary_om = ', '.join(f"`{k}`: {v}" for k, v in sorted(omitted.items()))
            lines.append(f"- **Arquivos/diretórios omitidos:** {summary_om}")
        for w in warnings[:15]:
            lines.append(f"- **Aviso em `{w['file']}`:** {w['warning']}")
        lines.append('')

    return '\n'.join(lines)
