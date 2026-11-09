// Aides d'affichage.

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export const getMe = (partie) => partie.players.find((p) => p.is_me) ?? partie.players[0];
export const getOpp = (partie) => {
  const me = getMe(partie);
  return partie.players.find((p) => p !== me) ?? partie.players[1];
};

/**
 * Libellé lisible de chaque unité d'une liste. Les noms pouvant être en double
 * (deux « Khorne Berzerkers »), on ajoute les points et l'unité attachée, puis un
 * numéro si deux libellés restent identiques (deux « Chaos Rhino » à 75 pts).
 */
export function unitLabels(liste) {
  const byId = new Map(liste.units.map((u) => [u.id, u]));
  const mates = new Map();
  for (const g of liste.attached_groups)
    for (const id of g.members)
      mates.set(
        id,
        g.members
          .filter((m) => m !== id)
          .map((m) => byId.get(m)?.name)
          .filter(Boolean)
      );
  const base = liste.units.map((u) => {
    const m = mates.get(u.id) ?? [];
    return { id: u.id, label: `${u.name} · ${u.points ?? '?'} pts${m.length ? ` · avec ${m.join(', ')}` : ''}` };
  });
  const counts = {};
  for (const b of base) counts[b.label] = (counts[b.label] || 0) + 1;
  const seen = {};
  return new Map(
    base.map((b) => {
      if (counts[b.label] > 1) {
        seen[b.label] = (seen[b.label] || 0) + 1;
        return [b.id, `${b.label} · n°${seen[b.label]}`];
      }
      return [b.id, b.label];
    })
  );
}

export function parseCountLines(text) {
  const items = [];
  const errors = [];
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((l, i) => {
      const m = l.match(/^(\d+)\s*[x×]\s*(.+)$/i);
      if (!m) errors.push(`Ligne ${i + 1} : format attendu « 2x Nom ».`);
      else items.push({ count: Number(m[1]), name: m[2].trim() });
    });
  return { items, errors };
}

export const formatCountLines = (items) => items.map((i) => `${i.count}x ${i.name}`).join('\n');

export function parseLines(text) {
  return { items: text.split('\n').map((l) => l.trim()).filter(Boolean), errors: [] };
}
