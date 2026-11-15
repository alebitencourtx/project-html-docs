"""SQL and DDL static fact extraction with balanced parenthesis/bracket scanning."""
from __future__ import annotations

import re
from typing import Any

CONSTRAINT_PREFIX_RE = re.compile(
    r'^(PRIMARY|FOREIGN|UNIQUE|CONSTRAINT|CHECK|INDEX|KEY|FULLTEXT|SPATIAL|LIKE)\b',
    re.IGNORECASE,
)


def _extract_balanced_parens(text: str, open_idx: int, max_scan: int = 60_000) -> tuple[str, int] | None:
    if open_idx < 0 or open_idx >= len(text) or text[open_idx] != '(':
        return None
    depth = 0
    in_quote: str | None = None
    limit = min(len(text), open_idx + max_scan)
    i = open_idx
    while i < limit:
        ch = text[i]
        if in_quote is not None:
            if ch == in_quote:
                if i + 1 < limit and text[i + 1] == in_quote:
                    i += 2
                    continue
                in_quote = None
            elif ch == '\\' and in_quote != '`' and i + 1 < limit:
                i += 2
                continue
            i += 1
            continue
        if ch in ("'", '"', '`'):
            in_quote = ch
        elif ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0:
                return text[open_idx + 1:i], i
        i += 1
    return None


def _split_top_level_sql_items(body: str) -> list[str]:
    items: list[str] = []
    cur: list[str] = []
    paren_depth = 0
    angle_depth = 0
    in_quote: str | None = None
    n = len(body)
    i = 0
    while i < n:
        ch = body[i]
        if in_quote is not None:
            cur.append(ch)
            if ch == in_quote:
                if i + 1 < n and body[i + 1] == in_quote:
                    cur.append(body[i + 1])
                    i += 2
                    continue
                in_quote = None
            elif ch == '\\' and in_quote != '`' and i + 1 < n:
                cur.append(body[i + 1])
                i += 2
                continue
            i += 1
            continue

        if ch in ("'", '"', '`'):
            in_quote = ch
            cur.append(ch)
        elif ch == '(':
            paren_depth += 1
            cur.append(ch)
        elif ch == ')':
            if paren_depth > 0:
                paren_depth -= 1
            cur.append(ch)
        elif ch == '<':
            angle_depth += 1
            cur.append(ch)
        elif ch == '>':
            if angle_depth > 0:
                angle_depth -= 1
            cur.append(ch)
        elif ch == ',' and paren_depth == 0 and angle_depth == 0:
            segment = ''.join(cur).strip()
            if segment:
                items.append(segment)
            cur = []
            i += 1
            continue
        else:
            cur.append(ch)
        i += 1

    tail = ''.join(cur).strip()
    if tail:
        items.append(tail)
    return items


def _parse_ddl_column(raw_col: str) -> dict[str, str] | None:
    c = raw_col.strip()
    if not c or CONSTRAINT_PREFIX_RE.match(c):
        return None
    m = re.match(r'^(`[^`]+`|"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)\s+(.+)$', c, re.DOTALL)
    if not m:
        return None
    col_name = m.group(1).strip('`"')
    rest = re.sub(r'\s+', ' ', m.group(2)).strip()

    # Extract type expression preserving balanced (...) like DECIMAL(10, 2) or <...> like STRUCT<a: INT>
    type_chars: list[str] = []
    p_depth = 0
    a_depth = 0
    i = 0
    while i < len(rest):
        ch = rest[i]
        if ch == '(':
            p_depth += 1
            type_chars.append(ch)
        elif ch == ')':
            if p_depth > 0:
                p_depth -= 1
            type_chars.append(ch)
        elif ch == '<':
            a_depth += 1
            type_chars.append(ch)
        elif ch == '>':
            if a_depth > 0:
                a_depth -= 1
            type_chars.append(ch)
        elif ch.isspace() and p_depth == 0 and a_depth == 0:
            # Handle multi-word base types like DOUBLE PRECISION or CHARACTER VARYING
            ahead = rest[i + 1:].upper()
            if ahead.startswith(('PRECISION', 'VARYING', 'WITHOUT TIME ZONE', 'WITH TIME ZONE')):
                type_chars.append(' ')
            else:
                break
        else:
            type_chars.append(ch)
        i += 1

    col_type = ''.join(type_chars).strip()
    if not col_type:
        return None
    return {'name': col_name, 'type': col_type[:80]}


def extract_sql_facts(text: str, origin: str = 'sql') -> dict[str, Any]:
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
        cleaned, re.IGNORECASE,
    ):
        kind = m.group(1).upper()
        name = m.group(2).strip('`"')
        targets.append({'op': f'CREATE {kind}', 'target': name})

    for m in re.finditer(
        r'\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMPORARY\s+|TEMP\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_."`]+)\s*\(',
        cleaned, re.IGNORECASE,
    ):
        tname = m.group(1).strip('`"')
        open_idx = m.end() - 1
        extracted = _extract_balanced_parens(cleaned, open_idx)
        if not extracted:
            continue
        body, _ = extracted
        if re.match(r'^\s*(?:SELECT|WITH)\b', body, re.IGNORECASE):
            continue
        parsed_cols = []
        for raw_col in _split_top_level_sql_items(body):
            parsed = _parse_ddl_column(raw_col)
            if parsed:
                parsed_cols.append(parsed)
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
