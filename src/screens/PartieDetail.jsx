import { useState } from 'react';
import { Screen, ResultBadge, TypeBadge, Notice, NoticeList, Field } from '../components/ui.jsx';
import PartieEditor from '../components/PartieEditor.jsx';
import ProgressChart from '../components/ProgressChart.jsx';
import ExtrasForm, { extrasFromPartie } from '../components/ExtrasForm.jsx';
import { useData } from '../data.jsx';
import { formatDate, getMe, getOpp, unitLabels } from '../lib/format.js';
import { checkCoherence, applyDerived } from '../lib/validation.js';
import { updatePartie, deletePartie } from '../lib/store.js';
import { ARCHETYPES } from '../lib/constants.js';

export default function PartieDetail({ id }) {
  const { parties, listes, loading } = useData();
  const partie = parties.find((p) => p.id === Number(id));
  if (loading) return <Screen title="Partie" back="#/parties"><p className="muted">Chargement…</p></Screen>;
  if (!partie)
    return (
      <Screen title="Partie introuvable" back="#/parties">
        <p>Cette partie n'existe pas (ou plus).</p>
      </Screen>
    );
  const liste = listes.find((l) => l.id === partie.liste_id);
  return <Inner key={partie.id} partie={partie} liste={liste} listes={listes} />;
}

function Inner({ partie, liste, listes }) {
  const { reload } = useData();
  const [editing, setEditing] = useState(false);
  const me = getMe(partie);
  const opp = getOpp(partie);

  if (editing)
    return (
      <Edit
        partie={partie}
        listes={listes}
        onDone={async (changed) => {
          if (changed) await reload();
          setEditing(false);
        }}
      />
    );

  return (
    <Screen title={`${formatDate(partie.game_date)} · ${opp.name}`} back="#/parties">
      <div className="badges" style={{ marginTop: 0 }}>
        <ResultBadge result={me.tournament_result} />
        <TypeBadge type={partie.game_type} />
        <span className="badge badge-neutral">
          {me.tournament_score}–{opp.tournament_score}
        </span>
      </div>

      <div className="card">
        <dl className="kv">
          <dt>Factions</dt>
          <dd>
            {me.faction} contre {opp.faction}
          </dd>
          <dt>Missions</dt>
          <dd>{partie.missions[0] === partie.missions[1] ? partie.missions[0] : partie.missions.join(' / ')}</dd>
          <dt>Déploiement</dt>
          <dd>{partie.deployment || '—'}</dd>
          <dt>Commencé par</dt>
          <dd>{me.went_first ? 'Moi' : opp.name}</dd>
          <dt>Dispositions</dt>
          <dd>
            {me.disposition} / {opp.disposition}
          </dd>
          <dt>Points de bataille</dt>
          <dd>
            {me.battle_points} contre {opp.battle_points}
          </dd>
        </dl>
      </div>

      <h2>Progression</h2>
      <ProgressChart me={me} opp={opp} />

      <h2>Points par tour</h2>
      <table className="t">
        <thead>
          <tr>
            <th rowSpan="2" className="l">Tour</th>
            <th colSpan="3">{me.name}</th>
            <th colSpan="3">{opp.name}</th>
          </tr>
          <tr>
            <th>Prim.</th>
            <th>Sec.</th>
            <th>Cumul</th>
            <th>Prim.</th>
            <th>Sec.</th>
            <th>Cumul</th>
          </tr>
        </thead>
        <tbody>
          {me.points_by_turn.map((t, i) => {
            const o = opp.points_by_turn[i];
            return (
              <tr key={t.tour}>
                <td className="l">T{t.tour}</td>
                <td>{t.primaire}</td>
                <td>{t.secondaires}</td>
                <td><b>{t.cumul}</b></td>
                <td>{o.primaire}</td>
                <td>{o.secondaires}</td>
                <td><b>{o.cumul}</b></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">
        Plafonds : 15 points par tour et 45 par partie, séparément pour le primaire et les secondaires. Battle Ready
        (+{me.battle_ready} / +{opp.battle_ready}) non réparti par tour.
      </p>

      {[me, opp].map((p) => (
        <details className="acc" key={p.name}>
          <summary>
            <span className="wrap">
              Détail · {p.name} <span className="muted small">(primaire {p.primary.total}, secondaires {p.secondaries_total})</span>
            </span>
          </summary>
          <div className="acc-body">
            <div className="card-sub">
              {p.primary.name} : {p.primary.per_turn.join(' · ')} (brut {p.primary.raw_total}, retenu {p.primary.total})
            </div>
            <div className="sub-block">
              {p.secondaries.map((s, i) => (
                <div className="sec-row" key={i}>
                  <div className="nm">{s.name}</div>
                  <div className="vals">
                    {s.per_turn.map((v, k) => (
                      <span key={k}>{v}</span>
                    ))}
                    <b>{s.total}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      ))}

      <h2>Liste jouée</h2>
      {liste ? (
        <a className="card" href={`#/listes/${liste.id}`}>
          <div className="card-title">{liste.name}</div>
          <div className="card-sub">
            {liste.faction} · {liste.total_points} pts
          </div>
        </a>
      ) : (
        <Notice kind="error">La liste rattachée est introuvable.</Notice>
      )}

      {liste && <Extras partie={partie} liste={liste} />}

      <hr />
      <div className="actions">
        <button type="button" className="btn" onClick={() => setEditing(true)}>
          Modifier les données de la partie
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            if (!window.confirm('Supprimer définitivement cette partie ?')) return;
            await deletePartie(partie.id);
            await reload();
            window.location.hash = '#/parties';
          }}
        >
          Supprimer la partie
        </button>
      </div>
    </Screen>
  );
}

function Extras({ partie, liste }) {
  const { reload } = useData();
  const [value, setValue] = useState(() => extrasFromPartie(partie));
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(extrasFromPartie(partie));
  const same = value.most_useful_unit_id && value.most_useful_unit_id === value.least_useful_unit_id;
  const names = unitLabels(liste);
  const arch = ARCHETYPES.find((a) => a.value === partie.opponent_archetype)?.label;

  return (
    <>
      <h2>Informations complémentaires</h2>
      {!dirty && (
        <div className="card-sub">
          <p>Plus utile : {partie.most_useful_unit_id ? names.get(partie.most_useful_unit_id) : '—'}</p>
          <p>Moins utile : {partie.least_useful_unit_id ? names.get(partie.least_useful_unit_id) : '—'}</p>
          <p>Archétype adverse : {arch ?? '—'}</p>
        </div>
      )}
      <details className="acc">
        <summary>Modifier</summary>
        <div className="acc-body">
          <ExtrasForm
            liste={liste}
            value={value}
            onChange={(v) => {
              setValue(v);
              setOk(false);
            }}
          />
          {error && <Notice kind="error">{error}</Notice>}
          {ok && <Notice kind="ok">Enregistré.</Notice>}
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!dirty || !value.game_type || !!same}
              onClick={async () => {
                try {
                  setError(null);
                  await updatePartie(partie.id, { ...partie, ...value });
                  await reload();
                  setOk(true);
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </details>
    </>
  );
}

function Edit({ partie, listes, onDone }) {
  const [draft, setDraft] = useState(() => structuredClone(partie));
  const [error, setError] = useState(null);
  const warnings = checkCoherence(draft);

  return (
    <Screen title="Modifier la partie">
      <p className="muted small">
        Les totaux sont recalculés à chaque modification. Les incohérences éventuelles sont signalées mais n'empêchent pas
        l'enregistrement.
      </p>
      <NoticeList kind="warn" title="Points d'attention" items={warnings} />
      <Field label="Liste jouée">
        <select
          className="input"
          value={draft.liste_id}
          onChange={(e) =>
            setDraft({
              ...draft,
              liste_id: Number(e.target.value),
              most_useful_unit_id: null,
              least_useful_unit_id: null,
            })
          }
        >
          {listes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
      <PartieEditor partie={draft} onChange={setDraft} />
      {error && <Notice kind="error">{error}</Notice>}
      <div className="actions">
        <button type="button" className="btn" onClick={() => onDone(false)}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            try {
              await updatePartie(partie.id, applyDerived(draft));
              onDone(true);
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Enregistrer
        </button>
      </div>
    </Screen>
  );
}
