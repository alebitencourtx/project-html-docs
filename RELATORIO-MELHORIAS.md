# Relatório consolidado de melhorias e bugs — `project-html-docs`

| Campo | Conteúdo |
|---|---|
| Versão analisada | 1.0.0 (`package.json`) |
| Data | 14/11/2026 |
| Escopo | `SKILL.md`, `references/`, `schemas/`, `scripts/`, `assets/`, `tests/`, `examples/` e `outputs/` |
| Base | Duas análises independentes consolidadas, código-fonte, build, navegador, medições e testes |
| Documentos observados | Data Master Santander (`7f06bcb`, 12 seções, 8 diagramas) e Admin Metrics (15 seções, 7 diagramas) |
| Natureza | Relatório técnico; nenhuma alteração de código foi feita para produzi-lo |

---

## 1. Sumário executivo

A skill está sólida para o propósito: contrato de autoria claro, build determinístico, HTML único e offline, validação estrutural, exemplos e testes. Não há falha que impeça gerar um documento completo.

A consolidação das duas análises resultou em **15 defeitos priorizados**, sendo **1 de impacto alto**, **5 médios** e **9 baixos**, além de **5 lacunas de ciclo de vida/validação**, **6 oportunidades de expressividade** e **7 melhorias de UX/acessibilidade**. O achado mais grave é a ampliação de diagramas perder as setas; a lacuna mais estratégica é a ausência de verificação de documento desatualizado.

| Categoria | Destaque |
|---|---|
| Correção | Modal sem setas, busca sem restauração de estado, tabelas comprimidas no estreito |
| Dados | Inventário perde 7 de 17 fontes no Data Master |
| Ciclo de vida | Sem `verify` de fontes/revisão e sem registro de revisão humana |
| Expressividade | Falta mapa de tabelas/junções, gráfico de linha, schema e conteúdo multiarquivo |
| UX/acessibilidade | Sticky headers, syntax highlighting, âncoras H3, tabelas com `scope` |
| Build | `build.mjs` monolítico, IDs dependentes de ordem, sem cache nem watch |

---

## 2. Método e níveis de evidência

Cada achado foi classificado pelo método usado, para não confundir observação com hipótese:

| Nível | Significado |
|---|---|
| **Navegador** | Reproduzido no documento gerado, com medição ou interação real |
| **Código** | Confirmado por leitura do caminho de execução |
| **Visual** | Observado em captura em 1440 px ou 390 px |
| **Medido** | Obtido por `getBBox`, contagem de DOM ou recibo de build |
| **Inferido** | Derivado de CSS/cálculo, sem renderização final (ex.: impressão) |

Algumas hipóteses levantadas na análise inicial foram **descartadas** e outras **corrigidas** após verificação. Elas estão registradas na seção 12 para preservar a rastreabilidade.

---

## 3. Defeitos confirmados

| ID | Achado | Severidade | Método |
|---|---|---|---|
| C1 | Modal de diagrama perde as setas | **Alta** | Navegador |
| C2 | Busca não restaura o estado das seções | Média | Código |
| C3 | Tabelas comprimem em vez de rolar no estreito | Média | Visual |
| C4 | Inventário ignora `.sh` e `.txt` | Média | Medido |
| C5 | Gráfico reduz rótulos no estreito | Média | Inferido |
| C6 | Rótulos longos de gráfico são cortados no limite | Baixa | Medido |
| C7 | Pluralização da busca | Baixa | Navegador |
| C8 | Foco não retorna ao botão do modal | Baixa | Navegador |
| C9 | Recibo conta referências como seção | Baixa | Medido |
| C10 | Versão fixa em dois pontos do build | Baixa | Código |
| C11 | Rolagem suave em saltos muito longos | Baixa | Visual |
| C12 | Barra de valor zero ambígua | Baixa | Visual |
| C13 | Impressão comprime diagramas largos | Média | Inferido |
| C14 | `style` inline não é validado | Baixa | Código |
| C15 | Classes autorais podem colidir com o shell | Baixa | Código |

### C1 — Modal perde as setas

`assets/document.js` clona o SVG e remove todos os `id`:

```js
svg.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
```

As referências `marker-end="url(#diagram-1-arrowhead)"` permanecem. No Data Master, o diálogo ficou com **2 `<marker>`, 0 IDs e 11 referências quebradas**. As setas desaparecem ao ampliar. O mesmo risco vale para gradientes, filtros e `clipPath`.

**Correção:** aplicar prefixo novo aos IDs do clone e reescrever `url(#...)`, ou usar IDs únicos com sufixo do diálogo.
**Aceite:** todas as referências `url(#...)` do SVG ampliado resolvem; setas visíveis.

### C2 — Busca não restaura o estado

`assets/document.js` força `s.open = true` em todas as seções e `details` encontrados. Ao limpar o campo, não há restauração: seções que estavam recolhidas permanecem abertas.

**Correção:** guardar o estado `open` antes do primeiro filtro e restaurar ao esvaziar a busca.
**Aceite:** recolher tudo → buscar → limpar → tudo continua recolhido.

### C3 — Tabelas comprimem no estreito

`.table-wrap` tem `overflow:auto`, mas `table{width:100%}` sem largura mínima. Em 390 px, colunas com termos técnicos se comprimem a uma ou duas palavras por linha. A rolagem horizontal só aparece quando o conteúdo a força.

**Correção:** `min-width` por tabela (ou derivado do número de colunas), cabeçalho fixo e indicação visual de rolagem.
**Aceite:** tabela de 3+ colunas rola horizontalmente; colunas não viram coluna de uma palavra.

### C4 — Inventário ignora `.sh` e `.txt`

`scripts/inspect_repo.py` não inclui `.sh` nem `.txt` em `EXTENSIONS`. No Data Master, o inventário listou **10 de 17 fontes**: ficaram de fora **6 scripts `.sh` e o `requirements.txt`** (7 arquivos). O autor só descobre isso lendo o repositório por conta própria.

**Correção:** ampliar extensões, classificar por tipo (`code`, `config`, `schema`, `docs`, `infra`, `notebook`), marcar entrypoints e aceitar `--include/--exclude`. Manter a promessa de não executar código.
**Aceite:** o inventário do Data Master lista 17/17 com classificação.

### C5 — Gráfico reduz rótulos no estreito

O gráfico tem `viewBox` de 880 px, fonte de 15 px e `.chart svg{width:100%}`. Em um contêiner de ~330 px, a escala é ~0,375: os rótulos passam a ~5,6 px efetivos. O SVG continua acessível por nome, mas o texto deixa de ser legível.

**Correção:** largura mínima com rolagem local, ou modo “tabela primeiro” abaixo de 600 px; aumentar a fonte no viewBox estreito; garantir tabela de dados visível (hoje ela fica em `details` recolhido).
**Aceite:** rótulos com pelo menos 12 px efetivos ou tabela legível sem zoom.

### C13 — Impressão comprime diagramas largos

O CSS de print força `width:100%!important; min-width:0!important; max-width:100%!important`. Em A4, a área útil é ~180 mm ≈ 680 px a 96 dpi; um SVG de 1300 px escala para ~0,52, e uma fonte de 15 px vira ~7,8 px. Diagramas largos ficam com rótulos ilegíveis.

**Correção:** usar `max-width:100%` sem forçar `width:100%` para diagramas menores; para os muito largos, página landscape, quebra dedicada ou versão resumida.
**Aceite:** diagramas de até 900 px preservam a largura natural; os maiores têm tratamento explícito.

### Demais defeitos

| ID | Correção proposta | Aceite |
|---|---|---|
| C6 | Calcular `left` do gráfico pelo maior rótulo; limite atual de 45 caracteres corta a partir de ~31 | Rótulos de 45 caracteres não invadem a borda |
| C7 | Singular/plural por idioma: “1 seção encontrada” / “N seções encontradas” | 0, 1 e 2 corretos |
| C8 | Restaurar foco em `requestAnimationFrame` após `close` | Foco no botão de origem |
| C9 | Contar `sections` de conteúdo e `referenceBlocks` separadamente | Data Master: 12 + 1; Admin Metrics: 15 + 1 |
| C10 | Ler versão de `package.json` no `<meta>` e no recibo | Bump reflete no HTML e no recibo |
| C11 | Salto instantâneo para âncoras longas; suave só para ajustes curtos | Clique em seção distante chega imediatamente |
| C12 | Marcador textual ou mínimo visual para zero; remover a pista de barra cheia | Zero distinto de ausência |
| C14 | Escanear `style` inline com a mesma regex de `url()`, permitindo `data:`/`#` | SVG com estilo externo falha |
| C15 | Whitelist de classes autorais, preservando `cards` e `card` | `class="sidebar"` não afeta o shell |

---

## 4. Lacunas de ciclo de vida e validação

### L1 — Não há verificação de documento desatualizado

O recibo grava hashes das fontes e a revisão, mas nada os compara depois; a revisão do manifesto é manual. Um código alterado deixa a documentação silenciosamente velha.

**Proposta:** `scripts/verify.mjs` que recalcula hashes, compara com o recibo, informa fontes alteradas/removidas e revisão atual vs. documentada; `--strict` falha com exit code.
**Aceite:** fonte alterada é detectada; nada alterado retorna “em dia”.

### L2 — O recibo não registra revisão humana

`browserReviewed` é sempre `false`; não há canal para registrar o que foi realmente verificado. A declaração fica só na conversa.

**Proposta:** `documentacao.review.json` opcional com data, viewport, checagens, limitações e ambiente. O build não deve inferir revisão.

### L3 — O validador aceita estruturas incompletas

Não há checagem de:

- tabela com `thead`/`th` e `scope`;
- `details` com `summary`;
- H4 sem H3;
- títulos de seção duplicados;
- link sem texto;
- cerca de código sem linguagem;
- `figure` sem `figcaption`;
- `style` inline com URL externa;
- contagem separada de seções e referências.

**Aceite:** fixtures negativas falham com mensagem específica; o documento atual continua passando.

### L4 — Falta orientação sobre segredos

Projetos documentados podem conter tokens e chaves. A skill orienta não executar código, mas não orienta como mencionar credenciais sem reproduzi-las.

**Proposta:** nunca copiar o valor; descrever local, tipo e necessidade de rotação; não transformar isso em auditoria de segurança.

### L5 — Integridade pós-build

O build grava `sha256` das fontes, mas não há comando para confirmar que os arquivos atuais correspondem ao que foi lido. É o complemento natural do `verify` (L1).

---

## 5. Melhorias de UX e acessibilidade

| ID | Melhoria | Por quê |
|---|---|---|
| U1 | Cabeçalho fixo em tabelas longas | Dicionários de 18+ campos perdem o cabeçalho ao rolar |
| U2 | Syntax highlighting build-time | SQL, Python e PowerShell em monocromia dificultam a leitura |
| U3 | Sidebar: título truncado e metadados fixos | Títulos longos e 15+ seções empurram versão/data para fora |
| U4 | Badge `all` com cor neutra | Hoje `all` e `business` compartilham o mesmo verde |
| U5 | Helper para embutir imagens como data URI | O validador aceita `data:`, mas o authoring não ensina |
| U6 | `caption`/`scope` em tabelas | Acessibilidade de tabela não é verificada |
| U7 | Cópia com `execCommand` e download de código | O clipboard pode ser negado; o fallback atual só seleciona texto |

**Sobre U5:** o authoring **não** menciona capturas de tela; o gap é real, mas a justificativa não é “documentado e não suportado”. Preferir SVG/diagramas quando possível, porque imagens embutidas aumentam o HTML e envelhecem rápido.

**Sobre U3:** o exemplo de título longo precisa ser real; a sidebar mostra `spec.title`, não o subtítulo. A correção é útil para títulos longos, mas o caso não ocorre nos dois outputs atuais.

---

## 6. Expressividade para dados

### E1 — Mapa de tabelas/junções (maior valor)

Um ER Mermaid expressa entidades e cardinalidade, mas não grão, PK composta, condição de junção, filtro de escopo, “view × tabela” nem “sem chave de volta”. É exatamente o que um documento de engenharia de dados precisa.

**Proposta:** bloco `tablemap` com JSON estruturado:

- tabelas: nome, grão, chaves, tipo (`tabela`, `view`, `sintética`), notas;
- relações: origem, destino, cardinalidade, predicado de junção, observação;
- legenda e rodapé de escopo.

Renderização acessível, empilhada no estreito, com tabela equivalente. Nenhuma FK inferida: o predicado é declarado.

### E2 — Gráfico de linha/área

Só existe barra horizontal; a própria `authoring.md` reconhece a limitação para séries. Adicionar `type: "line"` (e opcional `area`), eixo X explícito, unidade, `asOf`, fonte e tabela embutida. Adicionar `basis: configured | observed | illustrative`; `observed` exige `asOf`; `illustrative` renderiza selo.

### E3 — Bloco de schema/dicionário

Schema com objeto, campos (`name`, `type`, `nullable`, `key`, `description`) e agrupamento por tabela; tabela ancorada e pesquisável. Classificações sensíveis só se fornecidas.

### E4 — Fluxo em estágios/swimlanes

Estágios, passos, entradas/saídas, flag de replay e observações datadas; fallback vertical no estreito. Mermaid continua para diagramas simples.

### E5 — Conteúdo por seção

Permitir `sections[].content` ou `includes`, mantendo `content` único como compatível. Um `content.md` de 40 KB funciona, mas revisões e autoria paralela sofrem. A orientação deve ser estrutural, não um limite arbitrário de KB.

### E6 — Âncoras e sumário de H3

Slug único para H3/H4, “Nesta seção” e deep links. Um mini-TOC resolve navegação, mas sem IDs não há link direto para a subseção.

### Cuidado com `dataAsOf`

`dataAsOf` é opcional e distinto de `updated`. Exigir o campo só porque o documento tem seções técnicas gera falso positivo nos dois outputs. A regra correta é exigir `asOf` em gráficos/cards com dados observados (`basis: observed`), não por audiência.

---

## 7. Build, testes e documentação

### Build

- **B1:** dividir `build.mjs` em `render/chart`, `render/mermaid`, `render/shell`, `render/tablemap`; o arquivo tem 68 linhas densas e um template de ~20 linhas em uma única expressão.
- **B2:** IDs de diagrama derivados do título (hash), não da ordem; adicionar um diagrama não deve mudar o hash dos demais.
- **B3:** cache de SVG Mermaid por hash da fonte.
- **B4:** `--watch` e `--serve` locais, apenas para autoria.
- **B5:** erro amigável para Node < 22 e dependências ausentes.
- **B6:** versão lida de `package.json` (C10).
- **B7:** manter CSS/JS em fonte legível; minificação é opcional e não deve complicar o build.
- **B8:** minificação **não** é prioridade; o HTML é dominado por conteúdo e SVGs, e o CSS já é compacto.

### Testes

Cobrir o que hoje não é testado:

- manifesto: ID duplicado, fonte desconhecida, fonte fora do repositório, seção duplicada;
- validador: tabela sem cabeçalho, `details` sem `summary`, H4 órfão, link vazio, `style` inline;
- gráfico: 40+ categorias, rótulo > 45, `asOf` ausente em `observed`, zero;
- tablemap/linha: renderer e fallback;
- JS puro: normalização de busca, pluralização, restauração de estado, reescrita de IDs no modal;
- determinismo: build duas vezes gera os mesmos bytes;
- Windows/UTF-8;
- `inspect_repo.py` com fixture que inclua `.sh` e `.txt`.

Testes visuais com Playwright/axe podem existir como `test:visual` opcional, nunca como dependência do build.

### Documentação

- Exemplo mínimo mais realista: `repoRoot`, `sources`, cards, um ER, um chart com `asOf`, `details` e tablemap.
- Segundo exemplo de pipeline de dados com grão, watermark, merge e runbook.
- Receitas por arquétipo: pipeline, serviço/API, CLI/biblioteca, monorepo.
- Checklist de atualização: diff das fontes, reler código alterado, atualizar revisão, rebuild, reverificar, declarar o que não foi verificado.
- Guia de estilo: regras com exemplo, limites sem linguagem de auditoria, definição dos públicos.
- Troubleshooting: erro de Mermaid, caminho relativo, PowerShell/UTF-8, guarda de sobrescrita.
- Interpretação do recibo e do futuro `review.json`.

---

## 8. Prioridades

### Top 10 consolidado

1. **C1** — corrigir IDs no modal (setas e gradientes).
2. **L1** — `verify` de fontes e revisão.
3. **C4** — ampliar `EXTENSIONS` do inventário.
4. **C2/C7** — busca: estado, plural e snippets.
5. **C3/U1** — `min-width` em tabelas + sticky header.
6. **C13** — dimensionamento de SVG no print.
7. **C5/C6/C12** — gráfico: estreito, `left` dinâmico e zero.
8. **C9/C10/L2** — recibo: contagem, versão, `builtAt`, revisão.
9. **C14/C15/L3** — validação de `style`, classes e tabelas.
10. **E6/U2** — âncoras H3 + mini-TOC e syntax highlighting.

**E1 (tablemap)** entra como item estratégico seguinte; é a melhoria de maior valor para documentação de dados, mas exige renderer, CSS responsivo, schema e testes.

### Matriz de prioridade

| Prioridade | Itens | Impacto | Esforço |
|---|---|---|---|
| P0 — correção e confiança | C1, L1, C4, C2/C7, C9/C10, L3 | Alto | Baixo/Médio |
| P1 — experiência imediata | C3/U1, C13, C5/C6/C12, C8, C11, U7 | Médio/Alto | Baixo/Médio |
| P1 — expressividade | E1, E2, E3, E4, E5, E6 | Alto | Médio/Alto |
| P2 — UX e acessibilidade | U1–U7, L3, L5 | Médio | Baixo/Médio |
| P2 — build e testes | B1–B6, testes, docs | Médio | Médio |
| P3 — opcional | B7, exportações, dark mode, ordenação de tabelas | Baixo | Variável |

---

## 9. Roadmap sugerido

### Iteração 1 — Confiança

`verify`, recibo completo, inventário ampliado, regras básicas do validador, correção do modal e da busca.

**Saída:** `npm test` verde; fonte alterada detectada; Data Master inventaria 17/17; modal mantém setas; busca restaura estado.

### Iteração 2 — Leitura e resiliência

Tabelas com `min-width` e sticky header, print, gráfico no estreito, foco, validação de `style`/classes, tabelas com `scope`.

**Saída:** 390 px e A4 legíveis; modal com foco correto; validador rejeita SVG com estilo externo.

### Iteração 3 — Expressividade e escala

Tablemap, gráfico de linha com `basis/asOf`, schema, pipeline, conteúdo multiarquivo, H3 + TOC, syntax highlighting, split do build, cache e testes.

**Saída:** exemplo novo com todos os componentes; build duas vezes idêntico; adicionar diagrama não altera IDs anteriores; 45 caracteres de rótulo sem corte.

---

## 10. Critérios de aceite globais

- `npm test` verde e build reproduzível (mesmos bytes em duas execuções).
- Nenhum recurso externo no HTML; recibo passa.
- Manifestos existentes continuam válidos.
- Inspeção em 1440 px e 390 px sem overflow global, com rolagem local intencional.
- Toda nova capacidade tem exemplo, teste e uma frase sobre o que ela **não** prova.
- Nenhuma informação de negócio inferida a partir de amostra de dados.

## 11. Não objetivos

- Backend, CDN, analytics, wiki ou chamada de modelo em tempo de leitura.
- Inferir donos, SLAs, classificações ou causas.
- Score de maturidade, matriz de severidade ou plano de modernização no documento.
- Documento bilíngue no mesmo arquivo; um idioma por documento continua sendo a regra.
- Tema visual por projeto; a consistência do shell é uma decisão da skill.
- Limites arbitrários de KB ou de número de seções; a correção é estrutural (multiarquivo).
- Minificação como objetivo; o ganho é marginal.
- Playwright/axe obrigatórios para gerar a documentação.
- Substituir a autoria semântica por geração automática de seções.
- Remover categorias ou seções existentes por preferência de estilo; a consolidação preserva o que já funciona.

---

## 12. Anexo — evidências e hipóteses

### Ambiente e medições

| Medição | Resultado |
|---|---|
| Data Master | 12 seções de conteúdo, 8 diagramas, 2 gráficos, 152.511 bytes, revisão `7f06bcb` |
| Admin Metrics | 15 seções de conteúdo, 7 diagramas, 2 gráficos, 141.277 bytes |
| Recibo do Data Master | 13 `doc-section` (12 + referências), 8 diagramas, 2 gráficos |
| Recibo do Admin Metrics | 16 `doc-section` (15 + referências), 7 diagramas, 2 gráficos |
| Testes | `npm test`: 5/5 passando |
| Viewport estreito | iframe de 390 px, cliente 375 px, `scrollWidth` 375 px |
| Overflow global | 0 px |
| Modal | 2 `<marker>`, 0 IDs, 11 referências quebradas |
| Busca | “1 seções encontradas”; “dicionario” sem acento funciona; “xyzabc” sem resultado |
| Expansão | 20 blocos fechados/reabertos corretamente |
| Foco após `Escape` | `BODY` |
| Rolagem de âncora | ~12.700 px em movimento suave |
| Rótulo de 26 caracteres | `x=33`, largura 173, viewBox 880 — **não cortado** |
| Rótulo de 22 caracteres | `x=49..72`, largura 134..157 |
| Impressão (inferida) | SVG de 1300 px em ~680 px úteis: escala 0,52; fonte 15 px → ~7,8 px |

### Hipóteses corrigidas ou descartadas

| Hipótese | Resultado |
|---|---|
| Rótulos de gráfico são cortados a partir de ~18 caracteres | **Corrigida:** 26 caracteres cabem (`x=33`); o corte começa por volta de 31 e é certo em 45 |
| ER com 8+ entidades fica comprimido pelo fator 1,35 | **Corrigida:** o fator aumenta a largura; o risco é rolagem excessiva, não compressão |
| Busca falha se as seções estiverem fechadas | **Descartada:** `textContent` inclui o conteúdo de `<details>` fechados; o DOM está populado |
| `docs/` e `assets/` são pulados pelo inventário | **Descartada:** não estão no `SKIP`; a causa real é `EXTENSIONS` sem `.sh`/`.txt` |
| O authoring menciona capturas de tela | **Descartada:** não há ocorrência de imagem/screenshot/captura em `authoring.md` nem `SKILL.md` |
| `dataAsOf` ausente é omissão em documento com seções técnicas | **Corrigida:** gera falso positivo; exigir `asOf` apenas em dados observados |
| Tabelas no estreito: 24 tabelas, 0 com overflow | **Corrigida:** os 24/0 foram medidos a 855 px; a 390 px observou-se compressão, sem repetir a contagem |
| “9 defeitos confirmados” | **Corrigida:** os achados têm métodos distintos; o relatório agora separa navegador, código, visual, medido e inferido |

### O que não foi verificado

- Caminho de sucesso do clipboard; o fallback de seleção foi confirmado.
- Impressão/PDF renderizado; a análise de print é derivada do CSS e do cálculo de escala.
- Leitores de tela reais; há apenas checagens estruturais de nome acessível.
- Build do Admin Metrics nesta rodada; os números vêm do recibo existente.

### Comandos

```powershell
npm ci --ignore-scripts
npm test
node scripts/build.mjs examples/minimal/document.json --out <saida>.html
node scripts/build.mjs datamaster/docs/document.json --out datamaster/docs/documentacao.html
```
