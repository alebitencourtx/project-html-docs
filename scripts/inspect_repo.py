"""Static repository inspector, structural dossier builder, and reading-plan generator.

Thin CLI & re-export entrypoint delegating implementation to `scripts/inspector/`.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from inspector import (  # noqa: E402
    detect_stack_signals,
    extract_iac_resources,
    extract_ipynb_facts,
    extract_js_ts_facts,
    extract_python_facts,
    extract_scala_facts,
    extract_sql_facts,
    extract_workflow_or_config,
    inspect,
    is_secret_name,
    redact_inline_secrets,
    redact_sensitive_text,
    render_reading_plan,
    safe_preview_value,
)
from inspector.extractors import STACK_PATTERNS  # noqa: E402
from inspector.graph import EXTENSIONS, GENERATED_ARTIFACT_PATTERNS, KIND, NOISE_DATA_EXTS, SKIP, SPECIAL_NAMES  # noqa: E402

__all__ = [
    'SKIP',
    'EXTENSIONS',
    'SPECIAL_NAMES',
    'KIND',
    'STACK_PATTERNS',
    'NOISE_DATA_EXTS',
    'GENERATED_ARTIFACT_PATTERNS',
    'is_secret_name',
    'redact_inline_secrets',
    'redact_sensitive_text',
    'safe_preview_value',
    'detect_stack_signals',
    'extract_sql_facts',
    'extract_python_facts',
    'extract_ipynb_facts',
    'extract_js_ts_facts',
    'extract_scala_facts',
    'extract_workflow_or_config',
    'extract_iac_resources',
    'inspect',
    'render_reading_plan',
]

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('repository', type=Path)
    parser.add_argument('--out', required=True, type=Path, help='Output JSON inventory/dossier path')
    parser.add_argument('--plan', type=Path, default=None, help='Optional output Markdown reading-plan path')
    parser.add_argument('--include', default='', help='Comma-separated path fragments to include')
    parser.add_argument('--exclude', default='', help='Comma-separated path fragments to exclude')
    args = parser.parse_args()

    includes = [x.strip() for x in args.include.split(',') if x.strip()]
    excludes = [x.strip() for x in args.exclude.split(',') if x.strip()]
    ignore_set = {str(args.out.resolve())}
    if args.plan is not None:
        ignore_set.add(str(args.plan.resolve()))
    result = inspect(args.repository, includes, excludes, ignore_paths=ignore_set)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    if args.plan is not None:
        args.plan.parent.mkdir(parents=True, exist_ok=True)
        args.plan.write_text(render_reading_plan(result), encoding='utf-8')

    sp = result['scaleProfile']
    print(
        f"Inventoried {len(result['files'])} sources ({sp['tier']}, {sp['totalCodeLines']} lines); "
        f"revision {result['revision']}"
    )
