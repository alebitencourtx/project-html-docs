# Changelog

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
