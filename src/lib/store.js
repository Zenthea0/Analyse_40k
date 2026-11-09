// Règles métier au-dessus d'IndexedDB : verrouillage des listes, rattachement
// obligatoire des parties, étiquettes, sauvegarde et restauration.

import * as db from './db.js';
import { analyseListe, listeSignature } from './signature.js';
import { applyDerived } from './validation.js';
import { ARCHETYPES, GAME_TYPES, BACKUP_APP, BACKUP_VERSION } from './constants.js';

export class RuleError extends Error {}

const LISTE_FIELDS = [
  'name',
  'faction',
  'detachments',
  'strategy',
  'battle_size',
  'total_points',
  'source',
  'attached_groups',
  'units',
];
const PARTIE_FIELDS = [
  'game_date',
  'edition',
  'rules_source',
  'mission_pack',
  'deployment',
  'special_rules',
  'missions',
  'players',
  'liste_id',
  'game_type',
  'most_useful_unit_id',
  'least_useful_unit_id',
  'opponent_archetype',
  'labels',
];

const pick = (obj, fields) => Object.fromEntries(fields.map((f) => [f, structuredClone(obj[f])]));

export async function loadAll() {
  const [listes, parties, labels] = await Promise.all([
    db.getAll('listes'),
    db.getAll('parties'),
    db.getAll('labels'),
  ]);
  return { listes, parties, labels };
}

// ---------------------------------------------------------------- Listes

export const partiesOfListe = (parties, listeId) => parties.filter((p) => p.liste_id === listeId);

function checkListeRules(liste, existing, excludeId) {
  if (!String(liste.name ?? '').trim()) throw new RuleError('Le nom de la liste est obligatoire.');
  const { signature, duplicateOf, nameConflict } = analyseListe(liste, existing, excludeId);
  if (duplicateOf)
    throw new RuleError(`Cette liste est identique à « ${duplicateOf.name} » : il s'agit de la même liste.`);
  if (nameConflict)
    throw new RuleError(`Le nom « ${liste.name.trim()} » est déjà utilisé par une liste différente.`);
  return signature;
}

export async function saveListe(liste) {
  const existing = await db.getAll('listes');
  const signature = checkListeRules(liste, existing, null);
  const record = {
    ...pick(liste, LISTE_FIELDS),
    name: liste.name.trim(),
    signature,
    created_at: new Date().toISOString(),
  };
  return db.add('listes', record);
}

/** Une liste n'est modifiable que tant qu'aucune partie n'y est rattachée. */
export async function isListeLocked(id) {
  const parties = await db.getAll('parties');
  return partiesOfListe(parties, id).length > 0;
}

export async function updateListe(id, liste) {
  if (await isListeLocked(id))
    throw new RuleError('Cette liste est verrouillée : au moins une partie y est rattachée.');
  const [existing, current] = await Promise.all([db.getAll('listes'), db.getOne('listes', id)]);
  if (!current) throw new RuleError('Liste introuvable.');
  const signature = checkListeRules(liste, existing, id);
  await db.put('listes', {
    ...pick(liste, LISTE_FIELDS),
    name: liste.name.trim(),
    id,
    signature,
    created_at: current.created_at,
  });
}

export async function deleteListe(id) {
  if (await isListeLocked(id))
    throw new RuleError('Impossible de supprimer une liste utilisée par des parties : supprime d\'abord ces parties.');
  await db.remove('listes', id);
}

// ---------------------------------------------------------------- Parties

function checkPartieRules(rec, listes) {
  const liste = listes.find((l) => l.id === rec.liste_id);
  if (!liste) throw new RuleError('Une partie doit être rattachée à une liste existante.');
  if (!GAME_TYPES.some((t) => t.value === rec.game_type))
    throw new RuleError('Le type de partie (compétitive ou fun) est obligatoire.');
  if (!Array.isArray(rec.players) || rec.players.length !== 2) throw new RuleError('Une partie compte deux joueurs.');
  const ids = new Set(liste.units.map((u) => u.id));
  for (const k of ['most_useful_unit_id', 'least_useful_unit_id'])
    if (rec[k] && !ids.has(rec[k])) throw new RuleError('Unité inconnue dans la liste rattachée.');
  if (rec.most_useful_unit_id && rec.most_useful_unit_id === rec.least_useful_unit_id)
    throw new RuleError('L\'unité la plus utile et la moins utile doivent être différentes.');
  if (rec.opponent_archetype && !ARCHETYPES.some((a) => a.value === rec.opponent_archetype))
    throw new RuleError('Archétype adverse inconnu.');
}

function buildPartie(rec) {
  const clean = {
    ...rec,
    most_useful_unit_id: rec.most_useful_unit_id || null,
    least_useful_unit_id: rec.least_useful_unit_id || null,
    opponent_archetype: rec.opponent_archetype || null,
    labels: rec.labels ?? {},
  };
  return pick(applyDerived(clean), PARTIE_FIELDS);
}

export async function savePartie(rec) {
  const listes = await db.getAll('listes');
  const built = buildPartie(rec);
  checkPartieRules(built, listes);
  return db.add('parties', { ...built, created_at: new Date().toISOString() });
}

export async function updatePartie(id, rec) {
  const [listes, current] = await Promise.all([db.getAll('listes'), db.getOne('parties', id)]);
  if (!current) throw new RuleError('Partie introuvable.');
  const built = buildPartie(rec);
  checkPartieRules(built, listes);
  await db.put('parties', { ...built, id, created_at: current.created_at });
}

export const deletePartie = (id) => db.remove('parties', id);

// ---------------------------------------------------------------- Étiquettes

const normLabel = (s) => String(s).trim().toLowerCase();

export async function addLabel(name) {
  const n = String(name).trim();
  if (!n) throw new RuleError('Le nom de l\'étiquette est obligatoire.');
  const labels = await db.getAll('labels');
  if (labels.some((l) => normLabel(l.name) === normLabel(n))) throw new RuleError('Cette étiquette existe déjà.');
  return db.add('labels', { name: n });
}

export async function renameLabel(id, name) {
  const n = String(name).trim();
  if (!n) throw new RuleError('Le nom de l\'étiquette est obligatoire.');
  const labels = await db.getAll('labels');
  if (labels.some((l) => l.id !== id && normLabel(l.name) === normLabel(n)))
    throw new RuleError('Cette étiquette existe déjà.');
  await db.put('labels', { id, name: n });
}

export async function deleteLabel(id) {
  const parties = await db.getAll('parties');
  for (const p of parties) {
    if (p.labels && String(id) in p.labels) {
      const labels = { ...p.labels };
      delete labels[id];
      await db.put('parties', { ...p, labels });
    }
  }
  await db.remove('labels', id);
}

// ---------------------------------------------------------------- Sauvegarde

export async function exportBackup() {
  const data = await loadAll();
  return {
    app: BACKUP_APP,
    backup_version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    data,
  };
}

export function backupFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `analyse40k-sauvegarde-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.json`;
}

/** Vérifie une sauvegarde avant restauration ; renvoie un résumé ou lève RuleError. */
export function checkBackup(obj) {
  if (!obj || typeof obj !== 'object' || obj.app !== BACKUP_APP)
    throw new RuleError('Ce fichier n\'est pas une sauvegarde de cette application.');
  if (!Number.isInteger(obj.backup_version) || obj.backup_version !== BACKUP_VERSION)
    throw new RuleError(`Version de sauvegarde ${obj.backup_version ?? 'inconnue'} non prise en charge.`);
  const d = obj.data;
  if (!d || !Array.isArray(d.listes) || !Array.isArray(d.parties) || !Array.isArray(d.labels))
    throw new RuleError('Sauvegarde incomplète : listes, parties ou étiquettes manquantes.');
  for (const key of ['listes', 'parties', 'labels']) {
    const ids = d[key].map((r) => r?.id);
    if (ids.some((i) => !Number.isInteger(i))) throw new RuleError(`Sauvegarde invalide : identifiant manquant dans « ${key} ».`);
    if (new Set(ids).size !== ids.length) throw new RuleError(`Sauvegarde invalide : identifiants en double dans « ${key} ».`);
  }
  const listeIds = new Set(d.listes.map((l) => l.id));
  for (const l of d.listes)
    if (!Array.isArray(l.units) || !Array.isArray(l.attached_groups))
      throw new RuleError(`Sauvegarde invalide : la liste « ${l.name} » est incomplète.`);
  for (const p of d.parties) {
    if (!listeIds.has(p.liste_id)) throw new RuleError('Sauvegarde invalide : une partie n\'est rattachée à aucune liste.');
    if (!Array.isArray(p.players) || p.players.length !== 2) throw new RuleError('Sauvegarde invalide : une partie est incomplète.');
  }
  return {
    exported_at: obj.exported_at ?? null,
    listes: d.listes.length,
    parties: d.parties.length,
    labels: d.labels.length,
  };
}

export async function restoreBackup(obj) {
  const summary = checkBackup(obj);
  // Les signatures sont recalculées : elles dépendent du code, pas de la sauvegarde.
  const listes = obj.data.listes.map((l) => ({ ...l, signature: listeSignature(l) }));
  await db.replaceAll({ listes, parties: obj.data.parties, labels: obj.data.labels });
  return summary;
}
