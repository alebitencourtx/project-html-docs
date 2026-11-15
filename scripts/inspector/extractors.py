"""Language- and framework-specific static extractors for inspect_repo."""
from __future__ import annotations

import ast
import json
from pathlib import Path
import re
from typing import Any

from .redaction import is_secret_name, redact_inline_secrets, safe_preview_value
from .sql_parser import extract_sql_facts

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
        'com.azure.cosmos.spark', 'upsert_item', 'create_item',
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
    'scala': ('org.apache.spark', 'case class ', 'object ', ' extends app'),
}


def detect_stack_signals(posix_path: str, text: str) -> list[str]:
    lower_path = posix_path.lower()
    lower_text = text[:262_144].lower()
    hits: set[str] = set()
    if lower_path.endswith(('.tf', '.hcl', '.bicep')):
        hits.add('terraform_iac')
    if lower_path.endswith('.scala'):
        hits.add('scala')
    if lower_path.endswith(('dbt_project.yml', 'profiles.yml')):
        hits.add('dbt')
    if lower_path.endswith('databricks.yml'):
        hits.add('databricks')
    if '.github/workflows/' in lower_path:
        hits.add('orchestration')
    if lower_path.endswith('.json') and '"activities"' in lower_text and (
        '"linkedservicename"' in lower_text
        or '"databricksnotebook"' in lower_text
        or '"microsoft.datafactory"' in lower_text
        or '"microsoft.synapse"' in lower_text
    ):
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


def _spark_chain_details(call_node: ast.Call) -> dict[str, Any]:
    details: dict[str, Any] = {}
    options: dict[str, Any] = {}
    cur: ast.AST = call_node
    while isinstance(cur, (ast.Call, ast.Attribute)):
        if isinstance(cur, ast.Call):
            if isinstance(cur.func, ast.Attribute):
                mname = cur.func.attr
                if mname == 'format' and cur.args:
                    fmt = _const_value(cur.args[0])
                    if fmt is not None:
                        details['format'] = str(fmt)
                elif mname == 'mode' and cur.args:
                    md = _const_value(cur.args[0])
                    if md is not None:
                        details['mode'] = str(md)
                elif mname == 'outputMode' and cur.args:
                    om = _const_value(cur.args[0])
                    if om is not None:
                        details['outputMode'] = str(om)
                elif mname == 'partitionBy' and cur.args:
                    details['partitionBy'] = [
                        str(_const_value(a) or _unparse(a) or '')
                        for a in cur.args
                        if _const_value(a) or _unparse(a)
                    ]
                elif mname == 'trigger':
                    trig = {kw.arg: _const_value(kw.value) for kw in cur.keywords if kw.arg}
                    if trig:
                        details['trigger'] = trig
                elif mname == 'option' and len(cur.args) >= 2:
                    ok = str(_const_value(cur.args[0]) or '')
                    ov = _const_value(cur.args[1])
                    if ok:
                        if ok == 'checkpointLocation':
                            details['checkpointLocation'] = safe_preview_value(ok, ov)
                        options[ok] = safe_preview_value(ok, ov)
                elif mname == 'options':
                    for kw in cur.keywords:
                        if kw.arg:
                            options[kw.arg] = safe_preview_value(kw.arg, _const_value(kw.value))
                cur = cur.func.value
            else:
                break
        else:
            cur = cur.value
    if options:
        details['options'] = options
    return details


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
        for ln in lines:
            stripped = ln.strip()
            if not stripped or stripped == '# Databricks notebook source':
                continue
            m = re.match(r'^#\s*MAGIC\s+%([a-zA-Z0-9_-]+)(.*)$', stripped)
            if m:
                lang = m.group(1).lower()
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


def _collect_python_type_hints(tree: ast.AST) -> dict[str, str]:
    hints: dict[str, str] = {}
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            all_args = [*node.args.posonlyargs, *node.args.args, *node.args.kwonlyargs]
            for a in all_args:
                if a.annotation:
                    ann = _unparse(a.annotation)
                    if ann:
                        hints[a.arg] = ann
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.annotation:
            ann = _unparse(node.annotation)
            if ann:
                hints[node.target.id] = ann
        elif isinstance(node, ast.Assign) and isinstance(node.value, ast.Call):
            c_txt = _unparse(node.value.func)
            if c_txt:
                for tgt in node.targets:
                    if isinstance(tgt, ast.Name):
                        hints.setdefault(tgt.id, c_txt)
    return hints


def _classify_container_client_call(
    chain: list[str],
    var_types: dict[str, str],
    imported_modules: set[str],
) -> str | None:
    chain_lower = '.'.join(chain).lower()
    if any(tok in chain_lower for tok in ('blob', 'datalake', 'file_system')):
        return 'azure_blob_adls'
    if 'cosmos' in chain_lower:
        return 'cosmos_db'
    for part in chain[:-1]:
        t = var_types.get(part, '').lower()
        if any(tok in t for tok in ('blob', 'datalake', 'filesystem')):
            return 'azure_blob_adls'
        if 'cosmos' in t:
            return 'cosmos_db'
    has_blob_imp = any(m.startswith('azure.storage.blob') or m.startswith('azure.storage.filedatalake') for m in imported_modules)
    has_cosmos_imp = any(m.startswith('azure.cosmos') for m in imported_modules)
    if has_blob_imp and not has_cosmos_imp:
        return 'azure_blob_adls'
    if has_cosmos_imp and not has_blob_imp:
        return 'cosmos_db'
    return None


def extract_python_facts(posix_path: str, text: str) -> dict[str, Any]:
    is_db, db_cells, py_source = _strip_databricks_cells(text)
    is_test_file = bool(re.search(r'(?:^|/)test_[^/]+\.py$|_test\.py$', posix_path))

    result: dict[str, Any] = {
        'isDatabricksNotebook': is_db,
        'notebookCells': [
            {'cell': c['cell'], 'lang': c['lang'], 'startLine': c['startLine'], 'endLine': c['endLine']}
            for c in db_cells
        ] if is_db else [],
        'notebookCalls': [],
        'imports': [],
        'constants': [],
        'envAndCliParams': [],
        'symbols': [],
        'schemas': [],
        'dataIO': [],
        'endpoints': [],
        'testsIndex': [],
        'hasMainGuard': "__name__ == '__main__'" in text or '__name__ == "__main__"' in text,
        'sqlBlocks': [],
    }

    for m in re.finditer(r'^(?:#\s*MAGIC\s+)?%run\s+([^\s#]+)', text, flags=re.MULTILINE):
        nb_target = m.group(1).strip('\'"')
        line = text[:m.start()].count('\n') + 1
        if nb_target:
            result['notebookCalls'].append(nb_target)
            result['dataIO'].append({'op': 'notebook_run', 'method': '%run', 'target': nb_target, 'line': line})

    if is_db:
        for c in db_cells:
            if c['lang'] == 'sql' and c['text']:
                sql_info = extract_sql_facts(c['text'], origin=f"cell:{c['cell']}")
                if sql_info['targets'] or sql_info['sources'] or sql_info['ddlSchemas']:
                    result['sqlBlocks'].append(sql_info)

    try:
        tree = ast.parse(py_source)
    except SyntaxError as exc:
        result['symbols'] = _extract_regex_python_symbols(py_source)
        result['parseWarning'] = f'Python SyntaxError at L{exc.lineno or 0}: {exc.msg}'
        return result

    router_prefixes: dict[str, str] = {}
    imported_modules: set[str] = set()

    for node in tree.body:
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported_modules.add(alias.name)
                result['imports'].append({'module': alias.name, 'names': [], 'level': 0})
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ''
            names = [a.name for a in node.names]
            if mod:
                imported_modules.add(mod)
            result['imports'].append({'module': mod, 'names': names, 'level': node.level})
        elif isinstance(node, ast.Assign):
            for tgt in node.targets:
                if isinstance(tgt, ast.Name):
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

    if not is_test_file:
        var_types = _collect_python_type_hints(tree)
        seen_io: set[tuple[int, str]] = set()
        seen_params: set[tuple[str, str, int]] = set()
        ast_spark_lines: set[int] = set()

        def add_param(p_kind: str, p_name: str, p_line: int, default_val: Any = None, help_txt: str | None = None) -> None:
            if not p_name or (p_kind, p_name, p_line) in seen_params:
                return
            seen_params.add((p_kind, p_name, p_line))
            entry: dict[str, Any] = {'kind': p_kind, 'name': p_name, 'line': p_line}
            if default_val is not None:
                entry['default'] = safe_preview_value(p_name, default_val)
            if help_txt:
                entry['help'] = redact_inline_secrets(str(help_txt))[:120]
            result['envAndCliParams'].append(entry)

        for fn_node in ast.walk(tree):
            if isinstance(fn_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for dec in fn_node.decorator_list:
                    if isinstance(dec, ast.Call):
                        dchain = _call_chain(dec.func)
                        if dchain and dchain[-1] in {'option', 'argument'} and any('click' in c.lower() or 'typer' in c.lower() for c in dchain):
                            flags = [str(_const_value(a)) for a in dec.args if isinstance(_const_value(a), str)]
                            if flags:
                                kw_map = {kw.arg: _const_value(kw.value) for kw in dec.keywords if kw.arg}
                                add_param('cli_option', ', '.join(flags), getattr(dec, 'lineno', fn_node.lineno), kw_map.get('default'), kw_map.get('help'))

        for sub in ast.walk(tree):
            if isinstance(sub, ast.Subscript):
                val_txt = _unparse(sub.value) or ''
                if val_txt.endswith('os.environ') or val_txt == 'environ':
                    env_name = _const_value(sub.slice)
                    if isinstance(env_name, str):
                        add_param('env', env_name, getattr(sub, 'lineno', 0))
                continue

            if isinstance(sub, ast.Dict):
                raw_keys = [_const_value(k) for k in sub.keys if k is not None]
                str_keys = [k for k in raw_keys if isinstance(k, str)]
                if any(k.startswith(('spark.cosmos.', 'eventhubs.', 'fs.azure.', 'kafka.')) for k in str_keys):
                    line = getattr(sub, 'lineno', 0)
                    preview: dict[str, Any] = {}
                    for k, v in zip(sub.keys, sub.values):
                        k_val = _const_value(k)
                        if isinstance(k_val, str):
                            preview[k_val] = safe_preview_value(k_val, _const_value(v))
                    key = (line, f"config_dict:{','.join(sorted(preview.keys())[:3])}")
                    if key not in seen_io:
                        seen_io.add(key)
                        result['dataIO'].append({'op': 'spark_config_dict', 'keys': sorted(preview.keys())[:12], 'options': preview, 'line': line})
                continue

            if not isinstance(sub, ast.Call):
                continue
            chain = _call_chain(sub.func)
            if not chain:
                continue
            last = chain[-1]
            joined = '.'.join(chain)
            line = getattr(sub, 'lineno', 0)

            arg0 = _const_value(sub.args[0]) if sub.args else None
            if joined in {'os.getenv', 'os.environ.get'} and isinstance(arg0, str):
                def_val = _const_value(sub.args[1]) if len(sub.args) > 1 else None
                for kw in sub.keywords:
                    if kw.arg == 'default':
                        def_val = _const_value(kw.value)
                add_param('env', arg0, line, def_val)
            elif last == 'add_argument' and isinstance(arg0, str):
                flags = [str(_const_value(a)) for a in sub.args if isinstance(_const_value(a), str)]
                kw_map = {kw.arg: _const_value(kw.value) for kw in sub.keywords if kw.arg}
                add_param('cli_arg', ', '.join(flags) or arg0, line, kw_map.get('default'), kw_map.get('help'))
            elif last == 'Option' and any('typer' in c.lower() for c in chain):
                kw_map = {kw.arg: _const_value(kw.value) for kw in sub.keywords if kw.arg}
                opt_flags = [str(_const_value(a)) for a in sub.args[1:] if isinstance(_const_value(a), str)]
                add_param('cli_option', ', '.join(opt_flags) or f'Option@L{line}', line, arg0, kw_map.get('help'))

            io_entry: dict[str, Any] | None = None

            if 'spark' in chain and ('readStream' in chain or 'read' in chain) and last in {'load', 'table', 'parquet', 'delta', 'json', 'csv', 'orc', 'text'}:
                is_stream = 'readStream' in chain
                chain_meta = _spark_chain_details(sub)
                ast_spark_lines.add(line)
                io_entry = {
                    'op': 'spark_read_stream' if is_stream else 'spark_read',
                    'method': last,
                    'target': safe_preview_value('target', arg0) if isinstance(arg0, str) else (_unparse(sub.args[0]) if sub.args else None),
                    'line': line,
                    **chain_meta,
                }
            elif ('writeStream' in chain or 'write' in chain) and last in {'save', 'saveAsTable', 'toTable', 'table', 'start', 'parquet', 'delta', 'json', 'csv', 'orc', 'text'}:
                is_stream = 'writeStream' in chain
                chain_meta = _spark_chain_details(sub)
                ast_spark_lines.add(line)
                io_entry = {
                    'op': 'spark_write_stream' if is_stream else 'spark_write',
                    'method': last,
                    'target': safe_preview_value('target', arg0) if isinstance(arg0, str) else (_unparse(sub.args[0]) if sub.args else None),
                    'line': line,
                    **chain_meta,
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
                    'method': last,
                    'target': safe_preview_value('target', _const_value(sub.args[1]) if len(sub.args) > 1 else arg0),
                    'line': line,
                }
            elif 'dbutils' in chain and chain[-2:] == ['notebook', 'run'] and isinstance(arg0, str):
                result['notebookCalls'].append(arg0)
                io_entry = {'op': 'notebook_run', 'method': 'dbutils.notebook.run', 'target': arg0, 'line': line}
            elif 'dbutils' in chain and chain[-2:] == ['widgets', 'get'] and isinstance(arg0, str):
                io_entry = {'op': 'databricks_widget', 'name': arg0, 'line': line}
                add_param('databricks_widget', arg0, line)
            elif 'dbutils' in chain and chain[-2:] == ['secrets', 'get']:
                scope = _const_value(sub.args[0]) if len(sub.args) >= 1 else None
                key = _const_value(sub.args[1]) if len(sub.args) >= 2 else None
                io_entry = {'op': 'databricks_secret_ref', 'scope': str(scope), 'key': str(key), 'line': line}
            elif last == 'get_container_client':
                classified = _classify_container_client_call(chain, var_types, imported_modules)
                if classified:
                    io_entry = {'op': classified, 'method': last, 'target': safe_preview_value('target', arg0) if isinstance(arg0, str) else None, 'line': line}
            elif last in {'BlobServiceClient', 'DataLakeServiceClient', 'get_blob_client', 'get_file_system_client', 'upload_blob', 'download_blob'} and (
                any('blob' in c.lower() or 'datalake' in c.lower() or 'file_system' in c.lower() for c in chain)
                or last in {'BlobServiceClient', 'DataLakeServiceClient', 'upload_blob', 'download_blob'}
            ):
                io_entry = {'op': 'azure_blob_adls', 'method': last, 'target': safe_preview_value('target', arg0) if isinstance(arg0, str) else None, 'line': line}
            elif last in {'CosmosClient', 'upsert_item', 'create_item', 'query_items', 'read_item'}:
                io_entry = {'op': 'cosmos_db', 'method': last, 'target': safe_preview_value('target', arg0) if isinstance(arg0, str) else None, 'line': line}
            elif last in {'EventHubConsumerClient', 'EventHubProducerClient', 'from_connection_string', 'send_batch', 'receive_batch'} and any('eventhub' in c.lower() or 'producer' in c.lower() or 'consumer' in c.lower() for c in chain):
                io_entry = {'op': 'event_hubs', 'method': last, 'target': safe_preview_value('target', arg0) if isinstance(arg0, str) else None, 'line': line}
            elif last == 'StructType' and sub.args:
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

        for m in re.finditer(r"""['"]((?:abfss?|wasbs?|dbfs|s3a?|gs)://[^'"\s]{3,120})['"]""", py_source):
            line = py_source[:m.start()].count('\n') + 1
            uri = m.group(1)
            if not is_secret_name(uri):
                key = (line, f"uri:{uri}")
                if key not in seen_io:
                    seen_io.add(key)
                    result['dataIO'].append({'op': 'storage_uri', 'target': redact_inline_secrets(uri), 'line': line})

        for m in re.finditer(r"""\.format\(\s*['"]([^'"]+)['"]\s*\)|\.option\(\s*['"](checkpointLocation|path|dbtable|spark\.cosmos\.accountEndpoint|spark\.cosmos\.database|spark\.cosmos\.container|eventhubs\.name)['"]\s*,\s*([^)]+)\)""", py_source):
            line = py_source[:m.start()].count('\n') + 1
            if line in ast_spark_lines:
                continue
            if m.group(1):
                key = (line, f"spark_format:{m.group(1)}")
                if key not in seen_io:
                    seen_io.add(key)
                    result['dataIO'].append({'op': 'spark_format', 'format': m.group(1), 'line': line})
            else:
                opt_k = m.group(2)
                opt_v = m.group(3).strip()[:80]
                key = (line, f"spark_option:{opt_k}")
                if key not in seen_io:
                    seen_io.add(key)
                    result['dataIO'].append({'op': 'spark_option', 'key': opt_k, 'value': safe_preview_value(opt_k, opt_v), 'line': line})

    return result


def extract_ipynb_facts(posix_path: str, text: str) -> dict[str, Any]:
    try:
        nb = json.loads(text)
    except Exception as exc:
        return {'parseError': True, 'parseWarning': f'Invalid ipynb JSON: {str(exc)[:120]}'}

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
            clean_lines = [('# ' + ln if ln.lstrip().startswith('%') else ln) for ln in src.splitlines()]
            code_cells.append('\n'.join(clean_lines))

    merged_py = '\n\n'.join(code_cells)
    facts = extract_python_facts(posix_path, merged_py) if merged_py.strip() else {
        'isDatabricksNotebook': False, 'notebookCalls': [], 'imports': [], 'constants': [],
        'envAndCliParams': [], 'symbols': [], 'schemas': [], 'dataIO': [],
        'endpoints': [], 'testsIndex': [], 'hasMainGuard': False, 'sqlBlocks': [],
    }
    for idx, sql_txt in enumerate(sql_cells, start=1):
        sql_info = extract_sql_facts(sql_txt, origin=f"ipynb_sql:{idx}")
        if sql_info['targets'] or sql_info['sources'] or sql_info['ddlSchemas']:
            facts['sqlBlocks'].append(sql_info)
    facts['notebookCellCount'] = len(nb.get('cells', []))
    return facts


def extract_js_ts_facts(posix_path: str, text: str) -> dict[str, Any]:
    is_test = bool(re.search(r'\.(?:test|spec)\.[cm]?[jt]sx?$', posix_path))
    imports: list[dict[str, Any]] = []
    seen_mods: set[str] = set()

    def add_mod(mod: str) -> None:
        if mod and mod not in seen_mods:
            seen_mods.add(mod)
            imports.append({'module': mod, 'names': [], 'level': 0})

    for pat in (
        r"""(?:import|export)\s+(?:type\s+)?(?:\*\s+(?:as\s+[A-Za-z_$][A-Za-z0-9_$]*\s+)?|[\s\S]*?)\s+from\s+['"]([^'"]+)['"]""",
        r"""^\s*import\s+['"]([^'"]+)['"]""",
        r"""\b(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)""",
    ):
        flags = re.MULTILINE if pat.startswith('^') else 0
        for m in re.finditer(pat, text, flags=flags):
            add_mod(m.group(1))

    symbols = []
    seen_sym_names: set[tuple[str, int]] = set()
    for m in re.finditer(r'^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)', text, flags=re.MULTILINE):
        line = text[:m.start()].count('\n') + 1
        seen_sym_names.add((m.group(1), line))
        symbols.append({'name': m.group(1), 'kind': 'function', 'startLine': line, 'endLine': line, 'signature': f"{m.group(1)}({m.group(2)[:80]})"})
    for m in re.finditer(r'^(?:export\s+(?:default\s+)?)?(?:const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?(?:\(([^)]*)\)|([A-Za-z_$][A-Za-z0-9_$]*))\s*=>', text, flags=re.MULTILINE):
        line = text[:m.start()].count('\n') + 1
        name = m.group(1)
        params = m.group(2) if m.group(2) is not None else (m.group(3) or '')
        if (name, line) not in seen_sym_names:
            seen_sym_names.add((name, line))
            symbols.append({'name': name, 'kind': 'function', 'startLine': line, 'endLine': line, 'signature': f"{name}({params[:80]})"})
    for m in re.finditer(r'^(?:export\s+(?:default\s+)?)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)', text, flags=re.MULTILINE):
        line = text[:m.start()].count('\n') + 1
        symbols.append({'name': m.group(1), 'kind': 'class', 'startLine': line, 'endLine': line})

    schemas = []
    if posix_path.endswith(('.ts', '.tsx', '.mts', '.cts')) and not is_test:
        for m in re.finditer(r'^(?:export\s+)?(interface|type)\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\s+(?:extends\s+[^{=]+)?|\s*=)\s*\{([^}]{1,1500}?)\}', text, flags=re.MULTILINE):
            line = text[:m.start()].count('\n') + 1
            fields = []
            for raw_ln in re.split(r'[;\n]', m.group(3)):
                fm = re.match(r'^\s*(?:readonly\s+)?([A-Za-z_$][A-Za-z0-9_$]*\??)\s*:\s*([^;/\n]+)', raw_ln)
                if fm:
                    fields.append({'name': fm.group(1), 'type': fm.group(2).strip().rstrip(';,')[:60]})
            if fields:
                schemas.append({'name': m.group(2), 'kind': f'ts_{m.group(1)}', 'line': line, 'fields': fields[:40]})
        for m in re.finditer(r'^(?:export\s+)?enum\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\{([^}]{1,800}?)\}', text, flags=re.MULTILINE):
            line = text[:m.start()].count('\n') + 1
            members = []
            for raw_ln in re.split(r'[,\n]', m.group(2)):
                em = re.match(r'^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:=.*)?$', raw_ln)
                if em:
                    members.append({'name': em.group(1), 'type': 'enum_member'})
            if members:
                schemas.append({'name': m.group(1), 'kind': 'ts_enum', 'line': line, 'fields': members[:40]})

    env_cli_params = []
    seen_env: set[tuple[str, int]] = set()
    if not is_test:
        for m in re.finditer(r"""(?:process\.env(?:\?\.|\.)([A-Z][A-Z0-9_]*)|process\.env(?:\?\.)?\[['"]([A-Z][A-Z0-9_]*)['"]\]|import\.meta\.env(?:\?\.|\.)([A-Z][A-Z0-9_]*))""", text):
            ename = m.group(1) or m.group(2) or m.group(3)
            line = text[:m.start()].count('\n') + 1
            if ename and (ename, line) not in seen_env:
                seen_env.add((ename, line))
                env_cli_params.append({'kind': 'env', 'name': ename, 'line': line})

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
        'schemas': schemas[:30],
        'envAndCliParams': env_cli_params[:40],
        'endpoints': endpoints,
        'testsIndex': tests_index[:50],
    }


def extract_scala_facts(posix_path: str, text: str) -> dict[str, Any]:
    imports = [{'module': m.group(1).strip(), 'names': [], 'level': 0} for m in re.finditer(r'^\s*import\s+([^\s;]+)', text, flags=re.MULTILINE)]
    symbols: list[dict[str, Any]] = []
    for m in re.finditer(r'^\s*(?:sealed\s+|abstract\s+|final\s+|case\s+)*(class|object|trait|def)\s+([A-Za-z_][A-Za-z0-9_]*)', text, flags=re.MULTILINE):
        line = text[:m.start()].count('\n') + 1
        symbols.append({'name': m.group(2), 'kind': m.group(1), 'startLine': line, 'endLine': line})

    data_io: list[dict[str, Any]] = []
    for m in re.finditer(r'\bspark\.(readStream|read)\b[\s\S]{0,180}?\.(load|table|parquet|delta|json|csv|orc|text)\s*\(\s*(?:[\'"]([^\'"]*)[\'"])?', text):
        line = text[:m.start()].count('\n') + 1
        op = 'spark_read_stream' if m.group(1) == 'readStream' else 'spark_read'
        data_io.append({'op': op, 'method': m.group(2), 'target': safe_preview_value('target', m.group(3) or None), 'line': line})
    for m in re.finditer(r'\.(writeStream|write)\b[\s\S]{0,180}?\.(save|saveAsTable|toTable|table|start)\s*\(\s*(?:[\'"]([^\'"]*)[\'"])?', text):
        line = text[:m.start()].count('\n') + 1
        op = 'spark_write_stream' if m.group(1) == 'writeStream' else 'spark_write'
        data_io.append({'op': op, 'method': m.group(2), 'target': safe_preview_value('target', m.group(3) or None), 'line': line})
    for m in re.finditer(r'\.format\(\s*[\'"]([^\'"]+)[\'"]\s*\)', text):
        line = text[:m.start()].count('\n') + 1
        data_io.append({'op': 'spark_format', 'format': m.group(1), 'line': line})

    return {
        'imports': imports[:40],
        'symbols': symbols[:50],
        'dataIO': data_io[:40],
        'hasMainGuard': bool(re.search(r'\bdef\s+main\s*\(|\bextends\s+App\b', text)),
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
            'runCommands': [redact_inline_secrets(r.strip())[:120] for r in runs[:15]],
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
    elif lower.endswith('.json') and len(text.encode('utf-8')) <= 262_144:
        try:
            obj = json.loads(text)
            if isinstance(obj, dict):
                props = obj.get('properties') if isinstance(obj.get('properties'), dict) else {}
                if isinstance(props.get('activities'), list):
                    acts = []
                    for act in props['activities'][:40]:
                        if not isinstance(act, dict):
                            continue
                        tp = act.get('typeProperties') if isinstance(act.get('typeProperties'), dict) else {}
                        nb_path = tp.get('notebookPath')
                        if isinstance(nb_path, dict):
                            nb_path = nb_path.get('value')
                        acts.append({
                            'name': act.get('name'),
                            'type': act.get('type'),
                            'dependsOn': [d.get('activity') for d in (act.get('dependsOn') or []) if isinstance(d, dict) and d.get('activity')],
                            'notebookPath': str(nb_path) if nb_path else None,
                            'inputs': [i.get('referenceName') for i in (act.get('inputs') or []) if isinstance(i, dict) and i.get('referenceName')],
                            'outputs': [o.get('referenceName') for o in (act.get('outputs') or []) if isinstance(o, dict) and o.get('referenceName')],
                        })
                    info['adfPipeline'] = {
                        'name': obj.get('name') or Path(posix_path).stem,
                        'activities': acts,
                    }
                elif len(text.encode('utf-8')) <= 8192:
                    if posix_path == 'package.json' or lower.endswith('/package.json'):
                        raw_scripts = obj.get('scripts', {})
                        safe_scripts = {
                            str(k): redact_inline_secrets(str(v))[:120]
                            for k, v in (raw_scripts.items() if isinstance(raw_scripts, dict) else [])
                        }
                        info['inlineSummary'] = {
                            'name': obj.get('name'),
                            'version': obj.get('version'),
                            'scripts': safe_scripts,
                            'dependencies': list((obj.get('dependencies') or {}).keys())[:25],
                        }
                    else:
                        info['inlineSummary'] = safe_preview_value('config', obj)
        except Exception as exc:
            info['parseWarning'] = f'Invalid JSON: {str(exc)[:120]}'
    elif lower.endswith('.toml') and len(text.encode('utf-8')) <= 8192:
        scripts = re.findall(r'^([A-Za-z0-9_-]+)\s*=\s*[\'"]([^\'"]+)[\'"]', text, flags=re.MULTILINE)
        info['inlineSummary'] = {k: safe_preview_value(k, redact_inline_secrets(v)) for k, v in scripts[:20]}

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
