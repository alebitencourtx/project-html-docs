# Changelog

## 1.5.0 — 2026-11-14

Endurecimento visual dos diagramas 2D e tema Santander, ergonomia de navegação (`H3`, `#back-to-top`, sidebar flex sem sobreposição), validação geométrica de SVGs e ampliação dos extratores de Engenharia de Dados (PySpark encadeado, `%run`/`dbutils.notebook.run`, Azure Data Factory JSON, Scala, env/CLI e `.docignore`).

### Corrigido & Melhorado

- **Sidebar sem sobreposição & Ergonomia Desktop (`assets/document.css`, `assets/document.js`, `scripts/build.mjs`)**:
  - Conversão de `.sidebar` em coluna flex (`nav` com scroll independente acima do rodapé `<small>`), eliminando definitivamente a sobreposição do banner `"HTML único · leitura offline"` sobre os últimos itens do menu.
  - Remoção do bloco CSS legado `@media (max-width: 760px)`, alinhando o shell exclusivamente à experiência desktop (~1440 px), e substituição de `background: white` literais por `var(--surface)`.
  - Geração automática de âncoras `H3` com IDs únicos e subnavegação recuada (`.nav-sub`) na barra lateral (respeitando busca e filtro de audiência), além do botão flutuante `#back-to-top`.
  - Suporte a acentos em caixa alta (`ÁÀÂÃÉÊÍÓÔÕÚÇ`) no cálculo de largura de rótulos de `barChart`.
- **Harmonização Completa do Tema Santander & Blindagem SVG (`scripts/diagrams.mjs`, `assets/document.css`)**:
  - Classes semânticas em zonas (`.sol-zone-*`), nós (`.sol-node-role-*`), cabeçalhos/setas (`.sol-arrow-head-*`), linhagens (`.sol-edge-lineage`) e cartões ER (`.schema-header-*`), permitindo harmonização visual completa do modo `Santander` nos diagramas 2D sem perda das cores semânticas de sucesso/erro/alerta.
  - Prevenção automática de sobreposição entre *pills* de rótulos e caixas de nós/entidades (`resolvePillPositions`).
  - Renderização de `` `código` `` em notas técnicas (`.diagram-note`), remoção de crases soltas em títulos/`figcaption`, eliminação de marcação dupla `??` em tipos nullable no `schema`, e largura dinâmica de badges chave (`PK`/`PART`/`UK,FK`).
- **Validação Estrutural e Guardrails (`scripts/build.mjs`, `scripts/validate.mjs`)**:
  - Rejeição explícita de `<h1>` dentro do Markdown de seções (Markdown ou HTML) e reserva do ID `back-to-top`.
  - Auditoria SVG em `validateHtml`: exige `viewBox` numérico válido, proíbe `NaN`/`Infinity`/`undefined` em atributos geométricos, `<rect>` negativos, crases literais em legendas/notas de diagramas e `??` no `.schema-svg`.
  - Avisos não bloqueantes (`warnings`) no recibo quando há excesso de `"audience": "all"` ou omissão majoritária de `sections[].sources`.
- **Dossiê Estático 1.5.0 & Limpeza do Pacote (`scripts/inspect_repo.py`, `scripts/verify.mjs`)**:
  - Parser completo de cadeias PySpark (captura `.format`, `.mode`, `.partitionBy`, `.trigger`, `checkpointLocation` e opções em AST) + dicionários `spark.cosmos.*` / `eventhubs.*` / `fs.azure.*` / `kafka.*`.
  - Extração de `%run` e `dbutils.notebook.run(...)` com arestas `'notebook_run'`, pipelines Azure Data Factory / Synapse JSON (`'adf_activity'`), arquivos Scala (`.scala`), variáveis `os.getenv`/`os.environ`/CLI (`argparse`/`click`/`typer`) em `envAndCliParams`.
  - Exclusão automática de artefatos gerados (`*.validation.json`, `reading-plan.md`, `update-plan.md`, `documentacao*.html`), suporte a `.docignore` na raiz, `git diff --stat` no `--impact`, e remoção do diretório transitório `outputs/`.

## 1.4.0 — 2026-11-14

Descoberta determinística de repositórios (0 tokens de LLM), extração profunda para Engenharia de Dados em nuvem/streaming e atualização incremental orientada a impacto.

### Adicionado

- **Dossiê Estático e Plano de Leitura Cirúrgica (`scripts/inspect_repo.py`)**:
  - Extração AST para Python (`.py`, notebooks Databricks `# COMMAND ----------` / `%sql` / `%python` e `.ipynb` ignorando outputs), além de parsers determinísticos para SQL/DDL/CTEs/dbt, JS/TS, Workflows GitHub Actions, `databricks.yml`, configurações JSON/TOML e IaC Terraform/Bicep.
  - Detecção especializada de sinais e E/S para **PySpark**, **Databricks** (`dbutils.widgets`, `dbutils.secrets` sem valores, `@dlt.table`, `cloudFiles`), **Delta Lake**, **Azure Cosmos DB**, **Azure Event Hubs**, **Azure Blob Storage / ADLS Gen2** (`abfss://`, `wasbs://`), **SQL/DuckDB/Snowflake/BigQuery**, e **APIs** (FastAPI/Flask/Express rotas e modelos Pydantic/dataclass/StructType/PyArrow).
  - Construção automática de grafo de dependências (`import`, `bundle_task`, `workflow_run`, `sql_lineage`), cálculo de centralidade, classificação em **4 Ondas de Leitura** (`readingWaves`), índice de testes (`testsIndex`), `scaleProfile` (`small` / `medium` / `large` para divisão paralela por domínios) e geração opcional de `reading-plan.md` (`--plan`).
  - Higiene automática de segredos em constantes, configurações inline e referências `dbutils.secrets.get`.
- **Análise Incremental de Impacto e Drift (`scripts/verify.mjs`)**:
  - Flags `--impact`, `--dossier <inventory.json>` e `--plan <update-plan.md>` que cruzam alterações de SHA-256 com o grafo de dependências e `sections[].sources` do `document.json`, apontando fontes diretas, dependentes transitivos, novos arquivos core não rastreados e apenas as seções `stale` a revisar.
- **Guias de Nuvem & APIs (`SKILL.md`, `references/data-engineering.md`, `references/authoring.md`)**:
  - Diretrizes de leitura seletiva por ondas/intervalos de linhas e checklists específicos para PySpark, Databricks, Delta Lake, Cosmos DB, Event Hubs, Blob/ADLS Gen2 e APIs.

## 1.3.0 — 2026-11-14

Reengenharia visual e funcional para projetos de engenharia de dados (público técnico e não técnico), mantendo 100% de compatibilidade offline e preservação integral de todas as 11 categorias existentes.

### Adicionado

- **Motor SVG determinístico em grade 2D (`scripts/diagrams.mjs`)**:
  - **`solution` / `flow`**: grade 2D estruturada com coluna lateral de entradas (`ENTRADAS`), estágios empilhados (`warm`, `cool`, `teal`, `amber`, `neutral`), cartões multi-linha com passos numerados (`step`), chips inline para `` `código` ``, cilindros limpos, cartões de decisão compactos (`shape: "decision"`), corredores dedicados no rodapé (`channel: "bottom"` / `"bottom-inner"` / `"top"`), notas marginais (`callouts`), legenda vetorial `.figure-legend` e nota técnica de rodapé.
  - **`schema` / `erd`**: entidades de tabelas com cabeçalho tipado (`table`, `mart`, `json`, `external`), faixa explícita de **Grão** (com quebra automática de linha), leitura natural `[PK/FK/UK] nome_coluna — tipo` com zebra striping e conectores *Crow's Foot* (`1`, `0..1`, `1..N`, `0..N`) + linhagem tracejada (`kind: "lineage"`).
- **Navegação para público técnico e não técnico (`build.mjs`, `document.js`, `document.css`)**:
  - **Filtro de perfil de leitura** (`Todas` | `Visão de negócio` | `Visão técnica` | `Operação`): preserva todas as 11 seções no DOM/pesquisa enquanto ajusta foco e abertura das seções relevantes ao perfil.
  - **Callouts semânticos tipados** (`Regra de negócio:`, `Exemplo prático:`, `Atenção:`, `Limitação:`) e **badges automáticos de coluna** em tabelas (`` `PK` ``, `` `FK` ``, `` `UK` ``, `` `PARTIÇÃO` ``, `` `PII` ``, `` `NOT NULL` ``).
  - **Filtro local automático em dicionários/tabelas extensas** (`>= 8` linhas), botão limpar (`×`) e atalhos (`/` / `Ctrl+K`) na pesquisa, destaque visual dos termos buscados (`<mark class="search-hit">`), realce de conexões em `.sol-svg` (na página e dentro do modal ampliado) e controles de zoom (`−` / `+` com readout `%`) no modal `#diagram-dialog`.
- **Descoberta estática para Engenharia de Dados (`scripts/inspect_repo.py`)**: suporte a `.j2`, `.jinja`, `.jinja2`, `.hql`, `.ddl`, `.dml`, `.avsc`, `.graphql` e extração leve de `countsByKind` e `stackSignals` (dbt, PySpark, Databricks, Delta Lake, Airflow, Dagster, DuckDB, Polars, Terraform).
- **Exemplo completo (`examples/showcase/`)**: demonstra as 11 categorias preservadas com os novos diagramas, dicionário pesquisável, callouts tipados e matriz de incidentes.

### Corrigido & Melhorado

- Distribuição de portas (`nextPort`) calculada após a resolução real dos lados em `renderSolutionDiagram`, evitando sobreposição de múltiplas saídas no mesmo lado, além de distribuição de portas em `renderSchemaDiagram`.
- Desvio automático de arestas que cruzariam nós/entidades intermediários na mesma linha, quebra automática de subtítulos de zonas e tokens de código sem separadores, folga inferior de `meta` em cilindros e quebra de rótulos em canais/arestas verticais.
- Localização do `eyebrow` padrão para inglês (`language: "en"`), wrapper `<div class="table-wrap">` compatível com atributos na tag `<table>`, proteção contra IDs reservados do shell HTML e mensagens de erro contextualizadas para `H2` e blocos JSON.
- Pós-processamento Mermaid aprimorado para subtítulos de subgraph protegidos (`.subgraph-title`), `erDiagram` com colunas `[Badge] nome — tipo`, `edge-label-yes/no` com prefixos compostos (ex.: `"Sim (dados novos)"`), sincronização de scrollspy no rodapé da página e limite de altura em `@media print`.

## 1.2.0 — 2026-11-14

Evoluções visuais, reengenharia de gráficos, modernização do Design System e padronização arquitetural em estágios 2D empilhados desenvolvidos na branch `feature/melhorias-visuais-arquitetura`.

### Reengenharia de Gráficos (`barChart`)

- **Eliminação do abismo espacial (Proximidade Gestáltica)**: Posicionamento adaptativo de valores numéricos diretamente dentro da barra em barras longas (`barWidth >= 64px`) com texto branco em alto contraste, ou imediatamente após a barra em barras curtas, complementado por linhas guia pontilhadas discretas (`stroke-dasharray="2,3"`) conectando a barra ao valor.
- **Régua de Escala e Linhas de Grade (*Gridlines*)**: Injeção de linhas verticais suaves e marcações numéricas proporcionais a 25%, 50%, 75% e 100% da escala máxima, permitindo interpretação quantitativa imediata.
- **Representação Digna e Explícita do Valor Zero**: Substituição do traço gráfico ambíguo por texto suave ou badge explícito `"0 (zero)"` / `"0 (nenhum)"` no início da barra quando o valor for 0.
- **Variantes Semânticas de Cor (`variant`)**: Suporte ao atributo opcional `variant` em `spec.data[]` mapeando paleta padronizada:
  - `accent` (padrão): azul-petróleo/ciano (`#087f8c`)
  - `warning`: âmbar operacional (`#d97706`)
  - `danger`: carmesim/crítico (`#dc2626`)
  - `success`: verde/sucesso (`#16a34a`)
  - `neutral`: cinza ardósia (`#64748b`)
- **Acessibilidade e Tooltips Nativos em SVG (Zero JS)**: Cada linha estruturada com `<g class="chart-row">` contendo `<title>` nativo, suporte a foco por teclado (`tabindex="0"`) e realce `:hover` dinâmico nas barras.
- **Fluidez em Telas Estreitas**: Remoção da imposição de `min-width: 32rem` nas tabelas de 2 colunas do `<details>` do gráfico, permitindo visualização móvel perfeita sem scroll horizontal indesejado.

### Design System, Tipografia e Layout

- **Ergonomia de Leitura (*Measure*)**: Limitação da largura de linha a `max-width: 76ch` para parágrafos, listas e citações em `.section-body`, eliminando fadiga de leitura em monitores ultrawide enquanto tabelas e diagramas preservam 100% da largura útil.
- **Pilha Tipográfica Moderna e Números Tabulares**: Adoção de pilha de fontes nativas do sistema (`system-ui`) e ativação de `font-variant-numeric: tabular-nums` para alinhamento vertical preciso de dígitos em tabelas, métricas e datas.
- **Cabeçalhos Fixos Funcionais em Tabelas (`sticky th`)**: Correção em `.table-wrap` com `max-height: min(72vh, 680px)` e `overscroll-behavior: contain`, garantindo que `th { position: sticky; top: 0; }` permaneça visível durante a navegação em tabelas extensas.
- **Indicadores de Transbordamento (*Scroll Shadows*)**: Adição de sombras de rolagem nuançadas em gradiente e scrollbar refinada (`scrollbar-width: thin`) no contêiner `.diagram-scroll`, fornecendo affordance visual imediato em telas que cortam diagramas largos.
- **Legendas Semânticas Padronizadas (`.figure-legend`)**: Estilização de componentes de legenda flexíveis com badges coloridos e convenções de linha tracejada para diagramas e mapas de fluxo.
- **Accordions com Chevron Vetorial Rotativo**: Substituição dos caracteres estáticos `+`/`−` por chevrons vetoriais com animação de rotação suave de 90° (`transition: transform 0.2s`), eliminando saltos visuais.
- **Sincronização de Scroll da Sidebar**: Integração no `IntersectionObserver` de `assets/document.js` para rolar automaticamente o link ativo da barra lateral para a área visível (`activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' })`).
- **Otimização para Impressão A4**: Adição de `tr { break-inside: avoid; }` e `h2, h3, h4 { break-after: avoid; }` no bloco `@media print` para prevenir quebra de linhas e títulos órfãos.

### Visualização de Arquitetura e Inspeção no Desktop

- **Modal de Ampliação Interativo com Controles de Escala**: Inclusão de botões "Ajustar à tela" (*Fit*) e "Tamanho real" (*100%*) no cabeçalho do `<dialog id="diagram-dialog">`, permitindo que diagramas e matrizes panorâmicas sejam inspecionados em sua totalidade de uma só vez, com alternância imediata para tamanho natural.
- **Eliminação de Inflação Artificial de Diagramas**: Remoção do multiplicador arbitrário `* 1.15` e da restrição forçada de `min-width: 90%` em `scripts/build.mjs`, assegurando que o SVG mantenha dimensões naturais sem transbordamento forçado da viewport desktop.
- **Hierarquia Tipográfica Real em Nós (Pós-processamento de SVG)**: Classificação automática de títulos e subtítulos gerados a partir de `<small>` com `.node-title` e `.node-subtitle`, garantindo peso e tamanho de fonte distintos sem degradação do texto.
- **Subgraphs Semânticos Agnósticos a Projetos**: Estilização visual em tons pastel para subgraphs de esteiras de dados baseada em convenções genéricas de engenharia (`stream`/`realtime`/`ingest` em tons quentes suaves, `batch`/`dw`/`analytics`/`serving` em azul analítico suave, e `input`/`source`/`entrada` com bordas tracejadas discretas).
- **Diretrizes Arquiteturais 2D Agnósticas**: Documentação de padrões em `references/authoring.md` e `references/data-engineering.md` orientando a divisão lógica em Entradas (esquerda), Regimes Funcionais Empilhados (tempo real vs. lote) e Consumo (direita), eliminando proibições rígidas dogmáticas e estabelecendo foco na experiência desktop.

### Padrão de Desenho da Solução em Estágios 2D Empilhados

- **Controle de Enquadramento e Orientação de Diagramas**: Orientação para evitar esteiras horizontais excessivamente longas (>1.200px), reservando `flowchart LR` para diagramas compactos e matrizes 2D para arquiteturas complexas.
- **Estruturação em Estágios Empilhados (2D)**:
  - Decomposição em camadas funcionais com `subgraph` temáticos (Entradas à esquerda, Streaming/Ingestão no topo, Batch/Serving na base).
  - Marcadores numéricos circulares sequenciais (①..⑤) nos títulos dos nós de ação explicitando o fluxo temporal e de dependências (sem numerar fontes ou stores).
  - Subtítulos técnicos padronizados com `<small>` detalhando formato, particionamento e responsabilidade técnica dos componentes.
  - Inclusão de legendas semânticas via `.figure-legend` para comunicação de tipos de canais, armazenamento e fluxos de exceção.

### Contratos e Documentação Técnica

- Atualização de `references/authoring.md` com as diretrizes de arquitetura em estágios 2D empilhados, legendas semânticas via `.figure-legend` e especificações do componente `barChart`.
- Atualização de `references/data-engineering.md` com diretrizes para esteiras de dados em estágios funcionais empilhados, subtítulos técnicos com metadados/formatos e métricas de dados com variantes semânticas.
- Atualização de `package.json` para versão 1.2.0 alinhada ao `SKILL.md`.

## 1.1.0 — 2026-11-14

Correções de confiabilidade e leitura derivadas do relatório consolidado. O formato de autoria continua compatível com a 1.0.0.

### Corrigido

- Ampliação de diagramas preserva IDs de `marker`, gradientes, filtros e `clipPath`; as setas não desaparecem mais no modal.
- Foco retorna ao botão de origem após fechar o modal.
- Busca usa singular/plural correto e restaura o estado de abertura das seções ao limpar o campo.
- Tabelas têm largura mínima e cabeçalho fixo; no estreito elas rolam em vez de comprimir colunas.
- Gráficos calculam a margem esquerda pelo maior rótulo (até 45 caracteres) e marcam o valor zero.
- Gráficos largos rolam no estreito em vez de reduzir os rótulos a poucos pixels.
- Impressão preserva a largura natural de diagramas menores e limita apenas os que excedem a página.
- Salto por âncora é instantâneo, evitando rolagem de milhares de pixels.
- Contagem do recibo separa `contentSections` de `referenceBlocks`.
- Versão do builder é lida de `package.json`; o recibo inclui `skillVersion`, `builtAt` e `manifestSha256`.
- Inventário inclui `.sh`, `.txt`, `.ps1`, `.tf`, `.proto`, `.ipynb` e outras extensões, com classificação por tipo.
- Validador rejeita tabela sem cabeçalho, `details` sem `summary`, H4 sem H3, `figure` sem legenda, link sem texto e `style` inline com URL externa.
- Cópia de código tenta `navigator.clipboard`, depois `execCommand` e, por fim, seleção manual.

### Adicionado

- `scripts/verify.mjs`: compara hashes das fontes e revisão Git com o recibo; suporta `--strict`.
- `--include` e `--exclude` no `inspect_repo.py`.
- Orientação de higiene de segredos no `SKILL.md`.
- Regras de tabela, `summary`, hierarquia de títulos, figura, link e estilo inline no validador.
- Testes para rótulo longo, zero, estruturas incompletas e verificação de fontes.

### Fora do escopo desta versão

Mapa de tabelas/junções, gráfico de linha, bloco de schema, fluxo em estágios, conteúdo multiarquivo, âncoras H3 + sumário e syntax highlighting permanecem no roadmap do relatório consolidado.
