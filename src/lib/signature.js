// Identité d'une liste : deux listes au contenu identique sont la même liste ;
// la moindre modification en fait une autre liste (pas de notion de version).

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sortedCounted = (arr) => arr.map((x) => `${x.count}|${x.name}`).sort(cmp);
const sortedOptions = (arr) => arr.map((o) => `${o.type}|${o.name}`).sort(cmp);

function unitKey(u) {
  return JSON.stringify([
    u.name,
    u.points ?? null,
    u.role ?? null,
    u.unit_type ?? null,
    !!u.warlord,
    sortedCounted(u.models),
    sortedCounted(u.wargear),
    sortedOptions(u.options),
  ]);
}

// Hash 53 bits (cyrb53) : suffisant pour comparer quelques dizaines de listes.
function cyrb53(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Signature du contenu (hors nom, hors versions de l'export, hors libellés de groupes). */
export function listeSignature(l) {
  const byId = new Map(l.units.map((u) => [u.id, unitKey(u)]));
  const groups = l.attached_groups
    .map((g) => g.members.map((m) => byId.get(m) ?? `?${m}`).sort(cmp).join('+'))
    .sort(cmp);
  const canonical = JSON.stringify({
    faction: l.faction.trim(),
    detachments: l.detachments.map((d) => d.trim()).sort(cmp),
    strategy: l.strategy.trim(),
    battle_size: l.battle_size ?? null,
    units: [...byId.values()].sort(cmp),
    groups,
  });
  return cyrb53(canonical);
}

const normName = (s) => String(s).trim().toLowerCase();

/**
 * Compare une liste à celles déjà enregistrées.
 * - duplicateOf : liste de même contenu (on propose de la réutiliser)
 * - nameConflict : liste de même nom mais de contenu différent (renommage obligatoire)
 */
export function analyseListe(liste, existing, excludeId = null) {
  const signature = listeSignature(liste);
  const others = existing.filter((l) => l.id !== excludeId);
  const sigOf = (l) => l.signature ?? listeSignature(l);
  const duplicateOf = others.find((l) => sigOf(l) === signature) ?? null;
  const nameConflict =
    others.find((l) => normName(l.name) === normName(liste.name) && sigOf(l) !== signature) ?? null;
  return { signature, duplicateOf, nameConflict };
}
