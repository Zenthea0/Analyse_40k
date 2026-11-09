// Règles et listes de valeurs communes (voir docs/modele-donnees.md, format 1.0).

export const SCHEMA_MAJOR = 1;
export const EDITION = '11e';
export const TOURS = 5;
export const CAP_TURN = 15; // plafond par manche (primaire et secondaires, indépendants)
export const CAP_GAME = 45; // plafond par partie (primaire et secondaires, indépendants)
export const BATTLE_READY_VALUES = [0, 10];

export const RESULTS = ['victory', 'draw', 'defeat'];
export const RESULT_LABELS = { victory: 'Victoire', draw: 'Nul', defeat: 'Défaite' };

export const OPTION_TYPES = ['optimisation', 'amélioration'];

export const GAME_TYPES = [
  { value: 'competitive', label: 'Compétitive' },
  { value: 'fun', label: 'Fun' },
];

export const ARCHETYPES = [
  { value: 'corps-a-corps', label: 'Corps à corps' },
  { value: 'tir', label: 'Tir' },
  { value: 'placement', label: 'Placement' },
  { value: 'polyvalence', label: 'Polyvalence' },
];

export const BACKUP_APP = 'analyse-40k';
export const BACKUP_VERSION = 1;
