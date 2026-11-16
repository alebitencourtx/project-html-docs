export const SUPPORTED_LANGS = ['pt', 'en'];

export const VIDEO_CHAPTERS = [
  { id: 'overview', time: 1.0 },
  { id: 'search', time: 7.0 },
  { id: 'diagram', time: 11.8 },
  { id: 'themes', time: 20.8 },
  { id: 'summary', time: 24.8 },
];

export const RECIPES = {
  cli: `# 1. Install dependencies & verify environment (doctor)
npm ci --ignore-scripts && npm test
node scripts/cli.mjs doctor

# 2. Static repository discovery (AST + regex + dependency graph)
node scripts/cli.mjs inspect . \\
  --out docs/inventory.json \\
  --plan docs/reading-plan.md

# 3. Compile single-file offline HTML + SHA-256 receipt
node scripts/cli.mjs build docs/document.json \\
  --out docs/documentacao.html --force

# 4. Verify hashes & detect stale sections after commits
node scripts/cli.mjs verify docs/document.json \\
  docs/documentacao.validation.json --impact --dossier docs/inventory.json --plan docs/update-plan.md`,
  manifest: `{
  "title": "project-html-docs",
  "subtitle": "Gerador de documentação técnica e funcional em HTML único offline",
  "version": "1.12.0",
  "updated": "2026-11-15",
  "mode": "full",
  "theme": "vermelho",
  "language": "pt-BR",
  "repoRoot": "..",
  "content": "content.md",
  "companionDoc": {
    "href": "documentacao-resumida.html",
    "label": "Guia rápido"
  },
  "sections": [
    {
      "id": "executive-summary",
      "title": "Visão Executiva",
      "audience": "all",
      "sources": ["skill", "cli", "builder"]
    },
    {
      "id": "architecture",
      "title": "Arquitetura da Solução",
      "audience": "technical",
      "sources": ["diagrams", "verifier", "inspector"]
    }
  ],
  "sources": [
    { "id": "skill", "path": "SKILL.md", "description": "Porta de entrada da skill" },
    { "id": "cli", "path": "scripts/cli.mjs", "description": "Entrada única inspect/build/verify/doctor" },
    { "id": "builder", "path": "scripts/build.mjs", "description": "Compilador HTML offline e auditoria" },
    { "id": "diagrams", "path": "scripts/diagrams.mjs", "description": "Motor SVG 2D e enhancer Mermaid" },
    { "id": "verifier", "path": "scripts/verify.mjs", "description": "Verificação de hashes e análise de impacto" },
    { "id": "inspector", "path": "scripts/inspect_repo.py", "description": "Dossiê estático AST, regex e grafo" }
  ]
}`,
  skill: `Use the project-html-docs skill (SKILL.md):
1. Run scripts/cli.mjs inspect on this repository to generate
   docs/inventory.json and docs/reading-plan.md.
2. Read references on demand and author docs/document.json +
   docs/content.md strictly from implemented behavior.
3. Compile docs/documentacao.html (mode: "full") and
   docs/documentacao-resumida.html (mode: "summary") with scripts/cli.mjs build.
4. Verify SHA-256 receipts with scripts/cli.mjs verify.`,
};

export const TRANSLATIONS = {
  pt: {
    metaTitle: 'project-html-docs · Documentação de projeto em HTML único offline',
    metaDescription: 'Transforme qualquer repositório de software ou engenharia de dados em um manual HTML único, offline, interativo e verificável por hash.',
    skipToContent: 'Ir para o conteúdo',
    navCapabilities: 'Recursos',
    navWorkflow: 'Fluxo',
    navArtifacts: 'Exemplos',
    navQuickStart: 'Começar',
    navCta: 'Abrir manual',
    ariaMainNav: 'Navegação principal',
    ariaLangSwitch: 'Idioma / Language',
    ariaDemoChapters: 'Capítulos da demonstração',
    ariaProofMetrics: 'Métricas do gerador',
    ariaPipelineDiagram: 'Pipeline de compilação do project-html-docs',
    ariaRecipeTabs: 'Exemplos de uso',
    heroMeta: 'v1.12.0 · Licença MIT · Node 22+ & Python 3.10+ · Saída 100% offline',
    heroTitle: 'Documentação de projeto em um único HTML offline e verificável.',
    heroSubtitle: 'Uma skill enxuta com CLI única e compilador determinístico que transformam o estado implementado de qualquer repositório em um manual técnico e funcional — com diagramas 2D em SVG, busca instantânea, filtro por perfil e recibo SHA-256.',
    heroPrimaryCta: 'Explorar manual ao vivo',
    heroSecondaryCta: 'Abrir guia rápido (9 min)',
    videoWindowTitle: 'project-html-docs · Demonstração gravada em 1440×900',
    videoPlay: 'Reproduzir',
    videoPause: 'Pausar',
    videoReplay: 'Reiniciar',
    videoOpenManual: 'Testar arquivo real',
    chapOverview: '01. Filtros',
    chapSearch: '02. Busca',
    chapDiagram: '03. Diagrama',
    chapThemes: '04. Temas',
    chapSummary: '05. Resumo',
    videoCaption: 'Gravação real do manual gerado em docs/documentacao.html: filtro por audiência, busca sem acento com destaque, diagrama 2D com zoom, alternância Vermelho/Azul e Guia Rápido.',
    proof1Value: '1 HTML',
    proof1Label: 'Sem servidor, CDN ou runtime externo na leitura',
    proof2Value: '0 tokens',
    proof2Label: 'Descoberta estática via AST, regex e grafo (cli.mjs inspect)',
    proof3Value: '55',
    proof3Label: 'Testes automatizados em CLI, ZIP, build, SVG, dossiê e impacto',
    proof4Value: 'SHA-256',
    proof4Label: 'Recibo de integridade + detecção incremental de seções stale',
    capSectionEyebrow: '01 · Arquitetura do produto',
    capSectionTitle: 'Feito para quem decide e para quem mantém.',
    capSectionLead: 'Em vez de relatórios estáticos que envelhecem no dia seguinte, o project-html-docs separa descoberta determinística, autoria estruturada e validação de integridade.',
    cap1Title: 'Diagramas 2D determinísticos e Mermaid aprimorado',
    cap1Body: 'Blocos solution, flow e schema em Markdown viram SVG inline em grade 2D com zonas empilhadas, cilindros, cartões de decisão compactos, desvio automático de sobreposição de rótulos, realce de conexões no hover e modal com zoom.',
    cap1Footer: 'Motor em scripts/diagrams.mjs · zero JavaScript externo no navegador',
    cap2Title: 'Duas profundidades a partir das mesmas fontes',
    cap2Body: 'Gere o Manual Completo (11 capítulos com dicionários pesquisáveis) e o Guia Rápido (4 a 7 capítulos com tempo de leitura estimado), ligados entre si por companionDoc.',
    cap3Title: 'Dossiê estático sem executar código',
    cap3Body: 'inspect_repo.py mapeia Python, Databricks, PySpark, Delta Lake, Azure Data Factory, Cosmos DB, Event Hubs, FastAPI, SQL lineage e IaC em ondas de leitura com redação automática de segredos.',
    cap4Title: 'Manutenção incremental via grafo',
    cap4Body: 'Quando o código muda, verify.mjs --impact cruza hashes SHA-256 e dependências transitivas para apontar seções stale — e detecta quando apenas o renderer da skill mudou (rendererSha256).',
    cap5Title: 'Ergonomia responsiva e temas Vermelho e Azul',
    cap5Body: 'Sidebar fixa no desktop e drawer recolhível no mobile, busca (/ ou Ctrl+K), filtros por audiência, tabelas filtráveis e temas Vermelho (padrão) e Azul.',
    wfSectionEyebrow: '02 · Fluxo de trabalho',
    wfSectionTitle: 'Quatro etapas do repositório ao HTML auditado.',
    wfSectionLead: 'Cada etapa produz artefatos versionáveis em texto; o HTML final é sempre compilado de forma atômica após passar na auditoria estrutural.',
    wfStep1Num: '01.',
    wfStep1Title: 'Inspecionar o repositório',
    wfStep1Body: 'Varredura estática com exclusões de .docignore. Gera inventory.json e o roteiro reading-plan.md em 4 ondas.',
    wfStep2Num: '02.',
    wfStep2Title: 'Escrever manifesto e Markdown',
    wfStep2Body: 'Defina seções, fontes e cartões em document.json; escreva prosa, tabelas, callouts, gráficos e diagramas em content.md.',
    wfStep3Num: '03.',
    wfStep3Title: 'Compilar o HTML único',
    wfStep3Body: 'build.mjs valida o schema AJV, sanitiza o Markdown, renderiza todos os SVGs inline e audita links, geometria e LaTeX.',
    wfStep4Num: '04.',
    wfStep4Title: 'Verificar hashes e impacto',
    wfStep4Body: 'verify.mjs confere os SHA-256 gravados no recibo validation.json e calcula quais seções exigem revisão após commits.',
    tabCli: 'Comandos CLI',
    tabManifest: 'document.json',
    tabSkill: 'Prompt para agente',
    copyBtn: 'Copiar',
    copiedBtn: 'Copiado',
    copyFailedBtn: 'Selecione e copie',
    artSectionEyebrow: '03 · Prova viva em /docs',
    artSectionTitle: 'O próprio projeto documentado pela skill.',
    artSectionLead: 'Os dois arquivos HTML abaixo estão hospedados nesta mesma pasta /docs do GitHub Pages e foram compilados diretamente do código deste repositório.',
    artFullTag: 'mode: "full" · 11 seções · ~36 min de leitura',
    artFullTitle: 'Manual Completo do Gerador',
    artFullBody: 'Cobre arquitetura interna, regras de validação, dicionários completos de manifesto/recibo/dossiê, 3 diagramas 2D/fluxo, gráfico de testes e guia de recuperação operacional.',
    artFullMeta: 'docs/documentacao.html · 207 KB autossuficiente',
    artFullCta: 'Abrir manual completo',
    artSummaryTag: 'mode: "summary" · 6 seções · ~9 min de leitura',
    artSummaryTitle: 'Guia Rápido / Visão Resumida',
    artSummaryBody: 'Panorama executivo e operacional em 6 capítulos de alto sinal, com diagramas principais, tabela de regras e link cruzado de retorno para o manual completo.',
    artSummaryMeta: 'docs/documentacao-resumida.html · 114 KB autossuficiente',
    artSummaryCta: 'Abrir guia rápido',
    qsEyebrow: '04 · Pronto para GitHub Pages e uso local',
    qsTitle: 'Documente seu repositório com evidência verificável.',
    qsBody: 'Baixe o ZIP enxuto da Release, clone o repositório ou aponte seu agente para SKILL.md e execute scripts/cli.mjs para gerar o primeiro manual HTML.',
    qsPrimaryCta: 'Abrir manual completo',
    qsRepoCta: 'Ver repositório no GitHub',
    footerLicense: 'Licença MIT · v1.12.0',
    footerRepo: 'GitHub',
    footerFull: 'Manual completo',
    footerSummary: 'Guia rápido',
  },
  en: {
    metaTitle: 'project-html-docs · Single-file offline project documentation',
    metaDescription: 'Turn any software or data-engineering repository into a self-contained, offline, hash-verifiable HTML manual.',
    skipToContent: 'Skip to content',
    navCapabilities: 'Capabilities',
    navWorkflow: 'Workflow',
    navArtifacts: 'Live Docs',
    navQuickStart: 'Quick Start',
    navCta: 'Open manual',
    ariaMainNav: 'Main navigation',
    ariaLangSwitch: 'Language',
    ariaDemoChapters: 'Demonstration chapters',
    ariaProofMetrics: 'Generator highlights',
    ariaPipelineDiagram: 'project-html-docs compilation pipeline',
    ariaRecipeTabs: 'Usage examples',
    heroMeta: 'v1.12.0 · MIT License · Node 22+ & Python 3.10+ · 100% offline output',
    heroTitle: 'Turn any codebase into a single-file, offline, verifiable HTML manual.',
    heroSubtitle: 'A lean operational skill with a unified CLI and deterministic compiler that document a repository’s current implemented state—complete with 2D SVG diagrams, instant search, audience filtering, and SHA-256 receipts.',
    heroPrimaryCta: 'Explore live manual',
    heroSecondaryCta: 'Open quick guide (9 min)',
    videoWindowTitle: 'project-html-docs · Recorded walkthrough at 1440×900',
    videoPlay: 'Play',
    videoPause: 'Pause',
    videoReplay: 'Replay',
    videoOpenManual: 'Try real output',
    chapOverview: '01. Filters',
    chapSearch: '02. Search',
    chapDiagram: '03. Diagram',
    chapThemes: '04. Themes',
    chapSummary: '05. Summary',
    videoCaption: 'Real screen capture of docs/documentacao.html: audience filtering, accent-insensitive search with highlights, 2D SVG diagram zoom modal, Red/Blue theme switching, and Quick Guide.',
    proof1Value: '1 HTML',
    proof1Label: 'Zero server, CDN, or external runtime required when reading',
    proof2Value: '0 tokens',
    proof2Label: 'Deterministic AST, regex & graph discovery (cli.mjs inspect)',
    proof3Value: '55',
    proof3Label: 'Automated tests covering CLI, ZIP, build, SVG geometry, dossier & impact',
    proof4Value: 'SHA-256',
    proof4Label: 'Validation receipt + incremental stale-section impact routing',
    capSectionEyebrow: '01 · Product architecture',
    capSectionTitle: 'Built for both stakeholders and maintainers.',
    capSectionLead: 'Instead of static documents that drift on day two, project-html-docs separates deterministic code discovery, structured authoring, and structural validation.',
    cap1Title: 'Deterministic 2D SVG diagrams and enhanced Mermaid',
    cap1Body: 'Write solution, flow, and schema blocks in Markdown and compile them into inline SVGs on a strict 2D grid—with stacked zones, cylinders, compact decision cards, pill collision avoidance, hover focus, and zoom modal.',
    cap1Footer: 'Engine in scripts/diagrams.mjs · zero external browser libraries',
    cap2Title: 'Two reading depths from the exact same sources',
    cap2Body: 'Compile a Full Manual (11 chapters with searchable dictionaries) alongside a concise Quick Guide (4–7 chapters with estimated reading time), cross-linked via companionDoc.',
    cap3Title: 'Zero-execution static repository dossier',
    cap3Body: 'inspect_repo.py maps Python, Databricks notebooks, chained PySpark, Delta Lake, Azure Data Factory, Cosmos DB, Event Hubs, FastAPI, SQL lineage, and IaC into 4 reading waves with automatic secret redaction.',
    cap4Title: 'Graph-driven incremental updates',
    cap4Body: 'When code changes, verify.mjs --impact compares SHA-256 hashes and walks the dependency graph so update-plan.md flags only the stale sections that need review.',
    cap5Title: 'Responsive reading ergonomics & Red / Blue themes',
    cap5Body: 'Fixed sidebar on desktop, collapsible drawer on mobile, accent-insensitive search (/ or Ctrl+K), audience filters, sticky headers with local filtering on tables with 8+ rows, plus Red (default) and Blue themes.',
    wfSectionEyebrow: '02 · Workflow',
    wfSectionTitle: 'Four steps from repository to audited HTML.',
    wfSectionLead: 'Every input stays plain-text and version-controlled; the final HTML is written atomically only after passing structural validation.',
    wfStep1Num: '01.',
    wfStep1Title: 'Inspect the repository',
    wfStep1Body: 'Static scan respecting .docignore exclusions. Outputs inventory.json and a 4-wave reading-plan.md.',
    wfStep2Num: '02.',
    wfStep2Title: 'Author manifest and Markdown',
    wfStep2Body: 'Declare sections, sources, and hero cards in document.json; write prose, tables, callouts, charts, and diagrams in content.md.',
    wfStep3Num: '03.',
    wfStep3Title: 'Compile the single HTML',
    wfStep3Body: 'build.mjs validates the AJV schema, sanitizes Markdown, renders inline SVGs, and audits anchors, geometry, and LaTeX.',
    wfStep4Num: '04.',
    wfStep4Title: 'Verify hashes and impact',
    wfStep4Body: 'verify.mjs checks recorded SHA-256 source fingerprints in validation.json and pinpoints stale sections after new commits.',
    tabCli: 'CLI Commands',
    tabManifest: 'document.json',
    tabSkill: 'Agent Prompt',
    copyBtn: 'Copy',
    copiedBtn: 'Copied',
    copyFailedBtn: 'Select & copy',
    artSectionEyebrow: '03 · Live proof in /docs',
    artSectionTitle: 'The skill documented by itself.',
    artSectionLead: 'Both HTML manuals below are hosted right here in /docs for GitHub Pages and were compiled directly from this repository’s codebase.',
    artFullTag: 'mode: "full" · 11 sections · ~36 min read',
    artFullTitle: 'Full Generator Manual',
    artFullBody: 'Covers internal architecture, validation contracts, searchable dictionaries for manifest/receipt/dossier, 3 SVG diagrams, test coverage chart, and operational recovery.',
    artFullMeta: 'docs/documentacao.html · 207 KB self-contained',
    artFullCta: 'Open full manual',
    artSummaryTag: 'mode: "summary" · 6 sections · ~9 min read',
    artSummaryTitle: 'Quick Guide / Summary View',
    artSummaryBody: 'High-signal executive and operational overview in 6 chapters, keeping key diagrams, rule tables, and a companion link back to the full manual.',
    artSummaryMeta: 'docs/documentacao-resumida.html · 114 KB self-contained',
    artSummaryCta: 'Open quick guide',
    qsEyebrow: '04 · Ready for GitHub Pages & local use',
    qsTitle: 'Document your repository with verifiable evidence.',
    qsBody: 'Download the slim Release ZIP, clone the repo, or point an agent to SKILL.md and run scripts/cli.mjs to generate your project’s first offline HTML manual.',
    qsPrimaryCta: 'Open full manual',
    qsRepoCta: 'View on GitHub',
    footerLicense: 'MIT License · v1.12.0',
    footerRepo: 'GitHub',
    footerFull: 'Full manual',
    footerSummary: 'Quick guide',
  },
};

export function resolveLang(input) {
  if (!input) return 'pt';
  const normalized = String(input).trim().toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('pt')) return 'pt';
  return 'pt';
}

export function getCopy(lang) {
  return TRANSLATIONS[resolveLang(lang)];
}
