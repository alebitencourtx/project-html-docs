# Plano de Leitura Cirúrgica (Dossiê Estático)

- **Repositório:** `/app/applet/project-html-docs`
- **Revisão Git:** `12ea3444daf308d63a29a52e970352074f2331a7`
- **Escala:** `medium` · **29** arquivos core (44 totais, 8,285 linhas de código/schema)
- **Estratégia recomendada:** Leitura seletiva em Ondas 1 -> 2 -> 3; usar intervalos [Lstart-Lend] dos símbolos para arquivos > 200 linhas e consultar testsIndex em vez de ler testes integrais.
- **Stacks detectados:** `api_service` (8), `azure_blob_adls` (5), `cosmos_db` (5), `data_quality` (1), `databricks` (11), `dbt` (7), `delta_lake` (5), `event_hubs` (7), `iceberg` (2), `orchestration` (7), `scala` (3), `spark_pyspark` (12), `sql_warehouse` (9), `terraform_iac` (4)

## 1. Pontos de Entrada, Orquestração & APIs

### Workflows / CI
- `.github/workflows/ci.yml` — **CI** (triggers: `pull_request, push`)

### Rotas API Detectadas
| Método | Rota | Handler | Arquivo |
|---|---|---|---|
| `GET` | `/telemetry/{tenant_id}` | `—` | `tests/dossier.test.mjs:L103` |

### Variáveis de Ambiente, Widgets & Parâmetros CLI
| Tipo | Parâmetro | Default | Arquivo |
|---|---|---|---|
| `cli_arg` | `repository` | — | `scripts/inspect_repo.py:L61` |
| `cli_arg` | `--out` | — | `scripts/inspect_repo.py:L62` |
| `cli_arg` | `--plan` | — | `scripts/inspect_repo.py:L63` |
| `cli_arg` | `--include` | `` | `scripts/inspect_repo.py:L64` |
| `cli_arg` | `--exclude` | `` | `scripts/inspect_repo.py:L65` |

## 2. Mapa de E/S de Dados (PySpark, Databricks, Cosmos, Event Hubs, Blob, SQL)

| Arquivo | Operação | Alvo / Formato / Opção | Linha |
|---|---|---|---|
| `scripts/inspector/extractors.py` | `spark_format` | `delta` | `L24` |

## 4. Ondas de Leitura Priorizadas (Core → Contratos → Testes sob demanda)

### Onda 1 — Entrypoints, Orquestração & Configs (ler primeiro)
- **`scripts/inspector/extractors.py`** (900 linhas · centralidade `13` · [api_service, azure_blob_adls, cosmos_db, data_quality, databricks, dbt, delta_lake, event_hubs, iceberg, orchestration, scala, spark_pyspark, sql_warehouse, terraform_iac])
  - Constantes: `STACK_PATTERNS={'spark_pyspark': "('pyspark', 'sparksession', 'spark.read', 'spark.write', 'spark.table', 'spark.s", 'databricks': "('databricks', 'dbutils', 'unity_catalog', 'databricks.yml', '# databricks noteb", 'delta_lake': '(\'deltatable\', \'using delta\', \'.format("delta")\', ".format(\'delta\')", \'merge int', 'cosmos_db': "('azure.cosmos', 'cosmosclient', 'cosmos_db', 'cosmos.oltp', 'com.azure.cosmos.s", 'event_hubs': '(\'azure.eventhub\', \'eventhubconsumerclient\', \'eventhubproducerclient\', \'format("', 'azure_blob_adls': "('azure.storage.blob', 'blobserviceclient', 'azure.storage.filedatalake', 'datal", 'dbt': "('dbt_project.yml', 'profiles.yml', 'dbt_packages', 'ref(', 'source(')", 'sql_warehouse': "('duckdb', 'pyarrow', 'parquet', 'snowflake', 'bigquery', 'synapse', 'create tab", 'iceberg': "('iceberg', 'using iceberg')", 'orchestration': "('airflow', 'dag(', '@dag', 'dagster', '@asset', '@job', 'prefect', '@flow', '@t"}`
  - Símbolos-chave: `detect_stack_signals` (`L62-L86`); `_unparse` (`L89-L95`); `_const_value` (`L98-L103`); `_call_chain` (`L106-L116`); `_spark_chain_details` (`L119-L167`); `_strip_databricks_cells` (`L170-L221`); `_extract_regex_python_symbols` (`L224-L237`); `_collect_python_type_hints` (`L240-L260`); `_classify_container_client_call` (`L263-L285`); `extract_python_facts` (`L288-L661`)
- **`.github/workflows/ci.yml`** (36 linhas · centralidade `5` · [orchestration])
- **`README.md`** (325 linhas · centralidade `5` · [api_service, databricks, spark_pyspark, sql_warehouse])
- **`package.json`** (10 linhas · centralidade `5`)
- **`scripts/inspect_repo.py`** (87 linhas · centralidade `4`)
- **`agents/openai.yaml`** (5 linhas · centralidade `0`)
- **`docs/document-summary.json`** (101 linhas · centralidade `0`)
- **`docs/document.json`** (145 linhas · centralidade `0` · [orchestration, spark_pyspark])
- **`examples/minimal/document.json`** (2 linhas · centralidade `0`)
- **`examples/showcase/document.json`** (29 linhas · centralidade `0`)
- **`package-lock.json`** (622 linhas · centralidade `0`)
- **`schemas/diagram.schema.json`** (217 linhas · centralidade `0`)
- **`schemas/document.schema.json`** (81 linhas · centralidade `0`)

### Onda 2 — Core Pipeline, Streaming & Regras de Negócio
- **`scripts/build.mjs`** (468 linhas · centralidade `17` · [dbt])
  - Símbolos-chave: `barChart` (`L29-L29`); `ensureWritableTarget` (`L91-L91`); `writeAtomicFile` (`L107-L107`); `build` (`L118-L118`); `parseBuildCliArgs` (`L412-L412`)
- **`scripts/lib/urls.mjs`** (29 linhas · centralidade `8` · [dbt])
- **`scripts/renderer-hash.mjs`** (41 linhas · centralidade `7`)
- **`scripts/validate.mjs`** (83 linhas · centralidade `7` · [dbt])
- **`scripts/inspector/redaction.py`** (90 linhas · centralidade `6`)
- **`scripts/inspector/sql_parser.py`** (249 linhas · centralidade `6` · [delta_lake, iceberg, sql_warehouse])
  - Constantes: `CONSTRAINT_PREFIX_RE=re.compile('^(PRIMARY|FOREIGN|UNIQUE|CONSTRAINT|CHECK|INDEX|KEY|FULLTEXT|SPATIAL|LIKE)\\b', re.IGNOR`
  - Símbolos-chave: `_extract_balanced_parens` (`L13-L42`); `_split_top_level_sql_items` (`L45-L101`); `_parse_ddl_column` (`L104-L149`); `extract_sql_facts` (`L152-L248`)
- **`scripts/lib/hash.mjs`** (37 linhas · centralidade `6` · [sql_warehouse])
- **`scripts/verify.mjs`** (551 linhas · centralidade `6`)
  - Símbolos-chave: `git` (`L8-L8`); `readJson` (`L16-L16`); `hashByAlgorithm` (`L20-L20`); `checkFileHash` (`L24-L24`); `resolveCandidateHtmlPath` (`L34-L34`); `verify` (`L45-L45`); `analyzeImpact` (`L206-L206`); `renderUpdatePlan` (`L338-L338`); `parseVerifyCliArgs` (`L463-L463`)
- **`scripts/inspector/graph.py`** (736 linhas · centralidade `5` · [databricks, event_hubs, orchestration, spark_pyspark, sql_warehouse, terraform_iac])
  - Constantes: `SKIP={'node_modules', '.pytest_cache', '.git', '.ruff_cache', '__pycache__', '.next',`, `EXTENSIONS={'.sql', '.kt', '.rs', '.js', '.md', '.mjs', '.cs', '.sh', '.jsx', '.ts', '.py',`, `SPECIAL_NAMES={'Procfile', 'Dockerfile', 'Jenkinsfile', 'Makefile'}`, `KIND={'.md': 'docs', '.mdx': 'docs', '.rst': 'docs', '.txt': 'docs', '.html': 'docs', '.py': 'code', '.sh': 'code', '.ps1': 'code', '.js': 'code', '.mjs': 'code'}`, `NOISE_DATA_EXTS={'.parquet', '.csv'}`, `GENERATED_ARTIFACT_PATTERNS=('*.validation.json', 'reading-plan.md', 'update-plan.md', 'documentacao*.html')`
  - Símbolos-chave: `_resolve_python_import` (`L63-L84`); `_resolve_js_import` (`L87-L96`); `_resolve_notebook_target` (`L99-L116`); `inspect` (`L119-L574`); `render_reading_plan` (`L577-L735`)
- **`docs/landing-i18n.mjs`** (281 linhas · centralidade `4` · [api_service, databricks, spark_pyspark])
  - Símbolos-chave: `resolveLang` (`L270-L270`); `getCopy` (`L278-L278`)
- **`scripts/diagrams.mjs`** (1440 linhas · centralidade `4`)
  - Símbolos-chave: `validateChartSpec` (`L14-L14`); `charWidth` (`L56-L56`); `measureText` (`L67-L67`); `parseRichTokens` (`L76-L76`); `splitLongCode` (`L91-L91`); `wrapRichLines` (`L127-L127`); `renderWrappedLinesSvg` (`L175-L175`); `roundedOrthogonalPath` (`L207-L207`); `renderLegendHtml` (`L236-L236`); `renderInlineCodeHtml` (`L252-L252`)
- **`scripts/inspector/__init__.py`** (33 linhas · centralidade `4`)
- **`scripts/lib/html-shell.mjs`** (92 linhas · centralidade `3` · [dbt])
- **`scripts/lib/i18n.mjs`** (46 linhas · centralidade `2`)
- **`docs/landing.js`** (246 linhas · centralidade `1`)
  - Símbolos-chave: `getInitialLang` (`L5-L5`); `updateVideoToggleLabel` (`L40-L40`); `applyLanguage` (`L46-L46`); `syncActiveChapter` (`L101-L101`); `selectRecipe` (`L114-L114`)
- **`assets/document.js`** (612 linhas · centralidade `0`)

### Onda 4 — UI / Referência & Índice de Testes (ler corpo só em dúvida)
- **`tests/dossier.test.mjs`** (671 linhas · centralidade `1` · [api_service, azure_blob_adls, cosmos_db, databricks, delta_lake, event_hubs, orchestration, scala, spark_pyspark, sql_warehouse, terraform_iac])
  - Cobertura verificada: `verify.mjs --impact propagates drift through dependency graph and marks only stale sections`, `verify.mjs detects skill renderer updates independently of source drift and recommends rebuild-only`
- **`CHANGELOG.md`** (254 linhas · centralidade `0` · [api_service, azure_blob_adls, cosmos_db, databricks, event_hubs, orchestration, spark_pyspark, sql_warehouse, terraform_iac])
- **`SKILL.md`** (53 linhas · centralidade `0` · [api_service, azure_blob_adls, cosmos_db, databricks, event_hubs, spark_pyspark, sql_warehouse])
- **`docs/content-summary.md`** (206 linhas · centralidade `0`)
- **`docs/content.md`** (712 linhas · centralidade `0` · [databricks, orchestration, spark_pyspark])
- **`docs/index.html`** (355 linhas · centralidade `0` · [api_service, databricks, spark_pyspark])
- **`examples/minimal/content.md`** (39 linhas · centralidade `0`)
- **`examples/showcase/content.md`** (429 linhas · centralidade `0`)
- **`references/authoring.md`** (160 linhas · centralidade `0`)
- **`references/data-engineering.md`** (91 linhas · centralidade `0` · [api_service, azure_blob_adls, cosmos_db, databricks, delta_lake, event_hubs, scala, spark_pyspark, sql_warehouse])
- **`references/tools.md`** (12 linhas · centralidade `0` · [databricks])
- **`tests/browser.test.mjs`** (325 linhas · centralidade `0`)
  - Cobertura verificada: `M05 headless Chromium: landing page WAI-ARIA tabs keyboard navigation and PT/EN aria-label translation`
- **`tests/build.test.mjs`** (566 linhas · centralidade `0` · [dbt])
  - Cobertura verificada: `runnable example: offline diagrams, accessible values and nested details survive rendering`, `multiple SVGs namespace marker identifiers; unsafe Markdown HTML cannot execute`, `content/manifest mismatch fails without creating an output`, `chart rejects misleading values and duplicate categories; zero remains zero`, `chart keeps a 45-character label inside the SVG and marks zero`, `chart features: semantic variants, accessible row titles, value proximity, dignified zero, and grid scale`, `validator rejects runtime/asset dependencies and broken navigation`, `validator rejects incomplete structures and inline external styles` (+13)
- **`tests/diagrams.test.mjs`** (553 linhas · centralidade `0` · [dbt, delta_lake, event_hubs, spark_pyspark])
  - Cobertura verificada: `parseRichTokens and wrapRichLines isolate inline code chips and hard-wrap long separatorless tokens`, `renderSchemaDiagram renders typed entities, wrapped grain, spread ports, natural key order and lineage vs FK`, `enhanceMermaidSvg upgrades ER column order, PK/FK classes, composite branch badges and state colors`, `build enforces reserved IDs, localized eyebrow, safe table attributes, typed callouts, and column badges`, `inspect_repo.py discovers Jinja/SQL/DDL data-engineering templates and detects stackSignals`, `showcase example builds cleanly preserving all 11 categories, audience filters, dictionary badges and new diagrams`, `renderSolutionDiagram auto-bypasses explicit right->left skip edges and wraps long bold titles in narrow boxes`, `renderSchemaDiagram routes cross-row bottom->right relations through inter-row gutter around intermediate entities` (+1)
- **`tests/landing.test.mjs`** (149 linhas · centralidade `0`)
  - Cobertura verificada: `PT and EN translation dictionaries share identical non-empty keys`, `resolveLang and getCopy normalize language tags safely`, `docs/index.html references valid i18n keys, ARIA labels/tabs, local assets, and chapter buttons`, `F13 landing RECIPES.manifest strictly validates against document.schema.json and builds successfully`

## 5. Resumo Inline de Configurações Pequenas (sem necessidade de reabertura trivial)

- `docs/document-summary.json`: `{"title": "project-html-docs · Guia Rápido", "subtitle": "Visão panorâmica da skill que transforma o estado implementado de um repositório em um manual HTML único, offline e v...", "eyebrow": "project-html-docs · guia rápido", "version": "1`
- `examples/minimal/document.json`: `{"title": "Daily sales", "subtitle": "Combines accepted orders into a daily dataset for business analysis.", "version": "Example 1.0", "updated": "2026-11-14", "language": "en", "content": "content.md", "cards": [{"label": "Delivery", "valu`
- `examples/showcase/document.json`: `{"title": "Comparador Analítico PCM · Referência Visual", "subtitle": "Exemplo ilustrativo completo demonstrando todas as 11 categorias preservadas e os diagramas 2D de solução, fluxo em e...", "eyebrow": "project-html-docs · padrão visual `
- `package.json`: `{"name": "project-html-docs", "version": "1.10.0", "scripts": {"test": "node --test tests/*.test.mjs", "build:example": "node scripts/build.mjs examples/minimal/document.json --out examples/minimal/documentacao.html --force", "build:showcas`
- `schemas/diagram.schema.json`: `{"$schema": "http://json-schema.org/draft-07/schema#", "$id": "diagram.schema.json", "definitions": {"role": {"type": "string", "enum": ["regulator", "danger", "analytical", "info", "step", "neutral", "output", "success", "..."]}, "side": {`
- `schemas/document.schema.json`: `{"$schema": "http://json-schema.org/draft-07/schema#", "type": "object", "additionalProperties": false, "required": ["title", "subtitle", "version", "updated", "content", "sections"], "properties": {"title": {"type": "string", "minLength": `

## 6. Omissões & Avisos de Parsing Estático

- **Arquivos/diretórios omitidos:** `generated_artifact`: 8, `output_artifact`: 2, `skip_dir`: 3, `unsupported_ext`: 7
