# project-html-docs

Gerador de documentação técnica e funcional para projetos de software e engenharia de dados, compilado em um único arquivo HTML estático, interativo e totalmente offline.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-%3E%3D3.10-blue.svg)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/tests-25%20passing-success.svg)](#testes-automatizados)
[![Version](https://img.shields.io/badge/version-1.4.0-orange.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## O que é

O `project-html-docs` é uma ferramenta desenvolvida para transformar o código implementado de um projeto em um manual técnico completo, reunindo arquitetura, regras de negócio, fluxos de dados, modelos de tabelas e instruções operacionais em um único arquivo `.html`.

O resultado não depende de servidores web, frameworks dinâmicos ou acesso à internet. Qualquer pessoa na equipe pode abrir o arquivo diretamente no navegador (Chrome, Edge, Firefox, Safari) e ter acesso a uma interface rápida, com busca local e diagramas interativos. É especialmente útil para documentar projetos em ambientes corporativos fechados, auditorias regulatórias ou entregas formais de engenharia de dados.

---

## Principais recursos

- **Arquivo único e offline**: CSS, JavaScript e imagens vetoriais (SVG) são incorporados no próprio HTML.
- **Temas integrados**: Alternância entre o tema padrão e o tema corporativo Santander diretamente pela barra de ferramentas, salvando a preferência no navegador.
- **Motor próprio de diagramas 2D em SVG**: Suporte nativo a diagramas de arquitetura (`solution`) e modelagem de tabelas com linhagem (`schema`), sem depender de bibliotecas externas no navegador.
- **Navegação focada em diferentes públicos**:
  - Filtro por perfil de leitor (*Todas*, *Visão de negócio*, *Visão técnica*, *Operação*), permitindo que áreas de negócio e times técnicos foquem no que interessa sem perder seções do documento.
  - Busca instantânea com realce de termos encontrados e atalhos rápidos (`/` ou `Ctrl+K`).
  - Campo de filtro automático em tabelas com 8 ou mais linhas (dicionários de dados), inclusive dentro de seções expansíveis.
  - Formatação visual automática para regras de negócio, exemplos práticos e avisos em citações Markdown.
- **Mapeador de código sem consumo de tokens**: Script Python que inspeciona o repositório via AST e extrai estruturas de pipelines (PySpark, Databricks, Delta Lake, Cosmos DB, Event Hubs, ADLS Gen2, APIs e SQL), montando um plano de leitura organizado em 4 etapas ordenadas.
- **Verificação de integridade e impacto incremental**: Checagem de alterações por hash SHA-256 no código-fonte, apontando exatamente quais seções da documentação precisam ser atualizadas quando o código mudar.

---

## Estrutura do projeto

```text
project-html-docs/
├── assets/
│   ├── document.css            # Estilos visuais, temas (Padrão e Santander) e layout
│   └── document.js             # Lógica de busca, temas, filtros e controles do modal
├── examples/
│   ├── minimal/                # Exemplo simples de documentação funcional
│   └── showcase/               # Exemplo completo com as 11 seções e diagramas avançados
├── references/
│   ├── authoring.md            # Guia prático de redação e sintaxe
│   ├── data-engineering.md     # Boas práticas para esteiras de dados e nuvem
│   └── tools.md                # Descrição das dependências do gerador
├── schemas/
│   └── document.schema.json    # Validação estrutural do arquivo document.json
├── scripts/
│   ├── build.mjs               # Compila os arquivos fonte no HTML final
│   ├── diagrams.mjs            # Motor de renderização de diagramas em SVG
│   ├── inspect_repo.py         # Análise estática do repositório e geração do plano de leitura
│   ├── validate.mjs            # Validador de integridade e qualidade do HTML
│   └── verify.mjs              # Checagem de hashes SHA-256 e cálculo de impacto incremental
├── tests/
│   ├── build.test.mjs          # Testes do compilador e validador HTML
│   ├── diagrams.test.mjs       # Testes unitários do motor de diagramas
│   └── dossier.test.mjs        # Testes de mapeamento estático e impacto
├── CHANGELOG.md                # Registro de novidades de cada versão
├── package.json                # Dependências fixadas e scripts de execução
└── SKILL.md                    # Instruções operacionais para execução guiada por agentes
```

---

## Requisitos

- **Node.js**: 22 ou superior
- **Python**: 3.10 ou superior (usado apenas no script `inspect_repo.py`)

Para instalar as dependências do projeto:

```bash
npm ci --ignore-scripts
```

---

## Como usar

O fluxo de documentação é dividido em quatro etapas principais:

### 1. Inspecionar o código do projeto
Para entender a estrutura do repositório sem precisar ler arquivo por arquivo manualmente:

```bash
python scripts/inspect_repo.py <caminho-do-repositorio> --out docs/inventory.json --plan docs/reading-plan.md
```

Isso gera:
- `inventory.json`: Inventário técnico com arquivos, tecnologias identificadas e grafo de dependências.
- `reading-plan.md`: Roteiro sugerido de leitura em 4 ondas ordenadas (configurações centrais → esteira principal → esquemas e consultas → testes), indicando os trechos de linhas mais relevantes.

### 2. Escrever o manifesto e o conteúdo
Crie uma pasta com os arquivos da sua documentação:
- **`document.json`**: Informações básicas (título, versão, cartões de destaque, idioma, tema e lista de seções com suas respectivas fontes de código).
- **`content.md`**: O texto em si, estruturado com títulos `## H2` que correspondem exatamente aos títulos declarados no `document.json`.

Você pode usar como base os exemplos em `examples/minimal/` ou `examples/showcase/`.

### 3. Gerar o arquivo HTML
Para compilar o documento em arquivo único:

```bash
node scripts/build.mjs docs/document.json --out docs/documentacao.html --force
```

O comando valida a estrutura contra o esquema JSON, processa o Markdown, renderiza os diagramas em SVG inline e salva o resultado final pronto para visualização.

### 4. Validar e auditar
Para conferir se o documento reflete fielmente os arquivos referenciados e salvar o recibo de validação:

```bash
node scripts/verify.mjs docs/document.json docs/documentacao.validation.json
```

---

## Atualizações incrementais com análise de impacto

Quando o código do projeto for alterado, você não precisa reler o repositório inteiro para saber o que atualizar:

```bash
# 1. Atualize o inventário técnico
python scripts/inspect_repo.py <caminho-do-repositorio> --out docs/inventory.json

# 2. Calcule o impacto das mudanças no documento existente
node scripts/verify.mjs docs/document.json docs/documentacao.validation.json --impact --dossier docs/inventory.json --plan docs/update-plan.md
```

O arquivo `update-plan.md` gerado listará:
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
        { "name": "event_id", "type": "STRING", "badge": "PK" },
        { "name": "device_id", "type": "STRING", "badge": "FK" },
        { "name": "data_particao", "type": "DATE", "badge": "PARTIÇÃO" },
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
        { "name": "data_referencia", "type": "DATE", "badge": "PK" },
        { "name": "device_id", "type": "STRING", "badge": "PK" },
        { "name": "total_eventos", "type": "BIGINT", "badge": "NOT NULL" }
      ]
    }
  ],
  "relations": [
    { "from": "t_origem", "to": "t_destino", "cardinality": "1..N", "kind": "lineage", "label": "agregação" }
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

A suíte de testes cobre a validação estrutural do HTML, renderização de diagramas SVG, desvios de rota, mapeamento AST de repositórios e análise de impacto:

```bash
# Rodar todos os testes unitários
npm test

# Compilar os exemplos disponíveis
npm run build:example
npm run build:showcase
```

---

## Licença

Distribuído sob licença MIT. Consulte o arquivo `package.json` para mais informações.
