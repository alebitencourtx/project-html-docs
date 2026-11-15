# Análise visual do Streamify e proposta de evolução do desenho de solução

| Campo | Conteúdo |
|---|---|
| Skill analisada | `project-html-docs` |
| Documento principal | `C:\Users\alebi\Downloads\teste doc\docs\documentacao.html` |
| Insumos examinados | `document.json`, `content.md` e `documentacao.validation.json` do documento; `SKILL.md`, `references/`, `scripts/`, `assets/`, `tests/`, `examples/` e relatórios anteriores da skill |
| Referência estética | Imagem “Fluxo dos dados” anexada à solicitação |
| Escopo | Experiência **desktop**, com prioridade no desenho de solução/arquitetura |
| Fora do escopo | Visão mobile e impressão/PDF |
| Natureza | Análise e propostas; **nenhum código, HTML, JSON, manifesto, conteúdo de entrada ou teste foi alterado** |

---

## 1. Resumo executivo

A skill já produz uma documentação com aparência profissional. A identidade visual é sóbria, a hierarquia das seções é clara, os cartões iniciais funcionam bem no desktop e a leitura textual é confortável. **Não recomendo uma reformulação geral do shell, das cores ou da tipografia.**

O problema está concentrado no componente mais importante para comunicar a arquitetura: o desenho de solução. Apesar do título “Arquitetura da Solução em Matriz 2D”, o SVG do Streamify não apresenta uma matriz compacta. O motor de layout posicionou o segundo estágio principalmente **à direita** do primeiro, produzindo um fluxo muito largo, com percurso difícil de compreender e dependência de rolagem horizontal.

A referência anexada é mais eficaz porque combina:

- visão completa em um retângulo horizontal moderado;
- coluna de entradas e estágios visualmente contidos;
- títulos de estágio curtos, acompanhados de uma explicação secundária;
- nós alinhados em uma grade previsível;
- diferença visual entre processos, bases, resultados e fluxos de controle;
- legenda e observações integradas à composição.

**Recomendação central:** adotar esse modelo como padrão visual de “desenho de solução”, mas não depender somente de instruções textuais para que Mermaid/ELK descubra o layout. No curto prazo, o diagrama do Streamify deve ser reescrito e seu estilo refinado. Como evolução estrutural, recomendo um componente declarativo `solution`, com posição lógica em grade, tipos semânticos de nó e validação do SVG final. Mermaid continuaria adequado para ER, sequências e fluxos simples.

A prioridade não é adicionar decoração. É melhorar **composição, hierarquia, densidade e semântica visual**.

---

## 2. Método e evidências

Foram usados leitura do código da skill, inspeção do documento em Chromium, medições do DOM e do SVG, comparação com o artefato anterior do Streamify e análise visual da referência anexada. Não houve rebuild nem alteração dos artefatos.

### 2.1. Fatos observados no documento principal

| Evidência | Resultado | Consequência visual |
|---|---:|---|
| `viewBox` do desenho de solução | `2771,73 × 519` | Proporção de aproximadamente **5,34:1**, muito mais larga que a referência |
| Largura efetivamente renderizada | **2.869 px** | A visão geral não cabe na área útil de um desktop convencional |
| Largura registrada como natural pelo builder | **3.187,49 px** | O acréscimo fixo de 15% agrava o problema em vez de corrigi-lo |
| Área útil calculada pelo CSS em viewport de 1440 px | Aproximadamente **981 px** | Quase dois terços do desenho ficam fora da primeira vista |
| Posição do Estágio 1 | `x=72`, `y=218`, largura `965` | Primeira faixa relativamente compacta |
| Posição do Estágio 2 | `x=1116`, `y=335`, largura `1.634` | Começa depois do fim horizontal do primeiro; não forma dois andares alinhados |
| Posição das entradas | `x=376`, `y=22`, largura `420` | Ficam acima do Estágio 1, e não em uma coluna lateral clara como na referência |
| Modal de ampliação | `2.869 px` de conteúdo para `794 px` úteis na medição | “Ampliar” apresenta outro recorte do mesmo fluxo, não uma visão integral |
| Referências de marcadores no modal | Nenhuma quebrada | A correção anterior das setas funciona; não deve ser repetida como novo problema |

### 2.2. O recibo estrutural não detecta o problema

O recibo informa `passed: true`, três diagramas e dois gráficos, mas mantém `browserReviewed: false`. Isso é coerente com o contrato atual: IDs, recursos e estrutura podem estar válidos enquanto a composição visual continua inadequada.

O caso comprova que **“passou na validação” não é evidência de boa arquitetura visual**. Falta um orçamento de composição e uma revisão desktop com critérios objetivos.

### 2.3. Os dois extremos demonstram a fragilidade do mecanismo atual

O artefato anterior em `outputs/streamify/documentacao.html` contém outro desenho, com `viewBox` de aproximadamente `627 × 2050`: uma torre vertical. O documento solicitado em Downloads corrige esse extremo, mas vai para o oposto: uma faixa muito larga.

São artefatos diferentes, com tempos de build diferentes; o documento de Downloads foi sempre a fonte principal desta análise. A comparação serve apenas para mostrar que **alternar `TD`, `LR`, `subgraph` e instruções mais enfáticas não garante o resultado desejado**.

---

## 3. O que já funciona bem e deve ser preservado

1. **Identidade visual consistente.** Azul-petróleo, superfícies claras e bordas discretas combinam com documentação técnica.
2. **Boa hierarquia editorial.** Numeração das seções, títulos, badges de audiência e tipografia formam uma navegação previsível.
3. **Hero e cartões no desktop.** Em 1440 px, os quatro cartões ficam equilibrados e comunicam rapidamente tecnologias e entregas.
4. **Largura de leitura.** O limite de `76ch` para parágrafos e listas já evita linhas excessivamente longas.
5. **Conteúdo progressivo.** Seções recolhíveis, busca e referências são úteis sem exigir backend.
6. **HTML único e SVG offline.** A solução proposta deve manter essa propriedade, sem CDN, imagens remotas ou runtime externo.
7. **Ampliação tecnicamente íntegra.** As setas permanecem no modal; o problema atual é composição e enquadramento, não perda dos marcadores.

As melhorias, portanto, devem ser cirúrgicas. Não há justificativa para trocar o tema, adicionar gradientes, criar sombras fortes ou transformar o documento em um dashboard.

---

## 4. Comparação direta com a referência

| Dimensão | Streamify atual | Referência anexada | Mudança desejada |
|---|---|---|---|
| Enquadramento | Faixa muito larga, parcialmente fora da tela | Composição completa em retângulo moderado | Caber na área útil desktop sem reduzir o texto |
| Organização | Estágio 2 deslocado para a direita | Andares e regiões com limites claros | Grade explícita e alinhamento das faixas |
| Leitura | Percurso longo, com conexões entre regiões distantes | Poucos percursos principais e contratos claros | Priorizar o caminho dos dados |
| Títulos de estágio | Longos e predominantemente em caixa alta | Título curto + frase secundária | Separar nome, regime e frequência |
| Nós | Tecnologia e detalhes competem na mesma hierarquia | Ação/objeto em destaque e metadados discretos | Tipografia em dois níveis |
| Sequência | Dez elementos numerados, incluindo fontes e stores | Numeração concentrada nas ações | Numerar somente passos reais |
| Controle × dados | Orquestrador participa da mesma cadeia visual | Controle e leituras auxiliares têm traço próprio | Separar arestas por significado |
| Formas | Estilo global praticamente uniforme | Processos, stores e resultados diferenciados | Taxonomia por papel |
| Legenda | Fora da moldura e genérica | Integrada e relacionada a cor/forma/linha | Correspondência 1:1 com o desenho |
| Observações | Texto posterior à figura | Notas associadas à própria composição | Rodapé visual único |
| Ampliação | SVG natural ainda mais largo que a janela | A visão principal já é compreensível | Modal como apoio, não como correção |

A principal lição da referência não é “usar vermelho e azul”. É **controlar o layout e dar significado consistente a cada recurso visual**.

---

## 5. Diagnóstico das causas na skill

### 5.1. A “matriz 2D” existe nas instruções, não no resultado

O código de autoria em `content.md:58-91` declara entradas e dois estágios, mas Beautiful Mermaid/ELK decide as posições finais. `flowchart TD` e `direction LR` dentro de `subgraph`s não constituem um contrato de grade.

A política atual avalia principalmente a sintaxe de origem: proíbe `flowchart LR` contínuo com mais de três nós e prescreve nomes de grupos e uma proporção ideal. Ela não verifica a geometria produzida.

Há inclusive um contraexemplo no próprio projeto: o Admin Metrics contém um `flowchart LR` compacto, com cerca de 816 px de largura natural, adequado a uma visão desktop. Logo, **horizontal não é sinônimo de ruim, assim como `TD` não é sinônimo de bidimensional**.

### 5.2. Excesso de largura é tratado como exibição, quando nasce no layout

Em `scripts/build.mjs:81-84`, diagramas não-ER recebem fator `1,15`, `width` fixa e `min-width` de 90% desse valor. No Streamify, isso resulta em `min-width: 2869px`.

Rolagem local, sombras laterais e modal ajudam a inspecionar mapas grandes, mas não transformam um fluxo extenso em uma boa visão geral. Aplicar somente `width:100%`, `max-width` ou `scale()` produziria o efeito oposto: tudo caberia, mas com tipografia microscópica.

A sequência correta é: **simplificar e organizar primeiro; dimensionar depois; ampliar apenas como conveniência.**

### 5.3. A visão principal mistura perguntas diferentes

O desenho reúne dez elementos numerados, duas cadências, catálogo, orquestrador, staging, modelagem, produção e BI. Ao mesmo tempo, já existe uma seção específica para o ciclo do Airflow.

Isso produz:

- um estágio com cinco nós em sequência;
- títulos como “ORQUESTRAÇÃO EM LOTE, DW & BI”;
- fontes e armazenamentos numerados como se fossem ações temporais;
- mistura entre fluxo físico e controle de execução.

Uma solução mais legível deveria separar quatro vistas conforme a necessidade do projeto:

1. **Contexto:** entradas, plataforma e consumidores.
2. **Arquitetura:** componentes, fronteiras e stores.
3. **Fluxo de dados:** transformações e contratos persistidos.
4. **Execução:** triggers, ordem, decisões e recuperação.

Nem todo projeto precisa das quatro figuras. O que se deve evitar é responder a todas essas perguntas em um único “diagramão”.

### 5.4. A hierarquia tipográfica dos nós é insuficiente

No nó inspecionado, título e segunda linha aparecem no mesmo `<text>`, com `13px` e peso `500`; o `<small>` autoral vira apenas outro `tspan`, sem classe semântica. Assim, a diferenciação prometida pelas instruções não se concretiza de forma confiável.

Além disso, os `g.node` são irmãos dos `g.subgraph`, não descendentes deles. Regras que pressupõem aninhamento podem atingir apenas o cabeçalho do grupo. Seletores baseados em `data-id`, caixa de caracteres e `rect:nth-of-type(...)` tornam o resultado sensível a nomes e à estrutura interna do renderer.

### 5.5. A moldura e a legenda não formam uma unidade

O builder fecha o `<figure>` antes da `.figure-legend` escrita no Markdown. A legenda fica fora da moldura e não acompanha naturalmente uma futura exportação.

Também há uma distinção importante entre os artefatos:

- o documento principal usa classes `badge-danger`, `badge-info` e `badge-neutral`, para as quais existe estilo;
- o artefato anterior em `outputs/streamify` usa `legend-async`, `legend-storage` e `legend-sync`, sem regras de cor correspondentes no CSS atual.

Isso revela uma convenção frágil entre documento, referências e CSS. A solução não deve ser apenas adicionar mais classes, e sim fazer com que a legenda seja gerada a partir dos mesmos tipos semânticos usados pelos nós e arestas.

### 5.6. O título descreve a técnica, não a informação

“Arquitetura da Solução em Matriz 2D” e “SVG · diagrama vetorial” enfatizam implementação e formato. Para o leitor, **“Fluxo ponta a ponta dos dados”** é mais útil. Na referência, o título antecede o desenho e tem presença visual; no HTML atual, o `figcaption` aparece depois, em `12px` e cor atenuada.

---

## 6. Modelo visual proposto

### 6.1. Estrutura da figura

A composição recomendada possui quatro regiões:

1. **Cabeçalho:** título informativo e ação discreta “Ampliar”.
2. **Canvas:** entradas laterais, estágios alinhados e consumo final.
3. **Legenda:** dentro da figura, explicando somente os sinais realmente usados.
4. **Nota:** cadência, escopo e indicação do que foi deixado para as figuras de detalhe.

Para o desenho de solução, adotar uma grade com:

- coluna de entradas à esquerda;
- duas ou três faixas funcionais com limites horizontais próximos;
- até quatro nós de leitura principal por faixa;
- saídas/consumidores claramente identificados;
- arestas ortogonais, com rótulos curtos e sem cruzamentos ambíguos.

Como alvo inicial para esse arquétipo, não como lei universal:

| Propriedade | Meta para desktop de 1440 px |
|---|---|
| Largura do SVG | Aproximadamente **900–1.000 px** |
| Altura do SVG | Aproximadamente **480–650 px** |
| Proporção | Preferencialmente **1,5:1 a 2,1:1**, ajustada ao conteúdo |
| Título de nó | `13–14px`, peso `600`, cor neutra |
| Subtítulo de nó | `11–12px`, peso `400`, cor atenuada |
| Título de estágio | `12px`, peso `700`, cor da categoria |
| Subtítulo de estágio | `11px`, peso `400`, sem caixa alta |
| Nós por faixa | Idealmente 3–4; simplificar ou detalhar quando exceder |

Esses números são um **orçamento de design a validar**, não uma nova proibição rígida. ERs e diagramas naturalmente verticais devem ter outro envelope.

### 6.2. Aplicação conceitual ao Streamify

Uma visão geral mais próxima da referência poderia conter:

| Região | Conteúdo principal |
|---|---|
| Entradas | **Eventsim** e **Catálogo de apoio**, sem numeração |
| Estágio 1 — **Ingestão contínua** | `① Kafka` → `② Spark Streaming` → **GCS / Parquet** |
| Contrato entre regimes | **GCS / Parquet** como store visível; leitura pela carga horária em aresta sólida |
| Estágio 2 — **Transformação analítica** | `③ Carga horária` → `④ dbt` → **BigQuery Production** |
| Consumo | **Looker Studio**, com forma/papel de consumidor |
| Controle | “Airflow · DAG horária · minuto 05” no subtítulo do Estágio 2; detalhes dos operadores na figura específica |
| Dados auxiliares | Catálogo → dbt, com aresta de dados de referência devidamente identificada |

Nesse modelo:

- GCS e BigQuery são armazenamentos, não “passos” equivalentes a Spark e dbt;
- Airflow caracteriza o controle do estágio, sem inflar a cadeia física principal;
- staging e dados de apoio continuam representados, mas com menos competição visual;
- “External Table”, criação/drop e ordem dos operadores permanecem na seção de orquestração;
- a figura responde primeiro **o que entra, quais regimes existem, qual contrato os conecta e o que é consumido**.

### 6.3. Linguagem visual

Reutilizar a base cromática que já existe, com alguns ajustes:

- canvas neutro e estágios em tons pastel;
- títulos de nó neutros, sem colorir todo o texto pela cor do estágio;
- contornos um pouco mais perceptíveis que `#cbd5e1`, sem sombras pesadas;
- processos retangulares discretamente arredondados;
- stores com forma própria e/ou etiqueta “store”;
- entradas e consumidores diferenciados por forma e texto, não apenas cor;
- dados em linha sólida; controle em linha tracejada; telemetria em padrão separado quando existir;
- vermelho usado com cautela: na linguagem dos gráficos ele já significa `danger`, portanto não deve sugerir incidente em uma esteira saudável sem explicação.

---

## 7. Melhorias propostas na skill

### 7.1. Correção imediata do padrão atual — prioridade P0

Esta etapa melhora o documento sem exigir a substituição completa do renderer.

1. **Reescrever a arquitetura principal do Streamify** conforme a decomposição da seção 6.2, olhando o SVG final e não apenas o Mermaid.
2. **Encurtar títulos de estágio e nós** e numerar somente ações de execução.
3. **Criar hierarquia real para título/subtítulo** no pós-processamento do SVG, usando classes explícitas; não depender genericamente de `tspan:last-child`.
4. **Restringir regras de arquitetura ao tipo de figura correto**, evitando que o estilo global de `g.node` neutralize todos os papéis e contamine outros tipos de diagrama.
5. **Eliminar o multiplicador arbitrário de 15% para overviews de solução.** Não substituí-lo por redução automática indiscriminada: se exceder o orçamento, o autor deve reorganizar o desenho.
6. **Integrar título, canvas, legenda e nota ao mesmo `<figure>`** e remover o ruído “SVG · diagrama vetorial” da posição de destaque.
7. **Adicionar “Ajustar à janela” e “100%” no modal**, abrindo inicialmente a visão inteira quando isso mantiver o texto legível.
8. **Padronizar IDs, classes de legenda e referências**, validando que cada estilo esperado realmente casa com um elemento do SVG.

**Limite desta etapa:** Mermaid/ELK continuará tendo liberdade de layout. Por isso, o aceite visual obrigatório é indispensável.

### 7.2. Componente estruturado `solution` — prioridade P1

Para obter repetibilidade próxima da referência, criar um fence `solution` com especificação JSON, de forma semelhante ao componente `chart` já existente.

O contrato deve representar:

| Campo conceitual | Finalidade |
|---|---|
| `view` | Distinguir `context`, `architecture`, `data-flow` e `execution` |
| `title`, `caption` | Explicar a pergunta respondida pela figura |
| `grid` / `stages` | Declarar faixas, ordem, limites e alinhamento |
| `nodes[]` | `id`, `label`, `subtitle`, `type`, `row`, `column` e `step` opcional |
| `edges[]` | `from`, `to`, `label` e `type` (`data`, `control`, `reference`, `telemetry`, `exception`) |
| `legend` / `notes` | Gerar explicações a partir das mesmas categorias usadas no grafo |
| `sources` opcionais | Relacionar elementos a evidências quando necessário |

O build calcularia posições em pixels e rotas ortogonais, gerando **SVG determinístico, autocontido e sem JavaScript de runtime**. A autoria informaria coordenadas lógicas de grade, não coordenadas em pixels.

Tipos sugeridos: `source`, `ingest`, `process`, `store`, `control`, `contract`, `consumer` e `telemetry`. Cada tipo deve combinar pelo menos dois sinais, como cor + forma, ou cor + etiqueta.

Mermaid deve permanecer para compatibilidade e diagramas simples. O componente novo é justificado pela necessidade demonstrada de **posicionamento previsível, semântica e legenda coerente**, não por preferência estética isolada.

### 7.3. Revisão das instruções de autoria

Arquivos: `SKILL.md`, `references/authoring.md` e `references/data-engineering.md`.

Recomenda-se:

- manter a cautela contra correntes horizontais extensas;
- retirar a proibição absoluta baseada apenas em `LR` e quantidade de nós;
- substituir a proporção obrigatória de 2:1–3:1 por envelopes por tipo de figura;
- exigir distinção entre arquitetura, dados e execução;
- exigir inspeção do SVG renderizado no desktop;
- proibir arestas invisíveis e nós fictícios usados apenas para “empurrar” o layout;
- orientar overview + detalhe quando houver excesso de componentes;
- incluir um exemplo completo baseado na referência, com títulos, nós, arestas, legenda e nota.

### 7.4. Validação e testes

Arquivos: `scripts/validate.mjs`, `tests/build.test.mjs` e novos fixtures de solução.

Adicionar:

- fixture canônico de `solution` com resultado determinístico;
- orçamento de dimensões para o arquétipo de overview;
- verificação de classes/tipos e correspondência da legenda;
- verificação de IDs, referências e permanência das setas;
- revisão desktop em 1440 × 900 com captura de referência;
- checagens de posição: Estágio 2 abaixo, e não à direita, quando esse for o layout declarado;
- inspeção de clipping e sobreposição de textos e arestas em navegador;
- teste que impeça seletores sem correspondência no SVG real.

Testes estruturais devem continuar rápidos. A suíte visual pode ser opcional para autoria, mas precisa ser executada antes de publicar mudanças no design system.

### 7.5. Governança dos artefatos

`SKILL.md` e `CHANGELOG.md` apresentam o padrão como 1.2.0, enquanto `package.json`, meta tags e recibos ainda identificam 1.1.0. Ao implementar as propostas, alinhar versão, exemplos e outputs regenerados para evitar dúvida sobre qual CSS/JS produziu cada documento.

---

## 8. Melhorias visuais secundárias para desktop

Estas melhorias são úteis, mas não devem competir com o desenho de solução.

| Prioridade | Melhoria | Justificativa |
|---|---|---|
| P1 | Moldura de figura com título superior, canvas e legenda integrados | Melhora todas as figuras e aproxima a composição da referência |
| P1 | Modal com ajuste e retorno a 100% | Melhora a inspeção sem usar zoom como substituto do layout |
| P2 | Rótulo de linguagem e syntax highlighting estático nos blocos de código | Hoje há espaço superior reservado e código predominantemente monocromático |
| P2 | Realce dos termos encontrados pela busca | Reduz o esforço para localizar o trecho dentro de seções longas |
| P2 | `aria-label` específico nos botões, como “Ampliar: Fluxo dos dados” | Diferencia ações repetidas na mesma página |
| P2 | Exportação de SVG somente após incorporar estilos, título e legenda | `outerHTML` sozinho não preserva necessariamente a aparência final |

Não recomendo priorizar dark mode, novos gráficos, efeitos decorativos ou reorganização do hero nesta frente.

---

## 9. Plano de execução sugerido

| Etapa | Entrega | Impacto | Esforço |
|---|---|---:|---:|
| **P0 — Streamify e estilo atual** | Overview compacto, hierarquia de nós, figura integrada, convenções de legenda e modal com ajuste | Muito alto | Baixo–médio |
| **P1 — Guias e proteção visual** | Novas diretrizes, exemplo canônico, orçamento desktop e testes do SVG real | Alto | Médio |
| **P1 — Componente `solution`** | Renderer declarativo de grade, tipos semânticos e legenda derivada | Muito alto | Médio–alto |
| **P2 — Experiência complementar** | Código destacado, busca com realce, nomes acessíveis e exportação consistente | Médio | Médio |

O componente estruturado pode ser implementado depois da correção imediata, mas o exemplo canônico e os critérios de aceite devem nascer antes, para que ambos usem a mesma referência visual.

---

## 10. Critérios objetivos de aceite no desktop

Para o desenho de solução do Streamify:

1. Em **1440 × 900**, o overview aparece completo sem rolagem horizontal no canvas e sem reduzir o zoom do navegador.
2. O Estágio 2 é percebido abaixo do Estágio 1, com faixas alinhadas; não começa à direita do fim do primeiro.
3. Títulos e subtítulos são visualmente distintos e nenhum texto é cortado.
4. O leitor identifica entradas, dois regimes de processamento, o contrato entre eles e o consumo final sem percorrer toda a página.
5. Apenas ações recebem numeração; fontes, stores e consumidores têm papel visual próprio.
6. Arestas de dados, controle e referência possuem convenções distintas quando presentes.
7. Não há arestas cruzando nós ou rótulos de forma ambígua.
8. Cada entrada da legenda corresponde a um sinal do desenho, e cada sinal significativo tem explicação textual.
9. Título, figura, legenda e nota são percebidos como uma única composição.
10. O modal permite visão inteira e retorno a 100%; setas e marcadores continuam íntegros.
11. O HTML permanece único, offline e sem dependência de runtime Mermaid.
12. A revisão visual realizada é registrada separadamente; `passed: true` estrutural não é apresentado como aprovação estética.

---

## 11. O que não recomendo

- **Somente reduzir o SVG por CSS.** Isso resolve enquadramento destruindo a legibilidade.
- **Somente aumentar o modal ou adicionar scroll.** Isso facilita navegar pelo problema, sem corrigi-lo.
- **Adicionar mais regras verbais rígidas ao prompt.** O documento atual já demonstra que intenção textual não determina geometria.
- **Proibir todo `flowchart LR`.** Há fluxos horizontais compactos e adequados no próprio projeto.
- **Criar nós ou links invisíveis para enganar o autolayout.** O grafo deixa de representar apenas a solução e fica mais frágil.
- **Usar a imagem anexada como PNG permanente.** O valor da referência está no modelo de composição; o produto final deve continuar vetorial e pesquisável.
- **Adicionar logos, ilustrações, gradientes ou sombras fortes.** Isso aumenta custo visual sem melhorar a compreensão.
- **Numerar todos os elementos.** Numeração deve indicar execução, não servir apenas como decoração.
- **Confundir cor operacional com cor arquitetural.** `danger`, `warning` e `success` não são uma taxonomia suficiente para componentes.

---

## 12. Conclusão

A base visual do HTML é boa e deve ser preservada. O salto de qualidade esperado virá de transformar o desenho de solução em uma **visão compacta, hierárquica e semanticamente controlada**, semelhante à referência anexada.

A correção mais importante não é trocar uma paleta nem escolher outra direção Mermaid. É fazer a skill controlar aquilo que hoje fica ao acaso: **posição dos estágios, densidade dos nós, hierarquia dos textos, significado das arestas e integração da legenda**.

O caminho recomendado é corrigir imediatamente o Streamify e os padrões frágeis de CSS/autoria e, em seguida, consolidar esse aprendizado em um componente `solution` determinístico, mantendo Mermaid para os casos em que ele funciona bem.
