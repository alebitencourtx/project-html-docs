"""Modular static repository inspection utilities."""
from __future__ import annotations

from .redaction import is_secret_name, redact_inline_secrets, redact_sensitive_text, safe_preview_value
from .sql_parser import extract_sql_facts
from .extractors import (
    detect_stack_signals,
    extract_python_facts,
    extract_ipynb_facts,
    extract_js_ts_facts,
    extract_scala_facts,
    extract_workflow_or_config,
    extract_iac_resources,
)
from .graph import inspect, render_reading_plan

__all__ = [
    'is_secret_name',
    'redact_inline_secrets',
    'redact_sensitive_text',
    'safe_preview_value',
    'extract_sql_facts',
    'detect_stack_signals',
    'extract_python_facts',
    'extract_ipynb_facts',
    'extract_js_ts_facts',
    'extract_scala_facts',
    'extract_workflow_or_config',
    'extract_iac_resources',
    'inspect',
    'render_reading_plan',
]
