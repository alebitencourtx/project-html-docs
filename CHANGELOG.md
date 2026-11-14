# Changelog

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

### Padrão de Desenho da Solução em Estágios 2D Empilhados

- **Proibição Expressa de Diagramas Retilíneos Horizontais**: Proibição estrita de diagramas de arquitetura e esteiras de processamento contínuos em linha reta horizontal (`flowchart LR` contínuo com mais de 3 nós).
- **Estruturação Obrigatória em Estágios Empilhados (2D)**:
  - Decomposição vertical em camadas com `subgraph` temáticos funcionais (Origem/Ingestão, Validação/Stage, Processamento/Regras, Armazenamento/Contratos, Consumo/Analytics).
  - Marcadores numéricos circulares sequenciais (①..⑤) nos títulos dos nós explicitando o fluxo temporal e de dependências.
  - Subtítulos técnicos padronizados com `<small>` detalhando formato, particionamento e responsabilidade técnica dos componentes.
  - Inclusão obrigatória de legendas semânticas via `.figure-legend` para comunicação de tipos de canais, armazenamento e fluxos de exceção.

### Contratos e Documentação Técnica

- Atualização de `references/authoring.md` com as novas diretrizes obrigatórias de arquitetura em estágios 2D empilhados, legendas semânticas via `.figure-legend` e especificações completas do componente `barChart`.
- Atualização de `references/data-engineering.md` com a proibição de pipelines horizontais lineares, padrão obrigatório de esteiras em estágios funcionais empilhados, subtítulos técnicos com metadados/formatos e métricas de dados com variantes semânticas.
- Atualização de `SKILL.md` refletindo todas as melhorias visuais, de gráficos e de desenho de solução da versão 1.2.0.

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
