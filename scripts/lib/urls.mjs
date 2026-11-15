const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;
const ALLOWED_SCHEMES = new Set(['https:', 'http:', 'mailto:']);

export function isSafeHref(rawHref, { allowRelative = true } = {}) {
  if (typeof rawHref !== 'string') return false;
  if (CONTROL_CHARS_RE.test(rawHref)) return false;
  const trimmed = rawHref.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('//')) return false;

  const compact = trimmed.replace(/[\s\u0000-\u001f\u007f]+/g, '');
  if (compact.startsWith('//')) return false;

  const colonIdx = compact.indexOf(':');
  const delimIdx = compact.search(/[/?#]/);
  if (colonIdx !== -1 && (delimIdx === -1 || colonIdx < delimIdx)) {
    const scheme = compact.slice(0, colonIdx + 1).toLowerCase();
    return ALLOWED_SCHEMES.has(scheme);
  }
  return allowRelative;
}

export function assertSafeHref(rawHref, label = 'href') {
  if (!isSafeHref(rawHref)) {
    throw Error(`Unsafe ${label}: ${JSON.stringify(String(rawHref ?? ''))}`);
  }
  return rawHref.trim();
}
