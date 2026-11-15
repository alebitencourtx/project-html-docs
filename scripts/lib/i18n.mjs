export const RESERVED_IDS = new Set([
  'main', 'sidebar', 'sidebar-backdrop', 'nav-toggle', 'nav-close', 'mobile-search-btn',
  'search', 'search-clear', 'search-count', 'expand', 'collapse', 'print', 'no-results', 'back-to-top',
  'document-references', 'diagram-dialog', 'dialog-title', 'dialog-zoom-in', 'dialog-zoom-out',
  'dialog-zoom-label', 'dialog-fit', 'dialog-actual', 'dialog-close', 'dialog-canvas',
]);

export const THEME_ALIASES = {
  vermelho: 'vermelho',
  azul: 'azul',
  santander: 'vermelho',
  default: 'azul',
};

export function normalizeTheme(v) {
  return THEME_ALIASES[v] || 'vermelho';
}

export function getUiWords(en, mode) {
  return en ? {
    all: 'Everyone', business: 'Business', technical: 'Technical', operations: 'Operations',
    search: 'Search documentation', clearSearch: 'Clear search', expand: 'Expand all', collapse: 'Collapse all', print: 'Print / PDF',
    none: 'No sections found.', offline: 'Single HTML · offline reading', sources: 'Sources', updated: 'Updated', code: 'Code',
    diagram: 'Expand', close: 'Close', fit: 'Fit to view', actual: '100%', hint: 'Choose a section or filter by reading profile.',
    data: 'Data as of', reference: 'Document references',
    defaultEyebrow: mode === 'summary' ? 'Quick guide · Summary view' : 'Functional & technical documentation',
    summaryBadge: 'Quick guide',
    readingBadge: m => `~${m} min read`,
    filterAll: 'All', filterBusiness: 'Business view', filterTechnical: 'Technical view', filterOps: 'Operations', backToTop: 'Back to top',
    themeRed: 'Red', themeBlue: 'Blue',
    menu: 'Menu', openMenu: 'Open navigation menu', closeMenu: 'Close navigation menu',
  } : {
    all: 'Para todos', business: 'Funcional', technical: 'Técnico', operations: 'Operação',
    search: 'Pesquisar documentação', clearSearch: 'Limpar busca', expand: 'Expandir tudo', collapse: 'Recolher tudo', print: 'Imprimir / PDF',
    none: 'Nenhuma seção encontrada.', offline: 'HTML único · leitura offline', sources: 'Referências', updated: 'Atualizado', code: 'Código',
    diagram: 'Ampliar', close: 'Fechar', fit: 'Ajustar à tela', actual: 'Tamanho real', hint: 'Navegue por assunto ou filtre por perfil de leitura.',
    data: 'Dados observados em', reference: 'Referências do documento',
    defaultEyebrow: mode === 'summary' ? 'Guia rápido · Visão resumida' : 'Documentação funcional e técnica',
    summaryBadge: 'Guia rápido',
    readingBadge: m => `~${m} min de leitura`,
    filterAll: 'Todas', filterBusiness: 'Visão de negócio', filterTechnical: 'Visão técnica', filterOps: 'Operação', backToTop: 'Topo',
    themeRed: 'Vermelho', themeBlue: 'Azul',
    menu: 'Menu', openMenu: 'Abrir menu de navegação', closeMenu: 'Fechar menu de navegação',
  };
}
