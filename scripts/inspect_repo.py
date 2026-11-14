"""List documentation source candidates without importing or executing project code."""
import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path

SKIP = {'.git', 'node_modules', '.venv', 'venv', '__pycache__', '.runtime', 'data', 'site', 'dist', 'build', '.mypy_cache', '.pytest_cache', 'target', 'coverage'}
EXTENSIONS = {
    '.md', '.mdx', '.rst', '.txt', '.py', '.sh', '.ps1', '.sql', '.json', '.yaml', '.yml',
    '.toml', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.ipynb', '.tf', '.hcl',
    '.java', '.scala', '.go', '.rs', '.cs', '.rb', '.php', '.kt', '.proto', '.csv', '.cfg', '.ini',
}
SPECIAL_NAMES = {'Dockerfile', 'Makefile', 'Procfile', 'Jenkinsfile'}
KIND = {
    '.md': 'docs', '.mdx': 'docs', '.rst': 'docs', '.txt': 'docs', '.html': 'docs',
    '.py': 'code', '.sh': 'code', '.ps1': 'code', '.js': 'code', '.mjs': 'code', '.cjs': 'code',
    '.ts': 'code', '.tsx': 'code', '.jsx': 'code', '.java': 'code', '.scala': 'code', '.go': 'code',
    '.rs': 'code', '.cs': 'code', '.rb': 'code', '.php': 'code', '.kt': 'code',
    '.sql': 'schema', '.proto': 'schema', '.json': 'config', '.yaml': 'config', '.yml': 'config',
    '.toml': 'config', '.cfg': 'config', '.ini': 'config', '.tf': 'infra', '.hcl': 'infra',
    '.ipynb': 'notebook', '.csv': 'data',
}


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
            files.append({
                'path': rel.as_posix(),
                'bytes': size,
                'kind': KIND.get(p.suffix.lower(), 'infra' if name in SPECIAL_NAMES else 'other'),
                'sha256': hashlib.sha256(raw).hexdigest(),
            })
    return {
        'repository': str(root),
        'revision': git('rev-parse', 'HEAD'),
        'workingTreeChanges': git('status', '--short'),
        'includes': includes,
        'excludes': excludes,
        'files': files,
        'note': 'Candidate source paths only; no semantic extraction or production execution.',
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
