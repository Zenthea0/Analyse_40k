import { Field, TextInput, NumInput, Segmented } from './ui.jsx';
import { applyDerived, computePlayer } from '../lib/validation.js';
import { RESULT_LABELS, BATTLE_READY_VALUES, TOURS } from '../lib/constants.js';

const RESULT_OPTIONS = Object.entries(RESULT_LABELS).map(([value, label]) => ({ value, label }));

function TurnInputs({ values, onChange, label }) {
  return (
    <div className="turns">
      {Array.from({ length: TOURS }, (_, i) => (
        <label key={i}>
          T{i + 1}
          <NumInput
            value={values[i]}
            label={`${label} tour ${i + 1}`}
            onChange={(v) => {
              const next = [...values];
              next[i] = v;
              onChange(next);
            }}
          />
        </label>
      ))}
    </div>
  );
}

function PlayerBlock({ p, idx, update }) {
  const d = computePlayer(p);
  const title = `${p.is_me ? 'Moi' : 'Adversaire'} · ${p.name || '…'}`;
  return (
    <details className="acc">
      <summary>
        <span className="wrap">
          {title} <span className="muted small">· {d.battlePoints} pts de bataille</span>
        </span>
      </summary>
      <div className="acc-body">
        <Field label="Pseudo">
          <TextInput value={p.name} onChange={(v) => update((x) => (x.players[idx].name = v))} />
        </Field>
        <div className="row2">
          <Field label="Faction">
            <TextInput value={p.faction} onChange={(v) => update((x) => (x.players[idx].faction = v))} />
          </Field>
          <Field label="Disposition">
            <TextInput value={p.disposition} onChange={(v) => update((x) => (x.players[idx].disposition = v))} />
          </Field>
        </div>
        <div className="row2">
          <Field label="Score de tournoi">
            <NumInput value={p.tournament_score} label="Score de tournoi" onChange={(v) => update((x) => (x.players[idx].tournament_score = v))} />
          </Field>
          <Field label="Issue">
            <select
              className="input"
              value={p.tournament_result}
              onChange={(e) => update((x) => (x.players[idx].tournament_result = e.target.value))}
            >
              {RESULT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="sub-block">
          <Field label="Objectif primaire">
            <TextInput value={p.primary.name} onChange={(v) => update((x) => (x.players[idx].primary.name = v))} />
          </Field>
          <TurnInputs
            values={p.primary.per_turn}
            label="Primaire"
            onChange={(vals) => update((x) => (x.players[idx].primary.per_turn = vals))}
          />
          <p className="readout">
            Brut <b>{d.primaryRawTotal}</b> → plafonné (15 par tour, 45 au total) <b>{d.primaryTotal}</b>
          </p>
        </div>

        <div className="sub-block">
          <div className="field-label">Objectifs secondaires</div>
          {p.secondaries.map((s, k) => (
            <div key={k} className="sec-row">
              <div className="row2" style={{ gridTemplateColumns: '1fr auto' }}>
                <TextInput
                  aria-label="Nom du secondaire"
                  value={s.name}
                  onChange={(v) => update((x) => (x.players[idx].secondaries[k].name = v))}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-label={`Supprimer ${s.name || 'ce secondaire'}`}
                  onClick={() => update((x) => x.players[idx].secondaries.splice(k, 1))}
                >
                  ✕
                </button>
              </div>
              <div style={{ marginTop: 6 }}>
                <TurnInputs
                  values={s.per_turn}
                  label={s.name || 'Secondaire'}
                  onChange={(vals) => update((x) => (x.players[idx].secondaries[k].per_turn = vals))}
                />
              </div>
              <div className="readout">Total : <b>{d.secondaryTotals[k]}</b></div>
            </div>
          ))}
          <div className="actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() =>
                update((x) => x.players[idx].secondaries.push({ name: '', per_turn: [0, 0, 0, 0, 0], total: 0 }))
              }
            >
              + Secondaire
            </button>
          </div>
          <p className="readout">
            Somme plafonnée (15 par tour, 45 au total) <b>{d.secondariesTotal}</b>
          </p>
        </div>

        <div className="sub-block">
          <Field label="Battle Ready">
            <select
              className="input"
              value={p.battle_ready}
              onChange={(e) => update((x) => (x.players[idx].battle_ready = Number(e.target.value)))}
            >
              {BATTLE_READY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <p className="readout">
            Primaire <b>{d.primaryTotal}</b> + secondaires <b>{d.secondariesTotal}</b> + Battle Ready <b>{d.battleReady}</b> ={' '}
            <b>{d.battlePoints}</b> points de bataille
          </p>
        </div>
      </div>
    </details>
  );
}

/**
 * Édition complète d'une partie. Chaque modification recalcule toutes les valeurs dérivées
 * (totaux, plafonds, points de bataille, points par tour) via applyDerived.
 */
export default function PartieEditor({ partie, onChange }) {
  const update = (fn) => {
    const next = structuredClone(partie);
    fn(next);
    onChange(applyDerived(next));
  };
  const names = partie.players.map((p, i) => ({ value: i, label: p.name || `Joueur ${i + 1}` }));
  const meIdx = partie.players.findIndex((p) => p.is_me);
  const firstIdx = partie.players.findIndex((p) => p.went_first);

  return (
    <div>
      <details className="acc" open>
        <summary>Informations générales</summary>
        <div className="acc-body">
          <Field label="Date de la partie">
            <input
              className="input"
              type="date"
              value={partie.game_date}
              onChange={(e) => update((x) => (x.game_date = e.target.value))}
            />
          </Field>
          <Field label="Qui es-tu ?">
            <Segmented
              label="Joueur correspondant à moi"
              value={meIdx}
              options={names}
              onChange={(i) => update((x) => x.players.forEach((p, k) => (p.is_me = k === i)))}
            />
          </Field>
          <Field label="Qui a commencé ?">
            <Segmented
              label="Joueur ayant commencé"
              value={firstIdx}
              options={names}
              onChange={(i) => update((x) => x.players.forEach((p, k) => (p.went_first = k === i)))}
            />
          </Field>
          <div className="row2">
            <Field label="Déploiement">
              <TextInput value={partie.deployment} onChange={(v) => update((x) => (x.deployment = v))} />
            </Field>
            <Field label="Pack de missions">
              <TextInput value={partie.mission_pack} onChange={(v) => update((x) => (x.mission_pack = v))} />
            </Field>
          </div>
          <div className="row2">
            <Field label="Source des règles">
              <TextInput value={partie.rules_source} onChange={(v) => update((x) => (x.rules_source = v))} />
            </Field>
            <Field label="Règles spéciales">
              <TextInput value={partie.special_rules} onChange={(v) => update((x) => (x.special_rules = v))} />
            </Field>
          </div>
          {partie.missions.map((m, i) => (
            <Field key={i} label={`Mission de ${partie.players[i]?.name || `joueur ${i + 1}`}`}>
              <TextInput value={m} onChange={(v) => update((x) => (x.missions[i] = v))} />
            </Field>
          ))}
          <p className="muted small">Édition {partie.edition}</p>
        </div>
      </details>

      {partie.players.map((p, i) => (
        <PlayerBlock key={i} p={p} idx={i} update={update} />
      ))}
    </div>
  );
}
