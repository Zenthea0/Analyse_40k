import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  checkListeStructure,
  checkPartieStructure,
  normalizeListe,
  normalizePartie,
  listeWarnings,
  declaredSnapshot,
  checkPartie,
  compareDeclared,
  applyDerived,
  computePlayer,
  findDuplicateParties,
  parseJsonText,
} from '../src/lib/validation.js';
import { listeSignature, analyseListe } from '../src/lib/signature.js';
import { unitLabels } from '../src/lib/format.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8'));
const LISTES = {
  ck: read('liste-fun-ck.json'),
  l3: read('liste-l3.json'),
  we: read('world-eaters.json'),
};
const PARTIES = read('parties.json');

test('les 3 listes de test : structure valide, aucun avertissement, totaux cohérents', () => {
  for (const [nom, l] of Object.entries(LISTES)) {
    assert.deepEqual(checkListeStructure(l), [], nom);
    const { liste, fileWarnings } = normalizeListe(l);
    assert.deepEqual(fileWarnings, [], nom);
    assert.deepEqual(listeWarnings(liste), [], nom);
  }
});

test('un total de points erroné et un seigneur de guerre manquant sont signalés', () => {
  const { liste } = normalizeListe(LISTES.ck);
  liste.units[0].points += 10;
  liste.units.forEach((u) => (u.warlord = false));
  const w = listeWarnings(liste);
  assert.equal(w.length, 2);
  assert.match(w[0], /Total des unités \(1995\)/);
  assert.match(w[1], /0 seigneur/);
});

test('refus : mauvais type, version majeure inconnue, JSON invalide', () => {
  assert.match(checkListeStructure(PARTIES[0])[0], /type « partie »/);
  assert.match(checkListeStructure({ ...LISTES.ck, schema_version: '2.0' })[0], /non reconnue/);
  assert.match(checkPartieStructure({ ...PARTIES[0], schema_version: '1.7' }).join(''), /^$/);
  assert.ok(parseJsonText('{oups').error);
});

test('refus : édition autre que 11e, tableaux de longueur incorrecte', () => {
  assert.match(checkPartieStructure({ ...PARTIES[0], edition: '10e' })[0], /non traitée/);
  const p = structuredClone(PARTIES[0]);
  p.players[0].primary.per_turn.pop();
  assert.ok(checkPartieStructure(p).some((e) => /primary/.test(e)));
  const q = structuredClone(PARTIES[0]);
  q.missions = ['a'];
  assert.ok(checkPartieStructure(q).some((e) => /missions/.test(e)));
});

test('les 3 parties de test : structure valide et zéro écart après recalcul', () => {
  for (const raw of PARTIES) {
    assert.deepEqual(checkPartieStructure(raw), [], raw.game_date);
    const { partie, fileWarnings } = normalizePartie(raw);
    assert.deepEqual(fileWarnings, []);
    assert.deepEqual(checkPartie(partie, declaredSnapshot(partie)), [], raw.game_date);
  }
});

test('recalculer ne change aucune valeur des fichiers de test', () => {
  for (const raw of PARTIES) {
    const { partie } = normalizePartie(raw);
    assert.deepEqual(applyDerived(partie), partie, raw.game_date);
  }
});

test('plafonds : primaire du 25 septembre brut 51 plafonné à 45, 92 points de bataille', () => {
  const me = PARTIES[1].players[0];
  const d = computePlayer(me);
  assert.equal(d.primaryRawTotal, 51);
  assert.equal(d.primaryTotal, 45);
  assert.equal(d.battlePoints, 92);
  assert.equal(d.pointsByTurn.at(-1).cumul, 82);
});

test('plafond de 15 par manche sur les secondaires (tour 4 du 25 septembre)', () => {
  const d = computePlayer(PARTIES[1].players[0]);
  // 5 + 3 + 4 + 5 = 17 brut au tour 4 -> 15
  assert.equal(d.pointsByTurn[3].secondaires, 15);
});

test('écarts : valeur modifiée, issue incohérente, mission différente, deux « premiers »', () => {
  const { partie } = normalizePartie(PARTIES[2]);
  const declared = declaredSnapshot(partie);

  const a = structuredClone(partie);
  a.players[0].primary.per_turn[4] = 15; // 30 -> 33 brut
  const ecartsA = compareDeclared(declared, a);
  assert.ok(ecartsA.some((e) => /total primaire déclaré 30, recalculé 33/.test(e)));
  assert.ok(ecartsA.some((e) => /points de bataille déclarés 78, recalculés 81/.test(e)));

  const b = structuredClone(partie);
  b.players[0].tournament_result = 'defeat';
  assert.ok(checkPartie(b, declared).some((e) => /incohérente avec le score 14-6/.test(e)));

  const c = structuredClone(partie);
  c.missions[1] = 'Autre mission';
  assert.ok(checkPartie(c, declared).some((e) => /différente de l'objectif primaire/.test(e)));

  const d = structuredClone(partie);
  d.players[1].went_first = true;
  assert.ok(checkPartie(d, declared).some((e) => /avoir commencé/.test(e)));

  const e = structuredClone(partie);
  e.players[0].battle_ready = 5;
  assert.ok(checkPartie(e, declared).some((x) => /Battle Ready/.test(x)));
});

test('adopter les valeurs recalculées supprime les écarts déclarés', () => {
  const { partie } = normalizePartie(PARTIES[0]);
  const declared = declaredSnapshot(partie);
  const edited = structuredClone(partie);
  edited.players[1].secondaries[0].per_turn[0] = 5;
  assert.ok(compareDeclared(declared, edited).length > 0);
  assert.deepEqual(compareDeclared(declaredSnapshot(applyDerived(edited)), edited), []);
});

test('doublons : même date et mêmes pseudos, insensible à la casse et à l\'ordre', () => {
  const { partie } = normalizePartie(PARTIES[0]);
  const saved = [{ id: 1, ...structuredClone(partie) }];
  assert.equal(findDuplicateParties(partie, saved).length, 1);
  const autre = structuredClone(partie);
  autre.players.reverse();
  autre.players[0].name = autre.players[0].name.toUpperCase();
  assert.equal(findDuplicateParties(autre, saved).length, 1);
  assert.equal(findDuplicateParties(partie, saved, 1).length, 0);
  const d = structuredClone(partie);
  d.game_date = '2026-08-22';
  assert.equal(findDuplicateParties(d, saved).length, 0);
});

test('identité des listes : le nom ne compte pas, la moindre modification oui', () => {
  const { liste } = normalizeListe(LISTES.l3);
  const renommee = structuredClone(liste);
  renommee.name = 'Autre nom';
  renommee.source.data_version = 'v1000';
  renommee.attached_groups.forEach((g, i) => (g.group = `Groupe ${i}`));
  assert.equal(listeSignature(renommee), listeSignature(liste));

  const modif = structuredClone(liste);
  modif.units[2].points += 5;
  assert.notEqual(listeSignature(modif), listeSignature(liste));

  const opt = structuredClone(liste);
  opt.units[5].options = [];
  assert.notEqual(listeSignature(opt), listeSignature(liste));

  const wl = structuredClone(liste);
  wl.units.find((u) => u.warlord).warlord = false;
  wl.units[0].warlord = true;
  assert.notEqual(listeSignature(wl), listeSignature(liste));

  const eq = structuredClone(liste);
  eq.units[0].wargear[0].count = 2;
  assert.notEqual(listeSignature(eq), listeSignature(liste));
});

test('analyseListe : contenu identique -> réutilisation ; même nom, contenu différent -> renommage', () => {
  const { liste } = normalizeListe(LISTES.l3);
  const saved = [{ id: 1, ...liste, signature: listeSignature(liste) }];
  assert.equal(analyseListe(liste, saved).duplicateOf.id, 1);
  assert.equal(analyseListe(liste, saved).nameConflict, null);

  const modif = structuredClone(liste);
  modif.units[0].points += 1;
  const r = analyseListe(modif, saved);
  assert.equal(r.duplicateOf, null);
  assert.equal(r.nameConflict.id, 1);

  modif.name = 'Liste L3 bis';
  assert.equal(analyseListe(modif, saved).nameConflict, null);
  assert.equal(analyseListe(liste, saved, 1).duplicateOf, null);
});

test('libellés d\'unités : doublons distingués par l\'unité attachée puis par un numéro', () => {
  const { liste } = normalizeListe(LISTES.we);
  const labels = unitLabels(liste);
  assert.equal(labels.get('u04'), 'Khorne Berzerkers · 170 pts · avec Khârn the Betrayer');
  assert.equal(labels.get('u06'), 'Khorne Berzerkers · 170 pts · avec Master of Executions');
  assert.equal(labels.get('u08'), 'Chaos Rhino · 75 pts · n°1');
  assert.equal(labels.get('u09'), 'Chaos Rhino · 75 pts · n°2');
  assert.equal(new Set(labels.values()).size, liste.units.length);
});
