const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[c]));

export const ROLE_PALETTE = {
  regulator:  { border: '#c2414b', fill: '#ffffff', header: '#fef2f2', title: '#991b1b', accent: '#dc2626', badgeBg: '#fee2e2', badgeFg: '#991b1b', label: 'Regulador / crítico' },
  danger:     { border: '#c2414b', fill: '#ffffff', header: '#fef2f2', title: '#991b1b', accent: '#dc2626', badgeBg: '#fee2e2', badgeFg: '#991b1b', label: 'Crítico / exceção' },
  analytical: { border: '#2563eb', fill: '#ffffff', header: '#eff6ff', title: '#1e40af', accent: '#2563eb', badgeBg: '#dbeafe', badgeFg: '#1e40af', label: 'Base integrada / analítico' },
  info:       { border: '#0284c7', fill: '#ffffff', header: '#f0f9ff', title: '#0369a1', accent: '#0284c7', badgeBg: '#e0f2fe', badgeFg: '#0369a1', label: 'Armazenamento / lote' },
  step:       { border: '#475569', fill: '#ffffff', header: '#f8fafc', title: '#0f172a', accent: '#0f172a', badgeBg: '#e2e8f0', badgeFg: '#1e293b', label: 'Etapa de processamento' },
  neutral:    { border: '#64748b', fill: '#ffffff', header: '#f8fafc', title: '#1e293b', accent: '#475569', badgeBg: '#f1f5f9', badgeFg: '#334155', label: 'Componente' },
  output:     { border: '#087f8c', fill: '#ffffff', header: '#ecfeff', title: '#115e59', accent: '#087f8c', badgeBg: '#ccfbf1', badgeFg: '#115e59', label: 'Entrega / consumo' },
  success:    { border: '#16a34a', fill: '#ffffff', header: '#f0fdf4', title: '#166534', accent: '#16a34a', badgeBg: '#dcfce7', badgeFg: '#166534', label: 'Sucesso / validado' },
  warning:    { border: '#d97706', fill: '#ffffff', header: '#fffbeb', title: '#92400e', accent: '#d97706', badgeBg: '#fef3c7', badgeFg: '#92400e', label: 'Decisão / atenção' },
  json:       { border: '#4f46e5', fill: '#ffffff', header: '#eef2ff', title: '#3730a3', accent: '#4f46e5', badgeBg: '#e0e7ff', badgeFg: '#3730a3', label: 'Contrato JSON' },
};

const ZONE_PALETTE = {
  warm:    { fill: '#fdf3f3', stroke: '#e8c4c4', title: '#b91c1c', subtitle: '#c2414b' },
  cool:    { fill: '#ecf2f8', stroke: '#c1d2e6', title: '#1e40af', subtitle: '#2563eb' },
  teal:    { fill: '#eef8f8', stroke: '#bae0e3', title: '#0f5f68', subtitle: '#087f8c' },
  amber:   { fill: '#fef9ee', stroke: '#ebd5a7', title: '#92400e', subtitle: '#b45309' },
  neutral: { fill: '#f3f6f8', stroke: '#d1dbe3', title: '#334155', subtitle: '#64748b' },
};

const ENTITY_PALETTE = {
  table:    { headerBg: '#102b3d', headerFg: '#ffffff', tagBg: '#1d4b68', tagFg: '#d8eff5', border: '#9fb6c5', subBg: '#edf3f6', subFg: '#314c5e', tag: 'TABELA', dashed: false },
  mart:     { headerBg: '#0f5f68', headerFg: '#ffffff', tagBg: '#187d88', tagFg: '#e0f7f8', border: '#8ec7cd', subBg: '#eef8f8', subFg: '#13535b', tag: 'MART / VIEW', dashed: false },
  json:     { headerBg: '#3730a3', headerFg: '#ffffff', tagBg: '#4f46e5', tagFg: '#e0e7ff', border: '#a5b4fc', subBg: '#eef2ff', subFg: '#3730a3', tag: 'JSON / ESTADO', dashed: true },
  external: { headerBg: '#475569', headerFg: '#ffffff', tagBg: '#64748b', tagFg: '#f1f5f9', border: '#cbd5e1', subBg: '#f8fafc', subFg: '#475569', tag: 'EXTERNO', dashed: true },
};

function charWidth(c, fontSize = 12, mono = false) {
  if (mono) return fontSize * 0.61;
  const scale = fontSize / 12;
  if (c === ' ') return 3.4 * scale;
  if ('MW@%'.includes(c)) return 10.6 * scale;
  if (/[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(c)) return 8.0 * scale;
  if (/[0-9]/.test(c)) return 6.7 * scale;
  if (/[il.,:;!|'`·]/.test(c)) return 3.3 * scale;
  return 6.2 * scale;
}

export function measureText(str, fontSize = 12, mono = false) {
  let w = 0;
  for (const ch of String(str || '')) w += charWidth(ch, fontSize, mono);
  return w;
}

/**
 * Splits a string with inline `code` spans into structured tokens.
 */
export function parseRichTokens(text) {
  const tokens = [];
  const raw = String(text ?? '');
  const regex = /`([^`]+)`/g;
  let last = 0;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    if (m.index > last) tokens.push({ text: raw.slice(last, m.index), code: false });
    tokens.push({ text: m[1], code: true });
    last = regex.lastIndex;
  }
  if (last < raw.length) tokens.push({ text: raw.slice(last), code: false });
  return tokens;
}

function splitLongCode(str, maxW, fontSize) {
  if (measureText(str, fontSize, true) + 10 <= maxW) return [str];
  const parts = str.split(/(?<=[._/\-])/);
  const out = [];
  let cur = '';
  const pushHard = token => {
    let chunk = '';
    for (const ch of token) {
      if (chunk && measureText(chunk + ch, fontSize, true) + 10 > maxW) {
        out.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    if (chunk) out.push(chunk);
  };
  for (const p of parts) {
    if (!cur && measureText(p, fontSize, true) + 10 > maxW) {
      pushHard(p);
    } else if (cur && measureText(cur + p, fontSize, true) + 10 > maxW) {
      out.push(cur);
      if (measureText(p, fontSize, true) + 10 > maxW) pushHard(p);
      else cur = p;
      if (measureText(p, fontSize, true) + 10 > maxW) cur = '';
    } else {
      cur += p;
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [str];
}

/**
 * Wraps rich text lines into visual lines of segments { text, code, width }.
 */
export function wrapRichLines(lines, maxW, fontSize = 11.5) {
  const codeSize = Math.max(10, fontSize - 1);
  const visualLines = [];
  for (const rawLine of lines || []) {
    if (rawLine === '') {
      visualLines.push([]);
      continue;
    }
    const tokens = parseRichTokens(rawLine);
    const words = [];
    for (const tok of tokens) {
      if (tok.code) {
        const chunks = splitLongCode(tok.text, maxW, codeSize);
        chunks.forEach((c, idx) => {
          words.push({ text: c, code: true, spaceBefore: idx === 0 ? false : false, width: measureText(c, codeSize, true) + 10 });
        });
      } else {
        const pieces = tok.text.split(/(\s+)/).filter(Boolean);
        for (const p of pieces) {
          if (/^\s+$/.test(p)) {
            words.push({ text: ' ', code: false, isSpace: true, width: charWidth(' ', fontSize, false) });
          } else {
            words.push({ text: p, code: false, isSpace: false, width: measureText(p, fontSize, false) });
          }
        }
      }
    }

    let curLine = [];
    let curW = 0;
    for (const w of words) {
      if (w.isSpace && curLine.length === 0) continue;
      if (curW > 0 && curW + w.width > maxW) {
        while (curLine.length && curLine[curLine.length - 1].isSpace) curLine.pop();
        visualLines.push(curLine);
        curLine = [];
        curW = 0;
        if (w.isSpace) continue;
      }
      curLine.push(w);
      curW += w.width;
    }
    while (curLine.length && curLine[curLine.length - 1].isSpace) curLine.pop();
    if (curLine.length || !visualLines.length) visualLines.push(curLine);
  }
  return visualLines;
}

function renderWrappedLinesSvg(visualLines, startX, startY, lineH, fontSize = 11.5, fill = '#334155', align = 'left', boxW = 0) {
  const codeSize = Math.max(10, fontSize - 1);
  return visualLines.map((segs, idx) => {
    const y = startY + idx * lineH;
    if (!segs.length) return '';
    // Merge adjacent non-code segments for cleaner SVG output
    const merged = [];
    for (const s of segs) {
      if (!s.code && merged.length && !merged[merged.length - 1].code) {
        merged[merged.length - 1].text += s.text;
        merged[merged.length - 1].width += s.width;
      } else {
        merged.push({ ...s });
      }
    }
    const totalW = merged.reduce((a, b) => a + b.width, 0);
    let x = align === 'center' && boxW > 0 ? startX + Math.max(0, (boxW - totalW) / 2) : startX;
    return merged.map(seg => {
      if (seg.code) {
        const cw = seg.width;
        const rect = `<rect x="${x.toFixed(1)}" y="${(y - fontSize + 1).toFixed(1)}" width="${cw.toFixed(1)}" height="${(fontSize + 3.5).toFixed(1)}" rx="3" fill="#eef2f6" stroke="#d5dfe7" stroke-width="0.75"/>`;
        const txt = `<text x="${(x + 5).toFixed(1)}" y="${y.toFixed(1)}" class="mono" font-size="${codeSize}" fill="#0f172a">${esc(seg.text)}</text>`;
        x += cw + 1;
        return rect + txt;
      }
      const txt = `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${fontSize}" fill="${fill}">${esc(seg.text)}</text>`;
      x += measureText(seg.text, fontSize, false);
      return txt;
    }).join('');
  }).join('');
}

function roundedOrthogonalPath(pts, radius = 6) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  if (pts.length === 2) return `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} L${pts[1][0].toFixed(1)},${pts[1][1].toFixed(1)}`;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const dx1 = cx - px, dy1 = cy - py;
    const dx2 = nx - cx, dy2 = ny - cy;
    const l1 = Math.hypot(dx1, dy1);
    const l2 = Math.hypot(dx2, dy2);
    if (l1 < 1 || l2 < 1 || (dx1 === 0 && dx2 === 0) || (dy1 === 0 && dy2 === 0)) {
      d += ` L${cx.toFixed(1)},${cy.toFixed(1)}`;
      continue;
    }
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const ax = cx - (dx1 / l1) * r;
    const ay = cy - (dy1 / l1) * r;
    const bx = cx + (dx2 / l2) * r;
    const by = cy + (dy2 / l2) * r;
    d += ` L${ax.toFixed(1)},${ay.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
  return d;
}

function renderLegendHtml(legend, locale = 'pt-BR') {
  if (!Array.isArray(legend) || !legend.length) return '';
  const items = legend.map(item => {
    const type = item.type || 'box';
    const role = ROLE_PALETTE[item.role] || ROLE_PALETTE.neutral;
    if (type === 'dashed') {
      return `<span class="legend-item"><span class="line-dashed" style="border-top-color:${role.border}"></span> ${esc(item.label)}</span>`;
    }
    if (type === 'solid') {
      return `<span class="legend-item"><span class="line-solid" style="border-top-color:${role.accent}"></span> ${esc(item.label)}</span>`;
    }
    return `<span class="legend-item"><span class="legend-outline-swatch" style="border-color:${role.border};background:${role.header}"></span> ${esc(item.label)}</span>`;
  }).join('');
  return `<div class="figure-legend" aria-label="${locale === 'pt-BR' ? 'Legenda do diagrama' : 'Diagram legend'}">${items}</div>`;
}

function wrapFigure(svg, title, { legendHtml = '', noteHtml = '', diagramLabel = 'Ampliar' } = {}) {
  return `<figure class="diagram"><div class="figure-tools"><span class="figure-tag">${esc(title)}</span><button type="button" data-expand-diagram aria-label="${esc(diagramLabel)}: ${esc(title)}">${esc(diagramLabel)}</button></div><div class="diagram-scroll">${svg}</div>${legendHtml}<figcaption>${esc(title)}</figcaption>${noteHtml}</figure>`;
}

function wrapEdgeLabelText(text, maxW, fontSize = 10.5) {
  const rawLines = String(text || '').split('\n');
  const out = [];
  for (const line of rawLines) {
    if (measureText(line, fontSize, false) <= maxW) {
      out.push(line);
      continue;
    }
    const words = line.split(/\s+/).filter(Boolean);
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && measureText(next, fontSize, false) > maxW) {
        out.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    if (cur) out.push(cur);
  }
  return out.join('\n');
}

function renderPillLabel(x, y, text, { bg = '#ffffff', stroke = '#cbd5e1', fg = '#334155', fontSize = 10.5 } = {}) {
  if (!text) return '';
  const lines = String(text).split('\n');
  const maxW = Math.max(...lines.map(l => measureText(l, fontSize, false)));
  const pw = Math.round(maxW + 18);
  const ph = Math.round(lines.length * 14 + 8);
  const rx = x - pw / 2;
  const ry = y - ph / 2;
  const tspans = lines.map((l, idx) => `<tspan x="${x.toFixed(1)}" dy="${idx === 0 ? 0 : 14}">${esc(l)}</tspan>`).join('');
  return `<g class="sol-edge-label"><rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${pw}" height="${ph}" rx="4" fill="${bg}" stroke="${stroke}" stroke-width="0.9"/><text x="${x.toFixed(1)}" y="${(ry + 15).toFixed(1)}" text-anchor="middle" font-size="${fontSize}" font-weight="500" fill="${fg}">${tspans}</text></g>`;
}

function renderNodeCard(node, x, y, w, h, layout) {
  const role = ROLE_PALETTE[node.role || 'step'] || ROLE_PALETTE.step;
  const shape = node.shape || 'card';
  const padX = 14;
  const innerW = w - padX * 2;
  const titleLines = layout.titleLines;
  const bodyLines = layout.bodyLines;
  const metaText = node.meta ? String(node.meta) : '';

  let bodySvg = '';
  let curY = y + (shape === 'cylinder' ? 22 : 14);

  // Title + step badge
  const hasStep = node.step !== undefined && node.step !== null && String(node.step) !== '';
  const stepStr = hasStep ? String(node.step) : '';
  const titleX = x + padX + (hasStep ? 24 : 0);

  if (hasStep) {
    const cx = x + padX + 9;
    const cy = curY + 7;
    bodySvg += `<circle cx="${cx}" cy="${cy}" r="9.5" fill="${role.accent}"/><text x="${cx}" y="${cy + 3.8}" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">${esc(stepStr)}</text>`;
  }

  bodySvg += titleLines.map((tl, idx) =>
    `<text x="${titleX}" y="${(curY + 11 + idx * 16).toFixed(1)}" font-size="12.5" font-weight="700" fill="${role.title}">${esc(tl)}</text>`
  ).join('');
  curY += titleLines.length * 16 + 6;

  if (bodyLines.length) {
    bodySvg += renderWrappedLinesSvg(bodyLines, x + padX, curY + 8, 15.5, 11.2, '#334155');
    curY += bodyLines.length * 15.5 + 4;
  }

  if (metaText) {
    let metaFont = 9.8;
    let rawW = measureText(metaText, metaFont, false) * 1.07 + 16;
    if (rawW > innerW) {
      metaFont = 9.0;
      rawW = measureText(metaText, metaFont, false) * 1.07 + 14;
    }
    const pillW = Math.min(innerW, Math.round(rawW));
    const pillBottomOffset = shape === 'cylinder' ? 32 : 26;
    bodySvg += `<rect x="${x + padX}" y="${(y + h - pillBottomOffset).toFixed(1)}" width="${pillW}" height="18" rx="4" fill="${role.badgeBg}"/><text x="${x + padX + 7}" y="${(y + h - pillBottomOffset + 12.5).toFixed(1)}" font-size="${metaFont}" font-weight="600" fill="${role.badgeFg}">${esc(metaText)}</text>`;
  }

  let frameSvg = '';
  if (shape === 'cylinder') {
    const ry = 8;
    const cx = x + w / 2;
    const topY = y + ry;
    const botY = y + h - ry;
    frameSvg =
      `<path d="M${x},${topY} L${x},${botY} A${w / 2},${ry} 0 0,0 ${x + w},${botY} L${x + w},${topY} Z" fill="${role.fill}" stroke="${role.border}" stroke-width="1.5"/>` +
      `<ellipse cx="${cx}" cy="${topY}" rx="${w / 2}" ry="${ry}" fill="${role.header}" stroke="${role.border}" stroke-width="1.5"/>`;
  } else if (shape === 'decision') {
    frameSvg =
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${role.header}" stroke="${role.border}" stroke-width="1.6"/>` +
      `<rect x="${x + w - 26}" y="${y + 7}" width="18" height="18" rx="4" fill="${role.accent}"/><text x="${x + w - 17}" y="${y + 20}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#ffffff">?</text>`;
  } else {
    const dash = node.dashed ? ' stroke-dasharray="5,3"' : '';
    frameSvg =
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${role.fill}" stroke="${role.border}" stroke-width="1.4"${dash}/>` +
      `<path d="M${x + 1},${y + 8} Q${x + 1},${y + 1} ${x + 8},${y + 1} L${x + w - 8},${y + 1} Q${x + w - 1},${y + 1} ${x + w - 1},${y + 8} L${x + w - 1},${y + 5} L${x + 1},${y + 5} Z" fill="${role.accent}" opacity="0.88"/>`;
  }

  return `<g class="sol-node" data-node-id="${esc(node.id)}" tabindex="0" role="group" aria-label="${esc(node.title)}">${frameSvg}${bodySvg}</g>`;
}

/**
 * Computes card height for a node given its column width.
 */
function layoutNodeBox(node, colWidth) {
  const shape = node.shape || 'card';
  const padX = 14;
  const hasStep = node.step !== undefined && node.step !== null && String(node.step) !== '';
  const titleMaxW = colWidth - padX * 2 - (hasStep ? 24 : 0) - (shape === 'decision' ? 24 : 0);

  // Simple title wrap
  const titleWords = String(node.title || '').split(/\s+/).filter(Boolean);
  const titleLines = [];
  let curT = '';
  for (const w of titleWords) {
    const next = curT ? `${curT} ${w}` : w;
    if (curT && measureText(next, 12.5, false) > titleMaxW) {
      titleLines.push(curT);
      curT = w;
    } else {
      curT = next;
    }
  }
  if (curT) titleLines.push(curT);
  if (!titleLines.length) titleLines.push(node.id);

  const rawLines = Array.isArray(node.lines)
    ? node.lines
    : (node.body ? String(node.body).split('\n') : []);
  const bodyLines = wrapRichLines(rawLines, colWidth - padX * 2, 11.2);

  let h = shape === 'cylinder' ? 28 : 18;
  h += titleLines.length * 16 + 6;
  if (bodyLines.length) h += bodyLines.length * 15.5 + 10;
  if (node.meta) h += shape === 'cylinder' ? 34 : 26;
  if (shape === 'cylinder') h += 12;
  return {
    w: colWidth,
    h: Math.max(shape === 'cylinder' ? 92 : 68, Math.ceil(h)),
    titleLines,
    bodyLines,
  };
}

/**
 * Renders a 2D staged Solution Architecture / Flow diagram (`solution` or `flow` fence).
 */
export function renderSolutionDiagram(spec, { locale = 'pt-BR', diagramLabel = 'Ampliar', mode = 'solution' } = {}) {
  if (!spec || typeof spec !== 'object' || !spec.title || !Array.isArray(spec.nodes) || !spec.nodes.length) {
    throw Error(`${mode} diagram requires title and a non-empty nodes[] array`);
  }

  const seenIds = new Set();
  for (const n of spec.nodes) {
    if (!n.id || typeof n.id !== 'string' || seenIds.has(n.id)) throw Error(`Duplicate or missing node id: ${n.id}`);
    seenIds.add(n.id);
  }

  const zones = Array.isArray(spec.zones) ? spec.zones : [];
  const edges = Array.isArray(spec.edges) ? spec.edges : [];
  const hasInputs = Boolean(spec.inputs && (spec.inputs.label || (spec.inputs.nodes || []).length));

  const maxNodeCol = Math.max(0, ...spec.nodes.map(n => Number(n.col ?? 0)));
  const maxZoneCol = zones.length ? Math.max(...zones.map(z => Number(z.colStart ?? 0) + Number(z.colSpan ?? 1) - 1)) : 0;
  const maxCalloutCol = zones.reduce((m, z) => {
    const cs = Array.isArray(z.callouts) ? z.callouts : [];
    return Math.max(m, ...cs.map(c => Number(c.col ?? 0)), m);
  }, 0);
  const numCols = Math.max(Number(spec.cols || 0), maxNodeCol + 1, maxZoneCol + 1, maxCalloutCol + 1);

  const maxNodeRow = Math.max(0, ...spec.nodes.map(n => Number(n.row ?? 0)));
  const maxZoneRow = zones.length ? Math.max(...zones.map(z => Number(z.row ?? 0) + Number(z.rowSpan ?? 1) - 1)) : 0;
  const numRows = Math.max(maxNodeRow + 1, maxZoneRow + 1);

  const colWidth = Number(spec.colWidth || 236);
  const colGap = Number(spec.colGap || 76);
  const rowGap = Number(spec.rowGap || 58);
  const stackGap = 14;
  const padLeft = 24;
  const padRight = 24;
  const padTop = hasInputs ? 34 : 20;

  // Compute layouts for every node
  const nodeLayouts = new Map();
  const cellNodes = new Map();
  for (const n of spec.nodes) {
    const c = Number(n.col ?? 0);
    const r = Number(n.row ?? 0);
    const spanW = Number(n.colSpan || 1) > 1 ? colWidth * n.colSpan + colGap * (n.colSpan - 1) : colWidth;
    nodeLayouts.set(n.id, layoutNodeBox(n, spanW));
    const key = `${c}:${r}`;
    if (!cellNodes.has(key)) cellNodes.set(key, []);
    cellNodes.get(key).push(n);
  }

  // Callout heights per (col, row)
  const cellCallouts = new Map();
  for (const z of zones) {
    for (const co of z.callouts || []) {
      const c = Number(co.col ?? (Number(z.colStart ?? 0) + Number(z.colSpan ?? 1) - 1));
      const r = Number(co.row ?? z.row ?? 0);
      const key = `${c}:${r}`;
      const wrapped = wrapRichLines(String(co.text || '').split('\n'), colWidth - 16, 11);
      const ch = wrapped.length * 15 + 12;
      if (!cellCallouts.has(key)) cellCallouts.set(key, []);
      cellCallouts.get(key).push({ ...co, wrapped, h: ch, role: co.role || (z.variant === 'warm' ? 'regulator' : z.variant === 'cool' ? 'analytical' : 'neutral') });
    }
  }

  // Compute each row height
  const rowHasZoneHeader = Array.from({ length: numRows }, (_, r) =>
    zones.some(z => Number(z.row ?? 0) === r)
  );
  const rowHeights = Array.from({ length: numRows }, (_, r) => {
    let maxH = 110;
    for (let c = 0; c < numCols; c++) {
      const list = cellNodes.get(`${c}:${r}`) || [];
      const coList = cellCallouts.get(`${c}:${r}`) || [];
      const nodesH = list.reduce((acc, n, i) => acc + nodeLayouts.get(n.id).h + (i > 0 ? stackGap : 0), 0);
      const coH = coList.reduce((acc, co, i) => acc + co.h + (i > 0 ? 8 : 0), 0);
      const totalCellH = list.length && coList.length ? nodesH + 12 + coH : Math.max(nodesH, coH);
      if (totalCellH > maxH) maxH = totalCellH;
    }
    return maxH + (rowHasZoneHeader[r] ? 56 : 14) + 22;
  });

  // Resolve edge routing (including auto-bypass around intermediate nodes in same row)
  const occupiedCell = new Set(spec.nodes.map(n => `${Number(n.col ?? 0)}:${Number(n.row ?? 0)}`));
  const nodeCoord = new Map(spec.nodes.map(n => [n.id, { col: Number(n.col ?? 0), row: Number(n.row ?? 0) }]));

  const resolvedEdges = edges.map(e => {
    const fc = nodeCoord.get(e.from);
    const tc = nodeCoord.get(e.to);
    if (!fc || !tc) throw Error(`Edge references unknown node: ${e.from} -> ${e.to}`);

    let channel = e.channel;
    if (!channel && !e.fromSide && !e.toSide && fc.row === tc.row && Math.abs(fc.col - tc.col) > 1) {
      const minC = Math.min(fc.col, tc.col);
      const maxC = Math.max(fc.col, tc.col);
      let blocked = false;
      for (let c = minC + 1; c < maxC; c++) {
        if (occupiedCell.has(`${c}:${fc.row}`)) { blocked = true; break; }
      }
      if (blocked) channel = fc.row === 0 ? 'top' : 'bottom';
    }

    let fSide = e.fromSide;
    let tSide = e.toSide;
    if (!fSide || !tSide) {
      if (channel === 'bottom' || channel === 'bottom-inner') {
        fSide = fSide || 'bottom';
        tSide = tSide || 'bottom';
      } else if (channel === 'top') {
        fSide = fSide || 'top';
        tSide = tSide || 'top';
      } else if (fc.col === tc.col) {
        fSide = fSide || (tc.row >= fc.row ? 'bottom' : 'top');
        tSide = tSide || (tc.row >= fc.row ? 'top' : 'bottom');
      } else if (tc.col >= fc.col) {
        fSide = fSide || 'right';
        tSide = tSide || 'left';
      } else {
        fSide = fSide || 'left';
        tSide = tSide || 'right';
      }
    }
    return { ...e, channel, fSide, tSide };
  });

  // Channel allocation for bottom/top routed edges
  const bottomChannelEdges = resolvedEdges.filter(e => e.channel === 'bottom' || e.channel === 'bottom-inner');
  const topChannelEdges = resolvedEdges.filter(e => e.channel === 'top');
  // Put bottom-inner closer to boxes, bottom further down
  const orderedBottom = [
    ...bottomChannelEdges.filter(e => e.channel === 'bottom-inner'),
    ...bottomChannelEdges.filter(e => e.channel === 'bottom'),
  ];
  const extraTop = topChannelEdges.length ? topChannelEdges.length * 34 + 14 : 0;
  const extraBottom = orderedBottom.length ? orderedBottom.length * 38 + 26 : 22;

  // Compute zone header wrapping height allowance
  const zoneSubtitleLines = new Map();
  for (const z of zones) {
    const cSpan = Number(z.colSpan ?? 1);
    const zw = cSpan * colWidth + (cSpan - 1) * colGap + 28;
    const subLines = z.subtitle ? wrapEdgeLabelText(z.subtitle, Math.max(120, zw - 32), 11).split('\n') : [];
    zoneSubtitleLines.set(z, subLines);
  }
  const rowZoneHeaderExtra = Array.from({ length: numRows }, (_, r) => {
    const zs = zones.filter(z => Number(z.row ?? 0) === r);
    if (!zs.length) return 0;
    const maxSub = Math.max(1, ...zs.map(z => (zoneSubtitleLines.get(z) || []).length));
    return (maxSub - 1) * 14;
  });

  // Row Y positions
  const rowY = [];
  let accY = padTop + extraTop;
  for (let r = 0; r < numRows; r++) {
    rowY.push(accY);
    accY += rowHeights[r] + rowZoneHeaderExtra[r] + (r < numRows - 1 ? rowGap : 0);
  }
  const contentBottom = accY;
  const totalW = padLeft + numCols * colWidth + (numCols - 1) * colGap + padRight;
  const totalH = contentBottom + extraBottom;

  const colX = c => padLeft + c * (colWidth + colGap);

  // Place nodes & callouts
  const nodeBoxes = new Map();
  for (let r = 0; r < numRows; r++) {
    const headOffset = (rowHasZoneHeader[r] ? 52 : 8) + rowZoneHeaderExtra[r];
    for (let c = 0; c < numCols; c++) {
      const list = cellNodes.get(`${c}:${r}`) || [];
      let ny = rowY[r] + headOffset;
      for (const n of list) {
        const l = nodeLayouts.get(n.id);
        nodeBoxes.set(n.id, { x: colX(c), y: ny, w: l.w, h: l.h, cx: colX(c) + l.w / 2, cy: ny + l.h / 2, layout: l, node: n });
        ny += l.h + stackGap;
      }
    }
  }

  // Render zones
  let zonesSvg = '';
  if (hasInputs) {
    zonesSvg += `<text x="${padLeft + 2}" y="${padTop - 8}" font-size="11" font-weight="700" letter-spacing="0.08em" fill="#475569">${esc(spec.inputs.label || 'ENTRADAS')}</text>`;
  }

  for (const z of zones) {
    const c0 = Number(z.colStart ?? 0);
    const cSpan = Number(z.colSpan ?? 1);
    const r0 = Number(z.row ?? 0);
    const rSpan = Number(z.rowSpan ?? 1);
    const zx = colX(c0) - 14;
    const zw = cSpan * colWidth + (cSpan - 1) * colGap + 28;
    const zy = rowY[r0] - 4;
    const bottomRow = r0 + rSpan - 1;
    const zh = (rowY[bottomRow] + rowHeights[bottomRow] + rowZoneHeaderExtra[bottomRow]) - zy + 8;
    const pal = ZONE_PALETTE[z.variant || 'neutral'] || ZONE_PALETTE.neutral;

    zonesSvg += `<g class="sol-zone"><rect x="${zx}" y="${zy}" width="${zw}" height="${zh}" rx="10" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1.2"/>`;
    if (z.title) {
      zonesSvg += `<text x="${zx + 16}" y="${zy + 21}" font-size="11.5" font-weight="700" letter-spacing="0.04em" fill="${pal.title}">${esc(z.title)}</text>`;
    }
    const subLines = zoneSubtitleLines.get(z) || [];
    subLines.forEach((sl, sIdx) => {
      zonesSvg += `<text x="${zx + 16}" y="${zy + 36 + sIdx * 14}" font-size="11" font-weight="500" fill="${pal.subtitle}">${esc(sl)}</text>`;
    });
    // Render callouts inside this zone
    const calloutRenderCount = new Map();
    for (const co of z.callouts || []) {
      const cc = Number(co.col ?? (c0 + cSpan - 1));
      const cr = Number(co.row ?? r0);
      const list = cellNodes.get(`${cc}:${cr}`) || [];
      const lastNodeBottom = list.length
        ? nodeBoxes.get(list[list.length - 1].id).y + nodeBoxes.get(list[list.length - 1].id).h + 14
        : rowY[cr] + 58 + rowZoneHeaderExtra[cr];
      const key = `${cc}:${cr}`;
      const coItems = cellCallouts.get(key) || [];
      const coIdx = calloutRenderCount.get(key) || 0;
      calloutRenderCount.set(key, coIdx + 1);
      const matched = coItems[coIdx] || coItems[0];
      if (!matched) continue;
      const cy = lastNodeBottom + coItems.slice(0, coIdx).reduce((s, x) => s + x.h + 6, 0);
      const coPal = ROLE_PALETTE[matched.role] || ROLE_PALETTE.neutral;
      zonesSvg += renderWrappedLinesSvg(matched.wrapped, colX(cc) + 4, cy + 10, 15, 11, coPal.title);
    }
    zonesSvg += `</g>`;
  }

  // Port distribution using RESOLVED fSide/tSide so same-side edges never overlap
  const sideUsage = new Map();
  const sideTotals = new Map();
  for (const e of resolvedEdges) {
    sideTotals.set(`${e.from}:${e.fSide}`, (sideTotals.get(`${e.from}:${e.fSide}`) || 0) + 1);
    sideTotals.set(`${e.to}:${e.tSide}`, (sideTotals.get(`${e.to}:${e.tSide}`) || 0) + 1);
  }
  function nextPort(nodeId, side, box) {
    const key = `${nodeId}:${side}`;
    const total = sideTotals.get(key) || 1;
    const idx = sideUsage.get(key) || 0;
    sideUsage.set(key, idx + 1);
    const maxSpread = side === 'left' || side === 'right' ? Math.max(12, Math.min(24, (box.h - 24) / Math.max(1, total))) : Math.max(16, Math.min(28, (box.w - 32) / Math.max(1, total)));
    const offset = total > 1 ? (idx - (total - 1) / 2) * maxSpread : 0;
    if (side === 'left') return [box.x, box.cy + offset];
    if (side === 'right') return [box.x + box.w, box.cy + offset];
    if (side === 'top') return [box.cx + offset, box.y];
    return [box.cx + offset, box.y + box.h];
  }

  // Unique marker colors
  const markerIds = new Set(['default']);
  for (const e of resolvedEdges) {
    if (e.branch === 'yes') markerIds.add('yes');
    else if (e.branch === 'no') markerIds.add('no');
    else if (e.role && ROLE_PALETTE[e.role]) markerIds.add(e.role);
  }
  const defsSvg = [...markerIds].map(m => {
    const color = m === 'yes' ? '#16a34a' : m === 'no' ? '#dc2626' : m === 'default' ? '#334155' : ROLE_PALETTE[m].accent;
    return `<marker id="__PREFIX__arrow-${m}" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0.5, 8 3, 0 5.5" fill="${color}"/></marker>`;
  }).join('');

  // Render edges
  let edgesSvg = '';
  let edgeLabelsSvg = '';
  let topIdx = 0;

  for (const e of resolvedEdges) {
    const fromBox = nodeBoxes.get(e.from);
    const toBox = nodeBoxes.get(e.to);
    const { fSide, tSide } = e;

    const p1 = nextPort(e.from, fSide, fromBox);
    const p2 = nextPort(e.to, tSide, toBox);
    let pts;
    let labelPos;

    if (e.channel === 'bottom' || e.channel === 'bottom-inner') {
      const idx = e.channel === 'bottom-inner' ? 0 : Math.max(orderedBottom.some(x => x.channel === 'bottom-inner') ? 1 : 0, orderedBottom.indexOf(e));
      const laneY = contentBottom + 20 + idx * 34;
      pts = [p1, [p1[0], laneY], [p2[0], laneY], p2];
      labelPos = [(p1[0] + p2[0]) / 2, laneY];
    } else if (e.channel === 'top') {
      const laneY = padTop + extraTop - 22 - topIdx * 32;
      topIdx++;
      pts = [p1, [p1[0], laneY], [p2[0], laneY], p2];
      labelPos = [(p1[0] + p2[0]) / 2, laneY];
    } else if (fSide === 'right' && tSide === 'left') {
      if (Math.abs(p1[1] - p2[1]) < 4) {
        pts = [p1, p2];
        labelPos = [(p1[0] + p2[0]) / 2, p1[1] - 13];
      } else {
        const midX = (p1[0] + p2[0]) / 2;
        pts = [p1, [midX, p1[1]], [midX, p2[1]], p2];
        labelPos = [midX, (p1[1] + p2[1]) / 2];
      }
    } else if ((fSide === 'bottom' && tSide === 'top') || (fSide === 'top' && tSide === 'bottom')) {
      if (Math.abs(p1[0] - p2[0]) < 6) {
        pts = [p1, p2];
        labelPos = [p1[0], (p1[1] + p2[1]) / 2];
      } else {
        const midY = (p1[1] + p2[1]) / 2;
        pts = [p1, [p1[0], midY], [p2[0], midY], p2];
        labelPos = [(p1[0] + p2[0]) / 2, midY];
      }
    } else {
      const midX = (p1[0] + p2[0]) / 2;
      pts = [p1, [midX, p1[1]], [midX, p2[1]], p2];
      labelPos = [midX, (p1[1] + p2[1]) / 2];
    }

    const markerKey = e.branch === 'yes' ? 'yes' : e.branch === 'no' ? 'no' : (e.role && ROLE_PALETTE[e.role]) ? e.role : 'default';
    const strokeColor = markerKey === 'yes' ? '#16a34a' : markerKey === 'no' ? '#dc2626' : markerKey === 'default' ? '#334155' : ROLE_PALETTE[markerKey].accent;
    const dashAttr = e.style === 'dashed' ? ' stroke-dasharray="5,4"' : '';
    const strokeW = e.style === 'thick' ? '2.1' : '1.5';
    const pathD = roundedOrthogonalPath(pts, 7);

    edgesSvg += `<path class="sol-edge" data-from="${esc(e.from)}" data-to="${esc(e.to)}" d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="${strokeW}"${dashAttr} marker-end="url(#__PREFIX__arrow-${markerKey})"/>`;

    if (e.label) {
      let pillStyle = { bg: '#ffffff', stroke: '#cbd5e1', fg: '#334155' };
      if (e.branch === 'yes') pillStyle = { bg: '#dcfce7', stroke: '#86efac', fg: '#166534' };
      else if (e.branch === 'no') pillStyle = { bg: '#fee2e2', stroke: '#fca5a5', fg: '#991b1b' };
      else if (e.role && ROLE_PALETTE[e.role]) {
        pillStyle = { bg: ROLE_PALETTE[e.role].header, stroke: ROLE_PALETTE[e.role].border, fg: ROLE_PALETTE[e.role].title };
      }
      const isHorizGap = !e.channel && (fSide === 'right' && tSide === 'left');
      const maxLblW = isHorizGap ? Math.max(58, colGap - 14) : e.channel ? Math.max(120, Math.abs(p2[0] - p1[0]) - 24) : 136;
      const labelText = wrapEdgeLabelText(e.label, maxLblW, 10.5);
      edgeLabelsSvg += `<g class="sol-edge-label-wrap" data-from="${esc(e.from)}" data-to="${esc(e.to)}">${renderPillLabel(labelPos[0], labelPos[1], labelText, pillStyle)}</g>`;
    }
  }

  // Render nodes
  const nodesSvg = [...nodeBoxes.values()].map(b => renderNodeCard(b.node, b.x, b.y, b.w, b.h, b.layout)).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" class="sol-svg" role="img" aria-label="${esc(spec.title)}" data-natural-width="${totalW}" style="width:${totalW}px;max-width:100%;height:auto"><defs>${defsSvg}</defs>${zonesSvg}${edgesSvg}${nodesSvg}${edgeLabelsSvg}</svg>`;

  const legendHtml = renderLegendHtml(spec.legend, locale);
  const noteHtml = spec.note ? `<p class="diagram-note">${esc(spec.note)}</p>` : '';
  return wrapFigure(svg, spec.title, { legendHtml, noteHtml, diagramLabel });
}

/**
 * Renders a Table Entity / Schema Relationship SVG (`schema` or `erd` fence).
 */
export function renderSchemaDiagram(spec, { locale = 'pt-BR', diagramLabel = 'Ampliar' } = {}) {
  if (!spec || typeof spec !== 'object' || !spec.title || !Array.isArray(spec.entities) || !spec.entities.length) {
    throw Error('schema diagram requires title and a non-empty entities[] array');
  }

  const seen = new Set();
  for (const ent of spec.entities) {
    if (!ent.id || !ent.name || seen.has(ent.id)) throw Error(`Invalid or duplicate entity id: ${ent.id}`);
    seen.add(ent.id);
  }

  const relations = Array.isArray(spec.relations) ? spec.relations : [];
  const maxCol = Math.max(0, ...spec.entities.map(e => Number(e.col ?? 0)));
  const maxRow = Math.max(0, ...spec.entities.map(e => Number(e.row ?? 0)));
  const numCols = Math.max(Number(spec.cols || 0), maxCol + 1);
  const numRows = maxRow + 1;

  const colGap = Number(spec.colGap || 126);
  const rowGap = Number(spec.rowGap || 62);
  const padX = 28;
  const padY = 24;

  // Measure each entity width and height naturally (wrapping long grain lines)
  const entLayouts = new Map();
  for (const ent of spec.entities) {
    const cols = Array.isArray(ent.columns) ? ent.columns : [];
    const headerW = measureText(ent.name, 13, false) + 110;
    const rowWidths = cols.map(c => {
      const keyList = c.key ? String(c.key).split(',').map(k => k.trim()).filter(Boolean) : [];
      const badgeW = keyList.length ? keyList.length * 26 + 6 : 12;
      const nameW = measureText(c.name || '', 11.5, true);
      const typeStr = (c.type || '') + (c.nullable ? '?' : '');
      const typeW = measureText(typeStr, 10.5, true);
      return badgeW + nameW + typeW + 46;
    });
    const baseW = Math.max(256, Math.ceil(Math.max(headerW, ...rowWidths, 240)));
    const grainMaxW = Math.max(baseW - 24, 300);
    const grainLines = ent.grain ? wrapEdgeLabelText(ent.grain, grainMaxW, 10.2).split('\n') : [];
    const actualGrainW = grainLines.length ? Math.max(...grainLines.map(gl => measureText(gl, 10.2, false))) + 28 : 0;
    const w = Math.max(baseW, Math.ceil(actualGrainW));
    const headerH = 34;
    const grainH = grainLines.length ? grainLines.length * 14 + 10 : 0;
    const rowH = 24;
    const h = headerH + grainH + Math.max(1, cols.length) * rowH + 6;
    entLayouts.set(ent.id, { w, h, headerH, grainH, grainLines, rowH });
  }

  // Compute column widths and row heights across grid
  const colWidths = Array.from({ length: numCols }, (_, c) => {
    const matching = spec.entities.filter(e => Number(e.col ?? 0) === c);
    return Math.max(250, ...matching.map(e => entLayouts.get(e.id).w));
  });
  const rowHeights = Array.from({ length: numRows }, (_, r) => {
    const matching = spec.entities.filter(e => Number(e.row ?? 0) === r);
    return Math.max(96, ...matching.map(e => entLayouts.get(e.id).h));
  });

  const colX = [];
  let cx = padX;
  for (let c = 0; c < numCols; c++) {
    colX.push(cx);
    cx += colWidths[c] + (c < numCols - 1 ? colGap : 0);
  }
  const rowY = [];
  let ry = padY;
  for (let r = 0; r < numRows; r++) {
    rowY.push(ry);
    ry += rowHeights[r] + (r < numRows - 1 ? rowGap : 0);
  }

  const occupiedEntity = new Set(spec.entities.map(e => `${Number(e.col ?? 0)}:${Number(e.row ?? 0)}`));
  const entityCoord = new Map(spec.entities.map(e => [e.id, { col: Number(e.col ?? 0), row: Number(e.row ?? 0) }]));
  const resolvedRelations = relations.map(rel => {
    const fc = entityCoord.get(rel.from);
    const tc = entityCoord.get(rel.to);
    if (!fc || !tc) throw Error(`Schema relation references unknown entity: ${rel.from} -> ${rel.to}`);
    let channel = rel.channel;
    if (!channel && !rel.fromSide && !rel.toSide && fc.row === tc.row && Math.abs(fc.col - tc.col) > 1) {
      const minC = Math.min(fc.col, tc.col);
      const maxC = Math.max(fc.col, tc.col);
      for (let c = minC + 1; c < maxC; c++) {
        if (occupiedEntity.has(`${c}:${fc.row}`)) { channel = 'bottom'; break; }
      }
    }
    let fSide = rel.fromSide;
    let tSide = rel.toSide;
    if (!fSide || !tSide) {
      if (channel === 'bottom') { fSide = fSide || 'bottom'; tSide = tSide || 'bottom'; }
      else if (fc.col === tc.col) {
        fSide = fSide || (tc.row >= fc.row ? 'bottom' : 'top');
        tSide = tSide || (tc.row >= fc.row ? 'top' : 'bottom');
      } else if (tc.col >= fc.col) {
        fSide = fSide || 'right'; tSide = tSide || 'left';
      } else {
        fSide = fSide || 'left'; tSide = tSide || 'right';
      }
    }
    return { ...rel, channel, fSide, tSide };
  });

  const totalW = cx + padX;
  const bottomChanCount = resolvedRelations.filter(rel => rel.channel === 'bottom').length;
  const totalH = ry + padY + (bottomChanCount ? bottomChanCount * 32 + 12 : 0);

  const entBoxes = new Map();
  for (const ent of spec.entities) {
    const c = Number(ent.col ?? 0);
    const r = Number(ent.row ?? 0);
    const l = entLayouts.get(ent.id);
    // Center entity horizontally inside its column
    const ex = colX[c] + Math.round((colWidths[c] - l.w) / 2);
    const ey = rowY[r];
    entBoxes.set(ent.id, { x: ex, y: ey, w: l.w, h: l.h, cx: ex + l.w / 2, cy: ey + l.h / 2, ent, l });
  }

  const defsSvg = `<marker id="__PREFIX__lineage-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0.5, 8 3, 0 5.5" fill="#087f8c"/></marker>`;

  function crowsFootGlyph(x, y, side, card) {
    const dir = side === 'left' ? -1 : side === 'right' ? 1 : side === 'top' ? -1 : 1;
    const horiz = side === 'left' || side === 'right';
    const stroke = '#64748b';
    let s = '';
    const isMany = card === '1..N' || card === '0..N' || card === 'N';
    const isZero = card === '0..1' || card === '0..N';
    const isOne = card === '1' || card === '1..1' || card === '0..1';
    if (horiz) {
      if (isMany) {
        s += `<line x1="${x}" y1="${y}" x2="${x + dir * 10}" y2="${y - 6}" stroke="${stroke}" stroke-width="1.35"/>`;
        s += `<line x1="${x}" y1="${y}" x2="${x + dir * 10}" y2="${y + 6}" stroke="${stroke}" stroke-width="1.35"/>`;
        s += `<line x1="${x}" y1="${y}" x2="${x + dir * 10}" y2="${y}" stroke="${stroke}" stroke-width="1.35"/>`;
      } else if (isOne) {
        s += `<line x1="${x + dir * 6}" y1="${y - 6}" x2="${x + dir * 6}" y2="${y + 6}" stroke="${stroke}" stroke-width="1.35"/>`;
      }
      if (isZero) {
        s += `<circle cx="${x + dir * 13}" cy="${y}" r="3.5" fill="#f8fbfc" stroke="${stroke}" stroke-width="1.35"/>`;
      } else if (isOne && !isMany) {
        s += `<line x1="${x + dir * 10}" y1="${y - 6}" x2="${x + dir * 10}" y2="${y + 6}" stroke="${stroke}" stroke-width="1.35"/>`;
      }
    } else {
      if (isMany) {
        s += `<line x1="${x}" y1="${y}" x2="${x - 6}" y2="${y + dir * 10}" stroke="${stroke}" stroke-width="1.35"/>`;
        s += `<line x1="${x}" y1="${y}" x2="${x + 6}" y2="${y + dir * 10}" stroke="${stroke}" stroke-width="1.35"/>`;
        s += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + dir * 10}" stroke="${stroke}" stroke-width="1.35"/>`;
      } else if (isOne) {
        s += `<line x1="${x - 6}" y1="${y + dir * 6}" x2="${x + 6}" y2="${y + dir * 6}" stroke="${stroke}" stroke-width="1.35"/>`;
      }
      if (isZero) {
        s += `<circle cx="${x}" cy="${y + dir * 13}" r="3.5" fill="#f8fbfc" stroke="${stroke}" stroke-width="1.35"/>`;
      } else if (isOne && !isMany) {
        s += `<line x1="${x - 6}" y1="${y + dir * 10}" x2="${x + 6}" y2="${y + dir * 10}" stroke="${stroke}" stroke-width="1.35"/>`;
      }
    }
    return s;
  }

  // Port distribution for schema entities
  const relSideTotals = new Map();
  const relSideUsage = new Map();
  for (const rel of resolvedRelations) {
    relSideTotals.set(`${rel.from}:${rel.fSide}`, (relSideTotals.get(`${rel.from}:${rel.fSide}`) || 0) + 1);
    relSideTotals.set(`${rel.to}:${rel.tSide}`, (relSideTotals.get(`${rel.to}:${rel.tSide}`) || 0) + 1);
  }
  function nextSchemaPort(id, side, box) {
    const key = `${id}:${side}`;
    const total = relSideTotals.get(key) || 1;
    const idx = relSideUsage.get(key) || 0;
    relSideUsage.set(key, idx + 1);
    const spread = side === 'left' || side === 'right' ? Math.max(16, Math.min(26, (box.h - 40) / Math.max(1, total))) : Math.max(20, Math.min(34, (box.w - 40) / Math.max(1, total)));
    const offset = total > 1 ? (idx - (total - 1) / 2) * spread : 0;
    if (side === 'left') return [box.x, box.cy + offset];
    if (side === 'right') return [box.x + box.w, box.cy + offset];
    if (side === 'top') return [box.cx + offset, box.y];
    return [box.cx + offset, box.y + box.h];
  }

  // Render relations
  let relsSvg = '';
  let relLabelsSvg = '';
  let bIdx = 0;

  for (const rel of resolvedRelations) {
    const b1 = entBoxes.get(rel.from);
    const b2 = entBoxes.get(rel.to);
    const { fSide, tSide } = rel;

    const p1 = nextSchemaPort(rel.from, fSide, b1);
    const p2 = nextSchemaPort(rel.to, tSide, b2);

    let pts;
    let lblPos;
    if (rel.channel === 'bottom') {
      const ly = ry + 18 + bIdx * 30;
      bIdx++;
      pts = [p1, [p1[0], ly], [p2[0], ly], p2];
      lblPos = [(p1[0] + p2[0]) / 2, ly];
    } else if (fSide === 'right' && tSide === 'left') {
      const midX = (p1[0] + p2[0]) / 2;
      pts = [p1, [midX, p1[1]], [midX, p2[1]], p2];
      lblPos = [midX, (p1[1] + p2[1]) / 2];
    } else {
      const midY = (p1[1] + p2[1]) / 2;
      pts = [p1, [p1[0], midY], [p2[0], midY], p2];
      lblPos = [(p1[0] + p2[0]) / 2, midY];
    }

    const isLineage = rel.kind === 'lineage';
    const stroke = isLineage ? '#087f8c' : '#64748b';
    const dash = isLineage ? ' stroke-dasharray="5,4"' : '';
    const marker = isLineage ? ' marker-end="url(#__PREFIX__lineage-arrow)"' : '';
    const pathD = roundedOrthogonalPath(pts, 7);

    const card1 = !isLineage && rel.fromCard ? crowsFootGlyph(p1[0], p1[1], fSide, rel.fromCard) : '';
    const card2 = !isLineage && rel.toCard ? crowsFootGlyph(p2[0], p2[1], tSide, rel.toCard) : '';

    relsSvg += `<g class="sol-edge" data-from="${esc(rel.from)}" data-to="${esc(rel.to)}"><path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="1.4"${dash}${marker}/>${card1}${card2}</g>`;

    if (rel.label) {
      const isHorizGap = !rel.channel && (fSide === 'right' && tSide === 'left');
      const maxRelLblW = isHorizGap ? Math.max(84, colGap - 18) : 150;
      const labelText = wrapEdgeLabelText(rel.label, maxRelLblW, 10);
      relLabelsSvg += `<g class="sol-edge-label-wrap" data-from="${esc(rel.from)}" data-to="${esc(rel.to)}">${renderPillLabel(lblPos[0], lblPos[1], labelText, isLineage ? { bg: '#ecfeff', stroke: '#99f6e4', fg: '#115e59', fontSize: 10 } : { bg: '#ffffff', stroke: '#cbd5e1', fg: '#334155', fontSize: 10 })}</g>`;
    }
  }

  // Render entity cards
  const entitiesSvg = [...entBoxes.values()].map(({ x, y, w, h, ent, l }) => {
    const pal = ENTITY_PALETTE[ent.kind || 'table'] || ENTITY_PALETTE.table;
    const dash = pal.dashed ? ' stroke-dasharray="5,3"' : '';
    const cols = Array.isArray(ent.columns) ? ent.columns : [];

    let inner = '';
    // Outer card
    inner += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="${pal.border}" stroke-width="1.4"${dash}/>`;
    // Header
    inner += `<path d="M${x},${y + 8} Q${x},${y} ${x + 8},${y} L${x + w - 8},${y} Q${x + w},${y} ${x + w},${y + 8} L${x + w},${y + l.headerH} L${x},${y + l.headerH} Z" fill="${pal.headerBg}"/>`;
    inner += `<text x="${x + 12}" y="${y + 21.5}" font-size="12.5" font-weight="700" fill="${pal.headerFg}">${esc(ent.name)}</text>`;

    // Kind tag pill in header
    const tagW = Math.round(measureText(pal.tag, 9, false) + 12);
    inner += `<rect x="${x + w - tagW - 10}" y="${y + 8}" width="${tagW}" height="17" rx="4" fill="${pal.tagBg}"/><text x="${x + w - tagW / 2 - 10}" y="${y + 19.5}" text-anchor="middle" font-size="8.8" font-weight="700" letter-spacing="0.04em" fill="${pal.tagFg}">${esc(pal.tag)}</text>`;

    let rowTop = y + l.headerH;
    if (l.grainLines.length) {
      inner += `<rect x="${x + 1}" y="${rowTop}" width="${w - 2}" height="${l.grainH}" fill="${pal.subBg}"/><line x1="${x}" y1="${rowTop + l.grainH}" x2="${x + w}" y2="${rowTop + l.grainH}" stroke="${pal.border}" stroke-width="0.75"/>`;
      l.grainLines.forEach((gl, gIdx) => {
        inner += `<text x="${x + 12}" y="${rowTop + 15.5 + gIdx * 14}" font-size="10.2" font-weight="500" fill="${pal.subFg}">${esc(gl)}</text>`;
      });
      rowTop += l.grainH;
    }

    let prevWasKey = false;
    cols.forEach((c, idx) => {
      const cy = rowTop + idx * l.rowH;
      const keyList = c.key ? String(c.key).split(',').map(k => k.trim().toUpperCase()).filter(Boolean) : [];
      const isKey = keyList.length > 0;
      const zebra = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
      inner += `<rect x="${x + 1}" y="${cy}" width="${w - 2}" height="${l.rowH}" fill="${zebra}"/>`;
      if (prevWasKey && !isKey) {
        inner += `<line x1="${x + 1}" y1="${cy}" x2="${x + w - 1}" y2="${cy}" stroke="#cbd5e1" stroke-width="1"/>`;
      }
      prevWasKey = isKey;

      let nameX = x + 12;
      for (const k of keyList) {
        const badgeStyle = k === 'PK'
          ? { bg: '#fef3c7', fg: '#92400e', bd: '#f59e0b' }
          : k === 'FK'
            ? { bg: '#dbeafe', fg: '#1e40af', bd: '#60a5fa' }
            : { bg: '#ede9fe', fg: '#5b21b6', bd: '#a78bfa' };
        inner += `<rect x="${nameX}" y="${cy + 4.5}" width="22" height="15" rx="3" fill="${badgeStyle.bg}" stroke="${badgeStyle.bd}" stroke-width="0.8"/><text x="${nameX + 11}" y="${cy + 15}" text-anchor="middle" font-size="8.8" font-weight="700" fill="${badgeStyle.fg}">${esc(k)}</text>`;
        nameX += 26;
      }

      inner += `<text x="${nameX}" y="${cy + 15.5}" class="mono" font-size="11.2" font-weight="${isKey ? '600' : '400'}" fill="#0f172a">${esc(c.name)}</text>`;
      const typeLabel = (c.type || '') + (c.nullable ? '?' : '');
      inner += `<text x="${x + w - 12}" y="${cy + 15.5}" text-anchor="end" class="mono" font-size="10.2" fill="#64748b">${esc(typeLabel)}</text>`;
    });

    return `<g class="sol-node schema-entity" data-node-id="${esc(ent.id)}" tabindex="0" role="group" aria-label="${esc(ent.name)}">${inner}</g>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" class="sol-svg schema-svg" role="img" aria-label="${esc(spec.title)}" data-natural-width="${totalW}" style="width:${totalW}px;max-width:100%;height:auto"><defs>${defsSvg}</defs>${relsSvg}${entitiesSvg}${relLabelsSvg}</svg>`;

  const defaultLegend = [
    { type: 'box', role: 'step', label: locale === 'pt-BR' ? 'Entidade física / tabela' : 'Physical table' },
    { type: 'box', role: 'output', label: locale === 'pt-BR' ? 'Visão derivada / mart' : 'Derived mart / view' },
    { type: 'box', role: 'json', label: locale === 'pt-BR' ? 'Objeto lógico / JSON' : 'Logical JSON object' },
    { type: 'dashed', role: 'output', label: locale === 'pt-BR' ? 'Derivação / linhagem (não é FK)' : 'Lineage / aggregation (not FK)' },
  ];
  const legendHtml = renderLegendHtml(spec.legend || defaultLegend, locale);
  const noteHtml = spec.note ? `<p class="diagram-note">${esc(spec.note)}</p>` : '';
  return wrapFigure(svg, spec.title, { legendHtml, noteHtml, diagramLabel });
}

/**
 * Enhances Mermaid SVGs produced by beautiful-mermaid:
 * - Reorders ER columns to [Key Badge] [column_name] [type] and differentiates PK/FK colors.
 * - Rounds ER entity rects and removes inflated scaling distortion.
 * - Adds semantic classes to Yes/No edge labels and state nodes.
 */
export function enhanceMermaidSvg($, mermaidSource) {
  const isEr = /^\s*erDiagram/m.test(mermaidSource);
  const isState = /^\s*stateDiagram/m.test(mermaidSource);

  // Protect subgraph text coloring so only the subgraph header label gets styled
  $('g.subgraph').each((_, sg) => {
    const $sg = $(sg);
    const directTexts = $sg.children('text');
    if (directTexts.length) directTexts.first().addClass('subgraph-title');
  });

  // Node title/subtitle from <br><small>
  $('g.node text').each((_, t) => {
    const tspans = $(t).find('tspan');
    if (tspans.length > 1) {
      $(tspans[0]).addClass('node-title');
      tspans.slice(1).addClass('node-subtitle');
    }
  });

  // Semantic branch labels in flowcharts (matches exact words and composite prefixes like "Sim (dados novos)")
  $('g.edge-label').each((_, el) => {
    const $el = $(el);
    const txt = $el.text().trim().toLowerCase();
    if (/^(sim|yes|ok|v[aá]lido|aprovado|sucesso|confirmado)\b/.test(txt)) {
      $el.addClass('edge-label-yes');
    } else if (/^(n[aã]o|no|erro|falha|inv[aá]lido|descartar|rejeitado)\b/.test(txt)) {
      $el.addClass('edge-label-no');
    }
  });

  // Semantic state coloring in stateDiagram-v2
  if (isState) {
    $('g.node').each((_, el) => {
      const $el = $(el);
      const label = ($el.attr('data-label') || $el.text() || '').trim().toLowerCase();
      if (/^(aberto|open|erro|falha|cr[ií]tico)/.test(label)) $el.addClass('state-open');
      else if (/^(recuper|pending|pendente|draft|aguard)/.test(label)) $el.addClass('state-recovering');
      else if (/^(resolv|fechado|closed|ok|aprov|confirm)/.test(label)) $el.addClass('state-resolved');
    });
  }

  // Upgrade ER entity cards: rounded corners + natural [Badge] [name] ... [type] column order + PK/FK color contrast
  if (isEr) {
    $('g.entity').each((_, ent) => {
      const $ent = $(ent);
      const rects = $ent.children('rect');
      if (rects.length >= 2) {
        $(rects[0]).attr({ rx: '7', ry: '7', class: 'er-card-bg' });
        $(rects[1]).attr({ rx: '7', ry: '7', class: 'er-card-header' });
      }
      const x0 = parseFloat($(rects[0]).attr('x') || '0');
      const w0 = parseFloat($(rects[0]).attr('width') || '180');

      // Group attribute rows by y coordinate
      const texts = $ent.children('text').toArray();
      // Skip header title (first text with font-weight 700)
      const attrTexts = texts.slice(1);
      const rowsByY = new Map();
      for (const t of attrTexts) {
        const yKey = String(Math.round(parseFloat($(t).attr('y') || '0')));
        if (!rowsByY.has(yKey)) rowsByY.set(yKey, []);
        rowsByY.get(yKey).push($(t));
      }
      // Match key badge rects by vertical proximity
      const badgeRects = rects.toArray().slice(2).map(r => $(r));

      for (const [yKey, rowTexts] of rowsByY) {
        const yNum = Number(yKey);
        const rowBadgeRect = badgeRects.find(r => Math.abs(parseFloat(r.attr('y') || '0') + 7 - yNum) < 5);
        const keyTxt = rowTexts.find(t => /^(PK|FK|UK)$/i.test(t.text().trim()));
        const monoTexts = rowTexts.filter(t => t.hasClass('mono'));

        if (keyTxt && rowBadgeRect) {
          const k = keyTxt.text().trim().toUpperCase();
          rowBadgeRect.addClass(k === 'PK' ? 'er-badge-pk' : k === 'FK' ? 'er-badge-fk' : 'er-badge-uk');
          keyTxt.addClass(k === 'PK' ? 'er-badge-text-pk' : k === 'FK' ? 'er-badge-text-fk' : 'er-badge-text-uk');
        }

        // beautiful-mermaid emits [type] (no text-anchor) then [name] (text-anchor="end"). Swap them!
        if (monoTexts.length === 2) {
          const typeEl = monoTexts[0];
          const nameEl = monoTexts[1];
          const nameX = parseFloat(typeEl.attr('x') || String(x0 + 36));
          nameEl.attr({ x: String(nameX), 'text-anchor': 'start', 'font-weight': keyTxt ? '600' : '400', class: 'mono er-col-name' });
          typeEl.attr({ x: String(x0 + w0 - 10), 'text-anchor': 'end', class: 'mono er-col-type' });
        }
      }
    });
  }
}
