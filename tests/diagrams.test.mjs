import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { renderMermaidSVG } from 'beautiful-mermaid';
import {
  parseRichTokens,
  wrapRichLines,
  renderSolutionDiagram,
  renderSchemaDiagram,
  enhanceMermaidSvg,
  validateChartSpec,
} from '../scripts/diagrams.mjs';
import { build } from '../scripts/build.mjs';
import { validateHtml } from '../scripts/validate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('parseRichTokens and wrapRichLines isolate inline code chips and hard-wrap long separatorless tokens', () => {
  const tokens = parseRichTokens('pasta `entrada_comparador/` e `sand_obk.report`');
  assert.deepEqual(tokens, [
    { text: 'pasta ', code: false },
    { text: 'entrada_comparador/', code: true },
    { text: ' e ', code: false },
    { text: 'sand_obk.report', code: true },
  ]);
  const wrapped = wrapRichLines(['lê `tabela_a` e grava em `tabela_b` com sucesso'], 160);
  assert.ok(wrapped.length >= 2);

  const hardWrapped = wrapRichLines(['hash `' + 'a'.repeat(48) + '`'], 140);
  assert.ok(hardWrapped.length >= 2);
});

test('renderSolutionDiagram produces 2D zones, stacked nodes, cylinders, gutters, port spreading, bypass routing, legend and note', () => {
  const html = renderSolutionDiagram({
    title: 'Arquitetura 2D',
    inputs: { label: 'ENTRADAS' },
    zones: [
      { id: 'z2', title: 'ESTÁGIO 2', subtitle: 'rápido e com subtítulo detalhado para testar quebra em coluna estreita', variant: 'warm', row: 0, colStart: 1, colSpan: 2 },
      { id: 'z1', title: 'ESTÁGIO 1', subtitle: 'pesado', variant: 'cool', row: 1, colStart: 1, colSpan: 2, callouts: [{ col: 2, row: 1, text: 'nota lateral' }, { col: 2, row: 1, text: 'nota lateral' }] },
    ],
    nodes: [
      { id: 'in1', col: 0, row: 0, role: 'regulator', title: 'CSV <bruto>', lines: ['pasta `entrada/`'] },
      { id: 'in2', col: 0, row: 1, shape: 'cylinder', role: 'analytical', title: 'Base Unify', lines: ['`lake.raw`'], meta: 'Delta v42' },
      { id: 's1', col: 1, row: 0, step: 1, role: 'step', title: 'Validar', lines: ['checa chaves'] },
      { id: 's2', col: 1, row: 1, step: 2, role: 'step', title: 'Planejar', lines: ['calcula lotes'] },
      { id: 'out1', col: 2, row: 0, shape: 'cylinder', role: 'regulator', title: 'Resultado', lines: ['BI'] },
      { id: 's3', col: 2, row: 0, step: 3, role: 'step', title: 'Arquivar', lines: ['move CSV'] },
      { id: 'agg', col: 2, row: 1, role: 'analytical', title: 'Agregado', lines: ['~250 linhas'], meta: 'Grão: dia' },
    ],
    edges: [
      { from: 'in1', to: 's1' },
      // Skip edge from col 0 to col 2 in row 0 should auto-bypass over s1 (col 1) via top lane
      { from: 'in1', to: 'out1', label: 'atalho escopo' },
      { from: 's1', to: 's2', label: 'corte' },
      // Two bottom channel exits from in2 must spread horizontally instead of colliding on the same pixel
      { from: 'in2', to: 'agg', channel: 'bottom', role: 'analytical', label: 'partições D...D+7' },
      { from: 'in2', to: 's2', channel: 'bottom-inner', style: 'dashed', label: 'controle 1' },
      { from: 'agg', to: 's2', channel: 'bottom-inner', style: 'dashed', label: 'controle 2' },
    ],
    legend: [
      { type: 'box', role: 'regulator', label: 'Regulador' },
      { type: 'dashed', role: 'neutral', label: 'Controle' },
    ],
    note: 'Observação operacional',
  });

  const $ = load(html);
  assert.equal($('figure.diagram').length, 1);
  assert.equal($('.sol-zone').length, 2);
  assert.equal($('.sol-node').length, 7);
  assert.equal($('.sol-edge').length, 6);
  assert.equal($('.figure-legend .legend-item').length, 2);
  assert.equal($('.diagram-note').text(), 'Observação operacional');
  assert.ok(!html.includes('<bruto>'));
  assert.ok(html.includes('&lt;bruto&gt;'));

  // Verify the two bottom exits from in2 start at distinct X coordinates (port spreading works!)
  const in2Edges = $('.sol-edge[data-from="in2"]').map((_, e) => $(e).attr('d')).get();
  assert.equal(in2Edges.length, 2);
  const startX = d => d.match(/^M([\d.]+),/)?.[1];
  assert.notEqual(startX(in2Edges[0]), startX(in2Edges[1]), 'Two bottom edges from in2 should have spread ports');

  assert.throws(() => renderSolutionDiagram({ title: 'Bad', nodes: [] }), /non-empty nodes/);
  assert.throws(() => renderSolutionDiagram({
    title: 'Bad edge',
    nodes: [{ id: 'a', title: 'A' }],
    edges: [{ from: 'a', to: 'missing' }],
  }), /unknown node/);
});

test('renderSchemaDiagram renders typed entities, wrapped grain, spread ports, natural key order and lineage vs FK', () => {
  const html = renderSchemaDiagram({
    title: 'Modelo de Tabelas',
    entities: [
      {
        id: 't1',
        name: 'agregado_controle',
        kind: 'table',
        grain: 'Grão: 1 linha = dia processado com descrição deliberadamente longa para forçar quebra elegante de linha no subheader',
        col: 0,
        row: 0,
        columns: [
          { key: 'PK', name: 'dia', type: 'date' },
          { key: 'UK', name: 'run_id', type: 'string' },
        ],
      },
      {
        id: 'm1',
        name: 'agregado_diario',
        kind: 'mart',
        grain: 'Grão: 1 linha = dia × casa',
        col: 1,
        row: 0,
        columns: [
          { key: 'PK', name: 'dia', type: 'date' },
          { key: 'FK', name: 'run_id', type: 'string' },
          { name: 'qtd', type: 'bigint', nullable: true },
        ],
      },
      {
        id: 'm2',
        name: 'mart_final',
        kind: 'mart',
        grain: 'Grão: 1 linha = execução',
        col: 2,
        row: 0,
        columns: [{ key: 'PK', name: 'execucao_id', type: 'string' }],
      },
    ],
    relations: [
      { from: 't1', to: 'm1', fromCard: '1', toCard: '1..N', label: 'controla' },
      { from: 't1', to: 'm1', kind: 'lineage', label: 'derivação' },
      // Skip relation from t1 (col 0) to m2 (col 2) across m1 (col 1) auto-routes to bottom channel
      { from: 't1', to: 'm2', kind: 'lineage', label: 'corte direto' },
    ],
  });

  const $ = load(html);
  assert.equal($('.schema-entity').length, 3);
  assert.equal($('.sol-edge').length, 3);
  assert.ok(html.includes('TABELA'));
  assert.ok(html.includes('MART / VIEW'));
  assert.ok(html.includes('bigint?'));
  assert.ok(html.includes('stroke-dasharray="5,4"'));

  // Two right->left relations between t1 and m1 should have distinct start Y coordinates
  const rightPaths = $('.sol-edge[data-from="t1"][data-to="m1"] path').map((_, p) => $(p).attr('d')).get();
  assert.equal(rightPaths.length, 2);
  const startY = d => d.match(/^M[\d.]+,([\d.]+)/)?.[1];
  assert.notEqual(startY(rightPaths[0]), startY(rightPaths[1]), 'Schema side ports should spread vertically');
});

test('enhanceMermaidSvg upgrades ER column order, PK/FK classes, composite branch badges and state colors', () => {
  const erSource = `erDiagram\n  A ||--o{ B : tem\n  A {\n    string id PK\n  }\n  B {\n    string id PK\n    string a_id FK\n  }`;
  const erRaw = renderMermaidSVG(erSource);
  const $er = load(erRaw, { xml: true });
  enhanceMermaidSvg($er, erSource);

  const bEnt = $er('g.entity[data-id="B"]');
  assert.equal(bEnt.find('rect.er-card-bg').attr('rx'), '7');
  assert.equal(bEnt.find('rect.er-badge-pk').length, 1);
  assert.equal(bEnt.find('rect.er-badge-fk').length, 1);
  const colNameX = parseFloat(bEnt.find('text.er-col-name').first().attr('x'));
  const colTypeX = parseFloat(bEnt.find('text.er-col-type').first().attr('x'));
  assert.ok(colNameX < colTypeX, `Expected column name (${colNameX}) to the left of type (${colTypeX})`);

  const flowSource = `flowchart TD\n  A[Teste] -->|Sim (dados novos)| B[Ok]\n  A -->|Não (expirado)| C[Erro]`;
  const $flow = load(renderMermaidSVG(flowSource), { xml: true });
  enhanceMermaidSvg($flow, flowSource);
  assert.equal($flow('g.edge-label-yes').length, 1);
  assert.equal($flow('g.edge-label-no').length, 1);

  const stateSource = `stateDiagram-v2\n  [*] --> Aberto\n  Aberto --> Recuperando\n  Recuperando --> Resolvido`;
  const $state = load(renderMermaidSVG(stateSource), { xml: true });
  enhanceMermaidSvg($state, stateSource);
  assert.equal($state('g.node.state-open').length, 1);
  assert.equal($state('g.node.state-recovering').length, 1);
  assert.equal($state('g.node.state-resolved').length, 1);
});

test('build enforces reserved IDs, localized eyebrow, safe table attributes, typed callouts, and column badges', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doc-enhancements-'));
  try {
    // 1. Reserved section ID must fail cleanly
    await fs.writeFile(path.join(dir, 'bad.json'), JSON.stringify({
      title: 'Bad', subtitle: 'Test', version: '1', updated: '2026-11-14', content: 'bad.md',
      sections: [{ id: 'search', title: 'Busca', audience: 'all' }],
    }));
    await fs.writeFile(path.join(dir, 'bad.md'), '## Busca\n\nTexto.\n');
    await assert.rejects(() => build(path.join(dir, 'bad.json'), path.join(dir, 'bad.html')), /Reserved section id/);

    // 2. English default eyebrow + table with class + typed blockquotes + column badges
    await fs.writeFile(path.join(dir, 'en.json'), JSON.stringify({
      title: 'Pipeline', subtitle: 'English docs', version: '1.0', updated: '2026-11-14', language: 'en', content: 'en.md',
      sections: [{ id: 'rules', title: 'Rules', audience: 'business' }],
    }));
    await fs.writeFile(path.join(dir, 'en.md'), [
      '## Rules',
      '',
      '> Business rule: Deduplicate before summing.',
      '',
      '> Worked example: Day 1 has 10 rows.',
      '',
      '> Warning: Do not truncate target.',
      '',
      '> Limitation: Excludes archived partitions.',
      '',
      '<table class="custom"><thead><tr><th>Col</th><th>Role</th></tr></thead><tbody><tr><td><code>id</code></td><td><code>PK</code> <code>NOT NULL</code></td></tr></tbody></table>',
      '',
    ].join('\n'));
    const out = path.join(dir, 'en.html');
    const r = await build(path.join(dir, 'en.json'), out);
    assert.equal(r.passed, true);
    const html = await fs.readFile(out, 'utf8');
    const $ = load(html);
    assert.equal($('.eyebrow').text(), 'Functional & technical documentation');
    assert.equal($('blockquote.callout-rule').length, 1);
    assert.equal($('blockquote.callout-example').length, 1);
    assert.equal($('blockquote.callout-warning').length, 1);
    assert.equal($('blockquote.callout-limit').length, 1);
    assert.equal($('.table-wrap table.custom').length, 1);
    assert.equal($('code.col-badge-pk').length, 1);
    assert.equal($('code.col-badge-notnull').length, 1);
    assert.equal($('[data-audience-filter]').length, 4);
    assert.equal($('#search-clear').length, 1);
    assert.equal($('#dialog-zoom-label').length, 1);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('inspect_repo.py discovers Jinja/SQL/DDL data-engineering templates and detects stackSignals', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'inspect-de-test-'));
  try {
    await fs.writeFile(path.join(dir, 'dbt_project.yml'), 'name: lakehouse\n');
    await fs.mkdir(path.join(dir, 'models'), { recursive: true });
    await fs.writeFile(path.join(dir, 'models/mart.sql.j2'), 'SELECT * FROM {{ ref("stg_orders") }}\n');
    await fs.writeFile(path.join(dir, 'pipeline.py'), 'from pyspark.sql import SparkSession\n# USING DELTA\n');
    const outJson = path.join(dir, 'inv.json');
    execFileSync('python3', [path.join(root, 'scripts/inspect_repo.py'), dir, '--out', outJson]);
    const inv = JSON.parse(await fs.readFile(outJson, 'utf8'));
    assert.equal(inv.countsByKind.template, 1);
    assert.ok(inv.stackSignals.dbt >= 1);
    assert.ok(inv.stackSignals.spark_pyspark >= 1);
    assert.ok(inv.stackSignals.delta_lake >= 1);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('showcase example builds cleanly preserving all 11 categories, audience filters, dictionary badges and new diagrams', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doc-showcase-'));
  try {
    const out = path.join(dir, 'showcase.html');
    const r = await build(path.join(root, 'examples/showcase/document.json'), out);
    assert.equal(r.passed, true);
    assert.equal(r.contentSections, 11);
    assert.equal(r.diagrams, 5);
    assert.equal(r.charts, 1);
    const html = await fs.readFile(out, 'utf8');
    const v = validateHtml(html);
    assert.equal(v.passed, true);
    const $ = load(html);
    assert.equal($('#dialog-zoom-in').length, 1);
    assert.equal($('#dialog-zoom-out').length, 1);
    assert.equal($('#dialog-zoom-label').length, 1);
    assert.equal($('[data-audience-filter]').length, 4);
    assert.equal($('blockquote.callout-rule').length, 1);
    assert.equal($('blockquote.callout-example').length, 1);
    assert.equal($('blockquote.callout-warning').length, 1);
    assert.equal($('blockquote.callout-limit').length, 1);
    assert.ok($('code.col-badge-pk').length >= 4);
    assert.ok($('code.col-badge-partition').length >= 1);
    const ids = $('[id]').map((_, e) => $(e).attr('id')).get();
    assert.equal(new Set(ids).size, ids.length);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('renderSolutionDiagram routes self-loops externally, widens colGap for horizontal labels, and detours same-column bottom edges around blockers', () => {
  const html = renderSolutionDiagram({
    title: 'Roteamento de fluxos e desvios',
    cols: 3,
    colGap: 40,
    zones: [
      { id: 'z1', title: 'ESTÁGIO', variant: 'warm', row: 0, colStart: 1, colSpan: 2 },
    ],
    nodes: [
      { id: 'n0', col: 0, row: 0, role: 'step', title: 'Origem', lines: ['passo 0'] },
      { id: 'n1', col: 1, row: 0, role: 'step', title: 'Validação', lines: ['passo 1'] },
      { id: 'dec', col: 2, row: 0, shape: 'decision', role: 'warning', title: 'Publicar?', lines: ['checa critérios'] },
      { id: 'prom', col: 2, row: 1, role: 'output', title: 'Promover', lines: ['publica release'] },
    ],
    edges: [
      { from: 'n0', to: 'n1', label: 'dados ok ou falha final' },
      { from: 'n1', to: 'dec', label: 'sim' },
      { from: 'dec', to: 'dec', branch: 'no', style: 'dashed', label: 'Não · mantém draft' },
      { from: 'dec', to: 'prom', channel: 'bottom', style: 'dashed', label: 'prova de deploy' },
    ],
  });

  const $ = load(html);
  const svg = $('svg.sol-svg');
  const viewBox = svg.attr('viewBox').split(/\s+/).map(Number);
  assert.ok(viewBox[2] > 24 * 2 + 236 * 3 + 40 * 2, `Expected canvas width (${viewBox[2]}) to expand for self-loop and wide horizontal label`);

  // Self-loop label pill must sit outside the dec node right edge
  const decRect = $('.sol-node[data-node-id="dec"] rect').first();
  const decRight = Number(decRect.attr('x')) + Number(decRect.attr('width'));
  const selfLabelRect = $('.sol-edge-label-wrap[data-from="dec"][data-to="dec"] rect').first();
  assert.ok(Number(selfLabelRect.attr('x')) > decRight, `Self-loop pill x (${selfLabelRect.attr('x')}) must be to the right of node (${decRight})`);

  // Horizontal label between col 0 and col 1 must fit without clipping node rects
  const n0Right = Number($('.sol-node[data-node-id="n0"] rect').first().attr('x')) + Number($('.sol-node[data-node-id="n0"] rect').first().attr('width'));
  const n1Left = Number($('.sol-node[data-node-id="n1"] rect').first().attr('x'));
  const gap = n1Left - n0Right;
  const hLabelW = Number($('.sol-edge-label-wrap[data-from="n0"][data-to="n1"] rect').first().attr('width'));
  assert.ok(gap >= hLabelW + 10, `Expected expanded colGap (${gap}) to accommodate horizontal label (${hLabelW})`);

  // Bottom-channel edge dec -> prom must detour horizontally around prom instead of dropping straight through its center
  const decPromPath = $('.sol-edge[data-from="dec"][data-to="prom"]').attr('d');
  const promX = Number($('.sol-node[data-node-id="prom"] rect').first().attr('x'));
  const promW = Number($('.sol-node[data-node-id="prom"] rect').first().attr('width'));
  const pathXs = [...decPromPath.matchAll(/[MLQ]([\d.]+),/g)].map(m => Number(m[1]));
  assert.ok(pathXs.some(x => x > promX + promW), `Expected dec->prom bottom edge to detour right past ${promX + promW}, got Xs=${pathXs.join(',')}`);
});

test('renderSolutionDiagram auto-bypasses explicit right->left skip edges and wraps long bold titles in narrow boxes', () => {
  const html = renderSolutionDiagram({
    title: 'Bypass e quebra de título',
    colWidth: 196,
    zones: [{ id: 'z1', title: 'ESTÁGIO 1', variant: 'warm', row: 0, colStart: 1, colSpan: 2 }],
    nodes: [
      { id: 'apis', col: 0, row: 0, role: 'regulator', title: 'Oito Admins', lines: ['origem'] },
      { id: 'restore', col: 1, row: 0, step: 1, role: 'step', title: 'Restaurar e validar', lines: ['estado'] },
      { id: 'collect', col: 2, row: 0, step: 2, role: 'step', title: 'Diagnóstico + última boa', lines: ['coleta'] },
    ],
    edges: [
      { from: 'apis', to: 'collect', fromSide: 'right', toSide: 'left', label: 'JSON Admin' },
      { from: 'restore', to: 'collect', label: 'ok' },
    ],
  });

  const $ = load(html);
  const restoreRect = $('.sol-node[data-node-id="restore"] rect').first();
  const restoreTop = Number(restoreRect.attr('y'));
  const pillRect = $('.sol-edge-label-wrap[data-from="apis"][data-to="collect"] rect').first();
  const pillBottom = Number(pillRect.attr('y')) + Number(pillRect.attr('height'));
  assert.ok(pillBottom < restoreTop, `Expected JSON Admin pill bottom (${pillBottom}) above restore top (${restoreTop})`);

  // Long bold title on collect (colWidth=196) should wrap into 2 <text> lines instead of clipping edge
  const collectTexts = $('.sol-node[data-node-id="collect"] text[font-weight="700"]').length;
  assert.ok(collectTexts >= 3, `Expected step badge + >=2 wrapped title lines, got ${collectTexts}`);
});

test('renderSchemaDiagram routes cross-row bottom->right relations through inter-row gutter around intermediate entities', () => {
  const html = renderSchemaDiagram({
    title: 'Entidades lógicas',
    entities: [
      { id: 'runs', name: 'runs', kind: 'json', col: 0, row: 0, columns: [{ key: 'PK', name: 'run_id', type: 'string' }] },
      { id: 'reports', name: 'reports', kind: 'json', col: 1, row: 0, columns: [{ key: 'PK,FK', name: 'run_id', type: 'string' }] },
      { id: 'probes', name: 'probes', kind: 'json', col: 2, row: 0, columns: [{ key: 'FK', name: 'run_id', type: 'string' }] },
      { id: 'observations', name: 'observations', kind: 'json', col: 0, row: 1, columns: [{ key: 'PK', name: 'entity_id', type: 'string' }] },
      { id: 'incidents', name: 'incidents', kind: 'json', col: 1, row: 1, grain: 'Grão: 1 ocorrência = entidade ou fonte × regra', columns: [{ key: 'PK', name: 'id', type: 'string' }] },
    ],
    relations: [
      { from: 'runs', to: 'reports', fromCard: '1', toCard: '1..N', label: 'contém' },
      { from: 'runs', to: 'probes', fromSide: 'right', toSide: 'left', kind: 'lineage', label: 'atalho topo' },
      { from: 'reports', to: 'observations', fromSide: 'bottom', toSide: 'right', fromCard: '1', toCard: '1..N', label: 'normaliza' },
    ],
  });

  const $ = load(html);
  const incRect = $('.schema-entity[data-node-id="incidents"] rect').first();
  const incX = Number(incRect.attr('x'));
  const incY = Number(incRect.attr('y'));
  const incW = Number(incRect.attr('width'));
  const incH = Number(incRect.attr('height'));

  const normPill = $('.sol-edge-label-wrap[data-from="reports"][data-to="observations"] rect').first();
  const normY = Number(normPill.attr('y'));
  const normBottom = normY + Number(normPill.attr('height'));
  assert.ok(normBottom < incY, `Expected normaliza pill bottom (${normBottom}) to stay cleanly in gutter above incidents top (${incY})`);

  // Ensure every coordinate of reports->observations stays clear of incidents box interior
  const relPath = $('.sol-edge[data-from="reports"][data-to="observations"] path').attr('d');
  const coords = [...relPath.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
  for (const [x, y] of coords) {
    const insideInc = x > incX && x < incX + incW && y > incY && y < incY + incH;
    assert.equal(insideInc, false, `Point (${x},${y}) must not enter incidents box (${incX}..${incX + incW}, ${incY}..${incY + incH})`);
  }

  // Row 0 skip relation runs->probes should go above runs top via top channel
  const runsTop = Number($('.schema-entity[data-node-id="runs"] rect').first().attr('y'));
  const topPillBottom = Number($('.sol-edge-label-wrap[data-from="runs"][data-to="probes"] rect').first().attr('y')) +
    Number($('.sol-edge-label-wrap[data-from="runs"][data-to="probes"] rect').first().attr('height'));
  assert.ok(topPillBottom < runsTop, `Expected runs->probes top pill (${topPillBottom}) above runs top (${runsTop})`);
});

test('v1.5.0 diagrams: inline code in note, stripped title backticks, single ?, dynamic key badge width, theme classes and pill collision avoidance', () => {
  const solHtml = renderSolutionDiagram({
    title: 'Pipeline `bronze_events` v1.5',
    zones: [
      { id: 'z1', title: 'CAMADA STREAM', variant: 'warm', row: 0, colStart: 0, colSpan: 2 },
    ],
    nodes: [
      { id: 'a', col: 0, row: 0, role: 'analytical', title: 'Origem', lines: ['leitura'] },
      { id: 'b', col: 1, row: 0, role: 'output', title: 'Destino', lines: ['escrita'] },
    ],
    edges: [
      { from: 'a', to: 'b', role: 'analytical', label: 'fluxo 1' },
      { from: 'a', to: 'b', role: 'output', label: 'fluxo 2' },
    ],
    note: 'Usa `checkpointLocation` e `mergeSchema`.',
  });
  const $s = load(solHtml);
  assert.ok(!$s('.figure-tag').text().includes('`'));
  assert.ok(!$s('figcaption').text().includes('`'));
  assert.equal($s('.diagram-note code').length, 2);
  assert.equal($s('.sol-zone-warm').length, 1);
  assert.equal($s('.sol-node-role-analytical').length, 1);
  assert.equal($s('.sol-node-role-output').length, 1);
  assert.equal($s('.sol-arrow-head-analytical').length, 1);
  assert.equal($s('.sol-arrow-head-output').length, 1);

  // Two parallel edge pills between a -> b must not collide vertically
  const pillRects = $s('.sol-edge-label-wrap rect').map((_, r) => ({
    x: Number($s(r).attr('x')),
    y: Number($s(r).attr('y')),
    w: Number($s(r).attr('width')),
    h: Number($s(r).attr('height')),
  })).get();
  assert.equal(pillRects.length, 2);
  const overlapX = pillRects[0].x < pillRects[1].x + pillRects[1].w && pillRects[0].x + pillRects[0].w > pillRects[1].x;
  const overlapY = pillRects[0].y < pillRects[1].y + pillRects[1].h && pillRects[0].y + pillRects[0].h > pillRects[1].y;
  assert.equal(overlapX && overlapY, false, 'Parallel edge label pills must resolve non-overlapping positions');

  const schHtml = renderSchemaDiagram({
    title: 'Contrato `delta.gold`',
    entities: [
      {
        id: 'e1',
        name: 'gold_tbl',
        kind: 'mart',
        grain: '1 linha = evento',
        col: 0,
        row: 0,
        columns: [
          { key: 'PART', name: 'dt_ref', type: 'date' },
          { name: 'payload', type: 'string?', nullable: true },
        ],
      },
    ],
    note: 'Grava via `MERGE INTO`.',
  });
  const $sch = load(schHtml);
  assert.ok(!schHtml.includes('string??'));
  assert.ok(schHtml.includes('string?'));
  assert.equal($sch('.schema-header-mart').length, 1);
  assert.equal($sch('.diagram-note code').length, 1);
  assert.ok(Number($sch('.schema-key-badge-part').first().attr('width')) > 22, 'Wide key badge PART should size dynamically');
});

test('v1.9.0 diagrams: multiple bottom-inner edges get distinct Y lanes, colSpan honors occupied cells, and crowded pills stay inside canvas', () => {
  const html = renderSolutionDiagram({
    title: 'Canais múltiplos e colSpan',
    cols: 3,
    zones: [
      { id: 'z1', title: 'ESTÁGIO ÚNICO', variant: 'cool', row: 0, colStart: 0, colSpan: 3 },
    ],
    nodes: [
      { id: 'wide', col: 0, row: 0, colSpan: 2, role: 'step', title: 'Etapa Larga', lines: ['ocupa col 0 e 1'] },
      { id: 'n2', col: 2, row: 0, role: 'output', title: 'Destino', lines: ['col 2'] },
      { id: 'n3', col: 0, row: 1, role: 'analytical', title: 'Base 1', lines: ['linha 1'] },
      { id: 'n4', col: 1, row: 1, role: 'analytical', title: 'Base 2', lines: ['linha 1'] },
      { id: 'n5', col: 2, row: 1, role: 'analytical', title: 'Base 3', lines: ['linha 1'] },
    ],
    edges: [
      { from: 'wide', to: 'n2', label: 'saída larga' },
      { from: 'n3', to: 'n4', label: 'p1' },
      { from: 'n3', to: 'n4', label: 'p2' },
      { from: 'n3', to: 'n4', label: 'p3' },
      { from: 'n3', to: 'n5', channel: 'bottom-inner', style: 'dashed', label: 'lane A' },
      { from: 'n4', to: 'n5', channel: 'bottom-inner', style: 'dashed', label: 'lane B' },
    ],
  });
  const $ = load(html);
  const svg = $('svg.sol-svg');
  const vb = svg.attr('viewBox').split(/\s+/).map(Number);

  // colSpan=2 node (wide) must span wider than a single column and connect directly to n2
  const wideRect = $('.sol-node[data-node-id="wide"] rect').first();
  assert.ok(Number(wideRect.attr('width')) > 300);

  // Two bottom-inner edges must use distinct horizontal laneY coordinates
  const dA = $('.sol-edge[data-from="n3"][data-to="n5"]').attr('d');
  const dB = $('.sol-edge[data-from="n4"][data-to="n5"]').attr('d');
  const extractYs = d => [...d.matchAll(/L[\d.]+,([\d.]+)/g)].map(m => Number(m[1]));
  const laneYA = Math.max(...extractYs(dA));
  const laneYB = Math.max(...extractYs(dB));
  assert.notEqual(laneYA, laneYB, `Expected distinct bottom-inner Y lanes (${laneYA} vs ${laneYB})`);

  // All pills must remain inside SVG viewBox bounds without overlap
  const pills = $('.sol-edge-label-wrap rect').map((_, r) => ({
    x: Number($(r).attr('x')),
    y: Number($(r).attr('y')),
    w: Number($(r).attr('width')),
    h: Number($(r).attr('height')),
  })).get();
  for (const p of pills) {
    assert.ok(p.x >= 0 && p.x + p.w <= vb[2], `Pill out of horizontal bounds: ${JSON.stringify(p)} vs ${vb[2]}`);
  }
});

test('M03 & F15 schema contract: diagram and chart renderers reject unknown keys like column badge or relation cardinality', () => {
  assert.throws(() => renderSchemaDiagram({
    title: 'Invalid Badge Property',
    entities: [{
      id: 't1', name: 'tbl', kind: 'table', col: 0, row: 0,
      columns: [{ name: 'id', type: 'INT', badge: 'PK' }],
    }],
  }), /Invalid schema diagram spec/);

  assert.throws(() => renderSchemaDiagram({
    title: 'Invalid Cardinality Property',
    entities: [
      { id: 't1', name: 'a', kind: 'table', col: 0, row: 0, columns: [{ name: 'id', type: 'INT', key: 'PK' }] },
      { id: 't2', name: 'b', kind: 'table', col: 1, row: 0, columns: [{ name: 'id', type: 'INT', key: 'PK' }] },
    ],
    relations: [{ from: 't1', to: 't2', cardinality: '1..N', kind: 'lineage' }],
  }), /Invalid schema diagram spec/);

  assert.throws(() => renderSolutionDiagram({
    title: 'Negative coordinates',
    nodes: [{ id: 'a', col: -1, row: 0, title: 'Bad' }],
  }), /Invalid solution diagram spec/);

  assert.throws(() => validateChartSpec({
    type: 'bar', title: 'Bad chart', unit: 'u', source: 's', unknownExtra: true,
    data: [{ label: 'X', value: 1 }],
  }), /Invalid chart spec/);
});




