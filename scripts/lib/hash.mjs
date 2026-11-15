import path from 'node:path';
import { createHash } from 'node:crypto';

export const HASH_ALGORITHM = 'sha256-lf-text-v1';

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.avif',
  '.mp4', '.webm', '.mov', '.avi', '.mp3', '.wav',
  '.pdf', '.zip', '.gz', '.tar', '.7z', '.parquet',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
]);

export function hashRaw(bufOrStr) {
  return createHash('sha256').update(bufOrStr).digest('hex');
}

export function isBinaryBuffer(buf, filePath = '') {
  const ext = filePath ? path.extname(filePath).toLowerCase() : '';
  if (BINARY_EXTS.has(ext)) return true;
  if (!Buffer.isBuffer(buf)) return false;
  return buf.includes(0);
}

export function canonicalizeTextBuffer(bufOrStr, filePath = '') {
  if (typeof bufOrStr === 'string') {
    return Buffer.from(bufOrStr.replace(/\r\n/g, '\n'), 'utf8');
  }
  if (isBinaryBuffer(bufOrStr, filePath)) {
    return bufOrStr;
  }
  return Buffer.from(bufOrStr.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
}

export function hashCanonicalText(bufOrStr, filePath = '') {
  return hashRaw(canonicalizeTextBuffer(bufOrStr, filePath));
}
