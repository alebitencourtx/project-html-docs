export function renderRubric(review) {
  return [
    '# Visual review rubric', '',
    `HTML SHA-256: ${review.htmlSha256}`,
    `Review ID: ${review.runId}`, '',
    'Open every PNG below. Check legibility, clipping, overlap, spacing, contrast,',
    'connector routes and whether the figure communicates its intended meaning.',
    'Mark each tile [x] if inspected and acceptable, [!] for a defect, or leave [ ] pending.',
    'Automated geometry checks do not certify business meaning or visual quality.', '',
    ...review.tiles.map(t => `- [ ] ${t.id} — ${t.file}`), '',
    '## Notes', '',
  ].join('\n');
}

export function parseRubric(text = '') {
  const checked = [], flagged = [], unchecked = [], duplicates = [];
  const seen = new Set();
  for (const match of text.matchAll(/^\s*- \[([ xX!])\] ([\w-]+)(?:\s|$)/gm)) {
    const [, state, id] = match;
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
    (state === '!' ? flagged : state === ' ' ? unchecked : checked).push(id);
  }
  return { checked, flagged, unchecked, duplicates,
    htmlSha256: text.match(/^HTML SHA-256: ([a-f0-9]{64})\s*$/m)?.[1] || null,
    runId: text.match(/^Review ID: ([\w-]+)\s*$/m)?.[1] || null };
}

export function evaluateReviewGate(receipt, { rubricText = null, acceptIssues = null } = {}) {
  const reasons = [];
  const vr = receipt.visualReview;
  if (!vr) reasons.push('No visual review: run `review` first');
  else {
    if (!receipt.htmlSha256 || vr.htmlSha256 !== receipt.htmlSha256) reasons.push('Visual review is stale: HTML changed after `review`; run it again');
    if (!Number.isInteger(vr.summary?.errors) || vr.summary.errors > 0) reasons.push('Automated review reported errors or has no valid summary');
    if (!Array.isArray(vr.interactionFailures) || vr.interactionFailures.length) reasons.push('Interaction checks failed or are missing');
    if (!Array.isArray(vr.tiles) || !vr.tiles.length) reasons.push('Visual review has no tiles');
  }
  if (!rubricText) reasons.push('Rubric missing: pass --rubric <file>');
  else {
    const rubric = parseRubric(rubricText);
    if (rubric.htmlSha256 !== receipt.htmlSha256) reasons.push('Rubric is stale or missing its HTML SHA-256');
    if (!vr?.runId || rubric.runId !== vr.runId) reasons.push('Rubric belongs to a different review run');
    if (rubric.unchecked.length) reasons.push(`Rubric has unchecked tiles: ${rubric.unchecked.join(', ')}`);
    if (rubric.flagged.length) reasons.push(`Rubric flags defects: ${rubric.flagged.join(', ')}`);
    if (rubric.duplicates.length) reasons.push('Rubric contains duplicate tile IDs');
    const missing = (vr?.tiles || []).filter(t => !rubric.checked.includes(t.id));
    if (missing.length) reasons.push(`Tiles not approved: ${missing.map(t => t.id).join(', ')}`);
  }
  const reason = String(acceptIssues ?? '').trim();
  if (acceptIssues !== null && reason.length < 10) {
    return { ok: false, accepted: false, reasons: [...reasons, '--accept-issues requires a reason of at least 10 characters'] };
  }
  return { ok: reasons.length === 0 || reason.length >= 10, accepted: reason.length >= 10, reasons };
}
