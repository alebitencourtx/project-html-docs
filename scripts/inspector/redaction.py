"""Secret and credential redaction helpers for static repository inspection."""
from __future__ import annotations

import re
from typing import Any

SECRET_NAME_RE = re.compile(
    r'(?:secret|token|password|passwd|pwd|api_?key|access_?key|private_?key|master_?key|account_?key|sas|conn(?:ection)?_?str(?:ing)?|credential|client_secret)',
    re.IGNORECASE,
)

SECRET_VALUE_RE = re.compile(
    r'(?:ghp_[A-Za-z0-9]{10,}|github_pat_[A-Za-z0-9_]{15,}|gho_[A-Za-z0-9]{10,}|glpat-[A-Za-z0-9_-]{10,}|sk-(?:proj-|live-|test-)?[A-Za-z0-9]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._-]{12,}|https?://[^:@/\s]+:[^@/\s]+@)'
)

CLI_SECRET_FLAG_RE = re.compile(
    r'(?<!\S)(--(?:password|passwd|pwd|pass|token|secret|api-key|apikey|access-key|client-secret|auth|pat)|-p)'
    r'(?:(\s*=\s*)|(\s+))'
    r"('[^']*'|\"[^\"]*\"|[^\s'\"]+)",
    re.IGNORECASE,
)

ENV_SECRET_ASSIGN_RE = re.compile(
    r'\b([A-Za-z_][A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|PWD|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|MASTER_?KEY|ACCOUNT_?KEY|SAS|CONN(?:ECTION)?_?STR(?:ING)?|CREDENTIAL|CLIENT_SECRET)[A-Za-z0-9_]*)'
    r'\s*=\s*'
    r"('[^']*'|\"[^\"]*\"|[^\s;&|\"']+)",
    re.IGNORECASE,
)

CONN_STR_RE = re.compile(
    r'((?:AccountKey|SharedAccessKey)\s*=\s*)([^;\s\'"]+)',
    re.IGNORECASE,
)


def is_secret_name(name: str) -> bool:
    return bool(SECRET_NAME_RE.search(name or ''))


def _mask_cli_flag(m: re.Match[str]) -> str:
    flag = m.group(1)
    sep = m.group(2) if m.group(2) is not None else (m.group(3) or ' ')
    val = m.group(4)
    # Do not corrupt variable references like $SECRET or ${{ secrets.TOKEN }} unless inline literal
    if val.startswith(('$', '"$', "'$")):
        return m.group(0)
    return f"{flag}{sep}<redacted>"


def _mask_env_assign(m: re.Match[str]) -> str:
    key = m.group(1)
    val = m.group(2)
    if val.startswith(('$', '"$', "'$")):
        return m.group(0)
    return f"{key}=<redacted>"


def redact_inline_secrets(text: str) -> str:
    if not text:
        return text
    cleaned = SECRET_VALUE_RE.sub('<redacted>', text)
    cleaned = CONN_STR_RE.sub(r'\1<redacted>', cleaned)
    cleaned = CLI_SECRET_FLAG_RE.sub(_mask_cli_flag, cleaned)
    cleaned = ENV_SECRET_ASSIGN_RE.sub(_mask_env_assign, cleaned)
    return cleaned


def redact_sensitive_text(text: str) -> str:
    """Alias for centralized secret masking before any truncation."""
    return redact_inline_secrets(text)


def safe_preview_value(name: str, raw_val: Any) -> Any:
    if is_secret_name(name):
        return '<redacted>'
    if isinstance(raw_val, str):
        if 'AccountKey=' in raw_val or 'SharedAccessKey=' in raw_val or 'Endpoint=sb://' in raw_val:
            return '<redacted-connection-string>'
        cleaned = redact_inline_secrets(raw_val)
        if len(cleaned) > 120:
            return cleaned[:117] + '...'
        return cleaned
    if isinstance(raw_val, (int, float, bool)) or raw_val is None:
        return raw_val
    if isinstance(raw_val, list):
        return [safe_preview_value(name, x) for x in raw_val[:8]] + (['...'] if len(raw_val) > 8 else [])
    if isinstance(raw_val, dict):
        return {str(k): safe_preview_value(str(k), v) for k, v in list(raw_val.items())[:10]}
    return redact_inline_secrets(str(raw_val))[:80]
