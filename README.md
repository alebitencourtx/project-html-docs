# project-html-docs

Gerador de documentação técnica e funcional para projetos de software e engenharia de dados, compilado em um único arquivo HTML estático, interativo e totalmente offline.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-%3E%3D3.10-blue.svg)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/tests-55%20cases-success.svg)](#testes-automatizados)
[![Version](https://img.shields.io/badge/version-1.11.0-orange.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## O que é

O `project-html-docs` é uma ferramenta desenvolvida para transformar o código implementado de um projeto em um manual técnico completo, reunindo arquitetura, regras de negócio, fluxos de dados, modelos de tabelas e instruções operacionais em um único arquivo `.html`.

O resultado não depende de servidores web, frameworks dinâmicos ou acesso à internet. Qualquer pessoa na equipe pode abrir o arquivo diretamente no navegador (Chrome, Edge, Firefox, Safari) e ter acesso a uma interface rápida, com busca local e diagramas interativos. É especialmente útil para documentar projetos em ambientes corporativos fechados, auditorias regulatórias ou entregas formais de engenharia de dados.

---

## Principais recursos

- **Arquivo único e offline**: CSS, JavaScript e imagens vetoriais (SVG) são incorporados no próprio HTML.
- **Dois modos de apresentação (Manual Completo vs Guia Rápido)**:
  - **Manual Completo (`mode: "full"`)**: Cobre toda a jornada com todas as seções, diagramas detalhados e dicionários completos.
  - **Guia Rápido / Visão Resumida (`mode: "summary"`)**: Versão panorâmica e objetiva para leitura em ~5 minutos, com 4 a 7 capítulos de alto sinal, badges de tempo de leitura e link cruzado (`companionDoc`) para o manual completo.
- **Temas integrados (Vermelho e Azul)**: Alternância entre os temas **Vermelho** (padrão) e **Azul** diretamente pela barra de ferramentas, salvando a preferência no navegador e harmonizando tanto o visual da página quanto as cores dos diagramas SVG 2D.
- **Motor próprio de diagramas 2D em SVG**: Suporte nativo a diagramas de arquitetura (`solution`) e modelagem de tabelas com linhagem (`schema`), com desvio inteligente de sobreposição de rótulos (*pill collision avoidance*) e sem depender de bibliotecas externas no navegador.
- **Navegação responsiva para desktop e mobile**:
  - Barra lateral flexível com rolagem independente no desktop e menu lateral recolhível (drawer off-canvas com barra superior compacta, botão de busca rápida, fechamento por `Esc`, backdrop ou seleção de capítulo) em telas menores (≤ 960 px).
  - Subnavegação automática para títulos `H3` recuados sob cada capítulo principal.
  - Botão flutuante para voltar ao topo da página com rolagem suave.
  - Filtro por perfil de leitor (*Todas*, *Visão de negócio*, *Visão técnica*, *Operação*), permitindo que áreas de negócio e times técnicos foquem no que interessa sem perder seções do documento.
  - Busca instantânea com realce de termos encontrados e atalhos rápidos (`/` ou `Ctrl+K`).
  - Campo de filtro automático em tabelas com 8 ou mais linhas (dicionários de dados), inclusive dentro de seções expansíveis e sem travar a rolagem vertical da página.
  - Formatação visual automática para regras de negócio, exemplos práticos e avisos em citações Markdown.
- **Mapeador estático de código sem consumo de tokens**: Script Python que inspeciona o repositório via AST e extrai estruturas completas:
  - Pipelines PySpark (incluindo chamadas encadeadas de leitura/escrita, opções e particionamento).
  - Databricks notebooks, comandos mágicos `%run` e chamadas `dbutils.notebook.run`.
  - Pipelines JSON do Azure Data Factory e Azure Synapse.
  - Tecnologias de nuvem e streaming: Delta Lake, Cosmos DB, Event Hubs, ADLS Gen2, APIs (FastAPI/Flask) e código Scala.
  - Parâmetros de CLI (`argparse`, `click`, `typer`) e variáveis de ambiente (`os.getenv`).
  - Suporte a arquivo `.docignore` na raiz do projeto com globs, negações (`!`) e caminhos ancorados (`/`), extração JS/TS (`interface`, `type`, `enum`, *arrow functions*, `process.env`/`import.meta.env`) e redação automática de segredos em previews e workflows.
  - Montagem de um plano de leitura organizado em 4 etapas ordenadas (`reading-plan.md`).
- **Verificação de integridade e impacto incremental**: Checagem de alterações por hash SHA-256 nos códigos-fonte, nos artefatos de autoria (`manifestSha256`, `inputSha256`, `htmlSha256`) e nos templates/assets da própria skill (`rendererSha256`), diferenciando commits apenas de documentação (`sourceDrift`), suportando `--mark-reviewed` pós-inspeção visual e apontando no `update-plan.md` quais seções precisam de revisão ou quando basta regerar o HTML com `build.mjs --force`.
- **Landing Page e Showcase Oficial**: Apresentação interativa em `docs/index.html` pronta para publicação no GitHub Pages (pasta `/docs`), com vídeo demonstrativo, alternador de idiomas e navegação direta para o Manual Completo e Guia Rápido.

---

## Estrutura do projeto

```text
project-html-docs/
├── .gitattributes              # Política de fim de linha LF e atributos binários
├── .github/
│   ├── scripts/
│   │   └── package_skill.py    # Empacotador determinístico do ZIP enxuto de release
│   └── workflows/
│       ├── ci.yml              # Matriz CI Ubuntu/Windows (Node + Python + Playwright)
│       └── release.yml         # Publicação automática do ZIP versionado nas tags v*
├── agents/
│   └── openai.yaml             # Metadados UTF-8 de descoberta da skill
├── assets/
│   ├── document.css            # Estilos visuais, layout responsivo e temas (Vermelho e Azul)
│   └── document.js             # Busca, filtros, drawer mobile inert/trap, zoom e impressão
├── docs/                       # Landing page e documentação oficial (GitHub Pages)
│   ├── index.html              # Landing page interativa bilíngue (PT/EN)
│   ├── landing.css             # Estilos da landing page
│   ├── landing.js              # Interatividade e navegação WAI-ARIA da landing page
│   ├── landing-i18n.mjs        # Dicionários de tradução, ARIA e receitas válidas
│   ├── demo.mp4                # Vídeo demonstrativo da skill
│   ├── demo-poster.png         # Pôster do vídeo demonstrativo
│   ├── documentacao.html       # Manual completo do próprio gerador
│   └── documentacao-resumida.html # Guia rápido do próprio gerador
├── examples/
│   ├── minimal/                # Exemplo simples de documentação funcional
│   └── showcase/               # Exemplo completo com as 11 seções e diagramas avançados
├── references/
│   ├── authoring.md            # Guia prático de redação, sintaxe e validações
│   ├── data-engineering.md     # Boas práticas para esteiras de dados, nuvem e streaming
│   ├── diagrams.md             # Especificação de diagramas 2D, Mermaid, gráficos e design system
│   └── tools.md                # Descrição das dependências do gerador
├── schemas/
│   ├── diagram.schema.json     # Esquema JSON formal de solution, flow, schema e barChart
│   └── document.schema.json    # Validação estrutural do manifesto document.json
├── scripts/
│   ├── build.mjs               # Compila manifesto e Markdown no HTML final e recibo
│   ├── cli.mjs                 # Entrada única de CLI (inspect, build, verify e doctor)
│   ├── diagrams.mjs            # Motor SVG 2D (solution/flow/schema) e enhancer Mermaid
│   ├── inspect_repo.py         # Fachada CLI do dossiê estático AST/regex/grafo
│   ├── inspector/              # Pacote Python modular (redaction, sql_parser, extractors, graph)
│   ├── lib/                    # Módulos compartilhados (urls, hash, i18n, html-shell)
│   ├── renderer-hash.mjs       # Hash determinístico dos assets/scripts/lockfile da skill
│   ├── validate.mjs            # Validador estrutural de HTML, URLs, SVGs e navegação
│   └── verify.mjs              # Checagem estrita de recibos, hashes SHA-256 e impacto
├── tests/
│   ├── browser.test.mjs        # Testes reais em Chromium headless (drawer, zoom, print, ARIA)
│   ├── build.test.mjs          # Testes do compilador, segurança de URLs, colisões e recibos
│   ├── cli.test.mjs            # Testes da entrada única cli.mjs e do ZIP enxuto de release
│   ├── diagrams.test.mjs       # Testes unitários e de contrato AJV do motor de diagramas
│   ├── dossier.test.mjs        # Testes de AST, DDL, E/S, redação, grafo e impacto
│   └── landing.test.mjs        # Testes da landing page, i18n, receitas e consistência
├── CHANGELOG.md                # Registro de novidades de cada versão
├── LICENSE                     # Licença MIT
├── package.json                # Dependências fixadas e scripts de execução
├── README.md                   # Guia introdutório do projeto
└── SKILL.md                    # Porta de entrada enxuta para execução guiada por agentes
```

---

## Requisitos e instalação

- **Node.js**: 22 ou superior
- **Python**: 3.10 ou superior (usado apenas na etapa `inspect`)

### Instalação em IDEs / CLIs de LLM (ZIP enxuto ou Git)

Baixe o `.zip` versionado da Release (`project-html-docs-v1.11.0.zip`, contendo apenas `SKILL.md`, `LICENSE`, `agents/`, `scripts/`, `assets/`, `schemas/`, `references/`, `examples/minimal/`, `package.json` e `package-lock.json` — sem `docs/`, vídeo ou testes) e extraia na pasta de skills da sua IDE/CLI:

```bash
mkdir -p .claude/skills/project-html-docs
unzip project-html-docs-v1.11.0.zip -d .claude/skills/project-html-docs
npm ci --ignore-scripts --prefix .claude/skills/project-html-docs
node .claude/skills/project-html-docs/scripts/cli.mjs doctor
```

Também é possível clonar o repositório diretamente ou gerar o pacote local com `npm run package:skill`.

---

## Como usar

Você pode acionar toda a skill pela entrada única `scripts/cli.mjs` de qualquer diretório de trabalho:

### 1. Inspecionar o código do projeto
Para entender a estrutura do repositório sem precisar ler arquivo por arquivo manualmente:

```bash
node scripts/cli.mjs inspect <caminho-do-repositorio> --out docs/inventory.json --plan docs/reading-plan.md
```

Isso gera:
- `inventory.json`: Inventário técnico com arquivos, tecnologias identificadas e grafo de dependências.
- `reading-plan.md`: Roteiro sugerido de leitura em 4 ondas ordenadas (configurações centrais → esteira principal → esquemas e consultas → testes), indicando os trechos de linhas mais relevantes.

Caso precise ignorar pastas ou arquivos específicos, crie um `.docignore` na raiz do repositório inspecionado com os padrões a excluir.

### 2. Escrever o manifesto e o conteúdo
Crie uma pasta com os arquivos da sua documentação:
- **`document.json`**: Informações básicas (título, versão, cartões de destaque, idioma, tema e lista de seções com suas respectivas fontes de código).
- **`content.md`**: O texto em si, estruturado com títulos `## H2` que correspondem exatamente aos títulos declarados no `document.json`. Títulos `### H3` geram links automáticos de subnavegação na barra lateral.

Você pode usar como base os exemplos em `examples/minimal/` ou `examples/showcase/`.

### 3. Gerar o arquivo HTML (Manual Completo ou Guia Rápido)
Para compilar o manual completo em arquivo único:

```bash
node scripts/cli.mjs build docs/document.json --out docs/documentacao.html --force
```

Para compilar uma versão condensada no **Modo Guia Rápido**:

```bash
node scripts/cli.mjs build docs/document-summary.json --out docs/documentacao-resumida.html --mode summary --force
```

No manifesto do Guia Rápido, você pode adicionar o link para o manual completo:

```json
{
  "mode": "summary",
  "companionDoc": {
    "href": "documentacao.html",
    "label": "Manual completo"
  }
}
```

O comando valida a estrutura contra o esquema JSON, processa o Markdown, audita as dimensões e geometrias dos diagramas SVG e salva o resultado final pronto para visualização.

### 4. Validar e auditar
Para conferir se o documento reflete fielmente os arquivos referenciados e salvar o recibo de validação:

```bash
node scripts/cli.mjs verify docs/document.json docs/documentacao.validation.json
```

---

## Atualizações incrementais com análise de impacto

Quando o código do projeto for alterado, você não precisa reler o repositório inteiro para saber o que atualizar:

```bash
# 1. Atualize o inventário técnico
node scripts/cli.mjs inspect <caminho-do-repositorio> --out docs/inventory.json

# 2. Calcule o impacto das mudanças no documento existente
node scripts/cli.mjs verify docs/document.json docs/documentacao.validation.json --impact --dossier docs/inventory.json --plan docs/update-plan.md
```

O arquivo `update-plan.md` gerado listará:
- Se o template/CSS/JS da própria skill mudou desde a última compilação (`rendererSha256`), avisando quando basta rodar `build.mjs --force` sem precisar reler o código-fonte.
- Resumo estatístico do Git (`git diff --stat`) entre as versões.
- Quais arquivos de código sofreram alteração direta de hash.
- Quais módulos do sistema dependem deles e foram impactados indiretamente.
- Exatamente quais seções do documento estão desatualizadas (`stale`) e precisam de revisão.

---

## Sintaxe dos diagramas nativos

Os diagramas são escritos em blocos de código com JSON embutido no Markdown:

### Diagrama de arquitetura em grade (`solution` ou `flow`)

Permite organizar sistemas complexos em colunas e faixas horizontais coloridas, com passos numerados, nós de decisão e armazenamento:

````markdown
```solution
{
  "title": "Fluxo de Ingestão e Processamento",
  "cols": 3,
  "zones": [
    { "id": "z1", "title": "INGESTÃO", "subtitle": "Streaming contínuo", "variant": "warm", "row": 0, "colStart": 0, "colSpan": 3 },
    { "id": "z2", "title": "PERSISTÊNCIA", "subtitle": "Armazenamento analítico", "variant": "cool", "row": 1, "colStart": 1, "colSpan": 2 }
  ],
  "nodes": [
    { "id": "fonte", "col": 0, "row": 0, "role": "danger", "title": "Azure Event Hubs", "lines": ["tópico telemetry", "consumer group dedicado"] },
    { "id": "job", "col": 1, "row": 0, "role": "step", "step": 1, "title": "Structured Streaming", "lines": ["watermark 15 min", "validação de schema"] },
    { "id": "decisao", "col": 2, "row": 0, "shape": "decision", "role": "warning", "title": "Payload Válido?", "lines": ["contrato JSON"] },
    { "id": "delta", "col": 1, "row": 1, "shape": "cylinder", "role": "info", "title": "Delta Lake Bronze", "lines": ["partição ano/mes/dia"], "meta": "ADLS Gen2" },
    { "id": "mart", "col": 2, "row": 1, "role": "output", "step": 2, "title": "Tabela Agregada", "lines": ["camada Gold / BI"] }
  ],
  "edges": [
    { "from": "fonte", "to": "job", "label": "eventos brutos" },
    { "from": "job", "to": "decisao", "label": "valida formato" },
    { "from": "decisao", "to": "delta", "branch": "yes", "label": "Sim (grava lote)" },
    { "from": "decisao", "to": "decisao", "branch": "no", "style": "dashed", "label": "Não · quarentena" },
    { "from": "delta", "to": "mart", "label": "agregação diária" }
  ]
}
```
````

### Diagrama de tabelas e linhagem (`schema` ou `erd`)

Especifica tabelas, colunas, tipos, chaves e relações com definição clara do grão:

````markdown
```schema
{
  "title": "Modelagem de Tabelas e Linhagem",
  "entities": [
    {
      "id": "t_origem",
      "name": "raw_events",
      "kind": "table",
      "grain": "1 linha = 1 evento recebido",
      "col": 0, "row": 0,
      "columns": [
        { "name": "event_id", "type": "STRING", "key": "PK" },
        { "name": "device_id", "type": "STRING", "key": "FK" },
        { "name": "data_particao", "type": "DATE", "key": "PART" },
        { "name": "payload", "type": "STRING" }
      ]
    },
    {
      "id": "t_destino",
      "name": "fct_metrics_daily",
      "kind": "mart",
      "grain": "1 linha = 1 dispositivo por dia",
      "col": 1, "row": 0,
      "columns": [
        { "name": "data_referencia", "type": "DATE", "key": "PK" },
        { "name": "device_id", "type": "STRING", "key": "PK" },
        { "name": "total_eventos", "type": "BIGINT", "nullable": false }
      ]
    }
  ],
  "relations": [
    { "from": "t_origem", "to": "t_destino", "fromCard": "1", "toCard": "1..N", "kind": "lineage", "label": "agregação" }
  ]
}
```
````

---

## Formatações automáticas no texto

- **Destaques em citações**:
  Prefixos específicos em blockquotes aplicam cores e bordas semânticas automaticamente:
  - `> Regra de negócio:`: destaque azul com borda de ênfase.
  - `> Exemplo prático:`: destaque verde para cenários e cálculos ilustrativos.
  - `> Atenção:`: destaque âmbar para alertas operacionais.
  - `> Limitação:`: destaque vermelho para restrições técnicas conhecidas.

- **Badges de colunas em tabelas**:
  Palavras entre crases nas células de tabelas recebem formatação de etiqueta colorida automaticamente para termos como `` `PK` ``, `` `FK` ``, `` `UK` ``, `` `PARTIÇÃO` ``, `` `PII` `` e `` `NOT NULL` ``.

---

## Testes automatizados

A suíte de testes cobre a validação estrutural do HTML, modo summary, geometria dos diagramas SVG, desvios de rota, mapeamento AST de repositórios, análise de impacto e integridade da landing page:

```bash
# Rodar todos os testes automatizados (55 testes, incluindo Chromium headless)
npm test

# Compilar os exemplos disponíveis
npm run build:example
npm run build:showcase
```

---

## Histórico de releases

- **[v1.11.0](CHANGELOG.md#1110--2026-11-15)**: Entrada única de CLI (`scripts/cli.mjs` com `inspect`, `build`, `verify` e `doctor`), `SKILL.md` enxuto com detalhamento de diagramas/UI movido para `references/diagrams.md`, e empacotador/workflow automático do `.zip` enxuto de release (`.github/scripts/package_skill.py` + `.github/workflows/release.yml`).
- **[v1.10.0](CHANGELOG.md#1100--2026-11-15)**: Blindagem completa de URLs (rejeitando caracteres de controle e lista explícita de protocolos seguros), sanitização centralizada de segredos em previews/workflows/`package.json`, proteção atômica contra colisão de recibo/temporário, hashes canônicos `sha256-lf-text-v1` + `package-lock.json` no renderer, validação formal via `diagram.schema.json` e `if/then` de `repoRoot`, modularização em `scripts/lib/` e `scripts/inspector/`, correções de DDL/Blob/streaming/grafo, zoom Fit e drawer `inert`/impressão no navegador e testes reais em Chromium.
- **[v1.9.0](CHANGELOG.md#190--2026-11-15)**: Hardening de acessibilidade mobile (`inert`, focus trap, modal até 960 px), harmonização Mermaid no tema Vermelho, verificação de artefatos + `--mark-reviewed` + `sourceDrift` no `verify.mjs`, faixas múltiplas em diagramas 2D e extração JS/TS + `.docignore` completo no `inspect_repo.py`.
- **[v1.8.0](CHANGELOG.md#180--2026-11-15)**: Visão mobile responsiva com menu lateral recolhível (drawer off-canvas até 960 px) e detecção de atualização exclusiva do renderer da skill (`rendererSha256`) no `verify.mjs --impact`.
- **[v1.7.0](CHANGELOG.md#170--2026-11-15)**: Temas por cor (Vermelho padrão e Azul), remoção de retenção de rolagem sobre tabelas, nova landing page oficial em `docs/index.html` com vídeo demonstrativo, internacionalização e manual completo do gerador em `docs/`.
- **[v1.6.0](CHANGELOG.md#160--2026-11-14)**: Modo Guia Rápido / Visão Resumida (`mode: "summary"`, `--mode summary`), badges de tempo de leitura (`~N min de leitura`), link seguro `companionDoc`, contagem de palavras e avisos de concisão no recibo de validação.
- **[v1.5.0](CHANGELOG.md#150--2026-11-14)**: Sidebar flex com scroll independente, subnavegação H3, botão voltar ao topo, harmonização cromática do tema nos diagramas SVG, prevenção de colisão de rótulos, validação geométrica de SVGs, extração de cadeias PySpark, pipelines ADF, Scala e suporte a `.docignore`.
- **[v1.4.0](CHANGELOG.md#140--2026-11-14)**: Mapeamento estático profundo (AST Python, Databricks notebooks, PySpark, Event Hubs, Cosmos DB, ADLS Gen2, APIs), reading waves e análise incremental de impacto (`verify.mjs --impact`).
- **[v1.3.0](CHANGELOG.md#130--2026-11-14)**: Motor SVG 2D determinístico (`diagrams.mjs`), filtro de perfil de leitor, busca com highlight, tema Santander, controles de zoom e filtro local dinâmico em tabelas.
- **[v1.2.0](CHANGELOG.md#120--2026-11-14)**: Reengenharia de gráficos de barra SVG, ergonomia de leitura (76ch) e cabeçalhos fixos em tabelas.

---

## Licença

Distribuído sob [licença MIT](LICENSE). Consulte o arquivo `LICENSE` e `package.json` para mais informações.
