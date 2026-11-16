## Resumo executivo

O `project-html-docs` é uma skill operacional e um conjunto de scripts que transforma o **estado implementado** de um repositório de software ou de engenharia de dados em um manual técnico e funcional, entregue como **um único arquivo HTML offline**. A proposta não é auditar, modernizar ou redesenhar o projeto: é explicar o que existe, como se conecta, quais regras aplica e como é operado.

O resultado é pensado para dois públicos que normalmente recebem documentos separados: leitores de negócio, que precisam entender propósito, entradas, saídas e limites; e leitores técnicos, que precisam de arquitetura, fluxos, contratos de dados, regras e receitas de execução. A mesma página oferece filtro por perfil de leitura, busca local, dicionários pesquisáveis, diagramas vetoriais e impressão, sem exigir servidor, CDN ou acesso à internet.

<div class="cards">
<div class="card"><h3>Para negócio</h3><p>O que o projeto entrega, quem consome, qual o grão dos dados, quais regras mudam o resultado e quais limites impedem uma leitura incorreta.</p></div>
<div class="card"><h3>Para técnico</h3><p>Componentes, fronteiras, ordem de processamento, decisões, contratos de arquivos, dependências e rastreabilidade entre fonte e afirmação.</p></div>
<div class="card"><h3>Para operação</h3><p>Pré-requisitos, comandos, parâmetros, saídas esperadas, verificação de integridade e recuperação diante de falhas previsíveis.</p></div>
</div>

O fluxo da skill é deliberadamente separado em duas camadas. A primeira é **determinística**: o `inspect_repo.py` varre o repositório, extrai estruturas e monta um dossiê com plano de leitura, sem executar o código e sem consumir tokens de LLM. A segunda é **autoral**: um agente lê as fontes priorizadas, escreve o manifesto e o Markdown, e aciona os renderizadores. O build consolida tudo e o `verify.mjs` confere se as fontes ainda correspondem ao que foi documentado.

> Regra de negócio: documentar significa descrever o comportamento atual e comprovável do projeto. Planos históricos, intenções e metas não substituem a implementação; quando o código não sustenta uma afirmação, ela não deve ser publicada.

> Limitação: o código prova a implementação, não uma execução bem-sucedida em produção. O manual deve declarar essa fronteira sempre que não houver telemetria, artefato de execução ou contexto de produto disponível.

A versão atual é a **1.12.0**, com **63 testes definidos**; 61 passaram nesta execução e 2 testes opcionais de navegador foram ignorados por ausência de playwright-cli. Ela consolida **segurança de URLs** (`scripts/lib/urls.mjs`), **sanitização pré-truncamento de segredos** (`scripts/inspector/redaction.py`), **gravação atômica** contra colisão de recibos/temporários, **hashes canônicos LF** (`sha256-lf-text-v1`), **contratos formais via AJV** (`schemas/diagram.schema.json` e `if/then` de `repoRoot`), **modularização** em `scripts/lib/*` e `scripts/inspector/*`, e **ergonomia mobile/impressão/WAI-ARIA** verificada em navegador real. As seções seguintes detalham escopo, uso, arquitetura, regras, contratos, operação e limites.

A v1.12.0 acrescenta `review` via Chrome/Edge/Chromium instalado, sem novas dependências npm. O padrão captura hero, figuras e seções com erro em 1440 px. O gate de `verify --mark-reviewed --rubric <arquivo>` exige hash atual, checks aprovados e todos os tiles inspecionados; `--accept-issues` registra uma exceção visual justificada. Cards recebem quebra defensiva de identificadores e grades por contagem.

## Visão funcional e escopo

A skill resolve um problema recorrente: a documentação de um projeto envelhece mais rápido que o código, e os documentos costumam ser escritos em formatos que não sobrevivem a ambientes corporativos fechados. Aqui, as entradas permanecem editáveis em texto e o produto final é um artefato portátil, sem dependências de runtime.

| Entrada | Formato | Papel | Obrigatória |
|---|---|---|---|
| Repositório documentado | diretório local | Fonte da verdade sobre o comportamento implementado | Sim |
| `document.json` | JSON validado por schema | Título, versão, cartões, seções, fontes, modo e tema | Sim |
| `content.md` | Markdown com GFM | Prosa, tabelas, callouts, diagramas e gráficos | Sim |
| Diagramas 2D | blocos `solution`, `flow`, `schema` ou `erd` | Arquitetura, processamento e entidades | Opcional |
| Gráficos | bloco `chart` | Comparação numérica com unidade e fonte | Opcional |
| Dossiê estático | `inventory.json` e `reading-plan.md` | Priorização de leitura e base da análise de impacto | Recomendado |
| HTML final | `documentacao.html` | Manual único, interativo e offline | Saída |
| Recibo | `documentacao.validation.json` | Prova de integridade e métricas do build | Saída |

**Está no escopo:** explicar o propósito do projeto, o desenho da solução, os fluxos, as regras de negócio, o modelo de dados, a operação e os limites que afetam a interpretação. **Não está no escopo:** produzir backlog de defeitos, maturidade, matriz de severidade, plano de modernização ou auditoria de segurança. A skill também não executa jobs, não altera produção e não consulta serviços externos para preencher lacunas.

O manual completo preserva as categorias da jornada do leitor: resumo executivo, escopo funcional, estado atual, uso, desenho da solução, processamento, regras, modelo de dados, operação, decisões e glossário. O **Guia Rápido** destila a mesma história em 4 a 7 capítulos de alto sinal, com estimativa de leitura e um link seguro para o manual completo via `companionDoc`.

Quando o repositório documentado é uma esteira de dados, a skill incorpora o perfil de engenharia de dados: PySpark, Databricks, Delta Lake, Cosmos DB, Event Hubs, Blob/ADLS Gen2, APIs e contratos de qualidade. Esse perfil acrescenta perguntas específicas sobre modos de escrita, partições, checkpoints, watermark, catálogo, rotas e limites de consumo, sem transformar o manual em uma auditoria de segurança ou de desempenho.

<div class="cards">
<div class="card"><h3>Entradas editáveis</h3><p>Markdown, JSON e texto de diagrama permanecem versionáveis; o HTML é sempre regenerável a partir deles.</p></div>
<div class="card"><h3>Saída autossuficiente</h3><p>CSS, JavaScript e SVG entram no arquivo final. Nenhuma requisição de rede é necessária para ler, buscar ou imprimir.</p></div>
<div class="card"><h3>Rastreabilidade</h3><p>Cada seção declara suas fontes; o recibo registra hashes e revisão Git; o impacto aponta o que revisar.</p></div>
</div>

> Atenção: não copie fatos de outro repositório para um documento novo. Nomes de tabelas, volumes, SLAs e comportamentos só podem entrar se estiverem sustentados pelas fontes daquele projeto.

> Limitação: quando o repositório não estabelece propósito de negócio, ownership, status de deploy ou justificativa histórica, a skill orienta consultar contexto de produto ou perguntar o fato específico. O código pode provar a implementação, não a intenção original.

## Estado atual da solução

A versão **1.12.0** é um pacote Node.js privado sob licença MIT (`LICENSE`), com dependências fixadas (`package-lock.json`), workflow de CI Ubuntu/Windows (`.github/workflows/ci.yml`), política LF (`.gitattributes`) e um pacote Python modular de inspeção. O requisito de autoria é **Node 22 ou superior** e **Python 3.10 ou superior**; o leitor final precisa apenas de um navegador moderno. A suíte executa com `npm test` e cobre compilação, segurança, contratos AJV, diagramas, gráficos, temas, modos, análise de impacto e **testes reais em Chromium headless**.

| Componente | Linhas | Papel |
|---|---|---|
| `scripts/inspector/` (`extractors.py`, `graph.py`, `sql_parser.py`, `redaction.py`, `__init__.py`) + `inspect_repo.py` | 2.095 | Varredura estática modular, extração AST/JS/TS/PySpark/DDL, redação pré-truncamento e grafo |
| `scripts/diagrams.mjs` | 1.440 | Diagramas 2D determinísticos (validados por `diagram.schema.json`) e enriquecimento de Mermaid |
| `assets/document.css` | 1.055 | Design system, layout responsivo (desktop + drawer mobile), temas e regras `@media print` |
| `assets/document.js` | 637 | Drawer mobile (`inert` sincronizado por breakpoint + focus trap), zoom `Fit` monótono, busca, `aria-pressed` e impressão |
| `scripts/verify.mjs` | 570 | Hashes canônicos LF (`sha256-lf-text-v1`), `receiptStatus`, `--html`, `sourceDrift`, impacto e `--mark-reviewed` |
| `scripts/build.mjs` + `scripts/lib/` (`urls.mjs`, `hash.mjs`, `i18n.mjs`, `html-shell.mjs`) | 672 | Manifesto, Markdown, validação CLI, escrita atômica sem colisões e shell HTML responsivo |
| `schemas/` (`document.schema.json` + `diagram.schema.json`) | 298 | Esquemas AJV draft-07 de manifesto (`repoRoot` condicional), diagramas 2D e gráficos |
| `scripts/validate.mjs` | 85 | Auditoria estrutural do HTML, links seguros (`isSafeHref`), H4/`.card h3`, LaTeX inline e SVGs |
| `scripts/renderer-hash.mjs` | 41 | Hash SHA-256 determinístico dos assets, `scripts/lib/*`, schemas e `package-lock.json` |

A contagem acima vem do `inventory.json` gerado em 16/11/2026, exceto `document.css`, medido diretamente porque a lista de extensões do inspetor não inclui `.css`. O dossiê classificou o repositório como **medium**: **44 arquivos totais**, **29 arquivos core** e **8.285 linhas** de código ou schema.

```chart
{"type":"bar","title":"Testes definidos por arquivo (1.12.0)","unit":"testes","source":"Definições em tests/*.test.mjs; browser opcionais","asOf":"2026-11-16","data":[{"label":"tests/build.test.mjs","value":24,"variant":"success"},{"label":"tests/diagrams.test.mjs","value":13,"variant":"accent"},{"label":"tests/dossier.test.mjs","value":7,"variant":"neutral"},{"label":"tests/landing.test.mjs","value":5,"variant":"accent"},{"label":"tests/browser.test.mjs","value":2,"variant":"neutral"},{"label":"tests/cli.test.mjs","value":4,"variant":"success"},{"label":"tests/review-browser.test.mjs","value":4,"variant":"success"},{"label":"tests/review-gate.test.mjs","value":4,"variant":"success"}]}
```

O histórico recente mostra a evolução do produto em camadas. A versão 1.3.0 introduziu o motor SVG 2D, o filtro de audiência, a busca com destaque e o tema vermelho; a 1.4.0 adicionou o dossiê estático e a análise incremental; a 1.5.0 endureceu diagramas, subnavegação H3 e extratores; a 1.6.0 trouxe o modo resumido; a 1.7.0 consolidou os temas **Vermelho** e **Azul** e a rolagem sobre tabelas curtas; a 1.8.0 adicionou o menu lateral recolhível no mobile e `rendererSha256`; a 1.9.0 endureceu acessibilidade (`inert`/focus trap mobile), Mermaid no tema vermelho, verificação de artefatos + `sourceDrift` + `--mark-reviewed` e extração JS/TS/`.docignore`; e a **1.10.0** consolidou contratos AJV (`diagram.schema.json`), modularização (`scripts/lib/*` e `scripts/inspector/*`), hashes canônicos LF (`sha256-lf-text-v1`), segurança de URLs/segredos/atômico, zoom `Fit` monótono, impressão de tabelas filtradas, WAI-ARIA e testes em Chromium headless.

Na interface, o seletor oferece **Vermelho** (primeiro e padrão) e **Azul**; a escolha é persistida em `localStorage` sem sobrescrita passiva na carga, e valores antigos são migrados (`santander` → vermelho, `default` → azul). O tema vermelho harmoniza shell, sidebar, hero, diagramas 2D e SVGs Mermaid, sem apagar as cores semânticas de sucesso, atenção e erro.

<div class="cards">
<div class="card"><h3>Núcleo determinístico</h3><p>Inspeção modular sem execução, renderização validada por schema AJV, escrita atômica e recibos canônicos LF.</p></div>
<div class="card"><h3>Interface offline</h3><p>Busca accent-insensitive multi-ocorrência, filtros com aria-pressed, temas, tabelas e modal com zoom Fit monótono.</p></div>
<div class="card"><h3>Qualidade verificável</h3><p>63 testes (incluindo Chromium headless), exemplos mínimo e showcase, CI Ubuntu/Windows e revisão registrada.</p></div>
</div>

> Atenção: a suíte prova o comportamento dos geradores e do HTML produzido; ela não prova que o conteúdo semântico de um manual específico está correto. Essa verificação continua sendo responsabilidade da autoria e da revisão.

## Como usar

A entrada única é `scripts/cli.mjs`: `doctor` confere Node, Python e dependências; `inspect`, `build` e `verify` devolvem JSON com caminhos resolvidos. Para executar de outra pasta, use o caminho absoluto da CLI entre aspas. Os scripts internos continuam disponíveis por compatibilidade.

A instalação enxuta usa o ZIP versionado da Release: extraia em uma pasta `project-html-docs`, execute `npm ci --ignore-scripts --prefix "<skill>"` e `node "<skill>/scripts/cli.mjs" doctor`. O ZIP inclui apenas a skill, scripts, assets, schemas, referências, exemplo mínimo, licença e manifests npm; não inclui vídeos, landing page, testes nem node_modules. A LLM lê `SKILL.md` e consulta as referências sob demanda. No repositório de desenvolvimento, `npm run package:skill` gera o arquivo em `dist/`.

O uso típico tem cinco passos: instalar uma vez, mapear o repositório, escrever os inputs, compilar e verificar. Os comandos abaixo assumem que a skill está neste repositório e que o diretório de trabalho da documentação é `docs/`.

Para distribuição como skill, `SKILL.md` é o entrypoint legível por agentes que não têm descoberta automática. O arquivo `agents/openai.yaml` declara o nome de exibição, a descrição curta e o prompt padrão que aciona a skill. O conteúdo do projeto documentado nunca fica embutido nesses metadados: eles apenas descrevem como executar o fluxo.

```bash
# 1. Instalar dependências (uma vez)
npm ci --ignore-scripts

# 2. Mapear o repositório e gerar o dossiê + plano de leitura
node scripts/cli.mjs inspect . --out docs/inventory.json --plan docs/reading-plan.md

# 3. Compilar o manual completo
node scripts/cli.mjs build docs/document.json --out docs/documentacao.html

# 4. Conferir hashes, fontes e revisão
node scripts/cli.mjs verify docs/document.json docs/documentacao.validation.json

# 5. Rodar a suíte quando o gerador for alterado
npm test
```

O manifesto é o contrato do documento. Ele exige `title`, `subtitle`, `version`, `updated`, `content` e `sections`; aceita `language` (`pt-BR` ou `en`), `theme` (`vermelho` ou `azul`, com vermelho como padrão), `mode` (`full` ou `summary`), `cards`, `companionDoc`, `repoRoot`, `revision`, `dataAsOf` e `sources`. Cada seção tem `id`, `title`, `audience` e, idealmente, `sources`.

| Comando | Efeito | Saída |
|---|---|---|
| `npm ci --ignore-scripts` | Instala as versões do `package-lock.json` | `node_modules/` |
| `node scripts/cli.mjs inspect <repo> --out <json> --plan <md>` | Varredura estática, sem executar o projeto | Dossiê e plano de leitura |
| `node scripts/cli.mjs build <manifest> --out <html>` | Compila, valida e grava o manual | HTML + recibo |
| `node scripts/cli.mjs build <manifest> --out <html> --force` | Atualiza um HTML existente de forma deliberada | HTML + recibo |
| `node scripts/cli.mjs build <manifest> --out <html> --mode summary` | Força o modo Guia Rápido | HTML + recibo |
| `node scripts/cli.mjs verify <manifest> <receipt> [--html <html>]` | Compara fontes LF, artefatos (`manifest`/`content`/`html`) e revisão (`sourceDrift`) | Relatório JSON (`receiptStatus`) |
| `node scripts/cli.mjs verify <manifest> <receipt> --strict` | Falha com código 1 se recibo incompleto ou drift real de fonte/artefato | Relatório JSON |
| `node scripts/cli.mjs verify <manifest> <receipt> --strict --mark-reviewed --rubric <rubric.md>` | Marca `browserReviewed: true` e timestamp após review e rubrica aprovados | Recibo atualizado |
| `node scripts/cli.mjs verify <manifest> <receipt> --impact --dossier <json> --plan <md>` | Calcula seções afetadas e grava o plano | Relatório + `update-plan.md` |
| `node scripts/cli.mjs review <html> --out <dir>` | Checks via CDP, PNGs, review.json e rubric.md | Evidência visual |
| `npm test` | Executa os 63 testes (incluindo Chromium headless) | Resultado da suíte |

O conteúdo começa obrigatoriamente com um `##` cujo texto coincida, na ordem, com `sections[].title`. Cada `###` vira subnavegação lateral. Um `#` dentro do Markdown é reservado ao título do documento e provoca erro de build. Tabelas ganham cabeçalho fixo, rolagem local e filtro automático a partir de 8 linhas; a roda da página continua funcionando sobre tabelas curtas. Diagramas são declarados em fences próprios.

```json
{
  "title": "Meu projeto",
  "subtitle": "O que ele faz e para quem.",
  "version": "1.0",
  "updated": "2026-11-16",
  "content": "content.md",
  "repoRoot": "..",
  "sections": [
    { "id": "resumo", "title": "Resumo executivo", "audience": "all" }
  ],
  "sources": [
    { "id": "readme", "path": "README.md", "description": "Visão geral do projeto." }
  ]
}
```

```markdown
## Resumo executivo

Texto introdutório da seção.

### Um subtítulo navegável

Mais detalhe.
```

Para um Guia Rápido, use um manifesto separado com `"mode": "summary"` e, opcionalmente, um link para o manual completo:

```json
{
  "mode": "summary",
  "companionDoc": { "href": "documentacao.html", "label": "Manual completo" }
}
```

> Regra de negócio: o build nunca sobrescreve um HTML existente sem `--force`, nunca aceita que a saída seja o próprio manifesto ou o Markdown de entrada e só grava depois que a validação estrutural passa.

> Atenção: o leitor final não precisa de Node, Python ou servidor. Essas ferramentas são necessárias apenas para gerar e verificar o documento. O HTML pode ser copiado para um compartilhamento, anexado a um processo ou aberto localmente.

> Limitação: o build não prova qualidade semântica nem visual. Depois de compilar, execute `review`, inspecione as capturas e preencha a rubrica. O padrão é desktop 1440 px; mobile/tablet são opcionais via `--viewports`. Declare o que não foi verificado, incluindo impressão e comportamento de cópia quando não exercitados.

## Desenho da solução

A solução separa **descoberta**, **compilação** e **verificação**. A descoberta é opcional para compilar, mas alimenta a leitura cirúrgica e a análise de impacto. A compilação é inteiramente local e resolve todos os visuais em tempo de build. A verificação compara o que foi documentado com o estado atual das fontes e produz um plano de revisão.

```solution
{
  "title": "Arquitetura do gerador e do ciclo de verificação",
  "inputs": { "label": "ENTRADAS E FONTES" },
  "zones": [
    { "id": "z1", "title": "1 · DESCOBERTA DETERMINÍSTICA", "subtitle": "opcional, zero LLM e zero execução", "variant": "warm", "row": 0, "colStart": 1, "colSpan": 2 },
    { "id": "z2", "title": "2 · COMPILAÇÃO OFFLINE", "subtitle": "tudo resolvido em tempo de build", "variant": "cool", "row": 1, "colStart": 1, "colSpan": 2 },
    { "id": "z3", "title": "3 · VERIFICAÇÃO E MANUTENÇÃO", "subtitle": "hashes, grafo de dependências e plano de atualização", "variant": "teal", "row": 2, "colStart": 1, "colSpan": 2 }
  ],
  "nodes": [
    { "id": "repo", "col": 0, "row": 0, "shape": "cylinder", "role": "regulator", "title": "Repositório", "lines": ["código, configuração e testes", "revisão Git e status"], "meta": "fonte da verdade" },
    { "id": "manifest", "col": 0, "row": 1, "role": "neutral", "title": "document.json", "lines": ["seções, fontes e cartões", "modo, tema e idioma"] },
    { "id": "content", "col": 0, "row": 1, "role": "neutral", "title": "content.md", "lines": ["H2 = seções, na ordem", "fences 2D, chart e Mermaid"] },
    { "id": "inspect", "col": 1, "row": 0, "step": 1, "role": "step", "title": "inspect_repo.py", "lines": ["AST, regex e grafo", "zero execução do código"] },
    { "id": "dossier", "col": 2, "row": 0, "shape": "cylinder", "role": "analytical", "title": "Dossiê + plano", "lines": ["inventory.json", "reading-plan.md"], "meta": "evidência com file:line" },
    { "id": "build", "col": 1, "row": 1, "step": 2, "role": "step", "title": "build.mjs", "lines": ["AJV + Marked + sanitize", "shell e subnavegação"] },
    { "id": "renderers", "col": 2, "row": 1, "step": 3, "role": "step", "title": "Renderizadores", "lines": ["solution / flow / schema", "chart + Mermaid"] },
    { "id": "html", "col": 2, "row": 1, "shape": "cylinder", "role": "output", "title": "documentacao.html", "lines": ["CSS, JS e SVG inline", "1 arquivo, leitura offline"] },
    { "id": "receipt", "col": 1, "row": 2, "shape": "cylinder", "role": "info", "title": "validation.json", "lines": ["hashes SHA-256 das fontes", "métricas e avisos"] },
    { "id": "verify", "col": 1, "row": 2, "step": 4, "role": "step", "title": "verify.mjs", "lines": ["drift de fontes + revisão", "impacto por grafo"] },
    { "id": "plan", "col": 2, "row": 2, "role": "output", "title": "update-plan.md", "lines": ["fontes alteradas", "seções marcadas como stale"] }
  ],
  "edges": [
    { "from": "repo", "to": "inspect", "label": "varredura estática" },
    { "from": "manifest", "to": "build", "label": "schema + fontes" },
    { "from": "content", "to": "build", "label": "Markdown" },
    { "from": "inspect", "to": "dossier", "label": "fatos e grafo" },
    { "from": "build", "to": "renderers", "label": "tokens + JSON" },
    { "from": "renderers", "to": "html", "label": "SVG inline" },
    { "from": "build", "to": "receipt", "label": "grava" },
    { "from": "receipt", "to": "verify", "label": "compara" },
    { "from": "verify", "to": "plan", "label": "gera" }
  ],
  "legend": [
    { "type": "box", "role": "regulator", "label": "Fonte e revisão" },
    { "type": "box", "role": "step", "label": "Etapa executável" },
    { "type": "box", "role": "analytical", "label": "Dossiê estático" },
    { "type": "box", "role": "output", "label": "Artefato entregue" },
    { "type": "box", "role": "info", "label": "Recibo de build" }
  ],
  "note": "O inspect_repo.py é opcional para compilar; ele alimenta a leitura e, com --impact, o verify.mjs. O build grava HTML e recibo de forma atômica."
}
```

| Objeto | Papel | Lido / gravado |
|---|---|---|
| `document.json` | Contrato do manual: seções, fontes, cartões e modo | Lido pelo build e pelo verify |
| `content.md` | Texto, tabelas, callouts, diagramas e gráficos | Lido pelo build |
| `sources[]` | Arquivos locais que sustentam as afirmações | Lidos e hasheados pelo build |
| `inventory.json` | Dossiê estático do repositório | Produzido pelo inspect; usado pelo impacto |
| `documentacao.html` | Manual único com CSS, JS e SVG embutidos | Gravado pelo build; aberto no navegador |
| `documentacao.validation.json` | Recibo com métricas, avisos e fingerprints | Gravado pelo build; lido pelo verify |
| `update-plan.md` | Diagnóstico de drift e seções a revisar | Gravado pelo verify em modo impacto |

A arquitetura tem quatro propriedades que explicam quase todas as decisões do projeto. **Primeiro**, o produto é offline: não há CDN, endpoint de gráfico, iframe ou script remoto; o validador rejeita qualquer dependência externa. **Segundo**, tudo que é visual é resolvido antes da entrega: diagramas 2D, Mermaid e gráficos viram SVG inline no build. **Terceiro**, a interface é mantida localmente em `assets/document.css` e `assets/document.js`, compartilhada por todos os documentos. **Quarto**, a autoria é separada da renderização: o agente entende o domínio e escreve; os scripts apenas transformam e auditam.

> Regra de negócio: o HTML é a entrega, mas os inputs continuam sendo a fonte editável. Nenhum fato deve existir apenas dentro do HTML, porque o próximo build precisa reproduzi-lo a partir de Markdown e JSON.

> Limitação: o dossiê é uma ajuda de descoberta, não uma prova de arquitetura. A leitura das fontes e a interpretação semântica continuam sendo trabalhos humanos ou de agente, com citações `arquivo:linha` quando a afirmação for específica.

## Fluxo e processamento

O caminho de compilação é curto e cheio de guardas. O objetivo é falhar cedo, com mensagem contextual, antes de criar um arquivo parcial ou um HTML que pareça válido mas esteja estruturalmente quebrado.

```flow
{
  "title": "Caminho de build e falha segura",
  "inputs": { "label": "ENTRADA" },
  "zones": [
    { "id": "z1", "title": "CONTRATO", "subtitle": "validação antes de renderizar", "variant": "warm", "row": 0, "colStart": 1, "colSpan": 2 },
    { "id": "z2", "title": "RENDER", "subtitle": "Markdown, SVG e sanitização", "variant": "cool", "row": 1, "colStart": 1, "colSpan": 2 },
    { "id": "z3", "title": "ENTREGA", "subtitle": "gravação atômica e recibo", "variant": "teal", "row": 2, "colStart": 1, "colSpan": 2 }
  ],
  "nodes": [
    { "id": "entry", "col": 0, "row": 0, "role": "neutral", "title": "Manifesto + Markdown", "lines": ["document.json", "content.md"] },
    { "id": "guard1", "col": 1, "row": 0, "shape": "decision", "role": "warning", "title": "Contrato válido?", "lines": ["schema, H2, IDs", "fontes e saída"] },
    { "id": "render", "col": 1, "row": 1, "step": 1, "role": "step", "title": "Renderiza fences", "lines": ["2D, chart, Mermaid", "sanitização"] },
    { "id": "fail", "col": 2, "row": 1, "role": "danger", "title": "Aborta sem gravar", "lines": ["nenhum HTML parcial", "erro com contexto"] },
    { "id": "guard2", "col": 1, "row": 2, "shape": "decision", "role": "warning", "title": "HTML válido?", "lines": ["validateHtml", "âncoras e SVG"] },
    { "id": "write", "col": 2, "row": 2, "step": 2, "role": "output", "title": "Grava HTML + recibo", "lines": ["write atômico", "validation.json"] }
  ],
  "edges": [
    { "from": "entry", "to": "guard1", "label": "lê inputs" },
    { "from": "guard1", "to": "render", "branch": "yes", "label": "Sim" },
    { "from": "guard1", "to": "fail", "branch": "no", "style": "dashed", "label": "Não · erro" },
    { "from": "render", "to": "guard2", "label": "HTML + SVG" },
    { "from": "guard2", "to": "write", "branch": "yes", "label": "Sim" },
    { "from": "guard2", "to": "fail", "branch": "no", "style": "dashed", "label": "Não · erro" }
  ],
  "legend": [
    { "type": "box", "role": "neutral", "label": "Entrada editável" },
    { "type": "box", "role": "warning", "label": "Decisão de contrato" },
    { "type": "box", "role": "step", "label": "Etapa de renderização" },
    { "type": "box", "role": "danger", "label": "Saída de falha" },
    { "type": "box", "role": "output", "label": "Entrega verificada" }
  ],
  "note": "As guardas rodam antes de qualquer gravação; o recibo só existe se validateHtml passar e o HTML for gravado por rename atômico."
}
```

**Build (`scripts/build.mjs` + `scripts/lib/`).** O compilador valida flags CLI (`parseBuildCliArgs`), lê o manifesto e o valida contra `schemas/document.schema.json` com AJV (exigindo `repoRoot` quando `sources` não é vazio). Em seguida, resolve `content` e `repoRoot`, recusa colisão tanto do `--out` quanto do recibo `.validation.json` contra inputs e arquivos existentes sem `--force`, e calcula SHA-256 canônico LF (`sha256-lf-text-v1`) para cada fonte declarada, verificando que o caminho permanece dentro do repositório. Só então o Markdown é tokenizado: cada H2 vira uma seção, H1 é rejeitado, títulos e ordem precisam coincidir com o manifesto e cada `sections[].sources` precisa existir no mapa.

Na renderização, cada fence passa primeiro por validação formal e sanitização. `solution`/`flow` e `schema`/`erd` são validados por `schemas/diagram.schema.json` em `scripts/diagrams.mjs`; `chart` valida `chartSpec`; e `mermaid` passa pelo renderer fixado e pelo `enhanceMermaidSvg`. Links (`a[href]` e `companionDoc.href`) são conferidos por `isSafeHref` em `scripts/lib/urls.mjs`, que rejeita caracteres de controle Unicode (`U+0000–U+001F`, `U+007F`), protocol-relative `//` e protocolos fora da whitelist (`http:`, `https:`, `mailto:`, `tel:`, relativos e `#`).

O shell (`scripts/lib/html-shell.mjs` + `scripts/lib/i18n.mjs`) embute CSS e JavaScript, monta hero, cartões, toolbar, busca, filtros e diálogo de diagramas, e produz um HTML com um único H1. O validador então audita IDs duplicados, âncoras quebradas, ativos externos, SVG sem nome acessível, `viewBox` inválido, geometria com `NaN`/`Infinity`, detalhes sem `summary`, tabelas sem cabeçalho, links vazios ou inseguros e LaTeX não renderizado. Se tudo passar, grava HTML e recibo via arquivos temporários exclusivos (`createUniqueTempPath`) removidos garantidamente em `try/finally`.

**Inspeção (`scripts/inspect_repo.py` + `scripts/inspector/`).** A fachada CLI orquestra um pacote modular dividido em `redaction.py`, `sql_parser.py`, `extractors.py` e `graph.py`. A varredura percorre o repositório excluindo diretórios técnicos padrão e artefatos gerados pela própria skill, respeitando `.docignore` (comentários, `!` negações, âncoras `/`), e registrando omissões e avisos por arquivo em `omittedCounts`, `omittedFiles` e `parseWarnings`. Extratores especializados cobrem Python/AST (com guarda para lambdas/subscritos em `_call_chain`), notebooks Databricks e `.ipynb`, DDL SQL balanceada (`DECIMAL(10, 2)`, genéricos `<...>`), JS/TS (`.mts`/`.cts`, reexports `export ... from`, imports dinâmicos, `interface`/`type`/`enum`, *arrow functions*, `process.env`/`import.meta.env`), desambiguação Blob vs Cosmos em `get_container_client`, streaming PySpark (`toTable`/`table`/`orc`/`text`/`.outputMode`) e Scala/Terraform/workflows. A sanitização em `redaction.py` roda antes de qualquer truncamento para tokens, chaves CLI e segredos inline.

**Verificação (`scripts/verify.mjs`).** O verificador valida flags (`parseVerifyCliArgs`), classifica o recibo (`receiptStatus`: `complete` | `legacy-partial` | `invalid`, recusando `{}` até fora de `--strict`), confere hashes canônicos `sha256-lf-text-v1` de fontes e artefatos (`manifestSha256`, `inputSha256`), resolve o HTML via `--html` -> `receipt.htmlPath` -> irmão `.validation.json` (comparando hash bruto), diferencia commits só de docs (`revision.sourceDrift`) e compara `rendererSha256` (que inclui `package-lock.json`, `diagram.schema.json` e `scripts/lib/*`). No `--strict`, exige `receiptStatus === "complete"` com HTML íntegro; com `--mark-reviewed --rubric <arquivo>`, valida o gate visual e grava `browserReviewed: true`; e com `--impact`, percorre o grafo de dependências e marca apenas as seções `stale`.

| Etapa | Entrada | Saída | Falha prevista |
|---|---|---|---|
| Validar manifesto | `document.json` | Objeto validado | Schema inválido ou campo extra |
| Resolver fontes | `sources[]` e `repoRoot` | Mapa de hashes | Fonte ausente, duplicada ou fora do repo |
| Tokenizar Markdown | `content.md` | Grupos de seções | H1, H2 fora de ordem ou texto antes do primeiro H2 |
| Renderizar visual | Fences JSON | SVG/chart inline | JSON inválido, nó/entidade sem id ou valor de gráfico inválido |
| Sanitizar e montar | HTML das seções | Shell completo | HTML perigoso ou IDs reservados |
| Validar HTML | Shell | Recibo | Âncora, SVG, tabela, `details` ou ativo externo |
| Gravar | HTML + recibo | Arquivos finais | Falha de escrita ou validação |

> Exemplo prático: se `scripts/validate.mjs` mudar, o `verify.mjs` marca a fonte como `changed`. Como `build.mjs` importa `validate.mjs`, o build entra como dependente transitivo; qualquer seção que declare `build` em `sources` fica `stale`. Uma seção que declare apenas `readme` permanece `fresh` e não precisa ser relida.

> Atenção: a análise de impacto só encontra o que está mapeado. Se uma fonte alterada não estiver vinculada a nenhuma seção em `sections[].sources`, o plano emite um aviso de fonte não mapeada; corrija o manifesto antes de confiar no plano.

## Regras funcionais e validações

As regras do gerador são contractuais: algumas impedem o build, outras apenas alertam. A distinção é importante para operar a skill sem tratar todo aviso como defeito e sem publicar um documento que viola uma garantia estrutural.

### Contrato de conteúdo e de build

| Condição | Resultado | Leitura |
|---|---|---|
| H1 no Markdown ou `<h1>` em HTML | Erro e nenhuma gravação | O H1 é exclusivo do título do documento |
| `<h4>` sem `<h3>` anterior na seção (`<h3>` dentro de `.card` não conta) | Erro de validação | Garante hierarquia correta fora de cartões |
| Texto antes do primeiro H2 | Erro | O conteúdo precisa começar pela primeira seção declarada |
| H2 fora de ordem ou com texto diferente de `sections[].title` | Erro | Títulos são comparados exatamente, inclusive acentos |
| `id` de seção reservado, duplicado ou fora do padrão | Erro | IDs do shell não podem ser reutilizados; o padrão é `^[a-z][a-z0-9-]*$` |
| Fonte desconhecida em `sections[].sources` | Erro | Toda referência precisa existir em `sources[]` |
| Fonte fora do `repoRoot` | Erro | O build recusa path traversal e caminhos absolutos |
| Saída já existente sem `--force` | Erro | Atualização é deliberada, nunca acidental |
| Saída igual ao manifesto ou ao Markdown | Erro | Inputs não podem ser sobrescritos |
| `companionDoc.href` local ausente no build | Aviso não bloqueante | Alerta sem impedir compilação paralela |
| `details` sem um único `summary` | Erro de validação | Acordeões precisam de rótulo acessível |
| Tabela sem `thead`/`th` | Erro de validação | Toda tabela precisa de cabeçalho |
| Figura sem `figcaption` | Erro de validação | Diagramas e gráficos precisam de legenda |
| Script externo, iframe, `link` ou CSS remoto | Erro de validação | O produto é offline por contrato |
| LaTeX não renderizado (`$x_i$`, `$n^2$`, `$$...$$`, mantendo moeda `$ 10`) | Erro de validação | Use Unicode e HTML para fórmulas |
| Mais de 70% das seções com `audience: "all"` | Aviso | Distribua as audiências para o filtro ser útil |
| Mais de 50% das seções sem `sources` | Aviso | Sem vínculo, o impacto não consegue rotear a revisão |

### Modo Guia Rápido

| Condição | Comportamento | Leitura |
|---|---|---|
| `mode: "full"` | Sem limite de seções ou palavras | Manual completo, com dicionários e detalhes |
| `mode: "summary"` com 4 a 7 seções | Caminho esperado | Panorama de ~5 a 7 minutos |
| `mode: "summary"` com mais de 8 seções | Aviso não bloqueante | O guia perdeu a característica de leitura rápida |
| `mode: "summary"` com mais de 3.500 palavras | Aviso não bloqueante | Reduza detalhe enciclopédico |
| `companionDoc.href` com esquema inseguro | Erro | `javascript:`, `data:` e `vbscript:` são recusados |
| Contagem de leitura | `max(1, round(palavras / 190))` | Estimativa exibida no hero do modo resumido |
| `--mode summary` na CLI | Sobrepõe o campo do manifesto | Útil para gerar as duas versões do mesmo conteúdo-base |

### Impacto e propagação

| Tipo de aresta no dossiê | Direção da propagação | Exemplo |
|---|---|---|
| `import` | Módulo importado mudou → quem importa fica `stale` | `build.mjs` importa `validate.mjs` |
| `notebook_run` | Notebook chamado mudou → chamador fica `stale` | `dbutils.notebook.run` |
| `bundle_task` | Notebook/arquivo mudou → bundle fica `stale` | `databricks.yml` |
| `adf_activity` | Notebook mudou → pipeline ADF fica `stale` | Atividade `DatabricksNotebook` |
| `workflow_run` | Script mudou → workflow fica `stale` | GitHub Actions |
| `sql_lineage` | Produtor mudou → consumidor SQL fica `stale` | Tabela de origem → consulta |
| Sem grafo | Apenas a fonte direta é marcada | Uso mínimo do dossiê |

A leitura correta é: **hash diferente** é sinal de drift, não prova de mudança semântica; **seção `stale`** é convite à revisão, não conclusão de que o texto está errado; **seção `fresh`** significa que as fontes declaradas não mudaram, não que o conteúdo seja verdadeiro para sempre.

> Regra de negócio: uma seção sem `sources` não participa do roteamento de impacto. Declarar as fontes é parte do contrato de autoria, não um detalhe opcional, sempre que o manifesto tiver fontes e mais de duas seções.

### Gráficos e diagramas

O componente `chart` aceita apenas barras horizontais com valores finitos e não negativos, de 1 a 40 categorias, rótulos únicos de até 45 caracteres, unidade e fonte obrigatórias. Cada gráfico embute uma tabela de dados acessível, uma escala linear com marcações em 25%, 50%, 75% e 100%, tratamento explícito de zero e variantes semânticas de cor (`accent`, `success`, `warning`, `danger`, `neutral`). A data de observação (`asOf`) é opcional e aparece na legenda.

Diagramas 2D são validados pelo renderizador: `solution` e `flow` exigem título, lista não vazia de nós e IDs únicos; `schema` e `erd` exigem título, entidades com nome e IDs únicos. Arestas que apontam para nós inexistentes falham. O motor distribui portas, desvia de nós intermediários, evita colisão de rótulos e calcula a geometria antes de emitir o SVG. O `validate.mjs` complementa com checagens de acessibilidade e geometria, mas não certifica semântica, cardinalidade ou legibilidade visual.

> Exemplo prático: um gráfico com três valores `15`, `11` e `3` e unidade `testes` é válido; o maior valor ocupa a barra mais longa, o zero teria badge explícito e a tabela embutida repetiria os três pares. Um valor negativo ou um rótulo repetido interrompe o build com mensagem de erro.

> Limitação: validação estrutural não substitui revisão visual. Sobreposição de rótulos, corte de texto, uma seta ambígua ou uma tabela apertada podem passar pelo HTML válido e ainda assim prejudicar a leitura; o comando `review` acrescenta checks de geometria e interação; a rubrica exige inspeção dos tiles, com desktop como padrão e mobile/tablet sob demanda.

## Modelo e relacionamento dos artefatos

O gerador não usa banco de dados. O modelo é um conjunto de arquivos com papéis bem definidos: dois inputs editáveis, um dossiê de descoberta, dois artefatos de build e um plano de manutenção. As relações são de **derivação e responsabilidade**, não de chave estrangeira.

```schema
{
  "title": "Artefatos do ciclo de documentação",
  "entities": [
    {
      "id": "manifest",
      "name": "document.json",
      "kind": "json",
      "grain": "1 objeto = 1 manual",
      "col": 0,
      "row": 0,
      "columns": [
        { "name": "title", "type": "STRING" },
        { "name": "version", "type": "STRING" },
        { "name": "updated", "type": "STRING" },
        { "name": "mode", "type": "ENUM" },
        { "name": "sections[]", "type": "ARRAY" },
        { "name": "sources[]", "type": "ARRAY" }
      ]
    },
    {
      "id": "content",
      "name": "content.md",
      "kind": "external",
      "grain": "1 arquivo = 1 seção por H2",
      "col": 0,
      "row": 1,
      "columns": [
        { "name": "## seção", "type": "MARKDOWN" },
        { "name": "fences", "type": "JSON" },
        { "name": "prosa", "type": "MARKDOWN" },
        { "name": "tabelas", "type": "MARKDOWN" }
      ]
    },
    {
      "id": "receipt",
      "name": "validation.json",
      "kind": "json",
      "grain": "1 arquivo = 1 build verificado",
      "col": 1,
      "row": 0,
      "columns": [
        { "name": "passed", "type": "BOOLEAN" },
        { "name": "sources[]", "type": "ARRAY" },
        { "name": "revision", "type": "STRING" },
        { "name": "manifestSha256", "type": "STRING" },
        { "name": "htmlSha256", "type": "STRING" },
        { "name": "warnings[]", "type": "ARRAY" }
      ]
    },
    {
      "id": "inventory",
      "name": "inventory.json",
      "kind": "json",
      "grain": "1 arquivo = 1 varredura do repositório",
      "col": 1,
      "row": 1,
      "columns": [
        { "name": "scaleProfile", "type": "OBJECT" },
        { "name": "files[]", "type": "ARRAY" },
        { "name": "dependencyGraph", "type": "OBJECT" },
        { "name": "readingWaves", "type": "OBJECT" },
        { "name": "symbolIndex", "type": "OBJECT" },
        { "name": "testsIndex", "type": "OBJECT" }
      ]
    },
    {
      "id": "html",
      "name": "documentacao.html",
      "kind": "mart",
      "grain": "1 arquivo = 1 manual offline",
      "col": 2,
      "row": 0,
      "columns": [
        { "name": "seções", "type": "DETAILS" },
        { "name": "SVG", "type": "INLINE" },
        { "name": "CSS", "type": "INLINE" },
        { "name": "JS", "type": "INLINE" },
        { "name": "tema", "type": "ATTRIBUTE" }
      ]
    },
    {
      "id": "plan",
      "name": "update-plan.md",
      "kind": "external",
      "grain": "1 arquivo = 1 diagnóstico de drift",
      "col": 2,
      "row": 1,
      "columns": [
        { "name": "fontes alteradas", "type": "TABLE" },
        { "name": "dependentes", "type": "LIST" },
        { "name": "seções stale", "type": "LIST" },
        { "name": "git diff", "type": "TEXT" }
      ]
    }
  ],
  "relations": [
    { "from": "manifest", "to": "html", "kind": "lineage", "label": "compila" },
    { "from": "content", "to": "html", "kind": "lineage", "label": "compila" },
    { "from": "manifest", "to": "receipt", "kind": "lineage", "label": "fingerprints" },
    { "from": "inventory", "to": "plan", "kind": "lineage", "label": "alimenta impacto" },
    { "from": "receipt", "to": "plan", "kind": "lineage", "label": "compara" }
  ],
  "note": "Artefatos são arquivos, não tabelas relacionais; setas tracejadas indicam derivação, não chave estrangeira."
}
```

| Artefato | Grão | Identidade | Produzido por | Consumido por |
|---|---|---|---|---|
| `document.json` | 1 objeto = 1 manual | Título + versão + revisão | Autoria | Build e verify |
| `content.md` | 1 arquivo = 1 seção por H2 | Títulos H2 na ordem | Autoria | Build |
| `inventory.json` | 1 arquivo = 1 varredura | Caminho + hash de cada arquivo | `inspect_repo.py` | Autoria e impacto |
| `documentacao.html` | 1 arquivo = 1 manual | Caminho de saída | Build | Leitor |
| `validation.json` | 1 arquivo = 1 build | `manifestSha256` + revisão | Build | Verify e operação |
| `update-plan.md` | 1 arquivo = 1 diagnóstico | Revisão documentada → atual | Verify | Autoria |

### Dicionário do manifesto

<details>
<summary>Campos de document.json</summary>

| Campo | Tipo | Obrigatório | Função |
|---|---|---|---|
| `title` | string | Sim | Título do documento e do HTML |
| `subtitle` | string | Sim | Descrição curta exibida no hero |
| `version` | string | Sim | Versão editorial do manual |
| `updated` | string `YYYY-MM-DD` | Sim | Data de atualização do documento |
| `content` | string | Sim | Caminho relativo do Markdown |
| `sections` | array | Sim | Seções na ordem em que aparecem no Markdown |
| `sources` | array | Recomendado | Fontes locais com id, path e descrição |
| `language` | `pt-BR` ou `en` | Não | Idioma do shell e dos rótulos |
| `theme` | `vermelho` ou `azul` | Não | Tema inicial; ausência equivale a vermelho |
| `mode` | `full` ou `summary` | Não | Preset de detalhe do documento |
| `eyebrow` | string | Não | Sobrelinha do hero; tem padrão por idioma |
| `cards` | array de até 4 | Não | Cartões de destaque do hero |
| `repoRoot` | string | Com fontes | Raiz para resolver `sources[].path` |
| `revision` | string | Não | Revisão Git efetivamente lida |
| `dataAsOf` | string | Não | Data dos dados observados, distinta da atualização |
| `companionDoc` | objeto | Não | Link seguro para manual ou guia companheiro |

Cada seção exige `id` (padrão `^[a-z][a-z0-9-]*$`), `title` e `audience` (`all`, `business`, `technical` ou `operations`). `sources` é uma lista de IDs de fontes. IDs de seção não podem colidir com o shell (`main`, `sidebar`, `sidebar-backdrop`, `nav-toggle`, `nav-close`, `mobile-search-btn`, `search`, `expand`, `collapse`, `print`, `back-to-top`, `diagram-dialog`, entre outros). O schema usa `additionalProperties: false`, portanto campos não previstos são rejeitados.

</details>

### Dicionário do recibo

<details>
<summary>Campos de validation.json</summary>

| Campo | Tipo | Função |
|---|---|---|
| `passed` | boolean | Indica se o validador não encontrou erros |
| `errors` | array | Lista de falhas estruturais |
| `mode` | string | `full` ou `summary` efetivamente usado |
| `wordCount` | number | Palavras contadas no corpo das seções |
| `readingMinutes` | number | Estimativa `max(1, round(wordCount / 190))` |
| `sections` | number | Seções de conteúdo, sem o bloco de referências |
| `contentSections` | number | Mesma contagem de seções de conteúdo |
| `referenceBlocks` | number | Quantidade de blocos de referências gerados |
| `diagrams` | number | Figuras de diagrama no HTML |
| `charts` | number | Figuras de gráfico no HTML |
| `bytes` | number | Tamanho do HTML em bytes |
| `warnings` | array | Avisos não bloqueantes de autoria |
| `version` | string | Versão da skill que gerou o recibo |
| `skillVersion` | string | Versão da skill registrada no build |
| `hashAlgorithm` | string | `sha256-lf-text-v1` para canonicalização LF portátil |
| `htmlPath` | string | Caminho do HTML relativo à pasta do recibo |
| `rendererSha256` | string | Hash SHA-256 dos assets, `scripts/lib/*`, schemas e `package-lock.json` |
| `builtAt` | ISO 8601 | Momento do build |
| `manifestSha256` | string | Hash canônico LF do manifesto bruto |
| `inputSha256` | string | Hash canônico LF do Markdown de entrada |
| `htmlSha256` | string | Hash bruto do HTML final |
| `revision` | string ou null | Revisão Git documentada |
| `sources` | array | Fontes com path e SHA-256 |
| `visualReview` | objeto | Hash, navegador, viewports, tiles, erros e rubrica da última revisão |
| `reviewOverride` | objeto opcional | Motivo e timestamp de exceção visual explícita |
| `browserReviewed` | boolean | Revisão visual registrada via `--mark-reviewed` |
| `browserReviewedAt` | ISO 8601 | Momento em que a revisão no navegador foi confirmada |

O recibo é uma fotografia do build, não um monitor de produção. `builtAt` muda a cada compilação; `manifestSha256`, `inputSha256`, `htmlSha256` e `hashAlgorithm` permitem ao `verify.mjs` validar `receiptStatus` (`complete`, `legacy-partial`, `invalid`) e detectar dessincronização entre artefatos; `sources` é a lista confrontada com os arquivos atuais. `browserReviewed` inicia como `false` e passa a `true` via `verify.mjs --mark-reviewed --rubric <arquivo>` após o gate visual. Uma exceção explícita `--accept-issues` registra `reviewOverride` e não certifica inspeção visual.

</details>

### Dicionário do dossiê

<details>
<summary>Campos de inventory.json</summary>

| Campo | Tipo | Função |
|---|---|---|
| `dossierVersion` | string | Versão do formato do dossiê (`1.10.0`) |
| `generatedAt` | ISO 8601 | Momento da varredura |
| `repository` | string | Caminho absoluto do repositório |
| `revision` | string ou null | HEAD do Git no momento da varredura |
| `workingTreeChanges` | string | Saída de `git status --short` |
| `countsByKind` | objeto | Contagem por code, config, docs, schema, infra etc. |
| `stackSignals` | objeto | Contagem de sinais de stacks detectados |
| `scaleProfile` | objeto | Tier, arquivos, core files e linhas |
| `entrypoints` | objeto | Workflows, bundles, ADF, endpoints e CLIs |
| `envAndCliParams` | array | Variáveis de ambiente e parâmetros de CLI |
| `notebooks` | array | Notebooks Databricks e `.ipynb` |
| `dataContracts` | array | Schemas, DDLs e contratos extraídos |
| `sqlLineage` | array | Fontes, alvos e linhagem SQL |
| `iacResources` | array | Recursos Terraform/Bicep |
| `symbolIndex` | objeto | Constantes, símbolos e E/S por arquivo |
| `testsIndex` | objeto | Testes detectados por arquivo |
| `dependencyGraph` | objeto | Arestas, graus de entrada e saída |
| `readingWaves` | objeto | Ondas 1 a 4 com centralidade |
| `omittedCounts` | objeto | Contagem agregada de arquivos omitidos por motivo |
| `omittedFiles` | array | Lista estruturada `{path, reason}` de arquivos omitidos |
| `parseWarnings` | array | Avisos isolados de arquivos com erro de parsing AST/JSON |
| `files` | array | Metadados de cada arquivo inventariado |

A varredura é estática e determinística. Ela não executa o projeto, não chama LLM e não substitui leitura: serve para priorizar, localizar símbolos e montar o grafo que a análise de impacto usa. Segredos, tokens e strings de conexão são redigidos centralmente em `redaction.py` antes de qualquer truncamento.

</details>

> Atenção: o dossiê pode conter falsos positivos. Rotas de teste, fixtures e referências de documentação podem ser classificadas como stacks ou endpoints de produção. Neste próprio repositório, o inventário sinalizou Databricks, Spark, Event Hubs, Cosmos DB e uma rota `/telemetry/{tenant_id}` proveniente de testes e referências, não de uma esteira em produção. A leitura humana ou de agente continua necessária.

> Limitação: os artefatos não formam um modelo relacional. As setas do diagrama mostram quem deriva de quem; elas não representam chaves estrangeiras, cardinalidade de negócio ou integridade referencial.

## Operação e recuperação

A operação é local e idempotente na maior parte dos casos. O build recusa sobrescrever; o verify é somente leitura; o inspect apenas grava o dossiê e o plano. A suíte de testes usa diretórios temporários e não altera o documento publicado.

| Sintoma | Causa provável | Ação de recuperação |
|---|---|---|
| `Output already exists` | HTML de destino já existe | Escolha outro nome ou use `--force` de forma deliberada |
| `Output cannot overwrite an input` | `--out` aponta para o manifesto ou o Markdown | Escolha um caminho de saída separado |
| `repoRoot is required for local sources` | Há `sources` sem `repoRoot` | Defina `repoRoot` relativo à pasta do manifesto |
| `Source outside repository` | `sources[].path` escapa da raiz | Corrija o caminho ou mova a fonte |
| `Unknown source` | Seção referencia um id inexistente | Adicione a fonte ou corrija o id |
| `Duplicate source` ou `Duplicate section` | IDs repetidos | Renomeie os IDs |
| H2 não coincide | Título ou ordem divergente do manifesto | Alinhe `sections[].title` e os H2 exatamente |
| H1 no conteúdo | Título de nível 1 no Markdown | Remova o H1; use o título do manifesto |
| `Invalid chart block` | JSON, rótulo, valor ou unidade inválidos | Corrija o bloco; consulte as regras de gráfico |
| `Invalid solution diagram block` | Nó/aresta inválido ou id duplicado | Corrija o JSON e os IDs |
| `Broken anchor` | Link interno aponta para id inexistente | Aponte para uma seção ou H3 existente |
| `External or unsupported asset` | Script, iframe, CDN ou CSS remoto | Embute o recurso ou remove a dependência |
| `Unrendered LaTeX math` | Fórmula com `$...$` ou `$$...$$` | Use Unicode e HTML |
| `verify` com `changed` | Fonte mudou desde o build | Releia a seção, atualize o texto e recompile |
| `verify` com `missing` | Fonte removida ou renomeada | Corrija o manifesto ou restaure o arquivo |
| Revisão Git diferente | Commit novo desde o recibo | Reexecute o impacto e revise as seções `stale` |
| Árvore suja | Alterações não commitadas | Trate como snapshot local e confirme as fontes lidas |
| Página para de rolar sobre tabela | HTML antigo com contenção de roda em `.table-wrap` | Recompile com a versão 1.7.0 ou posterior; a contenção foi removida |
| Layout mobile sem gaveta ou com `Template da skill atualizado` | HTML antigo compilado antes das melhorias da skill | Recompile diretamente com `build.mjs --force` sem reler o repositório |

O ciclo de atualização recomendado é: gerar um novo dossiê, rodar o verify em modo impacto e abrir o `update-plan.md`. Se houver mudanças de código, revise apenas as seções `stale` e as fontes alteradas antes de recompilar; se apenas o template da skill tiver mudado (`renderer.needsRebuild: true` com fontes sincronizadas), pule a releitura e rode diretamente `build.mjs --force`. O plano mostra alterações de renderer, fontes diretas, dependentes transitivos, novos arquivos core e `git diff --stat` quando a revisão documentada difere da atual.

```bash
node scripts/cli.mjs inspect . --out docs/inventory.json --plan docs/reading-plan.md
node scripts/cli.mjs verify docs/document.json docs/documentacao.validation.json --impact --dossier docs/inventory.json --plan docs/update-plan.md
```

A revisão de entrega deve cobrir: overflow global, menu lateral recolhível no mobile (`#nav-toggle`, `#nav-close`, backdrop, `Escape`, `main.inert` + *focus trap* por `Tab`, e fechamento ao navegar), sidebar com rolagem independente sem sobrepor o rodapé no desktop, subnavegação H3, botão de topo, rolagem local de tabelas e diagramas, busca sem acento com destaque de todas as ocorrências, estado sem resultados, links para seções recolhidas, expandir/recolher, cópia com fallback, troca de tema (incluindo diagramas 2D e Mermaid no tema Vermelho), fechamento do modal (`<= 960 px` responsivo) com Escape e impressão com todas as seções. O review usa desktop 1440 px por padrão; acrescente mobile 390 px e tablet 1024 px quando solicitados. Impressão, clipboard e focus trap completos continuam exigindo inspeção específica.

> Regra de negócio: `--force` é uma decisão editorial, não um atalho de automação. Use quando a intenção for substituir deliberadamente o HTML existente e mantenha o recibo anterior se precisar comparar versões.

> Atenção: o `verify.mjs` sem `--strict` sai com código 0 mesmo quando há drift; ele relata `ok: false` no JSON. Em CI, use `--strict` para transformar drift em falha de processo.

> Limitação: hashes provam que os bytes mudaram ou permaneceram iguais; não provam que o significado da seção continua correto. A decisão de reescrever continua humana.

## Decisões e limites

O projeto faz escolhas explícitas para manter o produto portátil, auditável e reproduzível. As decisões abaixo explicam o comportamento atual; não são um roadmap.

| Decisão | Efeito | Trade-off |
|---|---|---|
| HTML único e offline | Leitura em ambientes fechados, sem servidor ou CDN | Arquivo maior; sem atualização remota |
| Renderização em tempo de build | SVG, gráficos e Mermaid não dependem de runtime | O build precisa de Node; o HTML não |
| Inputs em Markdown/JSON | Edição, revisão e versionamento simples | Títulos H2 e manifesto precisam ser mantidos em sincronia |
| Inspeção estática | Zero execução de código e zero tokens de LLM | Heurísticas podem gerar falsos positivos |
| Hashes + Git no recibo | Drift detectável e impacto rastreável | Não há prova semântica nem de execução |
| Sanitização e validação | Bloqueiam HTML perigoso, ativos externos e estruturas quebradas | Conteúdo precisa respeitar o contrato de autoria |
| Interface responsiva (desktop + mobile) | Sidebar fixa em ~1440 px e drawer lateral recolhível em ≤ 960 px | Tabelas e diagramas extensos usam rolagem horizontal local em telas estreitas |
| Temas por cor | Vermelho primeiro e padrão, com Azul alternável e preferência persistida | A troca de tema não altera layout, conteúdo ou semântica |
| Rolagem de tabelas | A roda rola a tabela quando ela tem overflow e a página quando não tem | Tabelas altas ainda rolam internamente antes de encadear |
| Dependências fixadas | Builds reproduzíveis e auditoria de versões | Atualização exige mudança consciente do lockfile |
| Separação skill × projeto | O gerador é reutilizável; o conteúdo fica no repositório documentado | A skill precisa ser instalada ou referenciada no ambiente de autoria |

### Limitações conhecidas

| Limitação | Impacto na leitura | Mitigação |
|---|---|---|
| Snapshot estático | Não prova execução, deploy ou telemetria de produção | Declarar `dataAsOf` e distinguir código de observação |
| Extração heurística | Rotas, stacks e notebooks de teste podem parecer produção | Confirmar no código e citar `arquivo:linha` |
| `.css` fora da lista de extensões | O dossiê não inventaria folhas de estilo | Ler `assets/document.css` quando o visual for relevante |
| Títulos H2 exatos | Pequenas diferenças de acento ou ordem quebram o build | Comparar manifesto e conteúdo antes de compilar |
| Duas versões editoriais | Manual completo e Guia Rápido exigem dois inputs | Usar `companionDoc` e manter o guia enxuto |
| Gráfico apenas de barras | Séries temporais e valores negativos não são suportados | Outro renderizador documentado ou tabela |
| Impacto depende de `sections[].sources` | Fontes não vinculadas não são roteadas | Preencher `sources` em todas as seções aplicáveis |
| Validação estrutural | Não garante clareza, precisão ou beleza | Revisão em desktop/mobile e leitura crítica |
| Mermaid embutido no build | Não há edição interativa no HTML final | Editar o texto do fence e recompilar |
| Diagramas largos em telas estreitas | Diagramas detalhados exigem arraste lateral em smartphones | Usar rolagem horizontal local ou o botão Ampliar (Ajustar à tela) |

> Regra de negócio: a skill documenta o estado atual. Backlog de defeitos, maturidade, severidade e plano de modernização não fazem parte da entrega, a menos que solicitados explicitamente.

> Limitação: nunca reproduza valores de segredo encontrados no código. Descreva onde vivem (por exemplo, Key Vault, `dbutils.secrets`, variável de ambiente), qual é o papel e a necessidade de rotação, sem transformar a documentação em auditoria de segurança.

> Atenção: a ausência de um dado não é zero. Se não há telemetria, o documento deve dizer que não há; não deve inventar volumes, SLAs ou resultados para preencher cartões.

## Glossário e referências

| Termo | Significado neste projeto |
|---|---|
| Skill | Pacote operacional com instruções e scripts que um agente carrega para executar a documentação |
| Manifesto | `document.json`, contrato do manual: seções, fontes, cartões, modo e tema |
| Dossiê | `inventory.json`, fotografia estática do repositório com arquivos, símbolos e grafo |
| Plano de leitura | `reading-plan.md`, ordem priorizada de leitura em quatro ondas |
| Onda de leitura | Agrupamento de arquivos por papel e centralidade (entrypoints, core, contratos, testes) |
| Fence | Bloco de código Markdown com linguagem especial, como `solution`, `schema`, `chart` ou `mermaid` |
| Diagrama 2D | SVG determinístico renderizado em grade de colunas e linhas pelo `diagrams.mjs` |
| Recibo | `validation.json`, resultado do build com erros, avisos, métricas e hashes |
| Drift | Diferença entre o estado atual das fontes e o estado registrado no recibo |
| `stale` | Seção cujas fontes diretas ou transitivas mudaram e precisam de revisão |
| `fresh` | Seção cujas fontes declaradas permanecem com o mesmo hash |
| Guia Rápido | Modo `summary`, com 4 a 7 capítulos e estimativa de leitura |
| `companionDoc` | Link seguro entre o Guia Rápido e o Manual Completo |
| Callout | Citação Markdown tipada: regra, exemplo, atenção ou limitação |
| Fingerprint | Hash SHA-256 usado para comparar manifesto, Markdown, HTML e fontes |

### Arquivos de referência

| Arquivo | Conteúdo |
|---|---|
| `SKILL.md` | Fluxo operacional, decisões editoriais e política de manutenção da skill |
| `README.md` | Visão geral, requisitos, comandos, recursos e histórico resumido |
| `LICENSE` | Licença MIT oficial do projeto |
| `.gitattributes` | Política de quebra de linha LF e atributos binários |
| `.github/workflows/ci.yml` | Matriz CI Ubuntu/Windows (Node 22, Python 3.10+, Playwright Chromium) |
| `references/authoring.md` | Contrato de autoria, sintaxe de diagramas, contratos e revisão |
| `references/data-engineering.md` | Perfil para pipelines, nuvem, streaming, APIs e qualidade de dados |
| `references/tools.md` | Dependências, escopo e separação entre autoria e renderização |
| `schemas/document.schema.json` | Esquema JSON do manifesto (com `if/then` para `repoRoot`) |
| `schemas/diagram.schema.json` | Esquema JSON formal de `solution`/`flow`, `schema`/`erd` e `chartSpec` |
| `scripts/build.mjs` | Compilador, validação CLI, escrita atômica e recibo |
| `scripts/lib/` | Módulos `urls.mjs`, `hash.mjs`, `i18n.mjs` e `html-shell.mjs` |
| `scripts/diagrams.mjs` | Motor SVG 2D (validado via AJV) e enriquecimento de Mermaid |
| `scripts/validate.mjs` | Auditoria estrutural do HTML, links seguros e dos SVGs |
| `scripts/verify.mjs` | Hashes LF/binários, `receiptStatus`, revisão Git, impacto e atualização |
| `scripts/inspect_repo.py` | Fachada CLI do inspetor estático para dossiê e plano de leitura |
| `scripts/inspector/` | Pacote modular Python (`redaction.py`, `sql_parser.py`, `extractors.py`, `graph.py`) |
| `scripts/renderer-hash.mjs` | Hash SHA-256 determinístico dos assets, libs, schemas e lockfile do renderer |
| `assets/document.css` | Design system, temas e estilos `@media print` (incluindo linhas filtradas) |
| `assets/document.js` | Busca, filtros (`aria-pressed`), temas, zoom `Fit` monótono e `inert` sincronizado |
| `examples/minimal/` | Exemplo mínimo executável |
| `examples/showcase/` | Exemplo completo com as 11 categorias e diagramas avançados |
| `tests/` | **63 testes** em 8 arquivos (incluindo `tests/browser.test.mjs` em Chromium headless) |

Este manual foi gerado a partir do estado local v1.12.0 sobre a revisão `2d4277fce3d5af7bb63f6d4df01d75d1fe607c98` em 16/11/2026 (alterações ainda não commitadas). As referências completas de cada capítulo aparecem no bloco **Referências do documento**, gerado automaticamente a partir de `sources[]`. Para aprofundar, comece por [Como usar](#uso), [Desenho da solução](#solucao) e [Operação e recuperação](#operacao).
