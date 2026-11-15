# Data-engineering profile

Describe consumers, transformations and stored contracts. Adapt to the repository: JSON state is not a relational database, and not every pipeline has bronze/silver/gold or an orchestrator.

For each important object establish business meaning, grain (exactly one row/event/object), natural/technical/composite identity, enforced vs logical uniqueness, join columns/cardinality, event/reference/ingestion times, timezone, source/transformation, format/location, write policy, partitioning, retention and consumption. Define missing/invalid values and their effect on output.

Separate execution order, lineage and association. List all composite-key components. Explain aggregation N:1 without pretending it is a foreign key. Types come from DDL/models/contracts, not guesses from sample values. Show essential attributes in ER and the full dictionary below.

## Diagramas de Arquitetura de Dados e Linhagem

1. **Proibição Expressa de Pipelines em Linha Reta Horizontal**:
   - É **terminantemente proibido** documentar pipelines e esteiras de dados como uma cadeia horizontal contínua e plana (`flowchart LR` contínuo com mais de 3 nós).
   - Fluxos horizontais extensos quebram a responsividade em telas desktop e mobile, forçando rolagem lateral excessiva e ocultando estágios finais do processamento.

2. **Diretriz Obrigatória: Matriz Arquitetural 2D (Entradas + Andares Empilhados)**:
   - Toda esteira de engenharia de dados deve ser modelada como uma matriz funcional:
     - `ENTRADAS`: Fontes de dados, eventos externos, arquivos brutos ou cadastros auxiliares à esquerda.
     - `ESTÁGIO 1`: Ingestão contínua / streaming / micro-lotes / data lake em tempo real (bloco superior).
     - `ESTÁGIO 2`: Carga em lote / orquestração / modelagem dimensional dbt / DW e BI (bloco inferior).
     - Setas verticais interligando partições do lake ao staging do armazém e feedback operacional.
   - **Passos Numerados Sequenciais**: Prefixar títulos de nós com marcadores circulares ①..⑦ para explicitar o fluxo causal dos dados.
   - **Subtítulos Técnicos com `<small>`**: Identificar em cada nó o formato, particionamento e tecnologia envolvida (ex.: `node["③ Data Lake GCS<br><small>Parquet particionado por month/day/hour</small>"]`).
   - **Legendas Semânticas (`.figure-legend`)**: Incluir logo abaixo do diagrama legenda identificando convenções de armazenamento, lote vs streaming, e caminhos de exceção:
     ```html
     <div class="figure-legend">
       <span class="legend-item"><span class="badge badge-danger"></span> Ingestão Streaming Contínua</span>
       <span class="legend-item"><span class="badge badge-info"></span> Camada Analítica / DW / Lote</span>
       <span class="legend-item"><span class="badge badge-neutral"></span> Fontes de Entrada</span>
       <span class="legend-item"><span class="line-dashed"></span> Leitura de Metadados / Gatilhos</span>
       <span class="legend-item"><span class="line-solid"></span> Fluxo Físico de Dados</span>
     </div>
     ```
   - **Nota Técnica de Rodapé**: Incluir parágrafo conciso detalhando janelas operacionais, frequência da orquestração e idempotência.

## Regras de Negócio e Métricas em Gráficos

Rules expose denominator eligibility, thresholds, cutoffs, deduplication and exceptions. Give worked examples for nonobvious outcomes. Do not average percentages when code uses ratios of sums, sum cumulative snapshots, or infer incremental behavior without implementation. Explain late data, reuse, reprocessing and idempotency as actually implemented.

Gráficos de retenção, janelas de expiração de dados ou SLAs operacionais devem utilizar o componente `barChart` padronizado:
- **Variantes Semânticas de Cor (`variant`)**: Utilize `"warning"` para limiares de atenção, `"danger"` para SLAs críticos ou estouro de tolerância, `"success"` para faixas ideais e `"neutral"` para estágios arquivados ou secundários.
- **Marcações de Escala e Grade**: Ticks a 25%, 50%, 75% e 100% com linhas de grade verticais facilitam a comparação imediata de volumetria e latência sem leitura exaustiva da tabela.
- **Tratamento Digno do Zero**: Volumes nulos, filas sem backlog ou retenções desabilitadas devem registrar `"0 (zero)"` explícito em vez de marcadores ambíguos.

Operation explains trigger, configuration, prerequisite state, output, restart/recovery and success criteria. If a successful job can publish a degraded-data diagnostic, explain this distinction.

Use snapshots only when supplied or locally available within scope. Identify run/date/source; do not call them live. Retention or threshold charts can explain implementation without running a pipeline. Never fabricate records to populate executive cards.

This is an as-is guide. Document constraints affecting use. Do not invent owners, SLAs, classifications, optimization plans or historical rationale. An implemented choice can be described even when its original rationale is unknown.
