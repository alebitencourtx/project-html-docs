"""Package the slim distributable runtime ZIP archive for project-html-docs."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import zipfile

ROOT_DEFAULT = Path(__file__).resolve().parents[2]

INCLUDE_FILES = [
    'SKILL.md',
    'LICENSE',
    'package.json',
    'package-lock.json',
]

INCLUDE_DIRS = [
    'agents',
    'scripts',
    'assets',
    'schemas',
    'references',
    'examples/minimal',
]

EXCLUDED_NAMES = {
    '__pycache__',
    '.DS_Store',
    'Thumbs.db',
}

EXCLUDED_REL_FILES = {
    'examples/minimal/documentacao.html',
    'examples/minimal/documentacao.validation.json',
}


def should_exclude(rel_posix: str, path_obj: Path) -> bool:
    parts = rel_posix.split('/')
    if any(part in EXCLUDED_NAMES for part in parts):
        return True
    if path_obj.suffix.lower() in {'.pyc', '.pyo'}:
        return True
    if rel_posix in EXCLUDED_REL_FILES:
        return True
    if '.tmp' in path_obj.name and path_obj.name.endswith('.tmp'):
        return True
    return False


def collect_entries(skill_root: Path) -> list[tuple[Path, str]]:
    entries: list[tuple[Path, str]] = []
    for rel in INCLUDE_FILES:
        p = skill_root / rel
        if not p.is_file():
            raise FileNotFoundError(f'Required skill file missing: {p}')
        entries.append((p, rel))

    for rel_dir in INCLUDE_DIRS:
        base = skill_root / rel_dir
        if not base.is_dir():
            raise FileNotFoundError(f'Required skill directory missing: {base}')
        for file_path in sorted(base.rglob('*')):
            if not file_path.is_file():
                continue
            rel_posix = file_path.relative_to(skill_root).as_posix()
            if should_exclude(rel_posix, file_path):
                continue
            entries.append((file_path, rel_posix))

    entries.sort(key=lambda item: item[1])
    return entries


def build_skill_zip(skill_root: Path = ROOT_DEFAULT, out_path: Path | None = None) -> Path:
    skill_root = skill_root.resolve()
    pkg = json.loads((skill_root / 'package.json').read_text(encoding='utf-8'))
    version = pkg.get('version', '0.0.0')
    if out_path is None:
        out_path = skill_root / 'dist' / f'project-html-docs-v{version}.zip'
    out_path = out_path.resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    entries = collect_entries(skill_root)
    tmp_path = out_path.with_suffix('.zip.tmp')
    try:
        with zipfile.ZipFile(tmp_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
            for src, arcname in entries:
                # Deterministic timestamp >= 1980 for reproducible archives
                info = zipfile.ZipInfo(arcname, date_time=(2026, 11, 15, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                zf.writestr(info, src.read_bytes())
        tmp_path.replace(out_path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()
    return out_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT_DEFAULT, help='Skill repository root')
    parser.add_argument('--out', type=Path, default=None, help='Output .zip file path')
    args = parser.parse_args()

    out = build_skill_zip(args.root, args.out)
    with zipfile.ZipFile(out, 'r') as zf:
        count = len(zf.namelist())
    print(json.dumps({
        'ok': True,
        'archivePath': str(out),
        'files': count,
        'bytes': out.stat().st_size,
    }, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
