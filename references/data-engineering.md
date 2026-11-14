# Data-engineering profile

Describe consumers, transformations and stored contracts. Adapt to the repository: JSON state is not a relational database, and not every pipeline has bronze/silver/gold or an orchestrator.

For each important object establish business meaning, grain (exactly one row/event/object), natural/technical/composite identity, enforced vs logical uniqueness, join columns/cardinality, event/reference/ingestion times, timezone, source/transformation, format/location, write policy, partitioning, retention and consumption. Define missing/invalid values and their effect on output.

Separate execution order, lineage and association. List all composite-key components. Explain aggregation N:1 without pretending it is a foreign key. Types come from DDL/models/contracts, not guesses from sample values. Show essential attributes in ER and the full dictionary below.

## Diagramas de Arquitetura de Dados e Linhagem

1. **Proibição Expressa de Pipelines em Linha Reta Horizontal**:
   - É **terminantemente proibido** documentar pipelines e esteiras de dados como uma cadeia horizontal contínua e plana (`flowchart LR` contínuo com mais de 3 nós).
   - Fluxos horizontais extensos quebram a responsividade em telas desktop e mobile, forçando rolagem lateral excessiva e ocultando estágios finais do processamento.

2. **Diretriz Obrigatória de Estágios Funcionais Empilhados (2D)**:
   - Toda esteira de engenharia de dados deve ser decomposta em **estágios empilhados verticalmente** (`flowchart TD` ou fluxo em camadas estruturadas).
   - **`subgraph` Temáticos**: Agrupe as etapas por responsabilidades claras do ciclo de vida dos dados, tais como:
     - `① Origem & Extração` (APIs, logs, transacional)
     - `② Ingestão & Stage` (Landing zone, validação de schema, desduplicação)
     - `③ Transformação & Enriquecimento` (Regras de negócio, agregações, joins)
     - `④ Camada de Armazenamento / Contratos` (Curated, Delta/Iceberg/Parquet, RDBMS)
     - `⑤ Publicação & Consumo` (Métricas, APIs analíticas, visualizações)
   - **Passos Numerados Sequenciais**: Prefixar títulos de nós com marcadores circulares ①..⑤ para destacar o fluxo causal dos dados.
   - **Subtítulos Técnicos com `<small>`**: Identificar em cada nó o formato, particionamento e tecnologia envolvida (ex.: `node["③ Agregação Diária<br><small>Delta Lake / Particionado por dt_referencia</small>"]`).
   - **Legendas Semânticas (`.figure-legend`)**: Incluir logo abaixo do diagrama legenda identificando convenções de armazenamento, lote vs streaming, e caminhos de exceção:
     ```html
     <div class="figure-legend">
       <span class="legend-item"><span class="legend-badge legend-sync"></span> Ingestão em Lote</span>
       <span class="legend-item"><span class="legend-badge legend-async"></span> Eventos Streaming</span>
       <span class="legend-item"><span class="legend-badge legend-storage"></span> Lakehouse / Tabela Otimizada</span>
     </div>
     ```

## Regras de Negócio e Métricas em Gráficos

Rules expose denominator eligibility, thresholds, cutoffs, deduplication and exceptions. Give worked examples for nonobvious outcomes. Do not average percentages when code uses ratios of sums, sum cumulative snapshots, or infer incremental behavior without implementation. Explain late data, reuse, reprocessing and idempotency as actually implemented.

Gráficos de retenção, janelas de expiração de dados ou SLAs operacionais devem utilizar o componente `barChart` padronizado:
- **Variantes Semânticas de Cor (`variant`)**: Utilize `"warning"` para limiares de atenção, `"danger"` para SLAs críticos ou estouro de tolerância, `"success"` para faixas ideais e `"neutral"` para estágios arquivados ou secundários.
- **Marcações de Escala e Grade**: Ticks a 25%, 50%, 75% e 100% com linhas de grade verticais facilitam a comparação imediata de volumetria e latência sem leitura exaustiva da tabela.
- **Tratamento Digno do Zero**: Volumes nulos, filas sem backlog ou retenções desabilitadas devem registrar `"0 (zero)"` explícito em vez de marcadores ambíguos.

Operation explains trigger, configuration, prerequisite state, output, restart/recovery and success criteria. If a successful job can publish a degraded-data diagnostic, explain this distinction.

Use snapshots only when supplied or locally available within scope. Identify run/date/source; do not call them live. Retention or threshold charts can explain implementation without running a pipeline. Never fabricate records to populate executive cards.

This is an as-is guide. Document constraints affecting use. Do not invent owners, SLAs, classifications, optimization plans or historical rationale. An implemented choice can be described even when its original rationale is unknown.
