import 'fake-indexeddb/auto';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as store from '../src/lib/store.js';
import * as db from '../src/lib/db.js';
import { normalizeListe, normalizePartie } from '../src/lib/validation.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8'));
const L3 = normalizeListe(read('liste-l3.json')).liste;
const CK = normalizeListe(read('liste-fun-ck.json')).liste;
const PARTIES = read('parties.json').map((p) => normalizePartie(p).partie);

const rec = (partie, listeId, extra = {}) => ({
  ...partie,
  liste_id: listeId,
  game_type: 'competitive',
  most_useful_unit_id: null,
  least_useful_unit_id: null,
  opponent_archetype: null,
  labels: {},
  ...extra,
});

beforeEach(async () => {
  await db.replaceAll({ listes: [], parties: [], labels: [] });
});

test('listes : enregistrement, doublon de contenu refusé, conflit de nom refusé', async () => {
  const id = await store.saveListe(L3);
  assert.ok(Number.isInteger(id));
  await assert.rejects(() => store.saveListe({ ...structuredClone(L3), name: 'Autre nom' }), /identique/);
  const modif = structuredClone(L3);
  modif.units[0].points += 1;
  await assert.rejects(() => store.saveListe(modif), /déjà utilisé/);
  modif.name = 'Liste L3 modifiée';
  await store.saveListe(modif);
  assert.equal((await store.loadAll()).listes.length, 2);
});

test('parties : rattachement obligatoire, type obligatoire, calculs recalculés à l\'enregistrement', async () => {
  await assert.rejects(() => store.savePartie(rec(PARTIES[0], 999)), /rattachée à une liste/);
  const listeId = await store.saveListe(L3);
  await assert.rejects(() => store.savePartie(rec(PARTIES[0], listeId, { game_type: null })), /obligatoire/);
  const tricheur = rec(PARTIES[0], listeId);
  tricheur.players[0].battle_points = 1;
  const id = await store.savePartie(tricheur);
  const saved = (await store.loadAll()).parties.find((p) => p.id === id);
  assert.equal(saved.players[0].battle_points, 85);
  assert.equal(saved.liste_id, listeId);
});

test('unités utile / moins utile : appartenance à la liste et différence', async () => {
  const listeId = await store.saveListe(L3);
  await assert.rejects(() => store.savePartie(rec(PARTIES[0], listeId, { most_useful_unit_id: 'u99' })), /inconnue/);
  await assert.rejects(
    () => store.savePartie(rec(PARTIES[0], listeId, { most_useful_unit_id: 'u07', least_useful_unit_id: 'u07' })),
    /différentes/
  );
  await store.savePartie(rec(PARTIES[0], listeId, { most_useful_unit_id: 'u07', least_useful_unit_id: 'u11' }));
});

test('verrouillage : liste modifiable sans partie, verrouillée et non supprimable avec partie', async () => {
  const listeId = await store.saveListe(L3);
  const edit = structuredClone(L3);
  edit.units[0].name = 'Technomancer (corrigé)';
  await store.updateListe(listeId, edit);
  assert.equal((await store.loadAll()).listes[0].units[0].name, 'Technomancer (corrigé)');

  const partieId = await store.savePartie(rec(PARTIES[1], listeId));
  assert.equal(await store.isListeLocked(listeId), true);
  await assert.rejects(() => store.updateListe(listeId, edit), /verrouillée/);
  await assert.rejects(() => store.deleteListe(listeId), /utilisée par des parties/);

  await store.deletePartie(partieId);
  assert.equal(await store.isListeLocked(listeId), false);
  await store.deleteListe(listeId);
  assert.equal((await store.loadAll()).listes.length, 0);
});

test('mise à jour d\'une partie : conserve la date de création, change de liste, valide les règles', async () => {
  const a = await store.saveListe(L3);
  const b = await store.saveListe(CK);
  const id = await store.savePartie(rec(PARTIES[2], a));
  const before = (await store.loadAll()).parties[0];
  await store.updatePartie(id, { ...before, liste_id: b, game_type: 'fun' });
  const after = (await store.loadAll()).parties[0];
  assert.equal(after.liste_id, b);
  assert.equal(after.game_type, 'fun');
  assert.equal(after.created_at, before.created_at);
  await assert.rejects(() => store.updatePartie(id, { ...after, liste_id: 12345 }), /rattachée/);
});

test('étiquettes : unicité, renommage, suppression retirée des parties', async () => {
  const l = await store.addLabel('Tournoi');
  await assert.rejects(() => store.addLabel(' tournoi '), /existe déjà/);
  await store.renameLabel(l, 'Tournoi officiel');
  const listeId = await store.saveListe(L3);
  await store.savePartie(rec(PARTIES[0], listeId, { labels: { [l]: 'ETC' } }));
  assert.equal((await store.loadAll()).parties[0].labels[l], 'ETC');
  await store.deleteLabel(l);
  const all = await store.loadAll();
  assert.equal(all.labels.length, 0);
  assert.deepEqual(all.parties[0].labels, {});
});

test('sauvegarde : aller-retour complet, puis restauration dans une base vide', async () => {
  const listeId = await store.saveListe(L3);
  const lab = await store.addLabel('Mode');
  await store.savePartie(rec(PARTIES[0], listeId, { labels: { [lab]: 'x' }, most_useful_unit_id: 'u07' }));
  await store.savePartie(rec(PARTIES[1], listeId, { game_type: 'fun' }));
  const backup = await store.exportBackup();
  assert.equal(backup.data.parties.length, 2);

  await db.replaceAll({ listes: [], parties: [], labels: [] });
  const summary = await store.restoreBackup(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual([summary.listes, summary.parties, summary.labels], [1, 2, 1]);
  const restored = await store.loadAll();
  assert.deepEqual(restored.parties, backup.data.parties);
  assert.equal(restored.listes[0].id, listeId);
  // Les nouveaux enregistrements ne réutilisent pas un identifiant existant.
  const nextId = await store.saveListe(CK);
  assert.ok(nextId > listeId);
});

test('restauration : fichiers invalides refusés sans toucher aux données', async () => {
  const listeId = await store.saveListe(L3);
  await store.savePartie(rec(PARTIES[0], listeId));
  const backup = await store.exportBackup();

  assert.throws(() => store.checkBackup({ app: 'autre' }), /pas une sauvegarde/);
  assert.throws(() => store.checkBackup({ ...backup, backup_version: 2 }), /non prise en charge/);
  const orpheline = structuredClone(backup);
  orpheline.data.parties[0].liste_id = 4242;
  await assert.rejects(() => store.restoreBackup(orpheline), /aucune liste/);
  const doublon = structuredClone(backup);
  doublon.data.listes.push(structuredClone(doublon.data.listes[0]));
  await assert.rejects(() => store.restoreBackup(doublon), /en double/);

  const after = await store.loadAll();
  assert.equal(after.listes.length, 1);
  assert.equal(after.parties.length, 1);
});
