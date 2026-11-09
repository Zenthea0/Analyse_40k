import { Field, TextInput, NumInput, Check, ParsedTextarea } from './ui.jsx';
import { sum } from '../lib/validation.js';
import { OPTION_TYPES } from '../lib/constants.js';
import { formatCountLines, parseCountLines, parseLines } from '../lib/format.js';

function nextUnitId(units) {
  const max = units.reduce((m, u) => Math.max(m, Number(String(u.id).replace(/\D/g, '')) || 0), 0);
  return `u${String(max + 1).padStart(2, '0')}`;
}

/** Édition d'une liste (import ou correction avant la première partie). */
export default function ListeEditor({ liste, onChange }) {
  const update = (fn) => {
    const next = structuredClone(liste);
    fn(next);
    onChange(next);
  };
  const byId = new Map(liste.units.map((u) => [u.id, u]));
  const summed = sum(liste.units.map((u) => u.points || 0));

  return (
    <div>
      <Field label="Nom de la liste">
        <TextInput value={liste.name} onChange={(v) => update((l) => (l.name = v))} />
      </Field>
      <Field label="Faction">
        <TextInput value={liste.faction} onChange={(v) => update((l) => (l.faction = v))} />
      </Field>
      <Field label="Détachements (un par ligne)">
        <ParsedTextarea
          initial={liste.detachments.join('\n')}
          parse={parseLines}
          onValid={(items) => update((l) => (l.detachments = items))}
          rows={2}
          label="Détachements"
        />
      </Field>
      <Field label="Disposition stratégique">
        <TextInput value={liste.strategy} onChange={(v) => update((l) => (l.strategy = v))} />
      </Field>
      <div className="row2">
        <Field label="Taille de bataille">
          <NumInput value={liste.battle_size} label="Taille de bataille" onChange={(v) => update((l) => (l.battle_size = v))} />
        </Field>
        <Field label="Total de l'en-tête">
          <NumInput value={liste.total_points} label="Total de l'en-tête" onChange={(v) => update((l) => (l.total_points = v))} />
        </Field>
      </div>
      <p className="readout">
        Somme des unités : <b>{summed}</b> pts · {liste.units.length} unité(s)
      </p>

      <h2>Unités</h2>
      {liste.units.map((u) => (
        <details className="acc" key={u.id}>
          <summary>
            <span className="wrap">
              {u.warlord ? '★ ' : ''}
              {u.name || 'Sans nom'} · {u.points ?? '?'} pts
            </span>
          </summary>
          <div className="acc-body">
            <Field label="Nom">
              <TextInput value={u.name} onChange={(v) => update((l) => (l.units.find((x) => x.id === u.id).name = v))} />
            </Field>
            <div className="row2">
              <Field label="Points">
                <NumInput value={u.points} label="Points" onChange={(v) => update((l) => (l.units.find((x) => x.id === u.id).points = v))} />
              </Field>
              <Field label="Type">
                <TextInput
                  value={u.unit_type}
                  placeholder="Personnage…"
                  onChange={(v) => update((l) => (l.units.find((x) => x.id === u.id).unit_type = v.trim() ? v : null))}
                />
              </Field>
            </div>
            <Field label="Rôle d'attachement">
              <TextInput
                value={u.role}
                placeholder="Meneur, Gardes du Corps, Appui…"
                onChange={(v) => update((l) => (l.units.find((x) => x.id === u.id).role = v.trim() ? v : null))}
              />
            </Field>
            <Check
              checked={u.warlord}
              onChange={(c) =>
                update((l) => {
                  l.units.forEach((x) => (x.warlord = c && x.id === u.id));
                })
              }
            >
              Seigneur de guerre
            </Check>
            <Field label="Figurines (une ligne « 5x Nom »)">
              <ParsedTextarea
                key={`${u.id}-m`}
                initial={formatCountLines(u.models)}
                parse={parseCountLines}
                onValid={(items) => update((l) => (l.units.find((x) => x.id === u.id).models = items))}
                rows={2}
                label="Figurines"
              />
            </Field>
            <Field label="Équipement (une ligne « 2x Nom »)">
              <ParsedTextarea
                key={`${u.id}-w`}
                initial={formatCountLines(u.wargear)}
                parse={parseCountLines}
                onValid={(items) => update((l) => (l.units.find((x) => x.id === u.id).wargear = items))}
                rows={4}
                label="Équipement"
              />
            </Field>
            <div className="field-label">Optimisations et améliorations</div>
            {u.options.map((o, i) => (
              <div key={i} className="row2" style={{ gridTemplateColumns: '1fr 1.4fr auto', marginTop: 6 }}>
                <select
                  className="input"
                  aria-label="Type"
                  value={o.type}
                  onChange={(e) => update((l) => (l.units.find((x) => x.id === u.id).options[i].type = e.target.value))}
                >
                  {OPTION_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <TextInput
                  aria-label="Nom"
                  value={o.name}
                  onChange={(v) => update((l) => (l.units.find((x) => x.id === u.id).options[i].name = v))}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-label="Supprimer cette option"
                  onClick={() => update((l) => l.units.find((x) => x.id === u.id).options.splice(i, 1))}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="actions">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => update((l) => l.units.find((x) => x.id === u.id).options.push({ type: 'optimisation', name: '' }))}
              >
                + Option
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() =>
                  update((l) => {
                    l.units = l.units.filter((x) => x.id !== u.id);
                    l.attached_groups.forEach((g) => (g.members = g.members.filter((m) => m !== u.id)));
                    l.attached_groups = l.attached_groups.filter((g) => g.members.length > 0);
                  })
                }
              >
                Supprimer l'unité
              </button>
            </div>
          </div>
        </details>
      ))}
      <button
        type="button"
        className="btn btn-block"
        onClick={() =>
          update((l) =>
            l.units.push({
              id: nextUnitId(l.units),
              name: '',
              points: 0,
              role: null,
              unit_type: null,
              warlord: false,
              models: [],
              wargear: [],
              options: [],
            })
          )
        }
      >
        + Ajouter une unité
      </button>

      {liste.attached_groups.length > 0 && (
        <>
          <h2>Unités attachées</h2>
          <div className="card-sub">
            {liste.attached_groups.map((g) => (
              <p key={g.group}>
                <b>{g.group}</b> : {g.members.map((m) => byId.get(m)?.name ?? m).join(' + ')}
              </p>
            ))}
            <p>Les rattachements viennent de l'export et ne se modifient pas ici.</p>
          </div>
        </>
      )}
    </div>
  );
}
