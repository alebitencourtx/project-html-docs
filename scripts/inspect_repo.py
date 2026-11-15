"""Static repository inspector, structural dossier builder, and reading-plan generator.

Extracts factual architecture, symbol skeletons, line ranges, dependency graphs,
data-engineering I/O (PySpark, Databricks, Delta Lake, Cosmos DB, Event Hubs,
Blob/ADLS Gen2, SQL/DuckDB/dbt), API routes, IaC resources, and reading waves
without executing project code or calling any LLM.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter, defaultdict, deque
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from typing import Any

SKIP = {
    '.git', 'node_modules', '.venv', 'venv', 'env', '__pycache__', '.runtime',
    'data', 'site', 'dist', 'build', '.mypy_cache', '.pytest_cache',
    'target', 'coverage', '.tox', '.ruff_cache', '.playwright-cli', '.next',
}

EXTENSIONS = {
    '.md', '.mdx', '.rst', '.txt', '.py', '.sh', '.ps1', '.sql', '.hql', '.ddl', '.dml',
    '.j2', '.jinja', '.jinja2', '.avsc', '.graphql', '.json', '.yaml', '.yml',
    '.toml', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.ipynb',
    '.tf', '.hcl', '.bicep', '.java', '.scala', '.go', '.rs', '.cs', '.rb',
    '.php', '.kt', '.proto', '.csv', '.cfg', '.ini',
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
    '.toml': 'config', '.cfg': 'config', '.ini': 'config',
    '.tf': 'infra', '.hcl': 'infra', '.bicep': 'infra',
    '.ipynb': 'notebook', '.csv': 'data',
}

STACK_PATTERNS: dict[str, tuple[str, ...]] = {
    'spark_pyspark': (
        'pyspark', 'sparksession', 'spark.read', 'spark.write', 'spark.table',
        'spark.sql', 'readstream', 'writestream', 'pyspark.sql', 'structtype',
    ),
    'databricks': (
        'databricks', 'dbutils', 'unity_catalog', 'databricks.yml',
        '# databricks notebook source', '# command ----------', 'cloudfiles',
        '@dlt.', 'dlt.table', 'autoloader', 'spark.databricks.',
    ),
    'delta_lake': (
        'deltatable', 'using delta', '.format("delta")', ".format('delta')",
        'merge into', 'delta.tables', 'zorder', 'liquid clustering', 'vacuum ',
    ),
    'cosmos_db': (
        'azure.cosmos', 'cosmosclient', 'cosmos_db', 'cosmos.oltp',
        'com.azure.cosmos.spark', 'get_container_client', 'upsert_item',
        'query_items', 'read_item', 'partition_key',
    ),
    'event_hubs': (
        'azure.eventhub', 'eventhubconsumerclient', 'eventhubproducerclient',
        'format("eventhubs")', "format('eventhubs')", 'eventhubs.connectionstring',
        'spark-sql-kafka', 'checkpointlocation', 'eventhub_name', 'consumer_group',
    ),
    'azure_blob_adls': (
        'azure.storage.blob', 'blobserviceclient', 'azure.storage.filedatalake',
        'datalakeserviceclient', 'abfss://', 'wasbs://', 'wasb://',
        '.blob.core.windows.net', '.dfs.core.windows.net', 'dbutils.fs.mount',
    ),
    'dbt': ('dbt_project.yml', 'profiles.yml', 'dbt_packages', 'ref(', 'source('),
    'sql_warehouse': (
        'duckdb', 'pyarrow', 'parquet', 'snowflake', 'bigquery',
        'synapse', 'create table', 'create or replace',
    ),
    'iceberg': ('iceberg', 'using iceberg'),
    'orchestration': (
        'airflow', 'dag(', '@dag', 'dagster', '@asset', '@job',
        'prefect', '@flow', '@task', '.github/workflows',
    ),
    'api_service': (
        'fastapi', 'apirouter', '@app.get', '@app.post', '@router.get', '@router.post',
        'flask', 'blueprint', 'express()', 'httpx', 'aiohttp', 'pydantic', 'basemodel',
    ),
    'data_quality': ('great_expectations', 'pandera', 'soda', 'dbt-expectations', 'deequ'),
    'terraform_iac': ('.tf', '.hcl', '.bicep', 'azurerm_', 'databricks_'),
}

SECRET_NAME_RE = re.compile(
    r'(?:secret|token|password|passwd|pwd|api_?key|access_?key|private_?key|sas|conn(?:ection)?_?str(?:ing)?|credential|client_secret)',
    re.IGNORECASE,
)

NOISE_DATA_EXTS = {'.csv', '.parquet'}


def is_secret_name(name: str) -> bool:
    return bool(SECRET_NAME_RE.search(name or ''))


def safe_preview_value(name: str, raw_val: Any) -> Any:
    if is_secret_name(name):
        return '<redacted>'
    if isinstance(raw_val, str):
        if len(raw_val) > 120:
            return raw_val[:117] + '...'
        if 'AccountKey=' in raw_val or 'SharedAccessKey=' in raw_val or 'Endpoint=sb://' in raw_val:
            return '<redacted-connection-string>'
        return raw_val
    if isinstance(raw_val, (int, float, bool)) or raw_val is None:
        return raw_val
    if isinstance(raw_val, list):
        return [safe_preview_value(name, x) for x in raw_val[:8]] + (['...'] if len(raw_val) > 8 else [])
    if isinstance(raw_val, dict):
        return {str(k): safe_preview_value(str(k), v) for k, v in list(raw_val.items())[:10]}
    return str(raw_val)[:80]


def detect_stack_signals(posix_path: str, text: str) -> list[str]:
    lower_path = posix_path.lower()
    lower_text = text[:262_144].lower()
    hits: set[str] = set()
    if lower_path.endswith(('.tf', '.hcl', '.bicep')):
        hits.add('terraform_iac')
    if lower_path.endswith(('dbt_project.yml', 'profiles.yml')):
        hits.add('dbt')
    if lower_path.endswith('databricks.yml'):
        hits.add('databricks')
    if '.github/workflows/' in lower_path:
        hits.add('orchestration')
    for stack, tokens in STACK_PATTERNS.items():
        if any(tok in lower_text or tok in lower_path for tok in tokens):
            hits.add(stack)
    return sorted(hits)


def _unparse(node: ast.AST | None) -> str | None:
    if node is None:
        return None
    try:
        return ast.unparse(node)
    except Exception:
        return None


def _const_value(node: ast.AST) -> Any:
    try:
        return ast.literal_eval(node)
    except Exception:
        s = _unparse(node)
        return s[:100] if s else None


def _call_chain(node: ast.AST) -> list[str]:
    parts: list[str] = []
    cur = node
    while isinstance(cur, ast.Attribute):
        parts.append(cur.attr)
        cur = cur.value
    if isinstance(cur, ast.Name):
        parts.append(cur.id)
    elif isinstance(cur, ast.Call):
        parts.extend(_call_chain(cur.func))
    return list(reversed(parts))


def _strip_databricks_cells(text: str) -> tuple[bool, list[dict[str, Any]], str]:
    is_db = '# Databricks notebook source' in text or '# COMMAND ----------' in text
    if not is_db:
        return False, [], text

    raw_cells = re.split(r'^# COMMAND ----------\s*$', text, flags=re.MULTILINE)
    cells: list[dict[str, Any]] = []
    py_lines: list[str] = []
    line_cursor = 1

    for idx, cell in enumerate(raw_cells, start=1):
        lines = cell.splitlines()
        lang = 'python'
        magic_idx = None
        for i, ln in enumerate(lines):
            stripped = ln.strip()
            if not stripped or stripped == '# Databricks notebook source':
                continue
            m = re.match(r'^#\s*MAGIC\s+%([a-zA-Z0-9_-]+)(.*)$', stripped)
            if m:
                lang = m.group(1).lower()
                magic_idx = i
            break

        if lang in ('sql', 'md', 'markdown', 'sh', 'bash', 'scala', 'r', 'fs'):
            clean_cell_lines = []
            for ln in lines:
                s = ln.lstrip()
                if s.startswith('# MAGIC'):
                    clean_cell_lines.append(re.sub(r'^#\s*MAGIC\s?(?:%[a-zA-Z0-9_-]+\s*)?', '', s))
                else:
                    clean_cell_lines.append('')
            cell_text = '\n'.join(clean_cell_lines).strip()
            cells.append({
                'cell': idx,
                'lang': 'markdown' if lang in ('md', 'markdown') else lang,
                'startLine': line_cursor,
                'endLine': line_cursor + max(len(lines) - 1, 0),
                'text': cell_text,
            })
            # Replace non-python cell lines with comments to keep exact line numbers for ast!
            for _ in lines:
                py_lines.append('# [magic cell]')
        else:
            cells.append({
                'cell': idx,
                'lang': 'python',
                'startLine': line_cursor,
                'endLine': line_cursor + max(len(lines) - 1, 0),
                'text': cell.strip(),
            })
            py_lines.extend(lines)
        line_cursor += len(lines) + 1

    return True, cells, '\n'.join(py_lines)


def _extract_regex_python_symbols(text: str) -> list[dict[str, Any]]:
    symbols: list[dict[str, Any]] = []
    for m in re.finditer(r'^(async\s+def|def|class)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(\([^)]*\))?', text, flags=re.MULTILINE):
        line = text[:m.start()].count('\n') + 1
        kind_raw, name, sig = m.group(1), m.group(2), m.group(3) or ''
        kind = 'class' if kind_raw == 'class' else ('async_function' if 'async' in kind_raw else 'function')
        symbols.append({
            'name': name,
            'kind': kind,
            'startLine': line,
            'endLine': line,
            'signature': f"{name}{sig}",
        })
    return symbols


def extract_sql_facts(text: str, origin: str = 'sql') -> dict[str, Any]:
    # Remove single-line and multi-line SQL comments
    cleaned = re.sub(r'/\*[\s\S]*?\*/', ' ', text)
    cleaned = re.sub(r'--[^\n]*', ' ', cleaned)

    targets: list[dict[str, Any]] = []
    ctes: list[str] = []
    sources: list[str] = []
    group_by: list[str] = []
    partitions: list[str] = []
    formats: list[str] = []
    columns: list[dict[str, Any]] = []

    for m in re.finditer(
        r'\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMPORARY\s+|TEMP\s+)?(?:LIVE\s+)?(TABLE|VIEW|MATERIALIZED\s+VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_."`{}-]+)',
        cleaned, re.IGNORECASE
    ):
        kind = m.group(1).upper()
        name = m.group(2).strip('`"')
        targets.append({'op': f'CREATE {kind}', 'target': name})

    for m in re.finditer(r'\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_."`]+)\s*\(([\s\S]{1,3000}?)\)', cleaned, re.IGNORECASE):
        tname = m.group(1).strip('`"')
        body = m.group(2)
        if 'SELECT ' in body.upper():
            continue
        parsed_cols = []
        for raw_col in body.split(','):
            c = raw_col.strip()
            if not c or re.match(r'^(PRIMARY|FOREIGN|UNIQUE|CONSTRAINT|CHECK)\b', c, re.IGNORECASE):
                continue
            parts = c.split()
            if len(parts) >= 2:
                parsed_cols.append({'name': parts[0].strip('`"'), 'type': parts[1]})
        if parsed_cols:
            columns.append({'table': tname, 'columns': parsed_cols[:40]})

    for m in re.finditer(r'\bMERGE\s+INTO\s+([A-Za-z0-9_."`]+)\s+(?:AS\s+\w+\s+)?USING\s+([A-Za-z0-9_."`()]+)', cleaned, re.IGNORECASE):
        targets.append({'op': 'MERGE INTO', 'target': m.group(1).strip('`"')})
        sources.append(m.group(2).strip('`"('))

    for m in re.finditer(r'\bINSERT\s+(?:INTO|OVERWRITE)\s+(?:TABLE\s+)?([A-Za-z0-9_."`]+)', cleaned, re.IGNORECASE):
        targets.append({'op': 'INSERT', 'target': m.group(1).strip('`"')})

    for m in re.finditer(r'\bCOPY\s+INTO\s+([A-Za-z0-9_."`]+)\s+FROM\s+[\'"]([^\'"]+)[\'"]', cleaned, re.IGNORECASE):
        targets.append({'op': 'COPY INTO', 'target': m.group(1).strip('`"')})
        sources.append(m.group(2))

    # WITH CTE names
    for m in re.finditer(r'\b(?:WITH|,)\s*([A-Za-z_][A-Za-z0-9_]*)\s+AS\s*\(', cleaned, re.IGNORECASE):
        cte_name = m.group(1)
        if cte_name.upper() not in {'SELECT', 'INSERT', 'UPDATE', 'DELETE'} and cte_name not in ctes:
            ctes.append(cte_name)

    cte_set = {c.lower() for c in ctes}
    for m in re.finditer(r'\b(?:FROM|JOIN)\s+([A-Za-z0-9_."`{}-]+(?:\([^)]*\))?)', cleaned, re.IGNORECASE):
        src = m.group(1).strip().strip('`"')
        if not src or src.startswith('('):
            continue
        if src.lower() in cte_set:
            continue
        if src not in sources:
            sources.append(src)

    # dbt ref() / source()
    for m in re.finditer(r"""\{\{\s*(ref|source)\(\s*['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?\s*\)\s*\}\}""", text):
        ref_val = f"{m.group(2)}.{m.group(3)}" if m.group(3) else m.group(2)
        if ref_val not in sources:
            sources.append(ref_val)

    for m in re.finditer(r'\bUSING\s+(DELTA|ICEBERG|PARQUET|CSV|JSON|ORC)\b', cleaned, re.IGNORECASE):
        fmt = m.group(1).upper()
        if fmt not in formats:
            formats.append(fmt)

    for m in re.finditer(r'\b(?:PARTITIONED\s+BY|CLUSTER\s+BY)\s*\(([^)]+)\)', cleaned, re.IGNORECASE):
        for p in m.group(1).split(','):
            col = p.strip().split()[0]
            if col and col not in partitions:
                partitions.append(col)

    for m in re.finditer(r'\bGROUP\s+BY\s+([^\n;]+?)(?=\b(?:HAVING|ORDER|LIMIT|QUALIFY|WINDOW|UNION|;|$))', cleaned, re.IGNORECASE):
        raw_grp = re.sub(r'\s+', ' ', m.group(1)).strip()
        if raw_grp and len(raw_grp) <= 120 and raw_grp not in group_by:
            group_by.append(raw_grp)

    return {
        'origin': origin,
        'targets': targets[:30],
        'ctes': ctes[:30],
        'sources': sources[:40],
        'formats': formats,
        'partitions': partitions,
        'groupBy': group_by[:15],
        'ddlSchemas': columns[:15],
    }


def extract_python_facts(posix_path: str, text: str) -> dict[str, Any]:
    is_db, db_cells, py_source = _strip_databricks_cells(text)
    is_test_file = bool(re.search(r'(?:^|/)test_[^/]+\.py$|_test\.py$', posix_path))

    result: dict[str, Any] = {
        'isDatabricksNotebook': is_db,
        'notebookCells': [{'cell': c['cell'], 'lang': c['lang'], 'startLine': c['startLine'], 'endLine': c['endLine']} for c in db_cells] if is_db else [],
        'imports': [],
        'constants': [],
        'symbols': [],
        'schemas': [],
        'dataIO': [],
        'endpoints': [],
        'testsIndex': [],
        'hasMainGuard': "__name__ == '__main__'" in text or '__name__ == "__main__"' in text,
        'sqlBlocks': [],
    }

    # Extract SQL cells from Databricks notebook
    if is_db:
        for c in db_cells:
            if c['lang'] == 'sql' and c['text']:
                sql_info = extract_sql_facts(c['text'], origin=f"cell:{c['cell']}")
                if sql_info['targets'] or sql_info['sources'] or sql_info['ddlSchemas']:
                    result['sqlBlocks'].append(sql_info)

    try:
        tree = ast.parse(py_source)
    except SyntaxError:
        result['symbols'] = _extract_regex_python_symbols(py_source)
        return result

    router_prefixes: dict[str, str] = {}

    # Top-level pass: imports, constants, router prefixes, classes & functions
    for node in tree.body:
        if isinstance(node, ast.Import):
            for alias in node.names:
                result['imports'].append({'module': alias.name, 'names': [], 'level': 0})
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ''
            names = [a.name for a in node.names]
            result['imports'].append({'module': mod, 'names': names, 'level': node.level})
        elif isinstance(node, ast.Assign):
            for tgt in node.targets:
                if isinstance(tgt, ast.Name):
                    # Detect APIRouter(prefix="/v1/...")
                    if isinstance(node.value, ast.Call) and 'APIRouter' in (_unparse(node.value.func) or ''):
                        for kw in node.value.keywords:
                            if kw.arg == 'prefix':
                                router_prefixes[tgt.id] = str(_const_value(kw.value) or '')
                    if tgt.id.isupper() and len(tgt.id) >= 2:
                        result['constants'].append({
                            'name': tgt.id,
                            'line': node.lineno,
                            'value': safe_preview_value(tgt.id, _const_value(node.value)),
                        })
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            if node.target.id.isupper() and len(node.target.id) >= 2 and node.value is not None:
                result['constants'].append({
                    'name': node.target.id,
                    'line': node.lineno,
                    'value': safe_preview_value(node.target.id, _const_value(node.value)),
                })

        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            decs = [_unparse(d) or '' for d in node.decorator_list]
            doc = ast.get_docstring(node)
            first_doc = doc.splitlines()[0].strip()[:140] if doc else None
            args_list = [a.arg + (f': {_unparse(a.annotation)}' if a.annotation else '') for a in node.args.args]
            ret = _unparse(node.returns)
            sig = f"{node.name}({', '.join(args_list)})" + (f" -> {ret}" if ret else '')

            if is_test_file and node.name.startswith('test_'):
                result['testsIndex'].append({
                    'name': node.name,
                    'startLine': node.lineno,
                    'endLine': getattr(node, 'end_lineno', node.lineno),
                    'doc': first_doc,
                })
            else:
                result['symbols'].append({
                    'name': node.name,
                    'kind': 'async_function' if isinstance(node, ast.AsyncFunctionDef) else 'function',
                    'startLine': node.lineno,
                    'endLine': getattr(node, 'end_lineno', node.lineno),
                    'decorators': decs[:4],
                    'signature': sig[:220],
                    'doc': first_doc,
                })

            # HTTP API Route decorators (FastAPI / Flask / Starlette)
            for dec_node in node.decorator_list:
                if isinstance(dec_node, ast.Call):
                    chain = _call_chain(dec_node.func)
                    if len(chain) >= 2 and chain[-1].lower() in {'get', 'post', 'put', 'delete', 'patch', 'route', 'api_route'}:
                        obj_name = chain[0]
                        method = chain[-1].upper()
                        route_path = _const_value(dec_node.args[0]) if dec_node.args else None
                        if isinstance(route_path, str):
                            prefix = router_prefixes.get(obj_name, '')
                            result['endpoints'].append({
                                'method': method,
                                'path': prefix + route_path,
                                'handler': node.name,
                                'line': node.lineno,
                            })

            # Databricks DLT table/view decorators
            for dec_text in decs:
                if 'dlt.table' in dec_text or 'dlt.view' in dec_text:
                    result['dataIO'].append({
                        'op': 'dlt_definition',
                        'target': node.name,
                        'decorator': dec_text[:120],
                        'line': node.lineno,
                    })

        elif isinstance(node, ast.ClassDef):
            bases = [_unparse(b) or '' for b in node.bases]
            decs = [_unparse(d) or '' for d in node.decorator_list]
            doc = ast.get_docstring(node)
            first_doc = doc.splitlines()[0].strip()[:140] if doc else None

            is_schema = any(b in {'BaseModel', 'TypedDict', 'SQLModel'} for b in bases) or any('dataclass' in d for d in decs)
            methods: list[dict[str, Any]] = []
            schema_fields: list[dict[str, str]] = []

            for sub in node.body:
                if isinstance(sub, ast.AnnAssign) and isinstance(sub.target, ast.Name):
                    schema_fields.append({'name': sub.target.id, 'type': _unparse(sub.annotation) or 'Any'})
                elif isinstance(sub, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    if is_test_file and sub.name.startswith('test_'):
                        result['testsIndex'].append({
                            'name': f"{node.name}.{sub.name}",
                            'startLine': sub.lineno,
                            'endLine': getattr(sub, 'end_lineno', sub.lineno),
                        })
                    else:
                        sub_args = [a.arg for a in sub.args.args if a.arg != 'self']
                        methods.append({
                            'name': sub.name,
                            'startLine': sub.lineno,
                            'endLine': getattr(sub, 'end_lineno', sub.lineno),
                            'signature': f"{sub.name}({', '.join(sub_args[:6])})",
                        })

            result['symbols'].append({
                'name': node.name,
                'kind': 'schema_model' if is_schema else 'class',
                'bases': bases,
                'decorators': decs[:4],
                'startLine': node.lineno,
                'endLine': getattr(node, 'end_lineno', node.lineno),
                'methods': methods[:25],
                'doc': first_doc,
            })
            if is_schema and schema_fields:
                result['schemas'].append({
                    'name': node.name,
                    'kind': 'pydantic' if 'BaseModel' in bases else ('typeddict' if 'TypedDict' in bases else 'dataclass'),
                    'line': node.lineno,
                    'fields': schema_fields[:40],
                })

    # Walk all AST Call nodes for Data Engineering & Cloud I/O patterns (outside test files to avoid mock noise)
    if not is_test_file:
        seen_io: set[tuple[int, str]] = set()
        for sub in ast.walk(tree):
            if not isinstance(sub, ast.Call):
                continue
            chain = _call_chain(sub.func)
            joined = '.'.join(chain)
            line = getattr(sub, 'lineno', 0)

            # 1. PySpark / Delta / Auto Loader / Event Hubs / Cosmos Spark read & write chains
            io_entry: dict[str, Any] | None = None
            arg0 = _const_value(sub.args[0]) if sub.args else None

            if 'spark' in chain and ('readStream' in chain or 'read' in chain) and chain[-1] in {'load', 'table', 'parquet', 'delta', 'json', 'csv', 'orc', 'text'}:
                is_stream = 'readStream' in chain
                io_entry = {
                    'op': 'spark_read_stream' if is_stream else 'spark_read',
                    'method': chain[-1],
                    'target': safe_preview_value('target', arg0) if isinstance(arg0, str) else _unparse(sub.args[0]) if sub.args else None,
                    'line': line,
                }
            elif ('writeStream' in chain or 'write' in chain) and chain[-1] in {'save', 'saveAsTable', 'start', 'parquet', 'delta', 'json', 'csv'}:
                is_stream = 'writeStream' in chain
                io_entry = {
                    'op': 'spark_write_stream' if is_stream else 'spark_write',
                    'method': chain[-1],
                    'target': safe_preview_value('target', arg0) if isinstance(arg0, str) else _unparse(sub.args[0]) if sub.args else None,
                    'line': line,
                }
            elif joined.endswith(('spark.sql', 'duckdb.execute', 'con.execute', 'conn.execute')) and isinstance(arg0, str):
                sql_info = extract_sql_facts(arg0, origin=f"line:{line}")
                if sql_info['targets'] or sql_info['sources']:
                    result['sqlBlocks'].append(sql_info)
                io_entry = {
                    'op': 'sql_execute',
                    'method': joined,
                    'target': ', '.join(t['target'] for t in sql_info['targets']) or ', '.join(sql_info['sources'][:3]) or safe_preview_value('sql', arg0),
                    'line': line,
                }
            elif joined.endswith(('DeltaTable.forName', 'DeltaTable.forPath')):
                io_entry = {
                    'op': 'delta_table',
                    'method': chain[-1],
                    'target': safe_preview_value('target', _const_value(sub.args[1]) if len(sub.args) > 1 else arg0),
                    'line': line,
                }
            elif 'dbutils' in chain and chain[-2:] == ['widgets', 'get'] and isinstance(arg0, str):
                io_entry = {'op': 'databricks_widget', 'name': arg0, 'line': line}
            elif 'dbutils' in chain and chain[-2:] == ['secrets', 'get']:
                scope = _const_value(sub.args[0]) if len(sub.args) >= 1 else None
                key = _const_value(sub.args[1]) if len(sub.args) >= 2 else None
                io_entry = {'op': 'databricks_secret_ref', 'scope': str(scope), 'key': str(key), 'line': line}
            elif chain[-1:] in (['CosmosClient'], ['get_container_client'], ['upsert_item'], ['create_item'], ['query_items'], ['read_item']):
                io_entry = {'op': 'cosmos_db', 'method': chain[-1], 'target': safe_preview_value('target', arg0) if isinstance(arg0, str) else None, 'line': line}
            elif chain[-1:] in (['EventHubConsumerClient'], ['EventHubProducerClient'], ['from_connection_string'], ['send_batch'], ['receive_batch']) and any('eventhub' in c.lower() or 'producer' in c.lower() or 'consumer' in c.lower() for c in chain):
                io_entry = {'op': 'event_hubs', 'method': chain[-1], 'target': safe_preview_value('target', arg0) if isinstance(arg0, str) else None, 'line': line}
            elif chain[-1:] in (['BlobServiceClient'], ['DataLakeServiceClient'], ['get_blob_client'], ['get_container_client'], ['get_file_system_client'], ['upload_blob'], ['download_blob']) and any('blob' in c.lower() or 'datalake' in c.lower() or 'file_system' in c.lower() for c in chain):
                io_entry = {'op': 'azure_blob_adls', 'method': chain[-1], 'target': safe_preview_value('target', arg0) if isinstance(arg0, str) else None, 'line': line}
            elif chain[-1] == 'StructType' and sub.args:
                fields = []
                if isinstance(sub.args[0], ast.List):
                    for elt in sub.args[0].elts:
                        if isinstance(elt, ast.Call) and 'StructField' in (_unparse(elt.func) or '') and len(elt.args) >= 2:
                            fname = _const_value(elt.args[0])
                            ftype = _unparse(elt.args[1])
                            if isinstance(fname, str):
                                fields.append({'name': fname, 'type': ftype or 'unknown'})
                if fields:
                    result['schemas'].append({'name': f'StructType@L{line}', 'kind': 'pyspark_struct', 'line': line, 'fields': fields[:50]})
            elif joined.endswith(('pa.schema', 'pyarrow.schema')) and sub.args and isinstance(sub.args[0], ast.List):
                fields = []
                for elt in sub.args[0].elts:
                    if isinstance(elt, ast.Call) and 'field' in (_unparse(elt.func) or '') and len(elt.args) >= 2:
                        fname = _const_value(elt.args[0])
                        ftype = _unparse(elt.args[1])
                        if isinstance(fname, str):
                            fields.append({'name': fname, 'type': ftype or 'unknown'})
                if fields:
                    result['schemas'].append({'name': f'ArrowSchema@L{line}', 'kind': 'pyarrow', 'line': line, 'fields': fields[:50]})

            if io_entry is not None:
                key = (line, f"{io_entry.get('op')}:{io_entry.get('method')}")
                if key not in seen_io:
                    seen_io.add(key)
                    result['dataIO'].append(io_entry)

        # Also catch explicit cloud storage URIs and Spark .format(...) / .option("checkpointLocation", ...)
        for m in re.finditer(r"""['"]((?:abfss?|wasbs?|dbfs|s3a?|gs)://[^'"\s]{3,120})['"]""", py_source):
            line = py_source[:m.start()].count('\n') + 1
            uri = m.group(1)
            if not is_secret_name(uri):
                key = (line, f"uri:{uri}")
                if key not in seen_io:
                    seen_io.add(key)
                    result['dataIO'].append({'op': 'storage_uri', 'target': uri, 'line': line})

        for m in re.finditer(r"""\.format\(\s*['"]([^'"]+)['"]\s*\)|\.option\(\s*['"](checkpointLocation|path|dbtable|spark\.cosmos\.accountEndpoint|spark\.cosmos\.database|spark\.cosmos\.container|eventhubs\.name)['"]\s*,\s*([^)]+)\)""", py_source):
            line = py_source[:m.start()].count('\n') + 1
            if m.group(1):
                result['dataIO'].append({'op': 'spark_format', 'format': m.group(1), 'line': line})
            else:
                opt_k = m.group(2)
                opt_v = m.group(3).strip()[:80]
                result['dataIO'].append({'op': 'spark_option', 'key': opt_k, 'value': safe_preview_value(opt_k, opt_v), 'line': line})

    return result


def extract_ipynb_facts(posix_path: str, text: str) -> dict[str, Any]:
    try:
        nb = json.loads(text)
    except Exception:
        return {'parseError': True}

    code_cells: list[str] = []
    sql_cells: list[str] = []
    for cell in nb.get('cells', []):
        if cell.get('cell_type') != 'code':
            continue
        src = ''.join(cell.get('source', [])) if isinstance(cell.get('source'), list) else str(cell.get('source', ''))
        stripped = src.lstrip()
        if stripped.startswith(('%%sql', '%sql')):
            sql_cells.append(re.sub(r'^%%?sql[^\n]*\n?', '', stripped))
        elif stripped.startswith(('%md', '%fs', '%sh', '%%bash')):
            continue
        else:
            # Remove single-line %magic calls before AST parsing
            clean_lines = [('# ' + ln if ln.lstrip().startswith('%') else ln) for ln in src.splitlines()]
            code_cells.append('\n'.join(clean_lines))

    merged_py = '\n\n'.join(code_cells)
    facts = extract_python_facts(posix_path, merged_py) if merged_py.strip() else {
        'isDatabricksNotebook': False, 'imports': [], 'constants': [],
        'symbols': [], 'schemas': [], 'dataIO': [], 'endpoints': [], 'testsIndex': [],
        'hasMainGuard': False, 'sqlBlocks': [],
    }
    for idx, sql_txt in enumerate(sql_cells, start=1):
        sql_info = extract_sql_facts(sql_txt, origin=f"ipynb_sql:{idx}")
        if sql_info['targets'] or sql_info['sources'] or sql_info['ddlSchemas']:
            facts['sqlBlocks'].append(sql_info)
    facts['notebookCellCount'] = len(nb.get('cells', []))
    return facts


def extract_js_ts_facts(posix_path: str, text: str) -> dict[str, Any]:
    is_test = bool(re.search(r'\.(?:test|spec)\.[cm]?[jt]sx?$', posix_path))
    imports = []
    for m in re.finditer(r"""(?:import\s+[\s\S]*?\s+from\s+|require\()\s*['"]([^'"]+)['"]""", text):
        imports.append({'module': m.group(1), 'names': [], 'level': 0})

    symbols = []
    for m in re.finditer(r'^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)', text, flags=re.MULTILINE):
        line = text[:m.start()].count('\n') + 1
        symbols.append({'name': m.group(1), 'kind': 'function', 'startLine': line, 'endLine': line, 'signature': f"{m.group(1)}({m.group(2)[:80]})"})
    for m in re.finditer(r'^(?:export\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)', text, flags=re.MULTILINE):
        line = text[:m.start()].count('\n') + 1
        symbols.append({'name': m.group(1), 'kind': 'class', 'startLine': line, 'endLine': line})

    endpoints = []
    for m in re.finditer(r"""\b(?:app|router|fastify)\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]""", text):
        line = text[:m.start()].count('\n') + 1
        endpoints.append({'method': m.group(1).upper(), 'path': m.group(2), 'line': line})

    tests_index = []
    if is_test:
        for m in re.finditer(r"""\b(?:test|it)\(\s*['"]([^'"]{2,120})['"]""", text):
            line = text[:m.start()].count('\n') + 1
            tests_index.append({'name': m.group(1), 'startLine': line})

    return {
        'imports': imports,
        'symbols': [] if is_test else symbols[:40],
        'endpoints': endpoints,
        'testsIndex': tests_index[:50],
    }


def extract_workflow_or_config(posix_path: str, text: str) -> dict[str, Any]:
    lower = posix_path.lower()
    info: dict[str, Any] = {}

    if '.github/workflows/' in lower and lower.endswith(('.yml', '.yaml')):
        name_m = re.search(r'^name:\s*(.+)$', text, flags=re.MULTILINE)
        crons = re.findall(r"""cron:\s*['"]([^'"]+)['"]""", text)
        runs = re.findall(r'run:\s*(.+)$', text, flags=re.MULTILINE)
        triggers = re.findall(r'^\s{2}(push|pull_request|schedule|workflow_dispatch|workflow_call)\s*:', text, flags=re.MULTILINE)
        info['workflow'] = {
            'name': name_m.group(1).strip().strip("'\"") if name_m else posix_path,
            'triggers': sorted(set(triggers)),
            'crons': crons,
            'runCommands': [r.strip()[:120] for r in runs[:15]],
        }
    elif lower.endswith('databricks.yml') or lower.endswith('databricks.yaml'):
        nb_paths = re.findall(r'notebook_path:\s*([^\s#]+)', text)
        py_files = re.findall(r'python_file:\s*([^\s#]+)', text)
        jobs = re.findall(r'^\s{4,6}([A-Za-z0-9_-]+):\s*(?:#.*)?$', text, flags=re.MULTILINE)
        crons = re.findall(r"""quartz_cron_expression:\s*['"]([^'"]+)['"]""", text)
        info['databricksBundle'] = {
            'notebookPaths': sorted(set(nb_paths)),
            'pythonFiles': sorted(set(py_files)),
            'crons': crons,
            'blocks': jobs[:20],
        }
    elif lower.endswith('.json') and len(text.encode('utf-8')) <= 8192:
        try:
            obj = json.loads(text)
            if isinstance(obj, dict):
                if posix_path == 'package.json' or lower.endswith('/package.json'):
                    info['inlineSummary'] = {
                        'name': obj.get('name'),
                        'version': obj.get('version'),
                        'scripts': obj.get('scripts', {}),
                        'dependencies': list((obj.get('dependencies') or {}).keys())[:25],
                    }
                else:
                    info['inlineSummary'] = safe_preview_value('config', obj)
        except Exception:
            pass
    elif lower.endswith('.toml') and len(text.encode('utf-8')) <= 8192:
        scripts = re.findall(r'^([A-Za-z0-9_-]+)\s*=\s*[\'"]([^\'"]+)[\'"]', text, flags=re.MULTILINE)
        info['inlineSummary'] = {k: safe_preview_value(k, v) for k, v in scripts[:20]}

    return info


def extract_iac_resources(posix_path: str, text: str) -> list[dict[str, str]]:
    resources: list[dict[str, str]] = []
    if posix_path.endswith(('.tf', '.hcl')):
        for m in re.finditer(r'resource\s+"([^"]+)"\s+"([^"]+)"', text):
            resources.append({'type': m.group(1), 'name': m.group(2)})
    elif posix_path.endswith('.bicep'):
        for m in re.finditer(r"""resource\s+([A-Za-z0-9_]+)\s+['"]([^'"]+)['"]""", text):
            resources.append({'type': m.group(2), 'name': m.group(1)})
    return resources[:30]


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
    for ext in ('', '.ts', '.tsx', '.js', '.mjs', '.cjs', '/index.ts', '/index.js'):
        cand = norm + ext
        if cand in all_paths and cand != from_file:
            return cand
    return None


def inspect(root: Path, includes: list[str] | None = None, excludes: list[str] | None = None) -> dict[str, Any]:
    root = root.resolve()
    includes = [x for x in (includes or []) if x]
    excludes = [x for x in (excludes or []) if x]

    def git(*args: str) -> str | None:
        r = subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True, encoding='utf-8', errors='replace')
        return r.stdout.strip() if r.returncode == 0 else None

    def selected(rel: Path) -> bool:
        posix = rel.as_posix()
        if includes and not any(token in posix for token in includes):
            return False
        if any(token in posix for token in excludes):
            return False
        return True

    files: list[dict[str, Any]] = []
    stack_counts: Counter[str] = Counter()
    kind_counts: Counter[str] = Counter()
    stacks_by_file: dict[str, list[str]] = {}

    file_details: dict[str, dict[str, Any]] = {}
    sql_lineage: list[dict[str, Any]] = []
    endpoints: list[dict[str, Any]] = []
    notebooks: list[dict[str, Any]] = []
    data_contracts: list[dict[str, Any]] = []
    iac_resources: list[dict[str, Any]] = []
    workflows: list[dict[str, Any]] = []
    databricks_bundles: list[dict[str, Any]] = []
    inline_configs: dict[str, Any] = {}
    tests_index: dict[str, list[dict[str, Any]]] = {}

    total_code_lines = 0

    for directory, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in SKIP and not (Path(directory) / d).is_symlink())
        for name in sorted(names):
            p = Path(directory) / name
            if p.is_symlink() or name.startswith('.env') and name != '.env.example':
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

            # Deep extraction
            ext = p.suffix.lower()
            if ext == '.py':
                py_facts = extract_python_facts(posix, text)
                file_details[posix] = py_facts
                if py_facts['isDatabricksNotebook']:
                    notebooks.append({
                        'path': posix,
                        'format': 'databricks_py',
                        'cells': len(py_facts['notebookCells']),
                        'languages': sorted({c['lang'] for c in py_facts['notebookCells']}),
                    })
                for ep in py_facts['endpoints']:
                    endpoints.append({'file': posix, **ep})
                for sc in py_facts['schemas']:
                    data_contracts.append({'file': posix, **sc})
                for sb in py_facts['sqlBlocks']:
                    sql_lineage.append({'file': posix, **sb})
                if py_facts['testsIndex']:
                    tests_index[posix] = py_facts['testsIndex']

            elif ext == '.ipynb':
                nb_facts = extract_ipynb_facts(posix, text)
                file_details[posix] = nb_facts
                notebooks.append({
                    'path': posix,
                    'format': 'ipynb',
                    'cells': nb_facts.get('notebookCellCount', 0),
                })
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

            elif ext in {'.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'}:
                js_facts = extract_js_ts_facts(posix, text)
                file_details[posix] = js_facts
                for ep in js_facts['endpoints']:
                    endpoints.append({'file': posix, **ep})
                if js_facts['testsIndex']:
                    tests_index[posix] = js_facts['testsIndex']

            elif ext in {'.tf', '.hcl', '.bicep'}:
                res = extract_iac_resources(posix, text)
                if res:
                    iac_resources.append({'file': posix, 'resources': res})
                    file_details[posix] = {'iac': res}

            elif ext in {'.yml', '.yaml', '.json', '.toml'}:
                cfg = extract_workflow_or_config(posix, text)
                if cfg:
                    file_details[posix] = cfg
                    if 'workflow' in cfg:
                        workflows.append({'file': posix, **cfg['workflow']})
                    if 'databricksBundle' in cfg:
                        databricks_bundles.append({'file': posix, **cfg['databricksBundle']})
                    if 'inlineSummary' in cfg:
                        inline_configs[posix] = cfg['inlineSummary']

    # Build Python module index (supporting both root packages and src/<pkg>/ layouts)
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

    # Build directed dependency graph
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

    # Table producers -> SQL consumers
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
        elif p.endswith(('.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx')):
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
        elif 'workflow' in det:
            joined_cmd = ' '.join(det['workflow'].get('runCommands', []))
            for cand in all_paths:
                if cand.endswith(('.py', '.sh', '.mjs', '.js')) and (cand in joined_cmd or Path(cand).name in joined_cmd):
                    add_edge(p, cand, 'workflow_run')

    for item in sql_lineage:
        consumer = item['file']
        for src_tbl in item.get('sources', []):
            for prod in table_producers.get(src_tbl.lower(), []):
                add_edge(prod, consumer, 'sql_lineage')

    # Assign Reading Waves & Centrality Score
    file_map = {f['path']: f for f in files}
    waves: dict[str, list[dict[str, Any]]] = {'wave1': [], 'wave2': [], 'wave3': [], 'wave4': []}

    for f in files:
        p = f['path']
        lower = p.lower()
        kind = f['kind']
        det = file_details.get(p, {})
        is_test = bool(re.search(r'(?:^|/)tests?/|test_[^/]+\.py$|_test\.py$|\.(?:test|spec)\.', lower))

        score = (in_degree[p] * 2) + out_degree[p]
        if det.get('hasMainGuard') or det.get('endpoints'):
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

    # Compact symbol & dataIO index for dossier consumption
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
        'dossierVersion': '1.4.0',
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
            'endpoints': endpoints,
            'cliOrMainFiles': [p for p, d in file_details.items() if d.get('hasMainGuard')],
        },
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

    if ep['endpoints']:
        lines.append('### Rotas API Detectadas')
        lines.append('| Método | Rota | Handler | Arquivo |')
        lines.append('|---|---|---|---|')
        for route in ep['endpoints'][:30]:
            lines.append(f"| `{route['method']}` | `{route['path']}` | `{route.get('handler', '—')}` | `{route['file']}:L{route['line']}` |")
        lines.append('')

    if dossier['iacResources']:
        lines.append('### Recursos Cloud / IaC Extraídos')
        for blk in dossier['iacResources']:
            summary = ', '.join(f"`{r['type']}.{r['name']}`" for r in blk['resources'][:10])
            lines.append(f"- `{blk['file']}`: {summary}")
        lines.append('')

    # Data I/O Summary
    io_rows: list[tuple[str, str, str, int]] = []
    for path_str, info in sorted(dossier['symbolIndex'].items()):
        for io in info.get('dataIO', []):
            tgt = io.get('target') or io.get('format') or io.get('name') or io.get('value') or io.get('key') or io.get('decorator') or '—'
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
            # If file > 180 lines, show symbol line-range map so agent can slice!
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
            lines.append(f"- `{cfg_path}`: `{json.dumps(summary, ensure_ascii=False)[:240]}`")
        lines.append('')

    return '\n'.join(lines)


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
    result = inspect(args.repository, includes, excludes)

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
