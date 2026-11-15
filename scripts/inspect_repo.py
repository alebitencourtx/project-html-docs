"""List documentation source candidates and detect data-engineering stack signals without executing project code."""
import argparse
from collections import Counter
import hashlib
import json
import os
import subprocess
from pathlib import Path

SKIP = {
    '.git', 'node_modules', '.venv', 'venv', '__pycache__', '.runtime',
    'data', 'site', 'dist', 'build', '.mypy_cache', '.pytest_cache',
    'target', 'coverage', '.tox', '.ruff_cache',
}
EXTENSIONS = {
    '.md', '.mdx', '.rst', '.txt', '.py', '.sh', '.ps1', '.sql', '.hql', '.ddl', '.dml',
    '.j2', '.jinja', '.jinja2', '.avsc', '.graphql', '.json', '.yaml', '.yml',
    '.toml', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.ipynb', '.tf', '.hcl',
    '.java', '.scala', '.go', '.rs', '.cs', '.rb', '.php', '.kt', '.proto', '.csv', '.cfg', '.ini',
}
SPECIAL_NAMES = {'Dockerfile', 'Makefile', 'Procfile', 'Jenkinsfile'}
KIND = {
    '.md': 'docs', '.mdx': 'docs', '.rst': 'docs', '.txt': 'docs', '.html': 'docs',
    '.py': 'code', '.sh': 'code', '.ps1': 'code', '.js': 'code', '.mjs': 'code', '.cjs': 'code',
    '.ts': 'code', '.tsx': 'code', '.jsx': 'code', '.java': 'code', '.scala': 'code', '.go': 'code',
    '.rs': 'code', '.cs': 'code', '.rb': 'code', '.php': 'code', '.kt': 'code',
    '.sql': 'schema', '.hql': 'schema', '.ddl': 'schema', '.dml': 'schema',
    '.proto': 'schema', '.avsc': 'schema', '.graphql': 'schema',
    '.j2': 'template', '.jinja': 'template', '.jinja2': 'template',
    '.json': 'config', '.yaml': 'config', '.yml': 'config',
    '.toml': 'config', '.cfg': 'config', '.ini': 'config', '.tf': 'infra', '.hcl': 'infra',
    '.ipynb': 'notebook', '.csv': 'data',
}

STACK_PATTERNS = {
    'dbt': ('dbt_project.yml', 'profiles.yml', 'dbt_packages', 'ref(', 'source('),
    'spark_pyspark': ('pyspark', 'sparksession', 'spark.read', 'spark.table'),
    'databricks': ('databricks', 'dbutils', 'unity_catalog', 'databricks.yml'),
    'delta_lake': ('delta', 'deltatable', 'using delta', 'merge into'),
    'iceberg': ('iceberg', 'using iceberg'),
    'airflow': ('airflow', 'dag(', '@dag', 'pythonoperator'),
    'dagster': ('dagster', '@asset', '@job'),
    'prefect': ('prefect', '@flow', '@task'),
    'duckdb': ('duckdb',),
    'polars': ('polars',),
    'pandas': ('pandas',),
    'data_quality': ('great_expectations', 'pandera', 'soda', 'dbt-expectations', 'tests:'),
    'terraform_iac': ('.tf', '.hcl'),
}


def detect_stack_signals(posix_path, raw_bytes):
    lower_path = posix_path.lower()
    hits = set()
    if lower_path.endswith(('.tf', '.hcl')):
        hits.add('terraform_iac')
    if lower_path.endswith(('dbt_project.yml', 'profiles.yml')):
        hits.add('dbt')
    if lower_path.endswith('databricks.yml'):
        hits.add('databricks')
    if len(raw_bytes) <= 262_144:
        text = raw_bytes.decode('utf-8', errors='ignore').lower()
        for stack, tokens in STACK_PATTERNS.items():
            if any(tok in text or tok in lower_path for tok in tokens):
                hits.add(stack)
    return sorted(hits)


def inspect(root, includes=None, excludes=None):
    root = root.resolve()
    includes = [x for x in (includes or []) if x]
    excludes = [x for x in (excludes or []) if x]

    def git(*args):
        r = subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True, encoding='utf-8', errors='replace')
        return r.stdout.strip() if r.returncode == 0 else None

    def selected(rel):
        posix = rel.as_posix()
        if includes and not any(token in posix for token in includes):
            return False
        if any(token in posix for token in excludes):
            return False
        return True

    files = []
    stack_counts = Counter()
    kind_counts = Counter()

    for directory, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in SKIP and not (Path(directory) / d).is_symlink())
        for name in sorted(names):
            p = Path(directory) / name
            if p.is_symlink() or name.startswith('.env'):
                continue
            if p.suffix.lower() not in EXTENSIONS and name not in SPECIAL_NAMES:
                continue
            rel = p.relative_to(root)
            if not selected(rel):
                continue
            size = p.stat().st_size
            if size > 2_000_000:
                continue
            raw = p.read_bytes()
            posix = rel.as_posix()
            kind = KIND.get(p.suffix.lower(), 'infra' if name in SPECIAL_NAMES else 'other')
            kind_counts[kind] += 1
            for sig in detect_stack_signals(posix, raw):
                stack_counts[sig] += 1
            files.append({
                'path': posix,
                'bytes': size,
                'kind': kind,
                'sha256': hashlib.sha256(raw).hexdigest(),
            })

    return {
        'repository': str(root),
        'revision': git('rev-parse', 'HEAD'),
        'workingTreeChanges': git('status', '--short'),
        'includes': includes,
        'excludes': excludes,
        'countsByKind': dict(sorted(kind_counts.items())),
        'stackSignals': dict(sorted(stack_counts.items())),
        'files': files,
        'note': 'Candidate source paths and static stack signals only; no semantic extraction or production execution.',
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('repository', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--include', default='', help='comma-separated path fragments to include')
    parser.add_argument('--exclude', default='', help='comma-separated path fragments to exclude')
    args = parser.parse_args()
    includes = [x.strip() for x in args.include.split(',') if x.strip()]
    excludes = [x.strip() for x in args.exclude.split(',') if x.strip()]
    result = inspect(args.repository, includes, excludes)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Inventoried {len(result['files'])} sources; revision {result['revision']}")
