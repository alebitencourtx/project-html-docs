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
