# Data-engineering profile

Describe consumers, transformations and stored contracts so **both non-technical stakeholders and data engineers** can read the same HTML document without contradictions. Adapt to the repository: JSON state is not a relational database, and not every pipeline has bronze/silver/gold or an orchestrator.

For each important object establish business meaning, grain (exactly one row/event/object), natural/technical/composite identity, enforced vs logical uniqueness, join columns/cardinality, event/reference/ingestion times, timezone, source/transformation, format/location, write policy, partitioning, retention and consumption. Define missing/invalid values and their effect on output.

Separate execution order, lineage and association. List all composite-key components. Explain aggregation N:1 without pretending it is a foreign key. Types come from DDL/models/contracts, not guesses from sample values. Show essential attributes in `schema`/ER and the full searchable dictionary below (using `` `PK` ``, `` `FK` ``, `` `UK` ``, `` `PARTIÇÃO` ``, `` `PII` ``, `` `NOT NULL` `` badges in the dictionary table).

## Estrutura Recomendada para Público Duplo (Negócio + Engenharia)

1. **Resumo Executivo e Hero Cards (Visão de Negócio Primeiro)**:
   - Os 4 cards iniciais do manifesto devem responder diretamente em linguagem simples:
     1. **Origens** (de onde vem o dado);
     2. **Cadência e Janela** (quando atualiza e qual período cobre);
     3. **Entrega e Grão** (qual tabela/BI é consumido e o que 1 linha representa);
     4. **Reuso / Limite** (política de reprocessamento ou restrição relevante).
2. **Tagging Preciso de Audiência (`audience`)**:
   - Preserve **todas as categorias aplicáveis** da jornada do leitor e distribua `audience` com precisão entre `all`, `business`, `technical` e `operations` (evite marcar quase todas as seções como `all`) para que o filtro interativo ajude gerentes, analistas e engenheiros a focar sem perder o acesso completo às especificações.
   - Sempre que houver consumo por usuários finais e analistas além do batch, separe em capítulos distintos: **uso do produto / triagem** (`business`), **como consultar os dados** com receitas SQL/Parquet copiáveis (`technical`) e **como executar / operar** (`operations`). Use blocos `.cards` em 3 colunas para orientar leitura executiva, triagem rápida e armadilhas de consulta.
3. **Callouts Semânticos em Regras e Operação**:
   - Use citações prefixadas para destacar visualmente semântica de negócio e restrições técnicas:
     - `> Regra de negócio: ...` — definição funcional em linguagem simples;
     - `> Exemplo prático: ...` — simulação numérica passo a passo de deduplicação/corte/cálculo;
     - `> Atenção: ...` — cuidado operacional ou condição de reprocessamento;
     - `> Limitação: ...` — dado não coberto, dependência ou degradação conhecida.

## Diagramas de Arquitetura de Dados, Fluxo e Entidades

1. **Proibição Expressa de Pipelines em Linha Reta Horizontal**:
   - É **terminantemente proibido** documentar pipelines e esteiras de dados complexas como uma cadeia horizontal contínua e plana (`flowchart LR` contínuo com mais de 3 nós).
   - Fluxos horizontais extensos quebram a responsividade e ocultam estágios e feedbacks entre camadas.

2. **Padrão Recomendado para Desenho de Solução: Matriz 2D (`solution`)**:
   - Modele esteiras abrangentes em grade 2D determinística (`scripts/diagrams.mjs`):
     - `ENTRADAS` à esquerda (fontes de dados, CSVs externos, bases integradas em cilindro).
     - `ESTÁGIO SUPERIOR` (`variant: "warm"` ou `"teal"`): comparação, ingestão rápida, validação ou consumo.
     - `ESTÁGIO INFERIOR` (`variant: "cool"`): processamento pesado, sintética, camadas Bronze/Silver/Gold ou lotes.
     - Setas verticais inter-estágios alinhadas na mesma coluna e canais dedicados no rodapé (`channel: "bottom"` / `"bottom-inner"`) para leitura de partições ou feedback tracejado de controle.
   - **Receitas Recorrentes**:
     - *Lakehouse / Medallion*: `ENTRADAS` (APIs/ARQs) → Estágio Inferior (`Bronze`/`Silver` em lotes ou streaming) → Estágio Superior (`Gold` / Serving / BI) com retornos de watermark ou tabela de controle no canal inferior.
     - *Incremental / Watermark / Backfill*: separe o planejamento/leitura da tabela de controle do processamento de lotes idempotentes.
   - **Cartões Ricos**: Utilize `step: 1..5`, explicação objetiva em `lines`, nomes de tabelas/pastas em crases e volumetria/particionamento no texto ou `meta`.
   - **Tabela Complementar Imediata**: Logo abaixo da figura e da nota operacional, inclua a tabela `Objeto | Papel | Lido / gravado` mapeando os principais artefatos do diagrama.

3. **Padrão para Entidade de Tabelas e Linhagem (`schema`)**:
   - Declare explicitamente `kind` (`"table"`, `"mart"`, `"json"`, `"external"`) e `grain` (*"Grão: 1 linha = ..."*) em cada entidade.
   - Liste chaves (`PK`, `FK`, `UK`) e colunas principais na ordem natural `[Badge] nome_coluna — tipo`.
   - Use `kind: "lineage"` (linha tracejada) para projeções/agregações (`GROUP BY`) e `1..N` / `0..N` (Crow's Foot) apenas para relações reais de identidade.
   - Quando houver estado lógico/bruto e múltiplas projeções analíticas ou marts, **divida em dois diagramas `schema` focados** (ex.: estado lógico & bruto vs projeções tabulares & linhagem) e agrupe os dicionários completos de campos e enums em blocos `<details>` dedicados ao final do documento.

## Regras de Negócio, Qualidade e Métricas em Gráficos

Rules expose denominator eligibility, thresholds, cutoffs, deduplication and exceptions. Give worked examples (`> Exemplo prático:`) for nonobvious outcomes. Do not average percentages when code uses ratios of sums, sum cumulative snapshots, or infer incremental behavior without implementation. Explain late data, reuse, reprocessing and idempotency as actually implemented.

Sempre que houver regras de qualidade ou dados degradados, documente em tabela: **Condição (ex.: dado atrasado, nulo, duplicado, schema drift) | Comportamento implementado | Impacto no consumidor**.

Gráficos de retenção, janelas de expiração de dados ou SLAs operacionais devem utilizar o componente `barChart` padronizado:
- **Variantes Semânticas de Cor (`variant`)**: Utilize `"warning"` para limiares de atenção, `"danger"` para SLAs críticos ou estouro de tolerância, `"success"` para faixas ideais e `"neutral"` para estágios arquivados ou secundários.
- **Marcações de Escala e Grade**: Ticks a 25%, 50%, 75% e 100% com linhas de grade verticais facilitam a comparação imediata de volumetria e latência sem leitura exaustiva da tabela.
- **Tratamento Digno do Zero**: Volumes nulos, filas sem backlog ou retenções desabilitadas devem registrar `"0 (zero)"` explícito em vez de marcadores ambíguos.

## Operação, Backfill e Matriz de Incidentes

Operation explains trigger, configuration, parameters, prerequisite state, output, restart/recovery and success criteria. If a successful job can publish a degraded-data diagnostic, explain this distinction. Inclua uma matriz prática de recuperação quando houver falhas conhecidas ou pontos de parada:

| Sintoma | Causa provável | Parâmetro / Ação de recuperação |
|---|---|---|
| Execução interrompida no meio do mês | Falha transitória de cluster/rede durante um lote | Reexecutar sem alterar parâmetros; lotes anteriores já gravados são reaproveitados automaticamente |

## Engenharia de Dados em Nuvem, Streaming e APIs (PySpark, Databricks, Cosmos DB, Event Hubs, Blob/ADLS, APIs)

Ao analisar repositórios baseados em nuvem, pipelines ou streaming (com apoio de `--plan <work>/reading-plan.md` gerado pelo `inspect_repo.py`, incluindo cadeias PySpark, chamadas `%run`/`dbutils.notebook.run`, pipelines Azure Data Factory/Synapse, código Scala e parâmetros `os.getenv`/CLI/`dbutils.widgets`), documente explicitamente os contratos específicos de cada tecnologia conforme implementado no código:

1. **PySpark, Scala & Databricks / ADF (Notebooks, Workflows / Asset Bundles & Delta Lake)**:
   - **Execução & Orquestração**: identifique jobs em `databricks.yml`, pipelines JSON do Azure Data Factory (`DatabricksNotebook`, dependências entre atividades), encadeamentos `%run` / `dbutils.notebook.run`, células `# COMMAND ----------` / `%sql` / `%python`, parâmetros via `dbutils.widgets.get(...)` / CLI / variáveis de ambiente e referências a segredos (`dbutils.secrets.get(scope, key)` — nunca exponha valores).
   - **Leitura e Escrita**: registre se o job é batch (`spark.read`) ou Structured Streaming (`spark.readStream` / Auto Loader `cloudFiles`), qual o `trigger` (`availableNow=True`, `processingTime`, contínuo), o `checkpointLocation`, o modo de escrita (`append`, `overwrite` com `partitionOverwriteMode`, `MERGE INTO` com chaves de match) e a estratégia de particionamento (`partitionBy` / `CLUSTER BY` / `ZORDER`).
   - **Catálogo**: diferencie caminhos físicos (`abfss://...`, `dbfs:/...`) de tabelas gerenciadas/externas no Unity Catalog (`catalog.schema.table`).
2. **Azure Event Hubs & Streaming**:
   - Documente tópico/`eventhub_name`, `$Default` ou `consumer_group` dedicado, `startingOffsets`, estratégia de checkpoint para retomada sem duplicidade, tratamento de schema inválido/JSON malformado (*dead-letter* / quarentena) e janela de *watermark* para dados atrasados (`withWatermark`).
3. **Azure Blob Storage / ADLS Gen2**:
   - Documente contêineres/diretórios (`abfss://<container>@<account>.dfs.core.windows.net/...`), padrão de prefixo/partição (`ano=.../mes=.../dia=...`), política de retenção/lifecycle ou movimentação pós-processamento (*archive* vs reprocessamento).
4. **Azure Cosmos DB & APIs de Serviço (FastAPI / Flask / Express / REST)**:
   - **Cosmos DB**: identifique banco, contêiner, **chave de partição (`partition_key` / `PartitionKey`)**, padrão de gravação (`upsert_item` vs `create_item` vs conector `cosmos.oltp`), TTL configurado no contêiner e eventuais limites de throughput/RU ou retries `429`.
   - **APIs (quando presentes)**: separe claramente **APIs consumidas pelo pipeline** (origens HTTP, paginação, timeout, retry, auth) de **APIs expostas para consumo/operação** (rotas `@app.get`/`@router.post`, contrato JSON de entrada/saída, códigos HTTP e autenticação). Use blocos `<details>` ou tabela de endpoints resumida sem virar especificação Swagger redundante.

## Evidências e Limites de Análise

Use snapshots only when supplied or locally available within scope. Identify run/date/source and distinguish clearly between a local repository/implementation snapshot (`snapshot local de implementação`) and live runtime telemetry; do not call them live. Retention or threshold charts can explain implementation without running a pipeline. Never fabricate records to populate executive cards.

This is an as-is guide. Document constraints affecting use. Do not invent owners, SLAs, classifications, optimization plans or historical rationale. An implemented choice can be described even when its original rationale is unknown.
