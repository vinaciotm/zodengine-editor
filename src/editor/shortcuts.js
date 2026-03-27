// Central shortcut registry — single source of truth for all keyboard shortcuts.
// TransformToolbar reads keys from here; TopBar modal renders rows from here.

export const SC = {
  transform: {
    select:    { key: 'q', display: 'Q',    label: 'Cursor / Select' },
    translate: { key: 'w', display: 'W',    label: 'Posição' },
    rotate:    { key: 'e', display: 'E',    label: 'Rotação' },
    scale:     { key: 'r', display: 'R',    label: 'Escala' },
  },
  view: {
    lit:       { key: '8', display: '8',    label: 'Com luz' },
    solid:     { key: '9', display: '9',    label: 'Sem efeitos' },
    wireframe: { key: '0', display: '0',    label: 'Wireframe' },
  },
  edit: {
    copy:      { display: '⌘C',  label: 'Copiar',     meta: true, key: 'c' },
    paste:     { display: '⌘V',  label: 'Colar',      meta: true, key: 'v' },
    duplicate: { display: '⌘D',  label: 'Duplicar',   meta: true, key: 'd' },
    undo:      { display: '⌘Z',  label: 'Desfazer',   meta: true, key: 'z' },
    redo:      { display: '⌘⇧Z', label: 'Refazer',    meta: true, shift: true, key: 'z' },
    delete:    { display: 'Del', label: 'Deletar',    key: 'Delete' },
    group:     { display: '⌘G',  label: 'Agrupar',    meta: true, key: 'g' },
    ungroup:   { display: '⌘⇧G', label: 'Desagrupar', meta: true, shift: true, key: 'g' },
  },
  game: {
    play:      { key: 'p', display: 'P',    label: 'Play / Stop' },
    save:      { display: '⌘S',  label: 'Salvar',     meta: true, key: 's' },
  },
};

// Ordered sections for the shortcuts modal
export const SHORTCUT_SECTIONS = [
  { title: 'Transformação', group: 'transform' },
  { title: 'Visualização',  group: 'view' },
  { title: 'Edição',        group: 'edit' },
  { title: 'Jogo',          group: 'game' },
];
