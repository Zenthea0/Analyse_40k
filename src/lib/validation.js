// Port JavaScript des contrôles de parse_liste.py et valider_synthese.py,
// plus les règles d'import décrites dans docs/modele-donnees.md.
// Module pur (aucune dépendance au navigateur) : testé avec node --test.

import {
  SCHEMA_MAJOR,
  EDITION,
  TOURS,
  CAP_TURN,
  CAP_GAME,
  BATTLE_READY_VALUES,
  OPTION_TYPES,
  RESULTS,
  RESULT_LABELS,
} from './constants.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v);
const isStr = (v) => typeof v === 'string';
const isStrOrNull = (v) => v === null || typeof v === 'string';
export const sum = (a) => a.reduce((s, v) => s + v, 0);

export function parseJsonText(text) {
  try {
    return { data: JSON.parse(text) };
  } catch (e) {
    return { error: `Le contenu n'est pas un JSON valide (${e.message}).` };
  }
}

function checkHeader(obj, expectedType, errors) {
  if (!isObj(obj)) {
    errors.push('Le contenu doit être un objet JSON.');
    return false;
  }
  if (obj.type !== expectedType) {
    errors.push(`Ce fichier est de type « ${obj.type ?? 'absent'} » alors que « ${expectedType} » est attendu.`);
    return false;
  }
  const m = isStr(obj.schema_version) ? obj.schema_version.match(/^(\d+)\.(\d+)$/) : null;
  if (!m) {
    errors.push('Champ « schema_version » absent ou mal formé (attendu : « 1.0 »).');
    return false;
  }
  if (Number(m[1]) !== SCHEMA_MAJOR) {
    errors.push(
      `Version de format ${obj.schema_version} non reconnue : seule la version majeure ${SCHEMA_MAJOR} est acceptée.`
    );
    return false;
  }
  return true;
}

export function isValidDate(s) {
  if (!isStr(s) || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// ---------------------------------------------------------------- Liste

const isCounted = (arr) =>
  Array.isArray(arr) && arr.every((x) => isObj(x) && isInt(x.count) && isStr(x.name));

function checkUnitStructure(u, i, errors) {
  const label = `Unité n°${i + 1}`;
  if (!isObj(u)) {
    errors.push(`${label} : objet attendu.`);
    return;
  }
  const need = (c, m) => c || errors.push(`${label} : ${m}`);
  need(isStr(u.id) && u.id !== '', 'champ « id » manquant.');
  need(isStr(u.name) && u.name !== '', 'champ « name » manquant.');
  need(u.points === null || isInt(u.points), 'champ « points » invalide (entier ou null).');
  need(isStrOrNull(u.role), 'champ « role » invalide.');
  need(isStrOrNull(u.unit_type), 'champ « unit_type » invalide.');
  need(typeof u.warlord === 'boolean', 'champ « warlord » invalide (booléen attendu).');
  need(isCounted(u.models), 'champ « models » invalide.');
  need(isCounted(u.wargear), 'champ « wargear » invalide.');
  need(
    Array.isArray(u.options) &&
      u.options.every((o) => isObj(o) && OPTION_TYPES.includes(o.type) && isStr(o.name)),
    'champ « options » invalide.'
  );
}

/** Structure d'un fichier « liste ». Renvoie la liste des erreurs bloquantes (vide = valide). */
export function checkListeStructure(obj) {
  const errors = [];
  if (!checkHeader(obj, 'liste', errors)) return errors;
  const need = (c, m) => c || errors.push(m);
  need(isStr(obj.name) && obj.name.trim() !== '', 'Champ « name » manquant ou vide.');
  need(isStr(obj.faction), 'Champ « faction » manquant.');
  need(Array.isArray(obj.detachments) && obj.detachments.every(isStr), 'Champ « detachments » invalide.');
  need(isStr(obj.strategy), 'Champ « strategy » manquant.');
  need(obj.battle_size === null || isInt(obj.battle_size), 'Champ « battle_size » invalide.');
  need(isInt(obj.total_points), 'Champ « total_points » manquant ou invalide.');
  need(isObj(obj.source), 'Champ « source » invalide.');
  need(
    Array.isArray(obj.attached_groups) &&
      obj.attached_groups.every(
        (g) => isObj(g) && isStr(g.group) && Array.isArray(g.members) && g.members.every(isStr)
      ),
    'Champ « attached_groups » invalide.'
  );
  need(Array.isArray(obj.warnings) && obj.warnings.every(isStr), 'Champ « warnings » invalide.');
  if (!Array.isArray(obj.units)) errors.push('Champ « units » manquant.');
  else obj.units.forEach((u, i) => checkUnitStructure(u, i, errors));
  return errors;
}

/** Copie de travail d'une liste valide + avertissements du fichier. */
export function normalizeListe(obj) {
  const liste = structuredClone({
    name: obj.name.trim(),
    faction: obj.faction,
    detachments: obj.detachments,
    strategy: obj.strategy,
    battle_size: obj.battle_size,
    total_points: obj.total_points,
    source: obj.source,
    attached_groups: obj.attached_groups,
    units: obj.units,
  });
  return { liste, fileWarnings: [...obj.warnings] };
}

/** Contrôles de cohérence d'une liste (mêmes règles que parse_liste.py). */
export function listeWarnings(l) {
  const w = [];
  const summed = sum(l.units.map((u) => u.points || 0));
  if (summed !== l.total_points) {
    w.push(`Total des unités (${summed}) différent du total de l'en-tête (${l.total_points}).`);
  }
  for (const u of l.units) if (u.points === null || u.points === undefined) w.push(`Unité sans points : ${u.name}.`);
  const warlords = l.units.filter((u) => u.warlord).length;
  if (warlords !== 1) w.push(`${warlords} seigneur(s) de guerre trouvé(s) : 1 attendu.`);
  const ids = l.units.map((u) => u.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) w.push(`Identifiants d'unité en double : ${[...new Set(dup)].join(', ')}.`);
  const known = new Set(ids);
  for (const g of l.attached_groups)
    for (const m of g.members) if (!known.has(m)) w.push(`${g.group} : l'unité ${m} n'existe pas.`);
  return w;
}

// ---------------------------------------------------------------- Partie

const isTurns = (a) => Array.isArray(a) && a.length === TOURS && a.every((v) => isInt(v) && v >= 0);

function checkPlayerStructure(p, i, errors) {
  const label = `Joueur ${i + 1}`;
  if (!isObj(p)) {
    errors.push(`${label} : objet attendu.`);
    return;
  }
  const need = (c, m) => c || errors.push(`${label} : ${m}`);
  need(isStr(p.name) && p.name !== '', 'champ « name » manquant.');
  need(typeof p.is_me === 'boolean', 'champ « is_me » invalide.');
  need(isStr(p.faction), 'champ « faction » manquant.');
  need(isStr(p.disposition), 'champ « disposition » manquant.');
  need(typeof p.went_first === 'boolean', 'champ « went_first » invalide.');
  need(isInt(p.tournament_score), 'champ « tournament_score » invalide.');
  need(RESULTS.includes(p.tournament_result), 'champ « tournament_result » invalide.');
  need(
    isObj(p.primary) &&
      isStr(p.primary.name) &&
      isTurns(p.primary.per_turn) &&
      isInt(p.primary.raw_total) &&
      isInt(p.primary.total),
    `champ « primary » invalide (${TOURS} valeurs entières positives attendues par tour).`
  );
  need(
    Array.isArray(p.secondaries) &&
      p.secondaries.every((s) => isObj(s) && isStr(s.name) && isTurns(s.per_turn) && isInt(s.total)),
    `champ « secondaries » invalide (${TOURS} valeurs entières positives attendues par tour).`
  );
  need(isInt(p.secondaries_total), 'champ « secondaries_total » invalide.');
  need(isInt(p.battle_ready), 'champ « battle_ready » invalide.');
  need(isInt(p.battle_points), 'champ « battle_points » invalide.');
  need(
    Array.isArray(p.points_by_turn) &&
      p.points_by_turn.length === TOURS &&
      p.points_by_turn.every(
        (t) =>
          isObj(t) && ['tour', 'primaire', 'secondaires', 'total', 'cumul'].every((k) => isInt(t[k]))
      ),
    `champ « points_by_turn » invalide (${TOURS} entrées attendues).`
  );
}

/** Structure d'un fichier « partie ». Renvoie les erreurs bloquantes (vide = valide). */
export function checkPartieStructure(obj) {
  const errors = [];
  if (!checkHeader(obj, 'partie', errors)) return errors;
  const need = (c, m) => c || errors.push(m);
  need(isValidDate(obj.game_date), 'Champ « game_date » absent ou invalide (format AAAA-MM-JJ attendu).');
  if (obj.edition !== EDITION) {
    errors.push(`Édition ${JSON.stringify(obj.edition ?? null)} non traitée : seules les parties ${EDITION} sont acceptées.`);
  }
  for (const k of ['rules_source', 'mission_pack', 'deployment', 'special_rules'])
    need(isStrOrNull(obj[k]), `Champ « ${k} » invalide.`);
  need(
    Array.isArray(obj.missions) && obj.missions.length === 2 && obj.missions.every(isStr),
    'Champ « missions » invalide (2 valeurs attendues).'
  );
  need(Array.isArray(obj.warnings) && obj.warnings.every(isStr), 'Champ « warnings » invalide.');
  if (!Array.isArray(obj.players) || obj.players.length !== 2) errors.push('Deux joueurs sont attendus.');
  else obj.players.forEach((p, i) => checkPlayerStructure(p, i, errors));
  return errors;
}

/** Copie de travail d'une partie valide + avertissements du fichier. */
export function normalizePartie(obj) {
  const s = (v) => v ?? '';
  const partie = structuredClone({
    game_date: obj.game_date,
    edition: obj.edition,
    rules_source: s(obj.rules_source),
    mission_pack: s(obj.mission_pack),
    deployment: s(obj.deployment),
    special_rules: s(obj.special_rules),
    missions: obj.missions,
    players: obj.players,
  });
  return { partie, fileWarnings: [...obj.warnings] };
}

// ---------------------------------------------------------------- Calculs

const toInt = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
const turns = (a) => Array.from({ length: TOURS }, (_, i) => toInt(a?.[i]));

/** Recalcule tout ce qui dérive des valeurs brutes d'un joueur (règles de valider_synthese.py). */
export function computePlayer(p) {
  const primaryRaw = turns(p.primary.per_turn);
  const primaryCapped = primaryRaw.map((v) => Math.min(v, CAP_TURN));
  const primaryTotal = Math.min(sum(primaryCapped), CAP_GAME);

  let secSumByTurn = Array(TOURS).fill(0);
  const secondaryTotals = [];
  for (const s of p.secondaries) {
    const vals = turns(s.per_turn);
    secondaryTotals.push(sum(vals));
    secSumByTurn = secSumByTurn.map((a, i) => a + vals[i]);
  }
  const secCapped = secSumByTurn.map((v) => Math.min(v, CAP_TURN));
  const secondariesTotal = Math.min(sum(secCapped), CAP_GAME);

  const battleReady = Number.isFinite(p.battle_ready) ? p.battle_ready : 0;
  const battlePoints = primaryTotal + secondariesTotal + battleReady;

  let cp = 0;
  let cs = 0;
  const pointsByTurn = [];
  for (let t = 0; t < TOURS; t++) {
    cp = Math.min(cp + primaryCapped[t], CAP_GAME);
    cs = Math.min(cs + secCapped[t], CAP_GAME);
    pointsByTurn.push({
      tour: t + 1,
      primaire: primaryCapped[t],
      secondaires: secCapped[t],
      total: primaryCapped[t] + secCapped[t],
      cumul: cp + cs,
    });
  }
  return {
    primaryRaw,
    primaryRawTotal: sum(primaryRaw),
    primaryTotal,
    secondaryTotals,
    secondariesTotal,
    battleReady,
    battlePoints,
    pointsByTurn,
  };
}

/** Renvoie une copie de la partie dont toutes les valeurs dérivées sont recalculées. */
export function applyDerived(partie) {
  const out = structuredClone(partie);
  for (const p of out.players) {
    const d = computePlayer(p);
    p.primary.per_turn = d.primaryRaw;
    p.primary.raw_total = d.primaryRawTotal;
    p.primary.total = d.primaryTotal;
    p.secondaries.forEach((s, i) => {
      s.per_turn = turns(s.per_turn);
      s.total = d.secondaryTotals[i];
    });
    p.secondaries_total = d.secondariesTotal;
    p.battle_points = d.battlePoints;
    p.points_by_turn = d.pointsByTurn;
  }
  return out;
}

/** Valeurs dérivées « déclarées » par le fichier, pour les comparer au recalcul. */
export function declaredSnapshot(partie) {
  return partie.players.map((p) => ({
    name: p.name,
    raw_total: p.primary.raw_total,
    total: p.primary.total,
    secondaries: p.secondaries.map((s) => s.total),
    secondaries_total: p.secondaries_total,
    battle_points: p.battle_points,
    points_by_turn: p.points_by_turn.map((t) => ({ ...t })),
  }));
}

const TURN_KEYS = [
  ['primaire', 'primaire'],
  ['secondaires', 'secondaires'],
  ['total', 'total'],
  ['cumul', 'cumul'],
];

/** Écarts entre les valeurs déclarées et le recalcul à partir des valeurs brutes actuelles. */
export function compareDeclared(declared, partie) {
  const out = [];
  partie.players.forEach((p, i) => {
    const d = declared?.[i];
    if (!d) return;
    const c = computePlayer(p);
    const nom = p.name;
    if (d.raw_total !== c.primaryRawTotal)
      out.push(`${nom} : somme brute primaire déclarée ${d.raw_total}, recalculée ${c.primaryRawTotal}.`);
    if (d.total !== c.primaryTotal)
      out.push(`${nom} : total primaire déclaré ${d.total}, recalculé ${c.primaryTotal}.`);
    if (d.secondaries.length === p.secondaries.length) {
      p.secondaries.forEach((s, k) => {
        if (d.secondaries[k] !== c.secondaryTotals[k])
          out.push(`${nom} : total de « ${s.name} » déclaré ${d.secondaries[k]}, recalculé ${c.secondaryTotals[k]}.`);
      });
    }
    if (d.secondaries_total !== c.secondariesTotal)
      out.push(`${nom} : total secondaires déclaré ${d.secondaries_total}, recalculé ${c.secondariesTotal}.`);
    if (d.battle_points !== c.battlePoints)
      out.push(`${nom} : points de bataille déclarés ${d.battle_points}, recalculés ${c.battlePoints}.`);
    d.points_by_turn.forEach((dt, t) => {
      const ct = c.pointsByTurn[t];
      for (const [key, label] of TURN_KEYS)
        if (dt[key] !== ct[key])
          out.push(`${nom} : tour ${t + 1}, ${label} déclaré ${dt[key]}, recalculé ${ct[key]}.`);
    });
  });
  return out;
}

export function issue(own, other) {
  if (own > other) return 'victory';
  if (own === other) return 'draw';
  return 'defeat';
}

/** Règles de cohérence indépendantes des valeurs déclarées. */
export function checkCoherence(partie) {
  const out = [];
  const ps = partie.players;
  if (!isValidDate(partie.game_date)) out.push('Date de partie invalide (format AAAA-MM-JJ attendu).');
  if (ps.some((p) => !String(p.name).trim())) out.push('Le pseudo d\'un joueur est vide.');
  if (ps.filter((p) => p.is_me).length !== 1) out.push('Exactement un joueur doit être marqué comme « moi ».');
  if (ps.filter((p) => p.went_first).length !== 1) out.push('Exactement un joueur doit avoir commencé la partie.');
  partie.missions.forEach((m, i) => {
    if (ps[i] && m !== ps[i].primary.name)
      out.push(`Mission « ${m} » différente de l'objectif primaire « ${ps[i].primary.name} » de ${ps[i].name}.`);
  });
  for (const p of ps)
    if (!BATTLE_READY_VALUES.includes(p.battle_ready))
      out.push(`${p.name} : Battle Ready doit valoir 0 ou 10 (reçu ${p.battle_ready}).`);
  const [a, b] = ps;
  for (const [p, own, other] of [
    [a, a.tournament_score, b.tournament_score],
    [b, b.tournament_score, a.tournament_score],
  ]) {
    const attendu = issue(own, other);
    if (p.tournament_result !== attendu)
      out.push(
        `${p.name} : issue « ${RESULT_LABELS[p.tournament_result] ?? p.tournament_result} » incohérente avec le score ${own}-${other} (attendu : « ${RESULT_LABELS[attendu]} »).`
      );
  }
  return out;
}

/** Tous les écarts qui bloquent l'enregistrement à l'import. */
export function checkPartie(partie, declared) {
  return [...checkCoherence(partie), ...(declared ? compareDeclared(declared, partie) : [])];
}

// ---------------------------------------------------------------- Doublons

const norm = (s) => String(s).trim().toLowerCase();
const playersKey = (p) => p.players.map((x) => norm(x.name)).sort().join('|');

/** Parties déjà enregistrées ayant la même date et les mêmes deux pseudos. */
export function findDuplicateParties(partie, parties, excludeId = null) {
  const key = playersKey(partie);
  return parties.filter(
    (x) => x.id !== excludeId && x.game_date === partie.game_date && playersKey(x) === key
  );
}
