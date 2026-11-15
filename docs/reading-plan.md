# Plano de Leitura Cirúrgica (Dossiê Estático)

- **Repositório:** `/app/applet/project-html-docs`
- **Revisão Git:** `5ae1368bafc7b39d6f04ccdf88eb6dd3770b4d7e`
- **Escala:** `medium` · **18** arquivos core (32 totais, 6,438 linhas de código/schema)
- **Estratégia recomendada:** Leitura seletiva em Ondas 1 -> 2 -> 3; usar intervalos [Lstart-Lend] dos símbolos para arquivos > 200 linhas e consultar testsIndex em vez de ler testes integrais.
- **Stacks detectados:** `api_service` (8), `azure_blob_adls` (5), `cosmos_db` (4), `data_quality` (1), `databricks` (10), `dbt` (2), `delta_lake` (4), `event_hubs` (6), `iceberg` (1), `orchestration` (3), `scala` (3), `spark_pyspark` (10), `sql_warehouse` (6), `terraform_iac` (3)

## 1. Pontos de Entrada, Orquestração & APIs

### Rotas API Detectadas
| Método | Rota | Handler | Arquivo |
|---|---|---|---|
| `GET` | `/telemetry/{tenant_id}` | `—` | `tests/dossier.test.mjs:L103` |

### Variáveis de Ambiente, Widgets & Parâmetros CLI
| Tipo | Parâmetro | Default | Arquivo |
|---|---|---|---|
| `cli_arg` | `repository` | — | `scripts/inspect_repo.py:L1630` |
| `cli_arg` | `--out` | — | `scripts/inspect_repo.py:L1631` |
| `cli_arg` | `--plan` | — | `scripts/inspect_repo.py:L1632` |
| `cli_arg` | `--include` | `` | `scripts/inspect_repo.py:L1633` |
| `cli_arg` | `--exclude` | `` | `scripts/inspect_repo.py:L1634` |

## 2. Mapa de E/S de Dados (PySpark, Databricks, Cosmos, Event Hubs, Blob, SQL)

| Arquivo | Operação | Alvo / Formato / Opção | Linha |
|---|---|---|---|
| `scripts/inspect_repo.py` | `spark_format` | `delta` | `L64` |

## 4. Ondas de Leitura Priorizadas (Core → Contratos → Testes sob demanda)

### Onda 1 — Entrypoints, Orquestração & Configs (ler primeiro)
- **`scripts/inspect_repo.py`** (1656 linhas · centralidade `7` · [api_service, azure_blob_adls, cosmos_db, data_quality, databricks, dbt, delta_lake, event_hubs, iceberg, orchestration, scala, spark_pyspark, sql_warehouse, terraform_iac])
  - Constantes: `SKIP={'venv', '.git', '.tox', '.venv', '.runtime', 'dist', 'node_modules', '.ruff_cac`, `EXTENSIONS={'.hql', '.scala', '.tsx', '.md', '.java', '.json', '.py', '.avsc', '.dml', '.sq`, `SPECIAL_NAMES={'Procfile', 'Makefile', 'Jenkinsfile', 'Dockerfile'}`, `KIND={'.md': 'docs', '.mdx': 'docs', '.rst': 'docs', '.txt': 'docs', '.html': 'docs', '.py': 'code', '.sh': 'code', '.ps1': 'code', '.js': 'code', '.mjs': 'code'}`, `STACK_PATTERNS={'spark_pyspark': "('pyspark', 'sparksession', 'spark.read', 'spark.write', 'spark.table', 'spark.s", 'databricks': "('databricks', 'dbutils', 'unity_catalog', 'databricks.yml', '# databricks noteb", 'delta_lake': '(\'deltatable\', \'using delta\', \'.format("delta")\', ".format(\'delta\')", \'merge int', 'cosmos_db': "('azure.cosmos', 'cosmosclient', 'cosmos_db', 'cosmos.oltp', 'com.azure.cosmos.s", 'event_hubs': '(\'azure.eventhub\', \'eventhubconsumerclient\', \'eventhubproducerclient\', \'format("', 'azure_blob_adls': "('azure.storage.blob', 'blobserviceclient', 'azure.storage.filedatalake', 'datal", 'dbt': "('dbt_project.yml', 'profiles.yml', 'dbt_packages', 'ref(', 'source(')", 'sql_warehouse': "('duckdb', 'pyarrow', 'parquet', 'snowflake', 'bigquery', 'synapse', 'create tab", 'iceberg': "('iceberg', 'using iceberg')", 'orchestration': "('airflow', 'dag(', '@dag', 'dagster', '@asset', '@job', 'prefect', '@flow', '@t"}`, `SECRET_NAME_RE=<redacted>`
  - Símbolos-chave: `is_secret_name` (`L114-L115`); `redact_inline_secrets` (`L118-L119`); `safe_preview_value` (`L122-L138`); `detect_stack_signals` (`L141-L160`); `_unparse` (`L163-L169`); `_const_value` (`L172-L177`); `_call_chain` (`L180-L190`); `_spark_chain_details` (`L193-L233`); `_strip_databricks_cells` (`L236-L290`); `_extract_regex_python_symbols` (`L293-L306`)
- **`README.md`** (313 linhas · centralidade `5` · [api_service, databricks, spark_pyspark, sql_warehouse])
- **`package.json`** (10 linhas · centralidade `5`)
- **`agents/openai.yaml`** (5 linhas · centralidade `0`)
- **`docs/document-summary.json`** (96 linhas · centralidade `0`)
- **`docs/document.json`** (131 linhas · centralidade `0`)
- **`examples/minimal/document.json`** (2 linhas · centralidade `0`)
- **`examples/showcase/document.json`** (29 linhas · centralidade `0`)
- **`package-lock.json`** (622 linhas · centralidade `0`)
- **`schemas/document.schema.json`** (20 linhas · centralidade `0`)

### Onda 2 — Core Pipeline, Streaming & Regras de Negócio
- **`scripts/build.mjs`** (242 linhas · centralidade `9`)
  - Símbolos-chave: `enhanceSectionHtml` (`L33-L33`); `barChart` (`L75-L75`); `build` (`L112-L112`); `esc` (`L16-L16`); `hash` (`L17-L17`); `clean` (`L19-L19`); `slugify` (`L29-L29`); `normalizeTheme` (`L31-L31`)
- **`scripts/validate.mjs`** (82 linhas · centralidade `6`)
- **`scripts/verify.mjs`** (456 linhas · centralidade `5`)
  - Símbolos-chave: `git` (`L10-L10`); `readJson` (`L18-L18`); `checkOptionalFileHash` (`L22-L22`); `verify` (`L32-L32`); `analyzeImpact` (`L147-L147`); `renderUpdatePlan` (`L281-L281`); `getFlagValue` (`L402-L402`); `hash` (`L8-L8`)
- **`docs/landing-i18n.mjs`** (268 linhas · centralidade `4` · [api_service, databricks, spark_pyspark])
  - Símbolos-chave: `resolveLang` (`L257-L257`); `getCopy` (`L265-L265`)
- **`scripts/diagrams.mjs`** (1415 linhas · centralidade `4`)
  - Símbolos-chave: `charWidth` (`L37-L37`); `measureText` (`L48-L48`); `parseRichTokens` (`L57-L57`); `splitLongCode` (`L72-L72`); `wrapRichLines` (`L108-L108`); `renderWrappedLinesSvg` (`L156-L156`); `roundedOrthogonalPath` (`L188-L188`); `renderLegendHtml` (`L217-L217`); `renderInlineCodeHtml` (`L233-L233`); `cleanDiagramTitle` (`L238-L238`)
- **`scripts/renderer-hash.mjs`** (33 linhas · centralidade `4`)
- **`docs/landing.js`** (212 linhas · centralidade `1`)
  - Símbolos-chave: `getInitialLang` (`L5-L5`); `updateVideoToggleLabel` (`L37-L37`); `applyLanguage` (`L43-L43`); `syncActiveChapter` (`L91-L91`); `selectRecipe` (`L104-L104`)
- **`assets/document.js`** (570 linhas · centralidade `0`)

### Onda 4 — UI / Referência & Índice de Testes (ler corpo só em dúvida)
- **`tests/dossier.test.mjs`** (498 linhas · centralidade `1` · [api_service, azure_blob_adls, cosmos_db, databricks, delta_lake, event_hubs, orchestration, scala, spark_pyspark, sql_warehouse, terraform_iac])
  - Cobertura verificada: `verify.mjs --impact propagates drift through dependency graph and marks only stale sections`, `verify.mjs detects skill renderer updates independently of source drift and recommends rebuild-only`
- **`CHANGELOG.md`** (220 linhas · centralidade `0` · [api_service, azure_blob_adls, databricks, event_hubs, orchestration, spark_pyspark, sql_warehouse, terraform_iac])
- **`SKILL.md`** (53 linhas · centralidade `0` · [api_service, azure_blob_adls, cosmos_db, databricks, event_hubs, spark_pyspark, sql_warehouse])
- **`docs/content-summary.md`** (205 linhas · centralidade `0`)
- **`docs/content.md`** (696 linhas · centralidade `0` · [databricks, spark_pyspark])
- **`docs/index.html`** (355 linhas · centralidade `0` · [api_service, databricks, spark_pyspark])
- **`examples/minimal/content.md`** (39 linhas · centralidade `0`)
- **`examples/showcase/content.md`** (429 linhas · centralidade `0`)
- **`references/authoring.md`** (160 linhas · centralidade `0`)
- **`references/data-engineering.md`** (91 linhas · centralidade `0` · [api_service, azure_blob_adls, cosmos_db, databricks, delta_lake, event_hubs, scala, spark_pyspark, sql_warehouse])
- **`references/tools.md`** (12 linhas · centralidade `0` · [databricks])
- **`tests/build.test.mjs`** (400 linhas · centralidade `0`)
  - Cobertura verificada: `runnable example: offline diagrams, accessible values and nested details survive rendering`, `multiple SVGs namespace marker identifiers; unsafe Markdown HTML cannot execute`, `content/manifest mismatch fails without creating an output`, `chart rejects misleading values and duplicate categories; zero remains zero`, `chart keeps a 45-character label inside the SVG and marks zero`, `chart features: semantic variants, accessible row titles, value proximity, dignified zero, and grid scale`, `validator rejects runtime/asset dependencies and broken navigation`, `validator rejects incomplete structures and inline external styles` (+9)
- **`tests/diagrams.test.mjs`** (522 linhas · centralidade `0` · [dbt, delta_lake, event_hubs, spark_pyspark])
  - Cobertura verificada: `parseRichTokens and wrapRichLines isolate inline code chips and hard-wrap long separatorless tokens`, `renderSchemaDiagram renders typed entities, wrapped grain, spread ports, natural key order and lineage vs FK`, `enhanceMermaidSvg upgrades ER column order, PK/FK classes, composite branch badges and state colors`, `build enforces reserved IDs, localized eyebrow, safe table attributes, typed callouts, and column badges`, `inspect_repo.py discovers Jinja/SQL/DDL data-engineering templates and detects stackSignals`, `showcase example builds cleanly preserving all 11 categories, audience filters, dictionary badges and new diagrams`, `renderSolutionDiagram auto-bypasses explicit right->left skip edges and wraps long bold titles in narrow boxes`, `renderSchemaDiagram routes cross-row bottom->right relations through inter-row gutter around intermediate entities`
- **`tests/landing.test.mjs`** (84 linhas · centralidade `0`)
  - Cobertura verificada: `PT and EN translation dictionaries share identical non-empty keys`, `resolveLang and getCopy normalize language tags safely`, `docs/index.html references valid i18n keys, local assets, and chapter buttons`, `landing RECIPES.manifest strictly validates against document.schema.json and RECIPES.cli uses valid verify flags`

## 5. Resumo Inline de Configurações Pequenas (sem necessidade de reabertura trivial)

- `docs/document-summary.json`: `{"title": "project-html-docs · Guia Rápido", "subtitle": "Visão panorâmica da skill que transforma o estado implementado de um repositório em um manual HTML único, offline e v...", "eyebrow": "project-html-docs · guia rápido", "version": "1`
- `docs/document.json`: `{"title": "project-html-docs · Manual do Gerador", "subtitle": "Documentação funcional e técnica do skill que transforma o estado implementado de um repositório em um manual HTML ún...", "eyebrow": "project-html-docs · manual do próprio ger`
- `examples/minimal/document.json`: `{"title": "Daily sales", "subtitle": "Combines accepted orders into a daily dataset for business analysis.", "version": "Example 1.0", "updated": "2026-11-14", "language": "en", "content": "content.md", "cards": [{"label": "Delivery", "valu`
- `examples/showcase/document.json`: `{"title": "Comparador Analítico PCM · Referência Visual", "subtitle": "Exemplo ilustrativo completo demonstrando todas as 11 categorias preservadas e os diagramas 2D de solução, fluxo em e...", "eyebrow": "project-html-docs · padrão visual `
- `package.json`: `{"name": "project-html-docs", "version": "1.9.0", "scripts": {"test": "node --test tests/*.test.mjs", "build:example": "node scripts/build.mjs examples/minimal/document.json --out examples/minimal/documentacao.html --force", "build:showcase`
- `schemas/document.schema.json`: `{"$schema": "http://json-schema.org/draft-07/schema#", "type": "object", "additionalProperties": false, "required": ["title", "subtitle", "version", "updated", "content", "sections"], "properties": {"title": {"type": "string", "minLength": `
