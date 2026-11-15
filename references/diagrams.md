# Diagrams, charts, and reading design system

This reference complements [authoring](authoring.md) with concrete syntax for deterministic 2D diagrams, Mermaid fences, bar charts, and the offline shell ergonomics.

## 1. Deterministic 2D Diagrams (Recommended)

Render at build time via `scripts/diagrams.mjs` (validated against `schemas/diagram.schema.json`) as offline inline SVG inside `<figure class="diagram">`.

- **`solution` fences**: Strict 2D column × row architectures with a left `inputs` column, stacked `zones` (`warm`, `cool`, `teal`), rich multi-line cards with ①..⑤ step badges, inline `` `code` `` chips, metadata pills (`meta`), cylinders (`shape: "cylinder"`), marginal `callouts`, bottom/top gutter channels (`channel: "bottom" | "bottom-inner" | "top"`), `.figure-legend`, and operational `note`.
- **`flow` fences**: Staged workflows using compact decision cards (`shape: "decision"` — never oversized diamonds), colored `yes`/`no` branch pills (`branch: "yes" | "no"`), and clean retry/fallback channels.
- **`schema` / `erd` fences**: Typed entity cards (`kind: "table" | "mart" | "json" | "external"`) with explicit `grain` (`"Grão: 1 linha = ..."`), columns in natural `[PK/FK/UK] column_name — type` reading order, zebra rows, Crow's Foot cardinalities (`1`, `0..1`, `1..N`, `0..N`), and dashed `kind: "lineage"` derivations.

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

### Layout & Modeling Guidelines

- **Avoid long flat horizontal chains**: Never draw continuous `flowchart LR` pipelines with `> 3` nodes; stack stages in 2D (`solution`).
- **Role colors**: `regulator` (red), `analytical` (blue), `step` (graphite), `output` (teal), `warning` (amber).
- **Split dense models**: Divide complex data models into two focused `schema` diagrams (e.g., raw/logical state vs derived tabular projections/marts) instead of overcrowding one canvas or deleting meaningful relationships. Never invent foreign keys for `GROUP BY` aggregations—use `kind: "lineage"`.
- **Follow-up table**: Pair rich `solution` diagrams with an `Objeto | Papel | Lido / gravado` summary table immediately below the figure.

## 2. Mermaid Fences (Backward Compatible)

Fence format: ` ```mermaid <Descriptive Title> `. Rendered at build time via pinned Beautiful Mermaid (`1.1.3`) and enhanced by `enhanceMermaidSvg`:
- Rounded ER cards with `[PK/FK] name — type` column order and distinct `PK`/`FK`/`UK` badges.
- Semantic `Sim`/`Não` branch badge colors and state colors (`Aberto`, `Recuperando`, `Resolvido`).
- Theme-aware CSS variables on `.diagram-scroll svg:not(.sol-svg)`.

## 3. Bar Charts (`chart`)

````markdown
```chart
{"type":"bar","title":"Configured retention","unit":"days","source":"config/retention.json","data":[{"label":"Raw","value":7,"variant":"warning"},{"label":"Curated","value":30,"variant":"success"},{"label":"Archive","value":0,"variant":"neutral"}]}
```
````

- **Rules**: Finite nonnegative values, unique labels (`<= 45` chars), `1–40` categories, explicit `unit` and `source` (`asOf` for dated observations).
- **Visual features**: Gestalt value proximity (inside bars `>= 64px`, dotted guide lines otherwise), scale gridlines (`25%`, `50%`, `75%`, `100%`), explicit `0 (zero)` badges, semantic `variant` (`accent`, `warning`, `danger`, `success`, `neutral`), native SVG `<title>` tooltips in `<g class="chart-row">`, and an embedded accessible `<table>` inside `<details>`.

## 4. Reading Ergonomics & Offline Design System

- **Responsive shell (`assets/document.css`, `assets/document.js`, `scripts/lib/html-shell.mjs`)**:
  - Desktop (`> 960 px`): fixed `268 px` left sidebar with independent scrollable nav, H3 subnavigation links under each H2, floating `#back-to-top` button, and full-width narrative text aligned with tables/diagrams.
  - Mobile (`≤ 960 px`): sticky compact top bar (`.mobile-topbar` with `#nav-toggle`, `#mobile-search-btn`), off-canvas slide-over drawer (`#sidebar`, `#nav-close`, backdrop click, `Escape`, focus trap, responsive `inert` sync across breakpoints, auto-close on link tap), stacked toolbar controls, and zero horizontal page overflow.
- **Themes & Filters**:
  - Color themes **Vermelho** (default) and **Azul** harmonize shell chrome, 2D `solution`/`schema` zones/nodes/arrows, Mermaid SVGs, and chart accents while keeping semantic status colors legible (`localStorage` persisted without overwriting on passive load).
  - **Audience Filter** (`All` / `Business view` / `Technical view` / `Operations`, synced via `aria-pressed`) preserves all sections in the DOM while adjusting visual focus.
- **Tables, Search & Formulas**:
  - Sticky table headers (`th { position: sticky }`), no vertical wheel trapping on short tables, automatic local row filter on tables with `>= 8` rows (including inside `<details>`), print restoration of filtered rows (`beforeprint`/`afterprint` + `@media print`), and styled semantic badges (`` `PK` ``, `` `FK` ``, `` `UK` ``, `` `PARTIÇÃO` ``, `` `PII` ``, `` `NOT NULL` ``).
  - Accent-insensitive search (`/`, `Ctrl+K`, clear `×`) highlighting all term occurrences.
  - Interactive diagram modal with Fit / 100% / Zoom (`−`/`+` monotonic from effective Fit scale) + hover/focus connection highlighting.
  - Write formulas with Unicode and HTML tags (`×`, `÷`, `Δ`, `≤`, `≥`, `<sub>`, `<sup>`, `<code>`) rather than raw LaTeX (`$...$` / `$$...$$`); `validate.mjs` rejects unrendered LaTeX delimiters.
