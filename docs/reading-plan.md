# Plano de Leitura Cirúrgica (Dossiê Estático)

- **Repositório:** `C:\Users\alebi\Documents\ChatGPT\teste-opendata\project-html-docs`
- **Revisão Git:** `78dc658d3b1a895a64aa0956b306955eb240989d`
- **Escala:** `small` · **13** arquivos core (23 totais, 5,156 linhas de código/schema)
- **Estratégia recomendada:** Leitura sequencial guiada por Ondas 1 -> 2 -> 3 (projeto compacto).
- **Stacks detectados:** `api_service` (6), `azure_blob_adls` (5), `cosmos_db` (4), `data_quality` (1), `databricks` (7), `dbt` (2), `delta_lake` (4), `event_hubs` (6), `iceberg` (1), `orchestration` (2), `scala` (3), `spark_pyspark` (7), `sql_warehouse` (6), `terraform_iac` (3)

## 1. Pontos de Entrada, Orquestração & APIs

### Rotas API Detectadas
| Método | Rota | Handler | Arquivo |
|---|---|---|---|
| `GET` | `/telemetry/{tenant_id}` | `—` | `tests/dossier.test.mjs:L103` |

### Variáveis de Ambiente, Widgets & Parâmetros CLI
| Tipo | Parâmetro | Default | Arquivo |
|---|---|---|---|
| `cli_arg` | `repository` | — | `scripts/inspect_repo.py:L1548` |
| `cli_arg` | `--out` | — | `scripts/inspect_repo.py:L1549` |
| `cli_arg` | `--plan` | — | `scripts/inspect_repo.py:L1550` |
| `cli_arg` | `--include` | `` | `scripts/inspect_repo.py:L1551` |
| `cli_arg` | `--exclude` | `` | `scripts/inspect_repo.py:L1552` |

## 2. Mapa de E/S de Dados (PySpark, Databricks, Cosmos, Event Hubs, Blob, SQL)

| Arquivo | Operação | Alvo / Formato / Opção | Linha |
|---|---|---|---|
| `scripts/inspect_repo.py` | `spark_format` | `delta` | `L64` |

## 4. Ondas de Leitura Priorizadas (Core → Contratos → Testes sob demanda)

### Onda 1 — Entrypoints, Orquestração & Configs (ler primeiro)
- **`scripts/inspect_repo.py`** (1574 linhas · centralidade `7` · [api_service, azure_blob_adls, cosmos_db, data_quality, databricks, dbt, delta_lake, event_hubs, iceberg, orchestration, scala, spark_pyspark, sql_warehouse, terraform_iac])
  - Constantes: `SKIP={'node_modules', 'data', '.pytest_cache', 'build', 'target', '.git', '.ruff_cach`, `EXTENSIONS={'.graphql', '.scala', '.hql', '.html', '.ini', '.ipynb', '.md', '.ddl', '.json'`, `SPECIAL_NAMES={'Makefile', 'Dockerfile', 'Procfile', 'Jenkinsfile'}`, `KIND={'.md': 'docs', '.mdx': 'docs', '.rst': 'docs', '.txt': 'docs', '.html': 'docs', '.py': 'code', '.sh': 'code', '.ps1': 'code', '.js': 'code', '.mjs': 'code'}`, `STACK_PATTERNS={'spark_pyspark': "('pyspark', 'sparksession', 'spark.read', 'spark.write', 'spark.table', 'spark.s", 'databricks': "('databricks', 'dbutils', 'unity_catalog', 'databricks.yml', '# databricks noteb", 'delta_lake': '(\'deltatable\', \'using delta\', \'.format("delta")\', ".format(\'delta\')", \'merge int', 'cosmos_db': "('azure.cosmos', 'cosmosclient', 'cosmos_db', 'cosmos.oltp', 'com.azure.cosmos.s", 'event_hubs': '(\'azure.eventhub\', \'eventhubconsumerclient\', \'eventhubproducerclient\', \'format("', 'azure_blob_adls': "('azure.storage.blob', 'blobserviceclient', 'azure.storage.filedatalake', 'datal", 'dbt': "('dbt_project.yml', 'profiles.yml', 'dbt_packages', 'ref(', 'source(')", 'sql_warehouse': "('duckdb', 'pyarrow', 'parquet', 'snowflake', 'bigquery', 'synapse', 'create tab", 'iceberg': "('iceberg', 'using iceberg')", 'orchestration': "('airflow', 'dag(', '@dag', 'dagster', '@asset', '@job', 'prefect', '@flow', '@t"}`, `SECRET_NAME_RE=<redacted>`
  - Símbolos-chave: `is_secret_name` (`L110-L111`); `safe_preview_value` (`L114-L129`); `detect_stack_signals` (`L132-L151`); `_unparse` (`L154-L160`); `_const_value` (`L163-L168`); `_call_chain` (`L171-L181`); `_spark_chain_details` (`L184-L224`); `_strip_databricks_cells` (`L227-L281`); `_extract_regex_python_symbols` (`L284-L297`); `extract_sql_facts` (`L300-L395`)
- **`README.md`** (298 linhas · centralidade `5` · [api_service, databricks, spark_pyspark, sql_warehouse])
- **`package.json`** (10 linhas · centralidade `5`)
- **`agents/openai.yaml`** (5 linhas · centralidade `0`)
- **`examples/minimal/document.json`** (2 linhas · centralidade `0`)
- **`examples/showcase/document.json`** (29 linhas · centralidade `0`)
- **`package-lock.json`** (622 linhas · centralidade `0`)
- **`schemas/document.schema.json`** (20 linhas · centralidade `0`)

### Onda 2 — Core Pipeline, Streaming & Regras de Negócio
- **`scripts/build.mjs`** (226 linhas · centralidade `8`)
  - Símbolos-chave: `enhanceSectionHtml` (`L31-L31`); `barChart` (`L73-L73`); `build` (`L110-L110`)
- **`scripts/validate.mjs`** (77 linhas · centralidade `6`)
- **`scripts/diagrams.mjs`** (1367 linhas · centralidade `4`)
  - Símbolos-chave: `charWidth` (`L37-L37`); `measureText` (`L48-L48`); `parseRichTokens` (`L57-L57`); `splitLongCode` (`L72-L72`); `wrapRichLines` (`L108-L108`); `renderWrappedLinesSvg` (`L156-L156`); `roundedOrthogonalPath` (`L188-L188`); `renderLegendHtml` (`L217-L217`); `renderInlineCodeHtml` (`L233-L233`); `cleanDiagramTitle` (`L238-L238`)
- **`scripts/verify.mjs`** (329 linhas · centralidade `4`)
  - Símbolos-chave: `git` (`L9-L9`); `readJson` (`L17-L17`); `verify` (`L21-L21`); `analyzeImpact` (`L83-L83`); `renderUpdatePlan` (`L217-L217`); `getFlagValue` (`L291-L291`)
- **`assets/document.js`** (472 linhas · centralidade `0`)

### Onda 4 — UI / Referência & Índice de Testes (ler corpo só em dúvida)
- **`tests/dossier.test.mjs`** (330 linhas · centralidade `1` · [api_service, azure_blob_adls, cosmos_db, databricks, delta_lake, event_hubs, scala, spark_pyspark, sql_warehouse, terraform_iac])
  - Cobertura verificada: `verify.mjs --impact propagates drift through dependency graph and marks only stale sections`
- **`CHANGELOG.md`** (177 linhas · centralidade `0` · [api_service, azure_blob_adls, databricks, event_hubs, orchestration, spark_pyspark, sql_warehouse, terraform_iac])
- **`SKILL.md`** (53 linhas · centralidade `0` · [api_service, azure_blob_adls, cosmos_db, databricks, event_hubs, spark_pyspark, sql_warehouse])
- **`examples/minimal/content.md`** (39 linhas · centralidade `0`)
- **`examples/showcase/content.md`** (429 linhas · centralidade `0`)
- **`references/authoring.md`** (160 linhas · centralidade `0`)
- **`references/data-engineering.md`** (91 linhas · centralidade `0` · [api_service, azure_blob_adls, cosmos_db, databricks, delta_lake, event_hubs, scala, spark_pyspark, sql_warehouse])
- **`references/tools.md`** (12 linhas · centralidade `0` · [databricks])
- **`tests/build.test.mjs`** (311 linhas · centralidade `0`)
  - Cobertura verificada: `runnable example: offline diagrams, accessible values and nested details survive rendering`, `multiple SVGs namespace marker identifiers; unsafe Markdown HTML cannot execute`, `content/manifest mismatch fails without creating an output`, `chart rejects misleading values and duplicate categories; zero remains zero`, `chart keeps a 45-character label inside the SVG and marks zero`, `chart features: semantic variants, accessible row titles, value proximity, dignified zero, and grid scale`, `validator rejects runtime/asset dependencies and broken navigation`, `validator rejects incomplete structures and inline external styles` (+8)
- **`tests/diagrams.test.mjs`** (470 linhas · centralidade `0` · [dbt, delta_lake, event_hubs, spark_pyspark])
  - Cobertura verificada: `parseRichTokens and wrapRichLines isolate inline code chips and hard-wrap long separatorless tokens`, `renderSchemaDiagram renders typed entities, wrapped grain, spread ports, natural key order and lineage vs FK`, `enhanceMermaidSvg upgrades ER column order, PK/FK classes, composite branch badges and state colors`, `build enforces reserved IDs, localized eyebrow, safe table attributes, typed callouts, and column badges`, `inspect_repo.py discovers Jinja/SQL/DDL data-engineering templates and detects stackSignals`, `showcase example builds cleanly preserving all 11 categories, audience filters, dictionary badges and new diagrams`, `renderSolutionDiagram auto-bypasses explicit right->left skip edges and wraps long bold titles in narrow boxes`, `renderSchemaDiagram routes cross-row bottom->right relations through inter-row gutter around intermediate entities`

## 5. Resumo Inline de Configurações Pequenas (sem necessidade de reabertura trivial)

- `examples/minimal/document.json`: `{"title": "Daily sales", "subtitle": "Combines accepted orders into a daily dataset for business analysis.", "version": "Example 1.0", "updated": "2026-11-14", "language": "en", "content": "content.md", "cards": [{"label": "Delivery", "valu`
- `examples/showcase/document.json`: `{"title": "Comparador Analítico PCM · Referência Visual", "subtitle": "Exemplo ilustrativo completo demonstrando todas as 11 categorias preservadas e os diagramas 2D de solução, fluxo em e...", "eyebrow": "project-html-docs · padrão visual `
- `package.json`: `{"name": "project-html-docs", "version": "1.7.0", "scripts": {"test": "node --test tests/*.test.mjs", "build:example": "node scripts/build.mjs examples/minimal/document.json --out examples/minimal/documentacao.html --force", "build:showcase`
- `schemas/document.schema.json`: `{"$schema": "http://json-schema.org/draft-07/schema#", "type": "object", "additionalProperties": false, "required": ["title", "subtitle", "version", "updated", "content", "sections"], "properties": {"title": {"type": "string", "minLength": `
