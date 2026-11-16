import path from 'node:path';

export const receiptPathFor = htmlPath => htmlPath.replace(/\.html$/i, '') + '.validation.json';

export function resolveCandidateHtmlPath(receiptPath, receipt, explicitHtmlFile) {
  if (explicitHtmlFile) return path.resolve(explicitHtmlFile);
  if (typeof receipt?.htmlPath === 'string' && receipt.htmlPath.trim()) {
    return path.resolve(path.dirname(receiptPath), receipt.htmlPath);
  }
  return /\.validation\.json$/i.test(receiptPath)
    ? receiptPath.replace(/\.validation\.json$/i, '.html') : null;
}
