# Authoring contract

## Reader journey and source selection

| Category | Useful answer | Typical source |
|---|---|---|
| Executive summary | Problem, consumers, delivery, supported decisions | Product context, README, outputs |
| Functional scope | Inputs, outputs, concepts, boundaries | Interfaces and existing docs |
| Current state | Implemented capabilities, version, dated observations if available | Code/config; run artifacts for observations |
| How to use | Tasks, recipes, expected results, interpretation | UI, CLI/API, SQL, examples |
| Solution design | Components, boundaries, stores and consumers | Runtime, infrastructure, dependencies |
| Processing | Trigger, ordering, decisions, reads/writes, failure branches | Entrypoints and orchestration |
| Rules | Conditions, formula, exclusions and example | Code, SQL, config, relevant tests |
| Data model | Grain, identity, relations, types and meanings | DDL, models, Arrow, contracts |
| Operation | Prerequisites, parameters, execution, outputs, recovery | CLI, workflows, runbooks |
| Decisions | Current choices and established rationale | ADRs and maintained docs |
| Glossary/references | Terms and sources for deeper reading | Domain context, local paths |

Combine related categories or add project-specific sections (for example, separating product/dashboard usage from SQL/query consumption recipes, batch execution CLI, data continuity/quality, and grouped data dictionaries). Do not force empty categories. Explain behavior before implementation details. Prefer useful copyable recipes to embedding entire modules. Distribute `audience` tags accurately (`all`, `business`, `technical`, `operations`)—avoid defaulting almost every chapter to `all`—without splitting the same facts into contradictory business and technical documents.

## Input format

`document.json` conforms to `schemas/document.schema.json`:

- Required: `title`, `subtitle`, `version`, `updated` (YYYY-MM-DD), `content` (relative Markdown), `sections`.
- `language`: `pt-BR` (default) or `en`.
- `theme`: optional initial color palette (`default` or `santander` dark-red & black palette); the generated HTML toolbar also includes an interactive theme switcher (`Default`/`Atual` vs `Santander`) without changing layout or typography.
- Each section: `id`, `title`, `audience` (`all`, `business`, `technical`, `operations`), optional `sources` IDs. Avoid reserved HTML shell IDs (`main`, `search`, `expand`, `collapse`, `print`, `no-results`, `document-references`, `diagram-dialog`). The HTML shell exposes an interactive reading-profile filter for these `audience` tags without removing any section from the document.
- `repoRoot`: relative repository path; `revision`: revision actually read from Git.
- `sources`: local `id`, `path` relative to repoRoot, `description`. The builder checks existence and records hashes separately. Files are not executed.
- `dataAsOf`: optional observation date/time and timezone, distinct from document update and code revision.
- `cards`: up to four objects with `label`, `value`, `description`. Prefer stable properties; measured numbers need dates. For data-engineering projects, use the 4 Hero cards to answer business essentials: **Origens**, **Cadência / Janela**, **Entrega / Grão** and **Escopo / Limites**.

Start Markdown with `## First section title`. Every H2 maps to a manifest section; H3/H4 are subsections. H1 is generated. Links use manifest IDs, e.g. `[Rules](#rules)`. Scripts, event handlers, iframes, inline CSS and remote assets are not authoring components. HTML is sanitized.

Cards use ordinary HTML (effective both for 3-column executive framing, triage checklists and query rules of thumb):

```html
<div class="cards">
<div class="card"><h3>Question</h3><p>What the reader needs to know.</p></div>
</div>
```

For progressive detail and large reference dictionaries, group related field/flag/parameter tables into native nested accordions (`<details>` then `<summary>Detailed schema</summary>`, a blank line, Markdown table, a blank line and `</details>`). Pair dense business rules with compact worked interpretation matrices (`Condition | Result | Interpretation`) in addition to prose walkthroughs. Blockquotes become styled callouts; prefixing with `Regra de negócio:` / `Business rule:`, `Exemplo prático:` / `Worked example:`, `Atenção:` / `Warning:`, or `Limitação:` / `Limitation:` applies distinct semantic colors automatically. Paragraphs, lists and callouts span the full readable width of each section card (`max-width: none`) to align cleanly with tables, diagrams and charts.

Mathematical expressions and formulas must use readable Unicode symbols and HTML (`×`, `÷`, `Δ`, `≤`, `≥`, `≈`, `<sub>`, `<sup>`, `<code>`) rather than raw LaTeX (`$...$` or `$$...$$`): the generated single-file HTML is 100% offline with no MathJax/KaTeX runtime, and `validate.mjs` rejects unrendered LaTeX delimiters in prose and tables. Tables gain horizontal scroll, automatic local row filtering when `>= 8` rows (including inside nested `<details>` blocks), and semantic column badges for `` `PK` ``, `` `FK` ``, `` `UK` ``, `` `PARTIÇÃO` ``, `` `PII` `` and `` `NOT NULL` ``. Code fences gain copy controls with manual-selection fallback. References are anchors within the single HTML.

## Diagrams

The builder supports **two complementary SVG paths**, both rendered at build time as offline inline SVG inside `<figure class="diagram">`:

1. **Deterministic 2D Grid Diagrams (`solution`, `flow`, `schema`) — Recommended for Solution Design, Workflows and Table Entities**:
   - **` ```solution `** (and **` ```flow `**): JSON specification rendered by `scripts/diagrams.mjs` on a strict 2D column × row grid with aligned vertical stages (`zones`), left `inputs` column, rich multi-line cards (`step`, `title`, `lines` with inline `` `code` `` chips, `meta`), cylinder shapes (`shape: "cylinder"`), compact decision cards (`shape: "decision"`), marginal `callouts`, bottom/top gutter channels (`channel: "bottom" | "bottom-inner" | "top"`), semantic edge branches (`branch: "yes" | "no"`), built-in `.figure-legend`, and operational `note`.
   - **` ```schema `** (or **` ```erd `**): JSON specification for data models and table entities with typed headers (`kind: "table" | "mart" | "json" | "external"`), explicit `grain`, columns in natural `[PK/FK/UK] name — type` reading order with zebra rows, Crow's Foot cardinalities (`1`, `0..1`, `1..N`, `0..N`), and dashed `kind: "lineage"` derivations.
   - **Follow-up Table**: Pair rich `solution` diagrams with an `Objeto | Papel | Lido / gravado` summary table immediately below the figure when documenting multi-stage data pipelines.

2. **Mermaid (` ```mermaid <Title> `)**:
   - Supported by the pinned Beautiful Mermaid renderer: compact `flowchart`, `stateDiagram-v2`, `sequenceDiagram`, `classDiagram`, `erDiagram` and XY charts.
   - At build time, `enhanceMermaidSvg` rounds ER entity cards, reorders ER columns to `[PK/FK] name — type`, differentiates `PK`/`FK`/`UK` badges, adds semantic `.edge-label-yes`/`.edge-label-no` colors, and colors state nodes (`Aberto`, `Recuperando`, `Resolvido`).

````markdown
```solution
{
  "title": "Componentes da solução em estágios 2D",
  "inputs": { "label": "ENTRADAS" },
  "zones": [
    { "id": "z2", "title": "ESTÁGIO 2 · COMPARAÇÃO", "subtitle": "rápido, roda em toda execução", "variant": "warm", "row": 0, "colStart": 1, "colSpan": 2 },
    { "id": "z1", "title": "ESTÁGIO 1 · SINTÉTICA", "subtitle": "pesado, só dias sem agregado válido", "variant": "cool", "row": 1, "colStart": 1, "colSpan": 2 }
  ],
  "nodes": [
    { "id": "csv", "col": 0, "row": 0, "role": "regulator", "title": "CSV do painel", "lines": ["pasta `entrada/`", "1 arquivo, 1 mês"] },
    { "id": "unify", "col": 0, "row": 1, "shape": "cylinder", "role": "analytical", "title": "Base integrada", "lines": ["`lake.report_raw`", "~200 mi/dia"] },
    { "id": "s1", "col": 1, "row": 0, "step": 1, "role": "step", "title": "Ler e validar", "lines": ["valida chaves e corte"] },
    { "id": "s2", "col": 1, "row": 1, "step": 2, "role": "step", "title": "Planejar", "lines": ["separa dias reaproveitáveis × a calcular"] },
    { "id": "out", "col": 2, "row": 0, "shape": "cylinder", "role": "regulator", "title": "Resultado", "lines": ["`tabela_resultado`", "histórico + BI"] },
    { "id": "agg", "col": 2, "row": 1, "role": "analytical", "title": "agregado_diario", "lines": ["~250 linhas/dia"] }
  ],
  "edges": [
    { "from": "csv", "to": "s1" },
    { "from": "s1", "to": "s2", "label": "dias e corte" },
    { "from": "s1", "to": "out", "label": "escopo" },
    { "from": "unify", "to": "s2", "label": "histórico" },
    { "from": "s2", "to": "agg", "label": "lotes" },
    { "from": "agg", "to": "out", "label": "dias válidos" }
  ],
  "legend": [
    { "type": "box", "role": "regulator", "label": "Dados de entrada e resultado" },
    { "type": "box", "role": "analytical", "label": "Base integrada e agregados" },
    { "type": "box", "role": "step", "label": "Etapas executáveis" }
  ],
  "note": "Inclua aqui métricas reais de execução, janelas e política de reuso."
}
```
````

### Diretrizes de Desenho de Solução, Fluxo e Entidade de Tabelas

1. **Controle de Enquadramento e Orientação de Diagramas**:
   - Evite correntes horizontais lineares excessivamente longas que ultrapassem 1.200px de largura e forcem rolagem horizontal penosa em telas desktop convencionais.
   - Diagramas compactos e focados (com até 4-5 nós) podem utilizar `flowchart LR` ou `flow` linear; arquiteturas com múltiplos regimes devem usar **`solution` em grade 2D** (Entradas à esquerda + estágios empilhados + corredores de retorno no rodapé).
2. **Desenho de Solução em Grade 2D (`solution`)**:
   - **Zonas empilhadas**: Estágios rápidos/superiores (`variant: "warm"`) e estágios pesados/analíticos (`variant: "cool"`) alinhados por coluna para que setas inter-estágios cruzem verticalmente sem zigue-zague.
   - **Cartões ricos com `code` chips**: Combine título com passo circular (`step: 1..5`), explicação objetiva em `lines`, nomes de pastas/tabelas entre crases `` `...` `` e metadado opcional (`meta`).
   - **Papéis de cor por natureza do dado**: `regulator` (vermelho), `analytical` (azul), `step` (grafite), `output` (teal), `warning` (âmbar).
   - **Canais de retorno e notas marginais**: Use `channel: "bottom"` / `"bottom-inner"` para leituras em lote ou feedback de controle em linha tracejada (`style: "dashed"`), e `callouts` nas zonas para anotações operacionais.
3. **Desenho de Fluxo (`flow` ou `mermaid`)**:
   - Evite losangos gigantes: use `shape: "decision"` em `flow` (cartão compacto com badge `?`) e `branch: "yes"` / `branch: "no"` para colorir imediatamente caminhos positivos e de exceção/fallback.
4. **Entidade de Tabelas (`schema` ou `mermaid erDiagram`)**:
   - Identifique explicitamente o tipo de objeto (`table`, `mart`, `json`) e o **grão** (`1 linha = ...`).
   - Apresente colunas na ordem natural `[PK/FK/UK] nome_coluna — tipo` e use `kind: "lineage"` (tracejado) para agregações/derivações — nunca invente FK para agregação.

Architecture names components and boundaries; flow names actions and decisions; ER names entities, keys and established cardinalities; lineage describes transformations. Never invent foreign keys for aggregation or view derivation. Identify logical vs physical models. An overview can show essential attributes; full dictionaries belong below.

Keep short labels, meaningful groups, moderate widths/heights and explanatory captions. Break dense views into overview/detail. Enlarging a diagram is optional convenience, not a substitute for a readable main view. Inspect connector routes, text overlap and label clipping.

## Charts

The reusable chart component supports horizontal bars: finite nonnegative values, unique labels up to 45 characters, 1–40 categories. Retain relevant categories or state the selection. A table of values is always embedded. Negative values/time series need another documented build-time renderer, not reinterpretation as positive bars.

````markdown
```chart
{"type":"bar","title":"Configured retention","unit":"days","source":"config/retention.json","data":[{"label":"Raw","value":7,"variant":"warning"},{"label":"Curated","value":30,"variant":"success"},{"label":"Archive","value":0,"variant":"neutral"}]}
```
````

### Padrões do Componente `barChart`

- **Proximidade Gestáltica dos Valores**: O valor numérico não fica isolado no final de uma área vazia. Barras longas (`barWidth >= 64px`) acomodam o número internamente (alinhado à direita em texto branco); barras curtas posicionam o número logo após o término da barra, ou utilizam linha guia pontilhada discreta de alinhamento.
- **Régua de Escala e Grade (*Gridlines*)**: Renderização automática de marcações verticais discretas em 25%, 50%, 75% e 100% da escala máxima, acompanhadas dos valores correspondentes para orientar a leitura quantitativa instantânea.
- **Representação Semântica e Explícita do Zero**: Valores nulos (`d.value === 0`) são identificados explicitamente por badge ou texto suave `"0 (zero)"` no início da barra, abolindo traços ambíguos.
- **Variantes Semânticas de Cor (`variant`)**: Cada item de `spec.data[]` pode declarar a propriedade opcional `variant` para comunicação de status e criticidade:
  - `"accent"` (padrão): azul-petróleo/ciano (`#087f8c`)
  - `"warning"`: âmbar/alerta (`#d97706`)
  - `"danger"`: carmesim/crítico (`#dc2626`)
  - `"success"`: verde/sucesso (`#16a34a`)
  - `"neutral"`: ardósia/neutro (`#64748b`)
- **Acessibilidade e Tooltips Nativos**: Cada linha é estruturada em um grupo `<g class="chart-row">` contendo `<title>` SVG nativo com rótulo, valor formatado e unidade, exibindo tooltip imediato sem dependência de JavaScript e permitindo realce em `:hover` e foco por teclado.
- **Tabelas de Acessibilidade Embutidas**: A tabela de dados do `<details>` ocupa 100% da largura do card sem forçamento de largura mínima excessiva.

Add `asOf` for measured observations. State percentage denominators and duration units. Configured cadence and retention are facts about implementation, not runtime performance.

## Validation and updates

The receipt verifies IDs, anchors, resource closure, accessible diagram names and source fingerprints. It does not certify cardinalities, business meaning, freshness or deployment status. Verify those while authoring; keep the checks out of the executive narrative.

`contentSections` counts content sections only; `referenceBlocks` counts the generated reference block. `skillVersion`, `builtAt` and `manifestSha256` identify the builder and inputs. `browserReviewed` stays `false` unless a separate review record is attached.

After building or updating a document, run `node <skill>/scripts/verify.mjs <work>/document.json <work>/documentacao.validation.json`. It recomputes source hashes and the Git revision and reports changed, missing or unexpected sources. Use `--strict` to fail when the document no longer matches its sources.

When updating an existing documented repository, avoid re-reading untouched code:
1. Run `python <skill>/scripts/inspect_repo.py <repo> --out <work>/inventory.json --plan <work>/reading-plan.md`.
2. Run `node <skill>/scripts/verify.mjs <work>/document.json <work>/documentacao.validation.json --impact --dossier <work>/inventory.json --plan <work>/update-plan.md`.
3. Because `sections[].sources` links each H2 section to its backing source IDs and `inventory.json` carries the internal dependency graph, `update-plan.md` identifies directly changed sources, transitively impacted modules, untracked new core files and only the `stale` sections that require review.

Inspect on **desktop** (~1440 px; do not worry about or optimize for mobile/narrow viewports): global overflow, labels, local table/diagram scroll, accent-insensitive search, no-result search, links into collapsed sections, expand/collapse, copy/fallback, modal close/Escape and print with all sections. Check reading with network unavailable. Report actual verification rather than inferring browser success from structural validation.

On update compare source changes and revisit dependent sections. A changed hash alone is not proof of changed meaning. Render to the requested version and preserve the previous document unless replacement was requested.
