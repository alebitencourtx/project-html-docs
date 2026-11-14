# Relatório de Auditoria Visual, Reengenharia de Gráficos e Design System
## Skill `project-html-docs` (v1.1.0)

| Dimensão | Especificação Técnica |
|---|---|
| **Skill Auditada** | `project-html-docs` (v1.1.0, commit `4fc469d`, [package.json](file:///c:/Users/alebi/Documents/ChatGPT/teste-opendata/project-html-docs/package.json)) |
| **Artefatos Validados** | `outputs/admin-metrics-v2/documentacao-v2.html` (144.860 bytes, 15 seções, 7 diagramas, 2 gráficos)<br>`datamaster/docs/v2/documentacao-v2.html` (139.642 bytes, 12 seções, 8 diagramas, 2 gráficos)<br>`scripts/build.mjs`, `assets/document.css`, `assets/document.js`, `scripts/validate.mjs`, `scripts/verify.mjs` |
| **Testes Executados** | `node --test tests/*.test.mjs` (8/8 passaram em ~1.000ms); `validateHtml` executado em ambos os outputs (0 erros) |
| **Premissas Invioláveis** | 100% offline e autocontido (zero conexões remotas/CDNs/Google Fonts), preservação integral de todas as seções e categorias existentes, nenhuma modificação de código de projeto nesta etapa analítica |

---

## 1. Sumário Executivo & Confronto Crítico com a Investigação Anterior

A versão **1.1.0** trouxe avanços significativos de estabilidade e confiabilidade (resolvendo colisões de IDs em marcadores de SVG, persistência de estado na busca e criação do validador de proveniência `verify.mjs`).

Entretanto, uma auditoria profunda do código-fonte e dos outputs renderizados revelou que a análise preliminar continha equívocos técnicos substanciais e suposições não verificadas, ao mesmo tempo em que ignorou gargalos visuais críticos que afetam diretamente a experiência do usuário final.

### Principais Correções e Esclarecimentos em Relação ao Relatório Anterior:

1. **A Falácia do Dark Mode "Automático"**:
   - *O que a investigação anterior alegou*: Que bastava definir um bloco `@media (prefers-color-scheme: dark)` remapeando variáveis em `:root` para que todo o documento e os diagramas Mermaid se adaptassem automaticamente.
   - *O que o código realmente mostra*:
     - Em `scripts/build.mjs`, as variáveis do Mermaid (`--bg:#f8fbfc;--surface:#ffffff;--fg:#172b3c;...`) são injetadas como **estilos inline no atributo `style` de cada `<svg>`**. Regras em `:root` no CSS têm especificidade inferior e **não sobrescrevem propriedades inline**. Os diagramas permaneceriam com fundo branco brilhante.
     - Em `scripts/build.mjs`, todas as cores do `barChart` (`fill="#314c5e"`, `fill="#e8eff3"`, `fill="#172b3c"`) são **atributos SVG literais fixos**. No dark mode, os textos pretos tornam-se completamente invisíveis sobre o fundo escuro.
     - Em `assets/document.css`, existem **45 cores hexadecimais literais sem variáveis** (`figure { background: #f8fbfc }`, `.card { background: #fafcfd }`, `.metric { background: white }`, `th { background: #edf3f6 }`). O dark mode simplista produziria uma aberração visual com caixas brancas sobre fundo escuro.

2. **Exagero sobre Transbordamento de Diagramas em Monitores Desktop (1080p)**:
   - *O que a investigação anterior alegou*: Que "quase todos os diagramas transbordam e exigem rolagem horizontal em 1080p".
   - *O que a medição real revelou*:
     - Em `admin-metrics-v2`: **Nenhum dos 7 diagramas transborda 1050px** (o maior tem 905,6px de largura natural).
     - Em `datamaster`: Apenas **2 dos 8 diagramas** (Diagrama 1 com 1.364px e Diagrama 3 com 1.781px) transbordam 1050px. Os outros 6 cabem perfeitamente.
     - *Diagnóstico real*: O problema grave de transbordamento não ocorre em desktops Full HD, mas sim em **telas <= 900px (tablets e celulares)**, onde 11 dos 15 diagramas transbordam sem qualquer indicador de affordance de rolagem.

3. **Efeito Colateral Oculto da Largura Mínima de Tabela (`32rem`)**:
   - A regra `table { min-width: 32rem }` adicionada na v1.1.0 foi aplicada indiscriminadamente a **todas** as tabelas. Inclusive às tabelas de 2 colunas dentro do `<details>` do `barChart` (`Categoria | Valor`). Como consequência, em celulares de 360px–390px, uma tabela de apenas duas colunas curtas é forçada a 512px, gerando uma barra de rolagem horizontal desnecessária dentro do card do gráfico.

4. **Lacunas Não Notadas Anteriormente**:
   - **Busca cega sem realce visual**: A busca abre as seções correspondentes, mas não insere `<mark>` nos termos pesquisados; em seções de 2.000 palavras, o usuário precisa fazer uma segunda busca com `Ctrl+F` para localizar o trecho.
   - **Desconexão de rolagem da Sidebar**: Quando o usuário navega por páginas longas com 15 seções, os links inferiores da sidebar recebem `aria-current="location"`, mas ficam ocultos fora da área visível da barra lateral, sem sincronização de scroll (`scrollIntoView({ block: 'nearest' })`).
   - **Quebra de linhas de tabela na impressão**: Tabelas de 24 campos sofrem cortes indesejados ao meio em A4 por falta de `tr { break-inside: avoid }`.

---

## 2. Auditoria Forense das Correções Recentes (v1.1.0)

A tabela abaixo confronta as mudanças aplicadas na v1.1.0 com o seu comportamento real na renderização:

| Alteração v1.1.0 | Arquivo e Linhas | Comportamento Real no Navegador | Veredito |
|---|---|---|---|
| **Namespace em IDs de SVG clonado** | `assets/document.js#L121-L150` | Reescreve com sucesso atributos `id` e referências `url(#...)`. Setas de diagramas, marcadores e gradientes permanecem perfeitos no modal. | **Eficaz / Resolvido** |
| **Restauração de foco acessível** | `assets/document.js#L158` | O foco retorna ao botão "Ampliar" via `trigger?.focus()` com delay seguro de 60ms. | **Eficaz / Resolvido** |
| **Busca com memória de estado** | `assets/document.js#L15-L41` | `savedOpen` memoriza fielmente o estado dos accordions e restaura ao limpar a caixa de pesquisa. | **Eficaz / Resolvido** |
| **Cabeçalho fixo de tabela (`th sticky`)** | `assets/document.css#L12` | **Totalmente inoperante na rolagem da página.** Elementos com `position: sticky` ficam contidos no ancestral de overflow (`.table-wrap`). Como `.table-wrap` não possui `max-height`, ele expande livremente; a tabela rola junto com a página e o cabeçalho desaparece. | **Falha Técnica** |
| **Largura mínima de tabela (`32rem`)** | `assets/document.css#L11` | Evita compressão em tabelas largas, mas penaliza tabelas simples (2 colunas) em dispositivos móveis, forçando scroll horizontal indesejado. | **Parcial / Efeito Colateral** |
| **Cálculo dinâmico da margem `left` no gráfico** | `scripts/build.mjs#L23-L25` | A fórmula baseada em pesos por caractere calcula corretamente a largura do rótulo até 45 caracteres. Nenhum texto é cortado. | **Eficaz / Resolvido** |
| **Marcador de zero no gráfico** | `scripts/build.mjs#L27` | Adiciona `<line data-zero="true" stroke-width="3">`. Visualmente, assemelha-se a uma falha gráfica ou risco acidental na borda da barra cinza. | **Insatisfatório visualmente** |
| **Conflito de `min-width` no SVG do gráfico** | `scripts/build.mjs#L29` vs `assets/document.css#L14` | O CSS define `.chart svg { min-width: 720px }`, porém o SVG possui `style="...; min-width: ${w}px"`. Como `w` varia de 880px a 968px, o inline style vence e quebra a leitura móvel. Além disso, `tests/build.test.mjs:62` exige `min-width:\d+px`. | **Conflito de Especificidade** |

---

## 3. Reengenharia Aprofundada do Componente de Gráficos (`barChart`)

O gerador atual em `scripts/build.mjs` produz uma renderização estática que sofre de problemas severos de visualização de dados.

### 3.1. Eliminação do "Abismo Espacial" e Conectividade Gestáltica
- **O Problema Matemático**:
  A coordenada horizontal do valor numérico é fixada em:
  ```javascript
  // build.mjs:27
  <text x="${left+plot+14}" y="${y+16}" fill="#172b3c" font-weight="600">${esc(fmt.format(d.value))}</text>
  ```
  Onde `plot = 540`.
  No gráfico *"Janelas configuradas de histórico"* do Admin Metrics, o item `"Séries públicas"` possui valor `3` (escala máxima `30`). A barra azul ocupa apenas `54px`.
  O número `"3"` é renderizado em `x = 220 + 540 + 14 = 774px`.
  Existe uma lacuna de **486 pixels vazios** entre a ponta da barra e o número. A Lei da Proximidade da Gestalt é violada: o olho do leitor precisa fazer rastreamento horizontal cego sobre uma barra cinza vazia.
- **A Solução Técnica Proposta**:
  Adotar um modelo duplo de posicionamento adaptativo com guia visual:
  1. **Barras longas (`barWidth >= 64px`)**: O valor numérico é renderizado **dentro da própria barra**, alinhado à direita com `text-anchor="end"`, cor branca `#ffffff` e `font-weight: 600`.
  2. **Barras curtas (`barWidth < 64px`)**: O valor é posicionado imediatamente após a ponta da barra: `x = left + barWidth + 8px` com texto escuro.
  3. **Preservação de Alinhamento de Coluna com Guia Pontilhada**: Caso se deseje manter a coluna de números alinhada à direita para facilitar comparação vertical direta, adicionar uma linha guia sutil entre o término da barra e o número:
     ```svg
     <line x1="${left + barWidth + 6}" y1="${y + 11.5}" x2="${left + plot + 6}" y2="${y + 11.5}" stroke="#cbd5e1" stroke-dasharray="2,3" stroke-width="1"/>
     ```

### 3.2. Responsividade Mobile: SVG Fluido e Alternância de Layout
- **Evidência no Dispositivo Móvel**:
  Em uma tela de 375px (iPhone padrão), o gráfico atual é cortado. O leitor visualiza os rótulos de texto e ~40px de uma barra cinza. O número fica invisível e inacessível a menos que o usuário deslize a tela lateralmente.
- **Solução Arquitetural**:
  1. **Eliminar o `min-width: ${w}px` inline** no SVG de `build.mjs` e transferir o controle de dimensionamento para classes utilitárias no CSS:
     ```css
     .chart svg {
       width: 100%;
       max-width: 100%;
       height: auto;
       display: block;
     }
     ```
  2. **Layout Adaptativo em Telas Estreitas (Mobile Stacked Mode)**:
     Em telas `<= 640px`, a melhor prática para gráficos de barras é renderizar no modo **empilhado (Stacked)**:
     - Linha 1: Rótulo da categoria à esquerda, valor numérico à direita.
     - Linha 2: Barra ocupando 100% da largura útil da viewport.
     Isso reduz a zero a necessidade de rolagem horizontal em smartphones, tornando os dados legíveis num relance.

### 3.3. Eixos, Grade (*Gridlines*) e Régua de Escala
- **Ausência Crítica**:
  O gráfico exibe apenas uma legenda estática no rodapé: `"0 · dias · escala linear"`. O usuário não sabe qual valor representa o limite direito da barra cinza (se é 30, 50 ou 100).
- **Proposta de Régua Numérica**:
  Injetar 4 a 5 linhas de grade verticais discretas (`stroke="#e2e8f0"` com `stroke-dasharray="3,3"`) correspondentes a 25%, 50%, 75% e 100% do valor máximo (`max`), acompanhadas dos marcadores numéricos arredondados no topo ou base do gráfico:
  ```javascript
  const ticks = [0, 0.25, 0.5, 0.75, 1.0].map(ratio => ({
    x: left + Math.round(ratio * plot),
    value: Math.round(ratio * max)
  }));
  ```

### 3.4. Variantes Semânticas de Cor por Categoria
- No Admin Metrics, os dois limiares de resposta são renderizados na mesma cor ciano `#087f8c`:
  - `Atenção: 2.000 ms`
  - `Crítico: 4.000 ms`
- Em monitoramento operacional, associar a mesma cor a "Atenção" e "Crítico" viola princípios de IHC (Interação Humano-Computador).
- **Especificação de Suporte a Esquema Semântico**:
  Permitir atributo opcional `variant` em `spec.data[]`:
  ```json
  {
    "data": [
      { "label": "Atenção", "value": 2000, "variant": "warning" },
      { "label": "Crítico", "value": 4000, "variant": "danger" }
    ]
  }
  ```
  Mapeamento de tokens CSS no SVG:
  - `accent` (padrão): `#087f8c` (teal)
  - `warning`: `#d97706` (âmbar)
  - `danger`: `#dc2626` (carmesim)
  - `success`: `#16a34a` (esmeralda)
  - `neutral`: `#64748b` (ardósia)

### 3.5. Representação Semântica e Dignificada do Valor Zero
- No Datamaster v2, o item `"30 informado: nenhuma página lida"` tem valor `0`.
- O traço de 3px `<line data-zero="true">` introduzido na v1.1.0 parece uma falha de pintura na borda da barra.
- **Novo Padrão Visual**:
  Quando `d.value === 0`, preencher o início da barra com um badge ou texto textual suave:
  ```svg
  <text x="${left + 8}" y="${y + 16}" fill="#64748b" font-size="12" font-style="italic">0 (nenhum)</text>
  ```
  Isso comunica intencionalidade de forma inequívoca.

### 3.6. Interatividade Acessível com Tooltips Nativos (100% Offline e Zero JS)
- Agrupar cada linha em `<g class="chart-row" tabindex="0" role="graphics-symbol" aria-label="${esc(d.label)}: ${fmt.format(d.value)} ${esc(spec.unit)}">`.
- Incluir elemento SVG `<title>${esc(d.label)}: ${fmt.format(d.value)} ${esc(spec.unit)}</title>`.
- Estilizar com CSS elegante:
  ```css
  .chart-row:hover rect.bar-fg,
  .chart-row:focus-visible rect.bar-fg {
    filter: brightness(1.15);
    outline: none;
  }
  .chart-row:hover text {
    fill: var(--ink);
    font-weight: 700;
  }
  ```

### 3.7. Correção da Tabela de Detalhes (`<details>`) do Gráfico
- Adicionar no CSS:
  ```css
  .chart details table {
    min-width: auto !important; /* Desfaz o 32rem global para a tabela simples do gráfico */
    width: 100%;
  }
  ```
  Elimina a rolagem horizontal interna forçada nos celulares em tabelas de 2 colunas.

---

## 4. Análise dos Diagramas Mermaid (SVG Inline) e Modal de Inspeção

O renderizador em `scripts/build.mjs` utiliza a biblioteca `beautiful-mermaid`.

### 4.1. Diagnóstico do Fator de Escala (1.15x e 1.35x)
- O código aplica ampliação fixa de `1.15` (ou `1.35` para `erDiagram`).
- **Análise Forense de Tamanhos**:
  - Em telas Full HD desktop (1920x1080), a área de leitura disponível é de ~1050px.
  - No Admin Metrics, todos os 7 diagramas medem entre 669px e 905px de largura. Nenhum deles excede a largura da tela em desktops.
  - No Datamaster, o Diagrama 3 ("Do evento recebido ao documento no MongoDB") atinge **1.781,4px**, e o Diagrama 1 atinge **1.364,6px**.
- **Comportamento em Telas Médias e Móveis**:
  - Em telas `<= 900px`, 11 dos 15 diagramas transbordam a largura do contêiner.
  - Como o contêiner `.diagram-scroll` não possui indicativo visual de transbordamento, o usuário mobile não percebe que o diagrama continua para a direita.
- **Melhoria Proposta — Scroll Shadows Nativas em CSS**:
  ```css
  .diagram-scroll {
    overflow-x: auto;
    background:
      linear-gradient(to right, white 30%, rgba(255,255,255,0)),
      linear-gradient(to right, rgba(255,255,255,0), white 70%) 100% 0,
      radial-gradient(farthest-side at 0 50%, rgba(0,0,0,.15), rgba(0,0,0,0)),
      radial-gradient(farthest-side at 100% 50%, rgba(0,0,0,.15), rgba(0,0,0,0)) 100% 0;
    background-repeat: no-repeat;
    background-size: 40px 100%, 40px 100%, 14px 100%, 14px 100%;
    background-attachment: local, local, scroll, scroll;
  }
  ```
  Essa técnica pura de CSS desenha uma sombra sutil apenas enquanto houver conteúdo oculto para rolar, sumindo automaticamente ao atingir o fim da rolagem.

### 4.2. Contraste e Profundidade Visual dos Nós do Diagrama
- **Medição Colorimétrica**:
  - Fundo do contêiner da figura: `#f8fbfc` (luminância 0.966)
  - Superfície dos nós: `#ffffff` (luminância 1.000)
  - Taxa de contraste entre nó e fundo: **1.03:1**.
  - A diretriz WCAG 2.1 (Critério 1.4.11) exige contraste mínimo de **3:1** para elementos gráficos essenciais.
  - A borda `#b8cbd5` contra o fundo `#f8fbfc` tem contraste de apenas **1.6:1**.
- **Solução Visual**:
  1. Aumentar o tom da borda dos nós para `#94a3b8` (Slate 400).
  2. Injetar um filtro SVG sutil de drop-shadow nos nós (`feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.06"`), conferindo sensação tátil de camadas e elevação limpa sem pesar no layout.

### 4.3. Modernização da Barra de Ferramentas do Modal de Diagramas
O modal `#diagram-dialog` atual em `assets/document.js` exibe o SVG em tamanho fixo (`naturalWidth`), forçando o uso de barras de rolagem bidirecionais.
- Diagramas pequenos (como o Diagrama 2 do Datamaster, de 302px) ficam perdidos no centro de um modal de 1600px.
- Diagramas gigantes (1.781px) obrigam navegação arrastada.
- **Novos Recursos para a Barra de Ferramentas do Modal**:
  1. **Ajustar à Janela (Fit)**: Calcula a escala exata (`Math.min(canvasWidth / svgWidth, canvasHeight / svgHeight)`) para exibir o diagrama completo sem rolagem.
  2. **Controle de Zoom Interativo**: Botões `[ + ]`, `[ − ]` e `[ 100% ]` com atalhos de teclado (`+` e `-`).
  3. **Exportação Offline Direta ("Baixar SVG")**:
     Recurso de grande valor para engenheiros que precisam extrair a arquitetura para apresentações ou tickets:
     ```javascript
     function downloadCurrentSvg() {
       const svg = document.querySelector('#dialog-canvas svg');
       const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `${document.querySelector('#dialog-title').textContent.trim()}.svg`;
       a.click();
       URL.revokeObjectURL(url);
     }
     ```

---

## 5. Design System, Tipografia e Layout do HTML Gerado

### 5.1. Otimização Tipográfica do *Measure* (Comprimento da Linha de Texto)
- **Diagnóstico**:
  Em monitores amplos (1440p / ultrawide), os parágrafos de texto expandem por até 1350px, gerando linhas com mais de **130 caracteres**.
  O padrão áureo de ergonomia de leitura em design editorial e documentações técnicas é de **65 a 76 caracteres** por linha (*Measure*).
- **Ajuste Proposto**:
  Restringir parágrafos e listas à largura ótima de leitura, mantendo diagramas, tabelas e métricas na largura total:
  ```css
  .section-body > p,
  .section-body > ul,
  .section-body > ol,
  .section-body > blockquote {
    max-width: 76ch;
  }
  .table-wrap, .diagram, .chart, .cards, .hero-cards {
    max-width: 100%;
  }
  ```

### 5.2. Pilha Universal de Fontes do Sistema e Números Tabulares
- O CSS atual declara `font-family: Inter, Segoe UI, Arial, sans-serif;`.
- Como o HTML é 100% offline e não inclui fontes web, "Inter" só carrega se instalada no SO. Em macOS, cai para Arial (que não possui números tabulares nem métricas refinadas).
- **Pilha de Fontes Nativas Moderna**:
  ```css
  :root {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  }
  /* Números perfeitamente alinhados em tabelas, métricas e datas */
  table, .metric strong, .sidebar nav a span, .section-heading .number {
    font-variant-numeric: tabular-nums;
  }
  /* Pilha Mono com clareza em código */
  code, pre, .source-path {
    font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Monaco, Consolas, "Courier New", monospace;
  }
  ```

### 5.3. Correção Definitiva do Cabeçalho Fixo de Tabelas (`sticky th`)
- Para que `position: sticky` funcione em tabelas longas (como os dicionários de dados de 24 campos do Datamaster e Admin Metrics) sem quebrar o layout da página:
  ```css
  .table-wrap {
    overflow: auto;
    max-height: min(72vh, 680px); /* Ativa a rolagem interna apenas em tabelas longas */
    overscroll-behavior: contain; /* Impede que o scroll da tabela role a página abruptamente */
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: #edf3f6;
    box-shadow: inset 0 -1px 0 var(--line); /* Previne frestas de renderização em sub-pixels */
  }
  ```
  Tabelas curtas (com 2 a 5 linhas) têm altura inferior a 300px e não ativam barra vertical, preservando comportamento natural.

### 5.4. Syntax Highlighting no Build (100% Estático, Zero Dependência em Runtime)
- Nos dois projetos analisados, existem blocos de código em `sql`, `powershell`, `bash`, `python` e `json`.
- Atualmente, todo o código é exibido em texto monocromático azul-escuro.
- **Implementação Segura no Build**:
  A verificação em `scripts/build.mjs` confirma que a função `clean()` do `sanitize-html` **permite a tag `span` e o atributo `class`**:
  ```javascript
  const textTags = [...sanitizeHtml.defaults.allowedTags, 'details', 'summary', 'div', 'span', ...];
  ```
  Portanto, um tokenizador leve por expressões regulares executado em `scripts/build.mjs` no momento do build pode converter palavras-chave (`SELECT`, `def`, `if`, `const`), strings, comentários e números em `<span class="tok-kw">`, `<span class="tok-str">`, etc.
- **Pill de Linguagem no Bloco de Código**:
  Adicionar um indicador visual da linguagem no canto superior esquerdo de cada `<pre>`:
  ```css
  pre:before {
    content: attr(data-lang);
    position: absolute;
    left: 14px;
    top: 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #8cadbd;
  }
  ```

### 5.5. Realce Visual de Termos Encontrados na Busca (*Search Highlight*)
- **Lacuna Atual**: A busca expande as seções, mas o usuário não sabe onde a palavra pesquisada está.
- **Solução Visual Leve**:
  Ao filtrar, envolver as ocorrências do termo com `<mark class="search-match">`:
  ```css
  mark.search-match {
    background: #fef08a;
    color: #854d0e;
    padding: 1px 3px;
    border-radius: 3px;
  }
  ```
  Ao limpar o campo de busca, os elementos `<mark>` são desenrolados de forma limpa.

### 5.6. Sincronização de Rolagem da Sidebar (*Sidebar Scroll Sync*)
- No `assets/document.js`, o `IntersectionObserver` atualiza o link ativo com `aria-current="location"`.
- Adicionar sincronização do scroll da barra lateral:
  ```javascript
  const activeLink = document.querySelector(`nav a[href="#${e.target.id}"]`);
  if (activeLink) {
    activeLink.setAttribute('aria-current', 'location');
    activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  ```
  Evita que o leitor perca o rastreamento em documentos com 15+ seções.

### 5.7. Refinamento dos Accordions com Chevron Rotativo
- O toggle atual utiliza caracteres ASCII estáticos `content: "+"` e `content: "−"`.
- Devido a diferenças métricas entre as fontes, o caractere salta na vertical ao ser clicado, e em telas estreitas quebra linha de forma irregular.
- **Substituição por Chevron SVG Rotativo**:
  Um ícone de seta vetorial que rotaciona 90 graus com transição cúbica suave (`transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)`), eliminando qualquer pulo visual.

### 5.8. Âncoras Copiáveis em Títulos H3 (*Deep-Linking*)
- Adicionar geração automática de atributo `id` nos títulos `h3` durante o parsing de Markdown.
- Ao passar o mouse (`:hover`), exibir um ícone discreto `#` que copia o link permanente diretamente para o clipboard.

### 5.9. Correção de Quebra de Página em Impressão A4
- No bloco `@media print` de `assets/document.css`, adicionar:
  ```css
  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  h2, h3, h4 {
    break-after: avoid;
    page-break-after: avoid;
  }
  ```
  Impede que uma linha de tabela seja dividida horizontalmente entre duas páginas ou que um título fique órfão no rodapé da folha.

---

## 6. Proposta Prática de Melhorias (Plano de Ação Priorizado)

### Pacote 1 — Alta Prioridade & Alto Impacto Visual (Esforço Baixo / Médio)
1. **Reengenharia do `barChart`**:
   - Eliminar a lacuna de 540px posicionando o número dinamicamente (interno em barras longas ou conectado via linha guia pontilhada).
   - Suporte a variantes semânticas de cor (`variant: warning | danger | success | neutral`).
   - Régua com marcações de escala (0%, 25%, 50%, 75%, 100%) e gridlines discretas.
   - Representação elegante de zero através de badge ou texto explícito `0 (nenhum)`.
   - Tooltips nativos via `<title>` e realce `:hover` nas linhas do gráfico.
   - Remoção de `min-width: 32rem` nas tabelas de 2 colunas do gráfico.
2. **Tipografia e Leitura**:
   - Conter parágrafos e listas em `max-width: 76ch`.
   - Adotar pilha de fontes de sistema universais e ativar números tabulares (`tabular-nums`).
   - Chevron vetorial rotativo substituindo o `+`/`−` nos accordions.
3. **Tabelas e Navegação**:
   - Ativação do `th sticky` adicionando `max-height: min(72vh, 680px)` e `overscroll-behavior: contain` em `.table-wrap`.
   - Sincronização automática de scroll da sidebar com a seção ativa.
   - Proteção contra quebra de linhas de tabela em impressão A4 (`tr { break-inside: avoid }`).

### Pacote 2 — Ferramentas de Produtividade & Inspeção Técnica (Esforço Médio)
1. **Modal de Diagramas Aperfeiçoado**:
   - Controles de Zoom (`+`, `−`, `100%`) e Ajuste à Janela (`Fit`).
   - Botão de exportação offline direta ("Baixar SVG").
   - Scroll shadows no container `.diagram-scroll` para indicar visualmente que o diagrama transborda lateralmente.
2. **Syntax Highlighting Estático no Build**:
   - Tokenizador no `build.mjs` para SQL, Python, Bash, PowerShell e JSON.
   - Adição de Pill com o nome da linguagem no canto do bloco de código.
3. **Realce de Termos na Busca**:
   - Aplicação dinâmica de `<mark class="search-match">` nos termos encontrados e restauração limpa ao esvaziar o campo.
4. **Deep-linking em H3**:
   - Âncoras `#` copiáveis nos subtítulos.

### Pacote 3 — Evolução Estrutural & Novos Componentes (Próximos Ciclos)
1. **Componente Estruturado `tablemap`**:
   - Visualizador de entidades de dados (grãos, PK/FK, volume e regras de junção), conforme previsto no roadmap original.
2. **Gráfico de Linha (`type: "line"`)**:
   - Para exibição de métricas temporais contínuas.
3. **Refatoração Completa para Suporte a Dark Mode**:
   - Substituição dos 45 códigos hexadecimais literais por variáveis de tema.
   - Adaptação das cores internas dos SVGs gerados para responderem perfeitamente a temas claros e escuros.
