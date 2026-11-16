## O que é e para quem

O `project-html-docs` transforma o **estado implementado** de um repositório em um manual técnico e funcional, entregue como **um único HTML offline**. Ele não audita, não redesenha e não promete modernização: explica o que existe, como se conecta, quais regras aplica e como é operado.

O mesmo documento atende dois públicos. Leitores de negócio encontram propósito, entradas, saídas, grão, regras e limites. Leitores técnicos encontram arquitetura, fluxos, contratos, dicionários, comandos e rastreabilidade entre fonte e afirmação. A interface oferece filtro por perfil, busca local, tabelas pesquisáveis, diagramas vetoriais e impressão.

<div class="cards">
<div class="card"><h3>Negócio</h3><p>O que o projeto entrega, quem consome, qual o grão e quais regras mudam o resultado.</p></div>
<div class="card"><h3>Técnico</h3><p>Componentes, processamento, contratos de arquivos, dependências e decisões de implementação.</p></div>
<div class="card"><h3>Operação</h3><p>Pré-requisitos, comandos, verificação de integridade e recuperação de falhas previsíveis.</p></div>
</div>

A versão atual é a **1.12.0**, com **63 testes definidos**; 61 passaram nesta execução e 2 testes opcionais de navegador foram ignorados por ausência de playwright-cli. Os temas são **Vermelho** (primeiro e padrão) e **Azul**; a escolha fica no `localStorage` sem sobrescrita passiva na carga, e valores antigos são migrados (`santander` → vermelho, `default` → azul). A interface combina barra fixa no desktop com menu lateral recolhível no mobile (`inert` sincronizado + *focus trap*), zoom `Fit` monótono, impressão de tabelas filtradas, validação formal AJV e hashes canônicos LF.

A v1.12.0 acrescenta `review` via Chrome/Edge/Chromium instalado, sem novas dependências npm. O padrão captura hero, figuras e seções com erro em 1440 px. O gate de `verify --mark-reviewed --rubric <arquivo>` exige hash atual, checks aprovados e todos os tiles inspecionados; `--accept-issues` registra uma exceção visual justificada. Cards recebem quebra defensiva de identificadores e grades por contagem.

> Regra de negócio: documentar é descrever o comportamento atual e comprovável. Planos históricos e intenções não substituem a implementação; quando o código não sustenta uma afirmação, ela não deve ser publicada.

> Limitação: o código prova a implementação, não uma execução bem-sucedida em produção. O manual deve declarar essa fronteira quando não houver telemetria ou contexto de produto.

## Como funciona

A solução separa **compilação** e **verificação**. A compilação é local e resolve todos os visuais em tempo de build. A verificação compara o que foi documentado com o estado atual das fontes e produz um plano de revisão. A inspeção estática do repositório é opcional para compilar, mas alimenta a leitura cirúrgica e a análise de impacto.

```solution
{
  "title": "Do repositório ao HTML verificado",
  "inputs": { "label": "ENTRADAS" },
  "zones": [
    { "id": "z1", "title": "COMPILAÇÃO", "subtitle": "local, sem servidor", "variant": "warm", "row": 0, "colStart": 1, "colSpan": 2 },
    { "id": "z2", "title": "VERIFICAÇÃO", "subtitle": "hashes e impacto", "variant": "cool", "row": 1, "colStart": 1, "colSpan": 2 }
  ],
  "nodes": [
    { "id": "repo", "col": 0, "row": 0, "shape": "cylinder", "role": "regulator", "title": "Repositório", "lines": ["código e configuração", "revisão Git"] },
    { "id": "manifest", "col": 0, "row": 1, "role": "neutral", "title": "Manifesto + Markdown", "lines": ["seções e fontes", "diagramas em fences"] },
    { "id": "build", "col": 1, "row": 0, "step": 1, "role": "step", "title": "build.mjs", "lines": ["schema + sanitização", "shell offline"] },
    { "id": "render", "col": 2, "row": 0, "step": 2, "role": "step", "title": "Renderizadores", "lines": ["SVG 2D e chart", "Mermaid"] },
    { "id": "html", "col": 2, "row": 0, "shape": "cylinder", "role": "output", "title": "HTML único", "lines": ["CSS/JS/SVG inline", "leitura offline"] },
    { "id": "verify", "col": 1, "row": 1, "step": 3, "role": "step", "title": "verify.mjs", "lines": ["SHA-256 + Git", "impacto por grafo"] },
    { "id": "plan", "col": 2, "row": 1, "role": "output", "title": "Plano de revisão", "lines": ["seções stale", "fontes alteradas"] }
  ],
  "edges": [
    { "from": "repo", "to": "build", "label": "fontes" },
    { "from": "manifest", "to": "build", "label": "Markdown" },
    { "from": "build", "to": "render", "label": "tokens + JSON" },
    { "from": "render", "to": "html", "label": "SVG inline" },
    { "from": "build", "to": "verify", "label": "recibo" },
    { "from": "verify", "to": "plan", "label": "gera" }
  ],
  "legend": [
    { "type": "box", "role": "regulator", "label": "Repositório" },
    { "type": "box", "role": "step", "label": "Etapa executável" },
    { "type": "box", "role": "output", "label": "Artefato entregue" }
  ],
  "note": "O inspect_repo.py é opcional para compilar; ele alimenta a leitura e, com --impact, o verify.mjs."
}
```

| Etapa | O que faz | Saída |
|---|---|---|
| Inspeção | Varre o repositório com AST e regex, sem executar o código | `inventory.json` e `reading-plan.md` |
| Build | Valida o manifesto, tokeniza o Markdown, renderiza diagramas e sanitiza o HTML | `documentacao.html` |
| Recibo | Registra hashes, revisão, métricas e avisos | `validation.json` |
| Verificação | Compara fontes e revisão, calcula dependentes e seções afetadas | Relatório JSON e `update-plan.md` |

O `build.mjs` usa AJV para o schema do manifesto (`document.schema.json`) e dos diagramas (`diagram.schema.json`), Marked para o Markdown, sanitize-html para o conteúdo e Cheerio para a auditoria. O `diagrams.mjs` desenha `solution`/`flow`/`schema` em SVG e enriquece Mermaid. O `validate.mjs` rejeita ativos externos, URLs com controle/protocolo inseguro, âncoras quebradas, SVG inválido, tabelas sem cabeçalho e LaTeX não renderizado. O `verify.mjs` lê o recibo, valida `receiptStatus` + SHA-256 LF (`sha256-lf-text-v1`) e percorre o grafo do dossiê modular (`scripts/inspector/*`).

> Regra de negócio: o HTML é a entrega, mas os inputs continuam sendo a fonte editável. Nenhum fato deve existir apenas dentro do HTML.

> Limitação: a inspeção é heurística. Rotas de teste, fixtures e referências podem parecer produção; confirme no código e cite `arquivo:linha` quando a afirmação for específica.

## Como usar

A entrada única é `scripts/cli.mjs`: `doctor` confere Node, Python e dependências; `inspect`, `build` e `verify` devolvem JSON com caminhos resolvidos. Para executar de outra pasta, use o caminho absoluto da CLI entre aspas. Os scripts internos continuam disponíveis por compatibilidade.

A instalação enxuta usa o ZIP versionado da Release: extraia em uma pasta `project-html-docs`, execute `npm ci --ignore-scripts --prefix "<skill>"` e `node "<skill>/scripts/cli.mjs" doctor`. O ZIP inclui apenas a skill, scripts, assets, schemas, referências, exemplo mínimo, licença e manifests npm; não inclui vídeos, landing page, testes nem node_modules. A LLM lê `SKILL.md` e consulta as referências sob demanda. No repositório de desenvolvimento, `npm run package:skill` gera o arquivo em `dist/`.

A autoria exige **Node 22+** e **Python 3.10+**. O leitor final precisa apenas de um navegador. As dependências são instaladas uma vez e ficam fixadas pelo `package-lock.json`.

```bash
# 1. Instalar
npm ci --ignore-scripts

# 2. Mapear o repositório (opcional, mas recomendado)
node scripts/cli.mjs inspect . --out docs/inventory.json --plan docs/reading-plan.md

# 3. Compilar o manual completo
node scripts/cli.mjs build docs/document.json --out docs/documentacao.html

# 4. Verificar as fontes
node scripts/cli.mjs verify docs/document.json docs/documentacao.validation.json

# 5. Rodar a suíte quando o gerador mudar
npm test
```

O manifesto exige `title`, `subtitle`, `version`, `updated`, `content` e `sections`. Aceita `language`, `theme` (`vermelho` ou `azul`), `mode` (`full` ou `summary`), `cards`, `companionDoc`, `repoRoot`, `revision`, `dataAsOf` e `sources`. Cada seção tem `id`, `title`, `audience` e, idealmente, `sources`.

| Comando | Resultado |
|---|---|
| `node scripts/cli.mjs inspect <repo> --out <json> --plan <md>` | Dossiê estático e plano de leitura |
| `node scripts/cli.mjs build <manifest> --out <html>` | Manual completo e recibo |
| `node scripts/cli.mjs build <manifest> --out <html> --mode summary` | Guia Rápido e recibo |
| `node scripts/cli.mjs verify <manifest> <receipt> [--html <html>]` | Conferência de fontes LF, artefatos e revisão (`sourceDrift`) |
| `node scripts/cli.mjs verify <manifest> <receipt> --strict --mark-reviewed --rubric <rubric.md>` | Marca `browserReviewed: true` após review e rubrica aprovados (desktop por padrão) |
| `node scripts/cli.mjs verify <manifest> <receipt> --impact --dossier <json> --plan <md>` | Plano de atualização por impacto |
| `node scripts/cli.mjs review <html> --out <dir>` | Checks via CDP, PNGs, review.json e rubric.md |
| `npm test` | 63 testes da suíte (incluindo Chromium headless) |

O conteúdo começa com um `##` cujo texto coincide, na ordem, com `sections[].title`. Cada `###` vira subnavegação. Um `#` é reservado ao título do documento. Tabelas ganham cabeçalho fixo e filtro a partir de 8 linhas; a roda da página continua funcionando sobre tabelas curtas.

Para gerar as duas versões, use manifestos separados: `document.json` em modo `full` e `document-summary.json` em modo `summary`, com `companionDoc` apontando um para o outro. O build nunca sobrescreve sem `--force` e só grava depois que a validação estrutural passa.

> Atenção: o leitor final não precisa de Node, Python ou servidor. O HTML pode ser copiado, anexado ou aberto localmente.

> Limitação: o build não prova qualidade semântica nem visual. Execute `review` em desktop (1440 px por padrão), inspecione os tiles e preencha a rubrica. Acrescente `--viewports 1440,1024,390` quando mobile/tablet for solicitado.

## Regras e limites

| Regra | Efeito |
|---|---|
| H1 no Markdown | Erro: o H1 é exclusivo do título do manifesto |
| H2 fora de ordem ou com texto diferente de `sections[].title` | Erro de build |
| Fonte desconhecida ou fora do `repoRoot` | Erro: o caminho precisa ser local e existir |
| Saída existente sem `--force` | Erro: atualização precisa ser deliberada |
| HTML perigoso, script externo, iframe ou CDN | Erro de validação: o produto é offline |
| Tabela sem cabeçalho, figura sem legenda, `details` sem `summary` | Erro de validação |
| LaTeX não renderizado | Erro: use Unicode e HTML |
| Mais de 70% das seções com `audience: "all"` | Aviso de distribuição de audiência |
| Mais de 50% das seções sem `sources` | Aviso: o impacto não conseguirá rotear a revisão |
| Guia Rápido com mais de 8 seções ou 3.500 palavras | Aviso de concisão |
| `theme` ausente | Vermelho |
| Gráfico com valor negativo, rótulo repetido ou mais de 40 categorias | Erro |

> Regra de negócio: uma seção sem `sources` não participa do roteamento de impacto. Declarar as fontes é parte do contrato de autoria.

> Atenção: avisos não interrompem o build; erros sim. O recibo mostra `passed: false` apenas quando há erro estrutural.

| Limitação | Impacto | Mitigação |
|---|---|---|
| Snapshot estático | Não prova execução ou produção | Declarar `dataAsOf` |
| Extração heurística | Falsos positivos de stacks e rotas | Confirmar no código e citar `arquivo:linha` |
| `.css` fora do inspetor | Folhas de estilo não entram no dossiê | Ler o CSS quando o visual for relevante |
| Títulos H2 exatos | Acento ou ordem divergente quebra o build | Comparar manifesto e conteúdo |
| Gráfico só de barras | Sem séries temporais ou valores negativos | Usar tabela ou outro renderizador |
| Validação estrutural | Não garante clareza ou beleza | Revisão em desktop/mobile e leitura crítica |
| Diagramas largos no mobile | Exigem arraste lateral em telas estreitas | Usar rolagem local ou Ampliar (Ajustar à tela) |

> Limitação: a skill documenta o estado atual. Backlog de defeitos, maturidade, severidade e plano de modernização não fazem parte da entrega, a menos que solicitados.

> Atenção: nunca reproduza segredos encontrados no código. Descreva onde vivem e qual é o papel, sem expor valores.

## Verificação e atualização

O `verify.mjs` relê o manifesto e o recibo (`receiptStatus`), confere hashes canônicos LF (`sha256-lf-text-v1`) das fontes, dos artefatos de autoria (`manifestSha256`, `inputSha256`, `htmlSha256`) e do renderer da skill (`rendererSha256`, incluindo libs e `package-lock.json`), detecta fontes inesperadas e diferencia commits exclusivos de documentação via `revision.sourceDrift`. Com `--impact`, ele percorre o grafo do dossiê, encontra dependentes transitivos, marca apenas as seções `stale` e avisa quando basta rodar `build.mjs --force`; com `--mark-reviewed --rubric <arquivo>`, valida o gate visual e grava `browserReviewed: true` e `browserReviewedAt` no recibo após validação visual real.

```bash
node scripts/cli.mjs inspect . --out docs/inventory.json --plan docs/reading-plan.md
node scripts/cli.mjs verify docs/document.json docs/documentacao.validation.json --impact --dossier docs/inventory.json --plan docs/update-plan.md
```

O plano mostra fontes alteradas, dependentes, arquivos core novos (truncando listagens acima de 25 itens), resumo `git diff --stat` e as seções que precisam de revisão. Se uma fonte mudou e não está vinculada a nenhuma seção, o plano avisa; corrija `sections[].sources` antes de confiar no roteamento.

```chart
{"type":"bar","title":"Testes definidos por arquivo (1.12.0)","unit":"testes","source":"Definições em tests/*.test.mjs; browser opcionais","asOf":"2026-11-16","data":[{"label":"tests/build.test.mjs","value":24,"variant":"success"},{"label":"tests/diagrams.test.mjs","value":13,"variant":"accent"},{"label":"tests/dossier.test.mjs","value":7,"variant":"neutral"},{"label":"tests/landing.test.mjs","value":5,"variant":"accent"},{"label":"tests/browser.test.mjs","value":2,"variant":"neutral"},{"label":"tests/cli.test.mjs","value":4,"variant":"success"},{"label":"tests/review-browser.test.mjs","value":4,"variant":"success"},{"label":"tests/review-gate.test.mjs","value":4,"variant":"success"}]}
```

| Sintoma | Causa provável | Ação |
|---|---|---|
| `Output already exists` | HTML de destino já existe | Usar outro nome ou `--force` |
| H2 não coincide | Título ou ordem divergente | Alinhar manifesto e conteúdo |
| `Unknown source` | ID de fonte inexistente | Adicionar a fonte ou corrigir o ID |
| `verify` com `changed` | Fonte mudou desde o build | Revisar a seção e recompilar |
| Revisão Git diferente | Commit novo desde o recibo | Rodar impacto e revisar `stale` |
| Página para de rolar sobre tabela | HTML antigo com contenção de roda | Recompilar com 1.7.0+ |
| `Template da skill atualizado` | CSS/JS/builder da skill mudou sem mudar o código | Rodar apenas `build.mjs --force` |

A revisão de entrega cobre overflow global, menu lateral recolhível no mobile (`inert` + *focus trap*), sidebar sem sobrepor o rodapé no desktop, subnavegação H3, botão de topo, rolagem local de tabelas e diagramas, busca sem acento com destaque de todas as ocorrências, estado sem resultados, cópia, temas (inclusive Mermaid), modal (`<= 960 px`) com Escape e impressão em desktop por padrão; inclua mobile/tablet quando solicitado.

> Regra de negócio: `--force` é uma decisão editorial, não um atalho de automação.

> Atenção: sem `--strict`, o `verify.mjs` sai com código 0 mesmo com drift; em CI, use `--strict`.

> Limitação: hashes provam alteração de bytes, não mudança de significado. A decisão de reescrever continua humana.

## Referências essenciais

| Arquivo | Conteúdo |
|---|---|
| `SKILL.md` | Fluxo operacional, decisões e manutenção da skill |
| `README.md` | Visão geral, requisitos, comandos e recursos |
| `references/authoring.md` | Contrato de autoria, sintaxe de diagramas e revisão |
| `schemas/document.schema.json` + `diagram.schema.json` | Esquemas AJV de manifesto, diagramas 2D e gráficos |
| `scripts/build.mjs` + `scripts/lib/*` | Compilador, sanitização URL/HTML, hashes LF e shell |
| `scripts/diagrams.mjs` | Diagramas SVG 2D e Mermaid |
| `scripts/validate.mjs` | Auditoria estrutural do HTML e dos SVGs |
| `scripts/verify.mjs` | Hashes LF, completeness do recibo, revisão Git e impacto |
| `scripts/inspect_repo.py` + `scripts/inspector/*` | Dossiê estático modular e plano de leitura |
| `assets/document.css` | Design system, temas e `@media print` |
| `assets/document.js` | Busca, filtros (`aria-pressed`), zoom `Fit` e `inert` |
| `examples/showcase/` | Exemplo completo com 11 categorias |

| Termo | Significado |
|---|---|
| Manifesto | `document.json`, contrato do manual |
| Dossiê | `inventory.json`, fotografia estática do repositório |
| Recibo | `validation.json`, resultado do build (`sha256-lf-text-v1`) |
| Drift | Diferença entre fontes atuais e recibo |
| `stale` | Seção cujas fontes mudaram e precisa de revisão |
| Guia Rápido | Modo `summary`, com 4 a 7 capítulos |

Para o detalhamento completo, consulte o [Manual completo](documentacao.html), gerado a partir do estado local v1.12.0 sobre a revisão `2d4277fce3d5af7bb63f6d4df01d75d1fe607c98` em 16/11/2026 (alterações ainda não commitadas).
