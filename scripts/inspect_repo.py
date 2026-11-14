"""List documentation source candidates without importing or executing project code."""
import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path

SKIP = {'.git', 'node_modules', '.venv', 'venv', '__pycache__', '.runtime', 'data', 'site', 'dist', 'build'}
EXTENSIONS = {'.md', '.py', '.sql', '.json', '.yaml', '.yml', '.toml', '.js', '.ts', '.html', '.ipynb'}

def inspect(root):
    root = root.resolve()
    def git(*args):
        r = subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True, encoding='utf-8', errors='replace')
        return r.stdout.strip() if r.returncode == 0 else None
    files = []
    for directory, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in SKIP and not (Path(directory)/d).is_symlink())
        for name in sorted(names):
            p = Path(directory)/name
            if p.is_symlink() or name.startswith('.env') or p.suffix.lower() not in EXTENSIONS:
                continue
            size = p.stat().st_size
            if size > 2_000_000:
                continue
            raw = p.read_bytes()
            files.append({'path': p.relative_to(root).as_posix(), 'bytes': size, 'sha256': hashlib.sha256(raw).hexdigest()})
    return {'repository': str(root), 'revision': git('rev-parse', 'HEAD'), 'workingTreeChanges': git('status', '--short'), 'files': files, 'note': 'Candidate source paths only; no semantic extraction or production execution.'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('repository', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    result = inspect(args.repository)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f"Inventoried {len(result['files'])} sources; revision {result['revision']}")
