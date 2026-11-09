import { Field, Segmented, TextInput } from './ui.jsx';
import { useData } from '../data.jsx';
import { GAME_TYPES, ARCHETYPES } from '../lib/constants.js';
import { unitLabels } from '../lib/format.js';

/**
 * Informations saisies à la main pour chaque partie :
 * type (obligatoire), unité la plus / la moins utile, archétype adverse, étiquettes personnalisées.
 * value = { game_type, most_useful_unit_id, least_useful_unit_id, opponent_archetype, labels }
 */
export default function ExtrasForm({ liste, value, onChange }) {
  const { labels } = useData();
  const names = unitLabels(liste);
  const set = (patch) => onChange({ ...value, ...patch });
  const unitOptions = (
    <>
      <option value="">— Aucune —</option>
      {liste.units.map((u) => (
        <option key={u.id} value={u.id}>
          {names.get(u.id)}
        </option>
      ))}
    </>
  );
  const same = value.most_useful_unit_id && value.most_useful_unit_id === value.least_useful_unit_id;

  return (
    <div>
      <Field label="Type de partie (obligatoire)">
        <Segmented
          label="Type de partie"
          value={value.game_type}
          options={GAME_TYPES}
          onChange={(v) => set({ game_type: v })}
        />
      </Field>
      <Field label="Unité la plus utile (facultatif)">
        <select
          className="input"
          value={value.most_useful_unit_id ?? ''}
          onChange={(e) => set({ most_useful_unit_id: e.target.value || null })}
        >
          {unitOptions}
        </select>
      </Field>
      <Field label="Unité la moins utile (facultatif)">
        <select
          className="input"
          value={value.least_useful_unit_id ?? ''}
          onChange={(e) => set({ least_useful_unit_id: e.target.value || null })}
        >
          {unitOptions}
        </select>
      </Field>
      {same && (
        <p className="field-hint" style={{ color: 'var(--loss)' }}>
          L'unité la plus utile et la moins utile doivent être différentes.
        </p>
      )}
      <Field label="Archétype de la liste adverse (facultatif)">
        <select
          className="input"
          value={value.opponent_archetype ?? ''}
          onChange={(e) => set({ opponent_archetype: e.target.value || null })}
        >
          <option value="">— Non renseigné —</option>
          {ARCHETYPES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>
      {labels.map((l) => (
        <Field key={l.id} label={`Étiquette « ${l.name} »`}>
          <TextInput
            value={value.labels?.[l.id] ?? ''}
            placeholder="Valeur libre"
            onChange={(v) => {
              const next = { ...(value.labels ?? {}) };
              if (v.trim()) next[l.id] = v;
              else delete next[l.id];
              set({ labels: next });
            }}
          />
        </Field>
      ))}
    </div>
  );
}

export const emptyExtras = () => ({
  game_type: null,
  most_useful_unit_id: null,
  least_useful_unit_id: null,
  opponent_archetype: null,
  labels: {},
});

export const extrasFromPartie = (p) => ({
  game_type: p.game_type ?? null,
  most_useful_unit_id: p.most_useful_unit_id ?? null,
  least_useful_unit_id: p.least_useful_unit_id ?? null,
  opponent_archetype: p.opponent_archetype ?? null,
  labels: p.labels ?? {},
});
